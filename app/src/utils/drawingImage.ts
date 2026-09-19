export interface DrawingImageAsset {
  dataUrl: string
  width: number
  height: number
  name: string
}

const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
const MAX_EDGE = 1200
const MAX_DATA_CHARS = 900_000

export function isDrawingImageFile(file: File): boolean {
  return ALLOWED.has(file.type) || /\.(jpe?g|png|webp|gif)$/i.test(file.name)
}

export function isDrawingImageHref(value?: string): boolean {
  return Boolean(value?.startsWith('data:image/'))
}

export async function fileToDrawingImage(file: File): Promise<DrawingImageAsset> {
  if (!isDrawingImageFile(file)) {
    throw new Error('Use a JPG, PNG, WebP, or GIF image.')
  }
  const source = await readAsDataUrl(file)
  return compressDrawingImage(source, file.name, file.type)
}

export async function dataUrlToDrawingImage(dataUrl: string, name = 'image'): Promise<DrawingImageAsset> {
  if (!isDrawingImageHref(dataUrl)) {
    throw new Error('That is not an image.')
  }
  return compressDrawingImage(dataUrl, name, dataUrl.startsWith('data:image/png') ? 'image/png' : 'image/jpeg')
}

async function compressDrawingImage(dataUrl: string, name: string, mime: string): Promise<DrawingImageAsset> {
  const image = await loadImage(dataUrl)
  const scale = Math.min(1, MAX_EDGE / Math.max(image.width, image.height))
  const width = Math.max(1, Math.round(image.width * scale))
  const height = Math.max(1, Math.round(image.height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Could not process the image')
  ctx.drawImage(image, 0, 0, width, height)

  const preferPng = mime === 'image/png' || mime === 'image/gif' || mime === 'image/webp'
  let next = preferPng ? canvas.toDataURL('image/png') : canvas.toDataURL('image/jpeg', 0.84)
  if (next.length > MAX_DATA_CHARS) {
    let quality = 0.82
    next = canvas.toDataURL('image/jpeg', quality)
    while (next.length > MAX_DATA_CHARS && quality > 0.48) {
      quality -= 0.08
      next = canvas.toDataURL('image/jpeg', quality)
    }
  }
  if (next.length > MAX_DATA_CHARS) {
    throw new Error(`${name} is still too large after compression. Try a smaller crop.`)
  }
  return { dataUrl: next, width, height, name }
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(new Error(`Could not read ${file.name}`))
    reader.readAsDataURL(file)
  })
}

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('Could not decode the image'))
    image.src = dataUrl
  })
}

export function defaultImageSize(natural: { width: number; height: number }, maxEdge = 360) {
  const scale = Math.min(1, maxEdge / Math.max(natural.width, natural.height, 1))
  return {
    width: Math.max(48, Math.round(natural.width * scale)),
    height: Math.max(48, Math.round(natural.height * scale)),
  }
}
