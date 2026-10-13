'use client'
import { useState } from 'react'
import Link from 'next/link'

export function SaveResumeForPractice({ text }: { text: string }) {
    const [busy, setBusy] = useState(false)
    const [savedText, setSavedText] = useState('')
    const [error, setError] = useState('')
    return <div className="mb-6 rounded-2xl border border-primary/20 bg-primary/5 p-4">
        <button disabled={busy || text.trim().length < 30} className="rounded-full border border-primary/40 px-4 py-2 text-sm text-primary disabled:opacity-50" onClick={async () => {
            setBusy(true); setError('')
            try {
                const current = await fetch('/api/my-resume', { cache: 'no-store' })
                const previous = await current.json()
                if (!current.ok) throw new Error(previous.error || '读取简历失败')
                const response = await fetch('/api/my-resume', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text, revision: previous.profile.revision }) })
                const data = await response.json()
                if (!response.ok) throw new Error(data.error || '保存失败')
                setSavedText(text)
            } catch (failure) { setError(failure instanceof Error ? failure.message : '保存失败') }
            finally { setBusy(false) }
        }}>{busy ? '正在保存…' : '保存确认版，用于项目深挖（不调用 AI）'}</button>
        {savedText === text && <p role="status" className="mt-3 text-sm text-success">确认版已保存。<Link href="/project" className="underline">前往我的项目深挖</Link>，确认后点击 AI 更新题库。</p>}
        {error && <p role="alert" className="mt-3 text-sm text-error">{error}</p>}
    </div>
}
