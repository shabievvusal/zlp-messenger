import type { Chat } from '@/types'
import { useChatStore } from '@/store/chat'
import { Avatar } from '@/components/ui/Avatar'

interface Props {
  chat: Chat
}

export function ChatHeader({ chat }: Props) {
  const typing = useChatStore((s) => s.typing[chat.id])
  const typingCount = typing?.size ?? 0

  const title = chat.title ?? 'Unknown'
  const subtitle =
    typingCount > 0
      ? `${typingCount} typing...`
      : chat.type === 'private'
      ? 'last seen recently'
      : `${chat.members_count} members`

  return (
    <header className="flex items-center gap-3 px-4 py-3
      bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 z-10 shadow-sm">
      <Avatar name={title} url={chat.avatar_url} size={40} />
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm text-gray-900 dark:text-gray-100 truncate">{title}</p>
        <p className={`text-xs truncate ${typingCount > 0 ? 'text-primary-500 italic' : 'text-gray-500 dark:text-gray-400'}`}>
          {subtitle}
        </p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1">
        <IconBtn title="Search">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </IconBtn>
        <IconBtn title="Call">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
        </IconBtn>
        <IconBtn title="More">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
        </IconBtn>
      </div>
    </header>
  )
}

function IconBtn({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <button
      title={title}
      className="w-8 h-8 rounded-full flex items-center justify-center
        hover:bg-gray-100 dark:hover:bg-gray-700 transition text-gray-600 dark:text-gray-300"
    >
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        {children}
      </svg>
    </button>
  )
}
