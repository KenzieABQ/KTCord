"use client"

import { formatDistanceToNowStrict } from "date-fns"
import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { errorMessage } from "@/lib/api/errors"
import { inviteUrl, type Invite } from "@/lib/api/invites"
import { useCreateInvite, useServer } from "@/lib/queries/servers"
import { cn } from "@/lib/utils"

const EXPIRY_OPTIONS = [
  { label: "30 minutes", seconds: 1800 },
  { label: "1 hour", seconds: 3600 },
  { label: "6 hours", seconds: 21600 },
  { label: "12 hours", seconds: 43200 },
  { label: "1 day", seconds: 86400 },
  { label: "7 days", seconds: 604800 },
  { label: "Never", seconds: 0 },
]
const USES_OPTIONS = [0, 1, 5, 10, 25, 50, 100]
const labelClass = "text-xs font-bold tracking-wide uppercase text-muted-foreground"

function describeInvite(invite: Invite) {
  const parts: string[] = []
  parts.push(
    invite.expires_at
      ? `Your invite link expires in ${formatDistanceToNowStrict(new Date(invite.expires_at))}.`
      : "Your invite link will never expire."
  )
  if (invite.max_uses) parts.push(`It can be used ${invite.max_uses} ${invite.max_uses === 1 ? "time" : "times"}.`)
  return parts.join(" ")
}

/** Creates a 7-day link on open; "Edit invite link" makes a new one with other limits. */
export function InviteDialog({ serverId }: { serverId: string }) {
  const { data: server } = useServer(serverId)
  const createInvite = useCreateInvite(serverId)
  const [invite, setInvite] = useState<Invite | null>(null)
  const [editing, setEditing] = useState(false)
  const [expiry, setExpiry] = useState("604800")
  const [maxUses, setMaxUses] = useState("0")
  const [copied, setCopied] = useState(false)
  const started = useRef(false)

  const { mutateAsync } = createInvite
  useEffect(() => {
    if (started.current) return
    started.current = true
    mutateAsync({ maxAgeSeconds: 604800, maxUses: null })
      .then(setInvite)
      .catch((err) => toast.error(errorMessage(err)))
  }, [mutateAsync])

  async function regenerate() {
    try {
      const next = await createInvite.mutateAsync({
        maxAgeSeconds: Number(expiry) || null,
        maxUses: Number(maxUses) || null,
      })
      setInvite(next)
      setEditing(false)
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  async function copy() {
    if (!invite) return
    await navigator.clipboard.writeText(inviteUrl(invite.code))
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  if (editing) {
    return (
      <div>
        <DialogHeader>
          <DialogTitle>Server invite link settings</DialogTitle>
        </DialogHeader>
        <div className="mt-5 flex flex-col gap-4">
          <Field>
            <FieldLabel className={labelClass}>Expire after</FieldLabel>
            <Select value={expiry} onValueChange={setExpiry}>
              <SelectTrigger className="w-full bg-input">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EXPIRY_OPTIONS.map((o) => (
                  <SelectItem key={o.seconds} value={String(o.seconds)}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field>
            <FieldLabel className={labelClass}>Max number of uses</FieldLabel>
            <Select value={maxUses} onValueChange={setMaxUses}>
              <SelectTrigger className="w-full bg-input">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {USES_OPTIONS.map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {n === 0 ? "No limit" : `${n} ${n === 1 ? "use" : "uses"}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>
        <div className="mt-6 -mx-6 -mb-6 flex justify-end gap-2 rounded-b-xl bg-sidebar px-4 py-3">
          <Button variant="ghost" onClick={() => setEditing(false)}>
            Cancel
          </Button>
          <Button onClick={regenerate} disabled={createInvite.isPending}>
            Generate a New Link
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <DialogHeader>
        <DialogTitle>Invite friends to {server?.name ?? "this server"}</DialogTitle>
        <DialogDescription>Send a server invite link to a friend.</DialogDescription>
      </DialogHeader>
      <div className="mt-5 flex items-center gap-2 rounded-md bg-input p-1 pl-3">
        <Input
          readOnly
          value={invite ? inviteUrl(invite.code) : "Generating…"}
          className="h-8 border-0 bg-transparent px-0 focus-visible:ring-0"
          aria-label="Invite link"
          onFocus={(e) => e.target.select()}
        />
        <Button
          onClick={copy}
          disabled={!invite}
          className={cn("min-w-20", copied && "bg-success hover:bg-success")}
        >
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
      {invite && (
        <p className="mt-2 text-xs text-muted-foreground">
          {describeInvite(invite)}{" "}
          <button type="button" className="text-link hover:underline" onClick={() => setEditing(true)}>
            Edit invite link.
          </button>
        </p>
      )}
    </div>
  )
}
