"use client"

import { useEffect, useRef, useState } from "react"
import { toast } from "@/lib/toast"

import { errorMessage } from "@/lib/api/errors"
import { fetchVoiceToken } from "@/lib/api/voice"
import { isTextField } from "@/lib/shortcuts"
import { playbackVolume, usePrefsStore } from "@/lib/stores/prefs-store"
import { useVoiceStore } from "@/lib/stores/voice-store"
import { isNonTypingKey } from "@/lib/voice/keys"
import type { VoiceSession } from "@/lib/voice/livekit-session"

import { useMyVoiceModeration } from "./use-my-voice-moderation"

function captureOptions() {
  const { inputDeviceId, noiseSuppression, echoCancellation } = usePrefsStore.getState()
  return {
    deviceId: inputDeviceId || undefined,
    noiseSuppression,
    echoCancellation,
    autoGainControl: true,
  }
}

const MIC_BLOCKED = "KTCord can't use your microphone. Allow it in your browser's site settings, then unmute."

/**
 * Real audio for the voice connection through LiveKit: joins the channel's room with a
 * token from /api/livekit/token, publishes the microphone (always on, or while the
 * push-to-talk key is held), plays everyone else, and reports when we're speaking.
 * Without a configured voice server the connection stays presence-only.
 */
export function useVoiceAudio() {
  const channelId = useVoiceStore((s) => s.connection?.channelId ?? null)
  const joinedAt = useVoiceStore((s) => s.connection?.joinedAt ?? null)
  const live = useVoiceStore((s) => s.connection?.audio === "livekit" && s.connection.status === "connected")
  const canSpeak = useVoiceStore((s) => s.connection?.canSpeak ?? false)
  const canVideo = useVoiceStore((s) => s.connection?.canVideo ?? false)
  const camera = useVoiceStore((s) => s.camera)
  const screenShare = useVoiceStore((s) => s.screenShare)
  const cameraDeviceId = usePrefsStore((s) => s.cameraDeviceId)
  const userVolumes = usePrefsStore((s) => s.userVolumes)
  const localMutes = usePrefsStore((s) => s.localMutes)
  const selfMute = useVoiceStore((s) => s.selfMute)
  const selfDeaf = useVoiceStore((s) => s.selfDeaf)
  const pushToTalkHeld = useVoiceStore((s) => s.pushToTalkHeld)
  const inputMode = usePrefsStore((s) => s.inputMode)
  const pushToTalkKey = usePrefsStore((s) => s.pushToTalkKey)
  const inputDeviceId = usePrefsStore((s) => s.inputDeviceId)
  const outputDeviceId = usePrefsStore((s) => s.outputDeviceId)
  const { serverMute, serverDeaf } = useMyVoiceModeration()

  const [session, setSession] = useState<VoiceSession | null>(null)
  /** Automatic rejoins since the last successful connection. */
  const retries = useRef(0)

  // One room per connection: (re)joining makes a new one, leaving tears it down.
  useEffect(() => {
    if (!channelId) return
    let cancelled = false
    let current: VoiceSession | null = null

    void (async () => {
      try {
        const token = await fetchVoiceToken(channelId)
        if (cancelled) return
        if (token.kind === "unavailable") {
          useVoiceStore.getState().setAudio("unavailable", false)
          return
        }
        useVoiceStore.getState().setAudio("livekit", token.canSpeak, token.canVideo)

        const { createVoiceSession } = await import("@/lib/voice/livekit-session")
        if (cancelled) return
        current = createVoiceSession(
          {
            capture: captureOptions(),
            outputDeviceId: usePrefsStore.getState().outputDeviceId,
            deafened: useVoiceStore.getState().selfDeaf,
            volumeFor: playbackVolume,
          },
          {
            onStatus: (status) => {
              if (cancelled) return
              useVoiceStore.getState().setStatus(status)
              if (status === "connected") retries.current = 0
            },
            onSpeaking: (speaking) => useVoiceStore.getState().setSpeaking(speaking),
            onDisconnected: ({ message, retry }) => {
              if (cancelled) return
              const voice = useVoiceStore.getState()
              if (retry && retries.current < 2) {
                retries.current += 1
                voice.rejoin()
                return
              }
              voice.leave()
              if (message) toast(message)
            },
            onPlaybackBlocked: (resume) =>
              toast("Your browser paused voice audio.", {
                id: "voice-playback",
                action: { label: "Play audio", onClick: resume },
              }),
            onScreenShareEnded: () => useVoiceStore.getState().setScreenShare(false),
            onDeviceError: (error) =>
              toast.error(
                error.name === "NotAllowedError"
                  ? MIC_BLOCKED
                  : "Your microphone isn't working. Check it in Settings → Voice & Audio."
              ),
          }
        )
        setSession(current)
        await current.connect(token.url, token.token)
      } catch (error) {
        if (cancelled) return
        useVoiceStore.getState().leave()
        toast.error(errorMessage(error))
      }
    })()

    return () => {
      cancelled = true
      setSession(null)
      void current?.disconnect()
      useVoiceStore.getState().setSpeaking(false)
    }
  }, [channelId, joinedAt])

  // Microphone: on unless muted; in push-to-talk mode only while the key is held.
  const transmit = !selfMute && !serverMute && (inputMode === "voice-activity" || pushToTalkHeld)
  useEffect(() => {
    if (!session || !live || !canSpeak) return
    session.setMicrophone(transmit, captureOptions()).catch((error: Error) => {
      if (error.name !== "NotAllowedError") return
      useVoiceStore.setState({ selfMute: true })
      toast.error(MIC_BLOCKED)
    })
  }, [session, transmit, live, canSpeak])

  // Deafen silences everyone (and the store mutes us too). A moderator's server deafen does too.
  useEffect(() => {
    session?.setDeafened(selfDeaf || serverDeaf)
  }, [session, selfDeaf, serverDeaf])

  // Camera: on while wanted (and allowed); a refused or missing camera turns the toggle off.
  useEffect(() => {
    if (!session || !live) return
    session.setCamera(camera && canVideo, cameraDeviceId).catch((error: Error) => {
      useVoiceStore.getState().setCamera(false)
      toast.error(
        error.name === "NotAllowedError"
          ? "KTCord can't use your camera. Allow it in your browser's site settings."
          : "Your camera isn't working. Check that it's connected and not in use."
      )
    })
  }, [session, live, camera, canVideo, cameraDeviceId])

  // Screen share: the browser asks what to share; cancelling that just turns the toggle off.
  useEffect(() => {
    if (!session || !live) return
    session.setScreenShare(screenShare && canVideo).catch((error: Error) => {
      useVoiceStore.getState().setScreenShare(false)
      if (error.name !== "NotAllowedError") toast.error("Couldn't share your screen. Try again.")
    })
  }, [session, live, screenShare, canVideo])

  // User Volume and local mutes.
  useEffect(() => {
    session?.applyVolumes()
  }, [session, userVolumes, localMutes])

  // Switch devices live when they change in settings.
  useEffect(() => {
    if (session && live) void session.switchDevice("audioinput", inputDeviceId)
  }, [session, live, inputDeviceId])
  useEffect(() => {
    if (session && live) void session.switchDevice("audiooutput", outputDeviceId)
  }, [session, live, outputDeviceId])

  // Push-to-talk key. Typing keys don't count while a text box has focus.
  useEffect(() => {
    if (!channelId || inputMode !== "push-to-talk") return
    const { setPushToTalkHeld } = useVoiceStore.getState()
    const down = (e: KeyboardEvent) => {
      if (e.code !== pushToTalkKey) return
      if (!isNonTypingKey(e.code)) {
        if (isTextField(e.target)) return
        e.preventDefault()
      }
      setPushToTalkHeld(true)
    }
    const up = (e: KeyboardEvent) => {
      if (e.code === pushToTalkKey) setPushToTalkHeld(false)
    }
    const release = () => setPushToTalkHeld(false)
    window.addEventListener("keydown", down)
    window.addEventListener("keyup", up)
    window.addEventListener("blur", release)
    return () => {
      window.removeEventListener("keydown", down)
      window.removeEventListener("keyup", up)
      window.removeEventListener("blur", release)
      release()
    }
  }, [channelId, inputMode, pushToTalkKey])
}
