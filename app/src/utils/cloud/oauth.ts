import { oauthRedirectUri, pkceChallenge, randomUrlString } from './pkce'
import {
  getGoogleTokens,
  getMicrosoftTokens,
  setGoogleTokens,
  setMicrosoftTokens,
  type CloudAccountProvider,
  type CloudOAuthTokens,
} from './cloudCredentials'
import { resolveGoogleClientId, resolveMicrosoftClientId } from './oauthConfig'
import { getSaasConnection, setSaasConnection } from '../saas/credentials'
import { normalizeInstanceUrl } from '../saas/instanceUrl'

const SESSION_KEY = 'avb-oauth-pending'
const RESULT_KEY = 'avb-oauth-result'
const MESSAGE_TYPE = 'avb-oauth-callback'
const POPUP_FEATURES = 'width=520,height=740,scrollbars=yes,resizable=yes,status=yes,menubar=no,toolbar=no,location=yes'

interface PendingOAuth {
  provider: CloudAccountProvider
  verifier: string
  state: string
  clientId: string
  extraScopes?: string[]
  tokenUrl?: string
  authorizeUrl?: string
}

interface PreparedOAuth extends PendingOAuth {
  tokenUrl: string
  authorizeUrl: string
  scopes: string[]
}

const preparedLogins = new Map<CloudAccountProvider, PreparedOAuth>()

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
    at: Date.now(),
  }
  const isRedirect = sessionStorage.getItem(`${SESSION_KEY}-mode`) === 'redirect'
  try {
    const opener = window.opener as Window | null
    if (opener && !opener.closed) {
      opener.postMessage(payload, window.location.origin)
      window.close()
      return true
    }
  } catch {
    /* Cross-origin opener access can throw; fall through. */
  }
  if (isRedirect) return false
  try {
    localStorage.setItem(RESULT_KEY, JSON.stringify(payload))
  } catch {
    /* ignore */
  }
  window.close()
  return true
}

export function openSignInWindow(url = 'about:blank'): Window | null {
  let popup: Window | null = null
  try {
    popup = window.open(url, 'avb-oauth', POPUP_FEATURES)
  } catch {
    popup = null
  }
  if (!popup) {
    try {
      popup = window.open(url, 'avb-oauth')
    } catch {
      popup = null
    }
  }
  if (popup) {
    if (url === 'about:blank') {
      try {
        popup.document.open()
        popup.document.write(
          '<!doctype html><title>Sign in</title><p style="font-family:Segoe UI,sans-serif;padding:28px;color:#334155">Opening the sign-in page…</p>',
        )
        popup.document.close()
      } catch {
        /* ignore */
      }
    }
    try {
      popup.focus()
    } catch {
      /* ignore */
    }
  }
  return popup
}

export function peekPreparedLoginUrl(provider: CloudAccountProvider, clientId: string): string | null {
  const prepared = preparedLogins.get(provider)
  if (prepared && prepared.clientId === clientId.trim()) return prepared.authorizeUrl
  return null
}

export async function prefetchMicrosoftLogin(clientId?: string): Promise<string | null> {
  const id = (await resolveMicrosoftClientId(clientId)).trim()
  if (!id) return null
  const prepared = await createAuthorization({
    provider: 'microsoft',
    clientId: id,
    authorizeUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    tokenUrl: '/api/ms-oauth/common/oauth2/v2.0/token',
    scopes: microsoftScopes(),
    extraParams: { prompt: 'select_account' },
  })
  preparedLogins.set('microsoft', prepared)
  return prepared.authorizeUrl
}

export async function prefetchGoogleLogin(clientId?: string, includeGcs = false): Promise<string | null> {
  const id = (await resolveGoogleClientId(clientId)).trim()
  if (!id) return null
  const prepared = await createAuthorization({
    provider: 'google',
    clientId: id,
    authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: '/api/google-oauth/token',
    scopes: googleScopes(includeGcs),
    extraParams: { access_type: 'offline', prompt: 'select_account' },
  })
  preparedLogins.set('google', prepared)
  return prepared.authorizeUrl
}

