import { createContext, useContext, useState, useRef, useEffect, type ReactNode, useCallback } from 'react'
import { toast } from 'sonner'
import confetti from 'canvas-confetti'
import type { CanvasElement, Page, User, Milestone, Occasion, DrawSettings, JourneyDetails, PagePattern } from '@/types/journal'
import type { JournalMetadata, SyncOperation } from '@/lib/syncTypes'
import type { CheckpointInfo } from '@/lib/firebaseSync'
import { useFirebaseAuth } from '@/hooks/useFirebaseAuth'
import { useWebRTCSync } from '@/hooks/useWebRTCSync'

const STORAGE_KEY_PAGES = 'journal_pages'
const STORAGE_KEY_METADATA = 'journal_metadata'
const STORAGE_KEY_UID = 'journal_anon_uid'
const ELEMENT_TS_KEY = '_updatedAt'

function sanitizePages(pages: Page[]): Page[] {
  return pages.map(p => ({ ...p, elements: p.elements ?? [] }))
}

function deduplicatePageElements(pages: Page[]): Page[] {
  const seen = new Set<string>()
  return pages.map(page => ({
    ...page,
    elements: page.elements.filter(el => {
      if (seen.has(el.id)) return false
      seen.add(el.id)
      return true
    })
  }))
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
  updateElement: (id: string, updates: Partial<CanvasElement>, syncEnabled?: boolean, pageIdx?: number) => void
  deleteElement: (id: string, pageIdx?: number) => void
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
  authLoading: boolean
  authError: string | null
  signInWithGoogle: () => void
  signInAnonymously: () => void
  signOut: () => void
  syncLoading: boolean
  isConnected: boolean
  flushSync: () => void
  saveCheckpoint: (label?: string) => Promise<void>
  loadCheckpoint: (id: string) => Promise<Page[] | null>
  deleteCheckpoint: (id: string) => Promise<void>
  checkpoints: CheckpointInfo[]
  refreshCheckpoints: () => Promise<void>
  syncLatency: number
  syncPeakLatency: number
}

const JournalContext = createContext<JournalContextType | undefined>(undefined)

