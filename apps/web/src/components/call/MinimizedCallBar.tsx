import { useEffect, useState } from 'react'
import { useCallStore } from '@/store/call'

interface Props {
  onHangup: () => void
  onToggleMute: () => void
  onExpand: () => void
}

export function MinimizedCallBar({ onHangup, onToggleMute, onExpand }: Props) {
  const active = useCallStore((s) => s.active)
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    if (!active?.startedAt) return
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - active.startedAt!) / 1000))
    }, 1000)
    return () => clearInterval(interval)
  }, [active?.startedAt])

  if (!active || active.status === 'ended') return null

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
  }

  const isConnecting = active.status === 'connecting' || active.status === 'ringing'
  const isReconnecting = active.status === 'reconnecting'
  const statusText = isConnecting
    ? (active.status === 'ringing' ? 'Звонит…' : 'Подключение…')
    : isReconnecting
    ? 'Переподключение…'
    : formatTime(elapsed)

  return (
    <div className="fixed top-0 left-0 right-0 z-50 flex justify-center pointer-events-none">
      <div
        className="pointer-events-auto flex items-center gap-2 px-3 py-1.5
          bg-[#1a1a2e]/95 dark:bg-black/90 backdrop-blur-sm
          rounded-b-2xl shadow-2xl border border-white/10
          min-w-[240px] max-w-[380px] animate-slideDown"
      >
      {/* Green pulse dot */}
      <span className="relative flex-shrink-0">
        <span className="w-2 h-2 rounded-full bg-green-400 block" />
        <span className="absolute inset-0 rounded-full bg-green-400 animate-ping opacity-60" />
      </span>

      {/* Name + status — click to expand */}
      <button
        onClick={onExpand}
        className="flex-1 min-w-0 text-left"
      >
        <p className="text-white text-xs font-semibold truncate leading-tight">
          {active.targetName}
        </p>
        <p className="text-green-400 text-[10px] leading-tight">{statusText}</p>
      </button>

      {/* Mute */}
      <button
        onClick={onToggleMute}
        title={active.isMuted ? 'Включить микрофон' : 'Выключить микрофон'}
        className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors flex-shrink-0
          ${active.isMuted ? 'bg-white/25' : 'bg-white/10 hover:bg-white/20'}`}
      >
        <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          {active.isMuted ? (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
          )}
        </svg>
      </button>

      {/* Expand */}
      <button
        onClick={onExpand}
        title="Развернуть"
        className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors flex-shrink-0"
      >
        <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
        </svg>
      </button>

      {/* Hangup */}
      <button
        onClick={onHangup}
        title="Завершить звонок"
        className="w-7 h-7 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center transition-colors flex-shrink-0"
      >
        <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M16 8l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M5 3a2 2 0 00-2 2v1c0 8.284 6.716 15 15 15h1a2 2 0 002-2v-3.28a1 1 0 00-.684-.948l-4.493-1.498a1 1 0 00-1.21.502l-1.13 2.257a11.042 11.042 0 01-5.516-5.517l2.257-1.128a1 1 0 00.502-1.21L9.228 3.683A1 1 0 008.279 3H5z" />
        </svg>
      </button>
      </div>
    </div>
  )
}
