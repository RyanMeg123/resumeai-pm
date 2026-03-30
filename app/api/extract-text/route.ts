/** @format */

import { NextResponse } from 'next/server'
import {
    extractDocxText,
    extractPdfText,
    extractTxtText,
} from '@/lib/file-text-extract'

export async function POST(request: Request) {
    try {
        const formData = await request.formData()
        const file = formData.get('file')

        if (!(file instanceof File)) {
            return NextResponse.json(
                { error: '未收到文件' },
                { status: 400 },
            )
        }

        const fileName = file.name.toLowerCase()
        const arrayBuffer = await file.arrayBuffer()

        let text = ''

        if (fileName.endsWith('.pdf')) {
            text = await extractPdfText(arrayBuffer)
        } else if (fileName.endsWith('.docx')) {
            text = await extractDocxText(arrayBuffer)
        } else if (fileName.endsWith('.txt')) {
            text = await extractTxtText(arrayBuffer)
        } else {
            return NextResponse.json(
                { error: '仅支持 PDF / Word(.docx) / TXT 格式' },
                { status: 400 },
            )
        }

        if (!text.trim()) {
            return NextResponse.json(
                { error: '文件内容为空或暂时无法解析' },
                { status: 422 },
            )
        }

        return NextResponse.json({ text })
    } catch (error) {
        console.error('Extract text failed:', error)
        return NextResponse.json(
            { error: '文件解析失败，请重试或直接粘贴文本' },
            { status: 500 },
        )
    }
}
