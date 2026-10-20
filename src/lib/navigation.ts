/** A same-origin path from `?next=`, or the fallback. Rejects absolute and protocol-relative URLs. */
export function safeNext(next: string | null | undefined, fallback = "/channels/me"): string {
  return next?.startsWith("/") && !next.startsWith("//") ? next : fallback
}

/** Reads `?next=` from the current URL. Only call from event handlers or effects. */
export function nextFromLocation(fallback = "/channels/me"): string {
  return safeNext(new URLSearchParams(window.location.search).get("next"), fallback)
}
