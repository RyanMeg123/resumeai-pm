export interface InterviewQuestion {
    id: string
    index: number
    category: string
    prompt: string
    interviewerIntent?: string
    referenceAnswer?: string
    followUp?: string
    bank?: 'general' | 'project-deep-dive' | 'company'
}

export interface CompanyInterviewQuestion extends InterviewQuestion {
    companySlug: string
    sessionId: string
    questionKind: 'main' | 'follow_up' | 'interviewer_request'
    followUpOf?: string
    duplicateOf?: string
    sourceUrl: string
    sourceTitle: string
    sourceDateNote: string
}

export interface CompanyInterviewBank {
    slug: string
    title: string
    questionCount: number
    sessions: {
        id: string
        label: string
        questionCount: number
        interviewDate: string | null
        dateBasis: string
    }[]
    questions: CompanyInterviewQuestion[]
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

export interface ProjectQuestionSet {
    id: string
    person: string
    project: string
    questions: InterviewQuestion[]
    referenceAnswers: Record<string, string>
}

export interface InterviewGuide {
    id: string
    title: string
    content: string
}
