import AdmZip from 'adm-zip'
import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildRecap } from '../src/lib/recap/buildRecap.ts'
import {
  inferMediaType,
  isSafePreviewMedia,
  parseWhatsAppExportText,
} from '../src/lib/whatsapp/parseExport.ts'
import type { MediaManifestItem, MemoryMessage } from '../src/lib/memory/types.ts'

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outDir = path.join(rootDir, 'public', 'memory-data')
const mediaDir = path.join(outDir, 'media')
const messageChunksDir = path.join(outDir, 'message-chunks')
const privateDataDir = path.join(rootDir, 'private-data')
const importReportPath = path.join(privateDataDir, 'import-report.json')
const maxEntryCount = 2_500
const maxSingleFileBytes = 150 * 1024 * 1024
const maxTotalMediaBytes = 1.5 * 1024 * 1024 * 1024
const messageChunkSize = 5_000

interface ImportReport {
  generatedAt: string
  source: {
    inputFile: string
    dateOrder: 'day-first' | 'month-first'
    rawLineCount: number
  }
  dateRange: {
    start: string | null
    end: string | null
  }
  counts: {
    renderedRows: number
    senderMessages: number
    systemMessages: number
    textMessages: number
    deletedMessages: number
    callMessages: number
    attachmentRows: number
    localPreviewMediaFiles: number
    editedMessages: number
    activeDays: number
    calendarDays: number
  }
  bySender: Array<{ sender: string; count: number }>
  byType: Array<{ type: MemoryMessage['type']; count: number }>
  momentCandidates: Array<{
    reason: string
    messageId: string
    timestamp: string
    sender: string | null
    preview: string
  }>
  reviewChecklist: string[]
}

async function main() {
  const inputPath = process.argv[2]
  const dateOrder = process.argv.includes('--month-first') ? 'month-first' : 'day-first'

  if (!inputPath) {
    throw new Error('Usage: npm run import:whatsapp -- <export.zip|_chat.txt> [--month-first]')
  }

  await rm(outDir, { force: true, recursive: true })
  await mkdir(mediaDir, { recursive: true })
  await mkdir(messageChunksDir, { recursive: true })
  await mkdir(privateDataDir, { recursive: true })

  const input = path.resolve(process.cwd(), inputPath)
  const imported = input.toLowerCase().endsWith('.zip')
    ? await importZip(input)
    : { chatText: await readTextExport(input), mediaManifest: [] }

  const messages = parseWhatsAppExportText(imported.chatText, { dateOrder })
  const recap = buildRecap(messages)
  const messageChunkManifest = await writeMessageChunks(messages, recap.messageCount)
  const importReport = buildImportReport(messages, imported.mediaManifest, {
    inputFile: path.basename(input),
    dateOrder,
    rawLineCount: countRawLines(imported.chatText),
  })
  const realMessageCount = messages.filter(
    (message) => message.sender && message.type !== 'system',
  ).length

  await writeJson(path.join(outDir, 'message-chunks.json'), messageChunkManifest)
  await writeJson(path.join(outDir, 'recap.json'), recap)
  await writeJson(path.join(outDir, 'media-manifest.json'), imported.mediaManifest)
  await writeJson(importReportPath, importReport)

  console.log(
    `Imported ${realMessageCount} sender-attributed messages (${messages.length} rendered rows) into ${path.relative(rootDir, outDir)}`,
  )
  console.log(`Wrote private import report to ${path.relative(rootDir, importReportPath)}`)
}

async function writeMessageChunks(messages: MemoryMessage[], messageCount: number) {
  const chunks: Array<{
    path: string
    count: number
    start: string | null
    end: string | null
  }> = []

  for (let startIndex = 0; startIndex < messages.length; startIndex += messageChunkSize) {
    const chunk = messages.slice(startIndex, startIndex + messageChunkSize)
    const chunkIndex = chunks.length
    const filename = `messages-${chunkIndex.toString().padStart(4, '0')}.json`
    const first = chunk[0]
    const last = chunk.at(-1)

    await writeJson(path.join(messageChunksDir, filename), chunk)
    chunks.push({
      path: `/memory-data/message-chunks/${filename}`,
      count: chunk.length,
      start: timestampFor(first),
      end: timestampFor(last),
    })
  }

  return {
    chunkSize: messageChunkSize,
    renderedRowCount: messages.length,
    messageCount,
    chunks,
  }
}

