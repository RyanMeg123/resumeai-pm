import 'server-only'
import { assertDataLocks, contentHash, readData, writeData, withDataLock } from './ai-store'

export class AIError extends Error {
    constructor(message: string, public status = 400) { super(message) }
}
export interface AIRecord {
    id: string
    content: string
    createdAt: string
    model: string
    usage: { inputTokens: number; outputTokens: number }
}
interface Budget { total: number; users: Record<string, number> }
function limit(value: string | undefined, fallback: number) {
    const parsed = Number(value)
    return Number.isInteger(parsed) && parsed >= 0 && value !== undefined ? parsed : fallback
}
export async function aiUsage(username: string) {
    const date = new Date().toISOString().slice(0, 10)
    const ledger = await readData<Budget>(`usage/${date}.json`) ?? { total: 0, users: {} }
    return { used: ledger.users[username] ?? 0, limit: limit(process.env.AI_DAILY_USER_LIMIT, 20), totalUsed: ledger.total, totalLimit: limit(process.env.AI_DAILY_TOTAL_LIMIT, 60) }
}

export async function requestAI(input: {
    username: string; task: string; system: string; prompt: string; maxTokens: number
    json?: boolean; shared?: boolean; generate: boolean
}): Promise<{ record: AIRecord | null; cached: boolean }> {
    const model = process.env.AIHUBMIX_MODEL || 'gemini-3.1-flash-lite'
    const id = contentHash({ version: 1, scope: input.shared ? 'public-reference' : input.username, task: input.task, model, system: input.system, prompt: input.prompt, maxTokens: input.maxTokens, json: Boolean(input.json) })
    const file = `ai-cache/${id}.json`
    const cached = await readData<AIRecord>(file)
    if (cached) return { record: cached, cached: true }
    if (!input.generate) return { record: null, cached: false }
    return withDataLock(`ai:${id}`, async () => {
        const saved = await readData<AIRecord>(file)
        if (saved) return { record: saved, cached: true }
        const failure = await readData<{ at: number }>(`ai-failures/${id}.json`)
        if (failure && Date.now() - failure.at < 60_000) throw new AIError('刚才的请求失败，请一分钟后手动重试；系统不会自动重复扣费', 429)
        const apiKey = process.env.AIHUBMIX_API_KEY
        if (!apiKey) throw new AIError('AI 服务尚未配置，请联系管理员', 503)
        await withDataLock('ai-budget', async () => {
            const date = new Date().toISOString().slice(0, 10)
            const ledger = await readData<Budget>(`usage/${date}.json`) ?? { total: 0, users: {} }
            if ((ledger.users[input.username] ?? 0) >= limit(process.env.AI_DAILY_USER_LIMIT, 20) || ledger.total >= limit(process.env.AI_DAILY_TOTAL_LIMIT, 60)) {
                throw new AIError('今日新生成额度已用完，已保存的内容仍可查看', 429)
            }
            ledger.total += 1
            ledger.users[input.username] = (ledger.users[input.username] ?? 0) + 1
            // Reserve before sending; failed upstream requests can still incur charges.
            await writeData(`usage/${date}.json`, ledger)
        })
        try {
            let endpoint = 'https://aihubmix.com/v1/chat/completions'
            if (process.env.AI_TEST_ENDPOINT && process.env.NODE_ENV !== 'production') {
                const testUrl = new URL(process.env.AI_TEST_ENDPOINT)
                if (!['127.0.0.1', 'localhost'].includes(testUrl.hostname)) throw new AIError('测试服务必须在本机', 500)
                endpoint = testUrl.href
            }
            await assertDataLocks()
            const response = await fetch(endpoint, {
                method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
                body: JSON.stringify({ model, messages: [{ role: 'system', content: input.system }, { role: 'user', content: input.prompt }], temperature: 0.2, max_tokens: input.maxTokens, ...(input.json ? { response_format: { type: 'json_object' } } : {}) }),
                signal: AbortSignal.timeout(90_000),
            })
            if (!response.ok) throw new AIError(response.status === 401 ? 'AI 服务密钥无效，请联系管理员' : `AI 服务暂时失败（${response.status}），未自动重试`, 502)
            const payload = await response.json()
            const content = payload.choices?.[0]?.message?.content
            if (typeof content !== 'string' || !content.trim() || payload.choices?.[0]?.finish_reason === 'length') throw new AIError('AI 返回不完整，旧记录已保留；可稍后重试', 502)
            if (input.json) { try { JSON.parse(content) } catch { throw new AIError('AI 返回格式无效，旧记录已保留', 502) } }
            const record: AIRecord = { id, content, createdAt: new Date().toISOString(), model, usage: { inputTokens: Number(payload.usage?.prompt_tokens) || 0, outputTokens: Number(payload.usage?.completion_tokens) || 0 } }
            await writeData(file, record)
            return { record, cached: false }
        } catch (error) {
            await writeData(`ai-failures/${id}.json`, { at: Date.now() })
            if (error instanceof AIError) throw error
            throw new AIError('AI 请求未完成，未自动重试；请稍后再试', 502)
        }
    })
}
