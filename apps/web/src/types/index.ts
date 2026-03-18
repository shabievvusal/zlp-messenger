export interface User {
  id: string
  username: string
  first_name: string
  last_name?: string
  bio?: string
  avatar_url?: string
  is_bot: boolean
  last_seen?: string
}

export type ChatType = 'private' | 'group' | 'channel' | 'saved'

export interface Chat {
  id: string
  type: ChatType
  title?: string
  description?: string
  username?: string
  avatar_url?: string
  is_public: boolean
  members_count: number
  created_by?: string
  created_at: string
  updated_at: string
  last_message?: Message
  unread_count: number
}

export type MessageType =
  | 'text' | 'photo' | 'video' | 'voice' | 'video_note'
  | 'audio' | 'document' | 'sticker' | 'gif' | 'location'
  | 'contact' | 'poll' | 'service'

export interface Message {
  id: string
  chat_id: string
  sender_id?: string
  type: MessageType
  text?: string
  reply_to_id?: string
  forward_from_id?: string
  forward_chat_id?: string
  is_edited: boolean
  is_deleted: boolean
  is_pinned: boolean
  views: number
  created_at: string
  edited_at?: string
  sender?: User
  attachments?: Attachment[]
  reactions?: Reaction[]
  reply_to?: Message
}

export interface Attachment {
  id: string
  message_id: string
  type: 'photo' | 'video' | 'audio' | 'voice' | 'document' | 'sticker' | 'gif'
  url: string
  file_name?: string
  file_size?: number
  mime_type?: string
  width?: number
  height?: number
  duration?: number
  thumbnail?: string
}

export interface Reaction {
  message_id: string
  user_id: string
  emoji: string
  created_at: string
}

export type CallType = 'voice' | 'video' | 'group_voice'
export type CallStatus = 'ringing' | 'active' | 'ended' | 'missed' | 'declined'

export interface Call {
  id: string
  chat_id: string
  initiated_by: string
  type: CallType
  status: CallStatus
  started_at?: string
  ended_at?: string
  participants?: User[]
}

// WebSocket events
export type WSEventType =
  | 'new_message' | 'message_edited' | 'message_deleted'
  | 'reaction' | 'user_online' | 'user_offline'
  | 'user_typing' | 'user_stop_typing'
  | 'message_read' | 'call_incoming' | 'call_accepted'
  | 'call_declined' | 'call_ended' | 'call_webrtc' | 'error'

export interface WSEvent {
  type: WSEventType
  payload: unknown
}
