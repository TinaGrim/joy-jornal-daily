import { useRef, useState, useCallback, useEffect } from 'react'
import { useDrop } from 'react-dnd'
import type { CanvasElement, Page } from '@/types/journal'
import { useJournal } from '../contexts/JournalContext'
import DraggableElement from './DraggableElement'
import UserCursors from './UserCursors'
import PaperTexture from './PaperTexture'

interface DropItem {
  elementType?: string
  element?: CanvasElement
  width?: number
  height?: number
  data?: Record<string, unknown>
  id?: string
  pageIndex?: number
  x?: number
  y?: number
}

function computePathBBox(path: string, strokePadding = 12) {
  const nums = [...path.matchAll(/([ML])\s*([\d.]+)\s+([\d.]+)/g)]
  if (!nums.length) return null
  const points = nums.map(m => ({ x: parseFloat(m[2]), y: parseFloat(m[3]) }))
  const xs = points.map(p => p.x)
  const ys = points.map(p => p.y)
  const minX = Math.min(...xs) - strokePadding
  const minY = Math.min(...ys) - strokePadding
  const maxX = Math.max(...xs) + strokePadding
  const maxY = Math.max(...ys) + strokePadding
  const w = maxX - minX
  const h = maxY - minY
  const translated = path.replace(/([ML])\s*([\d.]+)\s+([\d.]+)/g, (_, cmd, px, py) =>
    `${cmd} ${(parseFloat(px) - minX).toFixed(1)} ${(parseFloat(py) - minY).toFixed(1)}`
  )
  return { x: minX, y: minY, width: Math.max(w, 10), height: Math.max(h, 10), paths: [translated] }
}

function pointInPolygon(px: number, py: number, poly: { x: number; y: number }[]) {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x, yi = poly[i].y
    const xj = poly[j].x, yj = poly[j].y
    if ((yi > py) !== (yj > py) && px < (xj - xi) * (py - yi) / (yj - yi) + xi) {
      inside = !inside
    }
  }
  return inside
}

function pathToPoints(path: string) {
  const nums = [...path.matchAll(/([ML])\s*([\d.]+)\s+([\d.]+)/g)]
  return nums.map(m => ({ x: parseFloat(m[2]), y: parseFloat(m[3]) }))
}

function segIntersect(a1x: number, a1y: number, a2x: number, a2y: number, b1x: number, b1y: number, b2x: number, b2y: number): boolean {
  const d1x = a2x - a1x, d1y = a2y - a1y
  const d2x = b2x - b1x, d2y = b2y - b1y
  const dx = b1x - a1x, dy = b1y - a1y
  const crossD = d1x * d2y - d1y * d2x
  if (Math.abs(crossD) < 1e-10) return false
  const t = (d2x * dy - d2y * dx) / crossD
  const u = (d1x * dy - d1y * dx) / crossD
  return t >= 0 && t <= 1 && u >= 0 && u <= 1
}

function lineIntersectsRect(x1: number, y1: number, x2: number, y2: number, rx: number, ry: number, rw: number, rh: number): boolean {
  if (x1 >= rx && x1 <= rx + rw && y1 >= ry && y1 <= ry + rh) return true
  if (x2 >= rx && x2 <= rx + rw && y2 >= ry && y2 <= ry + rh) return true
  if (segIntersect(x1, y1, x2, y2, rx, ry, rx, ry + rh)) return true
  if (segIntersect(x1, y1, x2, y2, rx + rw, ry, rx + rw, ry + rh)) return true
  if (segIntersect(x1, y1, x2, y2, rx, ry, rx + rw, ry)) return true
  if (segIntersect(x1, y1, x2, y2, rx, ry + rh, rx + rw, ry + rh)) return true
  return false
}

interface CanvasProps {
  page: Page
  pageIndex: number
  side?: 'left' | 'right'
}

