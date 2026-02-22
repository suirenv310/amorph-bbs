import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

// POST /api/chat/rooms/[id]/kick — kick member (vẫn vào lại được)
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = getSessionUser(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { user_id } = await req.json()
  if (!user_id) return NextResponse.json({ error: 'Thiếu user_id' }, { status: 400 })

  const { data: room } = await supabaseAdmin
    .from('rooms').select('created_by').eq('id', params.id).single()

  const isOwner = room?.created_by === session.id
  const isAdmin = session.role === 'admin'
  if (!isOwner && !isAdmin)
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  if (user_id === session.id)
    return NextResponse.json({ error: 'Không thể kick chính mình' }, { status: 400 })

  // Chỉ xóa khỏi room_members, không ban
  await supabaseAdmin.from('room_members')
    .delete().eq('room_id', params.id).eq('user_id', user_id)

  return NextResponse.json({ ok: true })
}
