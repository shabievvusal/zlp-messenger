import { useEffect, useRef, useState, useMemo } from 'react'
import type { Attachment } from '@/types'

interface Props {
  attachment: Attachment
  isOwn: boolean
}

// Generate pseudo-random waveform bars seeded by url string
function generateBars(seed: string, count = 30): number[] {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0
  const bars: number[] = []
  for (let i = 0; i < count; i++) {
    h = (Math.imul(1664525, h) + 1013904223) | 0
    bars.push(20 + (Math.abs(h) % 80))
  }
  return bars
}

export function VoiceMessage({ attachment, isOwn }: Props) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [loading, setLoading] = useState(true)

  const bars = useMemo(() => generateBars(attachment.url), [attachment.url])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    console.log('[voice] src:', attachment.url)

    const onLoaded = () => {
      console.log('[voice] loadedmetadata, duration:', audio.duration)
      setDuration(audio.duration || 0)
      setLoading(false)
    }
    const onCanPlay = () => {
      console.log('[voice] canplay')
      setLoading(false)
    }
    const onError = (e: Event) => {
      const err = (e.target as HTMLAudioElement).error
      console.error('[voice] audio error:', err?.code, err?.message)
      setLoading(false)
    }
    const onTime = () => setCurrentTime(audio.currentTime)
    const onEnded = () => { setPlaying(false); setCurrentTime(0) }

    audio.addEventListener('loadedmetadata', onLoaded)
    audio.addEventListener('canplay', onCanPlay)
    audio.addEventListener('error', onError)
    audio.addEventListener('timeupdate', onTime)
    audio.addEventListener('ended', onEnded)

    return () => {
      audio.removeEventListener('loadedmetadata', onLoaded)
      audio.removeEventListener('canplay', onCanPlay)
      audio.removeEventListener('error', onError)
      audio.removeEventListener('timeupdate', onTime)
      audio.removeEventListener('ended', onEnded)
    }
  }, [])

  const togglePlay = () => {
    const audio = audioRef.current
    if (!audio) return
    if (playing) {
      audio.pause()
      setPlaying(false)
    } else {
      audio.play().catch(() => {})
      setPlaying(true)
    }
  }

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current
    if (!audio || !duration) return
    const rect = e.currentTarget.getBoundingClientRect()
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    audio.currentTime = ratio * duration
  }

  const fmt = (s: number) => {
    if (!isFinite(s)) return '0:00'
    const m = Math.floor(s / 60)
    const sec = Math.floor(s % 60)
    return `${m}:${String(sec).padStart(2, '0')}`
  }

  const progress = duration > 0 ? currentTime / duration : 0
  const filledCount = Math.round(progress * bars.length)

  const activeColor = isOwn ? 'var(--voice-bar-active-out)' : 'var(--voice-bar-active-in)'
  const inactiveColor = isOwn ? 'var(--voice-bar-inactive-out)' : 'var(--voice-bar-inactive-in)'

  return (
    <div className="flex items-center gap-3 py-1 min-w-[200px] max-w-[260px]">
      <audio ref={audioRef} src={attachment.url} preload="metadata" />

      {/* Play / Pause button */}
      <button
        onClick={togglePlay}
        disabled={loading}
        className={`
          flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center
          transition-all active:scale-90 disabled:opacity-50
          ${isOwn
            ? 'bg-black/10 dark:bg-white/20 hover:bg-black/15 dark:hover:bg-white/30 text-green-800 dark:text-white'
            : 'bg-primary-500 hover:bg-primary-600 text-white shadow-md shadow-primary-500/30'}
        `}
      >
        {loading ? (
          <svg className="w-4 h-4 animate-spin opacity-70" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path strokeLinecap="round" strokeWidth={2.5} d="M12 2a10 10 0 0 1 10 10" />
          </svg>
        ) : playing ? (
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M6 5h3v14H6zm9 0h3v14h-3z" />
          </svg>
        ) : (
          <svg className="w-4 h-4 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z" />
          </svg>
        )}
      </button>

      {/* Waveform + time */}
      <div className="flex-1 min-w-0 flex flex-col gap-1">
        {/* Waveform bars — clickable for seek */}
        <div
          className="flex items-center gap-[2px] h-8 cursor-pointer"
          onClick={handleSeek}
        >
          {bars.map((h, i) => (
            <div
              key={i}
              className="flex-1 rounded-full transition-colors duration-100"
              style={{
                height: `${h}%`,
                backgroundColor: i < filledCount ? activeColor : inactiveColor,
              }}
            />
          ))}
        </div>

        {/* Time */}
        <div className={`flex justify-between text-[10px] leading-none
          ${isOwn
            ? 'text-green-900/60 dark:text-white/60'
            : 'text-gray-400 dark:text-gray-500'}`}>
          <span>{fmt(currentTime > 0 ? currentTime : duration)}</span>
        </div>
      </div>
    </div>
  )
}
