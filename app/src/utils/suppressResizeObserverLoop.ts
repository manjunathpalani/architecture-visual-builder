/** Chromium throws this when a ResizeObserver callback mutates layout in the same frame. */

const LOOP =
  /ResizeObserver loop(?: completed with undelivered notifications)?|ResizeObserver loop limit exceeded|undelivered notifications/i

export function isResizeObserverLoop(message: unknown): boolean {
  return typeof message === 'string' && LOOP.test(message)
}

export function suppressResizeObserverLoop() {
  if (typeof window === 'undefined') return
  const w = window as Window & { __avbRoPatched?: boolean }
  if (w.__avbRoPatched) return
  w.__avbRoPatched = true

  const Original = window.ResizeObserver
  if (Original) {
    window.ResizeObserver = class extends Original {
      constructor(callback: ResizeObserverCallback) {
        let frame = 0
        super((entries, observer) => {
          if (frame) cancelAnimationFrame(frame)
          frame = requestAnimationFrame(() => {
            frame = 0
            callback(entries, observer)
          })
        })
      }
    } as typeof ResizeObserver
  }

  const swallow = (event: ErrorEvent) => {
    const message = event.message || (event.error instanceof Error ? event.error.message : '')
    if (!isResizeObserverLoop(message)) return
    event.preventDefault()
    event.stopImmediatePropagation()
  }
  window.addEventListener('error', swallow, true)
}

suppressResizeObserverLoop()
