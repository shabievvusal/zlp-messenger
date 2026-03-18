import { create } from 'zustand'
import type { Chat, Message } from '@/types'

interface TypingState {
  [chatId: string]: Set<string> // chatId → set of typing userIds
}

interface ChatState {
  chats: Chat[]
  activeChatId: string | null
  messages: Record<string, Message[]> // chatId → messages
  typing: TypingState
  onlineUsers: Set<string>

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
  incrementUnread: (chatId: string) => void
  clearUnread: (chatId: string) => void
}

export const useChatStore = create<ChatState>((set, get) => ({
  chats: [],
  activeChatId: null,
  messages: {},
  typing: {},
  onlineUsers: new Set(),

  setChats: (chats) => set({ chats }),
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
    set((state) => ({ messages: { ...state.messages, [chatId]: messages } })),

  prependMessages: (chatId, messages) =>
    set((state) => ({
      messages: {
        ...state.messages,
        [chatId]: [...messages, ...(state.messages[chatId] ?? [])],
      },
    })),

  addMessage: (msg) =>
    set((state) => {
      const existing = state.messages[msg.chat_id] ?? []
      return {
        messages: {
          ...state.messages,
          [msg.chat_id]: [...existing, msg],
        },
      }
    }),

  updateMessage: (msg) =>
    set((state) => {
      const existing = state.messages[msg.chat_id] ?? []
      return {
        messages: {
          ...state.messages,
          [msg.chat_id]: existing.map((m) => (m.id === msg.id ? msg : m)),
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
      const prev = state.typing[chatId] ? new Set(state.typing[chatId]) : new Set<string>()
      if (isTyping) prev.add(userId)
      else prev.delete(userId)
      return { typing: { ...state.typing, [chatId]: prev } }
    }),

  setOnline: (userId, online) =>
    set((state) => {
      const next = new Set(state.onlineUsers)
      if (online) next.add(userId)
      else next.delete(userId)
      return { onlineUsers: next }
    }),

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
