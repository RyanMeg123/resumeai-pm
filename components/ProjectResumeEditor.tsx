'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { ResumeProfile } from '@/lib/resume-projects'

export function ProjectResumeEditor({ initial, usage }: { initial: ResumeProfile; usage: { used: number; limit: number } }) {
    const router = useRouter()
    // 已保存但还没分析（或改过后没重新分析）的简历，进入页面时自动分析一次
    const stale = Boolean(initial.hash) && initial.generated?.hash !== initial.hash
    const [expanded, setExpanded] = useState(!initial.text || stale)
    const [profile, setProfile] = useState(initial)
    const [text, setText] = useState(initial.text)
    const [busy, setBusy] = useState(false)
    const [message, setMessage] = useState('')
    const [error, setError] = useState('')
    const fileInput = useRef<HTMLInputElement>(null)
    const dirty = text.trim().replace(/\r\n/g, '\n') !== profile.text
    const save = async () => {
        const response = await fetch('/api/my-resume', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text, revision: profile.revision }) })
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || '保存失败')
        setProfile(data.profile)
        return data.profile as ResumeProfile
    }
    const update = async () => {
        setBusy(true); setMessage(''); setError('')
        try {
            const saved = dirty || !profile.hash ? await save() : profile
            setMessage('正在分析简历里的项目，大约需要 1 分钟…')
            const response = await fetch('/api/my-resume', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ hash: saved.hash }) })
            const data = await response.json()
            if (!response.ok) throw new Error(data.error || '生成失败')
            setProfile(data.profile)
            setMessage(data.cached ? '已复用这版简历的题库，没有再次调用 AI。' : '新版项目深挖已生成并保存，旧版资料已保留。')
            router.refresh()
        } catch (failure) { setError(failure instanceof Error ? failure.message : '请求失败，原题库已保留') }
        finally { setBusy(false) }
    }
    const autoStarted = useRef(false)
    useEffect(() => {
        // ref 防止开发模式下 effect 执行两次导致重复请求；失败后不自动重试，由用户手动点
        if (!stale || autoStarted.current) return
        autoStarted.current = true
        void update()
    }, []) // eslint-disable-line react-hooks/exhaustive-deps
    const upToDate = !dirty && Boolean(profile.hash) && profile.generated?.hash === profile.hash
    return <section className="mx-auto max-w-5xl px-6 pt-8 text-text-main">
        <details open={expanded} onToggle={(event) => setExpanded(event.currentTarget.open)} className="rounded-[28px] border border-white/10 bg-white/[0.04] p-6">
            <summary className="cursor-pointer font-medium">{profile.text ? '我的简历 · 修改后自动重新分析' : '第一步：上传你的简历'}</summary>
            <p className="mt-3 text-sm leading-7 text-text-muted">{profile.text ? '改完点“保存并分析”，会按新简历重新生成项目深挖题；旧版本的题库会保留归档。' : '导入或粘贴简历，保存后会自动分析里面的核心项目，生成专属深挖题、参考思路和追问。'}</p>
            <p className="mt-2 text-xs text-text-muted">今日已用 {usage.used} / {usage.limit} 次新生成额度。保存、查记录与重复内容不占新生成额度。</p>
            <label className="mt-4 block text-sm">最新简历<textarea value={text} onChange={(event) => setText(event.target.value)} disabled={busy} maxLength={20000} className="mt-2 min-h-60 w-full rounded-2xl border border-white/15 bg-bg-main p-4 leading-7" placeholder="在这里粘贴简历全文或更新后的项目经历（至少30字）…" /></label>
            <input ref={fileInput} type="file" accept=".pdf,.docx,.txt" aria-label="导入最新简历文件" disabled={busy} className="mt-3 block max-w-full text-sm" onChange={async (event) => {
                const file = event.target.files?.[0]
                if (!file) return
                setBusy(true); setError('')
                try {
                    if (file.size > 5 * 1024 * 1024) throw new Error('文件不能超过 5MB')
                    const form = new FormData(); form.append('file', file)
                    const response = await fetch('/api/extract-text', { method: 'POST', body: form })
                    const data = await response.json()
                    if (!response.ok) throw new Error(data.error || '解析失败')
                    if (data.text.length > 20000) throw new Error('简历超过2万字，请精简后粘贴')
                    setText(data.text); setMessage('文件已读取，请核对内容后保存或更新深挖。读取文件不会调用 AI。')
                } catch (failure) { setError(failure instanceof Error ? failure.message : '文件读取失败') }
                finally { setBusy(false); if (fileInput.current) fileInput.current.value = '' }
            }} />
            <div className="mt-4 flex flex-wrap gap-3">
                <button type="button" disabled={busy || text.trim().length < 30 || upToDate} onClick={() => update()} className="rounded-full bg-primary px-5 py-2 text-white disabled:opacity-50">{busy ? '分析中…' : upToDate ? '已是最新分析' : '保存并分析'}</button>
            </div>
            <p className="mt-3 text-xs leading-6 text-text-muted">分析会把简历发给 AIHubMix，每个新版本消耗 1 次生成额度；同一版本只分析一次，刷新页面不会重复扣额度。</p>
            {(dirty || (profile.generated && profile.generated.hash !== profile.hash)) && <p className="mt-3 text-sm text-warning">简历已修改，下面的题库仍对应上一次分析的版本；点“保存并分析”后替换。</p>}
            {profile.generated && <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-text-muted">最近分析：{profile.generated.summary}</p>}
            {message && <p role="status" className="mt-3 text-sm text-success">{message}</p>}
            {error && <p role="alert" className="mt-3 text-sm text-error">{error}</p>}
        </details>
    </section>
}
