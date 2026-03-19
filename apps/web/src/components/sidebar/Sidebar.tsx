import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useChatStore } from '@/store/chat'
import { useFolderStore, ChatFolder } from '@/store/folders'
import { usersApi } from '@/api/users'
import { chatApi } from '@/api/chat'
import type { User } from '@/types'
import { ChatItem } from './ChatItem'
import { SearchBar } from './SearchBar'
import { NewChatModal } from './NewChatModal'
import { SideDrawer } from './SideDrawer'
import { FolderBar } from './FolderBar'
import { FolderEditModal } from './FolderEditModal'
import { Avatar } from '@/components/ui/Avatar'

export function Sidebar() {
  const navigate = useNavigate()
  const chats = useChatStore((s) => s.chats)
  const activeChatId = useChatStore((s) => s.activeChatId)
  const setActiveChat = useChatStore((s) => s.setActiveChat)
  const clearMentions = useChatStore((s) => s.clearMentions)
  const upsertChat = useChatStore((s) => s.upsertChat)

  const { activeFolderId, folders } = useFolderStore()

  const [search, setSearch] = useState('')
  const [newChatMode, setNewChatMode] = useState<'private' | 'group' | null>(null)
  const [showDrawer, setShowDrawer] = useState(false)
  const [editingFolder, setEditingFolder] = useState<ChatFolder | null | undefined>(undefined)

  // User search results
  const [userResults, setUserResults] = useState<User[]>([])
  const [userSearching, setUserSearching] = useState(false)
  const searchTimer = useRef<ReturnType<typeof setTimeout>>()

  // Debounced user search
  useEffect(() => {
    clearTimeout(searchTimer.current)
    if (!search.trim()) {
      setUserResults([])
      setUserSearching(false)
      return
    }
    setUserSearching(true)
    searchTimer.current = setTimeout(async () => {
      try {
        const { data } = await usersApi.search(search)
        setUserResults(data ?? [])
      } catch {
        setUserResults([])
      } finally {
        setUserSearching(false)
      }
    }, 300)
    return () => clearTimeout(searchTimer.current)
  }, [search])

  // Filter chats by active folder, then by search query
  const folderChats = activeFolderId
    ? (() => {
        const folder = folders.find((f) => f.id === activeFolderId)
        return folder ? chats.filter((c) => folder.chatIds.includes(c.id)) : chats
      })()
    : chats

  const filteredChats = search
    ? folderChats.filter((c) =>
        (c.title ?? '').toLowerCase().includes(search.toLowerCase()) ||
        (c.username ?? '').toLowerCase().includes(search.toLowerCase())
      )
    : folderChats

  const handleSelectChat = (chatId: string) => {
    setActiveChat(chatId)
    clearMentions(chatId)
    navigate(`/chat/${chatId}`)
    if (search) setSearch('')
  }

  const handleSelectUser = async (user: User) => {
    try {
      const { data } = await chatApi.createPrivate(user.id)
      upsertChat(data)
      setActiveChat(data.id)
      navigate(`/chat/${data.id}`)
    } catch { /* ignore */ }
    setSearch('')
  }

  const folderName = activeFolderId
    ? (folders.find((f) => f.id === activeFolderId)?.name ?? 'Папка')
    : null

  const isSearching = search.trim().length > 0

  return (
    <aside className="w-[340px] flex-shrink-0 flex h-full
      border-r border-black/8 dark:border-white/8">

      {/* Folder bar (with hamburger at top) */}
      <FolderBar
        onEditFolder={(f) => setEditingFolder(f)}
        onOpenDrawer={() => setShowDrawer(true)}
      />

      {/* Chat list panel */}
      <div className="flex-1 flex flex-col bg-sidebar dark:bg-sidebar-dark overflow-hidden">

        {/* Header */}
        <div className="flex items-center px-4 py-2.5
          border-b border-black/8 dark:border-white/8">
          <span className="font-semibold text-base flex-1 text-gray-900 dark:text-gray-100 tracking-tight">
            {folderName ?? 'ZLP Messenger'}
          </span>
        </div>

        {/* Search + new chat button */}
        <SearchBar
          value={search}
          onChange={setSearch}
          onNewChat={() => setNewChatMode('private')}
        />

        {/* Folder subtitle */}
        {activeFolderId && folderName && !isSearching && (
          <div className="px-3 py-1.5 flex items-center gap-2
            border-b border-black/5 dark:border-white/5">
            <span className="text-[10px] text-primary-500 font-semibold uppercase tracking-widest">
              {folderName}
            </span>
            <span className="text-[10px] text-gray-400">
              {filteredChats.length} {filteredChats.length === 1 ? 'чат' : filteredChats.length < 5 ? 'чата' : 'чатов'}
            </span>
          </div>
        )}

        {/* Scrollable results */}
        <div className="flex-1 overflow-y-auto scrollbar-thin">

          {/* ── Search mode ── */}
          {isSearching ? (
            <>
              {/* Matching chats */}
              {filteredChats.length > 0 && (
                <>
                  <SectionLabel>Чаты</SectionLabel>
                  {filteredChats.map((chat) => (
                    <ChatItem
                      key={chat.id}
                      chat={chat}
                      active={chat.id === activeChatId}
                      onClick={() => handleSelectChat(chat.id)}
                    />
                  ))}
                </>
              )}

              {/* User search results */}
              {userSearching && (
                <p className="text-xs text-gray-400 text-center py-4">Поиск пользователей...</p>
              )}
              {!userSearching && userResults.length > 0 && (
                <>
                  <SectionLabel>Пользователи</SectionLabel>
                  {userResults.map((user) => (
                    <UserResultItem
                      key={user.id}
                      user={user}
                      onClick={() => handleSelectUser(user)}
                    />
                  ))}
                </>
              )}

              {/* Nothing found */}
              {!userSearching && filteredChats.length === 0 && userResults.length === 0 && (
                <div className="flex flex-col items-center justify-center h-36 text-gray-400">
                  <span className="text-3xl mb-2">🔍</span>
                  <p className="text-sm">Ничего не найдено</p>
                </div>
              )}
            </>
          ) : (
            /* ── Normal mode ── */
            filteredChats.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 text-gray-400">
                <span className="text-3xl mb-2">{activeFolderId ? '📁' : '💬'}</span>
                <p className="text-sm">
                  {activeFolderId ? 'В этой папке нет чатов' : 'Нет чатов'}
                </p>
                {!activeFolderId && (
                  <button
                    onClick={() => setNewChatMode('private')}
                    className="mt-3 text-sm text-primary-500 hover:text-primary-600 transition-colors font-medium"
                  >
                    Начать переписку
                  </button>
                )}
                {activeFolderId && (
                  <button
                    onClick={() => setEditingFolder(folders.find((f) => f.id === activeFolderId) ?? null)}
                    className="mt-2 text-xs text-primary-500 hover:text-primary-600 transition-colors"
                  >
                    Добавить чаты в папку
                  </button>
                )}
              </div>
            ) : (
              filteredChats.map((chat) => (
                <ChatItem
                  key={chat.id}
                  chat={chat}
                  active={chat.id === activeChatId}
                  onClick={() => handleSelectChat(chat.id)}
                />
              ))
            )
          )}
        </div>
      </div>

      {newChatMode && (
        <NewChatModal
          initialMode={newChatMode}
          onClose={() => setNewChatMode(null)}
        />
      )}

      {showDrawer && (
        <SideDrawer
          onClose={() => setShowDrawer(false)}
          onCreateGroup={() => { setShowDrawer(false); setNewChatMode('group') }}
        />
      )}

      {editingFolder !== undefined && (
        <FolderEditModal
          folder={editingFolder ?? undefined}
          onClose={() => setEditingFolder(undefined)}
        />
      )}
    </aside>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-4 pt-3 pb-1 text-[10px] font-semibold text-gray-400 uppercase tracking-widest">
      {children}
    </p>
  )
}

function UserResultItem({ user, onClick }: { user: User; onClick: () => void }) {
  const name = `${user.first_name}${user.last_name ? ' ' + user.last_name : ''}`
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-3 py-2.5
        hover:bg-black/5 dark:hover:bg-white/5 transition-colors text-left"
    >
      <Avatar name={name} url={user.avatar_url} size={46} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate leading-tight">
          {name}
        </p>
        {user.username && (
          <p className="text-xs text-gray-400 truncate">@{user.username}</p>
        )}
      </div>
    </button>
  )
}
