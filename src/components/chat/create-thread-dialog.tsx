"use client"

import { MessagesSquareIcon } from "lucide-react"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { errorMessage } from "@/lib/api/errors"
import { useCreateThread } from "@/lib/queries/messages"
import { useUiStore } from "@/lib/stores/ui-store"

/** Names a new thread started from a message, then opens it beside the channel. */
export function CreateThreadDialog({
  channelId,
  messageId,
  defaultName,
}: {
  channelId: string
  messageId: string
  defaultName: string
}) {
  const closeDialog = useUiStore((s) => s.closeDialog)
  const openSidePanel = useUiStore((s) => s.openSidePanel)
  const createThread = useCreateThread(channelId)
  const [name, setName] = useState(defaultName)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    try {
      const threadId = await createThread.mutateAsync({ messageId, name: name.trim() })
      closeDialog()
      openSidePanel({ kind: "thread", channelId, threadId })
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  return (
    <form onSubmit={submit} noValidate>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <MessagesSquareIcon className="size-5" /> Create Thread
        </DialogTitle>
        <DialogDescription>Keep a side conversation going without crowding the channel.</DialogDescription>
      </DialogHeader>
      <Field className="mt-5" data-invalid={Boolean(error)}>
        <FieldLabel htmlFor="thread-name" className="text-xs font-bold tracking-wide text-muted-foreground uppercase">
          Thread name
        </FieldLabel>
        <Input
          id="thread-name"
          autoFocus
          maxLength={100}
          placeholder="New Thread"
          value={name}
          onChange={(e) => {
            setName(e.target.value)
            setError(null)
          }}
        />
        {error && <FieldError>{error}</FieldError>}
      </Field>
      <DialogFooter className="-mx-6 mt-6 -mb-6 rounded-b-xl bg-sidebar px-4 py-3">
        <Button type="button" variant="ghost" onClick={closeDialog}>
          Cancel
        </Button>
        <Button type="submit" disabled={createThread.isPending}>
          Create Thread
        </Button>
      </DialogFooter>
    </form>
  )
}
