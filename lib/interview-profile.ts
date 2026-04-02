import { TargetRoleProfile } from './types'

export const RESUME_INTERVIEW_PROFILE_STORAGE_KEY =
    'resumeai-pm-interview-profile'

export interface ResumeInterviewProfile {
    name: string
    targetRoleProfile: TargetRoleProfile | null
    overallIssues: string[]
    selectedProjects: Array<{
        name: string
        role: string
        duration: string
        text: string
    }>
    updatedAt: string
}
