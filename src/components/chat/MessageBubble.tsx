import type { MediaManifestItem, MemoryMessage } from '../../lib/memory/types'
import { WhatsappIcon } from '../icons/WhatsappIcon'

interface MessageBubbleProps {
  message: MemoryMessage
  isOwn: boolean
  media?: MediaManifestItem
  isSearchMatch?: boolean
  isActiveSearchMatch?: boolean
  showSenderName?: boolean
}

export function MessageBubble({
  message,
  isOwn,
  media,
  isSearchMatch = false,
  isActiveSearchMatch = false,
  showSenderName = true,
}: MessageBubbleProps) {
  if (message.type === 'system') {
    return (
      <div className="system-message">
        <WhatsappIcon name="lock" className="system-lock" />
        <span>{message.text}</span>
      </div>
    )
  }

  return (
    <article
      className={`message-row ${isOwn ? 'own' : 'theirs'} ${isSearchMatch ? 'search-match' : ''} ${
        isActiveSearchMatch ? 'active-search-match' : ''
      }`}
      id={message.id}
    >
      <div className={`message-bubble ${message.type === 'call' ? 'call-bubble' : ''}`}>
        {showSenderName ? <div className="message-sender">{message.sender}</div> : null}
        {media ? <MediaPreview media={media} altText={message.text} /> : null}
        {message.mediaRef && !media ? (
          <div className="missing-media">
            <span>{message.mediaRef}</span>
            <small>Media reference from the export</small>
          </div>
        ) : null}
        {message.type === 'call' ? <CallPreview text={message.text} /> : null}
        {message.text && message.type !== 'call' ? <p>{message.text}</p> : null}
        <time>
          {message.edited ? <span className="edited-label">edited</span> : null}
          {formatMessageTime(message.timestamp)}
          {isOwn && message.type !== 'call' ? (
            <span className="read-receipt" aria-hidden="true">
              <WhatsappIcon name="checks" />
            </span>
          ) : null}
        </time>
      </div>
    </article>
  )
}

function CallPreview({ text }: { text: string }) {
  const normalized = cleanDisplayText(text)
  const [title = 'Call', ...details] = normalized.split(',').map((part) => part.trim())
  const isMissed = title.toLowerCase().includes('missed')

  return (
    <div className={`call-preview ${isMissed ? 'missed' : ''}`}>
      <span className="call-icon" aria-hidden="true">
        <WhatsappIcon name="phone" />
      </span>
      <span>
        <strong>{title}</strong>
        {details.length ? <small>{details.join(', ')}</small> : null}
      </span>
    </div>
  )
}

function MediaPreview({ media, altText }: { media: MediaManifestItem; altText: string }) {
  if (media.type === 'image' || media.type === 'sticker') {
    return <img className="media-preview image" src={media.path} alt={altText || media.filename} />
  }

  if (media.type === 'video') {
    return <video className="media-preview" src={media.path} controls preload="metadata" />
  }

  if (media.type === 'audio') {
    return <audio className="audio-preview" src={media.path} controls />
  }

  return (
    <a className="document-preview" href={media.path} download={media.filename}>
      Download {media.filename}
    </a>
  )
}

function formatMessageTime(timestamp: string): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(timestamp))
}

function cleanDisplayText(text: string): string {
  return text.replace(/[\u200e\u200f\u202a-\u202e]/g, '').replace(/\s+/g, ' ').trim()
}
