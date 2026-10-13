import assert from 'node:assert/strict'
import test from 'node:test'

const base = 'http://127.0.0.1:3000'
const password = process.env.PRACTICE_TEST_PASSWORD
assert.ok(password, 'Set PRACTICE_TEST_PASSWORD to the local test-account password')
const projectSetId = 'zhangwenjing-project01-churn'

async function request(path, { method = 'GET', body, cookie, origin = base } = {}) {
    return fetch(base + path, { method, redirect: 'manual', headers: {
        Origin: origin, ...(body ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}),
    }, body: body ? JSON.stringify(body) : undefined })
}
async function login(username) {
    const response = await request('/api/session', { method: 'POST', body: { username, password } })
    assert.equal(response.status, 200)
    const header = response.headers.get('set-cookie')
    assert.match(header, /HttpOnly/i)
    assert.match(header, /SameSite=strict/i)
    return header.split(';')[0]
}
async function logout(cookie) {
    assert.equal((await request('/api/session', { method: 'DELETE', cookie })).status, 200)
}

test('unauthenticated visitors cannot load private project pages or score project questions', async () => {
    for (const path of ['/project', '/project/wenjing', '/project/ziting', '/zhangwenjing-project']) {
        const response = await request(path)
        assert.equal(response.status, 307)
        assert.equal(response.headers.get('location'), '/login')
    }
    const response = await request('/api/interview-evaluate', { method: 'POST', body: { projectSetId, questionIds: ['proj-q-1'], answers: [] } })
    assert.equal(response.status, 401)
})

test('three accounts receive only owned material and the server chooses canonical project questions', async () => {
    for (const username of ['zhangwenjing', 'xiaohe', 'tianyijia']) {
        const cookie = await login(username)
        try {
            assert.equal((await (await request('/api/session', { cookie })).json()).user.username, username)
            const page = await request('/project', { cookie })
            assert.equal(page.status, 200)
            const html = await page.text()
            const score = await request('/api/interview-evaluate', { method: 'POST', cookie, body: {
                projectSetId, questionIds: ['proj-q-1'], questions: [{ id: 'proj-q-1', prompt: '篡改题面', category: '产品设计题' }],
                answers: [{ questionId: 'proj-q-1', answer: '先明确业务目标和用户场景，通过实验和数据验证方案。' }],
            } })
            if (username === 'zhangwenjing') {
                assert.ok(html.includes(projectSetId))
                assert.equal(score.status, 200)
                const data = await score.json()
                assert.equal(data.totalQuestions, 1)
                assert.notEqual(data.questionResults[0].prompt, '篡改题面')
                assert.equal((await request('/project/wenjing', { cookie })).headers.get('location'), '/project')
            } else {
                assert.ok(html.includes('等待补充你的简历'))
                assert.ok(!html.includes(projectSetId))
                assert.equal(score.status, 403)
                for (const path of ['/project/wenjing', '/zhangwenjing-project', '/project/ziting']) {
                    const denied = await request(path, { cookie })
                    const deniedHtml = await denied.text()
                    assert.ok(!deniedHtml.includes(projectSetId))
                    assert.ok(denied.status === 404 || deniedHtml.includes('NEXT_HTTP_ERROR_FALLBACK;404'))
                }
            }
            const crossSite = await request('/api/session', { method: 'DELETE', cookie, origin: 'https://other.example' })
            assert.equal(crossSite.status, 403)
        } finally { await logout(cookie) }
        assert.equal((await (await request('/api/session', { cookie })).json()).user, null)
        assert.equal((await request('/project', { cookie })).status, 307)
    }
})

test('reject invalid credentials, invalid shapes and foreign origins', async () => {
    assert.equal((await request('/api/session', { method: 'POST', body: { username: 'zhangwenjing', password: 'incorrect-password' } })).status, 401)
    assert.equal((await request('/api/session', { method: 'POST', body: { username: {}, password } })).status, 400)
    assert.equal((await request('/api/session', { method: 'POST', origin: 'https://other.example', body: { username: 'zhangwenjing', password } })).status, 403)
})

test('repeated unknown-account login attempts are limited', async () => {
    let last
    for (let i = 0; i < 11; i++) last = await request('/api/session', { method: 'POST', body: { username: 'nonexistent-auth-test', password: 'incorrect-password' } })
    assert.equal(last.status, 429)
})


test('login form cannot submit credentials with GET before hydration', async () => {
    const page = await request('/login')
    assert.equal(page.status, 200)
    const html = await page.text()
    assert.match(html, /<form[^>]*method="post"/)
    assert.match(html, /<input[^>]*disabled=""[^>]*name="password"|<input[^>]*name="password"[^>]*disabled=""/)
})
