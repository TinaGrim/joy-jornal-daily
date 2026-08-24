import { useEffect, useState } from 'react'
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
      return null
    } catch {
      return null
    } finally {
      inFlight.delete(id)
    }
  })()
  inFlight.set(id, p)
  return p
}

export function usePhotoSrc(src: unknown): string | undefined {
  const [resolved, setResolved] = useState<string | undefined>(undefined)

  useEffect(() => {
    if (!isPhotoRef(src)) {
      setResolved(typeof src === 'string' ? src : undefined)
      return
    }
    const cached = cache.get(photoRefId(src))
    if (cached !== undefined) {
      setResolved(cached)
      return
    }
    setResolved(undefined)
    let cancelled = false
    resolvePhotoSrc(src).then(val => {
      if (!cancelled && val) setResolved(val)
    })
    return () => {
      cancelled = true
    }
  }, [src])
  return resolved
}
