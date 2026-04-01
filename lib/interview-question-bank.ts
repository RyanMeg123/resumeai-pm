import 'server-only'

import { readFile } from 'node:fs/promises'
import path from 'node:path'

import { InterviewQuestion } from './interview-types'

let cachedQuestions: InterviewQuestion[] | null = null

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
        })
    }

    return questions.sort((a, b) => a.index - b.index)
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
