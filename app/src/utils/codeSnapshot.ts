import type { ArchitectureDocument, ComponentChangeTask, SystemNode, TechnicalChangeDesign } from '../types'
import { isVsCodeHost, scanWorkspaceCode } from './vscodeHost'
import { parseGitRepo } from './codeLink'
import { listGitHubTree, readGitHubFile } from './gitProviders/githubApi'
import { listAzureItems, readAzureFile } from './gitProviders/azureDevOpsApi'
import { isGitHubConnected, isAzureDevOpsConnected } from './gitCredentials'

export interface CodeScanTarget {
  systemId: string
  systemLabel: string
  changeKind: string
  gitPath?: string
  gitRepo?: string
  gitBranch?: string
  gitProvider?: string
  gitAzureProject?: string
  gitAzureRepoId?: string
}

export interface CodeSnapshotFile {
  path: string
  systemId?: string
  systemLabel?: string
  excerpt?: string
}

export interface CodeSnapshot {
  source: 'vscode' | 'github' | 'azure-devops' | 'local' | 'none'
  files: CodeSnapshotFile[]
  notes: string[]
}

const SOURCE_EXT = /\.(ts|tsx|js|jsx|mjs|cjs|py|cs|java|kt|go|rb|php|json|yml|yaml|xml|csproj|gradle|tf|bicep|md)$/i
const SKIP = /(^|\/)(node_modules|\.git|dist|build|out|\.next|coverage|bin|obj)(\/|$)/i
const MAX_LIST = 80
const MAX_EXCERPTS = 12
const MAX_EXCERPT_CHARS = 2200

export function targetsFromDesign(
  document: ArchitectureDocument,
  design: TechnicalChangeDesign,
): CodeScanTarget[] {
  const systems = flattenSystems(document.systems)
  const byId = new Map(systems.map((system) => [system.id, system]))
  const tasks = design.tasks.length > 0 ? design.tasks : fallbackTasks(systems)
  const seen = new Set<string>()
  const targets: CodeScanTarget[] = []
  for (const task of tasks) {
    if (seen.has(task.systemId)) continue
    seen.add(task.systemId)
    const system = byId.get(task.systemId)
    const props = system?.properties
    targets.push({
      systemId: task.systemId,
      systemLabel: task.systemLabel || system?.label || task.systemId,
      changeKind: task.changeKind,
      gitPath: task.codePath?.trim() || props?.gitPath?.trim(),
      gitRepo: props?.gitRepo?.trim() || props?.gitUrl?.trim(),
      gitBranch: props?.gitBranch?.trim(),
      gitProvider: props?.gitProvider,
      gitAzureProject: props?.gitAzureProject,
      gitAzureRepoId: props?.gitAzureRepoId,
    })
  }
  return targets
}

export async function collectCodeSnapshot(targets: CodeScanTarget[]): Promise<CodeSnapshot> {
  if (isVsCodeHost()) {
    try {
      const result = await scanWorkspaceCode(
        targets.map((target) => ({ label: target.systemLabel, path: target.gitPath ?? '', systemId: target.systemId })),
      )
      if (result.files.length > 0) {
        return { source: 'vscode', files: result.files, notes: result.notes ?? [] }
      }
      return {
        source: 'vscode',
        files: [],
        notes: result.notes?.length
          ? result.notes
          : ['VS Code workspace had no matching files for the linked code paths. Link gitPath on each component or open the repo folder.'],
      }
    } catch (err) {
      return {
        source: 'vscode',
        files: [],
        notes: [err instanceof Error ? err.message : 'Could not scan the VS Code workspace'],
      }
    }
  }

  const notes: string[] = []
  const files: CodeSnapshotFile[] = []
  for (const target of targets) {
    try {
      const remote = await scanRemoteTarget(target)
      files.push(...remote.files)
      notes.push(...remote.notes)
    } catch (err) {
      notes.push(
        `${target.systemLabel}: ${err instanceof Error ? err.message : 'Could not read linked repository'}`,
      )
    }
  }
  if (files.length > 0) {
    const source = files.some((file) => file.path.startsWith('ado:')) ? 'azure-devops' : 'github'
    return { source, files: capSnapshot(files), notes }
  }

  if (canPickLocalFolder()) {
    notes.push('No GitHub/Azure DevOps files found. You can pick a local folder to scan.')
  } else if (!isGitHubConnected() && !isAzureDevOpsConnected()) {
    notes.push('Connect GitHub or Azure DevOps in Settings, open this diagram in VS Code, or pick a local folder.')
  }
  return { source: files.length ? 'github' : 'none', files: capSnapshot(files), notes }
}

