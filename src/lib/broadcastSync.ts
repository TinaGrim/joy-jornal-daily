import type { Page } from '@/types/journal'
import type { CursorUpdate, SyncMessage, JournalMetadata, SyncOperation } from './syncTypes'

export type OnPagesCb = (pages: Page[]) => void
export type OnCursorCb = (cursor: CursorUpdate) => void
export type OnMetadataCb = (metadata: JournalMetadata) => void
export type OnOperationCb = (operation: SyncOperation) => void

export class BroadcastSync {
  private channel: BroadcastChannel
  private pages: Page[] = []
  private metadata: JournalMetadata | null = null
  private onPages: OnPagesCb
  private onConnected: (connected: boolean) => void
  private onCursor: OnCursorCb | null = null
  private onMetadata: OnMetadataCb | null = null
  private onOperation: OnOperationCb | null = null

  constructor(
    onPages: OnPagesCb,
    onConnected: (connected: boolean) => void,
    onCursor?: OnCursorCb,
    onMetadata?: OnMetadataCb,
    onOperation?: OnOperationCb,
  ) {
    this.onPages = onPages
    this.onConnected = onConnected
    this.onCursor = onCursor ?? null
    this.onMetadata = onMetadata ?? null
    this.onOperation = onOperation ?? null
    this.channel = new BroadcastChannel('journal-sync')

    this.channel.onmessage = (e) => {
      const msg = e.data as SyncMessage
      if (msg.type === 'full-state' || msg.type === 'pages-update') {
        this.onPages(msg.pages)
      } else if (msg.type === 'operation' && this.onOperation) {
        this.onOperation(msg.operation)
      } else if (msg.type === 'cursor-update' && this.onCursor) {
        this.onCursor(msg)
      } else if (msg.type === 'metadata-update' && this.onMetadata) {
        this.metadata = msg.metadata
        this.onMetadata(msg.metadata)
      }
    }
  }

  get isConnected(): boolean {
    return true
  }

  start() {
    this.onConnected(true)
    if (this.pages.length > 0) {
      const msg: SyncMessage = { type: 'full-state', pages: this.pages, updatedAt: Date.now() }
      this.channel.postMessage(msg)
    }
    if (this.metadata) {
      const msg: SyncMessage = { type: 'metadata-update', metadata: this.metadata, updatedAt: Date.now() }
      this.channel.postMessage(msg)
    }
  }

  destroy() {
    this.channel.close()
  }

  setPages(pages: Page[]) {
    this.pages = pages
  }

  setMetadata(metadata: JournalMetadata) {
    this.metadata = metadata
  }

  broadcastPages(pages: Page[]) {
    this.pages = pages
    const msg: SyncMessage = { type: 'pages-update', pages, updatedAt: Date.now() }
    this.channel.postMessage(msg)
  }

  broadcastCursor(userId: string, name: string, color: string, x: number, y: number, page: number) {
    const msg: SyncMessage = { type: 'cursor-update', userId, name, color, x, y, page, updatedAt: Date.now() }
    this.channel.postMessage(msg)
  }

  broadcastMetadata(metadata: JournalMetadata) {
    this.metadata = metadata
    const msg: SyncMessage = { type: 'metadata-update', metadata, updatedAt: Date.now() }
    this.channel.postMessage(msg)
  }

  broadcastOperation(operation: SyncOperation) {
    const msg: SyncMessage = { type: 'operation', operation }
    this.channel.postMessage(msg)
  }
}

export function createSync(
  onPages: OnPagesCb,
  onConnected: (connected: boolean) => void,
  onCursor?: OnCursorCb,
  onMetadata?: OnMetadataCb,
  onOperation?: OnOperationCb,
): BroadcastSync {
  return new BroadcastSync(onPages, onConnected, onCursor, onMetadata, onOperation)
}
