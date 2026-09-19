import type { ArchitectureDocument, ComponentChangeTask, FeatureUserStory, TechnicalChangeDesign } from '../types'
import { parseGitRepo } from './codeLink'
import { isGitHubConnected, getGitHubCredentials } from './gitCredentials'
import { createCopilotAgentIssue } from './gitProviders/githubApi'
import { isVsCodeHost, runLinkedAgent } from './vscodeHost'
import {
  buildApplyInstruction,
  buildAgentRunPayload,
  buildDesignPackMarkdown,
  buildStoryPackMarkdown,
  copyText,
  designFileSlug,
  downloadMarkdown,
  listDesignableSystems,
  tasksForStory,
  wrapAgentApplyPrompt,
  type AgentDispatchResult,
} from './changeDesign'

export type AgentDispatchScope = 'feature' | 'story' | 'component'

export interface AgentTarget {
  owner: string
  repo: string
  branch: string
  gitRepo: string
  gitPath?: string
}

export async function fetchCopilotAgentStatus(): Promise<{ available: boolean; workspace?: string }> {
  try {
    const response = await fetch('/api/agent/status')
    if (!response.ok) return { available: false }
    const payload = (await response.json()) as { available?: boolean; workspace?: string }
    return { available: Boolean(payload.available), workspace: payload.workspace }
  } catch {
    return { available: false }
  }
}

export function resolveAgentTarget(
  doc: ArchitectureDocument,
  design: TechnicalChangeDesign,
  task?: ComponentChangeTask,
): AgentTarget | null {
  const systems = listDesignableSystems(doc)
  const candidates = task
    ? [task]
    : design.tasks
  for (const item of candidates) {
    const system = systems.find((row) => row.id === item.systemId)
    const repo = system?.properties?.gitRepo || system?.properties?.gitUrl
    if (!repo) continue
    const parsed = parseGitRepo(repo, system?.properties?.gitProvider as 'github' | undefined)
    if (!parsed || parsed.provider !== 'github') continue
    return {
      owner: parsed.owner,
      repo: parsed.repo,
      branch: system?.properties?.gitBranch?.trim() || 'main',
      gitRepo: `${parsed.owner}/${parsed.repo}`,
      gitPath: item.codePath?.trim() || system?.properties?.gitPath,
    }
  }
  return null
}

export function buildDispatchInstruction(options: {
  document: ArchitectureDocument
  design: TechnicalChangeDesign
  scope: AgentDispatchScope
  story?: FeatureUserStory
  task?: ComponentChangeTask
  apply?: boolean
}): { instruction: string; label: string; fileBase: string } {
  const featureName = options.design.title.trim() || 'Untitled feature'
  if (options.scope === 'component' && options.task) {
    return {
      instruction: options.apply
        ? buildApplyInstruction(options.document, options.design, options.task)
        : options.task.instruction?.trim() || buildApplyInstruction(options.document, options.design, options.task),
      label: options.task.systemLabel,
      fileBase: `${designFileSlug(featureName)}-${options.task.systemId}`,
    }
  }
  if (options.scope === 'story' && options.story) {
    const body = buildStoryPackMarkdown(options.document, options.design, options.story)
    const storyName = options.story.title.trim() || 'Untitled story'
    return {
      instruction: wrapAgentApplyPrompt(`user story “${storyName}” in feature “${featureName}”`, body),
      label: storyName,
      fileBase: `${designFileSlug(featureName)}-${designFileSlug(storyName)}`,
    }
  }
  const body = buildDesignPackMarkdown(options.document, options.design)
  return {
    instruction: wrapAgentApplyPrompt(`feature “${featureName}” and its user stories`, body),
    label: featureName,
    fileBase: designFileSlug(featureName),
  }
}

