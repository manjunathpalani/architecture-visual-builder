type FullscreenDocument = Document & {
  webkitFullscreenElement?: Element | null
  webkitExitFullscreen?: () => Promise<void> | void
}

type FullscreenElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void
}

export function getFullscreenElement(): Element | null {
  const doc = document as FullscreenDocument
  return document.fullscreenElement ?? doc.webkitFullscreenElement ?? null
}

export function isElementFullscreen(el: Element | null): boolean {
  if (!el) return false
  return getFullscreenElement() === el
}

export async function requestElementFullscreen(el: HTMLElement): Promise<void> {
  const target = el as FullscreenElement
  if (target.requestFullscreen) {
    await target.requestFullscreen()
    return
  }
  if (target.webkitRequestFullscreen) {
    await target.webkitRequestFullscreen()
    return
  }
  throw new Error('Fullscreen is not supported in this browser')
}

export async function exitElementFullscreen(): Promise<void> {
  const doc = document as FullscreenDocument
  if (!getFullscreenElement()) return
  if (document.exitFullscreen) {
    await document.exitFullscreen()
    return
  }
  if (doc.webkitExitFullscreen) {
    await doc.webkitExitFullscreen()
  }
}

export function subscribeFullscreenChange(handler: () => void): () => void {
  document.addEventListener('fullscreenchange', handler)
  document.addEventListener('webkitfullscreenchange', handler)
  return () => {
    document.removeEventListener('fullscreenchange', handler)
    document.removeEventListener('webkitfullscreenchange', handler)
  }
}

const MENUS_STORAGE_KEY = 'avb-menus-hidden'

export function loadMenusHidden(): boolean {
  try {
    return localStorage.getItem(MENUS_STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

export function saveMenusHidden(hidden: boolean): void {
  try {
    localStorage.setItem(MENUS_STORAGE_KEY, hidden ? '1' : '0')
  } catch {
    /* ignore quota / private mode */
  }
}
