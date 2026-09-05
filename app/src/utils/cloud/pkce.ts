export function randomUrlString(bytes = 32): string {
  const buffer = crypto.getRandomValues(new Uint8Array(bytes))
  return base64Url(buffer)
}

export async function pkceChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))
  return base64Url(new Uint8Array(digest))
}

export function oauthRedirectUri(): string {
  return `${window.location.origin}/oauth/callback`
}

function base64Url(bytes: Uint8Array): string {
  let binary = ''
  bytes.forEach((b) => {
    binary += String.fromCharCode(b)
  })
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}
