import * as vscode from 'vscode'
import {
  emptyArchitectureJson,
  generateWithLanguageModel,
  isArchitectureFilename,
  isArchitectureJson,
  openWorkspacePath,
  runLinkedAgent,
  suggestedArchitectureUri,
} from './agent'
import { handleAiApi } from './aiProxy'
import { getBuilderHtml, getNonce, missingMediaHtml, notArchitectureHtml } from './webviewHtml'

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
  scope?: 'feature' | 'story' | 'component'
  featureTitle?: string
  storyTitle?: string
  body?: Record<string, unknown>
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

    const existing = document.getText().trim()
    if (existing && !isArchitectureJson(existing) && !isArchitectureFilename(document.uri)) {
      webviewPanel.webview.html = notArchitectureHtml(document.uri)
      void vscode.window.showErrorMessage(
        `"${nameFromUri(document.uri)}" is not an architecture diagram. Open a .avb.json / .architecture.json file, or run Architecture Visual Builder: New Architecture Diagram.`,
      )
      return
    }

    try {
      await vscode.workspace.fs.stat(media)
      webviewPanel.webview.html = getBuilderHtml(
        webviewPanel.webview,
        this.context.extensionUri,
        getNonce(),
      )
    } catch {
      webviewPanel.webview.html = missingMediaHtml()
      vscode.window.showErrorMessage(
        'Architecture Visual Builder webview bundle is missing. From the repo run: cd app && npm run build:single && cd ../extension && npm run build',
      )
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

      const current = document.getText().trim()
      if (current && !isArchitectureJson(current) && !isArchitectureFilename(document.uri)) {
        const pick = await vscode.window.showSaveDialog({
          defaultUri: suggestedArchitectureUri(),
          filters: { 'Architecture JSON': ['avb.json', 'architecture.json', 'json'] },
          saveLabel: 'Save architecture',
        })
        if (!pick) return
        await vscode.workspace.fs.writeFile(pick, Buffer.from(next, 'utf8'))
        await vscode.commands.executeCommand('vscode.openWith', pick, BuilderEditorProvider.viewType)
        return
      }

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
            scope: message.scope,
            featureTitle: message.featureTitle,
            storyTitle: message.storyTitle,
          })
          return
        case 'openPath':
          if (message.path) await openWorkspacePath(message.path)
          return
        case 'aiApi': {
          const requestId = message.requestId ?? ''
          const result = await handleAiApi(message.path ?? '', message.body)
          webviewPanel.webview.postMessage({
            type: 'aiApiResult',
            requestId,
            status: result.status,
            payload: result.payload,
          })
          return
        }
        case 'pickJsonFile': {
          const requestId = message.requestId ?? ''
          try {
            const picked = await vscode.window.showOpenDialog({
              canSelectMany: false,
              canSelectFiles: true,
              filters: { 'Architecture JSON': ['json'] },
              title: 'Open architecture JSON',
            })
            if (!picked?.[0]) {
              webviewPanel.webview.postMessage({ type: 'pickJsonResult', requestId, cancelled: true })
              return
            }
            const bytes = await vscode.workspace.fs.readFile(picked[0])
            const json = Buffer.from(bytes).toString('utf8')
            if (!isArchitectureJson(json)) {
              webviewPanel.webview.postMessage({
                type: 'pickJsonResult',
                requestId,
                error: `"${picked[0].path.split('/').pop()}" is not architecture JSON (needs metadata, systems, and integrations).`,
              })
              return
            }
            webviewPanel.webview.postMessage({ type: 'pickJsonResult', requestId, json })
          } catch (err) {
            webviewPanel.webview.postMessage({
              type: 'pickJsonResult',
              requestId,
              error: err instanceof Error ? err.message : 'Could not open that file',
            })
          }
          return
        }
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
