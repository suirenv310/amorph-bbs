import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import bcrypt from 'bcryptjs'

// PATCH /api/chat/rooms/[id] — update room (set password, etc)
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = getSessionUser(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = params
  const body   = await req.json()

  // Check ownership or admin
  const { data: room } = await supabaseAdmin
    .from('rooms').select('created_by, is_protected, name').eq('id', id).single()
  if (!room) return NextResponse.json({ error: 'Room not found' }, { status: 404 })

  const isOwner = room.created_by === session.id
  const isAdmin = session.role === 'admin'
  if (!isOwner && !isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const updates: any = {}

  // Set / remove password
  if (body.password !== undefined) {
    if (body.password === '') {
      updates.password_hash = null
      updates.has_password  = false
    } else {
      updates.password_hash = await bcrypt.hash(body.password, 10)
      updates.has_password  = true
    }
  }

  if (body.auto_delete !== undefined) updates.auto_delete = body.auto_delete
  if (body.description !== undefined) updates.description = body.description

  await supabaseAdmin.from('rooms').update(updates).eq('id', id)
  return NextResponse.json({ ok: true })
}

// POST /api/chat/rooms/[id] — join room (verify password if needed)
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = getSessionUser(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id }       = params
  const { password, action } = await req.json()

  const { data: room } = await supabaseAdmin
    .from('rooms').select('*').eq('id', id).single()
  if (!room) return NextResponse.json({ error: 'Room not found' }, { status: 404 })

  // Leave room
  if (action === 'leave') {
    await supabaseAdmin.from('room_members')
      .delete().eq('room_id', id).eq('user_id', session.id)
    return NextResponse.json({ ok: true })
  }

  // Join room
  if (room.has_password && session.role !== 'admin') {
    if (!password) return NextResponse.json({ error: 'PASSWORD_REQUIRED' }, { status: 403 })
    const ok = await bcrypt.compare(password, room.password_hash)
    if (!ok) return NextResponse.json({ error: 'Wrong password' }, { status: 403 })
  }

  // Upsert member (admin joins silently — no broadcast)
  await supabaseAdmin.from('room_members')
    .upsert({ room_id: id, user_id: session.id }, { onConflict: 'room_id,user_id' })

  return NextResponse.json({ ok: true, silent: session.role === 'admin' })
}

// DELETE /api/chat/rooms/[id] — delete room
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const session = getSessionUser(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = params
  const { data: room } = await supabaseAdmin
    .from('rooms').select('created_by, is_protected, name').eq('id', id).single()

  if (!room)              return NextResponse.json({ error: 'Not found'   }, { status: 404 })
  if (room.is_protected)  return NextResponse.json({ error: 'Protected'   }, { status: 400 })

  const isOwner = room.created_by === session.id
  const isAdmin = session.role === 'admin'
  if (!isOwner && !isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  await supabaseAdmin.from('rooms').delete().eq('id', id)

  // Audit log
  await writeAuditLog({
    action:         'delete_room',
    actor_id:       session.id,
    actor_name:     session.username,
    target_type:    'room',
    target_id:      id,
    target_preview: (room as any).name ?? '',
  })

  return NextResponse.json({ ok: true })
}

async function writeAuditLog(entry: {
  action: string, actor_id: string, actor_name: string,
  target_type: string, target_id: string, target_preview: string,
  metadata?: any
}) {
  await supabaseAdmin.from('audit_logs').insert(entry)
  // Also post to #ADMIN-LOG room as a system message
  const { data: logRoom } = await supabaseAdmin
    .from('rooms').select('id').eq('name', 'ADMIN-LOG').maybeSingle()
  if (logRoom) {
    const content = `[${entry.action.toUpperCase()}] ${entry.actor_name} → ${entry.target_type}:${entry.target_preview.slice(0, 80)}`
    await supabaseAdmin.from('messages').insert({
      room_id:   logRoom.id,
      author_id: null,
      content,
    })
  }
}
