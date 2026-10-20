"use client"

import { useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Field, FieldLabel } from "@/components/ui/field"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Textarea } from "@/components/ui/textarea"
import { errorMessage } from "@/lib/api/errors"
import { memberDisplayName } from "@/lib/members"
import { BAN_DELETE_OPTIONS } from "@/lib/moderation"
import { useBanMember, useKickMember } from "@/lib/queries/moderation"
import { useMembers, useServer } from "@/lib/queries/servers"
import { useUiStore } from "@/lib/stores/ui-store"

const labelClass = "text-xs font-bold tracking-wide uppercase text-muted-foreground"
const footerClass = "mt-6 -mx-6 -mb-6 rounded-b-xl bg-sidebar px-4 py-3"
const dangerButton = "bg-destructive text-white hover:bg-destructive/80"

function useTargetName(serverId: string, userId: string) {
  const { data: members } = useMembers(serverId)
  const member = members?.find((m) => m.user_id === userId)
  return member ? memberDisplayName(member) : "this member"
}

export function KickMemberDialog({ serverId, userId }: { serverId: string; userId: string }) {
  const closeDialog = useUiStore((s) => s.closeDialog)
  const { data: server } = useServer(serverId)
  const name = useTargetName(serverId, userId)
  const kick = useKickMember(serverId)

  async function confirm() {
    try {
      await kick.mutateAsync(userId)
      toast.success(`Kicked ${name}.`)
      closeDialog()
    } catch (error) {
      toast.error(errorMessage(error))
    }
  }

  return (
    <div>
      <DialogHeader>
        <DialogTitle>Kick {name} from {server?.name}</DialogTitle>
        <DialogDescription>
          They&apos;ll be removed from the server. They can rejoin if someone invites them again.
        </DialogDescription>
      </DialogHeader>
      <DialogFooter className={footerClass}>
        <Button variant="ghost" onClick={closeDialog}>
          Cancel
        </Button>
        <Button className={dangerButton} onClick={confirm} disabled={kick.isPending}>
          Kick
        </Button>
      </DialogFooter>
    </div>
  )
}

export function BanMemberDialog({ serverId, userId }: { serverId: string; userId: string }) {
  const closeDialog = useUiStore((s) => s.closeDialog)
  const name = useTargetName(serverId, userId)
  const ban = useBanMember(serverId)
  const [reason, setReason] = useState("")
  const [deleteSeconds, setDeleteSeconds] = useState("0")

  async function confirm() {
    try {
      await ban.mutateAsync({ userId, reason: reason.trim(), deleteSeconds: Number(deleteSeconds) })
      toast.success(`Banned ${name}.`)
      closeDialog()
    } catch (error) {
      toast.error(errorMessage(error))
    }
  }

  return (
    <div>
      <DialogHeader>
        <DialogTitle>Ban {name}?</DialogTitle>
        <DialogDescription>
          They&apos;ll be removed and can&apos;t rejoin, even with an invite, until they&apos;re unbanned
          in Server Settings.
        </DialogDescription>
      </DialogHeader>

      <Field className="mt-5">
        <FieldLabel className={labelClass}>Delete message history</FieldLabel>
        <RadioGroup value={deleteSeconds} onValueChange={setDeleteSeconds} className="gap-2">
          {BAN_DELETE_OPTIONS.map((option) => (
            <label key={option.seconds} className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
              <RadioGroupItem value={String(option.seconds)} />
              {option.label}
            </label>
          ))}
        </RadioGroup>
      </Field>

      <Field className="mt-4">
        <FieldLabel htmlFor="ban-reason" className={labelClass}>
          Reason for ban
        </FieldLabel>
        <Textarea
          id="ban-reason"
          rows={3}
          maxLength={512}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="resize-none"
        />
      </Field>

      <DialogFooter className={footerClass}>
        <Button variant="ghost" onClick={closeDialog}>
          Cancel
        </Button>
        <Button className={dangerButton} onClick={confirm} disabled={ban.isPending}>
          Ban
        </Button>
      </DialogFooter>
    </div>
  )
}
