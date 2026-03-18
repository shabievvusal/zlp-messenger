import { useEffect, useRef, useCallback } from 'react'
import { useAuthStore } from '@/store/auth'
import { useChatStore } from '@/store/chat'
import type { WSEvent, Message } from '@/types'

const WS_URL = import.meta.env.VITE_WS_URL ?? 'ws://localhost:8080/ws'
const RECONNECT_DELAY = 3000

export function useWebSocket() {
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectRef = useRef<ReturnType<typeof setTimeout>>()
  const { accessToken, isAuthenticated } = useAuthStore()
  const {
    addMessage, updateMessage, removeMessage,
    updateLastMessage, setTyping, setOnline, incrementUnread,
    activeChatId,
  } = useChatStore()

  const connect = useCallback(() => {
    if (!isAuthenticated || !accessToken) return
    if (wsRef.current?.readyState === WebSocket.OPEN) return

    const url = `${WS_URL}?token=${accessToken}`
    const ws = new WebSocket(url)
    wsRef.current = ws

    ws.onopen = () => {
      console.log('WS connected')
      clearTimeout(reconnectRef.current)
    }

    ws.onmessage = (e) => {
      try {
        const event: WSEvent = JSON.parse(e.data)
        handleEvent(event)
      } catch {
        /* ignore */
      }
    }

    ws.onclose = () => {
      console.log('WS disconnected, reconnecting...')
      reconnectRef.current = setTimeout(connect, RECONNECT_DELAY)
    }

    ws.onerror = () => {
      ws.close()
    }
  }, [isAuthenticated, accessToken])

  const handleEvent = (event: WSEvent) => {
    switch (event.type) {
      case 'new_message': {
        const msg = event.payload as Message
        addMessage(msg)
        updateLastMessage(msg.chat_id, msg)
        if (msg.chat_id !== activeChatId) {
          incrementUnread(msg.chat_id)
        }
        break
      }
      case 'message_edited': {
        updateMessage(event.payload as Message)
        break
      }
      case 'message_deleted': {
        const { chat_id, message_id } = event.payload as { chat_id: string; message_id: string }
        removeMessage(chat_id, message_id)
        break
      }
      case 'user_typing': {
        const { chat_id, user_id } = event.payload as { chat_id: string; user_id: string }
        setTyping(chat_id, user_id, true)
        setTimeout(() => setTyping(chat_id, user_id, false), 5000)
        break
      }
      case 'user_stop_typing': {
        const { chat_id, user_id } = event.payload as { chat_id: string; user_id: string }
        setTyping(chat_id, user_id, false)
        break
      }
      case 'user_online': {
        const { user_id } = event.payload as { user_id: string }
        setOnline(user_id, true)
        break
      }
      case 'user_offline': {
        const { user_id } = event.payload as { user_id: string }
        setOnline(user_id, false)
        break
      }
    }
  }

  const send = useCallback((type: string, payload: unknown) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type, payload }))
    }
  }, [])

  const sendTyping = useCallback((chatId: string) => {
    send('typing', { chat_id: chatId })
  }, [send])

  const sendStopTyping = useCallback((chatId: string) => {
    send('stop_typing', { chat_id: chatId })
  }, [send])

  const sendMarkRead = useCallback((messageId: string) => {
    send('mark_read', { message_id: messageId })
  }, [send])

  useEffect(() => {
    connect()
    return () => {
      clearTimeout(reconnectRef.current)
      wsRef.current?.close()
    }
  }, [connect])

  return { send, sendTyping, sendStopTyping, sendMarkRead }
}
