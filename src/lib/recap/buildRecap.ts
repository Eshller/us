import type { MemoryMessage, RecapCard, RecapData } from '../memory/types'

const emojiPattern = /\p{Extended_Pictographic}/gu
const quietWords = new Set([
  'the',
  'and',
  'you',
  'that',
  'this',
  'for',
  'with',
  'are',
  'was',
  'have',
  'but',
  'not',
  'just',
  'your',
  'what',
  'when',
  'from',
  'they',
  'there',
  'then',
  'omitted',
  'image',
  'voice',
  'call',
  'document',
  'audio',
  'video',
])

export function buildRecap(messages: MemoryMessage[]): RecapData {
  const userMessages = messages.filter((message) => message.sender && message.type !== 'system')
  const sorted = [...userMessages].sort(
    (left, right) => Date.parse(left.timestamp) - Date.parse(right.timestamp),
  )
  const participants = [...new Set(sorted.map((message) => message.sender).filter(Boolean))] as string[]
  const cards: RecapCard[] = []
  const firstMessage = sorted.find((message) => message.type === 'text' && message.text)
  const busiestMonth = getBusiestBucket(sorted, monthKey)
  const busiestDay = getBusiestBucket(sorted, dayKey)
  const busiestWeekday = getBusiestBucket(sorted, weekdayKey)
  const busiestHour = getBusiestBucket(sorted, hourKey)
  const streak = getLongestStreak(sorted)
  const emojis = getTopEmojis(sorted)
  const words = getTopWords(sorted)
  const totalWords = sorted.reduce((count, message) => count + wordCount(message.text), 0)
  const bySender = getSenderCounts(sorted)
  const activeDays = new Set(sorted.map((message) => message.dateKey)).size
  const totalDays = getTotalCalendarDays(sorted)
  const questionCounts = countBySender(sorted, (message) => message.text.includes('?'))
  const laughCounts = countBySender(sorted, (message) => /😂|lol|haha|hehe/i.test(message.text))
  const sorryCounts = countWordBySender(sorted, /\bsorry\b/gi)
  const loveCounts = countWordBySender(sorted, /i love you|love you|ily/gi)
  const lateNightCount = sorted.filter((message) => {
    const hour = new Date(message.timestamp).getHours()
    return hour >= 0 && hour < 4
  }).length
  const firstMedia = sorted.find((message) => message.mediaRef)

  if (firstMessage) {
    cards.push({
      id: 'first-message',
      eyebrow: 'First page',
      title: 'Where our chat begins',
      body: quote(firstMessage.text),
      messageId: firstMessage.id,
    })
  }

  cards.push({
    id: 'source-of-truth',
    eyebrow: 'Our little universe',
    title: `${sorted.length.toLocaleString()} little moments`,
    body: `Across ${activeDays.toLocaleString()} days, this became our tiny place for hellos, laughter, missing each other, and coming back. It stretches across ${totalDays.toLocaleString()} calendar days, but somehow still feels like one long conversation.`,
    metric: `${totalWords.toLocaleString()} words, all ours`,
  })

  if (bySender.length >= 2) {
    cards.push({
      id: 'sender-balance',
      eyebrow: 'Both of us',
      title: 'We both kept showing up',
      body: `${bySender[0].sender} left ${bySender[0].count.toLocaleString()} little traces here, and ${bySender[1].sender} left ${bySender[1].count.toLocaleString()}. The difference is only ${Math.abs(
        bySender[0].count - bySender[1].count,
      ).toLocaleString()} messages, which feels very us.`,
    })
  }

  if (busiestMonth) {
    cards.push({
      id: 'busiest-month',
      eyebrow: 'Most alive month',
      title: formatMonthLabel(busiestMonth.key),
      body: 'A month with the most tiny check-ins, long thoughts, and everything in between.',
      metric: `${busiestMonth.count.toLocaleString()} messages`,
    })
  }

  if (busiestDay) {
    cards.push({
      id: 'busiest-day',
      eyebrow: 'One very full day',
      title: formatDayLabel(busiestDay.key),
      body: 'The kind of day that left a trace in the conversation.',
      metric: `${busiestDay.count.toLocaleString()} messages`,
      messageId: busiestDay.firstMessageId,
    })
  }

  if (busiestWeekday) {
    cards.push({
      id: 'busiest-weekday',
      eyebrow: 'Weekly rhythm',
      title: `${busiestWeekday.key}s are loudest`,
      body: `${busiestWeekday.key}s somehow held the most of us: quick updates, random thoughts, and tiny reasons to smile at the phone.`,
      metric: `${busiestWeekday.count.toLocaleString()} messages`,
    })
  }

  if (streak.days > 1) {
    cards.push({
      id: 'longest-streak',
      eyebrow: 'Longest streak',
      title: `${streak.days} days in a row`,
      body: `From ${formatDayLabel(streak.start)} to ${formatDayLabel(streak.end)}, we kept finding our way back to each other.`,
      metric: `${streak.days} days`,
      messageId: streak.firstMessageId,
    })
  }

  if (emojis.length > 0) {
    cards.push({
      id: 'top-emojis',
      eyebrow: 'Tiny expressions',
      title: emojis.map((item) => item.value).join(' '),
      body: 'The little symbols that kept showing up.',
      metric: emojis.map((item) => `${item.value} ${item.count}`).join('  '),
    })
  }

  if (words.length > 0) {
    cards.push({
      id: 'shared-words',
      eyebrow: 'Recurring words',
      title: words.map((item) => item.value).join(', '),
      body: 'The tiny everyday words that somehow became part of our language.',
    })
  }

  if (lateNightCount > 0) {
    const percentage = sorted.length ? ((lateNightCount / sorted.length) * 100).toFixed(1) : '0.0'
    cards.push({
      id: 'late-night',
      eyebrow: 'After midnight',
      title: 'Our secret hour',
      body: `Between midnight and 4 AM, there are ${lateNightCount.toLocaleString()} sleepy little messages: half-awake thoughts, softness, and the kind of talking that belongs only to us.`,
      metric: `${percentage}% of our story`,
    })
  }

  if (busiestHour) {
    cards.push({
      id: 'busiest-hour',
      eyebrow: 'Peak hour',
      title: `${formatHourLabel(Number(busiestHour.key))}`,
      body: 'The hour our phones most often found each other.',
      metric: `${busiestHour.count.toLocaleString()} messages`,
    })
  }

  if (bySender.length >= 2) {
    const [first, second] = bySender
    const firstQuestions = questionCounts.get(first.sender) ?? 0
    const secondQuestions = questionCounts.get(second.sender) ?? 0
    const firstLaughs = laughCounts.get(first.sender) ?? 0
    const secondLaughs = laughCounts.get(second.sender) ?? 0

    cards.push({
      id: 'question-laugh',
      eyebrow: 'Texting personalities',
      title: 'Questions and laughs',
      body: `${first.sender}: ${firstQuestions.toLocaleString()} questions and ${firstLaughs.toLocaleString()} laughs. ${second.sender}: ${secondQuestions.toLocaleString()} questions and ${secondLaughs.toLocaleString()} laughs.`,
    })

    cards.push({
      id: 'soft-words',
      eyebrow: 'Soft words',
      title: 'Sorry and love',
      body: `${first.sender}: ${(sorryCounts.get(first.sender) ?? 0).toLocaleString()} sorrys and ${(loveCounts.get(first.sender) ?? 0).toLocaleString()} love phrases. ${second.sender}: ${(sorryCounts.get(second.sender) ?? 0).toLocaleString()} sorrys and ${(loveCounts.get(second.sender) ?? 0).toLocaleString()} love phrases.`,
    })
  }

  if (firstMedia) {
    cards.push({
      id: 'first-media',
      eyebrow: 'First saved media',
      title: firstMedia.mediaRef ?? 'A media memory',
      body: 'A little saved piece of us that can still take you back there.',
      messageId: firstMedia.id,
    })
  }

  return {
    generatedAt: new Date().toISOString(),
    participants,
    messageCount: userMessages.length,
    dateRange: {
      start: sorted[0]?.timestamp ?? null,
      end: sorted.at(-1)?.timestamp ?? null,
    },
    cards,
  }
}

