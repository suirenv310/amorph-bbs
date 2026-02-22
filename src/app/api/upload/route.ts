import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

const MAX_SIZE  = 2 * 1024 * 1024 // 2MB
const ALLOWED   = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
const BUCKET    = 'avatars'

export async function POST(req: Request) {
  const session = getSessionUser(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await req.formData()
  const file     = formData.get('avatar') as File | null

  if (!file)                        return NextResponse.json({ error: 'No file'              }, { status: 400 })
  if (!ALLOWED.includes(file.type)) return NextResponse.json({ error: 'PNG/JPG/WebP only'   }, { status: 400 })
  if (file.size > MAX_SIZE)         return NextResponse.json({ error: 'Max 2MB'              }, { status: 400 })

  const bytes  = await file.arrayBuffer()
  const buffer = Buffer.from(bytes)
  const ext    = file.type === 'image/webp' ? 'webp' : file.type === 'image/png' ? 'png' : 'jpg'
  const path   = `${session.id}/avatar.${ext}`

  // Upload to Supabase Storage
  const { error: upErr } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(path, buffer, {
      contentType:  file.type,
      upsert:       true,   // overwrite existing
    })

  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 })

  // Get public URL
  const { data: { publicUrl } } = supabaseAdmin.storage
    .from(BUCKET)
    .getPublicUrl(path)

  // Save to user record
  await supabaseAdmin
    .from('users')
    .update({ avatar_url: publicUrl })
    .eq('id', session.id)

  return NextResponse.json({ avatar_url: publicUrl })
}
