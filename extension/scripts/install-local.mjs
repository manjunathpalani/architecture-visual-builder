import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const extRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const pkg = JSON.parse(readFileSync(join(extRoot, 'package.json'), 'utf8'))
const folderName = `${pkg.publisher}.${pkg.name}-${pkg.version}`
const prefix = `${pkg.publisher}.${pkg.name}-`

const required = [
  join(extRoot, 'out', 'extension.js'),
  join(extRoot, 'media', 'architecture-visual-builder.js'),
]
for (const file of required) {
  if (!existsSync(file)) {
    console.error(`Missing ${file}`)
    console.error('From the repo: cd app && npm run build:single')
    console.error('Then:         cd ../extension && npm run build')
    process.exit(1)
  }
}

const home = homedir()
const destRoots = [join(home, '.vscode', 'extensions')]
for (const extra of [
  join(home, '.vscode-insiders', 'extensions'),
  join(home, '.cursor', 'extensions'),
]) {
  if (existsSync(dirname(extra))) destRoots.push(extra)
}

const files = ['package.json', 'README.md', 'LICENSE']
const dirs = ['out', 'media']

function installInto(root) {
  mkdirSync(root, { recursive: true })
  for (const entry of readdirSync(root)) {
    if (entry.startsWith(prefix) && entry !== folderName) {
      rmSync(join(root, entry), { recursive: true, force: true })
    }
  }
  const dest = join(root, folderName)
  rmSync(dest, { recursive: true, force: true })
  mkdirSync(dest, { recursive: true })
  for (const name of files) {
    const src = join(extRoot, name)
    if (existsSync(src)) cpSync(src, join(dest, name))
  }
  for (const name of dirs) {
    cpSync(join(extRoot, name), join(dest, name), { recursive: true })
  }
  registerInExtensionsJson(root, dest)
  return dest
}

function registerInExtensionsJson(root, dest) {
  const manifestPath = join(root, 'extensions.json')
  let list = []
  if (existsSync(manifestPath)) {
    try {
      list = JSON.parse(readFileSync(manifestPath, 'utf8'))
      if (!Array.isArray(list)) list = []
    } catch {
      list = []
    }
  }
  const id = `${pkg.publisher}.${pkg.name}`
  const posix = dest.replace(/\\/g, '/')
  const entry = {
    identifier: { id },
    version: pkg.version,
    location: {
      $mid: 1,
      path: `/${posix.replace(/^([A-Za-z]):/, (_, d) => d.toLowerCase() + ':')}`,
      scheme: 'file',
    },
    relativeLocation: folderName,
    metadata: {
      isApplicationScoped: false,
      isMachineScoped: false,
      isBuiltin: false,
      installedTimestamp: Date.now(),
      pinned: true,
      source: 'vsix',
      isPreReleaseVersion: false,
      hasPreReleaseVersion: false,
    },
  }
  const next = list.filter((item) => item?.identifier?.id !== id)
  next.push(entry)
  writeFileSync(manifestPath, JSON.stringify(next))
}

const installed = destRoots.map(installInto)
console.log('Sideloaded unsigned extension (no VSIX, no signature):')
for (const dest of installed) console.log(`  ${dest}`)
console.log('Reload the VS Code window: Command Palette → Developer: Reload Window')
