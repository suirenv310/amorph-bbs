'use client'
import { useState, useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'

interface Member {
  user_id:  string
  username: string
  avatar_url?: string
  joined_at: string
}

interface BannedUser {
  id:       string
  user_id:  string
  username: string
  reason?:  string
}

interface Props {
  roomId:    string
  ownerId:   string
  onDmClick: (partner: { id: string; username: string; avatar_url?: string }) => void
}

export default function MemberList({ roomId, ownerId, onDmClick }: Props) {
  const { user } = useAuth()
  const [members,  setMembers]  = useState<Member[]>([])
  const [banned,   setBanned]   = useState<BannedUser[]>([])
  const [showBans, setShowBans] = useState(false)
  const [confirm,  setConfirm]  = useState<{ msg: string; cb: () => void } | null>(null)

  const isOwner = user?.id === ownerId
  const isAdmin = user?.role === 'admin'
  const canManage = isOwner || isAdmin

  useEffect(() => {
    fetchMembers()
    if (canManage) fetchBanned()
  }, [roomId])

  const fetchMembers = async () => {
    const { data } = await (await fetch(`/api/chat/rooms/${roomId}/members`)).json().catch(() => ({ data: [] }))
    // fallback: supabase join
    const r = await fetch(`/api/chat/rooms/${roomId}/members`)
    const json = await r.json()
    setMembers(json.members || [])
  }

  const fetchBanned = async () => {
    const r = await fetch(`/api/chat/rooms/${roomId}/ban`)
    const json = await r.json()
    setBanned((json.bans || []).map((b: any) => ({
      id:       b.id,
      user_id:  b.user_id,
      username: b.user?.username || '???',
      reason:   b.reason,
    })))
  }

  const kick = async (userId: string, username: string) => {
    setConfirm({
      msg: `Kick "${username}" khỏi room? Họ vẫn vào lại được.`,
      cb:  async () => {
        await fetch(`/api/chat/rooms/${roomId}/kick`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body:   JSON.stringify({ user_id: userId }),
        })
        fetchMembers()
      }
    })
  }

  const ban = async (userId: string, username: string) => {
    setConfirm({
      msg: `Ban "${username}" khỏi room? Họ sẽ không vào lại được.`,
      cb:  async () => {
        await fetch(`/api/chat/rooms/${roomId}/ban`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body:   JSON.stringify({ user_id: userId }),
        })
        fetchMembers(); fetchBanned()
      }
    })
  }

  const unban = async (userId: string, username: string) => {
    setConfirm({
      msg: `Unban "${username}"?`,
      cb:  async () => {
        await fetch(`/api/chat/rooms/${roomId}/ban?user_id=${userId}`, { method: 'DELETE' })
        fetchBanned()
      }
    })
  }

  const transfer = async (userId: string, username: string) => {
    setConfirm({
      msg: `Transfer quyền chủ room cho "${username}"? Bạn sẽ mất quyền quản lý.`,
      cb:  async () => {
        await fetch(`/api/chat/rooms/${roomId}/transfer`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body:   JSON.stringify({ new_owner_id: userId }),
        })
        fetchMembers()
      }
    })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Members */}
      <div className="sec-head">MEMBERS ({members.length})</div>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {members.map(m => (
          <div key={m.user_id} style={{
            padding: '6px 11px', display: 'flex', alignItems: 'center', gap: 7,
            borderBottom: '1px solid rgba(255,255,255,.03)',
            background: m.user_id === ownerId ? 'rgba(240,192,64,.03)' : 'none',
          }}>
            {/* Avatar — click to DM */}
            <div
              onClick={() => user && m.user_id !== user.id && onDmClick({ id: m.user_id, username: m.username, avatar_url: m.avatar_url })}
              style={{
                width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
                background: 'var(--cyan)', overflow: 'hidden', cursor: m.user_id !== user?.id ? 'pointer' : 'default',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: "'Orbitron', monospace", fontSize: 11, fontWeight: 900, color: '#000',
                transition: 'box-shadow .15s',
              }}
              title={m.user_id !== user?.id ? `DM ${m.username}` : 'You'}
              onMouseEnter={e => { if (m.user_id !== user?.id) (e.currentTarget as HTMLElement).style.boxShadow = '0 0 8px var(--cyan)' }}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.boxShadow = 'none'}
            >
              {m.avatar_url
                ? <img src={m.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : m.username[0].toUpperCase()
              }
            </div>

            <div style={{ flex: 1, overflow: 'hidden' }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: m.user_id === ownerId ? 'var(--yellow)' : 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {m.username}
                {m.user_id === ownerId && <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 8, color: 'var(--yellow)', marginLeft: 5 }}>OWNER</span>}
                {m.user_id === user?.id && <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 8, color: 'var(--cyan)', marginLeft: 5 }}>YOU</span>}
              </div>
            </div>

            {/* Actions — chỉ owner/admin thấy, không hiện cho chính mình hoặc owner */}
            {canManage && m.user_id !== user?.id && m.user_id !== ownerId && (
              <div style={{ display: 'flex', gap: 3 }}>
                <button onClick={() => kick(m.user_id, m.username)} title="Kick" style={{ background: 'rgba(240,192,64,.08)', border: '1px solid rgba(240,192,64,.2)', color: 'var(--yellow)', fontSize: 9, padding: '2px 5px', cursor: 'pointer', fontFamily: "'Share Tech Mono', monospace" }}>KICK</button>
                <button onClick={() => ban(m.user_id, m.username)} title="Ban" style={{ background: 'rgba(255,58,90,.08)', border: '1px solid rgba(255,58,90,.2)', color: 'var(--red)', fontSize: 9, padding: '2px 5px', cursor: 'pointer', fontFamily: "'Share Tech Mono', monospace" }}>BAN</button>
                {isOwner && (
                  <button onClick={() => transfer(m.user_id, m.username)} title="Transfer ownership" style={{ background: 'rgba(0,212,255,.06)', border: '1px solid rgba(0,212,255,.2)', color: 'var(--cyan)', fontSize: 9, padding: '2px 5px', cursor: 'pointer', fontFamily: "'Share Tech Mono', monospace" }}>→</button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Banned list — chỉ owner/admin thấy */}
      {canManage && (
        <>
          <div className="sec-head" style={{ cursor: 'pointer' }} onClick={() => setShowBans(!showBans)}>
            BANNED ({banned.length}) {showBans ? '▲' : '▼'}
          </div>
          {showBans && (
            <div style={{ maxHeight: 140, overflowY: 'auto' }}>
              {banned.length === 0 && (
                <div style={{ padding: '8px 11px', fontFamily: "'Share Tech Mono', monospace", fontSize: 10, color: 'var(--textMuted)' }}>No banned users</div>
              )}
              {banned.map(b => (
                <div key={b.id} style={{ padding: '5px 11px', display: 'flex', alignItems: 'center', gap: 7, borderBottom: '1px solid rgba(255,58,90,.08)' }}>
                  <span style={{ fontSize: 12, color: 'var(--red)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.username}</span>
                  <button onClick={() => unban(b.user_id, b.username)} style={{ background: 'rgba(0,255,136,.06)', border: '1px solid rgba(0,255,136,.2)', color: 'var(--green)', fontSize: 9, padding: '2px 7px', cursor: 'pointer', fontFamily: "'Share Tech Mono', monospace" }}>UNBAN</button>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Confirm dialog */}
      {confirm && (
        <div className="overlay">
          <div className="modal-box" style={{ width: 320, textAlign: 'center' }}>
            <div style={{ fontSize: 13, color: 'var(--text)', marginBottom: 18, lineHeight: 1.6 }}>{confirm.msg}</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => { confirm.cb(); setConfirm(null) }} style={{ flex: 1, padding: 10, background: 'var(--red)', border: 'none', color: 'white', fontFamily: "'Orbitron', monospace", fontSize: 10, cursor: 'pointer', letterSpacing: 1 }}>CONFIRM</button>
              <button onClick={() => setConfirm(null)} className="btn-outline" style={{ flex: 1, padding: 10 }}>CANCEL</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
