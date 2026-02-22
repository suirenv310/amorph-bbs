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
      content:   `[${entry.action.toUpperCase()}] ${entry.actor_name} → "${entry.target_preview.slice(0,80)}" ${entry.metadata ? JSON.stringify(entry.metadata) : ''}`,
    })
  }
}

// PATCH /api/forum/threads/[id] — edit thread (owner or admin)
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = getSessionUser(req)
  if (!session)             return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!session.is_verified) return NextResponse.json({ error: 'Not verified' }, { status: 403 })

  const { id }    = params
  const { title, body, tag } = await req.json()

  const { data: thread } = await supabaseAdmin
    .from('threads').select('*').eq('id', id).maybeSingle()

  if (!thread || thread.deleted)
    return NextResponse.json({ error: 'Thread not found' }, { status: 404 })

  const isOwner = thread.author_id === session.id
  const isAdmin = session.role === 'admin'
  if (!isOwner && !isAdmin)
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Save edit history before updating
  await supabaseAdmin.from('thread_edits').insert({
    thread_id: id,
    old_title: thread.title,
    old_body:  thread.body,
    edited_by: session.id,
  })

  const updates: any = {
    edited:     true,
    edited_at:  new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
  if (title) updates.title = title.trim()
  if (body)  updates.body  = body.trim()
  if (tag)   updates.tag   = tag

  await supabaseAdmin.from('threads').update(updates).eq('id', id)

  // Audit log
  await writeAuditLog({
    action:         'edit_thread',
    actor_id:       session.id,
    actor_name:     session.username,
    target_type:    'thread',
    target_id:      id,
    target_preview: thread.title,
    metadata:       { old_title: thread.title, new_title: title || thread.title },
  })

  return NextResponse.json({ ok: true })
}

// DELETE /api/forum/threads/[id] — soft delete (owner or admin)
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const session = getSessionUser(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = params

  const { data: thread } = await supabaseAdmin
    .from('threads').select('*').eq('id', id).maybeSingle()

  if (!thread || thread.deleted)
    return NextResponse.json({ error: 'Thread not found' }, { status: 404 })

  const isOwner = thread.author_id === session.id
  const isAdmin = session.role === 'admin'
  if (!isOwner && !isAdmin)
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Soft delete — preserve original content for admin
  await supabaseAdmin.from('threads').update({
    deleted:          true,
    deleted_at:       new Date().toISOString(),
    deleted_by:       session.username,
    deleted_by_self:  isOwner && !isAdmin,
    original_title:   thread.title,
    original_body:    thread.body,
    // Replace visible content
    title:            '[deleted]',
    body:             '[deleted]',
  }).eq('id', id)

  // Audit log
  await writeAuditLog({
    action:         isAdmin && !isOwner ? 'admin_delete_thread' : 'delete_thread',
    actor_id:       session.id,
    actor_name:     session.username,
    target_type:    'thread',
    target_id:      id,
    target_preview: thread.title,
    metadata:       { original_body: thread.body.slice(0, 200) },
  })

  return NextResponse.json({ ok: true })
}

// GET /api/forum/threads/[id] — get single thread with edit history (admin only)
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const session = getSessionUser(req)
  const isAdmin = session?.role === 'admin'
  const { id }  = params

  const { data: thread } = await supabaseAdmin
    .from('threads')
    .select(isAdmin
      ? '*, author:author_id(id,username,discord_username,verify_code)'
      : 'id,title,body,tag,is_pinned,reply_count,edited,edited_at,created_at,updated_at,deleted'
    )
    .eq('id', id)
    .maybeSingle()

  if (!thread) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Admin: also return edit history + original content if deleted
  let editHistory = null
  if (isAdmin) {
    const { data: edits } = await supabaseAdmin
      .from('thread_edits')
      .select('*, editor:edited_by(username)')
      .eq('thread_id', id)
      .order('edited_at', { ascending: false })
    editHistory = edits || []
  }

  // Non-admin: hide original content
  if (!isAdmin && thread.deleted) {
    thread.original_title = undefined
    thread.original_body  = undefined
  }

  return NextResponse.json({ thread, editHistory })
}
