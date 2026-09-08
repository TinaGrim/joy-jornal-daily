import type { Page } from '@/types/journal'
import type { JournalMetadata } from '@/lib/syncTypes'
import { getDemoPages as seedDemoPages, getDemoMetadata as seedDemoMetadata } from '@/lib/demoContent'

/**
 * Demo-session storage (FR-003, FR-006, FR-007).
 *
 * The demo mode is a fully client-side, isolated journey: it must NEVER read
 * or write the real shared journal records (journal_pages, journal_metadata,
 * journal_pending_pages, journal_book_closed) and must never sync to the
 * cloud. Every record lives under a `demo:`-prefixed localStorage key so it
 * can never collide with the real book, and every access is wrapped in
 * try/catch with an in-memory fallback so storage failures degrade gracefully
 * while reload still restores the demo state.
 */

const DEMO_UID = 'demo'

const K_PAGES = 'demo:pages'
const K_METADATA = 'demo:metadata'
const K_UID = 'demo:uid'
const K_MIGRATED = 'demo:migrated-legacy-once'
const K_ADOPTED = 'demo:adoption-consumed'
const K_ADOPTION_INTENT = 'demo:adoption-intent'
const K_BOOK_CLOSED = 'demo:book_closed'

/** In-memory fallback used whenever localStorage is unavailable/fails. */
const mem = new Map<string, string>()

function read(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return mem.get(key) ?? null
  }
}

function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value)
  } catch {
    mem.set(key, value)
  }
}

function remove(key: string) {
  try {
    localStorage.removeItem(key)
  } catch {
    mem.delete(key)
  }
}

function readJSON<T>(key: string, fallback: T): T {
  const raw = read(key)
  if (!raw) return fallback
  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

/** The stable demo uid used to identify the demo session locally. */
export function getDemoUid(): string {
  const existing = read(K_UID)
  if (existing) return existing
  write(K_UID, DEMO_UID)
  return DEMO_UID
}

export function demoUidExists(): boolean {
  return read(K_UID) !== null
}

/** Demo pages. First run seeds the built-in sample content (FR-002). */
export function getDemoPages(): Page[] {
  return readJSON<Page[] | null>(K_PAGES, null) ?? getDemoPagesSeed()
}

export function getDemoPagesSeed(): Page[] {
  // Deep-copy each call so callers can never alias the module's frozen
  // element arrays (an aliasing bug surfaced during review of task 1.1).
  return JSON.parse(JSON.stringify(seedDemoPages())) as Page[]
}

export function setDemoPages(pages: Page[]) {
  write(K_PAGES, JSON.stringify(pages))
}

/** Demo metadata. First run seeds the built-in sample metadata. */
export function getDemoMetadata(): JournalMetadata {
  return readJSON<JournalMetadata | null>(K_METADATA, null) ?? getDemoMetadataSeed()
}

export function getDemoMetadataSeed(): JournalMetadata {
  return JSON.parse(JSON.stringify(seedDemoMetadata())) as JournalMetadata
}

export function setDemoMetadata(meta: JournalMetadata) {
  write(K_METADATA, JSON.stringify(meta))
}

/** Legacy real-journal content copied into demo (pre-demo app). Kept as a
 *  one-time purge flag: when set, the demo records may hold a copy of the real
 *  authenticated book, and JournalContext re-seeds them fresh on next entry
 *  (see enterDemoMode). New sessions never set this marker. */
export function getMigrationDone(): boolean {
  return read(K_MIGRATED) === '1'
}

export function clearMigrationDone() {
  remove(K_MIGRATED)
}

/**
 * One-time safety net for browsers that ran the pre-demo legacy migration:
 * their demo records (`demo:pages`, `demo:metadata`) carry a verbatim copy of
 * the real journal — on a browser used by a signed-in account, that is the
 * authenticated user's private book. Called before any demo state is read at
 * startup so the copy is dropped before it can be rendered, and a fresh seed
 * is put back. The marker is cleared so this only ever runs once per browser;
 * the module flag makes repeated calls a no-op.
 */
let legacyPurgeDone = false
export function purgeLegacyMigratedDemo() {
  if (legacyPurgeDone) return
  if (getMigrationDone()) {
    setDemoPages(getDemoPagesSeed())
    setDemoMetadata(getDemoMetadataSeed())
    clearMigrationDone()
  }
  legacyPurgeDone = true
}

/** Adoption-once per account (FR-010/FR-011): the demo journey's records are
 *  adopted into a real signed-in journal at most once per account. The set of
 *  account uids that already consumed adoption is stored so later demo edits
 *  are never re-carried. */
export function getAdoptedAccountIds(): string[] {
  return readJSON<string[]>(K_ADOPTED, [])
}

export function hasAdoptedAccount(uid: string): boolean {
  return getAdoptedAccountIds().includes(uid)
}

export function addAdoptedAccountId(uid: string) {
  const ids = getAdoptedAccountIds()
  if (!ids.includes(uid)) {
    write(K_ADOPTED, JSON.stringify([...ids, uid]))
  }
}

/** Adoption intent (FR-011): set the moment a demo visitor starts Google
 *  sign-in so the adoption survives a full-page redirect round trip while
 *  Firebase completes auth. Cleared once the intent is consumed, or when the
 *  visitor deliberately leaves the demo. */
export function setAdoptionIntent() {
  write(K_ADOPTION_INTENT, '1')
}

export function clearAdoptionIntent() {
  remove(K_ADOPTION_INTENT)
}

export function getAdoptionIntent(): boolean {
  return read(K_ADOPTION_INTENT) === '1'
}

/** Demo-scoped book open/closed preference. The real journal_book_closed key
 *  (JournalContext.tsx:337/:342) is never read or written in demo. */
export function getDemoBookClosed(): boolean {
  return read(K_BOOK_CLOSED) === '1'
}

export function setDemoBookClosed(closed: boolean) {
  write(K_BOOK_CLOSED, closed ? '1' : '0')
}

/** Delete all demo records. Used when the demo journey is permanently left. */
export function clearDemoStorage() {
  remove(K_PAGES)
  remove(K_METADATA)
  remove(K_UID)
  remove(K_MIGRATED)
  remove(K_ADOPTED)
  remove(K_ADOPTION_INTENT)
  remove(K_BOOK_CLOSED)
}

/** True when any demo record exists (used to restore the demo on reload). */
export function hasDemoState(): boolean {
  return demoUidExists() || read(K_PAGES) !== null || read(K_METADATA) !== null
}
