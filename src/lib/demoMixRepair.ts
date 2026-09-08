import type { Page, CanvasElement } from '../types/journal.ts'
import type { JournalMetadata } from './syncTypes.ts'
import { getDemoMetadata as seedDemoMetadata } from './demoContent.ts'

/**
 * Self-healing repair for the "signed-in journal mixed with the anonymous demo
 * book" corruption.
 *
 * The pre-fix flip merge published demo pages/elements into the REAL journal
 * (both journal_pages and the Firebase cloud slot), and mergePageSnapshots
 * merges per page index — so the four demo pages were fused into the real
 * book's first slots (pages 0-3) and every later merge re-introduces them from
 * either slot. All demo content is recognizable by its `demo-` id prefix
 * (see demoContent.ts), so it can be stripped deterministically.
 *
 * The strip is conservative: it fires ONLY when the book still contains real
 * (non-demo) pages. An intentionally adopted pure-demo book (FR-010/FR-011)
 * is left untouched. Idempotent and deterministic, so it can run on every
 * merge/publish/ingest path without a one-time marker.
 */

const DEMO_PREFIX = 'demo-'

export function isDemoPageId(id: string): boolean {
  return id.startsWith(DEMO_PREFIX)
}

export function isDemoElementId(id: string): boolean {
  return id.startsWith(DEMO_PREFIX)
}

export interface DemoMixRepairResult {
  pages: Page[]
  pagesRemoved: boolean
  elementsRemoved: boolean
}

export function repairDemoMixedJournalPages(pages: Page[]): DemoMixRepairResult {
  const hasRealPages = pages.some(p => !isDemoPageId(p.id))
  if (!hasRealPages) {
    // Pure demo book (freshly adopted) — never rip its journey out of a real
    // signed-in journal.
    return { pages, pagesRemoved: false, elementsRemoved: false }
  }
  const keptPages = pages.filter(p => !isDemoPageId(p.id))
  let elementsRemoved = false
  const cleaned = keptPages.map(p => {
    const elements = (p.elements ?? []).filter((el: CanvasElement) => {
      const drop = isDemoElementId(el.id)
      if (drop) elementsRemoved = true
      return !drop
    })
    return { ...p, elements }
  })
  return {
    pages: cleaned,
    pagesRemoved: keptPages.length !== pages.length,
    elementsRemoved,
  }
}

/** True when the metadata is exactly the shipped anonymous demo metadata. */
export function isDemoMetadata(meta: JournalMetadata): boolean {
  try {
    return JSON.stringify(meta) === JSON.stringify(seedDemoMetadata())
  } catch {
    return false
  }
}