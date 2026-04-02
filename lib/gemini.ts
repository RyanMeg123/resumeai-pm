/** @format */

import {
    FullResumeDraft,
    ResumeData,
    Project,
    TargetRoleProfile,
} from './types'
import { getAiPmRequirementsPrompt } from './ai-pm-requirements'
import { InterviewQuestion } from './interview-types'
import { ResumeInterviewProfile } from './interview-profile'

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

function normalizeFullResumeDraft(value: unknown): FullResumeDraft {
    if (!isObject(value)) {
        throw new Error('整份简历草稿格式不正确')
    }

    const title = isNonEmptyString(value.title) ? value.title.trim() : ''
    const summary = isNonEmptyString(value.summary) ? value.summary.trim() : ''
    const fullText = isNonEmptyString(value.fullText)
        ? value.fullText.trim()
        : ''
    const highlights = Array.isArray(value.highlights)
        ? value.highlights.filter(isNonEmptyString).map((item) => item.trim())
        : []

    if (!title || !summary || !fullText || highlights.length === 0) {
        throw new Error('整份简历草稿内容不完整')
    }

    return {
        title,
        summary,
        highlights: highlights.slice(0, 5),
        fullText,
    }
}

function normalizeGeneratedInterviewQuestions(value: unknown): InterviewQuestion[] {
    if (!isObject(value) || !Array.isArray(value.questions)) {
        throw new Error('定向题目格式不正确')
    }

    const questions = value.questions
        .filter(isObject)
        .map((item, index) => ({
            id:
                (isNonEmptyString(item.id) && item.id.trim()) ||
                `resume-q-${index + 1}`,
            index:
                typeof item.index === 'number' && Number.isFinite(item.index)
                    ? item.index
                    : index + 1,
            category:
                (isNonEmptyString(item.category) && item.category.trim()) ||
                '过往经历与行为题',
            prompt:
                (isNonEmptyString(item.prompt) && item.prompt.trim()) ||
                '',
        }))
        .filter((item) => item.prompt)

    if (questions.length === 0) {
        throw new Error('定向题目为空')
    }

    return questions.map((item, index) => ({
        ...item,
        id: item.id || `resume-q-${index + 1}`,
        index: index + 1,
    }))
}

function normalizeGeneratedInterviewQuestion(value: unknown): InterviewQuestion {
    if (!isObject(value)) {
        throw new Error('模拟面试问题格式不正确')
    }

    const prompt = isNonEmptyString(value.prompt) ? value.prompt.trim() : ''
    const category = isNonEmptyString(value.category)
        ? value.category.trim()
        : '过往经历与行为题'

    if (!prompt) {
        throw new Error('模拟面试问题为空')
    }

    return {
        id:
            (isNonEmptyString(value.id) && value.id.trim()) ||
            `mock-q-${Date.now()}`,
        index:
            typeof value.index === 'number' && Number.isFinite(value.index)
                ? value.index
                : 1,
        category,
        prompt,
    }
}

function buildTargetRolePrompt(targetRole?: TargetRoleProfile | null) {
    if (!targetRole?.title?.trim()) {
        return '当前没有提供目标岗位信息，请按通用 AI 产品经理岗位标准来分析。'
    }

    const lines = [`- 目标岗位：${targetRole.title.trim()}`]

    if (targetRole.company.trim()) {
        lines.push(`- 目标公司：${targetRole.company.trim()}`)
    }

    if (targetRole.jobDescription.trim()) {
        lines.push(`- 岗位描述：${targetRole.jobDescription.trim()}`)
    }

    lines.push(
        '- 你的分析、改写和补充建议都要优先贴这份目标岗位，而不是只做通用润色。',
    )

    return lines.join('\n')
}

