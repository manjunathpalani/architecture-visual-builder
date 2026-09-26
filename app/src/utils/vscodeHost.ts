/** Bridge to the VS Code extension host when this app runs in a webview. */

export interface VsCodeAgentRequest {
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

export interface AiApiHostResult {
  status: number
  payload: unknown
}

type HostMessage =
  | { type: 'setDocument'; json: string }
  | { type: 'instructionResult'; requestId: string; text?: string; error?: string }
  | { type: 'aiApiResult'; requestId: string; status: number; payload: unknown }
  | { type: 'pickJsonResult'; requestId: string; json?: string; error?: string; cancelled?: boolean }
  | {
      type: 'workspaceScanResult'
      requestId: string
      files?: Array<{ path: string; systemId?: string; systemLabel?: string; excerpt?: string }>
      notes?: string[]
      error?: string
    }

type ClientMessage =
  | { type: 'ready' }
  | { type: 'saveDocument'; json: string }
  | {
      type: 'runAgent'
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
  | { type: 'openPath'; path: string }
  | { type: 'generateInstruction'; requestId: string; prompt: string; context: string }
  | { type: 'aiApi'; requestId: string; path: string; body?: Record<string, unknown> }
  | { type: 'pickJsonFile'; requestId: string }
  | {
      type: 'scanWorkspace'
      requestId: string
      roots: Array<{ label: string; path?: string; systemId?: string }>
    }

interface VsCodeApi {
  postMessage(message: ClientMessage): void
  getState(): unknown
  setState(state: unknown): void
}

let api: VsCodeApi | null | undefined
const pendingInstructions = new Map<
  string,
  { resolve: (text: string) => void; reject: (err: Error) => void }
>()
const pendingAi = new Map<
  string,
  { resolve: (result: AiApiHostResult) => void; reject: (err: Error) => void }
>()
const pendingPicks = new Map<
  string,
  { resolve: (json: string | null) => void; reject: (err: Error) => void }
>()
const pendingScans = new Map<
  string,
  {
    resolve: (result: {
      files: Array<{ path: string; systemId?: string; systemLabel?: string; excerpt?: string }>
      notes: string[]
    }) => void
    reject: (err: Error) => void
  }
>()
const listeners = new Set<(message: HostMessage) => void>()
let listening = false

export function getVsCodeApi(): VsCodeApi | null {
  if (api !== undefined) return api
  try {
    const acquire = (window as unknown as { acquireVsCodeApi?: () => VsCodeApi }).acquireVsCodeApi
    api = typeof acquire === 'function' ? acquire() : null
  } catch {
    api = null
  }
  return api
}

export function isVsCodeHost(): boolean {
  return Boolean(getVsCodeApi())
}

function ensureListen() {
  if (listening) return
  listening = true
  window.addEventListener('message', (event: MessageEvent<HostMessage>) => {
    const data = event.data
    if (!data || typeof data !== 'object' || typeof (data as HostMessage).type !== 'string') return
    if (data.type === 'instructionResult') {
      const pending = pendingInstructions.get(data.requestId)
      if (!pending) return
      pendingInstructions.delete(data.requestId)
      if (data.error) pending.reject(new Error(data.error))
      else pending.resolve(data.text?.trim() || '')
      return
    }
    if (data.type === 'aiApiResult') {
      const pending = pendingAi.get(data.requestId)
      if (!pending) return
      pendingAi.delete(data.requestId)
      pending.resolve({ status: data.status, payload: data.payload })
      return
    }
    if (data.type === 'workspaceScanResult') {
      const pending = pendingScans.get(data.requestId)
      if (!pending) return
      pendingScans.delete(data.requestId)
      if (data.error) pending.reject(new Error(data.error))
      else pending.resolve({ files: data.files ?? [], notes: data.notes ?? [] })
      return
    }
    if (data.type === 'pickJsonResult') {
      const pending = pendingPicks.get(data.requestId)
      if (!pending) return
      pendingPicks.delete(data.requestId)
      if (data.error) pending.reject(new Error(data.error))
      else pending.resolve(data.cancelled ? null : data.json ?? null)
      return
    }
    listeners.forEach((listener) => listener(data))
  })
}

export function subscribeToHost(listener: (message: HostMessage) => void): () => void {
  ensureListen()
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function notifyHostReady() {
  getVsCodeApi()?.postMessage({ type: 'ready' })
}

export function saveDocumentToHost(json: string) {
  getVsCodeApi()?.postMessage({ type: 'saveDocument', json })
}

export function runLinkedAgent(request: VsCodeAgentRequest) {
  getVsCodeApi()?.postMessage({ type: 'runAgent', ...request })
}

export function openPathInHost(path: string) {
  const trimmed = path.trim()
  if (!trimmed) return
  getVsCodeApi()?.postMessage({ type: 'openPath', path: trimmed })
}

export function callAiApi(path: string, body?: Record<string, unknown>): Promise<AiApiHostResult> {
  const vscode = getVsCodeApi()
  if (!vscode) return Promise.reject(new Error('Not running inside VS Code'))
  ensureListen()
  const requestId = crypto.randomUUID()
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      pendingAi.delete(requestId)
      reject(new Error('VS Code AI request timed out'))
    }, 180000)
    pendingAi.set(requestId, {
      resolve: (result) => {
        window.clearTimeout(timer)
        resolve(result)
      },
      reject: (err) => {
        window.clearTimeout(timer)
        reject(err)
      },
    })
    vscode.postMessage({ type: 'aiApi', requestId, path, body })
  })
}

