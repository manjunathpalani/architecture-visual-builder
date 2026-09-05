import { oauthRedirectUri, pkceChallenge, randomUrlString } from './pkce'
import {
  setGoogleTokens,
  setMicrosoftTokens,
  type CloudAccountProvider,
  type CloudOAuthTokens,
} from './cloudCredentials'

const SESSION_KEY = 'avb-oauth-pending'
const MESSAGE_TYPE = 'avb-oauth-callback'

interface PendingOAuth {
  provider: CloudAccountProvider
  verifier: string
  state: string
  clientId: string
  extraScopes?: string[]
}

export class CloudApiError extends Error {
  status: number
  constructor(message: string, status = 400) {
    super(message)
    this.status = status
  }
}

export function isOAuthCallbackLocation(): boolean {
  const path = window.location.pathname.replace(/\/+$/, '') || '/'
  return path === '/oauth/callback'
}

export function handleOAuthPopupCallback(): boolean {
  if (typeof window === 'undefined') return false
  if (!isOAuthCallbackLocation()) return false
  const params = new URLSearchParams(window.location.search)
  if (!params.get('code') && !params.get('error') && !params.get('error_description')) return false
  const payload = {
    type: MESSAGE_TYPE,
    code: params.get('code'),
    state: params.get('state'),
    error: params.get('error') || params.get('error_description'),
  }
  try {
    const opener = window.opener as Window | null
    if (opener && !opener.closed) {
      opener.postMessage(payload, window.location.origin)
      window.close()
      return true
    }
  } catch {
    return false
  }
  return false
}

export async function signInWithMicrosoft(clientId: string): Promise<CloudOAuthTokens> {
  const id = clientId.trim()
  if (!id) throw new CloudApiError('Enter a Microsoft application (client) ID first.')
  const tokens = await runOAuthPopup({
    provider: 'microsoft',
    clientId: id,
    authorizeUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    tokenUrl: '/api/ms-oauth/common/oauth2/v2.0/token',
    scopes: [
      'openid',
      'profile',
      'email',
      'offline_access',
      'User.Read',
      'Files.ReadWrite',
      'Sites.Read.All',
    ],
  })
  setMicrosoftTokens(tokens)
  return tokens
}

export async function signInWithGoogle(clientId: string, includeGcs = false): Promise<CloudOAuthTokens> {
  const id = clientId.trim()
  if (!id) throw new CloudApiError('Enter a Google OAuth client ID first.')
  const scopes = [
    'openid',
    'email',
    'profile',
    'https://www.googleapis.com/auth/drive.file',
  ]
  if (includeGcs) scopes.push('https://www.googleapis.com/auth/devstorage.read_write')
  const tokens = await runOAuthPopup({
    provider: 'google',
    clientId: id,
    authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: '/api/google-oauth/token',
    scopes,
    extraParams: { access_type: 'offline', prompt: 'consent' },
  })
  setGoogleTokens(tokens)
  return tokens
}

async function runOAuthPopup(options: {
  provider: CloudAccountProvider
  clientId: string
  authorizeUrl: string
  tokenUrl: string
  scopes: string[]
  extraParams?: Record<string, string>
}): Promise<CloudOAuthTokens> {
  const verifier = randomUrlString(32)
  const challenge = await pkceChallenge(verifier)
  const nonce = randomUrlString(16)
  const state = `${options.provider}.${nonce}`
  const redirectUri = oauthRedirectUri()
  const pending: PendingOAuth = {
    provider: options.provider,
    verifier,
    state,
    clientId: options.clientId,
    extraScopes: options.scopes,
  }
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(pending))

  const url = new URL(options.authorizeUrl)
  url.searchParams.set('client_id', options.clientId)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('redirect_uri', redirectUri)
  url.searchParams.set('scope', options.scopes.join(' '))
  url.searchParams.set('state', state)
  url.searchParams.set('code_challenge', challenge)
  url.searchParams.set('code_challenge_method', 'S256')
  if (options.provider === 'microsoft') url.searchParams.set('response_mode', 'query')
  Object.entries(options.extraParams ?? {}).forEach(([key, value]) => url.searchParams.set(key, value))

  const popup = window.open(url.toString(), 'avb-oauth', 'width=480,height=720,menubar=no,toolbar=no')
  const code = await waitForOAuthCode(popup, state)
  const tokens = await exchangeCode({
    tokenUrl: options.tokenUrl,
    clientId: options.clientId,
    code,
    verifier,
    redirectUri,
  })
  sessionStorage.removeItem(SESSION_KEY)
  return {
    ...tokens,
    clientId: options.clientId,
    scopes: options.scopes,
  }
}

