import { getNodesBounds, getViewportForBounds, type Node } from '@xyflow/react'
import { toPng } from 'html-to-image'

export interface DiagramImage {
  dataUrl: string
  width: number
  height: number
}

export async function captureReactFlowPng(nodes: Node[]): Promise<DiagramImage | null> {
  const viewportEl = document.querySelector('.react-flow__viewport') as HTMLElement | null
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
    const dataUrl = await toPng(viewportEl, {
      backgroundColor: '#f8fafc',
      width,
      height,
      pixelRatio: 2,
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

export function dataUrlToBytes(dataUrl: string): Uint8Array {
  const comma = dataUrl.indexOf(',')
  const base64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return bytes
}
