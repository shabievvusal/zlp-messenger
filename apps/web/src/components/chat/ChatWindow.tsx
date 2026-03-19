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
import { ChatProvider } from '@/contexts/ChatContext'

const PAGE_SIZE = 50

interface Props {
  onStartCall?: (targetId: string, targetName: string, type: 'voice' | 'video') => void
}

export function ChatWindow({ onStartCall }: Props) {
  const { chatId } = useParams<{ chatId: string }>()
  const { setMessages, prependMessages, clearUnread, chats } = useChatStore()
  const currentUser = useAuthStore((s) => s.user)
  const chat = chats.find((c) => c.id === chatId)
  const prevChatId = useRef<string>()
  const [offset, setOffset] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const loadingMore = useRef(false)
  const [showProfile, setShowProfile] = useState(false)

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

  // Инициировать звонок: если peer_user_id есть в чате — используем, иначе запрашиваем участников
  const handleStartCall = useCallback(async (type: 'voice' | 'video') => {
    if (!chat || !onStartCall) return

    // Если бэкенд уже вернул peer_user_id — используем сразу
    if (chat.peer_user_id) {
      onStartCall(chat.peer_user_id, chat.title ?? 'User', type)
      return
    }

    // Фоллбэк: запрашиваем участников чата
    try {
      const { data: members } = await chatApi.getMembers(chat.id)
      const peer = members.find((m) => m.user_id !== currentUser?.id)
      if (!peer) return
      const name = peer.user
        ? `${peer.user.first_name}${peer.user.last_name ? ' ' + peer.user.last_name : ''}`
        : chat.title ?? 'User'
      onStartCall(peer.user_id, name, type)
    } catch { /* ignore */ }
  }, [chat, currentUser, onStartCall])

  if (!chatId || !chat) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-400">
        Chat not found
      </div>
    )
  }

  return (
    <ChatProvider>
      <div className="flex flex-col h-full bg-chat dark:bg-chat-dark relative">
        <ChatHeader
          chat={chat}
          onStartCall={handleStartCall}
          onOpenProfile={chat.type === 'private' && chat.peer_user_id ? () => setShowProfile(true) : undefined}
        />
        <MessageList chatId={chatId} onLoadMore={handleLoadMore} />
        <MessageInput chatId={chatId} />
        {showProfile && chat.peer_user_id && (
          <UserProfilePanel
            userId={chat.peer_user_id}
            onClose={() => setShowProfile(false)}
            onCall={(type) => handleStartCall(type)}
          />
        )}
      </div>
      <MediaViewer />
    </ChatProvider>
  )
}
