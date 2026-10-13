import { NextResponse } from 'next/server'
import { requestAI } from '@/lib/ai-service'
import { aiBody, aiFailure, aiUser, inputText } from '@/lib/ai-route'

export async function POST(request: Request) {
    try {
        const user = await aiUser(request)
        const body = await aiBody(request)
        const result = await requestAI({ username: user.username, task: 'resume-workbench', system: inputText(body.system, 12000), prompt: inputText(body.prompt, 50000), maxTokens: typeof body.maxTokens === 'number' ? Math.min(6000, Math.max(256, Math.floor(body.maxTokens))) : 2048, json: body.json !== false, generate: body.generate === true })
        return NextResponse.json(result)
    } catch (error) { return aiFailure(error) }
}