function timestampFor(message: MemoryMessage | undefined): string | null {
  return message?.timestamp ?? null
}

function buildImportReport(
  messages: MemoryMessage[],
  mediaManifest: MediaManifestItem[],
  source: ImportReport['source'],
): ImportReport {
  const sorted = [...messages].sort(
    (left, right) => Date.parse(left.timestamp) - Date.parse(right.timestamp),
  )
  const senderMessages = sorted.filter((message) => message.sender && message.type !== 'system')
  const activeDays = new Set(senderMessages.map((message) => message.dateKey)).size

  return {
    generatedAt: new Date().toISOString(),
    source,
    dateRange: {
      start: sorted[0]?.timestamp ?? null,
      end: sorted.at(-1)?.timestamp ?? null,
    },
    counts: {
      renderedRows: sorted.length,
      senderMessages: senderMessages.length,
      systemMessages: countWhere(sorted, (message) => message.type === 'system'),
      textMessages: countWhere(senderMessages, (message) => message.type === 'text'),
      deletedMessages: countWhere(senderMessages, (message) => message.type === 'deleted'),
      callMessages: countWhere(senderMessages, (message) => message.type === 'call'),
      attachmentRows: countWhere(senderMessages, (message) => isAttachmentType(message.type)),
      localPreviewMediaFiles: mediaManifest.length,
      editedMessages: countWhere(senderMessages, (message) => message.edited === true),
      activeDays,
      calendarDays: getTotalCalendarDays(senderMessages),
    },
    bySender: getCounts(senderMessages, (message) => message.sender ?? 'Unknown').map(
      ([sender, count]) => ({ sender, count }),
    ),
    byType: getCounts(sorted, (message) => message.type).map(([type, count]) => ({
      type,
      count,
    })),
    momentCandidates: buildMomentCandidates(senderMessages),
    reviewChecklist: [
      'Open each moment candidate and keep only the ones that feel like the two of you.',
      'Replace any candidate that feels generic, awkward, painful, or too private for the gift.',
      'Make sure every recap card that mentions a moment can jump back to a real message.',
      'Read the recap copy out loud once; if it sounds like a report, rewrite it.',
    ],
  }
}

function buildMomentCandidates(messages: MemoryMessage[]): ImportReport['momentCandidates'] {
  const candidates: ImportReport['momentCandidates'] = []
  const seen = new Set<string>()
  const textMessages = messages.filter((message) => message.type === 'text' && message.text)

  addMomentCandidate(candidates, seen, 'The first real text in this keepsake', textMessages[0])
  addMomentCandidate(
    candidates,
    seen,
    'A tiny laugh to test whether the recap feels like you two',
    textMessages.find((message) => /😂|lol|haha|hehe/i.test(message.text)),
  )
  addMomentCandidate(
    candidates,
    seen,
    'A soft love-word moment',
    textMessages.find((message) => /\b(i love you|love you|ily)\b/i.test(message.text)),
  )
  addMomentCandidate(
    candidates,
    seen,
    'A goodnight-shaped moment',
    textMessages.find((message) => /\b(good ?night|gn|sweet dreams)\b/i.test(message.text)),
  )
  addMomentCandidate(
    candidates,
    seen,
    'A good-morning-shaped moment',
    textMessages.find((message) => /\b(good ?morning|gm)\b/i.test(message.text)),
  )
  addMomentCandidate(
    candidates,
    seen,
    'A late-night message from the sleepy hours',
    textMessages.find((message) => {
      const hour = new Date(message.timestamp).getHours()
      return hour >= 0 && hour < 4
    }),
  )
  addMomentCandidate(
    candidates,
    seen,
    'The first media memory the recap can jump to',
    messages.find((message) => isAttachmentType(message.type)),
  )
  addMomentCandidate(
    candidates,
    seen,
    'A longer message that may carry more feeling than a stat can',
    [...textMessages].sort((left, right) => right.text.length - left.text.length)[0],
  )

  for (const message of textMessages) {
    if (candidates.length >= 10) break
    addMomentCandidate(candidates, seen, 'A fallback candidate for your hand-picked top 10', message)
  }

  return candidates
}

