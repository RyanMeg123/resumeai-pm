import type { Metadata } from 'next'

import { ProjectPracticeClient } from '@/components/ProjectPracticeClient'
import { loadInterviewGuides, loadProjectQuestionBank } from '@/lib/project-question-bank'

export const metadata: Metadata = {
    title: '文婧项目深挖',
    description: '张文婧的 AI 产品经理项目面试深挖练习。',
}

export default async function WenjingProjectPage() {
    const [allSets, guides] = await Promise.all([
        loadProjectQuestionBank(),
        loadInterviewGuides('张文婧'),
    ])
    const wenjingSets = allSets.filter((set) => set.person === '张文婧')

    return (
        <ProjectPracticeClient
            personName="文婧"
            projectQuestionSets={wenjingSets}
            guides={guides}
        />
    )
}
