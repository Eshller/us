import type { MemoryMessage, MessageType } from '../memory/types'

export interface ParseOptions {
  dateOrder?: 'day-first' | 'month-first' | 'auto'
}

interface ParsedPrefix {
  date: string
  time: string
  rest: string
}

interface ParsedDateTime {
  timestamp: string
  dateKey: string
}

interface AttachmentRef {
  filename: string
  safePreview: boolean
}

const prefixPatterns = [
  /^\[(?<date>\d{1,2}[/. -]\d{1,2}[/. -]\d{2,4}),\s*(?<time>\d{1,2}:\d{2}(?::\d{2})?\s?(?:am|pm|AM|PM)?)\]\s*(?<rest>.*)$/,
  /^(?<date>\d{1,2}[/. -]\d{1,2}[/. -]\d{2,4}),\s*(?<time>\d{1,2}:\d{2}(?::\d{2})?\s?(?:am|pm|AM|PM)?)\s-\s(?<rest>.*)$/,
]

const mediaPattern =
  /(?:<)?(?<file>[^<>\n\r]+?\.(?:jpe?g|png|webp|gif|mp4|mov|m4v|opus|ogg|mp3|m4a|wav|pdf|docx?|xlsx?|pptx?|txt|vcf))(?:>)?/iu
const editedMarkerPattern = /\s*<?This message was edited>?\s*$/i
const safePreviewExtensions = new Set([
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.gif',
  '.mp4',
  '.mov',
  '.m4v',
  '.opus',
  '.ogg',
  '.mp3',
  '.m4a',
  '.wav',
])

export function parseWhatsAppExportText(
  input: string,
  options: ParseOptions = {},
): MemoryMessage[] {
  const messages: MemoryMessage[] = []
  const lines = input.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').split('\n')

  for (const line of lines) {
    const prefix = parsePrefix(line)

    if (!prefix) {
      const current = messages[messages.length - 1]
      if (current && line.trim()) {
        const editedState = extractEditedState(`${current.text}\n${line}`)
        current.text = editedState.text
        current.edited = current.edited || editedState.edited
        if (current.type !== 'document') {
          current.type = classifyMessage(current.text, current.mediaRef, current.sender)
        }
      }
      continue
    }

    const { sender, body } = parseSenderAndBody(prefix.rest)
    const editedState = extractEditedState(body)
    const attachment = extractAttachmentRef(editedState.text)
    if (!attachment && ((sender && !editedState.text) || (!sender && isBlankSenderRow(editedState.text)))) {
      continue
    }

    const mediaRef = attachment?.safePreview ? attachment.filename : null
    const { timestamp, dateKey } = parseDateTime(prefix.date, prefix.time, options)
    const type = classifyMessage(editedState.text, mediaRef, sender, attachment)
    const normalizedSender = type === 'system' ? null : sender

    messages.push({
      id: createMessageId(messages.length, timestamp),
      timestamp,
      dateKey,
      sender: normalizedSender,
      text: cleanMessageText(editedState.text, attachment),
      type,
      mediaRef,
      edited: editedState.edited,
    })
  }

  return messages
}

export function inferMediaType(filename: string): MessageType {
  const normalized = filename.toLowerCase()

  if (normalized.startsWith('stk-')) return 'sticker'
  if (/\.(jpe?g|png|webp|gif)$/.test(normalized)) return 'image'
  if (/\.(mp4|mov|m4v)$/.test(normalized)) return 'video'
  if (/\.(opus|ogg|mp3|m4a|wav)$/.test(normalized)) return 'audio'

  return 'document'
}

export function isSafePreviewMedia(filename: string): boolean {
  return safePreviewExtensions.has(extensionFor(filename))
}

function parsePrefix(line: string): ParsedPrefix | null {
  const normalizedLine = cleanFormattingMarks(line)

  for (const pattern of prefixPatterns) {
    const match = normalizedLine.match(pattern)
    if (match?.groups) {
      return {
        date: match.groups.date,
        time: match.groups.time,
        rest: match.groups.rest,
      }
    }
  }

  return null
}

function parseSenderAndBody(rest: string): { sender: string | null; body: string } {
  const separator = rest.indexOf(': ')

  if (separator <= 0) {
    return { sender: null, body: rest.trim() }
  }

  return {
    sender: rest.slice(0, separator).trim(),
    body: rest.slice(separator + 2).trim(),
  }
}

