import { getNodesBounds, getViewportForBounds, type Node } from '@xyflow/react'

async function htmlToImage() {
  return import('html-to-image')
}

export interface DiagramImage {
  dataUrl: string
  width: number
  height: number
}

export type DiagramImageFormat = 'png' | 'svg'

const EXPORT_BACKGROUND = '#f8fafc'

const CHROME_CLASSES = [
  'react-flow__controls',
  'react-flow__minimap',
  'react-flow__attribution',
  'react-flow__panel',
  'drawing-toolbar',
  'layout-toolbar',
  'ai-chat-launcher',
  'canvas-hint',
  'drawing-resize-handle',
]

function omitChrome(node: HTMLElement): boolean {
  if (!node.classList) return true
  return !CHROME_CLASSES.some((name) => node.classList.contains(name))
}

function viewportFrom(root?: ParentNode | null): HTMLElement | null {
  return (root ?? document).querySelector('.react-flow__viewport')
}

export async function captureReactFlowPng(
  nodes: Node[],
  root?: HTMLElement | null,
): Promise<DiagramImage | null> {
  const viewportEl = viewportFrom(root)
  if (!viewportEl || nodes.length === 0) return null

  const bounds = getNodesBounds(nodes)
  const pad = 80
  let width = Math.max(960, Math.round(bounds.width + pad))
  let height = Math.max(540, Math.round(bounds.height + pad))
  const scale = Math.min(1, 1600 / width, 900 / height)
  width = Math.round(width * scale)
  height = Math.round(height * scale)

  const view = getViewportForBounds(bounds, width, height, 0.4, 2, 0.1)

  try {
    const { toPng } = await htmlToImage()
    const dataUrl = await toPng(viewportEl, {
      backgroundColor: EXPORT_BACKGROUND,
      width,
      height,
      pixelRatio: 2,
      cacheBust: true,
      filter: omitChrome,
      style: {
        width: `${width}px`,
        height: `${height}px`,
        transform: `translate(${view.x}px, ${view.y}px) scale(${view.zoom})`,
      },
    })
    return { dataUrl, width, height }
  } catch {
    return null
  }
}

export async function captureCanvasImage(
  wrapper: HTMLElement,
  format: DiagramImageFormat,
): Promise<DiagramImage | null> {
  const width = Math.round(wrapper.clientWidth)
  const height = Math.round(wrapper.clientHeight)
  if (width < 8 || height < 8) return null

  const options = {
    backgroundColor: EXPORT_BACKGROUND,
    width,
    height,
    cacheBust: true,
    pixelRatio: format === 'png' ? 2 : 1,
    filter: omitChrome,
  }

  try {
    const { toPng, toSvg } = await htmlToImage()
    const dataUrl = format === 'svg' ? await toSvg(wrapper, options) : await toPng(wrapper, options)
    return { dataUrl, width, height }
  } catch {
    return null
  }
}

export function architectureFileSlug(name: string): string {
  const slug = name
    .trim()
    .replace(/\s+/g, '-')
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '')
  return slug || 'architecture'
}

export function downloadDataUrl(dataUrl: string, filename: string) {
  const anchor = window.document.createElement('a')
  anchor.href = dataUrl
  anchor.download = filename
  anchor.rel = 'noopener'
  window.document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
}

export function dataUrlToBytes(dataUrl: string): Uint8Array {
  const comma = dataUrl.indexOf(',')
  const base64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return bytes
}
