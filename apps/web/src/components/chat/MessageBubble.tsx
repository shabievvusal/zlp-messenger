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
import { UserProfilePanel } from './UserProfilePanel'
import { mediaUrl } from '@/utils/media'

interface Props {
  msg: Message
  isOwn: boolean
  isGrouped: boolean      // same sender as previous — no name header
  isLastInGroup: boolean  // next message is from different sender — show avatar
  chatType: ChatType
}

const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🔥', '👏', '🎉']

// Telegram-style bubble shape based on position in a sequence
// Avatar is always on the LEFT side, so left corners change shape
function bubbleShape(isGrouped: boolean, isLastInGroup: boolean): string {
  if (!isGrouped && isLastInGroup)  return 'rounded-[18px] rounded-bl-[4px]'   // single
  if (!isGrouped && !isLastInGroup) return 'rounded-[18px] rounded-bl-[6px]'   // first of series
  if (isGrouped  && !isLastInGroup) return 'rounded-r-[18px] rounded-l-[6px]'  // middle
  return 'rounded-r-[18px] rounded-tl-[6px] rounded-bl-[4px]'                  // last of series
}

function parseMentions(text: string): React.ReactNode {
  const parts = text.split(/(@\w+)/g)
  return parts.map((part, i) =>
    part.startsWith('@')
      ? <span key={i} className="text-primary-500 font-medium">{part}</span>
      : part
  )
}

