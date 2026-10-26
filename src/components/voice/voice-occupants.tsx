"use client"

import { HeadphoneOffIcon, MicOffIcon } from "lucide-react"

import { UserAvatar } from "@/components/profile/user-avatar"
import { UserPopover } from "@/components/profile/user-popover"
import { memberDisplayName } from "@/lib/members"
import { useMembers } from "@/lib/queries/servers"
import { cn } from "@/lib/utils"
import type { VoiceMember } from "@/lib/voice/roster"

import { useVoicePeople } from "./use-voice-people"
import { VoiceMemberMenu } from "./voice-member-menu"

/** Mute and deafen icons for someone in voice; red when a moderator did it (server mute/deafen). */
export function VoiceStateIcons({ member, className }: { member: VoiceMember; className?: string }) {
  const muted = member.serverMute || member.selfMute
  const deafened = member.serverDeaf || member.selfDeaf
  if (!muted && !deafened) return null
  return (
    <span className={cn("flex shrink-0 items-center gap-1 text-muted-foreground", className)}>
      {muted && (
        <MicOffIcon
          aria-label={member.serverMute ? "Server muted" : "Muted"}
          className={cn("size-3.5", member.serverMute && "text-destructive")}
        />
      )}
      {deafened && (
        <HeadphoneOffIcon
          aria-label={member.serverDeaf ? "Server deafened" : "Deafened"}
          className={cn("size-3.5", member.serverDeaf && "text-destructive")}
        />
      )}
    </span>
  )
}

/** The people connected to a voice channel, listed under it in the sidebar. */
export function VoiceOccupants({ serverId, channelId }: { serverId: string; channelId: string }) {
  const roster = useVoicePeople(serverId, channelId)
  const { data: members } = useMembers(serverId)
  if (roster.length === 0) return null

  return (
    <ul aria-label="Connected" className="mr-2 mb-1 ml-9 flex flex-col gap-px">
      {roster.map((person) => {
        const member = members?.find((m) => m.user_id === person.userId)
        const name = member ? memberDisplayName(member) : "Someone"
        return (
          <li key={person.userId}>
            <VoiceMemberMenu serverId={serverId} person={person}>
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
            </VoiceMemberMenu>
          </li>
        )
      })}
    </ul>
  )
}
