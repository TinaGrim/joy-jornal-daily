import { Download, Database } from 'lucide-react'
import { toast } from 'sonner'
import { useJournal } from '../contexts/JournalContext'

export default function ExportButton() {
  const { exportBackup } = useJournal()

  const handleExport = async (format: 'png' | 'pdf') => {
    const book = document.querySelector('[data-book]')
    if (!book) {
      toast.error('Could not find the journal page to export.')
      return
    }

    try {
      if (format === 'png') {
        const { default: html2canvas } = await import('html2canvas')
        const canvas = await html2canvas(book as HTMLElement, {
          backgroundColor: '#f0e6d3',
          scale: 2,
        })
        const link = document.createElement('a')
        link.download = `journal-page-${Date.now()}.png`
        link.href = canvas.toDataURL('image/png')
        link.click()
        toast.success('Page exported as PNG!')
      } else {
        toast.success('PDF export coming soon!')
      }
    } catch {
      toast.error('Export failed. Try again.')
    }
  }

  return (
    <div className="relative">
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
          </div>
        </div>
      </div>
    </div>
  )
}
