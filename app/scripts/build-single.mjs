/**
 * Compress Architecture Visual Builder into a single-file app.
 *
 * Outputs (in dist-single/):
 *   - architecture-visual-builder.html  Fully self-contained (CSS + JS inlined)
 *   - architecture-visual-builder.js    Embeddable bootstrap (injects CSS + mounts #root)
 *   - README.txt                        How to use
 *
 * Usage: npm run build:single
 */
import { spawnSync } from 'node:child_process'
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as esbuild from 'esbuild'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const tmpDir = join(root, 'dist-single-build')
const outDir = join(root, 'dist-single')

function run(cmd, args) {
  const result = spawnSync(cmd, args, {
    cwd: root,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  })
  if (result.status !== 0) {
    process.exit(result.status ?? 1)
  }
}

function findAsset(dir, ext) {
  const files = readdirSync(dir)
  const match = files.find((f) => f.endsWith(ext) && !f.includes('.iife.'))
  if (!match) throw new Error(`No *${ext} found in ${dir}`)
  return join(dir, match)
}

function escapeForScript(js) {
  return js.replace(/<\/script/gi, '<\\/script')
}

console.log('▸ Typecheck…')
run('npx', ['tsc', '--noEmit'])

console.log('▸ Vite single-chunk build…')
run('npx', ['vite', 'build', '--config', 'vite.single.config.ts'])

if (!existsSync(tmpDir)) {
  console.error('Build output missing:', tmpDir)
  process.exit(1)
}

const jsPath = findAsset(tmpDir, '.js')
let cssPath = join(tmpDir, 'app.css')
if (!existsSync(cssPath)) {
  try {
    cssPath = findAsset(tmpDir, '.css')
  } catch {
    cssPath = null
  }
}

const appJs = readFileSync(jsPath, 'utf8')
const appCss = cssPath && existsSync(cssPath) ? readFileSync(cssPath, 'utf8') : ''

console.log('▸ Compress to IIFE for offline / single-file use…')
const iifeOut = join(tmpDir, 'app.iife.js')
await esbuild.build({
  stdin: {
    contents: appJs,
    loader: 'js',
    resolveDir: tmpDir,
    sourcefile: 'app.js',
  },
  outfile: iifeOut,
  bundle: true,
  format: 'iife',
  platform: 'browser',
  target: ['es2020'],
  minify: true,
  logLevel: 'warning',
})

const iifeJs = readFileSync(iifeOut, 'utf8')

mkdirSync(outDir, { recursive: true })

const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="color-scheme" content="light" />
  <title>Architecture Visual Builder</title>
  <style>
${appCss}
  </style>
</head>
<body>
  <div id="root"></div>
  <script>
${escapeForScript(iifeJs)}
  </script>
</body>
</html>
`

const htmlOut = join(outDir, 'architecture-visual-builder.html')
writeFileSync(htmlOut, html, 'utf8')

const embedJs = `/**
 * Architecture Visual Builder — single-file embed
 * Usage:
 *   <div id="root"></div>
 *   <script src="architecture-visual-builder.js"></script>
 * Or omit #root — it will be created on document.body.
 */
(function () {
  var css = ${JSON.stringify(appCss)};
  if (css) {
    var style = document.createElement('style');
    style.setAttribute('data-avb', 'styles');
    style.textContent = css;
    document.head.appendChild(style);
  }
  if (!document.getElementById('root')) {
    var root = document.createElement('div');
    root.id = 'root';
    document.body.appendChild(root);
  }
})();
${iifeJs}
`

const jsOut = join(outDir, 'architecture-visual-builder.js')
writeFileSync(jsOut, embedJs, 'utf8')

const readme = `Architecture Visual Builder — single-file build
================================================

Files
-----
architecture-visual-builder.html
  Open in any modern browser (double-click or host statically).
  CSS + JS are fully inlined. No server required.

architecture-visual-builder.js
  Embed in an existing page:

    <div id="root"></div>
    <script src="architecture-visual-builder.js"></script>

  If #root is missing, it is created automatically.

Rebuild
-------
  cd app
  npm run build:single

Notes
-----
- GitHub / Azure DevOps Vite dev proxy is not included.
  Browser CORS rules apply when calling those APIs from a static file.
- Output is minified.
`

writeFileSync(join(outDir, 'README.txt'), readme, 'utf8')

rmSync(tmpDir, { recursive: true, force: true })

const htmlKb = (Buffer.byteLength(html) / 1024).toFixed(1)
const jsKb = (Buffer.byteLength(embedJs) / 1024).toFixed(1)

console.log('')
console.log('✓ Single-file app ready in dist-single/')
console.log(`  architecture-visual-builder.html  ${htmlKb} KB`)
console.log(`  architecture-visual-builder.js    ${jsKb} KB`)
console.log('')
