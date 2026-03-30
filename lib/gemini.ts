/** @format */

import { ResumeData, Project } from './types'
import { getAiPmRequirementsPrompt } from './ai-pm-requirements'

const AIHUBMIX_API_KEY = 'sk-GrHV0pBLBOBV7ii3A34110CeAf484bC29d65CaA13c1e7e15'
const AIHUBMIX_URL = 'https://aihubmix.com/v1/chat/completions'
const AI_PM_REQUIREMENTS_PROMPT = getAiPmRequirementsPrompt()

const AI_PM_SYSTEM_PROMPT = `你是一名资深 AI 产品经理招聘顾问和简历重构专家。

你的判断标准不是泛泛的“产品经理”，而是当前市场上 AI 产品经理岗位普遍看重的能力。你在分析和改写项目经历时，必须优先检查并突出以下维度：
1. 是否真的定义过 AI 场景，而不是只做普通功能。
2. 是否说明了目标用户、使用场景、核心痛点和业务目标。
3. 是否体现了 AI 方案设计能力，例如大模型应用、Prompt 设计、RAG/知识库、Agent/工作流、多模态、模型选型、规则与模型协同、人机协同。
4. 是否体现了数据与评测闭环，例如标注、评测集、效果评估、反馈回流、A/B 测试、上线后监控。
5. 是否体现了产品基本功，例如需求调研、竞品分析、PRD/原型、路线图、跨团队推动、上线落地、迭代优化。
6. 是否体现了业务结果，例如转化率、留存率、渗透率、使用率、效率提升、成本下降、时延、准确率、采纳率、ROI。
7. 是否体现了对 AI 边界的理解，例如幻觉、稳定性、成本、时延、可解释性、合规与安全。

你必须特别识别两类常见候选人，并给出有针对性的重构：
- 如果原文更像程序员转产品：不要堆技术栈、框架名和开发细节，要把经历翻译成“用户问题是什么、为什么要做、产品怎么定义、方案怎么取舍、如何验证效果、带来什么业务结果”。
- 如果原文更像传统产品经理转 AI：不要只写需求、流程和协调，要补出“AI 为什么适合这个场景、模型能力与限制是什么、如何做 Prompt/RAG/评测/数据反馈、如何定义 AI 指标和上线门槛”。

你还必须把下面这 20 条市场高频岗位要求当成固定检查清单。分析问题、重写项目、补建议时，都要尽可能对齐这 20 条要求：
${AI_PM_REQUIREMENTS_PROMPT}

写作规则：
- 全部输出必须使用简体中文。
- 严禁编造不存在的经历、结果、模型、数据或指标。
- 如果原文缺少关键数据，可以用明确占位符，例如【建议补充：准确率/转化率/时延/渗透率】。
- 简历语言要专业、克制、像真实候选人，不要空泛，不要喊口号。
- 项目描述优先使用“负责/主导/设计/定义/推进/搭建/优化/验证/落地”等动词。
- 每条建议都要尽量具体、可执行，指出缺了什么、为什么缺、应该怎么补。`

function createJsonMessages(prompt: string) {
    return [
        { role: 'system', content: AI_PM_SYSTEM_PROMPT },
        { role: 'user', content: prompt },
    ]
}

type JsonObject = Record<string, unknown>

function isObject(value: unknown): value is JsonObject {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isNonEmptyString(value: unknown): value is string {
    return typeof value === 'string' && value.trim().length > 0
}

function createTimeoutGuard(timeoutMs: number) {
    let timeoutId: ReturnType<typeof setTimeout> | undefined

    const promise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => {
            reject(new Error('AI 请求超时，请重试'))
        }, timeoutMs)
    })

    return {
        promise,
        cleanup: () => {
            if (timeoutId) {
                clearTimeout(timeoutId)
            }
        },
    }
}

