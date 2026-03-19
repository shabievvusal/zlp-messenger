import { useState } from 'react'
import { useChatStore } from '@/store/chat'
import { chatApi } from '@/api/chat'
import { Avatar } from '@/components/ui/Avatar'
import type { Message } from '@/types'
import toast from 'react-hot-toast'

interface Props {
  messages: Message[]
  onClose: () => void
}

export function ForwardModal({ messages, onClose }: Props) {
  const chats = useChatStore((s) => s.chats)
  const addMessage = useChatStore((s) => s.addMessage)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)

  const filtered = chats.filter((c) =>
    (c.title ?? '').toLowerCase().includes(search.toLowerCase())
  )

  const handleForward = async (targetChatId: string) => {
    setLoading(true)
    try {
      for (const msg of messages) {
        const { data } = await chatApi.forwardMessage(targetChatId, msg.id)
        // Add locally if forwarding to current chat
        if (data?.id) addMessage(data)
      }
      const targetTitle = chats.find((c) => c.id === targetChatId)?.title ?? 'чат'
      toast.success(`Переслано в «${targetTitle}»`)
      onClose()
    } catch {
      toast.error('Не удалось переслать сообщение')
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
        <div className="px-5 pt-5 pb-3">
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-3">
            Переслать {messages.length > 1 ? `${messages.length} сообщения` : 'сообщение'}
          </h2>
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
              fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              autoFocus
              type="text"
              placeholder="Поиск чата..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input-base pl-9 text-sm"
            />
          </div>
        </div>

        {/* Chat list */}
        <div className="max-h-72 overflow-y-auto scrollbar-thin">
          {filtered.length === 0 && (
            <p className="text-center text-gray-400 text-sm py-6">Чаты не найдены</p>
          )}
          {filtered.map((chat) => (
            <button
              key={chat.id}
              onClick={() => handleForward(chat.id)}
              disabled={loading}
              className="w-full flex items-center gap-3 px-5 py-3
                hover:bg-black/5 dark:hover:bg-white/5
                active:bg-black/8 transition-colors text-left disabled:opacity-50"
            >
              <Avatar name={chat.title ?? '?'} url={chat.avatar_url} size={42} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                  {chat.title ?? 'Чат'}
                </p>
                {chat.type === 'private' && (
                  <p className="text-xs text-gray-400 truncate">Личный чат</p>
                )}
                {chat.type === 'group' && (
                  <p className="text-xs text-gray-400 truncate">{chat.members_count} участников</p>
                )}
              </div>
            </button>
          ))}
        </div>

        <div className="px-5 pb-4 pt-1">
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
