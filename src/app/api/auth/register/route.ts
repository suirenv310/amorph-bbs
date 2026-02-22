import { NextResponse } from 'next/server'
import { registerUser, createToken, sessionCookie } from '@/lib/auth'

export async function POST(req: Request) {
  try {
    const { username, password } = await req.json()
    const user = await registerUser(username, password)

    const session = {
      id:           user.id,
      username:     user.username,
      role:         user.role,
      is_verified:  user.is_verified,
      is_banned:    user.is_banned,
    }
    const token = createToken(session)

    return NextResponse.json({ user: session }, {
      headers: { 'Set-Cookie': sessionCookie(token) }
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 })
  }
}
