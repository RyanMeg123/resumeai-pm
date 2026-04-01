import {
    DOMParser,
    XMLSerializer,
    type Document as XmlDocument,
    type Element as XmlElement,
    type Node as XmlNode,
} from '@xmldom/xmldom'
import { promises as fs } from 'node:fs'
import JSZip from 'jszip'

const WORD_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
const XML_NS = 'http://www.w3.org/XML/1998/namespace'

export type DocxReplacement = {
    name: string
    original: string
    updated: string
}

type ExportSummary = {
    matched: number
    unmatched: string[]
}

function normalize(text: string) {
    return text.replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim()
}

function isElement(node: XmlNode): node is XmlElement {
    return node.nodeType === node.ELEMENT_NODE
}

function getChildElements(parent: XmlElement, tagName: string) {
    const elements: XmlElement[] = []

    for (let index = 0; index < parent.childNodes.length; index += 1) {
        const node = parent.childNodes.item(index)
        if (node && isElement(node) && node.tagName === tagName) {
            elements.push(node)
        }
    }

    return elements
}

function getFirstChildElement(parent: XmlElement, tagName: string) {
    return getChildElements(parent, tagName)[0] ?? null
}

function walkElements(root: XmlElement, visit: (element: XmlElement) => void) {
    visit(root)

    for (let index = 0; index < root.childNodes.length; index += 1) {
        const node = root.childNodes.item(index)
        if (node && isElement(node)) {
            walkElements(node, visit)
        }
    }
}

function getParagraphs(root: XmlElement) {
    const paragraphs: XmlElement[] = []

    walkElements(root, element => {
        if (element.tagName === 'w:p') {
            paragraphs.push(element)
        }
    })

    return paragraphs
}

function getTextNodes(root: XmlElement) {
    const textNodes: XmlElement[] = []

    walkElements(root, element => {
        if (element.tagName === 'w:t') {
            textNodes.push(element)
        }
    })

    return textNodes
}

function getParagraphText(paragraph: XmlElement) {
    return getTextNodes(paragraph)
        .map(node => node.textContent ?? '')
        .join('')
}

function shouldPreserveSpaces(text: string) {
    return /^\s|\s$/.test(text) || /\s{2,}/.test(text)
}

function findSampleRun(paragraph: XmlElement) {
    const runs = paragraph.getElementsByTagName('w:r')

    for (let index = 0; index < runs.length; index += 1) {
        const run = runs.item(index)
        if (run && normalize(run.textContent ?? '')) {
            return run
        }
    }

    return runs.item(0)
}

function cloneRunProperties(targetDocument: XmlDocument, sampleRun: XmlElement | null) {
    const runProps = sampleRun ? getFirstChildElement(sampleRun, 'w:rPr') : null
    return runProps ? runProps.cloneNode(true) : null
}

function createRun(
    targetDocument: XmlDocument,
    text: string,
    sampleRun: XmlElement | null,
    withLineBreak = false,
) {
    const run = targetDocument.createElementNS(WORD_NS, 'w:r') as XmlElement
    const runProps = cloneRunProperties(targetDocument, sampleRun)

    if (runProps) {
        run.appendChild(runProps)
    }

    if (text) {
        const textNode = targetDocument.createElementNS(WORD_NS, 'w:t')
        if (shouldPreserveSpaces(text)) {
            textNode.setAttributeNS(XML_NS, 'xml:space', 'preserve')
        }
        textNode.appendChild(targetDocument.createTextNode(text))
        run.appendChild(textNode)
    }

    if (withLineBreak) {
        run.appendChild(targetDocument.createElementNS(WORD_NS, 'w:br'))
    }

    return run
}

function clearParagraph(paragraph: XmlElement) {
    for (let index = paragraph.childNodes.length - 1; index >= 0; index -= 1) {
        const node = paragraph.childNodes.item(index)
        if (node && (!isElement(node) || node.tagName !== 'w:pPr')) {
            paragraph.removeChild(node)
        }
    }
}

function addTextWithStyle(
    paragraph: XmlElement,
    text: string,
    sampleRun: XmlElement | null,
) {
    const lines = text.split(/\r?\n/)
    const targetDocument = paragraph.ownerDocument

    if (!targetDocument) {
        throw new Error('DOCX 段落缺少所属文档')
    }

    lines.forEach((line, index) => {
        const hasLineBreak = index < lines.length - 1
        const run = createRun(targetDocument, line, sampleRun, hasLineBreak)
        paragraph.appendChild(run)
    })
}

function replaceParagraphSpan(paragraphs: XmlElement[], replacementText: string) {
    if (paragraphs.length === 0) {
        return
    }

    const sampleRun = findSampleRun(paragraphs[0])
    clearParagraph(paragraphs[0])
    addTextWithStyle(paragraphs[0], replacementText, sampleRun)

    paragraphs.slice(1).forEach(clearParagraph)
}

function levenshteinDistance(source: string, target: string) {
    if (source === target) {
        return 0
    }

    if (source.length === 0) {
        return target.length
    }

    if (target.length === 0) {
        return source.length
    }

    const previous = new Array<number>(target.length + 1)
    const current = new Array<number>(target.length + 1)

    for (let column = 0; column <= target.length; column += 1) {
        previous[column] = column
    }

    for (let row = 1; row <= source.length; row += 1) {
        current[0] = row

        for (let column = 1; column <= target.length; column += 1) {
            const cost = source[row - 1] === target[column - 1] ? 0 : 1
            current[column] = Math.min(
                previous[column] + 1,
                current[column - 1] + 1,
                previous[column - 1] + cost,
            )
        }

        for (let column = 0; column <= target.length; column += 1) {
            previous[column] = current[column]
        }
    }

    return previous[target.length]
}