function buildFallbackFullResumeDraft({
    resumeData,
    selectedProjects,
    targetRole,
}: {
    resumeData: ResumeData
    selectedProjects: Array<{
        name: string
        role: string
        duration: string
        text: string
    }>
    targetRole?: TargetRoleProfile | null
}): FullResumeDraft {
    const title = targetRole?.title?.trim()
        ? `${targetRole.title.trim()}定向简历草稿`
        : 'AI 产品经理简历草稿'

    const summary = `已按当前目标岗位整理出一版整份简历草稿。你可以先直接使用这版，再补充更细的数字、结果和岗位关键词。`

    const highlights = [
        '已把你锁定的项目版本合并进整份简历草稿',
        targetRole?.title?.trim()
            ? `内容会优先贴近“${targetRole.title.trim()}”岗位`
            : '内容按通用 AI 产品经理岗位标准整理',
        '没有明确数据的地方，建议再补一轮结果和指标',
    ]

    const projectText = selectedProjects
        .map(
            (project) =>
                `【${project.name}】\n${project.role} | ${project.duration}\n${project.text}`,
        )
        .join('\n\n')

    const educationText =
        resumeData.education.length > 0
            ? resumeData.education
                  .map(
                      (item) =>
                          `${item.school}${
                              item.major ? ` · ${item.major}` : ''
                          }${item.year ? ` · ${item.year}` : ''}`,
                  )
                  .join('\n')
            : '【建议补充：教育经历】'

    return {
        title,
        summary,
        highlights,
        fullText: `姓名：${resumeData.name}\n求职方向：${
            targetRole?.title?.trim() || 'AI 产品经理'
        }\n\n个人概述：\n${summary}\n\n项目经历：\n${
            projectText || '【建议补充：核心项目经历】'
        }\n\n教育经历：\n${educationText}`,
    }
}

