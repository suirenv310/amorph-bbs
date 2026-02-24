'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useDmPopup } from '@/hooks/useDmPopup'
import { supabase } from '@/lib/supabase'
import DmPopupStack from '@/components/DmPopup'
import MemberList   from '@/components/MemberList'
import CreateRoomModal    from '@/components/CreateRoomModal'
import RoomPasswordModal  from '@/components/RoomPasswordModal'
import AvatarUpload       from '@/components/AvatarUpload'
import AuditLog           from '@/components/AuditLog'
import VoteButtons        from '@/components/VoteButtons'
import type { Thread, Reply, Message, Room } from '@/types'

const COLORS  = ['#00d4ff','#f0c040','#ff3a5a','#00ff88','#c580ff','#ff8844','#44aaff','#ff44cc','#88ff44','#ffaa00']
const AVATARS = ['◈','∆','◉','⊕','⬡','◆','▲','⬟','✦','⬠']
const GATE_PASS = 'amorph'

type View     = 'chat' | 'forum' | 'dm' | 'profile' | 'admin'
type AdminTab = 'overview' | 'users' | 'audit'

// ── GATE ──────────────────────────────────────────────────────
function Gate({ onEnter }: { onEnter: () => void }) {
  const [phase, setPhase]       = useState(0)
  const [showInput, setShowInput] = useState(false)
  const [value, setValue]       = useState('')
  const [error, setError]       = useState(false)
  const [granted, setGranted]   = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const lines = [
    { text: 'connecting to bbs.amorph.ikebukuro.jp...', color: '#1a4a2a' },
    { text: 'establishing secure tunnel...',             color: '#1a4a2a' },
    { text: 'connection established.',                   color: '#00ff88' },
    { text: '',                                          color: '#000' },
    { text: '⚠  this network requires authorization.',  color: '#f0c040' },
    { text: 'only members may enter.',                   color: '#1a4a2a' },
  ]

  useEffect(() => {
    [0,900,1800,2500,3200,4000].forEach((d,i) => setTimeout(() => setPhase(p => Math.max(p,i+1)), d))
    setTimeout(() => { setShowInput(true); inputRef.current?.focus() }, 4600)
  }, [])

  const submit = () => {
    if (value.toLowerCase() === GATE_PASS) {
      setGranted(true); setTimeout(onEnter, 1200)
    } else {
      setError(true); setValue(''); setTimeout(() => setError(false), 600)
    }
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'#000', zIndex:5000, display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ width:'min(480px,92vw)', fontFamily:"'Share Tech Mono',monospace" }}>
        {lines.slice(0,phase).map((l,i) => <div key={i} style={{ fontSize:13, lineHeight:2, color:l.color }}>{l.text}</div>)}
        {showInput && !granted && (
          <div style={{ marginTop:24, display:'flex', alignItems:'center', gap:10, fontSize:14, color:'#00ff88' }}>
            <span style={{ color:'#2a6a4a' }}>password:</span>
            <input ref={inputRef} type="password" value={value} onChange={e=>setValue(e.target.value)}
              onKeyDown={e=>e.key==='Enter'&&submit()} autoComplete="off"
              style={{ background:'none', border:'none', outline:'none', color:'#00ff88', fontFamily:'inherit', fontSize:14, flex:1 }} />
          </div>
        )}
        {error   && <div style={{ marginTop:14, color:'#ff3a5a', fontSize:12, letterSpacing:1 }}>// ACCESS DENIED //</div>}
        {granted && <div style={{ marginTop:18, textAlign:'center', color:'#00ff88', fontSize:13, letterSpacing:3 }}>// ACCESS GRANTED //</div>}
        <div style={{ marginTop:28, textAlign:'center', color:'#0f3020', fontSize:10, letterSpacing:1 }}>// hint: "amorph" //</div>
      </div>
    </div>
  )
}

