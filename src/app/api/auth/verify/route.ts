import { NextResponse } from 'next/server'
import { getSessionUser, verifyInviteCode, createToken, sessionCookie } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(req: Request) {
  try {
    const session = getSessionUser(req)
    if (!session) return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 })

    const { code } = await req.json()
    if (!code) return NextResponse.json({ error: 'Thiếu code' }, { status: 400 })

    const result = await verifyInviteCode(session.id, code)

    // Re-fetch updated user
    const { data: user } = await supabaseAdmin
      .from('users')
      .select('id, username, role, is_verified, is_banned')
      .eq('id', session.id)
      .single()

    const newSession = { ...session, is_verified: true }
    const token = createToken(newSession)

    return NextResponse.json(
      { ok: true, discord_username: result.discord_username, user: newSession },
      { headers: { 'Set-Cookie': sessionCookie(token) } }
    )
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 })
  }
}
