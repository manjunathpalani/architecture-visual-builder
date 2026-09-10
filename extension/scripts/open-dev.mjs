import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const extRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const home = homedir()
const localApp = process.env.LOCALAPPDATA || join(home, 'AppData', 'Local')

const candidates = [
  process.env.VSCODE_BIN,
  'code',
  'code.cmd',
  join(localApp, 'Programs', 'Microsoft VS Code', 'bin', 'code.cmd'),
  join(localApp, 'Programs', 'Microsoft VS Code Insiders', 'bin', 'code-insiders.cmd'),
  'C:\\Program Files\\Microsoft VS Code\\bin\\code.cmd',
  'C:\\Program Files (x86)\\Microsoft VS Code\\bin\\code.cmd',
].filter(Boolean)

function resolveBin() {
  for (const bin of candidates) {
    if (bin === 'code' || bin === 'code.cmd') return bin
    if (existsSync(bin)) return bin
  }
  return 'code.cmd'
}

const bin = resolveBin()
const child = spawn(bin, ['--extensionDevelopmentPath', extRoot], {
  detached: true,
  stdio: 'ignore',
  shell: process.platform === 'win32',
  windowsHide: true,
})
child.on('error', (err) => {
  console.error(`Could not start VS Code (${bin}): ${err.message}`)
  console.error('Install the "code" shell command, or run:')
  console.error(`  code --extensionDevelopmentPath="${extRoot}"`)
  process.exit(1)
})
child.unref()
console.log('Opened Extension Development Host (unsigned, no VSIX).')
console.log(`  ${bin} --extensionDevelopmentPath="${extRoot}"`)
