/**
 * What each connected client announces on a channel's `voice:<id>` presence topic.
 * Speaking isn't here: it changes several times a second, so it travels as
 * `speaking` Broadcast events on the same topic (see SpeakingEvent).
 */
export type VoicePresenceMeta = {
  user_id: string
  self_mute: boolean
  self_deaf: boolean
  joined_at: string
}

/** Broadcast on the voice topic whenever someone starts or stops talking. */
export type SpeakingEvent = { user_id: string; speaking: boolean }

export function isSpeakingEvent(value: unknown): value is SpeakingEvent {
  const v = value as SpeakingEvent | null
  return typeof v?.user_id === "string" && typeof v.speaking === "boolean"
}

/** One person in a voice channel, as the sidebar and voice view show them. */
export type VoiceMember = {
  userId: string
  selfMute: boolean
  selfDeaf: boolean
  speaking: boolean
  joinedAt: string
  /** Set by a moderator; they stick until lifted. */
  serverMute?: boolean
  serverDeaf?: boolean
}

/**
 * Turns a presence state into the channel's member list, in join order. Someone connected
 * from several tabs appears once, with the state of their most recent connection.
 * `speaking` names who is talking right now (from Broadcast); muted people never are.
 */
export function rosterFromPresence(
  state: Record<string, VoicePresenceMeta[]>,
  speaking: Record<string, boolean> = {}
): VoiceMember[] {
  const byUser = new Map<string, VoicePresenceMeta>()
  for (const metas of Object.values(state)) {
    for (const meta of metas) {
      if (!meta?.user_id) continue
      const current = byUser.get(meta.user_id)
      if (!current || meta.joined_at > current.joined_at) byUser.set(meta.user_id, meta)
    }
  }
  return [...byUser.values()]
    .map((m) => ({
      userId: m.user_id,
      selfMute: Boolean(m.self_mute),
      selfDeaf: Boolean(m.self_deaf),
      speaking: Boolean(speaking[m.user_id]) && !m.self_mute,
      joinedAt: m.joined_at,
    }))
    .sort((a, b) => a.joinedAt.localeCompare(b.joinedAt) || a.userId.localeCompare(b.userId))
}

/** Whether two rosters show the same thing, so unchanged syncs don't re-render the sidebar. */
export function sameRoster(a: VoiceMember[] | undefined, b: VoiceMember[]): boolean {
  if (!a || a.length !== b.length) return false
  return a.every(
    (m, i) =>
      m.userId === b[i].userId &&
      m.selfMute === b[i].selfMute &&
      m.selfDeaf === b[i].selfDeaf &&
      m.speaking === b[i].speaking &&
      m.joinedAt === b[i].joinedAt
  )
}
