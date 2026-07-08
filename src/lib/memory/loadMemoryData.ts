import { sampleMemoryData } from './sampleData'
import type {
  MediaManifestItem,
  MemoryData,
  MemoryDataLoadSnapshot,
  MemoryMessage,
  MessageType,
  RecapData,
} from './types'

interface MessageChunkManifest {
  chunkSize: number
  renderedRowCount: number
  messageCount: number
  chunks: MessageChunk[]
}

interface MessageChunk {
  path: string
  count: number
  start: string | null
  end: string | null
}

const messageTypes = new Set<MessageType>([
  'text',
  'image',
  'video',
  'audio',
  'document',
  'sticker',
  'call',
  'deleted',
  'system',
])
const progressiveListeners = new Set<(snapshot: MemoryDataLoadSnapshot) => void>()
let progressiveSnapshot: MemoryDataLoadSnapshot | null = null
let progressiveLoadPromise: Promise<void> | null = null

export async function loadMemoryData(): Promise<MemoryData> {
  let latestData = sampleMemoryData
  await loadMemoryDataProgressively((snapshot) => {
    if (snapshot.complete) {
      latestData = snapshot.data
    }
  })

  return latestData
}

export async function loadMemoryDataProgressively(
  onSnapshot: (snapshot: MemoryDataLoadSnapshot) => void,
): Promise<void> {
  await new Promise<void>((resolve) => {
    let unsubscribe: () => void = () => {}
    unsubscribe = subscribeMemoryDataProgressively((snapshot) => {
      onSnapshot(snapshot)
      if (snapshot.complete || snapshot.loadError) {
        unsubscribe()
        resolve()
      }
    })
  })
}

export function subscribeMemoryDataProgressively(
  onSnapshot: (snapshot: MemoryDataLoadSnapshot) => void,
): () => void {
  if (progressiveSnapshot && progressiveLoadPromise) {
    onSnapshot(progressiveSnapshot)
  }

  if (!progressiveLoadPromise) {
    progressiveSnapshot = null
    progressiveLoadPromise = loadMemoryDataProgressivelyUncached((snapshot) => {
      progressiveSnapshot = snapshot
      for (const listener of progressiveListeners) {
        listener(snapshot)
      }
    }).finally(() => {
      progressiveSnapshot = null
      progressiveLoadPromise = null
    })
  }

  progressiveListeners.add(onSnapshot)

  return () => {
    progressiveListeners.delete(onSnapshot)
  }
}

async function loadMemoryDataProgressivelyUncached(
  onSnapshot: (snapshot: MemoryDataLoadSnapshot) => void,
): Promise<void> {
  const [recapValue, mediaManifestValue] = await Promise.all([
    fetchJson<RecapData>('/memory-data/recap.json'),
    fetchJson<MediaManifestItem[]>('/memory-data/media-manifest.json'),
  ])
  const recap = isValidRecap(recapValue) ? recapValue : sampleMemoryData.recap
  const mediaManifest = isValidMediaManifest(mediaManifestValue) ? mediaManifestValue : []
  const chunkManifest = await fetchJson<MessageChunkManifest>('/memory-data/message-chunks.json')

  if (isValidMessageChunkManifest(chunkManifest)) {
    await loadChunkedMessages(chunkManifest, recap, mediaManifest, onSnapshot)
    return
  }

  const messages = await fetchJson<MemoryMessage[]>('/memory-data/messages.json')
  const data = isValidMessages(messages)
    ? { messages, recap, mediaManifest }
    : sampleMemoryData

  onSnapshot({
    data,
    complete: true,
    loadedRows: data.messages.length,
    totalRows: data.messages.length,
  })
}

