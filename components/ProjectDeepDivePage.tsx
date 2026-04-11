'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import {
    ArrowLeft,
    FileCheck2,
    FolderKanban,
    Gauge,
    ListChecks,
} from 'lucide-react'

import { ProjectDeepDiveBank } from '@/lib/interview-types'

function formatRichText(value: string) {
    return value.replace(/\*\*(.*?)\*\*/g, '$1').trim()
}

export function ProjectDeepDivePage({
    projects,
}: {
    projects: ProjectDeepDiveBank[]
}) {
    const [activeProjectSlug, setActiveProjectSlug] = useState(
        projects[0]?.slug ?? '',
    )
    const [activeCategory, setActiveCategory] = useState('')
    const activeProject = useMemo(
        () =>
            projects.find((project) => project.slug === activeProjectSlug) ??
            projects[0],
        [activeProjectSlug, projects],
    )
    const categories = useMemo(
        () =>
            activeProject
                ? Array.from(
                      new Set(activeProject.questions.map((item) => item.category)),
                  )
                : [],
        [activeProject],
    )
    const resolvedActiveCategory = categories.includes(activeCategory)
        ? activeCategory
        : (categories[0] ?? '')

    const activeQuestions = useMemo(
        () =>
            (activeProject?.questions ?? []).filter(
                (question) => question.category === resolvedActiveCategory,
            ),
        [activeProject, resolvedActiveCategory],
    )

    return (
        <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(77,126,255,0.18),_transparent_32%),radial-gradient(circle_at_top_right,_rgba(52,211,153,0.14),_transparent_28%),linear-gradient(180deg,_#0E0F14_0%,_#090A0E_100%)] text-text-main">
            <div className="mx-auto max-w-7xl px-6 py-8 md:px-10">
                <div className="mb-8">
                    <Link
                        href="/"
                        className="mb-4 inline-flex items-center gap-2 text-sm text-text-muted transition-colors hover:text-text-main"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        返回通用面试练习场
                    </Link>
                    <h1 className="text-3xl font-semibold tracking-tight md:text-5xl">
                        张文婧项目深挖
                    </h1>
                    <p className="mt-3 max-w-4xl text-sm leading-7 text-text-muted md:text-base">
                        这是单独页面，不和现在的通用题库混在一起。你放在
                        `interview-questions`
                        目录里的项目题库，会在这里按项目切换展示。
                    </p>
                </div>

                <section className="mb-8 rounded-[30px] border border-white/10 bg-white/[0.04] p-5 backdrop-blur">
                    <div className="mb-4 flex items-center gap-3 text-text-main">
                        <FolderKanban className="h-5 w-5 text-primary" />
                        <h2 className="text-lg font-medium">项目切换</h2>
                    </div>
                    <div className="flex flex-wrap gap-3">
                        {projects.map((project) => (
                            <button
                                key={project.slug}
                                onClick={() => setActiveProjectSlug(project.slug)}
                                className={`rounded-full border px-4 py-2 text-sm transition-colors ${
                                    activeProject?.slug === project.slug
                                        ? 'border-primary bg-primary/10 text-text-main'
                                        : 'border-white/10 bg-black/20 text-text-muted hover:border-white/20 hover:text-text-main'
                                }`}
                            >
                                {project.shortTitle} {project.questionCount}题
                            </button>
                        ))}
                    </div>
                </section>

                <section className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
                    <div className="rounded-[32px] border border-white/10 bg-white/[0.04] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.32)] backdrop-blur">
                        <div className="flex items-center gap-3 text-primary">
                            <FileCheck2 className="h-5 w-5" />
                            <span className="text-sm font-medium">
                                项目专项题库
                            </span>
                        </div>
                        <div className="mt-5 grid gap-4 md:grid-cols-3">
                            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                                <div className="text-sm text-text-muted">
                                    总题量
                                </div>
                                <div className="mt-2 text-3xl font-semibold">
                                    {activeProject?.questionCount ?? 0}
                                </div>
                                <div className="mt-2 text-sm text-text-muted">
                                    一题不漏，全部来自当前项目原文件
                                </div>
                            </div>
                            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                                <div className="text-sm text-text-muted">
                                    分类数
                                </div>
                                <div className="mt-2 text-3xl font-semibold">
                                    {categories.length}
                                </div>
                                <div className="mt-2 text-sm text-text-muted">
                                    按项目背景到反思迭代分组
                                </div>
                            </div>
                            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                                <div className="text-sm text-text-muted">
                                    页面内容
                                </div>
                                <div className="mt-2 text-3xl font-semibold">
                                    当前项目
                                </div>
                                <div className="mt-2 text-sm text-text-muted">
                                    题目、意图、答案、追问都在
                                </div>
                            </div>
                        </div>

                        {activeProject && (
                            <div className="mt-6 rounded-[24px] border border-white/10 bg-black/20 p-5">
                                <div className="text-sm font-medium text-text-main">
                                    当前项目
                                </div>
                                <div className="mt-2 text-xl font-semibold">
                                    {activeProject.shortTitle}
                                </div>
                                <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-text-muted">
                                    {activeProject.summary}
                                </p>
                                <div className="mt-3 text-xs text-text-muted">
                                    来源文件：{activeProject.fileName}
                                </div>
                            </div>
                        )}

                        <div className="mt-8 rounded-[28px] border border-primary/20 bg-primary/10 p-5 text-sm leading-7 text-text-main/90">
                            这页更适合做项目面试准备。建议先按分类顺着看一轮，再挑高频题反复口头演练，把参考答案压缩成你自己的 2 到 3 分钟版本。
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="rounded-[28px] border border-white/10 bg-black/20 p-5">
                            <div className="flex items-center gap-3 text-text-main">
                                <Gauge className="h-5 w-5 text-success" />
                                <h2 className="text-lg font-medium">
                                    这一页能直接怎么用
                                </h2>
                            </div>
                            <div className="mt-4 space-y-3 text-sm leading-7 text-text-muted">
                                <p>先挑一个分类，把题目和参考答案完整过一遍。</p>
                                <p>再按自己的经历重讲一版，不要照着答案背。</p>
                                <p>最后看“可能追问”，补齐容易被继续深挖的点。</p>
                            </div>
                        </div>

                        <div className="rounded-[28px] border border-white/10 bg-black/20 p-5">
                            <div className="flex items-center gap-3 text-text-main">
                                <ListChecks className="h-5 w-5 text-primary" />
                                <h2 className="text-lg font-medium">
                                    分类切换
                                </h2>
                            </div>
                            <div className="mt-4 text-sm leading-7 text-text-muted">
                                顶部点分类就能切换。每个分类里都按原文件顺序展示，方便你和文档逐题核对。
                            </div>
                        </div>
                    </div>
                </section>

                <section className="mt-8 rounded-[30px] border border-white/10 bg-white/[0.04] p-5 backdrop-blur">
                    <div className="mb-4 text-sm text-text-muted">分类导航</div>
                    <div className="flex flex-wrap gap-3">
                        {categories.map((category) => {
                            const count = (activeProject?.questions ?? []).filter(
                                (question) => question.category === category,
                            ).length

                            return (
                                <button
                                    key={category}
                                    onClick={() => setActiveCategory(category)}
                                    className={`rounded-full border px-4 py-2 text-sm transition-colors ${
                                        resolvedActiveCategory === category
                                            ? 'border-primary bg-primary/10 text-text-main'
                                            : 'border-white/10 bg-black/20 text-text-muted hover:border-white/20 hover:text-text-main'
                                    }`}
                                >
                                    {category} {count}题
                                </button>
                            )
                        })}
                    </div>
                </section>

                <section className="mt-8 space-y-5">
                    {activeQuestions.map((question) => (
                        <article
                            key={question.id}
                            className="rounded-[32px] border border-white/10 bg-white/[0.04] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.24)] backdrop-blur"
                        >
                            <div className="flex flex-wrap items-center justify-between gap-3">
                                <div className="text-sm text-primary">
                                    {question.category}
                                </div>
                                <div className="rounded-full border border-white/10 bg-black/20 px-4 py-2 text-sm text-text-muted">
                                    项目题 #{question.index}
                                </div>
                            </div>

                            <h2 className="mt-4 text-2xl font-semibold leading-9">
                                {question.prompt}
                            </h2>

                            {question.interviewerIntent && (
                                <div className="mt-6 rounded-[24px] border border-primary/20 bg-primary/10 p-5">
                                    <div className="text-sm font-medium text-primary">
                                        面试官意图
                                    </div>
                                    <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-text-main/90">
                                        {formatRichText(question.interviewerIntent)}
                                    </p>
                                </div>
                            )}

                            {question.referenceAnswer && (
                                <div className="mt-5 rounded-[24px] border border-success/20 bg-success/10 p-5">
                                    <div className="text-sm font-medium text-success">
                                        参考答案
                                    </div>
                                    <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-text-main/90">
                                        {formatRichText(question.referenceAnswer)}
                                    </p>
                                </div>
                            )}

                            {question.followUp && (
                                <div className="mt-5 rounded-[24px] border border-white/10 bg-black/20 p-5">
                                    <div className="text-sm font-medium text-text-main">
                                        可能追问
                                    </div>
                                    <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-text-muted">
                                        {formatRichText(question.followUp)}
                                    </p>
                                </div>
                            )}
                        </article>
                    ))}
                </section>
            </div>
        </main>
    )
}
