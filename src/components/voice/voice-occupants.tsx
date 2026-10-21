"use client"

import { HeadphoneOffIcon, MicOffIcon } from "lucide-react"

import { UserAvatar } from "@/components/profile/user-avatar"
import { UserPopover } from "@/components/profile/user-popover"
import { memberDisplayName } from "@/lib/members"
import { useMembers } from "@/lib/queries/servers"
import { useVoiceRoster } from "@/lib/stores/voice-store"
import { cn } from "@/lib/utils"
import type { VoiceMember } from "@/lib/voice/roster"

/** Mute and deafen icons for someone in voice. */
export function VoiceStateIcons({ member, className }: { member: VoiceMember; className?: string }) {
  if (!member.selfMute && !member.selfDeaf) return null
  return (
    <span className={cn("flex shrink-0 items-center gap-1 text-muted-foreground", className)}>
      {member.selfMute && <MicOffIcon aria-label="Muted" className="size-3.5" />}
      {member.selfDeaf && <HeadphoneOffIcon aria-label="Deafened" className="size-3.5" />}
    </span>
  )
}

/** The people connected to a voice channel, listed under it in the sidebar. */
export function VoiceOccupants({ serverId, channelId }: { serverId: string; channelId: string }) {
  const roster = useVoiceRoster(channelId)
  const { data: members } = useMembers(serverId)
  if (roster.length === 0) return null

  return (
    <ul aria-label="Connected" className="mr-2 mb-1 ml-9 flex flex-col gap-px">
      {roster.map((person) => {
        const member = members?.find((m) => m.user_id === person.userId)
        const name = member ? memberDisplayName(member) : "Someone"
        return (
          <li key={person.userId}>
            <UserPopover userId={person.userId} serverId={serverId}>
              <button
                type="button"
                className="flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-muted-foreground hover:bg-item-hover hover:text-interactive-hover"
              >
                <UserAvatar
                  userId={person.userId}
                  name={name}
                  src={member?.profile.avatar_url}
                  className={cn(
                    "size-6 rounded-full ring-2 ring-transparent transition-shadow",
                    person.speaking && "ring-status-online"
                  )}
                />
                <span className={cn("min-w-0 flex-1 truncate text-sm", person.speaking && "text-header")}>
                  {name}
                </span>
                <VoiceStateIcons member={person} />
                {person.speaking && <span className="sr-only">(speaking)</span>}
              </button>
            </UserPopover>
          </li>
        )
      })}
    </ul>
  )
}
