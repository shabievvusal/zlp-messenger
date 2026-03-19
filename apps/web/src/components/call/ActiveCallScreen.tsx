import { useEffect, useRef, useState } from 'react'
import { useCallStore } from '@/store/call'
import { Avatar } from '@/components/ui/Avatar'

interface Props {
  onHangup: () => void
  onToggleMute: () => void
  onToggleVideo: () => void
  onMinimize: () => void
  isMaximized: boolean
  onToggleMaximize: () => void
}

export function ActiveCallScreen({
  onHangup, onToggleMute, onToggleVideo,
  onMinimize, isMaximized, onToggleMaximize,
}: Props) {
  const active = useCallStore((s) => s.active)
  const [elapsed, setElapsed] = useState(0)

  const localVideoRef = useRef<HTMLVideoElement>(null)
  const remoteVideoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    if (localVideoRef.current && active?.localStream) {
      localVideoRef.current.srcObject = active.localStream
    }
  }, [active?.localStream])

  // Remote video — MUTED, audio handled by persistent <audio> in MessengerPage
  useEffect(() => {
    if (remoteVideoRef.current && active?.remoteStream) {
      remoteVideoRef.current.srcObject = active.remoteStream
    }
  }, [active?.remoteStream])

  useEffect(() => {
    if (!active?.startedAt) return
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - active.startedAt!) / 1000))
    }, 1000)
    return () => clearInterval(interval)
  }, [active?.startedAt])

  if (!active || active.status === 'ended') return null

  const isVideo = active.type === 'video'
  const isConnecting = active.status === 'connecting' || active.status === 'ringing'
  const isReconnecting = active.status === 'reconnecting'

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
  }

  const containerCls = isMaximized
    ? 'fixed inset-0 z-50'
    : 'fixed bottom-4 right-4 z-50 w-72 rounded-2xl overflow-hidden shadow-2xl'

  return (
    <div className={`${containerCls} bg-gray-900 flex flex-col text-white animate-scaleIn`}>

      {/* Remote video background — muted, audio via persistent <audio> in MessengerPage */}
      {isVideo && active.remoteStream ? (
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          muted
          className="absolute inset-0 w-full h-full object-cover"
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-b from-gray-800 to-gray-900" />
      )}

      <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/60" />

      {/* Top bar: minimize + maximize */}
      <div className="relative z-10 flex items-center justify-between px-3 pt-3">
        <button
          onClick={onMinimize}
          title="Свернуть"
          className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        <button
          onClick={onToggleMaximize}
          title={isMaximized ? 'Уменьшить' : 'Развернуть'}
          className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
        >
          {isMaximized ? (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
            </svg>
          )}
        </button>
      </div>

      {/* Caller info */}
      <div className="relative z-10 flex flex-col items-center pt-3 pb-2 gap-2">
        {!isVideo && <Avatar name={active.targetName} size={isMaximized ? 80 : 52} />}
        <p className={`font-semibold drop-shadow ${isMaximized ? 'text-xl' : 'text-base'}`}>
          {active.targetName}
        </p>
        <p className="text-xs text-gray-300 drop-shadow">
          {isConnecting
            ? (active.status === 'ringing' ? 'Звонит…' : 'Подключение…')
            : isReconnecting ? 'Переподключение…'
            : formatTime(elapsed)}
        </p>
      </div>

      {/* Local video PiP */}
      {isVideo && (
        <div className={`absolute z-20 rounded-xl overflow-hidden shadow-xl border border-white/20
          ${isMaximized ? 'top-4 right-4 w-28 h-40' : 'top-14 right-2 w-16 h-24'}`}>
          <video
            ref={localVideoRef}
            autoPlay muted playsInline
            className="w-full h-full object-cover"
            style={{ transform: 'scaleX(-1)' }}
          />
        </div>
      )}

      {/* Controls */}
      <div className={`relative z-10 mt-auto ${isMaximized ? 'pb-12 px-8' : 'pb-4 px-4'}`}>
        <div className="flex justify-center items-center gap-4">

          <ControlBtn
            active={active.isMuted}
            onClick={onToggleMute}
            label={active.isMuted ? 'Микрофон' : 'Микрофон'}
            activeColor="bg-white/25"
            small={!isMaximized}
          >
            {active.isMuted ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            )}
          </ControlBtn>

          {/* Hangup */}
          <button
            onClick={onHangup}
            className={`rounded-full bg-red-500 hover:bg-red-600 active:scale-90
              flex items-center justify-center transition-all shadow-lg shadow-red-500/40
              ${isMaximized ? 'w-16 h-16' : 'w-12 h-12'}`}
          >
            <svg className={isMaximized ? 'w-8 h-8' : 'w-6 h-6'} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M16 8l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M5 3a2 2 0 00-2 2v1c0 8.284 6.716 15 15 15h1a2 2 0 002-2v-3.28a1 1 0 00-.684-.948l-4.493-1.498a1 1 0 00-1.21.502l-1.13 2.257a11.042 11.042 0 01-5.516-5.517l2.257-1.128a1 1 0 00.502-1.21L9.228 3.683A1 1 0 008.279 3H5z" />
            </svg>
          </button>

          {isVideo ? (
            <ControlBtn
              active={active.isVideoOff}
              onClick={onToggleVideo}
              label="Камера"
              activeColor="bg-white/25"
              small={!isMaximized}
            >
              {active.isVideoOff ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z M3 3l18 18" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              )}
            </ControlBtn>
          ) : (
            <ControlBtn active={false} onClick={() => {}} label="Динамик" activeColor="bg-white/20" small={!isMaximized}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M15.536 8.464a5 5 0 010 7.072M12 6a7 7 0 010 12M8.464 15.536a5 5 0 010-7.072" />
            </ControlBtn>
          )}
        </div>
      </div>
    </div>
  )
}

function ControlBtn({
  active, onClick, label, activeColor, small, children,
}: {
  active: boolean; onClick: () => void; label: string
  activeColor: string; small?: boolean; children: React.ReactNode
}) {
  return (
    <button onClick={onClick} title={label} className="flex flex-col items-center gap-1">
      <span className={`rounded-full flex items-center justify-center transition-all active:scale-90
        ${small ? 'w-10 h-10' : 'w-12 h-12'}
        ${active ? activeColor : 'bg-white/10 hover:bg-white/20'}`}>
        <svg className={small ? 'w-5 h-5' : 'w-6 h-6'} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          {children}
        </svg>
      </span>
    </button>
  )
}
