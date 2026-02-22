import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const { data, error } = await supabaseAdmin
    .from('room_members')
    .select('user_id, joined_at, user:user_id(id, username, avatar_url)')
    .eq('room_id', params.id)
    .order('joined_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const members = (data || []).map((m: any) => ({
    user_id:   m.user_id,
    username:  m.user?.username || '???',
    avatar_url: m.user?.avatar_url || null,
    joined_at: m.joined_at,
  }))

  return NextResponse.json({ members })
}
