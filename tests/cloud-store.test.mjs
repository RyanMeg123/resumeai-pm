import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { promisify } from 'node:util'
import { execFile } from 'node:child_process'
import ts from 'typescript'

assert.ok(process.env.PRACTICE_STORAGE_NAMESPACE?.startsWith('test:'), 'Use a disposable test: namespace, never production records')
assert.ok(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN)
const directory = await mkdtemp(path.join(tmpdir(), 'resumeai-store-test-'))
const moduleFile = path.join(directory, 'store.mjs')
const source = (await readFile(new URL('../lib/ai-store.ts', import.meta.url), 'utf8')).replace("import 'server-only'", '')
await writeFile(moduleFile, ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText)
const moduleUrl = pathToFileURL(moduleFile).href
const store = await import(moduleUrl)
const prefix = process.env.PRACTICE_STORAGE_NAMESPACE
const command = async (...args) => {
    const r = await fetch(process.env.KV_REST_API_URL, { method: 'POST', headers: { Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}`, 'Content-Type': 'application/json' }, body: JSON.stringify(args) })
    const value = await r.json(); assert.ok(!value.error); return value.result
}
const child = promisify(execFile)
try {
    await store.writeData('checks/counter.json', 0)
    const code = `const s=await import(${JSON.stringify(moduleUrl)});for(let i=0;i<3;i++)await s.withDataLock('counter',async()=>{const n=await s.readData('checks/counter.json');await new Promise(r=>setTimeout(r,30));await s.writeData('checks/counter.json',n+1)});`
    await Promise.all([child(process.execPath, ['--input-type=module', '-e', code]), child(process.execPath, ['--input-type=module', '-e', code])])
    assert.equal(await store.readData('checks/counter.json'), 6)
    await store.withDataLock('expired-owner', async () => {
        await command('DEL', `${prefix}:lock:${store.contentHash('expired-owner')}`)
        await assert.rejects(store.writeData('checks/forbidden.json', true))
        await assert.rejects(store.assertDataLocks())
    })
    assert.equal(await store.readData('checks/forbidden.json'), null)
    await store.writeData('checks/session.json', { user: 'fixture' }, 60)
    assert.ok(await command('TTL', `${prefix}:checks/session.json`) > 0)
    await store.deleteData('checks/session.json')
    assert.equal(await store.readData('checks/session.json'), null)
    await assert.rejects(store.writeData('../escape.json', {}))
    await child(process.execPath, ['--input-type=module', '-e', `const s=await import(${JSON.stringify(moduleUrl)});await (await import('node:assert/strict')).default.rejects(s.readData('checks/missing.json'));`], { env: { ...process.env, VERCEL: '1', KV_REST_API_URL: '', KV_REST_API_TOKEN: '' } })
    console.log('PASS: real shared store, cross-process locking, expired-owner fencing, session TTL/deletion, path validation, production fail-closed')
} finally {
    await command('DEL', `${prefix}:checks/counter.json`, `${prefix}:checks/session.json`, `${prefix}:checks/forbidden.json`)
    await rm(directory, { recursive: true, force: true })
}
