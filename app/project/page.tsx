import Link from 'next/link'
import { ProjectResumeEditor } from '@/components/ProjectResumeEditor'
import { readResumeProfile } from '@/lib/resume-projects'
import { aiUsage } from '@/lib/ai-service'
import { requireUser } from '@/lib/auth'
import { loadUserProjects } from '@/lib/user-projects'
import { ProjectPracticeClient } from '@/components/ProjectPracticeClient'

export default async function MyProjectPage() {
    const user = await requireUser()
    const { sets, guides } = await loadUserProjects(user)
    const profile = await readResumeProfile(user.username)
    const editor = <ProjectResumeEditor initial={profile} usage={await aiUsage(user.username)} />
    if (!sets.length) return <>{editor}<main className="min-h-dvh bg-bg-main px-6 py-16 text-text-main">
        <section className="mx-auto max-w-3xl rounded-[32px] border border-white/10 bg-white/[0.04] p-8">
            <p className="text-sm text-primary">{user.name}的项目深挖</p>
            <h1 className="mt-3 text-3xl font-semibold">等待补充你的简历</h1>
            <p className="mt-4 leading-7 text-text-muted">在上方粘贴或导入你的简历，点击“AI 分析并更新深挖”即可生成专属项目题目、参考答案和追问。</p>
            <Link href="/" className="mt-6 inline-block rounded-full bg-primary px-5 py-3 text-white">去公共练习场</Link>
        </section>
    </main></>
    return <>{editor}<ProjectPracticeClient key={`${user.username}:${profile.generated?.id ?? 'original'}`} personName={user.name} projectQuestionSets={sets} guides={guides} /></>
}
