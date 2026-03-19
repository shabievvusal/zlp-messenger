import { useEffect, useRef, useCallback } from 'react'
import { useAuthStore } from '@/store/auth'
import { useChatStore } from '@/store/chat'
import { useCallStore } from '@/store/call'
import { canNotify } from './useNotificationPermission'
import type { WSEvent, Message } from '@/types'

const RECONNECT_DELAY = 3000

function getWsUrl(token: string) {
  // Всегда вычисляем из текущего хоста — работает и на HTTP и на HTTPS
  const proto = window.location.protocol === 'https:' ? 'wss' : 'ws'
  const host = window.location.host
  return `${proto}://${host}/ws?token=${token}`
}

// Allows App.tsx to register a navigate function for notification click
let _navigateToChat: ((chatId: string) => void) | null = null
export function registerNavigateToChat(fn: (chatId: string) => void) {
  _navigateToChat = fn
}

// Exposed so other hooks (useWebRTC) can consume call_webrtc events
export type WebRTCHandler = (subType: string, from: string, data: unknown, callId: string) => void
let _webRTCHandler: WebRTCHandler | null = null
export function registerWebRTCHandler(fn: WebRTCHandler | null) {
  _webRTCHandler = fn
}

// Caller side: triggered when callee accepts
let _onCallAccepted: (() => Promise<void>) | null = null
export function registerCallAcceptedHandler(fn: (() => Promise<void>) | null) { _onCallAccepted = fn }

// Called when remote side ends or declines the call — close PC without re-sending WS event
let _onRemoteCallEnded: (() => void) | null = null
export function registerRemoteCallEndedHandler(fn: (() => void) | null) { _onRemoteCallEnded = fn }

// Buffer offer in case it arrives before callee accepts
let _bufferedOffer: { subType: string; from: string; data: unknown; callId: string } | null = null
export function getBufferedOffer() { return _bufferedOffer }
export function clearBufferedOffer() { _bufferedOffer = null }

export function useWebSocket() {
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectRef = useRef<ReturnType<typeof setTimeout>>()
  const { accessToken, isAuthenticated } = useAuthStore()

  const addMessage = useChatStore((s) => s.addMessage)
  const updateMessage = useChatStore((s) => s.updateMessage)
  const removeMessage = useChatStore((s) => s.removeMessage)
  const updateLastMessage = useChatStore((s) => s.updateLastMessage)
  const setTyping = useChatStore((s) => s.setTyping)
  const setOnline = useChatStore((s) => s.setOnline)
  const incrementUnread = useChatStore((s) => s.incrementUnread)
  const incrementMention = useChatStore((s) => s.incrementMention)
  const markMessageRead = useChatStore((s) => s.markMessageRead)
  const activeChatId = useChatStore((s) => s.activeChatId)

  const setIncoming = useCallStore((s) => s.setIncoming)
  const updateActive = useCallStore((s) => s.updateActive)
  const clearAll = useCallStore((s) => s.clearAll)

  // Keep activeChatId in ref so event handler always sees latest value
  const activeChatIdRef = useRef(activeChatId)
  activeChatIdRef.current = activeChatId

  const handleEvent = useCallback((event: WSEvent) => {
    switch (event.type) {
      case 'new_message': {
        const msg = event.payload as Message
        addMessage(msg)
        updateLastMessage(msg.chat_id, msg)
        const isActiveChat = msg.chat_id === activeChatIdRef.current
        if (!isActiveChat) {
          incrementUnread(msg.chat_id)
        }
        // Browser notification when tab is hidden or user is in different chat
        if ((!isActiveChat || document.hidden) && canNotify()) {
          const store = useChatStore.getState()
          const mutedUntil = store.mutedChats[msg.chat_id]
          const isMuted = !!mutedUntil && new Date(mutedUntil) > new Date()
          if (!isMuted) {
            const senderName = msg.sender
              ? `${msg.sender.first_name}${msg.sender.last_name ? ' ' + msg.sender.last_name : ''}`
              : store.chats.find((c) => c.id === msg.chat_id)?.title ?? 'Новое сообщение'
            const body = msg.text?.slice(0, 100) ?? (msg.attachments?.length ? '📎 Вложение' : '')
            const n = new Notification(senderName, {
              body,
              icon: '/favicon.ico',
              // unique tag per message — prevents browser from silently replacing
              tag: msg.id,
            })
            n.onclick = () => {
              window.focus()
              _navigateToChat?.(msg.chat_id)
              n.close()
            }
          }
        }
        break
      }
      case 'message_edited':
        updateMessage(event.payload as Message)
        break
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
      case 'call_incoming': {
        const p = event.payload as {
          call_id: string; caller_id: string; call_type: string
          caller_name?: string; caller_avatar?: string
        }
        setIncoming({
          callId: p.call_id,
          callerId: p.caller_id,
          callerName: p.caller_name ?? 'Unknown',
          callerAvatar: p.caller_avatar,
          type: p.call_type === 'video' ? 'video' : 'voice',
        })
        break
      }
      case 'call_accepted': {
        updateActive({ status: 'connecting' })
        _onCallAccepted?.()
        break
      }
      case 'call_declined': {
        _onRemoteCallEnded?.()
        clearAll()
        break
      }
      case 'call_ended': {
        _onRemoteCallEnded?.()
        clearAll()
        break
      }
      case 'call_webrtc': {
        const p = event.payload as {
          sub_type: string; from: string; data: unknown; call_id: string
        }
        if (p.sub_type === 'webrtc_offer') {
          _bufferedOffer = { subType: p.sub_type, from: p.from, data: p.data, callId: p.call_id }
        }
        _webRTCHandler?.(p.sub_type, p.from, p.data, p.call_id)
        break
      }
      case 'mention': {
        const p = event.payload as { chat_id: string; message_id: string }
        incrementMention(p.chat_id)
        break
      }
      case 'message_read': {
        const p = event.payload as { message_id: string }
        markMessageRead(p.message_id)
        break
      }
    }
  }, [addMessage, updateMessage, removeMessage, updateLastMessage, setTyping, setOnline,
      incrementUnread, incrementMention, markMessageRead, setIncoming, updateActive, clearAll])

  const connect = useCallback(() => {
    if (!isAuthenticated || !accessToken) return
    if (wsRef.current?.readyState === WebSocket.OPEN) return

    try {
      const ws = new WebSocket(getWsUrl(accessToken))
      wsRef.current = ws

      ws.onopen = () => {
        clearTimeout(reconnectRef.current)
      }

      ws.onmessage = (e) => {
        try {
          const event: WSEvent = JSON.parse(e.data)
          handleEvent(event)
        } catch { /* ignore */ }
      }

      ws.onclose = () => {
        reconnectRef.current = setTimeout(connect, RECONNECT_DELAY)
      }

      ws.onerror = () => ws.close()
    } catch { /* ignore */ }
  }, [isAuthenticated, accessToken, handleEvent])

  const send = useCallback((type: string, payload: unknown) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type, payload }))
    }
  }, [])

  const sendTyping = useCallback((chatId: string) => send('typing', { chat_id: chatId }), [send])
  const sendStopTyping = useCallback((chatId: string) => send('stop_typing', { chat_id: chatId }), [send])
  const sendMarkRead = useCallback((messageId: string) => send('mark_read', { message_id: messageId }), [send])

  useEffect(() => {
    connect()
    return () => {
      clearTimeout(reconnectRef.current)
      wsRef.current?.close()
    }
  }, [connect])

  return { send, sendTyping, sendStopTyping, sendMarkRead }
}
