import { useEffect } from 'react'
import { Routes, Route } from 'react-router-dom'
import { Sidebar } from '@/components/sidebar/Sidebar'
import { ChatWindow } from '@/components/chat/ChatWindow'
import { EmptyChat } from '@/components/chat/EmptyChat'
import { useWebSocket } from '@/hooks/useWebSocket'
import { useChatStore } from '@/store/chat'
import { chatApi } from '@/api/chat'

export function MessengerPage() {
  const setChats = useChatStore((s) => s.setChats)
  useWebSocket()

  useEffect(() => {
    chatApi.getChats().then(({ data }) => setChats(data))
  }, [])

  return (
    <div className="flex h-full bg-white dark:bg-surface-dark overflow-hidden">
      <Sidebar />
      <main className="flex-1 flex flex-col overflow-hidden">
        <Routes>
          <Route path="/" element={<EmptyChat />} />
          <Route path="/chat/:chatId" element={<ChatWindow />} />
        </Routes>
      </main>
    </div>
  )
}
