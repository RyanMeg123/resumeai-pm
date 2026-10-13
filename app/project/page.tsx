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
            <h1 className="mt-3 text-3xl font-semibold">{profile.text ? '正在等待简历分析结果' : '先上传你的简历'}</h1>
            <p className="mt-4 leading-7 text-text-muted">{profile.text ? '分析完成后，这里会出现按你简历项目生成的深挖题、参考答案和追问。' : '在上方导入或粘贴简历，保存后会自动分析，生成你的专属项目深挖题。'}</p>
            <Link href="/" className="mt-6 inline-block rounded-full bg-primary px-5 py-3 text-white">去公共练习场</Link>
        </section>
    </main></>
    return <>{editor}<ProjectPracticeClient key={`${user.username}:${profile.generated?.id ?? 'original'}`} personName={user.name} projectQuestionSets={sets} guides={guides} /></>
}
