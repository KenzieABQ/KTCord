import "server-only"

import { AccessToken, TrackSource } from "livekit-server-sdk"

/** LiveKit project settings, or null while voice audio isn't set up (presence-only voice). */
export function liveKitConfig() {
  const url = process.env.NEXT_PUBLIC_LIVEKIT_URL
  const apiKey = process.env.LIVEKIT_API_KEY
  const apiSecret = process.env.LIVEKIT_API_SECRET
  return url && apiKey && apiSecret ? { url, apiKey, apiSecret } : null
}

/**
 * A short-lived token for one voice channel's room. Rooms are named after the channel id;
 * the identity is the user id, so a second tab joining replaces the first (as in Discord).
 * Without SPEAK the user can listen but not publish.
 */
export async function createVoiceToken(input: {
  apiKey: string
  apiSecret: string
  userId: string
  name: string
  channelId: string
  canSpeak: boolean
}) {
  const token = new AccessToken(input.apiKey, input.apiSecret, {
    identity: input.userId,
    name: input.name,
    ttl: "10m",
  })
  token.addGrant({
    room: input.channelId,
    roomJoin: true,
    canSubscribe: true,
    canPublish: input.canSpeak,
    canPublishSources: input.canSpeak ? [TrackSource.MICROPHONE] : [],
    canPublishData: false,
  })
  return token.toJwt()
}
