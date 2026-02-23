'use client'
import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import type { SessionUser, Profile } from '@/types'

interface AuthCtx {
  user:           SessionUser | null
  profiles:       Profile[]
  activeProfile:  Profile | null
  loading:        boolean
  // Auth
  login:          (username: string, password: string) => Promise<void>
  register:       (username: string, password: string) => Promise<void>
  logout:         () => Promise<void>
  // Verify
  verifyCode:     (code: string) => Promise<{ discord_username: string }>
  // Profiles
  fetchProfiles:  () => Promise<void>
  createProfile:  (display_name: string, avatar: string, color: string) => Promise<Profile>
  switchProfile:  (profile: Profile) => void
  deleteProfile:  (id: string) => Promise<void>
  updateProfile:  (id: string, updates: Partial<Pick<Profile, 'display_name' | 'avatar' | 'color'>>) => Promise<void>
}

const Ctx = createContext<AuthCtx>(null!)
export const useAuth = () => useContext(Ctx)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user,          setUser]          = useState<SessionUser | null>(null)
  const [profiles,      setProfiles]      = useState<Profile[]>([])
  const [activeProfile, setActiveProfile] = useState<Profile | null>(null)
  const [loading,       setLoading]       = useState(true)

  // ── Boot ────────────────────────────────────────────────
  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => r.json())
      .then(({ user }) => {
        setUser(user || null)
        if (user) fetchProfilesFor(user.id)
      })
      .finally(() => setLoading(false))
  }, [])

  const ACTIVE_PROFILE_KEY = 'amorph_active_profile_id'

  const fetchProfilesFor = useCallback(async (userId?: string) => {
    const r = await fetch('/api/profiles')
    if (!r.ok) return
    const { profiles } = await r.json()
    setProfiles(profiles || [])

    // Ưu tiên: saved in localStorage → is_default → first
    const savedId = localStorage.getItem(ACTIVE_PROFILE_KEY)
    const saved   = savedId ? (profiles || []).find((p: Profile) => p.id === savedId) : null
    const def     = saved
      || (profiles || []).find((p: Profile) => p.is_default)
      || profiles?.[0]
      || null
    setActiveProfile(def)
  }, [])

  const fetchProfiles = useCallback(() => fetchProfilesFor(), [fetchProfilesFor])

  // ── Auth actions ────────────────────────────────────────
  const login = async (username: string, password: string) => {
    const r = await fetch('/api/auth/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    })
    const data = await r.json()
    if (!r.ok) throw new Error(data.error)
    setUser(data.user)
    fetchProfilesFor(data.user.id)
  }

  const register = async (username: string, password: string) => {
    const r = await fetch('/api/auth/register', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    })
    const data = await r.json()
    if (!r.ok) throw new Error(data.error)
    setUser(data.user)
    fetchProfilesFor(data.user.id)
  }

  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    localStorage.removeItem('amorph_active_profile_id')
    setUser(null); setProfiles([]); setActiveProfile(null)
  }

  // ── Verify ──────────────────────────────────────────────
  const verifyCode = async (code: string) => {
    const r = await fetch('/api/auth/verify', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    })
    const data = await r.json()
    if (!r.ok) throw new Error(data.error)
    setUser(u => u ? { ...u, is_verified: true } : u)
    return { discord_username: data.discord_username }
  }

  // ── Profile actions ─────────────────────────────────────
  const createProfile = async (display_name: string, avatar: string, color: string) => {
    const r = await fetch('/api/profiles', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ display_name, avatar, color }),
    })
    const data = await r.json()
    if (!r.ok) throw new Error(data.error)
    setProfiles(ps => [...ps, data.profile])
    return data.profile as Profile
  }

  const switchProfile = (profile: Profile) => {
    setActiveProfile(profile)
    localStorage.setItem('amorph_active_profile_id', profile.id)
  }

  const deleteProfile = async (id: string) => {
    const r = await fetch(`/api/profiles?id=${id}`, { method: 'DELETE' })
    const data = await r.json()
    if (!r.ok) throw new Error(data.error)
    setProfiles(ps => ps.filter(p => p.id !== id))
    if (activeProfile?.id === id) {
      const remaining = profiles.filter(p => p.id !== id)
      setActiveProfile(remaining[0] || null)
    }
  }

  const updateProfile = async (id: string, updates: Partial<Pick<Profile, 'display_name' | 'avatar' | 'color'>>) => {
    const r = await fetch('/api/profiles', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profile_id: id, ...updates }),
    })
    const data = await r.json()
    if (!r.ok) throw new Error(data.error)
    setProfiles(ps => ps.map(p => p.id === id ? { ...p, ...updates } : p))
    if (activeProfile?.id === id) setActiveProfile(p => p ? { ...p, ...updates } : p)
  }

  return (
    <Ctx.Provider value={{
      user, profiles, activeProfile, loading,
      login, register, logout, verifyCode,
      fetchProfiles, createProfile, switchProfile, deleteProfile, updateProfile,
    }}>
      {children}
    </Ctx.Provider>
  )
}
