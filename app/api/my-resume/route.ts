import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { aiBody, aiFailure, aiUser, inputText } from '@/lib/ai-route'
import { AIError, aiUsage } from '@/lib/ai-service'
import { readResumeProfile, saveResume, updateResumeProjects } from '@/lib/resume-projects'

export async function GET() {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: '请先登录' }, { status: 401 })
    try { return NextResponse.json({ profile: await readResumeProfile(user.username), usage: await aiUsage(user.username) }, { headers: { 'Cache-Control': 'no-store' } }) }
    catch (error) { return aiFailure(error) }
}
export async function PUT(request: Request) {
    try {
        const user = await aiUser(request)
        const body = await aiBody(request)
        if (!Number.isInteger(body.revision)) throw new AIError('简历版本无效')
        const profile = await saveResume(user, inputText(body.text, 20000, 30), body.revision as number)
        return NextResponse.json({ profile })
    } catch (error) { return aiFailure(error) }
}
export async function POST(request: Request) {
    try {
        const user = await aiUser(request)
        const body = await aiBody(request)
        return NextResponse.json(await updateResumeProjects(user, inputText(body.hash, 64)))
    } catch (error) { return aiFailure(error) }
}
