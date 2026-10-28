import { format } from "date-fns"
import type { CSSProperties, ReactNode } from "react"

import { parseCosmetics, type Cosmetics } from "@/lib/cosmetics"
import { themeIsLight } from "@/lib/profile-display"
import { cn } from "@/lib/utils"

import { ProfileEffectLayer, StyledName } from "./cosmetics"
import type { PresenceStatus } from "./status-dot"
import { UserAvatar } from "./user-avatar"

export type ProfileCardData = {
  id: string
  username: string
  displayName: string
  avatarUrl: string | null
  bannerColor: string
  bannerUrl?: string | null
  /** Profile theme: the card is a gradient from primary (top) to accent (bottom). */
  themePrimary?: string | null
  themeAccent?: string | null
  /** Name style, avatar decoration and profile effect. */
  cosmetics?: Cosmetics | null
  pronouns?: string | null
  bio: string
  createdAt?: string
  customStatus?: string | null
}

/** Text colors for a themed card, so names and sections stay readable on any gradient. */
function themeVars(light: boolean): CSSProperties {
  return (
    light
      ? { "--header": "#060607", "--foreground": "#2e3035", "--muted-foreground": "#4e5058" }
      : { "--header": "#ffffff", "--foreground": "#dbdee1", "--muted-foreground": "#b5bac1" }
  ) as CSSProperties
}

/**
 * The profile card body: banner, avatar, names, About Me and "member since".
 * Used by the user popout, the DM side panel and the profile editor's live preview.
 * With a profile theme the whole card takes the user's two colors, as in Discord.
 */
export function ProfileCard({
  profile,
  status,
  className,
  fill = false,
  children,
}: {
  profile: ProfileCardData
  status?: PresenceStatus
  className?: string
  /** Stretch to the full height of its container (side panels), as in Discord's DM profile. */
  fill?: boolean
  /** Extra sections, such as roles or actions. */
  children?: ReactNode
}) {
  const themed = Boolean(profile.themePrimary && profile.themeAccent)
  const light = themed && themeIsLight(profile.themePrimary!, profile.themeAccent!)
  const tall = themed || Boolean(profile.bannerUrl)

  return (
    <div
      className={cn(
        "relative w-full overflow-hidden rounded-lg bg-card shadow-lg",
        themed && "p-1",
        fill && "flex min-h-full flex-col",
        className
      )}
      style={
        themed
          ? {
              background: `linear-gradient(180deg, ${profile.themePrimary} 0%, ${profile.themeAccent} 100%)`,
              ...themeVars(light),
            }
          : undefined
      }
    >
      <ProfileEffectLayer kind={profile.cosmetics?.effect} />
      <div
        className={cn("bg-cover bg-center", tall ? "h-[106px]" : "h-[60px]", themed && "rounded-t-md")}
        style={{
          backgroundColor: profile.bannerUrl ? undefined : themed ? profile.themePrimary! : profile.bannerColor,
          backgroundImage: profile.bannerUrl ? `url("${profile.bannerUrl}")` : undefined,
        }}
      />
      <div
        className={cn(
          "relative px-4 pb-4",
          themed && (light ? "bg-white/45" : "bg-black/35"),
          themed && "rounded-b-md",
          fill && "flex-1"
        )}
      >
        <div
          className={cn("absolute -top-10 left-4 rounded-full p-1.5", themed ? "" : "bg-card")}
          style={themed ? { backgroundColor: profile.themePrimary! } : undefined}
        >
          <UserAvatar
            userId={profile.id}
            name={profile.displayName}
            src={profile.avatarUrl}
            status={status}
            surface="card"
            ringColor={themed ? profile.themePrimary! : undefined}
            decoration={profile.cosmetics?.decoration}
            className="size-20"
            statusSize="lg"
            animate="always"
          />
        </div>
        <div className="pt-12">
          <p className="truncate text-xl leading-tight font-bold text-header">
            <StyledName cosmetics={profile.cosmetics} motion="always">
              {profile.displayName}
            </StyledName>
          </p>
          <p className="truncate text-sm text-foreground">
            {profile.username}
            {profile.pronouns && <span className="text-muted-foreground"> • {profile.pronouns}</span>}
          </p>
          {profile.customStatus && (
            <p className="mt-1 truncate text-sm text-muted-foreground">{profile.customStatus}</p>
          )}
        </div>

        <div
          className={cn(
            "mt-3 space-y-3 rounded-md p-3",
            themed ? (light ? "bg-white/50" : "bg-black/30") : "bg-floating/40 dark:bg-floating/60"
          )}
        >
          {profile.bio && (
            <section>
              <h3 className="text-xs font-bold tracking-wide text-header uppercase">About Me</h3>
              <p className="mt-1 text-sm break-words whitespace-pre-wrap text-foreground">{profile.bio}</p>
            </section>
          )}
          {profile.createdAt && (
            <section>
              <h3 className="text-xs font-bold tracking-wide text-header uppercase">Member Since</h3>
              <p className="mt-1 text-sm text-foreground">{format(new Date(profile.createdAt), "MMM d, yyyy")}</p>
            </section>
          )}
          {children}
        </div>
      </div>
    </div>
  )
}

/** The theme, banner and cosmetics fields of a profile row, for ProfileCardData. */
export function profileThemeFields(profile: {
  banner_url?: string | null
  theme_primary?: string | null
  theme_accent?: string | null
  cosmetics?: unknown
  pronouns?: string | null
}) {
  return {
    bannerUrl: profile.banner_url ?? null,
    themePrimary: profile.theme_primary ?? null,
    themeAccent: profile.theme_accent ?? null,
    cosmetics: parseCosmetics(profile.cosmetics),
    pronouns: profile.pronouns ?? null,
  }
}
