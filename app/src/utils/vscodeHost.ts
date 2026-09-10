/** Bridge to the VS Code extension host when this app runs in a webview. */

export interface VsCodeAgentRequest {
  instruction: string
  systemLabel: string
  gitPath?: string
  gitRepo?: string
  apply?: boolean
  changeKind?: 'new' | 'update' | 'retire'
}

type HostMessage =
  | { type: 'setDocument'; json: string }
  | { type: 'instructionResult'; requestId: string; text?: string; error?: string }

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
    }
  | { type: 'openPath'; path: string }
  | { type: 'generateInstruction'; requestId: string; prompt: string; context: string }

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
