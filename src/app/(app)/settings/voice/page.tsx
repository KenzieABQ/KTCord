"use client"

import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"

import { SettingsSection, SettingsToggle } from "@/components/settings/settings-layout"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useMediaDevices } from "@/hooks/use-media-devices"
import { usePrefsStore, type InputMode } from "@/lib/stores/prefs-store"
import { cn } from "@/lib/utils"
import { formatKeyCode } from "@/lib/voice/keys"

const DEFAULT = "default"

const MODES: { value: InputMode; label: string; description: string }[] = [
  { value: "voice-activity", label: "Voice Activity", description: "Your mic is on whenever you're unmuted." },
  { value: "push-to-talk", label: "Push to Talk", description: "Your mic is on only while you hold a key." },
]

function Heading({ id, children }: { id?: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="mb-2 text-xs font-bold tracking-wide text-muted-foreground uppercase">
      {children}
    </h2>
  )
}

function DevicePicker({
  id,
  label,
  kind,
  value,
  onChange,
}: {
  id: string
  label: string
  kind: "audioinput" | "audiooutput" | "videoinput"
  value: string
  onChange: (deviceId: string) => void
}) {
  const { devices, supported, labelled, requestAccess } = useMediaDevices(kind)
  if (!supported) return null
  return (
    <div className="min-w-0 flex-1">
      <Heading id={id}>{label}</Heading>
      <Select value={value || DEFAULT} onValueChange={(v) => onChange(v === DEFAULT ? "" : v)}>
        <SelectTrigger aria-labelledby={id} className="w-full bg-rail">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="bg-floating">
          <SelectItem value={DEFAULT}>System default</SelectItem>
          {devices.map((d, i) => (
            <SelectItem key={d.deviceId} value={d.deviceId}>
              {d.label || `${kind === "audioinput" ? "Microphone" : kind === "videoinput" ? "Camera" : "Speaker"} ${i + 1}`}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {!labelled && devices.length > 0 && (
        <button
          type="button"
          className="mt-1.5 text-xs text-link hover:underline"
          onClick={() =>
            requestAccess().catch(() => toast.error(`${kind === "videoinput" ? "Camera" : "Microphone"} access was blocked.`))
          }
        >
          Show device names
        </button>
      )}
    </div>
  )
}

/** Records the next key pressed as the push-to-talk key (Escape cancels). */
function KeyRecorder({ value, onChange }: { value: string; onChange: (code: string) => void }) {
  const [recording, setRecording] = useState(false)
  useEffect(() => {
    if (!recording) return
    function onKey(e: KeyboardEvent) {
      // Some synthetic or IME events carry no physical key; wait for a real one.
      if (!e.code) return
      e.preventDefault()
      e.stopPropagation()
      if (e.code !== "Escape") onChange(e.code)
      setRecording(false)
    }
    window.addEventListener("keydown", onKey, { capture: true })
    return () => window.removeEventListener("keydown", onKey, { capture: true })
  }, [recording, onChange])

  return (
    <div className="flex items-center gap-3">
      <kbd className="min-w-12 rounded-md border border-b-2 border-border bg-rail px-3 py-1.5 text-center font-sans text-sm font-semibold text-header">
        {recording ? "…" : formatKeyCode(value)}
      </kbd>
      <Button variant={recording ? "destructive" : "secondary"} onClick={() => setRecording((r) => !r)}>
        {recording ? "Press a key (Esc to cancel)" : "Change Keybind"}
      </Button>
    </div>
  )
}

/** "Let's Check": shows a live level meter from the chosen microphone. */
/** Settings → Voice & Audio → Video: a camera preview, off until asked for. */
function CameraPreview({ deviceId }: { deviceId: string }) {
  const [on, setOn] = useState(false)
  const video = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    if (!on) return
    let stream: MediaStream | null = null
    let cancelled = false
    navigator.mediaDevices
      .getUserMedia({ video: deviceId ? { deviceId: { exact: deviceId } } : true })
      .then((s) => {
        if (cancelled) return s.getTracks().forEach((t) => t.stop())
        stream = s
        if (video.current) video.current.srcObject = s
      })
      .catch(() => {
        toast.error("KTCord can't use your camera. Allow it in your browser's site settings.")
        setOn(false)
      })
    return () => {
      cancelled = true
      stream?.getTracks().forEach((t) => t.stop())
    }
  }, [on, deviceId])

  return (
    <div className="flex flex-col items-start gap-3">
      <div className="flex aspect-video w-full max-w-sm items-center justify-center overflow-hidden rounded-lg bg-rail">
        {on ? (
          <video ref={video} autoPlay playsInline muted className="size-full -scale-x-100 object-cover" />
        ) : (
          <span className="text-sm text-muted-foreground">Camera preview is off</span>
        )}
      </div>
      <Button variant="secondary" onClick={() => setOn(!on)}>
        {on ? "Stop Preview" : "Test Video"}
      </Button>
    </div>
  )
}

function MicTest() {
  const { inputDeviceId, noiseSuppression, echoCancellation } = usePrefsStore()
  const [testing, setTesting] = useState(false)
  const bar = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!testing) return
    let stream: MediaStream | null = null
    let context: AudioContext | null = null
    let frame = 0
    let stopped = false

    navigator.mediaDevices
      .getUserMedia({
        audio: { deviceId: inputDeviceId ? { exact: inputDeviceId } : undefined, noiseSuppression, echoCancellation },
      })
      .then((s) => {
        if (stopped) {
          for (const track of s.getTracks()) track.stop()
          return
        }
        stream = s
        context = new AudioContext()
        const analyser = context.createAnalyser()
        analyser.fftSize = 512
        context.createMediaStreamSource(s).connect(analyser)
        const samples = new Uint8Array(analyser.fftSize)
        const draw = () => {
          analyser.getByteTimeDomainData(samples)
          let peak = 0
          for (const v of samples) peak = Math.max(peak, Math.abs(v - 128))
          if (bar.current) bar.current.style.width = `${Math.min(100, (peak / 128) * 160)}%`
          frame = requestAnimationFrame(draw)
        }
        draw()
      })
      .catch(() => {
        toast.error("KTCord can't use your microphone. Allow it in your browser's site settings.")
        setTesting(false)
      })

    return () => {
      stopped = true
      cancelAnimationFrame(frame)
      for (const track of stream?.getTracks() ?? []) track.stop()
      void context?.close()
    }
  }, [testing, inputDeviceId, noiseSuppression, echoCancellation])

  return (
    <div>
      <Heading>Mic Test</Heading>
      <p className="mb-3 text-sm text-muted-foreground">Having mic issues? Talk and watch the bar move.</p>
      <div className="flex items-center gap-3">
        <Button onClick={() => setTesting((t) => !t)}>{testing ? "Stop Testing" : "Let's Check"}</Button>
        {/* Purely visual: it updates every frame through a ref. */}
        <div aria-hidden className="h-2 flex-1 overflow-hidden rounded-full bg-rail">
          <div ref={bar} className="h-full w-0 rounded-full bg-status-online transition-[width] duration-75" />
        </div>
      </div>
    </div>
  )
}