// ── AUTH MODAL ────────────────────────────────────────────────
function AuthModal({ onClose }: { onClose: () => void }) {
  const { login, register } = useAuth()
  const [mode, setMode]         = useState<'login'|'register'>('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr]           = useState('')
  const [loading, setLoading]   = useState(false)

  const submit = async () => {
    setErr(''); setLoading(true)
    try {
      mode === 'login' ? await login(username, password) : await register(username, password)
      onClose()
    } catch (e: any) { setErr(e.message) }
    finally { setLoading(false) }
  }

  return (
    <div className="overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal-box">
        <button onClick={onClose} style={{ position:'absolute', top:10, right:14, background:'none', border:'none', color:'var(--textMuted)', fontSize:17, cursor:'pointer' }}>✕</button>
        <div style={{ fontFamily:"'Orbitron',monospace", fontSize:18, color:'var(--cyan)', textAlign:'center', letterSpacing:4, marginBottom:18 }}>
          {mode==='login'?'ENTER':'JOIN'}
        </div>
        <div style={{ display:'flex', marginBottom:16, border:'1px solid var(--border)' }}>
          {(['login','register'] as const).map(m=>(
            <button key={m} onClick={()=>setMode(m)} style={{ flex:1, padding:8, background:mode===m?'var(--panel)':'none', border:'none', borderRight:'1px solid var(--border)', color:mode===m?'var(--cyan)':'var(--textDim)', fontFamily:"'Share Tech Mono',monospace", fontSize:10, letterSpacing:1, cursor:'pointer', textTransform:'uppercase' }}>{m}</button>
          ))}
        </div>
        {[['USERNAME',username,setUsername,'text'],['PASSWORD',password,setPassword,'password']].map(([label,val,setter,type])=>(
          <div key={label as string} style={{ marginBottom:12 }}>
            <label style={{ fontFamily:"'Share Tech Mono',monospace", fontSize:10, color:'var(--textDim)', letterSpacing:2, display:'block', marginBottom:5 }}>{label as string}</label>
            <input className="input-base" type={type as string} value={val as string} onChange={e=>(setter as any)(e.target.value)} onKeyDown={e=>e.key==='Enter'&&submit()} style={{ display:'block' }} />
          </div>
        ))}
        {err && <div style={{ padding:'6px 10px', background:'rgba(255,58,90,.06)', border:'1px solid rgba(255,58,90,.2)', color:'var(--red)', fontFamily:"'Share Tech Mono',monospace", fontSize:10, marginBottom:10 }}>⚠ {err}</div>}
        <button className="btn-primary" onClick={submit} disabled={loading} style={{ width:'100%', marginTop:6 }}>
          {loading?'...':(mode==='login'?'LOGIN':'CREATE ACCOUNT')}
        </button>
      </div>
    </div>
  )
}

// ── VERIFY MODAL ──────────────────────────────────────────────
function VerifyModal({ onClose }: { onClose: () => void }) {
  const { verifyCode } = useAuth()
  const [code,setCode]       = useState('')
  const [err,setErr]         = useState('')
  const [success,setSuccess] = useState('')
  const [loading,setLoading] = useState(false)

  const submit = async () => {
    setErr(''); setLoading(true)
    try {
      const { discord_username } = await verifyCode(code)
      setSuccess(`Verified! Linked to: ${discord_username}`)
      setTimeout(onClose, 1800)
    } catch (e: any) { setErr(e.message) }
    finally { setLoading(false) }
  }

  return (
    <div className="overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal-box">
        <button onClick={onClose} style={{ position:'absolute', top:10, right:14, background:'none', border:'none', color:'var(--textMuted)', fontSize:17, cursor:'pointer' }}>✕</button>
        <div style={{ fontFamily:"'Orbitron',monospace", fontSize:14, color:'var(--yellow)', textAlign:'center', letterSpacing:3, marginBottom:4 }}>VERIFY CODE</div>
        <div style={{ fontFamily:"'Share Tech Mono',monospace", fontSize:10, color:'var(--textMuted)', textAlign:'center', marginBottom:18, lineHeight:1.8 }}>
          Nhập invite code từ Discord (/getcode)<br/>để mở quyền đăng bài và comment.
        </div>
        <input className="input-base" value={code} onChange={e=>setCode(e.target.value.toUpperCase())}
          onKeyDown={e=>e.key==='Enter'&&submit()} placeholder="XXXXXXXX"
          style={{ display:'block', letterSpacing:3, textAlign:'center', fontSize:16 }} />
        {err     && <div style={{ marginTop:10, color:'var(--red)',   fontFamily:"'Share Tech Mono',monospace", fontSize:10 }}>⚠ {err}</div>}
        {success && <div style={{ marginTop:10, color:'var(--green)', fontFamily:"'Share Tech Mono',monospace", fontSize:10 }}>✓ {success}</div>}
        <button className="btn-primary" onClick={submit} disabled={loading} style={{ width:'100%', marginTop:14 }}>
          {loading?'...':'VERIFY'}
        </button>
      </div>
    </div>
  )
}

// ── MAIN APP ──────────────────────────────────────────────────
export default function Home() {
  const { user, profiles, activeProfile, loading, logout, switchProfile, createProfile, deleteProfile } = useAuth()
  const dmPopup = useDmPopup()

  const [gateOpen,   setGateOpen]   = useState(true)
  const [appVisible, setAppVisible] = useState(false)
  const [showAuth,   setShowAuth]   = useState(false)
  const [showVerify, setShowVerify] = useState(false)
  const [view,       setView]       = useState<View>('chat')

  // Chat
  const [rooms,          setRooms]          = useState<Room[]>([])
  const [activeRoom,     setActiveRoom]      = useState<Room | null>(null)
  const [roomOwners,     setRoomOwners]      = useState<Record<string,string>>({})
  const [messages,       setMessages]        = useState<Message[]>([])
  const [chatInput,      setChatInput]       = useState('')
  const [replyTo,        setReplyTo]         = useState<{id:string,content:string,author:string}|null>(null)
  const [showCreateRoom, setShowCreateRoom]  = useState(false)
  const [passwordRoom,   setPasswordRoom]    = useState<Room|null>(null)
  const msgEndRef = useRef<HTMLDivElement>(null)

  // Forum
  const [threads,       setThreads]       = useState<Thread[]>([])
  const [activeThread,  setActiveThread]  = useState<Thread|null>(null)
  const [replies,       setReplies]       = useState<Reply[]>([])
  const [forumSearch,   setForumSearch]   = useState('')
  const [replyInput,    setReplyInput]    = useState('')
  const [newThreadOpen, setNewThreadOpen] = useState(false)
  const [ntTitle,       setNtTitle]       = useState('')
  const [ntBody,        setNtBody]        = useState('')
  const [ntTag,         setNtTag]         = useState<'new'|'hot'|'discussion'>('new')
  // New thread media/options
  const [ntMediaUrls,   setNtMediaUrls]   = useState<string[]>([])
  const [ntMediaTypes,  setNtMediaTypes]  = useState<('image'|'video')[]>([])
  const [ntSpoiler,     setNtSpoiler]     = useState(false)
  const [ntVisibility,  setNtVisibility]  = useState<'anon'|'public'>('anon')
  const [ntUploading,   setNtUploading]   = useState(false)
  // Reply media/options
  const [rpMediaUrls,   setRpMediaUrls]   = useState<string[]>([])
  const [rpMediaTypes,  setRpMediaTypes]  = useState<('image'|'video')[]>([])
  const [rpSpoiler,     setRpSpoiler]     = useState(false)
  const [rpVisibility,  setRpVisibility]  = useState<'anon'|'public'>('anon')
  const [rpUploading,   setRpUploading]   = useState(false)
  // Spoiler reveal state
  const [spoilerRevealed, setSpoilerRevealed] = useState<Record<string,boolean>>({})
  // Votes
  const [threadVotes, setThreadVotes] = useState<Record<string, { upvotes: number; downvotes: number; myVote: number }>>({})
  const [replyVotes,  setReplyVotes]  = useState<Record<string, { upvotes: number; downvotes: number; myVote: number }>>({})
  // memberTick — increment to force MemberList refetch
  const [memberTick, setMemberTick] = useState(0)

  // DM tab
  const [conversations, setConversations] = useState<any[]>([])
  const [activeDm,      setActiveDm]      = useState<{id:string,username:string}|null>(null)
  const [dmMessages,    setDmMessages]    = useState<any[]>([])
  const [dmInput,       setDmInput]       = useState('')

  // Profile
  const [showNewProf,   setShowNewProf]   = useState(false)
  const [newProfName,   setNewProfName]   = useState('')
  const [newProfAvatar, setNewProfAvatar] = useState(AVATARS[0])
  const [newProfColor,  setNewProfColor]  = useState(COLORS[0])

  // Admin
  const [adminTab,  setAdminTab]  = useState<AdminTab>('overview')
  const [adminData, setAdminData] = useState<any>({})
  const [adminSearch, setAdminSearch] = useState('')
  const [confirmAction, setConfirmAction] = useState<{msg:string,cb:()=>void}|null>(null)

  const isAdmin    = user?.role === 'admin'
  const isVerified = user?.is_verified || user?.role === 'admin'

  // ── Gate ────────────────────────────────────────────────────
  const onGateEnter = useCallback(() => {
    setGateOpen(false); setAppVisible(true); fetchRooms()
  }, [])

  useEffect(() => {
    if (appVisible && !loading && !user) setShowAuth(true)
  }, [appVisible, loading, user])

  // ── Rooms ────────────────────────────────────────────────────
  const fetchRooms = async () => {
    const r = await fetch('/api/chat/rooms')
    const { rooms: data } = await r.json()
    const visible = (data || []).filter((r: any) => r.name !== 'ADMIN-LOG' || isAdmin)
    setRooms(visible)
    const owners: Record<string,string> = {}
    visible.forEach((r: any) => { owners[r.id] = r.created_by })
    setRoomOwners(owners)
    if (visible.length) { setActiveRoom(visible[0]); fetchMessages(visible[0].id) }
  }

  const fetchMessages = async (roomId: string) => {
    const r = await fetch(`/api/chat/messages?room_id=${roomId}`)
    const { messages: data } = await r.json()
    setMessages(data || [])
    setTimeout(() => msgEndRef.current?.scrollIntoView(), 50)
  }

  const joinRoom = async (room: Room) => {
    // Check ban first
    const r = await fetch(`/api/chat/rooms/${room.id}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'join' }),
    })
    const data = await r.json()
    if (!r.ok) {
      if (data.error === 'PASSWORD_REQUIRED') { setPasswordRoom(room); return }
      if (data.error?.includes('ban')) { alert('Bạn đã bị ban khỏi room này'); return }
    }
    setActiveRoom(room)
    fetchMessages(room.id)
  }

  // Realtime chat — messages (INSERT/UPDATE/DELETE) + room_members changes
  useEffect(() => {
    if (!activeRoom) return
    const roomId = activeRoom.id

    const ch = supabase.channel(`room-${roomId}`)
      // New message
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `room_id=eq.${roomId}` },
        () => fetchMessages(roomId)
      )
      // Deleted/edited message — refetch to get updated content
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'messages', filter: `room_id=eq.${roomId}` },
        (payload) => {
          setMessages(msgs => msgs.map(m =>
            m.id === payload.new.id
              ? { ...m, content: payload.new.deleted ? '[deleted]' : payload.new.content, deleted: payload.new.deleted }
              : m
          ))
        }
      )
      // Members join/leave — trigger MemberList re-render via key change
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'room_members', filter: `room_id=eq.${roomId}` },
        () => setMemberTick(t => t + 1)
      )
      .on('postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'room_members', filter: `room_id=eq.${roomId}` },
        () => setMemberTick(t => t + 1)
      )
      .subscribe()

    return () => { supabase.removeChannel(ch) }
  }, [activeRoom?.id])

  const sendMessage = async () => {
    if (!chatInput.trim() || !user || !activeRoom) return
    await fetch('/api/chat/messages', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        room_id:  activeRoom.id,
        content:  chatInput.trim(),
        reply_to_id: replyTo?.id || null,
      }),
    })
    setChatInput('')
    setReplyTo(null)
  }

  // ── Forum ─────────────────────────────────────────────────────
  const fetchThreads = useCallback(async () => {
    const params = new URLSearchParams()
    if (forumSearch) params.set('search', forumSearch)
    const r = await fetch(`/api/forum/threads?${params}`)
    const { threads: data } = await r.json()

    // Sort: pinned lên đầu, sau đó theo score (upvotes - downvotes)
    const sorted = (data || []).sort((a: any, b: any) => {
      if (a.is_pinned !== b.is_pinned) return b.is_pinned ? 1 : -1
      const scoreA = (a.upvotes || 0) - (a.downvotes || 0)
      const scoreB = (b.upvotes || 0) - (b.downvotes || 0)
      return scoreB - scoreA
    })
    setThreads(sorted)

    // Fetch votes cho tất cả threads
    if (sorted.length > 0) {
      const ids = sorted.map((t: any) => t.id).join(',')
      const vr  = await fetch(`/api/forum/votes?target_type=thread&target_ids=${ids}`)
      const { votes } = await vr.json()
      setThreadVotes(votes || {})
    }
  }, [forumSearch])

  useEffect(() => { if (view==='forum') fetchThreads() }, [view, fetchThreads])

  // Forum realtime — mới post thread/reply thì tự refresh
  useEffect(() => {
    if (view !== 'forum') return
    const ch = supabase.channel('forum-realtime')
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'threads' },
        () => fetchThreads()
      )
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'threads' },
        () => fetchThreads()
      )
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'replies' },
        (payload) => {
          // Nếu đang xem thread đó thì refetch replies
          setActiveThread(t => {
            if (t && payload.new.thread_id === t.id) {
              fetch(`/api/forum/replies?thread_id=${t.id}`)
                .then(r => r.json()).then(({ replies }) => setReplies(replies || []))
            }
            return t
          })
          // Luôn update reply_count trên thread list
          fetchThreads()
        }
      )
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [view, fetchThreads])

  const openThread = async (t: Thread) => {
    setActiveThread(t)
    const r = await fetch(`/api/forum/replies?thread_id=${t.id}`)
    const { replies: data } = await r.json()
    setReplies(data || [])

    // Fetch votes cho replies
    if (data && data.length > 0) {
      const ids = data.map((r: any) => r.id).join(',')
      const vr  = await fetch(`/api/forum/votes?target_type=reply&target_ids=${ids}`)
      const { votes } = await vr.json()
      setReplyVotes(votes || {})
    }

    // Refresh vote của thread này (cập nhật myVote khi mở detail)
    const tvr = await fetch(`/api/forum/votes?target_type=thread&target_ids=${t.id}`)
    const { votes: tv } = await tvr.json()
    if (tv) setThreadVotes(prev => ({ ...prev, ...tv }))
  }

  // Upload media helper
  const uploadMedia = async (file: File): Promise<{url:string,type:'image'|'video'}|null> => {
    const fd = new FormData()
    fd.append('file', file)
    const r = await fetch('/api/upload/media', { method:'POST', body:fd })
    if (!r.ok) { const { error } = await r.json(); alert(error); return null }
    return r.json()
  }

  const handleMediaSelect = async (
    files: FileList | null,
    setUrls: React.Dispatch<React.SetStateAction<string[]>>,
    setTypes: React.Dispatch<React.SetStateAction<('image'|'video')[]>>,
    setUploading: React.Dispatch<React.SetStateAction<boolean>>,
    currentCount: number
  ) => {
    if (!files) return
    const remaining = 4 - currentCount
    const toUpload  = Array.from(files).slice(0, remaining)
    setUploading(true)
    for (const file of toUpload) {
      const result = await uploadMedia(file)
      if (result) {
        setUrls(u  => [...u, result.url])
        setTypes(t => [...t, result.type])
      }
    }
    setUploading(false)
  }

  const postThread = async () => {
    if (!ntTitle.trim() || !ntBody.trim()) return
    const r = await fetch('/api/forum/threads', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: ntTitle, body: ntBody, tag: ntTag,
        profile_id:  ntVisibility === 'public' ? activeProfile?.id : null,
        media_urls:  ntMediaUrls,
        media_types: ntMediaTypes,
        is_spoiler:  ntSpoiler,
        visibility:  ntVisibility,
      }),
    })
    if (r.ok) {
      setNewThreadOpen(false)
      setNtTitle(''); setNtBody(''); setNtTag('new')
      setNtMediaUrls([]); setNtMediaTypes([]); setNtSpoiler(false); setNtVisibility('anon')
      fetchThreads()
    }
  }

  const postReply = async () => {
    if (!replyInput.trim() || !activeThread) return
    const r = await fetch('/api/forum/replies', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        thread_id:   activeThread.id,
        body:        replyInput,
        profile_id:  rpVisibility === 'public' ? activeProfile?.id : null,
        media_urls:  rpMediaUrls,
        media_types: rpMediaTypes,
        is_spoiler:  rpSpoiler,
        visibility:  rpVisibility,
      }),
    })
    if (r.ok) {
      setReplyInput('')
      setRpMediaUrls([]); setRpMediaTypes([]); setRpSpoiler(false); setRpVisibility('anon')
      openThread(activeThread)
    }
  }

  const deleteThread = async (id: string) => {
    await fetch(`/api/forum/threads/${id}`, { method: 'DELETE' })
    setActiveThread(null); fetchThreads()
  }

  const deleteReply = async (id: string) => {
    await fetch(`/api/forum/replies/${id}`, { method: 'DELETE' })
    if (activeThread) openThread(activeThread)
  }

  // ── DM tab ────────────────────────────────────────────────────
  const fetchConversations = async () => {
    const r = await fetch('/api/dm')
    const { conversations: data } = await r.json()
    setConversations(data || [])
  }

  const openDmTab = async (partner: {id:string,username:string}) => {
    setActiveDm(partner)
    const r = await fetch(`/api/dm?with=${partner.id}`)
    const { messages: data } = await r.json()
    setDmMessages(data || [])
  }

  const sendDmTab = async () => {
    if (!dmInput.trim() || !activeDm) return
    await fetch('/api/dm', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ receiver_id: activeDm.id, content: dmInput.trim() }),
    })
    setDmInput(''); if (activeDm) openDmTab(activeDm)
  }

  useEffect(() => { if (view==='dm') fetchConversations() }, [view])

  // ── Admin ─────────────────────────────────────────────────────
  const fetchAdmin = async (section: string) => {
    const r = await fetch(`/api/admin?section=${section}`)
    const data = await r.json()
    setAdminData((d: any) => ({ ...d, [section]: data }))
  }

  useEffect(() => {
    if (view==='admin') {
      if (adminTab === 'audit') return
      fetchAdmin(adminTab==='overview' ? 'overview' : 'users')
    }
  }, [view, adminTab])

  const adminAction = async (action: string, target_id: string, extra?: any) => {
    const r = await fetch('/api/admin', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, target_id, ...extra }),
    })
    if (!r.ok) return
    if (action === 'delete_message' && activeRoom) {
      // Soft-delete: update message in UI immediately
      setMessages(msgs => msgs.map(m =>
        m.id === target_id ? { ...m, content: '[deleted]', deleted: true } : m
      ))
    } else {
      fetchAdmin('users')
    }
  }

  const confirm = (msg: string, cb: () => void) => setConfirmAction({ msg, cb })

  if (gateOpen) return <Gate onEnter={onGateEnter} />

  return (
    <div style={{ position:'relative', zIndex:1, display:'grid', gridTemplateRows:'52px 1fr', height:'100vh', opacity:appVisible?1:0, transition:'opacity .5s' }}>

      {/* ── HEADER ───────────────────────────────────── */}
      <header style={{ display:'flex', alignItems:'center', gap:14, padding:'0 18px', background:'rgba(4,9,13,.97)', borderBottom:'1px solid var(--border)', position:'relative', zIndex:50, backdropFilter:'blur(12px)' }}>
        <div style={{ fontFamily:"'Orbitron',monospace", fontSize:17, fontWeight:900, color:'var(--cyan)', letterSpacing:5, animation:'glitch 9s infinite' }}>
          AMORPH<span style={{color:'var(--yellow)'}}>BBS</span>
        </div>

        <nav style={{ display:'flex', gap:2 }}>
          {(['chat','forum','dm'] as View[]).map(v=>(
            <button key={v} onClick={()=>setView(v)} style={{
              fontFamily:"'Share Tech Mono',monospace", fontSize:11, letterSpacing:1.5,
              padding:'5px 13px', background:'none',
              border: view===v ? '1px solid var(--cyan)' : '1px solid transparent',
              color: view===v ? 'var(--cyan)' : 'var(--textDim)',
              cursor:'pointer', transition:'all .15s', textTransform:'uppercase',
              textShadow: view===v ? '0 0 8px rgba(0,212,255,.6)' : 'none',
            }}>{v.toUpperCase()}</button>
          ))}
        </nav>

        <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:8 }}>
          {user ? (
            <>
              {!isVerified && (
                <button onClick={()=>setShowVerify(true)} style={{ fontFamily:"'Share Tech Mono',monospace", fontSize:10, padding:'4px 10px', background:'rgba(240,192,64,.08)', border:'1px solid var(--yellow)', color:'var(--yellow)', cursor:'pointer', letterSpacing:1, textTransform:'uppercase' }}>VERIFY CODE</button>
              )}
              {isAdmin && (
                <button onClick={()=>setView('admin')} style={{ fontFamily:"'Share Tech Mono',monospace", fontSize:10, padding:'4px 10px', background:view==='admin'?'rgba(240,192,64,.1)':'none', border:'1px solid var(--border)', color:'var(--yellow)', cursor:'pointer', letterSpacing:1 }}>⚙ ADMIN</button>
              )}
              <div onClick={()=>setView('profile')} style={{ display:'flex', alignItems:'center', gap:8, padding:'4px 12px', border:'1px solid var(--border)', background:'var(--panel)', cursor:'pointer' }}>
                {/* Avatar */}
                <div style={{ width:22, height:22, borderRadius:'50%', overflow:'hidden', flexShrink:0, background:'var(--cyan)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:900, fontFamily:"'Orbitron',monospace", color:'#000' }}>
                  {user ? '◈' : '?'}
                </div>
                <div style={{ width:7, height:7, borderRadius:'50%', background:isVerified?'var(--green)':'var(--yellow)', animation:'blink 2.2s ease-in-out infinite' }} />
                <span style={{ fontSize:13, fontWeight:700, color:activeProfile?.color||'var(--cyan)' }}>{user.username}</span>
              </div>
              <button onClick={logout} className="btn-outline">LOGOUT</button>
            </>
          ) : (
            <>
              <button onClick={()=>setShowAuth(true)} className="btn-outline">LOGIN</button>
              <button onClick={()=>setShowAuth(true)} className="btn-primary" style={{ padding:'5px 14px', fontSize:10 }}>JOIN</button>
            </>
          )}
        </div>
      </header>

      {/* ── SHELL ────────────────────────────────────── */}
      <div style={{ display:'grid', gridTemplateColumns:'200px 1fr 250px', overflow:'hidden' }}>

        {/* LEFT SIDEBAR */}
        <aside style={{ borderRight:'1px solid var(--border)', display:'flex', flexDirection:'column', overflow:'hidden' }}>
          <div className="sec-head" style={{ display:'flex', alignItems:'center', justifyContent:'space-between', paddingRight:8 }}>
            <span>CHANNELS</span>
            {user && <button onClick={()=>setShowCreateRoom(true)} style={{ background:'none', border:'none', color:'var(--cyan)', cursor:'pointer', fontSize:14, lineHeight:1 }}>+</button>}
          </div>
          <div style={{ flex:1, overflowY:'auto', padding:'4px 0' }}>
            {rooms.map(r=>(
              <div key={r.id} onClick={()=>joinRoom(r)} style={{
                padding:'7px 13px', cursor:'pointer', fontSize:13, fontWeight:500,
                display:'flex', alignItems:'center', justifyContent:'space-between',
                borderLeft: activeRoom?.id===r.id ? '2px solid var(--cyan)' : '2px solid transparent',
                background: activeRoom?.id===r.id ? 'rgba(0,212,255,.07)' : 'none',
                color: activeRoom?.id===r.id ? 'var(--cyan)' : 'var(--text)',
                transition:'all .15s',
              }}>
                <span>#{r.name.toLowerCase()}</span>
                {(r as any).has_password && <span style={{ fontSize:10, color:'var(--yellow)' }}>🔒</span>}
              </div>
            ))}
          </div>

          {/* Profile switcher */}
          {user && profiles.length > 0 && (
            <>
              <div className="sec-head">PROFILES</div>
              <div style={{ overflowY:'auto', maxHeight:130, padding:'4px 0' }}>
                {profiles.map(p=>(
                  <div key={p.id} onClick={()=>switchProfile(p)} style={{
                    padding:'5px 13px', display:'flex', alignItems:'center', gap:8,
                    cursor:'pointer', fontSize:12, fontWeight:600,
                    background: activeProfile?.id===p.id ? 'rgba(0,212,255,.06)' : 'none',
                    borderLeft: activeProfile?.id===p.id ? '2px solid var(--cyan)' : '2px solid transparent',
                  }}>
                    <div style={{ width:18, height:18, background:p.color, display:'flex', alignItems:'center', justifyContent:'center', fontFamily:"'Orbitron',monospace", fontSize:9, fontWeight:900, color:'#000' }}>{p.avatar}</div>
                    <span style={{ color:p.color, flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.display_name}</span>
                    {activeProfile?.id===p.id && <span style={{ fontFamily:"'Share Tech Mono',monospace", fontSize:8, color:'var(--cyan)' }}>ON</span>}
                  </div>
                ))}
              </div>
            </>
          )}
        </aside>

        {/* MAIN AREA */}
        <main style={{ display:'flex', flexDirection:'column', overflow:'hidden' }}>

          {/* ── CHAT ── */}
          {view==='chat' && (
            <div style={{ display:'flex', flexDirection:'column', flex:1, overflow:'hidden' }}>
              <div style={{ padding:'9px 15px', background:'var(--panel2)', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', gap:12, flexShrink:0 }}>
                <span style={{ fontFamily:"'Orbitron',monospace", fontSize:13, fontWeight:700, color:'var(--yellow)' }}>#{activeRoom?.name.toLowerCase()||'amorph'}</span>
                <span style={{ fontFamily:"'Share Tech Mono',monospace", fontSize:10, color:'var(--textMuted)', marginLeft:'auto' }}>{activeRoom?.description}</span>
              </div>

              <div style={{ flex:1, overflowY:'auto', padding:'11px 15px', display:'flex', flexDirection:'column', gap:1, background:'var(--panel)' }}>
                {messages.map(m=>{
                  const author = (m as any).author
                  const prof   = (m as any).author_profile
                  const displayName = prof?.display_name || author?.username || '???'
                  const avatarColor = prof?.color || 'var(--cyan)'
                  const avatarChar  = prof?.avatar || author?.username?.[0]?.toUpperCase() || '?'
                  return (
                    <div key={m.id} className="animate-msg-in" style={{ display:'flex', gap:10, padding:'4px 0', borderBottom:'1px solid rgba(255,255,255,.02)', position:'relative' }}
                      onMouseEnter={e=>(e.currentTarget.querySelector('.msg-actions') as HTMLElement)?.style && ((e.currentTarget.querySelector('.msg-actions') as HTMLElement).style.opacity='1')}
                      onMouseLeave={e=>(e.currentTarget.querySelector('.msg-actions') as HTMLElement)?.style && ((e.currentTarget.querySelector('.msg-actions') as HTMLElement).style.opacity='0')}
                    >
                      {/* Avatar — dùng profile nếu có */}
                      <div onClick={()=>user && author?.id !== user.id && dmPopup.openDm({ id: author?.id, username: author?.username, avatar_url: author?.avatar_url })}
                        style={{ width:28, height:28, borderRadius:'50%', flexShrink:0, marginTop:2, background:avatarColor, overflow:'hidden', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:"'Orbitron',monospace", fontSize:11, fontWeight:900, color:'#000', cursor: author?.id !== user?.id ? 'pointer' : 'default' }}>
                        {author?.avatar_url ? <img src={author.avatar_url} style={{ width:'100%', height:'100%', objectFit:'cover' }} /> : avatarChar}
                      </div>

                      <div style={{ flex:1, overflow:'hidden' }}>
                        {/* Quote preview */}
                        {(m as any).reply_to_id && (
                          <div style={{ padding:'3px 8px', marginBottom:4, borderLeft:'2px solid var(--cyanDim)', background:'rgba(0,180,220,.05)', fontSize:11, color:'var(--textMuted)', fontStyle:'italic', display:'flex', gap:6 }}>
                            <span style={{ color:'var(--cyanDim)', fontWeight:700, fontStyle:'normal' }}>{(m as any).reply_to_author}</span>
                            <span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{(m as any).reply_to_content}</span>
                          </div>
                        )}
                        <div style={{ display:'flex', alignItems:'baseline', gap:8, flexWrap:'wrap' }}>
                          <span style={{ fontSize:13, fontWeight:700, color:avatarColor }}>{displayName}</span>
                          <span style={{ fontFamily:"'Share Tech Mono',monospace", fontSize:10, color:'var(--textMuted)' }}>
                            {new Date(m.created_at).toLocaleTimeString('vi',{hour:'2-digit',minute:'2-digit'})}
                          </span>
                        </div>
                        <div style={{ fontSize:13, color:'var(--text)', lineHeight:1.5, wordBreak:'break-word' }}>{m.content}</div>
                      </div>

                      {/* Reply button */}
                      <div className="msg-actions" style={{ opacity:0, transition:'opacity .15s', display:'flex', alignItems:'flex-start', gap:4, paddingTop:4 }}>
                        <button onClick={()=>setReplyTo({ id:m.id, content:m.content.slice(0,80), author: author?.username||'?' })}
                          style={{ background:'none', border:'1px solid var(--border)', color:'var(--textDim)', fontFamily:"'Share Tech Mono',monospace", fontSize:9, padding:'2px 6px', cursor:'pointer', letterSpacing:1 }}>REPLY</button>
                        {(isAdmin || (m as any).author?.id === user?.id) && (
                          <button onClick={()=>confirm('Delete message?', ()=>adminAction('delete_message', m.id))}
                            style={{ background:'none', border:'1px solid rgba(255,58,90,.25)', color:'var(--red)', fontFamily:"'Share Tech Mono',monospace", fontSize:9, padding:'2px 6px', cursor:'pointer' }}>DEL</button>
                        )}
                      </div>
                    </div>
                  )
                })}
                <div ref={msgEndRef} />
              </div>

              {/* Reply preview */}
              {replyTo && (
                <div style={{ padding:'6px 13px', background:'rgba(0,180,220,.06)', borderTop:'1px solid var(--borderB)', display:'flex', alignItems:'center', gap:10, flexShrink:0 }}>
                  <span style={{ fontFamily:"'Share Tech Mono',monospace", fontSize:10, color:'var(--cyanDim)' }}>Replying to <strong>{replyTo.author}</strong>:</span>
                  <span style={{ fontSize:11, color:'var(--textMuted)', flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', fontStyle:'italic' }}>{replyTo.content}</span>
                  <button onClick={()=>setReplyTo(null)} style={{ background:'none', border:'none', color:'var(--textMuted)', cursor:'pointer', fontSize:14 }}>✕</button>
                </div>
              )}

              <div style={{ padding:'10px 13px', background:'var(--panel2)', borderTop:'1px solid var(--borderB)', display:'flex', gap:8, flexShrink:0 }}>
                {user ? (
                  <>
                    <textarea value={chatInput} onChange={e=>setChatInput(e.target.value)}
                      onKeyDown={e=>{ if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendMessage()} }}
                      placeholder="Message... (Enter to send)"
                      style={{ flex:1, background:'var(--bg3)', border:'1px solid var(--border)', color:'var(--white)', fontFamily:'Rajdhani,sans-serif', fontSize:13, padding:'8px 12px', resize:'none', outline:'none', minHeight:38, maxHeight:90 }} />
                    <button onClick={sendMessage} className="btn-primary" style={{ alignSelf:'flex-end', padding:'8px 15px' }}>SEND</button>
                  </>
                ) : (
                  <div style={{ flex:1, fontFamily:"'Share Tech Mono',monospace", fontSize:11, color:'var(--textMuted)', padding:'8px 0', cursor:'pointer' }} onClick={()=>setShowAuth(true)}>
                    // đăng nhập để chat //
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── FORUM LIST ── */}
          {view==='forum' && !activeThread && (
            <div style={{ display:'flex', flexDirection:'column', flex:1, overflow:'hidden' }}>
              <div style={{ padding:'9px 13px', background:'var(--panel2)', borderBottom:'1px solid var(--border)', display:'flex', gap:8, flexShrink:0 }}>
                <input value={forumSearch} onChange={e=>setForumSearch(e.target.value)} placeholder="SEARCH..." className="input-base" style={{ flex:1 }} />
                {isVerified
                  ? <button onClick={()=>setNewThreadOpen(true)} style={{ background:'none', border:'1px solid var(--yellow)', color:'var(--yellow)', fontFamily:"'Orbitron',monospace", fontSize:10, padding:'7px 13px', cursor:'pointer', whiteSpace:'nowrap', letterSpacing:1 }}>+ NEW</button>
                  : <span style={{ fontFamily:"'Share Tech Mono',monospace", fontSize:10, color:'var(--textMuted)', padding:'8px 0', whiteSpace:'nowrap', cursor:'pointer' }} onClick={()=>setShowVerify(true)}>verify để đăng bài →</span>
                }
              </div>
              <div style={{ flex:1, overflowY:'auto', padding:'10px 13px', display:'flex', flexDirection:'column', gap:8 }}>
                {threads.map(t=>(
                  <div key={t.id} style={{
                    border:'1px solid var(--border)', background:'var(--panel)', padding:'11px 13px',
                    transition:'all .15s',
                    borderLeft:`2px solid ${t.tag==='hot'?'var(--red)':t.tag==='pinned'?'var(--yellow)':'var(--borderB)'}`,
                  }}>
                    {/* Title — clickable để mở thread */}
                    <div onClick={()=>openThread(t)} style={{ cursor:'pointer' }}>
                      <div style={{ fontSize:13, fontWeight:600, color:'var(--white)', display:'flex', alignItems:'center', gap:5, marginBottom:4, flexWrap:'wrap' }}>
                        <span className={`tag tag-${t.tag}`}>{t.tag.toUpperCase()}</span>
                        {t.is_spoiler && <span style={{ fontFamily:"'Share Tech Mono',monospace", fontSize:9, background:'rgba(255,170,0,.12)', color:'var(--yellow)', padding:'1px 5px' }}>SPOILER</span>}
                        {(t.media_urls?.length>0) && <span style={{ fontFamily:"'Share Tech Mono',monospace", fontSize:9, color:'var(--textMuted)' }}>📎</span>}
                        {t.title}
                        {isAdmin && (t as any).author && (
                          <span style={{ fontFamily:"'Share Tech Mono',monospace", fontSize:9, color:'var(--yellow)', background:'rgba(240,192,64,.08)', padding:'1px 6px', marginLeft:4 }}>
                            {(t as any).author.username}
                          </span>
                        )}
                      </div>
                    </div>
                    {/* Footer: meta + vote buttons */}
                    <div style={{ fontFamily:"'Share Tech Mono',monospace", fontSize:10, color:'var(--textMuted)', display:'flex', alignItems:'center', gap:9, flexWrap:'wrap', marginTop:2 }}>
                      <span onClick={()=>openThread(t)} style={{ cursor:'pointer', display:'contents' }}>
                        {t.visibility==='public' && t.author_profile
                          ? <span style={{ color:'var(--textDim)' }}>{t.author_profile.display_name}</span>
                          : <span>Anon</span>
                        }
                        <span>•</span>
                        <span>{new Date(t.created_at).toLocaleDateString('vi')}</span>
                        <span>•</span>
                        <span>{t.reply_count} replies</span>
                        <span>•</span>
                      </span>
                      {/* VoteButtons: stopPropagation để click không trigger openThread */}
                      <span onClick={e => e.stopPropagation()}>
                        <VoteButtons
                          targetType="thread"
                          targetId={t.id}
                          initial={threadVotes[t.id] || { upvotes: t.upvotes||0, downvotes: t.downvotes||0, myVote: 0 }}
                          onAuthRequired={() => setShowAuth(true)}
                        />
                      </span>
                    </div>
                  </div>
                ))}
                {threads.length===0 && <div style={{ textAlign:'center', padding:40, fontFamily:"'Share Tech Mono',monospace", fontSize:11, color:'var(--textMuted)' }}>NO THREADS</div>}
              </div>
            </div>
          )}

          {/* ── THREAD DETAIL ── */}
          {view==='forum' && activeThread && (
            <div style={{ display:'flex', flexDirection:'column', flex:1, overflow:'hidden' }}>
              <div style={{ flex:1, overflowY:'auto', padding:13, display:'flex', flexDirection:'column', gap:9 }}>
                <button onClick={()=>setActiveThread(null)} style={{ background:'none', border:'none', color:'var(--textDim)', fontFamily:"'Share Tech Mono',monospace", fontSize:10, cursor:'pointer', letterSpacing:1, textAlign:'left', padding:0 }}>← BACK</button>
                {/* OP */}
                <div style={{ border:'1px solid var(--borderB)', background:'var(--panel2)', padding:13 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8, paddingBottom:9, marginBottom:9, borderBottom:'1px solid rgba(255,255,255,.04)', flexWrap:'wrap' }}>
                    {activeThread.visibility==='public' && activeThread.author_profile
                      ? <span style={{ fontSize:14, fontWeight:700, color:activeThread.author_profile.color||'var(--cyan)' }}>{activeThread.author_profile.display_name}</span>
                      : <span style={{ fontSize:14, fontWeight:700, color:'var(--textDim)' }}>Anon</span>
                    }
                    <span style={{ fontFamily:"'Share Tech Mono',monospace", fontSize:9, background:'rgba(0,212,255,.1)', color:'var(--cyan)', padding:'2px 6px' }}>OP</span>
                    <span className={`tag tag-${activeThread.tag}`}>{activeThread.tag.toUpperCase()}</span>
                    {activeThread.is_spoiler && <span style={{ fontFamily:"'Share Tech Mono',monospace", fontSize:9, background:'rgba(255,170,0,.12)', color:'var(--yellow)', padding:'1px 5px' }}>SPOILER</span>}
                    {isAdmin && (activeThread as any).author && (
                      <span style={{ fontFamily:"'Share Tech Mono',monospace", fontSize:9, color:'var(--yellow)', background:'rgba(240,192,64,.08)', padding:'2px 8px' }}>
                        {(activeThread as any).author.username} · {(activeThread as any).author.verify_code}
                      </span>
                    )}
                    <span style={{ fontFamily:"'Share Tech Mono',monospace", fontSize:10, color:'var(--textMuted)', marginLeft:'auto' }}>
                      {new Date(activeThread.created_at).toLocaleString('vi')}
                    </span>
                    {(isAdmin || (activeThread as any).author_id === user?.id) && (
                      <button onClick={()=>confirm('Delete thread?',()=>deleteThread(activeThread.id))} style={{ background:'rgba(255,58,90,.08)', border:'1px solid rgba(255,58,90,.25)', color:'var(--red)', fontFamily:"'Share Tech Mono',monospace", fontSize:9, padding:'2px 7px', cursor:'pointer' }}>DEL</button>
                    )}
                    {/* ── Vote buttons trên OP ── */}
                    <VoteButtons
                      targetType="thread"
                      targetId={activeThread.id}
                      initial={threadVotes[activeThread.id] || { upvotes: activeThread.upvotes||0, downvotes: activeThread.downvotes||0, myVote: 0 }}
                      onAuthRequired={() => setShowAuth(true)}
                    />
                  </div>
                  <div style={{ fontSize:17, fontWeight:700, color:'var(--white)', marginBottom:11 }}>{activeThread.title}</div>
                  {activeThread.is_spoiler && !spoilerRevealed['op'] ? (
                    <div style={{ padding:'20px', textAlign:'center', background:'rgba(255,170,0,.06)', border:'1px solid rgba(255,170,0,.2)', cursor:'pointer' }}
                      onClick={()=>setSpoilerRevealed(s=>({...s,'op':true}))}>
                      <span style={{ fontFamily:"'Share Tech Mono',monospace", fontSize:11, color:'var(--yellow)', letterSpacing:2 }}>⚠ SPOILER — click to reveal</span>
                    </div>
                  ) : (
                    <>
                      <div style={{ fontSize:13, lineHeight:1.7, color:'var(--text)', whiteSpace:'pre-wrap' }}>{activeThread.body}</div>
                      {activeThread.media_urls?.length>0 && (
                        <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginTop:10 }}>
                          {activeThread.media_urls.map((url,i)=>(
                            activeThread.media_types[i]==='video'
                              ? <video key={i} src={url} controls style={{ maxWidth:'100%', maxHeight:300, border:'1px solid var(--border)' }} />
                              : <img key={i} src={url} alt="" style={{ maxWidth:'100%', maxHeight:300, objectFit:'contain', border:'1px solid var(--border)', cursor:'pointer' }} onClick={()=>window.open(url,'_blank')} />
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* Replies */}
                {replies.map((r,i)=>{
                  const rKey = `reply-${r.id}`
                  const isDeleted = r.body==='[deleted]'
                  return (
                  <div key={r.id} style={{ border:'1px solid var(--border)', background:'var(--panel)', padding:13 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8, paddingBottom:9, marginBottom:9, borderBottom:'1px solid rgba(255,255,255,.04)', flexWrap:'wrap' }}>
                      <span style={{ fontFamily:"'Share Tech Mono',monospace", fontSize:9, color:'var(--textMuted)' }}>#{i+1}</span>
                      {r.visibility==='public' && r.author_profile && !isDeleted
                        ? <span style={{ fontSize:13, fontWeight:700, color:r.author_profile.color||'var(--textDim)' }}>{r.author_profile.display_name}</span>
                        : <span style={{ fontSize:13, fontWeight:700, color:isDeleted?'var(--textMuted)':'var(--textDim)' }}>Anon</span>
                      }
                      {r.is_spoiler && !isDeleted && <span style={{ fontFamily:"'Share Tech Mono',monospace", fontSize:9, background:'rgba(255,170,0,.12)', color:'var(--yellow)', padding:'1px 5px' }}>SPOILER</span>}
                      {isAdmin && (r as any).author && (
                        <span style={{ fontFamily:"'Share Tech Mono',monospace", fontSize:9, color:'var(--yellow)', background:'rgba(240,192,64,.08)', padding:'2px 7px' }}>
                          {(r as any).author.username}
                        </span>
                      )}
                      <span style={{ fontFamily:"'Share Tech Mono',monospace", fontSize:10, color:'var(--textMuted)', marginLeft:'auto' }}>
                        {new Date(r.created_at).toLocaleString('vi')}
                      </span>
                      {!isDeleted && (isAdmin || (r as any).author_id === user?.id) && (
                        <button onClick={()=>confirm('Delete reply?',()=>deleteReply(r.id))} style={{ background:'rgba(255,58,90,.08)', border:'1px solid rgba(255,58,90,.25)', color:'var(--red)', fontFamily:"'Share Tech Mono',monospace", fontSize:9, padding:'2px 7px', cursor:'pointer' }}>DEL</button>
                      )}
                      {/* ── Vote buttons trên reply ── */}
                      {!isDeleted && (
                        <VoteButtons
                          targetType="reply"
                          targetId={r.id}
                          initial={replyVotes[r.id] || { upvotes: r.upvotes||0, downvotes: r.downvotes||0, myVote: 0 }}
                          onAuthRequired={() => setShowAuth(true)}
                        />
                      )}
                    </div>
                    {isDeleted ? (
                      <div style={{ fontSize:13, lineHeight:1.7, color:'var(--textMuted)', whiteSpace:'pre-wrap', fontStyle:'italic' }}>{r.body}</div>
                    ) : r.is_spoiler && !spoilerRevealed[rKey] ? (
                      <div style={{ padding:'16px', textAlign:'center', background:'rgba(255,170,0,.06)', border:'1px solid rgba(255,170,0,.2)', cursor:'pointer' }}
                        onClick={()=>setSpoilerRevealed(s=>({...s,[rKey]:true}))}>
                        <span style={{ fontFamily:"'Share Tech Mono',monospace", fontSize:11, color:'var(--yellow)', letterSpacing:2 }}>⚠ SPOILER — click to reveal</span>
                      </div>
                    ) : (
                      <>
                        <div style={{ fontSize:13, lineHeight:1.7, color:'var(--text)', whiteSpace:'pre-wrap' }}>{r.body}</div>
                        {r.media_urls?.length>0 && (
                          <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginTop:10 }}>
                            {r.media_urls.map((url,mi)=>(
                              r.media_types[mi]==='video'
                                ? <video key={mi} src={url} controls style={{ maxWidth:'100%', maxHeight:260, border:'1px solid var(--border)' }} />
                                : <img key={mi} src={url} alt="" style={{ maxWidth:'100%', maxHeight:260, objectFit:'contain', border:'1px solid var(--border)', cursor:'pointer' }} onClick={()=>window.open(url,'_blank')} />
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                  )
                })}
              </div>

              {isVerified ? (
                <div style={{ border:'1px solid var(--border)', background:'var(--panel2)', padding:13, margin:'0 13px 13px', flexShrink:0 }}>
                  {/* Visibility + Spoiler toggles */}
                  <div style={{ display:'flex', gap:8, marginBottom:8, alignItems:'center' }}>
                    <button onClick={()=>setRpVisibility(v=>v==='anon'?'public':'anon')}
                      style={{ fontFamily:"'Share Tech Mono',monospace", fontSize:9, padding:'3px 8px', cursor:'pointer', letterSpacing:1,
                        background: rpVisibility==='public' ? 'rgba(0,212,255,.12)' : 'none',
                        border: `1px solid ${rpVisibility==='public' ? 'var(--cyan)' : 'var(--border)'}`,
                        color: rpVisibility==='public' ? 'var(--cyan)' : 'var(--textMuted)',
                      }}>
                      {rpVisibility==='public' ? (activeProfile ? activeProfile.display_name : 'PUBLIC') : 'ANON'}
                    </button>
                    <button onClick={()=>setRpSpoiler(s=>!s)}
                      style={{ fontFamily:"'Share Tech Mono',monospace", fontSize:9, padding:'3px 8px', cursor:'pointer', letterSpacing:1,
                        background: rpSpoiler ? 'rgba(255,170,0,.12)' : 'none',
                        border: `1px solid ${rpSpoiler ? 'var(--yellow)' : 'var(--border)'}`,
                        color: rpSpoiler ? 'var(--yellow)' : 'var(--textMuted)',
                      }}>
                      SPOILER {rpSpoiler ? 'ON' : 'OFF'}
                    </button>
                    {rpVisibility==='public' && !activeProfile && (
                      <span style={{ fontFamily:"'Share Tech Mono',monospace", fontSize:9, color:'var(--red)' }}>⚠ cần active profile</span>
                    )}
                  </div>
                  <textarea value={replyInput} onChange={e=>setReplyInput(e.target.value)} placeholder="Write your reply..."
                    style={{ width:'100%', background:'var(--bg3)', border:'1px solid var(--border)', color:'var(--white)', fontFamily:'Rajdhani,sans-serif', fontSize:13, padding:'8px 11px', resize:'vertical', outline:'none', minHeight:65, display:'block', marginBottom:8 }} />
                  {/* Media preview */}
                  {rpMediaUrls.length>0 && (
                    <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:8 }}>
                      {rpMediaUrls.map((url,i)=>(
                        <div key={i} style={{ position:'relative' }}>
                          {rpMediaTypes[i]==='video'
                            ? <video src={url} style={{ height:70, border:'1px solid var(--border)' }} />
                            : <img src={url} alt="" style={{ height:70, objectFit:'cover', border:'1px solid var(--border)' }} />
                          }
                          <button onClick={()=>{ setRpMediaUrls(u=>u.filter((_,j)=>j!==i)); setRpMediaTypes(t=>t.filter((_,j)=>j!==i)) }}
                            style={{ position:'absolute', top:2, right:2, background:'rgba(0,0,0,.7)', border:'none', color:'white', width:16, height:16, cursor:'pointer', fontSize:10, lineHeight:1 }}>✕</button>
                        </div>
                      ))}
                    </div>
                  )}
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                    <label style={{ cursor:'pointer' }}>
                      <input type="file" accept="image/jpeg,image/png,image/webp,image/gif,video/mp4" multiple style={{ display:'none' }}
                        onChange={e=>handleMediaSelect(e.target.files, setRpMediaUrls, setRpMediaTypes, setRpUploading, rpMediaUrls.length)} />
                      <span style={{ fontFamily:"'Share Tech Mono',monospace", fontSize:9, color:'var(--textMuted)', padding:'3px 8px', border:'1px solid var(--border)', cursor:'pointer', letterSpacing:1 }}>
                        {rpUploading ? 'UPLOADING...' : `📎 MEDIA (${rpMediaUrls.length}/4)`}
                      </span>
                    </label>
                    <button onClick={postReply} className="btn-primary" style={{ padding:'7px 18px', fontSize:10 }} disabled={rpUploading}>POST</button>
                  </div>
                </div>
              ) : user ? (
                <div style={{ padding:13, textAlign:'center', fontFamily:"'Share Tech Mono',monospace", fontSize:11, color:'var(--textMuted)', cursor:'pointer', flexShrink:0 }} onClick={()=>setShowVerify(true)}>
                  // cần verify code để comment //
                </div>
              ) : null}
            </div>
          )}

          {/* ── DM TAB ── */}
          {view==='dm' && (
            <div style={{ display:'flex', flex:1, overflow:'hidden' }}>
              <div style={{ width:200, borderRight:'1px solid var(--border)', display:'flex', flexDirection:'column', overflow:'hidden' }}>
                <div className="sec-head">DIRECT MESSAGES</div>
                <div style={{ flex:1, overflowY:'auto' }}>
                  {conversations.map((c: any)=>(
                    <div key={c.partner.id} onClick={()=>openDmTab(c.partner)} style={{ padding:'8px 13px', cursor:'pointer', borderBottom:'1px solid rgba(255,255,255,.03)', background: activeDm?.id===c.partner.id?'rgba(0,212,255,.05)':'none' }}>
                      <div style={{ fontSize:13, fontWeight:600, color:'var(--cyan)', marginBottom:3 }}>{c.partner.username}</div>
                      <div style={{ fontSize:11, color:'var(--textMuted)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{c.lastMessage?.content}</div>
                    </div>
                  ))}
                  {conversations.length===0 && <div style={{ padding:16, fontFamily:"'Share Tech Mono',monospace", fontSize:10, color:'var(--textMuted)' }}>No conversations yet.</div>}
                </div>
              </div>
              <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
                {activeDm ? (
                  <>
                    <div style={{ padding:'9px 15px', background:'var(--panel2)', borderBottom:'1px solid var(--border)', flexShrink:0 }}>
                      <span style={{ fontFamily:"'Orbitron',monospace", fontSize:13, color:'var(--cyan)' }}>{activeDm.username}</span>
                    </div>
                    <div style={{ flex:1, overflowY:'auto', padding:'11px 15px', display:'flex', flexDirection:'column', gap:4, background:'var(--panel)' }}>
                      {dmMessages.map((m:any)=>{
                        const isMine = (m.sender?.id ?? m.sender_id) === user?.id
                        const partnerName = activeDm?.username || '?'
                        return (
                          <div key={m.id} style={{
                            display:'flex',
                            flexDirection: isMine ? 'row-reverse' : 'row',
                            gap:8, alignItems:'flex-end',
                            marginLeft:  isMine ? '15%' : 0,
                            marginRight: isMine ? 0 : '15%',
                          }}>
                            {/* mini avatar */}
                            <div style={{
                              width:24, height:24, borderRadius:'50%', flexShrink:0,
                              background: isMine ? 'var(--cyan)' : 'var(--borderB)',
                              display:'flex', alignItems:'center', justifyContent:'center',
                              fontSize:10, fontWeight:900, color:'#000',
                              fontFamily:"'Orbitron',monospace",
                              alignSelf:'flex-end', marginBottom:2,
                            }}>
                              {isMine
                                ? (user?.username?.[0] ?? '?').toUpperCase()
                                : partnerName[0].toUpperCase()
                              }
                            </div>
                            <div style={{
                              maxWidth:'100%', padding:'8px 12px',
                              background: isMine ? 'rgba(0,212,255,.13)' : 'rgba(255,255,255,.04)',
                              border:`1px solid ${isMine ? 'rgba(0,212,255,.4)' : 'rgba(255,255,255,.08)'}`,
                              borderRadius: isMine ? '8px 8px 2px 8px' : '8px 8px 8px 2px',
                            }}>
                              <div style={{
                                fontSize:9, fontFamily:"'Share Tech Mono',monospace",
                                color: isMine ? 'var(--cyan)' : 'var(--textDim)',
                                marginBottom:4, letterSpacing:0.5,
                              }}>
                                {isMine ? 'YOU' : partnerName.toUpperCase()}
                              </div>
                              <div style={{ fontSize:13, color:'var(--text)', lineHeight:1.5 }}>{m.content}</div>
                              <div style={{ fontSize:10, color:'var(--textMuted)', fontFamily:"'Share Tech Mono',monospace", marginTop:4, textAlign:isMine?'right':'left' }}>
                                {new Date(m.created_at).toLocaleTimeString('vi',{hour:'2-digit',minute:'2-digit'})}
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                    <div style={{ padding:'10px 13px', background:'var(--panel2)', borderTop:'1px solid var(--borderB)', display:'flex', gap:8, flexShrink:0 }}>
                      <input value={dmInput} onChange={e=>setDmInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&sendDmTab()} placeholder="Send a message..." className="input-base" style={{ flex:1 }} />
                      <button onClick={sendDmTab} className="btn-primary" style={{ padding:'8px 15px', fontSize:10 }}>SEND</button>
                    </div>
                  </>
                ) : (
                  <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', fontFamily:"'Share Tech Mono',monospace", fontSize:11, color:'var(--textMuted)' }}>Select a conversation</div>
                )}
              </div>
            </div>
          )}

          {/* ── PROFILE ── */}
          {view==='profile' && (
            <div style={{ flex:1, overflowY:'auto' }}>
              <div style={{ padding:20, maxWidth:560, margin:'0 auto', display:'flex', flexDirection:'column', gap:16 }}>
                {!user ? (
                  <div style={{ textAlign:'center', padding:60, fontFamily:"'Share Tech Mono',monospace", fontSize:11, color:'var(--textMuted)' }}>
                    // NOT LOGGED IN //<br/><br/>
                    <button className="btn-primary" onClick={()=>setShowAuth(true)} style={{ marginTop:16 }}>LOGIN / JOIN</button>
                  </div>
                ) : (
                  <>
                    <div style={{ border:'1px solid var(--borderB)', background:'var(--panel2)', padding:24, display:'flex', gap:20, alignItems:'flex-start' }}>
                      <AvatarUpload currentUrl={undefined} onUploaded={()=>{}} />
                      <div style={{ flex:1 }}>
                        <div style={{ fontFamily:"'Orbitron',monospace", fontSize:20, fontWeight:700, color:activeProfile?.color||'var(--cyan)', marginBottom:4 }}>{user.username}</div>
                        <div style={{ fontFamily:"'Share Tech Mono',monospace", fontSize:10, color:'var(--textMuted)', marginBottom:12 }}>
                          {isAdmin ? '// ADMINISTRATOR //' : isVerified ? '// VERIFIED //' : '// UNVERIFIED //'}
                        </div>
                        {!isVerified && (
                          <button onClick={()=>setShowVerify(true)} style={{ fontFamily:"'Share Tech Mono',monospace", fontSize:10, padding:'5px 12px', background:'rgba(240,192,64,.08)', border:'1px solid var(--yellow)', color:'var(--yellow)', cursor:'pointer', letterSpacing:1, textTransform:'uppercase' }}>VERIFY CODE →</button>
                        )}
                      </div>
                    </div>
                    {/* Profiles */}
                    <div style={{ border:'1px solid var(--border)', background:'var(--panel)' }}>
                      <div className="sec-head">MY PROFILES ({profiles.length}/5)</div>
                      <div style={{ padding:'8px 0' }}>
                        {profiles.map(p=>(
                          <div key={p.id} style={{ padding:'7px 13px', display:'flex', alignItems:'center', gap:10, borderBottom:'1px solid rgba(255,255,255,.03)' }}>
                            <div style={{ width:28, height:28, background:p.color, display:'flex', alignItems:'center', justifyContent:'center', fontFamily:"'Orbitron',monospace", fontSize:12, fontWeight:900, color:'#000' }}>{p.avatar}</div>
                            <span style={{ fontSize:13, fontWeight:600, color:p.color, flex:1 }}>{p.display_name}</span>
                            {activeProfile?.id===p.id && <span style={{ fontFamily:"'Share Tech Mono',monospace", fontSize:9, color:'var(--cyan)' }}>ACTIVE</span>}
                            <button onClick={()=>switchProfile(p)} style={{ background:'none', border:'1px solid var(--border)', color:'var(--textDim)', fontFamily:"'Share Tech Mono',monospace", fontSize:9, padding:'2px 7px', cursor:'pointer' }}>USE</button>
                            {!p.is_default && (
                              <button onClick={()=>confirm(`Delete "${p.display_name}"?`,()=>deleteProfile(p.id))} style={{ background:'none', border:'1px solid rgba(255,58,90,.3)', color:'var(--red)', fontFamily:"'Share Tech Mono',monospace", fontSize:9, padding:'2px 7px', cursor:'pointer' }}>DEL</button>
                            )}
                          </div>
                        ))}
                        {profiles.length<5 && (
                          <div style={{ padding:'8px 13px' }}>
                            {!showNewProf ? (
                              <button onClick={()=>setShowNewProf(true)} style={{ background:'none', border:'1px dashed var(--border)', color:'var(--textMuted)', fontFamily:"'Share Tech Mono',monospace", fontSize:10, padding:'7px 14px', cursor:'pointer', width:'100%' }}>+ NEW PROFILE</button>
                            ) : (
                              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                                <input value={newProfName} onChange={e=>setNewProfName(e.target.value)} placeholder="Profile name..." className="input-base" />
                                <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
                                  {AVATARS.map(a=><div key={a} onClick={()=>setNewProfAvatar(a)} style={{ width:28, height:28, background:newProfColor, color:'#000', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:"'Orbitron',monospace", fontSize:12, fontWeight:900, cursor:'pointer', border: newProfAvatar===a?'2px solid white':'2px solid transparent' }}>{a}</div>)}
                                </div>
                                <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
                                  {COLORS.map(c=><div key={c} onClick={()=>setNewProfColor(c)} style={{ width:24, height:24, background:c, cursor:'pointer', border: newProfColor===c?'2px solid white':'2px solid transparent' }} />)}
                                </div>
                                <div style={{ display:'flex', gap:8 }}>
                                  <button onClick={async()=>{ await createProfile(newProfName,newProfAvatar,newProfColor); setShowNewProf(false); setNewProfName('') }} className="btn-primary" style={{ flex:1, padding:'8px 0', fontSize:10 }}>CREATE</button>
                                  <button onClick={()=>setShowNewProf(false)} className="btn-outline" style={{ padding:'8px 14px' }}>CANCEL</button>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* ── ADMIN ── */}
          {view==='admin' && isAdmin && (
            <div style={{ display:'flex', flexDirection:'column', flex:1, overflow:'hidden' }}>
              <div style={{ display:'flex', borderBottom:'2px solid var(--yellow)', background:'#050e08', flexShrink:0 }}>
                {(['overview','users','audit'] as AdminTab[]).map(t=>(
                  <button key={t} onClick={()=>setAdminTab(t)} style={{
                    padding:'10px 16px', background:adminTab===t?'#0a1e0a':'none', border:'none',
                    borderRight:'1px solid #1a3a20', color:adminTab===t?'var(--yellow)':'#2a6a2a',
                    fontFamily:"'Share Tech Mono',monospace", fontSize:11, letterSpacing:2,
                    cursor:'pointer', textTransform:'uppercase',
                  }}>{t}</button>
                ))}
              </div>
              <div style={{ flex:1, overflowY:'auto', padding:18 }}>
                {adminTab==='overview' && adminData.overview && (
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10 }}>
                    {Object.entries(adminData.overview.overview||{}).map(([k,v])=>(
                      <div key={k} style={{ background:'#070f09', border:'1px solid #1a3a1a', padding:16, textAlign:'center' }}>
                        <div style={{ fontFamily:"'Orbitron',monospace", fontSize:26, fontWeight:700, color:'var(--yellow)' }}>{v as number}</div>
                        <div style={{ fontFamily:"'Share Tech Mono',monospace", fontSize:9, color:'#2a6a2a', letterSpacing:2, marginTop:4 }}>{k.toUpperCase()}</div>
                      </div>
                    ))}
                  </div>
                )}
                {adminTab==='users' && (
                  <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                    <input value={adminSearch} onChange={e=>setAdminSearch(e.target.value)} placeholder="SEARCH USERS..." style={{ background:'#070f09', border:'1px solid #1a3a1a', color:'var(--white)', fontFamily:"'Share Tech Mono',monospace", fontSize:11, padding:'8px 12px', outline:'none', maxWidth:320 }} />
                    <div style={{ border:'1px solid #1a3a1a' }}>
                      {(adminData.users?.users||[]).filter((u:any)=>u.username.toLowerCase().includes(adminSearch.toLowerCase())).map((u:any,i:number)=>(
                        <div key={u.id} style={{ display:'grid', gridTemplateColumns:'24px 130px 1fr 80px 120px', padding:'9px 12px', borderBottom:'1px solid rgba(0,80,0,.2)', fontSize:13, alignItems:'center' }}>
                          <span style={{ fontFamily:"'Share Tech Mono',monospace", fontSize:10, color:'var(--textMuted)' }}>{i+1}</span>
                          <span style={{ fontWeight:700, color:u.is_banned?'var(--red)':'var(--cyan)' }}>{u.username}</span>
                          <span style={{ fontSize:11, color:'var(--textDim)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{u.discord_username||'—'}</span>
                          <span style={{ fontFamily:"'Share Tech Mono',monospace", fontSize:9, padding:'2px 6px', background:u.is_banned?'rgba(255,58,90,.1)':u.role==='admin'?'rgba(240,192,64,.12)':'rgba(0,100,150,.12)', color:u.is_banned?'var(--red)':u.role==='admin'?'var(--yellow)':'var(--cyanDim)', width:'fit-content' }}>
                            {u.is_banned?'BANNED':u.role.toUpperCase()}
                          </span>
                          <div style={{ display:'flex', gap:4, justifyContent:'flex-end' }}>
                            {u.username!=='admin'&&<>
                              <button onClick={()=>confirm(`${u.is_banned?'Unban':'Ban'} "${u.username}"?`,()=>adminAction(u.is_banned?'unban_user':'ban_user',u.id))} style={{ background:'rgba(240,192,64,.06)', border:'1px solid rgba(240,192,64,.2)', color:'var(--yellow)', fontFamily:"'Share Tech Mono',monospace", fontSize:9, padding:'3px 8px', cursor:'pointer' }}>{u.is_banned?'UNBAN':'BAN'}</button>
                              <button onClick={()=>confirm(`Revoke code of "${u.username}"?`,()=>adminAction('revoke_code',u.id))} style={{ background:'rgba(255,58,90,.06)', border:'1px solid rgba(255,58,90,.2)', color:'var(--red)', fontFamily:"'Share Tech Mono',monospace", fontSize:9, padding:'3px 8px', cursor:'pointer' }}>REVOKE</button>
                            </>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {adminTab==='audit' && <AuditLog />}
              </div>
            </div>
          )}
        </main>

        {/* RIGHT SIDEBAR — member list for chat, rules for others */}
        <aside style={{ borderLeft:'1px solid var(--border)', display:'flex', flexDirection:'column', overflow:'hidden' }}>
          {view==='chat' && activeRoom ? (
            <MemberList
              key={`${activeRoom.id}-${memberTick}`}
              roomId={activeRoom.id}
              ownerId={roomOwners[activeRoom.id] || ''}
              onDmClick={dmPopup.openDm}
            />
          ) : (
            <>
              <div className="sec-head">STATUS</div>
              <div style={{ padding:'7px 13px', display:'flex', justifyContent:'space-between', borderBottom:'1px solid rgba(255,255,255,.03)', fontFamily:"'Share Tech Mono',monospace", fontSize:10, color:'var(--textMuted)' }}>NETWORK <span style={{color:'var(--green)'}}>ACTIVE</span></div>
              <div style={{ padding:'7px 13px', display:'flex', justifyContent:'space-between', borderBottom:'1px solid rgba(255,255,255,.03)', fontFamily:"'Share Tech Mono',monospace", fontSize:10, color:'var(--textMuted)' }}>VERIFY <span style={{color:isVerified?'var(--green)':'var(--yellow)'}}>{isVerified?'ACTIVE':'PENDING'}</span></div>
              <div className="sec-head">RULES</div>
              <div style={{ padding:'11px 13px', fontFamily:"'Share Tech Mono',monospace", fontSize:10, color:'var(--textDim)', lineHeight:1.9 }}>
                No fighting.<br/>No revealing identities.<br/>Help each other.<br/>Keep the peace.<br/><br/>
                <span style={{color:'var(--yellow)'}}>We are formless.</span>
              </div>
            </>
          )}
        </aside>
      </div>

      {/* ── MODALS ───────────────────────────────────── */}
      {showAuth    && <AuthModal   onClose={()=>setShowAuth(false)} />}
      {showVerify  && <VerifyModal onClose={()=>setShowVerify(false)} />}
      {showCreateRoom && <CreateRoomModal onCreated={r=>{ setRooms(rs=>[...rs,r]); setShowCreateRoom(false) }} onCancel={()=>setShowCreateRoom(false)} />}
      {passwordRoom && (
        <RoomPasswordModal
          roomName={passwordRoom.name}
          roomId={passwordRoom.id}
          onSuccess={()=>{ setActiveRoom(passwordRoom); fetchMessages(passwordRoom.id); setPasswordRoom(null) }}
          onCancel={()=>setPasswordRoom(null)}
        />
      )}

      {/* New thread modal */}
      {newThreadOpen && (
        <div className="overlay" onClick={e=>e.target===e.currentTarget&&setNewThreadOpen(false)}>
          <div className="modal-box" style={{ width:480 }}>
            <button onClick={()=>setNewThreadOpen(false)} style={{ position:'absolute', top:10, right:14, background:'none', border:'none', color:'var(--textMuted)', fontSize:17, cursor:'pointer' }}>✕</button>
            <div style={{ fontFamily:"'Orbitron',monospace", fontSize:14, color:'var(--cyan)', textAlign:'center', letterSpacing:2, marginBottom:3 }}>NEW THREAD</div>
            {/* Visibility + Spoiler */}
            <div style={{ display:'flex', gap:8, marginBottom:14, justifyContent:'center' }}>
              <button onClick={()=>setNtVisibility(v=>v==='anon'?'public':'anon')}
                style={{ fontFamily:"'Share Tech Mono',monospace", fontSize:9, padding:'4px 10px', cursor:'pointer', letterSpacing:1,
                  background: ntVisibility==='public' ? 'rgba(0,212,255,.12)' : 'none',
                  border: `1px solid ${ntVisibility==='public' ? 'var(--cyan)' : 'var(--border)'}`,
                  color: ntVisibility==='public' ? 'var(--cyan)' : 'var(--textMuted)',
                }}>
                {ntVisibility==='public' ? (activeProfile ? `PUBLIC: ${activeProfile.display_name}` : 'PUBLIC (no profile)') : 'ANON'}
              </button>
              <button onClick={()=>setNtSpoiler(s=>!s)}
                style={{ fontFamily:"'Share Tech Mono',monospace", fontSize:9, padding:'4px 10px', cursor:'pointer', letterSpacing:1,
                  background: ntSpoiler ? 'rgba(255,170,0,.12)' : 'none',
                  border: `1px solid ${ntSpoiler ? 'var(--yellow)' : 'var(--border)'}`,
                  color: ntSpoiler ? 'var(--yellow)' : 'var(--textMuted)',
                }}>
                SPOILER {ntSpoiler ? 'ON' : 'OFF'}
              </button>
            </div>
            {ntVisibility==='public' && !activeProfile && (
              <div style={{ fontFamily:"'Share Tech Mono',monospace", fontSize:9, color:'var(--red)', textAlign:'center', marginBottom:10 }}>⚠ cần active profile để đăng public</div>
            )}
            <label style={{ fontFamily:"'Share Tech Mono',monospace", fontSize:10, color:'var(--textDim)', letterSpacing:2, display:'block', marginBottom:5 }}>TITLE</label>
            <input value={ntTitle} onChange={e=>setNtTitle(e.target.value)} className="input-base" placeholder="Thread title..." style={{ display:'block', marginBottom:10 }} />
            <label style={{ fontFamily:"'Share Tech Mono',monospace", fontSize:10, color:'var(--textDim)', letterSpacing:2, display:'block', marginBottom:5 }}>CONTENT</label>
            <textarea value={ntBody} onChange={e=>setNtBody(e.target.value)} placeholder="What's on your mind..." style={{ width:'100%', background:'var(--bg3)', border:'1px solid var(--border)', color:'var(--white)', fontFamily:'Rajdhani,sans-serif', fontSize:13, padding:'9px 12px', resize:'vertical', outline:'none', minHeight:90, display:'block', marginBottom:10 }} />
            <select value={ntTag} onChange={e=>setNtTag(e.target.value as any)} style={{ width:'100%', background:'var(--bg3)', border:'1px solid var(--border)', color:'var(--white)', fontFamily:'Rajdhani,sans-serif', fontSize:13, padding:'9px 12px', outline:'none', marginBottom:10 }}>
              <option value="new">NEW</option>
              <option value="discussion">DISCUSSION</option>
              <option value="hot">HOT</option>
            </select>
            {/* Media attach */}
            {ntMediaUrls.length>0 && (
              <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:8 }}>
                {ntMediaUrls.map((url,i)=>(
                  <div key={i} style={{ position:'relative' }}>
                    {ntMediaTypes[i]==='video'
                      ? <video src={url} style={{ height:70, border:'1px solid var(--border)' }} />
                      : <img src={url} alt="" style={{ height:70, objectFit:'cover', border:'1px solid var(--border)' }} />
                    }
                    <button onClick={()=>{ setNtMediaUrls(u=>u.filter((_,j)=>j!==i)); setNtMediaTypes(t=>t.filter((_,j)=>j!==i)) }}
                      style={{ position:'absolute', top:2, right:2, background:'rgba(0,0,0,.7)', border:'none', color:'white', width:16, height:16, cursor:'pointer', fontSize:10, lineHeight:1 }}>✕</button>
                  </div>
                ))}
              </div>
            )}
            <div style={{ display:'flex', gap:8, alignItems:'center', marginBottom:10 }}>
              <label style={{ cursor:'pointer', flex:1 }}>
                <input type="file" accept="image/jpeg,image/png,image/webp,image/gif,video/mp4" multiple style={{ display:'none' }}
                  onChange={e=>handleMediaSelect(e.target.files, setNtMediaUrls, setNtMediaTypes, setNtUploading, ntMediaUrls.length)} />
                <span style={{ fontFamily:"'Share Tech Mono',monospace", fontSize:9, color:'var(--textMuted)', padding:'4px 10px', border:'1px solid var(--border)', cursor:'pointer', letterSpacing:1, display:'inline-block' }}>
                  {ntUploading ? 'UPLOADING...' : `📎 ATTACH MEDIA (${ntMediaUrls.length}/4)`}
                </span>
              </label>
            </div>
            <button onClick={postThread} className="btn-primary" style={{ width:'100%' }} disabled={ntUploading}>POST THREAD</button>
          </div>
        </div>
      )}

      {/* Confirm dialog */}
      {confirmAction && (
        <div className="overlay">
          <div className="modal-box" style={{ width:340, textAlign:'center' }}>
            <div style={{ fontFamily:"'Orbitron',monospace", fontSize:14, color:'var(--red)', letterSpacing:2, marginBottom:16 }}>CONFIRM</div>
            <div style={{ fontSize:14, color:'var(--text)', marginBottom:20, lineHeight:1.6 }}>{confirmAction.msg}</div>
            <div style={{ display:'flex', gap:10 }}>
              <button onClick={()=>{ confirmAction.cb(); setConfirmAction(null) }} style={{ flex:1, padding:11, background:'var(--red)', border:'none', color:'white', fontFamily:"'Orbitron',monospace", fontSize:10, letterSpacing:2, cursor:'pointer' }}>CONFIRM</button>
              <button onClick={()=>setConfirmAction(null)} className="btn-outline" style={{ flex:1, padding:11 }}>CANCEL</button>
            </div>
          </div>
        </div>
      )}

      {/* DM Popup stack */}
      <DmPopupStack
        windows={dmPopup.windows}
        onOpen={dmPopup.openDm}
        onClose={dmPopup.closeDm}
        onMinimize={dmPopup.minimizeDm}
        onSend={dmPopup.sendDm}
      />

      <style>{`
        @keyframes glitch{0%,89%,100%{text-shadow:0 0 12px rgba(0,212,255,.5)}90%{text-shadow:3px 0 #ff3a5a,-3px 0 #f0c040}95%{text-shadow:-2px 0 var(--cyan),2px 0 #ff3a5a}}
        @keyframes blink{0%,100%{opacity:1}50%{opacity:.2}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}
        .msg-actions{transition:opacity .15s}
      `}</style>
    </div>
  )
}
