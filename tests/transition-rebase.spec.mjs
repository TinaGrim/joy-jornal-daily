// Pure unit tests for the demo → google session-transition rebase
// (src/lib/journalTransition.ts). These run in Node WITHOUT a browser because
// the rebase is a pure, dependency-injected computation.
//
// Scenario under test (critic finding C): when a demo visitor signs in with
// Google, the live pages/metadata state still holds the demo journey. When
// adoption does NOT carry that content (account already adopted, real book
// already edited, or intent consumed without a carry), the cloud init/merge
// save paths would otherwise publish demo records into the real shared cloud
// journal. The rebase must resolve the live state to the REAL journal (or the
// shipped default template) — never to demo content.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { computeDemoToGoogleRebase } from '../src/lib/journalTransition.ts'

const identity = (x) => x

function makeInput(overrides = {}) {
  const realPages = overrides.realPages ?? [{ id: 'p1', elements: [] }]
  const realMeta = overrides.realMeta ?? { anniversaryDate: '01.01.2020', milestones: [], occasions: [], journeyDetails: {} }
  const defaultPages = [{ id: 'cover', elements: [] }]
  const defaultMeta = { anniversaryDate: '16.11.2025', milestones: [], occasions: [], journeyDetails: { title: 'X' } }
  return {
    loadRealPages: () => overrides.noRealPages ? null : realPages,
    loadRealMetadata: () => overrides.noRealMeta ? null : realMeta,
    getDefaultPages: () => defaultPages,
    getDefaultMetadata: () => defaultMeta,
    dedupe: overrides.dedupe ?? identity,
    sanitize: overrides.sanitize ?? identity,
  }
}

test('no-adoption transition: rebases to the REAL local journal, never demo content', () => {
  const out = computeDemoToGoogleRebase(makeInput())
  assert.deepEqual(out.pages, [{ id: 'p1', elements: [] }])
  assert.equal(out.metadata.anniversaryDate, '01.01.2020')
})

test('when no real book exists yet, falls back to the shipped default template (not demo)', () => {
  const out = computeDemoToGoogleRebase(makeInput({ noRealPages: true, noRealMeta: true }))
  assert.deepEqual(out.pages, [{ id: 'cover', elements: [] }])
  assert.equal(out.metadata.anniversaryDate, '16.11.2025')
})

test('metadata fields that are null fall back to the real/default source', () => {
  const realMeta = { anniversaryDate: null, milestones: ['m1'], occasions: [], journeyDetails: null }
  const out = computeDemoToGoogleRebase(makeInput({ realMeta }))
  assert.equal(out.metadata.anniversaryDate, '16.11.2025')
  assert.deepEqual(out.metadata.milestones, ['m1'])
  assert.equal(out.metadata.anniversaryDate, '16.11.2025')
})

test('rebase result flows through dedupe + sanitize', () => {
  let dedupeCalls = 0
  let sanitizeCalls = 0
  const out = computeDemoToGoogleRebase(makeInput({
    dedupe: (p) => { dedupeCalls++; return p },
    sanitize: (p) => { sanitizeCalls++; return p },
  }))
  assert.ok(out.pages.length === 1)
  assert.equal(dedupeCalls, 1)
  assert.equal(sanitizeCalls, 1)
})
