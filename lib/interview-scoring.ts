import { InterviewAnswerInput, InterviewEvaluation, InterviewQuestion, InterviewQuestionResult } from './interview-types'

const CATEGORY_KEYWORDS: Record<string, string[]> = {
    'AI 基础理解': [
        '模型',
        '大模型',
        '机器学习',
        '深度学习',
        '概率',
        'token',
        '参数',
        '稳定性',
    ],
    'RAG 与知识库': [
        'RAG',
        '检索',
        '召回',
        '知识库',
        '切分',
        'chunk',
        '索引',
        '重排',
    ],
    'Agent 与自动化': [
        'Agent',
        '多Agent',
        '子Agent',
        '工作流',
        '规划',
        '工具调用',
        '执行',
        '审计',
    ],
    '评测与指标': [
        '评测',
        '指标',
        '准确率',
        '召回率',
        'A/B',
        '延迟',
        '成本',
        '满意度',
    ],
    '产品设计题': [
        '用户',
        '场景',
        '流程',
        '交互',
        '引导',
        '首屏',
        '确认',
        '多轮',
    ],
    '商业与策略': [
        'ROI',
        '成本',
        '付费',
        '商业',
        '转化',
        '留存',
        '需求',
        '价值',
    ],
    '推进与协作': [
        '算法',
        '工程',
        '设计',
        '排期',
        '优先级',
        '推进',
        '协作',
        '预期',
    ],
    '风险与责任': [
        '安全',
        '隐私',
        '偏见',
        '合规',
        '复核',
        '免责声明',
        '责任',
        '风险',
    ],
    '过往经历与行为题': [
        '我',
        '当时',
        '背景',
        '行动',
        '结果',
        '复盘',
        '推进',
        '冲突',
    ],
    '趋势与判断': [
        '未来',
        '趋势',
        '判断',
        '开源',
        '闭源',
        '护城河',
        '多模态',
        '赛道',
    ],
}

const PRODUCT_KEYWORDS = [
    '用户',
    '场景',
    '目标',
    '痛点',
    '方案',
    '取舍',
    '指标',
    '验证',
    '上线',
    '迭代',
    '业务',
    '价值',
]

const ACTION_KEYWORDS = [
    '分析',
    '判断',
    '设计',
    '拆解',
    '定义',
    '推进',
    '协调',
    '评估',
    '验证',
    '优化',
    '复盘',
]

const TRADEOFF_KEYWORDS = [
    '但是',
    '同时',
    '不过',
    '取舍',
    '权衡',
    '风险',
    '限制',
    '边界',
]

function containsAny(text: string, keywords: string[]) {
    return keywords.filter((keyword) => text.includes(keyword))
}

function roundScore(score: number) {
    return Math.max(0, Math.min(100, Math.round(score)))
}

function scoreLength(answer: string) {
    const length = answer.replace(/\s+/g, '').length

    if (length >= 260) return 24
    if (length >= 180) return 20
    if (length >= 120) return 16
    if (length >= 80) return 11
    if (length >= 40) return 6
    return 2
}

function scoreCoverage(answer: string, category: string) {
    const categoryHits = containsAny(answer, CATEGORY_KEYWORDS[category] || [])
    const productHits = containsAny(answer, PRODUCT_KEYWORDS)
    const tradeoffHits = containsAny(answer, TRADEOFF_KEYWORDS)

    return {
        score: Math.min(26, categoryHits.length * 4 + productHits.length * 2 + tradeoffHits.length * 2),
        categoryHits,
        productHits,
        tradeoffHits,
    }
}

function scoreExecution(answer: string) {
    const actionHits = containsAny(answer, ACTION_KEYWORDS)
    const metricHits = answer.match(/(\d+%|\d+ms|\d+倍|\d+天|\d+周|\d+月|\d+个|\d+人|\d+万)/g) || []
    const structured =
        Number(answer.includes('背景')) +
        Number(answer.includes('目标')) +
        Number(answer.includes('方案')) +
        Number(answer.includes('结果'))

    return {
        score: Math.min(28, actionHits.length * 2 + metricHits.length * 4 + structured * 3),
        actionHits,
        metricHits,
        structured,
    }
}

function scoreClarity(answer: string) {
    const sentences = answer.split(/[。！？；\n]/).filter((item) => item.trim())
    const hasListFeel = /1\.|2\.|首先|其次|最后/.test(answer)
    const score = Math.min(22, sentences.length * 3 + (hasListFeel ? 4 : 0))

    return {
        score,
        sentences: sentences.length,
        hasListFeel,
    }
}

