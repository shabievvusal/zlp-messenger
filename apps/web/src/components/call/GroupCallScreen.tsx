import { useEffect, useRef, useState } from 'react'
import { useGroupCallStore } from '@/store/groupCall'
import { useAuthStore } from '@/store/auth'

interface Props {
  onLeave: () => void
  onToggleMute: () => void
  onToggleVideo: () => void
  onToggleScreenShare: () => void
  onMinimize: () => void
  isMaximized: boolean
  onToggleMaximize: () => void
}

export function GroupCallScreen({
  onLeave, onToggleMute, onToggleVideo, onToggleScreenShare,
  onMinimize, isMaximized, onToggleMaximize,
}: Props) {
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

  const allTiles = [
    { userId: 'me', userName: myName, stream: active.localStream, isSelf: true },
    ...active.participants.map((p) => ({ ...p, isSelf: false })),
  ]

  const count = allTiles.length
  const cols = count <= 1 ? 1 : count <= 4 ? 2 : 3

  const containerCls = isMaximized
    ? 'fixed inset-0 z-50'
    : 'fixed bottom-4 right-4 z-50 w-80 rounded-2xl overflow-hidden shadow-2xl'

  return (
    <div className={`${containerCls} bg-[#1a1a2e] flex flex-col text-white animate-scaleIn`}>

      {/* Screen share banner */}
      {active.isScreenSharing && (
        <div className="bg-blue-600/90 text-white text-xs text-center py-1 font-medium flex-shrink-0">
          Вы демонстрируете экран
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-black/20 flex-shrink-0">
        <div className="min-w-0">
          <p className="text-xs font-semibold truncate">Групповой звонок</p>
          <p className="text-[10px] text-gray-400">{formatTime(elapsed)} · {allTiles.length} уч.</p>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button
            onClick={onMinimize}
            title="Свернуть"
            className="w-6 h-6 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          <button
            onClick={onToggleMaximize}
            title={isMaximized ? 'Уменьшить' : 'Развернуть'}
            className="w-6 h-6 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
          >
            {isMaximized ? (
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25" />
              </svg>
            ) : (
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Participant grid */}
      <div
        className={`grid gap-1 p-1.5 ${isMaximized ? 'flex-1' : ''}`}
        style={{
          gridTemplateColumns: `repeat(${cols}, 1fr)`,
          ...(isMaximized ? {} : { maxHeight: '280px' }),
        }}
      >
        {allTiles.map((tile) => (
          <ParticipantTile
            key={tile.userId}
            userName={tile.userName}
            stream={tile.stream}
            isSelf={tile.isSelf}
            isMuted={tile.isSelf ? active.isMuted : false}
            compact={!isMaximized}
          />
        ))}
      </div>

      {/* Controls */}
      <div className="flex justify-center items-center gap-4 py-3 bg-black/20 flex-shrink-0">

        <CtrlBtn active={active.isMuted} onClick={onToggleMute} activeClass="bg-white/25" small>
          {active.isMuted ? (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
          )}
        </CtrlBtn>

        <CtrlBtn active={active.isVideoOff} onClick={onToggleVideo} activeClass="bg-white/25" small>
          {active.isVideoOff ? (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z M3 3l18 18" />
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          )}
        </CtrlBtn>

        {/* Screen share */}
        <CtrlBtn active={active.isScreenSharing} onClick={onToggleScreenShare} activeClass="bg-blue-500/70" small>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </CtrlBtn>

        <button
          onClick={onLeave}
          className="w-10 h-10 rounded-full bg-red-500 hover:bg-red-600 flex items-center
            justify-center transition-all active:scale-90 shadow-md shadow-red-500/40"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M16 8l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M5 3a2 2 0 00-2 2v1c0 8.284 6.716 15 15 15h1a2 2 0 002-2v-3.28a1 1 0 00-.684-.948l-4.493-1.498a1 1 0 00-1.21.502l-1.13 2.257a11.042 11.042 0 01-5.516-5.517l2.257-1.128a1 1 0 00.502-1.21L9.228 3.683A1 1 0 008.279 3H5z" />
          </svg>
        </button>
      </div>
    </div>
  )
}

// ── Participant tile — NO audio element here (moved to GroupAudioManager in MessengerPage) ──
function ParticipantTile({
  userName, stream, isSelf, isMuted, compact,
}: {
  userName: string; stream: MediaStream | null
  isSelf: boolean; isMuted: boolean; compact?: boolean
}) {
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    if (!stream || !videoRef.current) return
    videoRef.current.srcObject = stream
  }, [stream])

  const hasVideo = stream && stream.getVideoTracks().some((t) => t.readyState === 'live' && t.enabled)

  return (
    <div className={`relative rounded-xl overflow-hidden bg-gray-800/70 flex items-center justify-center
      ${compact ? 'min-h-[80px]' : 'min-h-[120px]'}`}>
      {hasVideo ? (
        <video
          ref={videoRef}
          autoPlay playsInline
          muted  /* audio handled by GroupAudioManager */
          className="absolute inset-0 w-full h-full object-cover"
          style={isSelf ? { transform: 'scaleX(-1)' } : undefined}
        />
      ) : (
        <div className={`rounded-full bg-gray-600 flex items-center justify-center font-bold
          ${compact ? 'w-10 h-10 text-base' : 'w-14 h-14 text-xl'}`}>
          {userName.charAt(0).toUpperCase()}
        </div>
      )}
      <div className="absolute bottom-0 left-0 right-0 px-1.5 pb-1 pt-3
        bg-gradient-to-t from-black/60 to-transparent flex items-center gap-1">
        {isMuted && (
          <svg className="w-2.5 h-2.5 text-red-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
          </svg>
        )}
        <span className="text-white text-[10px] font-medium truncate">
          {isSelf ? `${userName} (вы)` : userName}
        </span>
      </div>
    </div>
  )
}

function CtrlBtn({
  active, onClick, activeClass, small, children,
}: {
  active: boolean; onClick: () => void; activeClass: string; small?: boolean; children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full flex items-center justify-center transition-all active:scale-90
        ${small ? 'w-10 h-10' : 'w-12 h-12'}
        ${active ? activeClass : 'bg-white/10 hover:bg-white/20'}`}
    >
      <svg className={small ? 'w-5 h-5' : 'w-6 h-6'} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        {children}
      </svg>
    </button>
  )
}
