import { createClient } from '@supabase/supabase-js'

const url  = process.env.NEXT_PUBLIC_SUPABASE_URL  || ''
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const svc  = process.env.SUPABASE_SERVICE_ROLE_KEY || anon

// Client-side (anon key)
export const supabase = createClient(
  url || 'https://placeholder.supabase.co',
  anon || 'placeholder'
)

// Server-side (service role — bypasses RLS, only used in API routes)
export const supabaseAdmin = createClient(
  url || 'https://placeholder.supabase.co',
  svc || 'placeholder',
  { auth: { autoRefreshToken: false, persistSession: false } }
)