function getBusiestBucket(
  messages: MemoryMessage[],
  keyForMessage: (message: MemoryMessage) => string,
): { key: string; count: number; firstMessageId: string } | null {
  const buckets = new Map<string, { count: number; firstMessageId: string }>()

  for (const message of messages) {
    const key = keyForMessage(message)
    const existing = buckets.get(key)

    if (existing) {
      existing.count += 1
    } else {
      buckets.set(key, { count: 1, firstMessageId: message.id })
    }
  }

  return [...buckets.entries()]
    .map(([key, value]) => ({ key, ...value }))
    .sort((left, right) => right.count - left.count)[0] ?? null
}

function getSenderCounts(messages: MemoryMessage[]): Array<{ sender: string; count: number }> {
  const counts = new Map<string, number>()

  for (const message of messages) {
    if (message.sender) counts.set(message.sender, (counts.get(message.sender) ?? 0) + 1)
  }

  return [...counts.entries()]
    .map(([sender, count]) => ({ sender, count }))
    .sort((left, right) => right.count - left.count)
}

function countBySender(
  messages: MemoryMessage[],
  predicate: (message: MemoryMessage) => boolean,
): Map<string, number> {
  const counts = new Map<string, number>()

  for (const message of messages) {
    if (message.sender && predicate(message)) {
      counts.set(message.sender, (counts.get(message.sender) ?? 0) + 1)
    }
  }

  return counts
}

