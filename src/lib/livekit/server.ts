import "server-only"

import { AccessToken, RoomServiceClient, TrackSource } from "livekit-server-sdk"

/** LiveKit project settings, or null while voice audio isn't set up (presence-only voice). */
export function liveKitConfig() {
  const url = process.env.NEXT_PUBLIC_LIVEKIT_URL
  const apiKey = process.env.LIVEKIT_API_KEY
  const apiSecret = process.env.LIVEKIT_API_SECRET
  return url && apiKey && apiSecret ? { url, apiKey, apiSecret } : null
}

/** A voice channel's LiveKit room: named by server and channel, so a server's rooms can be found. */
export function voiceRoomName(serverId: string, channelId: string) {
  return `${serverId}_${channelId}`
}

/** What someone may send in a voice room: microphone (SPEAK, not server muted), camera and screen (VIDEO). */
export function publishSources(canSpeak: boolean, canVideo: boolean): TrackSource[] {
  return [
    ...(canSpeak ? [TrackSource.MICROPHONE] : []),
    ...(canVideo ? [TrackSource.CAMERA, TrackSource.SCREEN_SHARE, TrackSource.SCREEN_SHARE_AUDIO] : []),
  ]
}

/**
 * A short-lived token for one voice channel's room. The identity is the user id, so a
 * second tab joining replaces the first (as in Discord). Without SPEAK, or while server
 * muted, the user can't publish their microphone; without VIDEO, no camera or screen;
 * server deafened, they can't hear either.
 */
export async function createVoiceToken(input: {
  apiKey: string
  apiSecret: string
  userId: string
  name: string
  room: string
  canSpeak: boolean
  canVideo?: boolean
  canHear?: boolean
}) {
  const token = new AccessToken(input.apiKey, input.apiSecret, {
    identity: input.userId,
    name: input.name,
    ttl: "10m",
  })
  const sources = publishSources(input.canSpeak, input.canVideo ?? false)
  token.addGrant({
    room: input.room,
    roomJoin: true,
    canSubscribe: input.canHear ?? true,
    canPublish: sources.length > 0,
    canPublishSources: sources,
    canPublishData: false,
  })
  return token.toJwt()
}

type Config = NonNullable<ReturnType<typeof liveKitConfig>>

function rooms(config: Config) {
  return new RoomServiceClient(config.url.replace(/^ws/, "http"), config.apiKey, config.apiSecret)
}

/** The rooms of a server's voice channels where this person is connected right now. */
async function roomsWith(config: Config, serverId: string, userId: string): Promise<string[]> {
  const client = rooms(config)
  const all = await client.listRooms()
  const mine = all.filter((r) => r.name.startsWith(`${serverId}_`))
  const found: string[] = []
  for (const room of mine) {
    const participants = await client.listParticipants(room.name)
    if (participants.some((p) => p.identity === userId)) found.push(room.name)
  }
  return found
}

/** Disconnects someone from every voice room in a server. Returns how many rooms they left. */
export async function removeFromServerVoice(config: Config, serverId: string, userId: string) {
  const client = rooms(config)
  const names = await roomsWith(config, serverId, userId)
  await Promise.all(names.map((room) => client.removeParticipant(room, userId)))
  return names.length
}

/** Applies server mute/deafen to someone who is already in a voice room. */
export async function applyVoiceModeration(
  config: Config,
  serverId: string,
  userId: string,
  state: { canSpeak: boolean; canVideo: boolean; canSubscribe: boolean }
) {
  const client = rooms(config)
  const names = await roomsWith(config, serverId, userId)
  const sources = publishSources(state.canSpeak, state.canVideo)
  await Promise.all(
    names.map((room) =>
      client.updateParticipant(room, userId, {
        permission: {
          canPublish: sources.length > 0,
          canSubscribe: state.canSubscribe,
          canPublishData: false,
          canPublishSources: sources,
        },
      })
    )
  )
  return names.length
}
