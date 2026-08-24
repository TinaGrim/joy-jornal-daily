import { useEffect, useReducer } from 'react'
import { ref, get, set } from 'firebase/database'
import { rtdb } from '@/lib/firebase'

const PHOTO_BANK_PATH = 'journal/v2/photos'
export const PHOTO_REF_PREFIX = 'jv2photo:'

const cache = new Map<string, string>()
const inFlight = new Map<string, Promise<string | null>>()

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
  if (rtdb) {
    set(ref(rtdb, `${PHOTO_BANK_PATH}/${id}`), dataUrl).catch(() => {})
  }
}

export function resolvePhotoSrc(src: unknown): Promise<string | null> {
  if (!isPhotoRef(src)) return Promise.resolve(typeof src === 'string' ? src : null)
  const id = photoRefId(src)
  const cached = cache.get(id)
  if (cached !== undefined) return Promise.resolve(cached)
  const pending = inFlight.get(id)
  if (pending) return pending
  const p = (async () => {
    try {
      if (!rtdb) return null
      const snap = await get(ref(rtdb, `${PHOTO_BANK_PATH}/${id}`))
      const val = snap.val()
      if (typeof val === 'string') {
        cache.set(id, val)
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
    if (cache.has(id)) return
    let cancelled = false
    resolvePhotoSrc(src).then(val => {
      if (!cancelled && val) bump()
    })
    return () => {
      cancelled = true
    }
  }, [src, bump])

  if (!isPhotoRef(src)) return typeof src === 'string' ? src : undefined
  return cache.get(photoRefId(src))
}
