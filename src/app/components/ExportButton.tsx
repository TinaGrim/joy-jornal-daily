import { useRef, useState } from 'react'
import { Download, Database, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { useJournal } from '../contexts/JournalContext'
import Canvas from './Canvas'
import { VintageVignette, VintageCorners, ForeEdgePage, BottomPageEdge, RibbonBookmark, CoverOrnament } from './VintageEffects'
import type { Page } from '@/types/journal'
import type { JournalMetadata } from '@/lib/syncTypes'

const PAGE_W = 640
const PAGE_H = 860

function prepareClone(doc: Document) {
  // Strip only the paper-grain SVG (feTurbulence filter), which html2canvas
  // cannot rasterize. Every other decorative SVG (page corners, cover
  // ornament) is kept so the export looks like the real book.
  doc.querySelectorAll('svg').forEach((svg) => {
    if (svg.querySelector('rect[filter]')) svg.remove()
  })
}

async function renderElement(el: HTMLElement) {
  const { default: html2canvas } = await import('html2canvas')
  let lastError: unknown
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const promise = html2canvas(el, {
      backgroundColor: '#f0e6d3',
      scale: 2,
      onclone: prepareClone,
      logging: false,
    })
    try {
      return await Promise.race([
        promise,
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('render timed out')), 30000)),
      ])
    } catch (e) {
      lastError = e
      if (attempt === 0) await new Promise((resolve) => setTimeout(resolve, 500))
    }
  }
  throw lastError
}

// All pages laid out on a single neat sheet, two per row, cover first —
// one organized file instead of the old horizontal strip of whatever was on
// screen at the time.
function sheetCanvas(canvases: HTMLCanvasElement[]) {
  const cols = 2
  const rows = Math.ceil(canvases.length / cols)
  const gap = 28
  const cellW = Math.max(...canvases.map((c) => c.width))
  const cellH = Math.max(...canvases.map((c) => c.height))
  const canvas = document.createElement('canvas')
  canvas.width = cellW * cols + gap * (cols + 1)
  canvas.height = cellH * rows + gap * (rows + 1)
  const context = canvas.getContext('2d')!
  context.fillStyle = '#f0e6d3'
  context.fillRect(0, 0, canvas.width, canvas.height)
  canvases.forEach((c, i) => {
    const col = i % cols
    const row = Math.floor(i / cols)
    context.drawImage(c, gap + col * (cellW + gap), gap + row * (cellH + gap))
  })
  return canvas
}

function download(canvas: HTMLCanvasElement, filename: string) {
  const link = document.createElement('a')
  link.download = filename
  link.href = canvas.toDataURL('image/png')
  link.click()
}

