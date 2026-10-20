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
