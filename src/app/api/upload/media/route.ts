import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

const MAX_IMAGE_SIZE = 10 * 1024 * 1024  // 10MB
const MAX_VIDEO_SIZE = 50 * 1024 * 1024  // 50MB
const ALLOWED_IMAGES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
const ALLOWED_VIDEOS = ['video/mp4']
const BUCKET = 'forum-media'

export async function POST(req: Request) {
  const session = getSessionUser(req)
  if (!session)             return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 })
  if (!session.is_verified && session.role !== 'admin')
    return NextResponse.json({ error: 'Cần verify code để upload' }, { status: 403 })

  const formData = await req.formData()
  const file = formData.get('file') as File | null

  if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 })

  const isImage = ALLOWED_IMAGES.includes(file.type)
  const isVideo = ALLOWED_VIDEOS.includes(file.type)

  if (!isImage && !isVideo)
    return NextResponse.json({ error: 'Chỉ hỗ trợ JPG/PNG/WebP/GIF và MP4' }, { status: 400 })

  const maxSize = isVideo ? MAX_VIDEO_SIZE : MAX_IMAGE_SIZE
  if (file.size > maxSize)
    return NextResponse.json({ error: `File quá lớn (max ${isVideo ? '50MB' : '10MB'})` }, { status: 400 })

  const bytes  = await file.arrayBuffer()
  const buffer = Buffer.from(bytes)

  const extMap: Record<string, string> = {
    'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp',
    'image/gif': 'gif',  'video/mp4': 'mp4',
  }
  const ext  = extMap[file.type]
  const name = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
  const path = `${session.id}/${name}`

  const { error: upErr } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(path, buffer, { contentType: file.type, upsert: false })

  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 })

  const { data: { publicUrl } } = supabaseAdmin.storage
    .from(BUCKET)
    .getPublicUrl(path)

  return NextResponse.json({
    url:  publicUrl,
    type: isImage ? 'image' : 'video',
  })
}