export default function ExportButton() {
  const { pages, exportBackup, restoreBackup } = useJournal()
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const galleryRef = useRef<HTMLDivElement | null>(null)
  const [exporting, setExporting] = useState(false)

  const handleRestoreFile = (file: File | null) => {
    const input = fileInputRef.current
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      let backup: unknown
      try {
        backup = JSON.parse(String(reader.result))
      } catch {
        toast.error('Invalid backup file — not valid JSON.')
        return
      }
      const pages = (backup as { pages?: unknown })?.pages
      const metadata = (backup as { metadata?: unknown })?.metadata
      if (!Array.isArray(pages) || !metadata) {
        toast.error('Invalid backup file — missing pages or metadata.')
        return
      }
      if (!window.confirm('Replace the current book with this backup? This overwrites the local and cloud copies.')) {
        return
      }
      restoreBackup({ pages: pages as Page[], metadata: metadata as JournalMetadata })
    }
    reader.readAsText(file)
    if (input) input.value = ''
  }

  const renderAllPages = async () => {
    setExporting(true)
    // Let the hidden gallery mount and layout before rasterizing.
    await new Promise((resolve) => setTimeout(resolve, 150))
    const container = galleryRef.current
    if (!container) {
      setExporting(false)
      return []
    }
    const targets = Array.from(container.querySelectorAll<HTMLElement>('[data-export-page]'))
    const canvases: HTMLCanvasElement[] = []
    for (const target of targets) canvases.push(await renderElement(target))
    setExporting(false)
    return canvases
  }

  const handleExport = async (format: 'png' | 'pdf') => {
    if (pages.length === 0) {
      toast.error('Nothing to export — the book is empty.')
      return
    }

    try {
      const canvases = await renderAllPages()
      if (canvases.length === 0) {
        toast.error('Could not render the pages to export.')
        return
      }

      if (format === 'png') {
        download(sheetCanvas(canvases), `journal-${Date.now()}.png`)
        toast.success('Journal exported as PNG.')
        return
      }

      const { jsPDF } = await import('jspdf')
      const [first] = canvases
      const w = first.width / 2
      const h = first.height / 2
      const doc = new jsPDF({ orientation: 'portrait', unit: 'px', format: [w, h], compress: true })
      canvases.forEach((canvas, i) => {
        if (i > 0) doc.addPage([canvas.width / 2, canvas.height / 2], 'portrait')
        doc.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, canvas.width / 2, canvas.height / 2)
      })
      doc.save(`journal-${Date.now()}.pdf`)
      toast.success(`Journal exported as PDF — ${canvases.length} page${canvases.length > 1 ? 's' : ''}.`)
    } catch (e) {
      setExporting(false)
      toast.error(`Export failed: ${e instanceof Error ? e.message : 'Try again.'}`)
    }
  }

  return (
    <div className="relative">
      <input
        ref={fileInputRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(e) => handleRestoreFile(e.target.files?.[0] ?? null)}
      />
      <div className="group inline-block">
        <button
          className="p-1.5 rounded-lg bg-white border border-[#e8dcc8] text-[#8b7355] hover:border-[#d97757] hover:text-[#d97757] transition-colors cursor-pointer"
          title="Export page"
          disabled={exporting}
        >
          <Download className="w-4 h-4" />
        </button>
        <div className="absolute right-0 top-full pt-1 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 z-50">
          <div className="bg-white border border-[#e8dcc8] rounded-lg shadow-lg overflow-hidden min-w-[160px]">
            <button
              onClick={() => handleExport('png')}
              disabled={exporting}
              className="block w-full px-3 py-2 text-xs text-[#2c3e50] hover:bg-[#e5d5b8] text-left cursor-pointer whitespace-nowrap disabled:opacity-50"
            >
              Export as PNG
            </button>
            <button
              onClick={() => handleExport('pdf')}
              disabled={exporting}
              className="block w-full px-3 py-2 text-xs text-[#2c3e50] hover:bg-[#e5d5b8] text-left cursor-pointer whitespace-nowrap disabled:opacity-50"
            >
              Export as PDF
            </button>
            <div className="border-t border-[#e8dcc8]" />
            <button
              onClick={exportBackup}
              className="flex items-center gap-2 w-full px-3 py-2 text-xs text-[#2c3e50] hover:bg-[#e5d5b8] text-left cursor-pointer whitespace-nowrap"
            >
              <Database className="w-3 h-3 text-[#8b7355]" />
              Download Backup
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 w-full px-3 py-2 text-xs text-[#2c3e50] hover:bg-[#e5d5b8] text-left cursor-pointer whitespace-nowrap"
            >
              <Upload className="w-3 h-3 text-[#8b7355]" />
              Restore from Backup
            </button>
          </div>
        </div>
      </div>

      {/* Hidden full-book gallery: one copy of every page with the real page
          chrome, used only to rasterize the export. Never interactable. */}
      {exporting && (
        <div
          ref={galleryRef}
          aria-hidden
          className="pointer-events-none"
          style={{ position: 'fixed', left: -20000, top: 0, opacity: 0, zIndex: -1, display: 'flex', gap: 24 }}
        >
          {pages.map((p, i) => {
            const side = i === 0 ? 'right' : i % 2 === 1 ? 'left' : 'right'
            const isCover = i === 0
            return (
              <div
                key={i}
                data-export-page={i}
                className="relative rounded-2xl"
                style={{
                  width: PAGE_W,
                  height: PAGE_H,
                  background: p.background,
                  overflow: 'hidden',
                  borderRadius: 14,
                  boxShadow: 'inset 0 0 0 1px rgba(139,115,85,0.12)',
                }}
              >
                {isCover ? <CoverOrnament /> : <ForeEdgePage side={side} />}
                <Canvas page={p} pageIndex={i} exportMode />
                <BottomPageEdge />
                {isCover ? <RibbonBookmark /> : <VintageCorners side={side} />}
                <VintageVignette isCover={isCover} side={side} />
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}