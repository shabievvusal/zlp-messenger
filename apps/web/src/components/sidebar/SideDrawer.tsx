import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/auth'
import { authApi } from '@/api/auth'
import { Avatar } from '@/components/ui/Avatar'
import { useDarkMode } from '@/hooks/useDarkMode'
import { mediaUrl } from '@/utils/media'

interface Props {
  onClose: () => void
  onCreateGroup: () => void
}

export function SideDrawer({ onClose, onCreateGroup }: Props) {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const { isDark, toggle } = useDarkMode()

  const name = `${user?.first_name ?? ''}${user?.last_name ? ' ' + user.last_name : ''}`

  const handleLogout = async () => {
    onClose()
    await authApi.logout().catch(() => {})
    logout()
    navigate('/login')
  }

  const go = (path: string) => { onClose(); navigate(path) }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm animate-fadeIn"
        onClick={onClose}
      />

      {/* Drawer panel */}
      <div className="fixed left-0 top-0 bottom-0 z-50 w-[300px]
        bg-white dark:bg-[#212121] shadow-2xl flex flex-col
        animate-slideInLeft overflow-hidden">

        {/* Hero section */}
        <div className="relative flex-shrink-0 bg-primary-600 dark:bg-[#2b5278] px-5 pt-10 pb-4">
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center
              rounded-full text-white/70 hover:text-white hover:bg-white/10 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          <Avatar
            name={name || '?'}
            url={user?.avatar_url ? mediaUrl(user.avatar_url) : null}
            size={68}
          />
          <p className="mt-3 font-semibold text-white text-base leading-tight">{name}</p>
          {user?.username && (
            <p className="text-white/70 text-sm mt-0.5">@{user.username}</p>
          )}
        </div>

        {/* Menu items */}
        <div className="flex-1 overflow-y-auto py-2">

          <DrawerItem
            icon={<IconProfile />}
            label="Мой профиль"
            onClick={() => go('/settings')}
          />

          <Divider />

          <DrawerItem
            icon={<IconGroup />}
            label="Создать группу"
            onClick={() => { onClose(); onCreateGroup() }}
          />
          <DrawerItem
            icon={<IconChannel />}
            label="Создать канал"
            onClick={() => { onClose(); onCreateGroup() }}
          />
          <DrawerItem
            icon={<IconContacts />}
            label="Контакты"
            onClick={() => go('/settings')}
          />
          <DrawerItem
            icon={<IconCalls />}
            label="Звонки"
            onClick={onClose}
          />

          <Divider />

          <DrawerItem
            icon={<IconSaved />}
            label="Избранное"
            onClick={onClose}
          />
          <DrawerItem
            icon={<IconSettings />}
            label="Настройки"
            onClick={() => go('/settings')}
          />

          <Divider />

          {/* Dark mode toggle */}
          <div className="flex items-center gap-4 px-5 py-3.5 cursor-pointer
            hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
            onClick={toggle}
          >
            <span className="text-gray-500 dark:text-gray-400 flex-shrink-0">
              <IconMoon />
            </span>
            <span className="flex-1 text-sm font-medium text-gray-800 dark:text-gray-100">
              Ночной режим
            </span>
            {/* Toggle switch */}
            <div className={`w-11 h-6 rounded-full transition-colors duration-200 flex-shrink-0
              ${isDark ? 'bg-primary-500' : 'bg-gray-300 dark:bg-gray-600'}`}>
              <div className={`w-5 h-5 bg-white rounded-full shadow mt-0.5 transition-transform duration-200
                ${isDark ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </div>
          </div>

          <Divider />

          <DrawerItem
            icon={<IconLogout />}
            label="Выйти"
            onClick={handleLogout}
            danger
          />
        </div>
      </div>
    </>
  )
}

function DrawerItem({ icon, label, onClick, danger }: {
  icon: React.ReactNode
  label: string
  onClick: () => void
  danger?: boolean
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-4 px-5 py-3.5 transition-colors text-left
        ${danger
          ? 'text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20'
          : 'text-gray-800 dark:text-gray-100 hover:bg-black/5 dark:hover:bg-white/5'
        }`}
    >
      <span className={`flex-shrink-0 ${danger ? 'text-red-500' : 'text-gray-500 dark:text-gray-400'}`}>
        {icon}
      </span>
      <span className="text-sm font-medium">{label}</span>
    </button>
  )
}

function Divider() {
  return <div className="mx-5 my-1 border-t border-black/8 dark:border-white/8" />
}

// ── Icons ──────────────────────────────────────────────────

function IconProfile() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  )
}

function IconGroup() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
        d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  )
}

function IconChannel() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
        d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
    </svg>
  )
}

function IconContacts() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  )
}

function IconCalls() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
        d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
    </svg>
  )
}

function IconSaved() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
        d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
    </svg>
  )
}

function IconSettings() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
        d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  )
}

function IconMoon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
        d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
    </svg>
  )
}

function IconLogout() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
        d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
    </svg>
  )
}
