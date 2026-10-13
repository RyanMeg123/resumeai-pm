import http from 'node:http'

let calls = 0
const port = Number(process.env.AI_FIXTURE_PORT || 39318)
http.createServer(async (request, response) => {
    response.setHeader('Content-Type', 'application/json')
    if (request.method === 'GET' && request.url === '/state') return response.end(JSON.stringify({ fixture: true, calls }))
    if (request.method !== 'POST' || request.url !== '/v1/chat/completions') { response.statusCode = 404; return response.end('{}') }
    let raw = ''
    for await (const chunk of request) raw += chunk
    const body = JSON.parse(raw)
    const prompt = body.messages.at(-1).content
    calls++
    if (prompt.includes('SLOW_TEST_CASE')) await new Promise(resolve => setTimeout(resolve, 1200))
    if (prompt.includes('FAIL_TEST_CASE')) { response.statusCode = 502; return response.end('{"error":"fixture failure"}') }
    let content = body.response_format ? JSON.stringify({ fixture: true }) : '验收参考：先明确用户场景、目标指标，再解释方案取舍与验证方法；缺少真实结果时标记【待补充】。'
    if (prompt.includes('最多5个核心项目')) content = JSON.stringify({ summary: '隔离验收：项目经历需要补充评测证据，不编造业绩。', projects: [{ name: prompt.includes('第二版') ? '测试项目第二版' : '隔离验收项目', questions: [1, 2, 3].map(index => ({ category: '评测与指标', prompt: `验收题${index}：你如何验证该项目的业务价值？`, interviewerIntent: '检查指标定义与证据。', referenceAnswer: '先明确业务目标、评测样本和上线门槛；真实数字【待补充】。', followUp: '如果指标没有改善，你会如何调整？' })) }] })
    if (prompt.includes('七层提问法')) content = JSON.stringify({ coverage: { 全景: 'hit', 口径: 'weak', 量化: 'miss', 依据: 'miss', 取舍: 'hit', 卡点: 'hit', 验证: 'weak' }, feedback: '验收点评：结构清楚，缺少量化结果与依据；真实数字【待补充】。', followUp: prompt.includes('【追问 3') ? null : { layer: '量化', prompt: '这个改进具体提升了多少？' } })
    if (prompt.includes('INVALID_JSON_TEST')) content = 'invalid JSON'
    response.end(JSON.stringify({ model: body.model, choices: [{ finish_reason: 'stop', message: { content } }], usage: { prompt_tokens: 20, completion_tokens: 30 } }))
}).listen(port, '127.0.0.1', () => console.log(`Local AI fixture on ${port}; never forwards requests externally.`))