export async function signInWithMicrosoft(clientId?: string, popup?: Window | null): Promise<CloudOAuthTokens> {
  const signInWindow = popup !== undefined ? popup : openSignInWindow()
  const id = (await resolveMicrosoftClientId(clientId)).trim()
  if (!id) {
    failInWindow(signInWindow, 'Microsoft sign-in needs an Azure app (client) ID once, then the Microsoft page can open.')
    throw new CloudApiError(
      'Enter an Azure app (client) ID, then Continue with Microsoft will open the Microsoft sign-in page.',
    )
  }
  const tokens = await runOAuthLogin({
    provider: 'microsoft',
    clientId: id,
    authorizeUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    tokenUrl: '/api/ms-oauth/common/oauth2/v2.0/token',
    scopes: microsoftScopes(),
    extraParams: { prompt: 'select_account' },
    popup: signInWindow,
    allowRedirect: true,
  })
  setMicrosoftTokens(tokens)
  return tokens
}

export async function signInWithDynamics(options: {
  clientId?: string
  instanceUrl: string
  tenant?: string
  popup?: Window | null
}): Promise<CloudOAuthTokens> {
  const instanceUrl = normalizeInstanceUrl(options.instanceUrl, 'dynamics')
  const signInWindow = options.popup !== undefined ? options.popup : openSignInWindow()
  const id = (await resolveMicrosoftClientId(options.clientId)).trim()
  if (!id) {
    failInWindow(signInWindow, 'Microsoft sign-in needs an Azure app (client) ID once, then the Microsoft page can open.')
    throw new CloudApiError(
      'Enter an Azure app (client) ID in Cloud storage, then Sign in with Microsoft will open the Microsoft sign-in page.',
    )
  }
  const tenant = options.tenant?.trim() || 'common'
  const tokens = await runOAuthLogin({
    provider: 'microsoft',
    clientId: id,
    authorizeUrl: `https://login.microsoftonline.com/${encodeURIComponent(tenant)}/oauth2/v2.0/authorize`,
    tokenUrl: `/api/ms-oauth/${encodeURIComponent(tenant)}/oauth2/v2.0/token`,
    scopes: [`${instanceUrl}/user_impersonation`, 'offline_access', 'openid', 'profile'],
    extraParams: { prompt: 'select_account' },
    popup: signInWindow,
    allowRedirect: true,
  })
  setSaasConnection('dynamics', {
    provider: 'dynamics',
    instanceUrl,
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    expiresAt: tokens.expiresAt,
    clientId: id,
    tenant,
  })
  return tokens
}

export async function refreshDynamicsAccess(): Promise<string> {
  const current = getSaasConnection('dynamics')
  if (!current) throw new CloudApiError('Dynamics 365 is not connected', 401)
  if (current.expiresAt && current.expiresAt > Date.now() + 30_000) return current.accessToken
  if (!current.refreshToken || !current.clientId) {
    throw new CloudApiError('Dynamics session expired. Sign in again.', 401)
  }
  const tenant = current.tenant || 'common'
  const next = await refreshToken({
    tokenUrl: `/api/ms-oauth/${encodeURIComponent(tenant)}/oauth2/v2.0/token`,
    clientId: current.clientId,
    refreshToken: current.refreshToken,
  })
  setSaasConnection('dynamics', {
    ...current,
    accessToken: next.accessToken,
    refreshToken: next.refreshToken ?? current.refreshToken,
    expiresAt: next.expiresAt,
  })
  return next.accessToken
}

export async function signInWithGoogle(
  clientId?: string,
  includeGcs = false,
  popup?: Window | null,
): Promise<CloudOAuthTokens> {
  const signInWindow = popup !== undefined ? popup : openSignInWindow()
  const id = (await resolveGoogleClientId(clientId)).trim()
  if (!id) {
    failInWindow(signInWindow, 'Google sign-in needs a Google OAuth client ID once, then the Google page can open.')
    throw new CloudApiError(
      'Enter a Google OAuth client ID, then Continue with Google will open the Google sign-in page.',
    )
  }
  const scopes = googleScopes(includeGcs)
  const tokens = await runOAuthLogin({
    provider: 'google',
    clientId: id,
    authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: '/api/google-oauth/token',
    scopes,
    extraParams: { access_type: 'offline', prompt: 'select_account' },
    popup: signInWindow,
    allowRedirect: true,
  })
  setGoogleTokens(tokens)
  return tokens
}

