import { useEffect, useRef, useCallback, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useChatStore } from '@/store/chat'
import { useAuthStore } from '@/store/auth'
import { chatApi } from '@/api/chat'
import { ChatHeader } from './ChatHeader'
import { MessageList } from './MessageList'
import { MessageInput } from './MessageInput'
import { MediaViewer } from './MediaViewer'
import { UserProfilePanel } from './UserProfilePanel'
import { ForwardModal } from './ForwardModal'
import { ChatProvider, useChatCtx } from '@/contexts/ChatContext'
import type { Message } from '@/types'

const PAGE_SIZE = 50

interface Props {
  onStartCall?: (targetId: string, targetName: string, type: 'voice' | 'video') => void
}

export function ChatWindow({ onStartCall }: Props) {
  return (
    <ChatProvider>
      <ChatWindowInner onStartCall={onStartCall} />
      <MediaViewer />
    </ChatProvider>
  )
}

function ChatWindowInner({ onStartCall }: Props) {
  const { chatId } = useParams<{ chatId: string }>()
  const { setMessages, prependMessages, clearUnread, chats } = useChatStore()
  const currentUser = useAuthStore((s) => s.user)
  const chat = chats.find((c) => c.id === chatId)
  const prevChatId = useRef<string>()
  const [offset, setOffset] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const loadingMore = useRef(false)
  const [showProfile, setShowProfile] = useState(false)

  const {
    selectedMsgIds, isSelecting, clearSelection,
    forwardMsg, setForwardMsg,
  } = useChatCtx()

  const messages = useChatStore((s) => s.messages[chatId ?? ''] ?? [])
  const selectedMessages = messages.filter((m) => selectedMsgIds.includes(m.id))

  const loadMessages = useCallback(async (id: string, off = 0) => {
    try {
      const { data } = await chatApi.getMessages(id, PAGE_SIZE, off)
      const sorted = [...data].reverse()
      if (off === 0) {
        setMessages(id, sorted)
      } else {
        prependMessages(id, sorted)
      }
      if (data.length < PAGE_SIZE) setHasMore(false)
      clearUnread(id)
    } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    if (!chatId || chatId === prevChatId.current) return
    prevChatId.current = chatId
    setOffset(0)
    setHasMore(true)
    clearSelection()
    loadMessages(chatId, 0)
  }, [chatId])

  const handleLoadMore = useCallback(async () => {
    if (!chatId || !hasMore || loadingMore.current) return
    loadingMore.current = true
    const newOffset = offset + PAGE_SIZE
    setOffset(newOffset)
    await loadMessages(chatId, newOffset)
    loadingMore.current = false
  }, [chatId, offset, hasMore])

  const handleStartCall = useCallback(async (type: 'voice' | 'video') => {
    if (!chat || !onStartCall) return
    if (chat.peer_user_id) {
      onStartCall(chat.peer_user_id, chat.title ?? 'Пользователь', type)
      return
    }
    try {
      const { data: members } = await chatApi.getMembers(chat.id)
      const peer = members.find((m) => m.user_id !== currentUser?.id)
      if (!peer) return
      const name = peer.user
        ? `${peer.user.first_name}${peer.user.last_name ? ' ' + peer.user.last_name : ''}`
        : chat.title ?? 'Пользователь'
      onStartCall(peer.user_id, name, type)
    } catch { /* ignore */ }
  }, [chat, currentUser, onStartCall])

  const handleDeleteSelected = useCallback(async () => {
    for (const id of selectedMsgIds) {
      try {
        await chatApi.deleteMessage(id)
        useChatStore.getState().removeMessage(chatId!, id)
      } catch { /* ignore */ }
    }
    clearSelection()
  }, [selectedMsgIds, chatId, clearSelection])

  if (!chatId || !chat) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-400">
        Чат не найден
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-chat dark:bg-chat-dark relative">
      <ChatHeader
        chat={chat}
        onStartCall={handleStartCall}
        onOpenProfile={chat.type === 'private' && chat.peer_user_id ? () => setShowProfile(true) : undefined}
      />
      <MessageList chatId={chatId} onLoadMore={handleLoadMore} />

      {/* Selection action bar OR normal input */}
      {isSelecting ? (
        <SelectionBar
          count={selectedMsgIds.length}
          onDelete={handleDeleteSelected}
          onForward={() => setForwardMsg(selectedMessages[0] ?? null)}
          onCancel={clearSelection}
        />
      ) : (
        <MessageInput chatId={chatId} />
      )}

      {showProfile && chat.peer_user_id && (
        <UserProfilePanel
          userId={chat.peer_user_id}
          onClose={() => setShowProfile(false)}
          onCall={(type) => handleStartCall(type)}
        />
      )}

      {forwardMsg && (
        <ForwardModal
          messages={isSelecting ? selectedMessages : [forwardMsg]}
          onClose={() => { setForwardMsg(null); clearSelection() }}
        />
      )}
    </div>
  )
}

function SelectionBar({ count, onDelete, onForward, onCancel }: {
  count: number
  onDelete: () => void
  onForward: () => void
  onCancel: () => void
}) {
  return (
    <div className="flex items-center gap-2 px-4 py-3
      bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm
      border-t border-black/8 dark:border-white/8 animate-slideDown">
      <button
        onClick={onCancel}
        className="icon-btn"
        title="Отмена выбора"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
      <span className="flex-1 text-sm font-medium text-gray-700 dark:text-gray-300">
        Выбрано: {count}
      </span>
      <button
        onClick={onForward}
        disabled={count === 0}
        className="icon-btn disabled:opacity-40"
        title="Переслать"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M13 9l3 3m0 0l-3 3m3-3H8m13 0a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </button>
      <button
        onClick={onDelete}
        disabled={count === 0}
        className="icon-btn text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-40"
        title="Удалить"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      </button>
    </div>
  )
}
