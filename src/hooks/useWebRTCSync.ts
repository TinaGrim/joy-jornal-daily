import { useState, useEffect, useRef, useCallback } from 'react'
import { createSync, type BroadcastSync } from '@/lib/broadcastSync'
import { createFirebaseSync, type FirebaseSync, type CheckpointInfo } from '@/lib/firebaseSync'
import { isFirebaseReady } from '@/lib/firebase'
import type { Page, CanvasElement } from '@/types/journal'
import type { JournalMetadata, SyncOperation } from '@/lib/syncTypes'

const CURSOR_STALE_MS = 5000
const CURSOR_CLEAN_INTERVAL = 2000

interface RemoteCursor {
  id: string
  name: string
  color: string
  x: number
  y: number
  pageIndex: number
  updatedAt: number
}

interface UseWebRTCSyncReturn {
  pages: Page[]
  loading: boolean
  error: Error | null
  savePages: (pages: Page[]) => void
  flushPages: () => void
  saveUserCursor: (userId: string, name: string, color: string, x: number, y: number, pageIndex: number) => void
  isConnected: boolean
  remoteCursors: Omit<RemoteCursor, 'updatedAt'>[]
  metadata: JournalMetadata | null
  saveMetadata: (metadata: JournalMetadata) => void
  broadcastOperation: (operation: SyncOperation) => void
  saveCheckpoint: (pages: Page[], label?: string) => Promise<void>
  getHistory: () => Promise<CheckpointInfo[]>
  loadCheckpoint: (id: string) => Promise<Page[] | null>
  deleteCheckpoint: (id: string) => Promise<void>
  lastLatency: number
  peakLatency: number
}

function applyOperation(pages: Page[], operation: SyncOperation): Page[] {
  const updated = [...pages]
  switch (operation.type) {
    case 'element-add': {
      const { pageIndex, element } = operation
      if (!updated[pageIndex]) return pages
      updated[pageIndex] = { ...updated[pageIndex], elements: [...updated[pageIndex].elements, element] }
      return updated
    }
    case 'element-update': {
      const { pageIndex, elementId, patch } = operation
      if (!updated[pageIndex]) return pages
      updated[pageIndex] = {
        ...updated[pageIndex],
        elements: updated[pageIndex].elements.map(el =>
          el.id === elementId ? { ...el, ...patch, data: { ...el.data, ...patch.data } } : el
        ),
      }
      return updated
    }
    case 'element-delete': {
      const { pageIndex, elementId } = operation
      if (!updated[pageIndex]) return pages
      updated[pageIndex] = {
        ...updated[pageIndex],
        elements: updated[pageIndex].elements.filter(el => el.id !== elementId),
      }
      return updated
    }
    case 'element-move': {
      const { elementId, fromPage, toPage, x, y } = operation
      if (!updated[fromPage] || !updated[toPage]) return pages
      const el = updated[fromPage].elements.find(e => e.id === elementId)
      if (!el) return pages
      updated[fromPage] = { ...updated[fromPage], elements: updated[fromPage].elements.filter(e => e.id !== elementId) }
      updated[toPage] = { ...updated[toPage], elements: [...updated[toPage].elements, { ...el, x, y }] }
      return updated
    }
    case 'page-add': {
      return [...updated, ...operation.pages]
    }
    case 'page-update': {
      const { pageIndex, patch } = operation
      if (!updated[pageIndex]) return pages
      updated[pageIndex] = { ...updated[pageIndex], ...patch }
      return updated
    }
    case 'page-elements-replace': {
      const { pageIndex, elements } = operation
      if (!updated[pageIndex]) return pages
      updated[pageIndex] = { ...updated[pageIndex], elements }
      return updated
    }
    case 'page-clear': {
      const { pageIndex } = operation
      if (!updated[pageIndex]) return pages
      updated[pageIndex] = { ...updated[pageIndex], elements: [] }
      return updated
    }
    default:
      return pages
  }
}

