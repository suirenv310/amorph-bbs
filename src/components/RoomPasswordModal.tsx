'use client'
import { useState } from 'react'

interface Props {
  roomName: string
  roomId:   string
  onSuccess: () => void
  onCancel:  () => void
}

export default function RoomPasswordModal({ roomName, roomId, onSuccess, onCancel }: Props) {
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)

  const submit = async () => {
    if (!password) return
    setError(''); setLoading(true)
    try {
      const r = await fetch(`/api/chat/rooms/${roomId}`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ action: 'join', password }),
      })
      const data = await r.json()
      if (!r.ok) throw new Error(data.error)
      onSuccess()
    } catch (e: any) {
      setError(e.message === 'Wrong password' ? 'Sai password' : e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="overlay" onClick={e => e.target === e.currentTarget && onCancel()}>
      <div className="modal-box" style={{ width: 340, textAlign: 'center' }}>
        <div style={{ fontFamily: "'Orbitron', monospace", fontSize: 14, color: 'var(--yellow)', letterSpacing: 3, marginBottom: 6 }}>
          🔒 PRIVATE ROOM
        </div>
        <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 10, color: 'var(--textMuted)', marginBottom: 20, letterSpacing: 1 }}>
          #{roomName.toLowerCase()} requires a password
        </div>

        <input
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && submit()}
          placeholder="enter password..."
          autoFocus
          className="input-base"
          style={{ textAlign: 'center', letterSpacing: 2, marginBottom: 12, display: 'block' }}
        />

        {error && (
          <div style={{ color: 'var(--red)', fontFamily: "'Share Tech Mono', monospace", fontSize: 10, marginBottom: 10 }}>
            ⚠ {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={submit} disabled={loading} className="btn-primary" style={{ flex: 1, padding: '10px 0', fontSize: 10 }}>
            {loading ? '...' : 'ENTER'}
          </button>
          <button onClick={onCancel} className="btn-outline" style={{ padding: '10px 14px' }}>
            CANCEL
          </button>
        </div>
      </div>
    </div>
  )
}
