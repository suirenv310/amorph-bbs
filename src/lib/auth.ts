import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { supabaseAdmin } from './supabase'
import type { SessionUser, UserRole } from '@/types'

const JWT_SECRET = process.env.JWT_SECRET!
const COOKIE_NAME = 'amorph_token'

// ── PASSWORD ──────────────────────────────────────────────────
export async function hashPassword(p: string) {
  return bcrypt.hash(p, 12)
}
export async function verifyPassword(p: string, hash: string) {
  return bcrypt.compare(p, hash)
}

// ── JWT ───────────────────────────────────────────────────────
export function createToken(user: SessionUser): string {
  return jwt.sign(user, JWT_SECRET, { expiresIn: '14d' })
}
export function verifyToken(token: string): SessionUser | null {
  try { return jwt.verify(token, JWT_SECRET) as SessionUser }
  catch { return null }
}

// ── SESSION FROM REQUEST ──────────────────────────────────────
export function getSessionUser(req: Request): SessionUser | null {
  const cookie = req.headers.get('cookie') || ''
  const match  = cookie.match(new RegExp(`(?:^|; )${COOKIE_NAME}=([^;]*)`))
  if (!match) return null
  return verifyToken(decodeURIComponent(match[1]))
}

// ── SET / CLEAR COOKIE ────────────────────────────────────────
export function sessionCookie(token: string): string {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : ''
  return `${COOKIE_NAME}=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${60*60*24*14}${secure}`
}
export function clearCookie(): string {
  return `${COOKIE_NAME}=; HttpOnly; Path=/; Max-Age=0`
}

// ── REGISTER ─────────────────────────────────────────────────
export async function registerUser(username: string, password: string) {
  // Validate
  if (!/^[a-zA-Z0-9_\-]{2,20}$/.test(username))
    throw new Error('Username: 2-20 ký tự, chỉ dùng chữ/số/_ ')

  if (password.length < 4)
    throw new Error('Password phải có ít nhất 4 ký tự')

  const { data: existing } = await supabaseAdmin
    .from('users').select('id').eq('username', username).maybeSingle()
  if (existing) throw new Error('Username đã được dùng')

  const password_hash = await hashPassword(password)

  const { data: user, error } = await supabaseAdmin
    .from('users')
    .insert({ username, password_hash })
    .select('id, username, role, is_verified, is_banned')
    .single()
  if (error) throw new Error(error.message)

  // Create default profile
  await supabaseAdmin.from('profiles').insert({
    user_id:      user.id,
    display_name: username,
    avatar:       '◈',
    color:        '#00d4ff',
    is_default:   true,
  })

  return user
}

// ── LOGIN ─────────────────────────────────────────────────────
export async function loginUser(username: string, password: string) {
  const { data: user, error } = await supabaseAdmin
    .from('users')
    .select('id, username, password_hash, role, is_verified, is_banned, ban_reason')
    .eq('username', username)
    .maybeSingle()

  if (error || !user) throw new Error('Sai username hoặc password')
  if (user.is_banned)  throw new Error(`Account bị ban. ${user.ban_reason ? 'Lý do: ' + user.ban_reason : ''}`)

  const ok = await verifyPassword(password, user.password_hash)
  if (!ok) throw new Error('Sai username hoặc password')

  // Get default profile
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .eq('user_id', user.id)
    .eq('is_default', true)
    .maybeSingle()

  return {
    id:               user.id,
    username:         user.username,
    role:             user.role as UserRole,
    is_verified:      user.is_verified,
    is_banned:        user.is_banned,
    active_profile_id: profile?.id,
  } satisfies SessionUser
}

// ── VERIFY INVITE CODE ────────────────────────────────────────
export async function verifyInviteCode(userId: string, code: string) {
  const upper = code.trim().toUpperCase()

  const { data: row, error } = await supabaseAdmin
    .from('invite_codes')
    .select('*')
    .eq('code', upper)
    .maybeSingle()

  if (error || !row) throw new Error('Code không tồn tại')
  if (row.revoked)   throw new Error('Code này đã bị thu hồi bởi admin')
  if (row.used && row.used_by_user_id !== userId)
    throw new Error('Code này đã được dùng bởi account khác')

  // Get user
  const { data: user } = await supabaseAdmin
    .from('users').select('verify_code').eq('id', userId).single()

  if (user?.verify_code && user.verify_code !== upper)
    throw new Error('Account của bạn đã gắn với một code khác. Liên hệ admin để reset.')

  // Bind code to user
  await supabaseAdmin.from('invite_codes').update({
    used:            true,
    used_by_user_id: userId,
    used_at:         new Date().toISOString(),
  }).eq('code', upper)

  await supabaseAdmin.from('users').update({
    verify_code:      upper,
    is_verified:      true,
    discord_user_id:  row.discord_user_id,
    discord_username: row.discord_username,
  }).eq('id', userId)

  return { discord_username: row.discord_username }
}
