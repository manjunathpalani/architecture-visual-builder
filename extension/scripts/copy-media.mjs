import { copyFileSync, existsSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(fileURLToPath(import.meta.url))
const source = join(root, '../../app/dist-single/architecture-visual-builder.js')
const mediaDir = join(root, '../media')
const dest = join(mediaDir, 'architecture-visual-builder.js')

if (!existsSync(source)) {
  console.error('Missing app/dist-single/architecture-visual-builder.js')
  console.error('Build the web app first: cd app && npm run build:single')
  process.exit(1)
}

mkdirSync(mediaDir, { recursive: true })
copyFileSync(source, dest)
console.log('Copied webview media to extension/media/')
