import type { Metadata } from 'next'

import { ProjectDeepDivePage } from '@/components/ProjectDeepDivePage'
import { loadProjectDeepDiveBanks } from '@/lib/interview-question-bank'

export const metadata: Metadata = {
    title: '张文婧项目深挖',
    description: '张文婧多个项目的面试深挖题，支持按项目切换查看。',
}

export default async function ZhangWenjingProjectPage() {
    const projects = await loadProjectDeepDiveBanks()

    return <ProjectDeepDivePage projects={projects} />
}
