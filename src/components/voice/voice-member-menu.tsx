"use client"

import { HeadphoneOffIcon, MicOffIcon, PhoneOffIcon } from "lucide-react"
import type { ReactNode } from "react"
import { toast } from "sonner"

import { ContextMenu, ContextMenuCheckboxItem, ContextMenuContent, ContextMenuItem, ContextMenuLabel, ContextMenuSeparator, ContextMenuTrigger } from "@/components/ui/context-menu"
import { errorMessage } from "@/lib/api/errors"
import { hasPermission, Permission, topRolePosition } from "@/lib/permissions"
import { useDisconnectFromVoice, useSetVoiceModeration } from "@/lib/queries/moderation"
import { useMembers, useRoles, useServer, useServerPermissions } from "@/lib/queries/servers"
import { useUserId } from "@/lib/stores/auth-store"
import type { VoiceMember } from "@/lib/voice/roster"

/**
 * Right-click menu for someone in voice: server mute, server deafen and disconnect, for
 * moderators (Timeout Members) above them in the role list. Others get the plain element.
 */
export function VoiceMemberMenu({ serverId, person, children }: { serverId: string; person: VoiceMember; children: ReactNode }) {
  const userId = useUserId()
  const { data: server } = useServer(serverId)
  const { data: roles } = useRoles(serverId)
  const { data: members } = useMembers(serverId)
  const { permissions, topPosition, isOwner } = useServerPermissions(serverId)
  const setModeration = useSetVoiceModeration(serverId)
  const disconnect = useDisconnectFromVoice(serverId)

  const target = members?.find((m) => m.user_id === person.userId)
  const targetTop =
    target && server ? topRolePosition({ userId: target.user_id, ownerId: server.owner_id, roles: roles ?? [], memberRoleIds: target.role_ids }) : Infinity
  const canModerate =
    hasPermission(permissions, Permission.MODERATE_MEMBERS) &&
    person.userId !== userId &&
    person.userId !== server?.owner_id &&
    (isOwner || topPosition > targetTop)
  if (!canModerate) return <>{children}</>

  const onError = (error: unknown) => toast.error(errorMessage(error))
  const set = (patch: { mute?: boolean; deaf?: boolean }) =>
    setModeration.mutate(
      { userId: person.userId, mute: patch.mute ?? Boolean(person.serverMute), deaf: patch.deaf ?? Boolean(person.serverDeaf) },
      { onError }
    )

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent className="w-52 bg-floating">
        <ContextMenuLabel className="text-xs text-muted-foreground">Voice moderation</ContextMenuLabel>
        <ContextMenuCheckboxItem checked={Boolean(person.serverMute)} onCheckedChange={(mute) => set({ mute })}>
          <MicOffIcon className="text-destructive" /> Server Mute
        </ContextMenuCheckboxItem>
        <ContextMenuCheckboxItem checked={Boolean(person.serverDeaf)} onCheckedChange={(deaf) => set({ deaf })}>
          <HeadphoneOffIcon className="text-destructive" /> Server Deafen
        </ContextMenuCheckboxItem>
        <ContextMenuSeparator />
        <ContextMenuItem
          variant="destructive"
          onSelect={() =>
            disconnect.mutate(person.userId, {
              onError,
              onSuccess: () => toast("Disconnected from voice."),
            })
          }
        >
          <PhoneOffIcon /> Disconnect
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}
