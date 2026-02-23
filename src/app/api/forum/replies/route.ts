import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

// GET /api/forum/replies?thread_id=
export async function GET(req: Request) {
  const session = getSessionUser(req)
  const isAdmin = session?.role === 'admin'

  const { searchParams } = new URL(req.url)
  const thread_id = searchParams.get('thread_id')
  if (!thread_id) return NextResponse.json({ error: 'Thiếu thread_id' }, { status: 400 })

  const select = isAdmin
    ? `id, body, created_at, media_urls, media_types, is_spoiler, visibility,
       author:author_id(id, username, discord_username, verify_code),
       author_profile:author_profile_id(id, display_name, avatar, color)`
    : `id, body, created_at, media_urls, media_types, is_spoiler, visibility,
       author_profile:author_profile_id(id, display_name, avatar, color)`

  const { data, error } = await supabaseAdmin
    .from('replies')
    .select(select)
    .eq('thread_id', thread_id)
    .eq('deleted', false)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ replies: data })
}

// POST /api/forum/replies — requires is_verified
export async function POST(req: Request) {
  const session = getSessionUser(req)
  if (!session)             return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 })
  if (!session.is_verified && session.role !== 'admin') return NextResponse.json({ error: 'Cần verify code để comment' }, { status: 403 })

  const { thread_id, body, profile_id, media_urls, media_types, is_spoiler, visibility } = await req.json()
  if (!thread_id || !body?.trim())
    return NextResponse.json({ error: 'Thiếu thread_id hoặc nội dung' }, { status: 400 })

  let resolvedProfileId = profile_id
  if (profile_id) {
    const { data: p } = await supabaseAdmin
      .from('profiles').select('user_id').eq('id', profile_id).maybeSingle()
    if (!p || p.user_id !== session.id) resolvedProfileId = null
  }

  const resolvedVisibility = (visibility === 'public' && resolvedProfileId) ? 'public' : 'anon'

  const { data, error } = await supabaseAdmin
    .from('replies')
    .insert({
      thread_id,
      body:              body.trim(),
      author_id:         session.id,
      author_profile_id: resolvedProfileId,
      media_urls:        Array.isArray(media_urls)  ? media_urls  : [],
      media_types:       Array.isArray(media_types) ? media_types : [],
      is_spoiler:        !!is_spoiler,
      visibility:        resolvedVisibility,
    })
    .select('id, body, created_at, media_urls, media_types, is_spoiler, visibility')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ reply: data })
}