async function requestJsonCompletion<T>({
    prompt,
    maxTokens,
    timeoutMs,
    maxAttempts,
    validate,
}: {
    prompt: string
    maxTokens: number
    timeoutMs: number
    maxAttempts: number
    validate: (value: unknown) => T
}): Promise<T> {
    let lastError: unknown = null

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        const retryPrompt =
            attempt === 1
                ? prompt
                : `${prompt}\n\n上一次返回不符合要求。请重新输出，并严格确保：\n1. 只返回 JSON 对象。\n2. 不要返回空 projects。\n3. 所有字段都使用简体中文。`
        const { promise: timeoutPromise, cleanup } = createTimeoutGuard(timeoutMs)

        try {
            const response = (await Promise.race([
                fetch(AIHUBMIX_URL, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${AIHUBMIX_API_KEY}`,
                    },
                    body: JSON.stringify({
                        model: 'gemini-3.1-flash-lite-preview',
                        messages: createJsonMessages(retryPrompt),
                        temperature: 0,
                        max_tokens: maxTokens,
                        response_format: { type: 'json_object' },
                    }),
                }),
                timeoutPromise,
            ])) as Response

            if (!response.ok) {
                const err = await response.text()
                console.error('AIHubMix API Error:', err)
                throw new Error(`API Error: ${response.status}`)
            }

            const payload = await response.json()
            const responseText = payload.choices?.[0]?.message?.content

            if (!isNonEmptyString(responseText)) {
                throw new Error('AI 返回为空')
            }

            const parsed = JSON.parse(responseText)
            return validate(parsed)
        } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error))
            console.error(
                `AI completion attempt ${attempt} failed:`,
                lastError,
            )
        } finally {
            cleanup()
        }
    }

    throw lastError instanceof Error
        ? lastError
        : new Error('AI 返回了无效数据')
}

async function requestJsonCompletionSafe<T>({
    fallback,
    ...options
}: {
    prompt: string
    maxTokens: number
    timeoutMs: number
    maxAttempts: number
    validate: (value: unknown) => T
    fallback: T
}): Promise<T> {
    try {
        return await requestJsonCompletion(options)
    } catch (error) {
        console.warn('AI completion fallback triggered:', error)
        return fallback
    }
}

function normalizeResumeData(value: unknown): ResumeData {
    if (!isObject(value)) {
        throw new Error('简历数据格式不正确')
    }

    const rawProjects = Array.isArray(value.projects) ? value.projects : []
    const projects = rawProjects
        .filter(isObject)
        .map((project, index) => {
            const scores = isObject(project.scores) ? project.scores : {}

            return {
                id:
                    (isNonEmptyString(project.id) && project.id) ||
                    `project-${index}-${Date.now()}`,
                name:
                    (isNonEmptyString(project.name) && project.name.trim()) ||
                    `项目 ${index + 1}`,
                role:
                    (isNonEmptyString(project.role) && project.role.trim()) ||
                    '未注明角色',
                duration:
                    (isNonEmptyString(project.duration) &&
                        project.duration.trim()) ||
                    '未注明时间',
                original:
                    (isNonEmptyString(project.original) &&
                        project.original.trim()) ||
                    '',
                scores: {
                    pm:
                        typeof scores.pm === 'number' && Number.isFinite(scores.pm)
                            ? scores.pm
                            : 0,
                    quantify:
                        typeof scores.quantify === 'number' &&
                        Number.isFinite(scores.quantify)
                            ? scores.quantify
                            : 0,
                    star:
                        typeof scores.star === 'number' &&
                        Number.isFinite(scores.star)
                            ? scores.star
                            : 0,
                    keywords:
                        typeof scores.keywords === 'number' &&
                        Number.isFinite(scores.keywords)
                            ? scores.keywords
                            : 0,
                },
                issues: Array.isArray(project.issues)
                    ? project.issues.filter(isNonEmptyString)
                    : [],
            }
        })
        .filter(
            (project) =>
                project.original.trim().length > 0 || project.name.trim().length > 0,
        )

    if (projects.length === 0) {
        throw new Error('未提取到任何项目经历')
    }

    return {
        name: isNonEmptyString(value.name) ? value.name.trim() : '候选人',
        education: Array.isArray(value.education)
            ? value.education
                  .filter(isObject)
                  .map((item) => ({
                      school: isNonEmptyString(item.school)
                          ? item.school.trim()
                          : '',
                      major: isNonEmptyString(item.major)
                          ? item.major.trim()
                          : '',
                      year: isNonEmptyString(item.year) ? item.year.trim() : '',
                  }))
            : [],
        projects,
        overallScore:
            typeof value.overallScore === 'number' &&
            Number.isFinite(value.overallScore)
                ? value.overallScore
                : 0,
        overallIssues: Array.isArray(value.overallIssues)
            ? value.overallIssues.filter(isNonEmptyString)
            : [],
    }
}

function normalizeProjectVersions(value: unknown): {
    concise: string
    detailed: string
    datadriven: string
} {
    if (!isObject(value)) {
        throw new Error('项目改写结果格式不正确')
    }

    const concise = isNonEmptyString(value.concise) ? value.concise.trim() : ''
    const detailed = isNonEmptyString(value.detailed) ? value.detailed.trim() : ''
    const datadriven = isNonEmptyString(value.datadriven)
        ? value.datadriven.trim()
        : ''

    if (!concise || !detailed || !datadriven) {
        throw new Error('项目改写结果不完整')
    }

    return { concise, detailed, datadriven }
}

export async function parseResume(text: string): Promise<ResumeData> {
    const prompt = `请分析下面这份简历，并只提取“项目经历、包含项目内容的工作经历、与产品相关的核心实践”。

你的任务不是简单摘要，而是站在 AI 产品经理招聘视角做诊断。请按以下标准打分和指出问题：
- PM相关度：是否体现需求洞察、产品定义、方案设计、跨团队推进、上线迭代。
- 量化程度：是否有业务结果、效率结果、模型效果、成本收益等数字。
- STAR结构：是否说清背景、任务、动作、结果，是否能看出候选人的真实贡献。
- 关键词覆盖：是否覆盖 AI 产品经理常见关注点，例如大模型、Prompt、RAG、Agent、评测、数据闭环、A/B测试、留存、转化、时延、准确率、人机协同、策略优化等。

请特别识别候选人的表达偏向：
- 若明显偏工程表达，请指出它“技术重、产品轻”的问题。
- 若明显偏传统产品表达，请指出它“产品重、AI理解轻”的问题。

你在判断时，必须同时参考这 20 条 AI 产品经理市场要求，并尽量让 issues 对应这些要求中的缺口：
${AI_PM_REQUIREMENTS_PROMPT}

输出要求：
- 所有 extracted text、issues、evaluations、JSON values 都必须使用简体中文。
- issues 必须具体、能落到修改动作，不能只写空泛判断。
- 如果项目原文不完整，也要尽量保留原始信息，不要补造。

简历原文如下：
${text}

请严格返回一个 JSON 对象，必须符合以下 schema：
{
  "name": "Candidate Name",
  "education": [{ "school": "...", "major": "...", "year": "..." }],
  "projects": [
    {
      "id": "unique-string-id",
      "name": "Project Name",
      "role": "Role in project",
      "duration": "Time period",
      "original": "The exact original text of the project description",
      "scores": {
        "pm": 0-100,
        "quantify": 0-100,
        "star": 0-100,
        "keywords": 0-100
      },
      "issues": ["Specific AI/PM issue 1 (e.g., Lack of model evaluation metrics, missing data strategy)", "Specific issue 2"]
    }
  ],
  "overallScore": 0-100,
  "overallIssues": ["Overall AI PM resume issue 1 (e.g., Needs more focus on AI feature design or algorithm collaboration)", "Overall issue 2", "Overall issue 3"]
}`

    return requestJsonCompletion({
        prompt,
        maxTokens: 4096,
        timeoutMs: 45000,
        maxAttempts: 3,
        validate: normalizeResumeData,
    })
}

export async function optimizeProject(
    project: Project,
): Promise<{ concise: string; detailed: string; datadriven: string }> {
    const prompt = `请把下面这段项目经历，重写成适合 AI 产品经理求职的 3 个版本。

项目名称：${project.name}
角色：${project.role}
原始描述：${project.original}

重写目标：
1. 让经历更符合市场对 AI 产品经理的期待，而不是普通产品经理或工程师简历。
2. 突出需求洞察、产品定义、AI 场景拆解、方案设计、跨团队推进、上线验证、结果复盘。
3. 如果原文偏工程，要翻译成产品语言；如果原文偏传统产品，要补足 AI 理解与评测/数据闭环视角。
4. 不要编造事实；没有数据就用占位符，例如【建议补充：模型准确率/采纳率/转化率/时延】。
5. 输出要像真实简历，不要写成咨询报告或面试回答。

改写时必须显式参考下面这 20 条 AI 产品经理岗位要求，优先补足当前项目最缺的那几条：
${AI_PM_REQUIREMENTS_PROMPT}

三个版本要求：
- concise：适合直接放进简历，压缩但有重点，3到4行，突出场景、动作、结果。
- detailed：严格按 STAR 组织，但仍然要像简历项目经历，不要写成长篇故事。
- datadriven：优先强化结果、指标、评测、上线效果、效率收益、业务收益，缺失处用占位符提醒。

请严格返回一个 JSON 对象，必须符合以下 schema：
{
  "concise": "A concise 3-4 line version highlighting core AI actions and business results.",
  "detailed": "A detailed version strictly following the STAR (Situation, Task, Action, Result) format, detailing the AI lifecycle.",
  "datadriven": "A version that maximizes quantitative expression (e.g., model accuracy, latency, DAU, ROI), adding placeholders for missing metrics."
}`

    return requestJsonCompletionSafe({
        prompt,
        maxTokens: 2048,
        timeoutMs: 45000,
        maxAttempts: 3,
        validate: normalizeProjectVersions,
        fallback: {
            concise: 'AI 生成失败，请重试。',
            detailed: 'AI 生成失败，请重试。',
            datadriven: 'AI 生成失败，请重试。',
        },
    })
}

export async function* refineProjectStream(
    currentText: string,
    userRequest: string,
) {
    const prompt = `用户想继续微调一段项目经历，让它更符合 AI 产品经理岗位。

当前版本：
${currentText}

用户要求：
${userRequest}

请只输出“修改后的项目描述正文”，不要输出解释、标题、前后缀。

修改原则：
- 继续保持 AI 产品经理视角，优先强化场景、用户、方案、协作、评测、数据闭环和结果。
- 不要编造不存在的数据和经历。
- 如果用户想突出技术背景，要改成“懂技术的产品经理”表达，而不是工程实现堆砌。
- 如果用户想突出产品背景，要补足 AI 相关的方法论与判断依据，而不是只写需求管理。
- 必须结合下面这 20 条 AI 产品经理岗位要求，优先补当前版本里缺失最明显的要求：
${AI_PM_REQUIREMENTS_PROMPT}
- 保持简历语言，必须用简体中文。`

    const response = await fetch(AIHUBMIX_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${AIHUBMIX_API_KEY}`,
        },
        body: JSON.stringify({
            model: 'gemini-3.1-flash-lite-preview',
            messages: createJsonMessages(prompt),
            stream: true,
        }),
    })

    if (!response.ok) {
        const err = await response.text()
        console.error('AIHubMix API Error:', err)
        throw new Error(`API Error: ${response.status}`)
    }

    const reader = response.body?.getReader()
    const decoder = new TextDecoder('utf-8')

    if (!reader) return

    let buffer = ''
    while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')

        // Keep the last incomplete line in the buffer
        buffer = lines.pop() || ''

        for (const line of lines) {
            const trimmedLine = line.trim()
            if (
                trimmedLine.startsWith('data: ') &&
                trimmedLine !== 'data: [DONE]'
            ) {
                try {
                    const data = JSON.parse(trimmedLine.slice(6))
                    const content = data.choices[0]?.delta?.content
                    if (content) {
                        yield content
                    }
                } catch (e) {
                    // Ignore parse errors on incomplete chunks
                }
            }
        }
    }
}
