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
 * Slots are ordered by deviceId so ties resolve identically on every
 * client regardless of snapshot arrival order, and elements are sorted by
 * id so the output is deterministic across devices.
 */
export function mergePageSnapshots(slots: PageSnapshot[]): Page[] {
  if (slots.length === 0) return []
  const ordered = [...slots].sort((a, b) => (a.deviceId < b.deviceId ? -1 : a.deviceId > b.deviceId ? 1 : 0))
  const pageCount = Math.max(...ordered.map(s => s.pages.length))
  const now = Date.now()
  const merged: Page[] = []

  for (let i = 0; i < pageCount; i++) {
    const candidates = ordered
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

    // Collapse stacked identical text boxes: repeated tap-to-insert (before
    // any edit renamed them) produced piles of identical invisible
    // placeholders on one spot across device slots, which blocked all taps
    // underneath ("cannot select element"). Identical text + font + size +
    // color within a few pixels = same insert duplicated; keep the newest.
    const stackSeen = new Map<string, CanvasElement>()
    const dedupedStacks: CanvasElement[] = []
    for (const el of unique) {
      let stackKey: string | null = null
      if (el.type === 'text') {
        const txt = typeof el.data?.text === 'string' ? el.data.text : ''
        if (txt.trim() !== '') {
          stackKey = [
            el.data.text,
            el.data.font ?? '', el.data.fontSize ?? '', el.data.color ?? '',
            Math.round((el.x ?? 0) / 4), Math.round((el.y ?? 0) / 4),
          ].join('|')
        }
      }
      if (stackKey !== null && stackSeen.has(stackKey)) {
        const existing = stackSeen.get(stackKey)!
        if (elementTimestamp(el) > elementTimestamp(existing)) {
          dedupedStacks[dedupedStacks.indexOf(existing)] = el
          stackSeen.set(stackKey, el)
        }
        continue
      }
      if (stackKey !== null) stackSeen.set(stackKey, el)
      dedupedStacks.push(el)
    }

    merged.push({ ...newestPage, elements: dedupedStacks })
  }

  return merged
}
