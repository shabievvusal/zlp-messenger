import { useEffect, useRef, useState, useCallback } from 'react'
import { useChatStore } from '@/store/chat'
import { useAuthStore } from '@/store/auth'
import { MessageBubble } from './MessageBubble'
import { DateDivider } from './DateDivider'
import { useChatCtx } from '@/contexts/ChatContext'
import { format, isSameDay, differenceInMinutes } from 'date-fns'
import { ru } from 'date-fns/locale'
import type { Message } from '@/types'

interface Props {
  chatId: string
  onLoadMore: () => void
}

export function MessageList({ chatId, onLoadMore }: Props) {
  const messages = useChatStore((s) => s.messages[chatId] ?? [])
  const currentUser = useAuthStore((s) => s.user)
  const { highlightMsgId, setHighlightMsgId } = useChatCtx()
  const containerRef = useRef<HTMLDivElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const prevLenRef = useRef(0)
  const [showScrollBtn, setShowScrollBtn] = useState(false)

  // Auto scroll to bottom on new message
  useEffect(() => {
    const added = messages.length - prevLenRef.current
    if (added === 1) {
      const last = messages[messages.length - 1]
      const isOwn = last?.sender_id === currentUser?.id
      if (isOwn || !showScrollBtn) {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
      }
    } else if (added > 1 && prevLenRef.current === 0) {
      // Initial load — scroll to bottom instantly
      bottomRef.current?.scrollIntoView()
    }
    prevLenRef.current = messages.length
  }, [messages.length])

  // Scroll-to and highlight message (from search)
  useEffect(() => {
    if (!highlightMsgId) return
    const container = containerRef.current
    if (!container) return
    const el = container.querySelector(`[data-msgid="${highlightMsgId}"]`) as HTMLElement | null
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      el.classList.add('msg-highlight')
      setTimeout(() => el.classList.remove('msg-highlight'), 2000)
    }
    setHighlightMsgId(null)
  }, [highlightMsgId])

  // Show scroll-to-bottom button + infinite scroll
  const handleScroll = useCallback(() => {
    const el = containerRef.current
    if (!el) return
    const fromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
    setShowScrollBtn(fromBottom > 300)
    if (el.scrollTop < 100) onLoadMore()
  }, [onLoadMore])

  const scrollToBottom = () => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    setShowScrollBtn(false)
  }

  return (
    <div className="relative flex-1 overflow-hidden">
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="h-full overflow-y-auto py-4 px-4 space-y-0.5 scrollbar-thin flex flex-col"
      >
        {messages.map((msg, idx) => {
          const prev = messages[idx - 1]
          const showDate = !prev || !isSameDay(new Date(msg.created_at), new Date(prev.created_at))
          const isOwn = msg.sender_id === currentUser?.id

          const isGrouped = !showDate &&
            msg.type !== 'service' &&
            !!prev &&
            prev.type !== 'service' &&
            prev.sender_id === msg.sender_id &&
            differenceInMinutes(new Date(msg.created_at), new Date(prev.created_at)) < 5

          return (
            <div key={msg.id} data-msgid={msg.id}>
              {showDate && (
                <DateDivider date={format(new Date(msg.created_at), 'd MMMM yyyy', { locale: ru })} />
              )}
              <div className={isGrouped ? 'mt-0.5' : 'mt-3'}>
                <MessageBubble msg={msg} isOwn={isOwn} isGrouped={isGrouped} />
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} className="h-1" />
      </div>

      {/* Scroll to bottom FAB */}
      {showScrollBtn && (
        <button
          onClick={scrollToBottom}
          className="absolute bottom-4 right-4 w-10 h-10 rounded-full
            bg-white/90 dark:bg-gray-700/90 backdrop-blur-sm shadow-lg
            flex items-center justify-center animate-popIn
            hover:bg-white dark:hover:bg-gray-600 active:scale-90
            transition-all border border-black/8 dark:border-white/8"
        >
          <svg className="w-5 h-5 text-gray-600 dark:text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      )}
    </div>
  )
}
