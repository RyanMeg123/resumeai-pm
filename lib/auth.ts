import 'server-only'

import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { contentHash, deleteData, readData, withDataLock, writeData } from './ai-store'

const ACCOUNTS = {
    zhangwenjing: { name: '张文婧', projectPrefix: 'zhangwenjing-', person: '张文婧' },
    xiaohe: { name: 'xiaohe', projectPrefix: 'xiaohe-', person: 'xiaohe' },
    tianyijia: { name: '田益嘉', projectPrefix: 'tianyijia-', person: 'tianyijia' },
} as const

export type PracticeUser = { username: string; name: string }
export const SESSION_COOKIE = 'practice-session'
export const SESSION_SECONDS = 60 * 60 * 24 * 7

type Session = { username: keyof typeof ACCOUNTS; expires: number }
type Attempts = { count: number; expires: number }

function accountName(value: string): value is keyof typeof ACCOUNTS {
    return Object.hasOwn(ACCOUNTS, value)
}

export function isSameOrigin(request: Request) {
    try {
        const origin = new URL(request.headers.get('origin') || '')
        // Next can normalize the request URL hostname; Host retains the browser-facing host and port.
        return origin.host === request.headers.get('host') && origin.protocol === new URL(request.url).protocol
    } catch { return false }
}

export async function authenticate(username: string, password: string) {
    return withDataLock('auth-attempts', async () => {
        const now = Date.now()
        const state = await readData<Record<string, Attempts>>('auth/attempts.json') ?? {}
        for (const [key, value] of Object.entries(state)) if (value.expires <= now) delete state[key]
        const key = accountName(username) ? username : 'unknown'
        const attempts = state[key] ?? { count: 0, expires: now + 15 * 60_000 }
        const total = state.total ?? { count: 0, expires: now + 15 * 60_000 }
        if (attempts.count >= 10 || total.count >= 100) return { status: 429 as const }
        state[key] = { ...attempts, count: attempts.count + 1 }
        state.total = { ...total, count: total.count + 1 }
        await writeData('auth/attempts.json', state, 15 * 60)
        const hashes: Record<string, string> = JSON.parse(process.env.PRACTICE_PASSWORD_HASHES || '{}')
        const encoded = accountName(username) ? hashes[username] : undefined
        const [salt, hash] = (encoded || '').split(':')
        const candidate = scryptSync(password, salt || 'unknown-account', 64)
        if (!accountName(username) || !hash || !/^[a-f0-9]{128}$/.test(hash) || !timingSafeEqual(candidate, Buffer.from(hash, 'hex'))) return { status: 401 as const }
        delete state[key]
        await writeData('auth/attempts.json', state, 15 * 60)
        const token = randomBytes(32).toString('hex')
        await writeData(`auth/sessions/${contentHash(token)}.json`, { username, expires: now + SESSION_SECONDS * 1000 }, SESSION_SECONDS)
        return { status: 200 as const, token }
    })
}

export async function getCurrentUser(): Promise<PracticeUser | null> {
    const token = (await cookies()).get(SESSION_COOKIE)?.value
    if (!token || !/^[a-f0-9]{64}$/.test(token)) return null
    const session = await readData<Session>(`auth/sessions/${contentHash(token)}.json`)
    if (!session || session.expires <= Date.now() || !accountName(session.username)) return null
    return { username: session.username, name: ACCOUNTS[session.username].name }
}

export async function requireUser() {
    const user = await getCurrentUser()
    if (!user) redirect('/login')
    return user
}

export async function revokeSession() {
    const token = (await cookies()).get(SESSION_COOKIE)?.value
    if (token && /^[a-f0-9]{64}$/.test(token)) await deleteData(`auth/sessions/${contentHash(token)}.json`)
}

export function projectAccount(user: PracticeUser) {
    return accountName(user.username) ? ACCOUNTS[user.username] : null
}
