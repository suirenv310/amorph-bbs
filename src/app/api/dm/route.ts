import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

// GET /api/dm?with=user_id   — get messages with a user
// GET /api/dm                — list conversations
export async function GET(req: Request) {
  const session = getSessionUser(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const withUserId = searchParams.get('with')

  if (withUserId) {
    // Get messages between two users
    const { data, error } = await supabaseAdmin
      .from('direct_messages')
      .select('id, content, read, created_at, sender:sender_id(id, username)')
      .or(
        `and(sender_id.eq.${session.id},receiver_id.eq.${withUserId}),` +
        `and(sender_id.eq.${withUserId},receiver_id.eq.${session.id})`
      )
      .order('created_at', { ascending: true })
      .limit(100)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Mark as read
    await supabaseAdmin
      .from('direct_messages')
      .update({ read: true })
      .eq('receiver_id', session.id)
      .eq('sender_id', withUserId)
      .eq('read', false)

    return NextResponse.json({ messages: data })
  }

  // List conversations — get latest message per unique partner
  const { data, error } = await supabaseAdmin
    .from('direct_messages')
    .select('id, content, read, created_at, sender:sender_id(id, username), receiver:receiver_id(id, username)')
    .or(`sender_id.eq.${session.id},receiver_id.eq.${session.id}`)
    .order('created_at', { ascending: false })
    .limit(200)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Deduplicate — keep latest per conversation partner
  const seen = new Map<string, any>()
  for (const msg of data) {
    const partner = (msg.sender as any).id === session.id ? msg.receiver : msg.sender
    const key = (partner as any).id
    if (!seen.has(key)) seen.set(key, { partner, lastMessage: msg })
  }

  // Count unread per partner
  const conversations = await Promise.all(
    Array.from(seen.values()).map(async ({ partner, lastMessage }) => {
      const { count } = await supabaseAdmin
        .from('direct_messages')
        .select('id', { count: 'exact', head: true })
        .eq('sender_id', partner.id)
        .eq('receiver_id', session.id)
        .eq('read', false)
      return { partner, lastMessage, unreadCount: count || 0 }
    })
  )

  return NextResponse.json({ conversations })
}

// POST /api/dm — send message
export async function POST(req: Request) {
  const session = getSessionUser(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { receiver_id, content } = await req.json()
  if (!receiver_id || !content?.trim())
    return NextResponse.json({ error: 'Thiếu receiver hoặc nội dung' }, { status: 400 })

  if (receiver_id === session.id)
    return NextResponse.json({ error: 'Không thể nhắn tin cho chính mình' }, { status: 400 })

  const { data, error } = await supabaseAdmin
    .from('direct_messages')
    .insert({ sender_id: session.id, receiver_id, content: content.trim() })
    .select('id, content, read, created_at, sender:sender_id(id, username)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ message: data })
}
