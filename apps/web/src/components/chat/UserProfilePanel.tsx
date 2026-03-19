import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Avatar } from '@/components/ui/Avatar'
import { usersApi } from '@/api/users'
import { chatApi } from '@/api/chat'
import { useChatStore } from '@/store/chat'
import { mediaUrl } from '@/utils/media'
import type { User, Attachment } from '@/types'
import toast from 'react-hot-toast'

interface Props {
  userId: string
  onClose: () => void
  onCall?: (type: 'voice' | 'video') => void
}

export function UserProfilePanel({ userId, onClose, onCall }: Props) {
  const navigate = useNavigate()
  const isOnline = useChatStore((s) => s.isOnline)
  const upsertChat = useChatStore((s) => s.upsertChat)

  const [profile, setProfile] = useState<User | null>(null)
  const [sharedMedia, setSharedMedia] = useState<Attachment[]>([])
  const [sharedFiles, setSharedFiles] = useState<Attachment[]>([])
  const [privateChatId, setPrivateChatId] = useState<string | null>(null)
  const [showMoreMenu, setShowMoreMenu] = useState(false)
  const [blocked, setBlocked] = useState(false)

  const name = profile
    ? `${profile.first_name}${profile.last_name ? ' ' + profile.last_name : ''}`
    : '...'
  const online = profile ? isOnline(profile.id) : false

  useEffect(() => {
    usersApi.getById(userId)
      .then(({ data }) => setProfile(data))
      .catch(() => {})
  }, [userId])

  // Try to find an existing private chat for media stats
  useEffect(() => {
    const chats = useChatStore.getState().chats
    const found = chats.find((c) => c.type === 'private' && c.peer_user_id === userId)
    if (found) {
      setPrivateChatId(found.id)
      chatApi.getSharedMedia(found.id, 'photo').then(({ data }) => setSharedMedia(data ?? [])).catch(() => {})
      chatApi.getSharedMedia(found.id, 'document').then(({ data }) => setSharedFiles(data ?? [])).catch(() => {})
    }
  }, [userId])

  const handleOpenChat = async () => {
    try {
      const { data } = await chatApi.createPrivate(userId)
      upsertChat(data)
      navigate(`/chat/${data.id}`)
      onClose()
    } catch { toast.error('Не удалось открыть чат') }
  }

  const handleBlock = () => {
    setBlocked((v) => !v)
    setShowMoreMenu(false)
    toast(blocked ? 'Пользователь разблокирован' : 'Пользователь заблокирован', { icon: blocked ? '✅' : '🚫' })
  }

  const photoCount = sharedMedia.filter((a) => a.type === 'photo').length
  const videoCount = sharedMedia.filter((a) => a.type === 'video').length
  const voiceCount = sharedMedia.filter((a) => a.type === 'voice' || a.type === 'audio').length
  const gifCount   = sharedMedia.filter((a) => a.type === 'gif').length

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

      <div
        className="relative z-10 w-full max-w-[360px] max-h-[90vh] overflow-y-auto
          bg-white dark:bg-[#1c1c1e] rounded-3xl shadow-2xl animate-scaleIn scrollbar-thin"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button onClick={onClose}
          className="absolute top-3 right-3 z-10 w-8 h-8 flex items-center justify-center
            rounded-full bg-black/10 dark:bg-white/10 hover:bg-black/20 transition-colors">
          <svg className="w-4 h-4 text-gray-600 dark:text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Hero */}
        <div className="flex flex-col items-center pt-8 pb-5 px-5
          bg-gradient-to-b from-primary-600 to-primary-500 rounded-t-3xl relative overflow-hidden">
          {profile?.avatar_url && (
            <img src={mediaUrl(profile.avatar_url)} alt=""
              className="absolute inset-0 w-full h-full object-cover opacity-30" />
          )}
          <div className="relative z-10 flex flex-col items-center gap-2">
            <div className="relative">
              <div className="w-20 h-20 rounded-full overflow-hidden ring-3 ring-white/30">
                {profile?.avatar_url
                  ? <img src={mediaUrl(profile.avatar_url)} alt={name} className="w-full h-full object-cover" />
                  : <Avatar name={name} size={80} />
                }
              </div>
              {online && (
                <span className="absolute bottom-1 right-1 w-3.5 h-3.5 bg-green-400
                  rounded-full border-2 border-white" />
              )}
            </div>
            <div className="text-center">
              <p className="text-white font-semibold text-lg leading-tight drop-shadow">{name}</p>
              <p className="text-white/70 text-xs mt-0.5">
                {online ? 'в сети' : profile?.last_seen
                  ? `был(а) сегодня в ${new Date(profile.last_seen).toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' })}`
                  : 'был(а) недавно'
                }
              </p>
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center justify-around px-4 py-3
          border-b border-black/5 dark:border-white/5">
          <ActionBtn label="Чат" onClick={handleOpenChat}
            icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>}
          />
          <ActionBtn label="Звук" onClick={() => toast('Настройки звука', { icon: '🔔' })}
            icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5" />
            </svg>}
          />
          {onCall && (
            <ActionBtn label="Звонок" onClick={() => { onCall('voice'); onClose() }}
              icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>}
            />
          )}
          <div className="relative">
            <ActionBtn label="Ещё" onClick={() => setShowMoreMenu((v) => !v)}
              icon={<svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <circle cx="5" cy="12" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="19" cy="12" r="1.5" />
              </svg>}
            />
            {showMoreMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowMoreMenu(false)} />
                <div className="absolute bottom-full right-0 mb-1 z-50
                  bg-white dark:bg-[#2c2c2e] rounded-2xl shadow-2xl py-1.5 min-w-[180px]
                  border border-black/5 dark:border-white/5 animate-scaleIn origin-bottom-right">
                  <button onClick={handleBlock}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-500
                      hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-left">
                    <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                    </svg>
                    {blocked ? 'Разблокировать' : 'Заблокировать'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Info rows */}
        <div className="divide-y divide-black/5 dark:divide-white/5">
          {profile?.bio && (
            <InfoRow>
              <p className="text-sm text-gray-700 dark:text-gray-200 leading-relaxed">{profile.bio}</p>
              <p className="text-[10px] text-gray-400 mt-0.5">О себе</p>
            </InfoRow>
          )}

          {profile?.numeric_id != null && (
            <InfoRow>
              <p className="text-sm text-primary-500 font-medium">
                {String(profile.numeric_id).replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0')}
              </p>
              <p className="text-[10px] text-gray-400 mt-0.5">ID</p>
            </InfoRow>
          )}

          {profile?.username && (
            <InfoRow>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-primary-500 font-medium">@{profile.username}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">Имя пользователя</p>
                </div>
                <button
                  onClick={() => navigator.clipboard.writeText(`@${profile.username}`).then(() => toast.success('Скопировано'))}
                  className="w-8 h-8 flex items-center justify-center rounded-xl
                    hover:bg-black/5 dark:hover:bg-white/8 transition-colors">
                  <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </button>
              </div>
            </InfoRow>
          )}

          {/* Add contact */}
          <button
            onClick={() => toast('Контакт добавлен', { icon: '✅' })}
            className="w-full flex items-center px-5 py-3.5 gap-3
              hover:bg-black/4 dark:hover:bg-white/4 transition-colors text-left">
            <svg className="w-5 h-5 text-primary-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
            </svg>
            <span className="text-sm font-semibold text-primary-500 uppercase tracking-wide">
              Добавить контакт
            </span>
          </button>
        </div>

        {/* Media stats */}
        {privateChatId && (
          <div className="border-t border-black/5 dark:border-white/5">
            <MediaStatRow
              label={`${photoCount} фотографий`}
              icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>}
            />
            <MediaStatRow
              label={`${videoCount} видео`}
              icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>}
            />
            <MediaStatRow
              label={`${sharedFiles.length} файлов`}
              icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>}
            />
            <MediaStatRow
              label={`${voiceCount} голосовых сообщений`}
              icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>}
            />
            <MediaStatRow
              label={`${gifCount} GIF`}
              icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>}
            />
          </div>
        )}

        {/* Block */}
        <div className="border-t border-black/5 dark:border-white/5">
          <button
            onClick={handleBlock}
            className="w-full flex items-center gap-3 px-5 py-4
              hover:bg-red-50 dark:hover:bg-red-900/15 transition-colors text-left">
            <svg className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
            </svg>
            <span className="text-sm font-medium text-red-500">
              {blocked ? 'Разблокировать' : 'Заблокировать'}
            </span>
          </button>
        </div>
      </div>
    </div>
  )
}

function ActionBtn({ label, onClick, icon }: { label: string; onClick: () => void; icon: React.ReactNode }) {
  return (
    <button onClick={onClick}
      className="flex flex-col items-center gap-1.5 px-3 py-2.5 rounded-2xl
        text-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/20
        active:scale-95 transition-all min-w-[60px]">
      {icon}
      <span className="text-[10px] font-medium">{label}</span>
    </button>
  )
}

function InfoRow({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-5 py-3.5">{children}</div>
  )
}

function MediaStatRow({ label, icon }: { label: string; icon: React.ReactNode }) {
  return (
    <div className="flex items-center gap-4 px-5 py-3
      hover:bg-black/4 dark:hover:bg-white/4 transition-colors cursor-default
      border-b border-black/5 dark:border-white/5 last:border-0">
      <span className="text-gray-400 flex-shrink-0">{icon}</span>
      <span className="text-sm text-gray-700 dark:text-gray-200">{label}</span>
    </div>
  )
}
