import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { chatApi } from '@/api/chat'
import { usersApi } from '@/api/users'
import { useChatStore } from '@/store/chat'
import { Avatar } from '@/components/ui/Avatar'
import type { User } from '@/types'
import toast from 'react-hot-toast'

interface Props {
  onClose: () => void
}

export function NewChatModal({ onClose }: Props) {
  const navigate = useNavigate()
  const upsertChat = useChatStore((s) => s.upsertChat)
  const setActiveChat = useChatStore((s) => s.setActiveChat)

  const [tab, setTab] = useState<'private' | 'group'>('private')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<User[]>([])
  const [groupTitle, setGroupTitle] = useState('')
  const [loading, setLoading] = useState(false)
  const [searching, setSearching] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    clearTimeout(timerRef.current)
    if (query.length < 2) { setResults([]); return }
    setSearching(true)
    timerRef.current = setTimeout(async () => {
      try {
        const { data } = await usersApi.search(query)
        setResults(data ?? [])
      } catch {
        setResults([])
      } finally {
        setSearching(false)
      }
    }, 300)
    return () => clearTimeout(timerRef.current)
  }, [query])

  const openPrivateChat = async (user: User) => {
    setLoading(true)
    try {
      const { data } = await chatApi.createPrivate(user.id)
      // Enrich with local user data so title shows immediately without refresh
      upsertChat({
        ...data,
        title: data.title || `${user.first_name}${user.last_name ? ' ' + user.last_name : ''}`,
        peer_user_id: data.peer_user_id || user.id,
        avatar_url: data.avatar_url || user.avatar_url,
      })
      setActiveChat(data.id)
      navigate(`/chat/${data.id}`)
      onClose()
    } catch {
      toast.error('Не удалось открыть чат')
    } finally {
      setLoading(false)
    }
  }

  const handleGroup = async () => {
    if (!groupTitle.trim()) return
    setLoading(true)
    try {
      const { data } = await chatApi.createGroup({ title: groupTitle })
      upsertChat(data)
      setActiveChat(data.id)
      navigate(`/chat/${data.id}`)
      onClose()
    } catch {
      toast.error('Failed to create group')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-card w-full max-w-sm overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 pt-6 pb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
            Новый чат
          </h2>

          {/* Tabs */}
          <div className="flex rounded-xl bg-black/5 dark:bg-white/5 p-1 gap-1">
            {(['private', 'group'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${
                  tab === t
                    ? 'bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-white'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                {t === 'private' ? '👤 Личное' : '👥 Группа'}
              </button>
            ))}
          </div>
        </div>

        {tab === 'private' ? (
          <div className="animate-fadeIn">
            {/* Search input */}
            <div className="px-6 pb-3">
              <div className="relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
                  fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  autoFocus
                  type="text"
                  placeholder="Поиск по имени или @username..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="input-base pl-9 pr-10 text-sm"
                />
                {searching && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2
                    spinner border-primary-500" />
                )}
              </div>
            </div>

            {/* Results */}
            <div className="max-h-72 overflow-y-auto scrollbar-thin">
              {query.length >= 2 && results.length === 0 && !searching && (
                <p className="text-center text-gray-400 text-sm py-8 animate-fadeIn">
                  Пользователи не найдены
                </p>
              )}
              {query.length < 2 && (
                <p className="text-center text-gray-400 text-sm py-8">
                  Введите минимум 2 символа
                </p>
              )}
              {results.map((user, i) => (
                <button
                  key={user.id}
                  onClick={() => openPrivateChat(user)}
                  disabled={loading}
                  className="w-full flex items-center gap-3 px-6 py-3
                    hover:bg-black/5 dark:hover:bg-white/5
                    active:bg-black/8 dark:active:bg-white/8
                    transition-colors text-left animate-fadeIn"
                  style={{ animationDelay: `${i * 0.04}s` }}
                >
                  <Avatar name={`${user.first_name} ${user.last_name ?? ''}`}
                    url={user.avatar_url} size={40} />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-gray-900 dark:text-gray-100 truncate">
                      {user.first_name} {user.last_name}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      @{user.username}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="px-6 pb-6 space-y-3 animate-fadeIn">
            <input
              type="text"
              placeholder="Название группы"
              value={groupTitle}
              onChange={(e) => setGroupTitle(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleGroup()}
              className="input-base text-sm"
            />
            <button
              onClick={handleGroup}
              disabled={loading || !groupTitle.trim()}
              className="w-full py-2.5 bg-primary-500 hover:bg-primary-600
                active:bg-primary-700 text-white rounded-xl font-medium
                disabled:opacity-40 disabled:cursor-not-allowed
                transition-all duration-150 active:scale-[0.98]
                shadow-sm shadow-primary-500/30"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="spinner" /> Создание...
                </span>
              ) : 'Создать группу'}
            </button>
          </div>
        )}

        <div className="px-6 pb-5">
          <button
            onClick={onClose}
            className="w-full py-2 text-sm text-gray-400 hover:text-gray-600
              dark:hover:text-gray-300 transition-colors"
          >
            Отмена
          </button>
        </div>
      </div>
    </div>
  )
}
