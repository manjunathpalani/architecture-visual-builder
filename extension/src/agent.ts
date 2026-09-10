import * as vscode from 'vscode'

export interface AgentRunRequest {
  instruction: string
  systemLabel: string
  gitPath?: string
  gitRepo?: string
  apply?: boolean
  changeKind?: 'new' | 'update' | 'retire'
}

export function emptyArchitectureJson(name: string): string {
  return JSON.stringify(
    {
      metadata: {
        name,
        description: '',
        version: '1.0.0',
        updatedAt: new Date().toISOString(),
      },
      systems: [],
      integrations: [],
    },
    null,
    2,
  )
}

export async function generateWithLanguageModel(prompt: string, context: string): Promise<string> {
  const copilot = await vscode.lm.selectChatModels({ vendor: 'copilot' })
  const model = copilot[0] ?? (await vscode.lm.selectChatModels())[0]
  if (!model) {
    throw new Error(
      'No VS Code language model is available. Sign in to GitHub Copilot or enable a chat model.',
    )
  }
  const response = await model.sendRequest(
    [vscode.LanguageModelChatMessage.User(`${prompt}\n\n${context}`)],
    {},
    new vscode.CancellationTokenSource().token,
  )
  let text = ''
  for await (const chunk of response.text) {
    text += chunk
  }
  return text.trim()
}

export async function runLinkedAgent(request: AgentRunRequest): Promise<void> {
  const folder = vscode.workspace.workspaceFolders?.[0]
  if (folder) {
    const dir = vscode.Uri.joinPath(folder.uri, '.avb')
    await vscode.workspace.fs.createDirectory(dir)
    const file = vscode.Uri.joinPath(dir, request.apply ? 'apply-task.md' : 'agent-task.md')
    const kind = request.changeKind ? request.changeKind.toUpperCase() : 'UPDATE'
    const body = `# ${request.apply ? 'APPLY' : 'Implement'} ${kind}: ${request.systemLabel}\n\n${request.instruction}\n`
    await vscode.workspace.fs.writeFile(file, Buffer.from(body, 'utf8'))
    await vscode.window.showTextDocument(file, {
      preview: true,
      viewColumn: vscode.ViewColumn.Beside,
    })
  }

  if (request.gitPath?.trim()) {
    await openWorkspacePath(request.gitPath.trim())
  }

  const query = [
    request.apply
      ? 'APPLY these architecture-driven code changes now. Edit files. Do not stop at a plan.'
      : 'Implement this architecture change in the current workspace.',
    request.changeKind ? `Change type: ${request.changeKind.toUpperCase()} (new = create, update = modify, retire = remove).` : '',
    request.gitPath ? `Stay scoped to ${request.gitPath}.` : '',
    request.gitRepo ? `Linked repository: ${request.gitRepo}.` : '',
    folder ? `The full instruction is also in .avb/${request.apply ? 'apply-task.md' : 'agent-task.md'}.` : '',
    '',
    request.instruction,
  ]
    .filter((line) => line !== undefined)
    .join('\n')

  try {
    await vscode.commands.executeCommand('workbench.action.chat.open', { query })
  } catch {
    await vscode.env.clipboard.writeText(request.instruction)
    void vscode.window.showInformationMessage(
      'Agent instruction copied. Paste it into Copilot Chat or another coding agent.',
    )
  }
}

export async function openWorkspacePath(gitPath: string): Promise<void> {
  const cleaned = gitPath.replace(/^[\\/]/, '')
  const folders = vscode.workspace.workspaceFolders ?? []
  for (const folder of folders) {
    const uri = vscode.Uri.joinPath(folder.uri, cleaned)
    try {
      const stat = await vscode.workspace.fs.stat(uri)
      if (stat.type & vscode.FileType.Directory) {
        await vscode.commands.executeCommand('revealInExplorer', uri)
        return
      }
      const doc = await vscode.workspace.openTextDocument(uri)
      await vscode.window.showTextDocument(doc, { preview: true, viewColumn: vscode.ViewColumn.Beside })
      return
    } catch {
      /* try next folder */
    }
  }
  const hits = await vscode.workspace.findFiles(cleaned, '**/node_modules/**', 1)
  if (hits[0]) {
    const doc = await vscode.workspace.openTextDocument(hits[0])
    await vscode.window.showTextDocument(doc, { preview: true, viewColumn: vscode.ViewColumn.Beside })
  }
}
