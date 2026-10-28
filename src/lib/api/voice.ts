import { ApiError } from "./errors"

export type VoiceToken =
  | { kind: "livekit"; token: string; url: string; canSpeak: boolean; canVideo: boolean }
  /** No voice server is configured: voice works as presence only. */
  | { kind: "unavailable" }

const MESSAGES: Record<string, string> = {
  forbidden: "You don't have permission to connect to this voice channel.",
  unauthenticated: "Your session expired. Sign in again to join voice.",
}

/** Asks our server for a LiveKit token for a voice channel (it checks permissions first). */
export async function fetchVoiceToken(channelId: string): Promise<VoiceToken> {
  const response = await fetch("/api/livekit/token", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ channelId }),
  })
  const body = (await response.json().catch(() => ({}))) as Record<string, unknown>
  if (!response.ok) {
    const code = typeof body.error === "string" ? body.error : "unknown"
    throw new ApiError(MESSAGES[code] ?? "Couldn't connect to voice. Try again in a moment.", code)
  }
  if (body.configured === false) return { kind: "unavailable" }
  return {
    kind: "livekit",
    token: String(body.token),
    url: String(body.url),
    canSpeak: Boolean(body.canSpeak),
    canVideo: Boolean(body.canVideo),
  }
}
