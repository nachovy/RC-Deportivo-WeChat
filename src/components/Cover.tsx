import { useEffect, useState } from 'react'
import { displayCoverSrc } from '../lib/wechatCover'

type CoverProps = {
  src: string
  title: string
  className?: string
  crop?: 'center' | 'right'
}

export function Cover({
  src,
  title,
  className = '',
  crop = 'center',
}: CoverProps) {
  const [failed, setFailed] = useState(false)
  const displaySrc = displayCoverSrc(src)

  useEffect(() => {
    setFailed(false)
  }, [src])

  if (!displaySrc || failed) {
    return (
      <div
        className={`cover-placeholder flex h-full w-full items-center justify-center text-white ${className}`}
        role="img"
        aria-label={title}
      >
        <img
          src="./crest.svg"
          alt=""
          className="h-10 w-auto object-contain opacity-90"
        />
      </div>
    )
  }

  return (
    <img
      src={displaySrc}
      alt={title}
      referrerPolicy="no-referrer"
      className={`h-full w-full object-cover ${
        crop === 'right' ? 'object-right' : 'object-center'
      } ${className}`}
      onError={() => setFailed(true)}
    />
  )
}
