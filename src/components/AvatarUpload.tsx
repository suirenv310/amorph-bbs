'use client'
import { useState, useRef, useCallback } from 'react'
import { useAuth } from '@/hooks/useAuth'

interface Props {
  currentUrl?: string
  onUploaded?: (url: string) => void
}

export default function AvatarUpload({ currentUrl, onUploaded }: Props) {
  const { user } = useAuth()
  const [dragging,  setDragging]  = useState(false)
  const [preview,   setPreview]   = useState<string | null>(currentUrl || null)
  const [uploading, setUploading] = useState(false)
  const [error,     setError]     = useState('')
  const [success,   setSuccess]   = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFile = useCallback(async (file: File) => {
    setError('')
    setSuccess(false)

    // Validate
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
    if (!allowed.includes(file.type)) { setError('PNG / JPG / WebP only'); return }
    if (file.size > 2 * 1024 * 1024) { setError('Max 2MB');               return }

    // Show preview using canvas (square crop)
    const url = await cropToSquare(file)
    setPreview(url)

    // Upload
    setUploading(true)
    try {
      // Convert data URL back to blob for upload
      const blob     = await (await fetch(url)).blob()
      const formData = new FormData()
      formData.append('avatar', blob, `avatar.${file.type.split('/')[1]}`)

      const r    = await fetch('/api/upload', { method: 'POST', body: formData })
      const data = await r.json()
      if (!r.ok) throw new Error(data.error)

      setPreview(data.avatar_url)
      setSuccess(true)
      onUploaded?.(data.avatar_url)
      setTimeout(() => setSuccess(false), 2000)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setUploading(false)
    }
  }, [onUploaded])

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }, [handleFile])

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
      {/* Preview + Drop Zone */}
      <div
        onClick={() => inputRef.current?.click()}
        onDrop={onDrop}
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        style={{
          width: 120, height: 120, cursor: 'pointer', position: 'relative',
          border: `2px ${dragging ? 'solid var(--cyan)' : 'dashed var(--border)'}`,
          background: dragging ? 'rgba(0,212,255,.05)' : 'var(--bg3)',
          transition: 'all .2s', flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          overflow: 'hidden',
        }}
      >
        {preview ? (
          <img src={preview} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <div style={{ textAlign: 'center', padding: 12 }}>
            <div style={{ fontSize: 28, marginBottom: 6 }}>◈</div>
            <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 9, color: 'var(--textMuted)', letterSpacing: 1 }}>
              CLICK OR DROP
            </div>
          </div>
        )}

        {/* Overlay on hover */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'rgba(0,0,0,.6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          opacity: 0, transition: 'opacity .2s',
        }}
          onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
          onMouseLeave={e => (e.currentTarget.style.opacity = '0')}
        >
          <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 9, color: 'var(--cyan)', letterSpacing: 1 }}>
            {uploading ? 'UPLOADING...' : 'CHANGE'}
          </span>
        </div>
      </div>

      <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={onInputChange} style={{ display: 'none' }} />

      <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 9, color: 'var(--textMuted)', letterSpacing: 1, textAlign: 'center' }}>
        PNG / JPG / WebP · Max 2MB<br/>Auto-cropped to square
      </div>

      {error   && <div style={{ color: 'var(--red)',   fontFamily: "'Share Tech Mono', monospace", fontSize: 10 }}>⚠ {error}</div>}
      {success && <div style={{ color: 'var(--green)', fontFamily: "'Share Tech Mono', monospace", fontSize: 10 }}>✓ UPLOADED</div>}
    </div>
  )
}

// ── Canvas square crop helper ────────────────────────────────
function cropToSquare(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const size   = Math.min(img.width, img.height)
      const canvas = document.createElement('canvas')
      canvas.width = canvas.height = Math.min(size, 512) // max 512px
      const ctx    = canvas.getContext('2d')!
      const scale  = canvas.width / size
      const offX   = (img.width  - size) / 2
      const offY   = (img.height - size) / 2
      ctx.drawImage(img, offX, offY, size, size, 0, 0, canvas.width, canvas.height)
      URL.revokeObjectURL(url)
      resolve(canvas.toDataURL(file.type, 0.92))
    }
    img.onerror = reject
    img.src = url
  })
}
