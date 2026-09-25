const BASE = import.meta.env.VITE_API_BASE ?? ''

export class ApiError extends Error {
  status: number
  code: string
  /** True when the server refused because the task is finished and locked. */
  isLocked: boolean

  constructor(status: number, code: string, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.isLocked = status === 423
  }
}

type Query = Record<string, string | number | boolean | undefined | null | string[]>

function withQuery(path: string, query?: Query): string {
  if (!query) return path
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue
    if (Array.isArray(value)) {
      if (value.length === 0) continue
      params.set(key, value.join(','))
    } else {
      params.set(key, String(value))
    }
  }
  const qs = params.toString()
  return qs ? `${path}?${qs}` : path
}

async function request<T>(method: string, path: string, options: { body?: unknown; query?: Query } = {}): Promise<T> {
  const res = await fetch(withQuery(BASE + path, options.query), {
    method,
    headers: options.body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  })

  if (res.status === 204) return undefined as T

  const text = await res.text()
  const payload = text ? safeParse(text) : null

  if (!res.ok) {
    const err = (payload as { error?: { code: string; message: string } } | null)?.error
    throw new ApiError(res.status, err?.code ?? 'error', err?.message ?? `Request failed (${res.status})`)
  }
  return payload as T
}

function safeParse(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

export const api = {
  get: <T,>(path: string, query?: Query) => request<T>('GET', path, { query }),
  post: <T,>(path: string, body?: unknown, query?: Query) => request<T>('POST', path, { body, query }),
  patch: <T,>(path: string, body?: unknown) => request<T>('PATCH', path, { body }),
  delete: <T,>(path: string, query?: Query) => request<T>('DELETE', path, { query }),
}