function microsoftScopes(): string[] {
  return [
    'openid',
    'profile',
    'email',
    'offline_access',
    'User.Read',
    'Files.ReadWrite',
    'Sites.Read.All',
  ]
}

function googleScopes(includeGcs: boolean): string[] {
  const scopes = ['openid', 'email', 'profile', 'https://www.googleapis.com/auth/drive.file']
  if (includeGcs) scopes.push('https://www.googleapis.com/auth/devstorage.read_write')
  return scopes
}

function failInWindow(popup: Window | null, message: string) {
  if (!popup || popup.closed) return
  try {
    popup.document.write(
      `<!doctype html><title>Sign in</title><p style="font-family:Segoe UI,sans-serif;padding:28px;color:#b91c1c">${message}</p>`,
    )
    popup.document.close()
  } catch {
    /* Already navigated cross-origin; leave the window alone. */
  }
}

function takePrepared(provider: CloudAccountProvider, clientId: string): PreparedOAuth | null {
  const prepared = preparedLogins.get(provider)
  if (!prepared || prepared.clientId !== clientId) return null
  preparedLogins.delete(provider)
  return prepared
}

async function createAuthorization(options: {
  provider: CloudAccountProvider
  clientId: string
  authorizeUrl: string
  tokenUrl: string
  scopes: string[]
  extraParams?: Record<string, string>
}): Promise<PreparedOAuth> {
  const verifier = randomUrlString(32)
  const challenge = await pkceChallenge(verifier)
  const nonce = randomUrlString(16)
  const state = `${options.provider}.${nonce}`
  const redirectUri = oauthRedirectUri()
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
  return {
    provider: options.provider,
    verifier,
    state,
    clientId: options.clientId,
    extraScopes: options.scopes,
    tokenUrl: options.tokenUrl,
    authorizeUrl: url.toString(),
    scopes: options.scopes,
  }
}

async function runOAuthLogin(options: {
  provider: CloudAccountProvider
  clientId: string
  authorizeUrl: string
  tokenUrl: string
  scopes: string[]
  extraParams?: Record<string, string>
  popup?: Window | null
  allowRedirect?: boolean
}): Promise<CloudOAuthTokens> {
  const prepared =
    takePrepared(options.provider, options.clientId) ??
    (await createAuthorization({
      provider: options.provider,
      clientId: options.clientId,
      authorizeUrl: options.authorizeUrl,
      tokenUrl: options.tokenUrl,
      scopes: options.scopes,
      extraParams: options.extraParams,
    }))
  const pending: PendingOAuth = {
    provider: prepared.provider,
    verifier: prepared.verifier,
    state: prepared.state,
    clientId: prepared.clientId,
    extraScopes: prepared.scopes,
    tokenUrl: prepared.tokenUrl,
    authorizeUrl: prepared.authorizeUrl,
  }
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(pending))
  try {
    localStorage.removeItem(RESULT_KEY)
  } catch {
    /* ignore */
  }

  const popup = options.popup && !options.popup.closed ? options.popup : null
  if (popup) {
    try {
      const href = popup.location.href
      if (!href || href === 'about:blank' || href.startsWith('about:')) {
        popup.location.replace(prepared.authorizeUrl)
      }
    } catch {
      /* Cross-origin if the click already opened the authorize URL. */
    }
    try {
      popup.focus()
    } catch {
      /* ignore */
    }
    const code = await waitForOAuthCode(popup, prepared.state)
    const tokens = await exchangeCode({
      tokenUrl: prepared.tokenUrl,
      clientId: options.clientId,
      code,
      verifier: prepared.verifier,
      redirectUri: oauthRedirectUri(),
    })
    sessionStorage.removeItem(SESSION_KEY)
    return {
      ...tokens,
      clientId: options.clientId,
      scopes: prepared.scopes,
    }
  }

  if (!options.allowRedirect) {
    throw new CloudApiError('Sign-in popup was blocked. Allow popups for this site and try again.')
  }

  sessionStorage.setItem(`${SESSION_KEY}-mode`, 'redirect')
  window.location.assign(prepared.authorizeUrl)
  return new Promise(() => undefined)
}

