export function apiFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const apiKey = process.env.NEXT_PUBLIC_LOCAL_API_KEY
  const headers = new Headers(init.headers || {})
  if (apiKey) {
    headers.set('x-api-key', apiKey)
  }

  return fetch(input, { ...init, headers })
}
