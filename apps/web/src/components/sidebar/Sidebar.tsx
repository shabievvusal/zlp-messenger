import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useChatStore } from '@/store/chat'
import { useAuthStore } from '@/store/auth'
import { authApi } from '@/api/auth'
import { ChatItem } from './ChatItem'
import { SearchBar } from './SearchBar'
import { NewChatModal } from './NewChatModal'

export function Sidebar() {
  const navigate = useNavigate()
  const chats = useChatStore((s) => s.chats)
  const activeChatId = useChatStore((s) => s.activeChatId)
  const setActiveChat = useChatStore((s) => s.setActiveChat)
  const logout = useAuthStore((s) => s.logout)
  const user = useAuthStore((s) => s.user)

  const [search, setSearch] = useState('')
  const [showNewChat, setShowNewChat] = useState(false)

  const filtered = search
    ? chats.filter((c) =>
        (c.title ?? '').toLowerCase().includes(search.toLowerCase()) ||
        (c.username ?? '').toLowerCase().includes(search.toLowerCase())
      )
    : chats

  const handleSelect = (chatId: string) => {
    setActiveChat(chatId)
    navigate(`/chat/${chatId}`)
  }

  const handleLogout = async () => {
    await authApi.logout()
    logout()
    navigate('/login')
  }

  return (
    <aside className="w-80 flex-shrink-0 flex flex-col border-r border-gray-200 dark:border-gray-700
      bg-sidebar dark:bg-sidebar-dark h-full">

      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={handleLogout}
          className="w-9 h-9 rounded-full bg-primary-500 flex items-center justify-center
            text-white font-semibold text-sm flex-shrink-0"
          title="Logout"
        >
          {user?.first_name?.[0]?.toUpperCase() ?? '?'}
        </button>
        <span className="font-semibold text-sm flex-1 truncate text-gray-900 dark:text-gray-100">
          {user?.first_name} {user?.last_name}
        </span>
        <button
          onClick={() => setShowNewChat(true)}
          className="w-8 h-8 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600
            flex items-center justify-center transition"
          title="New chat"
        >
          <svg className="w-5 h-5 text-gray-600 dark:text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>
      </div>

      {/* Search */}
      <SearchBar value={search} onChange={setSearch} />

      {/* Chat list */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {filtered.length === 0 ? (
          <p className="text-center text-gray-400 text-sm mt-10">
            {search ? 'No chats found' : 'No chats yet'}
          </p>
        ) : (
          filtered.map((chat) => (
            <ChatItem
              key={chat.id}
              chat={chat}
              active={chat.id === activeChatId}
              onClick={() => handleSelect(chat.id)}
            />
          ))
        )}
      </div>

      {showNewChat && <NewChatModal onClose={() => setShowNewChat(false)} />}
    </aside>
  )
}
