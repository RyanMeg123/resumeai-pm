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

    const questionFiles = filenames.filter(
        (name) => name.endsWith('.md') && !name.endsWith('-answers.md'),
    )

    const sets: ProjectQuestionSet[] = []

    for (const questionFile of questionFiles) {
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

    cachedSets = sets
    return cachedSets
}

const GUIDE_FILES: Record<string, { filename: string; title: string }> = {
    'self-intro': { filename: 'eziting-self-intro.md', title: '自我介绍' },
    'divergent': { filename: 'eziting-divergent.md', title: '发散性问题' },
    'ask-interviewer': { filename: 'eziting-ask-interviewer.md', title: '反问面试官' },
}

export async function loadInterviewGuides(
    person: string,
): Promise<InterviewGuide[]> {
    const dirPath = path.join(process.cwd(), 'interview-questions')
    const prefix = person === '鄂子婷' ? 'eziting' : person

    const guides: InterviewGuide[] = []

    for (const [id, config] of Object.entries(GUIDE_FILES)) {
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