export async function scanLocalFolder(targets: CodeScanTarget[]): Promise<CodeSnapshot> {
  const picker = (window as Window & { showDirectoryPicker?: () => Promise<FileSystemDirectoryHandle> }).showDirectoryPicker
  if (!picker) {
    throw new Error('This browser cannot open a local folder. Use Chrome/Edge, or open the diagram in VS Code.')
  }
  const root = await picker()
  const files: CodeSnapshotFile[] = []
  const defaultTarget = targets[0]
  await walkDirectory(root, '', files, defaultTarget)
  return {
    source: 'local',
    files: capSnapshot(files),
    notes: [`Scanned local folder “${root.name}”.`],
  }
}

export function canPickLocalFolder(): boolean {
  return typeof window !== 'undefined' && typeof (window as Window & { showDirectoryPicker?: unknown }).showDirectoryPicker === 'function'
}

export function formatSnapshotForPrompt(snapshot: CodeSnapshot): string {
  if (snapshot.files.length === 0) {
    return `Code snapshot: none (${snapshot.source}). ${snapshot.notes.join(' ')}`
  }
  const listed = snapshot.files
    .slice(0, MAX_LIST)
    .map((file) => `- ${file.path}${file.systemLabel ? ` [${file.systemLabel}]` : ''}`)
    .join('\n')
  const excerpts = snapshot.files
    .filter((file) => file.excerpt)
    .slice(0, MAX_EXCERPTS)
    .map((file) => `### ${file.path}\n${file.excerpt}`)
    .join('\n\n')
  return [
    `Code snapshot source: ${snapshot.source}`,
    snapshot.notes.length ? `Notes: ${snapshot.notes.join(' | ')}` : '',
    `Files (${Math.min(snapshot.files.length, MAX_LIST)}):`,
    listed,
    excerpts ? `Excerpts:\n${excerpts}` : '',
  ]
    .filter(Boolean)
    .join('\n')
}

async function scanRemoteTarget(target: CodeScanTarget): Promise<CodeSnapshot> {
  const pathPrefix = (target.gitPath ?? '').replace(/^\/+/, '')
  const provider = parseGitRepo(target.gitRepo ?? '', target.gitProvider as never)?.provider
  if ((provider === 'azure-devops' || target.gitAzureRepoId) && isAzureDevOpsConnected() && target.gitAzureProject && target.gitAzureRepoId) {
    const branch = target.gitBranch || 'main'
    const items = await listAzureItems(
      target.gitAzureProject,
      target.gitAzureRepoId,
      pathPrefix || '/',
      branch,
      'Full',
    )
    const files: CodeSnapshotFile[] = []
    const candidates = items.filter((item) => !item.isFolder && SOURCE_EXT.test(item.path) && !SKIP.test(item.path))
    for (const item of pickExcerpts(candidates.map((row) => row.path), pathPrefix, target.systemLabel)) {
      let excerpt = ''
      try {
        const text = await readAzureFile(target.gitAzureProject, target.gitAzureRepoId, item, branch)
        excerpt = text.slice(0, MAX_EXCERPT_CHARS)
      } catch {
        /* listing is still useful */
      }
      files.push({ path: item, systemId: target.systemId, systemLabel: target.systemLabel, excerpt: excerpt || undefined })
    }
    return { source: 'azure-devops', files, notes: files.length ? [] : [`No Azure DevOps files under ${pathPrefix || '/'} for ${target.systemLabel}`] }
  }

  if (!isGitHubConnected() || !target.gitRepo) {
    return { source: 'none', files: [], notes: target.gitRepo ? [] : [`${target.systemLabel} has no linked repository`] }
  }
  const parsed = parseGitRepo(target.gitRepo, target.gitProvider as never)
  if (!parsed || parsed.provider === 'azure-devops') {
    return { source: 'none', files: [], notes: [`${target.systemLabel}: unsupported or missing GitHub repo`] }
  }
  const branch = target.gitBranch || 'main'
  const tree = await listGitHubTree(parsed.owner, parsed.repo, branch)
  const paths = tree
    .filter((item) => item.type === 'blob' && SOURCE_EXT.test(item.path) && !SKIP.test(item.path))
    .filter((item) => !pathPrefix || item.path === pathPrefix || item.path.startsWith(`${pathPrefix}/`))
    .map((item) => item.path)
  const files: CodeSnapshotFile[] = []
  for (const filePath of pickExcerpts(paths, pathPrefix, target.systemLabel)) {
    let excerpt = ''
    try {
      const text = await readGitHubFile(parsed.owner, parsed.repo, filePath, branch)
      excerpt = text.slice(0, MAX_EXCERPT_CHARS)
    } catch {
      /* ignore */
    }
    files.push({
      path: filePath,
      systemId: target.systemId,
      systemLabel: target.systemLabel,
      excerpt: excerpt || undefined,
    })
  }
  return {
    source: 'github',
    files,
    notes: files.length ? [] : [`No GitHub files under ${pathPrefix || '/'} for ${target.systemLabel}`],
  }
}

