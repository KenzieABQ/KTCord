"use client"

import { HeadphoneOffIcon, MicOffIcon, PhoneOffIcon, VolumeXIcon } from "lucide-react"
import type { ReactNode } from "react"
import { toast } from "sonner"

import {
  ContextMenu,
  ContextMenuCheckboxItem,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
import { Slider } from "@/components/ui/slider"
import { errorMessage } from "@/lib/api/errors"
import { hasPermission, Permission, topRolePosition } from "@/lib/permissions"
import { useDisconnectFromVoice, useSetVoiceModeration } from "@/lib/queries/moderation"
import { useMembers, useRoles, useServer, useServerPermissions } from "@/lib/queries/servers"
import { useUserId } from "@/lib/stores/auth-store"
import { usePrefsStore } from "@/lib/stores/prefs-store"
import type { VoiceMember } from "@/lib/voice/roster"

/** Discord's User Volume slider (0-100%) and a mute that only affects you. */
function PlaybackControls({ userId }: { userId: string }) {
  const volume = usePrefsStore((s) => s.userVolumes[userId] ?? 100)
  const muted = usePrefsStore((s) => Boolean(s.localMutes[userId]))
  const set = usePrefsStore((s) => s.set)
  return (
    <>
      <ContextMenuLabel className="text-xs text-muted-foreground">User Volume</ContextMenuLabel>
      <div className="flex items-center gap-3 px-2 pb-2" onKeyDown={(e) => e.stopPropagation()}>
        <Slider
          aria-label="User volume"
          min={0}
          max={100}
          step={1}
          value={[volume]}
          onValueChange={([v]) => set({ userVolumes: { ...usePrefsStore.getState().userVolumes, [userId]: v } })}
          className="flex-1"
        />
        <span className="w-9 text-right text-xs text-muted-foreground tabular-nums">{volume}%</span>
      </div>
      <ContextMenuCheckboxItem
        checked={muted}
        onCheckedChange={(on) => {
          const localMutes = { ...usePrefsStore.getState().localMutes }
          if (on) localMutes[userId] = true
          else delete localMutes[userId]
          set({ localMutes })
        }}
      >
        <VolumeXIcon /> Mute
      </ContextMenuCheckboxItem>
    </>
  )
}

/**
 * Right-click menu for someone else in voice: their User Volume and a mute just for you,
 * plus server mute, server deafen and disconnect for moderators (Timeout Members) above
 * them in the role list. Your own entry gets the plain element.
 */
export function VoiceMemberMenu({
  serverId,
  person,
  children,
}: {
  serverId: string
  person: VoiceMember
  children: ReactNode
}) {
  const userId = useUserId()
  const { data: server } = useServer(serverId)
  const { data: roles } = useRoles(serverId)
  const { data: members } = useMembers(serverId)
  const { permissions, topPosition, isOwner } = useServerPermissions(serverId)
  const setModeration = useSetVoiceModeration(serverId)
  const disconnect = useDisconnectFromVoice(serverId)

  const target = members?.find((m) => m.user_id === person.userId)
  const targetTop =
    target && server
      ? topRolePosition({
          userId: target.user_id,
          ownerId: server.owner_id,
          roles: roles ?? [],
          memberRoleIds: target.role_ids,
        })
      : Infinity
  const canModerate =
    hasPermission(permissions, Permission.MODERATE_MEMBERS) &&
    person.userId !== userId &&
    person.userId !== server?.owner_id &&
    (isOwner || topPosition > targetTop)
  if (person.userId === userId) return <>{children}</>

  const onError = (error: unknown) => toast.error(errorMessage(error))
  const set = (patch: { mute?: boolean; deaf?: boolean }) =>
    setModeration.mutate(
      {
        userId: person.userId,
        mute: patch.mute ?? Boolean(person.serverMute),
        deaf: patch.deaf ?? Boolean(person.serverDeaf),
      },
      { onError }
    )

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent className="w-56 bg-floating">
        <PlaybackControls userId={person.userId} />
        {canModerate && (
          <ModerationItems
            person={person}
            set={set}
            onDisconnect={() =>
              disconnect.mutate(person.userId, { onError, onSuccess: () => toast("Disconnected from voice.") })
            }
          />
        )}
      </ContextMenuContent>
    </ContextMenu>
  )
}

function ModerationItems({
  person,
  set,
  onDisconnect,
}: {
  person: VoiceMember
  set: (patch: { mute?: boolean; deaf?: boolean }) => void
  onDisconnect: () => void
}) {
  return (
    <>
      <ContextMenuSeparator />
      <ContextMenuLabel className="text-xs text-muted-foreground">Voice moderation</ContextMenuLabel>
      <ContextMenuCheckboxItem checked={Boolean(person.serverMute)} onCheckedChange={(mute) => set({ mute })}>
        <MicOffIcon className="text-destructive" /> Server Mute
      </ContextMenuCheckboxItem>
      <ContextMenuCheckboxItem checked={Boolean(person.serverDeaf)} onCheckedChange={(deaf) => set({ deaf })}>
        <HeadphoneOffIcon className="text-destructive" /> Server Deafen
      </ContextMenuCheckboxItem>
      <ContextMenuSeparator />
      <ContextMenuItem variant="destructive" onSelect={onDisconnect}>
        <PhoneOffIcon /> Disconnect
      </ContextMenuItem>
    </>
  )
}
