export type CloudAccountProvider = 'microsoft' | 'google'

export interface CloudOAuthTokens {
  clientId: string
  accessToken: string
  refreshToken?: string
  expiresAt: number
  name?: string
  email?: string
  scopes?: string[]
}

export interface ICloudFolderMeta {
  name: string
  connectedAt: string
}

interface StoredCloud {
  microsoft?: CloudOAuthTokens
  google?: CloudOAuthTokens
  googleBucket?: string
  microsoftClientId?: string
  googleClientId?: string
  icloud?: ICloudFolderMeta
}

const STORAGE_KEY = 'architecture-visual-builder-cloud'

function load(): StoredCloud {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as StoredCloud) : {}
  } catch {
    return {}
  }
}

function save(data: StoredCloud) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}

export function defaultMicrosoftClientId(): string {
  return (import.meta.env.VITE_MS_CLIENT_ID as string | undefined)?.trim() || load().microsoftClientId || ''
}

export function defaultGoogleClientId(): string {
  return (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined)?.trim() || load().googleClientId || ''
}

export function setMicrosoftClientId(clientId: string) {
  const data = load()
  data.microsoftClientId = clientId.trim()
  save(data)
}

export function setGoogleClientId(clientId: string) {
  const data = load()
  data.googleClientId = clientId.trim()
  save(data)
}

export function getMicrosoftTokens(): CloudOAuthTokens | null {
  return load().microsoft ?? null
}

export function setMicrosoftTokens(tokens: CloudOAuthTokens | null) {
  const data = load()
  if (tokens) data.microsoft = tokens
  else delete data.microsoft
  save(data)
}

export function getGoogleTokens(): CloudOAuthTokens | null {
  return load().google ?? null
}

export function setGoogleTokens(tokens: CloudOAuthTokens | null) {
  const data = load()
  if (tokens) data.google = tokens
  else delete data.google
  save(data)
}

export function getGoogleBucket(): string {
  return load().googleBucket ?? ''
}

export function setGoogleBucket(bucket: string) {
  const data = load()
  data.googleBucket = bucket.trim()
  save(data)
}

export function getICloudMeta(): ICloudFolderMeta | null {
  return load().icloud ?? null
}

export function setICloudMeta(meta: ICloudFolderMeta | null) {
  const data = load()
  if (meta) data.icloud = meta
  else delete data.icloud
  save(data)
}

export function isMicrosoftConnected(): boolean {
  return Boolean(getMicrosoftTokens()?.accessToken)
}

export function isGoogleConnected(): boolean {
  return Boolean(getGoogleTokens()?.accessToken)
}

export function isICloudConnected(): boolean {
  return Boolean(getICloudMeta()?.name)
}

export function isCloudConnected(): boolean {
  return isMicrosoftConnected() || isGoogleConnected() || isICloudConnected()
}

export function microsoftAccountLabel(): string {
  const tokens = getMicrosoftTokens()
  return tokens?.name || tokens?.email || 'Microsoft 365'
}

export function googleAccountLabel(): string {
  const tokens = getGoogleTokens()
  return tokens?.name || tokens?.email || 'Google'
}
