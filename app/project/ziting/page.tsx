import type { Metadata } from 'next'

import { ProjectPracticeClient } from '@/components/ProjectPracticeClient'
import { loadInterviewGuides, loadProjectQuestionBank } from '@/lib/project-question-bank'

export const metadata: Metadata = {
    title: '子婷项目深挖',
    description: '鄂子婷的 AI 产品经理项目面试深挖练习。',
}

export default async function ZitingProjectPage() {
    const [allSets, guides] = await Promise.all([
        loadProjectQuestionBank(),
        loadInterviewGuides('鄂子婷'),
    ])
    const zitingSets = allSets.filter((set) => set.person === '鄂子婷')

    return (
        <ProjectPracticeClient
            personName="子婷"
            projectQuestionSets={zitingSets}
            guides={guides}
        />
    )
}
