import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { chatApi } from '@/api/chat'
import { useChatStore } from '@/store/chat'
import toast from 'react-hot-toast'

interface Props {
  onClose: () => void
}

export function NewChatModal({ onClose }: Props) {
  const navigate = useNavigate()
  const upsertChat = useChatStore((s) => s.upsertChat)
  const setActiveChat = useChatStore((s) => s.setActiveChat)

  const [tab, setTab] = useState<'private' | 'group'>('private')
  const [targetId, setTargetId] = useState('')
  const [groupTitle, setGroupTitle] = useState('')
  const [loading, setLoading] = useState(false)

  const handlePrivate = async () => {
    if (!targetId.trim()) return
    setLoading(true)
    try {
      const { data } = await chatApi.createPrivate(targetId.trim())
      upsertChat(data)
      setActiveChat(data.id)
      navigate(`/chat/${data.id}`)
      onClose()
    } catch {
      toast.error('User not found')
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
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full max-w-sm shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">New Chat</h2>

        {/* Tabs */}
        <div className="flex rounded-lg bg-gray-100 dark:bg-gray-700 p-1 mb-4">
          {(['private', 'group'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-1.5 text-sm font-medium rounded-md transition ${
                tab === t
                  ? 'bg-white dark:bg-gray-600 shadow text-gray-900 dark:text-white'
                  : 'text-gray-500 dark:text-gray-400'
              }`}
            >
              {t === 'private' ? 'Private' : 'Group'}
            </button>
          ))}
        </div>

        {tab === 'private' ? (
          <div className="space-y-3">
            <input
              type="text"
              placeholder="User ID or @username"
              value={targetId}
              onChange={(e) => setTargetId(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg
                bg-white dark:bg-gray-700 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            <button
              onClick={handlePrivate}
              disabled={loading || !targetId.trim()}
              className="w-full py-2 bg-primary-600 text-white rounded-lg font-medium
                hover:bg-primary-700 disabled:opacity-50 transition"
            >
              {loading ? 'Opening...' : 'Open Chat'}
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <input
              type="text"
              placeholder="Group name"
              value={groupTitle}
              onChange={(e) => setGroupTitle(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg
                bg-white dark:bg-gray-700 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            <button
              onClick={handleGroup}
              disabled={loading || !groupTitle.trim()}
              className="w-full py-2 bg-primary-600 text-white rounded-lg font-medium
                hover:bg-primary-700 disabled:opacity-50 transition"
            >
              {loading ? 'Creating...' : 'Create Group'}
            </button>
          </div>
        )}

        <button onClick={onClose} className="mt-3 w-full py-2 text-sm text-gray-500 hover:text-gray-700">
          Cancel
        </button>
      </div>
    </div>
  )
}
