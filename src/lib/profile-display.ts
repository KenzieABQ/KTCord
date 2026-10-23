import type { Profile } from "@/lib/api/profiles"

export function displayNameOf(
  profile: Pick<Profile, "display_name" | "username"> | null | undefined
): string {
  return profile?.display_name || profile?.username || "Unknown"
}

export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "?"
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[1][0]).toUpperCase()
}

/** Banner presets for onboarding and the profile editor. */
export const BANNER_PRESETS = [
  "#5865f2",
  "#3ba55c",
  "#faa61a",
  "#ed4245",
  "#eb459e",
  "#9b59b6",
  "#00a8fc",
  "#1abc9c",
  "#2b2d31",
] as const

/** Profile theme presets (primary, accent), like Discord's suggested profile colors. */
export const THEME_PRESETS: { name: string; primary: string; accent: string }[] = [
  { name: "Blurple", primary: "#5865f2", accent: "#1e1f22" },
  { name: "Midnight", primary: "#0b0c0e", accent: "#2b2d31" },
  { name: "Sunset", primary: "#f97316", accent: "#9d174d" },
  { name: "Forest", primary: "#166534", accent: "#052e16" },
  { name: "Ocean", primary: "#0ea5e9", accent: "#1e3a8a" },
  { name: "Blossom", primary: "#f9a8d4", accent: "#a855f7" },
  { name: "Lemon", primary: "#fde047", accent: "#65a30d" },
  { name: "Ember", primary: "#ef4444", accent: "#1c1917" },
]

/** Relative luminance of a #rrggbb color (0 = black, 1 = white), per WCAG. */
export function luminance(hex: string): number {
  const channels = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
  const [r, g, b] = channels.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** Whether text on a themed card should be dark: the theme's colors are light on average. */
export function themeIsLight(primary: string, accent: string): boolean {
  return (luminance(primary) + luminance(accent)) / 2 > 0.4
}
