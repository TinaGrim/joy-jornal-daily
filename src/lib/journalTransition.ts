import type { Page } from '@/types/journal'
import type { JournalMetadata } from '@/lib/syncTypes'

export interface JournalTransitionResult {
  pages: Page[]
  metadata: JournalMetadata
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
  const realMeta = input.loadRealMetadata() ?? defaultMeta
  const pages = input.dedupe(input.sanitize(input.loadRealPages() ?? input.getDefaultPages()))
  return {
    pages,
    metadata: {
      anniversaryDate: realMeta.anniversaryDate ?? defaultMeta.anniversaryDate,
      milestones: realMeta.milestones ?? defaultMeta.milestones,
      occasions: realMeta.occasions ?? defaultMeta.occasions,
      journeyDetails: realMeta.journeyDetails ?? defaultMeta.journeyDetails,
    },
  }
}
