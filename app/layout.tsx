import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
    title: {
        default: 'AI 产品经理练习工具',
        template: '%s | AI 产品经理练习工具',
    },
    description: '提供 AI 产品经理面试练习和简历打磨两套入口。',
}

export default function RootLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <html lang="zh-CN">
            <body suppressHydrationWarning>{children}</body>
        </html>
    )
}