export default function Canvas({ page, pageIndex, side }: CanvasProps) {
  const { addElement, updateElement, deleteElement, transferElement, currentPageIndex, drawSettings, setDrawSettings, setSelectedElementId, setSelectedElementIds, setFocusPageIndex } = useJournal()
  const canvasRef = useRef<HTMLDivElement>(null)
  const isActive = pageIndex === currentPageIndex || pageIndex === currentPageIndex - 1
  const [drawingPath, setDrawingPath] = useState<string | null>(null)
  const isDrawingRef = useRef(false)
  const drawingPathRef = useRef<string | null>(null)
  const rafRef = useRef<number | null>(null)

  const flushPath = useCallback(() => {
    rafRef.current = null
    setDrawingPath(drawingPathRef.current)
  }, [])

  const scheduleFlush = useCallback(() => {
    if (rafRef.current === null) {
      rafRef.current = requestAnimationFrame(flushPath)
    }
  }, [flushPath])

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
      }
    }
  }, [])

  const [, drop] = useDrop({
    accept: ['TOOL_ITEM', 'CANVAS_ELEMENT'],
    drop: (item: DropItem, monitor) => {
      if (!isActive) return
      setFocusPageIndex(pageIndex)
      const offset = monitor.getClientOffset()
      if (!offset || !canvasRef.current) return
      const rect = canvasRef.current.getBoundingClientRect()
      const w = item.width || 120
      const h = item.height || 120
      if (item.elementType) {
        addElement({
          type: item.elementType as CanvasElement['type'],
          x: (offset.x - rect.left) / rect.width * 640 - w / 2,
          y: (offset.y - rect.top) / rect.height * 860 - h / 2,
          width: w,
          height: h,
          rotation: 0,
          data: item.data || {},
        }, pageIndex)
      } else if (item.id) {
        if (item.pageIndex === pageIndex) {
          const initialOffset = monitor.getInitialClientOffset()
          const scale = rect.width / 640
          let newX: number, newY: number
          if (initialOffset) {
            newX = Math.max(0, Math.min(640 - w, (item.x ?? 0) + (offset.x - initialOffset.x) / scale))
            newY = Math.max(0, Math.min(860 - h, (item.y ?? 0) + (offset.y - initialOffset.y) / scale))
          } else {
            newX = Math.max(0, Math.min(640 - w, (offset.x - rect.left) / rect.width * 640))
            newY = Math.max(0, Math.min(860 - h, (offset.y - rect.top) / rect.height * 860))
          }
          updateElement(item.id, { x: newX, y: newY }, undefined, pageIndex)
        } else {
          const newX = Math.max(0, Math.min(640 - w, (offset.x - rect.left) / rect.width * 640 - w / 2))
          const newY = Math.max(0, Math.min(860 - h, (offset.y - rect.top) / rect.height * 860 - h / 2))
          transferElement(item.id, item.pageIndex ?? pageIndex, pageIndex, newX, newY)
        }
      }
    },
  })

  const getCanvasPos = useCallback((e: React.MouseEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect()
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    }
  }, [isActive])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0 || !isActive) return
    setFocusPageIndex(pageIndex)
    if (drawSettings.active && drawSettings.brush === 'lasso') {
    } else if (!drawSettings.active) {
      setSelectedElementId(null)
      setSelectedElementIds([])
    }
    isDrawingRef.current = true
    const pos = getCanvasPos(e)
    drawingPathRef.current = `M ${pos.x} ${pos.y}`
  }, [isActive, drawSettings.active, getCanvasPos, setSelectedElementId, setSelectedElementIds, setFocusPageIndex, pageIndex])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDrawingRef.current || !isActive || !drawSettings.active) return
    const pos = getCanvasPos(e)
    const prev = drawingPathRef.current
    drawingPathRef.current = prev ? `${prev} L ${pos.x} ${pos.y}` : `M ${pos.x} ${pos.y}`
    scheduleFlush()
  }, [isActive, drawSettings.active, getCanvasPos, scheduleFlush])

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    if (!isActive || drawSettings.active) return
    const pos = getCanvasPos(e)
    const newId = addElement({
      type: 'text',
      x: pos.x,
      y: pos.y,
      width: 200,
      height: 60,
      rotation: 0,
      data: {
        text: '',
        font: 'Caveat',
        fontSize: 28,
        color: '#2c3e50',
      },
    }, pageIndex)
    setSelectedElementId(newId)
  }, [isActive, drawSettings.active, getCanvasPos, addElement, setSelectedElementId, pageIndex])

  const handleMouseUp = useCallback(() => {
    if (!isDrawingRef.current || !isActive || !drawSettings.active) return
    isDrawingRef.current = false
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    const finalPath = drawingPathRef.current
    drawingPathRef.current = null

    if (drawSettings.brush === 'lasso' && finalPath) {
      const points = pathToPoints(finalPath)
      if (points.length < 3) {
        setDrawingPath(null)
        setDrawSettings({ ...drawSettings, active: false })
        return
      }
      const poly = [...points, points[0]]
      const selected = (page.elements ?? []).filter(el => !el.data?._deleted).filter(el => {
        const corners = [
          { x: el.x, y: el.y },
          { x: el.x + el.width, y: el.y },
          { x: el.x, y: el.y + el.height },
          { x: el.x + el.width, y: el.y + el.height },
          { x: el.x + el.width / 2, y: el.y + el.height / 2 },
        ]
        return corners.some(c => pointInPolygon(c.x, c.y, poly))
      })
      setSelectedElementIds(selected.map(el => el.id))
      if (selected.length > 0) setSelectedElementId(selected[0].id)
      setDrawingPath(null)
      setDrawSettings({ ...drawSettings, active: false })
      return
    }

    if (finalPath && finalPath.length > 4) {
      const bbox = computePathBBox(finalPath)
      if (bbox) {
        if (drawSettings.brush === 'eraser') {
          const eraserPoints = pathToPoints(finalPath)
          const margin = (drawSettings.strokeWidth || 8) * 2
          const xs = eraserPoints.map(p => p.x)
          const ys = eraserPoints.map(p => p.y)
          const eraserBbox = { x: Math.min(...xs) - margin, y: Math.min(...ys) - margin, w: Math.max(...xs) - Math.min(...xs) + margin * 2, h: Math.max(...ys) - Math.min(...ys) + margin * 2 }
          const toRemove = page.elements
            .filter(el => {
              const ex = el.x - margin
              const ey = el.y - margin
              const ew = el.width + margin * 2
              const eh = el.height + margin * 2
              for (let i = 0; i < eraserPoints.length - 1; i++) {
                if (lineIntersectsRect(eraserPoints[i].x, eraserPoints[i].y, eraserPoints[i + 1].x, eraserPoints[i + 1].y, ex, ey, ew, eh)) return true
              }
              if (eraserPoints.length === 1) {
                return eraserPoints[0].x >= ex && eraserPoints[0].x <= ex + ew && eraserPoints[0].y >= ey && eraserPoints[0].y <= ey + eh
              }
              if (el.x >= eraserBbox.x && el.x + el.width <= eraserBbox.x + eraserBbox.w && el.y >= eraserBbox.y && el.y + el.height <= eraserBbox.y + eraserBbox.h) return true
              return false
            })
          toRemove.forEach(el => deleteElement(el.id, pageIndex))
        } else {
          addElement({
            type: 'drawing',
            x: bbox.x,
            y: bbox.y,
            width: bbox.width,
            height: bbox.height,
            rotation: 0,
            data: {
              paths: bbox.paths,
              color: drawSettings.color,
              strokeWidth: drawSettings.strokeWidth,
              brush: drawSettings.brush,
            },
          }, pageIndex)
        }
      }
    }
    setDrawingPath(null)
    setSelectedElementId(null)
  }, [isActive, drawSettings, addElement, deleteElement, page.elements, pageIndex, setSelectedElementId, setSelectedElementIds, setDrawSettings])

  return (
    <div
      ref={node => { canvasRef.current = node; drop(node) }}
      data-page-index={pageIndex}
      className={`w-full h-full relative overflow-visible select-none touch-none ${side === 'left' ? 'rounded-s-2xl' : side === 'right' ? 'rounded-e-2xl' : ''}`}
      style={{ background: page.background }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onDoubleClick={handleDoubleClick}
    >
      {/* Paper grain texture — bottom layer */}
      <PaperTexture />

      {/* Pattern overlay — on top of background + paper grain */}
      {page.pattern === 'grid' && (
        <div
          className="absolute inset-0 opacity-[0.12] pointer-events-none z-10"
          style={{
            backgroundImage:
              'linear-gradient(#8b7355 1px, transparent 1px), linear-gradient(90deg, #8b7355 1px, transparent 1px)',
            backgroundSize: `${page.gridSize ?? 40}px ${page.gridSize ?? 40}px`,
          }}
        />
      )}
      {page.pattern === 'dots' && (
        <div
          className="absolute inset-0 opacity-[0.18] pointer-events-none z-10"
          style={{
            backgroundImage:
              `radial-gradient(circle, #8b7355 2px, transparent 2px)`,
            backgroundSize: `${page.gridSize ?? 40}px ${page.gridSize ?? 40}px`,
            backgroundPosition: '12px 12px',
          }}
        />
      )}

      {(page.elements ?? [])
        .filter(el => !el.data?._deleted)
        .slice()
        .sort((a, b) => a.zIndex - b.zIndex)
        .map(element => (
          <DraggableElement key={element.id} element={element} isActive={isActive} pageIndex={pageIndex} />
        ))}

      {drawingPath && drawSettings.active && (
        <svg
          className="absolute inset-0 pointer-events-none z-50"
          width="640"
          height="860"
          viewBox="0 0 640 860"
          preserveAspectRatio="none"
        >
          {drawSettings.brush === 'lasso' ? (
            <path
              d={drawingPath}
              stroke="#8b7355"
              strokeWidth={1.5}
              fill="rgba(139,115,85,0.04)"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray="5 4"
              opacity={0.7}
            />
          ) : drawSettings.brush === 'eraser' ? (
            <path
              d={drawingPath}
              stroke="#ff6b6b"
              strokeWidth={drawSettings.strokeWidth * 2}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray="6 4"
              opacity={0.5}
            />
          ) : (
            <path
              d={drawingPath}
              stroke={drawSettings.color}
              strokeWidth={drawSettings.strokeWidth}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={drawSettings.brush === 'highlighter' ? 0.4 : 1}
            />
          )}
        </svg>
      )}

      {isActive && <UserCursors pageIndex={pageIndex} />}
    </div>
  )
}
