import { API_BASE_URL } from '../api/config'

let warmupPromise: Promise<void> | null = null

export const warmAuthApi = () => {
  if (warmupPromise) return warmupPromise

  warmupPromise = fetch(`${API_BASE_URL}/health`, {
    method: 'GET',
    cache: 'no-store',
  })
    .then(() => undefined)
    .catch(() => undefined)

  return warmupPromise
}
