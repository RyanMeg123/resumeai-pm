import 'server-only'

import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'

import { InterviewGuide, InterviewQuestion, ProjectQuestionSet } from './interview-types'

let cachedSets: ProjectQuestionSet[] | null = null

function parseTitle(markdown: string): { person: string; project: string } {
    const titleMatch = markdown.match(/^#\s+(.+?)(?:\s*[-—]\s*(.+?))\s*项目面试题/m)

    if (titleMatch) {
        return {
            person: titleMatch[1].trim(),
            project: titleMatch[2].trim(),
        }
    }

    return { person: '未知', project: '未知' }
}

function parseQuestions(markdown: string): InterviewQuestion[] {
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
            id: `proj-q-${index}`,
            index,
            category: currentCategory,
            prompt,
        })
    }

    return questions.sort((a, b) => a.index - b.index)
}

function parseAnswers(markdown: string): Record<string, string> {
    const answers: Record<string, string> = {}

    const sections = markdown.split(/^### Q(\d+):/m)

    for (let i = 1; i < sections.length; i += 2) {
        const questionIndex = Number(sections[i])
        const content = sections[i + 1]

        if (!Number.isFinite(questionIndex) || !content) {
            continue
        }

        const cleaned = content
            .replace(/^[^\n]*\n/, '')
            .split(/^---$/m)[0]
            .trim()

        if (cleaned) {
            answers[`proj-q-${questionIndex}`] = cleaned
        }
    }

    return answers
}

function parseZhangwenjingTitle(markdown: string): { person: string; project: string } {
    const match = markdown.match(/^#\s+张文婧\s*·\s*项目面试题\s*·\s*(.+)$/m)
    if (match) {
        return { person: '张文婧', project: match[1].trim() }
    }
    return { person: '张文婧', project: '未知' }
}

function parseZhangwenjingQuestions(markdown: string): {
    questions: InterviewQuestion[]
    referenceAnswers: Record<string, string>
} {
    const questions: InterviewQuestion[] = []
    const referenceAnswers: Record<string, string> = {}

    const sections = markdown.split(/^### Q(\d+)\.\s*/m)

    let currentCategory = '未分类'
    const categoryPattern = /^##\s+\d+\.\s+(.+)$/gm
    const categoryPositions: Array<{ category: string; position: number }> = []
    let catMatch: RegExpExecArray | null
    while ((catMatch = categoryPattern.exec(markdown)) !== null) {
        categoryPositions.push({ category: catMatch[1].trim(), position: catMatch.index })
    }

    for (let i = 1; i < sections.length; i += 2) {
        const index = Number(sections[i])
        const content = sections[i + 1]

        if (!Number.isFinite(index) || !content) {
            continue
        }

        const questionPosition = markdown.indexOf(`### Q${index}.`)
        for (const cp of categoryPositions) {
            if (cp.position < questionPosition) {
                currentCategory = cp.category
            }
        }

        const promptMatch = content.match(/^(.+?)(?:\n|$)/)
        const prompt = promptMatch ? promptMatch[1].trim() : ''

        if (!prompt) {
            continue
        }

        const intentMatch = content.match(/\*\*面试官意图\*\*[：:]\s*(.+?)(?:\n|$)/)
        const interviewerIntent = intentMatch ? intentMatch[1].trim() : undefined

        const followUpMatch = content.match(/\*\*可能追问\*\*[：:]\s*(.+?)(?:\n|$)/)
        const followUp = followUpMatch ? followUpMatch[1].trim() : undefined

        const answerMatch = content.match(/\*\*参考答案\*\*[：:]\s*\n([\s\S]*?)(?=\n\*\*可能追问\*\*|\n---|\n### Q|$)/)
        let referenceAnswer: string | undefined
        if (answerMatch) {
            referenceAnswer = answerMatch[1]
                .replace(/^>\s?/gm, '')
                .trim()
        }

        const questionId = `proj-q-${index}`
        questions.push({
            id: questionId,
            index,
            category: currentCategory,
            prompt,
            interviewerIntent,
            followUp,
            referenceAnswer,
            bank: 'project-deep-dive',
        })

        if (referenceAnswer) {
            referenceAnswers[questionId] = referenceAnswer
        }
    }

    return {
        questions: questions.sort((a, b) => a.index - b.index),
        referenceAnswers,
    }
}

function deriveSetId(filename: string): string {
    return filename.replace(/\.md$/, '').replace(/-answers$/, '')
}

export async function loadProjectQuestionBank(): Promise<ProjectQuestionSet[]> {
    if (cachedSets) {
        return cachedSets
    }

    const dirPath = path.join(process.cwd(), 'interview-questions')

    let filenames: string[]
    try {
        filenames = await readdir(dirPath)
    } catch {
        cachedSets = []
        return cachedSets
    }

    const ezitingQuestionFiles = filenames.filter(
        (name) =>
            name.startsWith('eziting-') &&
            name.endsWith('.md') &&
            !name.endsWith('-answers.md') &&
            !name.startsWith('eziting-ask-interviewer'),
    )

    const zhangwenjingProjectFiles = filenames.filter(
        (name) =>
            name.startsWith('zhangwenjing-project') &&
            name.endsWith('.md'),
    )

    const zhangwenjingExtraQuestionFiles = filenames.filter(
        (name) =>
            name.startsWith('zhangwenjing-') &&
            name.endsWith('.md') &&
            !name.endsWith('-answers.md') &&
            !name.startsWith('zhangwenjing-project') &&
            !name.startsWith('zhangwenjing-self-intro-and-extras'),
    )

    const sets: ProjectQuestionSet[] = []

    for (const questionFile of ezitingQuestionFiles) {
        const baseId = deriveSetId(questionFile)
        const answersFile = `${baseId}-answers.md`

        const questionMarkdown = await readFile(
            path.join(dirPath, questionFile),
            'utf-8',
        )
        const { person, project } = parseTitle(questionMarkdown)
        const questions = parseQuestions(questionMarkdown)

        if (questions.length === 0) {
            continue
        }

        let referenceAnswers: Record<string, string> = {}
        if (filenames.includes(answersFile)) {
            const answersMarkdown = await readFile(
                path.join(dirPath, answersFile),
                'utf-8',
            )
            referenceAnswers = parseAnswers(answersMarkdown)
        }

        sets.push({
            id: baseId,
            person,
            project,
            questions,
            referenceAnswers,
        })
    }

    for (const file of zhangwenjingProjectFiles) {
        const baseId = file.replace(/\.md$/, '')
        const markdown = await readFile(path.join(dirPath, file), 'utf-8')
        const { person, project } = parseZhangwenjingTitle(markdown)
        const { questions, referenceAnswers } = parseZhangwenjingQuestions(markdown)

        if (questions.length === 0) {
            continue
        }

        sets.push({
            id: baseId,
            person,
            project,
            questions,
            referenceAnswers,
        })
    }

    for (const questionFile of zhangwenjingExtraQuestionFiles) {
        const baseId = deriveSetId(questionFile)
        const answersFile = `${baseId}-answers.md`

        const questionMarkdown = await readFile(
            path.join(dirPath, questionFile),
            'utf-8',
        )

        const titleMatch = questionMarkdown.match(/^#\s+张文婧\s*-\s*(.+?)\s*项目面试题/m)
        const project = titleMatch ? titleMatch[1].trim() : questionFile.replace(/\.md$/, '')
        const questions = parseQuestions(questionMarkdown)

        if (questions.length === 0) {
            continue
        }

        let referenceAnswers: Record<string, string> = {}
        if (filenames.includes(answersFile)) {
            const answersMarkdown = await readFile(
                path.join(dirPath, answersFile),
                'utf-8',
            )
            referenceAnswers = parseAnswers(answersMarkdown)
        }

        sets.push({
            id: baseId,
            person: '张文婧',
            project,
            questions,
            referenceAnswers,
        })
    }

    cachedSets = sets
    return cachedSets
}

interface GuideFileConfig {
    filename: string
    title: string
}

interface CombinedGuideConfig {
    filename: string
    sections: Array<{ id: string; title: string; marker: string }>
}

const EZITING_GUIDE_FILES: Record<string, GuideFileConfig> = {
    'ask-interviewer': { filename: 'eziting-ask-interviewer.md', title: '反问面试官' },
}

const ZHANGWENJING_COMBINED: CombinedGuideConfig = {
    filename: 'zhangwenjing-self-intro-and-extras.md',
    sections: [
        { id: 'ask-interviewer', title: '反问面试官', marker: '# 第三部分' },
    ],
}

function splitCombinedGuide(
    content: string,
    sections: CombinedGuideConfig['sections'],
): InterviewGuide[] {
    const guides: InterviewGuide[] = []
    const lines = content.split('\n')

    for (let i = 0; i < sections.length; i += 1) {
        const current = sections[i]
        const next = sections[i + 1]

        const startIdx = lines.findIndex((line) => line.startsWith(current.marker))
        if (startIdx < 0) {
            continue
        }

        const endIdx = next
            ? lines.findIndex((line, idx) => idx > startIdx && line.startsWith(next.marker))
            : lines.length

        const body = lines
            .slice(startIdx + 1, endIdx > startIdx ? endIdx : lines.length)
            .join('\n')
            .trim()

        if (body) {
            guides.push({ id: current.id, title: current.title, content: body })
        }
    }

    return guides
}

export async function loadInterviewGuides(
    person: string,
): Promise<InterviewGuide[]> {
    const dirPath = path.join(process.cwd(), 'interview-questions')

    if (person === '张文婧') {
        try {
            const content = await readFile(
                path.join(dirPath, ZHANGWENJING_COMBINED.filename),
                'utf-8',
            )
            return splitCombinedGuide(content, ZHANGWENJING_COMBINED.sections)
        } catch {
            return []
        }
    }

    const guides: InterviewGuide[] = []

    for (const [id, config] of Object.entries(EZITING_GUIDE_FILES)) {
        const filePath = path.join(dirPath, config.filename)
        try {
            const content = await readFile(filePath, 'utf-8')
            const bodyStart = content.indexOf('\n---')
            const body = bodyStart >= 0 ? content.slice(bodyStart + 4).trim() : content.trim()
            guides.push({ id, title: config.title, content: body })
        } catch {
            // File doesn't exist, skip
        }
    }

    return guides
}