function evaluateSingleQuestion(
    question: InterviewQuestion,
    rawAnswer: string,
): InterviewQuestionResult {
    const answer = rawAnswer.trim()

    if (!answer) {
        return {
            questionId: question.id,
            category: question.category,
            prompt: question.prompt,
            answer: '',
            score: 0,
            verdict: 'weak',
            strengths: ['保留了空白题，方便你后续补答'],
            improvements: ['这题未作答，至少先写出场景、判断依据和结论'],
        }
    }

    const lengthScore = scoreLength(answer)
    const coverage = scoreCoverage(answer, question.category)
    const execution = scoreExecution(answer)
    const clarity = scoreClarity(answer)

    let score = lengthScore + coverage.score + execution.score + clarity.score

    if (answer.length < 60) {
        score -= 12
    }

    if (coverage.productHits.length === 0) {
        score -= 8
    }

    if (execution.metricHits.length === 0 && question.category !== '过往经历与行为题') {
        score -= 4
    }

    score = roundScore(score)

    const strengths: string[] = []
    const improvements: string[] = []

    if (coverage.categoryHits.length >= 2) {
        strengths.push('答题时有贴住这类题真正关心的点，没有只说空话')
    } else {
        improvements.push('还没有打到这类题的关键点，建议补上更具体的方法或判断标准')
    }

    if (execution.metricHits.length > 0) {
        strengths.push('有结果和数字，回答更像真实项目经验')
    } else {
        improvements.push('缺少结果和数字，建议补充效果、门槛或权衡依据')
    }

    if (clarity.sentences >= 3 || clarity.hasListFeel) {
        strengths.push('表达结构比较清楚，面试官更容易跟住你的思路')
    } else {
        improvements.push('结构还不够清楚，建议按“背景-方案-验证-结果”来讲')
    }

    if (coverage.tradeoffHits.length > 0) {
        strengths.push('体现了取舍和边界意识，不像背书式回答')
    } else {
        improvements.push('可以多讲一层取舍和风险，这会比单纯下结论更有说服力')
    }

    const verdict: InterviewQuestionResult['verdict'] =
        score >= 80 ? 'strong' : score >= 60 ? 'solid' : 'weak'

    return {
        questionId: question.id,
        category: question.category,
        prompt: question.prompt,
        answer,
        score,
        verdict,
        strengths: strengths.slice(0, 2),
        improvements: improvements.slice(0, 2),
    }
}

export function evaluateInterviewSubmission({
    questions,
    answers,
    elapsedSeconds,
}: {
    questions: InterviewQuestion[]
    answers: InterviewAnswerInput[]
    elapsedSeconds: number
}): InterviewEvaluation {
    const answerMap = new Map(
        answers.map((item) => [item.questionId, item.answer ?? '']),
    )

    const questionResults = questions.map((question) =>
        evaluateSingleQuestion(question, answerMap.get(question.id) || ''),
    )

    const answeredQuestions = questionResults.filter((item) => item.answer.trim()).length
    const completionRate =
        questions.length === 0 ? 0 : answeredQuestions / questions.length
    const overallScore = roundScore(
        questionResults.reduce((sum, item) => sum + item.score, 0) /
            Math.max(1, questions.length),
    )

    const categoryGroups = new Map<string, number[]>()
    for (const result of questionResults) {
        const current = categoryGroups.get(result.category) || []
        current.push(result.score)
        categoryGroups.set(result.category, current)
    }

    const categoryScores = Array.from(categoryGroups.entries())
        .map(([category, scores]) => ({
            category,
            score: roundScore(
                scores.reduce((sum, score) => sum + score, 0) /
                    Math.max(1, scores.length),
            ),
        }))
        .sort((a, b) => b.score - a.score)

    const strengths: string[] = []
    const nextActions: string[] = []

    if (completionRate === 1) {
        strengths.push('这次题目全部交卷了，完整度是合格的')
    } else {
        nextActions.push('先把空白题补齐，真实面试里空题会直接拉低整体印象')
    }

    if (overallScore >= 80) {
        strengths.push('整体回答已经有较强说服力，继续打磨细节就能上强度')
    } else if (overallScore >= 60) {
        strengths.push('基础已经有了，但还需要把回答从“能说”推到“能打动人”')
    } else {
        nextActions.push('先统一答题框架，避免每题都只停留在概念层')
    }

    const weakCount = questionResults.filter((item) => item.verdict === 'weak').length
    const strongCount = questionResults.filter((item) => item.verdict === 'strong').length

    if (strongCount >= Math.ceil(questions.length / 2)) {
        strengths.push('有一半以上题目表现稳，说明你的基本盘已经起来了')
    }

    if (weakCount > 0) {
        nextActions.push('优先重刷低分题，把“用户场景、方案取舍、结果数字”这三件事补齐')
    }

    const lowCategory = categoryScores[categoryScores.length - 1]
    if (lowCategory) {
        nextActions.push(`你当前最弱的是“${lowCategory.category}”，建议专门抽这个模块单练`)
    }

    return {
        overallScore,
        completionRate: roundScore(completionRate * 100),
        totalQuestions: questions.length,
        answeredQuestions,
        elapsedSeconds,
        strengths: strengths.slice(0, 3),
        nextActions: nextActions.slice(0, 4),
        categoryScores,
        questionResults,
    }
}
