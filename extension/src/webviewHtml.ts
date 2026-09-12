import * as vscode from 'vscode'

export function getNonce(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let nonce = ''
  for (let i = 0; i < 32; i += 1) nonce += chars.charAt(Math.floor(Math.random() * chars.length))
  return nonce
}

export function getBuilderHtml(
  webview: vscode.Webview,
  extensionUri: vscode.Uri,
  nonce: string,
): string {
  const scriptUri = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, 'media', 'architecture-visual-builder.js'),
  )
  const csp = webview.cspSource
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${csp} data: blob: https:; style-src ${csp} 'unsafe-inline'; script-src 'nonce-${nonce}' ${csp} 'unsafe-eval' 'wasm-unsafe-eval'; font-src ${csp} data:; connect-src ${csp} https: http:;" />
  <meta name="color-scheme" content="light" />
  <title>Architecture Visual Builder</title>
  <style>
    html, body, #root { height: 100%; margin: 0; }
    body { overflow: hidden; background: #f8fafc; }
    #avb-boot { font-family: Segoe UI, sans-serif; color: #334155; padding: 24px; }
  </style>
</head>
<body>
  <div id="root"><div id="avb-boot">Loading Architecture Visual Builder…</div></div>
  <script nonce="${nonce}">
    window.addEventListener('error', function (event) {
      var msg = String((event.error && event.error.message) || event.message || '');
      if (/ResizeObserver loop|undelivered notifications/i.test(msg)) {
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }
      var root = document.getElementById('root');
      if (!root) return;
      if (root.querySelector('.app, .app-shell, .canvas-shell, .react-flow, canvas')) return;
      if (!root.querySelector('#avb-boot') && root.childElementCount > 0) return;
      root.innerHTML = '<div id="avb-boot"><h1 style="font-size:18px;color:#0f172a">The builder failed to load</h1><pre style="white-space:pre-wrap;color:#b91c1c">' +
        String((event.error && event.error.stack) || event.message || 'Unknown script error') +
        '</pre><p>Rebuild with <code>cd app && npm run build:single</code> then <code>cd ../extension && npm run build</code>, and reload the window.</p></div>';
    }, true);
  </script>
  <script nonce="${nonce}" src="${scriptUri}" onerror="document.getElementById('root').innerHTML='<div id=avb-boot><h1 style=font-size:18px>Could not load the builder script</h1><p>The webview bundle is missing or blocked. Run <code>cd app && npm run build:single && cd ../extension && npm run build</code> and reload.</p></div>'"></script>
</body>
</html>`
}

export function missingMediaHtml(): string {
  return `<!DOCTYPE html>
<html>
<body style="font-family: sans-serif; padding: 24px; color: #0f172a;">
  <h1 style="font-size: 18px;">Architecture Visual Builder is not packaged</h1>
  <p>Build the webview bundle, then reload the extension:</p>
  <pre style="background:#f1f5f9;padding:12px;border-radius:8px;">cd app
npm run build:single
cd ../extension
npm run build</pre>
</body>
</html>`
}

export function notArchitectureHtml(uri: vscode.Uri): string {
  const name = uri.path.split('/').pop() ?? uri.fsPath
  return `<!DOCTYPE html>
<html>
<body style="font-family: sans-serif; padding: 24px; color: #0f172a; max-width: 560px;">
  <h1 style="font-size: 18px;">This is not an architecture file</h1>
  <p><code>${escapeHtml(name)}</code> is not a diagram document (it needs <code>metadata</code>, <code>systems</code>, and <code>integrations</code>).</p>
  <p>Use <strong>Architecture Visual Builder: New Architecture Diagram</strong> to create a <code>.avb.json</code> file, or open <code>*architecture*.json</code> / <code>*.avb.json</code>.</p>
</body>
</html>`
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[char] ?? char))
}
