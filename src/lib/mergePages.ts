import type { Page, CanvasElement } from '../types/journal.ts'

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
 * Identity of a piece of visual content for collapse purposes: text boxes
 * (including invisible empty placeholders), stickers and emoji are the same
 * visual when their rendered content and style land on the same cell.
 * Position is quantized to a 4px grid so near-identical stacks (e.g. from
 * tap-to-insert or a merge of divergent device slots) collapse together while
 * elements placed on genuinely different spots never match.
 */
export function visualStackKey(el: CanvasElement): string | null {
  const rx = Math.round((el.x ?? 0) / 4)
  const ry = Math.round((el.y ?? 0) / 4)
  if (el.type === 'text') {
    const txt = el.data?.text
    if (typeof txt !== 'string') return null
    return ['text', txt, el.data.font ?? '', el.data.fontSize ?? '', el.data.color ?? '', rx, ry].join('|')
  }
  if (el.type === 'sticker') {
    const src = el.data?.src
    if (typeof src !== 'string' || src === '') return null
    return ['sticker', src, rx, ry].join('|')
  }
  if (el.type === 'emoji') {
    const emoji = el.data?.emoji
    if (typeof emoji !== 'string' || emoji === '') return null
    return ['emoji', emoji, rx, ry].join('|')
  }
  return null
}

function shouldReplace(existing: CanvasElement, el: CanvasElement): boolean {
  const existingDeleted = !!existing.data?._deleted
  const elDeleted = !!el.data?._deleted
  // A live copy always beats a tombstone: deleting one duplicate copy must
  // not delete the visual. Among live copies the newest `_updatedAt` wins.
  if (!elDeleted && existingDeleted) return true
  if (!elDeleted && !existingDeleted && elementTimestamp(el) > elementTimestamp(existing)) return true
  return false
}

/**
 * Removes duplicate copies of the same visual content within ONE page:
 * - images: one per unique `src` (the same photo re-uploaded by divergent
 *   device slots lands under different element ids);
 * - text / stickers / emoji: one per `visualStackKey` (same content + style
 *   on the same cell). Empty text placeholders are included — piles of
 *   identical invisible boxes block every tap underneath.
 * Tombstoned duplicates are removed when a live copy exists.
 */
export function collapseVisualDuplicates(elements: CanvasElement[]): CanvasElement[] {
  const out: CanvasElement[] = []
  const srcSeen = new Map<string, CanvasElement>()
  const stackSeen = new Map<string, CanvasElement>()
  for (const el of elements) {
    const src = el.type === 'image' && typeof el.data?.src === 'string' ? el.data.src : null
    if (src !== null && srcSeen.has(src)) {
      if (shouldReplace(srcSeen.get(src)!, el)) {
        out[out.indexOf(srcSeen.get(src)!)] = el
        srcSeen.set(src, el)
      }
      continue
    }
    if (src !== null) srcSeen.set(src, el)

    const key = visualStackKey(el)
    if (key !== null && stackSeen.has(key)) {
      if (shouldReplace(stackSeen.get(key)!, el)) {
        out[out.indexOf(stackSeen.get(key)!)] = el
        stackSeen.set(key, el)
      }
      continue
    }
    if (key !== null) stackSeen.set(key, el)
    out.push(el)
  }
  return out
}

/**
 * Makes every page id unique. A page list can accumulate two distinct real
 * pages that share one id (e.g. the id sequence was reused before). Merging
 * those into one page would destroy one of them, and rendering both leaves
 * repeated "Pg X–Y" labels, so every duplicate is renumbered deterministically
 * (`page-4` → `page-4-2`). Index-based — positions are untouched, only the
 * cosmetic page label changes.
 */
export function ensureUniquePageIds(pages: Page[]): Page[] {
  const seen = new Map<string, number>()
  return pages.map(p => {
    const n = (seen.get(p.id) ?? 0) + 1
    seen.set(p.id, n)
    if (n === 1) return p
    return { ...p, id: `${p.id}-${n}` }
  })
}

/**
 * Guards a restore/undo publish against resurrection from OTHER device slots.
 * Every live element in `other` for a page whose element id is absent from
 * the `restored` page is rewritten as a fresh tombstone. Publishing that back
 * to the origin's own cloud slot means the next cross-slot merge — which picks
 * the newest `_updatedAt` per id — kills the stale duplicate copies instead of
 * re-uniting them onto the restored book. Indexes beyond the restored book
 * (real additions from another device) are left untouched.
 */
export function tombstoneExtrasForRestore(restored: Page[], other: Page[], now: number): Page[] {
  return restored.map((p, i) => {
    const kept = p.elements ?? []
    const keptIds = new Set<string>()
    for (const el of kept) keptIds.add(el.id)
    const orphans = (other[i]?.elements ?? [])
      .filter(el => !el.data?._deleted && !keptIds.has(el.id))
      .map(el => ({ ...el, data: { ...el.data, _deleted: true, _updatedAt: now } }))
    if (orphans.length === 0) return p
    return { ...p, elements: [...kept, ...orphans] }
  })
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

    // Collapse duplicate copies of the same visual (photo/text/sticker/emoji)
    // so merging divergent device slots never stacks identical content on a
    // spot. Deterministic across devices: the element order is id-sorted and
    // the collapse is keyed/order-stable.
    const collapsed = collapseVisualDuplicates(elements)

    merged.push({ ...newestPage, elements: collapsed })
  }

  return merged
}
