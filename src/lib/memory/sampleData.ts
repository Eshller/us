import { buildRecap } from '../recap/buildRecap'
import type { MemoryData, MemoryMessage } from './types'

const sampleMessages: MemoryMessage[] = [
  {
    id: 'demo_001',
    timestamp: new Date('2024-01-01T10:12:00').toISOString(),
    dateKey: '2024-01-01',
    sender: 'You',
    text: 'First tiny hello in the archive.',
    type: 'text',
    mediaRef: null,
  },
  {
    id: 'demo_002',
    timestamp: new Date('2024-01-01T10:13:00').toISOString(),
    dateKey: '2024-01-01',
    sender: 'Her',
    text: 'And the first reply that made the day warmer.',
    type: 'text',
    mediaRef: null,
  },
  {
    id: 'demo_003',
    timestamp: new Date('2024-01-02T00:22:00').toISOString(),
    dateKey: '2024-01-02',
    sender: 'You',
    text: 'Still awake?',
    type: 'text',
    mediaRef: null,
  },
  {
    id: 'demo_004',
    timestamp: new Date('2024-01-02T00:23:00').toISOString(),
    dateKey: '2024-01-02',
    sender: 'Her',
    text: 'Always for a good story 🙂',
    type: 'text',
    mediaRef: null,
  },
  {
    id: 'demo_005',
    timestamp: new Date('2024-01-03T18:02:00').toISOString(),
    dateKey: '2024-01-03',
    sender: 'Her',
    text: 'IMG-20240103-WA0001.jpg',
    type: 'image',
    mediaRef: 'IMG-20240103-WA0001.jpg',
  },
]

export const sampleMemoryData: MemoryData = {
  messages: sampleMessages,
  recap: buildRecap(sampleMessages),
  mediaManifest: [],
}
