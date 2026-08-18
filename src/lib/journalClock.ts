let serverOffset = 0

export function setServerOffset(offsetMs: number): void {
  serverOffset = offsetMs
}

export function journalNow(): number {
  return Date.now() + serverOffset
}
