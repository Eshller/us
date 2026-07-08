import { useVirtualizer } from '@tanstack/react-virtual'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { WhatsappIcon } from '../icons/WhatsappIcon'
import type { MediaManifestItem, MemoryMessage } from '../../lib/memory/types'
import { MessageBubble } from './MessageBubble'

interface ChatArchiveProps {
  messages: MemoryMessage[]
  mediaManifest: MediaManifestItem[]
  selectedMessageId: string | null
  viewerSender: string | null
  isArchiveComplete: boolean
  loadedRows: number
  totalRows: number
  loadError?: string
  onOpenRecap: () => void
  onOpenPrivacy: () => void
}

type ChatRow =
  | { kind: 'date'; id: string; label: string }
  | { kind: 'message'; id: string; message: MemoryMessage }

export function ChatArchive({
  messages,
  mediaManifest,
  selectedMessageId,
  viewerSender,
  isArchiveComplete,
  loadedRows,
  totalRows,
  loadError,
  onOpenRecap,
  onOpenPrivacy,
}: ChatArchiveProps) {
  const [query, setQuery] = useState('')
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [activeMatchIndex, setActiveMatchIndex] = useState(0)
  const [showJumpToLatest, setShowJumpToLatest] = useState(false)
  const [scrollDateLabel, setScrollDateLabel] = useState('')
  const [showScrollDate, setShowScrollDate] = useState(false)
  const [sender, setSender] = useState('all')
  const [date, setDate] = useState('')
  const [mediaOnly, setMediaOnly] = useState(false)
  const parentRef = useRef<HTMLDivElement>(null)
  const didInitialScrollRef = useRef(false)
  const scrollDateTimeoutRef = useRef<number | null>(null)
  const mediaByName = useMemo(
    () => new Map(mediaManifest.map((item) => [item.filename, item])),
    [mediaManifest],
  )
  const participants = useMemo(
    () => [...new Set(messages.map((message) => message.sender).filter(Boolean))] as string[],
    [messages],
  )
  const ownSender =
    viewerSender && participants.includes(viewerSender)
      ? viewerSender
      : participants.find((participant) => /riti/i.test(participant)) ?? participants[0] ?? null
  const contactSender = participants.find((participant) => participant !== ownSender) ?? participants[0]
  const isOneToOne = participants.length <= 2
  const realMessageCount = useMemo(
    () => messages.filter((message) => message.sender && message.type !== 'system').length,
    [messages],
  )
  const archiveStatus = loadError
    ? 'Archive load incomplete; search unavailable'
    : isArchiveComplete
      ? `${realMessageCount.toLocaleString()} messages in this archive`
      : `Loading full archive... ${loadedRows.toLocaleString()}/${totalRows.toLocaleString()} rows`
  const visibleMessages = useMemo(() => {
    return messages.filter((message) => {
      if (sender !== 'all' && message.sender !== sender) return false
      if (mediaOnly && !message.mediaRef) return false
      if (date && message.dateKey !== date) return false
      return true
    })
  }, [date, mediaOnly, messages, sender])
  const searchMatches = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    if (!normalizedQuery || !isArchiveComplete) return []

    return visibleMessages.filter((message) => messageMatchesQuery(message, normalizedQuery))
  }, [isArchiveComplete, query, visibleMessages])
  const searchMatchIds = useMemo(
    () => new Set(searchMatches.map((message) => message.id)),
    [searchMatches],
  )
  const rows = useMemo(() => buildRows(visibleMessages), [visibleMessages])
  const activeMatch = searchMatches[activeMatchIndex] ?? null
  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (index) => (rows[index]?.kind === 'date' ? 34 : 54),
    getItemKey: (index) => rows[index]?.id ?? index,
    initialOffset: () => rows.length * 54,
    overscan: 12,
  })
  const scrollToLatest = useCallback(() => {
    if (!rows.length) return
    rowVirtualizer.scrollToIndex(rows.length - 1, { align: 'end' })
  }, [rowVirtualizer, rows.length])

  useEffect(() => {
    const scrollElement = parentRef.current
    if (!scrollElement) return

    const updateJumpButton = (revealDate = true) => {
      const distanceFromBottom =
        scrollElement.scrollHeight - scrollElement.scrollTop - scrollElement.clientHeight
      setShowJumpToLatest(distanceFromBottom > 900)

      if (!revealDate) return

      const firstVisibleRow =
        rowVirtualizer
          .getVirtualItems()
          .find((virtualRow) => virtualRow.end > scrollElement.scrollTop + 1) ??
        rowVirtualizer.getVirtualItems()[0]
      const visibleDate = currentVisibleDateLabel(firstVisibleRow?.index ?? 0, rows)
      if (visibleDate) {
        setScrollDateLabel(visibleDate)
        setShowScrollDate(true)
      }

      if (scrollDateTimeoutRef.current) {
        window.clearTimeout(scrollDateTimeoutRef.current)
      }
      scrollDateTimeoutRef.current = window.setTimeout(() => {
        setShowScrollDate(false)
      }, 1100)
    }

    const handleScroll = () => updateJumpButton()

    updateJumpButton(false)
    scrollElement.addEventListener('scroll', handleScroll, { passive: true })
    return () => {
      scrollElement.removeEventListener('scroll', handleScroll)
      if (scrollDateTimeoutRef.current) {
        window.clearTimeout(scrollDateTimeoutRef.current)
      }
    }
  }, [rowVirtualizer, rows])

  useEffect(() => {
    if (!selectedMessageId) return
    setQuery('')
    setIsSearchOpen(false)
    setSender('all')
    setDate('')
    setMediaOnly(false)
  }, [selectedMessageId])

  useEffect(() => {
    if (!isSearchOpen || !query.trim()) {
      setActiveMatchIndex(0)
      return
    }

    setActiveMatchIndex(searchMatches.length ? searchMatches.length - 1 : 0)
  }, [isSearchOpen, query, searchMatches.length])

  useEffect(() => {
    if (!selectedMessageId) return

    const rowIndex = rows.findIndex((row) => row.kind === 'message' && row.id === selectedMessageId)
    if (rowIndex >= 0) {
      rowVirtualizer.scrollToIndex(rowIndex, { align: 'center' })
    }
  }, [rowVirtualizer, rows, selectedMessageId])

  useLayoutEffect(() => {
    if (!rows.length || selectedMessageId || didInitialScrollRef.current) return

    let secondFrame = 0
    scrollToLatest()
    const firstFrame = window.requestAnimationFrame(() => {
      scrollToLatest()
      secondFrame = window.requestAnimationFrame(() => {
        scrollToLatest()
        didInitialScrollRef.current = true
      })
    })

    return () => {
      window.cancelAnimationFrame(firstFrame)
      window.cancelAnimationFrame(secondFrame)
    }
  }, [rows.length, scrollToLatest, selectedMessageId])

  useLayoutEffect(() => {
    if (!isArchiveComplete || !rows.length || selectedMessageId) return

    scrollToLatest()
    const frame = window.requestAnimationFrame(scrollToLatest)
    return () => window.cancelAnimationFrame(frame)
  }, [isArchiveComplete, rows.length, scrollToLatest, selectedMessageId])

  useEffect(() => {
    if (!activeMatch) return

    const rowIndex = rows.findIndex((row) => row.kind === 'message' && row.id === activeMatch.id)
    if (rowIndex >= 0) {
      rowVirtualizer.scrollToIndex(rowIndex, { align: 'center' })
    }
  }, [activeMatch, rowVirtualizer, rows])

  const openSearch = () => {
    setIsMenuOpen(false)
    setIsSearchOpen(true)
  }

  const closeSearch = () => {
    setIsMenuOpen(false)
    setIsSearchOpen(false)
    setQuery('')
  }

  const goToPreviousMatch = () => {
    if (!searchMatches.length) return
    setActiveMatchIndex((index) => Math.max(index - 1, 0))
  }

  const goToNextMatch = () => {
    if (!searchMatches.length) return
    setActiveMatchIndex((index) => Math.min(index + 1, searchMatches.length - 1))
  }

  return (
    <section className="chat-panel" aria-label="Chat archive">
      <header className={`chat-header ${isSearchOpen ? 'searching' : ''}`}>
        {isSearchOpen ? (
          <>
            <button type="button" className="wa-back" aria-label="Close search" onClick={closeSearch}>
              <WhatsappIcon name="back" />
            </button>
            <label className="wa-search-field">
              <span className="sr-only">Search this chat</span>
              <input
                autoFocus
                disabled={!isArchiveComplete}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={
                  isArchiveComplete
                    ? 'Search...'
                    : loadError
                      ? 'Full archive unavailable'
                      : 'Loading full archive...'
                }
              />
            </label>
            <div className="wa-search-count" aria-live="polite">
              {query.trim()
                ? searchMatches.length
                  ? `${activeMatchIndex + 1}/${searchMatches.length}`
                  : '0/0'
                : ''}
            </div>
            <div className="wa-search-nav">
              <button
                type="button"
                aria-label="Previous search result"
                onClick={goToPreviousMatch}
                disabled={!isArchiveComplete || !searchMatches.length || activeMatchIndex === 0}
              >
                <WhatsappIcon name="chevronUp" />
              </button>
              <button
                type="button"
                aria-label="Next search result"
                onClick={goToNextMatch}
                disabled={
                  !isArchiveComplete ||
                  !searchMatches.length ||
                  activeMatchIndex === searchMatches.length - 1
                }
              >
                <WhatsappIcon name="chevronDown" />
              </button>
            </div>
          </>
        ) : (
          <>
            <span className="wa-back" aria-hidden="true">
              <WhatsappIcon name="back" />
            </span>
            <button
              type="button"
              className="chat-contact-button"
              aria-label="Open Wrapped recap"
              onClick={onOpenRecap}
            >
              <span className="chat-avatar" aria-hidden="true">
                <span>{initialFor(contactSender)}</span>
              </span>
              <span className="chat-contact-copy">
                <span className="chat-contact-name">{contactSender ?? 'Chat'}</span>
                <span className="chat-contact-subtitle">{archiveStatus}</span>
              </span>
            </button>
            <div className="wa-actions">
              <span aria-hidden="true">
                <WhatsappIcon name="video" />
              </span>
              <span aria-hidden="true">
                <WhatsappIcon name="phone" />
              </span>
              <button
                type="button"
                aria-label="Open chat options"
                aria-expanded={isMenuOpen}
                onClick={() => setIsMenuOpen((open) => !open)}
              >
                <WhatsappIcon name="more" />
              </button>
            </div>
            {isMenuOpen ? (
              <div className="wa-menu">
                <button type="button" onClick={openSearch}>
                  <WhatsappIcon name="search" />
                  Search
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsMenuOpen(false)
                    onOpenPrivacy()
                  }}
                >
                  <WhatsappIcon name="lock" />
                  Privacy
                </button>
              </div>
            ) : null}
          </>
        )}
      </header>

      <div className="chat-tools" aria-label="Archive controls">
        <button type="button" className="desktop-search-button" onClick={openSearch}>
          <WhatsappIcon name="search" />
          Search this chat
          {query ? <span>{query}</span> : null}
        </button>
        <label>
          <span>Sender</span>
          <select value={sender} onChange={(event) => setSender(event.target.value)}>
            <option value="all">Everyone</option>
            {participants.map((participant) => (
              <option key={participant} value={participant}>
                {participant}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Date</span>
          <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
        </label>
        <label className="toggle-control">
          <input
            type="checkbox"
            checked={mediaOnly}
            onChange={(event) => setMediaOnly(event.target.checked)}
          />
          <span>Media only</span>
        </label>
      </div>

      {isSearchOpen && query.trim() && !searchMatches.length ? (
        <div className="search-empty" role="status">
          {isArchiveComplete ? 'No messages found' : (loadError ?? 'Loading full archive before searching')}
        </div>
      ) : null}

      {scrollDateLabel ? (
        <div className={`scroll-date-indicator ${showScrollDate ? 'visible' : ''}`} aria-hidden="true">
          {scrollDateLabel}
        </div>
      ) : null}

      <div className="chat-list" ref={parentRef} role="region" aria-label="Message history" tabIndex={0}>
        <div
          className="chat-list-inner"
          style={{
            height: `${rowVirtualizer.getTotalSize()}px`,
          }}
        >
          {rowVirtualizer.getVirtualItems().map((virtualRow) => {
            const row = rows[virtualRow.index]
            if (!row) return null

            return (
              <div
                className="chat-virtual-row"
                key={row.id}
                ref={rowVirtualizer.measureElement}
                data-index={virtualRow.index}
                style={{ transform: `translateY(${virtualRow.start}px)` }}
              >
                {row.kind === 'date' ? (
                  <div className="date-chip">{row.label}</div>
                ) : (
                  <MessageBubble
                    message={row.message}
                    isOwn={row.message.sender === ownSender}
                    media={row.message.mediaRef ? mediaByName.get(row.message.mediaRef) : undefined}
                    isSearchMatch={searchMatchIds.has(row.message.id)}
                    isActiveSearchMatch={activeMatch?.id === row.message.id}
                    showSenderName={!isOneToOne}
                  />
                )}
              </div>
            )
          })}
        </div>
      </div>

      {showJumpToLatest ? (
        <button
          type="button"
          className="jump-to-latest"
          aria-label="Jump to latest messages"
          onClick={scrollToLatest}
        >
          <WhatsappIcon name="chevronDown" />
        </button>
      ) : null}

      <footer className="chat-footer">
        <span>
          {visibleMessages.length.toLocaleString()} shown
          {isArchiveComplete ? '' : ' from latest messages'}
        </span>
        <span>Local archive, no upload required</span>
      </footer>
      <div className="chat-composer" aria-hidden="true">
        <span className="composer-plus">
          <WhatsappIcon name="plus" />
        </span>
        <div className="composer-input">
          <WhatsappIcon name="emoji" />
          <span>Message</span>
          <WhatsappIcon name="camera" />
        </div>
        <span className="composer-mic">
          <WhatsappIcon name="mic" />
        </span>
      </div>
    </section>
  )
}

function buildRows(messages: MemoryMessage[]): ChatRow[] {
  const rows: ChatRow[] = []
  let previousDay = ''

  for (const message of messages) {
    const day = message.dateKey
    if (day !== previousDay) {
      rows.push({
        kind: 'date',
        id: `date_${day}`,
        label: formatDate(message.dateKey),
      })
      previousDay = day
    }

    rows.push({ kind: 'message', id: message.id, message })
  }

  return rows
}

function currentVisibleDateLabel(startIndex: number, rows: ChatRow[]): string {
  for (let index = Math.max(0, startIndex); index >= 0; index -= 1) {
    const row = rows[index]
    if (row?.kind === 'date') return row.label
  }

  return ''
}

function messageMatchesQuery(message: MemoryMessage, normalizedQuery: string): boolean {
  return (
    message.text.toLowerCase().includes(normalizedQuery) ||
    message.sender?.toLowerCase().includes(normalizedQuery) ||
    message.mediaRef?.toLowerCase().includes(normalizedQuery) ||
    false
  )
}

function initialFor(name?: string): string {
  return name?.trim().slice(0, 1).toUpperCase() || '?'
}

function formatDate(dateKey: string): string {
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(`${dateKey}T00:00:00`))
}
