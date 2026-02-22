import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

// POST /api/chat/rooms/[id]/transfer — transfer ownership
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = getSessionUser(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { new_owner_id } = await req.json()
  if (!new_owner_id) return NextResponse.json({ error: 'Thiếu new_owner_id' }, { status: 400 })

  const { data: room } = await supabaseAdmin
    .from('rooms').select('created_by, is_protected').eq('id', params.id).single()

  if (!room) return NextResponse.json({ error: 'Room not found' }, { status: 404 })

  const isOwner = room.created_by === session.id
  const isAdmin = session.role === 'admin'
  if (!isOwner && !isAdmin)
    return NextResponse.json({ error: 'Chỉ chủ room mới transfer được' }, { status: 403 })

  if (new_owner_id === session.id)
    return NextResponse.json({ error: 'Bạn đã là chủ room rồi' }, { status: 400 })

  // Verify new owner là member của room
  const { data: member } = await supabaseAdmin
    .from('room_members')
    .select('user_id')
    .eq('room_id', params.id)
    .eq('user_id', new_owner_id)
    .maybeSingle()

  if (!member)
    return NextResponse.json({ error: 'User phải là member của room mới transfer được' }, { status: 400 })

  await supabaseAdmin.from('rooms')
    .update({ created_by: new_owner_id })
    .eq('id', params.id)

  return NextResponse.json({ ok: true })
}
