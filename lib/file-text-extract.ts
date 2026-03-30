/** @format */

import { execFile } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'
import mammoth from 'mammoth'

const execFileAsync = promisify(execFile)

export async function extractPdfText(
    arrayBuffer: ArrayBuffer,
): Promise<string> {
    const tempDir = os.tmpdir()
    const baseName = `resumeai-${randomUUID()}`
    const pdfPath = path.join(tempDir, `${baseName}.pdf`)
    const textPath = path.join(tempDir, `${baseName}.txt`)

    try {
        await fs.writeFile(pdfPath, Buffer.from(arrayBuffer))
        await execFileAsync('pdftotext', ['-layout', pdfPath, textPath])

        const text = await fs.readFile(textPath, 'utf8')
        return text.trim()
    } finally {
        await Promise.allSettled([fs.unlink(pdfPath), fs.unlink(textPath)])
    }
}

export async function extractDocxText(
    arrayBuffer: ArrayBuffer,
): Promise<string> {
    const result = await mammoth.extractRawText({
        buffer: Buffer.from(arrayBuffer),
    })
    return result.value.trim()
}

export async function extractTxtText(arrayBuffer: ArrayBuffer): Promise<string> {
    return new TextDecoder('utf-8').decode(arrayBuffer).trim()
}
