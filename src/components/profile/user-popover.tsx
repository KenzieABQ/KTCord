"use client"

import { MessageCircleIcon, PencilIcon } from "lucide-react"
import Link from "next/link"
import { useState, type ComponentProps, type ReactNode } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Skeleton } from "@/components/ui/skeleton"
import { errorMessage } from "@/lib/api/errors"
import { activeCustomStatus } from "@/lib/custom-status"
import { memberDisplayName } from "@/lib/members"
import { displayNameOf } from "@/lib/profile-display"
import { useProfile } from "@/lib/queries/profiles"
import { useMembers, useRoles } from "@/lib/queries/servers"
import { useOpenDm } from "@/lib/queries/social"
import { useUserId } from "@/lib/stores/auth-store"
import { useComposerStore } from "@/lib/stores/composer-store"
import { usePresenceStatus } from "@/lib/stores/presence-store"

import { ProfileCard } from "./profile-card"

function PopoverBody({ userId, serverId, onDone }: { userId: string; serverId: string | null; onDone: () => void }) {
  const selfId = useUserId()
  const { data: members } = useMembers(serverId ?? undefined)
  const { data: roles } = useRoles(serverId ?? undefined)
  const member = members?.find((m) => m.user_id === userId)
  const { data: fullProfile } = useProfile(userId)
  const status = usePresenceStatus(userId)
  const openDm = useOpenDm()
  const [message, setMessage] = useState("")

  const profile = fullProfile ?? member?.profile
  if (!profile) {
    return (
      <div className="flex flex-col gap-3 p-4">
        <Skeleton className="h-14 w-full bg-item-selected/60" />
        <Skeleton className="size-16 rounded-full bg-item-selected/60" />
        <Skeleton className="h-4 w-32 bg-item-selected/60" />
      </div>
    )
  }

  const custom = activeCustomStatus(profile)
  const memberRoles = member
    ? (roles ?? []).filter((r) => !r.is_default && member.role_ids.includes(r.id)).sort((a, b) => b.position - a.position)
    : []
  const isSelf = userId === selfId

  async function send() {
    try {
      const channelId = await openDm.mutateAsync(userId)
      // Hand what they typed to the DM's composer.
      if (message.trim()) useComposerStore.getState().setDraft(channelId, message.trim())
      onDone()
    } catch (error) {
      toast.error(errorMessage(error))
    }
  }

  return (
    <ProfileCard
      className="rounded-none shadow-none"
      status={status}
      profile={{
        id: profile.id,
        username: profile.username,
        displayName: member ? memberDisplayName(member) : displayNameOf(profile),
        avatarUrl: profile.avatar_url,
        bannerColor: profile.banner_color,
        bio: profile.bio,
        createdAt: profile.created_at,
        customStatus: custom ? [custom.emoji, custom.text].filter(Boolean).join(" ") : null,
      }}
    >
      {memberRoles.length > 0 && (
        <section>
          <h3 className="text-xs font-bold tracking-wide text-header uppercase">
            {memberRoles.length === 1 ? "Role" : "Roles"}
          </h3>
          <div className="mt-1.5 flex flex-wrap gap-1">
            {memberRoles.map((role) => (
              <span key={role.id} className="flex items-center gap-1 rounded-sm bg-sidebar px-1.5 py-0.5 text-xs text-foreground">
                <span className="size-2.5 rounded-full" style={{ backgroundColor: role.color ?? "#99aab5" }} />
                {role.name}
              </span>
            ))}
          </div>
        </section>
      )}
      {isSelf ? (
        <Button asChild variant="secondary" className="w-full">
          <Link href="/settings/profile" onClick={onDone}>
            <PencilIcon /> Edit Profile
          </Link>
        </Button>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            void send()
          }}
          className="flex gap-1.5"
        >
          <input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={`Message @${profile.username}`}
            aria-label={`Message @${profile.username}`}
            className="h-9 min-w-0 flex-1 rounded-md bg-input px-2.5 text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
          />
          <Button type="submit" size="icon-lg" aria-label="Send Message" disabled={openDm.isPending}>
            <MessageCircleIcon />
          </Button>
        </form>
      )}
    </ProfileCard>
  )
}

/** Click a name or avatar to see someone's profile card: roles, bio, and a way to message them. */
export function UserPopover({
  userId,
  serverId = null,
  side = "right",
  children,
  ...triggerProps
}: {
  userId: string | null
  serverId?: string | null
  side?: "left" | "right" | "top" | "bottom"
  children: ReactNode
} & Omit<ComponentProps<typeof PopoverTrigger>, "children" | "asChild">) {
  const [open, setOpen] = useState(false)
  if (!userId) return children
  return (
    <Popover open={open} onOpenChange={setOpen}>
      {/* Extra props (e.g. from a wrapping ContextMenuTrigger) land on the trigger element. */}
      <PopoverTrigger asChild {...triggerProps}>
        {children}
      </PopoverTrigger>
      <PopoverContent
        side={side}
        align="start"
        sideOffset={8}
        collisionPadding={12}
        className="w-[300px] overflow-hidden border-0 bg-card p-0 shadow-2xl"
      >
        {open && <PopoverBody userId={userId} serverId={serverId} onDone={() => setOpen(false)} />}
      </PopoverContent>
    </Popover>
  )
}
