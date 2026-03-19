import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useChatStore } from '@/store/chat'
import { useFolderStore, ChatFolder } from '@/store/folders'
import { ChatItem } from './ChatItem'
import { SearchBar } from './SearchBar'
import { NewChatModal } from './NewChatModal'
import { FolderBar } from './FolderBar'
import { FolderEditModal } from './FolderEditModal'

export function Sidebar() {
  const navigate = useNavigate()
  const chats = useChatStore((s) => s.chats)
  const activeChatId = useChatStore((s) => s.activeChatId)
  const setActiveChat = useChatStore((s) => s.setActiveChat)
  const clearMentions = useChatStore((s) => s.clearMentions)

  const { activeFolderId, folders } = useFolderStore()

  const [search, setSearch] = useState('')
  const [newChatMode, setNewChatMode] = useState<'private' | 'group' | null>(null)
  const [editingFolder, setEditingFolder] = useState<ChatFolder | null | undefined>(undefined)
  // undefined = closed, null = create new, ChatFolder = edit existing

  // Filter by active folder first, then by search
  const folderChats = activeFolderId
    ? (() => {
        const folder = folders.find((f) => f.id === activeFolderId)
        if (!folder) return chats
        return chats.filter((c) => folder.chatIds.includes(c.id))
      })()
    : chats

  const filtered = search
    ? folderChats.filter((c) =>
        (c.title ?? '').toLowerCase().includes(search.toLowerCase()) ||
        (c.username ?? '').toLowerCase().includes(search.toLowerCase())
      )
    : folderChats

  const handleSelect = (chatId: string) => {
    setActiveChat(chatId)
    clearMentions(chatId)
    navigate(`/chat/${chatId}`)
  }

  const folderName = activeFolderId
    ? (folders.find((f) => f.id === activeFolderId)?.name ?? 'Папка')
    : null

  return (
    <aside className="w-[340px] flex-shrink-0 flex h-full
      border-r border-black/8 dark:border-white/8">

      {/* Folder bar */}
      <FolderBar
        onEditFolder={(f) => setEditingFolder(f)}
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

        {/* Search + new chat */}
        <SearchBar
          value={search}
          onChange={setSearch}
          onNewChat={() => setNewChatMode('private')}
        />

        {/* Folder active indicator */}
        {activeFolderId && folderName && !search && (
          <div className="px-3 py-1.5 flex items-center gap-2
            border-b border-black/5 dark:border-white/5">
            <span className="text-[10px] text-primary-500 font-semibold uppercase tracking-widest">
              {folderName}
            </span>
            <span className="text-[10px] text-gray-400">
              {filtered.length} {filtered.length === 1 ? 'чат' : filtered.length < 5 ? 'чата' : 'чатов'}
            </span>
          </div>
        )}

        {/* Chat list */}
        <div className="flex-1 overflow-y-auto scrollbar-thin">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-gray-400">
              <span className="text-3xl mb-2">
                {activeFolderId ? '📁' : '💬'}
              </span>
              <p className="text-sm">
                {search
                  ? 'Чаты не найдены'
                  : activeFolderId
                  ? 'В этой папке нет чатов'
                  : 'Нет чатов'
                }
              </p>
              {!search && !activeFolderId && (
                <button
                  onClick={() => setNewChatMode('private')}
                  className="mt-3 text-sm text-primary-500 hover:text-primary-600 transition-colors font-medium"
                >
                  Начать переписку
                </button>
              )}
              {!search && activeFolderId && (
                <button
                  onClick={() => setEditingFolder(folders.find((f) => f.id === activeFolderId) ?? null)}
                  className="mt-2 text-xs text-primary-500 hover:text-primary-600 transition-colors"
                >
                  Добавить чаты в папку
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
      </div>

      {newChatMode && (
        <NewChatModal
          initialMode={newChatMode}
          onClose={() => setNewChatMode(null)}
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
