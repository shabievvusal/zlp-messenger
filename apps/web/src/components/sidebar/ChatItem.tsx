import { formatDistanceToNow } from 'date-fns'
import { ru } from 'date-fns/locale'
import { clsx } from 'clsx'
import type { Chat } from '@/types'
import { Avatar } from '@/components/ui/Avatar'

interface Props {
  chat: Chat
  active: boolean
  onClick: () => void
}

export function ChatItem({ chat, active, onClick }: Props) {
  const title = chat.title ?? 'Unknown'
  const lastMsg = chat.last_message

  const preview = lastMsg?.type === 'service'
    ? lastMsg.text
    : lastMsg?.text || (lastMsg?.attachments?.length ? '📎 Вложение' : '')

  return (
    <button
      onClick={onClick}
      className={clsx(
        'relative w-full flex items-center gap-3 px-4 py-3',
        'transition-all duration-150 ease-out',
        'hover:bg-black/5 dark:hover:bg-white/5',
        'active:scale-[0.99] active:bg-black/8 dark:active:bg-white/8',
        active
          ? 'bg-primary-500/10 dark:bg-primary-500/15'
          : ''
      )}
    >
      {/* Active indicator bar */}
      {active && (
        <div className="absolute left-0 top-3 bottom-3 w-[3px] bg-primary-500 rounded-r-full" />
      )}

      {/* Avatar */}
      <div className="flex-shrink-0">
        <Avatar name={title} url={chat.avatar_url} size={50} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 text-left">
        <div className="flex items-baseline justify-between gap-1">
          <span className={clsx(
            'font-medium text-sm truncate',
            active
              ? 'text-primary-600 dark:text-primary-400'
              : 'text-gray-900 dark:text-gray-100'
          )}>
            {title}
          </span>
          {lastMsg && (
            <span className="text-[11px] text-gray-400 dark:text-gray-500 flex-shrink-0">
              {formatDistanceToNow(new Date(lastMsg.created_at), { addSuffix: false, locale: ru })}
            </span>
          )}
        </div>

        <div className="flex items-center justify-between mt-0.5 gap-1">
          <p className={clsx(
            'text-xs truncate',
            lastMsg?.type === 'service'
              ? 'italic text-gray-400 dark:text-gray-500'
              : 'text-gray-500 dark:text-gray-400'
          )}>
            {preview}
          </p>
          {chat.unread_count > 0 && (
            <span className="ml-1 bg-primary-500 text-white text-[11px] font-medium
              rounded-full min-w-[20px] h-5 flex items-center justify-center
              px-1.5 flex-shrink-0 animate-popIn shadow-sm shadow-primary-500/30">
              {chat.unread_count > 99 ? '99+' : chat.unread_count}
            </span>
          )}
        </div>
      </div>
    </button>
  )
}
