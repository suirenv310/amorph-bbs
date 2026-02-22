import { NextResponse } from 'next/server'
import { loginUser, createToken, sessionCookie } from '@/lib/auth'

export async function POST(req: Request) {
  try {
    const { username, password } = await req.json()
    const session = await loginUser(username, password)
    const token   = createToken(session)

    return NextResponse.json({ user: session }, {
      headers: { 'Set-Cookie': sessionCookie(token) }
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 401 })
  }
}
