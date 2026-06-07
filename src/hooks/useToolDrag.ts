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
    const img = new Image()
    img.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'
    preview(img)
  }, [preview])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { ...collected, drag: ((el: HTMLElement | null) => { if (el) drag(el) }) as unknown as React.Ref<any> }
}
