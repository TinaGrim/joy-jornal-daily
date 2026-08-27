import type { Page, CanvasElement } from '@/types/journal'
import type { JournalMetadata } from '@/lib/syncTypes'

/**
 * Demo journal content (FR-002).
 *
 * This module provides a self-contained sample journey used by the demo
 * session mode. It is intentionally DISTINCT from the default real template
 * shipped in JournalContext (getDefaultPages/getDefaultMetadata): every page,
 * element, and metadata id carries a `demo-` prefix, the title and colors
 * differ, and the pages carry example text, shape, sticker, emoji, and
 * envelope elements so a reviewer can tell demo content apart from the real
 * template at a glance.
 *
 * The module is pure: it performs no side effects on load, touches no
 * storage or network, and imports only types.
 */

/** A single demo cover element. */
const coverElements: CanvasElement[] = [
  {
    id: 'demo-cover-flag',
    type: 'text',
    x: 230,
    y: 70,
    width: 180,
    height: 110,
    rotation: -3,
    zIndex: 1,
    data: { text: '🏝️🌺', font: 'Caveat', fontSize: 68, color: '#3f5a4a', textAlign: 'center' },
  },
  {
    id: 'demo-cover-rule-left',
    type: 'shape',
    x: 90,
    y: 220,
    width: 210,
    height: 2,
    rotation: 0,
    zIndex: 2,
    data: { shape: 'rectangle', fill: '#4a7c6f', opacity: 0.4 },
  },
  {
    id: 'demo-cover-rule-right',
    type: 'shape',
    x: 340,
    y: 220,
    width: 210,
    height: 2,
    rotation: 0,
    zIndex: 3,
    data: { shape: 'rectangle', fill: '#4a7c6f', opacity: 0.4 },
  },
  {
    id: 'demo-cover-title',
    type: 'text',
    x: 60,
    y: 240,
    width: 520,
    height: 70,
    rotation: 0,
    zIndex: 4,
    data: { text: 'Island Escape Notes', font: 'Playfair Display', fontSize: 50, color: '#3f5a4a', textAlign: 'center' },
  },
  {
    id: 'demo-cover-rule-center',
    type: 'shape',
    x: 195,
    y: 335,
    width: 250,
    height: 1.5,
    rotation: 0,
    zIndex: 5,
    data: { shape: 'rectangle', fill: '#7a9e8c', opacity: 0.25 },
  },
  {
    id: 'demo-cover-date',
    type: 'text',
    x: 140,
    y: 355,
    width: 360,
    height: 35,
    rotation: 0,
    zIndex: 6,
    data: { text: '02.08.2026', font: 'Caveat', fontSize: 28, color: '#4a7c6f', textAlign: 'center' },
  },
  {
    id: 'demo-cover-palm',
    type: 'emoji',
    x: 285,
    y: 405,
    width: 70,
    height: 45,
    rotation: 0,
    zIndex: 7,
    data: { emoji: '🌴' },
  },
  {
    id: 'demo-cover-names',
    type: 'text',
    x: 150,
    y: 460,
    width: 340,
    height: 45,
    rotation: 0,
    zIndex: 8,
    data: { text: 'Demo Travellers', font: 'Caveat', fontSize: 34, color: '#7a9e8c', textAlign: 'center' },
  },
  {
    id: 'demo-cover-rule-bottom',
    type: 'shape',
    x: 220,
    y: 535,
    width: 200,
    height: 1,
    rotation: 0,
    zIndex: 9,
    data: { shape: 'rectangle', fill: '#7a9e8c', opacity: 0.2 },
  },
]

/** A single demo content page element. */
const pageOneElements: CanvasElement[] = [
  {
    id: 'demo-p1-heading',
    type: 'text',
    x: 60,
    y: 60,
    width: 520,
    height: 50,
    rotation: 0,
    zIndex: 1,
    data: { text: 'Day One — Arrival', font: 'Caveat', fontSize: 40, color: '#3f5a4a', textAlign: 'left' },
  },
  {
    id: 'demo-p1-body',
    type: 'text',
    x: 60,
    y: 130,
    width: 520,
    height: 120,
    rotation: 0,
    zIndex: 2,
    data: { text: 'The ferry dropped us at the little harbour just after noon. Salt air, warm breeze, and the sound of waves against the pier.', font: 'Caveat', fontSize: 24, color: '#4a4a4a', textAlign: 'left' },
  },
  {
    id: 'demo-p1-sun',
    type: 'emoji',
    x: 500,
    y: 200,
    width: 70,
    height: 70,
    rotation: 0,
    zIndex: 3,
    data: { emoji: '🌅' },
  },
  {
    id: 'demo-p1-sticker',
    type: 'sticker',
    x: 80,
    y: 300,
    width: 120,
    height: 120,
    rotation: -6,
    zIndex: 4,
    data: { sticker: 'palm', label: 'Palm sticker' },
  },
  {
    id: 'demo-p1-shape',
    type: 'shape',
    x: 300,
    y: 320,
    width: 160,
    height: 90,
    rotation: 0,
    zIndex: 5,
    data: { shape: 'circle', fill: '#4a7c6f', opacity: 0.3 },
  },
]