export function JournalProvider({ children }: { children: ReactNode }) {
  const {
    user: firebaseUser,
    loading: authLoading,
    signInWithGoogle: fbSignIn,
    signOut: fbSignOut,
    isAuthenticated: fbAuthenticated,
  } = useFirebaseAuth()

  const [authError, setAuthError] = useState<string | null>(null)
  const [localUser, setLocalUser] = useState<{ uid: string; displayName: string } | null>(() => {
    const stored = localStorage.getItem(STORAGE_KEY_UID)
    return stored ? { uid: stored, displayName: 'You' } : null
  })

  const effectiveUser = firebaseUser ?? localUser
  const isAuthenticated = fbAuthenticated || !!localUser

  const signInWithGoogle = useCallback(async () => {
    try {
      setAuthError(null)
      await fbSignIn()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Sign in failed'
      if (msg.includes('auth/configuration-not-found')) {
        setAuthError('Google sign-in is not enabled in your Firebase project. Go to Firebase Console → Authentication → Sign-in method → enable Google, or use "Continue without account" below.')
      } else {
        setAuthError(msg)
      }
    }
  }, [fbSignIn])

  const signInAnonymously = useCallback(() => {
    let uid = localStorage.getItem(STORAGE_KEY_UID)
    if (!uid) {
      uid = `anon-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
      localStorage.setItem(STORAGE_KEY_UID, uid)
    }
    setLocalUser({ uid, displayName: 'You' })
  }, [])

  const signOut = useCallback(async () => {
    try {
      setLocalUser(null)
      localStorage.removeItem(STORAGE_KEY_UID)
      await fbSignOut()
    } catch (err) {
      console.error('[JournalContext] signOut failed:', err)
    }
  }, [fbSignOut])

  const sync = useWebRTCSync(isAuthenticated)
  const syncLoading = isAuthenticated && fbAuthenticated && sync.loading
  const syncLatency = sync.lastLatency
  const syncPeakLatency = sync.peakLatency

  const [checkpoints, setCheckpoints] = useState<CheckpointInfo[]>([])
  const refreshCheckpoints = useCallback(async () => {
    const list = await sync.getHistory()
    setCheckpoints(list)
  }, [sync])
  useEffect(() => { // eslint-disable-next-line react-hooks/set-state-in-effect -- init checkpoints from Firebase
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
      saveUserCursor(effectiveUser?.uid ?? 'local', currentUser.name, currentUser.color, x, y, page)
    },
    [saveUserCursor, currentUser.name, currentUser.color, effectiveUser?.uid],
  )

  const [bookClosed, setBookClosed] = useState(true)

  const [pages, setPages] = useState<Page[]>(() => {
    const stored = loadPagesFromStorage()
    console.log('[JournalContext] useState init, stored pages:', stored?.length, stored?.[1]?.elements?.length)
    return stored ?? getDefaultPages()
  })

  const pagesRef = useRef(pages)
  useEffect(() => { pagesRef.current = pages }, [pages])

  const initializedRef = useRef(false)

  useEffect(() => {
    if (!isAuthenticated) {
      console.log('[JournalContext] init skip: not authenticated 2')
      return
    }
    if (initializedRef.current) {
      return
    }

    if (!sync.loading && sync.pages.length > 0) {
      console.log('[JournalContext] loading', sync.pages.length, 'pages from BroadcastChannel peer')
      initializedRef.current = true
      const cleaned = deduplicatePageElements(sanitizePages(sync.pages))
      // eslint-disable-next-line react-hooks/set-state-in-effect -- sync external state into React
      setPages(cleaned)
      savePagesToStorage(cleaned)
    } else if (!sync.loading) {
      console.log('[JournalContext] No peer data yet, keeping localStorage')
      initializedRef.current = true
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: only react to peer data loading once
  }, [isAuthenticated, sync.loading])

  useEffect(() => {
    if (!initializedRef.current) return
    if (sync.pages.length === 0) return
    const incoming = deduplicatePageElements(sanitizePages(sync.pages))
    if (pagesRef.current.length !== incoming.length) {
      setPages(incoming)
    } else {
      let changed = false
      for (let i = 0; i < incoming.length && !changed; i++) {
        const a = pagesRef.current[i]
        const b = incoming[i]
        if (a.background !== b.background || a.pattern !== b.pattern) changed = true
        if ((a.elements?.length ?? 0) !== (b.elements?.length ?? 0)) changed = true
        if (!changed) {
          for (let j = 0; j < (a.elements?.length ?? 0) && !changed; j++) {
            const ea = a.elements[j]
            const eb = b.elements[j]
            if (ea.x !== eb.x || ea.y !== eb.y || ea.width !== eb.width || ea.height !== eb.height) changed = true
            if (!changed && ea.data?.[ELEMENT_TS_KEY] !== eb.data?.[ELEMENT_TS_KEY]) changed = true
          }
        }
      }
      if (changed) setPages(incoming)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: only react to sync.pages changes
  }, [sync.pages])

  const hadLocalMetadataRef = useRef(!!loadMetadataFromStorage())

  const [anniversaryDate, setAnniversaryDate] = useState(() => (loadMetadataFromStorage() ?? getDefaultMetadata()).anniversaryDate ?? getDefaultMetadata().anniversaryDate)
  const [milestones, setMilestones] = useState<Milestone[]>(() => (loadMetadataFromStorage() ?? getDefaultMetadata()).milestones ?? getDefaultMetadata().milestones)
  const [occasions, setOccasions] = useState<Occasion[]>(() => (loadMetadataFromStorage() ?? getDefaultMetadata()).occasions ?? getDefaultMetadata().occasions)
  const [journeyDetails, setJourneyDetails] = useState(() => (loadMetadataFromStorage() ?? getDefaultMetadata()).journeyDetails ?? getDefaultMetadata().journeyDetails)

  const metadataChannelRef = useRef<BroadcastChannel | null>(null)
  const metadataReceiveRef = useRef(false)
  const firebaseMetaReceiveRef = useRef(false)
  const deviceIdRef = useRef(`meta-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`)

  useEffect(() => {
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
  }, [])

  // Broadcast metadata changes (skip cross-tab broadcast if just received from another source)
  const metaPrevRef = useRef<string>('')
  useEffect(() => {
    const meta: JournalMetadata = { anniversaryDate, milestones: milestones ?? [], occasions: occasions ?? [], journeyDetails }
    const key = JSON.stringify(meta)
    if (key === metaPrevRef.current) return
    metaPrevRef.current = key
    // Always persist to localStorage and Firebase
    saveMetadataToStorage(meta)
    sync.saveMetadata(meta)
    // Only broadcast to other tabs if not received from another source
    if (metadataReceiveRef.current || firebaseMetaReceiveRef.current) {
      metadataReceiveRef.current = false
      firebaseMetaReceiveRef.current = false
      return
    }
    metadataChannelRef.current?.postMessage({ ...meta, _senderId: deviceIdRef.current })
  }, [anniversaryDate, milestones, occasions, journeyDetails, sync])

  // Apply incoming metadata from Firebase (other users)
  useEffect(() => {
    if (!sync.metadata) return
    const current: JournalMetadata = { anniversaryDate, milestones, occasions, journeyDetails }
    if (JSON.stringify(current) === JSON.stringify(sync.metadata)) return
    // If local metadata was loaded from localStorage, don't let Firebase overwrite with defaults
    if (hadLocalMetadataRef.current && JSON.stringify(sync.metadata) === JSON.stringify(getDefaultMetadata())) return
    firebaseMetaReceiveRef.current = true
    setAnniversaryDate(sync.metadata.anniversaryDate)
    setMilestones(sync.metadata.milestones ?? getDefaultMetadata().milestones)
    setOccasions(sync.metadata.occasions ?? getDefaultMetadata().occasions)
    setJourneyDetails(sync.metadata.journeyDetails ?? getDefaultMetadata().journeyDetails)
    saveMetadataToStorage(sync.metadata)
  }, [sync.metadata])

  const [currentPageIndex, setCurrentPageIndex] = useState(0)
  const [focusPageIndex, setFocusPageIndexState] = useState(0)
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

  const getFocusPageIndex = useCallback(() => focusPageIndexRef.current, [])

  const storageTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const savePages = useCallback(
    (updater: (prev: Page[]) => Page[], syncEnabled = true) => {
    const next = sanitizePages(updater(pagesRef.current))
    setPages(next)
    if (storageTimerRef.current) clearTimeout(storageTimerRef.current)
    storageTimerRef.current = setTimeout(() => {
      savePagesToStorage(pagesRef.current)
      storageTimerRef.current = null
    }, 2000)
    if (syncEnabled && sync.isConnected) {
      sync.savePages(next)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sync.isConnected, sync.savePages])

  const addElement = useCallback((element: Omit<CanvasElement, 'id' | 'zIndex'>, pageIdx?: number) => {
    const newElement: CanvasElement = {
      ...element,
      id: `element-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      zIndex: Date.now(),
    }
    const idx = pageIdx ?? focusPageIndexRef.current
    savePages(prev => {
      const updated = [...prev]
      updated[idx] = { ...updated[idx], elements: [...updated[idx].elements, newElement] }
      return updated
    })
    sync.broadcastOperation({ type: 'element-add', pageIndex: idx, element: newElement })
    return newElement.id
  }, [savePages, sync.broadcastOperation])

  const updateElement = useCallback((id: string, updates: Partial<CanvasElement>, syncEnabled = true, pageIdx?: number) => {
    const idx = pageIdx ?? focusPageIndexRef.current
    savePages(prev => {
      const updated = [...prev]
      updated[idx] = {
        ...updated[idx],
        elements: updated[idx].elements.map(el =>
          el.id === id ? { ...el, ...updates, data: { ...el.data, ...((updates as any).data || {}), [ELEMENT_TS_KEY]: Date.now() } } : el
        ),
      }
      return updated
    }, syncEnabled)
    if (syncEnabled) {
      sync.broadcastOperation({ type: 'element-update', pageIndex: idx, elementId: id, patch: { ...updates, data: { ...((updates as any).data || {}), [ELEMENT_TS_KEY]: Date.now() } } })
    }
  }, [savePages, sync.broadcastOperation])

  const deleteElement = useCallback((id: string, pageIdx?: number) => {
    const idx = pageIdx ?? focusPageIndexRef.current
    savePages(prev => {
      const updated = [...prev]
      updated[idx] = {
        ...updated[idx],
        elements: updated[idx].elements.filter(el => el.id !== id),
      }
      return updated
    })
    sync.broadcastOperation({ type: 'element-delete', pageIndex: idx, elementId: id })
  }, [savePages, sync.broadcastOperation])

  const deleteElements = useCallback((ids: string[], pageIdx?: number) => {
    const idx = pageIdx ?? focusPageIndexRef.current
    const idSet = new Set(ids)
    savePages(prev => {
      const updated = [...prev]
      updated[idx] = {
        ...updated[idx],
        elements: updated[idx].elements.filter(el => !idSet.has(el.id)),
      }
      return updated
    })
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
    })
    sync.broadcastOperation({ type: 'page-update', pageIndex: idx, patch: { background } })
  }, [savePages, sync.broadcastOperation])

  const updatePagePattern = useCallback((pattern: PagePattern) => {
    const idx = focusPageIndexRef.current
    savePages(prev => {
      const updated = [...prev]
      updated[idx] = { ...updated[idx], pattern }
      return updated
    })
    sync.broadcastOperation({ type: 'page-update', pageIndex: idx, patch: { pattern } })
  }, [savePages, sync.broadcastOperation])

  const updateGridSize = useCallback((size: number) => {
    const idx = focusPageIndexRef.current
    savePages(prev => {
      const updated = [...prev]
      updated[idx] = { ...updated[idx], gridSize: size }
      return updated
    })
    sync.broadcastOperation({ type: 'page-update', pageIndex: idx, patch: { gridSize: size } })
  }, [savePages, sync.broadcastOperation])

  const updateAllPagesBackground = useCallback((background: string) => {
    savePages(prev => prev.map(p => ({ ...p, background })), true)
  }, [savePages])

  const updateAllPagesPattern = useCallback((pattern: PagePattern) => {
    savePages(prev => prev.map(p => ({ ...p, pattern })), true)
  }, [savePages])

  const updateAllPagesGridSize = useCallback((size: number) => {
    savePages(prev => prev.map(p => ({ ...p, gridSize: size })), true)
  }, [savePages])

  const transferElement = useCallback((elementId: string, fromPage: number, toPage: number, newX: number, newY: number) => {
    savePages(prev => {
      const updated = [...prev]
      const element = updated[fromPage].elements.find(el => el.id === elementId)
      if (!element) return prev
      updated[fromPage] = {
        ...updated[fromPage],
        elements: updated[fromPage].elements.filter(el => el.id !== elementId),
      }
      updated[toPage] = {
        ...updated[toPage],
        elements: [...updated[toPage].elements, { ...element, x: newX, y: newY, data: { ...element.data, [ELEMENT_TS_KEY]: Date.now() } }],
      }
      return updated
    })
    sync.broadcastOperation({ type: 'element-move', elementId, fromPage, toPage, x: newX, y: newY })
  }, [savePages, sync.broadcastOperation])

  const replacePageElements = useCallback((newElements: CanvasElement[]) => {
    const idx = focusPageIndexRef.current
    savePages(prev => {
      const updated = [...prev]
      updated[idx] = { ...updated[idx], elements: newElements }
      return updated
    })
    sync.broadcastOperation({ type: 'page-elements-replace', pageIndex: idx, elements: newElements })
  }, [savePages, sync.broadcastOperation])

  const clearPage = useCallback(() => {
    const idx = focusPageIndexRef.current
    savePages(prev => {
      const updated = [...prev]
      updated[idx] = { ...updated[idx], elements: [] }
      return updated
    })
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
          return { ...el, ...up, data: { ...el.data, ...(up.data || {}), [ELEMENT_TS_KEY]: Date.now() } }
        }),
      }
      return updated
    }, syncEnabled)
    if (syncEnabled) {
      for (const elementId of Object.keys(updates)) {
        sync.broadcastOperation({ type: 'element-update', pageIndex: idx, elementId, patch: { ...updates[elementId], data: { ...(updates[elementId].data || {}), [ELEMENT_TS_KEY]: Date.now() } } })
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
        selectedElementId, setSelectedElementId,
        selectedElementIds, setSelectedElementIds, batchUpdateElements,
        journeyDetails, setJourneyDetails,
        rightPanelWidth, setRightPanelWidth,
        isAuthenticated, authLoading, authError, signInWithGoogle, signInAnonymously, signOut,
        syncLoading, isConnected: sync.isConnected,
        syncLatency, syncPeakLatency,
        flushSync: () => { sync.savePages(deduplicatePageElements(sanitizePages(pagesRef.current))); sync.flushPages() },
        saveCheckpoint, loadCheckpoint, deleteCheckpoint, checkpoints, refreshCheckpoints,
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
