/** @format */

import React, { useState, useRef } from 'react'
import { UploadCloud, CheckCircle } from 'lucide-react'

export function UploadView({
    onAnalyze,
}: {
    onAnalyze: (text: string, sourceFile?: File | null) => Promise<boolean>
}) {
    const [isDragging, setIsDragging] = useState(false)
    const [text, setText] = useState('')
    const [loading, setLoading] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)

    const handleFile = async (file: File) => {
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

            await onAnalyze(result.text, fileName.endsWith('.docx') ? file : null)
        } catch (e) {
            console.error(e)
            alert('解析失败，请重试或直接粘贴文本')
        } finally {
            setLoading(false)
        }
    }

    const handleTextAnalyze = async () => {
        if (!text.trim()) return

        setLoading(true)
        try {
            await onAnalyze(text, null)
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
