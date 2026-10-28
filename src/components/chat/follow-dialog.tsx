"use client"

import { useQuery } from "@tanstack/react-query"
import { MegaphoneIcon } from "lucide-react"
import { useState } from "react"
import { toast } from "@/lib/toast"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Field, FieldLabel } from "@/components/ui/field"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { followChannel } from "@/lib/api/announcements"
import { listChannels, type Channel } from "@/lib/api/channels"
import { errorMessage } from "@/lib/api/errors"
import { qk } from "@/lib/queries/keys"
import { useMyServers } from "@/lib/queries/servers"

const labelClass = "text-xs font-bold tracking-wide uppercase text-muted-foreground"

/** Follow an announcement channel: its published posts show up in a channel of your server. */
export function FollowDialog({
  channel,
  open,
  onOpenChange,
}: {
  channel: Channel
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { data: servers } = useMyServers()
  const [serverId, setServerId] = useState("")
  const [targetId, setTargetId] = useState("")
  const [saving, setSaving] = useState(false)
  const { data: channels } = useQuery({
    queryKey: qk.channels(serverId),
    queryFn: () => listChannels(serverId),
    enabled: Boolean(serverId),
  })
  const others = (servers ?? []).filter((s) => s.id !== channel.server_id)
  const texts = (channels ?? []).filter((c) => c.type === "text")

  async function follow() {
    setSaving(true)
    try {
      await followChannel(channel.id, targetId)
      toast.success(`Following #${channel.name}. New posts will show up in #${texts.find((c) => c.id === targetId)?.name}.`)
      onOpenChange(false)
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-chat p-6 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MegaphoneIcon className="size-5" /> Follow #{channel.name}
          </DialogTitle>
          <DialogDescription>
            Posts published here will also appear in the channel you pick. You need Manage Channels in that server.
          </DialogDescription>
        </DialogHeader>
        <div className="mt-2 flex flex-col gap-4">
          <Field>
            <FieldLabel className={labelClass}>Server</FieldLabel>
            <Select
              value={serverId}
              onValueChange={(v) => {
                setServerId(v)
                setTargetId("")
              }}
            >
              <SelectTrigger className="w-full bg-input" aria-label="Server">
                <SelectValue placeholder="Pick a server" />
              </SelectTrigger>
              <SelectContent>
                {others.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field>
            <FieldLabel className={labelClass}>Channel</FieldLabel>
            <Select value={targetId} onValueChange={setTargetId} disabled={!serverId}>
              <SelectTrigger className="w-full bg-input" aria-label="Channel">
                <SelectValue placeholder="Pick a text channel" />
              </SelectTrigger>
              <SelectContent>
                {texts.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    #{c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          {others.length === 0 && <p className="text-sm text-muted-foreground">You aren&apos;t in any other servers.</p>}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button disabled={!targetId || saving} onClick={() => void follow()}>
              Follow
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
