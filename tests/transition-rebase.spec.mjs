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
import { computeDemoToGoogleRebase, liveStateBelongsToRealJournal, mayMergeCloudWithLiveState } from '../src/lib/journalTransition.ts'
import { repairDemoMixedJournalPages, isDemoElementId, isDemoMetadata } from '../src/lib/demoMixRepair.ts'

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

// Regression guard for the "signed-in book mixed with the anonymous book" bug:
// the cloud merge/init paths must never read the live state as the real journal
// during (a) a demo session, or (b) the demo→google flip commit where `isDemo`
// is already false but the live state still holds demo content.

test('liveStateBelongsToRealJournal: only \"real\" counts as the real journal', () => {
  assert.equal(liveStateBelongsToRealJournal('real'), true)
  assert.equal(liveStateBelongsToRealJournal('demo'), false)
})

test('mayMergeCloudWithLiveState: blocks every window where live state is demo content', () => {
  // Normal demo session.
  assert.equal(mayMergeCloudWithLiveState(true, true, 'demo'), false)
  // Demo→google flip commit: initialized=true, inDemo already false, but the
  // live pages are STILL the demo book (rebase runs after merge) — must block.
  assert.equal(mayMergeCloudWithLiveState(true, false, 'demo'), false)
  // Uninitialized at startup, live state still demo — blocks.
  assert.equal(mayMergeCloudWithLiveState(false, true, 'demo'), false)
  assert.equal(mayMergeCloudWithLiveState(false, false, 'demo'), false)
  // Genuine real-journal session: the only window that may merge/publish.
  assert.equal(mayMergeCloudWithLiveState(true, false, 'real'), true)
  // In demo mode the live source should be 'demo', so combination is blocked
  // even if a stale ref said 'real' (defense in depth).
  assert.equal(mayMergeCloudWithLiveState(true, true, 'real'), false)
})

// Self-healing repair for the "sign-in mixed with anonymous book" corruption:
// the pre-fix flip fused the demo book into the real journal (pages 0-3 +
// metadata). All demo content carries a `demo-` id prefix, so it is stripped
// deterministically — but only when the book ALSO contains real pages, so an
// intentionally adopted pure-demo book is never gutted.

const realPage = { id: 'real-page', elements: [{ id: 'el-1', type: 'text', data: { text: 'r' } }] }
const demoPage = {
  id: 'demo-cover',
  elements: [
    { id: 'demo-cover-title', type: 'text', data: { text: 'Island' } },
    { id: 'el-2', type: 'text', data: { text: 'kept' } },
  ],
}

test('repair strips demo pages + demo elements from a mixed real journal', () => {
  const out = repairDemoMixedJournalPages([demoPage, realPage])
  assert.deepEqual(out.pages, realPage ? [{ ...realPage }] : [])
  assert.equal(out.pagesRemoved, true)
  // Demo elements live in the demo page (removed wholesale by pagesRemoved),
  // not in any real page, so elementsRemoved stays false here.
  assert.equal(out.elementsRemoved, false)
  // The real page's own elements are untouched.
  assert.deepEqual(out.pages[0].elements, realPage.elements)
})

test('repair leaves an adopted pure-demo book intact (never guts FR-010/011)', () => {
  const pure = [demoPage]
  const out = repairDemoMixedJournalPages(pure)
  assert.equal(out.pagesRemoved, false)
  assert.equal(out.elementsRemoved, false)
  assert.deepEqual(out.pages, pure)
})

test('repair strips demo elements mixed into a real page', () => {
  const mixed = [{
    id: 'real-page',
    elements: [
      { id: 'el-1', type: 'text', data: { text: 'real' } },
      { id: 'demo-pasted', type: 'text', data: { text: 'from demo' } },
    ],
  }]
  const out = repairDemoMixedJournalPages(mixed)
  assert.equal(out.pagesRemoved, false)
  assert.equal(out.elementsRemoved, true)
  assert.deepEqual(out.pages[0].elements, [{ id: 'el-1', type: 'text', data: { text: 'real' } }])
})

test('repair is idempotent: no real content is ever removed', () => {
  const mixed = [demoPage, realPage]
  const first = repairDemoMixedJournalPages(mixed)
  const second = repairDemoMixedJournalPages(first.pages)
  assert.equal(second.pagesRemoved, false)
  assert.equal(second.elementsRemoved, false)
  assert.deepEqual(second.pages, first.pages)
})

test('isDemoMetadata detects the shipped anonymous demo metadata', () => {
  const demoMeta = { anniversaryDate: '02.08.2026', milestones: [], occasions: [], journeyDetails: { title: 'Island Escape Notes', dates: 'August 2-5, 2026', destination: 'Santorini', flag: '🇬🇷' } }
  assert.equal(isDemoMetadata(demoMeta), true)
  assert.equal(isDemoMetadata({ ...demoMeta, journeyDetails: null }), false)
})

test('isDemoElementId prefixes only', () => {
  assert.equal(isDemoElementId('demo-cover-title'), true)
  assert.equal(isDemoElementId('el-2'), false)
})
