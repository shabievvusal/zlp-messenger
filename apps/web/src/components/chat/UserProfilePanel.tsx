import { useEffect, useState } from 'react'
import { Avatar } from '@/components/ui/Avatar'
import { usersApi } from '@/api/users'
import type { User } from '@/types'

interface Props {
  userId: string
  onClose: () => void
  onCall: (type: 'voice' | 'video') => void
}

export function UserProfilePanel({ userId, onClose, onCall }: Props) {
  const [profile, setProfile] = useState<User | null>(null)

  useEffect(() => {
    usersApi.getById(userId)
      .then(({ data }) => setProfile(data))
      .catch(() => {})
  }, [userId])

  const name = profile ? `${profile.first_name}${profile.last_name ? ' ' + profile.last_name : ''}` : '...'

  return (
    <>
      {/* Backdrop */}
      <div className="absolute inset-0 z-20" onClick={onClose} />
      {/* Panel */}
      <div className="absolute right-0 top-0 bottom-0 w-80 z-30
        bg-white/95 dark:bg-gray-800/95 backdrop-blur-md
        shadow-2xl border-l border-black/8 dark:border-white/8
        flex flex-col animate-slideInRight">

        {/* Header */}
        <div className="flex items-center gap-2 px-4 py-3
          border-b border-black/8 dark:border-white/8">
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full
            hover:bg-black/8 dark:hover:bg-white/10 transition-colors active:scale-90">
            <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <span className="font-semibold text-sm text-gray-900 dark:text-gray-100">Информация</span>
        </div>

        {/* Avatar + name */}
        <div className="flex flex-col items-center py-8 px-4 gap-3
          bg-gradient-to-b from-primary-50/50 to-transparent dark:from-primary-900/10">
          <div className="relative">
            <Avatar name={name} url={profile?.avatar_url} size={96} />
            <div className="absolute inset-0 rounded-full ring-4 ring-primary-500/20" />
          </div>
          <div className="text-center">
            <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">{name}</p>
            {profile?.username && (
              <p className="text-sm text-primary-500">@{profile.username}</p>
            )}
            <p className="text-xs text-gray-400 mt-1">был(а) недавно</p>
          </div>

          {/* Call buttons */}
          <div className="flex gap-4 mt-2">
            <button onClick={() => { onCall('voice'); onClose() }}
              className="flex flex-col items-center gap-1 px-5 py-3 rounded-2xl
                bg-primary-50 dark:bg-primary-900/20 hover:bg-primary-100 dark:hover:bg-primary-900/30
                active:scale-95 transition-all">
              <svg className="w-6 h-6 text-primary-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
              <span className="text-xs text-primary-500 font-medium">Звонок</span>
            </button>
            <button onClick={() => { onCall('video'); onClose() }}
              className="flex flex-col items-center gap-1 px-5 py-3 rounded-2xl
                bg-primary-50 dark:bg-primary-900/20 hover:bg-primary-100 dark:hover:bg-primary-900/30
                active:scale-95 transition-all">
              <svg className="w-6 h-6 text-primary-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              <span className="text-xs text-primary-500 font-medium">Видео</span>
            </button>
          </div>
        </div>

        {/* Bio */}
        {profile?.bio && (
          <div className="px-4 py-3 border-t border-black/5 dark:border-white/5">
            <p className="text-[10px] text-gray-400 uppercase tracking-widest mb-1.5 font-medium">О себе</p>
            <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{profile.bio}</p>
          </div>
        )}

        {/* Username */}
        {profile?.username && (
          <div className="px-4 py-3 border-t border-black/5 dark:border-white/5">
            <p className="text-[10px] text-gray-400 uppercase tracking-widest mb-1.5 font-medium">Имя пользователя</p>
            <p className="text-sm text-primary-500 font-medium">@{profile.username}</p>
          </div>
        )}
      </div>
    </>
  )
}
