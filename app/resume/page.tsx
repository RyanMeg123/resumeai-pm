import type { Metadata } from 'next'

import { ResumeWorkbenchPage } from '@/components/ResumeWorkbenchPage'

export const metadata: Metadata = {
    title: 'AI 产品经理简历打磨',
    description: '上传简历并结合目标岗位，生成更贴近 AI 产品经理岗位的优化建议。',
}

export default function ResumePage() {
    return <ResumeWorkbenchPage />
}
