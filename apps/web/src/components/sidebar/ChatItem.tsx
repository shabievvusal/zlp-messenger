import { useState } from 'react'
import { clsx } from 'clsx'
import type { Chat } from '@/types'
import { Avatar } from '@/components/ui/Avatar'
import { useChatStore } from '@/store/chat'
import { ChatContextMenu } from './ChatContextMenu'

interface Props {
  chat: Chat
  active: boolean
  onClick: () => void
}

// Telegram-style sender name colors
const SENDER_COLORS = [
  '#e17076', '#faa774', '#a695e7', '#7bc862',
  '#6ec9cb', '#65aadd', '#ee7aae',
]
function getSenderColor(id: string): string {
  let h = 0
  for (let i = 0; i < id.length; i++) h = id.charCodeAt(i) + ((h << 5) - h)
  return SENDER_COLORS[Math.abs(h) % SENDER_COLORS.length]
}

function formatTime(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' })
  }
  if (now.getTime() - date.getTime() < 7 * 86400000) {
    return date.toLocaleDateString('ru', { weekday: 'short' })
  }
  return date.toLocaleDateString('ru', { day: '2-digit', month: '2-digit' })
}

function getAttachmentPreview(type: string, fileName?: string): string {
  switch (type) {
    case 'photo':    return '📷 Фотография'
    case 'video':    return '🎥 Видео'
    case 'voice':    return '🎤 Голосовое сообщение'
    case 'audio':    return '🎵 Аудио'
    case 'sticker':  return '🃏 Стикер'
    case 'gif':      return '🎞 GIF'
    case 'document': return `📎 ${fileName ?? 'Файл'}`
    default:         return `📎 ${fileName ?? 'Файл'}`
  }
}

export function ChatItem({ chat, active, onClick }: Props) {
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(null)

  const title = chat.type === 'saved' ? 'Избранное' : (chat.title ?? 'Unknown')
  const lastMsg = chat.last_message
  const unreadMentions = useChatStore((s) => s.unreadMentions[chat.id] ?? 0)
  const mutedChats = useChatStore((s) => s.mutedChats)

  const isMuted = (() => {
    const until = mutedChats[chat.id]
    return !!until && new Date(until) > new Date()
  })()

  const isGroup = chat.type === 'group' || chat.type === 'channel'

  // Build preview and sender info
  let preview = ''
  let senderId = ''
  let senderName = ''

  if (lastMsg) {
    if (lastMsg.type === 'service') {
      preview = lastMsg.text ?? ''
    } else {
      if (lastMsg.attachments?.length) {
        const att = lastMsg.attachments[0]
        preview = getAttachmentPreview(att.type, att.file_name)
        // If there's also text, prefer text
        if (lastMsg.text) preview = lastMsg.text
      } else {
        preview = lastMsg.text ?? ''
      }

      if (isGroup && lastMsg.sender) {
        senderName = lastMsg.sender.first_name
        senderId = lastMsg.sender.id
      }
    }
  }

  const hasUnread = chat.unread_count > 0
  const senderColor = senderId ? getSenderColor(senderId) : undefined

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    setCtxMenu({ x: e.clientX, y: e.clientY })
  }

  return (
    <>
      <button
        onClick={onClick}
        onContextMenu={handleContextMenu}
        className={clsx(
          'relative w-full flex items-center gap-3 px-3 py-2.5',
          'transition-colors duration-100 text-left',
          'hover:bg-black/5 dark:hover:bg-white/5',
          active && 'bg-primary-500/10 dark:bg-primary-400/10'
        )}
      >
        {/* Active bar */}
        {active && (
          <div className="absolute left-0 top-2.5 bottom-2.5 w-[3px]
            bg-primary-500 rounded-r-full" />
        )}

        {/* Avatar */}
        <div className="flex-shrink-0">
          {chat.type === 'saved' ? (
            <SavedAvatar />
          ) : (
            <Avatar name={title} url={chat.avatar_url} size={50} />
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">

          {/* Row 1: title + time */}
          <div className="flex items-center justify-between gap-1 mb-[2px]">
            <div className="flex items-center gap-1 min-w-0 flex-1">
              {chat.type === 'channel' && (
                <svg className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14v-4H7l5-8v4h4l-5 8z" />
                </svg>
              )}
              {chat.type === 'group' && (
                <svg className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              )}
              <span className={clsx(
                'font-semibold text-sm truncate leading-tight',
                active
                  ? 'text-primary-600 dark:text-primary-400'
                  : 'text-gray-900 dark:text-gray-100'
              )}>
                {title}
              </span>
            </div>

            {/* Time + mute */}
            <div className="flex items-center gap-1 flex-shrink-0">
              {isMuted && (
                <svg className="w-3 h-3 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15zM17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                </svg>
              )}
              {lastMsg && (
                <span className="text-[11px] text-gray-400 dark:text-gray-500">
                  {formatTime(lastMsg.created_at)}
                </span>
              )}
            </div>
          </div>

          {/* Row 2: preview + badges */}
          <div className="flex items-center justify-between gap-1">
            <div className="flex-1 min-w-0">
              {senderName ? (
                <p className="text-xs truncate leading-tight">
                  <span style={{ color: senderColor }} className="font-medium">
                    {senderName}:&nbsp;
                  </span>
                  <span className="text-gray-500 dark:text-gray-400">{preview}</span>
                </p>
              ) : (
                <p className={clsx(
                  'text-xs truncate leading-tight',
                  lastMsg?.type === 'service'
                    ? 'italic text-gray-400 dark:text-gray-500'
                    : 'text-gray-500 dark:text-gray-400'
                )}>
                  {preview || '\u00a0'}
                </p>
              )}
            </div>

            <div className="flex items-center gap-1 flex-shrink-0">
              {unreadMentions > 0 && (
                <span className="bg-red-500 text-white text-[10px] font-bold
                  rounded-full w-4 h-4 flex items-center justify-center">
                  @
                </span>
              )}
              {hasUnread && (
                <span className={clsx(
                  'text-[11px] font-semibold rounded-full min-w-[20px] h-5',
                  'flex items-center justify-center px-1.5',
                  isMuted
                    ? 'bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                    : 'bg-primary-500 text-white'
                )}>
                  {chat.unread_count > 99 ? '99+' : chat.unread_count}
                </span>
              )}
            </div>
          </div>
        </div>
      </button>

      {ctxMenu && (
        <ChatContextMenu
          chat={chat}
          x={ctxMenu.x}
          y={ctxMenu.y}
          onClose={() => setCtxMenu(null)}
        />
      )}
    </>
  )
}

function SavedAvatar() {
  return (
    <div className="w-[50px] h-[50px] rounded-full flex-shrink-0
      bg-gradient-to-br from-primary-400 to-primary-600
      flex items-center justify-center">
      <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
        <path d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
      </svg>
    </div>
  )
}
