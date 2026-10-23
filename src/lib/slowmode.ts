/** Discord's slow mode stops, in seconds (0 = off, up to 6 hours). */
export const SLOWMODE_STEPS = [0, 5, 10, 15, 30, 60, 120, 300, 600, 900, 1800, 3600, 7200, 21600]

/** "Off", "30s", "5m", "2h". */
export function formatSlowmode(seconds: number): string {
  if (seconds === 0) return "Off"
  if (seconds < 60) return `${seconds}s`
  if (seconds < 3600) return `${seconds / 60}m`
  return `${seconds / 3600}h`
}
