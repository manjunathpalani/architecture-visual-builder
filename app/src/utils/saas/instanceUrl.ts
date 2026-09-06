import type { SaasProviderId } from './types'

export class SaasApiError extends Error {
  status?: number
  constructor(message: string, status?: number) {
    super(message)
    this.status = status
  }
}

export function normalizeInstanceUrl(input: string, provider: SaasProviderId): string {
  let value = input.trim()
  if (!value) throw new SaasApiError('Enter the SaaS instance URL')
  if (!/^https?:\/\//i.test(value)) value = `https://${value}`
  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw new SaasApiError('Enter a valid https URL')
  }
  if (url.protocol !== 'https:') throw new SaasApiError('Only https instance URLs are supported')
  const host = url.hostname.toLowerCase()
  if (provider === 'dynamics' && !host.endsWith('.dynamics.com')) {
    throw new SaasApiError('Dynamics URL should look like https://org.crm.dynamics.com')
  }
  if (
    provider === 'salesforce' &&
    !host.endsWith('.salesforce.com') &&
    !host.endsWith('.force.com') &&
    !host.endsWith('.cloudforce.com')
  ) {
    throw new SaasApiError('Salesforce URL should look like https://yourorg.my.salesforce.com')
  }
  return `https://${host}`
}

export function instanceHost(instanceUrl: string): string {
  return new URL(instanceUrl).hostname
}

export function proxyUrl(provider: SaasProviderId, instanceUrl: string, path: string): string {
  const host = instanceHost(instanceUrl)
  if (path.startsWith('http')) {
    const url = new URL(path)
    return `/api/saas/${provider}/${host}${url.pathname}${url.search}`
  }
  const suffix = path.startsWith('/') ? path : `/${path}`
  return `/api/saas/${provider}/${host}${suffix}`
}

export function odataErrorMessage(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== 'object') return fallback
  const error = (payload as { error?: { message?: string; code?: string } }).error
  if (error?.message) return error.message
  const message = (payload as { message?: string }).message
  if (typeof message === 'string' && message.trim()) return message
  return fallback
}

export async function mapPool<T, R>(items: T[], limit: number, mapper: (item: T) => Promise<R>): Promise<R[]> {
  if (items.length === 0) return []
  const results: R[] = new Array(items.length)
  let cursor = 0
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor
      cursor += 1
      results[index] = await mapper(items[index])
    }
  })
  await Promise.all(workers)
  return results
}
