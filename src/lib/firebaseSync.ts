import { ref, onValue, set, off, get, push, query, limitToLast, onChildAdded, type Unsubscribe } from 'firebase/database'
import { rtdb } from '@/lib/firebase'
import type { Page } from '@/types/journal'
import type { JournalMetadata, SyncOperation } from '@/lib/syncTypes'

const BOOK_PATH = 'journal/shared'
const MAX_HISTORY = 50

export interface CheckpointInfo {
  id: string
  savedAt: number
  label?: string
}

export class FirebaseSync {
  private onPages: (pages: Page[]) => void
  private onMetadata: (metadata: JournalMetadata | null) => void
  private onOperation: ((operation: SyncOperation) => void) | null
  private unsubPages: Unsubscribe | null = null
  private unsubMetadata: Unsubscribe | null = null
  private unsubOps: Unsubscribe | null = null
  private deviceId: string
  private writingPages = false
  private writingMetadata = false
  private pagesReceived = false
  private lastAutoCheckpoint = 0
  private lastPagesBroadcast = 0
  private pendingPages: Page[] | null = null
  private broadcastThrottleTimer: ReturnType<typeof setTimeout> | null = null

  constructor(
    onPages: (pages: Page[]) => void,
    onMetadata: (metadata: JournalMetadata | null) => void,
    onOperation?: (operation: SyncOperation) => void,
  ) {
    this.onPages = onPages
    this.onMetadata = onMetadata
    this.onOperation = onOperation ?? null
    this.deviceId = `device-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
  }

  start() {
    if (!rtdb) return

    const pagesRef = ref(rtdb, `${BOOK_PATH}/pages`)
    this.unsubPages = onValue(pagesRef, (snap) => {
      if (this.writingPages) return
      const val = snap.val()
      if (val && val._source !== this.deviceId && Array.isArray(val.data)) {
        this.pagesReceived = true
        this.onPages(val.data)
      }
    })

    const metaRef = ref(rtdb, `${BOOK_PATH}/metadata`)
    this.unsubMetadata = onValue(metaRef, (snap) => {
      if (this.writingMetadata) return
      const val = snap.val()
      if (val && val._source !== this.deviceId && val.data) {
        this.onMetadata(val.data)
      }
    })

      if (this.onOperation) {
      const startTime = Date.now()
      const opsRef = ref(rtdb, `${BOOK_PATH}/ops`)
      this.unsubOps = onChildAdded(opsRef, (snap) => {
        const val = snap.val()
        if (
          val && val._source !== this.deviceId && val.op
          && val.createdAt > startTime
        ) {
          this.onOperation!(val.op)
        }
      })
    }
  }

  destroy() {
    if (this.unsubPages) {
      off(ref(rtdb!, `${BOOK_PATH}/pages`))
      this.unsubPages = null
    }
    if (this.unsubMetadata) {
      off(ref(rtdb!, `${BOOK_PATH}/metadata`))
      this.unsubMetadata = null
    }
    if (this.unsubOps) {
      off(ref(rtdb!, `${BOOK_PATH}/ops`))
      this.unsubOps = null
    }
    if (this.broadcastThrottleTimer) {
      clearTimeout(this.broadcastThrottleTimer)
      this.broadcastThrottleTimer = null
    }
  }

  async broadcastPages(pages: Page[]) {
    if (!rtdb) return
    const now = Date.now()
    if (now - this.lastPagesBroadcast < 1000) {
      this.pendingPages = pages
      if (!this.broadcastThrottleTimer) {
        this.broadcastThrottleTimer = setTimeout(() => {
          this.broadcastThrottleTimer = null
          if (this.pendingPages) {
            this.flushPages(this.pendingPages)
            this.pendingPages = null
          }
        }, 1000 - (now - this.lastPagesBroadcast))
      }
      return
    }
    this.flushPages(pages)
  }

  private async flushPages(pages: Page[]) {
    if (!rtdb) return
    this.lastPagesBroadcast = Date.now()
    this.writingPages = true
    try {
      const pagesRef = ref(rtdb, `${BOOK_PATH}/pages`)
      await set(pagesRef, { data: pages, _source: this.deviceId, updatedAt: Date.now() })
      if (Date.now() - this.lastAutoCheckpoint >= 60000) {
        this.lastAutoCheckpoint = Date.now()
        this.saveCheckpoint(pages, 'Auto').catch(() => {})
      }
    } finally {
      this.writingPages = false
    }
  }

  async broadcastMetadata(metadata: JournalMetadata) {
    if (!rtdb) return
    this.writingMetadata = true
    try {
      const metaRef = ref(rtdb, `${BOOK_PATH}/metadata`)
      await set(metaRef, { data: metadata, _source: this.deviceId, updatedAt: Date.now() })
    } finally {
      this.writingMetadata = false
    }
  }

  async broadcastOperation(operation: SyncOperation) {
    if (!rtdb) return
    try {
      const opRef = ref(rtdb, `${BOOK_PATH}/ops`)
      await push(opRef, { op: operation, _source: this.deviceId, createdAt: Date.now() })
      this.pruneOps()
    } catch { /* ops are best-effort */ }
  }

  async saveCheckpoint(pages: Page[], label?: string): Promise<void> {
    if (!rtdb) return
    try {
      const stripped = pages.map(p => ({
        ...p,
        elements: p.elements.filter(el => !el.data?._deleted).map(el => {
          const { _updatedAt, ...rest } = el.data as Record<string, unknown>
          const data = Object.keys(rest).length ? rest : el.data
          return { ...el, data }
        }),
      }))
      const historyMetaRef = ref(rtdb, `${BOOK_PATH}/history-meta`)
      const pushResult = await push(historyMetaRef, { savedAt: Date.now(), label: label ?? null, _source: this.deviceId })
      const id = pushResult.key!
      const historyDataRef = ref(rtdb, `${BOOK_PATH}/history-data/${id}`)
      await set(historyDataRef, { data: stripped })
      this.pruneHistory().catch(() => {})
    } catch (err) {
      console.warn('[FirebaseSync] saveCheckpoint failed:', err)
    }
  }

  async getHistory(): Promise<CheckpointInfo[]> {
    if (!rtdb) return []
    try {
      const historyMetaRef = ref(rtdb, `${BOOK_PATH}/history-meta`)
      const snap = await get(query(historyMetaRef, limitToLast(MAX_HISTORY)))
      if (!snap.exists()) return []

      const entries: CheckpointInfo[] = []
      snap.forEach((child) => {
        const val = child.val()
        if (val && val.savedAt) {
          entries.push({ id: child.key!, savedAt: val.savedAt, label: val.label ?? undefined })
        }
      })
      entries.sort((a, b) => b.savedAt - a.savedAt)
      return entries
    } catch {
      return []
    }
  }

  async loadCheckpoint(id: string): Promise<Page[] | null> {
    if (!rtdb) return null
    try {
      const snap = await get(ref(rtdb, `${BOOK_PATH}/history-data/${id}`))
      if (!snap.exists()) return null
      const val = snap.val()
      if (Array.isArray(val.data) && val.data.length > 0) {
        return val.data
      }
    } catch {
      console.warn('[FirebaseSync] loadCheckpoint failed')
    }
    return null
  }

  async deleteCheckpoint(id: string): Promise<void> {
    if (!rtdb) return
    try {
      await set(ref(rtdb, `${BOOK_PATH}/history-meta/${id}`), null)
      await set(ref(rtdb, `${BOOK_PATH}/history-data/${id}`), null)
    } catch {
      console.warn('[FirebaseSync] deleteCheckpoint failed')
    }
  }

  async recoverFromHistory(): Promise<Page[] | null> {
    if (!rtdb) return null
    try {
      const latestQuery = query(ref(rtdb, `${BOOK_PATH}/history`), limitToLast(1))
      const snap = await get(latestQuery)
      if (snap.exists()) {
        let latest: Page[] | null = null
        snap.forEach((child) => {
          const val = child.val()
          if (val && Array.isArray(val.data) && val.data.length > 0) {
            latest = val.data
          }
        })
        return latest
      }
    } catch {
      console.warn('[FirebaseSync] history recovery failed')
    }
    return null
  }

  private pruneOps() {
    if (!rtdb) return
    const opsRef = ref(rtdb, `${BOOK_PATH}/ops`)
    get(opsRef).then((snap) => {
      if (!snap.exists()) return
      const maxOps = 500
      const cutoff = Date.now() - 5 * 60 * 1000
      const entries: { key: string; createdAt: number }[] = []
      snap.forEach((child) => {
        const val = child.val()
        entries.push({ key: child.key!, createdAt: val.createdAt ?? 0 })
      })
      const toDelete = entries
        .filter(e => e.createdAt < cutoff)
        .sort((a, b) => a.createdAt - b.createdAt)
      if (toDelete.length > maxOps) {
        toDelete.splice(0, toDelete.length - maxOps)
      }
      if (toDelete.length === 0) return
      const deletes = toDelete.map(e => set(ref(rtdb!, `${BOOK_PATH}/ops/${e.key}`), null))
      Promise.all(deletes).catch(() => {})
    }).catch(() => {})
  }

  private async pruneHistory() {
    if (!rtdb) return
    try {
      const historyMetaRef = ref(rtdb, `${BOOK_PATH}/history-meta`)
      const snap = await get(query(historyMetaRef, limitToLast(MAX_HISTORY + 1)))
      if (!snap.exists()) return

      const entries: { key: string; savedAt: number }[] = []
      snap.forEach((child) => {
        const val = child.val()
        entries.push({ key: child.key!, savedAt: val.savedAt ?? 0 })
      })

      if (entries.length <= MAX_HISTORY) return

      entries.sort((a, b) => a.savedAt - b.savedAt)
      const toDelete = entries.slice(0, entries.length - MAX_HISTORY)
      const deletes = toDelete.flatMap((entry) => [
        set(ref(rtdb!, `${BOOK_PATH}/history-meta/${entry.key}`), null),
        set(ref(rtdb!, `${BOOK_PATH}/history-data/${entry.key}`), null),
      ])
      await Promise.all(deletes)
    } catch (err) {
      console.warn('[FirebaseSync] history prune failed:', err)
    }
  }

  get isAvailable(): boolean {
    return !!rtdb
  }

  get hasReceivedPages(): boolean {
    return this.pagesReceived
  }
}

export function createFirebaseSync(
  onPages: (pages: Page[]) => void,
  onMetadata: (metadata: JournalMetadata | null) => void,
  onOperation?: (operation: SyncOperation) => void,
): FirebaseSync {
  return new FirebaseSync(onPages, onMetadata, onOperation)
}
