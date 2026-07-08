import { useMemo, useState } from 'react'
import type { RecapCard, RecapData } from '../../lib/memory/types'

interface RecapStoryProps {
  recap: RecapData
  onOpenMessage: (messageId: string) => void
  onBackToChat: () => void
}

export function RecapStory({ recap, onOpenMessage, onBackToChat }: RecapStoryProps) {
  const [activeIndex, setActiveIndex] = useState(0)
  const cards = recap.cards
  const activeCard = cards[activeIndex]
  const progress = useMemo(
    () => cards.map((card, index) => ({ id: card.id, isActive: index <= activeIndex })),
    [activeIndex, cards],
  )

  if (!activeCard) {
    return (
      <section className="recap-panel empty">
        <p>Import a WhatsApp export to generate a recap.</p>
      </section>
    )
  }

  return (
    <section className="recap-panel" aria-label="Wrapped-style recap">
      <button type="button" className="screen-back-button" onClick={onBackToChat}>
        Back to chat
      </button>
      <div className="recap-progress" aria-hidden="true">
        {progress.map((item) => (
          <span key={item.id} className={item.isActive ? 'active' : ''} />
        ))}
      </div>

      <RecapCardView card={activeCard} onOpenMessage={onOpenMessage} />

      <div className="recap-actions">
        <button
          type="button"
          onClick={() => setActiveIndex((index) => Math.max(index - 1, 0))}
          disabled={activeIndex === 0}
        >
          Previous
        </button>
        <span>
          {activeIndex + 1} / {cards.length}
        </span>
        <button
          type="button"
          onClick={() => setActiveIndex((index) => Math.min(index + 1, cards.length - 1))}
          disabled={activeIndex === cards.length - 1}
        >
          Next
        </button>
      </div>
    </section>
  )
}

function RecapCardView({
  card,
  onOpenMessage,
}: {
  card: RecapCard
  onOpenMessage: (messageId: string) => void
}) {
  return (
    <article className="recap-card">
      <p className="eyebrow">{card.eyebrow}</p>
      <h2>{card.title}</h2>
      {card.metric ? <strong>{card.metric}</strong> : null}
      <p>{card.body}</p>
      {card.messageId ? (
        <button type="button" onClick={() => onOpenMessage(card.messageId!)}>
          Open this moment in chat
        </button>
      ) : null}
    </article>
  )
}
