import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useChatStore } from '@/store/chat'
import { useFolderStore, ChatFolder } from '@/store/folders'
import { usersApi } from '@/api/users'
import { chatApi } from '@/api/chat'
import type { User, Chat } from '@/types'
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

  const { activeFolderId, folders, archivedChatIds } = useFolderStore()

  const [search, setSearch] = useState('')
  const [newChatMode, setNewChatMode] = useState<'private' | 'group' | null>(null)
  const [showDrawer, setShowDrawer] = useState(false)
  const [editingFolder, setEditingFolder] = useState<ChatFolder | null | undefined>(undefined)
  const [showArchive, setShowArchive] = useState(false)

  // User search
  const [userResults, setUserResults] = useState<User[]>([])
  const [userSearching, setUserSearching] = useState(false)
  const searchTimer = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    clearTimeout(searchTimer.current)
    if (!search.trim()) { setUserResults([]); setUserSearching(false); return }
    setUserSearching(true)
    searchTimer.current = setTimeout(async () => {
      try {
        const { data } = await usersApi.search(search)
        setUserResults(data ?? [])
      } catch { setUserResults([]) }
      finally { setUserSearching(false) }
    }, 300)
    return () => clearTimeout(searchTimer.current)
  }, [search])

  // Split chats into categories
  const savedChat = chats.find((c) => c.type === 'saved') ?? null
  const archivedChats = chats.filter((c) => archivedChatIds.includes(c.id))
  const archivedUnread = archivedChats.reduce((s, c) => s + (c.unread_count ?? 0), 0)

  // Normal chats: not saved, not archived, filtered by active folder
  const normalChats = chats.filter(
    (c) => c.type !== 'saved' && !archivedChatIds.includes(c.id)
  )
  const folderChats = activeFolderId
    ? (() => {
        const folder = folders.find((f) => f.id === activeFolderId)
        return folder ? normalChats.filter((c) => folder.chatIds.includes(c.id)) : normalChats
      })()
    : normalChats

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
    if (showArchive) setShowArchive(false)
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

  // ── Archive view ────────────────────────────────────────────
  if (showArchive) {
    return (
      <aside className="w-[340px] flex-shrink-0 flex h-full
        border-r border-black/8 dark:border-white/8">
        <FolderBar
          onEditFolder={(f) => setEditingFolder(f)}
          onOpenDrawer={() => setShowDrawer(true)}
        />
        <div className="flex-1 flex flex-col bg-sidebar dark:bg-sidebar-dark overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-3
            border-b border-black/8 dark:border-white/8">
            <button
              onClick={() => setShowArchive(false)}
              className="w-7 h-7 flex items-center justify-center rounded-full
                hover:bg-black/8 dark:hover:bg-white/10 transition-colors text-gray-500"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <span className="font-semibold text-sm text-gray-900 dark:text-gray-100">Архив</span>
          </div>
          <div className="flex-1 overflow-y-auto scrollbar-thin">
            {archivedChats.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 text-gray-400">
                <span className="text-3xl mb-2">🗄️</span>
                <p className="text-sm">Архив пуст</p>
              </div>
            ) : (
              archivedChats.map((chat) => (
                <ChatItem
                  key={chat.id}
                  chat={chat}
                  active={chat.id === activeChatId}
                  onClick={() => handleSelectChat(chat.id)}
                />
              ))
            )}
          </div>
        </div>
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

  // ── Normal view ─────────────────────────────────────────────
  return (
    <aside className="w-[340px] flex-shrink-0 flex h-full
      border-r border-black/8 dark:border-white/8">

      <FolderBar
        onEditFolder={(f) => setEditingFolder(f)}
        onOpenDrawer={() => setShowDrawer(true)}
      />

      <div className="flex-1 flex flex-col bg-sidebar dark:bg-sidebar-dark overflow-hidden">

        {/* Header */}
        <div className="flex items-center px-4 py-2.5
          border-b border-black/8 dark:border-white/8">
          <span className="font-semibold text-base flex-1 text-gray-900 dark:text-gray-100 tracking-tight">
            {folderName ?? 'ZLP Messenger'}
          </span>
        </div>

        {/* Search */}
        <SearchBar value={search} onChange={setSearch} />

        {/* Folder subtitle */}
        {activeFolderId && folderName && !isSearching && (
          <div className="px-3 py-1 flex items-center gap-2
            border-b border-black/5 dark:border-white/5">
            <span className="text-[10px] text-primary-500 font-semibold uppercase tracking-widest">
              {folderName}
            </span>
            <span className="text-[10px] text-gray-400">
              {filteredChats.length} {filteredChats.length === 1 ? 'чат' : filteredChats.length < 5 ? 'чата' : 'чатов'}
            </span>
          </div>
        )}

        <div className="flex-1 overflow-y-auto scrollbar-thin">

          {isSearching ? (
            /* ── Search results ── */
            <>
              {filteredChats.length > 0 && (
                <>
                  <SectionLabel>Чаты</SectionLabel>
                  {filteredChats.map((chat) => (
                    <ChatItem key={chat.id} chat={chat}
                      active={chat.id === activeChatId}
                      onClick={() => handleSelectChat(chat.id)} />
                  ))}
                </>
              )}
              {userSearching && (
                <p className="text-xs text-gray-400 text-center py-4">Поиск пользователей...</p>
              )}
              {!userSearching && userResults.length > 0 && (
                <>
                  <SectionLabel>Пользователи</SectionLabel>
                  {userResults.map((user) => (
                    <UserResultItem key={user.id} user={user}
                      onClick={() => handleSelectUser(user)} />
                  ))}
                </>
              )}
              {!userSearching && filteredChats.length === 0 && userResults.length === 0 && (
                <div className="flex flex-col items-center justify-center h-36 text-gray-400">
                  <span className="text-3xl mb-2">🔍</span>
                  <p className="text-sm">Ничего не найдено</p>
                </div>
              )}
            </>
          ) : (
            /* ── Normal list ── */
            <>
              {/* Archive row */}
              {archivedChats.length > 0 && !activeFolderId && (
                <ArchiveRow
                  chats={archivedChats}
                  unread={archivedUnread}
                  onClick={() => setShowArchive(true)}
                />
              )}

              {/* Saved messages */}
              {savedChat && !activeFolderId && (
                <ChatItem
                  chat={savedChat}
                  active={savedChat.id === activeChatId}
                  onClick={() => handleSelectChat(savedChat.id)}
                />
              )}

              {/* Regular chats */}
              {filteredChats.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-40 text-gray-400">
                  <span className="text-3xl mb-2">{activeFolderId ? '📁' : '💬'}</span>
                  <p className="text-sm">
                    {activeFolderId ? 'В этой папке нет чатов' : 'Нет чатов'}
                  </p>
                  {!activeFolderId && (
                    <button onClick={() => setNewChatMode('private')}
                      className="mt-3 text-sm text-primary-500 hover:text-primary-600 transition-colors font-medium">
                      Начать переписку
                    </button>
                  )}
                  {activeFolderId && (
                    <button
                      onClick={() => setEditingFolder(folders.find((f) => f.id === activeFolderId) ?? null)}
                      className="mt-2 text-xs text-primary-500 hover:text-primary-600 transition-colors">
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
              )}
            </>
          )}
        </div>
      </div>

      {newChatMode && (
        <NewChatModal initialMode={newChatMode} onClose={() => setNewChatMode(null)} />
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

// ── Archive summary row ─────────────────────────────────────
function ArchiveRow({ chats, unread, onClick }: { chats: Chat[]; unread: number; onClick: () => void }) {
  // Show last 3 archived chat names as preview
  const preview = chats.slice(0, 3).map((c) => c.title ?? 'Чат').join(', ')
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-3 py-2.5
        hover:bg-black/5 dark:hover:bg-white/5 transition-colors text-left"
    >
      {/* Archive icon */}
      <div className="w-[50px] h-[50px] rounded-full flex-shrink-0
        bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
        <svg className="w-6 h-6 text-gray-500 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
            d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-1 mb-[2px]">
          <span className="font-semibold text-sm text-gray-900 dark:text-gray-100">Архив</span>
          {unread > 0 && (
            <span className="bg-gray-400 dark:bg-gray-600 text-white text-[11px] font-semibold
              rounded-full min-w-[20px] h-5 flex items-center justify-center px-1.5">
              {unread > 99 ? '99+' : unread}
            </span>
          )}
        </div>
        <p className="text-xs text-gray-400 truncate leading-tight">{preview}</p>
      </div>
    </button>
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
    <button onClick={onClick}
      className="w-full flex items-center gap-3 px-3 py-2.5
        hover:bg-black/5 dark:hover:bg-white/5 transition-colors text-left">
      <Avatar name={name} url={user.avatar_url} size={46} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate leading-tight">{name}</p>
        {user.username && <p className="text-xs text-gray-400 truncate">@{user.username}</p>}
      </div>
    </button>
  )
}
