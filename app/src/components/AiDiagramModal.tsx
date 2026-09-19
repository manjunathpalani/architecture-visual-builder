import { useEffect, useRef, useState } from 'react'
import { Check, ImagePlus, KeyRound, Loader2, Plus, Send, Sparkles, X } from 'lucide-react'
import type { ArchitectureDocument } from '../types'
import {
  AI_PROVIDERS,
  getProvider,
  isEngineReady,
  loadAiSettings,
  saveAiSettings,
  type AiKeyTest,
  type AiProviderId,
} from '../utils/aiProviders'
import {
  AI_PROMPT_EXAMPLES,
  buildAiChatContext,
  fetchAiStatus,
  generateArchitectureFromPrompt,
  verifyAiKey,
  type AiPlacement,
  type AiStatus,
} from '../utils/aiDiagram'
import { filesToAiImages, type AiImage } from '../utils/aiImage'
import {
  chatHasHistory,
  clearAiChatSession,
  loadAiChatSession,
  saveAiChatSession,
  type AiChatMessage,
} from '../utils/aiChat'

interface AiDiagramModalProps {
  open: boolean
  currentDocument: ArchitectureDocument
  onGenerate: (document: ArchitectureDocument, placement: AiPlacement) => void
  onManageKeys: () => void
  onClose: () => void
}

