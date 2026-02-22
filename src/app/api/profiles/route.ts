import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

// GET /api/profiles — list my profiles
export async function GET(req: Request) {
  const session = getSessionUser(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('*')
    .eq('user_id', session.id)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ profiles: data })
}

// POST /api/profiles — create new profile (max 5)
export async function POST(req: Request) {
  const session = getSessionUser(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { display_name, avatar, color } = await req.json()

  if (!display_name?.trim())
    return NextResponse.json({ error: 'Tên profile không được trống' }, { status: 400 })

  // Check count
  const { count } = await supabaseAdmin
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', session.id)

  if ((count ?? 0) >= 5)
    return NextResponse.json({ error: 'Tối đa 5 profiles' }, { status: 400 })

  const { data, error } = await supabaseAdmin
    .from('profiles')
    .insert({
      user_id:      session.id,
      display_name: display_name.trim(),
      avatar:       avatar || '◈',
      color:        color  || '#00d4ff',
      is_default:   false,
    })
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ profile: data })
}

// PATCH /api/profiles — set active profile (stored in JWT is client-side;
//   here we update is_default)
export async function PATCH(req: Request) {
  const session = getSessionUser(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { profile_id, display_name, avatar, color, set_default } = await req.json()

  // Verify ownership
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('user_id')
    .eq('id', profile_id)
    .maybeSingle()

  if (!profile || profile.user_id !== session.id)
    return NextResponse.json({ error: 'Profile không tìm thấy' }, { status: 404 })

  if (set_default) {
    // Clear other defaults
    await supabaseAdmin
      .from('profiles')
      .update({ is_default: false })
      .eq('user_id', session.id)

    await supabaseAdmin
      .from('profiles')
      .update({ is_default: true })
      .eq('id', profile_id)
  }

  if (display_name || avatar || color) {
    const updates: any = {}
    if (display_name) updates.display_name = display_name.trim()
    if (avatar)       updates.avatar       = avatar
    if (color)        updates.color        = color

    await supabaseAdmin.from('profiles').update(updates).eq('id', profile_id)
  }

  return NextResponse.json({ ok: true })
}

// DELETE /api/profiles?id=xxx
export async function DELETE(req: Request) {
  const session = getSessionUser(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Thiếu id' }, { status: 400 })

  // Verify ownership + not default
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('user_id, is_default')
    .eq('id', id)
    .maybeSingle()

  if (!profile || profile.user_id !== session.id)
    return NextResponse.json({ error: 'Không tìm thấy' }, { status: 404 })

  if (profile.is_default)
    return NextResponse.json({ error: 'Không thể xóa profile mặc định' }, { status: 400 })

  await supabaseAdmin.from('profiles').delete().eq('id', id)
  return NextResponse.json({ ok: true })
}