function pickExcerpts(paths: string[], prefix: string, label: string): string[] {
  const ranked = [...paths].sort((a, b) => scorePath(a, prefix, label) - scorePath(b, prefix, label))
  return ranked.slice(0, MAX_EXCERPTS)
}

function scorePath(filePath: string, prefix: string, label: string): number {
  const name = filePath.toLowerCase()
  const needle = label.toLowerCase().replace(/[^a-z0-9]+/g, '')
  let score = 50
  if (/(^|\/)(index|main|app|program|startup|controller|service|api|routes)\./i.test(filePath)) score -= 20
  if (needle && name.replace(/[^a-z0-9]+/g, '').includes(needle)) score -= 15
  if (/package\.json$|csproj$|readme/i.test(filePath)) score -= 8
  if (prefix && filePath.startsWith(prefix)) score -= 5
  return score
}

function capSnapshot(files: CodeSnapshotFile[]): CodeSnapshotFile[] {
  const withExcerpt = files.filter((file) => file.excerpt).slice(0, MAX_EXCERPTS)
  const excerptPaths = new Set(withExcerpt.map((file) => file.path))
  const rest = files.filter((file) => !excerptPaths.has(file.path)).slice(0, MAX_LIST - withExcerpt.length)
  return [...withExcerpt, ...rest.map((file) => ({ ...file, excerpt: undefined }))]
}

function flattenSystems(systems: SystemNode[]): SystemNode[] {
  const rows: SystemNode[] = []
  for (const system of systems) {
    rows.push(system)
    if (system.subDiagram?.systems.length) rows.push(...flattenSystems(system.subDiagram.systems))
  }
  return rows
}

function fallbackTasks(systems: SystemNode[]): ComponentChangeTask[] {
  return systems
    .filter((system) => system.type !== 'note' && system.type !== 'shape' && system.type !== 'group')
    .slice(0, 8)
    .map((system) => ({
      id: system.id,
      systemId: system.id,
      systemLabel: system.label,
      changeKind: 'update',
      intent: '',
      status: 'pending',
    }))
}

async function walkDirectory(
  dir: FileSystemDirectoryHandle,
  prefix: string,
  out: CodeSnapshotFile[],
  target?: CodeScanTarget,
): Promise<void> {
  if (out.length >= MAX_LIST) return
  const relative = prefix.replace(/^\/+/, '')
  if (SKIP.test(relative)) return
  for await (const [name, handle] of dir as unknown as AsyncIterable<[string, FileSystemHandle]>) {
    const path = prefix ? `${prefix}/${name}` : name
    if (SKIP.test(path)) continue
    if (handle.kind === 'directory') {
      await walkDirectory(handle as FileSystemDirectoryHandle, path, out, target)
    } else if (handle.kind === 'file' && SOURCE_EXT.test(name)) {
      const fileHandle = handle as FileSystemFileHandle
      let excerpt: string | undefined
      if (out.filter((item) => item.excerpt).length < MAX_EXCERPTS) {
        try {
          const file = await fileHandle.getFile()
          if (file.size < 200_000) excerpt = (await file.text()).slice(0, MAX_EXCERPT_CHARS)
        } catch {
          excerpt = undefined
        }
      }
      out.push({
        path,
        systemId: target?.systemId,
        systemLabel: target?.systemLabel,
        excerpt,
      })
    }
    if (out.length >= MAX_LIST) return
  }
}