function newId() {
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

export function AiDiagramModal({
  open,
  currentDocument,
  onGenerate,
  onManageKeys,
  onClose,
}: AiDiagramModalProps) {
  const initial = loadAiSettings()
  const [storedChat] = useState<ReturnType<typeof loadAiChatSession>>(() => loadAiChatSession())
  const [prompt, setPrompt] = useState(storedChat.draft ?? '')
  const [placement, setPlacement] = useState<AiPlacement>(storedChat.placement)
  const [useContext, setUseContext] = useState(storedChat.useContext)
  const [provider, setProvider] = useState<AiProviderId>(initial.selectedProvider)
  const [userKey, setUserKey] = useState(initial.keys[initial.selectedProvider] ?? '')
  const [azureEndpoint, setAzureEndpoint] = useState(initial.azureEndpoint ?? '')
  const [azureDeployment, setAzureDeployment] = useState(initial.azureDeployment ?? '')
  const [status, setStatus] = useState<AiStatus | null>(null)
  const [images, setImages] = useState<AiImage[]>([])
  const [imageBusy, setImageBusy] = useState(false)
  const [loading, setLoading] = useState(false)
  const [keyTest, setKeyTest] = useState<AiKeyTest | undefined>(
    initial.keyTests?.[initial.selectedProvider],
  )
  const [testingKey, setTestingKey] = useState(false)
  const [messages, setMessages] = useState<AiChatMessage[]>(storedChat.messages)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    void fetchAiStatus().then(setStatus)
  }, [])

  useEffect(() => {
    saveAiChatSession({
      messages,
      placement,
      useContext,
      draft: prompt,
    })
  }, [messages, placement, useContext, prompt])

  useEffect(() => {
    const node = listRef.current
    if (!node) return
    node.scrollTop = node.scrollHeight
  }, [messages, loading])

  const info = getProvider(provider)
  const serverReady = Boolean(status?.providers.find((p) => p.id === provider)?.configured)
  const hasKey = isEngineReady(provider, status) || Boolean(userKey.trim())
  const hasAzureBits =
    provider !== 'azure-openai' ||
    (Boolean(azureEndpoint.trim()) && Boolean(azureDeployment.trim())) ||
    serverReady
  const canSend =
    (prompt.trim().length > 0 || images.length > 0) &&
    !loading &&
    !testingKey &&
    !imageBusy &&
    Boolean(status?.available) &&
    hasKey &&
    hasAzureBits

  const persistProvider = (next: AiProviderId) => {
    const settings = loadAiSettings()
    const nextSettings = {
      ...settings,
      selectedProvider: next,
      keys: { ...settings.keys, [provider]: userKey },
      azureEndpoint,
      azureDeployment,
    }
    saveAiSettings(nextSettings)
    setProvider(next)
    setUserKey(nextSettings.keys[next] ?? '')
    setKeyTest(nextSettings.keyTests?.[next])
  }

  const persistKeys = async (): Promise<{ ok: true } | { ok: false; message: string }> => {
    const settings = loadAiSettings()
    const trimmed = userKey.trim()
    if (!trimmed) {
      saveAiSettings({
        ...settings,
        selectedProvider: provider,
        azureEndpoint,
        azureDeployment,
      })
      return { ok: true }
    }

    const alreadyGood =
      settings.keys[provider] === trimmed && settings.keyTests?.[provider]?.ok === true
    if (alreadyGood) {
      saveAiSettings({
        ...settings,
        selectedProvider: provider,
        azureEndpoint,
        azureDeployment,
      })
      return { ok: true }
    }

    setTestingKey(true)
    const result = await verifyAiKey({
      provider,
      apiKey: trimmed,
      azureEndpoint,
      azureDeployment,
    })
    setTestingKey(false)

    const test: AiKeyTest = {
      ok: result.ok,
      message: result.message,
      testedAt: new Date().toISOString(),
      source: result.source,
    }
    setKeyTest(test)

    if (!result.ok) return { ok: false, message: result.message }

    saveAiSettings({
      ...settings,
      selectedProvider: provider,
      keys: { ...settings.keys, [provider]: trimmed },
      azureEndpoint,
      azureDeployment,
      keyTests: { ...settings.keyTests, [provider]: test },
    })
    return { ok: true }
  }

  const addFiles = async (files: File[]) => {
    if (files.length === 0) return
    setImageBusy(true)
    try {
      const next = await filesToAiImages(files)
      setImages((prev) => [...prev, ...next].slice(0, 4))
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: newId(),
          role: 'assistant',
          error: true,
          text: err instanceof Error ? err.message : 'Could not read the image',
        },
      ])
    } finally {
      setImageBusy(false)
    }
  }

  useEffect(() => {
    if (!open) return
    const onPaste = (event: ClipboardEvent) => {
      const files = Array.from(event.clipboardData?.files ?? []).filter((file) =>
        file.type.startsWith('image/'),
      )
      if (files.length === 0) return
      event.preventDefault()
      void addFiles(files)
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [open])

  useEffect(() => {
    if (!open) return
    const id = window.requestAnimationFrame(() => inputRef.current?.focus())
    return () => window.cancelAnimationFrame(id)
  }, [open])

  const sendPrompt = async (raw: string, attached: AiImage[]) => {
    const text = raw.trim()
    if ((!text && attached.length === 0) || loading) return

    const userMessage: AiChatMessage = {
      id: newId(),
      role: 'user',
      text: text || 'Recreate the attached image as an architecture diagram.',
      images: attached.length ? attached : undefined,
    }

    const history = [...messages, userMessage]
    setMessages(history)
    setPrompt('')
    setImages([])
    setLoading(true)
    const keyResult = await persistKeys()
    if (!keyResult.ok) {
      setMessages((prev) => [
        ...prev,
        {
          id: newId(),
          role: 'assistant',
          error: true,
          text: keyResult.message,
        },
      ])
      setLoading(false)
      return
    }

    try {
      const context = buildAiChatContext(
        history.filter((message) => message.id !== 'welcome'),
        useContext ? currentDocument : undefined,
      )
      const document = await generateArchitectureFromPrompt(userMessage.text, context, provider, attached)
      onGenerate(document, placement)
      setUseContext(true)
      setPlacement((prev) => (prev === 'new-tab' ? 'replace' : prev))
      setMessages((prev) => [
        ...prev,
        {
          id: newId(),
          role: 'assistant',
          text: `Drew **${document.metadata.name}** — ${document.systems.length} systems and ${document.integrations.length} integrations. Ask me to add, remove, or rearrange anything.`,
        },
      ])
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: newId(),
          role: 'assistant',
          error: true,
          text: err instanceof Error ? err.message : 'Diagram generation failed',
        },
      ])
    } finally {
      setLoading(false)
      inputRef.current?.focus()
    }
  }

  const handleSubmit = () => {
    void sendPrompt(prompt, images)
  }

  const startNewChat = () => {
    if (loading) return
    const next = clearAiChatSession()
    setMessages(next.messages)
    setPlacement(next.placement)
    setUseContext(next.useContext)
    setPrompt('')
    setImages([])
    inputRef.current?.focus()
  }

  if (!open) return null

  const hasHistory = chatHasHistory(messages)

  return (
    <div className="swagger-overlay ai-chat-overlay" onClick={onClose}>
      <div className="ai-chat-panel" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Draw with AI chat">
        <div className="ai-chat-header">
          <div>
            <h2>
              <Sparkles size={18} />
              Draw with AI
            </h2>
            <p>Chat to design and refine the diagram · {info.shortLabel}</p>
          </div>
          <div className="ai-chat-header-actions">
            {hasHistory && (
              <button
                type="button"
                className="btn-secondary"
                onClick={startNewChat}
                disabled={loading}
                title="Start a new conversation"
              >
                <Plus size={14} />
                New chat
              </button>
            )}
            <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="ai-chat-toolbar">
          <label>
            Engine
            <select
              value={provider}
              onChange={(e) => persistProvider(e.target.value as AiProviderId)}
              disabled={loading}
            >
              {AI_PROVIDERS.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                  {item.recommended ? ' (recommended)' : ''}
                </option>
              ))}
            </select>
          </label>
          <label>
            Place
            <select
              value={placement}
              onChange={(e) => setPlacement(e.target.value as AiPlacement)}
              disabled={loading}
            >
              <option value="new-tab">New tab</option>
              <option value="replace">Replace canvas</option>
              <option value="merge">Add to canvas</option>
            </select>
          </label>
          <label className="ai-chat-context">
            <input
              type="checkbox"
              checked={useContext}
              onChange={(e) => setUseContext(e.target.checked)}
              disabled={loading}
            />
            Use current diagram
          </label>
        </div>

        <div className="ai-chat-messages" ref={listRef}>
          {messages.map((message) => (
            <div
              key={message.id}
              className={`ai-chat-bubble ${message.role}${message.error ? ' error' : ''}`}
            >
              {message.images && message.images.length > 0 && (
                <div className="ai-chat-thumbs">
                  {message.images.map((image, index) => (
                    <img key={`${image.name}-${index}`} src={image.dataUrl} alt={image.name} />
                  ))}
                </div>
              )}
              <p>{message.text.replace(/\*\*(.*?)\*\*/g, '$1')}</p>
            </div>
          ))}
          {loading && (
            <div className="ai-chat-bubble assistant pending">
              <Loader2 size={14} className="spin" />
              Drawing with {info.shortLabel}…
            </div>
          )}
          {messages.length === 1 && !loading && (
            <div className="ai-chat-suggestions">
              {AI_PROMPT_EXAMPLES.map((example) => (
                <button
                  key={example}
                  type="button"
                  className="ai-example-chip"
                  disabled={loading}
                  onClick={() => void sendPrompt(example, [])}
                >
                  {example}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="ai-chat-composer">
          {images.length > 0 && (
            <div className="ai-chat-pending-images">
              {images.map((image, index) => (
                <figure key={`${image.name}-${index}`}>
                  <img src={image.dataUrl} alt={image.name} />
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label={`Remove ${image.name}`}
                    disabled={loading}
                    onClick={() => setImages((prev) => prev.filter((_, i) => i !== index))}
                  >
                    <X size={12} />
                  </button>
                </figure>
              ))}
            </div>
          )}
          <div
            className="ai-chat-input-row"
            onDragOver={(e) => {
              e.preventDefault()
              e.dataTransfer.dropEffect = 'copy'
            }}
            onDrop={(e) => {
              e.preventDefault()
              void addFiles(Array.from(e.dataTransfer.files))
            }}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              multiple
              hidden
              onChange={(e) => {
                void addFiles(Array.from(e.target.files ?? []))
                e.target.value = ''
              }}
            />
            <button
              type="button"
              className="icon-btn"
              title="Attach image"
              disabled={loading || imageBusy || images.length >= 4}
              onClick={() => fileInputRef.current?.click()}
            >
              <ImagePlus size={16} />
            </button>
            <textarea
              ref={inputRef}
              className="ai-chat-input"
              rows={2}
              placeholder="Describe the architecture, or ask for a change…"
              value={prompt}
              disabled={loading}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleSubmit()
                }
              }}
            />
            <button
              type="button"
              className="btn-primary ai-chat-send"
              disabled={!canSend}
              onClick={handleSubmit}
            >
              {loading ? <Loader2 size={15} className="spin" /> : <Send size={15} />}
              Send
            </button>
          </div>
          <div className="ai-chat-footer">
            {status?.available ? (
              <span>
                {serverReady
                  ? `Using server ${info.shortLabel} key`
                  : `Add a ${info.shortLabel} key below or in AI Engines`}
                {' · '}
                {status.providers.find((p) => p.id === provider)?.model ?? info.defaultModel}
              </span>
            ) : (
              <span>Start the app with npm run dev so the AI proxy can run.</span>
            )}
            <button type="button" className="btn-secondary" onClick={onManageKeys} disabled={loading}>
              <KeyRound size={13} />
              Settings
            </button>
          </div>
          {status?.available && !serverReady && (
            <>
            <div className="ai-chat-key-row">
              <input
                type="password"
                autoComplete="off"
                placeholder={info.keyPlaceholder}
                value={userKey}
                onChange={(e) => {
                  setUserKey(e.target.value)
                  setKeyTest(undefined)
                }}
                disabled={loading || testingKey}
              />
              {provider === 'azure-openai' && (
                <>
                  <input
                    placeholder="Azure endpoint"
                    value={azureEndpoint}
                    onChange={(e) => setAzureEndpoint(e.target.value)}
                    disabled={loading || testingKey}
                  />
                  <input
                    placeholder="Deployment"
                    value={azureDeployment}
                    onChange={(e) => setAzureDeployment(e.target.value)}
                    disabled={loading || testingKey}
                  />
                </>
              )}
              <button
                type="button"
                className="btn-secondary"
                disabled={loading || testingKey || !userKey.trim()}
                onClick={() => void persistKeys()}
              >
                {testingKey ? <Loader2 size={13} className="spin" /> : <Check size={13} />}
                {testingKey ? 'Testing…' : 'Test & save'}
              </button>
            </div>
            {keyTest && (
              <p className={`ai-key-status ${keyTest.ok ? 'ok' : 'err'}`}>
                {keyTest.ok ? <Check size={13} /> : <X size={13} />}
                {keyTest.message}
              </p>
            )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
