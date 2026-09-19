import * as os from 'node:os'
import * as path from 'node:path'
import * as vscode from 'vscode'

export interface AgentRunRequest {
  instruction: string
  systemLabel: string
  gitPath?: string
  gitRepo?: string
  apply?: boolean
  changeKind?: 'new' | 'update' | 'retire'
  scope?: 'feature' | 'story' | 'component'
  featureTitle?: string
  storyTitle?: string
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

export async function isCopilotLanguageModelAvailable(): Promise<boolean> {
  try {
    const copilot = await vscode.lm.selectChatModels({ vendor: 'copilot' })
    if (copilot[0]) return true
    const any = await vscode.lm.selectChatModels()
    return Boolean(any[0])
  } catch {
    return false
  }
}

export async function generateWithLanguageModel(prompt: string, context: string): Promise<string> {
  return completeViaVsCodeLm({ prompt, context })
}

export async function completeViaVsCodeLm(options: {
  systemPrompt?: string
  prompt: string
  context?: string
}): Promise<string> {
  const copilot = await vscode.lm.selectChatModels({ vendor: 'copilot' })
  const model = copilot[0] ?? (await vscode.lm.selectChatModels())[0]
  if (!model) {
    throw new Error(
      'GitHub Copilot is not available in this VS Code window. Sign in to GitHub Copilot (Accounts menu) and try again.',
    )
  }
  const parts = [
    options.systemPrompt?.trim(),
    options.context?.trim() ? `Existing architecture context:\n${options.context.trim()}` : '',
    options.prompt.trim(),
  ].filter(Boolean)
  const response = await model.sendRequest(
    [vscode.LanguageModelChatMessage.User(parts.join('\n\n'))],
    {},
    new vscode.CancellationTokenSource().token,
  )
  let text = ''
  for await (const chunk of response.text) {
    text += chunk
  }
  const trimmed = text.trim()
  if (!trimmed) {
    throw new Error('GitHub Copilot returned an empty response. Try a more specific prompt.')
  }
  return trimmed
}

export async function runLinkedAgent(request: AgentRunRequest): Promise<void> {
  const folder = vscode.workspace.workspaceFolders?.[0]
  const scope = request.scope ?? 'component'
  const fileName =
    scope === 'feature' ? 'apply-feature.md' : scope === 'story' ? 'apply-story.md' : request.apply ? 'apply-task.md' : 'agent-task.md'
  if (folder) {
    const dir = vscode.Uri.joinPath(folder.uri, '.avb')
    await vscode.workspace.fs.createDirectory(dir)
    const file = vscode.Uri.joinPath(dir, fileName)
    const kind = request.changeKind ? request.changeKind.toUpperCase() : 'UPDATE'
    const heading =
      scope === 'feature'
        ? `${request.apply ? 'APPLY' : 'Implement'} FEATURE: ${request.featureTitle || request.systemLabel}`
        : scope === 'story'
          ? `${request.apply ? 'APPLY' : 'Implement'} USER STORY: ${request.storyTitle || request.systemLabel}`
          : `${request.apply ? 'APPLY' : 'Implement'} ${kind}: ${request.systemLabel}`
    const body = `# ${heading}\n\n${request.instruction}\n`
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
    scope === 'feature'
      ? `This is a feature pack. Honor the feature definition and every user story.`
      : scope === 'story'
        ? `This is one user story inside feature "${request.featureTitle || 'the feature'}". Honor that story and its linked components only.`
        : request.changeKind
          ? `Change type: ${request.changeKind.toUpperCase()} (new = create, update = modify, retire = remove).`
          : '',
    request.featureTitle ? `Feature: ${request.featureTitle}.` : '',
    request.storyTitle ? `User story: ${request.storyTitle}.` : '',
    request.gitPath ? `Stay scoped to ${request.gitPath}.` : '',
    request.gitRepo ? `Linked repository: ${request.gitRepo}.` : '',
    folder ? `The full instruction is also in .avb/${fileName}.` : '',
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

export function isArchitectureJson(text: string): boolean {
  try {
    const parsed = JSON.parse(text) as { metadata?: unknown; systems?: unknown; integrations?: unknown }
    return Boolean(parsed?.metadata && Array.isArray(parsed.systems) && Array.isArray(parsed.integrations))
  } catch {
    return false
  }
}

export function isArchitectureFilename(uri: vscode.Uri): boolean {
  const name = uri.path.split('/').pop()?.toLowerCase() ?? ''
  return name.endsWith('.avb.json') || name.endsWith('.architecture.json') || name.includes('architecture')
}

export function suggestedArchitectureUri(): vscode.Uri {
  const folder = vscode.workspace.workspaceFolders?.[0]
  const name = 'architecture.avb.json'
  if (folder) return vscode.Uri.joinPath(folder.uri, name)
  return vscode.Uri.file(path.join(os.homedir(), name))
}

export async function openWorkspacePath(gitPath: string): Promise<void> {
  const raw = gitPath.trim().replace(/^["']|["']$/g, '')
  if (!raw) return

  const candidates: vscode.Uri[] = []
  if (/^[a-zA-Z]:[\\/]/.test(raw) || raw.startsWith('\\\\') || path.isAbsolute(raw)) {
    candidates.push(vscode.Uri.file(raw))
  }

  const posix = raw.replace(/\\/g, '/').replace(/^\/+/, '')
  const segments = posix.split('/').filter(Boolean)
  for (const folder of vscode.workspace.workspaceFolders ?? []) {
    if (segments.length) candidates.push(vscode.Uri.joinPath(folder.uri, ...segments))
    candidates.push(vscode.Uri.file(path.join(folder.uri.fsPath, raw)))
  }

  const seen = new Set<string>()
  for (const uri of candidates) {
    const key = uri.toString()
    if (seen.has(key)) continue
    seen.add(key)
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
      /* try next candidate */
    }
  }

  const glob = segments.join('/')
  if (glob) {
    const hits = await vscode.workspace.findFiles(`**/${glob}`, '**/node_modules/**', 5)
    if (hits[0]) {
      const doc = await vscode.workspace.openTextDocument(hits[0])
      await vscode.window.showTextDocument(doc, { preview: true, viewColumn: vscode.ViewColumn.Beside })
      return
    }
  }

  void vscode.window.showWarningMessage(`Could not open "${raw}" in the workspace.`)
}
