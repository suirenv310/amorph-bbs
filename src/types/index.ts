export type UserRole = 'user' | 'admin'

export interface User {
  id: string
  username: string
  discord_user_id?: string
  discord_username?: string
  verify_code?: string
  is_verified: boolean
  role: UserRole
  is_banned: boolean
  ban_reason?: string
  created_at: string
}

export interface Profile {
  id: string
  user_id: string
  display_name: string
  avatar: string
  color: string
  is_default: boolean
  created_at: string
}

export interface InviteCode {
  code: string
  discord_user_id: string
  discord_username: string
  discord_avatar_url?: string
  issued_at: string
  used: boolean
  used_by_user_id?: string
  used_at?: string
  revoked: boolean
  revoked_at?: string
  revoked_by?: string
  revoke_reason?: string
}

export interface Room {
  id: string
  name: string
  description: string
  is_protected: boolean
  created_at: string
}

// Chat messages — NOT anonymous, shows real username
export interface Message {
  id: string
  room_id: string
  content: string
  deleted: boolean
  created_at: string
  author: Pick<User, 'id' | 'username'> | null
}

// Forum threads — anonymous (author hidden from non-admins)
export interface Thread {
  id: string
  title: string
  body: string
  tag: 'hot' | 'new' | 'pinned' | 'discussion'
  is_pinned: boolean
  reply_count: number
  deleted: boolean
  created_at: string
  updated_at: string
  // Media
  media_urls:  string[]
  media_types: ('image' | 'video')[]
  is_spoiler:  boolean
  // Visibility: 'anon' = ẩn danh, 'public' = hiện username+avatar
  visibility:  'anon' | 'public'
  // Public profile info (visible when visibility='public')
  author_profile?: Pick<Profile, 'id' | 'display_name' | 'avatar' | 'color'> | null
  // Only visible to admins:
  author?: Pick<User, 'id' | 'username' | 'discord_username' | 'verify_code'> | null
  // Votes (denormalized counts from DB)
  upvotes?:   number
  downvotes?: number
}

export interface Reply {
  id: string
  thread_id: string
  body: string
  deleted: boolean
  created_at: string
  // Media
  media_urls:  string[]
  media_types: ('image' | 'video')[]
  is_spoiler:  boolean
  visibility:  'anon' | 'public'
  // Public profile info (visible when visibility='public')
  author_profile?: Pick<Profile, 'id' | 'display_name' | 'avatar' | 'color'> | null
  // Only visible to admins:
  author?: Pick<User, 'id' | 'username' | 'discord_username' | 'verify_code'> | null
  // Votes (denormalized counts from DB)
  upvotes?:   number
  downvotes?: number
}

export interface DirectMessage {
  id: string
  sender_id: string
  receiver_id: string
  content: string
  read: boolean
  created_at: string
  sender?: Pick<User, 'id' | 'username'> | null
}

export interface DmConversation {
  partner: Pick<User, 'id' | 'username'>
  lastMessage: DirectMessage
  unreadCount: number
}

// Session user (from JWT)
export interface SessionUser {
  id: string
  username: string
  role: UserRole
  is_verified: boolean
  is_banned: boolean
  active_profile_id?: string  // currently active profile
}