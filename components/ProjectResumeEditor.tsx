'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { ResumeProfile } from '@/lib/resume-projects'

export function ProjectResumeEditor({ initial, usage }: { initial: ResumeProfile; usage: { used: number; limit: number } }) {
    const router = useRouter()
    const [expanded, setExpanded] = useState(!initial.text)
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
    const update = async (generate: boolean) => {
        setBusy(true); setMessage(''); setError('')
        try {
            const saved = dirty || !profile.hash ? await save() : profile
            if (!generate) { setMessage('简历已保存，尚未调用 AI。'); return }
            const response = await fetch('/api/my-resume', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ hash: saved.hash }) })
            const data = await response.json()
            if (!response.ok) throw new Error(data.error || '生成失败')
            setProfile(data.profile)
            setMessage(data.cached ? '已复用这版简历的题库，没有再次调用 AI。' : '新版项目深挖已生成并保存，旧版资料已保留。')
            router.refresh()
        } catch (failure) { setError(failure instanceof Error ? failure.message : '请求失败，原题库已保留') }
        finally { setBusy(false) }
    }
    return <section className="mx-auto max-w-5xl px-6 pt-8 text-text-main">
        <details open={expanded} onToggle={(event) => setExpanded(event.currentTarget.open)} className="rounded-[28px] border border-white/10 bg-white/[0.04] p-6">
            <summary className="cursor-pointer font-medium">我的简历 · 更新个人项目深挖</summary>
            <p className="mt-3 text-sm leading-7 text-text-muted">粘贴或导入最新简历，确认后再让 AI 分析。每版简历按核心项目生成题目、参考思路和追问；相同内容复用已保存结果。</p>
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
                <button type="button" disabled={busy || text.trim().length < 30} onClick={() => update(false)} className="rounded-full border border-white/20 px-5 py-2 disabled:opacity-50">保存简历（不调用 AI）</button>
                <button type="button" disabled={busy || text.trim().length < 30} onClick={() => update(true)} className="rounded-full bg-primary px-5 py-2 text-white disabled:opacity-50">{busy ? '处理中…' : 'AI 分析并更新深挖'}</button>
            </div>
            <p className="mt-3 text-xs leading-6 text-text-muted">点击更新会将这版简历发给 AIHubMix；新内容消耗 1 次生成额度，未提供的经历和数据应标为待补充。切换题目和刷新不会自动调用 AI。</p>
            {(dirty || (profile.generated && profile.generated.hash !== profile.hash)) && <p className="mt-3 text-sm text-warning">简历已修改，下面的题库仍对应上一次生成版本；点击更新后才会替换。</p>}
            {profile.generated && <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-text-muted">最近分析：{profile.generated.summary}</p>}
            {message && <p role="status" className="mt-3 text-sm text-success">{message}</p>}
            {error && <p role="alert" className="mt-3 text-sm text-error">{error}</p>}
        </details>
    </section>
}
