import {
  ConnectionState,
  DisconnectReason,
  Room,
  RoomEvent,
  Track,
  type AudioCaptureOptions,
  type RemoteTrack,
} from "livekit-client"

import type { VoiceStatus } from "@/lib/stores/voice-store"

// Loaded with import() when someone joins voice, so livekit-client stays out of the main bundle.

const STATUS: Partial<Record<ConnectionState, VoiceStatus>> = {
  [ConnectionState.Connecting]: "connecting",
  [ConnectionState.Connected]: "connected",
  [ConnectionState.Reconnecting]: "reconnecting",
  [ConnectionState.SignalReconnecting]: "reconnecting",
}

/** Reasons worth an automatic rejoin (network trouble), as opposed to being removed. */
const RETRYABLE = new Set<DisconnectReason | undefined>([
  undefined,
  DisconnectReason.UNKNOWN_REASON,
  DisconnectReason.SERVER_SHUTDOWN,
  DisconnectReason.STATE_MISMATCH,
  DisconnectReason.JOIN_FAILURE,
  DisconnectReason.SIGNAL_CLOSE,
])

/** Why LiveKit dropped us, in words; null when we left on purpose. */
function disconnectMessage(reason: DisconnectReason | undefined): string | null {
  switch (reason) {
    case DisconnectReason.CLIENT_INITIATED:
      return null
    case DisconnectReason.DUPLICATE_IDENTITY:
      return "You joined voice from another tab or device, so this one was disconnected."
    case DisconnectReason.PARTICIPANT_REMOVED:
      return "You were removed from the voice channel."
    case DisconnectReason.ROOM_DELETED:
      return "The voice channel was closed."
    default:
      return "Lost connection to voice."
  }
}

export type VoiceSessionEvents = {
  onStatus: (status: VoiceStatus) => void
  onSpeaking: (speaking: boolean) => void
  /** LiveKit dropped the connection. `retry` means it's worth rejoining. */
  onDisconnected: (info: { message: string | null; retry: boolean }) => void
  /** The browser blocked playback; call `resume` from a user gesture. */
  onPlaybackBlocked: (resume: () => void) => void
  onDeviceError: (error: Error) => void
}

/** One LiveKit room connection: plays everyone else and publishes our microphone. */
export function createVoiceSession(
  options: { capture: AudioCaptureOptions; outputDeviceId: string; deafened: boolean },
  events: VoiceSessionEvents
) {
  let deafened = options.deafened
  const room = new Room({
    adaptiveStream: true,
    dynacast: true,
    audioCaptureDefaults: options.capture,
    audioOutput: { deviceId: options.outputDeviceId || undefined },
  })
  const players = document.createElement("div")
  players.hidden = true
  document.body.append(players)

  room
    .on(RoomEvent.ConnectionStateChanged, (state) => {
      const status = STATUS[state]
      if (status) events.onStatus(status)
    })
    .on(RoomEvent.TrackSubscribed, (track: RemoteTrack) => {
      if (track.kind !== Track.Kind.Audio) return
      const element = track.attach()
      element.muted = deafened
      players.append(element)
    })
    .on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack) => {
      for (const element of track.detach()) element.remove()
    })
    .on(RoomEvent.ActiveSpeakersChanged, (speakers) => events.onSpeaking(speakers.some((p) => p.isLocal)))
    .on(RoomEvent.AudioPlaybackStatusChanged, () => {
      if (!room.canPlaybackAudio) events.onPlaybackBlocked(() => void room.startAudio())
    })
    .on(RoomEvent.MediaDevicesError, (error) => events.onDeviceError(error))
    .on(RoomEvent.Disconnected, (reason) =>
      events.onDisconnected({ message: disconnectMessage(reason), retry: RETRYABLE.has(reason) })
    )

  return {
    connect: (url: string, token: string) => room.connect(url, token),
    /** Mutes or unmutes the published microphone (publishing it the first time). */
    async setMicrophone(enabled: boolean, capture: AudioCaptureOptions) {
      await room.localParticipant.setMicrophoneEnabled(enabled, capture)
    },
    setDeafened(value: boolean) {
      deafened = value
      for (const element of players.querySelectorAll("audio")) element.muted = value
    },
    async switchDevice(kind: "audioinput" | "audiooutput", deviceId: string) {
      await room.switchActiveDevice(kind, deviceId || "default")
    },
    async disconnect() {
      players.remove()
      await room.disconnect()
    },
  }
}

export type VoiceSession = ReturnType<typeof createVoiceSession>
