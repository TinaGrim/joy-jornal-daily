// Unit tests for the per-page visual duplicate collapse used by the cloud
// merge (mergePageSnapshots) and by the local publish path
// (JournalContext.deduplicatePageElements). Pure, runs in Node without a
// browser.
//
// Regression: merging divergent device slots piled identical content onto one
// spot — stickers and empty invisible text placeholders were never deduped,
// producing books that were "so many duplicated image, text, stick over the
// book and messy" before a restore.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mergePageSnapshots, collapseVisualDuplicates, visualStackKey } from '../src/lib/mergePages.ts'

const NOW = 1_700_000_000_000 // realistic modern timestamp base

const PAGE = { id: 'p1', background: '#fff', pattern: 'blank' }

function element(overrides) {
  return {
    id: 'e', type: 'text', x: 0, y: 0, width: 100, height: 50, rotation: 0, zIndex: 1,
    data: { _updatedAt: NOW }, ...overrides,
  }
}

// Two divergent device slots: slot A and slot B each hold their own page at
// index 0 carrying a different element copy of the same visual content.
function mergeTwo(a, b) {
  return mergePageSnapshots([
    { deviceId: 'dev-A', updatedAt: 1, pages: [{ ...PAGE, elements: [a] }] },
    { deviceId: 'dev-B', updatedAt: 1, pages: [{ ...PAGE, elements: [b] }] },
  ])
}

test('identical stickers on the same cell collapse across slots (was 2, now 1)', () => {
  const a = element({ id: 'a', type: 'sticker', x: 100, y: 100, data: { src: '🎀', _updatedAt: NOW + 2 } })
  const b = element({ id: 'b', type: 'sticker', x: 101, y: 100, data: { src: '🎀', _updatedAt: NOW + 3 } })
  const out = mergeTwo(a, b)
  assert.equal(out[0].elements.length, 1)
  assert.equal(out[0].elements[0].id, 'b') // newest wins
})

test('piles of identical empty text placeholders collapse (was 2, now 1)', () => {
  const a = element({ id: 'a', type: 'text', x: 50, y: 50, data: { text: '', font: 'Caveat', fontSize: 24, color: '#2c3e50', _updatedAt: NOW + 2 } })
  const b = element({ id: 'b', type: 'text', x: 52, y: 50, data: { text: '', font: 'Caveat', fontSize: 24, color: '#2c3e50', _updatedAt: NOW + 4 } })
  const out = mergeTwo(a, b)
  assert.equal(out[0].elements.length, 1)
  assert.equal(out[0].elements[0].id, 'b')
})

test('distinct stickers on the same cell are preserved as intentional', () => {
  const a = element({ id: 'a', type: 'sticker', x: 100, y: 100, data: { src: '🎀', _updatedAt: NOW + 2 } })
  const b = element({ id: 'b', type: 'sticker', x: 100, y: 100, data: { src: '🌸', _updatedAt: NOW + 3 } })
  const out = mergeTwo(a, b)
  assert.equal(out[0].elements.length, 2)
})

test('same content on a genuinely different cell is preserved', () => {
  const a = element({ id: 'a', type: 'sticker', x: 100, y: 100, data: { src: '🎀', _updatedAt: NOW + 2 } })
  const b = element({ id: 'b', type: 'sticker', x: 400, y: 100, data: { src: '🎀', _updatedAt: NOW + 3 } })
  const out = mergeTwo(a, b)
  assert.equal(out[0].elements.length, 2)
})

test('non-empty identical text on same cell still collapses (regression)', () => {
  const a = element({ id: 'a', type: 'text', x: 50, y: 50, data: { text: 'hello', font: 'Caveat', fontSize: 24, color: '#2c3e50', _updatedAt: NOW + 2 } })
  const b = element({ id: 'b', type: 'text', x: 51, y: 50, data: { text: 'hello', font: 'Caveat', fontSize: 24, color: '#2c3e50', _updatedAt: NOW + 5 } })
  const out = mergeTwo(a, b)
  assert.equal(out[0].elements.length, 1)
  assert.equal(out[0].elements[0].id, 'b')
})

test('same cell but different text content survives', () => {
  const a = element({ id: 'a', type: 'text', x: 50, y: 50, data: { text: 'hello', font: 'Caveat', fontSize: 24, color: '#2c3e50', _updatedAt: NOW + 2 } })
  const b = element({ id: 'b', type: 'text', x: 51, y: 50, data: { text: 'friend', font: 'Caveat', fontSize: 24, color: '#2c3e50', _updatedAt: NOW + 3 } })
  const out = mergeTwo(a, b)
  assert.equal(out[0].elements.length, 2)
})

test('photos: same src collapses, different src survives (regression)', () => {
  const sameA = element({ id: 'a', type: 'image', data: { src: 'data:img/1', _updatedAt: NOW + 2 } })
  const sameB = element({ id: 'b', type: 'image', data: { src: 'data:img/1', _updatedAt: NOW + 3 } })
  const out = mergeTwo(sameA, sameB)
  assert.equal(out[0].elements.length, 1)
  assert.equal(out[0].elements[0].id, 'b')
  const diffC = element({ id: 'c', type: 'image', data: { src: 'data:img/2', _updatedAt: NOW + 4 } })
  const out2 = mergePageSnapshots([{ deviceId: 'x', updatedAt: 1, pages: [{ ...PAGE, elements: [sameA, diffC] }] }])
  assert.equal(out2[0].elements.length, 2)
})

test('live duplicate wins over tombstoned duplicate of the same visual', () => {
  const deleted = element({ id: 'a', type: 'sticker', x: 100, y: 100, data: { src: '🎀', _deleted: true, _updatedAt: NOW + 9 } })
  const live = element({ id: 'b', type: 'sticker', x: 100, y: 100, data: { src: '🎀', _updatedAt: NOW + 2 } })
  const out = mergeTwo(deleted, live)
  assert.equal(out[0].elements.length, 1)
  assert.equal(out[0].elements[0].id, 'b')
  assert.equal(out[0].elements[0].data._deleted, undefined)
})

test('collapseVisualDuplicates keeps order and merges on the same cell', () => {
  const a = element({ id: 'a', type: 'text', x: 50, y: 50, data: { text: 'x', font: 'Caveat', fontSize: 24, color: '#2c3e50', _updatedAt: NOW + 2 } })
  const b = element({ id: 'b', type: 'text', x: 52, y: 50, data: { text: 'x', font: 'Caveat', fontSize: 24, color: '#2c3e50', _updatedAt: NOW + 3 } })
  const c = element({ id: 'c', type: 'sticker', x: 10, y: 10, data: { src: '🚗', _updatedAt: NOW + 4 } })
  const out = collapseVisualDuplicates([a, b, c])
  assert.deepEqual(out.map(e => e.id), ['b', 'c'])
})

test('visualStackKey covers stickers, emoji and empty text; rejects others', () => {
  assert.equal(visualStackKey(element({ type: 'sticker', data: { src: '🎀' } })), 'sticker|🎀|0|0')
  assert.equal(visualStackKey(element({ type: 'emoji', data: { emoji: '😀' } })), 'emoji|😀|0|0')
  assert.equal(visualStackKey(element({ type: 'text', data: { text: '' } })).startsWith('text|'), true)
  assert.equal(visualStackKey(element({ type: 'image', data: { src: 'x' } })), null)
  assert.equal(visualStackKey(element({ type: 'shape', data: { fill: '#f00' } })), null)
})