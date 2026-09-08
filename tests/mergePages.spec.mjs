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
import { mergePageSnapshots, collapseVisualDuplicates, visualStackKey, ensureUniquePageIds, tombstoneExtrasForRestore } from '../src/lib/mergePages.ts'

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

test('duplicate page ids are renumbered, first occurrence keeps the id', () => {
  const a = { ...PAGE, id: 'page-4', elements: [element({ id: 'x' })] }
  const b = { ...PAGE, id: 'page-4', elements: [element({ id: 'y' })] }
  const c = { ...PAGE, id: 'page-5', elements: [] }
  const out = ensureUniquePageIds([a, b, c])
  assert.deepEqual(out.map(p => p.id), ['page-4', 'page-4-2', 'page-5'])
  assert.ok(out[0].elements[0].id === 'x' && out[1].elements[0].id === 'y')
})

test('duplicate page ids are renumbered deterministically across runs', () => {
  const pages = [0, 1, 2].map(i => ({ ...PAGE, id: 'dup', elements: [] }))
  const a = ensureUniquePageIds(pages)
  const b = ensureUniquePageIds(pages)
  assert.deepEqual(a.map(p => p.id), b.map(p => p.id))
  assert.deepEqual(a.map(p => p.id), ['dup', 'dup-2', 'dup-3'])
})

test('restore tombstone guard: other-slot orphan ids become tombstones', () => {
  const restored = [{ ...PAGE, id: 'page-4', elements: [element({ id: 'kept', data: { _updatedAt: NOW + 0 } })] }]
  const cloud = [
    { ...PAGE, id: 'page-4', elements: [
      element({ id: 'kept', data: { _updatedAt: NOW } }),
      element({ id: 'stale-dup', type: 'sticker', x: 100, y: 100, data: { src: '🎀', _updatedAt: NOW - 5000 } }),
      element({ id: 'ghost', type: 'text', data: { _deleted: true, _updatedAt: NOW } }),
    ] },
    { ...PAGE, id: 'extra-page', elements: [element({ id: 'real-new', data: { _updatedAt: NOW } })] },
  ]
  const out = tombstoneExtrasForRestore(restored, cloud, NOW + 100)
  const els = out[0].elements
  assert.equal(els.length, 2) // kept + stale-dup tombstone; ghost was already deleted
  assert.equal(els[0].id, 'kept')
  assert.equal(els[0].data._deleted, undefined)
  assert.equal(els[1].id, 'stale-dup')
  assert.equal(els[1].data._deleted, true)
  assert.equal(els[1].data._updatedAt, NOW + 100)
})

test('restore tombstone guard: merging the tombstone back kills the stale slot copy', () => {
  const restored = [{ ...PAGE, elements: [element({ id: 'kept', data: { _updatedAt: NOW + 100 } })] }]
  const cloudRaw = [{ ...PAGE, elements: [element({ id: 'kept', data: { _updatedAt: NOW + 100 } }), element({ id: 'stale-dup', type: 'text', data: { text: 'dup', _updatedAt: NOW - 5000 } })] }]
  const withTombstones = tombstoneExtrasForRestore(restored, cloudRaw, NOW + 100)
  // another device still holds the stale live copy
  const staleSlot = [{ ...PAGE, elements: [element({ id: 'kept', data: { _updatedAt: NOW + 100 } }), element({ id: 'stale-dup', type: 'text', data: { text: 'dup', _updatedAt: NOW - 5000 } })] }]
  const merged = mergePageSnapshots([
    { deviceId: 'cloud', updatedAt: 0, pages: withTombstones },
    { deviceId: 'stale-device', updatedAt: 0, pages: staleSlot },
  ])
  const ids = merged[0].elements.filter(e => !e.data?._deleted).map(e => e.id)
  assert.deepEqual(ids, ['kept']) // stale-dup does not resurrect
})