/** @format */

import { execFile } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'
import { NextResponse } from 'next/server'
import {
    createPdfFriendlyDocx as buildPdfFriendlyDocx,
    exportResumeDocx,
} from '@/lib/docx-export'

const execFileAsync = promisify(execFile)

type Replacement = {
    name: string
    original: string
    updated: string
}

async function getSofficeCommand() {
    const candidates = [
        'soffice',
        '/Applications/LibreOffice.app/Contents/MacOS/soffice',
    ]

    for (const candidate of candidates) {
        try {
            if (candidate.includes('/')) {
                await fs.access(candidate)
                return candidate
            }

            await execFileAsync('which', [candidate])
            return candidate
        } catch {
            continue
        }
    }

    return null
}

async function getPagesCommand() {
    try {
        await fs.access('/Applications/Pages.app')
        return 'Pages'
    } catch {
        return null
    }
}

async function createPdfFriendlyDocx(inputPath: string, outputPath: string) {
    await buildPdfFriendlyDocx({
        inputPath,
        outputPath,
    })
    await fs.access(outputPath)
    return outputPath
}

async function convertDocxToPdfWithPages(docxPath: string, outputPath: string) {
    const pages = await getPagesCommand()
    if (!pages) {
        return null
    }

    const script = `
set inputPath to POSIX file ${JSON.stringify(docxPath)}
set outputPath to POSIX file ${JSON.stringify(outputPath)}
tell application "Pages"
    activate
    open inputPath
    repeat 60 times
        if (count of documents) > 0 then
            exit repeat
        end if
        delay 0.2
    end repeat

    if (count of documents) is 0 then error "Pages did not open the document."

    set docRef to front document
    export docRef to outputPath as PDF
    close docRef saving no
end tell
`

    await execFileAsync('osascript', ['-e', script])
    await fs.access(outputPath)
    return outputPath
}

async function convertDocxToPdf(docxPath: string, outputDir: string) {
    const pdfReadyDocxPath = path.join(outputDir, 'resume-pdf-ready.docx')
    const sourceForPdf = await createPdfFriendlyDocx(docxPath, pdfReadyDocxPath)

    const soffice = await getSofficeCommand()
    if (soffice) {
        const profileDir = path.join(os.tmpdir(), `lo-profile-${randomUUID()}`)
        await fs.mkdir(profileDir, { recursive: true })

        try {
            await execFileAsync(soffice, [
                `-env:UserInstallation=file://${profileDir}`,
                '--headless',
                '--convert-to',
                'pdf',
                '--outdir',
                outputDir,
                sourceForPdf,
            ])

            const pdfPath = path.join(
                outputDir,
                `${path.basename(sourceForPdf, '.docx')}.pdf`,
            )
            await fs.access(pdfPath)
            return pdfPath
        } finally {
            await fs.rm(profileDir, { recursive: true, force: true })
        }
    }

    const pagesOutputPath = path.join(
        outputDir,
        `${path.basename(sourceForPdf, '.docx')}.pdf`,
    )

    try {
        const pagesPdfPath = await convertDocxToPdfWithPages(
            sourceForPdf,
            pagesOutputPath,
        )
        if (pagesPdfPath) {
            return pagesPdfPath
        }
    } catch (error) {
        console.warn('Pages PDF export failed:', error)
    }

    return null
}

export async function GET() {
    const canExportPdf = !!((await getPagesCommand()) || (await getSofficeCommand()))

    return NextResponse.json({ canExportDocx: true, canExportPdf })
}

export async function POST(request: Request) {
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'resume-export-'))

    try {
        const formData = await request.formData()
        const file = formData.get('file')
        const replacementsRaw = formData.get('replacements')
        const target = formData.get('target')

        if (!(file instanceof File)) {
            return NextResponse.json({ error: '未收到原始Word文件' }, { status: 400 })
        }

        if (typeof replacementsRaw !== 'string') {
            return NextResponse.json({ error: '未收到修改内容' }, { status: 400 })
        }

        if (target !== 'docx' && target !== 'pdf') {
            return NextResponse.json({ error: '导出格式不正确' }, { status: 400 })
        }

        const replacements = JSON.parse(replacementsRaw) as Replacement[]
        if (!Array.isArray(replacements) || replacements.length === 0) {
            return NextResponse.json({ error: '没有可导出的项目内容' }, { status: 400 })
        }

        const inputPath = path.join(tempRoot, 'input.docx')
        const outputDocxPath = path.join(tempRoot, 'resume-updated.docx')

        await fs.writeFile(inputPath, Buffer.from(await file.arrayBuffer()))

        await exportResumeDocx({
            inputPath,
            outputPath: outputDocxPath,
            replacements,
        })

        if (target === 'pdf') {
            const pdfPath = await convertDocxToPdf(outputDocxPath, tempRoot)

            if (!pdfPath) {
                return NextResponse.json(
                    { error: '当前环境暂时不支持自动导出 PDF，请先导出 Word 版。' },
                    { status: 400 },
                )
            }

            const pdfBuffer = await fs.readFile(pdfPath)
            return new NextResponse(pdfBuffer, {
                headers: {
                    'Content-Type': 'application/pdf',
                    'Content-Disposition':
                        'attachment; filename="resume-updated.pdf"',
                },
            })
        }

        const docxBuffer = await fs.readFile(outputDocxPath)
        return new NextResponse(docxBuffer, {
            headers: {
                'Content-Type':
                    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                'Content-Disposition':
                    'attachment; filename="resume-updated.docx"',
            },
        })
    } catch (error) {
        console.error('Export resume failed:', error)
        return NextResponse.json(
            { error: '导出失败，请重试。' },
            { status: 500 },
        )
    } finally {
        await fs.rm(tempRoot, { recursive: true, force: true })
    }
}
