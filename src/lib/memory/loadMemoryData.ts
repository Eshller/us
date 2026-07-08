import { sampleMemoryData } from './sampleData'
import type { MediaManifestItem, MemoryData, MemoryMessage, MessageType, RecapData } from './types'

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

export async function loadMemoryData(): Promise<MemoryData> {
  const [messages, recap, mediaManifest] = await Promise.all([
    fetchJson<MemoryMessage[]>('/memory-data/messages.json'),
    fetchJson<RecapData>('/memory-data/recap.json'),
    fetchJson<MediaManifestItem[]>('/memory-data/media-manifest.json'),
  ])

  if (!isValidMessages(messages) || !isValidRecap(recap)) {
    return sampleMemoryData
  }

  return {
    messages,
    recap,
    mediaManifest: isValidMediaManifest(mediaManifest) ? mediaManifest : [],
  }
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
