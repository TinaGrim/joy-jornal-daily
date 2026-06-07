import type { Page, Milestone, Occasion, JourneyDetails, CanvasElement } from '@/types/journal'

export interface JournalMetadata {
  anniversaryDate: string
  milestones: Milestone[]
  occasions: Occasion[]
  journeyDetails: JourneyDetails
}

export type CursorUpdate = {
  userId: string
  name: string
  color: string
  x: number
  y: number
  page: number
  updatedAt: number
}

export type SyncOperation = (
  | { type: 'element-add'; pageIndex: number; element: CanvasElement }
  | { type: 'element-update'; pageIndex: number; elementId: string; patch: Partial<CanvasElement> }
  | { type: 'element-delete'; pageIndex: number; elementId: string }
  | { type: 'element-move'; elementId: string; fromPage: number; toPage: number; x: number; y: number }
  | { type: 'page-add'; pages: Page[] }
  | { type: 'page-update'; pageIndex: number; patch: Partial<Pick<Page, 'background' | 'pattern' | 'gridSize'>> }
  | { type: 'page-elements-replace'; pageIndex: number; elements: CanvasElement[] }
  | { type: 'page-clear'; pageIndex: number }
) & { _uid?: string; _createdAt?: number }

export type SyncMessage =
  | { type: 'full-state'; pages: Page[]; updatedAt: number }
  | { type: 'pages-update'; pages: Page[]; updatedAt: number }
  | { type: 'operation'; operation: SyncOperation }
  | { type: 'cursor-update'; userId: string; name: string; color: string; x: number; y: number; page: number; updatedAt: number }
  | { type: 'metadata-update'; metadata: JournalMetadata; updatedAt: number }
