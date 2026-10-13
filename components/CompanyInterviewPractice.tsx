'use client'

import { AIQuestionHelp } from './AIQuestionHelp'
import { usePracticeUser, practiceStorageKey } from '@/components/PracticeAccount'
import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, ArrowRight, ExternalLink, FileCheck2 } from 'lucide-react'
import type { CompanyInterviewBank, InterviewEvaluation } from '@/lib/interview-types'

const STORAGE_KEY = 'resumeai-pm-company-practice-v1'

type Draft = {
    version: 1
    companySlug: string
    sessionByCompany: Record<string, string>
    questionByCompany: Record<string, string>
    answers: Record<string, string>
}

function stringRecord(value: unknown): Record<string, string> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
    return Object.fromEntries(Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === 'string'))
}

export function CompanyInterviewPractice({ banks }: { banks: CompanyInterviewBank[] }) {
    const user = usePracticeUser()
    const storageKey = practiceStorageKey(STORAGE_KEY, user)
    const [draft, setDraft] = useState<Draft>({
        version: 1, companySlug: banks[0]?.slug ?? '',
        sessionByCompany: {}, questionByCompany: {}, answers: {},
    })
    const [ready, setReady] = useState(false)
    const [storageIssue, setStorageIssue] = useState('')
    const [error, setError] = useState('')
    const [submitting, setSubmitting] = useState(false)
    const [result, setResult] = useState<InterviewEvaluation | null>(null)

    useEffect(() => {
        try {
            const raw = window.localStorage.getItem(storageKey)
            if (raw) {
                const saved: unknown = JSON.parse(raw)
                if (saved && typeof saved === 'object' && 'version' in saved && saved.version === 1) {
                    const value = saved as Partial<Draft>
                    const validIds = new Set(banks.flatMap((bank) => bank.questions.map((question) => question.id)))
                    setDraft({
                        version: 1,
                        companySlug: banks.some((bank) => bank.slug === value.companySlug) ? value.companySlug! : banks[0]?.slug ?? '',
                        sessionByCompany: stringRecord(value.sessionByCompany),
                        questionByCompany: stringRecord(value.questionByCompany),
                        answers: Object.fromEntries(Object.entries(stringRecord(value.answers)).filter(([id]) => validIds.has(id))),
                    })
                }
            }
        } catch {
            setStorageIssue('未能恢复本地草稿。你仍可继续练习，请留意保存提示。')
        }
        setReady(true)
    }, [banks, storageKey])

    useEffect(() => {
        if (!ready) return
        try {
            window.localStorage.setItem(storageKey, JSON.stringify(draft))
            setStorageIssue('')
        } catch {
            setStorageIssue('本次回答尚未保存到本机，请勿刷新页面；浏览器允许本地存储后会继续保存。')
        }
    }, [draft, ready, storageKey])

    const bank = banks.find((item) => item.slug === draft.companySlug) ?? banks[0]
    const storedSession = bank && draft.sessionByCompany[bank.slug]
    const sessionId = bank?.sessions.some((session) => session.id === storedSession) ? storedSession : 'all'
    const questions = useMemo(() => bank?.questions.filter((question) => sessionId === 'all' || question.sessionId === sessionId) ?? [], [bank, sessionId])
    const storedQuestion = bank && draft.questionByCompany[bank.slug]
    const currentIndex = Math.max(0, questions.findIndex((question) => question.id === storedQuestion))
    const question = questions[currentIndex]
    const answered = questions.filter((item) => draft.answers[item.id]?.trim())
    const session = bank?.sessions.find((item) => item.id === question?.sessionId)
    const parentQuestion = bank?.questions.find((item) => item.id === question?.followUpOf)
    const total = banks.reduce((sum, item) => sum + item.questionCount, 0)

    const moveTo = (id: string) => {
        if (!bank) return
        setDraft((current) => ({ ...current, questionByCompany: { ...current.questionByCompany, [bank.slug]: id } }))
    }

    const submit = async () => {
        if (!bank || answered.length === 0 || submitting) return
        setSubmitting(true)
        setError('')
        setResult(null)
        try {
            const response = await fetch('/api/interview-evaluate', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    companySlug: bank.slug,
                    questionIds: answered.map((item) => item.id),
                    answers: answered.map((item) => ({ questionId: item.id, answer: draft.answers[item.id] })),
                }),
            })
            const data = await response.json()
            if (!response.ok) throw new Error(typeof data.error === 'string' ? data.error : '交卷失败')
            setResult(data as InterviewEvaluation)
        } catch (failure) {
            setError(failure instanceof Error ? failure.message : '交卷失败，请重试')
        } finally {
            setSubmitting(false)
        }
    }

    if (!bank) return <p>暂无公司题库，请稍后重试。</p>
    if (!ready) return <p className="text-text-muted">正在恢复面经练习进度…</p>

    return (
        <section className="space-y-6" aria-label="大厂面经练习">
            <div className="rounded-[32px] border border-white/10 bg-white/[0.04] p-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <h2 className="text-xl font-semibold">大厂面经练习</h2>
                    <span className="text-sm text-text-muted">{banks.length} 家公司 · {total} 条面经题</span>
                </div>
                <p className="mt-2 text-sm leading-6 text-text-muted">按公司和面经段落练习，回答自动保存在本机。材料为社区面经转述，包含重复考点和追问。</p>
                <div className="mt-5 flex flex-wrap gap-3" aria-label="选择公司">
                    {banks.map((item) => (
                        <button key={item.slug} disabled={submitting}
                            aria-pressed={item.slug === bank.slug}
                            onClick={() => {
                                setDraft((current) => ({ ...current, companySlug: item.slug }))
                                setResult(null); setError('')
                            }}
                            className={`rounded-full border px-5 py-3 text-sm font-medium transition-colors disabled:opacity-60 ${item.slug === bank.slug ? 'border-primary bg-primary/10 text-text-main' : 'border-white/10 text-text-muted hover:border-white/30'}`}
                        >{item.title} · {item.questionCount} 题</button>
                    ))}
                </div>
                <div className="mt-5 flex flex-wrap items-center gap-4">
                    <label className="flex items-center gap-3 text-sm text-text-muted">
                        面经段落
                        <select aria-label="面经段落" value={sessionId} disabled={submitting}
                            onChange={(event) => {
                                setDraft((current) => ({ ...current, sessionByCompany: { ...current.sessionByCompany, [bank.slug]: event.target.value } }))
                                setResult(null); setError('')
                            }}
                            className="max-w-full rounded-xl border border-white/10 bg-[#0B0C11] px-3 py-2 text-text-main">
                            <option value="all">全部面经 · {bank.questionCount} 题</option>
                            {bank.sessions.map((item) => <option key={item.id} value={item.id}>{item.label} · {item.questionCount} 题{item.interviewDate ? ` · ${item.interviewDate}` : ''}</option>)}
                        </select>
                    </label>
                    <span className="text-sm text-text-muted">当前范围已答 {answered.length} / {questions.length}</span>
                    <span className={`text-sm ${storageIssue ? 'text-warning' : 'text-success'}`} role="status">{storageIssue || '草稿已保存到本机'}</span>
                </div>
            </div>

            {question ? (
                <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
                    <aside className="rounded-[28px] border border-white/10 bg-white/[0.04] p-4">
                        <h3 className="mb-3 font-medium">{bank.title}题目</h3>
                        <div className="max-h-[560px] space-y-2 overflow-y-auto pr-1">
                            {questions.map((item, index) => (
                                <button key={item.id} disabled={submitting} aria-current={item.id === question.id ? 'true' : undefined}
                                    onClick={() => moveTo(item.id)}
                                    className={`w-full rounded-2xl border p-3 text-left ${item.id === question.id ? 'border-primary bg-primary/10' : 'border-white/10 bg-black/10 hover:border-white/30'}`}>
                                    <div className="flex justify-between gap-2 text-sm"><span>第 {index + 1} 题</span><span className={draft.answers[item.id]?.trim() ? 'text-success' : 'text-text-muted'}>{draft.answers[item.id]?.trim() ? '已答' : '待答'}</span></div>
                                    <p className="mt-2 line-clamp-2 text-xs leading-5 text-text-muted">{item.prompt}</p>
                                </button>
                            ))}
                        </div>
                    </aside>
                    <div className="min-w-0 rounded-[32px] border border-white/10 bg-white/[0.04] p-6">
                        <p className="text-sm text-primary">{bank.title} · {session?.label} · {question.category}</p>
                        <div className="mt-2 flex flex-wrap items-center gap-3">
                            <h3 className="text-2xl font-semibold">第 {currentIndex + 1} / {questions.length} 题</h3>
                            {question.questionKind === 'follow_up' && <span className="rounded-full bg-primary/10 px-3 py-1 text-xs text-primary">追问</span>}
                            {question.duplicateOf && <span className="text-xs text-text-muted">重复考点</span>}
                        </div>
                        <p className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-5 text-lg leading-8">{question.prompt}</p>
                        {parentQuestion && <p className="mt-3 text-sm leading-6 text-text-muted">承接问题：{parentQuestion.prompt}</p>}
                        <div className="mt-3 text-xs leading-6 text-text-muted">
                            <a href={question.sourceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">查看面经来源<ExternalLink className="h-3 w-3" /></a>
                            <p>{question.sourceDateNote}</p>
                        </div>
                        <label htmlFor="company-answer" className="mb-3 mt-5 block text-sm font-medium text-text-muted">写下你的回答</label>
                        <textarea id="company-answer" value={draft.answers[question.id] ?? ''} disabled={submitting}
                            onChange={(event) => {
                                setDraft((current) => ({ ...current, answers: { ...current.answers, [question.id]: event.target.value } }))
                                setResult(null)
                            }}
                            placeholder="结合你的项目，说明场景、判断依据、方案和验证结果。"
                            className="min-h-[260px] w-full rounded-[28px] border border-white/10 bg-[#0B0C11] p-5 text-base leading-7 outline-none placeholder:text-text-muted/70 focus:border-primary disabled:opacity-60" />
                                <AIQuestionHelp key={question.id} question={question} answer={draft.answers[question.id] || ''} companySlug={bank.slug} />
                        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                            <span className="text-sm text-text-muted">当前字数：{(draft.answers[question.id] ?? '').replace(/\s+/g, '').length}</span>
                            <div className="flex gap-3">
                                <button disabled={submitting || currentIndex === 0} onClick={() => moveTo(questions[currentIndex - 1].id)} className="inline-flex items-center gap-1 rounded-full border border-white/10 px-4 py-2 text-sm disabled:opacity-40"><ArrowLeft className="h-4 w-4" />上一题</button>
                                <button disabled={submitting || currentIndex === questions.length - 1} onClick={() => moveTo(questions[currentIndex + 1].id)} className="inline-flex items-center gap-1 rounded-full bg-primary px-4 py-2 text-sm text-white disabled:opacity-40">下一题<ArrowRight className="h-4 w-4" /></button>
                            </div>
                        </div>
                        <div className="mt-6 border-t border-white/10 pt-5">
                            <button onClick={submit} disabled={submitting || answered.length === 0} className="inline-flex items-center gap-2 rounded-full bg-success px-5 py-3 text-sm font-medium text-[#08110C] disabled:opacity-50"><FileCheck2 className="h-4 w-4" />{submitting ? '正在交卷…' : `提交已答 ${answered.length} 题并查看反馈`}</button>
                            <p className="mt-2 text-xs leading-6 text-text-muted">只评价当前范围内已答的题目，未答题及其他公司的草稿会保留。</p>
                            {error && <p role="alert" className="mt-3 text-sm text-error">{error}。回答已保留，可再次提交。</p>}
                        </div>
                    </div>
                </div>
            ) : <p className="text-text-muted">当前段落暂无题目，请选择其他段落。</p>}

            {result && (
                <section className="space-y-4" aria-label="公司面经评分结果">
                    <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-6">
                        <h3 className="text-xl font-semibold">{bank.title}面经练习反馈</h3>
                        <p className="mt-3 text-4xl font-semibold">{result.overallScore}<span className="ml-2 text-sm text-text-muted">分 · 本次评价 {result.totalQuestions} 题</span></p>
                        <p className="mt-3 text-xs text-text-muted">评分按回答结构和要点覆盖提供练习反馈，供复盘参考。</p>
                        <div className="mt-4 flex flex-wrap gap-3">{result.categoryScores.map((item) => <span key={item.category} className="rounded-xl border border-white/10 px-3 py-2 text-sm">{item.category} · {item.score} 分</span>)}</div>
                    </div>
                    {result.questionResults.map((item) => (
                        <article key={item.questionId} className="rounded-[28px] border border-white/10 bg-white/[0.04] p-6">
                            <h4 className="text-lg font-medium">{item.prompt}</h4>
                        <AIQuestionHelp question={{ id: item.questionId, index: 1, prompt: item.prompt, category: item.category }} answer={item.answer} companySlug={bank.slug} showMethod={false} />
                            <p className="mt-2 text-sm text-primary">{item.score} 分</p>
                            <p className="mt-4 whitespace-pre-wrap rounded-2xl bg-black/20 p-4 text-sm leading-7">{item.answer}</p>
                            <div className="mt-4 grid gap-4 sm:grid-cols-2">
                                <div><p className="text-sm text-success">做得好的地方</p>{item.strengths.map((point) => <p key={point} className="mt-2 text-sm leading-6 text-text-muted">{point}</p>)}</div>
                                <div><p className="text-sm text-warning">还可以补强</p>{item.improvements.map((point) => <p key={point} className="mt-2 text-sm leading-6 text-text-muted">{point}</p>)}</div>
                            </div>
                        </article>
                    ))}
                </section>
            )}
        </section>
    )
}