export async function dispatchAgentWork(options: {
  document: ArchitectureDocument
  design: TechnicalChangeDesign
  scope: AgentDispatchScope
  storyId?: string
  task?: ComponentChangeTask
  apply?: boolean
}): Promise<AgentDispatchResult> {
  const story = options.storyId
    ? (options.design.stories ?? []).find((item) => item.id === options.storyId)
    : undefined
  if (options.scope === 'story' && !story) {
    throw new Error('Select a user story before sending it to the agent.')
  }
  if (options.scope === 'component' && !options.task) {
    throw new Error('Select a component before sending it to the agent.')
  }
  if (options.scope === 'feature' && options.design.tasks.length === 0) {
    throw new Error('Add linked components before sending this feature to an agent.')
  }
  if (options.scope === 'story' && story && tasksForStory(options.design, story.id).length === 0) {
    throw new Error('Link components to this user story before sending it to an agent.')
  }

  const pack = buildDispatchInstruction({
    document: options.document,
    design: options.design,
    scope: options.scope,
    story,
    task: options.task,
    apply: options.apply,
  })
  const target = resolveAgentTarget(options.document, options.design, options.task)

  if (isVsCodeHost()) {
    const payload = options.task
      ? buildAgentRunPayload(options.document, options.design, options.task, true)
      : {
          instruction: pack.instruction,
          systemLabel: pack.label,
          gitPath: target?.gitPath,
          gitRepo: target?.gitRepo,
          apply: true,
        }
    payload.instruction = pack.instruction
    payload.systemLabel = pack.label
    runLinkedAgent({
      ...payload,
      scope: options.scope,
      featureTitle: options.design.title,
      storyTitle: story?.title,
    })
    return {
      mode: 'vscode',
      instruction: pack.instruction,
      message: `Sent ${options.scope} “${pack.label}” to the VS Code coding agent with feature and user-story context.`,
    }
  }

  if (isGitHubConnected() && target) {
    try {
      const issue = await createCopilotAgentIssue({
        owner: target.owner,
        repo: target.repo,
        branch: target.branch,
        title: `[Architecture] ${pack.label}`,
        body: pack.instruction,
        customInstructions:
          'Honor the feature definition and user stories. Implement only the linked components and stay inside the named code paths.',
      })
      return {
        mode: 'github',
        instruction: pack.instruction,
        url: issue.htmlUrl,
        message: `Opened GitHub Copilot coding-agent issue #${issue.number} on ${target.gitRepo}.`,
      }
    } catch (err) {
      const sdk = await sendViaCopilotSdk(pack.instruction, target).catch(() => null)
      if (sdk) return sdk
      await copyText(pack.instruction)
      downloadMarkdown(`${pack.fileBase}-agent.md`, pack.instruction)
      return {
        mode: 'clipboard',
        instruction: pack.instruction,
        message: `Could not start Copilot on GitHub (${err instanceof Error ? err.message : 'error'}). Instruction copied and downloaded.`,
      }
    }
  }

  const sdk = await sendViaCopilotSdk(pack.instruction, target).catch(() => null)
  if (sdk) return sdk

  await copyText(pack.instruction)
  downloadMarkdown(`${pack.fileBase}-agent.md`, pack.instruction)
  return {
    mode: 'clipboard',
    instruction: pack.instruction,
    message: target
      ? 'Connect GitHub in Settings to assign Copilot on the linked repo. Instruction copied and downloaded.'
      : 'Instruction copied and downloaded. Link a GitHub repo on a component, or open this diagram in VS Code, to send it to an agent.',
  }
}

async function sendViaCopilotSdk(
  instruction: string,
  target: AgentTarget | null,
): Promise<AgentDispatchResult | null> {
  const status = await fetchCopilotAgentStatus()
  if (!status.available) return null
  const creds = getGitHubCredentials()
  const response = await fetch('/api/agent/run', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt: instruction,
      gitHubToken: creds?.token,
      owner: target?.owner,
      repo: target?.repo,
      branch: target?.branch,
      workingDirectory: status.workspace,
    }),
  })
  const payload = (await response.json().catch(() => ({}))) as {
    error?: string
    sessionId?: string
    url?: string
  }
  if (!response.ok) {
    throw new Error(payload.error || 'Copilot agent failed to start')
  }
  return {
    mode: 'copilot-sdk',
    instruction,
    url: payload.url,
    message: payload.url
      ? `Started Copilot agent session ${payload.sessionId ?? ''}`.trim()
      : `Started local Copilot agent session${payload.sessionId ? ` ${payload.sessionId}` : ''}.`,
  }
}
