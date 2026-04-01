export interface InterviewQuestion {
    id: string
    index: number
    category: string
    prompt: string
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
