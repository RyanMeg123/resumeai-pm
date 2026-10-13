'use client'

import Link from 'next/link'
import { createContext, useContext, useEffect, useState } from 'react'
import type { PracticeUser } from '@/lib/auth'

const accountTabId = Math.random().toString(36).slice(2)
export function notifyAccountChange() {
    if (typeof BroadcastChannel === 'undefined') return
    const channel = new BroadcastChannel('practice-account')
    channel.postMessage(accountTabId)
    channel.close()
}

const AccountContext = createContext<PracticeUser | null>(null)
export function usePracticeUser() { return useContext(AccountContext) }
export function practiceStorageKey(key: string, user: PracticeUser | null) {
    return user ? `${key}:${user.username}` : key
}

export function PracticeAccount({ user, children }: { user: PracticeUser | null; children: React.ReactNode }) {
    const [error, setError] = useState('')
    const [busy, setBusy] = useState(false)
    useEffect(() => {
        const checkSession = async () => {
            try {
                const response = await fetch('/api/session', { cache: 'no-store' })
                if (!response.ok) return
                const data = await response.json()
                if ((data.user?.username ?? null) !== (user?.username ?? null)) window.location.reload()
            } catch { /* Keep the current page usable while offline. */ }
        }
        window.addEventListener('focus', checkSession)
        const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('practice-account') : null
        if (channel) channel.onmessage = (event) => {
            if (event.data !== accountTabId) window.location.reload()
        }
        return () => { window.removeEventListener('focus', checkSession); channel?.close() }
    }, [user?.username])

    const logout = async () => {
        setBusy(true); setError('')
        try {
            const response = await fetch('/api/session', { method: 'DELETE' })
            if (!response.ok) throw new Error()
            notifyAccountChange()
            window.location.assign('/login')
        } catch { setError('退出失败，请重试'); setBusy(false) }
    }

    return <AccountContext.Provider value={user}>
        <nav aria-label="账号" className="flex flex-wrap items-center justify-end gap-4 border-b border-white/10 bg-[#0E0F14] px-6 py-3 text-sm text-text-main">
            {user ? <><span>{user.name} · {user.username}</span><Link href="/project">我的项目深挖</Link><button disabled={busy} onClick={logout} className="rounded-full border border-white/20 px-4 py-2 disabled:opacity-50">{busy ? '正在退出…' : '退出登录'}</button></> : <Link href="/login" className="rounded-full border border-primary/40 px-4 py-2">登录我的账号</Link>}
            {error && <p role="alert" className="text-error">{error}</p>}
        </nav>
        {children}
    </AccountContext.Provider>
}
