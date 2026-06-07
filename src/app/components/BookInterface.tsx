import { useRef, useState, useEffect, useCallback } from 'react'
import { motion } from 'motion/react'
import { useJournal } from '../contexts/JournalContext'
import Canvas from './Canvas'
import { VintageVignette, VintageCorners, CoverOrnament, ForeEdgePage, BottomPageEdge, RibbonBookmark } from './VintageEffects'
import { ChevronLeft, ChevronRight, Plus, Check, Maximize2, Minimize2 } from 'lucide-react'
import { useAutoSave } from '@/hooks/useAutoSave'

const PAGE_W = 640
const PAGE_H = 860
const SPREAD_W = PAGE_W * 2 + 6

function useScaleToFit(singlePage: boolean) {
  const [scale, setScale] = useState(1)

  useEffect(() => {
    const check = () => {
      const pad = 32
      const navSpace = 80
      const sidebarW = 20
      const rightW = 72
      const bookW = singlePage ? PAGE_W : SPREAD_W
      const availableW = window.innerWidth - sidebarW - rightW - pad * 2
      const availableH = window.innerHeight - pad - (singlePage ? pad : navSpace)

      const wScale = availableW / bookW
      const hScale = availableH / PAGE_H
      const s = Math.min(wScale, hScale, 1)
      setScale(Math.max(0.25, s))
    }
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [singlePage])

  return scale
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export default function BookInterface(_props: Record<string, unknown>) {
  const { pages, bookClosed, setBookClosed, currentPageIndex, setCurrentPageIndex, setFocusPageIndex, addPage } = useJournal()
  const { status } = useAutoSave(pages)
  const containerRef = useRef<HTMLDivElement>(null)

  const [focusMode, setFocusMode] = useState(false)
  const [focusIndex, setFocusIndex] = useState(0)

  const scale = useScaleToFit(focusMode)

  const visibleW = bookClosed ? PAGE_W : focusMode ? PAGE_W : SPREAD_W
  const scaledW = visibleW * scale
  const scaledH = PAGE_H * scale
  const closedX = bookClosed ? -(SPREAD_W - PAGE_W) * scale : 0

  const handleOpen = () => {
    setBookClosed(false)
    setCurrentPageIndex(1)
    setFocusPageIndex(1)
  }

  const handlePrev = useCallback(() => {
    if (focusMode) {
      setFocusIndex(Math.max(0, focusIndex - 1))
      return
    }
    if (currentPageIndex <= 1) {
      setBookClosed(true)
      setCurrentPageIndex(0)
      setFocusPageIndex(0)
    } else {
      const prevIdx = currentPageIndex - 2
      setCurrentPageIndex(prevIdx)
      setFocusPageIndex(prevIdx)
    }
  }, [focusMode, focusIndex, currentPageIndex, setBookClosed, setCurrentPageIndex, setFocusPageIndex])

  const handleNext = useCallback(() => {
    if (focusMode) {
      setFocusIndex(Math.min(pages.length - 1, focusIndex + 1))
      return
    }
    const nextIdx = currentPageIndex + 2
    if (nextIdx < pages.length) {
      setCurrentPageIndex(nextIdx)
      setFocusPageIndex(nextIdx)
    } else {
      addPage()
      setTimeout(() => {
        setCurrentPageIndex(nextIdx)
        setFocusPageIndex(nextIdx)
      }, 0)
    }
  }, [focusMode, focusIndex, currentPageIndex, pages.length, addPage, setCurrentPageIndex, setFocusPageIndex])

  const handleFocusToggle = () => {
    if (!focusMode) {
      setFocusIndex(currentPageIndex)
      setFocusMode(true)
      setBookClosed(false)
    } else {
      const target = focusIndex % 2 === 1 ? focusIndex : Math.min(focusIndex + 1, pages.length - 1)
      setCurrentPageIndex(Math.max(1, target))
      setFocusPageIndex(Math.max(1, target))
      setFocusMode(false)
    }
  }

  useEffect(() => {
    if (!focusMode) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') setFocusIndex(prev => Math.max(0, prev - 1))
      if (e.key === 'ArrowRight') setFocusIndex(prev => Math.min(pages.length - 1, prev + 1))
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [focusMode, pages.length])

  useEffect(() => {
    setFocusPageIndex(focusIndex)
  }, [focusIndex, focusMode, setFocusPageIndex])

  const page = focusMode ? pages[focusIndex] : null

  return (
    <div className="relative flex flex-col items-center" ref={containerRef}>
      <div className="absolute -top-8 right-4 flex items-center gap-2 text-sm min-w-[80px] justify-end z-20">
        {status === 'saving' && (
          <div className="flex items-center gap-2 text-[#8b7355] animate-fade-in-up">
            <div className="w-1.5 h-1.5 bg-[#8b7355] rounded-full animate-pulse-subtle" />
            <span className="font-handwriting text-base">Saving...</span>
          </div>
        )}
        {status === 'saved' && (
          <div className="flex items-center gap-2 text-[#7ba083] animate-fade-in-up">
            <Check className="w-4 h-4" />
            <span className="font-handwriting text-base">Saved</span>
          </div>
        )}
      </div>

      <motion.div
        animate={{ width: scaledW, height: scaledH }}
        transition={{ duration: 0.3, ease: 'easeInOut' }}
        style={{ position: 'relative', overflow: 'hidden' }}
      >
        <motion.div
          animate={{ scale, x: closedX }}
          transition={{ duration: 0.3, ease: 'easeInOut' }}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            transformOrigin: 'top left',
            perspective: '2500px',
            width: SPREAD_W,
            height: PAGE_H,
          }}
        >
          {focusMode && page ? (
            <div
              data-book
              className="flex shadow-2xl rounded-2xl overflow-visible book-shadow relative"
              style={{ transform: 'rotateY(-1.5deg)', transformStyle: 'preserve-3d' }}
            >
              <div
                className="relative rounded-2xl flex flex-col"
                style={{
                  width: PAGE_W,
                  height: PAGE_H,
                  background: page.background,
                }}
              >
                <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-3 py-2 z-20 pointer-events-none">
                  <div className="flex items-center gap-1 pointer-events-auto">
                    <button
                      onClick={handlePrev}
                      disabled={focusIndex <= 0}
                      className="p-1 rounded-full bg-white/80 border border-[#e8dcc8] shadow-sm text-[#8b7355] hover:text-[#d97757] hover:border-[#d97757] disabled:opacity-20 disabled:cursor-not-allowed transition-all cursor-pointer"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <span className="text-xs font-handwriting text-[#8b7355]/70 bg-white/60 px-2 py-0.5 rounded-full pointer-events-auto select-none">
                    {focusIndex} / {pages.length - 1}
                  </span>
                  <div className="flex items-center gap-1 pointer-events-auto">
                    <button
                      onClick={handleNext}
                      disabled={focusIndex >= pages.length - 1}
                      className="p-1 rounded-full bg-white/80 border border-[#e8dcc8] shadow-sm text-[#8b7355] hover:text-[#d97757] hover:border-[#d97757] disabled:opacity-20 disabled:cursor-not-allowed transition-all cursor-pointer"
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={handleFocusToggle}
                      className="p-1 rounded-full bg-white/80 border border-[#e8dcc8] shadow-sm text-[#8b7355] hover:text-[#d97757] hover:border-[#d97757] transition-all cursor-pointer ml-1"
                      title="Exit focus mode"
                    >
                      <Minimize2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="flex-1 relative overflow-clip">
                  <ForeEdgePage side="right" />
                  <Canvas page={page} pageIndex={focusIndex} side="right" />
                  <BottomPageEdge />
                  <VintageCorners side="right" />
                  <VintageVignette side="right" />
                </div>
              </div>

            </div>
          ) : bookClosed ? (
            <div
              data-book
              className="flex shadow-2xl rounded-2xl overflow-visible book-shadow"
              style={{ transform: 'rotateY(-1.5deg)', transformStyle: 'preserve-3d' }}
            >
              <div className="w-[646px]" />
              <div
                className="relative overflow-clip rounded-2xl"
                style={{
                  width: PAGE_W,
                  height: PAGE_H,
                  background: 'linear-gradient(180deg, #ede2cb, #f0e6d3 40%, #ece0c8)',
                  boxShadow: 'inset 12px 0 16px -12px rgba(139,115,85,0.25), inset -4px 0 8px -4px rgba(255,255,255,0.4)',
                }}
              >
                <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-gradient-to-b from-transparent via-warm-brown/10 to-transparent pointer-events-none z-20" />
                <CoverOrnament />
                <div className="w-full h-full relative">
                  <Canvas page={pages[0]} pageIndex={0} side="right" />
                  <div className="absolute bottom-12 left-0 right-0 text-center pointer-events-none z-30">
                    <span className="text-base text-warm-brown font-handwriting opacity-50">
                      Open the book to begin &rarr;
                    </span>
                  </div>
                </div>
                <ForeEdgePage side="right" />
                <BottomPageEdge />
                <RibbonBookmark />
                <VintageVignette isCover side="right" />
              </div>
            </div>
          ) : (
            <div
              data-book
              className="flex shadow-2xl rounded-2xl overflow-visible book-shadow"
              style={{ transform: 'rotateY(-1.5deg)', transformStyle: 'preserve-3d' }}
            >
              <div
                className="relative overflow-clip rounded-s-2xl"
                style={{
                  width: PAGE_W,
                  height: PAGE_H,
                  background: 'linear-gradient(to right, #e5d5b8, #ece0c8 55%, #ede2cb)',
                  borderRight: '2px solid #dccfc0',
                  boxShadow: 'inset -12px 0 16px -12px rgba(139,115,85,0.25), inset 4px 0 8px -4px rgba(255,255,255,0.4)',
                }}
              >
                <ForeEdgePage side="left" />
                <Canvas page={pages[currentPageIndex - 1]} pageIndex={currentPageIndex - 1} side="left" />
                <BottomPageEdge />
                <VintageCorners side="left" />
                <VintageVignette side="left" />
              </div>

              <div
                className="relative z-10"
                style={{
                  width: '6px',
                  height: PAGE_H,
                  background: 'linear-gradient(to right, #b8a898, #d4c4b0 25%, #e0d4c4 50%, #d4c4b0 75%, #b8a898)',
                  boxShadow: '-2px 0 8px rgba(0,0,0,0.12), 2px 0 8px rgba(0,0,0,0.08)',
                }}
              >
                <div className="absolute inset-0" style={{ background: 'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,0,0,0.025) 3px, rgba(0,0,0,0.025) 4px)' }} />
                <div className="absolute" style={{ top: '15%', left: -3, right: -3, height: 8, background: 'linear-gradient(to bottom, #d4c4b0, #c8b8a4, #d4c4b0)', borderRadius: 2, boxShadow: '0 1px 3px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.25)' }} />
                <div className="absolute" style={{ top: '15%', left: -2, right: -2, height: 8, background: 'repeating-linear-gradient(0deg, transparent, transparent 1px, rgba(0,0,0,0.02) 1px, rgba(0,0,0,0.02) 2px)', borderRadius: 2 }} />
                <div className="absolute" style={{ top: '50%', left: -3, right: -3, height: 8, marginTop: -4, background: 'linear-gradient(to bottom, #d4c4b0, #c8b8a4, #d4c4b0)', borderRadius: 2, boxShadow: '0 1px 3px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.25)' }} />
                <div className="absolute" style={{ top: '50%', left: -2, right: -2, height: 8, marginTop: -4, background: 'repeating-linear-gradient(0deg, transparent, transparent 1px, rgba(0,0,0,0.02) 1px, rgba(0,0,0,0.02) 2px)', borderRadius: 2 }} />
                <div className="absolute" style={{ top: '85%', left: -3, right: -3, height: 8, marginTop: -4, background: 'linear-gradient(to bottom, #d4c4b0, #c8b8a4, #d4c4b0)', borderRadius: 2, boxShadow: '0 1px 3px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.25)' }} />
                <div className="absolute" style={{ top: '85%', left: -2, right: -2, height: 8, marginTop: -4, background: 'repeating-linear-gradient(0deg, transparent, transparent 1px, rgba(0,0,0,0.02) 1px, rgba(0,0,0,0.02) 2px)', borderRadius: 2 }} />
              </div>

              <div
                className="relative overflow-clip rounded-e-2xl"
                style={{
                  width: PAGE_W,
                  height: PAGE_H,
                  background: 'linear-gradient(to left, #ede2cb, #f0e6d3 40%, #ece0c8)',
                  borderLeft: '2px solid #dccfc0',
                  boxShadow: 'inset 12px 0 16px -12px rgba(139,115,85,0.25), inset -4px 0 8px -4px rgba(255,255,255,0.4)',
                }}
              >
                <Canvas page={pages[currentPageIndex]} pageIndex={currentPageIndex} side="right" />
                <ForeEdgePage side="right" />
                <BottomPageEdge />
                <VintageCorners side="right" />
                <VintageVignette side="right" />
              </div>
            </div>
          )}
        </motion.div>
      </motion.div>

      {/* Navigation */}
      <div className="flex justify-center items-center gap-5 mt-8 pb-4">
        {!focusMode && (
          <>
            <button
              onClick={handlePrev}
              disabled={bookClosed}
              className="p-2.5 rounded-full bg-[#f0e6d3] border-2 border-[#e8dcc8] disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[#e5d5b8] hover:border-[#d97757] transition-all cursor-pointer shadow-sm"
            >
              <ChevronLeft className="w-5 h-5 text-[#8b7355]" />
            </button>

            <span className="text-base text-[#8b7355] min-w-[90px] text-center font-handwriting">
              {bookClosed
                ? 'Closed'
                : `Pg ${currentPageIndex}–${currentPageIndex + 1} of ${pages.length - 1}`
              }
            </span>

            <button
              onClick={bookClosed ? handleOpen : handleNext}
              className="p-2.5 rounded-full bg-[#f0e6d3] border-2 border-[#e8dcc8] hover:bg-[#e5d5b8] hover:border-[#d97757] transition-all cursor-pointer shadow-sm"
            >
              {bookClosed ? (
                <Plus className="w-5 h-5 text-[#8b7355]" />
              ) : currentPageIndex + 1 >= pages.length - 1 ? (
                <Plus className="w-5 h-5 text-[#8b7355]" />
              ) : (
                <ChevronRight className="w-5 h-5 text-[#8b7355]" />
              )}
            </button>

            <button
              onClick={handleFocusToggle}
              disabled={bookClosed}
              className="p-2.5 rounded-full bg-[#f0e6d3] border-2 border-[#e8dcc8] disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[#e5d5b8] hover:border-[#d97757] transition-all cursor-pointer shadow-sm"
              title="Focus mode"
            >
              <Maximize2 className="w-4 h-4 text-[#8b7355]" />
            </button>
          </>
        )}
        {focusMode && (
          <span className="text-xs text-[#8b7355]/50 font-handwriting">focus mode</span>
        )}
      </div>
    </div>
  )
}


