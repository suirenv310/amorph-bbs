import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

// GET /api/chat/rooms/[id]/ban — lấy danh sách banned
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const session = getSessionUser(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: room } = await supabaseAdmin
    .from('rooms').select('created_by').eq('id', params.id).single()

  const isOwner = room?.created_by === session.id
  const isAdmin = session.role === 'admin'
  if (!isOwner && !isAdmin)
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data } = await supabaseAdmin
    .from('room_bans')
    .select('*, user:user_id(id, username), banned_by_user:banned_by(username)')
    .eq('room_id', params.id)
    .order('created_at', { ascending: false })

  return NextResponse.json({ bans: data || [] })
}

// POST /api/chat/rooms/[id]/ban — ban user
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = getSessionUser(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { user_id, reason } = await req.json()
  if (!user_id) return NextResponse.json({ error: 'Thiếu user_id' }, { status: 400 })

  const { data: room } = await supabaseAdmin
    .from('rooms').select('created_by').eq('id', params.id).single()

  const isOwner = room?.created_by === session.id
  const isAdmin = session.role === 'admin'
  if (!isOwner && !isAdmin)
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Không cho ban chính mình hoặc ban chủ room
  if (user_id === session.id)
    return NextResponse.json({ error: 'Không thể ban chính mình' }, { status: 400 })
  if (user_id === room?.created_by && !isAdmin)
    return NextResponse.json({ error: 'Không thể ban chủ room' }, { status: 400 })

  // Kick khỏi room luôn
  await supabaseAdmin.from('room_members')
    .delete().eq('room_id', params.id).eq('user_id', user_id)

  // Thêm vào ban list
  const { error } = await supabaseAdmin.from('room_bans').upsert({
    room_id:   params.id,
    user_id,
    banned_by: session.id,
    reason:    reason || null,
  }, { onConflict: 'room_id,user_id' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

// DELETE /api/chat/rooms/[id]/ban?user_id=xxx — unban
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const session = getSessionUser(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const user_id = searchParams.get('user_id')
  if (!user_id) return NextResponse.json({ error: 'Thiếu user_id' }, { status: 400 })

  const { data: room } = await supabaseAdmin
    .from('rooms').select('created_by').eq('id', params.id).single()

  const isOwner = room?.created_by === session.id
  const isAdmin = session.role === 'admin'
  if (!isOwner && !isAdmin)
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  await supabaseAdmin.from('room_bans')
    .delete().eq('room_id', params.id).eq('user_id', user_id)

  return NextResponse.json({ ok: true })
}
