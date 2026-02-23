import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

function requireAdmin(req: Request) {
  const session = getSessionUser(req)
  if (!session || session.role !== 'admin')
    throw new Error('Forbidden')
  return session
}

// POST /api/admin — general admin actions
export async function POST(req: Request) {
  try {
    const session = requireAdmin(req)
    const { action, target_id, reason, tag } = await req.json()

    switch (action) {

      // ── USER ACTIONS ─────────────────────────────────────
      case 'ban_user':
        await supabaseAdmin.from('users')
          .update({ is_banned: true, is_verified: false, ban_reason: reason || 'Banned by admin' })
          .eq('id', target_id)
        return NextResponse.json({ ok: true })

      case 'unban_user':
        await supabaseAdmin.from('users')
          .update({ is_banned: false, ban_reason: null })
          .eq('id', target_id)
        return NextResponse.json({ ok: true })

      case 'revoke_code':
        // Revoke invite code + unverify + unbind discord
        const { data: user } = await supabaseAdmin
          .from('users').select('verify_code').eq('id', target_id).single()
        if (user?.verify_code) {
          await supabaseAdmin.from('invite_codes')
            .update({ revoked: true, revoked_by: session.username, revoke_reason: reason, revoked_at: new Date().toISOString() })
            .eq('code', user.verify_code)
        }
        await supabaseAdmin.from('users')
          .update({
            is_verified:      false,
            verify_code:      null,
            discord_user_id:  null,
            discord_username: null,
          })
          .eq('id', target_id)
        return NextResponse.json({ ok: true })

      // ── THREAD ACTIONS ────────────────────────────────────
      case 'delete_thread':
        await supabaseAdmin.from('threads')
          .update({ deleted: true, deleted_by: session.username })
          .eq('id', target_id)
        return NextResponse.json({ ok: true })

      case 'pin_thread':
        await supabaseAdmin.from('threads')
          .update({ is_pinned: true, tag: 'pinned' })
          .eq('id', target_id)
        return NextResponse.json({ ok: true })

      case 'unpin_thread':
        await supabaseAdmin.from('threads')
          .update({ is_pinned: false, tag: tag || 'discussion' })
          .eq('id', target_id)
        return NextResponse.json({ ok: true })

      // ── REPLY ACTIONS ─────────────────────────────────────
      case 'delete_reply':
        await supabaseAdmin.from('replies')
          .update({ deleted: true, deleted_by: session.username })
          .eq('id', target_id)
        return NextResponse.json({ ok: true })

      // ── MESSAGE ACTIONS ───────────────────────────────────
      case 'delete_message':
        await supabaseAdmin.from('messages')
          .update({ deleted: true, deleted_by: session.username })
          .eq('id', target_id)
        return NextResponse.json({ ok: true })

      // ── ROOM ACTIONS ──────────────────────────────────────
      case 'delete_room':
        const { data: room } = await supabaseAdmin
          .from('rooms').select('is_protected').eq('id', target_id).single()
        if (room?.is_protected)
          return NextResponse.json({ error: 'Room được bảo vệ, không thể xóa' }, { status: 400 })
        await supabaseAdmin.from('rooms').delete().eq('id', target_id)
        return NextResponse.json({ ok: true })

      case 'create_room':
        const { name, description } = await req.json().catch(() => ({}))
        // handled separately below
        return NextResponse.json({ error: 'Use dedicated endpoint' }, { status: 400 })

      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
    }
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 403 })
  }
}

// GET /api/admin?section=users|codes|overview
export async function GET(req: Request) {
  try {
    requireAdmin(req)
    const { searchParams } = new URL(req.url)
    const section = searchParams.get('section')

    if (section === 'users') {
      const { data } = await supabaseAdmin
        .from('users')
        .select('id, username, role, is_verified, is_banned, ban_reason, discord_username, verify_code, created_at')
        .order('created_at', { ascending: false })
      return NextResponse.json({ users: data })
    }

    if (section === 'codes') {
      const { data } = await supabaseAdmin
        .from('invite_codes')
        .select('*, used_by:used_by_user_id(username)')
        .order('issued_at', { ascending: false })
      return NextResponse.json({ codes: data })
    }

    if (section === 'overview') {
      const [users, verified, banned, threads, messages, codes] = await Promise.all([
        supabaseAdmin.from('users').select('id', { count: 'exact', head: true }),
        supabaseAdmin.from('users').select('id', { count: 'exact', head: true }).eq('is_verified', true),
        supabaseAdmin.from('users').select('id', { count: 'exact', head: true }).eq('is_banned', true),
        supabaseAdmin.from('threads').select('id', { count: 'exact', head: true }).eq('deleted', false),
        supabaseAdmin.from('messages').select('id', { count: 'exact', head: true }).eq('deleted', false),
        supabaseAdmin.from('invite_codes').select('code', { count: 'exact', head: true }),
      ])
      return NextResponse.json({
        overview: {
          users:    users.count,
          verified: verified.count,
          banned:   banned.count,
          threads:  threads.count,
          messages: messages.count,
          codes:    codes.count,
        }
      })
    }

    return NextResponse.json({ error: 'Unknown section' }, { status: 400 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 403 })
  }
}
