import { defaultGoogleClientId, defaultMicrosoftClientId } from './cloudCredentials'

export interface OAuthAppConfig {
  microsoftClientId: string
  googleClientId: string
}

let cached: Promise<OAuthAppConfig> | null = null

export function loadOAuthAppConfig(): Promise<OAuthAppConfig> {
  if (!cached) cached = fetchOAuthAppConfig()
  return cached
}

async function fetchOAuthAppConfig(): Promise<OAuthAppConfig> {
  try {
    const response = await fetch('/api/oauth/config')
    if (response.ok) {
      const body = (await response.json()) as Partial<OAuthAppConfig>
      return {
        microsoftClientId: body.microsoftClientId?.trim() || defaultMicrosoftClientId(),
        googleClientId: body.googleClientId?.trim() || defaultGoogleClientId(),
      }
    }
  } catch {
    /* fall through */
  }
  return {
    microsoftClientId: defaultMicrosoftClientId(),
    googleClientId: defaultGoogleClientId(),
  }
}

export async function resolveMicrosoftClientId(explicit?: string): Promise<string> {
  if (explicit?.trim()) return explicit.trim()
  const config = await loadOAuthAppConfig()
  return config.microsoftClientId
}

export async function resolveGoogleClientId(explicit?: string): Promise<string> {
  if (explicit?.trim()) return explicit.trim()
  const config = await loadOAuthAppConfig()
  return config.googleClientId
}
