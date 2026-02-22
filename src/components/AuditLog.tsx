'use client'
import { useState, useEffect } from 'react'

const ACTION_COLORS: Record<string, string> = {
  edit_thread:         '#44aaff',
  delete_thread:       '#ff3a5a',
  admin_delete_thread: '#ff3a5a',
  edit_reply:          '#44aaff',
  delete_reply:        '#ff3a5a',
  admin_delete_reply:  '#ff3a5a',
  delete_message:      '#ff8844',
  ban_user:            '#ff3a5a',
  unban_user:          '#00ff88',
  revoke_code:         '#f0c040',
  delete_room:         '#ff8844',
  create_room:         '#00ff88',
}

export default function AuditLog() {
  const [logs,    setLogs]    = useState<any[]>([])
  const [search,  setSearch]  = useState('')
  const [action,  setAction]  = useState('')
  const [loading, setLoading] = useState(false)
  const [total,   setTotal]   = useState(0)

  const fetchLogs = async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (search) params.set('search', search)
    if (action) params.set('action', action)
    params.set('limit', '80')

    const r = await fetch(`/api/admin/audit-log?${params}`)
    const data = await r.json()
    setLogs(data.logs || [])
    setTotal(data.total || 0)
    setLoading(false)
  }

  useEffect(() => { fetchLogs() }, [search, action])

  const uniqueActions = [...new Set(logs.map(l => l.action))]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="SEARCH LOGS..."
          style={{ background: '#070f09', border: '1px solid #1a3a1a', color: 'var(--white)', fontFamily: "'Share Tech Mono', monospace", fontSize: 11, padding: '8px 12px', outline: 'none', flex: 1, maxWidth: 280 }}
        />
        <select
          value={action}
          onChange={e => setAction(e.target.value)}
          style={{ background: '#070f09', border: '1px solid #1a3a1a', color: 'var(--white)', fontFamily: "'Share Tech Mono', monospace", fontSize: 10, padding: '8px 10px', outline: 'none', cursor: 'pointer' }}
        >
          <option value="">ALL ACTIONS</option>
          {Object.keys(ACTION_COLORS).map(a => (
            <option key={a} value={a}>{a.toUpperCase()}</option>
          ))}
        </select>
        <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 10, color: '#2a6a2a', marginLeft: 'auto' }}>
          {total} entries
        </span>
      </div>

      <div style={{ border: '1px solid #1a3a1a' }}>
        {/* Header */}
        <div style={{ display: 'grid', gridTemplateColumns: '110px 100px 1fr 120px', padding: '8px 12px', background: '#070f09', borderBottom: '1px solid #1a3a1a', fontFamily: "'Share Tech Mono', monospace", fontSize: 10, color: '#2a6a2a', letterSpacing: 1.5 }}>
          <span>TIME</span><span>ACTION</span><span>DETAILS</span><span>ACTOR</span>
        </div>

        {loading && (
          <div style={{ padding: 20, textAlign: 'center', fontFamily: "'Share Tech Mono', monospace", fontSize: 10, color: '#2a6a2a' }}>LOADING...</div>
        )}

        {!loading && logs.length === 0 && (
          <div style={{ padding: 24, textAlign: 'center', fontFamily: "'Share Tech Mono', monospace", fontSize: 10, color: '#1a4a1a' }}>NO LOGS FOUND</div>
        )}

        {!loading && logs.map((log, i) => (
          <div key={log.id} style={{
            display: 'grid', gridTemplateColumns: '110px 100px 1fr 120px',
            padding: '8px 12px', borderBottom: '1px solid rgba(0,80,0,.15)',
            fontSize: 12, alignItems: 'center', transition: 'background .1s',
          }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,255,136,.02)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'none')}
          >
            <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 10, color: 'var(--textMuted)' }}>
              {new Date(log.created_at).toLocaleString('vi', { month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' })}
            </span>
            <span style={{
              fontFamily: "'Share Tech Mono', monospace", fontSize: 9, padding: '2px 6px',
              background: `${ACTION_COLORS[log.action] || '#888'}18`,
              color: ACTION_COLORS[log.action] || '#888', width: 'fit-content', letterSpacing: 1,
            }}>
              {log.action.toUpperCase()}
            </span>
            <div style={{ overflow: 'hidden' }}>
              <div style={{ color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {log.target_preview}
              </div>
              {log.metadata?.original_body && (
                <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 9, color: 'var(--textMuted)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  original: {log.metadata.original_body}
                </div>
              )}
            </div>
            <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 10, color: 'var(--yellow)', textAlign: 'right' }}>
              {log.actor_name || 'system'}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
