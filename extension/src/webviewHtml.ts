import * as vscode from 'vscode'

export function getBuilderHtml(webview: vscode.Webview, extensionUri: vscode.Uri): string {
  const scriptUri = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, 'media', 'architecture-visual-builder.js'),
  )
  const csp = webview.cspSource
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${csp} data: blob: https:; style-src ${csp} 'unsafe-inline'; script-src ${csp}; font-src ${csp} data:; connect-src ${csp} https:;" />
  <meta name="color-scheme" content="light" />
  <title>Architecture Visual Builder</title>
  <style>
    html, body, #root { height: 100%; margin: 0; }
    body { overflow: hidden; }
  </style>
</head>
<body>
  <div id="root"></div>
  <script src="${scriptUri}"></script>
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
