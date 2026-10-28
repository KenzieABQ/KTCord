import {
  ConnectionState,
  DisconnectReason,
  Room,
  RoomEvent,
  Track,
  type AudioCaptureOptions,
  type LocalTrackPublication,
  type Participant,
  type RemoteAudioTrack,
  type RemoteParticipant,
  type RemoteTrack,
  type RemoteTrackPublication,
} from "livekit-client"

import { useVoiceMediaStore, type VideoSource } from "@/lib/stores/voice-media-store"
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
  /** Our screen share stopped (e.g. from the browser's own "Stop sharing" button). */
  onScreenShareEnded: () => void
}

function videoSource(source: Track.Source): VideoSource | null {
  if (source === Track.Source.Camera) return "camera"
  if (source === Track.Source.ScreenShare) return "screen"
  return null
}

/**
 * One LiveKit room connection: plays everyone else, publishes our microphone, and shares
 * our camera or screen on request. Video tracks go to the voice media store.
 */
export function createVoiceSession(
  options: {
    capture: AudioCaptureOptions
    outputDeviceId: string
    deafened: boolean
    /** Playback volume for a person, 0-1 (their User Volume, or 0 when muted for me). */
    volumeFor: (userId: string) => number
  },
  events: VoiceSessionEvents
) {
  let deafened = options.deafened
  const media = useVoiceMediaStore.getState()
  media.clear()
  const showVideo = (participant: Participant, source: Track.Source, track: Track | null) => {
    const kind = videoSource(source)
    if (kind) useVoiceMediaStore.getState().setVideo(participant.identity, kind, track)
  }
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
    .on(RoomEvent.TrackSubscribed, (track: RemoteTrack, publication: RemoteTrackPublication, participant: RemoteParticipant) => {
      if (track.kind === Track.Kind.Video) {
        if (!publication.isMuted) showVideo(participant, publication.source, track)
        return
      }
      const element = track.attach()
      element.muted = deafened
      ;(track as RemoteAudioTrack).setVolume(options.volumeFor(participant.identity))
      players.append(element)
    })
    .on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack, publication: RemoteTrackPublication, participant: RemoteParticipant) => {
      if (track.kind === Track.Kind.Video) showVideo(participant, publication.source, null)
      else for (const element of track.detach()) element.remove()
    })
    .on(RoomEvent.TrackMuted, (publication, participant) => {
      if (publication.kind === Track.Kind.Video) showVideo(participant, publication.source, null)
    })
    .on(RoomEvent.TrackUnmuted, (publication, participant) => {
      if (publication.kind === Track.Kind.Video && publication.track) showVideo(participant, publication.source, publication.track)
    })
    .on(RoomEvent.LocalTrackPublished, (publication: LocalTrackPublication) => {
      if (publication.track && publication.kind === Track.Kind.Video) {
        showVideo(room.localParticipant, publication.source, publication.track)
      }
    })
    .on(RoomEvent.LocalTrackUnpublished, (publication: LocalTrackPublication) => {
      showVideo(room.localParticipant, publication.source, null)
      if (publication.source === Track.Source.ScreenShare) events.onScreenShareEnded()
    })
    .on(RoomEvent.ParticipantDisconnected, (participant) => {
      showVideo(participant, Track.Source.Camera, null)
      showVideo(participant, Track.Source.ScreenShare, null)
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
    async switchDevice(kind: "audioinput" | "audiooutput" | "videoinput", deviceId: string) {
      await room.switchActiveDevice(kind, deviceId || "default")
    },
    /** Turns the camera on, or off (unpublishing it, so the light goes out). */
    async setCamera(enabled: boolean, deviceId: string) {
      const current = room.localParticipant.getTrackPublication(Track.Source.Camera)
      if (enabled) {
        if (!current?.track) await room.localParticipant.setCameraEnabled(true, { deviceId: deviceId || undefined })
        else if (deviceId) await room.switchActiveDevice("videoinput", deviceId)
      } else if (current?.track) {
        await room.localParticipant.unpublishTrack(current.track, true)
      }
    },
    /** Starts sharing a screen or window (the browser asks which), with its audio if offered. */
    async setScreenShare(enabled: boolean) {
      const current = room.localParticipant.getTrackPublication(Track.Source.ScreenShare)
      if (enabled) {
        if (!current?.track) await room.localParticipant.setScreenShareEnabled(true, { audio: true, selfBrowserSurface: "exclude" })
      } else {
        await room.localParticipant.setScreenShareEnabled(false)
      }
    },
    /** Re-applies everyone's playback volume (after User Volume or a local mute changes). */
    applyVolumes() {
      for (const participant of room.remoteParticipants.values()) {
        const volume = options.volumeFor(participant.identity)
        participant.setVolume(volume, Track.Source.Microphone)
        participant.setVolume(volume, Track.Source.ScreenShareAudio)
      }
    },
    async disconnect() {
      players.remove()
      await room.disconnect()
      useVoiceMediaStore.getState().clear()
    },
  }
}

export type VoiceSession = ReturnType<typeof createVoiceSession>
