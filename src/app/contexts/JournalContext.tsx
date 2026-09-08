import { createContext, useContext, useState, useRef, useEffect, type ReactNode, useCallback } from 'react'
import { toast } from 'sonner'
import confetti from 'canvas-confetti'
import type { CanvasElement, Page, User, Milestone, Occasion, DrawSettings, JourneyDetails, PagePattern } from '@/types/journal'
import type { JournalMetadata } from '@/lib/syncTypes'
import type { CheckpointInfo } from '@/lib/firebaseSync'
import { mergePageSnapshots } from '@/lib/mergePages'
import { journalNow } from '@/lib/journalClock'
import { useFirebaseAuth, friendlyAuthError } from '@/hooks/useFirebaseAuth'
import { useWebRTCSync } from '@/hooks/useWebRTCSync'
import {
  getDemoUid,
  getDemoPages,
  setDemoPages,
  getDemoMetadata,
  setDemoMetadata,
  getDemoBookClosed,
  setDemoBookClosed,
  purgeLegacyMigratedDemo,
  hasDemoState,
  getDemoPagesSeed,
  getDemoMetadataSeed,
  setAdoptionIntent,
  clearAdoptionIntent,
  getAdoptionIntent,
  hasAdoptedAccount,
  addAdoptedAccountId,
} from '@/lib/demoStorage'
import { computeDemoToGoogleRebase, liveStateBelongsToRealJournal, mayMergeCloudWithLiveState, type LiveJournalSource } from '@/lib/journalTransition'
import { repairDemoMixedJournalPages, isDemoMetadata } from '@/lib/demoMixRepair'

const BACKUP_VERSION = 1

const STORAGE_KEY_PAGES = 'journal_pages'
const STORAGE_KEY_METADATA = 'journal_metadata'
const STORAGE_KEY_UID = 'journal_anon_uid'
const ELEMENT_TS_KEY = '_updatedAt'

function sanitizePages(pages: Page[]): Page[] {
  return pages.map(p => ({ ...p, elements: p.elements ?? [] }))
}

function deduplicatePageElements(pages: Page[]): Page[] {
  // Dedupe same-id copies WITHIN each page, newest `_updatedAt` winning.
  // This must never collapse across pages: transferElement moves an element
  // by tombstoning its source and appending a fresh copy to the target
  // page — when that id already existed on the target page, keeping the
  // first occurrence discarded the freshly moved copy, so dragging an
  // element across pages made it vanish on release.
  const ts = (el: CanvasElement): number => {
    const v = el.data?._updatedAt
    return typeof v === 'number' ? v : 0
  }
  return pages.map(page => {
    const byId = new Map<string, CanvasElement>()
    for (const el of page.elements ?? []) {
      const prev = byId.get(el.id)
      if (!prev || ts(el) > ts(prev)) byId.set(el.id, el)
    }
    return { ...page, elements: [...byId.values()] }
  })
}

function loadPagesFromStorage(): Page[] | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PAGES)
    return raw ? sanitizePages(JSON.parse(raw)) : null
  } catch { return null }
}

function savePagesToStorage(pages: Page[]) {
  try { localStorage.setItem(STORAGE_KEY_PAGES, JSON.stringify(pages)) } catch { /* localStorage may be full */ }
}

function loadMetadataFromStorage(): JournalMetadata | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_METADATA)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

function saveMetadataToStorage(meta: JournalMetadata) {
  try { localStorage.setItem(STORAGE_KEY_METADATA, JSON.stringify(meta)) } catch { /* localStorage may be full */ }
}

function getDefaultMetadata(): JournalMetadata {
  return {
    anniversaryDate: '16.11.2025',
    milestones: [],
    occasions: [],
    journeyDetails: {
      title: 'Summer Road Trip',
      dates: 'June 15-30, 2026',
      destination: 'Pacific Coast Highway',
      flag: '🇺🇸',
    },
  }
}

function getDefaultPages(): Page[] {
  return [
    {
      id: 'cover',
      background: 'linear-gradient(180deg, #e8dcc0 0%, #ece0c8 40%, #f0e6d3 100%)',
      pattern: 'blank',
      elements: [
        { id: 'cover-flag', type: 'text' as const, x: 230, y: 80, width: 180, height: 120, rotation: -2, zIndex: 1, data: { text: '🇰🇭🇯🇵', font: 'Caveat', fontSize: 72, color: '#2c3e50', textAlign: 'center' } },
        { id: 'divider-left', type: 'shape' as const, x: 90, y: 228, width: 210, height: 2, rotation: 0, zIndex: 2, data: { shape: 'rectangle' as const, fill: '#d97757', opacity: 0.35 } },
        { id: 'divider-right', type: 'shape' as const, x: 340, y: 228, width: 210, height: 2, rotation: 0, zIndex: 3, data: { shape: 'rectangle' as const, fill: '#d97757', opacity: 0.35 } },
        { id: 'cover-title', type: 'text' as const, x: 60, y: 245, width: 520, height: 70, rotation: 0, zIndex: 4, data: { text: 'Joy Journey Daily', font: 'Playfair Display', fontSize: 52, color: '#2c3e50', textAlign: 'center' } },
        { id: 'divider-center', type: 'shape' as const, x: 195, y: 340, width: 250, height: 1.5, rotation: 0, zIndex: 5, data: { shape: 'rectangle' as const, fill: '#8b7355', opacity: 0.2 } },
        { id: 'cover-anniversary', type: 'text' as const, x: 140, y: 360, width: 360, height: 35, rotation: 0, zIndex: 6, data: { text: '16.11.2025', font: 'Caveat', fontSize: 28, color: '#d97757', textAlign: 'center' } },
        { id: 'cover-heart', type: 'emoji' as const, x: 285, y: 410, width: 70, height: 45, rotation: 0, zIndex: 7, data: { emoji: '❤️' } },
        { id: 'cover-names', type: 'text' as const, x: 150, y: 465, width: 340, height: 45, rotation: 0, zIndex: 8, data: { text: 'Muffin & Hasha', font: 'Caveat', fontSize: 34, color: '#8b7355', textAlign: 'center' } },
        { id: 'divider-bottom', type: 'shape' as const, x: 220, y: 540, width: 200, height: 1, rotation: 0, zIndex: 9, data: { shape: 'rectangle' as const, fill: '#8b7355', opacity: 0.15 } },
      ],
    },
    { id: 'page-1', background: '#f0e6d3', pattern: 'grid', gridSize: 40, elements: [] },
    { id: 'page-2', background: '#f0e6d3', pattern: 'grid', gridSize: 40, elements: [] },
  ]
}

// True when the local book is still the untouched default template
// (fresh browser / cleared localStorage). Such a book must never be
// published to the cloud: it would become the canonical book for every
// other origin and replace their real content.
function isDefaultTemplate(pages: Page[]): boolean {
  const stripMeta = (data: Record<string, unknown> | undefined): Record<string, unknown> | undefined => {
    if (!data) return undefined
    const rest = { ...data }
    delete rest._updatedAt
    delete rest._deleted
    return rest
  }
  const canonical = (p: Page) => ({
    id: p.id,
    background: p.background,
    pattern: p.pattern,
    gridSize: p.gridSize,
    elements: (p.elements ?? [])
      .map(el => ({
        id: el.id, type: el.type, x: el.x, y: el.y,
        width: el.width, height: el.height, rotation: el.rotation, zIndex: el.zIndex,
        data: stripMeta(el.data),
      }))
      .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)),
  })
  const stripDeleted = (p: Page) => ({
    ...p,
    elements: (p.elements ?? []).filter(el => !el.data?._deleted),
  })
  return JSON.stringify(pages.map(p => canonical(stripDeleted(p))))
    === JSON.stringify(getDefaultPages().map(canonical))
}

