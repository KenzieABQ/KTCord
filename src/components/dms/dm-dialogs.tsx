"use client"

import { SearchIcon } from "@/components/icons"
import { useState } from "react"
import { toast } from "@/lib/toast"

import { UserAvatar } from "@/components/profile/user-avatar"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { errorMessage } from "@/lib/api/errors"
import { rankMatches } from "@/lib/mentions"
import { displayNameOf } from "@/lib/profile-display"
import {
  useAddGroupDmRecipients,
  useCreateGroupDm,
  useDm,
  useOpenDm,
  useRelationships,
} from "@/lib/queries/social"
import { useUiStore } from "@/lib/stores/ui-store"

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
