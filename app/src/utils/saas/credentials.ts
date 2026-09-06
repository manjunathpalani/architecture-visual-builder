import type { SaasConnection, SaasProviderId } from './types'

const STORAGE_KEY = 'architecture-visual-builder-saas'

type StoredSaas = Partial<Record<SaasProviderId, SaasConnection>>

function load(): StoredSaas {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as StoredSaas) : {}
  } catch {
    return {}
  }
}

function save(data: StoredSaas) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}

export function getSaasConnection(provider: SaasProviderId): SaasConnection | null {
  return load()[provider] ?? null
}

export function setSaasConnection(provider: SaasProviderId, connection: SaasConnection | null) {
  const data = load()
  if (connection) data[provider] = connection
  else delete data[provider]
  save(data)
}

export function saasTokenValid(connection: SaasConnection | null): boolean {
  if (!connection?.accessToken) return false
  if (!connection.expiresAt) return true
  return connection.expiresAt > Date.now() + 15_000
}
