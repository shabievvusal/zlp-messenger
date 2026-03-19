import { useEffect, useRef } from 'react'
import { useCallStore } from '@/store/call'
import { Avatar } from '@/components/ui/Avatar'

interface Props {
  onAccept: (type: 'voice' | 'video') => void
  onDecline: () => void
}

export function IncomingCallModal({ onAccept, onDecline }: Props) {
  const incoming = useCallStore((s) => s.incoming)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    if (!incoming) return
    // Play ringtone using Web Audio API oscillator (no external file needed)
    const ctx = new AudioContext()
    const gain = ctx.createGain()
    gain.gain.value = 0.15
    gain.connect(ctx.destination)

    let active = true
    const ring = () => {
      if (!active) return
      const osc = ctx.createOscillator()
      osc.type = 'sine'
      osc.frequency.value = 480
      osc.connect(gain)
      osc.start()
      setTimeout(() => { osc.stop(); osc.disconnect() }, 400)
      setTimeout(() => {
        if (!active) return
        const osc2 = ctx.createOscillator()
        osc2.type = 'sine'
        osc2.frequency.value = 480
        osc2.connect(gain)
        osc2.start()
        setTimeout(() => { osc2.stop(); osc2.disconnect() }, 400)
      }, 600)
    }

    ring()
    const interval = setInterval(ring, 3000)

    return () => {
      active = false
      clearInterval(interval)
      ctx.close()
    }
  }, [incoming])

  if (!incoming) return null

  const isVideo = incoming.type === 'video'

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-md animate-fadeIn" />

      {/* Card */}
      <div className="relative w-full max-w-sm animate-slideUp
        bg-gradient-to-b from-gray-800 to-gray-900
        rounded-3xl p-6 text-white shadow-2xl
        border border-white/10">

        {/* Caller info */}
        <div className="flex flex-col items-center gap-3 mb-8">
          <div className="relative">
            <Avatar name={incoming.callerName} url={incoming.callerAvatar} size={88} />
            {/* Pulse rings */}
            <span className="absolute inset-[-6px] rounded-full border-2 border-white/20 animate-ping" />
            <span className="absolute inset-[-14px] rounded-full border border-white/10 animate-ping"
              style={{ animationDelay: '0.3s' }} />
          </div>
          <div className="text-center mt-1">
            <p className="text-xl font-semibold">{incoming.callerName}</p>
            <p className="text-sm text-gray-400 mt-1 animate-pulse">
              {isVideo ? '📹 Входящий видеозвонок…' : '📞 Входящий звонок…'}
            </p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex justify-center gap-12">
          {/* Decline */}
          <button
            onClick={onDecline}
            className="flex flex-col items-center gap-2 group"
          >
            <span className="w-16 h-16 rounded-full bg-red-500 flex items-center justify-center
              shadow-lg shadow-red-500/30 group-hover:bg-red-600 group-active:scale-90
              transition-all">
              <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M16 8l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M5 3a2 2 0 00-2 2v1c0 8.284 6.716 15 15 15h1a2 2 0 002-2v-3.28a1 1 0 00-.684-.948l-4.493-1.498a1 1 0 00-1.21.502l-1.13 2.257a11.042 11.042 0 01-5.516-5.517l2.257-1.128a1 1 0 00.502-1.21L9.228 3.683A1 1 0 008.279 3H5z" />
              </svg>
            </span>
            <span className="text-sm text-gray-300">Отклонить</span>
          </button>

          {/* Accept voice */}
          {!isVideo && (
            <button
              onClick={() => onAccept('voice')}
              className="flex flex-col items-center gap-2 group"
            >
              <span className="w-16 h-16 rounded-full bg-green-500 flex items-center justify-center
                shadow-lg shadow-green-500/30 group-hover:bg-green-600 group-active:scale-90
                transition-all">
                <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
              </span>
              <span className="text-sm text-gray-300">Принять</span>
            </button>
          )}

          {/* Accept video */}
          {isVideo && (
            <button
              onClick={() => onAccept('video')}
              className="flex flex-col items-center gap-2 group"
            >
              <span className="w-16 h-16 rounded-full bg-green-500 flex items-center justify-center
                shadow-lg shadow-green-500/30 group-hover:bg-green-600 group-active:scale-90
                transition-all">
                <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </span>
              <span className="text-sm text-gray-300">Принять</span>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
