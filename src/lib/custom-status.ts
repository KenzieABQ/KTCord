import type { Profile } from "@/lib/api/profiles"

type WithCustomStatus = Pick<Profile, "custom_status_text" | "custom_status_emoji" | "custom_status_expires_at">

/** The custom status if it's set and hasn't expired. */
export function activeCustomStatus(
  profile: WithCustomStatus | null | undefined,
  now = new Date()
): { emoji: string | null; text: string | null } | null {
  if (!profile || (!profile.custom_status_text && !profile.custom_status_emoji)) return null
  if (profile.custom_status_expires_at && new Date(profile.custom_status_expires_at) <= now) return null
  return { emoji: profile.custom_status_emoji, text: profile.custom_status_text }
}

export const CLEAR_AFTER = [
  { label: "Today", value: "today" },
  { label: "4 hours", value: "4h" },
  { label: "1 hour", value: "1h" },
  { label: "30 minutes", value: "30m" },
  { label: "Don't clear", value: "never" },
] as const

export type ClearAfter = (typeof CLEAR_AFTER)[number]["value"]

export function expiryFor(choice: ClearAfter, now = new Date()): Date | null {
  switch (choice) {
    case "today": {
      const end = new Date(now)
      end.setHours(23, 59, 59, 999)
      return end
    }
    case "4h":
      return new Date(now.getTime() + 4 * 3600_000)
    case "1h":
      return new Date(now.getTime() + 3600_000)
    case "30m":
      return new Date(now.getTime() + 30 * 60_000)
    case "never":
      return null
  }
}