export function useWebRTCSync(enabled: boolean): UseWebRTCSyncReturn {
  const [pages, setPages] = useState<Page[]>([])
  const [loading, setLoading] = useState(true)
  const [error] = useState<Error | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [remoteCursors, setRemoteCursors] = useState<Omit<RemoteCursor, 'updatedAt'>[]>([])
  const [metadata, setMetadata] = useState<JournalMetadata | null>(null)
  const [lastLatency, setLastLatency] = useState(0)
  const [peakLatency, setPeakLatency] = useState(0)

  const syncRef = useRef<BroadcastSync | null>(null)
  const fbSyncRef = useRef<FirebaseSync | null>(null)
  const pagesRef = useRef<Page[]>([])
  const cursorsRef = useRef<Map<string, RemoteCursor>>(new Map())
  const seenOpUids = useRef<Set<string>>(new Set())
  const deviceIdRef = useRef(`device-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`)

  const publishCursors = useCallback(() => {
    const arr: Omit<RemoteCursor, 'updatedAt'>[] = []
    cursorsRef.current.forEach(c => {
      arr.push({ id: c.id, name: c.name, color: c.color, x: c.x, y: c.y, pageIndex: c.pageIndex })
    })
    setRemoteCursors(arr)
  }, [])

  const applyIncomingPages = useCallback((incomingPages: Page[]) => {
    if (incomingPages.length > 0) {
      setPages(incomingPages)
      pagesRef.current = incomingPages
    }
  }, [])

  const applyIncomingOp = useCallback((operation: SyncOperation) => {
    if (operation._uid && seenOpUids.current.has(operation._uid)) return
    if (operation._uid) seenOpUids.current.add(operation._uid)
    setPages(prev => {
      const next = applyOperation(prev, operation)
      pagesRef.current = next
      return next
    })
  }, [])

  const onIncomingBCOp = useCallback((operation: SyncOperation) => {
    if (operation._createdAt && !(operation._uid && seenOpUids.current.has(operation._uid))) {
      const delay = Date.now() - operation._createdAt
      if (delay > 10) console.log(`[SYNC] ${operation.type} via BC ${delay}ms`)
      setLastLatency(delay)
      setPeakLatency(prev => Math.max(prev, delay))
    }
    applyIncomingOp(operation)
  }, [applyIncomingOp])

  const onIncomingFBOp = useCallback((operation: SyncOperation) => {
    const dup = operation._uid && seenOpUids.current.has(operation._uid)
    if (operation._createdAt && !dup) {
      const delay = Date.now() - operation._createdAt
      if (delay > 10 && delay < 60000) console.log(`[SYNC] ${operation.type} via FB ${delay}ms`)
      if (delay < 5000) {
        setLastLatency(delay)
        setPeakLatency(prev => Math.max(prev, delay))
      }
    }
    applyIncomingOp(operation)
  }, [applyIncomingOp])

  const onIncomingPages = useCallback((incomingPages: Page[]) => {
    applyIncomingPages(incomingPages)
  }, [applyIncomingPages])

  const onIncomingMetadata = useCallback((incomingMetadata: JournalMetadata | null) => {
    if (incomingMetadata) {
      setMetadata(incomingMetadata)
    }
  }, [])

  useEffect(() => {
    if (!enabled) return

    const bs = createSync(
      onIncomingPages,
      (connected) => {
        setIsConnected(connected)
        if (connected) setLoading(false)
      },
      (cursor) => {
        cursorsRef.current.set(cursor.userId, {
          id: cursor.userId,
          name: cursor.name,
          color: cursor.color,
          x: cursor.x,
          y: cursor.y,
          pageIndex: cursor.page,
          updatedAt: cursor.updatedAt,
        })
        publishCursors()
      },
      onIncomingMetadata,
      onIncomingBCOp,
    )

    syncRef.current = bs
    bs.start()
    // eslint-disable-next-line react-hooks/set-state-in-effect -- init complete
    setLoading(false)

    let fbSync: FirebaseSync | null = null
    if (isFirebaseReady) {
      fbSync = createFirebaseSync(onIncomingPages, onIncomingMetadata, onIncomingFBOp)
      fbSync.start()
      fbSyncRef.current = fbSync
    }

    const cleanup = setInterval(() => {
      const now = Date.now()
      let changed = false
      cursorsRef.current.forEach((c, id) => {
        if (now - c.updatedAt > CURSOR_STALE_MS) {
          cursorsRef.current.delete(id)
          changed = true
        }
      })
      if (changed) publishCursors()
      if (seenOpUids.current.size > 2000) {
        seenOpUids.current.clear()
      }
    }, CURSOR_CLEAN_INTERVAL)

    return () => {
      bs.destroy()
      if (fbSync) fbSync.destroy()
      syncRef.current = null
      fbSyncRef.current = null
      clearInterval(cleanup)
    }
  }, [enabled, publishCursors, onIncomingPages, onIncomingBCOp, onIncomingFBOp, onIncomingMetadata])

  const savePages = useCallback((newPages: Page[]) => {
    setPages(newPages)
    pagesRef.current = newPages
    syncRef.current?.setPages(newPages)
    fbSyncRef.current?.broadcastPages(newPages)
  }, [])

  const flushPages = useCallback(() => {
    const sp = syncRef.current
    if (sp) {
      sp.broadcastPages(pagesRef.current)
    }
    fbSyncRef.current?.broadcastPages(pagesRef.current)
  }, [])

  const broadcastOperation = useCallback((operation: SyncOperation) => {
    const uid = operation._uid || `${deviceIdRef.current}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
    const enriched: SyncOperation = { ...operation, _uid: uid, _createdAt: Date.now() }
    seenOpUids.current.add(uid)
    syncRef.current?.broadcastOperation(enriched)
    fbSyncRef.current?.broadcastOperation(enriched)
  }, [])

  const saveUserCursor = useCallback(
    (userId: string, name: string, color: string, x: number, y: number, pageIndex: number) => {
      syncRef.current?.broadcastCursor(userId, name, color, x, y, pageIndex)
    },
    [],
  )

  const saveMetadata = useCallback((newMetadata: JournalMetadata) => {
    setMetadata(newMetadata)
    syncRef.current?.setMetadata(newMetadata)
    syncRef.current?.broadcastMetadata(newMetadata)
    fbSyncRef.current?.broadcastMetadata(newMetadata)
  }, [])

  const saveCheckpoint = useCallback(async (cpPages: Page[], label?: string) => {
    await fbSyncRef.current?.saveCheckpoint(cpPages, label)
  }, [])

  const getHistory = useCallback(async (): Promise<CheckpointInfo[]> => {
    return fbSyncRef.current?.getHistory() ?? []
  }, [])

  const loadCheckpoint = useCallback(async (id: string): Promise<Page[] | null> => {
    return fbSyncRef.current?.loadCheckpoint(id) ?? null
  }, [])

  const deleteCheckpoint = useCallback(async (id: string) => {
    await fbSyncRef.current?.deleteCheckpoint(id)
  }, [])

  return {
    pages,
    loading,
    error,
    savePages,
    flushPages,
    saveUserCursor,
    isConnected,
    remoteCursors,
    metadata,
    saveMetadata,
    broadcastOperation,
    saveCheckpoint,
    getHistory,
    loadCheckpoint,
    deleteCheckpoint,
    lastLatency,
    peakLatency,
  }
}
