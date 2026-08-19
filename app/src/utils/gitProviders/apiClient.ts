export class GitApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

export async function gitFetch<T>(
  url: string,
  headers: Record<string, string>,
): Promise<T> {
  const response = await fetch(url, { headers })

  if (!response.ok) {
    let message = `Request failed (${response.status})`
    try {
      const body = await response.json()
      message = body.message ?? body.error?.message ?? message
    } catch {
      // use default message
    }
    throw new GitApiError(message, response.status)
  }

  if (response.status === 204) return {} as T
  return response.json() as Promise<T>
}

export function toBase64Utf8(text: string): string {
  return btoa(unescape(encodeURIComponent(text)))
}

export function fromBase64Utf8(base64: string): string {
  return decodeURIComponent(escape(atob(base64)))
}