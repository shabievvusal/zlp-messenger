import { formatDistanceToNow } from 'date-fns'
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

  return (
    <button
      onClick={onClick}
      className={clsx(
        'w-full flex items-center gap-3 px-4 py-3 transition hover:bg-gray-100 dark:hover:bg-gray-700',
        active && 'bg-gray-200 dark:bg-gray-700'
      )}
    >
      <Avatar name={title} url={chat.avatar_url} size={48} />

      <div className="flex-1 min-w-0 text-left">
        <div className="flex items-center justify-between">
          <span className="font-medium text-sm text-gray-900 dark:text-gray-100 truncate">
            {title}
          </span>
          {lastMsg && (
            <span className="text-xs text-gray-400 flex-shrink-0 ml-1">
              {formatDistanceToNow(new Date(lastMsg.created_at), { addSuffix: false })}
            </span>
          )}
        </div>
        <div className="flex items-center justify-between mt-0.5">
          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
            {lastMsg?.text ?? ''}
          </p>
          {chat.unread_count > 0 && (
            <span className="ml-2 bg-primary-500 text-white text-xs rounded-full
              min-w-[20px] h-5 flex items-center justify-center px-1 flex-shrink-0">
              {chat.unread_count > 99 ? '99+' : chat.unread_count}
            </span>
          )}
        </div>
      </div>
    </button>
  )
}
