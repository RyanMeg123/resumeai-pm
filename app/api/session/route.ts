import { NextResponse } from 'next/server'
import { authenticate, getCurrentUser, isSameOrigin, revokeSession, SESSION_COOKIE, SESSION_SECONDS } from '@/lib/auth'

export async function GET() {
    return NextResponse.json({ user: await getCurrentUser() }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(request: Request) {
    if (!isSameOrigin(request)) return NextResponse.json({ error: '请从本站登录页面提交' }, { status: 403 })
    try {
        const body = await request.json()
        if (!body || typeof body.username !== 'string' || typeof body.password !== 'string' || body.username.length > 64 || body.password.length > 256) {
            return NextResponse.json({ error: '请输入有效的账号和密码' }, { status: 400 })
        }
        const result = await authenticate(body.username.trim().toLowerCase(), body.password)
        if (result.status !== 200) return NextResponse.json({ error: result.status === 429 ? '尝试次数过多，请 15 分钟后重试' : '账号或密码不正确' }, { status: result.status })
        await revokeSession()
        const response = NextResponse.json({ ok: true })
        response.cookies.set(SESSION_COOKIE, result.token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', path: '/', maxAge: SESSION_SECONDS })
        return response
    } catch {
        return NextResponse.json({ error: '登录失败，请检查输入或稍后重试' }, { status: 400 })
    }
}

export async function DELETE(request: Request) {
    if (!isSameOrigin(request)) return NextResponse.json({ error: '请求来源无效' }, { status: 403 })
    await revokeSession()
    const response = NextResponse.json({ ok: true })
    response.cookies.set(SESSION_COOKIE, '', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', path: '/', maxAge: 0 })
    return response
}
