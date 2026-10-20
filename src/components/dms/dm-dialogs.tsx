"use client"

import { SearchIcon, UsersIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import { useMemo, useState } from "react"
import { toast } from "sonner"

import { UserAvatar } from "@/components/profile/user-avatar"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { dmTitle } from "@/lib/api/dms"
import { errorMessage } from "@/lib/api/errors"
import { rankMatches } from "@/lib/mentions"
import { displayNameOf } from "@/lib/profile-display"
import {
  useAddGroupDmRecipients,
  useCreateGroupDm,
  useDm,
  useOpenDm,
  useRelationships,
  useVisibleDms,
} from "@/lib/queries/social"
import { useUserId } from "@/lib/stores/auth-store"
import { useUiStore } from "@/lib/stores/ui-store"

import { DmAvatar } from "./dm-avatar"

const MAX_GROUP = 10

/** Pick friends for a new DM/group DM, or to add to an existing group DM. */
export function SelectFriendsDialog({
  addToChannelId,
  preselect,
}: {
  addToChannelId?: string
  /** Friends ticked from the start (e.g. the other person when growing a 1:1 into a group). */
  preselect?: string[]
}) {
  const closeDialog = useUiStore((s) => s.closeDialog)
  const { data: relationships } = useRelationships()
  const { data: existing } = useDm(addToChannelId)
  const openDm = useOpenDm()
  const createGroup = useCreateGroupDm()
  const addRecipients = useAddGroupDmRecipients()
  const [query, setQuery] = useState("")
  const [picked, setPicked] = useState<string[]>(preselect ?? [])

  const inGroup = new Set(existing?.recipients.map((r) => r.user_id) ?? [])
  const friends = (relationships ?? []).filter((r) => r.kind === "friend" && !inGroup.has(r.user.id))
  const visible = rankMatches(friends, query, (r) => [r.user.username, displayNameOf(r.user)], 50)
  // Including you: a new group has picked + 1; an existing one has its current size.
  const capacity = MAX_GROUP - (existing ? existing.recipients.length : 1)
  const remaining = capacity - picked.length
  const busy = openDm.isPending || createGroup.isPending || addRecipients.isPending

  async function submit() {
    try {
      if (existing) {
        await addRecipients.mutateAsync({ channelId: existing.id, userIds: picked })
      } else if (picked.length === 1) {
        await openDm.mutateAsync(picked[0])
      } else {
        await createGroup.mutateAsync(picked)
      }
      closeDialog()
    } catch (error) {
      toast.error(errorMessage(error))
    }
  }

  return (
    <div>
      <DialogHeader>
        <DialogTitle>{existing ? "Add Friends" : "Select Friends"}</DialogTitle>
        <DialogDescription>
          {remaining > 0 ? `You can add ${remaining} more friend${remaining === 1 ? "" : "s"}.` : "This group is full."}
        </DialogDescription>
      </DialogHeader>
      <div className="relative mt-4">
        <SearchIcon className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          autoFocus
          placeholder="Type the username of a friend"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-8"
          aria-label="Search friends"
        />
      </div>
      <div className="mt-3 max-h-72 overflow-y-auto">
        {friends.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {existing ? "All of your friends are already here." : "You don't have any friends to add yet."}
          </p>
        ) : (
          visible.map((r) => {
            const checked = picked.includes(r.user.id)
            return (
              <label
                key={r.user.id}
                className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 hover:bg-item-hover has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50"
              >
                <UserAvatar userId={r.user.id} name={displayNameOf(r.user)} src={r.user.avatar_url} className="size-8" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-header">{displayNameOf(r.user)}</span>
                  <span className="block truncate text-xs text-muted-foreground">{r.user.username}</span>
                </span>
                <Checkbox
                  checked={checked}
                  disabled={!checked && remaining <= 0}
                  onCheckedChange={(on) =>
                    setPicked((list) => (on ? [...list, r.user.id] : list.filter((id) => id !== r.user.id)))
                  }
                />
              </label>
            )
          })
        )}
      </div>
      <DialogFooter className="-mx-6 mt-4 -mb-6 rounded-b-xl bg-sidebar px-4 py-3">
        <Button className="w-full sm:w-auto" disabled={picked.length === 0 || busy} onClick={submit}>
          {existing ? "Add" : picked.length > 1 ? "Create Group DM" : "Create DM"}
        </Button>
      </DialogFooter>
    </div>
  )
}

/** "Find or start a conversation": jump to a DM or message a friend. */
export function FindConversationDialog() {
  const router = useRouter()
  const userId = useUserId()
  const closeDialog = useUiStore((s) => s.closeDialog)
  const { data: dms } = useVisibleDms()
  const { data: relationships } = useRelationships()
  const openDm = useOpenDm()
  const [query, setQuery] = useState("")

  const results = useMemo(() => {
    const dmItems = (dms ?? []).map((dm) => ({ key: `dm:${dm.id}`, label: dmTitle(dm, userId), dm, friend: undefined }))
    const dmUsers = new Set(
      (dms ?? []).filter((dm) => dm.type === "dm").flatMap((dm) => dm.recipients.map((r) => r.user_id))
    )
    const friendItems = (relationships ?? [])
      .filter((r) => r.kind === "friend" && !dmUsers.has(r.user.id))
      .map((r) => ({ key: `friend:${r.user.id}`, label: displayNameOf(r.user), dm: undefined, friend: r.user }))
    return rankMatches([...dmItems, ...friendItems], query, (item) => [item.label, item.friend?.username ?? ""], 12)
  }, [dms, relationships, query, userId])

  return (
    <div>
      <DialogHeader>
        <DialogTitle>Find or start a conversation</DialogTitle>
      </DialogHeader>
      <Input
        autoFocus
        className="mt-4 h-11 text-base"
        placeholder="Where would you like to go?"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        aria-label="Search conversations"
      />
      <ul className="mt-3 max-h-80 overflow-y-auto">
        {results.map((item) => (
          <li key={item.key}>
            <button
              type="button"
              className="flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-left hover:bg-item-hover"
              onClick={async () => {
                if (item.dm) {
                  router.push(`/channels/me/${item.dm.id}`)
                  closeDialog()
                } else if (item.friend) {
                  try {
                    await openDm.mutateAsync(item.friend.id)
                    closeDialog()
                  } catch (error) {
                    toast.error(errorMessage(error))
                  }
                }
              }}
            >
              {item.dm ? (
                <DmAvatar dm={item.dm} />
              ) : (
                <UserAvatar userId={item.friend!.id} name={item.label} src={item.friend!.avatar_url} className="size-8" />
              )}
              <span className="min-w-0 flex-1 truncate text-sm font-medium text-header">{item.label}</span>
              {item.dm?.type === "group_dm" && <UsersIcon className="size-4 text-muted-foreground" />}
            </button>
          </li>
        ))}
        {results.length === 0 && (
          <li className="py-6 text-center text-sm text-muted-foreground">No friends or conversations match.</li>
        )}
      </ul>
    </div>
  )
}
