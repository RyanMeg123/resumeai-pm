'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import {
    ArrowLeft,
    ChevronDown,
    ChevronUp,
    Clock3,
    FolderKanban,
    Gauge,
    MessageCircleQuestion,
    Mic,
    RefreshCw,
    Brain,
    FileCheck2,
    Lightbulb,
} from 'lucide-react'

import {
    InterviewAnswerInput,
    InterviewEvaluation,
    InterviewGuide,
    InterviewQuestion,
    ProjectQuestionSet,
} from '@/lib/interview-types'

type TopTab = 'projects' | 'self-intro' | 'divergent' | 'ask-interviewer'

const TAB_CONFIG: Record<TopTab, { label: string; icon: typeof FolderKanban }> = {
    projects: { label: '项目深挖', icon: FolderKanban },
    'self-intro': { label: '自我介绍', icon: Mic },
    divergent: { label: '发散性问题', icon: Lightbulb },
    'ask-interviewer': { label: '反问面试官', icon: MessageCircleQuestion },
}

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

function countAnswered(
    questions: InterviewQuestion[],
    answers: Record<string, string>,
) {
    return questions.filter((question) => answers[question.id]?.trim()).length
}

function renderMarkdownText(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/^(\d+)\.\s+/gm, '<span class="inline-block w-6 text-text-muted">$1.</span> ')
        .replace(/^[-–]\s+/gm, '<span class="inline-block w-4 text-primary/60">·</span> ')
        .replace(/\n\n/g, '</p><p class="mt-3">')
        .replace(/\n/g, '<br />')
}

