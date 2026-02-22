'use client'
import { useState, useCallback } from 'react'
import { useAuth } from './useAuth'

const MAX_WINDOWS = 3

export interface DmWindow {
  partner:   { id: string; username: string; avatar_url?: string }
  messages:  any[]
  minimized: boolean
  unread:    number
}

export function useDmPopup() {
  const { user } = useAuth()
  const [windows, setWindows] = useState<DmWindow[]>([])

  const openDm = useCallback(async (partner: { id: string; username: string; avatar_url?: string }) => {
    if (!user) return
    if (partner.id === user.id) return

    // Already open → just unminimize
    setWindows(ws => {
      const existing = ws.find(w => w.partner.id === partner.id)
      if (existing) {
        return ws.map(w => w.partner.id === partner.id ? { ...w, minimized: false, unread: 0 } : w)
      }
      // Max 3 → remove oldest if full
      const trimmed = ws.length >= MAX_WINDOWS ? ws.slice(1) : ws
      return [...trimmed, { partner, messages: [], minimized: false, unread: 0 }]
    })

    // Fetch messages
    const r = await fetch(`/api/dm?with=${partner.id}`)
    const { messages } = await r.json()
    setWindows(ws => ws.map(w =>
      w.partner.id === partner.id ? { ...w, messages: messages || [] } : w
    ))
  }, [user])

  const closeDm = useCallback((partnerId: string) => {
    setWindows(ws => ws.filter(w => w.partner.id !== partnerId))
  }, [])

  const minimizeDm = useCallback((partnerId: string) => {
    setWindows(ws => ws.map(w =>
      w.partner.id === partnerId ? { ...w, minimized: !w.minimized } : w
    ))
  }, [])

  const sendDm = useCallback(async (partnerId: string, content: string) => {
    if (!content.trim()) return
    const r = await fetch('/api/dm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ receiver_id: partnerId, content }),
    })
    const { message } = await r.json()
    if (message) {
      setWindows(ws => ws.map(w =>
        w.partner.id === partnerId
          ? { ...w, messages: [...w.messages, message] }
          : w
      ))
    }
  }, [])

  const addIncomingMessage = useCallback((msg: any) => {
    const senderId = msg.sender_id
    setWindows(ws => ws.map(w => {
      if (w.partner.id !== senderId) return w
      return {
        ...w,
        messages: [...w.messages, msg],
        unread: w.minimized ? w.unread + 1 : 0,
      }
    }))
  }, [])

  return { windows, openDm, closeDm, minimizeDm, sendDm, addIncomingMessage }
}
