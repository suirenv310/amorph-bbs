import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(req: Request) {
  const session = getSessionUser(req)
  if (!session) return NextResponse.json({ user: null })

  // Re-fetch live status (ban/verify may have changed)
  const { data: user } = await supabaseAdmin
    .from('users')
    .select('id, username, role, is_verified, is_banned')
    .eq('id', session.id)
    .maybeSingle()

  if (!user) return NextResponse.json({ user: null })
  return NextResponse.json({ user: { ...session, ...user } })
}