interface JournalContextType {
  pages: Page[]
  bookClosed: boolean
  setBookClosed: (closed: boolean) => void
  currentPageIndex: number
  setCurrentPageIndex: (index: number) => void
  focusPageIndex: number
  setFocusPageIndex: (index: number) => void
  getFocusPageIndex: () => number
  transferElement: (elementId: string, fromPage: number, toPage: number, newX: number, newY: number) => void
  addElement: (element: Omit<CanvasElement, 'id' | 'zIndex'>, pageIdx?: number) => string
  updateElement: (id: string, updates: Partial<CanvasElement>, syncEnabled?: boolean, pageIdx?: number, opts?: { skipUndo?: boolean }) => void
  deleteElement: (id: string, pageIdx?: number, opts?: { skipUndo?: boolean }) => void
  deleteElements: (ids: string[], pageIdx?: number) => void
  replacePageElements: (elements: CanvasElement[]) => void
  clearPage: () => void
  bringForward: (id: string, pageIdx?: number) => void
  sendBackward: (id: string, pageIdx?: number) => void
  updatePageBackground: (background: string) => void
  updateAllPagesBackground: (background: string) => void
  updatePagePattern: (pattern: PagePattern) => void
  updateAllPagesPattern: (pattern: PagePattern) => void
  updateGridSize: (size: number) => void
  updateAllPagesGridSize: (size: number) => void
  addPage: () => void
  users: User[]
  currentUser: User
  remoteCursors: { id: string; x: number; y: number; pageIndex: number; name: string; color: string }[]
  updateCursorPosition: (x: number, y: number, page: number) => void
  anniversaryDate: string
  setAnniversaryDate: (date: string) => void
  milestones: Milestone[]
  addMilestone: (label: string, emoji?: string) => void
  toggleMilestone: (id: string) => void
  deleteMilestone: (id: string) => void
  occasions: Occasion[]
  addOccasion: (label: string, date: string, emoji?: string) => void
  deleteOccasion: (id: string) => void
  uploadedPhotos: { id: string; src: string; name: string }[]
  addUploadedPhotos: (photos: { id: string; src: string; name: string }[]) => void
  drawSettings: DrawSettings
  setDrawSettings: (settings: DrawSettings) => void
  selectedElementId: string | null
  setSelectedElementId: (id: string | null) => void
  selectedElementIds: string[]
  setSelectedElementIds: (ids: string[]) => void
  batchUpdateElements: (updates: Record<string, Partial<CanvasElement>>, syncEnabled?: boolean, pageIdx?: number) => void
  journeyDetails: JourneyDetails
  setJourneyDetails: (details: JourneyDetails) => void
  rightPanelWidth: number
  setRightPanelWidth: (width: number) => void
  isAuthenticated: boolean
  isDemo: boolean
  authLoading: boolean
  authError: string | null
  cloudLoading: boolean
  signInWithGoogle: () => void
  signInAnonymously: () => void
  signOut: () => void
  syncLoading: boolean
  isConnected: boolean
  flushSync: () => void
  undo: () => void
  redo: () => void
  canUndo: boolean
  canRedo: boolean
  saveCheckpoint: (label?: string) => Promise<void>
  loadCheckpoint: (id: string) => Promise<Page[] | null>
  deleteCheckpoint: (id: string) => Promise<void>
  checkpoints: CheckpointInfo[]
  refreshCheckpoints: () => Promise<void>
  syncLatency: number
  syncPeakLatency: number
  exportBackup: () => Promise<void>
  restoreBackup: (backup: { pages: Page[]; metadata: JournalMetadata }) => void
}

const JournalContext = createContext<JournalContextType | undefined>(undefined)

