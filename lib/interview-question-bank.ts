import 'server-only'

import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'

import { InterviewQuestion, ProjectDeepDiveBank } from './interview-types'

let cachedQuestions: InterviewQuestion[] | null = null
let cachedProjectDeepDiveBanks: ProjectDeepDiveBank[] | null = null

function parseQuestionBank(markdown: string): InterviewQuestion[] {
    const lines = markdown.split(/\r?\n/)
    const questions: InterviewQuestion[] = []
    let currentCategory = '未分类'

    for (const line of lines) {
        const categoryMatch = line.match(/^##\s+\d+\.\s+(.+)$/)
        if (categoryMatch) {
            currentCategory = categoryMatch[1].trim()
            continue
        }

        const questionMatch = line.match(/^(\d+)\.\s+(.+)$/)
        if (!questionMatch) {
            continue
        }

        const index = Number(questionMatch[1])
        const prompt = questionMatch[2].trim()

        if (!Number.isFinite(index) || !prompt) {
            continue
        }

        questions.push({
            id: `q-${index}`,
            index,
            category: currentCategory,
            prompt,
            bank: 'general',
        })
    }

    return questions.sort((a, b) => a.index - b.index)
}

function normalizeMarkdownBlock(lines: string[]) {
    return lines
        .map((line) => line.replace(/^>\s?/, ''))
        .join('\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim()
}

function buildProjectSlug(fileName: string) {
    return fileName.replace(/\.md$/i, '')
}

function parseProjectDeepDiveQuestionBank(
    markdown: string,
    fileName: string,
): ProjectDeepDiveBank {
    const lines = markdown.split(/\r?\n/)
    const questions: InterviewQuestion[] = []
    const titleMatch = markdown.match(/^#\s+(.+)$/m)
    const summaryLines: string[] = []
    let currentCategory = '未分类'
    let currentQuestion: InterviewQuestion | null = null
    let currentField: 'intent' | 'answer' | 'followUp' | null = null
    let answerLines: string[] = []
    let beforeFirstCategory = true

    if (!titleMatch) {
        throw new Error(`项目深挖题库解析失败：${fileName} 缺少标题`)
    }

    const title = titleMatch[1].trim()
    const shortTitle = title.split('·').pop()?.trim() || title

    const flushCurrentQuestion = () => {
        if (!currentQuestion) {
            return
        }

        if (!currentQuestion.interviewerIntent) {
            throw new Error(
                `项目深挖题库解析失败：第 ${currentQuestion.index} 题缺少面试官意图`,
            )
        }

        currentQuestion.referenceAnswer = normalizeMarkdownBlock(answerLines)

        if (!currentQuestion.referenceAnswer) {
            throw new Error(
                `项目深挖题库解析失败：第 ${currentQuestion.index} 题缺少参考答案`,
            )
        }

        questions.push(currentQuestion)
        currentQuestion = null
        currentField = null
        answerLines = []
    }

    for (const rawLine of lines) {
        const line = rawLine.trimEnd()
        const categoryMatch = line.match(/^##\s+\d+\.\s+(.+)$/)
        if (categoryMatch) {
            flushCurrentQuestion()
            beforeFirstCategory = false
            currentCategory = categoryMatch[1].trim()
            continue
        }

        if (beforeFirstCategory && rawLine.trimStart().startsWith('>')) {
            summaryLines.push(rawLine)
        }

        const questionMatch = line.match(/^###\s+Q(\d+)\.\s+(.+)$/)
        if (questionMatch) {
            flushCurrentQuestion()
            currentQuestion = {
                id: `${buildProjectSlug(fileName)}-q-${questionMatch[1]}`,
                index: Number(questionMatch[1]),
                category: currentCategory,
                prompt: questionMatch[2].trim(),
                bank: 'project-deep-dive',
            }
            currentField = null
            answerLines = []
            continue
        }

        if (!currentQuestion) {
            continue
        }

        if (line.trim() === '---') {
            currentField = null
            continue
        }

        const intentMatch = line.match(/^\*\*面试官意图\*\*：\s*(.+)$/)
        if (intentMatch) {
            currentQuestion.interviewerIntent = intentMatch[1].trim()
            currentField = 'intent'
            continue
        }

        if (/^\*\*参考答案\*\*：\s*$/.test(line)) {
            currentField = 'answer'
            answerLines = []
            continue
        }

        const followUpMatch = line.match(/^\*\*可能追问\*\*：\s*(.+)$/)
        if (followUpMatch) {
            currentQuestion.followUp = followUpMatch[1].trim()
            currentField = 'followUp'
            continue
        }

        if (currentField === 'answer') {
            answerLines.push(rawLine)
            continue
        }

        if (currentField === 'intent' && line.trim()) {
            currentQuestion.interviewerIntent = [
                currentQuestion.interviewerIntent,
                line.trim(),
            ]
                .filter(Boolean)
                .join('\n')
        }

        if (currentField === 'followUp' && line.trim()) {
            currentQuestion.followUp = [currentQuestion.followUp, line.trim()]
                .filter(Boolean)
                .join('\n')
        }
    }

    flushCurrentQuestion()

    const sortedQuestions = questions.sort((a, b) => a.index - b.index)
    const expectedQuestionCount = [
        ...markdown.matchAll(/^###\s+Q(\d+)\.\s+(.+)$/gm),
    ].length

    if (sortedQuestions.length !== expectedQuestionCount) {
        throw new Error(
            `项目深挖题库解析失败：${fileName} 应为 ${expectedQuestionCount} 题，实际解析到 ${sortedQuestions.length} 题`,
        )
    }

    for (let index = 0; index < sortedQuestions.length; index += 1) {
        const question = sortedQuestions[index]
        const expectedIndex = index + 1

        if (question.index !== expectedIndex) {
            throw new Error(
                `项目深挖题库解析失败：${fileName} 期望第 ${expectedIndex} 题，实际读到第 ${question.index} 题`,
            )
        }
    }

    return {
        slug: buildProjectSlug(fileName),
        fileName,
        title,
        shortTitle,
        summary: normalizeMarkdownBlock(summaryLines),
        questionCount: sortedQuestions.length,
        questions: sortedQuestions,
    }
}

export async function loadInterviewQuestionBank(): Promise<InterviewQuestion[]> {
    if (cachedQuestions) {
        return cachedQuestions
    }

    const filePath = path.join(process.cwd(), 'ai-pm-100-questions.md')
    const markdown = await readFile(filePath, 'utf-8')
    cachedQuestions = parseQuestionBank(markdown)
    return cachedQuestions
}

export async function loadProjectDeepDiveBanks(): Promise<ProjectDeepDiveBank[]> {
    if (cachedProjectDeepDiveBanks) {
        return cachedProjectDeepDiveBanks
    }

    const dirPath = path.join(process.cwd(), 'interview-questions')
    const fileNames = (await readdir(dirPath))
        .filter((fileName) => fileName.toLowerCase().endsWith('.md'))
        .sort((a, b) => a.localeCompare(b, 'zh-Hans-CN'))

    const banks: ProjectDeepDiveBank[] = []

    for (const fileName of fileNames) {
        const filePath = path.join(dirPath, fileName)
        const markdown = await readFile(filePath, 'utf-8')
        banks.push(parseProjectDeepDiveQuestionBank(markdown, fileName))
    }

    cachedProjectDeepDiveBanks = banks
    return cachedProjectDeepDiveBanks
}

export async function loadProjectDeepDiveQuestionBank(): Promise<
    InterviewQuestion[]
> {
    const banks = await loadProjectDeepDiveBanks()
    return banks[0]?.questions ?? []
}

export async function loadProjectDeepDiveBankBySlug(
    slug: string,
): Promise<ProjectDeepDiveBank | null> {
    const banks = await loadProjectDeepDiveBanks()
    return (
        banks.find((bank) => bank.slug === slug) ??
        null
    )
}
