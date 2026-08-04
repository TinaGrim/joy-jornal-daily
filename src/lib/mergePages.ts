import type { Page, CanvasElement } from '@/types/journal'

export interface PageSnapshot {
  pages: Page[]
  updatedAt: number
  deviceId: string
}

const TOMBSTONE_RETENTION_MS = 30 * 24 * 60 * 60 * 1000

function elementTimestamp(el: CanvasElement): number {
  const ts = el.data?._updatedAt
  return typeof ts === 'number' ? ts : 0
}

function pageTimestamp(page: Page): number {
  let max = 0
  for (const el of page.elements ?? []) {
    max = Math.max(max, elementTimestamp(el))
  }
  return max
}

/**
 * Merges per-device page snapshots into one canonical state.
 * Per element id the copy with the newest `_updatedAt` wins; deleted
 * elements are tombstones (`data._deleted`) so they never resurrect from
 * a stale device slot. Stale tombstones older than a month are pruned.
 * Elements are sorted by id so the output is deterministic across devices.
 */
export function mergePageSnapshots(slots: PageSnapshot[]): Page[] {
  if (slots.length === 0) return []
  const pageCount = Math.max(...slots.map(s => s.pages.length))
  const now = Date.now()
  const merged: Page[] = []

  for (let i = 0; i < pageCount; i++) {
    const candidates = slots
      .map(s => s.pages[i])
      .filter((p): p is Page => !!p)
    if (candidates.length === 0) continue

    let newestPage = candidates[0]
    let newestTs = -1
    for (const candidate of candidates) {
      const ts = pageTimestamp(candidate)
      if (ts > newestTs) {
        newestTs = ts
        newestPage = candidate
      }
    }

    const elementsById = new Map<string, CanvasElement>()
    for (const candidate of candidates) {
      for (const el of candidate.elements ?? []) {
        const existing = elementsById.get(el.id)
        if (!existing || elementTimestamp(el) > elementTimestamp(existing)) {
          elementsById.set(el.id, el)
        }
      }
    }

    const elements = [...elementsById.values()]
      .filter(el => !(el.data?._deleted && now - elementTimestamp(el) > TOMBSTONE_RETENTION_MS))
      .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))

    // Collapse duplicate photos: the same image `src` is the same photo even
    // when divergent device copies re-uploaded it under a different element
    // id. Prefer a live copy over a tombstone (deleting one duplicate copy
    // must not delete the photo); among live copies the newest wins.
    const srcSeen = new Map<string, CanvasElement>()
    const unique: CanvasElement[] = []
    for (const el of elements) {
      const src = el.type === 'image' ? el.data?.src : null
      if (typeof src === 'string' && srcSeen.has(src)) {
        const existing = srcSeen.get(src)!
        const elDeleted = !!el.data?._deleted
        const existingDeleted = !!existing.data?._deleted
        const replace = (!elDeleted && existingDeleted)
          || (!elDeleted && !existingDeleted && elementTimestamp(el) > elementTimestamp(existing))
        if (replace) {
          unique[unique.indexOf(existing)] = el
          srcSeen.set(src, el)
        }
        continue
      }
      if (typeof src === 'string') srcSeen.set(src, el)
      unique.push(el)
    }

    merged.push({ ...newestPage, elements: unique })
  }

  return merged
}
