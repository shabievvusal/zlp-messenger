import { useEffect, useRef, useState, useCallback } from 'react'
import { useChatStore } from '@/store/chat'
import { useAuthStore } from '@/store/auth'
import { MessageBubble } from './MessageBubble'
import { DateDivider } from './DateDivider'
import { useChatCtx } from '@/contexts/ChatContext'
import { format, isSameDay, differenceInMinutes } from 'date-fns'
import { ru } from 'date-fns/locale'
import type { ChatType } from '@/types'

interface Props {
  chatId: string
  chatType: ChatType
  onLoadMore: () => void
}

// Per-chat scroll state saved across switches
interface ScrollState {
  scrollTop: number
  nearBottom: boolean
}

export function MessageList({ chatId, chatType, onLoadMore }: Props) {
  const messages = useChatStore((s) => s.messages[chatId] ?? [])
  const currentUser = useAuthStore((s) => s.user)
  const { highlightMsgId, setHighlightMsgId } = useChatCtx()
  const containerRef = useRef<HTMLDivElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const prevLenRef = useRef(0)
  const [showScrollBtn, setShowScrollBtn] = useState(false)

  // Persists scroll positions for all chats across switches (key = chatId)
  const scrollStates = useRef<Map<string, ScrollState>>(new Map())

  // When switching chats: save old position (via handleScroll) and restore new one
  useEffect(() => {
    setShowScrollBtn(false)

    const state = scrollStates.current.get(chatId)

    if (!state || state.nearBottom) {
      // First visit to this chat, or user was near the bottom — go to bottom.
      // Reset prevLen so the messages.length effect sees "initial load" and also scrolls.
      prevLenRef.current = 0
      requestAnimationFrame(() => {
        bottomRef.current?.scrollIntoView()
      })
    } else {
      // User was reading old messages — restore their exact position.
      // Set prevLen to current count so the messages.length effect doesn't overwrite us.
      prevLenRef.current = messages.length
      requestAnimationFrame(() => {
        if (containerRef.current) {
          containerRef.current.scrollTop = state.scrollTop
        }
      })
    }
  }, [chatId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-scroll on new messages (only relevant while inside the same chat)
  useEffect(() => {
    const added = messages.length - prevLenRef.current
    if (added === 1) {
      const last = messages[messages.length - 1]
      const isOwn = last?.sender_id === currentUser?.id
      if (isOwn || !showScrollBtn) {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
      }
    } else if (added > 1 && prevLenRef.current === 0) {
      // Initial load — jump to bottom instantly
      bottomRef.current?.scrollIntoView()
    }
    prevLenRef.current = messages.length
  }, [messages.length]) // eslint-disable-line react-hooks/exhaustive-deps

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

  // Track scroll position for current chat + show/hide scroll button + infinite scroll
  const handleScroll = useCallback(() => {
    const el = containerRef.current
    if (!el) return
    const fromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
    const nearBottom = fromBottom <= 300
    setShowScrollBtn(!nearBottom)
    if (el.scrollTop < 100) onLoadMore()
    // Save state so we can restore it when switching back to this chat
    scrollStates.current.set(chatId, { scrollTop: el.scrollTop, nearBottom })
  }, [onLoadMore, chatId])

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
                <MessageBubble msg={msg} isOwn={isOwn} isGrouped={isGrouped} chatType={chatType} />
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
