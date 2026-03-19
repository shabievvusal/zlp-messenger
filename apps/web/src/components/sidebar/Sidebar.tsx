import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useChatStore } from '@/store/chat'
import { useAuthStore } from '@/store/auth'
import { ChatItem } from './ChatItem'
import { SearchBar } from './SearchBar'
import { NewChatModal } from './NewChatModal'
import { SideDrawer } from './SideDrawer'

export function Sidebar() {
  const navigate = useNavigate()
  const chats = useChatStore((s) => s.chats)
  const activeChatId = useChatStore((s) => s.activeChatId)
  const setActiveChat = useChatStore((s) => s.setActiveChat)
  const clearMentions = useChatStore((s) => s.clearMentions)

  const [search, setSearch] = useState('')
  const [showNewChat, setShowNewChat] = useState(false)
  const [showDrawer, setShowDrawer] = useState(false)

  const filtered = search
    ? chats.filter((c) =>
        (c.title ?? '').toLowerCase().includes(search.toLowerCase()) ||
        (c.username ?? '').toLowerCase().includes(search.toLowerCase())
      )
    : chats

  const handleSelect = (chatId: string) => {
    setActiveChat(chatId)
    clearMentions(chatId)
    navigate(`/chat/${chatId}`)
  }

  const totalUnread = chats.reduce((sum, c) => sum + (c.unread_count ?? 0), 0)

  return (
    <aside className="w-[340px] flex-shrink-0 flex flex-col
      border-r border-black/8 dark:border-white/8
      bg-sidebar dark:bg-sidebar-dark h-full">

      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5
        border-b border-black/8 dark:border-white/8">

        {/* Hamburger / menu button */}
        <button
          onClick={() => setShowDrawer(true)}
          className="w-9 h-9 flex items-center justify-center rounded-full
            hover:bg-black/8 dark:hover:bg-white/10 transition-colors active:scale-90"
          title="Меню"
        >
          <svg className="w-5 h-5 text-gray-600 dark:text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        {/* Title */}
        <span className="font-semibold text-sm flex-1 text-gray-900 dark:text-gray-100 tracking-tight">
          ZLP Messenger
          {totalUnread > 0 && (
            <span className="ml-2 text-[11px] bg-primary-500 text-white
              rounded-full px-1.5 py-0.5 font-medium animate-popIn">
              {totalUnread > 99 ? '99+' : totalUnread}
            </span>
          )}
        </span>

        {/* New chat */}
        <button
          onClick={() => setShowNewChat(true)}
          className="icon-btn"
          title="Новый чат"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
        </button>
      </div>

      {/* Search */}
      <SearchBar value={search} onChange={setSearch} />

      {/* Chat list */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-gray-400 animate-fadeIn">
            <span className="text-3xl mb-2">💬</span>
            <p className="text-sm">{search ? 'Чаты не найдены' : 'Нет чатов'}</p>
            {!search && (
              <button
                onClick={() => setShowNewChat(true)}
                className="mt-3 text-sm text-primary-500 hover:text-primary-600 transition-colors font-medium"
              >
                Начать переписку
              </button>
            )}
          </div>
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

      {showDrawer && (
        <SideDrawer
          onClose={() => setShowDrawer(false)}
          onCreateGroup={() => setShowNewChat(true)}
        />
      )}
    </aside>
  )
}
