import { format } from "date-fns"
import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

import type { PresenceStatus } from "./status-dot"
import { UserAvatar } from "./user-avatar"

export type ProfileCardData = {
  id: string
  username: string
  displayName: string
  avatarUrl: string | null
  bannerColor: string
  bio: string
  createdAt?: string
  customStatus?: string | null
}

/**
 * The profile card body: banner, avatar, names, About Me and "member since".
 * Used for the live preview in the profile editor and, later, the user popout.
 */
export function ProfileCard({
  profile,
  status,
  className,
  children,
}: {
  profile: ProfileCardData
  status?: PresenceStatus
  className?: string
  /** Extra sections, such as roles or actions. */
  children?: ReactNode
}) {
  return (
    <div className={cn("w-full overflow-hidden rounded-lg bg-card shadow-lg", className)}>
      <div className="h-[60px]" style={{ backgroundColor: profile.bannerColor }} />
      <div className="relative px-4 pb-4">
        <div className="absolute -top-10 left-4 rounded-full bg-card p-1.5">
          <UserAvatar
            userId={profile.id}
            name={profile.displayName}
            src={profile.avatarUrl}
            status={status}
            surface="card"
            className="size-20"
            statusClassName="size-5 right-0.5 bottom-0.5 ring-[5px]"
          />
        </div>
        <div className="pt-12">
          <p className="truncate text-xl leading-tight font-bold text-header">
            {profile.displayName}
          </p>
          <p className="truncate text-sm text-foreground">{profile.username}</p>
          {profile.customStatus && (
            <p className="mt-1 truncate text-sm text-muted-foreground">{profile.customStatus}</p>
          )}
        </div>

        <div className="mt-3 space-y-3 rounded-md bg-floating/40 p-3 dark:bg-floating/60">
          {profile.bio && (
            <section>
              <h3 className="text-xs font-bold tracking-wide text-header uppercase">About Me</h3>
              <p className="mt-1 text-sm break-words whitespace-pre-wrap text-foreground">
                {profile.bio}
              </p>
            </section>
          )}
          {profile.createdAt && (
            <section>
              <h3 className="text-xs font-bold tracking-wide text-header uppercase">
                Member Since
              </h3>
              <p className="mt-1 text-sm text-foreground">
                {format(new Date(profile.createdAt), "MMM d, yyyy")}
              </p>
            </section>
          )}
          {children}
        </div>
      </div>
    </div>
  )
}
