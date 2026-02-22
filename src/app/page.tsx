'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import type { Thread, Reply, Message, Room, DmConversation, DirectMessage } from '@/types'

// ── CONSTANTS ────────────────────────────────────────────────
const COLORS   = ['#00d4ff','#f0c040','#ff3a5a','#00ff88','#c580ff','#ff8844','#44aaff','#ff44cc','#88ff44','#ffaa00']
const AVATARS  = ['◈','∆','◉','⊕','⬡','◆','▲','⬟','✦','⬠']
const GATE_PASS = 'amorph'

type View = 'chat' | 'forum' | 'dm' | 'profile' | 'admin' | 'settings'
type AuthMode = 'login' | 'register' | 'guest'
type AdminTab = 'overview' | 'users' | 'rooms' | 'posts' | 'messages'

// ── GATE ─────────────────────────────────────────────────────
function Gate({ onEnter }: { onEnter: () => void }) {
  const [phase,    setPhase]    = useState(0)   // 0-5 typewriter lines
  const [showInput,setShowInput]= useState(false)
  const [value,    setValue]    = useState('')
  const [error,    setError]    = useState(false)
  const [granted,  setGranted]  = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const lines = [
    { text: 'connecting to bbs.amorph.ikebukuro.jp...',  color: '#1a4a2a' },
    { text: 'establishing secure tunnel...',              color: '#1a4a2a' },
    { text: 'connection established.',                    color: '#00ff88' },
    { text: '',                                           color: '#1a4a2a' },
    { text: '⚠  this network requires authorization.',   color: '#f0c040' },
    { text: 'only members may enter. password required.', color: '#1a4a2a' },
  ]

  useEffect(() => {
    const delays = [0, 900, 1800, 2500, 3200, 4000]
    delays.forEach((d, i) => setTimeout(() => setPhase(p => Math.max(p, i + 1)), d))
    setTimeout(() => { setShowInput(true); inputRef.current?.focus() }, 4600)
  }, [])

  const submit = () => {
    if (value.toLowerCase() === GATE_PASS) {
      setGranted(true)
      setTimeout(onEnter, 1400)
    } else {
      setError(true)
      setValue('')
      setTimeout(() => setError(false), 600)
    }
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'#000', zIndex:5000, display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ width: 'min(480px, 92vw)', fontFamily: "'Share Tech Mono', monospace" }}>
        {lines.slice(0, phase).map((l, i) => (
          <div key={i} style={{ fontSize:13, lineHeight:2, color: l.color, whiteSpace:'pre' }}>{l.text}</div>
        ))}

        {showInput && !granted && (
          <div style={{ marginTop:24, display:'flex', alignItems:'center', gap:10, fontSize:14, color:'#00ff88' }}>
            <span style={{ color:'#2a6a4a' }}>password:</span>
            <input
              ref={inputRef}
              type="password"
              value={value}
              onChange={e => setValue(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && submit()}
              autoComplete="off"
              style={{ background:'none', border:'none', outline:'none', color:'#00ff88', fontFamily:'inherit', fontSize:14, caretColor:'#00ff88', flex:1 }}
            />
            <span style={{ display:'inline-block', width:9, height:16, background:'#00ff88', animation:'blink 0.8s step-end infinite', verticalAlign:'middle' }} />
          </div>
        )}

        {error && (
          <div style={{ marginTop:16, color:'#ff3a5a', fontSize:12, letterSpacing:1, animation:'shake 0.3s ease' }}>
            // ACCESS DENIED — INCORRECT PASSWORD //
          </div>
        )}

        {granted && (
          <div style={{ marginTop:20, textAlign:'center', color:'#00ff88', fontSize:13, letterSpacing:3 }}>
            // ACCESS GRANTED — WELCOME TO AMORPH //
          </div>
        )}

        <div style={{ marginTop:32, textAlign:'center', color:'#0f3020', fontSize:10, letterSpacing:1 }}>
          // hint: the password is "amorph" //
        </div>
      </div>

      <style>{`
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
        @keyframes shake { 0%,100%{transform:translateX(0)} 25%{transform:translateX(-8px)} 75%{transform:translateX(8px)} }
      `}</style>
    </div>
  )
}

