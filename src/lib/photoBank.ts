import { useEffect, useReducer } from 'react'
import { ref, get, set } from 'firebase/database'
import { rtdb } from '@/lib/firebase'

const PHOTO_BANK_PATH = 'journal/v2/photos'
export const PHOTO_REF_PREFIX = 'jv2photo:'

// Level-1 cache: resolved data URLs for this session.
const cache = new Map<string, string>()
// Level-2 cache: persisted across reloads so photos render even before
// (or without) a working RTDB connection. Small entries only — localStorage
// quota is ~5MB and photos can be megabytes.
const L2_KEY = 'journal_photo_bank_v1'
const L2_MAX_ENTRY = 300 * 1024
const L2_MAX_TOTAL = 2.5 * 1024 * 1024

const inFlight = new Map<string, Promise<string | null>>()

function loadL2(): Map<string, string> {
  const map = new Map<string, string>()
  try {
    const raw = localStorage.getItem(L2_KEY)
    if (!raw) return map
    const obj = JSON.parse(raw) as Record<string, unknown>
    for (const [k, v] of Object.entries(obj)) {
      if (typeof v === 'string') map.set(k, v)
    }
  } catch { /* corrupted or unavailable */ }
  return map
}

function persistL2(id: string, dataUrl: string) {
  try {
    if (dataUrl.length > L2_MAX_ENTRY) return
    const map = loadL2()
    map.delete(id)
    map.set(id, dataUrl)
    // Evict oldest entries until under the total budget (Map keeps insertion order).
    let total = 0
    for (const v of map.values()) total += v.length
    for (const k of map.keys()) {
      if (total <= L2_MAX_TOTAL) break
      const v = map.get(k)
      if (!v) continue
      total -= v.length
      map.delete(k)
    }
    const out: Record<string, string> = {}
    for (const [k, v] of map) out[k] = v
    localStorage.setItem(L2_KEY, JSON.stringify(out))
  } catch { /* quota exceeded or storage unavailable — best effort */ }
}

export function isPhotoRef(src: unknown): src is string {
  return typeof src === 'string' && src.startsWith(PHOTO_REF_PREFIX)
}

export function photoRefId(src: string): string {
  return src.slice(PHOTO_REF_PREFIX.length)
}

export function makePhotoRef(id: string): string {
  return `${PHOTO_REF_PREFIX}${id}`
}

export function storePhotoData(id: string, dataUrl: string) {
  cache.set(id, dataUrl)
  persistL2(id, dataUrl)
  if (rtdb) {
    set(ref(rtdb, `${PHOTO_BANK_PATH}/${id}`), dataUrl).catch(() => {})
  }
}

function lookup(id: string): string | undefined {
  return cache.get(id) ?? loadL2().get(id)
}

export function resolvePhotoSrc(src: unknown): Promise<string | null> {
  if (!isPhotoRef(src)) return Promise.resolve(typeof src === 'string' ? src : null)
  const id = photoRefId(src)
  const cached = lookup(id)
  if (cached !== undefined) {
    cache.set(id, cached)
    return Promise.resolve(cached)
  }
  const pending = inFlight.get(id)
  if (pending) return pending
  const p = (async () => {
    try {
      if (!rtdb) return null
      const snap = await get(ref(rtdb, `${PHOTO_BANK_PATH}/${id}`))
      const val = snap.val()
      if (typeof val === 'string') {
        cache.set(id, val)
        persistL2(id, val)
        return val
      }
      console.warn(`[photoBank] Photo ${id} not found in RTDB`)
      return null
    } catch (err) {
      console.warn(`[photoBank] Failed to resolve photo ${id}:`, err)
      return null
    } finally {
      inFlight.delete(id)
    }
  })()
  inFlight.set(id, p)
  return p
}

export function usePhotoSrc(src: unknown): string | undefined {
  // The module-level `cache` is read during render (external store pattern);
  // the async resolution only bumps a counter to re-read it, so setState is
  // never called synchronously inside the effect body.
  const [, bump] = useReducer((n: number) => n + 1, 0)

  useEffect(() => {
    if (!isPhotoRef(src)) return
    const id = photoRefId(src)
    const known = lookup(id)
    if (known !== undefined) {
      cache.set(id, known)
      return
    }
    let cancelled = false
    // Retry with backoff so transient failures (offline tab, shields
    // toggling, socket blips) self-heal instead of leaving a blank box.
    let timer: ReturnType<typeof setTimeout> | undefined
    let attempt = 0
    const attemptFetch = () => {
      if (cancelled) return
      attempt++
      resolvePhotoSrc(src).then(val => {
        if (cancelled) return
        if (val) {
          bump()
          return
        }
        if (attempt < 5) timer = setTimeout(attemptFetch, 2000 * attempt)
      })
    }
    attemptFetch()
    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    }
  }, [src, bump])

  if (!isPhotoRef(src)) return typeof src === 'string' ? src : undefined
  const id = photoRefId(src)
  const val = lookup(id)
  if (val !== undefined && !cache.has(id)) cache.set(id, val)
  return val
}
