import { useState, useRef, useEffect, useCallback } from 'react'

export function useAutoSave(dependency: unknown, delay = 800) {
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- debounced status indicator
    setStatus('saving')

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }

    timeoutRef.current = setTimeout(() => {
      setStatus('saved')
      setTimeout(() => setStatus('idle'), 2000)
    }, delay)

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [dependency, delay])

  const reset = useCallback(() => {
    setStatus('idle')
  }, [])

  return { status, reset }
}
