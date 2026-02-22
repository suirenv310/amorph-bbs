import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

async function writeAuditLog(entry: {
  action: string, actor_id: string, actor_name: string,
  target_type: string, target_id: string, target_preview: string, metadata?: any
}) {
  await supabaseAdmin.from('audit_logs').insert(entry)
  const { data: logRoom } = await supabaseAdmin
    .from('rooms').select('id').eq('name', 'ADMIN-LOG').maybeSingle()
  if (logRoom) {
    await supabaseAdmin.from('messages').insert({
      room_id:   logRoom.id,
      author_id: null,
      content:   `[${entry.action.toUpperCase()}] ${entry.actor_name} → "${entry.target_preview.slice(0,80)}"`,
    })
  }
}

// PATCH /api/forum/replies/[id] — edit reply
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = getSessionUser(req)
  if (!session || !session.is_verified)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id }   = params
  const { body } = await req.json()
  if (!body?.trim()) return NextResponse.json({ error: 'Empty body' }, { status: 400 })

  const { data: reply } = await supabaseAdmin
    .from('replies').select('*').eq('id', id).maybeSingle()

  if (!reply || reply.deleted)
    return NextResponse.json({ error: 'Reply not found' }, { status: 404 })

  const isOwner = reply.author_id === session.id
  const isAdmin = session.role === 'admin'
  if (!isOwner && !isAdmin)
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Save edit history
  await supabaseAdmin.from('reply_edits').insert({
    reply_id:  id,
    old_body:  reply.body,
    edited_by: session.id,
  })

  await supabaseAdmin.from('replies').update({
    body:      body.trim(),
    edited:    true,
    edited_at: new Date().toISOString(),
  }).eq('id', id)

  await writeAuditLog({
    action:         'edit_reply',
    actor_id:       session.id,
    actor_name:     session.username,
    target_type:    'reply',
    target_id:      id,
    target_preview: reply.body,
    metadata:       { new_body: body.trim().slice(0, 200) },
  })

  return NextResponse.json({ ok: true })
}

// DELETE /api/forum/replies/[id] — soft delete reply
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const session = getSessionUser(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = params

  const { data: reply } = await supabaseAdmin
    .from('replies').select('*').eq('id', id).maybeSingle()

  if (!reply || reply.deleted)
    return NextResponse.json({ error: 'Reply not found' }, { status: 404 })

  const isOwner = reply.author_id === session.id
  const isAdmin = session.role === 'admin'
  if (!isOwner && !isAdmin)
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  await supabaseAdmin.from('replies').update({
    deleted:         true,
    deleted_at:      new Date().toISOString(),
    deleted_by:      session.username,
    deleted_by_self: isOwner && !isAdmin,
    original_body:   reply.body,
    body:            '[deleted]',
  }).eq('id', id)

  await writeAuditLog({
    action:         isAdmin && !isOwner ? 'admin_delete_reply' : 'delete_reply',
    actor_id:       session.id,
    actor_name:     session.username,
    target_type:    'reply',
    target_id:      id,
    target_preview: reply.body,
    metadata:       { original_body: reply.body.slice(0, 200) },
  })

  return NextResponse.json({ ok: true })
}

// GET /api/forum/replies/[id] — get edit history (admin only)
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const session = getSessionUser(req)
  if (session?.role !== 'admin')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data: edits } = await supabaseAdmin
    .from('reply_edits')
    .select('*, editor:edited_by(username)')
    .eq('reply_id', params.id)
    .order('edited_at', { ascending: false })

  return NextResponse.json({ edits: edits || [] })
}
