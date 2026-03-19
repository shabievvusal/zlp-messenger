import { useState, useRef, ChangeEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/auth'
import { api } from '@/api/client'
import { Avatar } from '@/components/ui/Avatar'
import toast from 'react-hot-toast'

export function SettingsPage() {
  const navigate = useNavigate()
  const { user, setAuth, accessToken } = useAuthStore()
  const [form, setForm] = useState({
    first_name: user?.first_name ?? '',
    last_name: user?.last_name ?? '',
    bio: user?.bio ?? '',
    username: user?.username ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const update = (key: string, val: string) => setForm((f) => ({ ...f, [key]: val }))

  const handleSave = async () => {
    setSaving(true)
    try {
      const { data } = await api.patch('/users/me', form)
      setAuth(data, accessToken!)
      toast.success('Профиль обновлён')
    } catch {
      toast.error('Не удалось обновить профиль')
    } finally {
      setSaving(false)
    }
  }

  const handleAvatarUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingAvatar(true)
    const formData = new FormData()
    formData.append('file', file)
    try {
      const { data } = await api.post('/media/avatar', formData)
      if (user) setAuth({ ...user, avatar_url: data.avatar_url }, accessToken!)
      toast.success('Аватар обновлён')
    } catch {
      toast.error('Не удалось загрузить аватар')
    } finally {
      setUploadingAvatar(false)
      e.target.value = ''
    }
  }

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900 animate-fadeIn">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3
        bg-white/80 dark:bg-gray-900/80 backdrop-blur-md
        border-b border-black/8 dark:border-white/8 shadow-sm">
        <button
          onClick={() => navigate('/')}
          className="icon-btn active:scale-90"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="font-semibold text-gray-900 dark:text-gray-100">Настройки</h1>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {/* Avatar */}
        <div className="flex flex-col items-center py-10
          bg-gradient-to-b from-primary-50/60 to-transparent
          dark:from-primary-900/10 dark:to-transparent">
          <div className="relative cursor-pointer group" onClick={() => fileRef.current?.click()}>
            <Avatar
              name={`${user?.first_name} ${user?.last_name ?? ''}`}
              url={user?.avatar_url}
              size={96}
            />
            <div className="absolute inset-0 rounded-full bg-black/40 flex items-center
              justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              {uploadingAvatar
                ? <div className="spinner border-white" />
                : <span className="text-white text-xl">📷</span>
              }
            </div>
            <div className="absolute inset-0 rounded-full ring-4 ring-primary-500/20" />
          </div>
          <input ref={fileRef} type="file" className="hidden"
            accept="image/*" onChange={handleAvatarUpload} />
          <p className="mt-4 text-lg font-semibold text-gray-900 dark:text-gray-100">
            {user?.first_name} {user?.last_name}
          </p>
          <p className="text-sm text-primary-500 mt-0.5">@{user?.username}</p>
        </div>

        {/* Fields */}
        <div className="px-4 py-6 space-y-4 max-w-md mx-auto w-full">
          {[
            { label: 'Имя', key: 'first_name', required: true },
            { label: 'Фамилия', key: 'last_name' },
            { label: 'Имя пользователя', key: 'username', required: true, prefix: '@' },
            { label: 'О себе', key: 'bio', multiline: true },
          ].map(({ label, key, required, prefix, multiline }) => (
            <div key={key}>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                {label} {required && <span className="text-red-400 text-xs">*</span>}
              </label>
              {multiline ? (
                <textarea
                  value={form[key as keyof typeof form]}
                  onChange={(e) => update(key, e.target.value)}
                  rows={3}
                  placeholder={`${label}...`}
                  className="input-base resize-none"
                />
              ) : (
                <div className="relative">
                  {prefix && (
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm select-none">{prefix}</span>
                  )}
                  <input
                    type="text"
                    value={form[key as keyof typeof form]}
                    onChange={(e) => update(key, e.target.value)}
                    className={`input-base ${prefix ? 'pl-7' : ''}`}
                  />
                </div>
              )}
            </div>
          ))}

          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full py-3 bg-primary-500 hover:bg-primary-600 active:bg-primary-700
              text-white font-semibold rounded-xl
              transition-all duration-150 active:scale-[0.98]
              disabled:opacity-50 disabled:cursor-not-allowed
              shadow-md shadow-primary-500/25 mt-2"
          >
            {saving ? (
              <span className="flex items-center justify-center gap-2">
                <span className="spinner" /> Сохранение...
              </span>
            ) : 'Сохранить изменения'}
          </button>
        </div>
      </div>
    </div>
  )
}
