import assert from 'node:assert/strict'
import test from 'node:test'

import { LAYERS, appendFollowUps, parseLayerReview } from '../lib/answer-layers.ts'

const coverage = Object.fromEntries(LAYERS.map((layer) => [layer.name, 'hit']))

test('parses a valid layered review', () => {
    const review = parseLayerReview(JSON.stringify({ coverage: { ...coverage, 依据: 'miss' }, feedback: '缺少依据', followUp: { layer: '依据', prompt: '这个数字怎么来的？' } }))
    assert.equal(review?.coverage['依据'], 'miss')
    assert.equal(review?.followUp?.layer, '依据')
})

test('returns null for legacy plain-text or malformed reviews', () => {
    assert.equal(parseLayerReview('旧版纯文本点评'), null)
    assert.equal(parseLayerReview(JSON.stringify({ fixture: true })), null)
    assert.equal(parseLayerReview(JSON.stringify({ coverage: { ...coverage, 口径: 'great' }, feedback: 'x' })), null)
})

test('drops follow-up that names an unknown layer', () => {
    const review = parseLayerReview(JSON.stringify({ coverage, feedback: '很好', followUp: { layer: '随便', prompt: '?' } }))
    assert.equal(review?.followUp, null)
})

test('appends follow-up rounds after the original answer', () => {
    assert.equal(appendFollowUps('原回答', []), '原回答')
    assert.equal(appendFollowUps('原回答', [{ prompt: '依据？', answer: 'AB 实验' }]), '原回答\n\n【追问 1：依据？】\nAB 实验')
})
