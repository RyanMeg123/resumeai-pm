// 七层提问法：答题自检与 AI 分层点评共用（前后端都会引用，不能加 server-only）
export const LAYERS = [
    { name: '全景', hint: '先把流程或背景讲完整' },
    { name: '口径', hint: '把模糊的词定义清楚，如“成功”“有效”' },
    { name: '量化', hint: '给数字，不给形容词' },
    { name: '依据', hint: '数字和决定是怎么来的，和什么基线比' },
    { name: '取舍', hint: '目标冲突时保哪个，为什么' },
    { name: '卡点', hint: '做不到的卡在哪一层：人力、数据、成本、技术' },
    { name: '验证', hint: '怎么证明有效，替代了现有流程的哪一步' },
] as const

export const ANSWER_FORMAT = ['结论先行', '数据或案例', '标注事实还是估计', '对产品意味着什么']
export const MAX_FOLLOW_UPS = 3

export type LayerName = (typeof LAYERS)[number]['name']
export type LayerStatus = 'hit' | 'weak' | 'miss'
export interface LayerReview {
    coverage: Record<LayerName, LayerStatus>
    feedback: string
    followUp: { layer: LayerName; prompt: string } | null
}
export interface FollowUpRound { prompt: string; answer: string }

const STATUSES: readonly string[] = ['hit', 'weak', 'miss']
const isLayer = (value: unknown): value is LayerName => LAYERS.some((layer) => layer.name === value)

// AI 输出是不可信数据：结构不对就返回 null，前端退回纯文本展示（也兼容旧版点评记录）
export function parseLayerReview(content: string): LayerReview | null {
    let value: unknown
    try { value = JSON.parse(content) } catch { return null }
    if (!value || typeof value !== 'object') return null
    const { coverage, feedback, followUp } = value as Record<string, unknown>
    if (!coverage || typeof coverage !== 'object' || typeof feedback !== 'string') return null
    const entries = LAYERS.map((layer) => [layer.name, (coverage as Record<string, unknown>)[layer.name]] as const)
    if (entries.some(([, status]) => typeof status !== 'string' || !STATUSES.includes(status))) return null
    const next = followUp as { layer?: unknown; prompt?: unknown } | null | undefined
    return {
        coverage: Object.fromEntries(entries) as Record<LayerName, LayerStatus>,
        feedback,
        followUp: next && isLayer(next.layer) && typeof next.prompt === 'string' && next.prompt.trim() ? { layer: next.layer, prompt: next.prompt.trim() } : null,
    }
}

export function appendFollowUps(answer: string, rounds: FollowUpRound[]) {
    return [answer, ...rounds.map((round, index) => `【追问 ${index + 1}：${round.prompt}】\n${round.answer}`)].join('\n\n')
}

export const LAYER_REVIEW_PROMPT = `请按“七层提问法”检查这份回答，每层判定 hit（讲到且有证据）/ weak（提到但缺数字或依据）/ miss（没讲）：
${LAYERS.map((layer) => `- ${layer.name}：${layer.hint}`).join('\n')}
不是每道题都需要全部七层，与题目无关的层判 hit。回答里若有【追问 N：…】，是候选人对追问的补充，一并评估。
只返回 JSON：{"coverage":{${LAYERS.map((layer) => `"${layer.name}":"hit|weak|miss"`).join(',')}},"feedback":"切题程度、优点、缺失的证据、可执行改进，以及保留真实经历的改进示例；缺失数据用【待补充】","followUp":{"layer":"最弱且与题目最相关的一层","prompt":"面试官会问的一句追问"}}
所有层都 hit 时 followUp 为 null。`
