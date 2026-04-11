import type { Metadata } from 'next'

import { ProjectPracticeClient } from '@/components/ProjectPracticeClient'
import { loadProjectQuestionBank } from '@/lib/project-question-bank'

export const metadata: Metadata = {
    title: '文婧项目深挖',
    description: '张文婧的 AI 产品经理项目面试深挖练习。',
}

export default async function WenjingProjectPage() {
    const allSets = await loadProjectQuestionBank()
    const wenjingSets = allSets.filter((set) => set.person === '张文婧')

    return (
        <ProjectPracticeClient
            personName="文婧"
            projectQuestionSets={wenjingSets}
        />
    )
}
