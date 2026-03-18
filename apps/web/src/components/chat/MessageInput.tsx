import { useState, useRef, KeyboardEvent, ChangeEvent } from 'react'
import { chatApi } from '@/api/chat'
import { useChatStore } from '@/store/chat'
import { useWebSocket } from '@/hooks/useWebSocket'
import { useAuthStore } from '@/store/auth'
import toast from 'react-hot-toast'

interface Props {
  chatId: string
}

export function MessageInput({ chatId }: Props) {
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const { addMessage } = useChatStore()
  const { sendTyping, sendStopTyping } = useWebSocket()
  const user = useAuthStore((s) => s.user)
  const typingTimerRef = useRef<ReturnType<typeof setTimeout>>()
  const fileRef = useRef<HTMLInputElement>(null)

  const handleSend = async () => {
    const trimmed = text.trim()
    if (!trimmed || sending) return

    setSending(true)
    setText('')
    sendStopTyping(chatId)

    try {
      const { data } = await chatApi.sendMessage(chatId, { text: trimmed, type: 'text' })
      // Optimistic: add with sender info
      addMessage({ ...data, sender: user ?? undefined })
    } catch {
      toast.error('Failed to send message')
      setText(trimmed)
    } finally {
      setSending(false)
    }
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value)
    sendTyping(chatId)
    clearTimeout(typingTimerRef.current)
    typingTimerRef.current = setTimeout(() => sendStopTyping(chatId), 3000)
  }

  const handleFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const formData = new FormData()
    formData.append('file', file)
    formData.append('chat_id', chatId)

    try {
      const res = await fetch('/api/media/upload', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${useAuthStore.getState().accessToken}`,
        },
        body: formData,
      })
      if (!res.ok) throw new Error()
      const data = await res.json()
      if (data.message) addMessage({ ...data.message, sender: user ?? undefined })
    } catch {
      toast.error('Upload failed')
    }

    e.target.value = ''
  }

  return (
    <div className="flex items-end gap-2 px-4 py-3
      bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">

      {/* Attach file */}
      <button
        onClick={() => fileRef.current?.click()}
        className="w-9 h-9 rounded-full flex items-center justify-center
          text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition flex-shrink-0"
        title="Attach file"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
        </svg>
      </button>
      <input ref={fileRef} type="file" className="hidden" onChange={handleFile}
        accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.zip" />

      {/* Text area */}
      <div className="flex-1 relative">
        <textarea
          value={text}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder="Write a message..."
          rows={1}
          className="w-full px-4 py-2.5 bg-gray-100 dark:bg-gray-700 rounded-full
            text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400
            resize-none max-h-32 overflow-y-auto focus:outline-none
            scrollbar-hide leading-5"
          style={{ minHeight: '40px' }}
        />
      </div>

      {/* Emoji button (placeholder) */}
      <button
        className="w-9 h-9 rounded-full flex items-center justify-center
          text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition flex-shrink-0"
        title="Emoji"
      >
        <span className="text-xl">😊</span>
      </button>

      {/* Send / Voice */}
      {text.trim() ? (
        <button
          onClick={handleSend}
          disabled={sending}
          className="w-9 h-9 rounded-full bg-primary-500 hover:bg-primary-600
            flex items-center justify-center transition flex-shrink-0
            disabled:opacity-50"
        >
          <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
          </svg>
        </button>
      ) : (
        <button
          className="w-9 h-9 rounded-full flex items-center justify-center
            text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition flex-shrink-0"
          title="Voice message"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
          </svg>
        </button>
      )}
    </div>
  )
}
