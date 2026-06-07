import { useState, useCallback } from 'react'
import { useJournal } from '@/app/contexts/JournalContext'
import { cn } from '@/lib/utils'
import { Clock, RotateCcw, Save, Trash2, Check, Sparkles } from 'lucide-react'

export default function HistoryPanel() {
  const { saveCheckpoint, loadCheckpoint, deleteCheckpoint, checkpoints, refreshCheckpoints } = useJournal()
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  const handleSave = useCallback(async () => {
    setSaving(true)
    await saveCheckpoint('Manual')
    setSaving(false)
  }, [saveCheckpoint])

  const handleRestore = useCallback(async (id: string) => {
    const data = await loadCheckpoint(id)
    if (data) {
      await refreshCheckpoints()
    }
  }, [loadCheckpoint, refreshCheckpoints])

  const handleDelete = useCallback(async (id: string) => {
    if (confirmDelete !== id) {
      setConfirmDelete(id)
      setTimeout(() => setConfirmDelete(null), 3000)
      return
    }
    await deleteCheckpoint(id)
    setConfirmDelete(null)
  }, [confirmDelete, deleteCheckpoint])

  const formatDate = (ts: number) => {
    const d = new Date(ts)
    return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className="flex flex-col h-full">
      <button
        onClick={handleSave}
        disabled={saving}
        className={cn(
          'shrink-0 w-full py-3 rounded-xl text-sm font-handwriting transition-all cursor-pointer flex items-center justify-center gap-2',
          saving
            ? 'bg-sage/30 text-sage cursor-wait'
            : 'bg-sage text-white hover:bg-sage/90 shadow-sm',
        )}
      >
        {saving ? (
          <><Clock className="w-4 h-4 animate-spin" /> Saving...</>
        ) : (
          <><Save className="w-4 h-4" /> Save Checkpoint</>
        )}
      </button>

      <div className="flex-1 overflow-y-auto mt-4 space-y-2 min-h-0">
        {checkpoints.length === 0 && (
          <p className="text-xs text-text-muted font-handwriting text-center pt-4">
            No checkpoints yet. Click above to save one.
          </p>
        )}
        {checkpoints.map((cp) => (
          <div
            key={cp.id}
            className="bg-white rounded-xl border border-border-light p-3 space-y-2"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                {cp.label === 'Auto' ? (
                  <Sparkles className="w-3.5 h-3.5 text-sage shrink-0" />
                ) : (
                  <Clock className="w-3.5 h-3.5 text-warm-brown shrink-0" />
                )}
                <span className="text-xs text-ink-navy font-handwriting truncate">
                  {formatDate(cp.savedAt)}
                </span>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => handleRestore(cp.id)}
                  className="p-1.5 rounded-lg text-sage hover:bg-sage/10 transition-colors cursor-pointer"
                  title="Restore this checkpoint"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => handleDelete(cp.id)}
                  className={cn(
                    'p-1.5 rounded-lg transition-colors cursor-pointer',
                    confirmDelete === cp.id
                      ? 'bg-red-100 text-red-500'
                      : 'text-text-muted hover:text-red-400 hover:bg-red-50',
                  )}
                  title={confirmDelete === cp.id ? 'Click again to confirm' : 'Delete'}
                >
                  {confirmDelete === cp.id ? <Check className="w-3.5 h-3.5" /> : <Trash2 className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
            {cp.label && (
              <span className={cn(
                'inline-block px-2 py-0.5 rounded text-[10px] font-handwriting',
                cp.label === 'Auto'
                  ? 'bg-sage/10 text-sage'
                  : 'bg-warm-brown/10 text-warm-brown',
              )}>
                {cp.label}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
