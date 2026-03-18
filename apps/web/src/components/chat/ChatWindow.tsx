import { useEffect, useRef, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { useChatStore } from '@/store/chat'
import { chatApi } from '@/api/chat'
import { ChatHeader } from './ChatHeader'
import { MessageList } from './MessageList'
import { MessageInput } from './MessageInput'

export function ChatWindow() {
  const { chatId } = useParams<{ chatId: string }>()
  const setMessages = useChatStore((s) => s.setMessages)
  const clearUnread = useChatStore((s) => s.clearUnread)
  const chats = useChatStore((s) => s.chats)
  const chat = chats.find((c) => c.id === chatId)
  const prevChatId = useRef<string>()

  const loadMessages = useCallback(async (id: string) => {
    try {
      const { data } = await chatApi.getMessages(id, 50, 0)
      setMessages(id, data.reverse()) // API returns DESC, reverse for display
      clearUnread(id)
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    if (!chatId || chatId === prevChatId.current) return
    prevChatId.current = chatId
    loadMessages(chatId)
  }, [chatId])

  if (!chatId || !chat) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-400">
        Chat not found
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-chat dark:bg-chat-dark">
      <ChatHeader chat={chat} />
      <MessageList chatId={chatId} />
      <MessageInput chatId={chatId} />
    </div>
  )
}
