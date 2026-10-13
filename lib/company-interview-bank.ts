import 'server-only'

import bytedance from '@/interview-questions/companies/bytedance.json'
import tencent from '@/interview-questions/companies/tencent.json'
import liAuto from '@/interview-questions/companies/li-auto.json'
import futu from '@/interview-questions/companies/futu.json'
import meituan from '@/interview-questions/companies/meituan.json'
import type { CompanyInterviewBank, CompanyInterviewQuestion } from './interview-types'

// Topic labels reuse the existing practice rubric; these are editorial labels,
// not claims about the original interviewer's grading criteria.
function questionCategory(prompt: string): string {
    const rules: [RegExp, string][] = [
        [/隐私|风险管理|安全|事故|泄露|合规|错误答案/, '风险与责任'],
        [/RAG|知识库|业务知识|检索/, 'RAG 与知识库'],
        [/Agent|工作流|工具调用/, 'Agent 与自动化'],
        [/评测|指标|A\/B|实验|准确|失败样本|归因|数据分析/, '评测与指标'],
        [/商业|盈利|付费|收费|投入产出|PMF|转化|成交|增长|获客|留存/, '商业与策略'],
        [/团队|分工|协作|优先级|交付|标注|目标转化|执行步骤/, '推进与协作'],
        [/未来|进展|生态|壁垒|竞争|差异化|论文|关注.*模型/, '趋势与判断'],
        [/模型|token|微调|学习|提示词|推理|AI产品经理.*职责/, 'AI 基础理解'],
        [/背景|经历|实习|项目|职业|个人|贡献|为什么.*选择|为什么.*加入|为什么.*腾讯|请介绍|表达|术语|SQL|Python/, '过往经历与行为题'],
    ]
    return rules.find(([pattern]) => pattern.test(prompt))?.[1] ?? '产品设计题'
}

type RawBank = typeof bytedance

function makeBank(raw: RawBank): CompanyInterviewBank {
    const questions: CompanyInterviewQuestion[] = raw.questions.map((item) => {
        const source = raw.sources.find((source) => source.id === item.source_id)
        const kind = item.question_kind
        if (!source || !raw.sessions.some((session) => session.id === item.session_id)
            || !['main', 'follow_up', 'interviewer_request'].includes(kind)) {
            throw new Error(`公司题库来源或段落无效：${raw.company_slug}`)
        }
        return {
            id: item.id,
            index: item.index,
            prompt: item.prompt,
            category: questionCategory(item.prompt),
            bank: 'company',
            companySlug: raw.company_slug,
            sessionId: item.session_id,
            questionKind: kind as CompanyInterviewQuestion['questionKind'],
            followUpOf: 'follow_up_of' in item ? String(item.follow_up_of) : undefined,
            duplicateOf: 'duplicate_of' in item ? String(item.duplicate_of) : undefined,
            sourceUrl: source.url,
            sourceTitle: source.title,
            sourceDateNote: source.date_note,
        }
    })
    const ids = new Set(questions.map((question) => question.id))
    if (questions.length !== raw.question_count || ids.size !== questions.length
        || questions.some((question, index) => question.index !== index + 1
            || (question.followUpOf && !ids.has(question.followUpOf))
            || (question.duplicateOf && !ids.has(question.duplicateOf)))) {
        throw new Error(`公司题库数量或题号无效：${raw.company_slug}`)
    }
    return {
        slug: raw.company_slug,
        title: raw.company_name,
        questionCount: questions.length,
        sessions: raw.sessions.map((session) => ({
            id: session.id,
            label: session.label,
            questionCount: session.question_count,
            interviewDate: session.interview_date,
            dateBasis: session.date_basis,
        })),
        questions,
    }
}

const banks = [bytedance, tencent, liAuto, futu, meituan].map((raw) => makeBank(raw as RawBank))

export function loadCompanyInterviewBanks(): CompanyInterviewBank[] {
    return banks
}

export function loadCompanyInterviewBank(slug: string): CompanyInterviewBank | undefined {
    return banks.find((bank) => bank.slug === slug)
}
