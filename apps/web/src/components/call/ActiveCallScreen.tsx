import { useEffect, useRef, useState } from 'react'
import { useCallStore } from '@/store/call'
import { Avatar } from '@/components/ui/Avatar'

interface Props {
  onHangup: () => void
  onToggleMute: () => void
  onToggleVideo: () => void
}

export function ActiveCallScreen({ onHangup, onToggleMute, onToggleVideo }: Props) {
  const active = useCallStore((s) => s.active)
  const [elapsed, setElapsed] = useState(0)

  const localVideoRef = useRef<HTMLVideoElement>(null)
  const remoteVideoRef = useRef<HTMLVideoElement>(null)
  const remoteAudioRef = useRef<HTMLAudioElement>(null)

  // Attach local stream to local video element
  useEffect(() => {
    if (localVideoRef.current && active?.localStream) {
      localVideoRef.current.srcObject = active.localStream
    }
  }, [active?.localStream])

  // Attach remote stream to video (for video calls) and audio (always, for voice)
  useEffect(() => {
    if (!active?.remoteStream) return
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = active.remoteStream
    }
    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = active.remoteStream
    }
  }, [active?.remoteStream])

  // Timer
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

  return (
    <div className="fixed inset-0 z-50 bg-gray-900 flex flex-col text-white">

      {/* Hidden audio element — plays remote audio for all call types */}
      <audio ref={remoteAudioRef} autoPlay playsInline className="hidden" />

      {/* Remote video (background, video calls only) */}
      {isVideo && active.remoteStream ? (
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          className="absolute inset-0 w-full h-full object-cover"
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-b from-gray-800 to-gray-900" />
      )}

      {/* Overlay gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/60" />

      {/* Top: caller info */}
      <div className="relative z-10 flex flex-col items-center pt-16 gap-3">
        {!isVideo && (
          <Avatar name={active.targetName} size={96} />
        )}
        <p className="text-2xl font-semibold drop-shadow">{active.targetName}</p>
        <p className="text-sm text-gray-300 drop-shadow">
          {isConnecting
            ? (active.status === 'ringing' ? 'Звонит…' : 'Подключение…')
            : isReconnecting
            ? 'Переподключение…'
            : formatTime(elapsed)}
        </p>
      </div>

      {/* Local video (PiP) */}
      {isVideo && (
        <div className="absolute top-4 right-4 z-20 w-28 h-40 rounded-2xl overflow-hidden shadow-xl border border-white/20">
          <video
            ref={localVideoRef}
            autoPlay
            muted
            playsInline
            className="w-full h-full object-cover mirror"
            style={{ transform: 'scaleX(-1)' }}
          />
        </div>
      )}

      {/* Bottom controls */}
      <div className="relative z-10 mt-auto pb-12 px-8">
        <div className="flex justify-center items-center gap-6">

          {/* Mute */}
          <ControlBtn
            active={active.isMuted}
            onClick={onToggleMute}
            label={active.isMuted ? 'Unmute' : 'Mute'}
            activeColor="bg-white/20"
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
            className="w-20 h-20 rounded-full bg-red-500 hover:bg-red-600 transition-colors
              flex items-center justify-center shadow-xl"
          >
            <svg className="w-9 h-9" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M16 8l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M5 3a2 2 0 00-2 2v1c0 8.284 6.716 15 15 15h1a2 2 0 002-2v-3.28a1 1 0 00-.684-.948l-4.493-1.498a1 1 0 00-1.21.502l-1.13 2.257a11.042 11.042 0 01-5.516-5.517l2.257-1.128a1 1 0 00.502-1.21L9.228 3.683A1 1 0 008.279 3H5z" />
            </svg>
          </button>

          {/* Toggle video (only for video calls) */}
          {isVideo ? (
            <ControlBtn
              active={active.isVideoOff}
              onClick={onToggleVideo}
              label={active.isVideoOff ? 'Show video' : 'Hide video'}
              activeColor="bg-white/20"
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
            <ControlBtn
              active={false}
              onClick={() => {}}
              label="Speaker"
              activeColor="bg-white/20"
            >
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
  active,
  onClick,
  label,
  activeColor,
  children,
}: {
  active: boolean
  onClick: () => void
  label: string
  activeColor: string
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-1.5 group`}
      title={label}
    >
      <span className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors
        ${active ? activeColor : 'bg-white/10 hover:bg-white/20'}`}>
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          {children}
        </svg>
      </span>
      <span className="text-xs text-gray-300">{label}</span>
    </button>
  )
}
