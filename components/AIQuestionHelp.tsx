'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { InterviewQuestion } from '@/lib/interview-types'
import { usePracticeUser } from './PracticeAccount'

type Mode = 'reference' | 'review'
type Saved = { content: string; createdAt: string; model: string }
export function AIQuestionHelp({ question, answer = '', projectSetId, companySlug }: { question: InterviewQuestion; answer?: string; projectSetId?: string; companySlug?: string }) {
    const user = usePracticeUser()
    const [history, setHistory] = useState<Array<Saved & { id: string; answer: string }> | null>(null)
    const [mode, setMode] = useState<Mode>('reference')
    const [record, setRecord] = useState<Saved | null>(null)
    const [reviewedAnswer, setReviewedAnswer] = useState('')
    const [missing, setMissing] = useState(false)
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState('')
    const [source, setSource] = useState('')
    const run = async (nextMode: Mode, generate = false) => {
        const submitted = answer.trim()
        setBusy(true); setError(''); setMissing(false); setRecord(null); setHistory(null); setMode(nextMode)
        try {
            const response = await fetch('/api/ai/question', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ questionId: question.id, projectSetId, companySlug, prompt: question.prompt, category: question.category, mode: nextMode, answer: submitted, generate }) })
            const data = await response.json()
            if (!response.ok) throw new Error(data.error || 'AI 分析失败，请稍后再试')
            setRecord(data.record)
            setMissing(!data.record)
            setReviewedAnswer(submitted)
            setSource(data.existing ? '题库已有参考 · 本次未调用 AI' : data.cached ? '已保存记录 · 本次未调用 AI' : 'AI 新生成 · 已保存到服务器')
        } catch (failure) { setError(failure instanceof Error ? failure.message : '请求失败，未自动重试') }
        finally { setBusy(false) }
    }
    if (!user) return <p className="mt-4 text-sm text-text-muted"><Link href="/login" className="text-primary">登录后查看 AI 参考与点评</Link>，已有记录免费复用。</p>
    return <section aria-label={`AI 辅助：${question.prompt}`} className="mt-4 rounded-2xl border border-primary/20 bg-primary/5 p-4">
        <div className="flex flex-wrap gap-3">
            <button type="button" disabled={busy} onClick={() => run('reference')} className="rounded-full border border-primary/30 px-4 py-2 text-sm text-primary disabled:opacity-50">查看参考 / AI 解析</button>
            <button type="button" disabled={busy || answer.trim().length < 5} onClick={() => run('review')} className="rounded-full border border-white/20 px-4 py-2 text-sm disabled:opacity-50">AI 点评我的回答</button>
            <button type="button" disabled={busy} className="rounded-full border border-white/20 px-4 py-2 text-sm disabled:opacity-50" onClick={async () => {
                setBusy(true); setError(''); setMissing(false); setRecord(null)
                try {
                    const response = await fetch('/api/ai/question', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ questionId: question.id, projectSetId, companySlug, prompt: question.prompt, category: question.category, mode: 'history' }) })
                    const data = await response.json()
                    if (!response.ok) throw new Error(data.error || '读取历史失败')
                    setHistory(data.history)
                } catch (failure) { setError(failure instanceof Error ? failure.message : '读取历史失败') }
                finally { setBusy(false) }
            }}>历史点评（不调用 AI）</button>
        </div>
        <p className="mt-2 text-xs leading-6 text-text-muted">先查已有记录，不会自动付费生成；回答内容不变时复用点评。</p>
        {busy && <p role="status" className="mt-3 text-sm">正在处理，请勿重复点击…</p>}
        {error && <p role="alert" className="mt-3 text-sm text-error">{error}</p>}
        {missing && <div className="mt-3 space-y-3"><p className="text-sm">{mode === 'reference' ? '这道题暂无保存的 AI 参考。' : '这份回答暂无保存的 AI 点评。'}点击生成会消耗 1 次新生成额度，并将题目{mode === 'review' ? '与本次回答' : ''}发送给 AIHubMix。</p><button type="button" disabled={busy} onClick={() => run(mode, true)} className="rounded-full bg-primary px-4 py-2 text-sm text-white">{mode === 'reference' ? '生成 AI 参考（消耗额度）' : '生成 AI 点评（消耗额度）'}</button></div>}
        {history && <div className="mt-3 space-y-2 text-sm">{history.length === 0 ? <p>这道题还没有保存的个人点评。</p> : history.map((item) => <button key={item.id} type="button" className="block w-full rounded-xl border border-white/10 p-3 text-left" onClick={() => { setRecord(item); setReviewedAnswer(item.answer); setMode('review'); setSource('历史记录 · 本次未调用 AI') }}>{new Date(item.createdAt).toLocaleString()} · {item.answer.slice(0, 60)}…</button>)}</div>}
        {record && <div className="mt-4 space-y-3">
            <p className="text-xs text-success">{source}{record.createdAt ? ` · ${new Date(record.createdAt).toLocaleString()}` : ''}</p>
            {mode === 'review' && <details className="text-sm text-text-muted"><summary>本次点评对应的回答{reviewedAnswer !== answer.trim() ? '（你已修改，需重新查看/分析）' : ''}</summary><p className="mt-2 whitespace-pre-wrap">{reviewedAnswer}</p></details>}
            <p className="whitespace-pre-wrap text-sm leading-7">{record.content.replace(/^#{1,6} /gm, '').replace(/\*\*(.*?)\*\*/g, '$1')}</p>
            <p className="text-xs text-text-muted">{record.model} · 参考内容请结合真实经历核对。</p>
        </div>}
    </section>
}
