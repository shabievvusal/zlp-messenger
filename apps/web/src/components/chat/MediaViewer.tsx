import { useEffect, useRef, useState } from 'react'
import { useChatCtx } from '@/contexts/ChatContext'

export function MediaViewer() {
  const { mediaViewer, closeMedia, mediaGallery, galleryIndex, nextGalleryImage, prevGalleryImage } = useChatCtx()
  const touchStartX = useRef(0)
  const [isGalleryMode, setIsGalleryMode] = useState(false)

  // Determine if we're showing gallery or single media
  useEffect(() => {
    setIsGalleryMode(!!mediaGallery && mediaGallery.length > 1)
  }, [mediaGallery])

  useEffect(() => {
    if (!mediaViewer && !mediaGallery) return
    
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeMedia()
      if (isGalleryMode) {
        if (e.key === 'ArrowRight') nextGalleryImage()
        if (e.key === 'ArrowLeft') prevGalleryImage()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [mediaViewer, mediaGallery, isGalleryMode, closeMedia, nextGalleryImage, prevGalleryImage])

  if (!mediaViewer && !mediaGallery) return null

  // Show gallery
  if (isGalleryMode && mediaGallery) {
    const current = mediaGallery[galleryIndex]
    return (
      <div
        className="fixed inset-0 z-[100] bg-black/92 backdrop-blur-sm
          flex items-center justify-center animate-fadeIn"
        onClick={closeMedia}
      >
        {/* Close button */}
        <button
          onClick={closeMedia}
          className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10
            flex items-center justify-center text-white hover:bg-white/25
            active:scale-90 transition-all text-lg z-10"
        >
          ✕
        </button>

        {/* Counter */}
        <div className="absolute top-4 left-4 text-white/70 text-sm font-medium">
          {galleryIndex + 1} / {mediaGallery.length}
        </div>

        {/* Media container */}
        <div
          onClick={(e) => e.stopPropagation()}
          className="max-w-[90vw] max-h-[90vh] animate-scaleIn relative flex items-center justify-center"
          onTouchStart={(e) => { touchStartX.current = e.touches[0].clientX }}
          onTouchEnd={(e) => {
            const diff = touchStartX.current - e.changedTouches[0].clientX
            if (diff > 50) nextGalleryImage()
            else if (diff < -50) prevGalleryImage()
          }}
        >
          {current.type === 'photo' || current.type === 'gif' ? (
            <img
              src={current.url}
              alt=""
              className="max-w-[90vw] max-h-[90vh] object-contain rounded-xl shadow-2xl"
            />
          ) : (
            <video
              src={current.url}
              controls
              autoPlay
              className="max-w-[90vw] max-h-[90vh] rounded-xl shadow-2xl"
            />
          )}
        </div>

        {/* Navigation arrows */}
        {mediaGallery.length > 1 && (
          <>
            <button
              onClick={(e) => { e.stopPropagation(); prevGalleryImage() }}
              className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/10
                flex items-center justify-center text-white hover:bg-white/25
                active:scale-90 transition-all text-xl"
            >
              ‹
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); nextGalleryImage() }}
              className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/10
                flex items-center justify-center text-white hover:bg-white/25
                active:scale-90 transition-all text-xl"
            >
              ›
            </button>
          </>
        )}

        {/* Download button */}
        <a
          href={current.url}
          download
          onClick={(e) => e.stopPropagation()}
          className="absolute bottom-4 left-4 w-10 h-10 rounded-full bg-white/10
            flex items-center justify-center text-white hover:bg-white/25
            active:scale-90 transition-all"
          title="Download"
        >
          ↓
        </a>
      </div>
    )
  }

  // Show single media (backward compatibility)
  if (mediaViewer) {
    return (
      <div
        className="fixed inset-0 z-[100] bg-black/92 backdrop-blur-sm
          flex items-center justify-center animate-fadeIn"
        onClick={closeMedia}
      >
        <button
          onClick={closeMedia}
          className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10
            flex items-center justify-center text-white hover:bg-white/25
            active:scale-90 transition-all text-lg"
        >
          ✕
        </button>

        <div onClick={(e) => e.stopPropagation()}
          className="max-w-[90vw] max-h-[90vh] animate-scaleIn">
          {mediaViewer.type === 'photo' ? (
            <img
              src={mediaViewer.url}
              alt=""
              className="max-w-[90vw] max-h-[90vh] object-contain rounded-xl shadow-2xl"
            />
          ) : (
            <video
              src={mediaViewer.url}
              controls
              autoPlay
              className="max-w-[90vw] max-h-[90vh] rounded-xl shadow-2xl"
            />
          )}
        </div>

        {/* Download button */}
        <a
          href={mediaViewer.url}
          download
          onClick={(e) => e.stopPropagation()}
          className="absolute bottom-4 left-4 w-10 h-10 rounded-full bg-white/10
            flex items-center justify-center text-white hover:bg-white/25
            active:scale-90 transition-all"
          title="Download"
        >
          ↓
        </a>
      </div>
    )
  }

  return null
}
        href={mediaViewer.url}
        download
        target="_blank"
        rel="noreferrer"
        onClick={(e) => e.stopPropagation()}
        className="absolute bottom-4 right-4 w-10 h-10 rounded-full bg-white/10
          flex items-center justify-center text-white hover:bg-white/25
          active:scale-90 transition-all text-lg"
        title="Download"
      >
        ↓
      </a>
    </div>
  )
}
