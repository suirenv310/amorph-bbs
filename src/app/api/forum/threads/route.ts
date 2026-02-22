import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

// GET /api/forum/threads?search=&tag=
export async function GET(req: Request) {
  const session = getSessionUser(req)
  const isAdmin = session?.role === 'admin'

  const { searchParams } = new URL(req.url)
  const search = searchParams.get('search') || ''
  const tag    = searchParams.get('tag')    || ''

  // Admin sees author info, others don't
  const select = isAdmin
    ? `id, title, tag, is_pinned, reply_count, created_at, updated_at,
       author:author_id(id, username, discord_username, verify_code),
       author_profile:author_profile_id(id, display_name)`
    : `id, title, tag, is_pinned, reply_count, created_at, updated_at`

  let query = supabaseAdmin
    .from('threads')
    .select(select)
    .eq('deleted', false)
    .order('is_pinned', { ascending: false })
    .order('updated_at',  { ascending: false })

  if (search) query = query.or(`title.ilike.%${search}%,body.ilike.%${search}%`)
  if (tag)    query = query.eq('tag', tag)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ threads: data })
}

// POST /api/forum/threads — requires is_verified
export async function POST(req: Request) {
  const session = getSessionUser(req)
  if (!session)          return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 })
  if (!session.is_verified) return NextResponse.json({ error: 'Cần verify code để đăng bài' }, { status: 403 })

  const { title, body, tag, profile_id } = await req.json()

  if (!title?.trim() || !body?.trim())
    return NextResponse.json({ error: 'Thiếu title hoặc nội dung' }, { status: 400 })

  // Verify profile belongs to user
  let resolvedProfileId = profile_id
  if (profile_id) {
    const { data: p } = await supabaseAdmin
      .from('profiles').select('user_id').eq('id', profile_id).maybeSingle()
    if (!p || p.user_id !== session.id) resolvedProfileId = null
  }

  const { data, error } = await supabaseAdmin
    .from('threads')
    .insert({
      title:             title.trim(),
      body:              body.trim(),
      tag:               tag || 'new',
      author_id:         session.id,
      author_profile_id: resolvedProfileId,
    })
    .select('id, title, tag, is_pinned, reply_count, created_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ thread: data })
}
