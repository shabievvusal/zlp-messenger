import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Chat, Message } from '@/types'
import { useChatStore } from '@/store/chat'
import { useCallStore } from '@/store/call'
import { Avatar } from '@/components/ui/Avatar'
import { chatApi } from '@/api/chat'
import { useChatCtx } from '@/contexts/ChatContext'

interface Props {
  chat: Chat
  onStartCall: (type: 'voice' | 'video') => void
  onOpenProfile?: () => void
}

export function ChatHeader({ chat, onStartCall, onOpenProfile }: Props) {
  const navigate = useNavigate()
  const typing = useChatStore((s) => s.typing[chat.id] ?? [])
  const typingCount = typing.length
  const activeCall = useCallStore((s) => s.active)
  const inCall = activeCall !== null
  const { setHighlightMsgId } = useChatCtx()

  const [showSearch, setShowSearch] = useState(false)
  const [searchQ, setSearchQ] = useState('')
  const [searchResults, setSearchResults] = useState<Message[]>([])
  const [searching, setSearching] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)

  const title = chat.title ?? 'Пользователь'
  const subtitle =
    typingCount > 0
      ? `${typingCount === 1 ? 'печатает' : 'печатают'}...`
      : chat.type === 'private'
      ? 'был(а) недавно'
      : `${chat.members_count} участников`

  const isPrivate = chat.type === 'private'

  // Фокус при открытии поиска
  useEffect(() => {
    if (showSearch) searchRef.current?.focus()
    else { setSearchQ(''); setSearchResults([]) }
  }, [showSearch])

  // Поиск по сообщениям с debounce
  useEffect(() => {
    if (!searchQ.trim() || searchQ.length < 2) { setSearchResults([]); return }
    setSearching(true)
    const t = setTimeout(async () => {
      try {
        const { data } = await chatApi.searchMessages(chat.id, searchQ)
        setSearchResults(data ?? [])
      } catch { setSearchResults([]) }
      finally { setSearching(false) }
    }, 300)
    return () => clearTimeout(t)
  }, [searchQ, chat.id])

  return (
    <header className="flex flex-col bg-white/80 dark:bg-gray-800/80 backdrop-blur-md
      border-b border-black/8 dark:border-white/8 z-10 shadow-sm">
      <div className="flex items-center gap-3 px-4 py-3">
        <button onClick={onOpenProfile} className="rounded-full focus:outline-none
          transition-transform hover:scale-105 active:scale-95" title="View profile">
          <Avatar name={title} url={chat.avatar_url} size={40} />
        </button>
        <div className="flex-1 min-w-0 cursor-pointer" onClick={onOpenProfile}>
          <p className="font-semibold text-sm text-gray-900 dark:text-gray-100 truncate">{title}</p>
          <p className={`text-xs truncate transition-colors ${typingCount > 0 ? 'text-primary-500 italic' : 'text-gray-500 dark:text-gray-400'}`}>
            {subtitle}
          </p>
        </div>

        {/* Действия */}
        <div className="flex items-center gap-1">
          {/* Голосовой звонок */}
          {isPrivate && (
            <IconBtn
              title={inCall ? 'Уже в звонке' : 'Аудиозвонок'}
              disabled={inCall}
              onClick={() => onStartCall('voice')}
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
            </IconBtn>
          )}

          {/* Видеозвонок */}
          {isPrivate && (
            <IconBtn
              title={inCall ? 'Уже в звонке' : 'Видеозвонок'}
              disabled={inCall}
              onClick={() => onStartCall('video')}
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </IconBtn>
          )}

          {/* Поиск по сообщениям */}
          <IconBtn
            title="Поиск в чате"
            active={showSearch}
            onClick={() => setShowSearch((v) => !v)}
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </IconBtn>

          {/* Настройки */}
          <IconBtn title="Настройки профиля" onClick={() => navigate('/settings')}>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </IconBtn>
        </div>
      </div>

      {/* Строка поиска */}
      {showSearch && (
        <div className="px-4 pb-2 animate-slideDown">
          <div className="relative">
            <input
              ref={searchRef}
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
              onKeyDown={(e) => e.key === 'Escape' && setShowSearch(false)}
              placeholder="Поиск сообщений..."
              className="input-base pl-9 pr-4 py-1.5 text-sm"
            />
            <svg className="absolute left-2.5 top-2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            {searching && (
              <div className="absolute right-2.5 top-2 w-4 h-4 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
            )}
          </div>

          {/* Результаты поиска */}
          {searchResults.length > 0 && (
            <div className="mt-1 max-h-48 overflow-y-auto rounded-xl scrollbar-thin
              bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm
              shadow-lg border border-black/5 dark:border-white/5 animate-fadeIn">
              {searchResults.map((msg) => (
                <button
                  key={msg.id}
                  onClick={() => {
                    setHighlightMsgId(msg.id)
                    setShowSearch(false)
                    setSearchQ('')
                    setSearchResults([])
                  }}
                  className="w-full text-left px-3 py-2 hover:bg-black/5 dark:hover:bg-white/5
                    transition-colors border-b border-black/5 dark:border-white/5 last:border-0"
                >
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">
                    {msg.sender?.first_name} • {new Date(msg.created_at).toLocaleDateString('ru-RU')}
                  </p>
                  <p className="text-sm text-gray-900 dark:text-gray-100 truncate">{msg.text}</p>
                </button>
              ))}
            </div>
          )}

          {searchQ.length >= 2 && !searching && searchResults.length === 0 && (
            <p className="text-xs text-gray-400 mt-1 px-1">Ничего не найдено</p>
          )}
        </div>
      )}
    </header>
  )
}

function IconBtn({
  title,
  onClick,
  disabled,
  active,
  children,
}: {
  title: string
  onClick?: () => void
  disabled?: boolean
  active?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={`w-8 h-8 rounded-full flex items-center justify-center transition-all
        active:scale-90 disabled:opacity-40 disabled:cursor-not-allowed
        ${active
          ? 'bg-primary-100 dark:bg-primary-900/50 text-primary-600 dark:text-primary-400'
          : 'hover:bg-black/8 dark:hover:bg-white/10 text-gray-600 dark:text-gray-300'
        }`}
    >
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        {children}
      </svg>
    </button>
  )
}
