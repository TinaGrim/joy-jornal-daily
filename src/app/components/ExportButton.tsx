import { useRef } from 'react'
import { Download, Database, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { useJournal } from '../contexts/JournalContext'
import type { Page } from '@/types/journal'
import type { JournalMetadata } from '@/lib/syncTypes'

function prepareClone(doc: Document) {
  doc.querySelectorAll('svg').forEach((svg) => {
    if (svg.querySelector('rect[filter]') || !svg.getAttribute('width') || !svg.getAttribute('height')) {
      svg.remove()
    }
  })
}

function pageTargets(book: Element): HTMLElement[] {
  const pages = Array.from(document.querySelectorAll<HTMLElement>('[data-page-index]'))
  return pages.length ? pages : [book as HTMLElement]
}

async function renderElement(el: HTMLElement) {
  const { default: html2canvas } = await import('html2canvas')
  let lastError: unknown
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const promise = html2canvas(el, {
      backgroundColor: '#f0e6d3',
      scale: 2,
      onclone: prepareClone,
    })
    try {
      return await Promise.race([
        promise,
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('render timed out')), 20000)),
      ])
    } catch (e) {
      lastError = e
      if (attempt === 0) await new Promise((resolve) => setTimeout(resolve, 500))
    }
  }
  throw lastError
}

function stitchPages(canvases: HTMLCanvasElement[]) {
  const width = canvases.reduce((sum, c) => sum + c.width, 0)
  const height = Math.max(...canvases.map((c) => c.height))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')!
  context.fillStyle = '#f0e6d3'
  context.fillRect(0, 0, width, height)
  let x = 0
  for (const pageCanvas of canvases) {
    context.drawImage(pageCanvas, x, 0)
    x += pageCanvas.width
  }
  return canvas
}

export default function ExportButton() {
  const { exportBackup, restoreBackup } = useJournal()
  const fileInputRef = useRef<HTMLInputElement | null>(null)

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

  const handleExport = async (format: 'png' | 'pdf') => {
    const book = document.querySelector('[data-book]')
    if (!book) {
      toast.error('Could not find the journal page to export.')
      return
    }

    try {
      const targets = pageTargets(book)
      if (format === 'png') {
        const canvases = await Promise.all(targets.map((page) => renderElement(page)))
        const canvas = canvases.length > 1 ? stitchPages(canvases) : canvases[0]
        const link = document.createElement('a')
        link.download = `journal-page-${Date.now()}.png`
        link.href = canvas.toDataURL('image/png')
        link.click()
        toast.success('Page exported as PNG!')
        return
      }

      const { jsPDF } = await import('jspdf')
      const canvases = await Promise.all(targets.map((page) => renderElement(page)))
      const [first] = canvases
      const w = first.width / 2
      const h = first.height / 2
      const doc = new jsPDF({ orientation: 'portrait', unit: 'px', format: [w, h], compress: true })
      canvases.forEach((canvas, i) => {
        if (i > 0) doc.addPage([canvas.width / 2, canvas.height / 2], 'portrait')
        doc.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, canvas.width / 2, canvas.height / 2)
      })
      doc.save(`journal-${Date.now()}.pdf`)
      toast.success('Journal exported as PDF!')
    } catch (e) {
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
        >
          <Download className="w-4 h-4" />
        </button>
        <div className="absolute right-0 top-full pt-1 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 z-50">
          <div className="bg-white border border-[#e8dcc8] rounded-lg shadow-lg overflow-hidden min-w-[160px]">
            <button
              onClick={() => handleExport('png')}
              className="block w-full px-3 py-2 text-xs text-[#2c3e50] hover:bg-[#e5d5b8] text-left cursor-pointer whitespace-nowrap"
            >
              Export as PNG
            </button>
            <button
              onClick={() => handleExport('pdf')}
              className="block w-full px-3 py-2 text-xs text-[#2c3e50] hover:bg-[#e5d5b8] text-left cursor-pointer whitespace-nowrap"
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
    </div>
  )
}