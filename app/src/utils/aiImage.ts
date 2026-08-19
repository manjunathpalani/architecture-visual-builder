export interface AiImage {
  name: string
  mimeType: 'image/jpeg' | 'image/png'
  dataUrl: string
}

const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
const MAX_FILES = 4
const MAX_EDGE = 1600
const MAX_DATA_CHARS = 2_400_000

export function isAllowedImageFile(file: File): boolean {
  return ALLOWED.has(file.type) || /\.(jpe?g|png|webp|gif)$/i.test(file.name)
}

export async function filesToAiImages(files: File[]): Promise<AiImage[]> {
  const picked = files.filter(isAllowedImageFile).slice(0, MAX_FILES)
  if (picked.length === 0) {
    throw new Error('Use a JPG, PNG, WebP, or GIF image.')
  }
  return Promise.all(picked.map((file) => fileToAiImage(file)))
}

async function fileToAiImage(file: File): Promise<AiImage> {
  const source = await readAsDataUrl(file)
  const compressed = await compressDataUrl(source, file.name)
  return compressed
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(new Error(`Could not read ${file.name}`))
    reader.readAsDataURL(file)
  })
}

async function compressDataUrl(dataUrl: string, name: string): Promise<AiImage> {
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

  let quality = 0.84
  let next = canvas.toDataURL('image/jpeg', quality)
  while (next.length > MAX_DATA_CHARS && quality > 0.5) {
    quality -= 0.08
    next = canvas.toDataURL('image/jpeg', quality)
  }
  if (next.length > MAX_DATA_CHARS) {
    throw new Error(`${name} is still too large after compression. Try a smaller crop.`)
  }
  return { name, mimeType: 'image/jpeg', dataUrl: next }
}

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('Could not decode the image'))
    image.src = dataUrl
  })
}

export function rawBase64(dataUrl: string): string {
  const comma = dataUrl.indexOf(',')
  return comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl
}

export function imageMime(dataUrl: string, fallback: AiImage['mimeType'] = 'image/jpeg'): AiImage['mimeType'] {
  if (dataUrl.startsWith('data:image/png')) return 'image/png'
  if (dataUrl.startsWith('data:image/jpeg') || dataUrl.startsWith('data:image/jpg')) return 'image/jpeg'
  return fallback
}
