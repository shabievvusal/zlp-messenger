import { useState } from 'react'
import { format } from 'date-fns'
import { clsx } from 'clsx'
import type { Message } from '@/types'
import { chatApi } from '@/api/chat'
import { useChatStore } from '@/store/chat'
import { useAuthStore } from '@/store/auth'

interface Props {
  msg: Message
  isOwn: boolean
}

export function MessageBubble({ msg, isOwn }: Props) {
  const [showMenu, setShowMenu] = useState(false)
  const updateMessage = useChatStore((s) => s.updateMessage)
  const removeMessage = useChatStore((s) => s.removeMessage)
  const currentUser = useAuthStore((s) => s.user)

  const handleDelete = async () => {
    await chatApi.deleteMessage(msg.id)
    removeMessage(msg.chat_id, msg.id)
    setShowMenu(false)
  }

  const handleReact = async (emoji: string) => {
    await chatApi.addReaction(msg.id, emoji)
    setShowMenu(false)
  }

  return (
    <div
      className="relative group max-w-[70%]"
      onContextMenu={(e) => { e.preventDefault(); setShowMenu(true) }}
    >
      {/* Reply preview */}
      {msg.reply_to && (
        <div className={clsx(
          'mb-1 px-2 py-1 border-l-2 rounded text-xs',
          isOwn
            ? 'border-green-600 bg-green-100/50 dark:bg-green-900/30'
            : 'border-blue-400 bg-blue-100/50 dark:bg-blue-900/30'
        )}>
          <p className="font-medium text-primary-600 dark:text-primary-400 truncate">
            {msg.reply_to.sender?.first_name ?? 'Unknown'}
          </p>
          <p className="text-gray-600 dark:text-gray-400 truncate">{msg.reply_to.text}</p>
        </div>
      )}

      {/* Bubble */}
      <div className={clsx(isOwn ? 'bubble-out' : 'bubble-in')}>
        {/* Sender name in group */}
        {!isOwn && msg.sender && (
          <p className="text-xs font-semibold text-primary-500 mb-0.5">
            {msg.sender.first_name}
          </p>
        )}

        {/* Text */}
        {msg.text && (
          <p className="text-sm text-gray-900 dark:text-gray-100 whitespace-pre-wrap break-words leading-relaxed">
            {msg.text}
          </p>
        )}

        {/* Attachments */}
        {msg.attachments?.map((a) => (
          <div key={a.id} className="mt-1">
            {a.type === 'photo' && (
              <img src={a.url} alt="" className="max-w-full rounded-lg max-h-80 object-cover" />
            )}
            {a.type === 'video' && (
              <video src={a.url} controls className="max-w-full rounded-lg max-h-80" />
            )}
            {a.type === 'document' && (
              <a href={a.url} target="_blank" rel="noreferrer"
                className="flex items-center gap-2 text-xs text-primary-600 hover:underline">
                <span>📎</span>
                <span className="truncate">{a.file_name ?? 'File'}</span>
              </a>
            )}
          </div>
        ))}

        {/* Reactions */}
        {msg.reactions && msg.reactions.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {Object.entries(
              msg.reactions.reduce((acc, r) => {
                acc[r.emoji] = (acc[r.emoji] ?? 0) + 1
                return acc
              }, {} as Record<string, number>)
            ).map(([emoji, count]) => (
              <button
                key={emoji}
                onClick={() => handleReact(emoji)}
                className="text-xs bg-black/10 dark:bg-white/10 rounded-full px-1.5 py-0.5
                  hover:bg-black/20 transition"
              >
                {emoji} {count}
              </button>
            ))}
          </div>
        )}

        {/* Meta */}
        <div className="flex items-center justify-end gap-1 mt-1">
          {msg.is_edited && (
            <span className="text-[10px] text-gray-400">edited</span>
          )}
          <span className="text-[10px] text-gray-400">
            {format(new Date(msg.created_at), 'HH:mm')}
          </span>
          {isOwn && (
            <span className="text-[10px] text-gray-400">✓✓</span>
          )}
        </div>
      </div>

      {/* Context menu */}
      {showMenu && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
          <div className="absolute z-50 bg-white dark:bg-gray-800 shadow-lg rounded-xl py-1 min-w-[160px]
            border border-gray-100 dark:border-gray-700"
            style={{ top: '100%', [isOwn ? 'right' : 'left']: 0 }}>

            <div className="flex gap-1 px-2 py-1 border-b border-gray-100 dark:border-gray-700">
              {['👍', '❤️', '😂', '😮', '😢', '🔥'].map((e) => (
                <button key={e} onClick={() => handleReact(e)}
                  className="text-lg hover:scale-125 transition-transform">
                  {e}
                </button>
              ))}
            </div>

            <MenuItem onClick={() => setShowMenu(false)}>↩ Reply</MenuItem>
            <MenuItem onClick={() => setShowMenu(false)}>⤵ Forward</MenuItem>
            {isOwn && <MenuItem onClick={() => setShowMenu(false)}>✏️ Edit</MenuItem>}
            {isOwn && (
              <MenuItem onClick={handleDelete} className="text-red-500">
                🗑 Delete
              </MenuItem>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function MenuItem({ children, onClick, className }: {
  children: React.ReactNode
  onClick: () => void
  className?: string
}) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        'w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition',
        className
      )}
    >
      {children}
    </button>
  )
}