export async function completeOAuthRedirect(): Promise<boolean> {
  if (!isOAuthCallbackLocation()) return false
  const params = new URLSearchParams(window.location.search)
  const code = params.get('code')
  const state = params.get('state')
  const error = params.get('error') || params.get('error_description')
  const raw = sessionStorage.getItem(SESSION_KEY)
  const isRedirect = sessionStorage.getItem(`${SESSION_KEY}-mode`) === 'redirect'
  if (!isRedirect && !raw) return false
  if (!isRedirect && !code && !error) return false
  sessionStorage.removeItem(SESSION_KEY)
  sessionStorage.removeItem(`${SESSION_KEY}-mode`)
  if (error) throw new CloudApiError(error)
  if (!code || !raw) throw new CloudApiError('Sign-in did not return a valid authorization code.')
  const pending = JSON.parse(raw) as PendingOAuth
  if (pending.state !== state) throw new CloudApiError('Sign-in state did not match. Try again.')
  const tokens = await exchangeCode({
    tokenUrl: pending.tokenUrl || '/api/ms-oauth/common/oauth2/v2.0/token',
    clientId: pending.clientId,
    code,
    verifier: pending.verifier,
    redirectUri: oauthRedirectUri(),
  })
  const stored = { ...tokens, clientId: pending.clientId, scopes: pending.extraScopes }
  if (pending.provider === 'google') setGoogleTokens(stored)
  else setMicrosoftTokens(stored)
  return true
}

function consumeOAuthResult(): { code?: string | null; state?: string | null; error?: string | null } | null {
  try {
    const raw = localStorage.getItem(RESULT_KEY)
    if (!raw) return null
    const data = JSON.parse(raw) as {
      type?: string
      code?: string | null
      state?: string | null
      error?: string | null
      at?: number
    }
    if (data?.type !== MESSAGE_TYPE) return null
    if (data.at && Date.now() - data.at > 5 * 60 * 1000) {
      localStorage.removeItem(RESULT_KEY)
      return null
    }
    localStorage.removeItem(RESULT_KEY)
    return data
  } catch {
    return null
  }
}

function waitForOAuthCode(popup: Window | null, expectedState: string): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!popup) {
      reject(new CloudApiError('Sign-in popup was blocked. Allow popups for this site and try again.'))
      return
    }
    const finish = (code: string) => {
      cleanup()
      resolve(code)
    }
    const fail = (message: string) => {
      cleanup()
      reject(new CloudApiError(message))
    }
    const applyResult = (data: { code?: string | null; state?: string | null; error?: string | null }) => {
      if (data.error) {
        fail(data.error)
        return
      }
      if (!data.code || data.state !== expectedState) {
        fail('Sign-in did not return a valid authorization code.')
        return
      }
      finish(data.code)
    }
    const timer = window.setInterval(() => {
      const stored = consumeOAuthResult()
      if (stored) {
        try {
          popup.close()
        } catch {
          /* ignore */
        }
        applyResult(stored)
        return
      }
      if (popup.closed) {
        fail('Sign-in was cancelled.')
      }
    }, 400)
    const timeout = window.setTimeout(() => {
      try {
        popup.close()
      } catch {
        /* ignore */
      }
      fail('Sign-in timed out. Try again.')
    }, 5 * 60 * 1000)
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return
      const data = event.data as { type?: string; code?: string | null; state?: string | null; error?: string | null }
      if (data?.type !== MESSAGE_TYPE) return
      try {
        popup.close()
      } catch {
        /* ignore */
      }
      applyResult(data)
    }
    const onStorage = (event: StorageEvent) => {
      if (event.key !== RESULT_KEY || !event.newValue) return
      const stored = consumeOAuthResult()
      if (stored) {
        try {
          popup.close()
        } catch {
          /* ignore */
        }
        applyResult(stored)
      }
    }
    const cleanup = () => {
      window.clearInterval(timer)
      window.clearTimeout(timeout)
      window.removeEventListener('message', onMessage)
      window.removeEventListener('storage', onStorage)
    }
    window.addEventListener('message', onMessage)
    window.addEventListener('storage', onStorage)
  })
}

async function exchangeCode(options: {
  tokenUrl: string
  clientId: string
  code: string
  verifier: string
  redirectUri: string
}): Promise<CloudOAuthTokens> {
  if (!options.code) {
    throw new CloudApiError('Sign-in did not return a valid authorization code.')
  }
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
