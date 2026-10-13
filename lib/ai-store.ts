import 'server-only'
import { AsyncLocalStorage } from 'node:async_hooks'
import { createHash, randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'

export const dataRoot = path.resolve(process.env.PRACTICE_DATA_DIR || '.practice-data')
export function contentHash(value: unknown) { return createHash('sha256').update(JSON.stringify(value)).digest('hex') }
function filePath(file: string) {
    if (!/^[a-zA-Z0-9_./-]+$/.test(file) || file.split('/').includes('..') || path.isAbsolute(file)) throw new Error('Invalid storage path')
    return path.join(dataRoot, file)
}
function cloudStore() {
    const url = process.env.KV_REST_API_URL
    const token = process.env.KV_REST_API_TOKEN
    if (url && token) return { url, token }
    // Never silently store production data on Vercel's temporary filesystem.
    if (process.env.VERCEL || url || token) throw new Error('Shared storage is not configured')
    return null
}
function redisKey(file: string) { return `${process.env.PRACTICE_STORAGE_NAMESPACE || 'resumeai-pm:v1'}:${file}` }
async function redis(command: (string | number)[]) {
    const config = cloudStore()
    if (!config) throw new Error('Shared storage is not configured')
    const url = new URL(config.url)
    if (url.protocol !== 'https:' && !(process.env.NODE_ENV !== 'production' && ['127.0.0.1', 'localhost'].includes(url.hostname))) throw new Error('Storage requires HTTPS')
    const response = await fetch(url, { method: 'POST', headers: { Authorization: `Bearer ${config.token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(command), cache: 'no-store', signal: AbortSignal.timeout(10_000) })
    if (!response.ok) throw new Error('Shared storage request failed')
    const payload = await response.json()
    if (payload.error) throw new Error('Shared storage command failed')
    return payload.result
}

type Lease = { key: string; token: string }
const leases = new AsyncLocalStorage<Lease[]>()
const checkLeases = "for i=1,#KEYS do if redis.call('GET',KEYS[i])~=ARGV[i] then return redis.error_reply('LOCK_EXPIRED') end end; "
async function guardedCommand(command: (string | number)[]) {
    const held = leases.getStore() ?? []
    return redis(['EVAL', `${checkLeases}return redis.call(unpack(ARGV,#KEYS+1))`, held.length, ...held.map(item => item.key), ...held.map(item => item.token), ...command])
}
export async function assertDataLocks() {
    if (!cloudStore()) return
    const held = leases.getStore() ?? []
    if (held.length) await redis(['EVAL', `${checkLeases}return 1`, held.length, ...held.map(item => item.key), ...held.map(item => item.token)])
}
export async function readData<T>(file: string): Promise<T | null> {
    const target = filePath(file)
    if (cloudStore()) {
        const value = await redis(['GET', redisKey(file)])
        return value === null ? null : JSON.parse(value) as T
    }
    try { return JSON.parse(await readFile(target, 'utf8')) as T }
    catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null; throw error }
}
export async function writeData(file: string, value: unknown, ttlSeconds?: number) {
    const target = filePath(file)
    if (cloudStore()) {
        await guardedCommand(['SET', redisKey(file), JSON.stringify(value), ...(ttlSeconds ? ['EX', ttlSeconds] : [])])
        return
    }
    await mkdir(path.dirname(target), { recursive: true, mode: 0o700 })
    const temporary = `${target}.${randomUUID()}.tmp`
    await writeFile(temporary, JSON.stringify(value), { mode: 0o600 })
    await rename(temporary, target)
}
export async function deleteData(file: string) {
    const target = filePath(file)
    if (cloudStore()) await guardedCommand(['DEL', redisKey(file)])
    else await rm(target, { force: true })
}

const runtime = globalThis as typeof globalThis & { practiceDataLocks?: Map<string, Promise<unknown>> }
const locks = runtime.practiceDataLocks ??= new Map<string, Promise<unknown>>()
export async function withDataLock<T>(name: string, work: () => Promise<T>): Promise<T> {
    if (cloudStore()) {
        const lease = { key: redisKey(`lock:${contentHash(name)}`), token: randomUUID() }
        const deadline = Date.now() + 100_000
        while (await redis(['SET', lease.key, lease.token, 'NX', 'PX', 180_000]) !== 'OK') {
            if (Date.now() >= deadline) throw new Error('Operation already in progress; retry later')
            await new Promise(resolve => setTimeout(resolve, 500))
        }
        // shortcut: a lease lasts 180s, above the AI timeout; fenced writes reject expired owners instead of corrupting records.
        try { return await leases.run([...(leases.getStore() ?? []), lease], work) }
        finally {
            try { await redis(['EVAL', "if redis.call('GET',KEYS[1])==ARGV[1] then return redis.call('DEL',KEYS[1]) end return 0", 1, lease.key, lease.token]) }
            catch { /* The lease expires if release fails; never retry paid work. */ }
        }
    }
    const key = `${dataRoot}:${name}`
    const previous = locks.get(key) ?? Promise.resolve()
    const next = previous.catch(() => undefined).then(work)
    locks.set(key, next)
    try { return await next } finally { if (locks.get(key) === next) locks.delete(key) }
}
