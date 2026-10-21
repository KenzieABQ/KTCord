let context: AudioContext | null = null

/** Plays a short sequence of sine notes; synthesized so there are no assets to load. */
function chime(frequencies: number[], step = 0.09, volume = 0.12) {
  if (typeof window === "undefined" || !("AudioContext" in window)) return
  try {
    context ??= new AudioContext()
    // Browsers keep audio suspended until the user has interacted with the page.
    if (context.state === "suspended") void context.resume()
    const now = context.currentTime
    frequencies.forEach((frequency, i) => {
      const start = now + i * step
      const osc = context!.createOscillator()
      const gain = context!.createGain()
      osc.type = "sine"
      osc.frequency.value = frequency
      gain.gain.setValueAtTime(0.0001, start)
      gain.gain.exponentialRampToValueAtTime(volume, start + 0.01)
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.18)
      osc.connect(gain).connect(context!.destination)
      osc.start(start)
      osc.stop(start + 0.2)
    })
  } catch {
    // Sound is a nicety; never let it break anything else.
  }
}

/** A short two-note chime for new-message notifications. */
export function playNotificationSound() {
  chime([880, 1320])
}

/** Rising notes when someone (or you) joins your voice channel, falling when they leave. */
export function playVoiceSound(kind: "join" | "leave") {
  chime(kind === "join" ? [523, 784] : [784, 523], 0.08, 0.08)
}
