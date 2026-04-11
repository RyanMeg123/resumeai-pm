export interface InterviewQuestion {
    id: string
    index: number
    category: string
    prompt: string
    interviewerIntent?: string
    referenceAnswer?: string
    followUp?: string
    bank?: 'general' | 'project-deep-dive'
}

export interface ProjectDeepDiveBank {
    slug: string
    fileName: string
    title: string
    shortTitle: string
    summary: string
    questionCount: number
    questions: InterviewQuestion[]
}

export interface InterviewAnswerInput {
    questionId: string
    answer: string
}

export interface InterviewQuestionResult {
    questionId: string
    category: string
    prompt: string
    answer: string
    score: number
    verdict: 'strong' | 'solid' | 'weak'
    strengths: string[]
    improvements: string[]
}

export interface InterviewCategoryScore {
    category: string
    score: number
}

export interface InterviewEvaluation {
    overallScore: number
    completionRate: number
    totalQuestions: number
    answeredQuestions: number
    elapsedSeconds: number
    strengths: string[]
    nextActions: string[]
    categoryScores: InterviewCategoryScore[]
    questionResults: InterviewQuestionResult[]
}
