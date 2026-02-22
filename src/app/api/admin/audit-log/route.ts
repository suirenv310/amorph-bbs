import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

// GET /api/admin/audit-log?action=&limit=50&offset=0
export async function GET(req: Request) {
  const session = getSessionUser(req)
  if (session?.role !== 'admin')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const action  = searchParams.get('action') || ''
  const search  = searchParams.get('search') || ''
  const limit   = parseInt(searchParams.get('limit')  || '60')
  const offset  = parseInt(searchParams.get('offset') || '0')

  let query = supabaseAdmin
    .from('audit_logs')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (action) query = query.eq('action', action)
  if (search) query = query.or(
    `actor_name.ilike.%${search}%,target_preview.ilike.%${search}%`
  )

  const { data, count, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ logs: data || [], total: count || 0 })
}