function renderGuideMarkdown(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/^## (.+)$/gm, '<h2>$1</h2>')
        .replace(/^### (.+)$/gm, '<h3>$1</h3>')
        .replace(/^#### (.+)$/gm, '<h4>$1</h4>')
        .replace(/^> (.+)$/gm, '<blockquote><p>$1</p></blockquote>')
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/^---$/gm, '<hr />')
        .replace(/^(\d+)\.\s+/gm, '<br /><span class="inline-block w-6 text-text-muted">$1.</span> ')
        .replace(/^[-–]\s+/gm, '<br /><span class="inline-block w-4 text-primary/60">·</span> ')
        .replace(/\n\n/g, '</p><p>')
        .replace(/\n/g, '<br />')
}

function ResultPanel({
    title,
    result,
    onReset,
    onRetry,
    retryLabel,
    extraHint,
}: {
    title: string
    result: InterviewEvaluation
    onReset: () => void
    onRetry: () => void
    retryLabel: string
    extraHint?: string
}) {
    return (
        <section className="mt-8 space-y-6">
            <div className="rounded-[32px] border border-white/10 bg-white/[0.05] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.32)] backdrop-blur">
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                        <div className="text-sm text-text-muted">{title}</div>
                        <div className="mt-2 text-5xl font-semibold">
                            {result.overallScore}
                        </div>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-3">
                        <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                            <div className="text-xs text-text-muted">完成度</div>
                            <div className="mt-1 text-2xl font-semibold">
                                {result.completionRate}%
                            </div>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                            <div className="text-xs text-text-muted">已答题</div>
                            <div className="mt-1 text-2xl font-semibold">
                                {result.answeredQuestions}/{result.totalQuestions}
                            </div>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                            <div className="text-xs text-text-muted">用时</div>
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
                            <h3 className="text-lg font-medium">这轮答得好的地方</h3>
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
                            <h3 className="text-lg font-medium">下一轮优先补什么</h3>
                        </div>
                        <div className="mt-4 space-y-3 text-sm leading-7 text-text-main/90">
                            {result.nextActions.map((item) => (
                                <p key={item}>{item}</p>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="mt-6">
                    <h3 className="text-lg font-medium">模块得分</h3>
                    <div className="mt-4 space-y-3">
                        {result.categoryScores.map((item) => (
                            <div key={item.category}>
                                <div className="mb-1 flex items-center justify-between text-sm">
                                    <span className="text-text-muted">{item.category}</span>
                                    <span>{item.score}</span>
                                </div>
                                <div className="h-2 overflow-hidden rounded-full bg-black/30">
                                    <div
                                        className="h-full rounded-full bg-primary"
                                        style={{ width: `${item.score}%` }}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {extraHint && (
                    <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm leading-7 text-text-muted">
                        {extraHint}
                    </div>
                )}

                <div className="mt-6 flex flex-wrap gap-3">
                    <button
                        onClick={onReset}
                        className="rounded-full border border-white/10 px-5 py-2 text-sm text-text-main transition-colors hover:border-white/20"
                    >
                        重新开始
                    </button>
                    <button
                        onClick={onRetry}
                        className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-hover"
                    >
                        <RefreshCw className="h-4 w-4" />
                        {retryLabel}
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
                                <div className="text-sm text-primary">{item.category}</div>
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
                                <div className="text-sm font-medium">做得好的地方</div>
                                <div className="mt-3 space-y-2 text-sm leading-7 text-text-main/90">
                                    {item.strengths.map((point) => (
                                        <p key={point}>{point}</p>
                                    ))}
                                </div>
                            </div>
                            <div className="rounded-2xl border border-warning/15 bg-warning/10 p-4">
                                <div className="text-sm font-medium">还可以补强</div>
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
    )
}

export function ProjectPracticeClient({
    personName,
    projectQuestionSets,
    guides = [],
}: {
    personName: string
    projectQuestionSets: ProjectQuestionSet[]
    guides?: InterviewGuide[]
}) {
    const [activeTopTab, setActiveTopTab] = useState<TopTab>('projects')

    const guidesMap = useMemo(
        () => Object.fromEntries(guides.map((g) => [g.id, g])),
        [guides],
    )

    const [selectedProjectSetId, setSelectedProjectSetId] = useState(
        projectQuestionSets[0]?.id ?? '',
    )
    const [projectQuestionCount, setProjectQuestionCount] = useState(10)
    const [expandedAnswerId, setExpandedAnswerId] = useState<string | null>(null)

    const selectedProjectSet = useMemo(
        () => projectQuestionSets.find((set) => set.id === selectedProjectSetId) ?? null,
        [projectQuestionSets, selectedProjectSetId],
    )

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

    const answeredCount = useMemo(
        () => countAnswered(sessionQuestions, answers),
        [answers, sessionQuestions],
    )

    const currentQuestion = sessionQuestions[currentIndex]

    const requestEvaluation = async ({
        questions,
        answerMap,
        totalElapsedSeconds,
    }: {
        questions: InterviewQuestion[]
        answerMap: Record<string, string>
        totalElapsedSeconds: number
    }) => {
        const payload = {
            questions,
            questionIds: questions.map((item) => item.id),
            elapsedSeconds: totalElapsedSeconds,
            answers: questions.map(
                (question): InterviewAnswerInput => ({
                    questionId: question.id,
                    answer: answerMap[question.id] || '',
                }),
            ),
        }

        const response = await fetch('/api/interview-evaluate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        })

        const evaluation = await response.json()

        if (!response.ok) {
            throw new Error(evaluation.error || '交卷失败')
        }

        return evaluation as InterviewEvaluation
    }

    const resetSession = () => {
        setSessionQuestions([])
        setAnswers({})
        setCurrentIndex(0)
        setStartedAt(null)
        setElapsedSeconds(0)
        setResult(null)
        setExpandedAnswerId(null)
    }

    const startProjectSession = () => {
        if (!selectedProjectSet) {
            return
        }

        const count = Math.min(projectQuestionCount, selectedProjectSet.questions.length)
        const bank = shuffle(selectedProjectSet.questions).slice(0, count)
        setSessionQuestions(bank)
        setAnswers({})
        setCurrentIndex(0)
        setResult(null)
        setElapsedSeconds(0)
        setStartedAt(Date.now())
        setExpandedAnswerId(null)
    }

    const submitSession = async () => {
        if (sessionQuestions.length === 0) {
            return
        }

        setIsSubmitting(true)

        try {
            const evaluation = await requestEvaluation({
                questions: sessionQuestions,
                answerMap: answers,
                totalElapsedSeconds: elapsedSeconds,
            })
            setResult(evaluation)
        } catch (error) {
            console.error(error)
            alert('交卷失败，请稍后重试')
        } finally {
            setIsSubmitting(false)
        }
    }

    if (!selectedProjectSet) {
        return (
            <main className="min-h-dvh bg-bg-main px-4 py-20 text-text-main sm:px-6">
                <div className="mx-auto max-w-5xl text-center">
                    <p className="text-text-muted">暂无项目题库</p>
                    <Link
                        href="/"
                        className="mt-4 inline-block rounded-full bg-primary px-5 py-2 text-sm font-medium text-white"
                    >
                        返回首页
                    </Link>
                </div>
            </main>
        )
    }

    return (
        <main className="min-h-dvh bg-bg-main px-4 py-12 text-text-main sm:px-6 lg:py-20">
            <div className="mx-auto max-w-5xl">
                <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
                    <div>
                        <Link
                            href="/"
                            className="inline-flex items-center gap-2 text-sm text-text-muted transition-colors hover:text-text-main"
                        >
                            <ArrowLeft className="h-4 w-4" />
                            返回面试练习场
                        </Link>
                        <h1 className="mt-3 text-3xl font-semibold md:text-4xl">
                            {personName}面试全准备
                        </h1>
                        <p className="mt-3 max-w-3xl text-sm leading-7 text-text-muted md:text-base">
                            项目深挖、自我介绍、发散性问题、反问面试官——面试全流程覆盖。
                        </p>
                    </div>
                </div>

                {/* Top-level tabs */}
                <div className="mb-8 flex flex-wrap gap-3">
                    {(Object.entries(TAB_CONFIG) as [TopTab, typeof TAB_CONFIG[TopTab]][]).map(
                        ([key, config]) => {
                            const Icon = config.icon
                            const isDisabled = key !== 'projects' && !guidesMap[key]
                            return (
                                <button
                                    key={key}
                                    onClick={() => !isDisabled && setActiveTopTab(key)}
                                    disabled={isDisabled}
                                    className={`inline-flex items-center gap-2 rounded-full border px-5 py-3 text-sm font-medium transition-colors ${
                                        activeTopTab === key
                                            ? 'border-primary bg-primary/10 text-text-main'
                                            : 'border-white/10 bg-white/[0.04] text-text-muted'
                                    } ${
                                        isDisabled
                                            ? 'cursor-not-allowed opacity-60'
                                            : 'hover:border-white/20 hover:text-text-main'
                                    }`}
                                >
                                    <Icon className="h-4 w-4" />
                                    {config.label}
                                </button>
                            )
                        },
                    )}
                </div>

                {activeTopTab !== 'projects' && guidesMap[activeTopTab] ? (
                    <div className="rounded-[32px] border border-white/10 bg-white/[0.04] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.32)] backdrop-blur">
                        <div
                            className="prose prose-invert prose-sm max-w-none leading-7 text-text-main/90 [&_h2]:mt-10 [&_h2]:mb-4 [&_h2]:text-xl [&_h2]:font-semibold [&_h3]:mt-6 [&_h3]:mb-3 [&_h3]:text-lg [&_h3]:font-medium [&_h4]:mt-4 [&_h4]:mb-2 [&_h4]:font-medium [&_p]:mb-3 [&_hr]:my-8 [&_hr]:border-white/10 [&_ul]:space-y-1 [&_ol]:space-y-1 [&_li]:text-text-main/80 [&_strong]:text-text-main [&_blockquote]:border-primary/30 [&_blockquote]:bg-primary/5 [&_blockquote]:rounded-2xl [&_blockquote]:px-5 [&_blockquote]:py-3 [&_blockquote]:not-italic [&_blockquote]:text-text-muted"
                            dangerouslySetInnerHTML={{
                                __html: renderGuideMarkdown(guidesMap[activeTopTab].content),
                            }}
                        />
                    </div>
                ) : activeTopTab === 'projects' ? (
                    <>
                {/* Project sub-tabs */}
                {projectQuestionSets.length > 1 && sessionQuestions.length === 0 && !result && (
                    <div className="mb-6 flex flex-wrap gap-2 rounded-[20px] border border-white/10 bg-white/[0.03] p-2">
                        {projectQuestionSets.map((set) => (
                            <button
                                key={set.id}
                                onClick={() => {
                                    setSelectedProjectSetId(set.id)
                                    resetSession()
                                }}
                                className={`rounded-2xl px-4 py-2.5 text-sm font-medium transition-colors ${
                                    selectedProjectSetId === set.id
                                        ? 'bg-primary/15 text-text-main shadow-sm'
                                        : 'text-text-muted hover:bg-white/[0.06] hover:text-text-main'
                                }`}
                            >
                                {set.project}
                            </button>
                        ))}
                    </div>
                )}

                {sessionQuestions.length === 0 && !result ? (
                    <section className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
                        <div className="rounded-[32px] border border-white/10 bg-white/[0.04] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.32)] backdrop-blur">
                            <div className="flex items-center gap-3 text-primary">
                                <FolderKanban className="h-5 w-5" />
                                <span className="text-sm font-medium">
                                    项目深挖 · {selectedProjectSet.project}
                                </span>
                            </div>

                            <div className="mt-5 space-y-4">
                                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                                    <div className="text-sm text-text-muted">当前项目</div>
                                    <div className="mt-2 text-lg font-semibold">
                                        {selectedProjectSet.person} · {selectedProjectSet.project}
                                    </div>
                                </div>
                                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                                    <div className="text-sm text-text-muted">题库容量</div>
                                    <div className="mt-2 text-lg font-semibold">
                                        {selectedProjectSet.questions.length} 题
                                    </div>
                                    <div className="mt-2 text-sm text-text-muted">
                                        含 {Object.keys(selectedProjectSet.referenceAnswers).length} 道参考答案
                                    </div>
                                </div>
                            </div>

                            <div className="mt-6">
                                <div className="mb-3 text-sm font-medium">本轮题量</div>
                                <div className="flex flex-wrap gap-3">
                                    {[10, 20, selectedProjectSet.questions.length]
                                        .filter(
                                            (count, index, arr) =>
                                                count <= selectedProjectSet.questions.length &&
                                                arr.indexOf(count) === index,
                                        )
                                        .map((count) => (
                                            <button
                                                key={count}
                                                onClick={() => setProjectQuestionCount(count)}
                                                className={`rounded-full border px-4 py-2 text-sm transition-colors ${
                                                    projectQuestionCount === count
                                                        ? 'border-primary bg-primary/10 text-text-main'
                                                        : 'border-white/10 bg-black/10 text-text-muted hover:border-white/20 hover:text-text-main'
                                                }`}
                                            >
                                                {count === selectedProjectSet.questions.length
                                                    ? `全部 ${count}`
                                                    : count}{' '}
                                                题
                                            </button>
                                        ))}
                                </div>
                            </div>

                            <div className="mt-8">
                                <button
                                    onClick={startProjectSession}
                                    className="rounded-full bg-primary px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-primary-hover"
                                >
                                    开始项目深挖
                                </button>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div className="rounded-[28px] border border-white/10 bg-black/20 p-5">
                                <div className="flex items-center gap-3 text-text-main">
                                    <Gauge className="h-5 w-5 text-success" />
                                    <h2 className="text-lg font-medium">
                                        项目深挖和公共题有什么不同
                                    </h2>
                                </div>
                                <div className="mt-4 space-y-3 text-sm leading-7 text-text-muted">
                                    <p>每道题都来自你的真实项目文档（PRD、立项报告），不是泛泛的概念题。</p>
                                    <p>覆盖需求洞察、方案设计、模型选型、交互体验、数据策略、商业化、风险兜底、项目管理。</p>
                                    <p>每题都有参考答案，答完后可以对照查看，查缺补漏。</p>
                                </div>
                            </div>

                            <div className="rounded-[28px] border border-white/10 bg-black/20 p-5">
                                <div className="text-sm font-medium">题目分类一览</div>
                                <div className="mt-3 flex flex-wrap gap-2">
                                    {Array.from(
                                        new Set(selectedProjectSet.questions.map((q) => q.category)),
                                    ).map((category) => (
                                        <span
                                            key={category}
                                            className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs text-text-muted"
                                        >
                                            {category}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </section>
                ) : result ? (
                    <ResultPanel
                        title="项目深挖总分"
                        result={result}
                        onReset={resetSession}
                        onRetry={startProjectSession}
                        retryLabel="再来一轮项目深挖"
                        extraHint={`这轮题目来自「${selectedProjectSet.person} · ${selectedProjectSet.project}」的项目文档。可以对照参考答案查缺补漏。`}
                    />
                ) : currentQuestion ? (
                    <section className="grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">
                        <aside className="rounded-[30px] border border-white/10 bg-white/[0.04] p-5 backdrop-blur">
                            <div className="flex items-center gap-3 text-sm text-text-muted">
                                <Clock3 className="h-4 w-4" />
                                已用时 {formatDuration(elapsedSeconds)}
                            </div>
                            <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4">
                                <div className="text-sm text-text-muted">已完成</div>
                                <div className="mt-2 text-3xl font-semibold">
                                    {answeredCount}/{sessionQuestions.length}
                                </div>
                            </div>
                            <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm leading-7 text-text-muted">
                                {selectedProjectSet.person} · {selectedProjectSet.project}
                            </div>

                            <div className="mt-5 space-y-2">
                                {sessionQuestions.map((question, index) => {
                                    const answered = answers[question.id]?.trim().length > 0

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
                                                        answered ? 'bg-success' : 'bg-border'
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
                                    项目深挖 #{currentQuestion.index}
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
                                            [currentQuestion.id]: event.target.value,
                                        }))
                                    }
                                    placeholder="尽量把场景、判断、动作、结果讲完整，就像在真实面试中回答一样。"
                                    className="min-h-[260px] w-full rounded-[28px] border border-white/10 bg-[#0B0C11] p-5 text-base leading-7 text-text-main outline-none transition-colors placeholder:text-text-muted/70 focus:border-primary"
                                />
                            </div>

                            {selectedProjectSet.referenceAnswers[currentQuestion.id] && (
                                <div className="mt-4">
                                    <button
                                        onClick={() =>
                                            setExpandedAnswerId(
                                                expandedAnswerId === currentQuestion.id
                                                    ? null
                                                    : currentQuestion.id,
                                            )
                                        }
                                        className="inline-flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-sm text-text-muted transition-colors hover:border-white/20 hover:text-text-main"
                                    >
                                        {expandedAnswerId === currentQuestion.id ? (
                                            <ChevronUp className="h-4 w-4" />
                                        ) : (
                                            <ChevronDown className="h-4 w-4" />
                                        )}
                                        {expandedAnswerId === currentQuestion.id
                                            ? '收起参考答案'
                                            : '查看参考答案'}
                                    </button>
                                    {expandedAnswerId === currentQuestion.id && (
                                        <div
                                            className="mt-3 rounded-[24px] border border-primary/20 bg-primary/5 p-5 text-sm leading-7 text-text-main/90"
                                            dangerouslySetInnerHTML={{
                                                __html: renderMarkdownText(
                                                    selectedProjectSet.referenceAnswers[
                                                        currentQuestion.id
                                                    ],
                                                ),
                                            }}
                                        />
                                    )}
                                </div>
                            )}

                            <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                                <div className="text-sm text-text-muted">
                                    这一题当前字数：
                                    {(answers[currentQuestion.id] || '').replace(/\s+/g, '').length}
                                </div>

                                <div className="flex flex-wrap gap-3">
                                    <button
                                        onClick={() =>
                                            setCurrentIndex((current) => Math.max(0, current - 1))
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
                                                        sessionQuestions.length - 1,
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
                                            {isSubmitting ? '正在交卷...' : '交卷并评分'}
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </section>
                ) : null}
                    </>
                ) : null}
            </div>
        </main>
    )
}
