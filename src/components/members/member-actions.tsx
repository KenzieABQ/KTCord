"use client"

import {
  ClockIcon,
  CopyIcon,
  GavelIcon,
  ShieldIcon,
  UserMinusIcon,
  UserPlusIcon,
} from "@/components/icons"
import { toast } from "@/lib/toast"

import {
  ContextMenuCheckboxItem,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
} from "@/components/ui/context-menu"
import {
  DropdownMenuCheckboxItem,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu"
import { errorMessage } from "@/lib/api/errors"
import { memberDisplayName } from "@/lib/members"
import { isTimedOut, TIMEOUT_OPTIONS, useModerationAbilities } from "@/lib/moderation"
import { useSetMemberRoles, useTimeoutMember } from "@/lib/queries/moderation"
import { useRelationships, useSendFriendRequest } from "@/lib/queries/social"
import { useUserId } from "@/lib/stores/auth-store"
import { useUiStore } from "@/lib/stores/ui-store"

import { UserContactItems } from "./user-actions"

export const PARTS = {
  dropdown: {
    Item: DropdownMenuItem,
    CheckboxItem: DropdownMenuCheckboxItem,
    Label: DropdownMenuLabel,
    Separator: DropdownMenuSeparator,
    Sub: DropdownMenuSub,
    SubTrigger: DropdownMenuSubTrigger,
    SubContent: DropdownMenuSubContent,
  },
  context: {
    Item: ContextMenuItem,
    CheckboxItem: ContextMenuCheckboxItem,
    Label: ContextMenuLabel,
    Separator: ContextMenuSeparator,
    Sub: ContextMenuSub,
    SubTrigger: ContextMenuSubTrigger,
    SubContent: ContextMenuSubContent,
  },
} as const

/**
 * Roles, timeout, kick and ban for one member, shown only when the caller is allowed.
 * Renders into either a dropdown or a right-click menu.
 */
export function MemberActionItems({
  kind,
  serverId,
  userId,
}: {
  kind: keyof typeof PARTS
  serverId: string
  userId: string
}) {
  const P = PARTS[kind]
  const abilities = useModerationAbilities(serverId, userId)
  const openDialog = useUiStore((s) => s.openDialog)
  const setRoles = useSetMemberRoles(serverId)
  const timeout = useTimeoutMember(serverId)
  const target = abilities.target
  const name = target ? memberDisplayName(target) : "member"
  const onError = (error: unknown) => toast.error(errorMessage(error))

  const anyModeration = abilities.canKick || abilities.canBan || abilities.canTimeout
  const selfId = useUserId()
  const addFriend = useSendFriendRequest()
  const { data: relationships } = useRelationships()
  const relationship = relationships?.find((r) => r.user.id === userId)
  const isSelf = userId === selfId

  return (
    <>
      {!isSelf && (
        <>
          <UserContactItems kind={kind} userId={userId} />
          {!relationship && target && (
            <P.Item
              onSelect={() =>
                addFriend.mutate(target.profile.username, {
                  onSuccess: () => toast.success(`Friend request sent to ${name}.`),
                  onError,
                })
              }
            >
              <UserPlusIcon /> Add Friend
            </P.Item>
          )}
          <P.Separator />
        </>
      )}
      {abilities.assignableRoles.length > 0 && target && (
        <P.Sub>
          <P.SubTrigger>
            <ShieldIcon /> Roles
          </P.SubTrigger>
          <P.SubContent className="max-h-72 w-52 overflow-y-auto bg-floating">
            {abilities.assignableRoles.map((role) => {
              const has = target.role_ids.includes(role.id)
              return (
                <P.CheckboxItem
                  key={role.id}
                  checked={has}
                  onSelect={(e) => e.preventDefault()}
                  onCheckedChange={(checked) =>
                    setRoles.mutate(
                      {
                        userId,
                        roleIds: checked
                          ? [...target.role_ids, role.id]
                          : target.role_ids.filter((id) => id !== role.id),
                      },
                      { onError }
                    )
                  }
                >
                  <span className="size-3 shrink-0 rounded-full" style={{ backgroundColor: role.color ?? "#99aab5" }} />
                  <span className="truncate">{role.name}</span>
                </P.CheckboxItem>
              )
            })}
          </P.SubContent>
        </P.Sub>
      )}

      {anyModeration && (
        <>
          <P.Separator />
          {abilities.canTimeout &&
            (isTimedOut(target) ? (
              <P.Item onSelect={() => timeout.mutate({ userId, until: null }, { onError })}>
                <ClockIcon /> Remove Timeout
              </P.Item>
            ) : (
              <P.Sub>
                <P.SubTrigger className="text-mention">
                  <ClockIcon /> Timeout {name}
                </P.SubTrigger>
                <P.SubContent className="w-44 bg-floating">
                  <P.Label className="text-xs text-muted-foreground">Can&apos;t send messages for…</P.Label>
                  {TIMEOUT_OPTIONS.map((option) => (
                    <P.Item
                      key={option.seconds}
                      onSelect={() =>
                        timeout.mutate(
                          { userId, until: new Date(Date.now() + option.seconds * 1000) },
                          {
                            onSuccess: () => toast.success(`${name} is timed out for ${option.label}.`),
                            onError,
                          }
                        )
                      }
                    >
                      {option.label}
                    </P.Item>
                  ))}
                </P.SubContent>
              </P.Sub>
            ))}
          {abilities.canKick && (
            <P.Item variant="destructive" onSelect={() => openDialog({ kind: "kick-member", serverId, userId })}>
              <UserMinusIcon /> Kick {name}
            </P.Item>
          )}
          {abilities.canBan && (
            <P.Item variant="destructive" onSelect={() => openDialog({ kind: "ban-member", serverId, userId })}>
              <GavelIcon /> Ban {name}
            </P.Item>
          )}
        </>
      )}

      <P.Separator />
      <P.Item onSelect={() => void navigator.clipboard.writeText(userId).then(() => toast.success("User ID copied."))}>
        <CopyIcon /> Copy User ID
      </P.Item>
    </>
  )
}
