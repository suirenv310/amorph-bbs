'use client'
import { useState } from 'react'

interface Props {
  onCreated: (room: any) => void
  onCancel:  () => void
}

export default function CreateRoomModal({ onCreated, onCancel }: Props) {
  const [name,        setName]        = useState('')
  const [description, setDescription] = useState('')
  const [password,    setPassword]    = useState('')
  const [autoDelete,  setAutoDelete]  = useState(true)
  const [error,       setError]       = useState('')
  const [loading,     setLoading]     = useState(false)

  const submit = async () => {
    if (!name.trim()) { setError('Tên room không được trống'); return }
    setError(''); setLoading(true)
    try {
      // Create room
      const r = await fetch('/api/chat/rooms', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ name: name.trim(), description }),
      })
      const data = await r.json()
      if (!r.ok) throw new Error(data.error)

      // Set password + auto_delete if needed
      if (password || autoDelete !== true) {
        await fetch(`/api/chat/rooms/${data.room.id}`, {
          method:  'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ password: password || undefined, auto_delete: autoDelete }),
        })
      }

      onCreated({ ...data.room, has_password: !!password })
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="overlay" onClick={e => e.target === e.currentTarget && onCancel()}>
      <div className="modal-box" style={{ width: 380 }}>
        <button onClick={onCancel} style={{ position: 'absolute', top: 10, right: 14, background: 'none', border: 'none', color: 'var(--textMuted)', fontSize: 17, cursor: 'pointer' }}>✕</button>
        <div style={{ fontFamily: "'Orbitron', monospace", fontSize: 14, color: 'var(--cyan)', textAlign: 'center', letterSpacing: 2, marginBottom: 4 }}>NEW CHANNEL</div>
        <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 10, color: 'var(--textMuted)', textAlign: 'center', marginBottom: 20 }}>// create a chatroom //</div>

        <label style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 10, color: 'var(--textDim)', letterSpacing: 2, display: 'block', marginBottom: 5 }}>NAME</label>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="channel-name..." maxLength={24} className="input-base" style={{ display: 'block', marginBottom: 12 }} />

        <label style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 10, color: 'var(--textDim)', letterSpacing: 2, display: 'block', marginBottom: 5 }}>DESCRIPTION (optional)</label>
        <input value={description} onChange={e => setDescription(e.target.value)} placeholder="What's this room for?" className="input-base" style={{ display: 'block', marginBottom: 12 }} />

        <label style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 10, color: 'var(--textDim)', letterSpacing: 2, display: 'block', marginBottom: 5 }}>
          PASSWORD <span style={{ color: 'var(--textMuted)' }}>(leave empty = public)</span>
        </label>
        <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="set a password to make private..." className="input-base" style={{ display: 'block', marginBottom: 16 }} />

        {/* Auto-delete toggle */}
        <div onClick={() => setAutoDelete(!autoDelete)} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', padding: '8px 0', userSelect: 'none' }}>
          <div style={{
            width: 32, height: 18, borderRadius: 9, transition: 'background .2s',
            background: autoDelete ? 'var(--green)' : 'var(--border)',
            position: 'relative', flexShrink: 0,
          }}>
            <div style={{
              width: 14, height: 14, borderRadius: '50%', background: 'white',
              position: 'absolute', top: 2, transition: 'left .2s',
              left: autoDelete ? 16 : 2,
            }} />
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>Auto-delete when empty</div>
            <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 9, color: 'var(--textMuted)' }}>Room tự xóa khi tất cả member out</div>
          </div>
        </div>

        {error && (
          <div style={{ marginTop: 10, color: 'var(--red)', fontFamily: "'Share Tech Mono', monospace", fontSize: 10 }}>⚠ {error}</div>
        )}

        <button onClick={submit} disabled={loading} className="btn-primary" style={{ width: '100%', marginTop: 16 }}>
          {loading ? '...' : 'CREATE'}
        </button>
      </div>
    </div>
  )
}
