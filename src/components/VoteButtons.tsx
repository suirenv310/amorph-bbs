'use client'
import { useState, useCallback } from 'react'
import { useAuth } from '@/hooks/useAuth'

interface VoteState {
  upvotes:   number
  downvotes: number
  myVote:    number  // 1, -1, or 0
}

interface Props {
  targetType: 'thread' | 'reply'
  targetId:   string
  initial:    VoteState
  onAuthRequired?: () => void  // called if user not logged in
}

export default function VoteButtons({ targetType, targetId, initial, onAuthRequired }: Props) {
  const { user } = useAuth()
  const [state,   setState]   = useState<VoteState>(initial)
  const [loading, setLoading] = useState(false)

  const vote = useCallback(async (value: 1 | -1) => {
    if (!user) { onAuthRequired?.(); return }
    if (loading) return

    // Optimistic update
    const prev = state
    const isSame = state.myVote === value  // toggle off

    setState(s => {
      let up   = s.upvotes
      let down = s.downvotes

      // Remove previous vote
      if (s.myVote === 1)  up   = Math.max(0, up - 1)
      if (s.myVote === -1) down = Math.max(0, down - 1)

      // Apply new vote (unless toggling off)
      if (!isSame) {
        if (value === 1)  up   += 1
        if (value === -1) down += 1
      }

      return { upvotes: up, downvotes: down, myVote: isSame ? 0 : value }
    })

    setLoading(true)
    try {
      const r = await fetch('/api/forum/votes', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ target_type: targetType, target_id: targetId, value }),
      })
      if (!r.ok) { setState(prev); return }
      const data = await r.json()
      setState({ upvotes: data.upvotes, downvotes: data.downvotes, myVote: data.myVote })
    } catch {
      setState(prev)
    } finally {
      setLoading(false)
    }
  }, [user, state, loading, targetType, targetId, onAuthRequired])

  const score    = state.upvotes - state.downvotes
  const isUp     = state.myVote === 1
  const isDown   = state.myVote === -1

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      {/* Upvote */}
      <button
        onClick={() => vote(1)}
        disabled={loading}
        title="Upvote"
        style={{
          display:     'flex',
          alignItems:  'center',
          gap:         4,
          padding:     '2px 7px',
          background:  isUp ? 'rgba(0,255,136,.15)' : 'none',
          border:      `1px solid ${isUp ? 'var(--green)' : 'var(--border)'}`,
          color:       isUp ? 'var(--green)' : 'var(--textDim)',
          fontFamily:  "'Share Tech Mono', monospace",
          fontSize:    10,
          cursor:      loading ? 'default' : 'pointer',
          transition:  'all .15s',
          letterSpacing: 0.5,
        }}
        onMouseEnter={e => { if (!isUp)   (e.currentTarget.style.borderColor = 'var(--green)') }}
        onMouseLeave={e => { if (!isUp)   (e.currentTarget.style.borderColor = 'var(--border)') }}
      >
        ▲ <span style={{ minWidth: 14, textAlign: 'center' }}>{state.upvotes}</span>
      </button>

      {/* Downvote */}
      <button
        onClick={() => vote(-1)}
        disabled={loading}
        title="Downvote"
        style={{
          display:     'flex',
          alignItems:  'center',
          gap:         4,
          padding:     '2px 7px',
          background:  isDown ? 'rgba(255,58,90,.12)' : 'none',
          border:      `1px solid ${isDown ? 'var(--red)' : 'var(--border)'}`,
          color:       isDown ? 'var(--red)' : 'var(--textDim)',
          fontFamily:  "'Share Tech Mono', monospace",
          fontSize:    10,
          cursor:      loading ? 'default' : 'pointer',
          transition:  'all .15s',
          letterSpacing: 0.5,
        }}
        onMouseEnter={e => { if (!isDown) (e.currentTarget.style.borderColor = 'var(--red)') }}
        onMouseLeave={e => { if (!isDown) (e.currentTarget.style.borderColor = 'var(--border)') }}
      >
        ▼ <span style={{ minWidth: 14, textAlign: 'center' }}>{state.downvotes}</span>
      </button>
    </div>
  )
}
