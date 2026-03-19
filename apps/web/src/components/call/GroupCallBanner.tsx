import { useGroupCallStore } from '@/store/groupCall'

interface Props {
  chatId: string
  onJoin: () => void
}

export function GroupCallBanner({ chatId, onJoin }: Props) {
  const liveCall = useGroupCallStore((s) => s.liveCalls[chatId])
  const activeCallChatId = useGroupCallStore((s) => s.active?.chatId)

  if (!liveCall) return null
  // Don't show banner if we're already in the call for this chat
  if (activeCallChatId === chatId) return null

  const names = liveCall.participants.slice(0, 3).map((p) => p.userName).join(', ')
  const extra = liveCall.participants.length > 3 ? ` +${liveCall.participants.length - 3}` : ''

  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-green-500/10 border-b border-green-500/20 animate-slideDown">
      {/* Pulse */}
      <span className="relative flex-shrink-0">
        <span className="w-2 h-2 rounded-full bg-green-500 block" />
        <span className="absolute inset-0 rounded-full bg-green-500 animate-ping opacity-60" />
      </span>

      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-green-700 dark:text-green-400 truncate">
          Идёт групповой звонок
        </p>
        <p className="text-[10px] text-green-600 dark:text-green-500 truncate">
          {names}{extra}
        </p>
      </div>

      <button
        onClick={onJoin}
        className="flex-shrink-0 px-3 py-1 rounded-full bg-green-500 hover:bg-green-600
          text-white text-xs font-semibold transition-colors"
      >
        Присоединиться
      </button>
    </div>
  )
}