function parseDateTime(date: string, time: string, options: ParseOptions): ParsedDateTime {
  const [first, second, rawYear] = date.split(/[/. -]/).map(Number)
  const year = rawYear < 100 ? 2000 + rawYear : rawYear
  const order = options.dateOrder ?? 'day-first'
  const dayFirst =
    order === 'day-first' || (order === 'auto' && (first > 12 || second <= 12))
  const day = dayFirst ? first : second
  const month = dayFirst ? second : first
  const { hours, minutes, seconds } = parseTime(time)
  const localDate = new Date(year, month - 1, day, hours, minutes, seconds)
  const dateKey = `${year.toString().padStart(4, '0')}-${month
    .toString()
    .padStart(2, '0')}-${day.toString().padStart(2, '0')}`

  if (Number.isNaN(localDate.getTime())) {
    return { timestamp: new Date(0).toISOString(), dateKey: '1970-01-01' }
  }

  return { timestamp: localDate.toISOString(), dateKey }
}

function parseTime(time: string): { hours: number; minutes: number; seconds: number } {
  const trimmed = time.trim()
  const meridiem = trimmed.match(/(am|pm)$/i)?.[1]?.toLowerCase()
  const parts = trimmed.replace(/\s?(am|pm)$/i, '').split(':').map(Number)
  let hours = parts[0] ?? 0

  if (meridiem === 'pm' && hours < 12) hours += 12
  if (meridiem === 'am' && hours === 12) hours = 0

  return {
    hours,
    minutes: parts[1] ?? 0,
    seconds: parts[2] ?? 0,
  }
}

function createMessageId(index: number, timestamp: string): string {
  const time = Number.isNaN(Date.parse(timestamp)) ? index : Date.parse(timestamp)
  return `m_${index.toString().padStart(6, '0')}_${time}`
}

function extractAttachmentRef(body: string): AttachmentRef | null {
  const trimmedBody = body.trim()
  const hasAttachmentMarker = /\(file attached\)$/i.test(trimmedBody) || /^<attached:\s?/i.test(trimmedBody)
  if (!hasAttachmentMarker) return null

  const attachmentText = trimmedBody
    .replace(/^<attached:\s?/i, '')
    .replace(/>$/i, '')
    .replace(/\s?\(file attached\)$/i, '')
    .trim()
  const match = attachmentText.match(mediaPattern)
  const filename = match?.groups?.file?.trim()

  if (!filename) return null

  return {
    filename,
    safePreview: isSafePreviewMedia(filename),
  }
}

function classifyMessage(
  body: string,
  mediaRef: string | null,
  sender: string | null = 'sender',
  attachment: AttachmentRef | null = null,
): MessageType {
  const normalized = cleanFormattingMarks(body).toLowerCase()

  if (isSystemNotice(normalized)) return 'system'
  if (!sender) return 'system'
  if (normalized.includes('message was deleted') || normalized.includes('you deleted this message')) {
    return 'deleted'
  }
  if (normalized.includes('voice call') || normalized.includes('video call')) {
    return 'call'
  }
  if (mediaRef) return inferMediaType(mediaRef)
  if (attachment && !attachment.safePreview) return 'document'

  return 'text'
}

function cleanMessageText(body: string, attachment: AttachmentRef | null = null): string {
  if (attachment && !attachment.safePreview) {
    return 'Document attachment skipped for privacy.'
  }

  return cleanFormattingMarks(body)
    .replace(/\s?\(file attached\)$/i, '')
    .replace(/^<attached:\s?/i, '')
    .replace(/>$/i, '')
    .trim()
}

function cleanFormattingMarks(text: string): string {
  return text.replace(/[\u200e\u200f\u202a-\u202e]/g, '')
}

function extractEditedState(body: string): { text: string; edited: boolean } {
  const cleanedBody = cleanFormattingMarks(body)
  const edited = editedMarkerPattern.test(cleanedBody)

  return {
    text: cleanedBody.replace(editedMarkerPattern, '').trim(),
    edited,
  }
}

function isSystemNotice(normalizedBody: string): boolean {
  return (
    normalizedBody.includes('messages and calls are end-to-end encrypted') ||
    normalizedBody.includes('only people in this chat can read') ||
    normalizedBody.endsWith(' is a contact.') ||
    normalizedBody.includes('security code changed')
  )
}

function isBlankSenderRow(text: string): boolean {
  return /^[^:]+:$/.test(text.trim())
}

function extensionFor(filename: string): string {
  const dotIndex = filename.lastIndexOf('.')
  return dotIndex >= 0 ? filename.slice(dotIndex).toLowerCase() : ''
}
