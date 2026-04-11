import type { Metadata } from 'next'

import { InterviewPracticeClient } from '@/components/InterviewPracticeClient'
import { loadInterviewQuestionBank } from '@/lib/interview-question-bank'

export const metadata: Metadata = {
    title: 'AI 产品经理面试练习场',
    description: '刷 AI 产品经理高频题，交卷后查看总分、模块得分和逐题反馈。',
}

export default async function Home() {
    const allQuestions = await loadInterviewQuestionBank()

    return <InterviewPracticeClient allQuestions={allQuestions} />
}
