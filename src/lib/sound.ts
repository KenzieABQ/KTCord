let context: AudioContext | null = null

/** A short two-note chime for new-message notifications, synthesized so there's no asset to load. */
export function playNotificationSound() {
  if (typeof window === "undefined" || !("AudioContext" in window)) return
  try {
    context ??= new AudioContext()
    // Browsers keep audio suspended until the user has interacted with the page.
    if (context.state === "suspended") void context.resume()
    const now = context.currentTime
    for (const [i, frequency] of [880, 1320].entries()) {
      const start = now + i * 0.09
      const osc = context.createOscillator()
      const gain = context.createGain()
      osc.type = "sine"
      osc.frequency.value = frequency
      gain.gain.setValueAtTime(0.0001, start)
      gain.gain.exponentialRampToValueAtTime(0.12, start + 0.01)
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.18)
      osc.connect(gain).connect(context.destination)
      osc.start(start)
      osc.stop(start + 0.2)
    }
  } catch {
    // Sound is a nicety; never let it break message handling.
  }
}
