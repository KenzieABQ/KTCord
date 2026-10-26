import "server-only"

const windows = new Map<string, { start: number; count: number }>()

/**
 * A per-process fixed-window limit: true while `key` has made fewer than `limit` calls in
 * the current window. Good enough to stop one person from hammering an endpoint.
 */
export function allow(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now()
  const entry = windows.get(key)
  if (!entry || now - entry.start >= windowMs) {
    if (windows.size > 10_000) windows.clear()
    windows.set(key, { start: now, count: 1 })
    return true
  }
  entry.count += 1
  return entry.count <= limit
}
