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

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = getSessionUser(req)
  if (!session)             return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!session.is_verified) return NextResponse.json({ error: 'Not verified' }, { status: 403 })

  const { id }    = params
  const { title, body, tag } = await req.json()

  const { data: thread } = await supabaseAdmin
    .from('threads').select('*').eq('id', id).maybeSingle()

  if (!thread || (thread as any).deleted)
    return NextResponse.json({ error: 'Thread not found' }, { status: 404 })

  const isOwner = (thread as any).author_id === session.id
  const isAdmin = session.role === 'admin'
  if (!isOwner && !isAdmin)
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  await supabaseAdmin.from('thread_edits').insert({
    thread_id: id,
    old_title: (thread as any).title,
    old_body:  (thread as any).body,
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

  await writeAuditLog({
    action:         'edit_thread',
    actor_id:       session.id,
    actor_name:     session.username,
    target_type:    'thread',
    target_id:      id,
    target_preview: (thread as any).title,
    metadata:       { old_title: (thread as any).title, new_title: title || (thread as any).title },
  })

  return NextResponse.json({ ok: true })
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const session = getSessionUser(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = params

  const { data: thread } = await supabaseAdmin
    .from('threads').select('*').eq('id', id).maybeSingle()

  if (!thread || (thread as any).deleted)
    return NextResponse.json({ error: 'Thread not found' }, { status: 404 })

  const isOwner = (thread as any).author_id === session.id
  const isAdmin = session.role === 'admin'
  if (!isOwner && !isAdmin)
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  await supabaseAdmin.from('threads').update({
    deleted:          true,
    deleted_at:       new Date().toISOString(),
    deleted_by:       session.username,
    deleted_by_self:  isOwner && !isAdmin,
    original_title:   (thread as any).title,
    original_body:    (thread as any).body,
    title:            '[deleted]',
    body:             '[deleted]',
  }).eq('id', id)

  await writeAuditLog({
    action:         isAdmin && !isOwner ? 'admin_delete_thread' : 'delete_thread',
    actor_id:       session.id,
    actor_name:     session.username,
    target_type:    'thread',
    target_id:      id,
    target_preview: (thread as any).title,
    metadata:       { original_body: (thread as any).body.slice(0, 200) },
  })

  return NextResponse.json({ ok: true })
}

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const session = getSessionUser(req)
  const isAdmin = session?.role === 'admin'
  const { id }  = params

  const { data: thread } = await supabaseAdmin
    .from('threads')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (!thread) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  let editHistory = null
  if (isAdmin) {
    const { data: edits } = await supabaseAdmin
      .from('thread_edits')
      .select('*, editor:edited_by(username)')
      .eq('thread_id', id)
      .order('edited_at', { ascending: false })
    editHistory = edits || []
  }

  const result = { ...thread } as any
  if (!isAdmin && result.deleted) {
    result.original_title = undefined
    result.original_body  = undefined
  }

  return NextResponse.json({ thread: result, editHistory })
}
