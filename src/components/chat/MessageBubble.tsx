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

  const isTextBubble = message.type === 'text' || message.type === 'deleted'
  const isAttachment = isAttachmentMessage(message)
  const displayText = displayTextForMessage(message)

  return (
    <article
      className={`message-row ${isOwn ? 'own' : 'theirs'} ${isSearchMatch ? 'search-match' : ''} ${
        isActiveSearchMatch ? 'active-search-match' : ''
      }`}
      id={message.id}
    >
      <div
        className={`message-bubble ${message.type === 'call' ? 'call-bubble' : ''} ${
          isTextBubble ? 'text-bubble' : ''
        } ${isAttachment ? 'attachment-bubble' : ''} ${message.edited ? 'edited-bubble' : ''}`}
      >
        {showSenderName ? <div className="message-sender">{message.sender}</div> : null}
        {media ? <MediaPreview media={media} altText={message.text} /> : null}
        {!media && isAttachment ? <AttachmentPlaceholder message={message} /> : null}
        {message.type === 'call' ? <CallPreview text={message.text} /> : null}
        {displayText ? <p>{displayText}</p> : null}
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

function AttachmentPlaceholder({ message }: { message: MemoryMessage }) {
  if (message.type === 'document') {
    return (
      <div className="attachment-card document-card unavailable">
        <span className="attachment-icon document-icon" aria-hidden="true">
          <WhatsappIcon name="file" />
        </span>
        <span className="attachment-copy">
          <strong>Document unavailable</strong>
          <small>Skipped from this keepsake for privacy</small>
        </span>
      </div>
    )
  }

  const { title, detail, iconName } = attachmentMetaFor(message)

  return (
    <div className={`media-placeholder ${message.type}`}>
      <div className="media-placeholder-visual" aria-hidden="true">
        <span className="media-placeholder-icon">
          <WhatsappIcon name={iconName} />
        </span>
      </div>
      <div className="media-placeholder-copy">
        <strong>{title}</strong>
        <small>{detail}</small>
      </div>
    </div>
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
    <a className="attachment-card document-card" href={media.path} download={media.filename}>
      <span className="attachment-icon document-icon" aria-hidden="true">
        <WhatsappIcon name="file" />
      </span>
      <span className="attachment-copy">
        <strong>{media.filename}</strong>
        <small>Tap to download</small>
      </span>
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

function isAttachmentMessage(message: MemoryMessage): boolean {
  return ['image', 'video', 'audio', 'document', 'sticker'].includes(message.type)
}

function displayTextForMessage(message: MemoryMessage): string {
  if (!message.text || message.type === 'call') return ''
  if (!isAttachmentMessage(message)) return message.text

  const documentSentinel = 'Document attachment skipped for privacy.'
  if (message.text === documentSentinel) return ''
  if (message.text.startsWith(`${documentSentinel}\n`)) {
    return message.text.slice(documentSentinel.length).trim()
  }

  const [firstLine = '', ...captionLines] = message.text.split('\n')
  if (message.mediaRef && cleanDisplayText(firstLine) === message.mediaRef) {
    return captionLines.join('\n').trim()
  }

  return message.text
}

function attachmentMetaFor(message: MemoryMessage): {
  title: string
  detail: string
  iconName: 'camera' | 'image' | 'mic' | 'video'
} {
  if (message.type === 'video') {
    return {
      title: 'Video unavailable',
      detail: message.mediaRef ?? 'Media referenced in the export',
      iconName: 'video',
    }
  }

  if (message.type === 'audio') {
    return {
      title: 'Voice note unavailable',
      detail: message.mediaRef ?? 'Audio referenced in the export',
      iconName: 'mic',
    }
  }

  if (message.type === 'sticker') {
    return {
      title: 'Sticker unavailable',
      detail: message.mediaRef ?? 'Sticker referenced in the export',
      iconName: 'image',
    }
  }

  return {
    title: 'Photo unavailable',
    detail: message.mediaRef ?? 'Image referenced in the export',
    iconName: 'camera',
  }
}
