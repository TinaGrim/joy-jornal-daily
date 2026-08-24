import { useEffect, useMemo, useCallback } from 'react'
import { useDrag } from 'react-dnd'
import { useJournal } from '../app/contexts/JournalContext'
import type { CanvasElement } from '@/types/journal'

interface UseToolDragOptions {
  elementType: string
  data?: Record<string, unknown>
  width?: number
  height?: number
}

// Logical page size is 640x860 (see Canvas); center placement for tap-to-insert
const PAGE_W = 640
const PAGE_H = 860

export function useToolDrag({ elementType, data, width = 80, height = 80 }: UseToolDragOptions) {
  const { addElement } = useJournal()
  const dragItem = useMemo(() => ({ elementType, data, width, height }), [elementType, data, width, height])

  const [collected, drag, preview] = useDrag(() => ({
    type: 'TOOL_ITEM',
    item: dragItem,
    collect: monitor => ({
      isDragging: monitor.isDragging(),
    }),
  }), [dragItem])

  // Tap-to-insert fallback: places the tool at the center of the focus page.
  // Works on every device regardless of drag-and-drop support (touch, Safari,
  // assistive tech) — dragging stays available where it works.
  const insert = useCallback(() => {
    addElement({
      type: elementType as CanvasElement['type'],
      x: PAGE_W / 2 - width / 2,
      y: PAGE_H / 2 - height / 2,
      width,
      height,
      rotation: 0,
      data: data || {},
    })
  }, [addElement, elementType, data, width, height])

  useEffect(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 60
    canvas.height = 60
    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.fillStyle = 'rgba(217,119,87,0.25)'
      ctx.strokeStyle = '#d97755'
      ctx.lineWidth = 2
      ctx.setLineDash([4, 3])
      const r = 8
      ctx.beginPath()
      ctx.moveTo(r, 0)
      ctx.lineTo(60 - r, 0)
      ctx.quadraticCurveTo(60, 0, 60, r)
      ctx.lineTo(60, 60 - r)
      ctx.quadraticCurveTo(60, 60, 60 - r, 60)
      ctx.lineTo(r, 60)
      ctx.quadraticCurveTo(0, 60, 0, 60 - r)
      ctx.lineTo(0, r)
      ctx.quadraticCurveTo(0, 0, r, 0)
      ctx.closePath()
      ctx.fill()
      ctx.stroke()
      ctx.setLineDash([])
      ctx.fillStyle = '#8b7355'
      ctx.font = '11px system-ui'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      const label = elementType.charAt(0).toUpperCase() + elementType.slice(1)
      ctx.fillText(label, 30, 30)
    }
    const img = new Image()
    img.src = canvas.toDataURL()
    preview(img)
  }, [preview, elementType])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { ...collected, insert, drag: ((el: HTMLElement | null) => { if (el) drag(el) }) as unknown as React.Ref<any> }
}