/** A second demo content page element. */
const pageTwoElements: CanvasElement[] = [
  {
    id: 'demo-p2-heading',
    type: 'text',
    x: 60,
    y: 60,
    width: 520,
    height: 50,
    rotation: 0,
    zIndex: 1,
    data: { text: 'Day Two — The Cove', font: 'Caveat', fontSize: 40, color: '#3f5a4a', textAlign: 'left' },
  },
  {
    id: 'demo-p2-body',
    type: 'text',
    x: 60,
    y: 130,
    width: 520,
    height: 120,
    rotation: 0,
    zIndex: 2,
    data: { text: 'Snorkelled the hidden cove this morning. Turquoise water, curious fish, and a tiny beach we had all to ourselves.', font: 'Caveat', fontSize: 24, color: '#4a4a4a', textAlign: 'left' },
  },
  {
    id: 'demo-p2-wave',
    type: 'emoji',
    x: 480,
    y: 180,
    width: 70,
    height: 70,
    rotation: 0,
    zIndex: 3,
    data: { emoji: '🌊' },
  },
  {
    id: 'demo-p2-envelope',
    type: 'envelope',
    x: 90,
    y: 300,
    width: 160,
    height: 120,
    rotation: 0,
    zIndex: 4,
    data: { opened: false, note: 'A little note from the island.', color: '#4a7c6f' },
  },
  {
    id: 'demo-p2-sticker',
    type: 'sticker',
    x: 380,
    y: 320,
    width: 110,
    height: 110,
    rotation: 8,
    zIndex: 5,
    data: { sticker: 'shell', label: 'Shell sticker' },
  },
]

/** A third demo content page element. */
const pageThreeElements: CanvasElement[] = [
  {
    id: 'demo-p3-heading',
    type: 'text',
    x: 60,
    y: 60,
    width: 520,
    height: 50,
    rotation: 0,
    zIndex: 1,
    data: { text: 'Day Three — Sunset', font: 'Caveat', fontSize: 40, color: '#3f5a4a', textAlign: 'left' },
  },
  {
    id: 'demo-p3-body',
    type: 'text',
    x: 60,
    y: 130,
    width: 520,
    height: 120,
    rotation: 0,
    zIndex: 2,
    data: { text: 'Watched the sun melt into the sea from the cliff path. Golden light, a warm breeze, and not a single cloud.', font: 'Caveat', fontSize: 24, color: '#4a4a4a', textAlign: 'left' },
  },
  {
    id: 'demo-p3-moon',
    type: 'emoji',
    x: 490,
    y: 190,
    width: 70,
    height: 70,
    rotation: 0,
    zIndex: 3,
    data: { emoji: '🌙' },
  },
  {
    id: 'demo-p3-shape',
    type: 'shape',
    x: 100,
    y: 300,
    width: 180,
    height: 90,
    rotation: 0,
    zIndex: 4,
    data: { shape: 'rectangle', fill: '#e8a87c', opacity: 0.35 },
  },
  {
    id: 'demo-p3-sticker',
    type: 'sticker',
    x: 360,
    y: 310,
    width: 120,
    height: 120,
    rotation: -4,
    zIndex: 5,
    data: { sticker: 'star', label: 'Star sticker' },
  },
]

/**
 * Returns the demo journal pages: a decorated cover plus three content pages
 * carrying example text, shape, sticker, emoji, and envelope elements.
 */
export function getDemoPages(): Page[] {
  return [
    {
      id: 'demo-cover',
      background: 'linear-gradient(180deg, #dcefe6 0%, #e6f2ec 40%, #eef6f1 100%)',
      pattern: 'blank',
      elements: [...coverElements],
    },
    {
      id: 'demo-page-1',
      background: '#eef6f1',
      pattern: 'grid',
      gridSize: 40,
      elements: [...pageOneElements],
    },
    {
      id: 'demo-page-2',
      background: '#eef6f1',
      pattern: 'grid',
      gridSize: 40,
      elements: [...pageTwoElements],
    },
    {
      id: 'demo-page-3',
      background: '#eef6f1',
      pattern: 'grid',
      gridSize: 40,
      elements: [...pageThreeElements],
    },
  ]
}

/**
 * Returns the demo journal metadata, distinct from the default real template
 * (different title, dates, destination, and flag).
 */
export function getDemoMetadata(): JournalMetadata {
  return {
    anniversaryDate: '02.08.2026',
    milestones: [],
    occasions: [],
    journeyDetails: {
      title: 'Island Escape Notes',
      dates: 'August 2-5, 2026',
      destination: 'Santorini',
      flag: '🇬🇷',
    },
  }
}