export function MessageBubble({ msg, isOwn, isGrouped, isLastInGroup, chatType }: Props) {
  const [viewProfileId, setViewProfileId] = useState<string | null>(null)
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

  // Debug: log sender info for incoming messages
  if (!isOwn) {
    console.log('[MessageBubble] incoming msg:', msg.id, 'sender_id:', msg.sender_id, 'sender:', msg.sender)
  }

  return (
    <div
      className={clsx(
        'flex flex-row items-end gap-1 group animate-msgIn',
        isSelecting && 'cursor-pointer',
        isSelected && 'bg-primary-500/10',
        'transition-colors rounded-lg px-1'
      )}
      onClick={handleBubbleClick}
    >
      {/* Selection checkbox — to the left of avatar for all */}
      {isSelecting && (
        <div className="flex-shrink-0 self-center order-first mr-1">
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

      {/* Avatar slot — always 28px wide so bubbles align; avatar shown on last msg in a sequence */}
      {!isSelecting && (
        <div className="w-7 flex-shrink-0 self-end">
          {isLastInGroup && msg.sender_id && (
            <button
              onClick={(e) => { e.stopPropagation(); setViewProfileId(msg.sender_id!) }}
              className="rounded-full hover:opacity-80 active:scale-90 transition-all"
            >
              <Avatar
                name={msg.sender
                  ? `${msg.sender.first_name}${msg.sender.last_name ? ' ' + msg.sender.last_name : ''}`
                  : '?'}
                url={msg.sender?.avatar_url ? mediaUrl(msg.sender.avatar_url) : null}
                size={28}
              />
            </button>
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
          <div className="mb-1 px-2 py-1 rounded-lg border-l-2 border-primary-400
            bg-primary-50/40 dark:bg-primary-900/20 flex items-center gap-1.5">
            <svg className="w-3 h-3 text-primary-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M13 9l3 3m0 0l-3 3m3-3H8m13 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-[11px] text-gray-500 dark:text-gray-400">Переслано от </span>
            {msg.forward_sender ? (
              <button
                onClick={(e) => { e.stopPropagation(); setViewProfileId(msg.forward_sender!.id.toString()) }}
                className="text-[11px] text-primary-500 font-medium hover:underline">
                {msg.forward_sender.first_name}{msg.forward_sender.last_name ? ' ' + msg.forward_sender.last_name : ''}
              </button>
            ) : (
              <span className="text-[11px] text-gray-400">неизвестного</span>
            )}
          </div>
        )}

        <div className={clsx(isOwn ? 'bubble-out' : 'bubble-in', bubbleShape(isGrouped, isLastInGroup), hasMedia && 'px-2 py-1.5')}>

          {/* Sender name (groups/channels only, for incoming non-grouped) */}
          {!isOwn && !isGrouped && (chatType === 'group' || chatType === 'channel') && msg.sender && (
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
              msg.is_read
                ? <span className="text-[10px] text-primary-400 leading-none">✓✓</span>
                : <span className="text-[10px] text-gray-400 leading-none">✓</span>
            )}
          </div>
        </div>

        {/* Reactions */}
        {Object.keys(reactionGroups).length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1 justify-start">
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
          <div className="flex items-center gap-1 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity justify-start">
            <QuickBtn title="Ответить" onClick={() => setReplyTo(msg)}>↩</QuickBtn>
            <QuickBtn title="Реакция" onClick={(e) => { e.stopPropagation(); openMenu(e) }}>😊</QuickBtn>
            {isOwn && <QuickBtn title="Редактировать" onClick={() => setEditMsg(msg)}>✏️</QuickBtn>}
            <QuickBtn title="Ещё" onClick={(e) => { e.stopPropagation(); openMenu(e) }}>⋯</QuickBtn>
          </div>
        )}
      </div>

      {/* User profile modal */}
      {viewProfileId && (
        <UserProfilePanel
          userId={viewProfileId}
          onClose={() => setViewProfileId(null)}
        />
      )}

      {/* Context menu — Telegram style */}
      {menu && (
        <div
          ref={menuRef}
          className="fixed z-[9999] w-52 rounded-2xl overflow-hidden
            bg-white dark:bg-[#2c2c2e] shadow-2xl
            border border-black/8 dark:border-white/8
            animate-scaleIn origin-top-left"
          style={{ top: Math.min(menu.y, window.innerHeight - 380), left: Math.min(menu.x, window.innerWidth - 220) }}
        >
          {/* Emoji reactions row */}
          <div className="flex items-center gap-0.5 px-2 py-2 border-b border-black/8 dark:border-white/8">
            {QUICK_REACTIONS.map((e) => (
              <button key={e} onClick={() => handleReact(e)}
                className="flex-1 text-lg hover:scale-125 transition-transform leading-none py-1 rounded-lg
                  hover:bg-black/5 dark:hover:bg-white/5">
                {e}
              </button>
            ))}
          </div>

          <CtxItem icon={<IcReply />}   label="Ответить"       onClick={() => { setReplyTo(msg); setMenu(null) }} />
          {isOwn && <CtxItem icon={<IcEdit />} label="Изменить" onClick={() => { setEditMsg(msg); setMenu(null) }} />}
          <CtxItem icon={<IcPin />}     label="Закрепить"      onClick={() => setMenu(null)} />
          {msg.text && <CtxItem icon={<IcCopy />} label="Копировать текст" onClick={handleCopyText} />}
          <CtxItem icon={<IcForward />} label="Переслать"      onClick={handleForward} />
          <CtxItem icon={<IcSelect />}  label="Выделить"       onClick={handleSelect} />
          {isOwn && (
            <>
              <div className="mx-3 my-1 border-t border-black/8 dark:border-white/8" />
              <CtxItem icon={<IcDelete />} label="Удалить" onClick={handleDelete} danger />
            </>
          )}

          {/* Timestamp footer */}
          <div className="flex items-center gap-1 px-4 py-2 border-t border-black/8 dark:border-white/8">
            {isOwn && (
              msg.is_read
                ? <span className="text-[11px] text-primary-400">✓✓</span>
                : <span className="text-[11px] text-gray-400">✓</span>
            )}
            <span className="text-[11px] text-gray-400">
              {format(new Date(msg.created_at), 'HH:mm')}
            </span>
          </div>
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

function CtxItem({ icon, label, onClick, danger }: {
  icon: React.ReactNode; label: string; onClick: () => void; danger?: boolean
}) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        'w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors',
        danger
          ? 'text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20'
          : 'text-gray-800 dark:text-gray-100 hover:bg-black/5 dark:hover:bg-white/5'
      )}
    >
      <span className={clsx('flex-shrink-0', danger ? 'text-red-500' : 'text-gray-500 dark:text-gray-400')}>
        {icon}
      </span>
      {label}
    </button>
  )
}

function IcReply() {
  return <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
  </svg>
}
function IcEdit() {
  return <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
  </svg>
}
function IcPin() {
  return <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
  </svg>
}
function IcCopy() {
  return <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
  </svg>
}
function IcForward() {
  return <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 9l3 3m0 0l-3 3m3-3H8m13 0a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
}
function IcSelect() {
  return <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
}
function IcDelete() {
  return <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} Б`
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} КБ`
  return `${(bytes / 1024 ** 2).toFixed(1)} МБ`
}
