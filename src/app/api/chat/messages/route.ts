import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

// GET /api/chat/messages?room_id=&limit=60
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const room_id = searchParams.get('room_id')
  const limit   = parseInt(searchParams.get('limit') || '60')
  if (!room_id) return NextResponse.json({ error: 'Thiếu room_id' }, { status: 400 })

  const { data, error } = await supabaseAdmin
    .from('messages')
    .select('id, content, created_at, reply_to_id, reply_to_content, reply_to_author, author:author_id(id, username, avatar_url), author_profile:author_profile_id(id, display_name, avatar, color)')
    .eq('room_id', room_id)
    .eq('deleted', false)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ messages: data.reverse() })
}

// POST /api/chat/messages
export async function POST(req: Request) {
  const session = getSessionUser(req)
  if (!session) return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 })

  const { room_id, content, reply_to_id, profile_id } = await req.json()
  if (!room_id || !content?.trim())
    return NextResponse.json({ error: 'Thiếu room_id hoặc nội dung' }, { status: 400 })

  // Check room ban
  const { data: ban } = await supabaseAdmin
    .from('room_bans')
    .select('id')
    .eq('room_id', room_id)
    .eq('user_id', session.id)
    .maybeSingle()

  if (ban) return NextResponse.json({ error: 'Bạn đã bị ban khỏi room này' }, { status: 403 })

  // Lấy quote info nếu có reply
  let reply_to_content: string | null = null
  let reply_to_author:  string | null = null

  if (reply_to_id) {
    const { data: original } = await supabaseAdmin
      .from('messages')
      .select('content, author:author_id(username)')
      .eq('id', reply_to_id)
      .maybeSingle()

    if (original) {
      // Truncate 1 dòng preview
      reply_to_content = original.content.split('\n')[0].slice(0, 100)
      reply_to_author  = (original.author as any)?.username || 'Unknown'
    }
  }

  const { data, error } = await supabaseAdmin
    .from('messages')
    .insert({
      room_id,
      content:          content.trim(),
      author_id:        session.id,
      author_profile_id: profile_id || null,
      reply_to_id:      reply_to_id || null,
      reply_to_content: reply_to_content,
      reply_to_author:  reply_to_author,
    })
    .select('id, content, created_at, reply_to_id, reply_to_content, reply_to_author, author:author_id(id, username, avatar_url), author_profile:author_profile_id(id, display_name, avatar, color)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ message: data })
}
