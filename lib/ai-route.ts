import 'server-only'
import { NextResponse } from 'next/server'
import { getCurrentUser, isSameOrigin } from './auth'
import { AIError } from './ai-service'

export async function aiUser(request: Request) {
    if (!isSameOrigin(request)) throw new AIError('请求来源无效', 403)
    const user = await getCurrentUser()
    if (!user) throw new AIError('请先登录，AI 记录会保存到你的账号', 401)
    return user
}
export async function aiBody(request: Request): Promise<Record<string, unknown>> {
    const text = await request.text()
    if (text.length > 80_000) throw new AIError('输入过长，请精简后再试', 413)
    let value: unknown
    try { value = JSON.parse(text) } catch { throw new AIError('请求格式无效') }
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new AIError('请求格式无效')
    return value as Record<string, unknown>
}
export function inputText(value: unknown, max: number, min = 1) {
    if (typeof value !== 'string' || value.trim().length < min || value.length > max) throw new AIError('输入内容为空或超过长度限制')
    return value.trim().replace(/\r\n/g, '\n')
}
export function aiFailure(error: unknown) {
    return NextResponse.json({ error: error instanceof AIError ? error.message : '记录保存或读取失败，请稍后重试；已有资料不会被覆盖' }, { status: error instanceof AIError ? error.status : 500 })
}
