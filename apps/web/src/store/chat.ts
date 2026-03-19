import { create } from 'zustand'
import type { Chat, Message } from '@/types'

interface ChatState {
  chats: Chat[]
  activeChatId: string | null
  messages: Record<string, Message[]>
  typing: Record<string, string[]>   // chatId → userIds[]
  onlineUsers: string[]              // userIds (array, не Set — для совместимости)

  setChats: (chats: Chat[]) => void
  setActiveChat: (chatId: string | null) => void
  upsertChat: (chat: Chat) => void

  setMessages: (chatId: string, messages: Message[]) => void
  prependMessages: (chatId: string, messages: Message[]) => void
  addMessage: (msg: Message) => void
  updateMessage: (msg: Message) => void
  removeMessage: (chatId: string, msgId: string) => void
  updateLastMessage: (chatId: string, msg: Message) => void

  setTyping: (chatId: string, userId: string, isTyping: boolean) => void
  setOnline: (userId: string, online: boolean) => void
  isOnline: (userId: string) => boolean
  incrementUnread: (chatId: string) => void
  clearUnread: (chatId: string) => void
}

export const useChatStore = create<ChatState>((set, get) => ({
  chats: [],
  activeChatId: null,
  messages: {},
  typing: {},
  onlineUsers: [],

  setChats: (chats) => set({ chats: chats ?? [] }),
  setActiveChat: (chatId) => set({ activeChatId: chatId }),

  upsertChat: (chat) =>
    set((state) => {
      const idx = state.chats.findIndex((c) => c.id === chat.id)
      if (idx === -1) return { chats: [chat, ...state.chats] }
      const chats = [...state.chats]
      chats[idx] = { ...chats[idx], ...chat }
      return { chats }
    }),

  setMessages: (chatId, messages) =>
    set((state) => ({ messages: { ...state.messages, [chatId]: messages ?? [] } })),

  prependMessages: (chatId, messages) =>
    set((state) => ({
      messages: {
        ...state.messages,
        [chatId]: [...(messages ?? []), ...(state.messages[chatId] ?? [])],
      },
    })),

  addMessage: (msg) =>
    set((state) => {
      const existing = state.messages[msg.chat_id] ?? []
      if (existing.some((m) => m.id === msg.id)) {
        console.log('[store] addMessage SKIPPED (dedup):', msg.id, 'attachments:', msg.attachments?.length ?? 0)
        return state
      }
      console.log('[store] addMessage OK:', msg.id, 'attachments:', msg.attachments?.length ?? 0, msg.attachments)
      return {
        messages: {
          ...state.messages,
          [msg.chat_id]: [...existing, msg],
        },
      }
    }),

  updateMessage: (msg) =>
    set((state) => {
      const found = (state.messages[msg.chat_id] ?? []).some((m) => m.id === msg.id)
      console.log('[store] updateMessage:', msg.id, found ? 'FOUND' : 'NOT FOUND', 'attachments:', msg.attachments?.length ?? 0)
      return {
        messages: {
          ...state.messages,
          [msg.chat_id]: (state.messages[msg.chat_id] ?? []).map((m) =>
            m.id === msg.id ? msg : m
          ),
        },
      }
    }),

  removeMessage: (chatId, msgId) =>
    set((state) => ({
      messages: {
        ...state.messages,
        [chatId]: (state.messages[chatId] ?? []).filter((m) => m.id !== msgId),
      },
    })),

  updateLastMessage: (chatId, msg) =>
    set((state) => ({
      chats: state.chats.map((c) =>
        c.id === chatId ? { ...c, last_message: msg } : c
      ),
    })),

  setTyping: (chatId, userId, isTyping) =>
    set((state) => {
      const prev = state.typing[chatId] ?? []
      const next = isTyping
        ? prev.includes(userId) ? prev : [...prev, userId]
        : prev.filter((id) => id !== userId)
      return { typing: { ...state.typing, [chatId]: next } }
    }),

  setOnline: (userId, online) =>
    set((state) => ({
      onlineUsers: online
        ? state.onlineUsers.includes(userId) ? state.onlineUsers : [...state.onlineUsers, userId]
        : state.onlineUsers.filter((id) => id !== userId),
    })),

  isOnline: (userId) => get().onlineUsers.includes(userId),

  incrementUnread: (chatId) =>
    set((state) => ({
      chats: state.chats.map((c) =>
        c.id === chatId ? { ...c, unread_count: (c.unread_count ?? 0) + 1 } : c
      ),
    })),

  clearUnread: (chatId) =>
    set((state) => ({
      chats: state.chats.map((c) =>
        c.id === chatId ? { ...c, unread_count: 0 } : c
      ),
    })),
}))
