import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('rooms')
    .select('*')
    .order('created_at', { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ rooms: data })
}

export async function POST(req: Request) {
  const session = getSessionUser(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { name, description } = await req.json()
  const cleaned = name?.trim().toUpperCase().replace(/\s+/g, '-').replace(/[^A-Z0-9\-]/g, '')
  if (!cleaned) return NextResponse.json({ error: 'Tên không hợp lệ' }, { status: 400 })

  const { data, error } = await supabaseAdmin
    .from('rooms')
    .insert({ name: cleaned, description: description || '', created_by: session.id })
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ room: data })
}