function countWordBySender(messages: MemoryMessage[], pattern: RegExp): Map<string, number> {
  const counts = new Map<string, number>()

  for (const message of messages) {
    if (!message.sender) continue
    const matches = message.text.match(pattern)?.length ?? 0
    if (matches > 0) counts.set(message.sender, (counts.get(message.sender) ?? 0) + matches)
  }

  return counts
}

function getTopEmojis(messages: MemoryMessage[]): Array<{ value: string; count: number }> {
  const counts = new Map<string, number>()

  for (const message of messages) {
    for (const emoji of message.text.match(emojiPattern) ?? []) {
      counts.set(emoji, (counts.get(emoji) ?? 0) + 1)
    }
  }

  return topEntries(counts, 5)
}

function getTopWords(messages: MemoryMessage[]): Array<{ value: string; count: number }> {
  const counts = new Map<string, number>()

  for (const message of messages) {
    const words = message.text
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s']/gu, ' ')
      .split(/\s+/)
      .filter((word) => word.length > 3 && !quietWords.has(word))

    for (const word of words) {
      counts.set(word, (counts.get(word) ?? 0) + 1)
    }
  }

  return topEntries(counts, 4)
}

function topEntries(counts: Map<string, number>, limit: number): Array<{ value: string; count: number }> {
  return [...counts.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((left, right) => right.count - left.count)
    .slice(0, limit)
}

function getLongestStreak(messages: MemoryMessage[]): {
  days: number
  start: string
  end: string
  firstMessageId?: string
} {
  const byDay = new Map<string, string>()

  for (const message of messages) {
    const key = dayKey(message)
    if (!byDay.has(key)) byDay.set(key, message.id)
  }

  const days = [...byDay.keys()].sort()
  let best = { days: 0, start: '', end: '', firstMessageId: undefined as string | undefined }
  let current = { days: 0, start: '', end: '', firstMessageId: undefined as string | undefined }
  let previous: Date | null = null

  for (const day of days) {
    const date = new Date(`${day}T00:00:00`)
    const followsPrevious =
      previous && date.getTime() - previous.getTime() === 24 * 60 * 60 * 1000

    if (!followsPrevious) {
      current = { days: 1, start: day, end: day, firstMessageId: byDay.get(day) }
    } else {
      current.days += 1
      current.end = day
    }

    if (current.days > best.days) best = { ...current }
    previous = date
  }

  return best
}

function monthKey(message: MemoryMessage): string {
  return message.dateKey.slice(0, 7)
}

function dayKey(message: MemoryMessage): string {
  return message.dateKey
}

function weekdayKey(message: MemoryMessage): string {
  return new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(
    new Date(`${message.dateKey}T00:00:00`),
  )
}

function hourKey(message: MemoryMessage): string {
  return String(new Date(message.timestamp).getHours())
}

function wordCount(text: string): number {
  return text.match(/[\p{L}\p{N}']+/gu)?.length ?? 0
}

function getTotalCalendarDays(messages: MemoryMessage[]): number {
  const first = messages[0]?.dateKey
  const last = messages.at(-1)?.dateKey

  if (!first || !last) return 0

  return Math.round((Date.parse(`${last}T00:00:00`) - Date.parse(`${first}T00:00:00`)) / 86400000) + 1
}

function formatHourLabel(hour: number): string {
  if (hour === 0) return '12 AM'
  if (hour === 12) return '12 PM'
  return hour < 12 ? `${hour} AM` : `${hour - 12} PM`
}

function formatMonthLabel(key: string): string {
  return new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(
    new Date(`${key}-01T00:00:00`),
  )
}

function formatDayLabel(key: string): string {
  return new Intl.DateTimeFormat(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(`${key}T00:00:00`))
}

function quote(text: string): string {
  const collapsed = text.replace(/\s+/g, ' ').trim()
  return collapsed.length > 160 ? `${collapsed.slice(0, 157)}...` : collapsed
}
