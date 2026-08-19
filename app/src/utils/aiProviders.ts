export type AiProviderId = 'spacexai' | 'openai' | 'anthropic' | 'gemini' | 'azure-openai'

export interface AiProviderInfo {
  id: AiProviderId
  label: string
  shortLabel: string
  recommended?: boolean
  description: string
  keyLabel: string
  keyPlaceholder: string
  keyUrl: string
  envKey: string
  defaultModel: string
  extraFields?: Array<{
    id: 'endpoint' | 'deployment'
    label: string
    placeholder: string
  }>
}

export interface AiProviderStatus {
  id: AiProviderId
  label: string
  model: string
  configured: boolean
  recommended?: boolean
}

export interface AiStatus {
  available: boolean
  defaultProvider: AiProviderId
  providers: AiProviderStatus[]
}

export interface StoredAiSettings {
  selectedProvider: AiProviderId
  keys: Partial<Record<AiProviderId, string>>
  azureEndpoint?: string
  azureDeployment?: string
}

const STORAGE_KEY = 'architecture-visual-builder-ai'
const LEGACY_XAI_KEY = 'architecture-visual-builder-xai'

export const AI_PROVIDERS: AiProviderInfo[] = [
  {
    id: 'spacexai',
    label: 'SpaceXAI (Grok)',
    shortLabel: 'SpaceXAI',
    recommended: true,
    description: 'Default engine. Grok 4.6 via api.x.ai.',
    keyLabel: 'SpaceXAI API key',
    keyPlaceholder: 'xai-... from console.x.ai',
    keyUrl: 'https://console.x.ai',
    envKey: 'XAI_API_KEY',
    defaultModel: 'grok-4.6',
  },
  {
    id: 'openai',
    label: 'OpenAI',
    shortLabel: 'OpenAI',
    description: 'GPT models via api.openai.com.',
    keyLabel: 'OpenAI API key',
    keyPlaceholder: 'sk-... from platform.openai.com',
    keyUrl: 'https://platform.openai.com/api-keys',
    envKey: 'OPENAI_API_KEY',
    defaultModel: 'gpt-4o',
  },
  {
    id: 'anthropic',
    label: 'Anthropic (Claude)',
    shortLabel: 'Anthropic',
    description: 'Claude models via api.anthropic.com.',
    keyLabel: 'Anthropic API key',
    keyPlaceholder: 'sk-ant-... from console.anthropic.com',
    keyUrl: 'https://console.anthropic.com/settings/keys',
    envKey: 'ANTHROPIC_API_KEY',
    defaultModel: 'claude-sonnet-4-5',
  },
  {
    id: 'gemini',
    label: 'Google Gemini',
    shortLabel: 'Gemini',
    description: 'Gemini models via Google AI Studio.',
    keyLabel: 'Google AI API key',
    keyPlaceholder: 'AIza... from aistudio.google.com',
    keyUrl: 'https://aistudio.google.com/apikey',
    envKey: 'GEMINI_API_KEY',
    defaultModel: 'gemini-2.5-flash',
  },
  {
    id: 'azure-openai',
    label: 'Azure OpenAI',
    shortLabel: 'Azure OpenAI',
    description: 'Your Azure OpenAI resource, deployment, and key.',
    keyLabel: 'Azure OpenAI key',
    keyPlaceholder: 'Azure resource key',
    keyUrl: 'https://portal.azure.com',
    envKey: 'AZURE_OPENAI_API_KEY',
    defaultModel: 'gpt-4o',
    extraFields: [
      { id: 'endpoint', label: 'Endpoint', placeholder: 'https://your-resource.openai.azure.com' },
      { id: 'deployment', label: 'Deployment name', placeholder: 'gpt-4o' },
    ],
  },
]

export function getProvider(id: AiProviderId): AiProviderInfo {
  return AI_PROVIDERS.find((p) => p.id === id) ?? AI_PROVIDERS[0]
}

export function loadAiSettings(): StoredAiSettings {
  const empty: StoredAiSettings = { selectedProvider: 'spacexai', keys: {} }
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as StoredAiSettings
      return {
        selectedProvider: parsed.selectedProvider ?? 'spacexai',
        keys: parsed.keys ?? {},
        azureEndpoint: parsed.azureEndpoint,
        azureDeployment: parsed.azureDeployment,
      }
    }
    const legacy = localStorage.getItem(LEGACY_XAI_KEY)?.trim()
    if (legacy) {
      const migrated = { selectedProvider: 'spacexai' as const, keys: { spacexai: legacy } }
      saveAiSettings(migrated)
      localStorage.removeItem(LEGACY_XAI_KEY)
      return migrated
    }
  } catch {
    /* ignore */
  }
  return empty
}

export function saveAiSettings(settings: StoredAiSettings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  } catch {
    /* ignore */
  }
}

export function getUserProviderKey(id: AiProviderId): string {
  return loadAiSettings().keys[id]?.trim() ?? ''
}

export function updateAiSettings(patch: Partial<StoredAiSettings>) {
  const current = loadAiSettings()
  saveAiSettings({
    ...current,
    ...patch,
    keys: { ...current.keys, ...patch.keys },
  })
}

export function countSavedKeys(): number {
  const settings = loadAiSettings()
  return Object.values(settings.keys).filter((value) => Boolean(value?.trim())).length
}