// ── AUTH MODAL ───────────────────────────────────────────────
function AuthModal({ onClose }: { onClose: () => void }) {
  const { login, register } = useAuth()
  const [mode,     setMode]     = useState<AuthMode>('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [err,      setErr]      = useState('')
  const [loading,  setLoading]  = useState(false)
  const [pickedColor,  setPickedColor]  = useState(COLORS[0])
  const [pickedAvatar, setPickedAvatar] = useState(AVATARS[0])

  const submit = async () => {
    setErr(''); setLoading(true)
    try {
      if (mode === 'login')    await login(username, password)
      if (mode === 'register') await register(username, password)
      onClose()
    } catch (e: any) {
      setErr(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box">
        <button onClick={onClose} style={{ position:'absolute', top:10, right:14, background:'none', border:'none', color:'var(--textMuted)', fontSize:17, cursor:'pointer' }}>✕</button>

        <div style={{ fontFamily:"'Orbitron', monospace", fontSize:18, color:'var(--cyan)', textAlign:'center', letterSpacing:4, marginBottom:3, textShadow:'0 0 20px rgba(0,212,255,.4)' }}>
          {mode === 'login' ? 'ENTER' : 'JOIN'}
        </div>
        <div style={{ fontFamily:"'Share Tech Mono', monospace", fontSize:10, color:'var(--textMuted)', textAlign:'center', marginBottom:22, letterSpacing:1 }}>
          {mode === 'login' ? '// welcome back //' : '// become formless //'}
        </div>

        {/* Tabs */}
        <div style={{ display:'flex', marginBottom:18, border:'1px solid var(--border)' }}>
          {(['login','register'] as AuthMode[]).map(m => (
            <button key={m} onClick={() => setMode(m)} style={{
              flex:1, padding:8, background: mode===m ? 'var(--panel)' : 'none',
              border:'none', borderRight:'1px solid var(--border)',
              color: mode===m ? 'var(--cyan)' : 'var(--textDim)',
              fontFamily:"'Share Tech Mono', monospace", fontSize:10, letterSpacing:1,
              cursor:'pointer', textTransform:'uppercase',
            }}>{m}</button>
          ))}
        </div>

        <label style={{ fontFamily:"'Share Tech Mono', monospace", fontSize:10, color:'var(--textDim)', letterSpacing:2, display:'block', marginBottom:5 }}>USERNAME</label>
        <input className="input-base" value={username} onChange={e=>setUsername(e.target.value)} placeholder="your alias..." style={{ display:'block' }} />

        <label style={{ fontFamily:"'Share Tech Mono', monospace", fontSize:10, color:'var(--textDim)', letterSpacing:2, display:'block', margin:'13px 0 5px' }}>PASSWORD</label>
        <input className="input-base" type="password" value={password} onChange={e=>setPassword(e.target.value)} onKeyDown={e=>e.key==='Enter'&&submit()} placeholder="••••••••" style={{ display:'block' }} />

        {mode === 'register' && (
          <>
            <label style={{ fontFamily:"'Share Tech Mono', monospace", fontSize:10, color:'var(--textDim)', letterSpacing:2, display:'block', margin:'13px 0 7px' }}>AVATAR</label>
            <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:10 }}>
              {AVATARS.map(a => (
                <div key={a} onClick={()=>setPickedAvatar(a)} style={{
                  width:32, height:32, background:pickedColor, color:'#000',
                  display:'flex', alignItems:'center', justifyContent:'center',
                  fontFamily:"'Orbitron', monospace", fontSize:13, fontWeight:900,
                  cursor:'pointer', border: pickedAvatar===a ? '2px solid white' : '2px solid transparent',
                  transform: pickedAvatar===a ? 'scale(1.1)' : 'none', transition:'all .15s',
                }}>{a}</div>
              ))}
            </div>
            <label style={{ fontFamily:"'Share Tech Mono', monospace", fontSize:10, color:'var(--textDim)', letterSpacing:2, display:'block', marginBottom:7 }}>COLOR</label>
            <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
              {COLORS.map(c => (
                <div key={c} onClick={()=>setPickedColor(c)} style={{
                  width:26, height:26, background:c, cursor:'pointer',
                  border: pickedColor===c ? '2px solid white' : '2px solid transparent',
                  transform: pickedColor===c ? 'scale(1.15)' : 'none', transition:'all .15s',
                }} />
              ))}
            </div>
          </>
        )}

        {err && (
          <div style={{ marginTop:12, padding:'6px 10px', background:'rgba(255,58,90,.06)', border:'1px solid rgba(255,58,90,.2)', color:'var(--red)', fontFamily:"'Share Tech Mono', monospace", fontSize:10 }}>
            ⚠ {err}
          </div>
        )}

        <button className="btn-primary" onClick={submit} disabled={loading} style={{ width:'100%', marginTop:18, opacity: loading ? .7 : 1 }}>
          {loading ? '...' : mode === 'login' ? 'LOGIN' : 'CREATE ACCOUNT'}
        </button>
      </div>
    </div>
  )
}

// ── VERIFY MODAL ─────────────────────────────────────────────
function VerifyModal({ onClose }: { onClose: () => void }) {
  const { verifyCode } = useAuth()
  const [code,    setCode]    = useState('')
  const [err,     setErr]     = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async () => {
    setErr(''); setLoading(true)
    try {
      const { discord_username } = await verifyCode(code)
      setSuccess(`Verified! Linked to Discord: ${discord_username}`)
      setTimeout(onClose, 2000)
    } catch (e: any) { setErr(e.message) }
    finally { setLoading(false) }
  }

  return (
    <div className="overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box">
        <button onClick={onClose} style={{ position:'absolute', top:10, right:14, background:'none', border:'none', color:'var(--textMuted)', fontSize:17, cursor:'pointer' }}>✕</button>
        <div style={{ fontFamily:"'Orbitron', monospace", fontSize:15, color:'var(--yellow)', textAlign:'center', letterSpacing:3, marginBottom:4 }}>VERIFY CODE</div>
        <div style={{ fontFamily:"'Share Tech Mono', monospace", fontSize:10, color:'var(--textMuted)', textAlign:'center', marginBottom:20, letterSpacing:1, lineHeight:1.8 }}>
          Nhập invite code từ Discord bot (/getcode)<br/>để mở quyền đăng bài và comment.
        </div>
        <input className="input-base" value={code} onChange={e=>setCode(e.target.value.toUpperCase())} onKeyDown={e=>e.key==='Enter'&&submit()} placeholder="XXXXXXXX" style={{ display:'block', letterSpacing:3, textAlign:'center', fontSize:16 }} />
        {err     && <div style={{ marginTop:10, color:'var(--red)', fontFamily:"'Share Tech Mono', monospace", fontSize:10 }}>⚠ {err}</div>}
        {success && <div style={{ marginTop:10, color:'var(--green)', fontFamily:"'Share Tech Mono', monospace", fontSize:10 }}>✓ {success}</div>}
        <button className="btn-primary" onClick={submit} disabled={loading} style={{ width:'100%', marginTop:16 }}>
          {loading ? '...' : 'VERIFY'}
        </button>
      </div>
    </div>
  )
}

// ── MAIN APP ──────────────────────────────────────────────────
export default function Home() {
  const { user, profiles, activeProfile, loading, logout, switchProfile, createProfile, deleteProfile, updateProfile } = useAuth()

  const [gateOpen,   setGateOpen]   = useState(true)
  const [appVisible, setAppVisible] = useState(false)
  const [showAuth,   setShowAuth]   = useState(false)
  const [showVerify, setShowVerify] = useState(false)
  const [view,       setView]       = useState<View>('chat')

  // Chat state
  const [rooms,       setRooms]       = useState<Room[]>([])
  const [activeRoom,  setActiveRoom]  = useState<Room | null>(null)
  const [messages,    setMessages]    = useState<Message[]>([])
  const [chatInput,   setChatInput]   = useState('')
  const msgEndRef = useRef<HTMLDivElement>(null)

  // Forum state
  const [threads,       setThreads]       = useState<Thread[]>([])
  const [activeThread,  setActiveThread]  = useState<Thread | null>(null)
  const [replies,       setReplies]       = useState<Reply[]>([])
  const [forumSearch,   setForumSearch]   = useState('')
  const [replyInput,    setReplyInput]    = useState('')
  const [newThreadOpen, setNewThreadOpen] = useState(false)
  const [ntTitle,       setNtTitle]       = useState('')
  const [ntBody,        setNtBody]        = useState('')
  const [ntTag,         setNtTag]         = useState<'new'|'hot'|'discussion'>('new')

  // DM state
  const [conversations, setConversations] = useState<DmConversation[]>([])
  const [activeDm,      setActiveDm]      = useState<{id:string,username:string} | null>(null)
  const [dmMessages,    setDmMessages]    = useState<DirectMessage[]>([])
  const [dmInput,       setDmInput]       = useState('')

  // Profile editor state
  const [editingProfile, setEditingProfile] = useState<string|null>(null)
  const [newProfName,    setNewProfName]    = useState('')
  const [newProfAvatar,  setNewProfAvatar]  = useState(AVATARS[0])
  const [newProfColor,   setNewProfColor]   = useState(COLORS[0])
  const [showNewProf,    setShowNewProf]    = useState(false)

  // Admin state
  const [adminTab,      setAdminTab]      = useState<AdminTab>('overview')
  const [adminData,     setAdminData]     = useState<any>({})
  const [adminSearch,   setAdminSearch]   = useState('')
  const [confirmAction, setConfirmAction] = useState<{msg:string,cb:()=>void}|null>(null)

  // ── Boot ──────────────────────────────────────────────────
  const onGateEnter = useCallback(() => {
    setGateOpen(false)
    setAppVisible(true)
    fetchRooms()
    if (!user) setTimeout(() => setShowAuth(true), 500)
  }, [user])

  useEffect(() => {
    if (appVisible && !loading && !user) setShowAuth(true)
  }, [appVisible, loading, user])

  // ── Rooms ──────────────────────────────────────────────────
  const fetchRooms = async () => {
    const r = await fetch('/api/chat/rooms').catch(()=>null)
    if (!r) return
    const { rooms: data } = await r.json()
    setRooms(data || [])
    if (data?.length) { setActiveRoom(data[0]); fetchMessages(data[0].id) }
  }

  const fetchMessages = async (roomId: string) => {
    const r = await fetch(`/api/chat/messages?room_id=${roomId}`)
    const { messages: data } = await r.json()
    setMessages(data || [])
    setTimeout(() => msgEndRef.current?.scrollIntoView(), 50)
  }

  // Realtime chat
  useEffect(() => {
    if (!activeRoom) return
    const ch = supabase.channel(`room-${activeRoom.id}`)
      .on('postgres_changes', { event:'INSERT', schema:'public', table:'messages', filter:`room_id=eq.${activeRoom.id}` },
        () => fetchMessages(activeRoom.id))
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [activeRoom?.id])

  const sendMessage = async () => {
    if (!chatInput.trim() || !user || !activeRoom) return
    await fetch('/api/chat/messages', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ room_id: activeRoom.id, content: chatInput.trim() }),
    })
    setChatInput('')
  }

  // ── Forum ──────────────────────────────────────────────────
  const fetchThreads = useCallback(async () => {
    const params = new URLSearchParams()
    if (forumSearch) params.set('search', forumSearch)
    const r = await fetch(`/api/forum/threads?${params}`)
    const { threads: data } = await r.json()
    setThreads(data || [])
  }, [forumSearch])

  useEffect(() => { if (view === 'forum') fetchThreads() }, [view, fetchThreads])

  const openThread = async (t: Thread) => {
    setActiveThread(t)
    const r = await fetch(`/api/forum/replies?thread_id=${t.id}`)
    const { replies: data } = await r.json()
    setReplies(data || [])
  }

  const postThread = async () => {
    if (!ntTitle.trim() || !ntBody.trim()) return
    const r = await fetch('/api/forum/threads', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ title:ntTitle, body:ntBody, tag:ntTag, profile_id: activeProfile?.id }),
    })
    if (r.ok) { setNewThreadOpen(false); setNtTitle(''); setNtBody(''); fetchThreads() }
  }

  const postReply = async () => {
    if (!replyInput.trim() || !activeThread) return
    const r = await fetch('/api/forum/replies', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ thread_id: activeThread.id, body: replyInput, profile_id: activeProfile?.id }),
    })
    if (r.ok) { setReplyInput(''); openThread(activeThread) }
  }

  // ── DM ─────────────────────────────────────────────────────
  const fetchConversations = async () => {
    const r = await fetch('/api/dm')
    const { conversations: data } = await r.json()
    setConversations(data || [])
  }

  const openDm = async (partner: {id:string,username:string}) => {
    setActiveDm(partner)
    const r = await fetch(`/api/dm?with=${partner.id}`)
    const { messages: data } = await r.json()
    setDmMessages(data || [])
  }

  const sendDm = async () => {
    if (!dmInput.trim() || !activeDm) return
    await fetch('/api/dm', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ receiver_id: activeDm.id, content: dmInput.trim() }),
    })
    setDmInput('')
    openDm(activeDm)
  }

  useEffect(() => { if (view === 'dm') fetchConversations() }, [view])

  // ── Admin ──────────────────────────────────────────────────
  const fetchAdmin = async (section: string) => {
    const r = await fetch(`/api/admin?section=${section}`)
    const data = await r.json()
    setAdminData((d: any) => ({ ...d, [section]: data }))
  }

  useEffect(() => { if (view === 'admin') fetchAdmin(adminTab) }, [view, adminTab])

  const adminAction = async (action: string, target_id: string, extra?: any) => {
    const r = await fetch('/api/admin', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ action, target_id, ...extra }),
    })
    if (r.ok) fetchAdmin(adminTab)
  }

  const confirm = (msg: string, cb: () => void) => setConfirmAction({ msg, cb })

  // ── RENDER ─────────────────────────────────────────────────
  if (gateOpen) return <Gate onEnter={onGateEnter} />

  const isAdmin    = user?.role === 'admin'
  const isVerified = user?.is_verified

  return (
    <div style={{ position:'relative', zIndex:1, display:'grid', gridTemplateRows:'52px 1fr', height:'100vh', opacity: appVisible?1:0, transition:'opacity .6s' }}>

      {/* ── HEADER ──────────────────────────────────── */}
      <header style={{ display:'flex', alignItems:'center', gap:14, padding:'0 18px', background:'rgba(4,9,13,.97)', borderBottom:'1px solid var(--border)', position:'relative', zIndex:50, backdropFilter:'blur(12px)' }}>
        <div onClick={()=>setView('profile')} style={{ fontFamily:"'Orbitron', monospace", fontSize:17, fontWeight:900, color:'var(--cyan)', letterSpacing:5, cursor:'pointer', animation:'glitch 9s infinite' }}>
          AMORPH<span style={{color:'var(--yellow)'}}>BBS</span>
        </div>

        <nav style={{ display:'flex', gap:2 }}>
          {(['chat','forum','dm'] as View[]).map(v => (
            <button key={v} onClick={()=>setView(v)} style={{
              fontFamily:"'Share Tech Mono', monospace", fontSize:11, letterSpacing:1.5,
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
                <button onClick={()=>setShowVerify(true)} style={{ fontFamily:"'Share Tech Mono', monospace", fontSize:10, padding:'4px 10px', background:'rgba(240,192,64,.08)', border:'1px solid var(--yellow)', color:'var(--yellow)', cursor:'pointer', letterSpacing:1, textTransform:'uppercase' }}>
                  VERIFY CODE
                </button>
              )}
              {isAdmin && (
                <button onClick={()=>setView('admin')} style={{ fontFamily:"'Share Tech Mono', monospace", fontSize:10, padding:'4px 10px', background: view==='admin'?'rgba(240,192,64,.1)':'none', border:'1px solid var(--border)', color:'var(--yellow)', cursor:'pointer', letterSpacing:1, textTransform:'uppercase' }}>
                  ⚙ ADMIN
                </button>
              )}
              <div onClick={()=>setView('profile')} style={{ display:'flex', alignItems:'center', gap:8, padding:'4px 12px', border:'1px solid var(--border)', background:'var(--panel)', cursor:'pointer' }}>
                {isAdmin && <span style={{ fontFamily:"'Share Tech Mono', monospace", fontSize:9, background:'rgba(240,192,64,.15)', color:'var(--yellow)', padding:'2px 6px', letterSpacing:1 }}>ADMIN</span>}
                <div style={{ width:7, height:7, borderRadius:'50%', background: isVerified?'var(--green)':'var(--yellow)', boxShadow:`0 0 6px ${isVerified?'var(--green)':'var(--yellow)'}`, animation:'blink 2.2s ease-in-out infinite' }} />
                <span style={{ fontSize:13, fontWeight:700, color: activeProfile?.color || 'var(--cyan)' }}>{user.username}</span>
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

      {/* ── SHELL ───────────────────────────────────── */}
      <div style={{ display:'grid', gridTemplateColumns:'205px 1fr 258px', overflow:'hidden' }}>

        {/* LEFT SIDEBAR */}
        <aside style={{ borderRight:'1px solid var(--border)', display:'flex', flexDirection:'column', overflow:'hidden' }}>
          <div className="sec-head">CHANNELS</div>
          <div style={{ flex:1, overflowY:'auto', padding:'5px 0' }}>
            {rooms.map(r => (
              <div key={r.id} onClick={()=>{ setActiveRoom(r); fetchMessages(r.id); setView('chat') }} style={{
                padding:'7px 13px', cursor:'pointer', fontSize:13, fontWeight:500,
                display:'flex', alignItems:'center', justifyContent:'space-between',
                borderLeft: activeRoom?.id===r.id ? '2px solid var(--cyan)' : '2px solid transparent',
                background: activeRoom?.id===r.id ? 'rgba(0,212,255,.07)' : 'none',
                color: activeRoom?.id===r.id ? 'var(--cyan)' : 'var(--text)',
                transition:'all .15s',
              }}>
                <span>#{r.name.toLowerCase()}</span>
              </div>
            ))}
          </div>

          <div className="sec-head" style={{ marginTop:'auto' }}>ONLINE</div>
          <div style={{ overflowY:'auto', maxHeight:160 }}>
            {user && (
              <div style={{ padding:'5px 13px', display:'flex', alignItems:'center', gap:8, fontSize:12, fontWeight:600 }}>
                <div style={{ width:6, height:6, borderRadius:'50%', background: activeProfile?.color||'var(--cyan)', boxShadow:`0 0 5px ${activeProfile?.color||'var(--cyan)'}` }} />
                <span style={{ color: activeProfile?.color||'var(--cyan)' }}>{user.username}</span>
              </div>
            )}
          </div>

          {/* Profile switcher */}
          {user && profiles.length > 0 && (
            <>
              <div className="sec-head">PROFILES</div>
              <div style={{ overflowY:'auto', maxHeight:140, padding:'4px 0' }}>
                {profiles.map(p => (
                  <div key={p.id} onClick={()=>switchProfile(p)} style={{
                    padding:'5px 13px', display:'flex', alignItems:'center', gap:8,
                    cursor:'pointer', fontSize:12, fontWeight:600,
                    background: activeProfile?.id===p.id ? 'rgba(0,212,255,.06)' : 'none',
                    borderLeft: activeProfile?.id===p.id ? '2px solid var(--cyan)' : '2px solid transparent',
                    transition:'all .1s',
                  }}>
                    <div className="av" style={{ width:18, height:18, fontSize:9, background:p.color }}>{p.avatar}</div>
                    <span style={{ color:p.color }}>{p.display_name}</span>
                    {activeProfile?.id===p.id && <span style={{ marginLeft:'auto', fontSize:9, color:'var(--cyan)', fontFamily:"'Share Tech Mono', monospace" }}>ACTIVE</span>}
                  </div>
                ))}
              </div>
            </>
          )}
        </aside>

        {/* MAIN AREA */}
        <main style={{ display:'flex', flexDirection:'column', overflow:'hidden' }}>

          {/* ── CHAT VIEW ── */}
          {view === 'chat' && (
            <div style={{ display:'flex', flexDirection:'column', flex:1, overflow:'hidden' }}>
              <div style={{ padding:'9px 15px', background:'var(--panel2)', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', gap:12, flexShrink:0 }}>
                <span style={{ fontFamily:"'Orbitron', monospace", fontSize:13, fontWeight:700, color:'var(--yellow)' }}>#{activeRoom?.name.toLowerCase() || 'amorph'}</span>
                <span style={{ fontFamily:"'Share Tech Mono', monospace", fontSize:10, color:'var(--textMuted)', marginLeft:'auto' }}>{activeRoom?.description}</span>
              </div>
              <div style={{ flex:1, overflowY:'auto', padding:'11px 15px', display:'flex', flexDirection:'column', gap:1, background:'var(--panel)' }}>
                {messages.map(m => (
                  <div key={m.id} className="animate-msg-in" style={{ display:'flex', gap:10, padding:'4px 0', borderBottom:'1px solid rgba(255,255,255,.02)' }}>
                    <span style={{ fontFamily:"'Share Tech Mono', monospace", fontSize:10, color:'var(--textMuted)', width:40, flexShrink:0, marginTop:2 }}>
                      {new Date(m.created_at).toLocaleTimeString('vi',{hour:'2-digit',minute:'2-digit'})}
                    </span>
                    <span style={{ fontSize:13, fontWeight:700, color:'var(--cyan)', width:90, flexShrink:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                      {(m.author as any)?.username || '???'}
                    </span>
                    <span style={{ fontSize:13, color:'var(--text)', flex:1, lineHeight:1.5, wordBreak:'break-word' }}>{m.content}</span>
                  </div>
                ))}
                <div ref={msgEndRef} />
              </div>
              <div style={{ padding:'10px 13px', background:'var(--panel2)', borderTop:'1px solid var(--borderB)', display:'flex', gap:8, flexShrink:0 }}>
                {user ? (
                  <>
                    <textarea value={chatInput} onChange={e=>setChatInput(e.target.value)}
                      onKeyDown={e=>{ if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendMessage()} }}
                      placeholder="Message... (Enter to send)"
                      style={{ flex:1, background:'var(--bg3)', border:'1px solid var(--border)', color:'var(--white)', fontFamily:'Rajdhani, sans-serif', fontSize:13, padding:'8px 12px', resize:'none', outline:'none', minHeight:38, maxHeight:90 }}
                    />
                    <button onClick={sendMessage} className="btn-primary" style={{ alignSelf:'flex-end', padding:'8px 15px' }}>SEND</button>
                  </>
                ) : (
                  <div style={{ flex:1, fontFamily:"'Share Tech Mono', monospace", fontSize:11, color:'var(--textMuted)', padding:'8px 0', cursor:'pointer' }} onClick={()=>setShowAuth(true)}>
                    // đăng nhập để chat //
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── FORUM VIEW ── */}
          {view === 'forum' && !activeThread && (
            <div style={{ display:'flex', flexDirection:'column', flex:1, overflow:'hidden' }}>
              <div style={{ padding:'9px 13px', background:'var(--panel2)', borderBottom:'1px solid var(--border)', display:'flex', gap:8, flexShrink:0 }}>
                <input value={forumSearch} onChange={e=>setForumSearch(e.target.value)} placeholder="SEARCH THREADS..." className="input-base" style={{ flex:1 }} />
                {isVerified
                  ? <button onClick={()=>setNewThreadOpen(true)} style={{ background:'none', border:'1px solid var(--yellow)', color:'var(--yellow)', fontFamily:"'Orbitron', monospace", fontSize:10, padding:'7px 13px', cursor:'pointer', whiteSpace:'nowrap', letterSpacing:1, textTransform:'uppercase' }}>+ NEW THREAD</button>
                  : <span style={{ fontFamily:"'Share Tech Mono', monospace", fontSize:10, color:'var(--textMuted)', padding:'8px 0', whiteSpace:'nowrap', cursor:'pointer' }} onClick={()=>setShowVerify(true)}>verify để đăng bài →</span>
                }
              </div>
              <div style={{ flex:1, overflowY:'auto', padding:'10px 13px', display:'flex', flexDirection:'column', gap:8 }}>
                {threads.map(t => (
                  <div key={t.id} onClick={()=>openThread(t)} style={{
                    border:'1px solid var(--border)', background:'var(--panel)', padding:'11px 13px',
                    cursor:'pointer', transition:'all .15s', display:'grid', gridTemplateColumns:'1fr auto', gap:10,
                    borderLeft: `2px solid ${t.tag==='hot'?'var(--red)':t.tag==='pinned'?'var(--yellow)':'var(--borderB)'}`,
                  }}
                    onMouseEnter={e=>(e.currentTarget.style.borderColor='var(--borderB)')}
                    onMouseLeave={e=>(e.currentTarget.style.borderColor='var(--border)')}>
                    <div>
                      <div style={{ fontSize:13, fontWeight:600, color:'var(--white)', display:'flex', alignItems:'center', gap:5, marginBottom:4, flexWrap:'wrap' }}>
                        <span className={`tag tag-${t.tag}`}>{t.tag.toUpperCase()}</span>
                        {t.title}
                        {/* Admin sees author */}
                        {isAdmin && (t as any).author && (
                          <span style={{ fontFamily:"'Share Tech Mono', monospace", fontSize:9, color:'var(--yellow)', background:'rgba(240,192,64,.08)', padding:'1px 6px', marginLeft:4 }}>
                            {(t as any).author.username} · {(t as any).author.discord_username}
                          </span>
                        )}
                      </div>
                      <div style={{ fontFamily:"'Share Tech Mono', monospace", fontSize:10, color:'var(--textMuted)', display:'flex', gap:9 }}>
                        <span style={{ color:'var(--textDim)' }}>Anon</span>
                        <span>•</span>
                        <span>{new Date(t.created_at).toLocaleDateString('vi')}</span>
                        <span>•</span>
                        <span>{t.reply_count} replies</span>
                      </div>
                    </div>
                    <div style={{ textAlign:'right' }}>
                      <div style={{ fontFamily:"'Orbitron', monospace", fontSize:19, color:'var(--cyanDim)' }}>{t.reply_count}</div>
                      <div style={{ fontFamily:"'Share Tech Mono', monospace", fontSize:9, color:'var(--textMuted)' }}>replies</div>
                    </div>
                  </div>
                ))}
                {threads.length === 0 && <div style={{ textAlign:'center', padding:40, fontFamily:"'Share Tech Mono', monospace", fontSize:11, color:'var(--textMuted)' }}>NO THREADS</div>}
              </div>
            </div>
          )}

          {/* ── THREAD DETAIL ── */}
          {view === 'forum' && activeThread && (
            <div style={{ display:'flex', flexDirection:'column', flex:1, overflow:'hidden' }}>
              <div style={{ flex:1, overflowY:'auto', padding:13, display:'flex', flexDirection:'column', gap:9 }}>
                <button onClick={()=>setActiveThread(null)} style={{ background:'none', border:'none', color:'var(--textDim)', fontFamily:"'Share Tech Mono', monospace", fontSize:10, cursor:'pointer', letterSpacing:1, textAlign:'left', padding:0, textTransform:'uppercase' }}>← BACK</button>
                {/* OP */}
                <div style={{ border:'1px solid var(--borderB)', background:'var(--panel2)', padding:13 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8, paddingBottom:9, marginBottom:9, borderBottom:'1px solid rgba(255,255,255,.04)', flexWrap:'wrap' }}>
                    <span style={{ fontSize:14, fontWeight:700, color:'var(--textDim)' }}>Anon</span>
                    <span style={{ fontFamily:"'Share Tech Mono', monospace", fontSize:9, background:'rgba(0,212,255,.1)', color:'var(--cyan)', padding:'2px 6px' }}>OP</span>
                    <span className={`tag tag-${activeThread.tag}`}>{activeThread.tag.toUpperCase()}</span>
                    {isAdmin && (activeThread as any).author && (
                      <span style={{ fontFamily:"'Share Tech Mono', monospace", fontSize:9, color:'var(--yellow)', background:'rgba(240,192,64,.08)', padding:'2px 8px' }}>
                        {(activeThread as any).author.username} · {(activeThread as any).author.discord_username} · {(activeThread as any).author.verify_code}
                      </span>
                    )}
                    <span style={{ fontFamily:"'Share Tech Mono', monospace", fontSize:10, color:'var(--textMuted)', marginLeft:'auto' }}>
                      {new Date(activeThread.created_at).toLocaleString('vi')}
                    </span>
                    {isAdmin && (
                      <button onClick={()=>confirm('Delete this thread?',()=>adminAction('delete_thread',activeThread.id))} style={{ background:'rgba(255,58,90,.08)', border:'1px solid rgba(255,58,90,.25)', color:'var(--red)', fontFamily:"'Share Tech Mono', monospace", fontSize:9, padding:'2px 7px', cursor:'pointer', textTransform:'uppercase' }}>DEL</button>
                    )}
                  </div>
                  <div style={{ fontSize:17, fontWeight:700, color:'var(--white)', marginBottom:11 }}>{activeThread.title}</div>
                  <div style={{ fontSize:13, lineHeight:1.7, color:'var(--text)', whiteSpace:'pre-wrap' }}>{activeThread.body}</div>
                </div>
                {/* Replies */}
                {replies.map((r, i) => (
                  <div key={r.id} style={{ border:'1px solid var(--border)', background:'var(--panel)', padding:13, position:'relative' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8, paddingBottom:9, marginBottom:9, borderBottom:'1px solid rgba(255,255,255,.04)', flexWrap:'wrap' }}>
                      <span style={{ fontFamily:"'Share Tech Mono', monospace", fontSize:9, color:'var(--textMuted)' }}>#{i+1}</span>
                      <span style={{ fontSize:13, fontWeight:700, color:'var(--textDim)' }}>Anon</span>
                      {isAdmin && (r as any).author && (
                        <span style={{ fontFamily:"'Share Tech Mono', monospace", fontSize:9, color:'var(--yellow)', background:'rgba(240,192,64,.08)', padding:'2px 7px' }}>
                          {(r as any).author.username} · {(r as any).author.verify_code}
                        </span>
                      )}
                      <span style={{ fontFamily:"'Share Tech Mono', monospace", fontSize:10, color:'var(--textMuted)', marginLeft:'auto' }}>
                        {new Date(r.created_at).toLocaleString('vi')}
                      </span>
                      {isAdmin && (
                        <button onClick={()=>confirm('Delete reply?',()=>adminAction('delete_reply',r.id))} style={{ background:'rgba(255,58,90,.08)', border:'1px solid rgba(255,58,90,.25)', color:'var(--red)', fontFamily:"'Share Tech Mono', monospace", fontSize:9, padding:'2px 7px', cursor:'pointer', textTransform:'uppercase' }}>DEL</button>
                      )}
                    </div>
                    <div style={{ fontSize:13, lineHeight:1.7, color:'var(--text)', whiteSpace:'pre-wrap' }}>{r.body}</div>
                  </div>
                ))}
              </div>
              {/* Reply input */}
              {isVerified ? (
                <div style={{ border:'1px solid var(--border)', background:'var(--panel2)', padding:13, margin:'0 13px 13px', flexShrink:0 }}>
                  <div style={{ fontFamily:"'Share Tech Mono', monospace", fontSize:10, color:'var(--textDim)', letterSpacing:2, marginBottom:8 }}>// POST REPLY (as Anon)</div>
                  <textarea value={replyInput} onChange={e=>setReplyInput(e.target.value)} placeholder="Write your reply..."
                    style={{ width:'100%', background:'var(--bg3)', border:'1px solid var(--border)', color:'var(--white)', fontFamily:'Rajdhani, sans-serif', fontSize:13, padding:'8px 11px', resize:'vertical', outline:'none', minHeight:65, display:'block', marginBottom:8 }} />
                  <div style={{ display:'flex', justifyContent:'flex-end' }}>
                    <button onClick={postReply} className="btn-primary" style={{ padding:'7px 18px', fontSize:10 }}>POST REPLY</button>
                  </div>
                </div>
              ) : user ? (
                <div style={{ padding:13, textAlign:'center', fontFamily:"'Share Tech Mono', monospace", fontSize:11, color:'var(--textMuted)', cursor:'pointer', flexShrink:0 }} onClick={()=>setShowVerify(true)}>
                  // cần verify code để comment //
                </div>
              ) : null}
            </div>
          )}

          {/* ── DM VIEW ── */}
          {view === 'dm' && (
            <div style={{ display:'flex', flex:1, overflow:'hidden' }}>
              {/* Conversation list */}
              <div style={{ width:200, borderRight:'1px solid var(--border)', display:'flex', flexDirection:'column', overflow:'hidden' }}>
                <div className="sec-head">DIRECT MESSAGES</div>
                <div style={{ flex:1, overflowY:'auto' }}>
                  {conversations.map(c => (
                    <div key={(c.partner as any).id} onClick={()=>openDm(c.partner as any)} style={{
                      padding:'8px 13px', cursor:'pointer', borderBottom:'1px solid rgba(255,255,255,.03)',
                      background: activeDm?.id===(c.partner as any).id ? 'rgba(0,212,255,.05)' : 'none',
                      transition:'background .1s',
                    }}>
                      <div style={{ fontSize:13, fontWeight:600, color:'var(--cyan)', marginBottom:3 }}>{(c.partner as any).username}</div>
                      <div style={{ fontSize:11, color:'var(--textMuted)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{(c.lastMessage as any)?.content}</div>
                      {c.unreadCount > 0 && <span style={{ background:'var(--red)', color:'white', fontSize:9, padding:'1px 5px', borderRadius:8, fontFamily:"'Share Tech Mono', monospace" }}>{c.unreadCount}</span>}
                    </div>
                  ))}
                  {conversations.length === 0 && <div style={{ padding:16, fontFamily:"'Share Tech Mono', monospace", fontSize:10, color:'var(--textMuted)' }}>No conversations yet.</div>}
                </div>
              </div>
              {/* DM chat */}
              <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
                {activeDm ? (
                  <>
                    <div style={{ padding:'9px 15px', background:'var(--panel2)', borderBottom:'1px solid var(--border)', flexShrink:0 }}>
                      <span style={{ fontFamily:"'Orbitron', monospace", fontSize:13, color:'var(--cyan)' }}>{activeDm.username}</span>
                    </div>
                    <div style={{ flex:1, overflowY:'auto', padding:'11px 15px', display:'flex', flexDirection:'column', gap:4, background:'var(--panel)' }}>
                      {dmMessages.map(m => {
                        const isMine = m.sender_id === user?.id
                        return (
                          <div key={m.id} style={{ display:'flex', flexDirection: isMine ? 'row-reverse' : 'row', gap:10, alignItems:'flex-start' }}>
                            <div style={{ maxWidth:'70%', padding:'8px 12px', background: isMine ? 'rgba(0,212,255,.1)' : 'var(--panel2)', border:`1px solid ${isMine ? 'var(--borderB)' : 'var(--border)'}` }}>
                              <div style={{ fontSize:13, color:'var(--text)', lineHeight:1.5 }}>{m.content}</div>
                              <div style={{ fontSize:10, color:'var(--textMuted)', fontFamily:"'Share Tech Mono', monospace", marginTop:4, textAlign: isMine ? 'right' : 'left' }}>
                                {new Date(m.created_at).toLocaleTimeString('vi',{hour:'2-digit',minute:'2-digit'})}
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                    <div style={{ padding:'10px 13px', background:'var(--panel2)', borderTop:'1px solid var(--borderB)', display:'flex', gap:8, flexShrink:0 }}>
                      <input value={dmInput} onChange={e=>setDmInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&sendDm()} placeholder="Send a message..." className="input-base" style={{ flex:1 }} />
                      <button onClick={sendDm} className="btn-primary" style={{ padding:'8px 15px', fontSize:10 }}>SEND</button>
                    </div>
                  </>
                ) : (
                  <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', fontFamily:"'Share Tech Mono', monospace", fontSize:11, color:'var(--textMuted)' }}>
                    Select a conversation
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── PROFILE VIEW ── */}
          {view === 'profile' && (
            <div style={{ flex:1, overflowY:'auto' }}>
              <div style={{ padding:20, maxWidth:600, margin:'0 auto', display:'flex', flexDirection:'column', gap:16 }}>
                {!user ? (
                  <div style={{ textAlign:'center', padding:60, fontFamily:"'Share Tech Mono', monospace", fontSize:11, color:'var(--textMuted)' }}>
                    // NOT LOGGED IN //<br/><br/>
                    <button className="btn-primary" onClick={()=>setShowAuth(true)} style={{ marginTop:16 }}>LOGIN / JOIN</button>
                  </div>
                ) : (
                  <>
                    {/* Account card */}
                    <div style={{ border:'1px solid var(--borderB)', background:'var(--panel2)', padding:24, display:'flex', gap:20, alignItems:'flex-start' }}>
                      <div className="av" style={{ width:64, height:64, fontSize:24, background: activeProfile?.color||'var(--cyan)', flexShrink:0 }}>{activeProfile?.avatar||'◈'}</div>
                      <div style={{ flex:1 }}>
                        <div style={{ fontFamily:"'Orbitron', monospace", fontSize:20, fontWeight:700, color: activeProfile?.color||'var(--cyan)', marginBottom:4 }}>{user.username}</div>
                        <div style={{ fontFamily:"'Share Tech Mono', monospace", fontSize:10, color:'var(--textMuted)', marginBottom:12 }}>
                          {isAdmin ? '// NETWORK ADMINISTRATOR //' : isVerified ? '// VERIFIED MEMBER //' : '// MEMBER (unverified) //'}
                        </div>
                        {!isVerified && (
                          <button onClick={()=>setShowVerify(true)} style={{ fontFamily:"'Share Tech Mono', monospace", fontSize:10, padding:'5px 12px', background:'rgba(240,192,64,.08)', border:'1px solid var(--yellow)', color:'var(--yellow)', cursor:'pointer', letterSpacing:1, textTransform:'uppercase' }}>
                            VERIFY CODE →
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Profiles */}
                    <div style={{ border:'1px solid var(--border)', background:'var(--panel)' }}>
                      <div className="sec-head">MY PROFILES ({profiles.length}/5)</div>
                      <div style={{ padding:'8px 0' }}>
                        {profiles.map(p => (
                          <div key={p.id} style={{ padding:'7px 13px', display:'flex', alignItems:'center', gap:10, borderBottom:'1px solid rgba(255,255,255,.03)' }}>
                            <div className="av" style={{ width:28, height:28, fontSize:12, background:p.color }}>{p.avatar}</div>
                            <span style={{ fontSize:13, fontWeight:600, color:p.color, flex:1 }}>{p.display_name}</span>
                            {activeProfile?.id===p.id && <span style={{ fontFamily:"'Share Tech Mono', monospace", fontSize:9, color:'var(--cyan)' }}>ACTIVE</span>}
                            <button onClick={()=>switchProfile(p)} style={{ background:'none', border:'1px solid var(--border)', color:'var(--textDim)', fontFamily:"'Share Tech Mono', monospace", fontSize:9, padding:'2px 7px', cursor:'pointer', letterSpacing:1, textTransform:'uppercase' }}>USE</button>
                            {!p.is_default && (
                              <button onClick={()=>confirm(`Delete profile "${p.display_name}"?`,()=>deleteProfile(p.id))} style={{ background:'none', border:'1px solid rgba(255,58,90,.3)', color:'var(--red)', fontFamily:"'Share Tech Mono', monospace", fontSize:9, padding:'2px 7px', cursor:'pointer', textTransform:'uppercase' }}>DEL</button>
                            )}
                          </div>
                        ))}
                        {profiles.length < 5 && (
                          <div style={{ padding:'8px 13px' }}>
                            {!showNewProf ? (
                              <button onClick={()=>setShowNewProf(true)} style={{ background:'none', border:'1px dashed var(--border)', color:'var(--textMuted)', fontFamily:"'Share Tech Mono', monospace", fontSize:10, padding:'7px 14px', cursor:'pointer', letterSpacing:1, textTransform:'uppercase', width:'100%' }}>+ NEW PROFILE</button>
                            ) : (
                              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                                <input value={newProfName} onChange={e=>setNewProfName(e.target.value)} placeholder="Profile name..." className="input-base" />
                                <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                                  {AVATARS.map(a => <div key={a} onClick={()=>setNewProfAvatar(a)} style={{ width:28, height:28, background:newProfColor, color:'#000', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:"'Orbitron', monospace", fontSize:12, fontWeight:900, cursor:'pointer', border: newProfAvatar===a?'2px solid white':'2px solid transparent', transition:'all .1s' }}>{a}</div>)}
                                </div>
                                <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                                  {COLORS.map(c => <div key={c} onClick={()=>setNewProfColor(c)} style={{ width:24, height:24, background:c, cursor:'pointer', border: newProfColor===c?'2px solid white':'2px solid transparent', transition:'all .1s' }} />)}
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

          {/* ── ADMIN VIEW ── */}
          {view === 'admin' && isAdmin && (
            <div style={{ display:'flex', flexDirection:'column', flex:1, overflow:'hidden' }}>
              <div style={{ display:'flex', borderBottom:'2px solid var(--yellow)', background:'#050e08', flexShrink:0 }}>
                {(['overview','users','rooms','posts','messages'] as AdminTab[]).map(t => (
                  <button key={t} onClick={()=>setAdminTab(t)} style={{
                    padding:'10px 16px', background: adminTab===t ? '#0a1e0a' : 'none', border:'none',
                    borderRight:'1px solid #1a3a20',
                    color: adminTab===t ? 'var(--yellow)' : '#2a6a2a',
                    fontFamily:"'Share Tech Mono', monospace", fontSize:11, letterSpacing:2,
                    cursor:'pointer', textTransform:'uppercase',
                    borderBottom: adminTab===t ? '2px solid var(--yellow)' : 'none', marginBottom: adminTab===t ? -2 : 0,
                  }}>{t}</button>
                ))}
              </div>
              <div style={{ flex:1, overflowY:'auto', padding:18 }}>
                {adminTab === 'overview' && adminData.overview && (
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10 }}>
                    {Object.entries(adminData.overview.overview||{}).map(([k,v]) => (
                      <div key={k} style={{ background:'#070f09', border:'1px solid #1a3a1a', padding:16, textAlign:'center' }}>
                        <div style={{ fontFamily:"'Orbitron', monospace", fontSize:26, fontWeight:700, color:'var(--yellow)' }}>{v as number}</div>
                        <div style={{ fontFamily:"'Share Tech Mono', monospace", fontSize:9, color:'#2a6a2a', letterSpacing:2, marginTop:4 }}>{k.toUpperCase()}</div>
                      </div>
                    ))}
                  </div>
                )}
                {adminTab === 'users' && (
                  <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                    <input value={adminSearch} onChange={e=>setAdminSearch(e.target.value)} placeholder="SEARCH USERS..." style={{ background:'#070f09', border:'1px solid #1a3a1a', color:'var(--white)', fontFamily:"'Share Tech Mono', monospace", fontSize:11, padding:'8px 12px', outline:'none', maxWidth:320 }} />
                    <div style={{ border:'1px solid #1a3a1a' }}>
                      {(adminData.users?.users||[]).filter((u:any)=>u.username.toLowerCase().includes(adminSearch.toLowerCase())).map((u:any,i:number)=>(
                        <div key={u.id} style={{ display:'grid', gridTemplateColumns:'24px 140px 1fr 80px 80px', padding:'9px 12px', borderBottom:'1px solid rgba(0,80,0,.2)', fontSize:13, alignItems:'center' }}>
                          <span style={{ fontFamily:"'Share Tech Mono', monospace", fontSize:10, color:'var(--textMuted)' }}>{i+1}</span>
                          <span style={{ fontWeight:700, color: u.is_banned?'var(--red)':'var(--cyan)' }}>{u.username}</span>
                          <span style={{ fontSize:11, color:'var(--textDim)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{u.discord_username||'—'} {u.verify_code?`· ${u.verify_code}`:''}</span>
                          <span style={{ fontFamily:"'Share Tech Mono', monospace", fontSize:9, padding:'2px 6px', background: u.is_banned?'rgba(255,58,90,.1)':u.role==='admin'?'rgba(240,192,64,.12)':'rgba(0,100,150,.12)', color: u.is_banned?'var(--red)':u.role==='admin'?'var(--yellow)':'var(--cyanDim)', width:'fit-content' }}>
                            {u.is_banned?'BANNED':u.role.toUpperCase()}
                          </span>
                          <div style={{ display:'flex', gap:4, justifyContent:'flex-end' }}>
                            {u.username!=='admin'&&<>
                              <button onClick={()=>confirm(`${u.is_banned?'Unban':'Ban'} "${u.username}"?`,()=>adminAction(u.is_banned?'unban_user':'ban_user',u.id))} style={{ background:'rgba(240,192,64,.06)', border:'1px solid rgba(240,192,64,.2)', color:'var(--yellow)', fontFamily:"'Share Tech Mono', monospace", fontSize:9, padding:'3px 8px', cursor:'pointer', textTransform:'uppercase' }}>{u.is_banned?'UNBAN':'BAN'}</button>
                              <button onClick={()=>confirm(`Revoke code of "${u.username}"?`,()=>adminAction('revoke_code',u.id))} style={{ background:'rgba(255,58,90,.06)', border:'1px solid rgba(255,58,90,.2)', color:'var(--red)', fontFamily:"'Share Tech Mono', monospace", fontSize:9, padding:'3px 8px', cursor:'pointer', textTransform:'uppercase' }}>REVOKE</button>
                            </>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

        </main>

        {/* RIGHT SIDEBAR */}
        <aside style={{ borderLeft:'1px solid var(--border)', display:'flex', flexDirection:'column', overflow:'hidden' }}>
          <div className="sec-head">STATUS</div>
          <div style={{ padding:'7px 13px', display:'flex', justifyContent:'space-between', borderBottom:'1px solid rgba(255,255,255,.03)', fontFamily:"'Share Tech Mono', monospace", fontSize:10, color:'var(--textMuted)' }}>NETWORK <span style={{color:'var(--green)'}}>ACTIVE</span></div>
          <div style={{ padding:'7px 13px', display:'flex', justifyContent:'space-between', borderBottom:'1px solid rgba(255,255,255,.03)', fontFamily:"'Share Tech Mono', monospace", fontSize:10, color:'var(--textMuted)' }}>SERVER <span style={{color:'var(--green)'}}>IKEBUKURO-01</span></div>
          <div style={{ padding:'7px 13px', display:'flex', justifyContent:'space-between', borderBottom:'1px solid rgba(255,255,255,.03)', fontFamily:"'Share Tech Mono', monospace", fontSize:10, color:'var(--textMuted)' }}>
            VERIFY <span style={{color: isVerified?'var(--green)':'var(--yellow)'}}>{isVerified?'ACTIVE':'PENDING'}</span>
          </div>
          <div className="sec-head">RULES</div>
          <div style={{ padding:'11px 13px', fontFamily:"'Share Tech Mono', monospace", fontSize:10, color:'var(--textDim)', lineHeight:1.9 }}>
            No fighting.<br/>No revealing identities.<br/>Help each other.<br/>Keep the peace.<br/><br/>
            <span style={{color:'var(--yellow)'}}>We are formless.</span>
          </div>
        </aside>
      </div>

      {/* ── MODALS ───────────────────────────────────── */}
      {showAuth   && <AuthModal   onClose={()=>setShowAuth(false)} />}
      {showVerify && <VerifyModal onClose={()=>setShowVerify(false)} />}

      {/* New thread modal */}
      {newThreadOpen && (
        <div className="overlay" onClick={e=>e.target===e.currentTarget&&setNewThreadOpen(false)}>
          <div className="modal-box" style={{ width:460 }}>
            <button onClick={()=>setNewThreadOpen(false)} style={{ position:'absolute', top:10, right:14, background:'none', border:'none', color:'var(--textMuted)', fontSize:17, cursor:'pointer' }}>✕</button>
            <div style={{ fontFamily:"'Orbitron', monospace", fontSize:14, color:'var(--cyan)', textAlign:'center', letterSpacing:2, marginBottom:3 }}>NEW THREAD</div>
            <div style={{ fontFamily:"'Share Tech Mono', monospace", fontSize:10, color:'var(--textMuted)', textAlign:'center', marginBottom:20 }}>// post anonymously as Anon //</div>
            <label style={{ fontFamily:"'Share Tech Mono', monospace", fontSize:10, color:'var(--textDim)', letterSpacing:2, display:'block', marginBottom:5 }}>TITLE</label>
            <input value={ntTitle} onChange={e=>setNtTitle(e.target.value)} className="input-base" placeholder="Thread title..." style={{ display:'block', marginBottom:10 }} />
            <label style={{ fontFamily:"'Share Tech Mono', monospace", fontSize:10, color:'var(--textDim)', letterSpacing:2, display:'block', marginBottom:5 }}>CONTENT</label>
            <textarea value={ntBody} onChange={e=>setNtBody(e.target.value)} placeholder="What's on your mind..." style={{ width:'100%', background:'var(--bg3)', border:'1px solid var(--border)', color:'var(--white)', fontFamily:'Rajdhani, sans-serif', fontSize:13, padding:'9px 12px', resize:'vertical', outline:'none', minHeight:90, display:'block', marginBottom:10 }} />
            <label style={{ fontFamily:"'Share Tech Mono', monospace", fontSize:10, color:'var(--textDim)', letterSpacing:2, display:'block', marginBottom:5 }}>TAG</label>
            <select value={ntTag} onChange={e=>setNtTag(e.target.value as any)} style={{ width:'100%', background:'var(--bg3)', border:'1px solid var(--border)', color:'var(--white)', fontFamily:'Rajdhani, sans-serif', fontSize:13, padding:'9px 12px', outline:'none', marginBottom:10 }}>
              <option value="new">NEW</option>
              <option value="discussion">DISCUSSION</option>
              <option value="hot">HOT</option>
            </select>
            <button onClick={postThread} className="btn-primary" style={{ width:'100%' }}>POST THREAD</button>
          </div>
        </div>
      )}

      {/* Confirm dialog */}
      {confirmAction && (
        <div className="overlay">
          <div className="modal-box" style={{ width:340, textAlign:'center' }}>
            <div style={{ fontFamily:"'Orbitron', monospace", fontSize:14, color:'var(--red)', letterSpacing:2, marginBottom:16 }}>CONFIRM</div>
            <div style={{ fontSize:14, color:'var(--text)', marginBottom:20, lineHeight:1.6 }}>{confirmAction.msg}</div>
            <div style={{ display:'flex', gap:10 }}>
              <button onClick={()=>{ confirmAction.cb(); setConfirmAction(null) }} style={{ flex:1, padding:11, background:'var(--red)', border:'none', color:'white', fontFamily:"'Orbitron', monospace", fontSize:10, letterSpacing:2, cursor:'pointer', textTransform:'uppercase' }}>CONFIRM</button>
              <button onClick={()=>setConfirmAction(null)} className="btn-outline" style={{ flex:1, padding:11 }}>CANCEL</button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes glitch {
          0%,89%,100%{text-shadow:0 0 12px rgba(0,212,255,.5)}
          90%{text-shadow:3px 0 #ff3a5a,-3px 0 #f0c040,0 0 12px rgba(0,212,255,.5)}
          95%{text-shadow:-2px 0 var(--cyan),2px 0 #ff3a5a}
        }
        @keyframes blink{0%,100%{opacity:1}50%{opacity:.2}}
      `}</style>
    </div>
  )
}
