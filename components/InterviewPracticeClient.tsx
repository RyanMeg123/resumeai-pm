'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import {
    ArrowLeft,
    Brain,
    Clock3,
    FileCheck2,
    Gauge,
    ListChecks,
    RefreshCw,
    Sparkles,
} from 'lucide-react'

import { InterviewAnswerInput, InterviewEvaluation, InterviewQuestion } from '@/lib/interview-types'

function shuffle<T>(items: T[]) {
    const copy = [...items]

    for (let index = copy.length - 1; index > 0; index -= 1) {
        const randomIndex = Math.floor(Math.random() * (index + 1))
        ;[copy[index], copy[randomIndex]] = [copy[randomIndex], copy[index]]
    }

    return copy
}

function formatDuration(totalSeconds: number) {
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

export function InterviewPracticeClient({
    allQuestions,
}: {
    allQuestions: InterviewQuestion[]
}) {
    const categories = useMemo(
        () => Array.from(new Set(allQuestions.map((item) => item.category))),
        [allQuestions],
    )
    const [selectedCategories, setSelectedCategories] = useState<string[]>(categories)
    const [questionCount, setQuestionCount] = useState(10)
    const [sessionQuestions, setSessionQuestions] = useState<InterviewQuestion[]>([])
    const [answers, setAnswers] = useState<Record<string, string>>({})
    const [currentIndex, setCurrentIndex] = useState(0)
    const [startedAt, setStartedAt] = useState<number | null>(null)
    const [elapsedSeconds, setElapsedSeconds] = useState(0)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [result, setResult] = useState<InterviewEvaluation | null>(null)

    useEffect(() => {
        if (!startedAt || result) {
            return
        }

        const timer = window.setInterval(() => {
            setElapsedSeconds(Math.round((Date.now() - startedAt) / 1000))
        }, 1000)

        return () => window.clearInterval(timer)
    }, [startedAt, result])

    const filteredBank = useMemo(() => {
        if (selectedCategories.length === 0) {
            return []
        }

        return allQuestions.filter((item) =>
            selectedCategories.includes(item.category),
        )
    }, [allQuestions, selectedCategories])

    const answeredCount = useMemo(
        () =>
            sessionQuestions.filter((question) => answers[question.id]?.trim()).length,
        [answers, sessionQuestions],
    )

    const currentQuestion = sessionQuestions[currentIndex]

    const toggleCategory = (category: string) => {
        setSelectedCategories((current) =>
            current.includes(category)
                ? current.filter((item) => item !== category)
                : [...current, category],
        )
    }

    const startSession = () => {
        const bank = shuffle(filteredBank).slice(
            0,
            Math.min(questionCount, filteredBank.length),
        )

        setSessionQuestions(bank)
        setAnswers({})
        setCurrentIndex(0)
        setResult(null)
        setElapsedSeconds(0)
        setStartedAt(Date.now())
    }

    const resetSession = () => {
        setSessionQuestions([])
        setAnswers({})
        setCurrentIndex(0)
        setStartedAt(null)
        setElapsedSeconds(0)
        setResult(null)
    }

    const submitSession = async () => {
        if (sessionQuestions.length === 0) {
            return
        }

        setIsSubmitting(true)

        try {
            const payload = {
                questionIds: sessionQuestions.map((item) => item.id),
                elapsedSeconds,
                answers: sessionQuestions.map(
                    (question): InterviewAnswerInput => ({
                        questionId: question.id,
                        answer: answers[question.id] || '',
                    }),
                ),
            }

            const response = await fetch('/api/interview-evaluate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
            })

            const evaluation = await response.json()

            if (!response.ok) {
                throw new Error(evaluation.error || '交卷失败')
            }

            setResult(evaluation)
        } catch (error) {
            console.error(error)
            alert('交卷失败，请稍后重试')
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(77,126,255,0.18),_transparent_32%),radial-gradient(circle_at_top_right,_rgba(52,211,153,0.14),_transparent_28%),linear-gradient(180deg,_#0E0F14_0%,_#090A0E_100%)] text-text-main">
            <div className="mx-auto max-w-7xl px-6 py-8 md:px-10">
                <div className="mb-8 flex items-center justify-between gap-4">
                    <div>
                        <Link
                            href="/"
                            className="mb-4 inline-flex items-center gap-2 text-sm text-text-muted transition-colors hover:text-text-main"
                        >
                            <ArrowLeft className="h-4 w-4" />
                            返回首页
                        </Link>
                        <h1 className="text-3xl font-semibold tracking-tight md:text-5xl">
                            AI 产品经理面试练习场
                        </h1>
                        <p className="mt-3 max-w-3xl text-sm leading-7 text-text-muted md:text-base">
                            从 100 道高频题里抽题作答。你交卷后会看到总分、模块得分、逐题反馈和下一轮该补什么。
                        </p>
                    </div>
                    <div className="hidden rounded-3xl border border-white/10 bg-white/5 p-4 backdrop-blur md:block">
                        <div className="text-xs uppercase tracking-[0.28em] text-text-muted">
                            题库
                        </div>
                        <div className="mt-2 text-3xl font-semibold">
                            {allQuestions.length}
                        </div>
                    </div>
                </div>

                {sessionQuestions.length === 0 ? (
                    <section className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
                        <div className="rounded-[32px] border border-white/10 bg-white/[0.04] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.32)] backdrop-blur">
                            <div className="flex items-center gap-3 text-primary">
                                <Sparkles className="h-5 w-5" />
                                <span className="text-sm font-medium">
                                    刷题模式
                                </span>
                            </div>
                            <div className="mt-5 grid gap-4 md:grid-cols-3">
                                {[
                                    {
                                        label: '快速热身',
                                        count: 5,
                                        desc: '10 分钟内跑一轮',
                                    },
                                    {
                                        label: '标准模拟',
                                        count: 10,
                                        desc: '更接近正式面试',
                                    },
                                    {
                                        label: '深度拉练',
                                        count: 15,
                                        desc: '适合集中补短板',
                                    },
                                ].map((item) => (
                                    <button
                                        key={item.count}
                                        onClick={() => setQuestionCount(item.count)}
                                        className={`rounded-2xl border p-4 text-left transition-all ${
                                            questionCount === item.count
                                                ? 'border-primary bg-primary/10 shadow-[0_10px_30px_rgba(77,126,255,0.18)]'
                                                : 'border-white/10 bg-black/10 hover:border-white/20 hover:bg-white/[0.03]'
                                        }`}
                                    >
                                        <div className="text-base font-medium">
                                            {item.label}
                                        </div>
                                        <div className="mt-1 text-3xl font-semibold">
                                            {item.count}
                                        </div>
                                        <div className="mt-2 text-sm text-text-muted">
                                            {item.desc}
                                        </div>
                                    </button>
                                ))}
                            </div>

                            <div className="mt-8">
                                <div className="mb-3 flex items-center justify-between">
                                    <div className="text-sm font-medium">
                                        选择练习模块
                                    </div>
                                    <button
                                        onClick={() => setSelectedCategories(categories)}
                                        className="text-sm text-text-muted transition-colors hover:text-text-main"
                                    >
                                        全选
                                    </button>
                                </div>
                                <div className="flex flex-wrap gap-3">
                                    {categories.map((category) => {
                                        const active =
                                            selectedCategories.includes(category)

                                        return (
                                            <button
                                                key={category}
                                                onClick={() =>
                                                    toggleCategory(category)
                                                }
                                                className={`rounded-full border px-4 py-2 text-sm transition-colors ${
                                                    active
                                                        ? 'border-primary bg-primary/10 text-text-main'
                                                        : 'border-white/10 bg-black/10 text-text-muted hover:border-white/20 hover:text-text-main'
                                                }`}
                                            >
                                                {category}
                                            </button>
                                        )
                                    })}
                                </div>
                            </div>

                            <div className="mt-8 flex flex-wrap items-center gap-4">
                                <button
                                    onClick={startSession}
                                    disabled={
                                        filteredBank.length === 0 ||
                                        filteredBank.length < questionCount
                                    }
                                    className="rounded-full bg-primary px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:bg-border disabled:text-text-muted"
                                >
                                    开始这一轮
                                </button>
                                <div className="text-sm text-text-muted">
                                    当前可抽题数：{filteredBank.length} 题
                                </div>
                            </div>
                            {filteredBank.length < questionCount && (
                                <p className="mt-3 text-sm text-warning">
                                    当前模块数量不足，请减少题量或多选几个模块。
                                </p>
                            )}
                        </div>

                        <div className="space-y-4">
                            <div className="rounded-[28px] border border-white/10 bg-black/20 p-5">
                                <div className="flex items-center gap-3 text-text-main">
                                    <Gauge className="h-5 w-5 text-success" />
                                    <h2 className="text-lg font-medium">
                                        交卷后你会拿到什么
                                    </h2>
                                </div>
                                <div className="mt-4 space-y-3 text-sm leading-7 text-text-muted">
                                    <p>总分和完成度，先看这一轮整体状态。</p>
                                    <p>模块得分，知道自己是卡在基础理解、Agent 还是商业判断。</p>
                                    <p>逐题反馈，知道哪题能打，哪题还像空话。</p>
                                </div>
                            </div>

                            <div className="rounded-[28px] border border-white/10 bg-black/20 p-5">
                                <div className="flex items-center gap-3 text-text-main">
                                    <ListChecks className="h-5 w-5 text-primary" />
                                    <h2 className="text-lg font-medium">
                                        建议答题方式
                                    </h2>
                                </div>
                                <div className="mt-4 space-y-3 text-sm leading-7 text-text-muted">
                                    <p>先讲用户场景和目标，再讲你怎么判断、怎么取舍。</p>
                                    <p>能给结果就给结果，哪怕是门槛、阈值或上线标准。</p>
                                    <p>别只讲概念，最好让人听出你真的做过。</p>
                                </div>
                            </div>
                        </div>
                    </section>
                ) : (
                    <section className="grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">
                        <aside className="rounded-[30px] border border-white/10 bg-white/[0.04] p-5 backdrop-blur">
                            <div className="flex items-center gap-3 text-sm text-text-muted">
                                <Clock3 className="h-4 w-4" />
                                已用时 {formatDuration(elapsedSeconds)}
                            </div>
                            <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4">
                                <div className="text-sm text-text-muted">
                                    已完成
                                </div>
                                <div className="mt-2 text-3xl font-semibold">
                                    {answeredCount}/{sessionQuestions.length}
                                </div>
                            </div>

                            <div className="mt-5 space-y-2">
                                {sessionQuestions.map((question, index) => {
                                    const answered =
                                        answers[question.id]?.trim().length > 0

                                    return (
                                        <button
                                            key={question.id}
                                            onClick={() => setCurrentIndex(index)}
                                            className={`w-full rounded-2xl border p-3 text-left transition-colors ${
                                                currentIndex === index
                                                    ? 'border-primary bg-primary/10'
                                                    : 'border-white/10 bg-black/10 hover:border-white/20'
                                            }`}
                                        >
                                            <div className="flex items-center justify-between gap-3">
                                                <span className="text-sm font-medium">
                                                    第 {index + 1} 题
                                                </span>
                                                <span
                                                    className={`h-2.5 w-2.5 rounded-full ${
                                                        answered
                                                            ? 'bg-success'
                                                            : 'bg-border'
                                                    }`}
                                                />
                                            </div>
                                            <div className="mt-2 line-clamp-2 text-xs leading-5 text-text-muted">
                                                {question.prompt}
                                            </div>
                                        </button>
                                    )
                                })}
                            </div>
                        </aside>

                        <div className="rounded-[32px] border border-white/10 bg-white/[0.04] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.32)] backdrop-blur">
                            <div className="flex flex-wrap items-center justify-between gap-4">
                                <div>
                                    <div className="text-sm text-primary">
                                        {currentQuestion.category}
                                    </div>
                                    <h2 className="mt-2 text-2xl font-semibold leading-tight">
                                        第 {currentIndex + 1} 题
                                    </h2>
                                </div>
                                <div className="rounded-full border border-white/10 bg-black/20 px-4 py-2 text-sm text-text-muted">
                                    题库编号 #{currentQuestion.index}
                                </div>
                            </div>

                            <div className="mt-6 rounded-[28px] border border-white/10 bg-black/20 p-5">
                                <p className="text-lg leading-8 text-text-main">
                                    {currentQuestion.prompt}
                                </p>
                            </div>

                            <div className="mt-5">
                                <label
                                    htmlFor={currentQuestion.id}
                                    className="mb-3 block text-sm font-medium text-text-muted"
                                >
                                    写下你的回答
                                </label>
                                <textarea
                                    id={currentQuestion.id}
                                    value={answers[currentQuestion.id] || ''}
                                    onChange={(event) =>
                                        setAnswers((current) => ({
                                            ...current,
                                            [currentQuestion.id]:
                                                event.target.value,
                                        }))
                                    }
                                    placeholder="建议按“场景/判断/方案/结果”来答。不是每题都要很长，但别只写一句话。"
                                    className="min-h-[260px] w-full rounded-[28px] border border-white/10 bg-[#0B0C11] p-5 text-base leading-7 text-text-main outline-none transition-colors placeholder:text-text-muted/70 focus:border-primary"
                                />
                            </div>

                            <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                                <div className="text-sm text-text-muted">
                                    这一题当前字数：
                                    {(answers[currentQuestion.id] || '')
                                        .replace(/\s+/g, '')
                                        .length}
                                </div>

                                <div className="flex flex-wrap gap-3">
                                    <button
                                        onClick={() =>
                                            setCurrentIndex((current) =>
                                                Math.max(0, current - 1),
                                            )
                                        }
                                        disabled={currentIndex === 0}
                                        className="rounded-full border border-white/10 px-4 py-2 text-sm text-text-main transition-colors hover:border-white/20 disabled:cursor-not-allowed disabled:text-text-muted"
                                    >
                                        上一题
                                    </button>
                                    {currentIndex < sessionQuestions.length - 1 ? (
                                        <button
                                            onClick={() =>
                                                setCurrentIndex((current) =>
                                                    Math.min(
                                                        sessionQuestions.length -
                                                            1,
                                                        current + 1,
                                                    ),
                                                )
                                            }
                                            className="rounded-full bg-primary px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-hover"
                                        >
                                            下一题
                                        </button>
                                    ) : (
                                        <button
                                            onClick={submitSession}
                                            disabled={isSubmitting}
                                            className="rounded-full bg-success px-5 py-2 text-sm font-medium text-[#08110C] transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                                        >
                                            {isSubmitting
                                                ? '正在交卷...'
                                                : '交卷并评分'}
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </section>
                )}

                {result && (
                    <section className="mt-8 space-y-6">
                        <div className="rounded-[32px] border border-white/10 bg-white/[0.05] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.32)] backdrop-blur">
                            <div className="flex flex-wrap items-center justify-between gap-4">
                                <div>
                                    <div className="text-sm text-text-muted">
                                        本轮总分
                                    </div>
                                    <div className="mt-2 text-5xl font-semibold">
                                        {result.overallScore}
                                    </div>
                                </div>
                                <div className="grid gap-3 sm:grid-cols-3">
                                    <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                                        <div className="text-xs text-text-muted">
                                            完成度
                                        </div>
                                        <div className="mt-1 text-2xl font-semibold">
                                            {result.completionRate}%
                                        </div>
                                    </div>
                                    <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                                        <div className="text-xs text-text-muted">
                                            已答题
                                        </div>
                                        <div className="mt-1 text-2xl font-semibold">
                                            {result.answeredQuestions}/
                                            {result.totalQuestions}
                                        </div>
                                    </div>
                                    <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                                        <div className="text-xs text-text-muted">
                                            用时
                                        </div>
                                        <div className="mt-1 text-2xl font-semibold">
                                            {formatDuration(result.elapsedSeconds)}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="mt-6 grid gap-4 lg:grid-cols-2">
                                <div className="rounded-[28px] border border-success/20 bg-success/10 p-5">
                                    <div className="flex items-center gap-3">
                                        <Brain className="h-5 w-5 text-success" />
                                        <h3 className="text-lg font-medium">
                                            这轮答得好的地方
                                        </h3>
                                    </div>
                                    <div className="mt-4 space-y-3 text-sm leading-7 text-text-main/90">
                                        {result.strengths.map((item) => (
                                            <p key={item}>{item}</p>
                                        ))}
                                    </div>
                                </div>

                                <div className="rounded-[28px] border border-warning/20 bg-warning/10 p-5">
                                    <div className="flex items-center gap-3">
                                        <FileCheck2 className="h-5 w-5 text-warning" />
                                        <h3 className="text-lg font-medium">
                                            下一轮优先补什么
                                        </h3>
                                    </div>
                                    <div className="mt-4 space-y-3 text-sm leading-7 text-text-main/90">
                                        {result.nextActions.map((item) => (
                                            <p key={item}>{item}</p>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div className="mt-6">
                                <h3 className="text-lg font-medium">
                                    模块得分
                                </h3>
                                <div className="mt-4 space-y-3">
                                    {result.categoryScores.map((item) => (
                                        <div key={item.category}>
                                            <div className="mb-1 flex items-center justify-between text-sm">
                                                <span className="text-text-muted">
                                                    {item.category}
                                                </span>
                                                <span>{item.score}</span>
                                            </div>
                                            <div className="h-2 overflow-hidden rounded-full bg-black/30">
                                                <div
                                                    className="h-full rounded-full bg-primary"
                                                    style={{
                                                        width: `${item.score}%`,
                                                    }}
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="mt-6 flex flex-wrap gap-3">
                                <button
                                    onClick={resetSession}
                                    className="rounded-full border border-white/10 px-5 py-2 text-sm text-text-main transition-colors hover:border-white/20"
                                >
                                    重新选题
                                </button>
                                <button
                                    onClick={startSession}
                                    className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-hover"
                                >
                                    <RefreshCw className="h-4 w-4" />
                                    再来一轮
                                </button>
                            </div>
                        </div>

                        <div className="space-y-4">
                            {result.questionResults.map((item, index) => (
                                <div
                                    key={item.questionId}
                                    className="rounded-[28px] border border-white/10 bg-white/[0.04] p-5"
                                >
                                    <div className="flex flex-wrap items-center justify-between gap-3">
                                        <div>
                                            <div className="text-sm text-primary">
                                                {item.category}
                                            </div>
                                            <h3 className="mt-2 text-lg font-medium leading-7">
                                                {index + 1}. {item.prompt}
                                            </h3>
                                        </div>
                                        <div
                                            className={`rounded-full px-4 py-2 text-sm font-medium ${
                                                item.verdict === 'strong'
                                                    ? 'bg-success/15 text-success'
                                                    : item.verdict === 'solid'
                                                      ? 'bg-primary/15 text-primary'
                                                      : 'bg-error/15 text-error'
                                            }`}
                                        >
                                            {item.score} 分
                                        </div>
                                    </div>
                                    <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm leading-7 text-text-main/90">
                                        {item.answer || '这题未作答'}
                                    </div>
                                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                                        <div className="rounded-2xl border border-success/15 bg-success/10 p-4">
                                            <div className="text-sm font-medium">
                                                做得好的地方
                                            </div>
                                            <div className="mt-3 space-y-2 text-sm leading-7 text-text-main/90">
                                                {item.strengths.map((point) => (
                                                    <p key={point}>{point}</p>
                                                ))}
                                            </div>
                                        </div>
                                        <div className="rounded-2xl border border-warning/15 bg-warning/10 p-4">
                                            <div className="text-sm font-medium">
                                                还可以补强
                                            </div>
                                            <div className="mt-3 space-y-2 text-sm leading-7 text-text-main/90">
                                                {item.improvements.map((point) => (
                                                    <p key={point}>{point}</p>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                )}
            </div>
        </main>
    )
}
