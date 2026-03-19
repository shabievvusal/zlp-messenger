import { useState, useRef, useEffect } from 'react'
import { format } from 'date-fns'
import { clsx } from 'clsx'
import type { Message, Reaction, ChatType } from '@/types'
import { chatApi } from '@/api/chat'
import { useChatStore } from '@/store/chat'
import { useAuthStore } from '@/store/auth'
import { useChatCtx } from '@/contexts/ChatContext'
import { VoiceMessage } from './VoiceMessage'
import { Avatar } from '@/components/ui/Avatar'
import { mediaUrl } from '@/utils/media'

interface Props {
  msg: Message
  isOwn: boolean
  isGrouped: boolean  // same sender as previous — no avatar/name needed
  chatType: ChatType
}

const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🔥', '👏', '🎉']

function parseMentions(text: string): React.ReactNode {
  const parts = text.split(/(@\w+)/g)
  return parts.map((part, i) =>
    part.startsWith('@')
      ? <span key={i} className="text-primary-500 font-medium">{part}</span>
      : part
  )
}

export function MessageBubble({ msg, isOwn, isGrouped, chatType }: Props) {
  // Service messages — centered pill, no bubble
  if (msg.type === 'service') {
    return (
      <div className="flex justify-center my-2 animate-fadeIn">
        <span className="text-xs text-gray-500 dark:text-gray-400
          bg-black/8 dark:bg-white/10 backdrop-blur-sm
          rounded-full px-3 py-1 select-none">
          {msg.text}
        </span>
      </div>
    )
  }

  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const removeMessage = useChatStore((s) => s.removeMessage)
  const updateMessage = useChatStore((s) => s.updateMessage)
  const chatMessages = useChatStore((s) => s.messages[msg.chat_id] ?? [])
  const currentUser = useAuthStore((s) => s.user)
  const {
    setReplyTo, setEditMsg, openMedia, openGallery, setForwardMsg,
    selectedMsgIds, isSelecting, enterSelectMode, toggleSelect,
  } = useChatCtx()

  const isSelected = selectedMsgIds.includes(msg.id)

  // Close context menu on outside click
  useEffect(() => {
    if (!menu) return
    const handler = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenu(null)
    }
    setTimeout(() => document.addEventListener('mousedown', handler), 0)
    return () => document.removeEventListener('mousedown', handler)
  }, [menu])

  const openMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    setMenu({ x: e.clientX, y: e.clientY })
  }

  const handleBubbleClick = () => {
    if (isSelecting) toggleSelect(msg.id)
  }

  const handleDelete = async () => {
    setMenu(null)
    try {
      await chatApi.deleteMessage(msg.id)
      removeMessage(msg.chat_id, msg.id)
    } catch { /* ignore */ }
  }

  const handleReact = async (emoji: string) => {
    setMenu(null)
    try {
      await chatApi.addReaction(msg.id, emoji)
      const existing = msg.reactions ?? []
      const hasOwn = existing.some((r) => r.user_id === currentUser?.id && r.emoji === emoji)
      const reactions: Reaction[] = hasOwn
        ? existing.filter((r) => !(r.user_id === currentUser?.id))
        : [...existing.filter((r) => r.user_id !== currentUser?.id), {
            message_id: msg.id, user_id: currentUser!.id, emoji, created_at: new Date().toISOString()
          }]
      updateMessage({ ...msg, reactions })
    } catch { /* ignore */ }
  }

  const handleCopyText = () => {
    if (msg.text) navigator.clipboard.writeText(msg.text)
    setMenu(null)
  }

  const handleSelect = () => {
    setMenu(null)
    enterSelectMode(msg.id)
  }

  const handleForward = () => {
    setMenu(null)
    setForwardMsg(msg)
  }

  // Group reactions by emoji
  const reactionGroups = (msg.reactions ?? []).reduce<Record<string, { count: number; mine: boolean }>>((acc, r) => {
    if (!acc[r.emoji]) acc[r.emoji] = { count: 0, mine: false }
    acc[r.emoji].count++
    if (r.user_id === currentUser?.id) acc[r.emoji].mine = true
    return acc
  }, {})

  const photoAttachments = msg.attachments?.filter((a) => a.type === 'photo' || a.type === 'gif') ?? []
  const hasMedia = photoAttachments.length > 0

  return (
    <div
      className={clsx(
        'flex items-end gap-1.5 group animate-msgIn',
        isOwn ? 'flex-row-reverse' : 'flex-row',
        isSelecting && 'cursor-pointer',
        isSelected && (isOwn ? 'bg-primary-500/10' : 'bg-primary-500/10'),
        'transition-colors rounded-lg px-1'
      )}
      onClick={handleBubbleClick}
    >
      {/* Selection checkbox */}
      {isSelecting && (
        <div className={clsx(
          'flex-shrink-0 self-center',
          isOwn ? 'order-last ml-1' : 'order-first mr-1'
        )}>
          <div className={clsx(
            'w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all',
            isSelected
              ? 'bg-primary-500 border-primary-500'
              : 'border-gray-400 dark:border-gray-500 bg-white dark:bg-gray-800'
          )}>
            {isSelected && (
              <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            )}
          </div>
        </div>
      )}

      {/* Sender avatar for incoming messages */}
      {!isSelecting && !isOwn && (
        <div className="w-7 flex-shrink-0 self-end">
          {!isGrouped && msg.sender && (
            <Avatar
              name={`${msg.sender.first_name}${msg.sender.last_name ? ' ' + msg.sender.last_name : ''}`}
              url={msg.sender.avatar_url ? mediaUrl(msg.sender.avatar_url) : null}
              size={28}
            />
          )}
        </div>
      )}

      {/* Bubble */}
      <div
        className="max-w-[70%] min-w-0"
        onContextMenu={isSelecting ? undefined : openMenu}
      >
        {/* Reply preview */}
        {msg.reply_to && (
          <div className={clsx(
            'mb-1 px-2 py-1 rounded-lg text-xs border-l-2 cursor-pointer',
            isOwn
              ? 'border-green-500 bg-green-100/60 dark:bg-green-900/30'
              : 'border-blue-400 bg-blue-100/60 dark:bg-blue-900/30'
          )}>
            <p className="font-semibold text-primary-600 dark:text-primary-400 truncate">
              {msg.reply_to.sender?.first_name ?? 'Сообщение'}
            </p>
            <p className="text-gray-600 dark:text-gray-400 truncate">
              {msg.reply_to.text ?? '📎 Вложение'}
            </p>
          </div>
        )}

        {/* Forward indicator */}
        {msg.forward_from_id && (
          <div className="mb-1 px-2 py-0.5 text-xs text-gray-400 italic flex items-center gap-1">
            <span>⤵</span> Переслано
          </div>
        )}

        <div className={clsx(isOwn ? 'bubble-out' : 'bubble-in', hasMedia && 'px-2 py-1.5')}>

          {/* Sender name (groups/channels only, for incoming non-grouped) */}
          {!isOwn && !isGrouped && msg.sender && (chatType === 'group' || chatType === 'channel') && (
            <p className="text-xs font-semibold text-primary-500 mb-1">
              {msg.sender.first_name}{msg.sender.last_name ? ' ' + msg.sender.last_name : ''}
            </p>
          )}

          {/* Text */}
          {msg.text && (
            <p className={clsx(
              'text-gray-900 dark:text-gray-100 whitespace-pre-wrap break-words',
              hasMedia ? 'text-xs leading-snug' : 'text-sm leading-relaxed'
            )}>
              {parseMentions(msg.text)}
            </p>
          )}

          {/* Attachments */}
          {(msg.attachments ?? []).length > 0 && (() => {
            const photos = photoAttachments
            const videos = msg.attachments?.filter(a => a.type === 'video') ?? []
            const otherMedia = msg.attachments?.filter(a => a.type === 'voice' || a.type === 'audio' || a.type === 'document') ?? []

            const handlePhotoClick = (attachmentId: string) => {
              const galleryItems = chatMessages.flatMap((message) =>
                (message.attachments ?? [])
                  .filter((a) => a.type === 'photo' || a.type === 'gif')
                  .map((a) => ({
                    id: a.id,
                    url: mediaUrl(a.url),
                    type: a.type as 'photo' | 'gif',
                    thumbnail: a.thumbnail ? mediaUrl(a.thumbnail) : undefined,
                  }))
              )
              const startIndex = galleryItems.findIndex((item) => item.id === attachmentId)
              if (startIndex >= 0) {
                openGallery(galleryItems, startIndex)
              } else {
                const fallback = photos.find((p) => p.id === attachmentId) ?? photos[0]
                if (fallback) {
                  openMedia(mediaUrl(fallback.url), fallback.type as 'photo' | 'gif')
                }
              }
            }

            return (
              <>
                {/* Photo gallery */}
                {photos.length > 0 && (
                  <div className="mt-2 grid gap-1" style={{
                    gridTemplateColumns: photos.length === 1 ? '1fr' : photos.length === 2 ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)',
                    maxWidth: photos.length === 1 ? '260px' : '300px',
                  }}>
                    {photos.map((a, idx) => (
                      <button
                        key={a.id}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          handlePhotoClick(a.id)
                        }}
                        className="relative rounded-lg overflow-hidden group cursor-zoom-in"
                        style={{ aspectRatio: photos.length === 1 ? '4 / 5' : '1 / 1' }}
                      >
                        <img
                          src={mediaUrl(a.thumbnail || a.url)}
                          alt=""
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        />
                        {photos.length > 1 && idx === photos.length - 1 && photos.length > 4 && (
                          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                            <span className="text-white text-xl font-semibold">+{photos.length - 4}</span>
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                )}

                {/* Videos */}
                {videos.map((a) => (
                  <video
                    key={a.id}
                    src={mediaUrl(a.url)}
                    className="max-w-full rounded-xl max-h-80 cursor-pointer mt-2"
                    onClick={(e) => {
                      e.stopPropagation()
                      openMedia(mediaUrl(a.url), 'video')
                    }}
                  />
                ))}

                {/* Voice & Audio */}
                {otherMedia
                  .filter(a => a.type === 'voice' || a.type === 'audio')
                  .map((a) => (
                    <div key={a.id} className="mt-2">
                      {a.type === 'voice' ? (
                        <VoiceMessage attachment={a} isOwn={isOwn} />
                      ) : (
                        <audio src={mediaUrl(a.url)} controls className="w-full" />
                      )}
                    </div>
                  ))}

                {/* Documents */}
                {otherMedia
                  .filter(a => a.type === 'document')
                  .map((a) => (
                    <a
                      key={a.id}
                      href={mediaUrl(a.url)}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-2 p-2 rounded-lg bg-black/5 dark:bg-white/5
                        hover:bg-black/10 transition text-sm mt-2"
                    >
                      <span className="text-2xl">📄</span>
                      <div className="min-w-0">
                        <p className="font-medium truncate text-gray-900 dark:text-gray-100">
                          {a.file_name ?? 'Файл'}
                        </p>
                        {a.file_size && (
                          <p className="text-xs text-gray-500">{formatSize(a.file_size)}</p>
                        )}
                      </div>
                    </a>
                  ))}
              </>
            )
          })()}

          {/* Meta row */}
          <div className="flex items-center gap-1 mt-1 select-none justify-end">
            {msg.is_edited && (
              <span className="text-[10px] text-gray-400 italic">изменено</span>
            )}
            <span className="text-[10px] text-gray-400">
              {format(new Date(msg.created_at), 'HH:mm')}
            </span>
            {isOwn && (
              <span className="text-[10px] text-primary-400">✓✓</span>
            )}
          </div>
        </div>

        {/* Reactions */}
        {Object.keys(reactionGroups).length > 0 && (
          <div className={clsx('flex flex-wrap gap-1 mt-1', isOwn ? 'justify-end' : 'justify-start')}>
            {Object.entries(reactionGroups).map(([emoji, { count, mine }]) => (
              <button
                key={emoji}
                onClick={(e) => { e.stopPropagation(); handleReact(emoji) }}
                className={clsx(
                  'text-xs rounded-full px-2 py-0.5 transition',
                  mine
                    ? 'bg-primary-100 dark:bg-primary-900/50 text-primary-700 dark:text-primary-300'
                    : 'bg-black/10 dark:bg-white/10'
                )}
              >
                {emoji} {count}
              </button>
            ))}
          </div>
        )}

        {/* Quick action buttons (visible on hover, hidden in select mode) */}
        {!isSelecting && (
          <div className={clsx(
            'flex items-center gap-1 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity',
            isOwn ? 'justify-end' : 'justify-start'
          )}>
            <QuickBtn title="Ответить" onClick={() => setReplyTo(msg)}>↩</QuickBtn>
            <QuickBtn title="Реакция" onClick={(e) => { e.stopPropagation(); openMenu(e) }}>😊</QuickBtn>
            {isOwn && <QuickBtn title="Редактировать" onClick={() => setEditMsg(msg)}>✏️</QuickBtn>}
            <QuickBtn title="Ещё" onClick={(e) => { e.stopPropagation(); openMenu(e) }}>⋯</QuickBtn>
          </div>
        )}
      </div>

      {/* Context menu */}
      {menu && (
        <div
          ref={menuRef}
          className="ctx-menu"
          style={{ top: Math.min(menu.y, window.innerHeight - 340), left: Math.min(menu.x, window.innerWidth - 220) }}
        >
          {/* Emoji row */}
          <div className="flex gap-1 px-3 py-2 border-b border-gray-100 dark:border-gray-700">
            {QUICK_REACTIONS.map((e) => (
              <button key={e} onClick={() => handleReact(e)}
                className="text-xl hover:scale-125 transition-transform leading-none">
                {e}
              </button>
            ))}
          </div>

          <MenuItem icon="↩" label="Ответить" onClick={() => { setReplyTo(msg); setMenu(null) }} />
          <MenuItem icon="⤵" label="Переслать" onClick={handleForward} />
          <MenuItem icon="☑️" label="Выбрать" onClick={handleSelect} />
          {msg.text && <MenuItem icon="📋" label="Копировать текст" onClick={handleCopyText} />}
          {isOwn && <MenuItem icon="✏️" label="Редактировать" onClick={() => { setEditMsg(msg); setMenu(null) }} />}
          <div className="my-1 border-t border-gray-100 dark:border-gray-700" />
          {isOwn && <MenuItem icon="🗑" label="Удалить" onClick={handleDelete} danger />}
        </div>
      )}
    </div>
  )
}

function QuickBtn({ title, onClick, children }: {
  title: string; onClick: (e: React.MouseEvent) => void; children: React.ReactNode
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      className="w-6 h-6 text-xs rounded-full bg-white dark:bg-gray-700 shadow
        flex items-center justify-center hover:scale-110 transition-transform"
    >
      {children}
    </button>
  )
}

function MenuItem({ icon, label, onClick, danger }: {
  icon: string; label: string; onClick: () => void; danger?: boolean
}) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        'w-full flex items-center gap-3 px-4 py-2.5 text-sm transition',
        danger
          ? 'text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20'
          : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
      )}
    >
      <span className="text-base leading-none">{icon}</span>
      {label}
    </button>
  )
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} Б`
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} КБ`
  return `${(bytes / 1024 ** 2).toFixed(1)} МБ`
}