function similarityScore(source: string, target: string) {
    const maxLength = Math.max(source.length, target.length)
    if (maxLength === 0) {
        return 1
    }

    return 1 - levenshteinDistance(source, target) / maxLength
}

function scoreCandidate(target: string, candidate: string, projectName: string) {
    if (!candidate) {
        return 0
    }

    let score = similarityScore(target, candidate)

    if (target.includes(candidate) || candidate.includes(target)) {
        score += 0.2
    }

    if (projectName && candidate.includes(projectName)) {
        score += 0.05
    }

    return score
}

function findBestSpan(
    paragraphs: XmlElement[],
    targetText: string,
    projectName: string,
) {
    const target = normalize(targetText)
    if (!target) {
        return null
    }

    let best:
        | {
              start: number
              end: number
              score: number
          }
        | null = null

    for (let start = 0; start < paragraphs.length; start += 1) {
        for (let spanLength = 1; spanLength <= 3; spanLength += 1) {
            const end = start + spanLength
            if (end > paragraphs.length) {
                break
            }

            const candidateText = normalize(
                paragraphs
                    .slice(start, end)
                    .map(paragraph => getParagraphText(paragraph))
                    .join('\n'),
            )
            const score = scoreCandidate(
                target,
                candidateText,
                normalize(projectName),
            )

            if (!best || score > best.score) {
                best = { start, end, score }
            }
        }
    }

    return best
}

async function loadDocumentXml(inputPath: string) {
    const buffer = await fs.readFile(inputPath)
    const zip = await JSZip.loadAsync(buffer)
    const documentEntry = zip.file('word/document.xml')

    if (!documentEntry) {
        throw new Error('DOCX 文件缺少正文内容')
    }

    const documentXml = await documentEntry.async('string')
    const parser = new DOMParser()
    const xmlDocument = parser.parseFromString(documentXml, 'application/xml')

    return { zip, xmlDocument }
}

async function saveDocumentXml(
    zip: JSZip,
    xmlDocument: XmlDocument,
    outputPath: string,
) {
    const serializer = new XMLSerializer()
    zip.file(
        'word/document.xml',
        serializer.serializeToString(xmlDocument),
    )
    const outputBuffer = await zip.generateAsync({ type: 'nodebuffer' })
    await fs.writeFile(outputPath, outputBuffer)
}

export async function exportResumeDocx(options: {
    inputPath: string
    outputPath: string
    replacements: DocxReplacement[]
}): Promise<ExportSummary> {
    const { zip, xmlDocument } = await loadDocumentXml(options.inputPath)
    const body = xmlDocument.getElementsByTagName('w:body').item(0)

    if (!body) {
        throw new Error('DOCX 文件缺少正文内容')
    }

    const paragraphs = getParagraphs(body).filter(paragraph =>
        Boolean(normalize(getParagraphText(paragraph))),
    )

    let matched = 0
    const unmatched: string[] = []

    for (const replacement of options.replacements) {
        const best = findBestSpan(paragraphs, replacement.original ?? '', replacement.name ?? '')

        if (!best || best.score < 0.45) {
            unmatched.push(replacement.name || replacement.original.slice(0, 50))
            continue
        }

        replaceParagraphSpan(
            paragraphs.slice(best.start, best.end),
            replacement.updated ?? '',
        )
        matched += 1
    }

    await saveDocumentXml(zip, xmlDocument, options.outputPath)
    return { matched, unmatched }
}

function stripLeadingTitleArtifact(body: XmlElement) {
    const paragraphs = getChildElements(body, 'w:p')

    for (const paragraph of paragraphs) {
        const textNodes = getTextNodes(paragraph)
        if (textNodes.length === 0) {
            continue
        }

        const joined = textNodes.map(node => node.textContent ?? '').join('').trim()
        if (!joined) {
            continue
        }

        const cleaned = joined.replace(/^[A-Za-z]\s*(?=[\u4e00-\u9fff])/, '')
        if (cleaned === joined) {
            return
        }

        textNodes.forEach((node, index) => {
            node.textContent = index === 0 ? cleaned : ''
        })
        return
    }
}

function stripParagraphNumbering(root: XmlElement) {
    const paragraphs = getParagraphs(root)

    paragraphs.forEach(paragraph => {
        const paragraphProps = getFirstChildElement(paragraph, 'w:pPr')
        if (!paragraphProps) {
            return
        }

        const numProps = getFirstChildElement(paragraphProps, 'w:numPr')
        if (numProps) {
            paragraphProps.removeChild(numProps)
        }
    })
}

export async function createPdfFriendlyDocx(options: {
    inputPath: string
    outputPath: string
}) {
    const { zip, xmlDocument } = await loadDocumentXml(options.inputPath)
    const body = xmlDocument.getElementsByTagName('w:body').item(0)

    if (!body) {
        throw new Error('DOCX 文件缺少正文内容')
    }

    stripLeadingTitleArtifact(body)
    stripParagraphNumbering(body)
    await saveDocumentXml(zip, xmlDocument, options.outputPath)
}