export function JournalProvider({ children }: { children: ReactNode }) {
  const {
    user: firebaseUser,
    loading: authLoading,
    error: fbAuthError,
    signInWithGoogle: fbSignIn,
    signOut: fbSignOut,
    isAuthenticated: fbAuthenticated,
  } = useFirebaseAuth()

  const [localAuthError, setLocalAuthError] = useState<string | null>(null)

  // Three-state session: 'google' (firebase-authed), 'demo' (isolated local
  // demo journey), or null (signed out / fresh visitor). A fresh visitor sees
  // AuthScreen; demo requires no firebase account and never touches the real
  // cloud journal.
  const [session, setSession] = useState<'google' | 'demo' | null>(() => {
    // Drop any pre-demo migrated copy of the real journal before it can be
    // rendered: an anonymous visitor must never see authenticated content.
    purgeLegacyMigratedDemo()
    if (fbAuthenticated) return 'google'
    if (hasDemoState()) return 'demo'
    return null
  })

  // A returning firebase user always wins at startup (and stays google while
  // authenticated); it is never downgraded to demo.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- auth resolution is async; session must be aligned once Firebase reports in
    if (fbAuthenticated) setSession('google')
  }, [fbAuthenticated])

  const isDemo = session === 'demo'
  const isDemoRef = useRef(isDemo)
  useEffect(() => { isDemoRef.current = isDemo }, [isDemo])
  const isGoogle = session === 'google'
  // A usable session: the book is editable in both google and demo modes.
  const isAuthenticated = session !== null
  // Which content the LIVE pages state holds. During the demo→google flip
  // commit this is 'demo' (the rebase effect runs after the merge/publish
  // effects) while `isDemo` is already false — so the cloud paths MUST gate on
  // this ref, never on `isDemo`/`isGoogle` alone, to avoid merging or publishing
  // demo content into the real journal. The rebase effect flips this to 'real'
  // in the same effect that swaps the live pages.
  const liveJournalSourceRef = useRef<LiveJournalSource>(session === 'demo' ? 'demo' : 'real')

  const effectiveUser = fbAuthenticated
    ? firebaseUser
    : isDemo
      ? { uid: getDemoUid(), displayName: 'Demo' }
      : null

  // Click-time failures land in localAuthError; redirect-completion failures
  // (which happen after returning from accounts.google.com, long after any
  // click handler is gone) arrive via fbAuthError. Show whichever exists.
  const authError = localAuthError ?? fbAuthError

  const signInWithGoogle = useCallback(async () => {
    try {
      setLocalAuthError(null)
      // FR-011: a demo visitor who starts sign-in marks adoption intent so the
      // adoption survives a full-page redirect round trip while Firebase
      // completes auth.
      if (isDemo) setAdoptionIntent()
      await fbSignIn()
      // A successfully completed popup flips the session to 'google' within a
      // frame. If the promise resolved but the visitor is STILL in the demo
      // shortly after, the attempt was cancelled or the redirect flow is in
      // flight — keep them in the demo and confirm their work is safe.
      window.setTimeout(() => {
        if (isDemoRef.current) {
          toast.info('Sign-in didn\'t complete — your demo journal stays on this device.')
        }
      }, 400)
    } catch (err) {
      setLocalAuthError(friendlyAuthError(err))
      if (isDemo) toast.error(friendlyAuthError(err))
    }
  }, [fbSignIn, isDemo])

  // Real cloud sync only ever runs for the google session. The demo session
  // must never construct or enable FirebaseSync (it would write the shared
  // cloud journal); when gated off, useWebRTCSync returns a quiescent object.
  const sync = useWebRTCSync(isGoogle, useCallback((msg: string) => {
    toast.error(msg, { duration: 5000 })
  }, []))
  const syncLoading = isGoogle && fbAuthenticated && sync.loading
  const syncLatency = sync.lastLatency
  const syncPeakLatency = sync.peakLatency

  const [checkpoints, setCheckpoints] = useState<CheckpointInfo[]>([])
  // Access getHistory through a ref: depending on `sync` directly made this
  // callback's identity change on every render, and the refresh effect below
  // would then setState a fresh array each pass — an infinite render loop
  // that froze the whole app the moment any auth state change re-rendered
  // the provider (the "unresponsive after Google sign-in" bug).
  const getHistoryRef = useRef(sync.getHistory)
  useEffect(() => { getHistoryRef.current = sync.getHistory }, [sync.getHistory])
  const refreshCheckpoints = useCallback(async () => {
    const list = await getHistoryRef.current()
    setCheckpoints(list)
  }, [])
  useEffect(() => {
    refreshCheckpoints()
  }, [refreshCheckpoints])

  const saveCheckpoint = useCallback(async (label?: string) => {
    await sync.saveCheckpoint(sync.pages, label)
    refreshCheckpoints()
    toast.success('Checkpoint saved!')
  }, [sync, refreshCheckpoints])

  const loadCheckpoint = useCallback(async (id: string): Promise<Page[] | null> => {
    const data = await sync.loadCheckpoint(id)
    if (data) {
      sync.savePages(data)
      refreshCheckpoints()
      toast.success('Checkpoint restored')
    }
    return data
  }, [sync, refreshCheckpoints])

  const deleteCheckpoint = useCallback(async (id: string) => {
    await sync.deleteCheckpoint(id)
    refreshCheckpoints()
  }, [sync, refreshCheckpoints])

  const currentUser: User = {
    id: effectiveUser?.uid ?? 'local',
    name: effectiveUser?.displayName ?? 'You',
    color: '#d97757',
    cursorX: 0,
    cursorY: 0,
    currentPage: 0,
  }

  const users: User[] = []

  const { remoteCursors, saveUserCursor } = sync
  const cursors = remoteCursors
  const updateCursorPosition = useCallback(
    (x: number, y: number, page: number) => {
      if (isDemo) return
      saveUserCursor(effectiveUser?.uid ?? 'local', currentUser.name, currentUser.color, x, y, page)
    },
    [saveUserCursor, currentUser.name, currentUser.color, effectiveUser?.uid, isDemo],
  )

  // Book starts OPEN by default: landing on a static closed cover made
  // people tap their elements with no response ("cannot select element").
  // The last chosen state is remembered per device (demo keeps its own
  // demo-scoped preference and never reads journal_book_closed).
  const initialBookClosed = (() => {
    if (session === 'demo') return getDemoBookClosed()
    try { return localStorage.getItem('journal_book_closed') === '1' } catch { return false }
  })()
  const [bookClosed, setBookClosedState] = useState<boolean>(initialBookClosed)
  const setBookClosed = useCallback((closed: boolean) => {
    setBookClosedState(closed)
    if (isDemo) {
      setDemoBookClosed(closed)
      return
    }
    try { localStorage.setItem('journal_book_closed', closed ? '1' : '0') } catch { /* storage unavailable */ }
  }, [isDemo, setBookClosedState])

  const signOut = useCallback(async () => {
    try {
      if (isDemo) {
        // Leaving demo returns to the signed-out gate but KEEPS demo records,
        // so re-entering demo restores the same state. A pending adoption
        // intent is discarded: leaving the demo abandons the conversion.
        clearAdoptionIntent()
        setBookClosedState(false)
        setSession(null)
        return
      }
      setSession(null)
      localStorage.removeItem(STORAGE_KEY_UID)
      await fbSignOut()
    } catch (err) {
      console.error('[JournalContext] signOut failed:', err)
    }
  }, [isDemo, setBookClosedState, fbSignOut])

  const [pages, setPages] = useState<Page[]>(() => {
    if (session === 'demo') return getDemoPages()
    const stored = loadPagesFromStorage()
    return stored ?? getDefaultPages()
  })

  const pagesRef = useRef(pages)
  useEffect(() => { pagesRef.current = pages }, [pages])

  const initializedRef = useRef(false)

  useEffect(() => {
    if (!isGoogle) {
      return
    }
    if (initializedRef.current) {
      return
    }
    if (sync.loading) {
      return
    }
    // The live state must be the REAL journal before anything is read from it
    // or published. During the session flips above and the change captured in
    // liveJournalSourceRef, pagesRef may still hold demo content even though
    // isDemo is already false — never publish that into the real cloud.
    if (!liveStateBelongsToRealJournal(liveJournalSourceRef.current)) {
      return
    }

    // Only publish local pages once Firebase has confirmed the cloud is
    // actually empty (cloudChecked). After the 10s offline fallback the
    // cloud state is unknown, and seeding would enshrine a stale book.
    // Auto-repair: never seed/publish demo content fused into the real book.
    const local = repairDemoMixedJournalPages(deduplicatePageElements(sanitizePages(pagesRef.current))).pages
    if (sync.pages.length === 0 && sync.cloudChecked) {
      initializedRef.current = true
      if (isDefaultTemplate(local)) {
        // Fresh origin showing the untouched template: there is nothing
        // worth publishing, and seeding it would make the default book
        // canonical for every origin. Stay local until the user edits.
        console.log('[JournalContext] cloud empty but local book is the default template, not seeding')
        return
      }
      console.log('[JournalContext] no cloud data yet, publishing local pages')
      // First device online: publish this origin's data so every origin
      // converges on one shared book instead of per-origin copies.
      sync.savePages(local)
    } else if (sync.cloudChecked) {
      // Cloud confirmed and non-empty: the adopt effect merges it in.
      initializedRef.current = true
    }
    // Otherwise the cloud state is still unknown (offline fallback);
    // stay uninitialized and decide when the first snapshot arrives.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: publish local data once cloud becomes available
  }, [isAuthenticated, sync.loading, sync.cloudChecked])

  useEffect(() => {
    // Cloud merge is only legitimate when the live state is the REAL journal.
    // During the demo→google flip commit this is false even though isDemo is
    // already false: the live pages still hold demo content and the rebase
    // effect runs afterwards. Without this guard a stale cloud snapshot
    // (surviving sign-out because the disabled sync path never cleared it) is
    // merged with demo content and persisted/published as the real book — the
    // "sign-in book mixed with the anonymous book" bug.
    if (!mayMergeCloudWithLiveState(initializedRef.current, isDemo, liveJournalSourceRef.current)) return
    if (sync.pages.length === 0) return
    const incoming = deduplicatePageElements(sanitizePages(sync.pages))
    const local = deduplicatePageElements(sanitizePages(pagesRef.current))
    // Merge the cloud book with this origin's local book instead of
    // replacing it, so edits made while offline (or on the old sync
    // design) are never lost; per element the newest `_updatedAt` wins.
    const merged = mergePageSnapshots([
      { pages: incoming, updatedAt: 0, deviceId: 'cloud' },
      { pages: local, updatedAt: 0, deviceId: 'local' },
    ])
    // Auto-heal the already-published mix: the pre-fix flip merged the demo
    // book into this real journal (local + cloud slots). Strip demo pages and
    // demo elements from the merged book so the corruption stops self-
    // perpetuating, and publish the cleaned book back to the cloud.
    const repaired = repairDemoMixedJournalPages(deduplicatePageElements(sanitizePages(merged)))
    const canonical = (pages: Page[]) =>
      pages.map(p => ({ ...p, elements: [...(p.elements ?? [])].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)) }))
    if (JSON.stringify(canonical(pagesRef.current)) === JSON.stringify(canonical(repaired.pages))) return
    setPages(repaired.pages)
    savePagesToStorage(repaired.pages)
    // Publish the converged book back to this origin's cloud slot, so every
    // origin's slot converges on the same content instead of each origin
    // retaining a divergent copy. Never publish the untouched template.
    if (!isDefaultTemplate(deduplicatePageElements(sanitizePages(pagesRef.current)))) {
      sync.savePages(repaired.pages)
    }
  }, [sync.pages, sync.savePages, isDemo])

  const hadLocalMetadataRef = useRef(session === 'demo' ? false : !!loadMetadataFromStorage())

  const [anniversaryDate, setAnniversaryDate] = useState(() => {
    const src = session === 'demo' ? getDemoMetadata() : (loadMetadataFromStorage() ?? getDefaultMetadata())
    return src.anniversaryDate ?? getDefaultMetadata().anniversaryDate
  })
  const [milestones, setMilestones] = useState<Milestone[]>(() => {
    const src = session === 'demo' ? getDemoMetadata() : (loadMetadataFromStorage() ?? getDefaultMetadata())
    return src.milestones ?? getDefaultMetadata().milestones
  })
  const [occasions, setOccasions] = useState<Occasion[]>(() => {
    const src = session === 'demo' ? getDemoMetadata() : (loadMetadataFromStorage() ?? getDefaultMetadata())
    return src.occasions ?? getDefaultMetadata().occasions
  })
  const [journeyDetails, setJourneyDetails] = useState(() => {
    const src = session === 'demo' ? getDemoMetadata() : (loadMetadataFromStorage() ?? getDefaultMetadata())
    return src.journeyDetails ?? getDefaultMetadata().journeyDetails
  })

  const metadataChannelRef = useRef<BroadcastChannel | null>(null)
  const metadataReceiveRef = useRef(false)
  const firebaseMetaReceiveRef = useRef(false)
  const deviceIdRef = useRef(`meta-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`)

  useEffect(() => {
    // The demo session is per-tab and fully isolated: it must never join the
    // shared 'journal-metadata' BroadcastChannel (which carries the real
    // journal's metadata between tabs).
    if (isDemo) return
    const channel = new BroadcastChannel('journal-metadata')
    metadataChannelRef.current = channel
    channel.onmessage = (e) => {
      const msg = e.data as JournalMetadata & { _senderId?: string }
      // Ignore self-received messages to avoid flag pollution
      if (msg._senderId === deviceIdRef.current) return
      const meta = msg
      metadataReceiveRef.current = true
      setAnniversaryDate(meta.anniversaryDate)
      setMilestones(meta.milestones ?? getDefaultMetadata().milestones)
      setOccasions(meta.occasions ?? getDefaultMetadata().occasions)
      setJourneyDetails(meta.journeyDetails ?? getDefaultMetadata().journeyDetails)
      saveMetadataToStorage(meta)
    }
    return () => channel.close()
  }, [isDemo])

  // Broadcast metadata changes (skip cross-tab broadcast if just received from another source)
  const metaPrevRef = useRef<string>('')
  const syncSaveMetadataRef = useRef(sync.saveMetadata)
  useEffect(() => { syncSaveMetadataRef.current = sync.saveMetadata }, [sync.saveMetadata])
  useEffect(() => {
    const meta: JournalMetadata = { anniversaryDate, milestones: milestones ?? [], occasions: occasions ?? [], journeyDetails }
    const key = JSON.stringify(meta)
    if (key === metaPrevRef.current) return
    metaPrevRef.current = key
    // Gate on the live source, not isDemo alone: during the demo→google flip
    // the live metadata is still the demo book's while isDemo is already
    // false. Writing it to journal_metadata / Firebase here is exactly the
    // "left panel replaced by the anonymous book" bug.
    if (isDemo || !liveStateBelongsToRealJournal(liveJournalSourceRef.current)) {
      // Demo metadata lives ONLY in demo-scoped storage; it must never reach
      // journal_metadata, Firebase, or the shared metadata BroadcastChannel.
      setDemoMetadata(meta)
      return
    }
    // Always persist to localStorage and Firebase
    saveMetadataToStorage(meta)
    syncSaveMetadataRef.current(meta)
    // Only broadcast to other tabs if not received from another source
    if (metadataReceiveRef.current || firebaseMetaReceiveRef.current) {
      metadataReceiveRef.current = false
      firebaseMetaReceiveRef.current = false
      return
    }
    metadataChannelRef.current?.postMessage({ ...meta, _senderId: deviceIdRef.current })
  }, [anniversaryDate, milestones, occasions, journeyDetails, isDemo])

  // Apply incoming metadata from Firebase (other users)
  useEffect(() => {
    if (isDemo) return
    if (!sync.metadata) return
    // Cloud metadata may still be the anonymous demo book's (published by the
    // pre-fix flip window). Never apply it — restore real local metadata (or,
    // if the real key was itself overwritten, a fresh template) instead.
    if (isDemoMetadata(sync.metadata)) {
      const current: JournalMetadata = { anniversaryDate, milestones: milestones ?? [], occasions: occasions ?? [], journeyDetails }
      if (isDemoMetadata(current)) {
        const real = loadMetadataFromStorage()
        const target = real && !isDemoMetadata(real) ? real : getDefaultMetadata()
        setAnniversaryDate(target.anniversaryDate)
        setMilestones(target.milestones ?? [])
        setOccasions(target.occasions ?? [])
        setJourneyDetails(target.journeyDetails)
        saveMetadataToStorage(target)
      }
      return
    }
    const current2: JournalMetadata = { anniversaryDate, milestones, occasions, journeyDetails }
    if (JSON.stringify(current2) === JSON.stringify(sync.metadata)) return
    // If local metadata was loaded from localStorage, don't let Firebase overwrite with defaults
    if (hadLocalMetadataRef.current && JSON.stringify(sync.metadata) === JSON.stringify(getDefaultMetadata())) return
    firebaseMetaReceiveRef.current = true
    setAnniversaryDate(sync.metadata.anniversaryDate)
    setMilestones(sync.metadata.milestones ?? getDefaultMetadata().milestones)
    setOccasions(sync.metadata.occasions ?? getDefaultMetadata().occasions)
    setJourneyDetails(sync.metadata.journeyDetails ?? getDefaultMetadata().journeyDetails)
    saveMetadataToStorage(sync.metadata)
  }, [sync.metadata, isDemo])

  // When the book boots already-open, land on the first content spread
  // (indices 1–2, i.e. "Pg 1–2") exactly like tapping the open button does,
  // instead of the cover spread ("Pg 0–1").
  const [currentPageIndex, setCurrentPageIndex] = useState(initialBookClosed ? 0 : 1)
  const [focusPageIndex, setFocusPageIndexState] = useState(initialBookClosed ? 0 : 1)
  const focusPageIndexRef = useRef(focusPageIndex)
  useEffect(() => { focusPageIndexRef.current = focusPageIndex }, [focusPageIndex])
  const setFocusPageIndex = useCallback((index: number) => {
    focusPageIndexRef.current = index
    setFocusPageIndexState(index)
  }, [])

  const [rightPanelWidth, setRightPanelWidth] = useState(0)
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null)
  const [selectedElementIds, setSelectedElementIds] = useState<string[]>([])
  const [drawSettings, setDrawSettings] = useState<DrawSettings>({
    active: false,
    brush: 'pen',
    color: '#2c3e50',
    strokeWidth: 3,
  })

  const [uploadedPhotos, setUploadedPhotos] = useState<{ id: string; src: string; name: string }[]>([])
  const addUploadedPhotos = useCallback((newPhotos: { id: string; src: string; name: string }[]) => {
    setUploadedPhotos(prev => [...prev, ...newPhotos])
  }, [])

  const getFocusPageIndex = useCallback(() => focusPageIndexRef.current, [])

  const storageTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // --- Undo / redo -------------------------------------------------------
  // Snapshot-based: every committed change pushes the previous book onto the
  // stack. Restores are merge-aware: elements are re-stamped with fresh
  // timestamps so the restored state wins the newest-timestamp merge on
  // every device, and elements created after the snapshot are tombstoned so
  // they cannot resurrect through the union merge.
  //
  // Coalescing is per-element, not blind time-based: rapid commits only fold
  // into the previous step while the SAME element(s) keep changing (held
  // arrow keys, quick repeat tweaks). A change touching different elements
  // always becomes its own step, so one Ctrl+Z undoes exactly one element's
  // operation. Callers can also pass undoOpt 'skip' to join the pending step
  // (e.g. filling in a freshly created empty text box) so an empty box never
  // becomes an undo destination.
  const UNDO_MAX = 60
  const UNDO_COALESCE_MS = 450
  const undoStackRef = useRef<Page[][]>([])
  const redoStackRef = useRef<Page[][]>([])
  const lastUndoPushRef = useRef(0)
  const lastUndoIdsRef = useRef<Set<string> | null>(null)
  const [undoDepth, setUndoDepth] = useState(0)
  const [redoDepth, setRedoDepth] = useState(0)

  // Track the prior session so a demo → google transition (sign-in from the
  // isolated demo) is detected deterministically.
  const prevSessionRef = useRef(session)
  useEffect(() => {
    const prev = prevSessionRef.current
    prevSessionRef.current = session
    if (session !== 'google' || prev === 'google') return
    // Whenever the session becomes google — direct from demo, via null after
    // leaving the demo, or from signed-out — the live pages/metadata may still
    // hold the demo journey (leaving demo keeps demo records live and never
    // resets pages). Rebase the live state onto the REAL local journal so the
    // cloud init/merge/save paths never publish demo content into the shared
    // cloud journal (later demo edits are never re-carried). The adoption
    // effect (below) is the ONLY legitimate way to carry demo content into the
    // real journal, and it re-reads demoStorage directly, so this rebase does
    // not disturb the eligible adoption path. A returning google user at
    // startup already initializes pages from real storage, making this a
    // content no-op for them.
    //
    // The undo/redo stacks also hold demo-content snapshots; clear them so a
    // post-transition Ctrl+Z can never pop a demo snapshot and publish it to
    // the real cloud via publishRestored (isDemo is already false by then). The
    // pending debounced storage write (which captures a now-stale session in
    // its closure) is cancelled so it can't write real content into demo
    // records (or vice versa) after the transition.
    if (storageTimerRef.current) {
      clearTimeout(storageTimerRef.current)
      storageTimerRef.current = null
    }
    initializedRef.current = false
    const rebased = computeDemoToGoogleRebase({
      loadRealPages: loadPagesFromStorage,
      loadRealMetadata: loadMetadataFromStorage,
      getDefaultPages,
      getDefaultMetadata,
      dedupe: deduplicatePageElements,
      sanitize: sanitizePages,
    })
    pagesRef.current = rebased.pages
    setPages(rebased.pages)
    // The live state is now the real journal; every cloud path may read it.
    liveJournalSourceRef.current = 'real'
    setAnniversaryDate(rebased.metadata.anniversaryDate)
    setMilestones(rebased.metadata.milestones)
    setOccasions(rebased.metadata.occasions)
    setJourneyDetails(rebased.metadata.journeyDetails)
    undoStackRef.current = []
    redoStackRef.current = []
    lastUndoPushRef.current = 0
    lastUndoIdsRef.current = null
    setUndoDepth(0)
    setRedoDepth(0)
  }, [session, setPages, setAnniversaryDate, setMilestones, setOccasions, setJourneyDetails])

  const pushUndoSnapshot = useCallback((force: boolean, affectedIds?: string[]) => {
    const now = Date.now()
    if (
      !force &&
      now - lastUndoPushRef.current < UNDO_COALESCE_MS &&
      affectedIds?.length &&
      lastUndoIdsRef.current?.size &&
      affectedIds.some(id => lastUndoIdsRef.current!.has(id))
    ) {
      return
    }
    lastUndoPushRef.current = now
    lastUndoIdsRef.current = affectedIds?.length ? new Set(affectedIds) : null
    undoStackRef.current.push(JSON.parse(JSON.stringify(pagesRef.current)) as Page[])
    if (undoStackRef.current.length > UNDO_MAX) undoStackRef.current.shift()
    redoStackRef.current = []
    setRedoDepth(0)
    setUndoDepth(undoStackRef.current.length)
  }, [])

  const publishRestored = useCallback((snapshot: Page[]) => {
    const now = journalNow()
    const snapIds = new Set<string>()
    for (const p of snapshot) for (const el of p.elements ?? []) snapIds.add(el.id)
    // Re-stamp timestamps so the restored state wins the newest-timestamp
    // merge, but KEEP each element's deletion state as of the snapshot.
    // Blanket-reviving everything resurrected every tombstone riding along
    // in old snapshots, so one Ctrl+Z brought back many long-dead elements
    // instead of just the last one undone.
    const revived = snapshot.map(p => ({
      ...p,
      elements: (p.elements ?? []).map(el => ({ ...el, data: { ...el.data, _deleted: el.data?._deleted === true, _updatedAt: now } })),
    }))
    const withExtras = revived.map((p, i) => {
      const extras = (pagesRef.current[i]?.elements ?? [])
        .filter(el => !snapIds.has(el.id) && !el.data?._deleted)
        .map(el => ({ ...el, data: { ...el.data, _deleted: true, _updatedAt: now } }))
      return { ...p, elements: [...p.elements, ...extras] }
    })
    const next = sanitizePages(withExtras)
    setPages(next)
    if (isDemo) {
      setDemoPages(next)
      setSelectedElementId(null)
      setSelectedElementIds([])
      return
    }
    savePagesToStorage(next)
    sync.savePages(deduplicatePageElements(next))
    setSelectedElementId(null)
    setSelectedElementIds([])
  }, [sync, isDemo])

  const undo = useCallback(() => {
    const snapshot = undoStackRef.current.pop()
    if (!snapshot) return
    redoStackRef.current.push(JSON.parse(JSON.stringify(pagesRef.current)) as Page[])
    setUndoDepth(undoStackRef.current.length)
    setRedoDepth(redoStackRef.current.length)
    lastUndoPushRef.current = 0
    lastUndoIdsRef.current = null
    publishRestored(snapshot)
  }, [publishRestored])

  const redo = useCallback(() => {
    const snapshot = redoStackRef.current.pop()
    if (!snapshot) return
    undoStackRef.current.push(JSON.parse(JSON.stringify(pagesRef.current)) as Page[])
    setUndoDepth(undoStackRef.current.length)
    setRedoDepth(redoStackRef.current.length)
    lastUndoPushRef.current = 0
    lastUndoIdsRef.current = null
    publishRestored(snapshot)
  }, [publishRestored])

  const savePages = useCallback(
    (updater: (prev: Page[]) => Page[], syncEnabled = true, undoOpt: boolean | 'skip' = false, affectedIds?: string[]) => {
      if (undoOpt === 'skip') {
        // The change joins the pending undo step; stale redo entries are
        // still obsolete though.
        redoStackRef.current = []
        setRedoDepth(0)
      } else if (syncEnabled || undoOpt) {
        pushUndoSnapshot(undoOpt === true, affectedIds)
      }
      const next = sanitizePages(updater(pagesRef.current))
      setPages(next)
      if (storageTimerRef.current) clearTimeout(storageTimerRef.current)
      storageTimerRef.current = setTimeout(() => {
        // Gate on the CURRENT session (via ref), not the value captured when
        // this timer was scheduled: the session may have switched (demo ↔
        // google) during the debounce window, and writing the wrong store would
        // leak real content into demo records (or demo content into the real
        // journal). The live-source check covers the brief flip window where
        // isDemo is already false but the state is still the demo book.
        if (isDemoRef.current || !liveStateBelongsToRealJournal(liveJournalSourceRef.current)) {
          setDemoPages(pagesRef.current)
        } else {
          savePagesToStorage(pagesRef.current)
        }
        storageTimerRef.current = null
      }, 2000)
      if (syncEnabled && !isDemo) {
        sync.savePages(next)
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sync.savePages, pushUndoSnapshot, isDemo])

  useEffect(() => {
    const persistNow = () => {
      if (isDemoRef.current || !liveStateBelongsToRealJournal(liveJournalSourceRef.current)) {
        setDemoPages(pagesRef.current)
      } else {
        savePagesToStorage(pagesRef.current)
      }
    }
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') persistNow()
    }
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('beforeunload', persistNow)
    window.addEventListener('pagehide', persistNow)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('beforeunload', persistNow)
      window.removeEventListener('pagehide', persistNow)
    }
  }, [])

  const addElement = useCallback((element: Omit<CanvasElement, 'id' | 'zIndex'>, pageIdx?: number) => {
    const newElement: CanvasElement = {
      ...element,
      id: `element-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      zIndex: journalNow(),
    }
    const idx = pageIdx ?? focusPageIndexRef.current
    // Cascade the spawn point when something already sits exactly there, so
    // repeated tap-to-insert never stacks invisible boxes on one spot (the
    // "cannot select element" regression).
    const occupied = (el: { x: number; y: number }) =>
      Math.abs(el.x - newElement.x) < 8 && Math.abs(el.y - newElement.y) < 8
    savePages(prev => {
      const page = prev[idx]
      let { x, y } = newElement
      for (let attempt = 0; attempt < 24; attempt++) {
        if (!page.elements.some(occupied)) break
        x += 16
        if (x + newElement.width > 640) { x = Math.max(0, 640 - newElement.width); y = Math.min(860 - newElement.height, y + 24) }
        newElement.x = x
        newElement.y = y
      }
      const updated = [...prev]
      updated[idx] = { ...page, elements: [...page.elements, newElement] }
      return updated
    }, true, true, [newElement.id])
    sync.broadcastOperation({ type: 'element-add', pageIndex: idx, element: newElement })
    return newElement.id
  }, [savePages, sync.broadcastOperation])

  const updateElement = useCallback((id: string, updates: Partial<CanvasElement>, syncEnabled = true, pageIdx?: number, opts?: { skipUndo?: boolean }) => {
    const idx = pageIdx ?? focusPageIndexRef.current
    savePages(prev => {
      const updated = [...prev]
      updated[idx] = {
        ...updated[idx],
        elements: updated[idx].elements.map(el =>
          el.id === id ? { ...el, ...updates, data: { ...el.data, ...((updates as any).data || {}), [ELEMENT_TS_KEY]: journalNow() } } : el
        ),
      }
      return updated
    }, syncEnabled, opts?.skipUndo ? 'skip' : false, [id])
    if (syncEnabled) {
      sync.broadcastOperation({ type: 'element-update', pageIndex: idx, elementId: id, patch: { ...updates, data: { ...((updates as any).data || {}), [ELEMENT_TS_KEY]: journalNow() } } })
    }
  }, [savePages, sync.broadcastOperation])

  const deleteElement = useCallback((id: string, pageIdx?: number, opts?: { skipUndo?: boolean }) => {
    const idx = pageIdx ?? focusPageIndexRef.current
    savePages(prev => {
      const updated = [...prev]
      updated[idx] = {
        ...updated[idx],
        elements: updated[idx].elements.map(el =>
          el.id === id ? { ...el, data: { ...el.data, _deleted: true, _updatedAt: journalNow() } } : el
        ),
      }
      return updated
    }, true, opts?.skipUndo ? 'skip' : true, [id])
    sync.broadcastOperation({ type: 'element-delete', pageIndex: idx, elementId: id })
  }, [savePages, sync.broadcastOperation])

  const deleteElements = useCallback((ids: string[], pageIdx?: number) => {
    const idx = pageIdx ?? focusPageIndexRef.current
    const idSet = new Set(ids)
    savePages(prev => {
      const updated = [...prev]
      updated[idx] = {
        ...updated[idx],
        elements: updated[idx].elements.map(el =>
          idSet.has(el.id) ? { ...el, data: { ...el.data, _deleted: true, _updatedAt: journalNow() } } : el
        ),
      }
      return updated
    }, true, true)
    ids.forEach(id => sync.broadcastOperation({ type: 'element-delete', pageIndex: idx, elementId: id }))
  }, [savePages, sync.broadcastOperation])

  const bringForward = useCallback((id: string, pageIdx?: number) => {
    const idx = pageIdx ?? focusPageIndexRef.current
    savePages(prev => {
      const updated = [...prev]
      const elements = [...updated[idx].elements]
      const elIdx = elements.findIndex(e => e.id === id)
      if (elIdx === -1) return prev
      const el = elements[elIdx]
      const sorted = elements.filter(e => e.id !== id).sort((a, b) => a.zIndex - b.zIndex)
      const above = sorted.find(e => e.zIndex > el.zIndex)
      if (above) {
        const tmp = el.zIndex
        el.zIndex = above.zIndex
        above.zIndex = tmp
      }
      updated[idx] = { ...updated[idx], elements }
      return updated
    })
    const el = pagesRef.current[idx]?.elements.find(e => e.id === id)
    if (el) sync.broadcastOperation({ type: 'element-update', pageIndex: idx, elementId: id, patch: { zIndex: el.zIndex } })
  }, [savePages, sync.broadcastOperation])

  const sendBackward = useCallback((id: string, pageIdx?: number) => {
    const idx = pageIdx ?? focusPageIndexRef.current
    savePages(prev => {
      const updated = [...prev]
      const elements = [...updated[idx].elements]
      const elIdx = elements.findIndex(e => e.id === id)
      if (elIdx === -1) return prev
      const el = elements[elIdx]
      const sorted = elements.filter(e => e.id !== id).sort((a, b) => b.zIndex - a.zIndex)
      const below = sorted.find(e => e.zIndex < el.zIndex)
      if (below) {
        const tmp = el.zIndex
        el.zIndex = below.zIndex
        below.zIndex = tmp
      }
      updated[idx] = { ...updated[idx], elements }
      return updated
    })
    const el = pagesRef.current[idx]?.elements.find(e => e.id === id)
    if (el) sync.broadcastOperation({ type: 'element-update', pageIndex: idx, elementId: id, patch: { zIndex: el.zIndex } })
  }, [savePages, sync.broadcastOperation])

  const updatePageBackground = useCallback((background: string) => {
    const idx = focusPageIndexRef.current
    savePages(prev => {
      const updated = [...prev]
      updated[idx] = { ...updated[idx], background }
      return updated
    }, true, true)
    sync.broadcastOperation({ type: 'page-update', pageIndex: idx, patch: { background } })
  }, [savePages, sync.broadcastOperation])

  const updatePagePattern = useCallback((pattern: PagePattern) => {
    const idx = focusPageIndexRef.current
    savePages(prev => {
      const updated = [...prev]
      updated[idx] = { ...updated[idx], pattern }
      return updated
    }, true, true)
    sync.broadcastOperation({ type: 'page-update', pageIndex: idx, patch: { pattern } })
  }, [savePages, sync.broadcastOperation])

  const updateGridSize = useCallback((size: number) => {
    const idx = focusPageIndexRef.current
    savePages(prev => {
      const updated = [...prev]
      updated[idx] = { ...updated[idx], gridSize: size }
      return updated
    }, true, true)
    sync.broadcastOperation({ type: 'page-update', pageIndex: idx, patch: { gridSize: size } })
  }, [savePages, sync.broadcastOperation])

  const updateAllPagesBackground = useCallback((background: string) => {
    savePages(prev => prev.map(p => ({ ...p, background })), true, true)
  }, [savePages])

  const updateAllPagesPattern = useCallback((pattern: PagePattern) => {
    savePages(prev => prev.map(p => ({ ...p, pattern })), true, true)
  }, [savePages])

  const updateAllPagesGridSize = useCallback((size: number) => {
    savePages(prev => prev.map(p => ({ ...p, gridSize: size })), true, true)
  }, [savePages])

  const transferElement = useCallback((elementId: string, fromPage: number, toPage: number, newX: number, newY: number) => {
    savePages(prev => {
      const updated = [...prev]
      const element = updated[fromPage].elements.find(el => el.id === elementId)
      if (!element) return prev
      const now = journalNow()
      updated[fromPage] = {
        ...updated[fromPage],
        elements: updated[fromPage].elements.map(el =>
          el.id === elementId ? { ...el, data: { ...el.data, _deleted: true, _updatedAt: now } } : el
        ),
      }
      updated[toPage] = {
        ...updated[toPage],
        elements: [...updated[toPage].elements, { ...element, x: newX, y: newY, data: { ...element.data, _deleted: false, _updatedAt: now + 1 } }],
      }
      return updated
    }, true, true)
    sync.broadcastOperation({ type: 'element-move', elementId, fromPage, toPage, x: newX, y: newY })
  }, [savePages, sync.broadcastOperation])

  const replacePageElements = useCallback((newElements: CanvasElement[]) => {
    const idx = focusPageIndexRef.current
    savePages(prev => {
      const updated = [...prev]
      updated[idx] = { ...updated[idx], elements: newElements }
      return updated
    }, true, true)
    sync.broadcastOperation({ type: 'page-elements-replace', pageIndex: idx, elements: newElements })
  }, [savePages, sync.broadcastOperation])

  const clearPage = useCallback(() => {
    const idx = focusPageIndexRef.current
    savePages(prev => {
      const updated = [...prev]
      updated[idx] = {
        ...updated[idx],
        elements: updated[idx].elements.map(el => ({
          ...el,
          data: { ...el.data, _deleted: true, _updatedAt: journalNow() },
        })),
      }
      return updated
    }, true, true)
    sync.broadcastOperation({ type: 'page-clear', pageIndex: idx })
  }, [savePages, sync.broadcastOperation])

  const batchUpdateElements = useCallback((updates: Record<string, Partial<CanvasElement>>, syncEnabled = true, pageIdx?: number) => {
    const idx = pageIdx ?? focusPageIndexRef.current
    savePages(prev => {
      const updated = [...prev]
      updated[idx] = {
        ...updated[idx],
        elements: updated[idx].elements.map(el => {
          const up = updates[el.id]
          if (!up) return el
          return { ...el, ...up, data: { ...el.data, ...(up.data || {}), [ELEMENT_TS_KEY]: journalNow() } }
        }),
      }
      return updated
    }, syncEnabled, false, Object.keys(updates))
    if (syncEnabled) {
      for (const elementId of Object.keys(updates)) {
        sync.broadcastOperation({ type: 'element-update', pageIndex: idx, elementId, patch: { ...updates[elementId], data: { ...(updates[elementId].data || {}), [ELEMENT_TS_KEY]: journalNow() } } })
      }
    }
  }, [savePages, sync.broadcastOperation])

  const addPage = useCallback(() => {
    const newPages = [
      { id: `page-${pagesRef.current.length + 1}`, background: '#f0e6d3', pattern: 'grid', gridSize: 40, elements: [] },
      { id: `page-${pagesRef.current.length + 2}`, background: '#f0e6d3', pattern: 'grid', gridSize: 40, elements: [] },
    ] as Page[]
    savePages(prev => [...prev, ...newPages])
    sync.broadcastOperation({ type: 'page-add', pages: newPages })
  }, [savePages, sync.broadcastOperation])

  const addMilestone = useCallback((label: string, emoji = '🎯') => {
    const ms: Milestone = { id: `ms-${Date.now()}`, label, emoji, done: false }
    setMilestones(prev => [...prev, ms])
  }, [])

  const toggleMilestone = useCallback((id: string) => {
    setMilestones(prev => {
      const target = prev.find(m => m.id === id)
      if (target && !target.done) {
        toast.success('Milestone reached!', {
          description: `${target.emoji} ${target.label}`,
        })
        confetti({
          particleCount: 60,
          spread: 80,
          origin: { y: 0.6 },
          colors: ['#d97757', '#7ba083', '#e8a87c', '#a8c5ab', '#2c3e50'],
        })
      }
      return prev.map(m => m.id === id ? { ...m, done: !m.done } : m)
    })
  }, [])

  const deleteMilestone = useCallback((id: string) => {
    setMilestones(prev => prev.filter(m => m.id !== id))
  }, [])

  const addOccasion = useCallback((label: string, date: string, emoji = '📅') => {
    const oc: Occasion = { id: `oc-${Date.now()}`, label, date, emoji }
    setOccasions(prev => [...prev, oc])
  }, [])

  const deleteOccasion = useCallback((id: string) => {
    setOccasions(prev => prev.filter(o => o.id !== id))
  }, [])

  // Enter the isolated demo journey. Replaces the old local anon session: a
  // demo user must NEVER see or edit the real shared cloud journal, so all
  // demo data lives only in demo-scoped localStorage (demoStorage) and sync is
  // never enabled for the demo path.
  const enterDemoMode = useCallback(() => {
    // Isolation guard: a demo user must NEVER inherit the real journal. The
    // pre-demo app once carried a legacy book (journal_pages, journal_metadata,
    // journal_anon_uid) into the demo under `demo:migrated-legacy-once`; on a
    // browser that had been used by a signed-in account those real keys held the
    // authenticated user's private synced book. purgeLegacyMigratedDemo drops
    // that carried-over copy once. New sessions never set the marker, so this
    // only ever fires for affected legacy browsers.
    purgeLegacyMigratedDemo()
    // First run: seed the built-in sample content. A returning visitor restores
    // their own demo-scoped records below. The demo never reads the real
    // journal keys (journal_pages, journal_metadata, journal_anon_uid).
    if (!hasDemoState()) {
      setDemoPages(getDemoPagesSeed())
      setDemoMetadata(getDemoMetadataSeed())
    }
    // Load the demo book + metadata into the LIVE state so the visitor edits
    // real React state, not just demo storage.
    const demoMeta = getDemoMetadata()
    setAnniversaryDate(demoMeta.anniversaryDate ?? getDefaultMetadata().anniversaryDate)
    setMilestones(demoMeta.milestones ?? getDefaultMetadata().milestones)
    setOccasions(demoMeta.occasions ?? getDefaultMetadata().occasions)
    setJourneyDetails(demoMeta.journeyDetails ?? getDefaultMetadata().journeyDetails)
    setPages(deduplicatePageElements(sanitizePages(getDemoPages())))
    setBookClosedState(getDemoBookClosed())
    setCurrentPageIndex(getDemoBookClosed() ? 0 : 1)
    setFocusPageIndexState(getDemoBookClosed() ? 0 : 1)
    // Entering demo must not inherit undo/redo snapshots from a prior google
    // session: Ctrl+Z in demo must never restore real-journal pages (which
    // would leak real content into the isolated demo view).
    undoStackRef.current = []
    redoStackRef.current = []
    lastUndoPushRef.current = 0
    lastUndoIdsRef.current = null
    setUndoDepth(0)
    setRedoDepth(0)
    // From now on the live state is the demo book.
    liveJournalSourceRef.current = 'demo'
    setSession('demo')
  }, [])

  // FR-010/FR-011: adopt a demo journey into the real journal when the visitor
  // signs in. Runs only when (a) the real book is still the shipped default
  // template, (b) the CLOUD has actually been read (never while unknown), and
  // (c) this account has not already consumed adoption — later demo edits are
  // never re-carried. The intent flag survives the full-page redirect.
  const demoAdoptedAccountsRef = useRef<Set<string>>(new Set())
  useEffect(() => {
    if (!isGoogle) return
    if (!fbAuthenticated || !firebaseUser?.uid) return
    if (sync.loading || !sync.cloudChecked) return
    // The live state must be the real journal before adoption inspects it as
    // "the real book" (and before demo pages are written to the real store).
    if (!liveStateBelongsToRealJournal(liveJournalSourceRef.current)) return
    if (!getAdoptionIntent()) return
    const uid = firebaseUser.uid
    if (demoAdoptedAccountsRef.current.has(uid)) return
    demoAdoptedAccountsRef.current.add(uid)
    // The intent is consumed exactly once: whether or not adoption is
    // eligible, this sign-in round is settled.
    clearAdoptionIntent()
    if (hasAdoptedAccount(uid)) return
    // Never overwrite a non-empty cloud book (e.g. a real journal created on
    // another device) with demo content — adoption only ever applies when the
    // cloud slot is genuinely empty.
    if (sync.pages.length > 0) return
    const real = pagesRef.current
    if (real.length > 0 && !isDefaultTemplate(real)) return
    const adoptedPages = deduplicatePageElements(sanitizePages(getDemoPages()))
    const demoMeta = getDemoMetadata()
    const meta: JournalMetadata = {
      anniversaryDate: demoMeta.anniversaryDate ?? getDefaultMetadata().anniversaryDate,
      milestones: demoMeta.milestones ?? getDefaultMetadata().milestones,
      occasions: demoMeta.occasions ?? getDefaultMetadata().occasions,
      journeyDetails: demoMeta.journeyDetails ?? getDefaultMetadata().journeyDetails,
    }
    setPages(adoptedPages)
    setAnniversaryDate(meta.anniversaryDate)
    setMilestones(meta.milestones)
    setOccasions(meta.occasions)
    setJourneyDetails(meta.journeyDetails)
    savePagesToStorage(adoptedPages)
    saveMetadataToStorage(meta)
    sync.savePages(adoptedPages)
    sync.saveMetadata(meta)
    addAdoptedAccountId(uid)
    toast.success('Your demo journey has been saved to your account.')
  }, [isGoogle, fbAuthenticated, firebaseUser, sync, setPages, setAnniversaryDate, setMilestones, setOccasions, setJourneyDetails])

  const exportBackup = useCallback(async () => {
    const meta: JournalMetadata = {
      anniversaryDate,
      milestones: milestones ?? [],
      occasions: occasions ?? [],
      journeyDetails,
    }
    // Embedding every checkpoint duplicated the whole book per snapshot
    // (~10 MB for a ~200 KB journal). Only the newest checkpoint is embedded;
    // the full history stays in the cloud.
    const checkpointsList = await sync.getHistory()
    let latestCheckpoint: Page[] | null = null
    if (checkpointsList.length > 0) {
      latestCheckpoint = await sync.loadCheckpoint(checkpointsList[0].id)
    }
    const backup = {
      version: BACKUP_VERSION,
      exportedAt: new Date().toISOString(),
      pages: pagesRef.current,
      metadata: meta,
      checkpoint: latestCheckpoint,
      checkpointMeta: checkpointsList.slice(0, 1),
    }
    // Minified: pretty-printing turned drawing strokes into hundreds of
    // thousands of lines.
    const json = JSON.stringify(backup)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `journey-backup-${new Date().toISOString().slice(0, 10)}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    toast.success('Backup downloaded!')
  }, [anniversaryDate, milestones, occasions, journeyDetails, sync.getHistory, sync.loadCheckpoint])

  // Restore the journal from an exported backup (the JSON produced by
  // exportBackup). The restored pages become the authoritative book for the
  // current session — for a google session that means local journal_pages AND
  // the cloud slot. publishRestored stamps every element with a fresh
  // timestamp and tombstones anything currently live that isn't in the backup,
  // so the subsequent cloud merge cannot resurrect old/other content on top of
  // the restored book. Metadata is replaced and persisted the same way.
  const restoreBackup = useCallback((backup: { pages: Page[]; metadata: JournalMetadata }) => {
    if (!Array.isArray(backup?.pages) || !backup?.metadata) {
      toast.error('Invalid backup file.')
      return
    }
    const restored = deduplicatePageElements(sanitizePages(backup.pages))
    if (restored.length === 0) {
      toast.error('Backup contains no pages.')
      return
    }
    const meta = backup.metadata
    setAnniversaryDate(meta.anniversaryDate ?? getDefaultMetadata().anniversaryDate)
    setMilestones(meta.milestones ?? getDefaultMetadata().milestones)
    setOccasions(meta.occasions ?? getDefaultMetadata().occasions)
    setJourneyDetails(meta.journeyDetails ?? getDefaultMetadata().journeyDetails)
    const persisted: JournalMetadata = {
      anniversaryDate: meta.anniversaryDate ?? getDefaultMetadata().anniversaryDate,
      milestones: meta.milestones ?? getDefaultMetadata().milestones,
      occasions: meta.occasions ?? getDefaultMetadata().occasions,
      journeyDetails: meta.journeyDetails ?? getDefaultMetadata().journeyDetails,
    }
    if (isDemoRef.current || !liveStateBelongsToRealJournal(liveJournalSourceRef.current)) {
      setDemoMetadata(persisted)
    } else {
      saveMetadataToStorage(persisted)
      sync.saveMetadata(persisted)
    }
    publishRestored(restored)
    toast.success('Book restored from backup.')
  }, [sync, publishRestored])

  return (
    <JournalContext.Provider
      value={{
        pages, bookClosed, setBookClosed, currentPageIndex, setCurrentPageIndex,
        focusPageIndex, setFocusPageIndex, getFocusPageIndex, transferElement,
        addElement, updateElement, deleteElement, deleteElements, replacePageElements, clearPage,
        bringForward, sendBackward, updatePageBackground, updateAllPagesBackground, updatePagePattern, updateAllPagesPattern, updateGridSize, updateAllPagesGridSize, addPage,
        users, currentUser,
        remoteCursors: cursors, updateCursorPosition,
        anniversaryDate, setAnniversaryDate,
        milestones, addMilestone, toggleMilestone, deleteMilestone,
        occasions, addOccasion, deleteOccasion,
        drawSettings, setDrawSettings,
        uploadedPhotos, addUploadedPhotos,
        selectedElementId, setSelectedElementId,
        selectedElementIds, setSelectedElementIds, batchUpdateElements,
        journeyDetails, setJourneyDetails,
        rightPanelWidth, setRightPanelWidth,
        isAuthenticated, isDemo, authLoading, authError, cloudLoading: isGoogle && sync.loading, signInWithGoogle, signInAnonymously: enterDemoMode, signOut,
        syncLoading, isConnected: sync.isConnected,
        syncLatency, syncPeakLatency,
        flushSync: () => { sync.savePages(deduplicatePageElements(sanitizePages(pagesRef.current))); sync.flushPages() },
        undo, redo,
        canUndo: undoDepth > 0,
        canRedo: redoDepth > 0,
        saveCheckpoint, loadCheckpoint, deleteCheckpoint, checkpoints, refreshCheckpoints,
        exportBackup, restoreBackup,
      }}
    >
      {children}
    </JournalContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useJournal() {
  const context = useContext(JournalContext)
  if (!context) throw new Error('useJournal must be used within JournalProvider')
  return context
}
