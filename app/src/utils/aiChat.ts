import type { AiImage } from './aiImage'
import type { AiPlacement } from './aiDiagram'

export const AI_CHAT_WELCOME =
  'Hi — I can draw an architecture from a description or a screenshot, then keep refining it in this chat. Tell me what to design, or pick a starter below.'

export interface AiChatMessage {
  id: string
  role: 'user' | 'assistant'
  text: string
  images?: AiImage[]
  error?: boolean
}

export interface AiChatSession {
  messages: AiChatMessage[]
  placement: AiPlacement
  useContext: boolean
  draft?: string
  updatedAt: string
}

const STORAGE_KEY = 'architecture-visual-builder-ai-chat'
const MAX_MESSAGES = 60

export function defaultAiChatSession(): AiChatSession {
  return {
    messages: [{ id: 'welcome', role: 'assistant', text: AI_CHAT_WELCOME }],
    placement: 'new-tab',
    useContext: false,
    draft: '',
    updatedAt: new Date().toISOString(),
  }
}

function isPlacement(value: unknown): value is AiPlacement {
  return value === 'new-tab' || value === 'replace' || value === 'merge'
}

function capMessages(messages: AiChatMessage[]): AiChatMessage[] {
  if (messages.length <= MAX_MESSAGES) return messages
  const welcome = messages.find((message) => message.id === 'welcome')
  const rest = messages.filter((message) => message.id !== 'welcome').slice(-(MAX_MESSAGES - 1))
  return welcome ? [welcome, ...rest] : rest
}

export function loadAiChatSession(): AiChatSession {
  const fallback = defaultAiChatSession()
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return fallback
    const parsed = JSON.parse(raw) as Partial<AiChatSession>
    if (!Array.isArray(parsed.messages) || parsed.messages.length === 0) return fallback
    const messages = parsed.messages.filter(
      (message): message is AiChatMessage =>
        Boolean(message) &&
        (message.role === 'user' || message.role === 'assistant') &&
        typeof message.text === 'string' &&
        typeof message.id === 'string',
    )
    if (messages.length === 0) return fallback
    return {
      messages: capMessages(messages),
      placement: isPlacement(parsed.placement) ? parsed.placement : 'new-tab',
      useContext: Boolean(parsed.useContext),
      draft: typeof parsed.draft === 'string' ? parsed.draft : '',
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : fallback.updatedAt,
    }
  } catch {
    return fallback
  }
}

export function saveAiChatSession(session: Omit<AiChatSession, 'updatedAt'> & { updatedAt?: string }) {
  const payload: AiChatSession = {
    messages: capMessages(session.messages),
    placement: session.placement,
    useContext: session.useContext,
    draft: session.draft ?? '',
    updatedAt: new Date().toISOString(),
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
    return
  } catch {
    /* quota — retry without image payloads */
  }
  try {
    const stripped: AiChatSession = {
      ...payload,
      messages: payload.messages.map((message) => ({
        id: message.id,
        role: message.role,
        text: message.text,
        error: message.error,
      })),
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stripped))
  } catch {
    /* ignore quota */
  }
}

export function clearAiChatSession(): AiChatSession {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* ignore */
  }
  return defaultAiChatSession()
}

export function chatHasHistory(messages: AiChatMessage[]): boolean {
  return messages.some((message) => message.id !== 'welcome')
}
