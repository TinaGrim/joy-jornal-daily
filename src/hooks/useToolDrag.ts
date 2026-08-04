import { useEffect, useMemo } from 'react'
import { useDrag } from 'react-dnd'

interface UseToolDragOptions {
  elementType: string
  data?: Record<string, unknown>
  width?: number
  height?: number
}

export function useToolDrag({ elementType, data, width = 80, height = 80 }: UseToolDragOptions) {
  const dragItem = useMemo(() => ({ elementType, data, width, height }), [elementType, data, width, height])

  const [collected, drag, preview] = useDrag(() => ({
    type: 'TOOL_ITEM',
    item: dragItem,
    collect: monitor => ({
      isDragging: monitor.isDragging(),
    }),
  }), [dragItem])

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
  return { ...collected, drag: ((el: HTMLElement | null) => { if (el) drag(el) }) as unknown as React.Ref<any> }
}
