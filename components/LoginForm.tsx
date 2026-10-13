'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { notifyAccountChange } from './PracticeAccount'

export function LoginForm() {
    const [ready, setReady] = useState(false)
    useEffect(() => setReady(true), [])
    const [error, setError] = useState('')
    const [busy, setBusy] = useState(false)
    return <main className="min-h-dvh bg-bg-main px-6 py-16 text-text-main">
        <form method="post" className="mx-auto max-w-md space-y-6 rounded-[32px] border border-white/10 bg-white/[0.04] p-8" onSubmit={async (event) => {
            event.preventDefault()
            const form = new FormData(event.currentTarget)
            setBusy(true); setError('')
            try {
                const response = await fetch('/api/session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: form.get('username'), password: form.get('password') }) })
                const data = await response.json()
                if (!response.ok) throw new Error(data.error || '登录失败')
                notifyAccountChange()
                window.location.assign('/project')
            } catch (failure) { setError(failure instanceof Error ? failure.message : '登录失败，请重试'); setBusy(false) }
        }}>
            <div><h1 className="text-3xl font-semibold">登录练习场</h1><p className="mt-3 leading-7 text-text-muted">登录后查看属于你的项目深挖和练习进度。</p></div>
            <label className="block">账号<input name="username" autoComplete="username" required maxLength={64} disabled={!ready || busy} className="mt-2 w-full rounded-2xl border border-white/20 bg-bg-main p-3" /></label>
            <label className="block">密码<input name="password" type="password" autoComplete="current-password" required maxLength={256} disabled={!ready || busy} className="mt-2 w-full rounded-2xl border border-white/20 bg-bg-main p-3" /></label>
            {error && <p role="alert" className="text-error">{error}</p>}
            <button disabled={!ready || busy} className="w-full rounded-full bg-primary px-5 py-3 font-medium text-white disabled:opacity-50">{!ready ? '正在加载…' : busy ? '正在登录…' : '登录'}</button>
            <Link href="/" className="block text-center text-sm text-text-muted">返回公共练习场</Link>
        </form>
    </main>
}
