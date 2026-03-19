import { api } from './client'
import type { Chat, ChatMember, Message, Attachment } from '@/types'

export const chatApi = {
  getChats: () => api.get<Chat[]>('/chats'),

  createPrivate: (targetId: string) =>
    api.post<Chat>('/chats/private', { target_id: targetId }),

  createGroup: (data: { title: string; description?: string; member_ids?: string[]; is_channel?: boolean }) =>
    api.post<Chat>('/chats/group', data),

  getMessages: (chatId: string, limit = 50, offset = 0) =>
    api.get<Message[]>(`/chats/${chatId}/messages`, { params: { limit, offset } }),

  sendMessage: (chatId: string, data: { text?: string; type?: string; reply_to_id?: string }) =>
    api.post<Message>(`/chats/${chatId}/messages`, data),

  editMessage: (msgId: string, text: string) =>
    api.patch(`/messages/${msgId}`, { text }),

  deleteMessage: (msgId: string) =>
    api.delete(`/messages/${msgId}`),

  addReaction: (msgId: string, emoji: string) =>
    api.post(`/messages/${msgId}/react`, { emoji }),

  removeReaction: (msgId: string) =>
    api.delete(`/messages/${msgId}/react`),

  searchMessages: (chatId: string, q: string) =>
    api.get<Message[]>(`/chats/${chatId}/messages/search`, { params: { q } }),

  getMembers: (chatId: string) =>
    api.get<ChatMember[]>(`/chats/${chatId}/members`),

  forwardMessage: (targetChatId: string, msg: Message) =>
    api.post<Message>(`/chats/${targetChatId}/messages`, {
      type: msg.type ?? 'text',
      text: msg.text,
      forward_from_id: msg.id,
    }),

  muteChat: (chatId: string, until: string | null) =>
    api.patch(`/chats/${chatId}/mute`, { until }),

  getSharedMedia: (chatId: string, type: 'photo' | 'document' = 'photo', limit = 20, offset = 0) =>
    api.get<Attachment[]>(`/chats/${chatId}/media`, { params: { type, limit, offset } }),

  updateGroup: (chatId: string, data: { title?: string; description?: string; is_public?: boolean }) =>
    api.patch(`/chats/${chatId}`, data),

  deleteGroup: (chatId: string) =>
    api.delete(`/chats/${chatId}`),

  addMember: (chatId: string, userId: string) =>
    api.post(`/chats/${chatId}/members`, { user_id: userId }),

  kickMember: (chatId: string, userId: string) =>
    api.delete(`/chats/${chatId}/members/${userId}`),

  setMemberRole: (chatId: string, userId: string, role: 'admin' | 'member', title?: string) =>
    api.patch(`/chats/${chatId}/members/${userId}/role`, { role, title }),

  leaveChat: (chatId: string) =>
    api.delete(`/chats/${chatId}/leave`),

  getGroupCallState: (chatId: string) =>
    api.get<{ active: boolean; call_id?: string; participants?: { user_id: string; user_name: string }[] }>(
      `/chats/${chatId}/call`
    ),

  getInviteLink: (chatId: string) =>
    api.get<{ invite_link: string }>(`/chats/${chatId}/invite-link`),

  resetInviteLink: (chatId: string) =>
    api.post<{ invite_link: string }>(`/chats/${chatId}/invite-link/reset`),

  getPermissions: (chatId: string) =>
    api.get<ChatPermissions>(`/chats/${chatId}/permissions`),

  updatePermissions: (chatId: string, perms: ChatPermissions) =>
    api.patch(`/chats/${chatId}/permissions`, perms),

  getAdminActions: (chatId: string, limit = 50) =>
    api.get<AdminAction[]>(`/chats/${chatId}/admin-actions`, { params: { limit } }),
}

export interface ChatPermissions {
  can_send_messages: boolean
  can_send_media: boolean
  can_add_members: boolean
  can_pin_messages: boolean
  can_change_info: boolean
  can_invite_users: boolean
}

export interface AdminAction {
  id: string
  chat_id: string
  actor_id: string
  target_id?: string
  action: string
  details?: string
  created_at: string
  actor?: { id: string; username: string; first_name: string; last_name?: string; avatar_url?: string }
  target?: { id: string; username: string; first_name: string; last_name?: string; avatar_url?: string }
}
