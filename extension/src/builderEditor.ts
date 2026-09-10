import * as vscode from 'vscode'
import { emptyArchitectureJson, generateWithLanguageModel, openWorkspacePath, runLinkedAgent } from './agent'
import { getBuilderHtml, missingMediaHtml } from './webviewHtml'

interface WebviewMessage {
  type: string
  json?: string
  requestId?: string
  prompt?: string
  context?: string
  instruction?: string
  systemLabel?: string
  gitPath?: string
  gitRepo?: string
  path?: string
  apply?: boolean
  changeKind?: 'new' | 'update' | 'retire'
}

export class BuilderEditorProvider implements vscode.CustomTextEditorProvider {
  static readonly viewType = 'architectureVisualBuilder.editor'

  static register(context: vscode.ExtensionContext): vscode.Disposable {
    return vscode.window.registerCustomEditorProvider(
      BuilderEditorProvider.viewType,
      new BuilderEditorProvider(context),
      {
        webviewOptions: { retainContextWhenHidden: true },
        supportsMultipleEditorsPerDocument: false,
      },
    )
  }

  constructor(private readonly context: vscode.ExtensionContext) {}

  async resolveCustomTextEditor(
    document: vscode.TextDocument,
    webviewPanel: vscode.WebviewPanel,
  ): Promise<void> {
    const media = vscode.Uri.joinPath(this.context.extensionUri, 'media', 'architecture-visual-builder.js')
    webviewPanel.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this.context.extensionUri, 'media')],
    }

    try {
      await vscode.workspace.fs.stat(media)
      webviewPanel.webview.html = getBuilderHtml(webviewPanel.webview, this.context.extensionUri)
    } catch {
      webviewPanel.webview.html = missingMediaHtml()
      return
    }

    let applying = false

    const postDocument = () => {
      const text = document.getText().trim()
      webviewPanel.webview.postMessage({
        type: 'setDocument',
        json: text || emptyArchitectureJson(nameFromUri(document.uri)),
      })
    }

    const writeDocument = async (json: string) => {
      const next = json.endsWith('\n') ? json : `${json}\n`
      if (document.getText() === next || document.getText() === json) return
      applying = true
      const edit = new vscode.WorkspaceEdit()
      edit.replace(document.uri, fullRange(document), next)
      await vscode.workspace.applyEdit(edit)
      applying = false
    }

    if (!document.getText().trim()) {
      await writeDocument(emptyArchitectureJson(nameFromUri(document.uri)))
    }

    webviewPanel.webview.onDidReceiveMessage(async (message: WebviewMessage) => {
      switch (message.type) {
        case 'ready':
          postDocument()
          return
        case 'saveDocument':
          if (typeof message.json === 'string') await writeDocument(message.json)
          return
        case 'runAgent':
          await runLinkedAgent({
            instruction: message.instruction ?? '',
            systemLabel: message.systemLabel ?? 'component',
            gitPath: message.gitPath,
            gitRepo: message.gitRepo,
            apply: message.apply,
            changeKind: message.changeKind,
          })
          return
        case 'openPath':
          if (message.path) await openWorkspacePath(message.path)
          return
        case 'generateInstruction': {
          const requestId = message.requestId ?? ''
          try {
            const text = await generateWithLanguageModel(message.prompt ?? '', message.context ?? '')
            webviewPanel.webview.postMessage({ type: 'instructionResult', requestId, text })
          } catch (err) {
            webviewPanel.webview.postMessage({
              type: 'instructionResult',
              requestId,
              error: err instanceof Error ? err.message : 'Language model failed',
            })
          }
        }
      }
    })

    const changeSub = vscode.workspace.onDidChangeTextDocument((event) => {
      if (applying) return
      if (event.document.uri.toString() !== document.uri.toString()) return
      postDocument()
    })
    webviewPanel.onDidDispose(() => changeSub.dispose())
  }
}

function fullRange(document: vscode.TextDocument): vscode.Range {
  const last = document.lineCount - 1
  return new vscode.Range(0, 0, last, document.lineAt(last).text.length)
}

function nameFromUri(uri: vscode.Uri): string {
  const base = uri.path.split('/').pop() ?? 'Architecture'
  return base.replace(/\.architecture\.json$/i, '').replace(/\.avb\.json$/i, '').replace(/\.json$/i, '')
}