async function loadChunkedMessages(
  manifest: MessageChunkManifest,
  recap: RecapData,
  mediaManifest: MediaManifestItem[],
  onSnapshot: (snapshot: MemoryDataLoadSnapshot) => void,
) {
  if (manifest.chunks.length === 0) {
    const complete = manifest.renderedRowCount === 0 && manifest.messageCount === 0
    onSnapshot({
      data: { messages: [], recap, mediaManifest },
      complete,
      loadedRows: 0,
      totalRows: manifest.renderedRowCount,
      loadError: complete ? undefined : 'The archive manifest has no message chunks.',
    })
    return
  }

  const latestChunkIndex = manifest.chunks.length - 1
  const latestMessages = await fetchMessageChunk(manifest.chunks[latestChunkIndex])
  if (!latestMessages) {
    onSnapshot({
      data: { messages: [], recap, mediaManifest },
      complete: false,
      loadedRows: 0,
      totalRows: manifest.renderedRowCount,
      loadError: 'The latest message chunk could not be loaded.',
    })
    return
  }

  const latestOnlyComplete =
    manifest.chunks.length === 1 && latestMessages.length === manifest.renderedRowCount
  onSnapshot({
    data: { messages: latestMessages, recap, mediaManifest },
    complete: latestOnlyComplete,
    loadedRows: latestMessages.length,
    totalRows: manifest.renderedRowCount,
    loadError:
      manifest.chunks.length === 1 && !latestOnlyComplete
        ? 'The message chunk count does not match the archive manifest.'
        : undefined,
  })

  if (manifest.chunks.length === 1) return

  const loadedChunks: MemoryMessage[][] = []
  loadedChunks[latestChunkIndex] = latestMessages
  let loadedRows = latestMessages.length
  let missingChunkCount = 0

  for (let index = latestChunkIndex - 1; index >= 0; index -= 1) {
    const messages = await fetchMessageChunk(manifest.chunks[index])
    if (!messages) {
      missingChunkCount += 1
      continue
    }

    loadedChunks[index] = messages
    loadedRows += messages.length
    onSnapshot({
      data: { messages: latestMessages, recap, mediaManifest },
      complete: false,
      loadedRows,
      totalRows: manifest.renderedRowCount,
    })
    await yieldToBrowser()
  }

  const messages = loadedChunks.flat()
  const complete = missingChunkCount === 0 && loadedRows === manifest.renderedRowCount
  onSnapshot({
    data: { messages: complete ? messages : latestMessages, recap, mediaManifest },
    complete,
    loadedRows,
    totalRows: manifest.renderedRowCount,
    loadError: complete ? undefined : 'Some archive chunks could not be loaded.',
  })
}

async function fetchMessageChunk(chunk: MessageChunk | undefined): Promise<MemoryMessage[] | null> {
  if (!chunk) return null

  const messages = await fetchJson<MemoryMessage[]>(chunk.path)
  if (!isValidMessages(messages) || messages.length !== chunk.count) return null

  return messages
}

function isValidMessages(value: unknown): value is MemoryMessage[] {
  return (
    Array.isArray(value) &&
    value.every(
      (message) =>
        isRecord(message) &&
        typeof message.id === 'string' &&
        typeof message.timestamp === 'string' &&
        typeof message.dateKey === 'string' &&
        (typeof message.sender === 'string' || message.sender === null) &&
        typeof message.text === 'string' &&
        isMessageType(message.type) &&
        (typeof message.mediaRef === 'string' || message.mediaRef === null) &&
        (message.edited === undefined || typeof message.edited === 'boolean'),
    )
  )
}

function isMessageType(value: unknown): value is MessageType {
  return typeof value === 'string' && messageTypes.has(value as MessageType)
}

function isValidRecap(value: unknown): value is RecapData {
  return (
    isRecord(value) &&
    Array.isArray(value.participants) &&
    typeof value.messageCount === 'number' &&
    isRecord(value.dateRange) &&
    Array.isArray(value.cards)
  )
}

function isValidMediaManifest(value: unknown): value is MediaManifestItem[] {
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        isRecord(item) &&
        typeof item.filename === 'string' &&
        typeof item.path === 'string' &&
        isMessageType(item.type),
    )
  )
}

function isValidMessageChunkManifest(value: unknown): value is MessageChunkManifest {
  return (
    isRecord(value) &&
    typeof value.chunkSize === 'number' &&
    typeof value.renderedRowCount === 'number' &&
    typeof value.messageCount === 'number' &&
    Array.isArray(value.chunks) &&
    value.chunks.every(
      (chunk) =>
        isRecord(chunk) &&
        typeof chunk.path === 'string' &&
        chunk.path.startsWith('/memory-data/message-chunks/') &&
        typeof chunk.count === 'number' &&
        (typeof chunk.start === 'string' || chunk.start === null) &&
        (typeof chunk.end === 'string' || chunk.end === null),
    )
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

async function fetchJson<T>(path: string): Promise<T | null> {
  try {
    const response = await fetch(path, { cache: 'no-store' })
    if (!response.ok) return null
    return (await response.json()) as T
  } catch {
    return null
  }
}

function yieldToBrowser(): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, 0)
  })
}