function waitForOAuthCode(popup: Window | null, expectedState: string): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!popup) {
      reject(new CloudApiError('Sign-in popup was blocked. Allow popups for this site and try again.'))
      return
    }
    const timer = window.setInterval(() => {
      if (popup.closed) {
        cleanup()
        reject(new CloudApiError('Sign-in was cancelled.'))
      }
    }, 500)
    const timeout = window.setTimeout(() => {
      cleanup()
      popup.close()
      reject(new CloudApiError('Sign-in timed out. Try again.'))
    }, 5 * 60 * 1000)
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return
      const data = event.data as { type?: string; code?: string | null; state?: string | null; error?: string | null }
      if (data?.type !== MESSAGE_TYPE) return
      cleanup()
      popup.close()
      if (data.error) {
        reject(new CloudApiError(data.error))
        return
      }
      if (!data.code || data.state !== expectedState) {
        reject(new CloudApiError('Sign-in did not return a valid authorization code.'))
        return
      }
      resolve(data.code)
    }
    const cleanup = () => {
      window.clearInterval(timer)
      window.clearTimeout(timeout)
      window.removeEventListener('message', onMessage)
    }
    window.addEventListener('message', onMessage)
  })
}

async function exchangeCode(options: {
  tokenUrl: string
  clientId: string
  code: string
  verifier: string
  redirectUri: string
}): Promise<CloudOAuthTokens> {
  const body = new URLSearchParams({
    client_id: options.clientId,
    grant_type: 'authorization_code',
    code: options.code,
    redirect_uri: options.redirectUri,
    code_verifier: options.verifier,
  })
  const response = await fetch(options.tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  const payload = (await response.json().catch(() => ({}))) as Record<string, string>
  if (!response.ok || !payload.access_token) {
    throw new CloudApiError(payload.error_description || payload.error || 'Token exchange failed', response.status)
  }
  return {
    clientId: options.clientId,
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token,
    expiresAt: Date.now() + Number(payload.expires_in || 3600) * 1000,
  }
}

export async function refreshMicrosoftAccess(): Promise<string> {
  const { getMicrosoftTokens } = await import('./cloudCredentials')
  const current = getMicrosoftTokens()
  if (!current) throw new CloudApiError('Microsoft account is not connected', 401)
  if (current.expiresAt > Date.now() + 30_000) return current.accessToken
  if (!current.refreshToken) throw new CloudApiError('Microsoft session expired. Sign in again.', 401)
  const next = await refreshToken({
    tokenUrl: '/api/ms-oauth/common/oauth2/v2.0/token',
    clientId: current.clientId,
    refreshToken: current.refreshToken,
  })
  setMicrosoftTokens({ ...current, ...next })
  return next.accessToken
}

export async function refreshGoogleAccess(): Promise<string> {
  const { getGoogleTokens } = await import('./cloudCredentials')
  const current = getGoogleTokens()
  if (!current) throw new CloudApiError('Google account is not connected', 401)
  if (current.expiresAt > Date.now() + 30_000) return current.accessToken
  if (!current.refreshToken) throw new CloudApiError('Google session expired. Sign in again.', 401)
  const next = await refreshToken({
    tokenUrl: '/api/google-oauth/token',
    clientId: current.clientId,
    refreshToken: current.refreshToken,
  })
  setGoogleTokens({ ...current, ...next })
  return next.accessToken
}

async function refreshToken(options: {
  tokenUrl: string
  clientId: string
  refreshToken: string
}): Promise<Pick<CloudOAuthTokens, 'accessToken' | 'refreshToken' | 'expiresAt'>> {
  const body = new URLSearchParams({
    client_id: options.clientId,
    grant_type: 'refresh_token',
    refresh_token: options.refreshToken,
  })
  const response = await fetch(options.tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  const payload = (await response.json().catch(() => ({}))) as Record<string, string>
  if (!response.ok || !payload.access_token) {
    throw new CloudApiError(payload.error_description || 'Session expired. Sign in again.', response.status)
  }
  return {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token || options.refreshToken,
    expiresAt: Date.now() + Number(payload.expires_in || 3600) * 1000,
  }
}
