import * as vscode from 'vscode'
import { emptyArchitectureJson } from './agent'
import { BuilderEditorProvider } from './builderEditor'

export function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(BuilderEditorProvider.register(context))

  context.subscriptions.push(
    vscode.commands.registerCommand('architectureVisualBuilder.new', async () => {
      const doc = await vscode.workspace.openTextDocument({
        language: 'json',
        content: emptyArchitectureJson('New Architecture'),
      })
      await vscode.commands.executeCommand('vscode.openWith', doc.uri, BuilderEditorProvider.viewType)
    }),
  )

  context.subscriptions.push(
    vscode.commands.registerCommand('architectureVisualBuilder.open', async (uri?: vscode.Uri) => {
      const target = uri ?? vscode.window.activeTextEditor?.document.uri
      if (!target) {
        await vscode.commands.executeCommand('architectureVisualBuilder.new')
        return
      }
      await vscode.commands.executeCommand('vscode.openWith', target, BuilderEditorProvider.viewType)
    }),
  )
}

export function deactivate() {}