export default function VoiceSettingsPage() {
  const prefs = usePrefsStore()
  const canChooseOutput = typeof HTMLMediaElement !== "undefined" && "setSinkId" in HTMLMediaElement.prototype

  return (
    <SettingsSection title="Voice & Audio" description="These settings apply to this device.">
      <div className="flex flex-col gap-4 sm:flex-row">
        <DevicePicker
          id="input-device"
          label="Input Device"
          kind="audioinput"
          value={prefs.inputDeviceId}
          onChange={(inputDeviceId) => prefs.set({ inputDeviceId })}
        />
        {canChooseOutput && (
          <DevicePicker
            id="output-device"
            label="Output Device"
            kind="audiooutput"
            value={prefs.outputDeviceId}
            onChange={(outputDeviceId) => prefs.set({ outputDeviceId })}
          />
        )}
      </div>

      <div className="mt-8">
        <MicTest />
      </div>

      <div className="mt-8 flex flex-col gap-4">
        <DevicePicker
          id="camera-device"
          label="Camera"
          kind="videoinput"
          value={prefs.cameraDeviceId}
          onChange={(cameraDeviceId) => prefs.set({ cameraDeviceId })}
        />
        <CameraPreview deviceId={prefs.cameraDeviceId} />
      </div>

      <div className="mt-8">
        <Heading id="input-mode">Input Mode</Heading>
        <div role="radiogroup" aria-labelledby="input-mode" className="flex flex-col gap-2">
          {MODES.map((mode) => {
            const selected = prefs.inputMode === mode.value
            return (
              <button
                key={mode.value}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => prefs.set({ inputMode: mode.value })}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2.5 text-left",
                  selected ? "bg-item-selected" : "bg-sidebar hover:bg-item-hover"
                )}
              >
                <span
                  className={cn(
                    "flex size-5 shrink-0 items-center justify-center rounded-full border-2",
                    selected ? "border-primary" : "border-interactive"
                  )}
                >
                  {selected && <span className="size-2.5 rounded-full bg-primary" />}
                </span>
                <span>
                  <span className="block font-medium text-header">{mode.label}</span>
                  <span className="block text-sm text-muted-foreground">{mode.description}</span>
                </span>
              </button>
            )
          })}
        </div>
        {prefs.inputMode === "push-to-talk" && (
          <div className="mt-4">
            <Heading>Shortcut</Heading>
            <KeyRecorder value={prefs.pushToTalkKey} onChange={(pushToTalkKey) => prefs.set({ pushToTalkKey })} />
            <p className="mt-2 text-xs text-muted-foreground">
              Works while KTCord is the active tab. Letter keys are ignored while you&apos;re typing in a text box;
              modifier and function keys (like Right Ctrl or F13) always work.
            </p>
          </div>
        )}
      </div>

      <div className="mt-8">
        <Heading>Voice Processing</Heading>
        <SettingsToggle
          id="noise-suppression"
          label="Noise Suppression"
          description="Filters out background noise like fans and keyboards."
          checked={prefs.noiseSuppression}
          onCheckedChange={(noiseSuppression) => prefs.set({ noiseSuppression })}
        />
        <SettingsToggle
          id="echo-cancellation"
          label="Echo Cancellation"
          description="Keeps people from hearing themselves through your speakers."
          checked={prefs.echoCancellation}
          onCheckedChange={(echoCancellation) => prefs.set({ echoCancellation })}
        />
        <p className="mt-2 text-xs text-muted-foreground">Processing changes apply the next time you join voice.</p>
      </div>
    </SettingsSection>
  )
}
