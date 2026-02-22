'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useAuth } from '@/hooks/useAuth'

interface DmWindow {
  partner:    { id: string; username: string; avatar_url?: string }
  messages:   any[]
  minimized:  boolean
  unread:     number
}

interface Props {
  windows:    DmWindow[]
  onOpen:     (partner: { id: string; username: string; avatar_url?: string }) => void
  onClose:    (partnerId: string) => void
  onMinimize: (partnerId: string) => void
  onSend:     (partnerId: string, content: string) => void
}

export default function DmPopupStack({ windows, onOpen, onClose, onMinimize, onSend }: Props) {
  return (
    <div style={{
      position:   'fixed', bottom: 0, right: 16, zIndex: 400,
      display:    'flex', gap: 8, alignItems: 'flex-end',
      pointerEvents: 'none',
    }}>
      {windows.map((w, i) => (
        <DmWindow
          key={w.partner.id}
          window={w}
          onClose={() => onClose(w.partner.id)}
          onMinimize={() => onMinimize(w.partner.id)}
          onSend={(content) => onSend(w.partner.id, content)}
        />
      ))}
    </div>
  )
}

function DmWindow({ window: w, onClose, onMinimize, onSend }: {
  window:     DmWindow
  onClose:    () => void
  onMinimize: () => void
  onSend:     (content: string) => void
}) {
  const { user } = useAuth()
  const [input,   setInput]   = useState('')
  const msgEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!w.minimized) setTimeout(() => msgEndRef.current?.scrollIntoView(), 50)
  }, [w.messages, w.minimized])

  const send = () => {
    if (!input.trim()) return
    onSend(input.trim())
    setInput('')
  }

  return (
    <div style={{
      width: 290, pointerEvents: 'all',
      display: 'flex', flexDirection: 'column',
      border: '1px solid var(--borderB)',
      background: 'var(--bg2)',
      boxShadow: '0 -4px 40px rgba(0,100,180,.2)',
      animation: 'fadeUp .2s ease-out',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '7px 10px', background: 'var(--panel2)',
        borderBottom: '1px solid var(--borderB)', cursor: 'pointer',
        userSelect: 'none',
      }} onClick={onMinimize}>
        {/* Avatar */}
        <div style={{
          width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
          background: 'var(--cyan)', display: 'flex', alignItems: 'center',
          justifyContent: 'center', fontSize: 10, fontWeight: 900,
          fontFamily: "'Orbitron', monospace", color: '#000', overflow: 'hidden',
        }}>
          {w.partner.avatar_url
            ? <img src={w.partner.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : w.partner.username[0].toUpperCase()
          }
        </div>

        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--cyan)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {w.partner.username}
        </span>

        {w.unread > 0 && w.minimized && (
          <span style={{ background: 'var(--red)', color: 'white', fontSize: 9, padding: '1px 5px', borderRadius: 8, fontFamily: "'Share Tech Mono', monospace" }}>
            {w.unread}
          </span>
        )}

        <div style={{ display: 'flex', gap: 4, marginLeft: 4 }}>
          {/* Minimize */}
          <button onClick={e => { e.stopPropagation(); onMinimize() }} style={{
            width: 18, height: 18, background: 'rgba(0,212,255,.1)', border: '1px solid var(--border)',
            color: 'var(--textDim)', fontSize: 11, cursor: 'pointer', display: 'flex',
            alignItems: 'center', justifyContent: 'center', lineHeight: 1,
          }}>−</button>
          {/* Close */}
          <button onClick={e => { e.stopPropagation(); onClose() }} style={{
            width: 18, height: 18, background: 'rgba(255,58,90,.1)', border: '1px solid rgba(255,58,90,.3)',
            color: 'var(--red)', fontSize: 11, cursor: 'pointer', display: 'flex',
            alignItems: 'center', justifyContent: 'center', lineHeight: 1,
          }}>✕</button>
        </div>
      </div>

      {/* Body — hidden when minimized */}
      {!w.minimized && (
        <>
          {/* Messages */}
          <div style={{
            height: 260, overflowY: 'auto', padding: '8px 10px',
            display: 'flex', flexDirection: 'column', gap: 4,
            background: 'var(--panel)',
          }}>
            {w.messages.length === 0 && (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Share Tech Mono', monospace", fontSize: 10, color: 'var(--textMuted)' }}>
                Start a conversation
              </div>
            )}
            {w.messages.map((m: any) => {
              const isMine = m.sender_id === user?.id
              return (
                <div key={m.id} style={{
                  display: 'flex', flexDirection: isMine ? 'row-reverse' : 'row',
                  gap: 6, alignItems: 'flex-end',
                }}>
                  <div style={{
                    maxWidth: '78%', padding: '6px 9px',
                    background: isMine ? 'rgba(0,212,255,.12)' : 'var(--panel2)',
                    border: `1px solid ${isMine ? 'var(--borderB)' : 'var(--border)'}`,
                  }}>
                    <div style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.5, wordBreak: 'break-word' }}>{m.content}</div>
                    <div style={{ fontSize: 9, color: 'var(--textMuted)', fontFamily: "'Share Tech Mono', monospace", marginTop: 3, textAlign: isMine ? 'right' : 'left' }}>
                      {new Date(m.created_at).toLocaleTimeString('vi', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>
              )
            })}
            <div ref={msgEndRef} />
          </div>

          {/* Input */}
          <div style={{ display: 'flex', gap: 6, padding: '7px 8px', borderTop: '1px solid var(--border)', background: 'var(--panel2)' }}>
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && send()}
              placeholder="Message..."
              style={{
                flex: 1, background: 'var(--bg3)', border: '1px solid var(--border)',
                color: 'var(--white)', fontFamily: 'Rajdhani, sans-serif', fontSize: 12,
                padding: '5px 8px', outline: 'none',
              }}
            />
            <button onClick={send} style={{
              background: 'var(--cyan)', border: 'none', color: '#000',
              fontFamily: "'Orbitron', monospace", fontSize: 9, fontWeight: 700,
              padding: '5px 9px', cursor: 'pointer', letterSpacing: 1,
            }}>→</button>
          </div>
        </>
      )}
    </div>
  )
}
