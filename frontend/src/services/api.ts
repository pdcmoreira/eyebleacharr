const API_BASE_URL = import.meta.env.VITE_API_URL || ''

type ParamValue = string | number | boolean | string[] | undefined

/**
 * Build a query string that handles arrays properly
 * Arrays will be serialized as multiple params with the same key (e.g., levels=INFO&levels=ERROR)
 */
export function buildQueryString(params: Record<string, ParamValue>): string {
  const searchParams = new URLSearchParams()

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined) return

    if (Array.isArray(value)) {
      value.forEach((v) => searchParams.append(key, String(v)))
    } else {
      searchParams.append(key, String(value))
    }
  })

  const queryString = searchParams.toString()

  return queryString ? `?${queryString}` : ''
}

interface FetchOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  body?: unknown
  params?: Record<string, string | number | boolean | undefined>
}

class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public data?: { error?: string },
  ) {
    super(message)

    this.name = 'ApiError'
  }
}

async function request<T>(endpoint: string, options: FetchOptions = {}): Promise<T> {
  const { method = 'GET', body, params } = options

  // Build URL with query params
  let url = `${API_BASE_URL}${endpoint}`

  if (params) {
    const searchParams = new URLSearchParams()

    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        searchParams.append(key, String(value))
      }
    })

    const queryString = searchParams.toString()

    if (queryString) {
      url += `?${queryString}`
    }
  }

  const response = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  })

  const data = await response.json()

  if (!response.ok) {
    throw new ApiError(
      data?.error || `Request failed with status ${response.status}`,
      response.status,
      data,
    )
  }

  return data
}

export const api = {
  get: <T>(url: string, params?: Record<string, string | number | boolean | undefined>) =>
    request<T>(url, { method: 'GET', params }),

  post: <T>(url: string, body?: unknown) => request<T>(url, { method: 'POST', body }),

  put: <T>(url: string, body?: unknown) => request<T>(url, { method: 'PUT', body }),

  delete: <T>(url: string, body?: unknown) => request<T>(url, { method: 'DELETE', body }),
}

export { ApiError }
