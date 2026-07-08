import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { ChatArchive } from './components/chat/ChatArchive'
import { RecapStory } from './components/recap/RecapStory'
import { loadMemoryData } from './lib/memory/loadMemoryData'
import type { MemoryData } from './lib/memory/types'
import './App.css'

type Tab = 'chat' | 'recap' | 'privacy'

function App() {
  const [memoryData, setMemoryData] = useState<MemoryData | null>(null)
  const [activeTab, setActiveTab] = useState<Tab>('chat')
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null)
  const viewerSender = useMemo(
    () =>
      memoryData?.recap.participants.find((participant) => /riti/i.test(participant)) ??
      memoryData?.recap.participants[0] ??
      null,
    [memoryData],
  )
  const dateRange = useMemo(() => {
    if (!memoryData?.recap.dateRange.start || !memoryData.recap.dateRange.end) {
      return 'Ready for your WhatsApp export'
    }

    return `${formatDate(memoryData.recap.dateRange.start)} - ${formatDate(
      memoryData.recap.dateRange.end,
    )}`
  }, [memoryData])

  useEffect(() => {
    loadMemoryData().then(setMemoryData)
  }, [])

  const openMessage = (messageId: string) => {
    setSelectedMessageId(messageId)
    setActiveTab('chat')
  }

  if (!memoryData) {
    return (
      <main className="app-shell loading">
        <p>Opening the archive...</p>
      </main>
    )
  }

  return (
    <main className={`app-shell tab-${activeTab}`}>
      <aside className="intro-panel">
        <p className="eyebrow">Private keepsake</p>
        <h1>A little room for our chat</h1>
        <p>
          A local WhatsApp-style archive with a small recap of the moments that kept showing up.
        </p>
        <div className="summary-card">
          <span>{memoryData.recap.messageCount.toLocaleString()}</span>
          <p>messages in this archive</p>
        </div>
        <div className="summary-card subtle">
          <span>{memoryData.recap.participants.join(' + ') || 'Two people'}</span>
          <p>{dateRange}</p>
        </div>
        <nav className="tab-list" aria-label="Keepsake sections">
          <TabButton
            active={activeTab === 'chat'}
            onClick={() => {
              setSelectedMessageId(null)
              setActiveTab('chat')
            }}
          >
            Chat
          </TabButton>
          <TabButton active={activeTab === 'recap'} onClick={() => setActiveTab('recap')}>
            Recap
          </TabButton>
          <TabButton active={activeTab === 'privacy'} onClick={() => setActiveTab('privacy')}>
            Privacy
          </TabButton>
        </nav>
      </aside>

      <section className="content-panel">
        {activeTab === 'chat' ? (
          <ChatArchive
            messages={memoryData.messages}
            mediaManifest={memoryData.mediaManifest}
            selectedMessageId={selectedMessageId}
            viewerSender={viewerSender}
            onOpenRecap={() => setActiveTab('recap')}
            onOpenPrivacy={() => setActiveTab('privacy')}
          />
        ) : null}
        {activeTab === 'recap' ? (
          <RecapStory
            recap={memoryData.recap}
            onOpenMessage={openMessage}
            onBackToChat={() => setActiveTab('chat')}
          />
        ) : null}
        {activeTab === 'privacy' ? <PrivacyPanel onBackToChat={() => setActiveTab('chat')} /> : null}
      </section>
    </main>
  )
}

function TabButton({
  active,
  children,
  onClick,
}: {
  active: boolean
  children: ReactNode
  onClick: () => void
}) {
  return (
    <button type="button" className={active ? 'active' : ''} onClick={onClick}>
      {children}
    </button>
  )
}

function PrivacyPanel({ onBackToChat }: { onBackToChat: () => void }) {
  return (
    <section className="privacy-panel">
      <button type="button" className="screen-back-button" onClick={onBackToChat}>
        Back to chat
      </button>
      <p className="eyebrow">Local first</p>
      <h2>This archive stays on this device.</h2>
      <p>
        The import script turns a WhatsApp export into static files inside this project. The app reads
        those local files and does not need accounts, analytics, or a hosted database.
      </p>
      <ul>
        <li>No cloud upload is required for the chat export.</li>
        <li>Generated chat data and media are ignored by git.</li>
        <li>The recap uses deterministic stats, not relationship scoring.</li>
      </ul>
    </section>
  )
}

function formatDate(timestamp: string): string {
  return new Intl.DateTimeFormat(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(timestamp))
}

export default App