export async function parseResume(
    text: string,
    targetRole?: TargetRoleProfile | null,
): Promise<ResumeData> {
    const prompt = `请分析下面这份简历，并只提取“项目经历、包含项目内容的工作经历、与产品相关的核心实践”。

本次求职目标如下：
${buildTargetRolePrompt(targetRole)}

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
    targetRole?: TargetRoleProfile | null,
): Promise<{ concise: string; detailed: string; datadriven: string }> {
    const prompt = `请把下面这段项目经历，重写成适合 AI 产品经理求职的 3 个版本。

本次求职目标如下：
${buildTargetRolePrompt(targetRole)}

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
    targetRole?: TargetRoleProfile | null,
) {
    const prompt = `用户想继续微调一段项目经历，让它更符合 AI 产品经理岗位。

本次求职目标如下：
${buildTargetRolePrompt(targetRole)}

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

export async function generateFullResumeDraft({
    resumeData,
    originalResumeText,
    selectedProjects,
    targetRole,
}: {
    resumeData: ResumeData
    originalResumeText: string
    selectedProjects: Array<{
        name: string
        role: string
        duration: string
        text: string
    }>
    targetRole?: TargetRoleProfile | null
}): Promise<FullResumeDraft> {
    const selectedProjectText = selectedProjects
        .map(
            (project, index) => `项目 ${index + 1}：
名称：${project.name}
角色：${project.role}
时间：${project.duration}
确认版内容：
${project.text}`,
        )
        .join('\n\n')

    const educationText =
        resumeData.education.length > 0
            ? resumeData.education
                  .map(
                      (item, index) =>
                          `${index + 1}. ${item.school}${
                              item.major ? `，${item.major}` : ''
                          }${item.year ? `，${item.year}` : ''}`,
                  )
                  .join('\n')
            : '暂无明确教育信息'

    const fallback = buildFallbackFullResumeDraft({
        resumeData,
        selectedProjects,
        targetRole,
    })

    const prompt = `请基于下面这些信息，输出一份“整份简历草稿”，用于 AI 产品经理岗位投递。

本次求职目标如下：
${buildTargetRolePrompt(targetRole)}

候选人姓名：${resumeData.name}

教育信息：
${educationText}

整体简历诊断里当前最需要补的点：
${resumeData.overallIssues?.join('\n') || '暂无'}

原始简历全文：
${originalResumeText}

下面这些项目版本，是用户已经确认过、希望放进最终简历的内容。你必须优先使用它们，覆盖原始简历里对应的项目表达：
${selectedProjectText || '暂无已确认项目'}

你的任务：
1. 输出一份完整可投递的简历草稿，不要只改项目段。
2. 尽量保留原始简历里真实存在的教育、经历、项目和背景信息。
3. 对于已确认的项目，必须优先采用上面的确认版内容。
4. 可以重组顺序、补充更好的标题和概述，但不要编造不存在的公司、数据、职责或结果。
5. 如果某处信息明显不够完整，可以用【建议补充：...】提示，但不要大面积留空。
6. 整体风格要像真实候选人的简历，不要写成说明文，不要写成咨询报告。
7. 最终 fullText 必须是一整份简历正文，建议包含：求职方向、个人概述、核心亮点、项目经历、教育经历。只有原始简历里明确有依据时，才加入技能或其他模块。

请严格返回一个 JSON 对象，必须符合以下 schema：
{
  "title": "这份整份简历草稿的标题",
  "summary": "用1段话概括这份整份简历怎么投、适合什么岗位",
  "highlights": ["亮点1", "亮点2", "亮点3"],
  "fullText": "完整简历正文，使用简体中文，保留清晰分段和换行"
}`

    return requestJsonCompletionSafe({
        prompt,
        maxTokens: 4096,
        timeoutMs: 45000,
        maxAttempts: 3,
        validate: normalizeFullResumeDraft,
        fallback,
    })
}

function buildFallbackResumeInterviewQuestions({
    profile,
    count,
}: {
    profile: ResumeInterviewProfile
    count: number
}): InterviewQuestion[] {
    const project = profile.selectedProjects[0]
    const targetRole = profile.targetRoleProfile?.title || 'AI 产品经理'
    const baseQuestions: Array<{
        category: InterviewQuestion['category']
        prompt: string
    }> = [
        {
            category: '过往经历与行为题',
            prompt: `请你结合最近一次最核心的项目，介绍一下为什么你适合“${targetRole}”这个岗位？`,
        },
        {
            category: '推进与协作',
            prompt: `结合${project?.name || '你的核心项目'}，讲一次你是怎么推动算法、工程或业务一起把事情做成的？`,
        },
        {
            category: '评测与指标',
            prompt: `如果面试官追问${project?.name || '这个项目'}到底怎么衡量效果，你会怎么讲评测指标和上线标准？`,
        },
        {
            category: '产品设计题',
            prompt: `如果让你继续把${project?.name || '这个项目'}做大，你下一步会优先优化哪个用户场景，为什么？`,
        },
        {
            category: '风险与责任',
            prompt: `这个方向里你最担心的风险是什么？你会怎么提前控制？`,
        },
        {
            category: '商业与策略',
            prompt: `如果老板质疑这个方向的投入产出比，你会怎么证明这件事值得继续做？`,
        },
        {
            category: 'AI 基础理解',
            prompt: `如果面试官问你为什么这个场景适合用大模型，而不是传统规则或流程系统，你会怎么回答？`,
        },
        {
            category: '过往经历与行为题',
            prompt: `结合你简历里最容易被质疑的一点，面试官如果深挖，你会怎么把它讲圆？`,
        },
    ]

    const issueQuestions: InterviewQuestion[] = profile.overallIssues.map((issue, index) => ({
        id: `resume-q-issue-${index + 1}`,
        index: index + 1,
        category: '过往经历与行为题',
        prompt: `你的简历里有一个明显短板是“${issue}”。如果面试官当场追问，你会怎么回应并补足说服力？`,
    }))

    const combined: InterviewQuestion[] = [...issueQuestions]
    for (const item of baseQuestions) {
        combined.push({
            id: `resume-q-base-${combined.length + 1}`,
            index: combined.length + 1,
            category: item.category,
            prompt: item.prompt,
        })
    }

    return combined.slice(0, Math.max(1, count))
}

export async function generateResumeInterviewQuestions({
    profile,
    count,
}: {
    profile: ResumeInterviewProfile
    count: number
}): Promise<InterviewQuestion[]> {
    const prompt = `你现在要根据候选人的最近一次简历诊断结果，生成一组“面试定向题”。

候选人信息：
- 姓名：${profile.name}
- 目标岗位：${profile.targetRoleProfile?.title || 'AI 产品经理'}
- 目标公司：${profile.targetRoleProfile?.company || '未填写'}
- 岗位描述：${profile.targetRoleProfile?.jobDescription || '未填写'}

简历里当前最需要补的点：
${profile.overallIssues.join('\n') || '暂无'}

候选人已经确认过的项目版本：
${profile.selectedProjects
    .map(
        (project, index) => `${index + 1}. ${project.name}
角色：${project.role}
时间：${project.duration}
内容：
${project.text}`,
    )
    .join('\n\n') || '暂无'}

出题要求：
1. 一共输出 ${count} 道题。
2. 这些题要明显贴着候选人的简历、目标岗位和当前短板来问，不能只是通用题库复述。
3. 题型里至少包含：项目深挖、指标追问、协作推进、岗位匹配、风险判断。
4. 问法要像真实面试官，不要写成练习说明。
5. category 只能从下面这些里选：AI 基础理解、RAG 与知识库、Agent 与自动化、评测与指标、产品设计题、商业与策略、推进与协作、风险与责任、过往经历与行为题、趋势与判断。

请严格返回一个 JSON 对象，格式如下：
{
  "questions": [
    {
      "id": "resume-q-1",
      "index": 1,
      "category": "过往经历与行为题",
      "prompt": "问题正文"
    }
  ]
}`

    return requestJsonCompletionSafe({
        prompt,
        maxTokens: 2048,
        timeoutMs: 45000,
        maxAttempts: 3,
        validate: normalizeGeneratedInterviewQuestions,
        fallback: buildFallbackResumeInterviewQuestions({ profile, count }),
    })
}

function buildFallbackMockInterviewQuestion({
    profile,
    round,
}: {
    profile?: ResumeInterviewProfile | null
    round: number
}): InterviewQuestion {
    const project = profile?.selectedProjects[0]
    const targetRole = profile?.targetRoleProfile?.title || 'AI 产品经理'

    if (round === 1) {
        return {
            id: 'mock-q-1',
            index: 1,
            category: '过往经历与行为题',
            prompt: `请你先做一个 1 到 2 分钟的自我介绍，并说明为什么你适合“${targetRole}”这个岗位。`,
        }
    }

    if (round === 2) {
        return {
            id: 'mock-q-2',
            index: 2,
            category: '推进与协作',
            prompt: `我们具体聊聊${project?.name || '你简历里最重要的项目'}。你当时到底做了哪些关键推进，怎么把算法、工程和业务拉到同一条线上？`,
        }
    }

    if (round === 3) {
        return {
            id: 'mock-q-3',
            index: 3,
            category: '评测与指标',
            prompt: `如果我继续追问这个项目的结果，你会用哪些指标证明它真的做成了？哪些数字是你最希望在面试里主动讲出来的？`,
        }
    }

    if (round === 4) {
        return {
            id: 'mock-q-4',
            index: 4,
            category: '产品设计题',
            prompt: `如果让你现在继续做这个方向，你下一步会优先优化哪个用户场景？为什么是它，不是别的？`,
        }
    }

    return {
        id: `mock-q-${round}`,
        index: round,
        category: '风险与责任',
        prompt: `最后一个问题：如果这个 AI 能力上线后出现明显错误回答或业务方质疑价值，你会怎么处理？`,
    }
}

export async function generateMockInterviewQuestion({
    profile,
    history,
    round,
}: {
    profile?: ResumeInterviewProfile | null
    history: Array<{
        question: string
        category: string
        answer: string
    }>
    round: number
}): Promise<InterviewQuestion> {
    const prompt = `你现在扮演一位正在面 AI 产品经理的真实面试官。

目标岗位信息：
- 目标岗位：${profile?.targetRoleProfile?.title || 'AI 产品经理'}
- 目标公司：${profile?.targetRoleProfile?.company || '未填写'}
- 岗位描述：${profile?.targetRoleProfile?.jobDescription || '未填写'}

候选人简历里的重点项目：
${profile?.selectedProjects
    ?.map(
        (project, index) => `${index + 1}. ${project.name}
角色：${project.role}
时间：${project.duration}
内容：
${project.text}`,
    )
    .join('\n\n') || '暂无'}

候选人的简历短板：
${profile?.overallIssues?.join('\n') || '暂无'}

当前已经进行到第 ${round} 轮。

前面的问答记录：
${history
    .map(
        (item, index) => `第 ${index + 1} 轮
问题类别：${item.category}
问题：${item.question}
回答：${item.answer}`,
    )
    .join('\n\n') || '这是第一轮，请先从自我介绍或岗位匹配开始。'}

你的任务：
1. 只生成下一道面试官问题，不要给答案，不要解释。
2. 第 1 轮优先让候选人做自我介绍或讲岗位匹配。
3. 后续轮次必须根据上一轮回答追问，问题要更像真实面试官，不要像题库列表。
4. 优先围绕项目深挖、指标追问、协作推进、取舍判断、风险控制来问。
5. category 只能从下面这些里选：AI 基础理解、RAG 与知识库、Agent 与自动化、评测与指标、产品设计题、商业与策略、推进与协作、风险与责任、过往经历与行为题、趋势与判断。

请严格返回一个 JSON 对象，格式如下：
{
  "id": "mock-q-${round}",
  "index": ${round},
  "category": "过往经历与行为题",
  "prompt": "下一道面试官问题"
}`

    return requestJsonCompletionSafe({
        prompt,
        maxTokens: 1024,
        timeoutMs: 45000,
        maxAttempts: 3,
        validate: normalizeGeneratedInterviewQuestion,
        fallback: buildFallbackMockInterviewQuestion({ profile, round }),
    })
}