export function pickJsonFileFromHost(): Promise<string | null> {
  const vscode = getVsCodeApi()
  if (!vscode) return Promise.reject(new Error('Not running inside VS Code'))
  ensureListen()
  const requestId = crypto.randomUUID()
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      pendingPicks.delete(requestId)
      reject(new Error('VS Code file picker timed out'))
    }, 300000)
    pendingPicks.set(requestId, {
      resolve: (json) => {
        window.clearTimeout(timer)
        resolve(json)
      },
      reject: (err) => {
        window.clearTimeout(timer)
        reject(err)
      },
    })
    vscode.postMessage({ type: 'pickJsonFile', requestId })
  })
}

export function scanWorkspaceCode(
  roots: Array<{ label: string; path?: string; systemId?: string }>,
): Promise<{
  files: Array<{ path: string; systemId?: string; systemLabel?: string; excerpt?: string }>
  notes: string[]
}> {
  const vscode = getVsCodeApi()
  if (!vscode) return Promise.reject(new Error('Not running inside VS Code'))
  ensureListen()
  const requestId = crypto.randomUUID()
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      pendingScans.delete(requestId)
      reject(new Error('VS Code workspace scan timed out'))
    }, 120000)
    pendingScans.set(requestId, {
      resolve: (result) => {
        window.clearTimeout(timer)
        resolve(result)
      },
      reject: (err) => {
        window.clearTimeout(timer)
        reject(err)
      },
    })
    vscode.postMessage({ type: 'scanWorkspace', requestId, roots })
  })
}

export function generateInstructionViaHost(prompt: string, context: string): Promise<string> {
  const vscode = getVsCodeApi()
  if (!vscode) return Promise.reject(new Error('Not running inside VS Code'))
  ensureListen()
  const requestId = crypto.randomUUID()
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      pendingInstructions.delete(requestId)
      reject(new Error('VS Code language model timed out'))
    }, 120000)
    pendingInstructions.set(requestId, {
      resolve: (text) => {
        window.clearTimeout(timer)
        resolve(text)
      },
      reject: (err) => {
        window.clearTimeout(timer)
        reject(err)
      },
    })
    vscode.postMessage({ type: 'generateInstruction', requestId, prompt, context })
  })
}
