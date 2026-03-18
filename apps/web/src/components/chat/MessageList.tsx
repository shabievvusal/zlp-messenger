import { useEffect, useRef } from 'react'
import { useChatStore } from '@/store/chat'
import { useAuthStore } from '@/store/auth'
import { MessageBubble } from './MessageBubble'
import { DateDivider } from './DateDivider'
import { format, isSameDay } from 'date-fns'
import type { Message } from '@/types'

interface Props {
  chatId: string
}

export function MessageList({ chatId }: Props) {
  const messages = useChatStore((s) => s.messages[chatId] ?? [])
  const currentUser = useAuthStore((s) => s.user)
  const bottomRef = useRef<HTMLDivElement>(null)
  const prevLenRef = useRef(0)

  useEffect(() => {
    if (messages.length !== prevLenRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: messages.length - prevLenRef.current === 1 ? 'smooth' : 'instant' })
      prevLenRef.current = messages.length
    }
  }, [messages.length])

  return (
    <div className="flex-1 overflow-y-auto py-4 px-4 space-y-1 scrollbar-thin">
      {messages.map((msg, idx) => {
        const prev = messages[idx - 1]
        const showDate = !prev || !isSameDay(new Date(msg.created_at), new Date(prev.created_at))
        const isOwn = msg.sender_id === currentUser?.id

        return (
          <div key={msg.id}>
            {showDate && (
              <DateDivider date={format(new Date(msg.created_at), 'MMMM d, yyyy')} />
            )}
            <MessageRow msg={msg} isOwn={isOwn} prevMsg={prev} />
          </div>
        )
      })}
      <div ref={bottomRef} />
    </div>
  )
}

function MessageRow({ msg, isOwn, prevMsg }: { msg: Message; isOwn: boolean; prevMsg?: Message }) {
  const isSameSender = prevMsg?.sender_id === msg.sender_id
  const showAvatar = !isOwn && !isSameSender

  return (
    <div className={`flex items-end gap-2 ${isOwn ? 'justify-end' : 'justify-start'}`}>
      {!isOwn && (
        <div className="w-7 flex-shrink-0">
          {showAvatar && msg.sender && (
            <div className="w-7 h-7 rounded-full bg-primary-400 flex items-center justify-center
              text-white text-xs font-semibold">
              {msg.sender.first_name[0]}
            </div>
          )}
        </div>
      )}
      <MessageBubble msg={msg} isOwn={isOwn} />
    </div>
  )
}
