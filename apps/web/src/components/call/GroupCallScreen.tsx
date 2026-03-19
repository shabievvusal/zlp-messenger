import { useEffect, useRef, useState } from 'react'
import { useGroupCallStore, GroupParticipant } from '@/store/groupCall'
import { useAuthStore } from '@/store/auth'

interface Props {
  onLeave: () => void
  onToggleMute: () => void
  onToggleVideo: () => void
  onMinimize: () => void
}

export function GroupCallScreen({ onLeave, onToggleMute, onToggleVideo, onMinimize }: Props) {
  const active = useGroupCallStore((s) => s.active)
  const currentUser = useAuthStore((s) => s.user)
  const [elapsed, setElapsed] = useState(0)
  const startRef = useRef(Date.now())

  useEffect(() => {
    startRef.current = Date.now()
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startRef.current) / 1000))
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  if (!active) return null

  const myName = currentUser
    ? `${currentUser.first_name}${currentUser.last_name ? ' ' + currentUser.last_name : ''}`
    : 'Вы'

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
  }

  // All tiles: local + remote participants
  const allTiles = [
    { userId: 'me', userName: myName, stream: active.localStream, isSelf: true },
    ...active.participants.map((p) => ({ ...p, isSelf: false })),
  ]

  // Grid layout: 1 → 1col, 2 → 2col, 3-4 → 2col, 5+ → 3col
  const count = allTiles.length
  const cols = count <= 1 ? 1 : count <= 4 ? 2 : 3

  return (
    <div className="fixed inset-0 z-50 bg-[#1a1a2e] flex flex-col text-white">

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-black/20">
        <div>
          <p className="text-sm font-semibold">Групповой звонок</p>
          <p className="text-xs text-gray-400">{formatTime(elapsed)} · {allTiles.length} участника</p>
        </div>
        <button
          onClick={onMinimize}
          className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      {/* Participant grid */}
      <div
        className="flex-1 grid gap-1 p-2 overflow-hidden"
        style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}
      >
        {allTiles.map((tile) => (
          <ParticipantTile
            key={tile.userId}
            userId={tile.userId}
            userName={tile.userName}
            stream={tile.stream}
            isSelf={tile.isSelf}
            isMuted={tile.isSelf ? active.isMuted : false}
          />
        ))}
      </div>

      {/* Controls */}
      <div className="flex justify-center items-center gap-5 py-6 bg-black/20">

        {/* Mute */}
        <CtrlBtn
          active={active.isMuted}
          onClick={onToggleMute}
          label={active.isMuted ? 'Включить микрофон' : 'Выключить микрофон'}
          activeClass="bg-white/25"
        >
          {active.isMuted ? (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
          )}
        </CtrlBtn>

        {/* Video toggle */}
        <CtrlBtn
          active={active.isVideoOff}
          onClick={onToggleVideo}
          label={active.isVideoOff ? 'Включить камеру' : 'Выключить камеру'}
          activeClass="bg-white/25"
        >
          {active.isVideoOff ? (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z M3 3l18 18" />
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          )}
        </CtrlBtn>

        {/* Leave */}
        <button
          onClick={onLeave}
          className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center
            transition-all active:scale-90 shadow-lg shadow-red-500/40"
          title="Покинуть звонок"
        >
          <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M16 8l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M5 3a2 2 0 00-2 2v1c0 8.284 6.716 15 15 15h1a2 2 0 002-2v-3.28a1 1 0 00-.684-.948l-4.493-1.498a1 1 0 00-1.21.502l-1.13 2.257a11.042 11.042 0 01-5.516-5.517l2.257-1.128a1 1 0 00.502-1.21L9.228 3.683A1 1 0 008.279 3H5z" />
          </svg>
        </button>

      </div>
    </div>
  )
}

// ── Participant tile ──────────────────────────────────────────
function ParticipantTile({
  userName, stream, isSelf, isMuted,
}: {
  userId: string
  userName: string
  stream: MediaStream | null
  isSelf: boolean
  isMuted: boolean
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const audioRef = useRef<HTMLAudioElement>(null)

  useEffect(() => {
    if (!stream) return
    if (videoRef.current) {
      videoRef.current.srcObject = stream
    }
    // Remote audio (not self)
    if (!isSelf && audioRef.current) {
      audioRef.current.srcObject = stream
    }
  }, [stream, isSelf])

  const hasVideo = stream && stream.getVideoTracks().some((t) => t.enabled)

  return (
    <div className="relative rounded-2xl overflow-hidden bg-gray-800/60 flex items-center justify-center min-h-[120px]">
      {/* Remote audio (hidden) */}
      {!isSelf && <audio ref={audioRef} autoPlay playsInline className="hidden" />}

      {/* Video or avatar */}
      {hasVideo ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isSelf}
          className="absolute inset-0 w-full h-full object-cover"
          style={isSelf ? { transform: 'scaleX(-1)' } : undefined}
        />
      ) : (
        <div className="flex flex-col items-center gap-2">
          <div className="w-14 h-14 rounded-full bg-gray-600 flex items-center justify-center text-xl font-bold">
            {userName.charAt(0).toUpperCase()}
          </div>
        </div>
      )}

      {/* Name + mute overlay */}
      <div className="absolute bottom-0 left-0 right-0 px-2 pb-1.5 pt-4
        bg-gradient-to-t from-black/60 to-transparent flex items-center gap-1.5">
        {isMuted && (
          <svg className="w-3 h-3 text-red-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
          </svg>
        )}
        <span className="text-white text-[11px] font-medium truncate">
          {isSelf ? `${userName} (вы)` : userName}
        </span>
      </div>
    </div>
  )
}

function CtrlBtn({
  active, onClick, label, activeClass, children,
}: {
  active: boolean
  onClick: () => void
  label: string
  activeClass: string
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      className={`flex flex-col items-center gap-1.5`}
    >
      <span className={`w-12 h-12 rounded-full flex items-center justify-center transition-all active:scale-90
        ${active ? activeClass : 'bg-white/10 hover:bg-white/20'}`}>
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          {children}
        </svg>
      </span>
      <span className="text-[10px] text-gray-400">{label}</span>
    </button>
  )
}
