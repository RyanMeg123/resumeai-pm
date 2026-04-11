'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import {
    ArrowLeft,
    Brain,
    Clock3,
    FileCheck2,
    Gauge,
    LibraryBig,
    ListChecks,
    LockKeyhole,
    RefreshCw,
    Sparkles,
    Unlock,
} from 'lucide-react'

import {
    InterviewAnswerInput,
    InterviewEvaluation,
    InterviewQuestion,
} from '@/lib/interview-types'
import {
    generateMockInterviewQuestion,
    generateResumeInterviewQuestions,
} from '@/lib/gemini'
import { ResumeInterviewProfile, RESUME_INTERVIEW_PROFILE_STORAGE_KEY } from '@/lib/interview-profile'

type PracticeMode = 'marathon' | 'mock' | 'cards' | 'resume'

const MARATHON_COMPLETED_STORAGE_KEY = 'resumeai-pm-marathon-completed'

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

function ResultPanel({
    title,
    result,
    onReset,
    onRetry,
    retryLabel,
    extraAction,
    extraHint,
}: {
    title: string
    result: InterviewEvaluation
    onReset: () => void
    onRetry: () => void
    retryLabel: string
    extraAction?: React.ReactNode
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
                    <h3 className="text-lg font-medium">模块得分</h3>
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
                    {extraAction}
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
    )
}

