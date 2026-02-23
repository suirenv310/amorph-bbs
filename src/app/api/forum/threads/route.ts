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
       media_urls, media_types, is_spoiler, visibility,
       author:author_id(id, username, discord_username, verify_code),
       author_profile:author_profile_id(id, display_name, avatar, color)`
    : `id, title, tag, is_pinned, reply_count, created_at, updated_at,
       media_urls, media_types, is_spoiler, visibility,
       author_profile:author_profile_id(id, display_name, avatar, color)`

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
  if (!session.is_verified && session.role !== 'admin') return NextResponse.json({ error: 'Cần verify code để đăng bài' }, { status: 403 })

  const { title, body, tag, profile_id, media_urls, media_types, is_spoiler, visibility } = await req.json()

  if (!title?.trim() || !body?.trim())
    return NextResponse.json({ error: 'Thiếu title hoặc nội dung' }, { status: 400 })

  // Verify profile belongs to user
  let resolvedProfileId = profile_id
  if (profile_id) {
    const { data: p } = await supabaseAdmin
      .from('profiles').select('user_id').eq('id', profile_id).maybeSingle()
    if (!p || p.user_id !== session.id) resolvedProfileId = null
  }

  // 'public' chỉ hợp lệ khi có profile
  const resolvedVisibility = (visibility === 'public' && resolvedProfileId) ? 'public' : 'anon'

  const { data, error } = await supabaseAdmin
    .from('threads')
    .insert({
      title:             title.trim(),
      body:              body.trim(),
      tag:               tag || 'new',
      author_id:         session.id,
      author_profile_id: resolvedProfileId,
      media_urls:        Array.isArray(media_urls)  ? media_urls  : [],
      media_types:       Array.isArray(media_types) ? media_types : [],
      is_spoiler:        !!is_spoiler,
      visibility:        resolvedVisibility,
    })
    .select('id, title, tag, is_pinned, reply_count, created_at, media_urls, media_types, is_spoiler, visibility')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ thread: data })
}
