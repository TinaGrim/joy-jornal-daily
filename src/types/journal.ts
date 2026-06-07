export interface CanvasElement {
  id: string
  type: 'image' | 'text' | 'sticker' | 'shape' | 'envelope' | 'emoji' | 'drawing'
  x: number
  y: number
  width: number
  height: number
  rotation: number
  zIndex: number
  data: Record<string, unknown>
}

export type PagePattern = 'grid' | 'dots' | 'blank'

export interface Page {
  id: string
  background: string
  elements: CanvasElement[]
  pattern?: PagePattern
  gridSize?: number
}

export interface User {
  id: string
  name: string
  color: string
  cursorX: number
  cursorY: number
  currentPage: number
}

export type PanelType =
  | 'photo'
  | 'templates'
  | 'draw'
  | 'text'
  | 'emoji'
  | 'stickers'
  | 'envelope'
  | 'shapes'
  | 'background'
  | 'history'
  | null

export interface JourneyDetails {
  title: string
  dates: string
  destination: string
  flag: string
}

export interface Milestone {
  id: string
  label: string
  emoji: string
  done: boolean
}

export interface Occasion {
  id: string
  label: string
  date: string
  emoji: string
}

export type BrushType = 'pen' | 'marker' | 'highlighter' | 'eraser' | 'lasso'

export interface DrawSettings {
  active: boolean
  brush: BrushType
  color: string
  strokeWidth: number
}
