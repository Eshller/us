export type MessageType =
  | 'text'
  | 'image'
  | 'video'
  | 'audio'
  | 'document'
  | 'sticker'
  | 'call'
  | 'deleted'
  | 'system'

export interface MemoryMessage {
  id: string
  timestamp: string
  dateKey: string
  sender: string | null
  text: string
  type: MessageType
  mediaRef: string | null
  edited?: boolean
  raw?: string
}

export interface MediaManifestItem {
  filename: string
  path: string
  type: MessageType
  size?: number
}

export interface RecapCard {
  id: string
  eyebrow: string
  title: string
  body: string
  metric?: string
  messageId?: string
}

export interface RecapData {
  generatedAt: string
  participants: string[]
  messageCount: number
  dateRange: {
    start: string | null
    end: string | null
  }
  cards: RecapCard[]
}

export interface MemoryData {
  messages: MemoryMessage[]
  recap: RecapData
  mediaManifest: MediaManifestItem[]
}

export interface MemoryDataLoadSnapshot {
  data: MemoryData
  complete: boolean
  loadedRows: number
  totalRows: number
  loadError?: string
}
