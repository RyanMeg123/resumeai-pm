/** @format */

'use client'

import React, { useState } from 'react'
import { UploadView } from '@/components/UploadView'
import { DashboardView } from '@/components/DashboardView'
import { SummaryView } from '@/components/SummaryView'
import { parseResume } from '@/lib/gemini'
import { ResumeData, Project, TargetRoleProfile } from '@/lib/types'

export function ResumeWorkbenchPage() {
    const [step, setStep] = useState<'upload' | 'dashboard' | 'summary'>(
        'upload',
    )
    const [resumeData, setResumeData] = useState<ResumeData | null>(null)
    const [sourceDocxFile, setSourceDocxFile] = useState<File | null>(null)
    const [originalResumeText, setOriginalResumeText] = useState('')
    const [targetRoleProfile, setTargetRoleProfile] =
        useState<TargetRoleProfile | null>(null)

    const handleAnalyze = async (
        text: string,
        targetRole: TargetRoleProfile,
        sourceFile?: File | null,
    ): Promise<boolean> => {
        try {
            const data = await parseResume(text, targetRole)
            if (!data.projects || data.projects.length === 0) {
                alert('未检测到项目经历，请手动粘贴项目描述')
                return false
            }

            data.projects = data.projects.map((p, i) => ({
                ...p,
                id: p.id || `project-${i}-${Date.now()}`,
            }))

            setSourceDocxFile(sourceFile || null)
            setOriginalResumeText(text)
            setTargetRoleProfile(targetRole)
            setResumeData(data)
            setStep('dashboard')
            return true
        } catch (e) {
            console.error(e)
            alert('解析失败，请重试')
            return false
        }
    }

    const handleUpdateProject = (
        projectId: string,
        updates: Partial<Project>,
    ) => {
        setResumeData((prev) => {
            if (!prev) return prev
            return {
                ...prev,
                projects: prev.projects.map((p) =>
                    p.id === projectId ? { ...p, ...updates } : p,
                ),
            }
        })
    }

    return (
        <main className="min-h-screen bg-bg-main text-text-main font-sans">
            {step === 'upload' && <UploadView onAnalyze={handleAnalyze} />}
            {step === 'dashboard' && resumeData && (
                <DashboardView
                    data={resumeData}
                    targetRoleProfile={targetRoleProfile}
                    onUpdateProject={handleUpdateProject}
                    onFinish={() => setStep('summary')}
                />
            )}
            {step === 'summary' && resumeData && (
                <SummaryView
                    data={resumeData}
                    onBack={() => setStep('dashboard')}
                    sourceDocxFile={sourceDocxFile}
                    originalResumeText={originalResumeText}
                    targetRoleProfile={targetRoleProfile}
                />
            )}
        </main>
    )
}
