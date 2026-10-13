import type { Metadata } from 'next'
import './globals.css'
import { getCurrentUser } from '@/lib/auth'
import { PracticeAccount } from '@/components/PracticeAccount'

export const metadata: Metadata = {
    title: {
        default: 'AI 产品经理练习工具',
        template: '%s | AI 产品经理练习工具',
    },
    description: '提供 AI 产品经理面试练习和简历打磨两套入口。',
}

export default async function RootLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const user = await getCurrentUser()
    return (
        <html lang="zh-CN">
            <body suppressHydrationWarning><PracticeAccount key={user?.username ?? 'guest'} user={user}>{children}</PracticeAccount></body>
        </html>
    )
}
