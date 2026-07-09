interface WhatsappIconProps {
  name:
    | 'attach'
    | 'back'
    | 'camera'
    | 'chevronDown'
    | 'chevronUp'
    | 'checks'
    | 'file'
    | 'image'
    | 'emoji'
    | 'lock'
    | 'mic'
    | 'more'
    | 'phone'
    | 'plus'
    | 'search'
    | 'video'
  className?: string
}

export function WhatsappIcon({ name, className = '' }: WhatsappIconProps) {
  return (
    <svg
      className={`wa-icon ${className}`}
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {paths[name]}
    </svg>
  )
}

const paths = {
  attach: (
    <path
      d="M8.2 12.4 13.9 6.7a3.3 3.3 0 0 1 4.7 4.7l-7 7a5 5 0 0 1-7.1-7.1l7.2-7.2"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
  back: (
    <path
      d="M15 5 8 12l7 7"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
  camera: (
    <>
      <path
        d="M5 8.2h3l1.5-2h5l1.5 2h3a1.8 1.8 0 0 1 1.8 1.8v7.2A1.8 1.8 0 0 1 19 19H5a1.8 1.8 0 0 1-1.8-1.8V10A1.8 1.8 0 0 1 5 8.2Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="13.4" r="3.1" stroke="currentColor" strokeWidth="1.8" />
    </>
  ),
  chevronDown: (
    <path
      d="m7 10 5 5 5-5"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
  chevronUp: (
    <path
      d="m7 14 5-5 5 5"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
  checks: (
    <>
      <path
        d="m4.8 12.6 3.1 3.1L15.3 8"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="m10 14.9.8.8L18.2 8"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </>
  ),
  file: (
    <>
      <path
        d="M7.5 3.8h6.1L18 8.2v11.1a1.7 1.7 0 0 1-1.7 1.7H7.5a1.7 1.7 0 0 1-1.7-1.7V5.5a1.7 1.7 0 0 1 1.7-1.7Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="M13.5 4v4.5H18" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M8.7 13h6.6M8.7 16h4.8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </>
  ),
  image: (
    <>
      <path
        d="M5.2 5.5h13.6A1.8 1.8 0 0 1 20.6 7.3v9.4a1.8 1.8 0 0 1-1.8 1.8H5.2a1.8 1.8 0 0 1-1.8-1.8V7.3a1.8 1.8 0 0 1 1.8-1.8Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="m4.2 16.4 4.2-4 3 2.7 2.4-2.5 5.8 5.4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="15.9" cy="9.2" r="1.3" fill="currentColor" />
    </>
  ),
  emoji: (
    <>
      <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M8.8 14.2c.7 1.3 1.8 2 3.2 2s2.5-.7 3.2-2"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M9.2 10h.1M14.7 10h.1"
        stroke="currentColor"
        strokeWidth="2.8"
        strokeLinecap="round"
      />
    </>
  ),
  lock: (
    <>
      <path
        d="M7.5 11h9A1.5 1.5 0 0 1 18 12.5v5A1.5 1.5 0 0 1 16.5 19h-9A1.5 1.5 0 0 1 6 17.5v-5A1.5 1.5 0 0 1 7.5 11Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M8.8 11V8.7a3.2 3.2 0 1 1 6.4 0V11"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </>
  ),
  mic: (
    <>
      <path
        d="M12 14.5a3 3 0 0 0 3-3V6.8a3 3 0 0 0-6 0v4.7a3 3 0 0 0 3 3Z"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M6.8 11.6a5.2 5.2 0 0 0 10.4 0M12 16.8V20M9.3 20h5.4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </>
  ),
  more: (
    <path
      d="M12 6.2h.01M12 12h.01M12 17.8h.01"
      stroke="currentColor"
      strokeWidth="3.2"
      strokeLinecap="round"
    />
  ),
  phone: (
    <>
      <path d="M16 2v6h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="m22 2-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path
        d="M13.832 16.568a1 1 0 0 0 1.213-.303l.355-.465A2 2 0 0 1 17 15h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2A18 18 0 0 1 2 4a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v3a2 2 0 0 1-.8 1.6l-.468.351a1 1 0 0 0-.292 1.233 14 14 0 0 0 6.392 6.384"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </>
  ),
  plus: (
    <path
      d="M12 5v14M5 12h14"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
    />
  ),
  search: (
    <>
      <circle cx="10.8" cy="10.8" r="6.3" stroke="currentColor" strokeWidth="2" />
      <path d="m15.6 15.6 4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </>
  ),
  video: (
    <>
      <path
        d="M4.8 7.2h8.8a2 2 0 0 1 2 2v5.6a2 2 0 0 1-2 2H4.8a2 2 0 0 1-2-2V9.2a2 2 0 0 1 2-2Z"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinejoin="round"
      />
      <path
        d="m15.6 10.1 4.8-2.8v9.4l-4.8-2.8"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </>
  ),
} as const
