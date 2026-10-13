import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

// Run against the local development server; evaluation has no database writes.
const endpoint = 'http://127.0.0.1:3000/api/interview-evaluate'
const slugs = ['bytedance', 'tencent', 'li-auto', 'futu', 'meituan']
const counts = [87, 14, 20, 10, 15]
const banks = await Promise.all(slugs.map(async (slug) => JSON.parse(await readFile(new URL(`../interview-questions/companies/${slug}.json`, import.meta.url), 'utf8'))))

async function submit(body) {
    const response = await fetch(endpoint, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    })
    return { status: response.status, data: await response.json() }
}

test('five company banks evaluate their canonical questions', async () => {
    for (const [index, bank] of banks.entries()) {
        assert.equal(bank.questions.length, counts[index])
        assert.equal(new Set(bank.questions.map((question) => question.id)).size, counts[index])
        assert.equal(bank.sessions.reduce((sum, session) => sum + session.question_count, 0), counts[index])
        const question = bank.questions[0]
        const result = await submit({
            companySlug: slugs[index], questionIds: [question.id],
            answers: [{ questionId: question.id, answer: '先明确目标用户、任务和业务目标，再设计方案，用完成率与对照实验验证结果。' }],
            questions: [{ id: question.id, prompt: '客户端篡改题面', category: '未分类' }],
        })
        assert.equal(result.status, 200)
        assert.equal(result.data.totalQuestions, 1)
        assert.equal(result.data.answeredQuestions, 1)
        assert.equal(result.data.questionResults[0].questionId, question.id)
        assert.equal(result.data.questionResults[0].prompt, question.prompt)
    }
})

test('company submissions reject unknown companies, foreign IDs and empty selections', async () => {
    for (const body of [
        { companySlug: 'unknown', questionIds: [banks[0].questions[0].id] },
        { companySlug: 'bytedance', questionIds: [banks[1].questions[0].id] },
        { companySlug: 'bytedance', questionIds: [] },
    ]) assert.equal((await submit(body)).status, 400)
})

test('existing general and custom question submissions still work', async () => {
    const general = await submit({ questionIds: ['q-1'], answers: [{ questionId: 'q-1', answer: 'AI产品经理负责确定目标用户与业务价值。' }] })
    assert.equal(general.status, 200)
    assert.equal(general.data.questionResults[0].questionId, 'q-1')
    const custom = await submit({ questions: [{ id: 'custom-test', prompt: '如何验证产品价值？', category: '产品设计题' }], answers: [] })
    assert.equal(custom.status, 200)
    assert.equal(custom.data.questionResults[0].prompt, '如何验证产品价值？')
    const invalidAnswer = await submit({ companySlug: 'bytedance', questionIds: [banks[0].questions[0].id], answers: [{ questionId: banks[0].questions[0].id, answer: 42 }] })
    assert.equal(invalidAnswer.status, 200)
    assert.equal(invalidAnswer.data.answeredQuestions, 0)
})
