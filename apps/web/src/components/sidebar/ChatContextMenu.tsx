import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createPortal } from 'react-dom'
import type { Chat } from '@/types'
import { useChatStore } from '@/store/chat'
import { useFolderStore } from '@/store/folders'
import { chatApi } from '@/api/chat'
import toast from 'react-hot-toast'

interface Props {
  chat: Chat
  x: number
  y: number
  onClose: () => void
}

export function ChatContextMenu({ chat, x, y, onClose }: Props) {
  const navigate = useNavigate()
  const menuRef = useRef<HTMLDivElement>(null)
  const [adjustedPos, setAdjustedPos] = useState({ x, y })
  const [showFolders, setShowFolders] = useState(false)

  const clearUnread = useChatStore((s) => s.clearUnread)
  const removeChat = useChatStore((s) => s.removeChat)
  const mutedChats = useChatStore((s) => s.mutedChats)
  const setChatMuted = useChatStore((s) => s.setChatMuted)
  const { folders, archivedChatIds, archiveChat, unarchiveChat, updateFolder } = useFolderStore()

  const isArchived = archivedChatIds.includes(chat.id)
  const isGroup = chat.type === 'group' || chat.type === 'channel'
  const isMuted = (() => {
    const until = mutedChats[chat.id]
    return !!until && new Date(until) > new Date()
  })()

  // Adjust so menu doesn't go off-screen
  useEffect(() => {
    if (!menuRef.current) return
    const { offsetWidth: w, offsetHeight: h } = menuRef.current
    setAdjustedPos({
      x: Math.min(x, window.innerWidth - w - 8),
      y: Math.min(y, window.innerHeight - h - 8),
    })
  }, [x, y])

  // Close on outside click or Escape
  useEffect(() => {
    const onMouse = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose()
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('mousedown', onMouse)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onMouse)
      document.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  const handleOpenNewTab = () => {
    window.open(`/chat/${chat.id}`, '_blank')
    onClose()
  }

  const handleMarkRead = () => {
    clearUnread(chat.id)
    onClose()
  }

  const handleToggleMute = () => {
    if (isMuted) {
      chatApi.muteChat(chat.id, null).catch(() => {})
      setChatMuted(chat.id, null)
      toast('Уведомления включены')
    } else {
      const until = '2099-01-01T00:00:00Z'
      chatApi.muteChat(chat.id, until).catch(() => {})
      setChatMuted(chat.id, until)
      toast('Уведомления отключены')
    }
    onClose()
  }

  const handleArchive = () => {
    isArchived ? unarchiveChat(chat.id) : archiveChat(chat.id)
    onClose()
  }

  const handleAddToFolder = (folderId: string) => {
    const folder = folders.find((f) => f.id === folderId)
    if (!folder) return
    if (!folder.chatIds.includes(chat.id)) {
      updateFolder(folderId, { chatIds: [...folder.chatIds, chat.id] })
    }
    toast.success(`Добавлено в «${folder.name}»`)
    onClose()
  }

  const handleLeave = async () => {
    onClose()
    if (!confirm(`Покинуть «${chat.title ?? 'чат'}»?`)) return
    try {
      await chatApi.leaveChat(chat.id)
      removeChat(chat.id)
      navigate('/')
    } catch { toast.error('Не удалось покинуть') }
  }

  const menu = (
    <div
      ref={menuRef}
      style={{ position: 'fixed', left: adjustedPos.x, top: adjustedPos.y, zIndex: 9999 }}
      className="w-56 bg-white dark:bg-[#212121] rounded-2xl shadow-2xl
        py-1.5 border border-black/5 dark:border-white/8 animate-scaleIn origin-top-left"
      onContextMenu={(e) => e.preventDefault()}
    >
      <Item
        icon={<IcNewTab />}
        label="Открыть в новой вкладке"
        onClick={handleOpenNewTab}
      />

      {/* Add to folder */}
      <Item
        icon={<IcFolder />}
        label="Добавить в папку"
        onClick={() => setShowFolders((v) => !v)}
        hasArrow
      />
      {showFolders && (
        <div className="border-t border-black/5 dark:border-white/8 py-1">
          {folders.length === 0 ? (
            <p className="text-xs text-gray-400 px-5 py-1.5">Нет папок</p>
          ) : (
            folders.map((f) => (
              <Item
                key={f.id}
                icon={<span className="text-base">{f.emoji}</span>}
                label={f.name}
                onClick={() => handleAddToFolder(f.id)}
                indent
              />
            ))
          )}
        </div>
      )}

      <Item icon={<IcRead />} label="Пометить прочитанным" onClick={handleMarkRead} />
      <Item icon={<IcPin />} label="Закрепить" onClick={() => { toast('Скоро...'); onClose() }} />

      <Item
        icon={<IcBell muted={isMuted} />}
        label={isMuted ? 'Вкл. уведомления' : 'Выкл. уведомления'}
        onClick={handleToggleMute}
      />

      <div className="my-1 border-t border-black/5 dark:border-white/8" />

      <Item
        icon={<IcArchive />}
        label={isArchived ? 'Из архива' : 'В архив'}
        onClick={handleArchive}
      />
      <Item
        icon={<IcReport />}
        label="Пожаловаться"
        onClick={() => { toast('Жалоба отправлена'); onClose() }}
      />

      {isGroup && (
        <>
          <div className="my-1 border-t border-black/5 dark:border-white/8" />
          <Item icon={<IcLeave />} label="Покинуть группу" onClick={handleLeave} danger />
        </>
      )}
    </div>
  )

  return createPortal(menu, document.body)
}

// ── Menu item ───────────────────────────────────────────────
function Item({
  icon, label, onClick, danger, hasArrow, indent,
}: {
  icon: React.ReactNode
  label: string
  onClick: () => void
  danger?: boolean
  hasArrow?: boolean
  indent?: boolean
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors text-left
        ${indent ? 'pl-7' : ''}
        ${danger
          ? 'text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20'
          : 'text-gray-800 dark:text-gray-100 hover:bg-black/5 dark:hover:bg-white/5'
        }`}
    >
      <span className={`flex-shrink-0 ${danger ? 'text-red-500' : 'text-gray-500 dark:text-gray-400'}`}>
        {icon}
      </span>
      <span className="flex-1 font-medium">{label}</span>
      {hasArrow && (
        <svg className="w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      )}
    </button>
  )
}

// ── Icons ───────────────────────────────────────────────────
function IcNewTab() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
    </svg>
  )
}
function IcFolder() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
    </svg>
  )
}
function IcRead() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  )
}
function IcPin() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
    </svg>
  )
}
function IcBell({ muted }: { muted: boolean }) {
  return muted ? (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
    </svg>
  ) : (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15zM17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
    </svg>
  )
}
function IcArchive() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
    </svg>
  )
}
function IcReport() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6H8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
    </svg>
  )
}
function IcLeave() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
    </svg>
  )
}
