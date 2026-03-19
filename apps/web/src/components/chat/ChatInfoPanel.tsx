import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { addHours, addDays, addWeeks } from 'date-fns'
import type { Chat, ChatMember, Attachment, User } from '@/types'
import { chatApi } from '@/api/chat'
import { usersApi } from '@/api/users'
import { useChatStore } from '@/store/chat'
import { useAuthStore } from '@/store/auth'
import { Avatar } from '@/components/ui/Avatar'
import { UserProfilePanel } from './UserProfilePanel'
import { GroupSettingsPanel } from './GroupSettingsPanel'
import { mediaUrl } from '@/utils/media'

interface Props {
  chat: Chat
  onClose: () => void
  onCall: (type: 'voice' | 'video') => void
}

const MUTE_OPTIONS = [
  { label: '1 час', getUntil: () => addHours(new Date(), 1).toISOString() },
  { label: '8 часов', getUntil: () => addHours(new Date(), 8).toISOString() },
  { label: '1 день', getUntil: () => addDays(new Date(), 1).toISOString() },
  { label: '1 неделю', getUntil: () => addWeeks(new Date(), 1).toISOString() },
  { label: 'Навсегда', getUntil: () => '2099-01-01T00:00:00Z' },
]

export function ChatInfoPanel({ chat, onClose, onCall }: Props) {
  const navigate = useNavigate()
  const isPrivate = chat.type === 'private'
  const isGroup = chat.type === 'group' || chat.type === 'channel'

  const currentUser = useAuthStore((s) => s.user)
  const [profile, setProfile] = useState<User | null>(null)
  const [members, setMembers] = useState<ChatMember[]>([])
  const [sharedMedia, setSharedMedia] = useState<Attachment[]>([])
  const [sharedFiles, setSharedFiles] = useState<Attachment[]>([])
  const [activeTab, setActiveTab] = useState<'media' | 'files'>('media')
  const [showMuteMenu, setShowMuteMenu] = useState(false)
  const [muteLoading, setMuteLoading] = useState(false)
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null)
  const [showMoreMenu, setShowMoreMenu] = useState(false)
  const [showGroupSettings, setShowGroupSettings] = useState(false)
  const [showAddMember, setShowAddMember] = useState(false)
  const [addSearch, setAddSearch] = useState('')
  const [addResults, setAddResults] = useState<User[]>([])
  const mutedChats = useChatStore((s) => s.mutedChats)
  const setChatMuted = useChatStore((s) => s.setChatMuted)
  const isOnline = useChatStore((s) => s.isOnline)
  const removeChat = useChatStore((s) => s.removeChat)

  const mutedUntil = mutedChats[chat.id]
  const isMuted = !!mutedUntil && new Date(mutedUntil) > new Date()

  const myMember = members.find((m) => m.user_id === currentUser?.id)
  const isOwner = myMember?.role === 'owner'
  const isAdmin = myMember?.role === 'admin' || isOwner

  useEffect(() => {
    if (isPrivate && chat.peer_user_id) {
      usersApi.getById(chat.peer_user_id)
        .then(({ data }) => setProfile(data))
        .catch(() => {})
    }
    if (isGroup) {
      chatApi.getMembers(chat.id)
        .then(({ data }) => setMembers(data ?? []))
        .catch(() => {})
    }
    chatApi.getSharedMedia(chat.id, 'photo')
      .then(({ data }) => setSharedMedia(data ?? []))
      .catch(() => {})
    chatApi.getSharedMedia(chat.id, 'document')
      .then(({ data }) => setSharedFiles(data ?? []))
      .catch(() => {})
  }, [chat.id])

  // Search for users to add
  useEffect(() => {
    if (!addSearch.trim()) { setAddResults([]); return }
    const timer = setTimeout(async () => {
      try {
        const { data } = await usersApi.search(addSearch)
        const memberIds = new Set(members.map((m) => m.user_id))
        setAddResults((data ?? []).filter((u: User) => !memberIds.has(u.id)))
      } catch { setAddResults([]) }
    }, 300)
    return () => clearTimeout(timer)
  }, [addSearch, members])

  const handleMute = async (until: string) => {
    setMuteLoading(true)
    try {
      await chatApi.muteChat(chat.id, until)
      setChatMuted(chat.id, until)
    } catch { /* ignore */ }
    finally { setMuteLoading(false); setShowMuteMenu(false) }
  }

  const handleUnmute = async () => {
    setMuteLoading(true)
    try {
      await chatApi.muteChat(chat.id, null)
      setChatMuted(chat.id, null)
    } catch { /* ignore */ }
    finally { setMuteLoading(false) }
  }

  const handleLeave = async () => {
    if (!confirm('Покинуть группу?')) return
    try {
      await chatApi.leaveChat(chat.id)
      removeChat(chat.id)
      onClose()
      navigate('/')
    } catch { /* ignore */ }
  }

  const handleKick = async (userId: string) => {
    try {
      await chatApi.kickMember(chat.id, userId)
      setMembers((prev) => prev.filter((m) => m.user_id !== userId))
    } catch { /* ignore */ }
  }

  const handleAddMember = async (userId: string) => {
    try {
      await chatApi.addMember(chat.id, userId)
      // Refresh members
      const { data } = await chatApi.getMembers(chat.id)
      setMembers(data ?? [])
      setShowAddMember(false)
      setAddSearch('')
    } catch { /* ignore */ }
  }

  const formatFileSize = (bytes: number) => {
    if (!bytes) return ''
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const name = isPrivate && profile
    ? `${profile.first_name}${profile.last_name ? ' ' + profile.last_name : ''}`
    : chat.title ?? 'Чат'

  // Nested: group settings
  if (showGroupSettings && isGroup) {
    return (
      <GroupSettingsPanel
        chat={chat}
        members={members}
        onClose={onClose}
        onBack={() => setShowGroupSettings(false)}
      />
    )
  }

  // Nested: member profile
  if (selectedMemberId) {
    return (
      <UserProfilePanel
        userId={selectedMemberId}
        onClose={() => setSelectedMemberId(null)}
        onCall={(type) => { onCall(type); setSelectedMemberId(null) }}
      />
    )
  }

  // Nested: add member search
  if (showAddMember) {
    return (
      <>
        <div className="absolute inset-0 z-20" onClick={() => setShowAddMember(false)} />
        <div className="absolute right-0 top-0 bottom-0 w-80 z-30
          bg-white dark:bg-gray-900
          shadow-2xl border-l border-black/8 dark:border-white/8
          flex flex-col animate-slideInRight">
          <div className="flex items-center gap-2 px-3 py-3 border-b border-black/8 dark:border-white/8 flex-shrink-0">
            <button onClick={() => setShowAddMember(false)}
              className="w-8 h-8 flex items-center justify-center rounded-full
                hover:bg-black/8 dark:hover:bg-white/10 transition-colors">
              <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <span className="font-semibold text-sm text-gray-900 dark:text-gray-100">Добавить участника</span>
          </div>
          <div className="px-3 py-2 border-b border-black/8 dark:border-white/8">
            <input
              autoFocus
              value={addSearch}
              onChange={(e) => setAddSearch(e.target.value)}
              placeholder="Поиск пользователей..."
              className="w-full bg-black/5 dark:bg-white/8 rounded-xl px-3 py-2
                text-sm text-gray-900 dark:text-gray-100
                placeholder:text-gray-400 outline-none"
            />
          </div>
          <div className="flex-1 overflow-y-auto scrollbar-thin">
            {addResults.map((u) => {
              const uName = `${u.first_name}${u.last_name ? ' ' + u.last_name : ''}`
              return (
                <button key={u.id}
                  onClick={() => handleAddMember(u.id)}
                  className="w-full flex items-center gap-3 px-4 py-2.5
                    hover:bg-black/5 dark:hover:bg-white/5 transition-colors text-left">
                  <Avatar name={uName} url={u.avatar_url} size={36} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{uName}</p>
                    {u.username && (
                      <p className="text-xs text-gray-400 truncate">@{u.username}</p>
                    )}
                  </div>
                  <svg className="w-5 h-5 text-primary-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </button>
              )
            })}
            {addSearch && addResults.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-8">Пользователи не найдены</p>
            )}
            {!addSearch && (
              <p className="text-sm text-gray-400 text-center py-8">Введите имя или @username</p>
            )}
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <div className="absolute inset-0 z-20" onClick={onClose} />
      <div className="absolute right-0 top-0 bottom-0 w-80 z-30
        bg-white dark:bg-gray-900
        shadow-2xl border-l border-black/8 dark:border-white/8
        flex flex-col animate-slideInRight">

        {/* Hero — full bleed with gradient */}
        <div className="relative flex-shrink-0">
          {/* Close button */}
          <button onClick={onClose}
            className="absolute top-3 left-3 z-10 w-8 h-8 flex items-center justify-center
              rounded-full bg-black/20 hover:bg-black/30 transition-colors backdrop-blur-sm">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* More menu button (top right, group only) */}
          {isGroup && (
            <div className="absolute top-3 right-3 z-10">
              <button onClick={() => setShowMoreMenu((v) => !v)}
                className="w-8 h-8 flex items-center justify-center
                  rounded-full bg-black/20 hover:bg-black/30 transition-colors backdrop-blur-sm">
                <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <circle cx="5" cy="12" r="1.5" />
                  <circle cx="12" cy="12" r="1.5" />
                  <circle cx="19" cy="12" r="1.5" />
                </svg>
              </button>
              {showMoreMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowMoreMenu(false)} />
                  <div className="absolute top-full right-0 mt-1 z-50
                    bg-white dark:bg-gray-800 rounded-2xl shadow-2xl py-1.5 min-w-[220px]
                    border border-black/5 dark:border-white/5 animate-scaleIn origin-top-right">
                    {isAdmin && (
                      <MoreMenuItem
                        label="Управление группой"
                        onClick={() => { setShowMoreMenu(false); setShowGroupSettings(true) }}
                        icon={
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                        }
                      />
                    )}
                    {isAdmin && (
                      <MoreMenuItem
                        label="Добавить участников"
                        onClick={() => { setShowMoreMenu(false); setShowAddMember(true) }}
                        icon={
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                          </svg>
                        }
                      />
                    )}
                    <MoreMenuItem
                      label="Экспорт истории чата"
                      onClick={() => setShowMoreMenu(false)}
                      icon={
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                      }
                    />
                    <div className="my-1 border-t border-black/5 dark:border-white/5" />
                    <MoreMenuItem
                      label="Покинуть группу"
                      onClick={() => { setShowMoreMenu(false); handleLeave() }}
                      danger
                      icon={
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                        </svg>
                      }
                    />
                  </div>
                </>
              )}
            </div>
          )}

          {/* Hero background */}
          <div className="h-48 bg-gradient-to-br from-primary-500 to-primary-700 relative overflow-hidden">
            {(isPrivate ? profile?.avatar_url : chat.avatar_url) && (
              <img
                src={mediaUrl(isPrivate ? profile!.avatar_url! : chat.avatar_url!)}
                alt=""
                className="w-full h-full object-cover opacity-60"
              />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
          </div>

          {/* Avatar + name overlaid at bottom of hero */}
          <div className="absolute bottom-0 left-0 right-0 px-4 pb-4 flex items-end gap-3">
            <div className="relative flex-shrink-0">
              <Avatar
                name={name}
                url={isPrivate ? profile?.avatar_url : chat.avatar_url}
                size={64}
              />
              {isPrivate && chat.peer_user_id && isOnline(chat.peer_user_id) && (
                <span className="absolute bottom-0.5 right-0.5 w-3 h-3 bg-green-500
                  rounded-full border-2 border-white" />
              )}
            </div>
            <div className="flex-1 min-w-0 pb-0.5">
              <p className="text-white font-semibold text-base leading-tight truncate drop-shadow">{name}</p>
              <p className="text-white/70 text-xs mt-0.5">
                {isPrivate
                  ? (chat.peer_user_id && isOnline(chat.peer_user_id) ? 'в сети' : 'был(а) недавно')
                  : `${members.length || chat.members_count} участников`}
              </p>
            </div>
          </div>
        </div>

        {/* Action buttons row */}
        <div className="flex items-center justify-around px-2 py-3
          border-b border-black/8 dark:border-white/8 flex-shrink-0">
          {isPrivate && (
            <>
              <ActionBtn
                onClick={() => { onCall('voice'); onClose() }}
                label="Звонок"
                icon={
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                }
              />
              <ActionBtn
                onClick={() => { onCall('video'); onClose() }}
                label="Видео"
                icon={
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.361a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                }
              />
            </>
          )}
          {/* Mute button with dropdown */}
          <div className="relative">
            <ActionBtn
              onClick={() => isMuted ? handleUnmute() : setShowMuteMenu((v) => !v)}
              label={isMuted ? 'Вкл. звук' : 'Звук'}
              loading={muteLoading}
              icon={isMuted
                ? <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15zM17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                  </svg>
                : <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072M12 6v12m0 0l-4-4m4 4l4-4M9.172 16.172a4 4 0 010-5.656M5.636 12.364a9 9 0 0112.728 0" />
                  </svg>
              }
            />
            {showMuteMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowMuteMenu(false)} />
                <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 z-50
                  bg-white dark:bg-gray-800 rounded-2xl shadow-2xl py-2 min-w-[160px]
                  border border-black/5 dark:border-white/5 animate-scaleIn origin-bottom">
                  <p className="text-[10px] text-gray-400 uppercase tracking-widest px-4 py-1.5 font-medium">
                    Выключить на...
                  </p>
                  {MUTE_OPTIONS.map((opt) => (
                    <button key={opt.label}
                      onClick={() => handleMute(opt.getUntil())}
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300
                        hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                      {opt.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {isGroup && isAdmin && (
            <ActionBtn
              onClick={() => setShowGroupSettings(true)}
              label="Управление"
              icon={
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              }
            />
          )}

          {isGroup && (
            <ActionBtn
              onClick={handleLeave}
              label="Покинуть"
              danger
              icon={
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              }
            />
          )}
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto scrollbar-thin">

          {/* Info rows */}
          {isPrivate && profile?.bio && (
            <InfoRow label="О себе" value={profile.bio} />
          )}
          {isPrivate && profile?.username && (
            <InfoRow label="Имя пользователя" value={`@${profile.username}`} highlight />
          )}
          {isPrivate && profile?.numeric_id != null && (
            <InfoRow label="ID" value={String(profile.numeric_id).replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0')} highlight />
          )}
          {isGroup && chat.description && (
            <InfoRow label="Описание" value={chat.description} />
          )}
          {isGroup && chat.username && (
            <InfoRow label="Ссылка" value={`@${chat.username}`} highlight />
          )}
          {isGroup && chat.numeric_id != null && (
            <InfoRow label="ID" value={`-100${chat.numeric_id}`} highlight />
          )}

          {/* Media stats row (group) */}
          {isGroup && (
            <div className="flex border-t border-black/5 dark:border-white/5 divide-x divide-black/5 dark:divide-white/5">
              <StatCell count={sharedMedia.filter((a) => a.type === 'photo').length} label="Фото" />
              <StatCell count={sharedMedia.filter((a) => a.type === 'video').length} label="Видео" />
              <StatCell count={sharedFiles.length} label="Файлы" />
            </div>
          )}

          {/* Members (group only) */}
          {isGroup && (
            <div className="border-t border-black/5 dark:border-white/5 pt-1">
              <div className="flex items-center justify-between px-4 py-2">
                <p className="text-[10px] text-gray-400 uppercase tracking-widest font-medium">
                  Участники ({members.length})
                </p>
                {isAdmin && (
                  <button
                    onClick={() => setShowAddMember(true)}
                    className="w-7 h-7 flex items-center justify-center rounded-full
                      hover:bg-black/8 dark:hover:bg-white/10 transition-colors text-primary-500">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                    </svg>
                  </button>
                )}
              </div>
              {members.map((m) => {
                const mName = m.user
                  ? `${m.user.first_name}${m.user.last_name ? ' ' + m.user.last_name : ''}`
                  : m.user_id
                const online = isOnline(m.user_id)
                const isMe = m.user_id === currentUser?.id
                return (
                  <div key={m.user_id} className="flex items-center group">
                    <button
                      onClick={() => !isMe && setSelectedMemberId(m.user_id)}
                      className="flex-1 flex items-center gap-3 px-4 py-2.5
                        hover:bg-black/5 dark:hover:bg-white/5 transition-colors text-left">
                      <div className="relative flex-shrink-0">
                        <Avatar name={mName} url={m.user?.avatar_url} size={38} />
                        {online && (
                          <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500
                            rounded-full border-2 border-white dark:border-gray-900" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                          {mName}{isMe ? ' (вы)' : ''}
                        </p>
                        <p className="text-xs text-gray-400 truncate">
                          {online ? 'в сети' : m.user?.username ? `@${m.user.username}` : 'был(а) недавно'}
                        </p>
                      </div>
                      {(m.role === 'owner' || m.role === 'admin') && (
                        <span className="text-[10px] font-medium text-primary-500
                          bg-primary-50 dark:bg-primary-900/20 rounded-full px-2 py-0.5 flex-shrink-0">
                          {m.role === 'owner' ? 'создатель' : 'админ'}
                        </span>
                      )}
                    </button>
                    {isAdmin && !isMe && m.role !== 'owner' && (
                      <button
                        onClick={() => handleKick(m.user_id)}
                        className="mr-3 w-7 h-7 flex items-center justify-center rounded-full
                          opacity-0 group-hover:opacity-100 transition-opacity
                          hover:bg-red-100 dark:hover:bg-red-900/30 text-red-500"
                        title="Исключить">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7a4 4 0 11-8 0 4 4 0 018 0zM9 14a6 6 0 00-6 6v1h12v-1a6 6 0 00-6-6zM21 12h-6" />
                        </svg>
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* Shared media / files */}
          <div className="border-t border-black/5 dark:border-white/5 pt-1">
            <div className="flex px-4 gap-4 py-2">
              <TabBtn active={activeTab === 'media'} onClick={() => setActiveTab('media')}>
                Медиа {sharedMedia.length > 0 && `(${sharedMedia.length})`}
              </TabBtn>
              <TabBtn active={activeTab === 'files'} onClick={() => setActiveTab('files')}>
                Файлы {sharedFiles.length > 0 && `(${sharedFiles.length})`}
              </TabBtn>
            </div>

            {activeTab === 'media' && (
              sharedMedia.length === 0
                ? <p className="text-xs text-gray-400 px-4 pb-4">Нет медиафайлов</p>
                : (
                  <div className="grid grid-cols-3 gap-0.5 px-1 pb-4">
                    {sharedMedia.map((a) => (
                      <div key={a.id}
                        className="aspect-square overflow-hidden cursor-pointer rounded-sm
                          hover:opacity-90 transition-opacity">
                        <img
                          src={mediaUrl(a.thumbnail || a.url)}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ))}
                  </div>
                )
            )}

            {activeTab === 'files' && (
              sharedFiles.length === 0
                ? <p className="text-xs text-gray-400 px-4 pb-4">Нет файлов</p>
                : (
                  <div className="px-2 pb-4 space-y-1">
                    {sharedFiles.map((a) => (
                      <a key={a.id}
                        href={mediaUrl(a.url)}
                        download={a.file_name}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-3 px-2 py-2 rounded-xl
                          hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                        <div className="w-9 h-9 rounded-xl bg-primary-100 dark:bg-primary-900/30
                          flex items-center justify-center flex-shrink-0">
                          <svg className="w-5 h-5 text-primary-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                          </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                            {a.file_name ?? 'Файл'}
                          </p>
                          <p className="text-xs text-gray-400">{formatFileSize(a.file_size ?? 0)}</p>
                        </div>
                      </a>
                    ))}
                  </div>
                )
            )}
          </div>

        </div>
      </div>
    </>
  )
}

function InfoRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="px-4 py-3 border-t border-black/5 dark:border-white/5">
      <p className="text-[10px] text-gray-400 uppercase tracking-widest mb-1 font-medium">{label}</p>
      <p className={`text-sm leading-relaxed ${highlight ? 'text-primary-500 font-medium' : 'text-gray-700 dark:text-gray-300'}`}>
        {value}
      </p>
    </div>
  )
}

function StatCell({ count, label }: { count: number; label: string }) {
  return (
    <div className="flex-1 flex flex-col items-center py-3 gap-0.5">
      <span className="text-base font-semibold text-gray-900 dark:text-gray-100">{count}</span>
      <span className="text-[10px] text-gray-400 font-medium">{label}</span>
    </div>
  )
}

function ActionBtn({
  icon, label, onClick, loading, danger,
}: { icon: React.ReactNode; label: string; onClick: () => void; loading?: boolean; danger?: boolean }) {
  return (
    <button onClick={onClick} disabled={loading}
      className={`flex flex-col items-center gap-1.5 px-3 py-2.5 rounded-2xl min-w-[60px]
        active:scale-95 transition-all disabled:opacity-50
        ${danger
          ? 'text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20'
          : 'text-primary-500 bg-primary-50 dark:bg-primary-900/20 hover:bg-primary-100 dark:hover:bg-primary-900/30'
        }`}>
      {icon}
      <span className={`text-[10px] font-medium leading-none ${danger ? 'text-red-500' : 'text-primary-500'}`}>
        {label}
      </span>
    </button>
  )
}

function MoreMenuItem({
  label, onClick, icon, danger,
}: { label: string; onClick: () => void; icon: React.ReactNode; danger?: boolean }) {
  return (
    <button onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors
        ${danger
          ? 'text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20'
          : 'text-gray-700 dark:text-gray-300 hover:bg-black/5 dark:hover:bg-white/5'
        }`}>
      <span className={danger ? 'text-red-500' : 'text-gray-400'}>{icon}</span>
      {label}
    </button>
  )
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      className={`text-sm font-medium pb-1 border-b-2 transition-colors ${
        active
          ? 'border-primary-500 text-primary-500'
          : 'border-transparent text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
      }`}>
      {children}
    </button>
  )
}
