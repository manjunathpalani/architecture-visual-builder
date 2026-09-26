import { callAiApi, isVsCodeHost } from './vscodeHost'

export async function aiFetch(
  path: 'status' | 'verify' | 'diagram' | 'analyze' | 'impact' | 'instruct' | 'requirements' | 'sad' | 'testplan',
  init?: { method?: string; body?: string },
): Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }> {
  if (isVsCodeHost()) {
    const body = init?.body ? (JSON.parse(init.body) as Record<string, unknown>) : undefined
    const result = await callAiApi(path, body)
    return {
      ok: result.status >= 200 && result.status < 300,
      status: result.status,
      json: async () => result.payload,
    }
  }

  const response = await fetch(`/api/ai/${path}`, {
    method: init?.method ?? (path === 'status' ? 'GET' : 'POST'),
    headers: { 'Content-Type': 'application/json' },
    body: init?.body,
  })
  return response
}

export function aiUnreachableMessage(): string {
  return isVsCodeHost()
    ? 'Could not reach the VS Code AI proxy. Reload the Architecture Visual Builder window and try again.'
    : 'Could not reach the AI proxy. Run the app with npm run dev.'
}