function addMomentCandidate(
  candidates: ImportReport['momentCandidates'],
  seen: Set<string>,
  reason: string,
  message: MemoryMessage | undefined,
) {
  if (!message || seen.has(message.id)) return

  seen.add(message.id)
  candidates.push({
    reason,
    messageId: message.id,
    timestamp: message.timestamp,
    sender: message.sender,
    preview: previewText(message.text || attachmentPreviewFor(message.type)),
  })
}

function previewText(text: string): string {
  const normalized = text.replace(/\s+/g, ' ').trim()
  return normalized.length > 140 ? `${normalized.slice(0, 137)}...` : normalized
}

function attachmentPreviewFor(type: MemoryMessage['type']): string {
  if (type === 'image') return 'Photo placeholder'
  if (type === 'video') return 'Video placeholder'
  if (type === 'audio') return 'Voice note placeholder'
  if (type === 'sticker') return 'Sticker placeholder'
  if (type === 'document') return 'Private attachment placeholder'
  return 'Message'
}

function getCounts<T extends string>(
  messages: MemoryMessage[],
  keyForMessage: (message: MemoryMessage) => T,
): Array<[T, number]> {
  const counts = new Map<T, number>()
  for (const message of messages) {
    const key = keyForMessage(message)
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }

  return [...counts.entries()].sort((left, right) => right[1] - left[1])
}

function countWhere(messages: MemoryMessage[], predicate: (message: MemoryMessage) => boolean): number {
  return messages.reduce((count, message) => count + (predicate(message) ? 1 : 0), 0)
}

function isAttachmentType(type: MemoryMessage['type']): boolean {
  return ['image', 'video', 'audio', 'document', 'sticker'].includes(type)
}

function getTotalCalendarDays(messages: MemoryMessage[]): number {
  const sortedDates = [...new Set(messages.map((message) => message.dateKey))].sort()
  const first = sortedDates[0]
  const last = sortedDates.at(-1)
  if (!first || !last) return 0

  return Math.round((dateKeyToUtcTime(last) - dateKeyToUtcTime(first)) / (24 * 60 * 60 * 1000)) + 1
}

function dateKeyToUtcTime(dateKey: string): number {
  const [year = 1970, month = 1, day = 1] = dateKey.split('-').map(Number)
  return Date.UTC(year, month - 1, day)
}

function countRawLines(text: string): number {
  if (!text) return 0
  return text.replace(/\r\n/g, '\n').split('\n').length
}

async function importZip(zipPath: string): Promise<{
  chatText: string
  mediaManifest: MediaManifestItem[]
}> {
  const zip = new AdmZip(zipPath)
  const entries = zip.getEntries().filter((entry) => !entry.isDirectory)

  if (entries.length > maxEntryCount) {
    throw new Error(`Export has too many files (${entries.length}). Limit is ${maxEntryCount}.`)
  }

  const chatEntry =
    entries.find((entry) => path.basename(entry.entryName).toLowerCase() === '_chat.txt') ??
    entries.find((entry) => entry.entryName.toLowerCase().endsWith('.txt'))

  if (!chatEntry) {
    throw new Error('No _chat.txt file found in the WhatsApp export zip.')
  }
  if (chatEntry.header.size > maxSingleFileBytes) {
    throw new Error('The chat text file is too large to import safely.')
  }

  const mediaManifest: MediaManifestItem[] = []
  let totalMediaBytes = 0

  for (const entry of entries) {
    if (entry === chatEntry) continue

    const filename = path.basename(entry.entryName)
    if (!filename || filename.startsWith('.')) continue
    if (!isSafePreviewMedia(filename)) continue
    if (entry.header.size > maxSingleFileBytes) {
      throw new Error(`${filename} is too large to import safely.`)
    }

    totalMediaBytes += entry.header.size
    if (totalMediaBytes > maxTotalMediaBytes) {
      throw new Error('Export media is too large to import safely.')
    }

    const targetPath = path.join(mediaDir, filename)
    await writeFile(targetPath, entry.getData())

    mediaManifest.push({
      filename,
      path: `/memory-data/media/${filename}`,
      type: inferMediaType(filename),
      size: entry.header.size,
    })
  }

  return {
    chatText: chatEntry.getData().toString('utf8'),
    mediaManifest,
  }
}

async function readTextExport(input: string): Promise<string> {
  const stats = await stat(input)
  if (stats.size > maxSingleFileBytes) {
    throw new Error('The chat text file is too large to import safely.')
  }

  return readFile(input, 'utf8')
}

async function writeJson(filePath: string, value: unknown) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`)
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
