import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

// GET /api/forum/votes?target_type=thread&target_ids=id1,id2,...
// Returns vote counts + current user's vote for each target
export async function GET(req: Request) {
  const session = getSessionUser(req)
  const { searchParams } = new URL(req.url)
  const target_type = searchParams.get('target_type') // 'thread' | 'reply'
  const target_ids  = searchParams.get('target_ids')?.split(',').filter(Boolean) || []

  if (!target_type || target_ids.length === 0)
    return NextResponse.json({ votes: {} })

  // Fetch user's own votes if logged in
  let myVotes: Record<string, number> = {}
  if (session) {
    const { data } = await supabaseAdmin
      .from('votes')
      .select('target_id, value')
      .eq('user_id', session.id)
      .eq('target_type', target_type)
      .in('target_id', target_ids)

    for (const v of data || []) {
      myVotes[v.target_id] = v.value
    }
  }

  // Fetch counts from threads/replies table directly (denormalized)
  const table = target_type === 'thread' ? 'threads' : 'replies'
  const { data: counts } = await supabaseAdmin
    .from(table)
    .select('id, upvotes, downvotes')
    .in('id', target_ids)

  const result: Record<string, { upvotes: number; downvotes: number; myVote: number }> = {}
  for (const row of counts || []) {
    result[row.id] = {
      upvotes:   row.upvotes   || 0,
      downvotes: row.downvotes || 0,
      myVote:    myVotes[row.id] || 0,
    }
  }

  return NextResponse.json({ votes: result })
}

// POST /api/forum/votes
// body: { target_type, target_id, value }
// value: 1 = upvote, -1 = downvote, 0 = remove vote
export async function POST(req: Request) {
  const session = getSessionUser(req)
  if (!session)
    return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 })

  const { target_type, target_id, value } = await req.json()

  if (!target_type || !target_id || ![-1, 0, 1].includes(value))
    return NextResponse.json({ error: 'Invalid params' }, { status: 400 })

  if (!['thread', 'reply'].includes(target_type))
    return NextResponse.json({ error: 'Invalid target_type' }, { status: 400 })

  // Check existing vote
  const { data: existing } = await supabaseAdmin
    .from('votes')
    .select('id, value')
    .eq('user_id', session.id)
    .eq('target_type', target_type)
    .eq('target_id', target_id)
    .maybeSingle()

  if (value === 0) {
    // Remove vote
    if (existing) {
      await supabaseAdmin.from('votes').delete().eq('id', existing.id)
    }
  } else if (existing) {
    if (existing.value === value) {
      // Same vote → toggle off (remove)
      await supabaseAdmin.from('votes').delete().eq('id', existing.id)
      // Return with myVote = 0
      return NextResponse.json(await getUpdatedCounts(target_type, target_id, session.id))
    } else {
      // Different vote → update
      await supabaseAdmin.from('votes')
        .update({ value, updated_at: new Date().toISOString() })
        .eq('id', existing.id)
    }
  } else {
    // New vote
    await supabaseAdmin.from('votes').insert({
      user_id:     session.id,
      target_type,
      target_id,
      value,
    })
  }

  return NextResponse.json(await getUpdatedCounts(target_type, target_id, session.id))
}

async function getUpdatedCounts(target_type: string, target_id: string, userId: string) {
  const table = target_type === 'thread' ? 'threads' : 'replies'

  const { data: counts } = await supabaseAdmin
    .from(table)
    .select('upvotes, downvotes')
    .eq('id', target_id)
    .single()

  const { data: myVoteRow } = await supabaseAdmin
    .from('votes')
    .select('value')
    .eq('user_id', userId)
    .eq('target_type', target_type)
    .eq('target_id', target_id)
    .maybeSingle()

  return {
    upvotes:   counts?.upvotes   || 0,
    downvotes: counts?.downvotes || 0,
    myVote:    myVoteRow?.value  || 0,
  }
}
