import assert from 'node:assert/strict'
import test from 'node:test'

const base = 'http://127.0.0.1:3001'
const fixture = 'http://127.0.0.1:39318/state'
const password = process.env.PRACTICE_TEST_PASSWORD
assert.ok(password, 'Set the isolated test-account password')
const state = await (await fetch(fixture)).json()
assert.equal(state.fixture, true, 'Run only with the local, non-billing AI fixture')
const cookies = {}
async function call(path, { user = 'zhangwenjing', method = 'POST', body, origin = base } = {}) {
    const response = await fetch(base + path, { method, headers: { Origin: origin, ...(cookies[user] ? { Cookie: cookies[user] } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined })
    return { status: response.status, data: await response.json() }
}
async function count() { return (await (await fetch(fixture)).json()).calls }
async function profile(user = 'zhangwenjing') { return (await call('/api/my-resume', { user, method: 'GET' })).data.profile }
async function save(text) { const previous = await profile(); return call('/api/my-resume', { method: 'PUT', body: { text, revision: previous.revision } }) }
const resume = '隔离验收简历：我负责内部知识库问答产品，先定义运营用户需求，再设计检索增强方案和评测集，结合采纳率与人工抽检验证效果。'

test('authentication and project ownership are enforced before any AI request', async () => {
    const before = await count()
    assert.equal((await call('/api/ai/question', { body: {} })).status, 401)
    for (const username of ['zhangwenjing', 'xiaohe']) {
        const response = await fetch(base + '/api/session', { method: 'POST', headers: { Origin: base, 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }) })
        assert.equal(response.status, 200)
        cookies[username] = response.headers.get('set-cookie').split(';')[0]
    }
    assert.equal((await call('/api/ai/question', { user: 'xiaohe', body: { projectSetId: 'zhangwenjing-project01-churn', questionId: 'proj-q-1', mode: 'reference', generate: true } })).status, 403)
    assert.equal((await call('/api/ai/completion', { origin: 'https://other.example', body: {} })).status, 403)
    assert.equal(await count(), before)
})

test('existing reference is free; concurrent public generation deduplicates and survives later reads', async () => {
    const before = await count()
    const existing = await call('/api/ai/question', { body: { projectSetId: 'zhangwenjing-project01-churn', questionId: 'proj-q-1', mode: 'reference', generate: true } })
    assert.equal(existing.data.existing, true)
    const body = { questionId: 'q-1', mode: 'reference', generate: false }
    assert.equal((await call('/api/ai/question', { body })).data.record, null)
    assert.equal(await count(), before)
    const results = await Promise.all([call('/api/ai/question', { body: { ...body, generate: true } }), call('/api/ai/question', { body: { ...body, generate: true } })])
    results.forEach(result => assert.equal(result.status, 200))
    assert.equal(await count(), before + 1)
    assert.equal(results[0].data.record.id, results[1].data.record.id)
    const reused = await call('/api/ai/question', { user: 'xiaohe', body })
    assert.equal(reused.data.cached, true)
    assert.equal(await count(), before + 1)
})

test('answer reviews isolate accounts, reuse identical answers and invalidate changed answers', async () => {
    const before = await count()
    const body = { questionId: 'q-1', mode: 'review', generate: true, answer: '测试回答：先明确目标用户和业务目标，再设计验证方法。' }
    const first = await call('/api/ai/question', { body })
    assert.equal(first.status, 200)
    assert.equal((await call('/api/ai/question', { body })).data.cached, true)
    assert.equal((await call('/api/ai/question', { user: 'xiaohe', body: { ...body, generate: false } })).data.record, null)
    assert.equal((await call('/api/ai/question', { body: { ...body, answer: body.answer + '补充评测集和成本约束。' } })).status, 200)
    assert.equal(await count(), before + 2)
    const history = await call('/api/ai/question', { body: { questionId: 'q-1', mode: 'history' } })
    assert.equal(history.data.history.length, 2)
    assert.ok(history.data.history.some(item => item.answer === body.answer))
    assert.equal((await call('/api/ai/question', { user: 'xiaohe', body: { questionId: 'q-1', mode: 'history' } })).data.history.length, 0)
    assert.equal(await count(), before + 2)
})

test('resume save is free; generated project sets persist and remain private', async () => {
    const before = await count()
    const saved = await save(resume)
    assert.equal(saved.status, 200)
    assert.equal(await count(), before)
    const generated = await call('/api/my-resume', { body: { hash: saved.data.profile.hash } })
    assert.equal(generated.status, 200)
    assert.equal(generated.data.profile.generated.sets[0].questions.length, 3)
    assert.equal((await call('/api/my-resume', { body: { hash: saved.data.profile.hash } })).data.cached, true)
    assert.equal((await profile('xiaohe')).text, '')
    const set = generated.data.profile.generated.sets[0]
    assert.equal((await call('/api/ai/question', { user: 'xiaohe', body: { projectSetId: set.id, questionId: set.questions[0].id, mode: 'reference', generate: true } })).status, 403)
    assert.equal((await call('/api/ai/question', { body: { projectSetId: set.id, questionId: set.questions[0].id, mode: 'reference', generate: true } })).data.existing, true)
    assert.equal(await count(), before + 1)
})

test('concurrent resume edits and provider failure never overwrite the active question bank', async () => {
    const previous = await profile()
    const slow = await save(resume + ' 第二版 SLOW_TEST_CASE')
    const before = await count()
    const pending = call('/api/my-resume', { body: { hash: slow.data.profile.hash } })
    for (let i = 0; i < 100 && await count() === before; i++) await new Promise(resolve => setTimeout(resolve, 20))
    const latest = await save(resume + ' 第三版，更新评测方法。')
    assert.equal((await pending).status, 409)
    assert.equal((await profile()).hash, latest.data.profile.hash)
    assert.equal((await profile()).generated.id, previous.generated.id)
    const failure = await save(resume + ' FAIL_TEST_CASE')
    const failed = await call('/api/my-resume', { body: { hash: failure.data.profile.hash } })
    assert.equal(failed.status, 502)
    const afterFailure = await count()
    assert.equal((await call('/api/my-resume', { body: { hash: failure.data.profile.hash } })).status, 429)
    assert.equal(await count(), afterFailure)
    assert.equal((await profile()).generated.id, previous.generated.id)
    const restored = await save(resume)
    assert.equal((await call('/api/my-resume', { body: { hash: restored.data.profile.hash } })).data.cached, true)
})

test('legacy AI gateway persists results, rejects invalid output and never retries automatically', async () => {
    const before = await count()
    const body = { system: '测试系统提示', prompt: '测试改写内容', maxTokens: 300, json: false, generate: true }
    assert.equal((await call('/api/ai/completion', { body })).status, 200)
    assert.equal((await call('/api/ai/completion', { body })).data.cached, true)
    assert.equal((await call('/api/ai/completion', { body: { ...body, prompt: 'INVALID_JSON_TEST', json: true } })).status, 502)
    assert.equal(await count(), before + 2)
})

test('daily caps block fresh work while keeping saved public references readable', async () => {
    let usage = (await call('/api/my-resume', { method: 'GET' })).data.usage
    assert.ok(usage.limit <= 30, 'Test budget must be small and isolated')
    while (usage.used < usage.limit) {
        const result = await call('/api/ai/completion', { body: { system: '验收', prompt: `预算隔离验证 ${usage.used}`, maxTokens: 256, json: false, generate: true } })
        assert.equal(result.status, 200)
        usage = (await call('/api/my-resume', { method: 'GET' })).data.usage
    }
    const before = await count()
    assert.equal((await call('/api/ai/completion', { body: { system: '验收', prompt: '预算用尽后新请求', generate: true } })).status, 429)
    assert.equal((await call('/api/ai/question', { body: { questionId: 'q-1', mode: 'reference', generate: true } })).data.cached, true)
    assert.equal(await count(), before)
})


test('global daily cap also blocks accounts with remaining individual allowance', async () => {
    let usage = (await call('/api/my-resume', { user: 'xiaohe', method: 'GET' })).data.usage
    while (usage.totalUsed < usage.totalLimit) {
        assert.ok(usage.used < usage.limit)
        const result = await call('/api/ai/completion', { user: 'xiaohe', body: { system: '验收', prompt: `全站预算隔离验证 ${usage.totalUsed}`, maxTokens: 256, json: false, generate: true } })
        assert.equal(result.status, 200)
        usage = (await call('/api/my-resume', { user: 'xiaohe', method: 'GET' })).data.usage
    }
    const before = await count()
    assert.equal((await call('/api/ai/completion', { user: 'xiaohe', body: { system: '验收', prompt: '全站预算用尽后', generate: true } })).status, 429)
    assert.equal(await count(), before)
})
