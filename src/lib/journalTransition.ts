import type { Page } from '../types/journal.ts'
import type { JournalMetadata } from './syncTypes.ts'
import { repairDemoMixedJournalPages, isDemoMetadata } from './demoMixRepair.ts'

export interface JournalTransitionResult {
  pages: Page[]
  metadata: JournalMetadata
}

/**
 * Which content the LIVE pages state currently holds. The live state holds demo
 * content in two windows that must never be merged into — or published as — the
 * real journal:
 *
 * 1. while a demo session is active, and
 * 2. during the brief session-flip commit after demo → google, BEFORE the
 *    rebase effect swaps `pages` to the real journal (at that moment `isDemo`
 *    is already `false` but the live state is still the demo book).
 *
 * Every real-journal cloud path (init/publish, merge, adoption, storage writes)
 * must gate on this so stale demo content can never leak into the real journal.
 */
export type LiveJournalSource = 'demo' | 'real'

/** True only when the live state genuinely belongs to the real journal. */
export function liveStateBelongsToRealJournal(liveSource: LiveJournalSource): boolean {
  return liveSource === 'real'
}

/**
 * Eligibility for the cloud init/merge paths: the live state may only be merged
 * with (or published as) the real journal when the session is initialized, not
 * in demo mode, AND the live state is genuinely the real journal. The middle
 * condition alone is NOT enough — during the demo→google flip `inDemo` is
 * already false while `liveSource` is still 'demo'.
 */
export function mayMergeCloudWithLiveState(
  initialized: boolean,
  inDemo: boolean,
  liveSource: LiveJournalSource,
): boolean {
  return initialized && !inDemo && liveSource === 'real'
}

export interface DemoToGoogleRebaseInput {
  loadRealPages: () => Page[] | null
  loadRealMetadata: () => JournalMetadata | null
  getDefaultPages: () => Page[]
  getDefaultMetadata: () => JournalMetadata
  dedupe: (pages: Page[]) => Page[]
  sanitize: (pages: Page[]) => Page[]
}

/**
 * Deterministic rebase target for the live journal state when the session
 * transitions demo → google (a demo visitor signs in with Google).
 *
 * The demo journey may ONLY be carried into the real journal via the adoption
 * path, which fires separately and reads the demo storage directly. This rebase
 * must therefore resolve to the REAL local journal — or the shipped default
 * template when no real book exists yet — so the cloud init/merge/save paths
 * (which run as soon as sync resolves, independently of adoption) never publish
 * demo records into the shared cloud journal. Later demo edits are never
 * re-carried. Pure: every dependency is injected, so it is unit-testable in
 * Node without React, localStorage, or Firebase.
 */
export function computeDemoToGoogleRebase(input: DemoToGoogleRebaseInput): JournalTransitionResult {
  const defaultMeta = input.getDefaultMetadata()
  // A pre-fix session may have written the anonymous demo metadata into the
  // real journal_metadata key; never carry that identity into a google session.
  const rawRealMeta = input.loadRealMetadata() ?? defaultMeta
  const realMeta = isDemoMetadata(rawRealMeta) ? defaultMeta : rawRealMeta
  const rawPages = input.loadRealPages() ?? input.getDefaultPages()
  // Strip any demo pages/elements already fused into the real book (the
  // sign-in-mixed-with-demo corruption), so the cloud init/merge/save paths
  // start from a clean real journal.
  const repaired = repairDemoMixedJournalPages(input.dedupe(input.sanitize(rawPages)))
  return {
    pages: repaired.pages,
    metadata: {
      anniversaryDate: realMeta.anniversaryDate ?? defaultMeta.anniversaryDate,
      milestones: realMeta.milestones ?? defaultMeta.milestones,
      occasions: realMeta.occasions ?? defaultMeta.occasions,
      journeyDetails: realMeta.journeyDetails ?? defaultMeta.journeyDetails,
    },
  }
}
