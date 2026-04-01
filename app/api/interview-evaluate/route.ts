import { NextRequest, NextResponse } from 'next/server'

import { loadInterviewQuestionBank } from '@/lib/interview-question-bank'
import { evaluateInterviewSubmission } from '@/lib/interview-scoring'
import { InterviewAnswerInput } from '@/lib/interview-types'

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const answers = Array.isArray(body.answers)
            ? (body.answers as InterviewAnswerInput[])
            : []
        const elapsedSeconds =
            typeof body.elapsedSeconds === 'number' &&
            Number.isFinite(body.elapsedSeconds)
                ? Math.max(0, Math.round(body.elapsedSeconds))
                : 0

        const bank = await loadInterviewQuestionBank()
        const rawQuestionIds: unknown[] = Array.isArray(body.questionIds)
            ? body.questionIds
            : []
        const selectedIds = rawQuestionIds.filter(
            (item): item is string => typeof item === 'string',
        )

        const questions = bank.filter((item) => selectedIds.includes(item.id))

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
