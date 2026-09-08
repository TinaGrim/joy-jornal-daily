// Unit tests for the backup/checkpoint payload helpers. A checkpoint now IS a
// backup (version + pages + metadata), so it can be downloaded and restored
// with the same Restore-from-Backup path. Pure functions — run in Node without
// a browser (downloadJson is DOM-bound and is intentionally not covered here).

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { BACKUP_VERSION, buildBackup, normalizeCheckpointPayload } from '../src/lib/journalBackup.ts'

const PAGE = { id: 'p1', background: '#f0e6d3', pattern: 'blank', elements: [] }
const META = { anniversaryDate: '2024-01-01', milestones: [], occasions: [], journeyDetails: 'Trip' }

test('buildBackup wraps pages + metadata with version and exportedAt', () => {
  const pages = [PAGE, { ...PAGE, id: 'p2', elements: [{ id: 'e1', type: 'text', x: 0, y: 0, width: 10, height: 10, rotation: 0, zIndex: 1, data: {} }] }]
  const out = buildBackup(pages, META, '2026-09-08T00:00:00.000Z')
  assert.equal(out.version, BACKUP_VERSION)
  assert.equal(out.exportedAt, '2026-09-08T00:00:00.000Z')
  assert.equal(out.pages, pages)
  assert.deepEqual(out.metadata, META)
})

test('buildBackup defaults exportedAt to now', () => {
  const out = buildBackup([PAGE], META)
  assert.equal(typeof out.exportedAt, 'string')
  assert.ok(Date.parse(out.exportedAt) > 0)
  assert.equal(out.version, BACKUP_VERSION)
})

test('normalizeCheckpointPayload reads the current payload format (pages + metadata + savedAt)', () => {
  const raw = {
    data: {
      version: BACKUP_VERSION,
      exportedAt: '2026-09-08T00:00:00.000Z',
      savedAt: 1757000000000,
      pages: [PAGE],
      metadata: META,
    },
  }
  const out = normalizeCheckpointPayload(raw)
  assert.ok(out)
  assert.equal(out.pages, raw.data.pages)
  assert.deepEqual(out.metadata, META)
  assert.equal(out.savedAt, 1757000000000)
})

test('normalizeCheckpointPayload accepts the legacy payload format (bare pages array, no metadata)', () => {
  const raw = { data: [PAGE, { ...PAGE, id: 'p2' }] }
  const out = normalizeCheckpointPayload(raw)
  assert.ok(out)
  assert.equal(out.pages.length, 2)
  assert.equal(out.metadata, null)
  assert.equal(out.savedAt, undefined)
})

test('normalizeCheckpointPayload handles metadata:null and missing savedAt in new format', () => {
  const raw = { data: { version: BACKUP_VERSION, pages: [PAGE], metadata: null } }
  const out = normalizeCheckpointPayload(raw)
  assert.ok(out)
  assert.equal(out.metadata, null)
  assert.equal(out.savedAt, undefined)
})

test('normalizeCheckpointPayload rejects non-object and page-less payloads', () => {
  assert.equal(normalizeCheckpointPayload(null), null)
  assert.equal(normalizeCheckpointPayload('nope'), null)
  assert.equal(normalizeCheckpointPayload({ data: 'nope' }), null)
  assert.equal(normalizeCheckpointPayload({ data: {} }), null)
  assert.equal(normalizeCheckpointPayload({ data: { version: BACKUP_VERSION } }), null)
})