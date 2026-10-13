import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser, isSameOrigin } from '@/lib/auth'
import { loadUserProjects } from '@/lib/user-projects'

import { loadInterviewQuestionBank } from '@/lib/interview-question-bank'
import { loadCompanyInterviewBank } from '@/lib/company-interview-bank'
import { evaluateInterviewSubmission } from '@/lib/interview-scoring'
import { InterviewAnswerInput, InterviewQuestion } from '@/lib/interview-types'

function normalizeQuestions(value: unknown): InterviewQuestion[] {
    if (!Array.isArray(value)) {
        return []
    }

    return value
        .map((item, index) => {
            if (
                typeof item !== 'object' ||
                item === null ||
                typeof (item as InterviewQuestion).prompt !== 'string' ||
                typeof (item as InterviewQuestion).category !== 'string'
            ) {
                return null
            }

            const question = item as InterviewQuestion

            return {
                id:
                    typeof question.id === 'string' && question.id.trim()
                        ? question.id
                        : `custom-q-${index + 1}`,
                index:
                    typeof question.index === 'number' &&
                    Number.isFinite(question.index)
                        ? question.index
                        : index + 1,
                category: question.category,
                prompt: question.prompt,
            }
        })
        .filter((item): item is InterviewQuestion => Boolean(item))
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const answers: InterviewAnswerInput[] = Array.isArray(body.answers)
            ? body.answers.filter((item: unknown): item is InterviewAnswerInput =>
                typeof item === 'object' && item !== null
                && typeof (item as InterviewAnswerInput).questionId === 'string'
                && typeof (item as InterviewAnswerInput).answer === 'string')
            : []
        const elapsedSeconds =
            typeof body.elapsedSeconds === 'number' &&
            Number.isFinite(body.elapsedSeconds)
                ? Math.max(0, Math.round(body.elapsedSeconds))
                : 0

        const rawQuestionIds: unknown[] = Array.isArray(body.questionIds)
            ? body.questionIds
            : []
        const selectedIds = rawQuestionIds.filter(
            (item): item is string => typeof item === 'string',
        )

        let questions: InterviewQuestion[]
        if (body.projectSetId !== undefined) {
            if (!isSameOrigin(request)) return NextResponse.json({ error: '请求来源无效' }, { status: 403 })
            const user = await getCurrentUser()
            if (!user) return NextResponse.json({ error: '登录已过期，请重新登录；回答会保留' }, { status: 401 })
            const { sets } = await loadUserProjects(user)
            const set = sets.find((item) => item.id === body.projectSetId)
            if (!set) return NextResponse.json({ error: '无权访问该项目' }, { status: 403 })
            const byId = new Map(set.questions.map((question) => [question.id, question]))
            if (selectedIds.some((id) => !byId.has(id))) return NextResponse.json({ error: '项目题目无效' }, { status: 400 })
            questions = [...new Set(selectedIds)].map((id) => byId.get(id)!)
        } else if (body.companySlug !== undefined) {
            const companyBank = typeof body.companySlug === 'string'
                ? loadCompanyInterviewBank(body.companySlug) : undefined
            if (!companyBank) {
                return NextResponse.json({ error: '公司题库不存在，请刷新后重试' }, { status: 400 })
            }
            const allowedIds = new Set(companyBank.questions.map((question) => question.id))
            if (selectedIds.some((id) => !allowedIds.has(id))) {
                return NextResponse.json({ error: '提交的题目不属于当前公司，请刷新后重试' }, { status: 400 })
            }
            questions = companyBank.questions.filter((question) => selectedIds.includes(question.id))
        } else {
            const bank = await loadInterviewQuestionBank()
            const customQuestions = normalizeQuestions(body.questions)
            questions = customQuestions.length > 0
                ? customQuestions : bank.filter((item) => selectedIds.includes(item.id))
        }

        if (questions.length === 0) {
            return NextResponse.json(
                { error: '没有收到有效题目，无法交卷' },
                { status: 400 },
            )
        }

        const evaluation = evaluateInterviewSubmission({
            questions,
            answers,
            elapsedSeconds,
        })

        return NextResponse.json(evaluation)
    } catch (error) {
        console.error('Interview evaluation failed:', error)
        return NextResponse.json(
            { error: '交卷失败，请稍后重试' },
            { status: 500 },
        )
    }
}
