import { useState } from 'react'
import { motion } from 'motion/react'
import { useJournal } from '../contexts/JournalContext'
import { useTheme } from '../contexts/ThemeContext'
import { Heart, Trophy, Calendar, Plus, X, Check, ChevronLeft, ChevronRight } from 'lucide-react'
import ExportButton from './ExportButton'

const ORNAMENT = '\u2766'

interface LeftSidebarProps {
  open: boolean
  onToggle: () => void
}

function computeDaysUntil(dateStr: string): number | null {
  const parts = dateStr.split('.')
  if (parts.length !== 3) return null
  const day = parseInt(parts[0], 10)
  const month = parseInt(parts[1], 10) - 1
  const year = parseInt(parts[2], 10)
  const today = new Date()
  let target = new Date(year, month, day)
  target.setHours(0, 0, 0, 0)
  today.setHours(0, 0, 0, 0)
  if (target < today) {
    target = new Date(year + 1, month, day)
  }
  const diff = target.getTime() - today.getTime()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

export default function LeftSidebar({ open, onToggle }: LeftSidebarProps) {
  const {
    milestones, addMilestone, toggleMilestone, deleteMilestone,
    occasions, addOccasion, deleteOccasion,
    anniversaryDate, setAnniversaryDate,
    syncLoading,
  } = useJournal()
  const { theme } = useTheme()
  const isDark = theme === 'night'

  const [newMsLabel, setNewMsLabel] = useState('')
  const [newMsEmoji, setNewMsEmoji] = useState('🎯')
  const [showMsForm, setShowMsForm] = useState(false)

  const [newOcLabel, setNewOcLabel] = useState('')
  const [newOcDate, setNewOcDate] = useState('')
  const [newOcEmoji, setNewOcEmoji] = useState('📅')
  const [showOcForm, setShowOcForm] = useState(false)

  const daysUntil = computeDaysUntil(anniversaryDate)

  const sortedMilestones = [...milestones].sort((a, b) => {
    if (a.done === b.done) return a.id.localeCompare(b.id)
    return a.done ? 1 : -1
  })

  const handleAddMilestone = () => {
    if (!newMsLabel.trim()) return
    addMilestone(newMsLabel.trim(), newMsEmoji)
    setNewMsLabel('')
    setNewMsEmoji('🎯')
    setShowMsForm(prev => !prev)
  }

  const handleAddOccasion = () => {
    if (!newOcLabel.trim() || !newOcDate.trim()) return
    addOccasion(newOcLabel.trim(), newOcDate.trim(), newOcEmoji)
    setNewOcLabel('')
    setNewOcDate('')
    setNewOcEmoji('📅')
    setShowOcForm(prev => !prev)
  }

  return (
    <div className={`fixed left-0 top-0 h-full z-30 ${open ? '' : 'pointer-events-none'}`}>
      {open && (
        <div
          className="fixed inset-0 bg-black/40 z-20 md:hidden pointer-events-auto"
          onClick={onToggle}
        />
      )}
      <motion.div
        animate={{ x: open ? 0 : -288 }}
        transition={{ duration: 0.25, ease: 'easeInOut' }}
        className={`relative h-full shadow-lg flex flex-col ${open ? 'pointer-events-auto' : ''}`}
        style={{
          width: 288,
          background: isDark ? '#1e1e2e' : '#f0e6d3',
          borderRight: isDark ? '2px solid #313244' : '2px solid #e8dcc8',
          backgroundImage: isDark ? 'none' : `
            repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(139,115,85,0.02) 2px, rgba(139,115,85,0.02) 3px),
            repeating-linear-gradient(90deg, transparent, transparent 30px, rgba(139,115,85,0.012) 30px, rgba(139,115,85,0.012) 31px)
          `,
        }}
      >
        <div className="min-w-72 flex-1 flex flex-col relative">
          <div className="sticky top-0 z-10 p-3 flex items-center justify-between" style={{
            background: isDark ? '#1e1e2e' : 'linear-gradient(180deg, #ede2cb, #f0e6d3)',
            borderBottom: isDark ? '2px solid #313244' : '2px solid #e8dcc8',
          }}>
            <div className="flex items-center gap-2">
              <span className={`text-sm ${isDark ? 'text-[#6c7086]' : 'text-[#a89a8a]'}`}>{ORNAMENT}</span>
              <span className={`text-lg font-handwriting tracking-wide ${isDark ? 'text-[#cdd6f4]' : 'text-[#8b7355]'}`}>Our Journey</span>
              <span className={`text-sm ${isDark ? 'text-[#6c7086]' : 'text-[#a89a8a]'}`}>{ORNAMENT}</span>
            </div>
            <ExportButton />
          </div>
          <div className="flex-1 overflow-y-auto px-5 pb-6 flex flex-col gap-6 pt-6">

            {/* Anniversary Countdown */}
            <div className="relative rounded-xl p-5 text-center shadow-sm overflow-hidden" style={{
              background: 'linear-gradient(160deg, #c97050, #d97757 30%, #e8a87c 70%, #d97757)',
              border: '1px solid rgba(255,255,255,0.15)',
            }}>
              <div className="absolute top-0 left-0 right-0 h-1" style={{
                background: 'repeating-linear-gradient(90deg, rgba(255,255,255,0.15) 0, rgba(255,255,255,0.15) 4px, transparent 4px, transparent 8px)',
              }} />
              <div className="absolute -top-6 -right-6 w-16 h-16 rounded-full opacity-10" style={{
                background: 'radial-gradient(circle, #fff, transparent)',
              }} />
              <div className="absolute -bottom-4 -left-4 w-12 h-12 rounded-full opacity-10" style={{
                background: 'radial-gradient(circle, #fff, transparent)',
              }} />
              <div className="flex items-center justify-center gap-1.5 mb-3">
                <Heart className="w-3.5 h-3.5 fill-white/80" style={{ color: '#fff' }} />
                <span className="text-[12px] font-handwriting uppercase tracking-[0.15em] text-white/75">Anniversary Countdown</span>
                <Heart className="w-3.5 h-3.5 fill-white/80" style={{ color: '#fff' }} />
              </div>
              <div className="text-5xl font-display font-bold text-white mb-1" style={{ textShadow: '0 2px 8px rgba(0,0,0,0.15)' }}>
                {daysUntil !== null ? daysUntil : '--'}
              </div>
              <div className="text-sm font-handwriting text-white/85">days &hearts;</div>
              <div className="text-xs font-handwriting text-white/60 mt-1">
                until {anniversaryDate}
              </div>
              <div className="mt-3 pt-3 border-t border-white/10">
                <input
                  type="text"
                  value={anniversaryDate}
                  onChange={e => setAnniversaryDate(e.target.value)}
                  className="w-28 mx-auto bg-white/15 text-white/80 text-xs text-center rounded px-2 py-1 outline-none placeholder:text-white/30 border border-white/10 font-handwriting"
                  placeholder="DD.MM.YYYY"
                />
              </div>
            </div>

            {/* Milestones */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-[#c97050]" />
                  <h2 className={`text-lg font-display tracking-wide ${isDark ? 'text-[#cdd6f4]' : 'text-[#5a4a3a]'}`}>Milestones</h2>
                </div>
                <button
                  type="button"
                  onClick={() => setShowMsForm(prev => !prev)}
                  className={`p-1 rounded transition-colors cursor-pointer ${isDark ? 'hover:bg-[#45475a] text-[#a6adc8] hover:text-[#f38ba8]' : 'hover:bg-[#e5d5b8] text-[#8b7355] hover:text-[#c97050]'}`}
                >
                  {showMsForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                </button>
              </div>
              <div className="space-y-1.5">
                {syncLoading && sortedMilestones.length === 0 && (
                  <div className="space-y-1.5">
                    <div className="h-11 rounded-lg animate-pulse" style={{ background: isDark ? '#45475a' : '#e5d5b8', opacity: 0.5 }} />
                    <div className="h-11 rounded-lg animate-pulse" style={{ background: isDark ? '#45475a' : '#e5d5b8', opacity: 0.35 }} />
                    <div className="h-11 rounded-lg animate-pulse" style={{ background: isDark ? '#45475a' : '#e5d5b8', opacity: 0.2 }} />
                  </div>
                )}
                {!syncLoading && sortedMilestones.length === 0 && !showMsForm && (
                  <p className={`text-xs font-handwriting text-center py-3 ${isDark ? 'text-[#6c7086]' : 'text-[#a89a8a]'}`}>
                    No milestones yet &mdash; click <Plus className="inline w-3 h-3 -mt-0.5" /> to add one
                  </p>
                )}
                {sortedMilestones.map(ms => (
                  <div
                    key={ms.id}
                    className="group flex items-center gap-2.5 p-2.5 rounded-lg transition-all cursor-pointer"
                    style={{
                      background: ms.done ? 'rgba(123,160,131,0.08)' : isDark ? '#313244' : '#faf6ef',
                      border: isDark ? `1.5px solid ${ms.done ? '#7ba083' : '#45475a'}` : `1.5px solid ${ms.done ? '#7ba083' : '#e8dcc8'}`,
                      opacity: ms.done ? 0.75 : 1,
                    }}
                    onClick={() => toggleMilestone(ms.id)}
                  >
                    <div
                      className="w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all"
                      style={{
                        background: ms.done ? '#7ba083' : 'transparent',
                        borderColor: ms.done ? '#7ba083' : '#dccfc0',
                      }}
                    >
                      {ms.done && <Check className="w-3 h-3 text-white" />}
                    </div>
                    <span className="text-base">{ms.emoji}</span>
                    <span
                      className="text-sm font-handwriting flex-1 transition-all"
                      style={{
                        color: ms.done ? '#7ba083' : isDark ? '#cdd6f4' : '#5a4a3a',
                        textDecoration: ms.done ? 'line-through' : 'none',
                      }}
                    >
                      {ms.label}
                    </span>
                    <button
                      type="button"
                      onClick={e => { e.stopPropagation(); deleteMilestone(ms.id) }}
                      className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-red-50 text-red-400 hover:text-red-600 transition-all cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
                {showMsForm && (
                  <div className="flex items-center gap-2 p-2 rounded-lg" style={{
                    border: '1.5px dashed #dccfc0',
                    background: isDark ? '#313244' : '#faf6ef',
                  }}>
                    <input
                      value={newMsEmoji}
                      onChange={e => setNewMsEmoji(e.target.value)}
                      className={`w-8 text-center text-lg bg-transparent outline-none ${isDark ? 'text-[#cdd6f4]' : ''}`}
                      maxLength={2}
                    />
                    <input
                      value={newMsLabel}
                      onChange={e => setNewMsLabel(e.target.value)}
                      placeholder="What's next?"
                      className={`flex-1 bg-transparent outline-none text-sm font-handwriting placeholder:text-[#a89a8a] ${isDark ? 'text-[#cdd6f4]' : 'text-[#5a4a3a]'}`}
                      onKeyDown={e => e.key === 'Enter' && handleAddMilestone()}
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={handleAddMilestone}
                      className="p-1 rounded text-white transition-colors cursor-pointer"
                      style={{ background: '#c97050' }}
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Occasions */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-[#c97050]" />
                  <h2 className={`text-lg font-display tracking-wide ${isDark ? 'text-[#cdd6f4]' : 'text-[#5a4a3a]'}`}>Occasions</h2>
                </div>
                <button
                  type="button"
                  onClick={() => setShowOcForm(prev => !prev)}
                  className={`p-1 rounded transition-colors cursor-pointer ${isDark ? 'hover:bg-[#45475a] text-[#a6adc8] hover:text-[#f38ba8]' : 'hover:bg-[#e5d5b8] text-[#8b7355] hover:text-[#c97050]'}`}
                >
                  {showOcForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                </button>
              </div>
              <div className="space-y-1.5">
                {syncLoading && occasions.length === 0 && (
                  <div className="space-y-1.5">
                    <div className="h-11 rounded-lg animate-pulse" style={{ background: isDark ? '#45475a' : '#e5d5b8', opacity: 0.5 }} />
                    <div className="h-11 rounded-lg animate-pulse" style={{ background: isDark ? '#45475a' : '#e5d5b8', opacity: 0.35 }} />
                  </div>
                )}
                {!syncLoading && occasions.length === 0 && !showOcForm && (
                  <p className={`text-xs font-handwriting text-center py-2 ${isDark ? 'text-[#6c7086]' : 'text-[#a89a8a]'}`}>
                    No occasions yet &mdash; add birthdays, trips & more
                  </p>
                )}
                {occasions.map(oc => (
                  <div
                    key={oc.id}
                    className="group flex items-center gap-2.5 p-2.5 rounded-lg transition-all cursor-default"
                    style={{
                      background: isDark ? '#313244' : '#faf6ef',
                      border: isDark ? '1.5px solid #45475a' : '1.5px solid #e8dcc8',
                    }}
                  >
                    <span className="text-base">{oc.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <div className={`text-sm font-handwriting truncate ${isDark ? 'text-[#cdd6f4]' : 'text-[#5a4a3a]'}`}>{oc.label}</div>
                      <div className={`text-[11px] font-handwriting ${isDark ? 'text-[#6c7086]' : 'text-[#a89a8a]'}`}>{oc.date}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => deleteOccasion(oc.id)}
                      className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-red-50 text-red-400 hover:text-red-600 transition-all cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
                {showOcForm && (
                  <div className="space-y-2 p-2.5 rounded-lg" style={{
                    border: '1.5px dashed #dccfc0',
                    background: isDark ? '#313244' : '#faf6ef',
                  }}>
                    <div className="flex items-center gap-2">
                      <input
                        value={newOcEmoji}
                        onChange={e => setNewOcEmoji(e.target.value)}
                        className={`w-8 text-center text-lg bg-transparent outline-none ${isDark ? 'text-[#cdd6f4]' : ''}`}
                        maxLength={2}
                      />
                      <input
                        value={newOcLabel}
                        onChange={e => setNewOcLabel(e.target.value)}
                        placeholder="Label"
                        className={`flex-1 bg-transparent outline-none text-sm font-handwriting placeholder:text-[#a89a8a] ${isDark ? 'text-[#cdd6f4]' : 'text-[#5a4a3a]'}`}
                        autoFocus
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        value={newOcDate}
                        onChange={e => setNewOcDate(e.target.value)}
                        placeholder="Date (e.g. 12 Mar)"
                        className={`flex-1 bg-transparent outline-none text-xs font-handwriting placeholder:text-[#a89a8a] ${isDark ? 'text-[#a6adc8]' : 'text-[#8b7355]'}`}
                        onKeyDown={e => e.key === 'Enter' && handleAddOccasion()}
                      />
                      <button
                        type="button"
                        onClick={handleAddOccasion}
                        className="p-1 rounded text-white transition-colors cursor-pointer"
                        style={{ background: '#c97050' }}
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

          </div>
          <div className="h-2 opacity-[0.03] pointer-events-none" style={{
            background: 'linear-gradient(180deg, transparent, rgba(0,0,0,0.3))',
          }} />
        </div>
      </motion.div>

      <button
        type="button"
        onClick={onToggle}
        className="absolute top-1/2 -translate-y-1/2 h-14 w-5 flex items-center justify-center rounded-r-md shadow-sm z-30 transition-colors cursor-pointer pointer-events-auto"
        style={{
          left: open ? 288 : 0,
          transition: 'left 0.25s ease-in-out',
          background: isDark ? '#313244' : 'linear-gradient(180deg, #ede2cb, #f0e6d3)',
          border: isDark ? '2px solid #45475a' : '2px solid #e8dcc8',
          borderLeft: 'none',
          color: isDark ? '#cdd6f4' : '#8b7355',
        }}
        title={open ? 'Close sidebar' : 'Open sidebar'}
      >
        {open ? <ChevronLeft className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
      </button>
    </div>
  )
}
