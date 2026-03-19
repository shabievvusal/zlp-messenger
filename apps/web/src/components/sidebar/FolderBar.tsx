import { useFolderStore, ChatFolder } from '@/store/folders'
import { useChatStore } from '@/store/chat'

interface Props {
  onEditFolder: (folder: ChatFolder | null) => void
  onOpenDrawer: () => void
}

export function FolderBar({ onEditFolder, onOpenDrawer }: Props) {
  const { folders, activeFolderId, setActiveFolder } = useFolderStore()
  const chats = useChatStore((s) => s.chats)

  const totalUnread = chats.reduce((sum, c) => sum + (c.unread_count ?? 0), 0)

  const folderUnread = (f: ChatFolder) =>
    chats
      .filter((c) => f.chatIds.includes(c.id))
      .reduce((sum, c) => sum + (c.unread_count ?? 0), 0)

  return (
    <div
      className="w-[62px] flex-shrink-0 flex flex-col items-center pt-1 pb-3 gap-0.5
        border-r border-black/8 dark:border-white/8
        bg-sidebar dark:bg-sidebar-dark overflow-y-auto scrollbar-hide"
    >
      {/* Hamburger menu — at very top */}
      <button
        onClick={onOpenDrawer}
        title="Меню"
        className="w-10 h-10 flex items-center justify-center rounded-xl mb-1
          text-gray-500 dark:text-gray-400
          hover:bg-black/8 dark:hover:bg-white/10
          hover:text-gray-800 dark:hover:text-gray-200
          transition-colors active:scale-90"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {/* All chats */}
      <FolderTab
        icon="💬"
        label="Все чаты"
        active={activeFolderId === null}
        unread={totalUnread}
        onClick={() => setActiveFolder(null)}
        onDoubleClick={() => {}}
      />

      {/* User folders */}
      {folders.map((f) => (
        <FolderTab
          key={f.id}
          icon={f.emoji}
          label={f.name}
          active={activeFolderId === f.id}
          unread={folderUnread(f)}
          onClick={() => setActiveFolder(f.id)}
          onDoubleClick={() => onEditFolder(f)}
        />
      ))}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Add folder button */}
      <button
        onClick={() => onEditFolder(null)}
        title="Создать папку"
        className="w-10 h-10 flex items-center justify-center rounded-xl
          text-gray-400 hover:text-primary-500
          hover:bg-primary-50 dark:hover:bg-primary-900/20
          transition-colors"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M12 4v16m8-8H4" />
        </svg>
      </button>
    </div>
  )
}

function FolderTab({
  icon, label, active, unread, onClick, onDoubleClick,
}: {
  icon: string
  label: string
  active: boolean
  unread: number
  onClick: () => void
  onDoubleClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      title={label}
      className={`relative w-full flex flex-col items-center gap-1 py-2 px-1
        transition-all duration-150 rounded-xl mx-1
        ${active
          ? 'text-primary-500'
          : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
        }`}
    >
      {/* Active indicator */}
      {active && (
        <div className="absolute left-0 top-2 bottom-2 w-[3px]
          bg-primary-500 rounded-r-full" />
      )}

      {/* Icon container */}
      <div className={`relative w-10 h-10 rounded-2xl flex items-center justify-center text-xl
        transition-colors
        ${active
          ? 'bg-primary-100 dark:bg-primary-900/30'
          : 'hover:bg-black/5 dark:hover:bg-white/8'
        }`}>
        {icon}

        {/* Unread badge */}
        {unread > 0 && (
          <span className="absolute -top-1 -right-1
            bg-primary-500 text-white text-[9px] font-bold
            rounded-full min-w-[16px] h-4 flex items-center justify-center px-1
            leading-none">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </div>

      {/* Label */}
      <span className={`text-[9px] font-medium leading-tight text-center
        max-w-[52px] truncate
        ${active ? 'text-primary-500' : ''}`}>
        {label}
      </span>
    </button>
  )
}