export function InterviewPracticeClient({
    allQuestions,
}: {
    allQuestions: InterviewQuestion[]
}) {
    const totalQuestions = allQuestions.length
    const totalQuestionsLabel = `${totalQuestions}题`
    const totalQuestionsCountLabel = `${totalQuestions} 道`
    const marathonModeLabel = `${totalQuestionsLabel}全刷`

    const categories = useMemo(
        () => Array.from(new Set(allQuestions.map((item) => item.category))),
        [allQuestions],
    )
    const groupedQuestions = useMemo(
        () =>
            categories.map((category) => ({
                category,
                questions: allQuestions.filter((item) => item.category === category),
            })),
        [allQuestions, categories],
    )

    const [activeMode, setActiveMode] = useState<PracticeMode>('marathon')
    const [activeMarathonCategory, setActiveMarathonCategory] = useState(
        categories[0] ?? '',
    )
    const [resumeProfile, setResumeProfile] = useState<ResumeInterviewProfile | null>(null)
    const [marathonCompleted, setMarathonCompleted] = useState(false)

    const [marathonAnswers, setMarathonAnswers] = useState<Record<string, string>>(
        {},
    )
    const [marathonStartedAt, setMarathonStartedAt] = useState<number | null>(null)
    const [marathonElapsedSeconds, setMarathonElapsedSeconds] = useState(0)
    const [marathonSubmitting, setMarathonSubmitting] = useState(false)
    const [marathonResult, setMarathonResult] =
        useState<InterviewEvaluation | null>(null)

    const [selectedCategories, setSelectedCategories] = useState<string[]>(categories)
    const [questionCount, setQuestionCount] = useState(10)
    const [mockQuestionCount, setMockQuestionCount] = useState(5)
    const [resumeQuestionCount, setResumeQuestionCount] = useState(8)
    const [sessionQuestions, setSessionQuestions] = useState<InterviewQuestion[]>([])
    const [answers, setAnswers] = useState<Record<string, string>>({})
    const [currentIndex, setCurrentIndex] = useState(0)
    const [startedAt, setStartedAt] = useState<number | null>(null)
    const [elapsedSeconds, setElapsedSeconds] = useState(0)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [isGeneratingMockQuestion, setIsGeneratingMockQuestion] = useState(false)
    const [isGeneratingResumeSession, setIsGeneratingResumeSession] = useState(false)
    const [result, setResult] = useState<InterviewEvaluation | null>(null)

    useEffect(() => {
        const profileRaw = window.localStorage.getItem(
            RESUME_INTERVIEW_PROFILE_STORAGE_KEY,
        )
        if (profileRaw) {
            try {
                const profile = JSON.parse(profileRaw) as ResumeInterviewProfile
                if (profile?.selectedProjects?.length > 0) {
                    setResumeProfile(profile)
                }
            } catch (error) {
                console.error('Failed to load interview profile:', error)
            }
        }

        const storedValue = window.localStorage.getItem(
            MARATHON_COMPLETED_STORAGE_KEY,
        )

        if (storedValue === 'true') {
            setMarathonCompleted(true)
        }
    }, [])

    useEffect(() => {
        if (!marathonStartedAt || marathonResult) {
            return
        }

        const timer = window.setInterval(() => {
            setMarathonElapsedSeconds(
                Math.round((Date.now() - marathonStartedAt) / 1000),
            )
        }, 1000)

        return () => window.clearInterval(timer)
    }, [marathonStartedAt, marathonResult])

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

    const marathonAnsweredCount = useMemo(
        () => countAnswered(allQuestions, marathonAnswers),
        [allQuestions, marathonAnswers],
    )
    const answeredCount = useMemo(
        () => countAnswered(sessionQuestions, answers),
        [answers, sessionQuestions],
    )

    const activeMarathonGroup = useMemo(
        () =>
            groupedQuestions.find(
                (group) => group.category === activeMarathonCategory,
            ) ?? groupedQuestions[0],
        [activeMarathonCategory, groupedQuestions],
    )
    const activeMarathonGroupIndex = useMemo(
        () =>
            groupedQuestions.findIndex(
                (group) => group.category === activeMarathonGroup?.category,
            ),
        [activeMarathonGroup?.category, groupedQuestions],
    )
    const currentQuestion = sessionQuestions[currentIndex]

    useEffect(() => {
        if (
            groupedQuestions.length > 0 &&
            !groupedQuestions.some(
                (group) => group.category === activeMarathonCategory,
            )
        ) {
            setActiveMarathonCategory(groupedQuestions[0].category)
        }
    }, [activeMarathonCategory, groupedQuestions])

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
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        })

        const evaluation = await response.json()

        if (!response.ok) {
            throw new Error(evaluation.error || '交卷失败')
        }

        return evaluation as InterviewEvaluation
    }

    const toggleCategory = (category: string) => {
        setSelectedCategories((current) =>
            current.includes(category)
                ? current.filter((item) => item !== category)
                : [...current, category],
        )
    }

    const startMarathon = () => {
        setMarathonAnswers({})
        setMarathonResult(null)
        setMarathonElapsedSeconds(0)
        if (groupedQuestions[0]) {
            setActiveMarathonCategory(groupedQuestions[0].category)
        }
        setMarathonStartedAt(Date.now())
    }

    const resetMarathon = () => {
        setMarathonAnswers({})
        setMarathonResult(null)
        setMarathonElapsedSeconds(0)
        if (groupedQuestions[0]) {
            setActiveMarathonCategory(groupedQuestions[0].category)
        }
        setMarathonStartedAt(null)
    }

    const submitMarathon = async () => {
        if (allQuestions.length === 0) {
            return
        }

        if (!marathonStartedAt) {
            setMarathonStartedAt(Date.now())
        }

        setMarathonSubmitting(true)

        try {
            const evaluation = await requestEvaluation({
                questions: allQuestions,
                answerMap: marathonAnswers,
                totalElapsedSeconds: marathonElapsedSeconds,
            })

            setMarathonResult(evaluation)

            if (evaluation.answeredQuestions === evaluation.totalQuestions) {
                setMarathonCompleted(true)
                window.localStorage.setItem(
                    MARATHON_COMPLETED_STORAGE_KEY,
                    'true',
                )
            }
        } catch (error) {
            console.error(error)
            alert('交卷失败，请稍后重试')
        } finally {
            setMarathonSubmitting(false)
        }
    }

    const startQuestionSession = (
        bank: InterviewQuestion[],
        _source: 'cards' | 'resume',
    ) => {
        setSessionQuestions(bank)
        setAnswers({})
        setCurrentIndex(0)
        setResult(null)
        setElapsedSeconds(0)
        setStartedAt(Date.now())
    }

    const startSession = () => {
        const bank = shuffle(filteredBank).slice(
            0,
            Math.min(questionCount, filteredBank.length),
        )

        startQuestionSession(bank, 'cards')
    }

    const startResumeSession = async () => {
        if (!resumeProfile) {
            return
        }

        setIsGeneratingResumeSession(true)

        try {
            const questions = await generateResumeInterviewQuestions({
                profile: resumeProfile,
                count: resumeQuestionCount,
            })
            startQuestionSession(questions, 'resume')
        } catch (error) {
            console.error(error)
            alert('定向题生成失败，请稍后重试')
        } finally {
            setIsGeneratingResumeSession(false)
        }
    }

    const startMockInterview = async () => {
        setIsGeneratingMockQuestion(true)

        try {
            const firstQuestion = await generateMockInterviewQuestion({
                profile: resumeProfile,
                history: [],
                round: 1,
            })
            startQuestionSession([firstQuestion], 'resume')
        } catch (error) {
            console.error(error)
            alert('模拟面试开启失败，请稍后重试')
        } finally {
            setIsGeneratingMockQuestion(false)
        }
    }

    const advanceMockInterview = async () => {
        const answer = currentQuestion ? answers[currentQuestion.id]?.trim() : ''

        if (!currentQuestion || !answer) {
            alert('请先回答当前问题，再继续追问。')
            return
        }

        setIsGeneratingMockQuestion(true)

        try {
            const nextQuestion = await generateMockInterviewQuestion({
                profile: resumeProfile,
                round: sessionQuestions.length + 1,
                history: sessionQuestions
                    .map((question) => ({
                        question: question.prompt,
                        category: question.category,
                        answer: answers[question.id] || '',
                    }))
                    .filter((item) => item.answer.trim()),
            })

            setSessionQuestions((current) => [...current, nextQuestion])
            setCurrentIndex(sessionQuestions.length)
        } catch (error) {
            console.error(error)
            alert('下一道追问生成失败，请稍后重试')
        } finally {
            setIsGeneratingMockQuestion(false)
        }
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

    return (
        <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(77,126,255,0.18),_transparent_32%),radial-gradient(circle_at_top_right,_rgba(52,211,153,0.14),_transparent_28%),linear-gradient(180deg,_#0E0F14_0%,_#090A0E_100%)] text-text-main">
            <div className="mx-auto max-w-7xl px-6 py-8 md:px-10">
                <div className="mb-8 flex items-center justify-between gap-4">
                    <div>
                        <Link
                            href="/resume"
                            className="mb-4 inline-flex items-center gap-2 text-sm text-text-muted transition-colors hover:text-text-main"
                        >
                            <ArrowLeft className="h-4 w-4" />
                            去简历打磨
                        </Link>
                        <h1 className="text-3xl font-semibold tracking-tight md:text-5xl">
                            AI 产品经理面试练习场
                        </h1>
                        <p className="mt-3 max-w-3xl text-sm leading-7 text-text-muted md:text-base">
                            先把 {totalQuestionsCountLabel}
                            高频题完整刷一轮，再进入抽卡式答题反复补短板。每次交卷后都会给你总分、模块分和逐题反馈。
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

                <div className="mb-8 flex flex-wrap gap-3">
                    <button
                        onClick={() => setActiveMode('marathon')}
                        className={`inline-flex items-center gap-2 rounded-full border px-5 py-3 text-sm font-medium transition-colors ${
                            activeMode === 'marathon'
                                ? 'border-primary bg-primary/10 text-text-main'
                                : 'border-white/10 bg-white/[0.04] text-text-muted hover:border-white/20 hover:text-text-main'
                        }`}
                    >
                        <LibraryBig className="h-4 w-4" />
                        {marathonModeLabel}
                    </button>
                    <button
                        onClick={() => setActiveMode('mock')}
                        className={`inline-flex items-center gap-2 rounded-full border px-5 py-3 text-sm font-medium transition-colors ${
                            activeMode === 'mock'
                                ? 'border-primary bg-primary/10 text-text-main'
                                : 'border-white/10 bg-white/[0.04] text-text-muted hover:border-white/20 hover:text-text-main'
                        }`}
                    >
                        <Brain className="h-4 w-4" />
                        模拟面试
                    </button>
                    <button
                        onClick={() => resumeProfile && setActiveMode('resume')}
                        disabled={!resumeProfile}
                        className={`inline-flex items-center gap-2 rounded-full border px-5 py-3 text-sm font-medium transition-colors ${
                            activeMode === 'resume'
                                ? 'border-primary bg-primary/10 text-text-main'
                                : 'border-white/10 bg-white/[0.04] text-text-muted'
                        } ${
                            resumeProfile
                                ? 'hover:border-white/20 hover:text-text-main'
                                : 'cursor-not-allowed opacity-60'
                        }`}
                    >
                        {resumeProfile ? (
                            <FileCheck2 className="h-4 w-4" />
                        ) : (
                            <LockKeyhole className="h-4 w-4" />
                        )}
                        简历定向题
                    </button>
                    <button
                        onClick={() => marathonCompleted && setActiveMode('cards')}
                        disabled={!marathonCompleted}
                        className={`inline-flex items-center gap-2 rounded-full border px-5 py-3 text-sm font-medium transition-colors ${
                            activeMode === 'cards'
                                ? 'border-primary bg-primary/10 text-text-main'
                                : 'border-white/10 bg-white/[0.04] text-text-muted'
                        } ${
                            marathonCompleted
                                ? 'hover:border-white/20 hover:text-text-main'
                                : 'cursor-not-allowed opacity-60'
                        }`}
                    >
                        {marathonCompleted ? (
                            <Unlock className="h-4 w-4" />
                        ) : (
                            <LockKeyhole className="h-4 w-4" />
                        )}
                        抽卡式答题
                    </button>
                </div>

                {activeMode === 'marathon' ? (
                    <>
                        {!marathonStartedAt && !marathonResult ? (
                            <section className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
                                <div className="rounded-[32px] border border-white/10 bg-white/[0.04] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.32)] backdrop-blur">
                                    <div className="flex items-center gap-3 text-primary">
                                        <LibraryBig className="h-5 w-5" />
                                        <span className="text-sm font-medium">
                                            {marathonModeLabel}模式
                                        </span>
                                    </div>
                                    <div className="mt-5 grid gap-4 md:grid-cols-3">
                                        <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                                            <div className="text-sm text-text-muted">
                                                总题量
                                            </div>
                                            <div className="mt-2 text-3xl font-semibold">
                                                {totalQuestions}
                                            </div>
                                            <div className="mt-2 text-sm text-text-muted">
                                                一次性把高频面试题过完
                                            </div>
                                        </div>
                                        <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                                            <div className="text-sm text-text-muted">
                                                模块数
                                            </div>
                                            <div className="mt-2 text-3xl font-semibold">
                                                {categories.length}
                                            </div>
                                            <div className="mt-2 text-sm text-text-muted">
                                                覆盖基础、Agent、商业和行为题
                                            </div>
                                        </div>
                                        <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                                            <div className="text-sm text-text-muted">
                                                解锁
                                            </div>
                                            <div className="mt-2 text-3xl font-semibold">
                                                抽卡
                                            </div>
                                            <div className="mt-2 text-sm text-text-muted">
                                                全部交卷后开放精练模式
                                            </div>
                                        </div>
                                    </div>

                                    <div className="mt-8 rounded-[28px] border border-primary/20 bg-primary/10 p-5 text-sm leading-7 text-text-main/90">
                                        这轮更像你给自己做一次完整摸底。先把全部题型都过一遍，知道自己薄弱在哪，再进抽卡模式反复补。
                                    </div>

                                    <div className="mt-8 flex flex-wrap items-center gap-4">
                                        <button
                                            onClick={startMarathon}
                                            className="rounded-full bg-primary px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-primary-hover"
                                        >
                                            开始刷 {totalQuestionsCountLabel}
                                        </button>
                                        {marathonCompleted && (
                                            <div className="text-sm text-success">
                                                你已经完成过一轮全刷，抽卡模式已解锁
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <div className="rounded-[28px] border border-white/10 bg-black/20 p-5">
                                        <div className="flex items-center gap-3 text-text-main">
                                            <Gauge className="h-5 w-5 text-success" />
                                            <h2 className="text-lg font-medium">
                                                这轮结束后能得到什么
                                            </h2>
                                        </div>
                                        <div className="mt-4 space-y-3 text-sm leading-7 text-text-muted">
                                            <p>先拿到一张完整底图，知道自己最弱的是哪一块。</p>
                                            <p>不是只看总分，还能看每个模块的高低。</p>
                                            <p>全部交卷后，抽卡式答题会自动解锁。</p>
                                        </div>
                                    </div>

                                    <div className="rounded-[28px] border border-white/10 bg-black/20 p-5">
                                        <div className="flex items-center gap-3 text-text-main">
                                            <ListChecks className="h-5 w-5 text-primary" />
                                            <h2 className="text-lg font-medium">
                                                建议怎么刷
                                            </h2>
                                        </div>
                                        <div className="mt-4 space-y-3 text-sm leading-7 text-text-muted">
                                            <p>可以先每题写短版，确保 {totalQuestionsLabel}都过一遍。</p>
                                            <p>第二轮再回头补低分题，把答案拉得更完整。</p>
                                            <p>行为题尽量写成真实经历，不要只讲原则。</p>
                                        </div>
                                    </div>
                                </div>
                            </section>
                        ) : (
                            <section className="space-y-6">
                                <div className="rounded-[30px] border border-white/10 bg-white/[0.04] p-5 backdrop-blur">
                                    <div className="flex flex-wrap items-center justify-between gap-4">
                                        <div className="flex flex-wrap items-center gap-4 text-sm text-text-muted">
                                            <div className="inline-flex items-center gap-2">
                                                <Clock3 className="h-4 w-4" />
                                                已用时{' '}
                                                {formatDuration(marathonElapsedSeconds)}
                                            </div>
                                            <div className="inline-flex items-center gap-2">
                                                <Sparkles className="h-4 w-4 text-success" />
                                                已完成 {marathonAnsweredCount}/
                                                {allQuestions.length}
                                            </div>
                                        </div>
                                        <div className="flex flex-wrap gap-3">
                                            <button
                                                onClick={resetMarathon}
                                                className="rounded-full border border-white/10 px-4 py-2 text-sm text-text-main transition-colors hover:border-white/20"
                                            >
                                                从头开始
                                            </button>
                                            <button
                                                onClick={submitMarathon}
                                                disabled={marathonSubmitting}
                                                className="rounded-full bg-success px-5 py-2 text-sm font-medium text-[#08110C] transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                                            >
                                                {marathonSubmitting
                                                    ? '正在交卷...'
                                                    : '交卷并评分'}
                                            </button>
                                        </div>
                                    </div>

                                    <div className="mt-5 flex flex-wrap gap-2">
                                        {groupedQuestions.map((group) => {
                                            const groupAnswered = countAnswered(
                                                group.questions,
                                                marathonAnswers,
                                            )

                                            return (
                                                <button
                                                    key={group.category}
                                                    onClick={() =>
                                                        setActiveMarathonCategory(
                                                            group.category,
                                                        )
                                                    }
                                                    className={`rounded-full border px-4 py-2 text-sm transition-colors ${
                                                        activeMarathonGroup?.category ===
                                                        group.category
                                                            ? 'border-primary bg-primary/10 text-text-main'
                                                            : 'border-white/10 bg-black/20 text-text-muted hover:border-white/20 hover:text-text-main'
                                                    }`}
                                                >
                                                    {group.category} {groupAnswered}/
                                                    {group.questions.length}
                                                </button>
                                            )
                                        })}
                                    </div>
                                </div>

                                {activeMarathonGroup && (
                                    <div className="space-y-6">
                                        <section
                                            key={activeMarathonGroup.category}
                                            className="rounded-[32px] border border-white/10 bg-white/[0.04] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.24)] backdrop-blur"
                                        >
                                            <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
                                                <div>
                                                    <div className="text-sm text-primary">
                                                        模块
                                                    </div>
                                                    <h2 className="mt-2 text-2xl font-semibold">
                                                        {activeMarathonGroup.category}
                                                    </h2>
                                                    <p className="mt-2 text-sm leading-7 text-text-muted">
                                                        现在只展示这个模块的题。切到别的 tab 才会看见别的模块。
                                                    </p>
                                                </div>
                                                <div className="flex flex-wrap items-center gap-3">
                                                    <div className="rounded-full border border-white/10 bg-black/20 px-4 py-2 text-sm text-text-muted">
                                                        已答{' '}
                                                        {countAnswered(
                                                            activeMarathonGroup.questions,
                                                            marathonAnswers,
                                                        )}
                                                        /{activeMarathonGroup.questions.length}
                                                    </div>
                                                    <div className="rounded-full border border-white/10 bg-black/20 px-4 py-2 text-sm text-text-muted">
                                                        第 {activeMarathonGroupIndex + 1} /{' '}
                                                        {groupedQuestions.length} 组
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="mb-6 flex flex-wrap gap-3">
                                                <button
                                                    onClick={() => {
                                                        const previousGroup =
                                                            groupedQuestions[
                                                                activeMarathonGroupIndex - 1
                                                            ]
                                                        if (previousGroup) {
                                                            setActiveMarathonCategory(
                                                                previousGroup.category,
                                                            )
                                                        }
                                                    }}
                                                    disabled={activeMarathonGroupIndex <= 0}
                                                    className="rounded-full border border-white/10 px-4 py-2 text-sm text-text-main transition-colors hover:border-white/20 disabled:cursor-not-allowed disabled:opacity-40"
                                                >
                                                    上一组
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        const nextGroup =
                                                            groupedQuestions[
                                                                activeMarathonGroupIndex + 1
                                                            ]
                                                        if (nextGroup) {
                                                            setActiveMarathonCategory(
                                                                nextGroup.category,
                                                            )
                                                        }
                                                    }}
                                                    disabled={
                                                        activeMarathonGroupIndex >=
                                                        groupedQuestions.length - 1
                                                    }
                                                    className="rounded-full border border-white/10 px-4 py-2 text-sm text-text-main transition-colors hover:border-white/20 disabled:cursor-not-allowed disabled:opacity-40"
                                                >
                                                    下一组
                                                </button>
                                            </div>

                                            <div className="space-y-4">
                                                {activeMarathonGroup.questions.map((question) => (
                                                    <div
                                                        key={question.id}
                                                        className="rounded-[28px] border border-white/10 bg-black/20 p-5"
                                                    >
                                                        <div className="flex flex-wrap items-center justify-between gap-3">
                                                            <div className="text-sm text-text-muted">
                                                                题库编号 #
                                                                {question.index}
                                                            </div>
                                                            <div className="text-sm text-text-muted">
                                                                当前字数：
                                                                {(
                                                                    marathonAnswers[
                                                                        question.id
                                                                    ] || ''
                                                                )
                                                                    .replace(
                                                                        /\s+/g,
                                                                        '',
                                                                    )
                                                                    .length}
                                                            </div>
                                                        </div>
                                                        <p className="mt-3 text-lg leading-8 text-text-main">
                                                            {question.prompt}
                                                        </p>
                                                        <textarea
                                                            value={
                                                                marathonAnswers[
                                                                    question.id
                                                                ] || ''
                                                            }
                                                            onChange={(event) => {
                                                                if (
                                                                    !marathonStartedAt
                                                                ) {
                                                                    setMarathonStartedAt(
                                                                        Date.now(),
                                                                    )
                                                                }

                                                                setMarathonAnswers(
                                                                    (current) => ({
                                                                        ...current,
                                                                        [question.id]:
                                                                            event
                                                                                .target
                                                                                .value,
                                                                    }),
                                                                )
                                                            }}
                                                            placeholder="先写一版能交卷的答案，后面再回头补低分题。"
                                                            className="mt-4 min-h-[180px] w-full rounded-[24px] border border-white/10 bg-[#0B0C11] p-4 text-sm leading-7 text-text-main outline-none transition-colors placeholder:text-text-muted/70 focus:border-primary"
                                                        />
                                                    </div>
                                                ))}
                                            </div>
                                        </section>
                                    </div>
                                )}

                                <div className="sticky bottom-6 z-10 rounded-[28px] border border-white/10 bg-[#0B0C11]/90 p-4 shadow-[0_16px_50px_rgba(0,0,0,0.35)] backdrop-blur">
                                    <div className="flex flex-wrap items-center justify-between gap-4">
                                        <div className="text-sm leading-7 text-text-muted">
                                            当前已答 {marathonAnsweredCount}/
                                            {totalQuestions} 题。
                                            {marathonAnsweredCount ===
                                            totalQuestions
                                                ? ' 这轮交卷后会解锁抽卡式答题。'
                                                : ` 只有 ${totalQuestionsCountLabel}全部答完，抽卡模式才会解锁。`}
                                        </div>
                                        <button
                                            onClick={submitMarathon}
                                            disabled={marathonSubmitting}
                                            className="rounded-full bg-success px-5 py-2 text-sm font-medium text-[#08110C] transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                                        >
                                            {marathonSubmitting
                                                ? '正在交卷...'
                                                : `提交 ${totalQuestionsCountLabel}`}
                                        </button>
                                    </div>
                                </div>
                            </section>
                        )}

                        {marathonResult && (
                            <ResultPanel
                                title={`${marathonModeLabel}总分`}
                                result={marathonResult}
                                onReset={resetMarathon}
                                onRetry={startMarathon}
                                retryLabel={`再刷 ${totalQuestionsCountLabel}`}
                                extraHint={
                                    marathonCompleted
                                        ? `你已经完成了 ${marathonModeLabel}，抽卡式答题现在已经解锁。`
                                        : `这轮还没把 ${totalQuestionsCountLabel}全部答完，所以抽卡式答题暂时不会解锁。`
                                }
                                extraAction={
                                    marathonCompleted ? (
                                        <button
                                            onClick={() => setActiveMode('cards')}
                                            className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-hover"
                                        >
                                            <Unlock className="h-4 w-4" />
                                            去抽卡式答题
                                        </button>
                                    ) : undefined
                                }
                            />
                        )}
                    </>
                ) : activeMode === 'mock' ? (
                    <>
                        {sessionQuestions.length === 0 ? (
                            <section className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
                                <div className="rounded-[32px] border border-white/10 bg-white/[0.04] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.32)] backdrop-blur">
                                    <div className="flex items-center gap-3 text-primary">
                                        <Brain className="h-5 w-5" />
                                        <span className="text-sm font-medium">
                                            模拟面试
                                        </span>
                                    </div>
                                    <div className="mt-5 rounded-[24px] border border-success/20 bg-success/10 p-4 text-sm leading-7 text-text-main/90">
                                        这里不再是题库刷题，而是一轮会连续追问的文字模拟面试。第一题从自我介绍或岗位匹配开始，后面会根据你的回答继续深挖。
                                    </div>

                                    <div className="mt-5 space-y-4">
                                        <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                                            <div className="text-sm text-text-muted">
                                                这轮会参考什么
                                            </div>
                                            <div className="mt-3 space-y-2 text-sm leading-7 text-text-main/90">
                                                <p>{resumeProfile ? '会参考你最近一次简历诊断、目标岗位和项目经历。' : '如果你还没做简历诊断，也能先按通用 AI 产品经理面试来模拟。'}</p>
                                                <p>每一轮会优先追问项目、指标、推进、取舍和风险。</p>
                                            </div>
                                        </div>
                                        {resumeProfile && (
                                            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                                                <div className="text-sm text-text-muted">当前目标岗位</div>
                                                <div className="mt-2 text-lg font-semibold">
                                                    {resumeProfile.targetRoleProfile?.company
                                                        ? `${resumeProfile.targetRoleProfile.title} · ${resumeProfile.targetRoleProfile.company}`
                                                        : resumeProfile.targetRoleProfile?.title || 'AI 产品经理'}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    <div className="mt-6">
                                        <div className="mb-3 text-sm font-medium">
                                            追问轮数
                                        </div>
                                        <div className="flex flex-wrap gap-3">
                                            {[4, 5, 6].map((count) => (
                                                <button
                                                    key={count}
                                                    onClick={() => setMockQuestionCount(count)}
                                                    className={`rounded-full border px-4 py-2 text-sm transition-colors ${
                                                        mockQuestionCount === count
                                                            ? 'border-primary bg-primary/10 text-text-main'
                                                            : 'border-white/10 bg-black/10 text-text-muted hover:border-white/20 hover:text-text-main'
                                                    }`}
                                                >
                                                    {count} 轮
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="mt-8 flex flex-wrap items-center gap-4">
                                        <button
                                            onClick={startMockInterview}
                                            disabled={isGeneratingMockQuestion}
                                            className="rounded-full bg-primary px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:bg-border disabled:text-text-muted"
                                        >
                                            {isGeneratingMockQuestion
                                                ? '正在生成第一题...'
                                                : '开始模拟面试'}
                                        </button>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <div className="rounded-[28px] border border-white/10 bg-black/20 p-5">
                                        <div className="flex items-center gap-3 text-text-main">
                                            <Gauge className="h-5 w-5 text-success" />
                                            <h2 className="text-lg font-medium">
                                                这一轮会更像真实面试
                                            </h2>
                                        </div>
                                        <div className="mt-4 space-y-3 text-sm leading-7 text-text-muted">
                                            <p>不是一次性把题给你，而是你答完一轮再继续追问。</p>
                                            <p>第一题通常会从自我介绍开始，后面逐步深挖项目和指标。</p>
                                            <p>结束后还是会给你总分和逐题反馈，方便你回头补强。</p>
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
                                            当前轮次
                                        </div>
                                        <div className="mt-2 text-3xl font-semibold">
                                            {sessionQuestions.length}/{mockQuestionCount}
                                        </div>
                                    </div>
                                    <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm leading-7 text-text-muted">
                                        面试官会根据你刚才的回答继续追问。越往后，问题通常会越具体。
                                    </div>

                                    <div className="mt-5 space-y-2">
                                        {sessionQuestions.map((question, index) => {
                                            const answered =
                                                answers[question.id]?.trim()
                                                    .length > 0

                                            return (
                                                <button
                                                    key={question.id}
                                                    onClick={() =>
                                                        setCurrentIndex(index)
                                                    }
                                                    className={`w-full rounded-2xl border p-3 text-left transition-colors ${
                                                        currentIndex === index
                                                            ? 'border-primary bg-primary/10'
                                                            : 'border-white/10 bg-black/10 hover:border-white/20'
                                                    }`}
                                                >
                                                    <div className="flex items-center justify-between gap-3">
                                                        <span className="text-sm font-medium">
                                                            第 {index + 1} 轮
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
                                                第 {currentIndex + 1} 轮
                                            </h2>
                                        </div>
                                        <div className="rounded-full border border-white/10 bg-black/20 px-4 py-2 text-sm text-text-muted">
                                            模拟面试
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
                                            你的回答
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
                                            placeholder="把它当作正式面试来答。先讲结论，再展开背景、动作、结果和取舍。"
                                            className="min-h-[260px] w-full rounded-[28px] border border-white/10 bg-[#0B0C11] p-5 text-base leading-7 text-text-main outline-none transition-colors placeholder:text-text-muted/70 focus:border-primary"
                                        />
                                    </div>

                                    <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                                        <div className="text-sm text-text-muted">
                                            当前字数：
                                            {(answers[currentQuestion.id] || '')
                                                .replace(/\s+/g, '').length}
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
                                                上一轮
                                            </button>
                                            {currentIndex <
                                            sessionQuestions.length - 1 ? (
                                                <button
                                                    onClick={() =>
                                                        setCurrentIndex(
                                                            (current) =>
                                                                Math.min(
                                                                    sessionQuestions.length -
                                                                        1,
                                                                    current + 1,
                                                                ),
                                                        )
                                                    }
                                                    className="rounded-full bg-primary px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-hover"
                                                >
                                                    看下一轮
                                                </button>
                                            ) : sessionQuestions.length <
                                              mockQuestionCount ? (
                                                <button
                                                    onClick={advanceMockInterview}
                                                    disabled={
                                                        isGeneratingMockQuestion ||
                                                        !answers[currentQuestion.id]?.trim()
                                                    }
                                                    className="rounded-full bg-primary px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:bg-border disabled:text-text-muted"
                                                >
                                                    {isGeneratingMockQuestion
                                                        ? '正在生成追问...'
                                                        : '继续追问'}
                                                </button>
                                            ) : (
                                                <button
                                                    onClick={submitSession}
                                                    disabled={isSubmitting}
                                                    className="rounded-full bg-success px-5 py-2 text-sm font-medium text-[#08110C] transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                                                >
                                                    {isSubmitting
                                                        ? '正在交卷...'
                                                        : '结束并评分'}
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </section>
                        )}

                        {result && (
                            <ResultPanel
                                title="模拟面试总分"
                                result={result}
                                onReset={resetSession}
                                onRetry={startMockInterview}
                                retryLabel="再来一轮模拟面试"
                                extraHint="这一轮是连续追问式模拟面试，不是公共题库刷题。下一轮会重新从开场自我介绍开始。"
                            />
                        )}
                    </>
                ) : activeMode === 'resume' ? (
                    resumeProfile ? (
                        <>
                            {sessionQuestions.length === 0 ? (
                                <section className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
                                    <div className="rounded-[32px] border border-white/10 bg-white/[0.04] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.32)] backdrop-blur">
                                        <div className="flex items-center gap-3 text-primary">
                                            <FileCheck2 className="h-5 w-5" />
                                            <span className="text-sm font-medium">
                                                简历定向题
                                            </span>
                                        </div>
                                        <div className="mt-5 rounded-[24px] border border-success/20 bg-success/10 p-4 text-sm leading-7 text-text-main/90">
                                            已读取你最近一次简历诊断。这一轮会按你的目标岗位、项目经历和当前短板来出题，更接近真实面试深挖。
                                        </div>

                                        <div className="mt-5 space-y-4">
                                            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                                                <div className="text-sm text-text-muted">当前目标岗位</div>
                                                <div className="mt-2 text-lg font-semibold">
                                                    {resumeProfile.targetRoleProfile?.company
                                                        ? `${resumeProfile.targetRoleProfile.title} · ${resumeProfile.targetRoleProfile.company}`
                                                        : resumeProfile.targetRoleProfile?.title || 'AI 产品经理'}
                                                </div>
                                            </div>
                                            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                                                <div className="text-sm text-text-muted">会优先追问的点</div>
                                                <div className="mt-3 space-y-2 text-sm leading-7 text-text-main/90">
                                                    {(resumeProfile.overallIssues.length > 0
                                                        ? resumeProfile.overallIssues
                                                        : ['项目结果表达不够具体', '岗位匹配说服力还可以更强']
                                                    ).slice(0, 3).map((item) => (
                                                        <p key={item}>{item}</p>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="mt-6">
                                            <div className="mb-3 text-sm font-medium">
                                                本轮题量
                                            </div>
                                            <div className="flex flex-wrap gap-3">
                                                {[5, 8, 10].map((count) => (
                                                    <button
                                                        key={count}
                                                        onClick={() => setResumeQuestionCount(count)}
                                                        className={`rounded-full border px-4 py-2 text-sm transition-colors ${
                                                            resumeQuestionCount === count
                                                                ? 'border-primary bg-primary/10 text-text-main'
                                                                : 'border-white/10 bg-black/10 text-text-muted hover:border-white/20 hover:text-text-main'
                                                        }`}
                                                    >
                                                        {count} 题
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="mt-8 flex flex-wrap items-center gap-4">
                                            <button
                                                onClick={startResumeSession}
                                                disabled={isGeneratingResumeSession}
                                                className="rounded-full bg-primary px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:bg-border disabled:text-text-muted"
                                            >
                                                {isGeneratingResumeSession
                                                    ? '正在生成定向题...'
                                                    : '开始这一轮定向题'}
                                            </button>
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <div className="rounded-[28px] border border-white/10 bg-black/20 p-5">
                                            <div className="flex items-center gap-3 text-text-main">
                                                <Gauge className="h-5 w-5 text-success" />
                                                <h2 className="text-lg font-medium">
                                                    这轮和公共题库有什么不同
                                                </h2>
                                            </div>
                                            <div className="mt-4 space-y-3 text-sm leading-7 text-text-muted">
                                                <p>会优先深挖你的项目经历，不再只是泛泛问概念。</p>
                                                <p>会贴着你要投的岗位，追问匹配度、结果和取舍。</p>
                                                <p>会针对简历短板补刀，更接近真实面试压力点。</p>
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
                                        <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm leading-7 text-text-muted">
                                            这轮题是根据你最近一次简历和目标岗位生成的。
                                        </div>

                                        <div className="mt-5 space-y-2">
                                            {sessionQuestions.map((question, index) => {
                                                const answered =
                                                    answers[question.id]?.trim()
                                                        .length > 0

                                                return (
                                                    <button
                                                        key={question.id}
                                                        onClick={() =>
                                                            setCurrentIndex(index)
                                                        }
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
                                                定向题 #{currentQuestion.index}
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
                                                placeholder="这轮建议你更像正式面试那样答，尽量把场景、判断、动作、结果讲完整。"
                                                className="min-h-[260px] w-full rounded-[28px] border border-white/10 bg-[#0B0C11] p-5 text-base leading-7 text-text-main outline-none transition-colors placeholder:text-text-muted/70 focus:border-primary"
                                            />
                                        </div>

                                        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                                            <div className="text-sm text-text-muted">
                                                这一题当前字数：
                                                {(answers[currentQuestion.id] || '')
                                                    .replace(/\s+/g, '').length}
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
                                                {currentIndex <
                                                sessionQuestions.length - 1 ? (
                                                    <button
                                                        onClick={() =>
                                                            setCurrentIndex(
                                                                (current) =>
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
                                <ResultPanel
                                    title="简历定向题总分"
                                    result={result}
                                    onReset={resetSession}
                                    onRetry={startResumeSession}
                                    retryLabel="再来一轮定向题"
                                    extraHint="这轮题目是根据你最近一次简历诊断生成的。如果你回去更新了简历，再来刷这一轮会更准。"
                                />
                            )}
                        </>
                    ) : (
                        <section className="rounded-[32px] border border-white/10 bg-white/[0.04] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.32)] backdrop-blur">
                            <div className="flex items-center gap-3 text-warning">
                                <LockKeyhole className="h-5 w-5" />
                                <span className="text-sm font-medium">
                                    还没有读到你的简历结果
                                </span>
                            </div>
                            <h2 className="mt-4 text-2xl font-semibold">
                                先去简历打磨跑一遍诊断
                            </h2>
                            <p className="mt-3 max-w-3xl text-sm leading-7 text-text-muted">
                                完成简历分析后，系统会自动把目标岗位、项目经历和薄弱点带到这里，再给你出一轮定向题。
                            </p>
                            <div className="mt-6">
                                <Link
                                    href="/resume"
                                    className="rounded-full bg-primary px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-hover"
                                >
                                    去做简历诊断
                                </Link>
                            </div>
                        </section>
                    )
                ) : marathonCompleted ? (
                    <>
                        {sessionQuestions.length === 0 ? (
                            <section className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
                                <div className="rounded-[32px] border border-white/10 bg-white/[0.04] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.32)] backdrop-blur">
                                    <div className="flex items-center gap-3 text-primary">
                                        <Sparkles className="h-5 w-5" />
                                        <span className="text-sm font-medium">
                                            抽卡式答题
                                        </span>
                                    </div>
                                    <div className="mt-5 rounded-[24px] border border-success/20 bg-success/10 p-4 text-sm leading-7 text-text-main/90">
                                        100 题全刷已完成。现在可以随机抽题，专门反复练你最薄弱的模块。
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
                                                onClick={() =>
                                                    setQuestionCount(item.count)
                                                }
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
                                                onClick={() =>
                                                    setSelectedCategories(
                                                        categories,
                                                    )
                                                }
                                                className="text-sm text-text-muted transition-colors hover:text-text-main"
                                            >
                                                全选
                                            </button>
                                        </div>
                                        <div className="flex flex-wrap gap-3">
                                            {categories.map((category) => {
                                                const active =
                                                    selectedCategories.includes(
                                                        category,
                                                    )

                                                return (
                                                    <button
                                                        key={category}
                                                        onClick={() =>
                                                            toggleCategory(
                                                                category,
                                                            )
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
                                                filteredBank.length <
                                                    questionCount
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
                                                抽卡模式适合干什么
                                            </h2>
                                        </div>
                                        <div className="mt-4 space-y-3 text-sm leading-7 text-text-muted">
                                            <p>把全刷里暴露出来的短板反复练熟。</p>
                                            <p>控制题量，更适合日常保持手感。</p>
                                            <p>你可以只抽最弱模块，不用每次都重刷 100 题。</p>
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
                                                answers[question.id]?.trim()
                                                    .length > 0

                                            return (
                                                <button
                                                    key={question.id}
                                                    onClick={() =>
                                                        setCurrentIndex(index)
                                                    }
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
                                                .replace(/\s+/g, '').length}
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
                                            {currentIndex <
                                            sessionQuestions.length - 1 ? (
                                                <button
                                                    onClick={() =>
                                                        setCurrentIndex(
                                                            (current) =>
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
                            <ResultPanel
                                title="抽卡模式总分"
                                result={result}
                                onReset={resetSession}
                                onRetry={startSession}
                                retryLabel="再抽一轮"
                            />
                        )}
                    </>
                ) : (
                    <section className="rounded-[32px] border border-white/10 bg-white/[0.04] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.32)] backdrop-blur">
                        <div className="flex items-center gap-3 text-warning">
                            <LockKeyhole className="h-5 w-5" />
                            <span className="text-sm font-medium">
                                抽卡模式暂未解锁
                            </span>
                        </div>
                        <h2 className="mt-4 text-2xl font-semibold">
                            先完成一轮 {marathonModeLabel}
                        </h2>
                        <p className="mt-3 max-w-3xl text-sm leading-7 text-text-muted">
                            你要先把 {totalQuestionsCountLabel}
                            完整交卷一次，系统才会开放抽卡式答题。这样做的目的是先把底图摸清楚，再去针对性补弱项。
                        </p>
                        <div className="mt-6">
                            <button
                                onClick={() => setActiveMode('marathon')}
                                className="rounded-full bg-primary px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-hover"
                            >
                                去刷 {totalQuestionsCountLabel}
                            </button>
                        </div>
                    </section>
                )}
            </div>
        </main>
    )
}
