import * as vscode from 'vscode'
import {
  emptyArchitectureJson,
  isArchitectureFilename,
  isArchitectureJson,
  suggestedArchitectureUri,
} from './agent'
import { BuilderEditorProvider } from './builderEditor'

export function activate(context: vscode.ExtensionContext) {
  try {
    context.subscriptions.push(BuilderEditorProvider.register(context))

    context.subscriptions.push(
      vscode.commands.registerCommand('architectureVisualBuilder.new', async () => {
        await createArchitectureFile()
      }),
    )

    context.subscriptions.push(
      vscode.commands.registerCommand('architectureVisualBuilder.open', async (uri?: vscode.Uri) => {
        const target = uri ?? jsonUriFromActiveEditor()
        if (!target) {
          const picked = await vscode.window.showOpenDialog({
            canSelectMany: false,
            canSelectFiles: true,
            filters: { 'Architecture JSON': ['json'] },
            title: 'Open architecture diagram',
          })
          if (!picked?.[0]) return
          await openArchitectureUri(picked[0])
          return
        }
        await openArchitectureUri(target)
      }),
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    void vscode.window.showErrorMessage(`Architecture Visual Builder failed to activate: ${message}`)
    throw err
  }
}

export function deactivate() {}

function jsonUriFromActiveEditor(): vscode.Uri | undefined {
  const uri = vscode.window.activeTextEditor?.document.uri
  if (!uri) return undefined
  const name = uri.path.split('/').pop()?.toLowerCase() ?? ''
  if (uri.scheme === 'untitled' || name.endsWith('.json')) return uri
  return undefined
}

async function createArchitectureFile(): Promise<void> {
  const pick = await vscode.window.showSaveDialog({
    defaultUri: suggestedArchitectureUri(),
    filters: { 'Architecture JSON': ['avb.json', 'architecture.json', 'json'] },
    saveLabel: 'Create architecture file',
    title: 'New Architecture Diagram',
  })
  if (!pick) return
  const name = pick.path.split('/').pop()?.replace(/\.(architecture|avb)\.json$/i, '').replace(/\.json$/i, '') ?? 'Architecture'
  await vscode.workspace.fs.writeFile(pick, Buffer.from(emptyArchitectureJson(name), 'utf8'))
  await vscode.commands.executeCommand('vscode.openWith', pick, BuilderEditorProvider.viewType)
}

async function openArchitectureUri(uri: vscode.Uri): Promise<void> {
  let text = ''
  try {
    if (uri.scheme === 'untitled') {
      const doc = await vscode.workspace.openTextDocument(uri)
      text = doc.getText()
    } else {
      text = Buffer.from(await vscode.workspace.fs.readFile(uri)).toString('utf8')
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    void vscode.window.showErrorMessage(`Could not open that file: ${message}`)
    return
  }

  const empty = !text.trim()
  if (!empty && !isArchitectureJson(text) && !isArchitectureFilename(uri)) {
    const choice = await vscode.window.showWarningMessage(
      `"${uri.path.split('/').pop()}" is not an architecture diagram. Create a new .avb.json file instead of overwriting it?`,
      'Create new file',
      'Cancel',
    )
    if (choice === 'Create new file') await createArchitectureFile()
    return
  }

  try {
    await vscode.commands.executeCommand('vscode.openWith', uri, BuilderEditorProvider.viewType)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    void vscode.window.showErrorMessage(`Could not open the architecture editor: ${message}`)
  }
}
