/** @format */

import React, { useState, useRef } from 'react'
import Link from 'next/link'
import { UploadCloud, CheckCircle } from 'lucide-react'
import { TargetRoleProfile } from '@/lib/types'

export function UploadView({
    onAnalyze,
}: {
    onAnalyze: (
        text: string,
        targetRole: TargetRoleProfile,
        sourceFile?: File | null,
    ) => Promise<boolean>
}) {
    const [isDragging, setIsDragging] = useState(false)
    const [text, setText] = useState('')
    const [targetTitle, setTargetTitle] = useState('')
    const [targetCompany, setTargetCompany] = useState('')
    const [targetJobDescription, setTargetJobDescription] = useState('')
    const [loading, setLoading] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)

    const buildTargetRoleProfile = (): TargetRoleProfile | null => {
        const profile = {
            title: targetTitle.trim(),
            company: targetCompany.trim(),
            jobDescription: targetJobDescription.trim(),
        }

        if (!profile.title) {
            alert('请先填写目标岗位，再开始分析')
            return null
        }

        return profile
    }

    const handleFile = async (file: File) => {
        const targetRoleProfile = buildTargetRoleProfile()
        if (!targetRoleProfile) {
            return
        }

        setLoading(true)
        try {
            const fileName = file.name.toLowerCase()
            if (
                !fileName.endsWith('.pdf') &&
                !fileName.endsWith('.docx') &&
                !fileName.endsWith('.txt')
            ) {
                alert('仅支持 PDF / Word(.docx) / TXT 格式')
                setLoading(false)
                return
            }

            const formData = new FormData()
            formData.append('file', file)

            const response = await fetch('/api/extract-text', {
                method: 'POST',
                body: formData,
            })

            const result = await response.json()

            if (!response.ok) {
                alert(result.error || '解析失败，请重试或直接粘贴文本')
                setLoading(false)
                return
            }

            if (!result.text?.trim()) {
                alert('文件内容为空或暂时无法解析')
                return
            }

            await onAnalyze(
                result.text,
                targetRoleProfile,
                fileName.endsWith('.docx') ? file : null,
            )
        } catch (e) {
            console.error(e)
            alert('解析失败，请重试或直接粘贴文本')
        } finally {
            setLoading(false)
        }
    }

    const handleTextAnalyze = async () => {
        if (!text.trim()) return

        const targetRoleProfile = buildTargetRoleProfile()
        if (!targetRoleProfile) {
            return
        }

        setLoading(true)
        try {
            await onAnalyze(text, targetRoleProfile, null)
        } finally {
            setLoading(false)
        }
    }

    const onDrop = (e: React.DragEvent) => {
        e.preventDefault()
        setIsDragging(false)
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            handleFile(e.dataTransfer.files[0])
        }
    }

    return (
        <div className="max-w-4xl mx-auto pt-20 px-6">
            <div className="text-center mb-12">
                <h1 className="text-4xl font-bold mb-4 text-text-main">
                    AI产品经理简历打磨
                </h1>
                <p className="text-text-muted text-lg mb-8">
                    专为AI PM打造，深度优化模型评估、数据策略与算法协作经历
                </p>
                <div className="mb-8 flex justify-center">
                    <Link
                        href="/"
                        className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-5 py-2 text-sm font-medium text-text-main transition-colors hover:bg-primary/20"
                    >
                        去首页刷 AI PM 面试题
                    </Link>
                </div>
                <div className="flex justify-center gap-8 text-sm text-text-muted">
                    <div className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-success" />{' '}
                        AI全链路梳理
                    </div>
                    <div className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-success" />{' '}
                        模型指标量化
                    </div>
                    <div className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-success" /> AI
                        PM关键词注入
                    </div>
                </div>
            </div>

            <div className="bg-bg-card border border-border rounded-2xl p-6 mb-8">
                <div className="mb-4">
                    <h2 className="text-xl font-bold text-text-main mb-2">
                        目标岗位
                    </h2>
                    <p className="text-sm text-text-muted leading-relaxed">
                        先告诉我你要投什么岗位。后面的诊断和改写会优先贴着这个岗位来做，不再只给你通用版本。
                    </p>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                    <div>
                        <label
                            htmlFor="target-title"
                            className="block text-sm font-medium text-text-main mb-2"
                        >
                            岗位名称
                        </label>
                        <input
                            id="target-title"
                            value={targetTitle}
                            onChange={(e) => setTargetTitle(e.target.value)}
                            placeholder="例如：AI 产品经理 / AI PM"
                            className="w-full bg-bg-main border border-border rounded-xl px-4 py-3 text-text-main focus:outline-none focus:border-primary"
                        />
                        <p className="mt-2 text-xs text-text-muted">
                            这是必填项，系统会按这个岗位来判断你的简历缺什么。
                        </p>
                    </div>
                    <div>
                        <label
                            htmlFor="target-company"
                            className="block text-sm font-medium text-text-main mb-2"
                        >
                            目标公司
                        </label>
                        <input
                            id="target-company"
                            value={targetCompany}
                            onChange={(e) => setTargetCompany(e.target.value)}
                            placeholder="例如：字节 / 阿里 / 某家创业公司"
                            className="w-full bg-bg-main border border-border rounded-xl px-4 py-3 text-text-main focus:outline-none focus:border-primary"
                        />
                        <p className="mt-2 text-xs text-text-muted">
                            不填也能分析；填了之后，改写会更贴近具体公司口味。
                        </p>
                    </div>
                </div>
                <div className="mt-4">
                    <label
                        htmlFor="target-job-description"
                        className="block text-sm font-medium text-text-main mb-2"
                    >
                        岗位描述
                    </label>
                    <textarea
                        id="target-job-description"
                        value={targetJobDescription}
                        onChange={(e) => setTargetJobDescription(e.target.value)}
                        placeholder="把岗位描述贴进来，系统会优先参考里面的关键词、职责和要求。"
                        className="w-full h-32 bg-bg-main border border-border rounded-xl p-4 text-text-main focus:outline-none focus:border-primary resize-none"
                    ></textarea>
                </div>
            </div>

            <div
                className={`border-2 border-dashed rounded-2xl p-12 text-center transition-colors ${
                    isDragging
                        ? 'border-primary bg-primary/5'
                        : 'border-border bg-bg-card'
                }`}
                onDragOver={(e) => {
                    e.preventDefault()
                    setIsDragging(true)
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={onDrop}
            >
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-8">
                        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
                        <p className="text-text-main text-lg">
                            正在解析你的简历…
                        </p>
                    </div>
                ) : (
                    <>
                        <UploadCloud className="w-16 h-16 text-primary mx-auto mb-6" />
                        <h3 className="text-xl font-medium text-text-main mb-2">
                            拖拽简历文件到此处，或点击上传
                        </h3>
                        <p className="text-text-muted mb-6">
                            支持 PDF / Word(.docx) / TXT 格式
                        </p>
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            className="bg-primary hover:bg-primary-hover text-white px-8 py-3 rounded-lg font-medium transition-colors"
                        >
                            选择文件
                        </button>
                        <input
                            type="file"
                            ref={fileInputRef}
                            className="hidden"
                            accept=".pdf,.docx,.txt"
                            onChange={(e) =>
                                e.target.files?.[0] &&
                                handleFile(e.target.files[0])
                            }
                        />
                    </>
                )}
            </div>

            {!loading && (
                <div className="mt-8">
                    <div className="flex items-center gap-4 mb-4">
                        <div className="h-px bg-border flex-1"></div>
                        <span className="text-text-muted text-sm">
                            或直接粘贴文本
                        </span>
                        <div className="h-px bg-border flex-1"></div>
                    </div>
                    <textarea
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        placeholder="在此粘贴你的简历文本..."
                        className="w-full h-48 bg-bg-card border border-border rounded-xl p-4 text-text-main focus:outline-none focus:border-primary resize-none"
                    ></textarea>
                    <button
                        onClick={handleTextAnalyze}
                        disabled={!text.trim()}
                        className="w-full mt-4 bg-primary hover:bg-primary-hover disabled:bg-border disabled:text-text-muted text-white py-3 rounded-lg font-medium transition-colors"
                    >
                        开始AI分析
                    </button>
                </div>
            )}
        </div>
    )
}
