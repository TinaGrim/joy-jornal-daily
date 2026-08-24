import { useRef, useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'motion/react'
import type { CanvasElement } from '@/types/journal'
import { useJournal } from '../contexts/JournalContext'
import { usePhotoSrc } from '@/lib/photoBank'
import { cn } from '@/lib/utils'
import { Trash2, MoveUp, MoveDown, Plane, Compass, Camera, Luggage, X, Mail, Heart, MoreVertical, Copy } from 'lucide-react'

const TORN_POLYGON = "0% 0%, 4% 2%, 8% 0%, 12% 3%, 16% 0%, 20% 2%, 24% 0%, 100% 0%, 100% 4%, 97% 8%, 100% 12%, 98% 16%, 100% 20%, 99% 24%, 100% 100%, 96% 98%, 92% 100%, 88% 97%, 84% 100%, 80% 98%, 76% 100%, 0% 100%, 2% 96%, 0% 92%, 3% 88%, 0% 84%, 1% 80%, 0% 76%"

let copiedElementData: Record<string, unknown> | null = null

interface DraggableElementProps {
  element: CanvasElement
  isActive: boolean
  pageIndex: number
}

export default function DraggableElement({ element, isActive, pageIndex }: DraggableElementProps) {
  const { updateElement, deleteElement, transferElement, bringForward, sendBackward, selectedElementId, setSelectedElementId, selectedElementIds, batchUpdateElements, pages, focusPageIndex, setFocusPageIndex, drawSettings, addElement, flushSync } = useJournal()
  const [isEditing, setIsEditing] = useState(false)
  const [isResizing, setIsResizing] = useState(false)
  const [isMoving, setIsMoving] = useState(false)
  const [dragState, setDragState] = useState<{ x: number; y: number; scale: number } | null>(null)
  const elementRef = useRef<HTMLDivElement>(null)
  const textRef = useRef<HTMLDivElement>(null)
  const menuAbove = element.y < 400
  const moveRef = useRef({
    startMouseX: 0,
    startMouseY: 0,
    startElemX: 0,
    startElemY: 0,
    elemWidth: 0,
    elemHeight: 0,
    scale: 1,
    rafId: null as number | null,
    batchIds: [] as string[],
    batchPositions: [] as { x: number; y: number }[],
    viewOffsetX: 0,
    viewOffsetY: 0,
  })
  const isSelected = selectedElementId === element.id
  const isMultiSelected = selectedElementIds.length > 0 && selectedElementIds.includes(element.id)
  const [menuOpen, setMenuOpen] = useState(false)
  const photoSrc = usePhotoSrc(element.data.src)

  const FONTS = ['Caveat', 'Playfair Display', 'Source Serif 4', 'Dancing Script', 'Inter', 'monospace']

  const elementTransform = `rotate(${element.rotation}deg)`

  const handleMouseDown = (e: React.PointerEvent) => {
    if (isEditing || isResizing || drawSettings.active) return
    if (!e.isPrimary) return
    if (e.pointerType === 'mouse' && e.button !== 0) return
    e.stopPropagation()
    setFocusPageIndex(pageIndex)
    setSelectedElementId(element.id)

    const rect = elementRef.current?.getBoundingClientRect()
    if (!rect) return

    let batchIds: string[] = []
    let batchPositions: { x: number; y: number }[] = []
    if (isMultiSelected) {
      const others = selectedElementIds.filter(id => id !== element.id)
      if (others.length > 0) {
        batchIds = selectedElementIds
        const pageEls = pages[focusPageIndex]?.elements ?? []
        batchPositions = selectedElementIds.map(id => {
          const el = pageEls.find(e => e.id === id)
          return { x: el?.x ?? 0, y: el?.y ?? 0 }
        })
      }
    }

    moveRef.current = {
      startMouseX: e.clientX,
      startMouseY: e.clientY,
      startElemX: element.x,
      startElemY: element.y,
      elemWidth: element.width,
      elemHeight: element.height,
      scale: rect.width / element.width,
      rafId: null,
      batchIds,
      batchPositions,
      viewOffsetX: e.clientX - rect.left,
      viewOffsetY: e.clientY - rect.top,
    }
    setDragState({ x: rect.left, y: rect.top, scale: rect.width / element.width })
    setIsMoving(true)
  }

  useEffect(() => {
    if (!isMoving) return

    const handlePointerMove = (e: PointerEvent) => {
      if (moveRef.current.rafId !== null) return
      moveRef.current.rafId = requestAnimationFrame(() => {
        moveRef.current.rafId = null
        const dx = (e.clientX - moveRef.current.startMouseX) / moveRef.current.scale
        const dy = (e.clientY - moveRef.current.startMouseY) / moveRef.current.scale
        const newX = moveRef.current.startElemX + dx
        const newY = moveRef.current.startElemY + dy
        const updates: Record<string, Partial<CanvasElement>> = {
          [element.id]: { x: newX, y: newY },
        }
        const { batchIds, batchPositions, startElemX, startElemY } = moveRef.current
        for (let i = 0; i < batchIds.length; i++) {
          const id = batchIds[i]
          if (id === element.id) continue
          updates[id] = {
            x: batchPositions[i].x + (newX - startElemX),
            y: batchPositions[i].y + (newY - startElemY),
          }
        }
        batchUpdateElements(updates, false, pageIndex)
        setDragState(prev => prev ? {
          ...prev,
          x: e.clientX - moveRef.current.viewOffsetX,
          y: e.clientY - moveRef.current.viewOffsetY,
        } : prev)
      })
    }

    const handlePointerUp = (e: PointerEvent) => {
      if (moveRef.current.rafId !== null) {
        cancelAnimationFrame(moveRef.current.rafId)
        moveRef.current.rafId = null
      }

      const pageEls = Array.from(document.querySelectorAll<HTMLElement>('[data-page-index]')).reverse()
      const target = pageEls.find(el => {
        const r = el.getBoundingClientRect()
        return e.clientX >= r.left - 3 && e.clientX <= r.right + 3 && e.clientY >= r.top && e.clientY <= r.bottom
      })
      if (target) {
        const toPage = parseInt(target.getAttribute('data-page-index')!)
        if (toPage !== pageIndex) {
          const rect = target.getBoundingClientRect()
          const { elemWidth: ew, elemHeight: eh, scale, viewOffsetX, viewOffsetY } = moveRef.current
          const ghostLeft = e.clientX - viewOffsetX + ew * (scale - 1) / 2
          const ghostTop = e.clientY - viewOffsetY + eh * (scale - 1) / 2
          const newX = Math.max(0, Math.min(640 - ew, (ghostLeft - rect.left) / rect.width * 640))
          const newY = Math.max(0, Math.min(860 - eh, (ghostTop - rect.top) / rect.height * 860))
          transferElement(element.id, pageIndex, toPage, newX, newY)
          setFocusPageIndex(toPage)
          setDragState(null)
          setIsMoving(false)
          return
        }
      }

      const dx = (e.clientX - moveRef.current.startMouseX) / moveRef.current.scale
      const dy = (e.clientY - moveRef.current.startMouseY) / moveRef.current.scale
      const newX = Math.max(0, Math.min(640 - moveRef.current.elemWidth, moveRef.current.startElemX + dx))
      const newY = Math.max(0, Math.min(860 - moveRef.current.elemHeight, moveRef.current.startElemY + dy))
      const updates: Record<string, Partial<CanvasElement>> = {
        [element.id]: { x: newX, y: newY },
      }
      const { batchIds, batchPositions, startElemX, startElemY } = moveRef.current
      for (let i = 0; i < batchIds.length; i++) {
        const id = batchIds[i]
        if (id === element.id) continue
        updates[id] = {
          x: batchPositions[i].x + (newX - startElemX),
          y: batchPositions[i].y + (newY - startElemY),
        }
      }
      batchUpdateElements(updates, true, pageIndex)

      setDragState(null)
      setIsMoving(false)
      flushSync()
    }

    document.addEventListener('pointermove', handlePointerMove)
    document.addEventListener('pointerup', handlePointerUp)
    document.addEventListener('pointercancel', handlePointerUp)

    return () => {
      document.removeEventListener('pointermove', handlePointerMove)
      document.removeEventListener('pointerup', handlePointerUp)
      document.removeEventListener('pointercancel', handlePointerUp)
      if (moveRef.current.rafId !== null) {
        cancelAnimationFrame(moveRef.current.rafId)
      }
      setDragState(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- drag data captured in moveRef at mousedown; context identities (flushSync etc.) must not tear down listeners mid-drag
  }, [isMoving])

  useEffect(() => {
    if (isEditing && textRef.current) {
      textRef.current.innerText = (element.data.text as string) || ''
      textRef.current.focus()
      const sel = window.getSelection()
      if (sel) {
        const range = document.createRange()
        range.selectNodeContents(textRef.current)
        range.collapse(false)
        sel.removeAllRanges()
        sel.addRange(range)
      }
    }
  }, [isEditing, element.data.text])

  const elementRefCallback = useCallback((node: HTMLDivElement | null) => {
    elementRef.current = node
  }, [])

  const handleResize = (e: React.PointerEvent, corner: string) => {
    if (!e.isPrimary) return
    if (e.pointerType === 'mouse' && e.button !== 0) return
    e.stopPropagation()
    try { e.currentTarget.setPointerCapture(e.pointerId) } catch { /* optional */ }
    setIsResizing(true)
    const startX = e.clientX
    const startY = e.clientY
    const startWidth = element.width
    const startHeight = element.height
    const startPosX = element.x
    const startPosY = element.y
    const s = elementRef.current
      ? elementRef.current.getBoundingClientRect().width / element.width
      : 1

    const onPointerMove = (moveEvent: PointerEvent) => {
      const dx = (moveEvent.clientX - startX) / s
      const dy = (moveEvent.clientY - startY) / s
      let newWidth = startWidth
      let newHeight = startHeight
      let newX = startPosX
      let newY = startPosY

      if (corner.includes('e')) newWidth = Math.max(40, startWidth + dx)
      if (corner.includes('s')) newHeight = Math.max(40, startHeight + dy)
      if (corner.includes('w')) { newWidth = Math.max(40, startWidth - dx); newX = startPosX + dx }
      if (corner.includes('n')) { newHeight = Math.max(40, startHeight - dy); newY = startPosY + dy }

      updateElement(element.id, { width: newWidth, height: newHeight, x: newX, y: newY }, false, pageIndex)
    }

    const onPointerUp = () => {
      setIsResizing(false)
      document.removeEventListener('pointermove', onPointerMove)
      document.removeEventListener('pointerup', onPointerUp)
      document.removeEventListener('pointercancel', onPointerUp)
      flushSync()
    }

    document.addEventListener('pointermove', onPointerMove)
    document.addEventListener('pointerup', onPointerUp)
    document.addEventListener('pointercancel', onPointerUp)
  }

  const renderElement = () => {
    switch (element.type) {
      case 'image':
        if (element.data.mask === 'cloud') {
          const cid = `c-${element.id}`
          return (
            <div className="w-full h-full relative overflow-hidden" style={{ filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.12))' }}>
              <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice">
                <defs>
                  <clipPath id={`w-${cid}`}>
                    <rect x="4" y="8" width="92" height="84" rx="3" />
                  </clipPath>
                </defs>

                <rect width="100" height="100" fill="#C8DFF0" />

                <rect x="2" y="2" width="96" height="96" rx="16" fill="white" />

                <circle cx="10" cy="6" r="6" fill="white" />
                <circle cx="24" cy="3" r="7" fill="white" />
                <circle cx="40" cy="2" r="8" fill="white" />
                <circle cx="55" cy="2" r="8" fill="white" />
                <circle cx="70" cy="3" r="7" fill="white" />
                <circle cx="86" cy="4" r="7" fill="white" />
                <circle cx="94" cy="10" r="6" fill="white" />
                <circle cx="10" cy="94" r="6" fill="white" />
                <circle cx="24" cy="97" r="7" fill="white" />
                <circle cx="40" cy="98" r="8" fill="white" />
                <circle cx="55" cy="98" r="8" fill="white" />
                <circle cx="70" cy="97" r="7" fill="white" />
                <circle cx="86" cy="96" r="7" fill="white" />
                <circle cx="94" cy="90" r="6" fill="white" />
                <circle cx="3" cy="24" r="7" fill="white" />
                <circle cx="2" cy="40" r="8" fill="white" />
                <circle cx="2" cy="55" r="8" fill="white" />
                <circle cx="3" cy="70" r="7" fill="white" />
                <circle cx="97" cy="24" r="7" fill="white" />
                <circle cx="98" cy="40" r="8" fill="white" />
                <circle cx="98" cy="55" r="8" fill="white" />
                <circle cx="97" cy="70" r="7" fill="white" />

                <image href={photoSrc ?? (element.data.src as string)} x="4" y="8" width="92" height="84" preserveAspectRatio="xMidYMid slice" clipPath={`url(#w-${cid})`} />

                <rect x="4" y="8" width="92" height="84" rx="3" fill="none" stroke="#A8C8E0" strokeWidth="1" />

                <g fill="white" opacity="0.55">
                  <path d="M6,10 Q8,7 10,10 Q8,9 6,10" />
                  <path d="M10,10 Q12,7 14,10 Q12,9 10,10" />
                </g>
                <g fill="white" opacity="0.45" transform="translate(-2,3) scale(0.7)">
                  <path d="M6,10 Q8,7 10,10 Q8,9 6,10" />
                  <path d="M10,10 Q12,7 14,10 Q12,9 10,10" />
                </g>
                <g fill="white" opacity="0.4" transform="translate(82,80) scale(0.6)">
                  <path d="M6,10 Q8,7 10,10 Q8,9 6,10" />
                  <path d="M10,10 Q12,7 14,10 Q12,9 10,10" />
                </g>

                <circle cx="8" cy="6" r="3" fill="white" opacity="0.25" />
                <circle cx="4" cy="16" r="2" fill="white" opacity="0.3" />
                <circle cx="92" cy="5" r="4" fill="white" opacity="0.2" />
                <circle cx="88" cy="90" r="3" fill="white" opacity="0.35" />
                <circle cx="96" cy="78" r="2" fill="white" opacity="0.25" />
                <circle cx="3" cy="80" r="3.5" fill="white" opacity="0.2" />
              </svg>
            </div>
          )
        }
        if (element.data.mask === 'polaroid') {
          return (
            <div className="w-full h-full bg-white p-2 shadow-lg rounded-sm">
              <img
                src={photoSrc ?? (element.data.src as string)}
                alt=""
                draggable={false}
                className="w-full h-full object-cover rounded-sm"
              />
            </div>
          )
        }
        if (element.data.mask === 'torn-edge') {
          return (
            <div className="w-full h-full relative" style={{ filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.15))' }}>
              <img
                src={photoSrc ?? (element.data.src as string)}
                alt=""
                draggable={false}
                className="w-full h-full object-cover"
                style={{ clipPath: `polygon(${TORN_POLYGON})` }}
              />
            </div>
          )
        }
        return (
          <img
            src={photoSrc ?? (element.data.src as string)}
            alt=""
            draggable={false}
            className="w-full h-full object-cover"
            style={{
              borderRadius: element.data.mask === 'circle' ? '50%' : '8px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            }}
          />
        )
      case 'text': {
        const textContent = element.data.text as string
        const isEmpty = !textContent || !textContent.trim()
        if (isEditing) {
          return (
            <div
              ref={textRef}
              contentEditable
              suppressContentEditableWarning
              spellCheck={false}
              data-placeholder="Type here..."
              onPointerDown={e => e.stopPropagation()}
              onMouseDown={e => e.stopPropagation()}
              onKeyDown={e => {
                if (e.key === 'Escape') {
                  e.preventDefault()
                  e.currentTarget.blur()
                }
              }}
              onBlur={e => {
                setIsEditing(false)
                const el = e.currentTarget
                const text = el.textContent || ''
                if (text.trim()) {
                  updateElement(element.id, {
                    width: Math.max(40, el.scrollWidth),
                    height: Math.max(20, el.scrollHeight),
                    data: { ...element.data, text },
                  }, undefined, pageIndex)
                } else {
                  deleteElement(element.id, pageIndex)
                }
              }}
              className="p-0 outline-none"
              style={{
                minWidth: '100%',
                minHeight: '100%',
                overflow: 'visible',
                whiteSpace: 'pre-wrap',
                overflowWrap: 'break-word',
                fontFamily: (element.data.font as string) || 'Caveat, cursive',
                fontSize: (element.data.fontSize as number) || 24,
                color: (element.data.color as string) || '#2c3e50',
                cursor: 'text',
              }}
            />
          )
        }
        return (
          <div
            onDoubleClick={e => { e.stopPropagation(); setIsEditing(true) }}
            onClick={e => {
              e.stopPropagation()
              // Tap-to-edit: a tap on an already-selected text opens the editor
              // (double-click stays for mouse users; this covers touch devices)
              if (isSelected) setIsEditing(true)
            }}
            className={cn('p-0 outline-none', isEmpty && 'opacity-40')}
            style={{
              minWidth: '100%',
              minHeight: '100%',
              overflow: 'visible',
              whiteSpace: 'pre-wrap',
              overflowWrap: 'break-word',
              fontFamily: (element.data.font as string) || 'Caveat, cursive',
              fontSize: (element.data.fontSize as number) || 24,
              color: (element.data.color as string) || '#2c3e50',
              cursor: 'default',
            }}
          >
            {isEmpty ? 'Type here...' : textContent}
          </div>
        )
      }
      case 'sticker':
        return (
          <div className="w-full h-full flex items-center justify-center">
            <span
              style={{
                fontSize: `${Math.max(20, Math.min(element.height, element.width) * 0.7)}px`,
                lineHeight: 1,
                filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))',
              }}
            >
              {element.data.src as string}
            </span>
          </div>
        )
      case 'emoji':
        return (
          <div className="w-full h-full flex items-center justify-center">
            <span
              style={{
                fontSize: `${Math.max(20, Math.min(element.height, element.width) * 0.7)}px`,
                lineHeight: 1,
              }}
            >
              {element.data.emoji as string}
            </span>
          </div>
        )
      case 'shape': {
        const fill = (element.data.fill as string) || '#d97757'
        const shapeOpacity = (element.data.opacity as number) || 0.8

        const darken = (hex: string, amount: number) => {
          const c = hex.replace('#', '')
          const r = Math.max(0, parseInt(c.substring(0, 2), 16) - amount)
          const g = Math.max(0, parseInt(c.substring(2, 4), 16) - amount)
          const b = Math.max(0, parseInt(c.substring(4, 6), 16) - amount)
          return `rgb(${r},${g},${b})`
        }

        const borderColor = darken(fill, 30)

        if (element.data.shape === 'icon') {
          const iconMap: Record<string, typeof Plane> = { Plane, Compass, Camera: Camera, Suitcase: Luggage }
          const Icon = iconMap[element.data.icon as string]
          return Icon ? (
            <div className="w-full h-full flex items-center justify-center" style={{ filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.12))' }}>
              <Icon className="w-full h-full p-2" style={{ color: fill, opacity: shapeOpacity }} />
            </div>
          ) : null
        }

        const shape = element.data.shape as string
        const isClipShape = shape === 'triangle' || shape === 'hexagon'

        const borderRadius = shape === 'circle' ? '50%' : shape === 'rectangle' ? '10px' : '0'

        return (
          <div className="w-full h-full" style={{ filter: 'drop-shadow(0 3px 8px rgba(0,0,0,0.13))', opacity: shapeOpacity }}>
            <div
              className="w-full h-full"
              style={{
                background: fill,
                border: `1.5px solid ${borderColor}`,
                borderRadius,
                clipPath: isClipShape
                  ? shape === 'triangle'
                    ? 'polygon(50% 0%, 0% 100%, 100% 100%)'
                    : 'polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)'
                  : undefined,
              }}
            />
          </div>
        )
      }
      case 'envelope': {
        const envColor = (element.data.color as string) || '#d97757'
        const opened = Boolean(element.data.opened)

        const hexToRgba = (hex: string, alpha: number) => {
          const c = hex.replace('#', '')
          const r = parseInt(c.substring(0, 2), 16)
          const g = parseInt(c.substring(2, 4), 16)
          const b = parseInt(c.substring(4, 6), 16)
          return `rgba(${r},${g},${b},${alpha})`
        }

        const isLight = (hex: string) => {
          const c = hex.replace('#', '')
          const r = parseInt(c.substring(0, 2), 16)
          const g = parseInt(c.substring(2, 4), 16)
          const b = parseInt(c.substring(4, 6), 16)
          return r * 0.299 + g * 0.587 + b * 0.114 > 160
        }

        const darken = (hex: string, amount: number) => {
          const c = hex.replace('#', '')
          const r = Math.max(0, parseInt(c.substring(0, 2), 16) - amount)
          const g = Math.max(0, parseInt(c.substring(2, 4), 16) - amount)
          const b = Math.max(0, parseInt(c.substring(4, 6), 16) - amount)
          return `rgb(${r},${g},${b})`
        }

        const lighten = (hex: string, amount: number) => {
          const c = hex.replace('#', '')
          const r = Math.min(255, parseInt(c.substring(0, 2), 16) + amount)
          const g = Math.min(255, parseInt(c.substring(2, 4), 16) + amount)
          const b = Math.min(255, parseInt(c.substring(4, 6), 16) + amount)
          return `rgb(${r},${g},${b})`
        }

        const textColor = isLight(envColor) ? '#2c3e50' : '#ffffff'
        const darkerEnv = darken(envColor, 35)
        const lightEnv = lighten(envColor, 40)
        const paperColor = '#faf6ef'

        return (
          <div className="w-full h-full relative cursor-pointer">
            <AnimatePresence mode="wait">
              {!opened ? (
                <motion.div
                  key="envelope-closed"
                  initial={{ scale: 0.85, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.85, opacity: 0 }}
                  transition={{ duration: 0.3, ease: 'easeInOut' }}
                  onClick={e => {
                    e.stopPropagation()
                    updateElement(element.id, {
                      data: { ...element.data, opened: true },
                    }, undefined, pageIndex)
                  }}
                  className="absolute inset-0"
                >
                  <div className="absolute inset-0 rounded-xl overflow-hidden" style={{
                    background: envColor,
                    boxShadow: `0 4px 16px ${hexToRgba(envColor, 0.35)}, inset 0 1px 0 ${hexToRgba(lightEnv, 0.3)}`,
                  }}>
                    <div className="absolute top-0 left-0 right-0 h-[48%]" style={{
                      background: darkerEnv,
                      clipPath: 'polygon(0 0, 100% 0, 50% 100%)',
                    }} />
                    <div className="absolute top-[47%] left-[8%] right-[8%] h-px opacity-20" style={{ background: textColor }} />
                    <div className="absolute inset-x-[10%] top-[52%] bottom-[18%] rounded border border-dashed opacity-[0.12]" style={{ borderColor: textColor }} />
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 rounded-full flex items-center justify-center" style={{
                      background: `radial-gradient(circle at 35% 35%, ${lightEnv}, ${darkerEnv})`,
                      border: `2.5px solid ${darkerEnv}`,
                      boxShadow: `0 3px 10px rgba(0,0,0,0.25), inset 0 1px 0 ${hexToRgba('#fff', 0.2)}`,
                    }}>
                      <Heart className="w-5 h-5 drop-shadow-sm" style={{ color: textColor }} />
                    </div>
                    <div className="absolute top-3 right-3 w-9 h-11 rounded border-2 opacity-20 flex items-center justify-center" style={{ borderColor: textColor }}>
                      <span className="text-[7px] font-bold" style={{ color: textColor }}>♥</span>
                    </div>
                    <div className="absolute bottom-3 left-0 right-0 text-center">
                      <span className="text-xs font-handwriting tracking-wider" style={{ color: hexToRgba(textColor, 0.4) }}>open me</span>
                    </div>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="envelope-opened"
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: 20, opacity: 0 }}
                  transition={{ duration: 0.3, ease: 'easeOut' }}
                  className="absolute inset-0 flex flex-col overflow-hidden rounded-xl"
                  style={{
                    background: paperColor,
                    boxShadow: `0 4px 16px ${hexToRgba(envColor, 0.2)}`,
                    border: `1px solid ${hexToRgba(envColor, 0.15)}`,
                  }}
                >
                  <div className="absolute -top-[3px] left-0 right-0 h-[6px]" style={{
                    background: paperColor,
                    clipPath: 'polygon(0% 100%, 2% 35%, 5% 65%, 8% 25%, 12% 75%, 15% 20%, 18% 55%, 22% 30%, 25% 80%, 28% 15%, 32% 60%, 35% 40%, 38% 85%, 42% 10%, 45% 50%, 48% 70%, 52% 25%, 55% 65%, 58% 35%, 62% 75%, 65% 15%, 68% 55%, 72% 30%, 75% 70%, 78% 20%, 82% 60%, 85% 40%, 88% 80%, 92% 10%, 95% 50%, 98% 30%, 100% 100%)',
                  }} />
                  <div className="flex items-center justify-between px-3 py-2 shrink-0" style={{
                    background: `linear-gradient(135deg, ${envColor}, ${darkerEnv})`,
                  }}>
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4 drop-shadow-sm" style={{ color: textColor }} />
                      <span className="text-xs font-handwriting" style={{ color: hexToRgba(textColor, 0.65) }}>letter</span>
                    </div>
                    <button
                      onPointerDown={e => { e.stopPropagation(); updateElement(element.id, { data: { ...element.data, opened: false } }, undefined, pageIndex) }}
                      className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-black/10 transition-colors cursor-pointer"
                      style={{ color: textColor }}
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div
                    contentEditable
                    suppressContentEditableWarning
                    spellCheck={false}
                    onBlur={e => {
                      const text = e.currentTarget.textContent || ''
                      updateElement(element.id, {
                        data: { ...element.data, note: text },
                      }, undefined, pageIndex)
                    }}
                    onPointerDown={e => e.stopPropagation()}
                    onMouseDown={e => e.stopPropagation()}
                    className="flex-1 px-5 py-4 text-base outline-none overflow-auto font-handwriting leading-relaxed"
                    data-placeholder="Write a note..."
                    style={{ color: '#3d3229' }}
                  >
                    {element.data.note ? String(element.data.note) : ''}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )
      }
      case 'drawing':
        return (
          <svg width={element.width} height={element.height} className="absolute top-0 left-0 pointer-events-none" style={(isSelected || isMultiSelected) ? { filter: 'drop-shadow(0 0 4px rgba(217,119,87,0.35))' } : undefined}>
            {(element.data.paths as string[])?.map((path, i) => (
              <path
                key={i}
                d={path}
                stroke={(element.data.color as string) || '#2c3e50'}
                strokeWidth={(element.data.strokeWidth as number) || 2}
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={(element.data.brush as string) === 'highlighter' ? 0.4 : 1}
              />
            ))}
          </svg>
        )
      default:
        return null
    }
  }

  if (!isActive) {
    return (
      <div
        onClick={() => setSelectedElementId(null)}
        style={{
          position: 'absolute', left: element.x, top: element.y,
          width: element.width, height: element.height,
          transform: `rotate(${element.rotation}deg)`,
          pointerEvents: 'none',
        }}
      >
        {renderElement()}
      </div>
    )
  }

  const handleToolMouseDown = (e: React.SyntheticEvent) => {
    e.stopPropagation()
  }

  const elementContent = (
    <>
      {renderElement()}

      {isSelected && !isEditing && !isMoving && (
        <>
          {element.type !== 'drawing' && ['nw', 'ne', 'sw', 'se'].map(corner => (
            <div
              key={corner}
              onPointerDown={e => handleResize(e, corner)} // eslint-disable-line -- reads elementRef scale at drag start, not during render
              className="absolute w-3 h-3 bg-white border-2 border-[#d97757] rounded-full hover:scale-125 transition-transform"
              style={{
                top: corner.includes('n') ? -6 : 'auto',
                bottom: corner.includes('s') ? -6 : 'auto',
                left: corner.includes('w') ? -6 : 'auto',
                right: corner.includes('e') ? -6 : 'auto',
                cursor: `${corner}-resize`,
                touchAction: 'none',
              }}
            />
          ))}
          <div className={`absolute ${menuAbove ? '-top-10' : 'bottom-full mb-2'} left-0 flex items-center gap-0.5 bg-white rounded-lg shadow-lg p-1 z-10`}>
            <button
              onPointerDown={handleToolMouseDown}
              onClick={e => { e.stopPropagation(); bringForward(element.id, pageIndex) }}
              className="p-1 hover:bg-[#e5d5b8] rounded cursor-pointer"
              title="Bring forward"
            >
              <MoveUp className="w-3.5 h-3.5 text-[#8b7355]" />
            </button>
            <button
              onPointerDown={handleToolMouseDown}
              onClick={e => { e.stopPropagation(); sendBackward(element.id, pageIndex) }}
              className="p-1 hover:bg-[#e5d5b8] rounded cursor-pointer"
              title="Send backward"
            >
              <MoveDown className="w-3.5 h-3.5 text-[#8b7355]" />
            </button>
            <div className="w-px h-4 bg-[#e5d5b8] mx-0.5" />
            <div className="relative">
              <button
                onPointerDown={handleToolMouseDown}
                onClick={e => { e.stopPropagation(); setMenuOpen(v => !v) }}
                className="p-1 hover:bg-[#e5d5b8] rounded cursor-pointer"
                title="More"
              >
                <MoreVertical className="w-3.5 h-3.5 text-[#8b7355]" />
              </button>
              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onPointerDown={handleToolMouseDown} onClick={e => { e.stopPropagation(); setMenuOpen(false) }} />
                  <div className={`absolute ${menuAbove ? 'top-8' : 'bottom-8'} left-0 bg-white rounded-lg shadow-xl border border-[#e5d5b8] py-1 min-w-[150px] z-20`} onPointerDown={handleToolMouseDown} onClick={e => e.stopPropagation()}>
                    {element.type === 'text' && (
                      <div className="px-2 py-1.5 border-b border-[#e5d5b8]">
                        <span className="text-[12px] font-medium text-[#8b7355] uppercase tracking-wider">Font</span>
                        <div className="mt-1 space-y-0.5">
                          {FONTS.map(font => (
                            <button
                              key={font}
                              onClick={() => { updateElement(element.id, { data: { ...element.data, font } }, undefined, pageIndex); setMenuOpen(false) }}
                              className="w-full text-left px-2 py-1 rounded text-xs hover:bg-[#f0e6d3] cursor-pointer"
                              style={{ fontFamily: font }}
                            >
                              {font}
                            </button>
                          ))}
                        </div>
                        <div className="mt-2 pt-2 border-t border-[#e5d5b8]">
                          <span className="text-[12px] font-medium text-[#8b7355] uppercase tracking-wider">Size</span>
                          <div className="mt-1 flex items-center gap-1">
                            <button
                              onClick={() => { const s = Math.max(8, ((element.data.fontSize as number) || 24) - 2); updateElement(element.id, { data: { ...element.data, fontSize: s } }, undefined, pageIndex); setMenuOpen(false) }}
                              className="w-7 h-7 flex items-center justify-center rounded text-xs hover:bg-[#f0e6d3] cursor-pointer font-bold text-[#8b7355]"
                            >−</button>
                            <span className="flex-1 text-center text-xs font-mono text-[#2c3e50]">{element.data.fontSize as number || 24}</span>
                            <button
                              onClick={() => { const s = Math.min(120, ((element.data.fontSize as number) || 24) + 2); updateElement(element.id, { data: { ...element.data, fontSize: s } }, undefined, pageIndex); setMenuOpen(false) }}
                              className="w-7 h-7 flex items-center justify-center rounded text-xs hover:bg-[#f0e6d3] cursor-pointer font-bold text-[#8b7355]"
                            >+</button>
                          </div>
                          <div className="mt-1 flex gap-1 flex-wrap">
                            {[12, 16, 20, 24, 28, 32, 40, 48].map(s => (
                              <button
                                key={s}
                                onClick={() => { updateElement(element.id, { data: { ...element.data, fontSize: s } }, undefined, pageIndex); setMenuOpen(false) }}
                                className={`px-1.5 py-0.5 rounded text-[12px] hover:bg-[#f0e6d3] cursor-pointer ${(element.data.fontSize as number) === s ? 'bg-[#d97757] text-white' : 'text-[#8b7355]'}`}
                              >{s}</button>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                    <button
                      onClick={() => { copiedElementData = { type: element.type, data: element.data, width: element.width, height: element.height, rotation: element.rotation }; setMenuOpen(false) }}
                      className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-[#2c3e50] hover:bg-[#f0e6d3] cursor-pointer"
                    >
                      <Copy className="w-3.5 h-3.5 text-[#8b7355]" />
                      Copy
                    </button>
                    <button
                      onClick={() => { const c = copiedElementData as Partial<CanvasElement> | null; if (c) { addElement({ type: c.type ?? 'shape', x: element.x + 20, y: element.y + 20, width: c.width ?? 200, height: c.height ?? 200, rotation: c.rotation ?? 0, data: c.data ?? {} }, pageIndex) } setMenuOpen(false) }}
                      className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-[#2c3e50] hover:bg-[#f0e6d3] cursor-pointer"
                      disabled={!copiedElementData}
                    >
                      <Copy className="w-3.5 h-3.5 text-[#8b7355]" />
                      Duplicate
                    </button>
                  </div>
                </>
              )}
            </div>
            <div className="w-px h-4 bg-[#e5d5b8] mx-0.5" />
            <button
              onPointerDown={handleToolMouseDown}
              onClick={e => { e.stopPropagation(); deleteElement(element.id, pageIndex) }}
              className="p-1 hover:bg-red-50 rounded cursor-pointer"
              title="Delete"
            >
              <Trash2 className="w-3.5 h-3.5 text-red-600" />
            </button>
          </div>
        </>
      )}
    </>
  )

  const portal = isMoving && dragState ? createPortal(
    <div
      style={{
        position: 'fixed',
        left: dragState.x + element.width * (dragState.scale - 1) / 2,
        top: dragState.y + element.height * (dragState.scale - 1) / 2,
        width: element.width,
        height: element.height,
        transform: `scale(${dragState.scale}) rotate(${element.rotation}deg)`,
        transformOrigin: 'center center',
        opacity: 0.85,
        zIndex: 99999,
        pointerEvents: 'none',
      }}
    >
      {renderElement()}
    </div>,
    document.body
  ) : null

  return (
    <>
      {portal}
      <div
        ref={elementRefCallback}
        data-elem-id={element.id}
        onPointerDown={handleMouseDown}
        onClick={e => { e.stopPropagation(); setSelectedElementId(element.id) }}
        style={{
          position: 'absolute', left: element.x, top: element.y,
          width: element.width, height: element.height,
          transform: elementTransform,
          opacity: isMoving ? 0 : 1,
          pointerEvents: drawSettings.active ? 'none' : undefined,
          cursor: drawSettings.active ? 'crosshair' : isEditing ? 'text' : 'default',
          outline: isSelected && element.type !== 'drawing' ? '2px solid #d97757' : isMultiSelected && element.type !== 'drawing' ? '1.5px dashed rgba(139,115,85,0.35)' : 'none',
          outlineOffset: '4px',
          transition: 'opacity 0.15s',
          zIndex: isSelected ? 9998 : 'auto',
        }}
      >
        {elementContent}
      </div>
    </>
  )
}
