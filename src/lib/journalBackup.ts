import type { Page } from '../types/journal.ts'
import type { JournalMetadata } from '../lib/syncTypes.ts'

export const BACKUP_VERSION = 1

// A checkpoint stored in the cloud history is the SAME payload shape as a
// downloaded backup — version + pages + metadata — so a checkpoint is always
// restorable like a backup (and can be downloaded as one).
export interface RestorableBackup {
  version: number
  exportedAt: string
  pages: Page[]
  metadata: JournalMetadata
}

// What loadCheckpoint returns: identical to a backup when the checkpoint was
// saved with the current payload format; legacy checkpoints only carried
// pages, so metadata is null and savedAt is missing.
export interface RestoredJournal {
  pages: Page[]
  metadata: JournalMetadata | null
  savedAt?: number
}

export function buildBackup(
  pages: Page[],
  metadata: JournalMetadata,
  exportedAt: string = new Date().toISOString(),
): RestorableBackup {
  return { version: BACKUP_VERSION, exportedAt, pages, metadata }
}

export function downloadJson(payload: unknown, filename: string) {
  const json = JSON.stringify(payload)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// Reads the value stored under history-data/<id>, accepting both the current
// payload (val.data = { version, savedAt, pages, metadata }) and the legacy
// one (val.data = Page[]).
export function normalizeCheckpointPayload(raw: unknown): RestoredJournal | null {
  if (!raw || typeof raw !== 'object') return null
  const data = 'data' in (raw as Record<string, unknown>) ? (raw as Record<string, unknown>).data : raw
  if (Array.isArray(data)) {
    return { pages: data as Page[], metadata: null }
  }
  if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>
    if (Array.isArray(obj.pages)) {
      const metadata = obj.metadata && typeof obj.metadata === 'object' ? (obj.metadata as JournalMetadata) : null
      const savedAt = typeof obj.savedAt === 'number' ? (obj.savedAt as number) : undefined
      return { pages: obj.pages as Page[], metadata, savedAt }
    }
  }
  return null
}