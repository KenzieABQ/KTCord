"use client"

import { XIcon } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { errorMessage } from "@/lib/api/errors"
import { activeCustomStatus, CLEAR_AFTER, expiryFor, type ClearAfter } from "@/lib/custom-status"
import { useMyProfile, useUpdateMyProfile } from "@/lib/queries/profiles"

const QUICK_EMOJI = ["😀", "🎮", "📚", "🎧", "💻", "☕", "🌙", "🔥", "🏖️", "🤒"]
const labelClass = "text-xs font-bold tracking-wide uppercase text-muted-foreground"

/** "Set a custom status": an emoji, up to 128 characters, and when to clear it. */
export function CustomStatusDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { data: profile } = useMyProfile()
  const update = useUpdateMyProfile()
  const current = activeCustomStatus(profile)
  const [emoji, setEmoji] = useState(current?.emoji ?? "")
  const [text, setText] = useState(current?.text ?? "")
  const [clearAfter, setClearAfter] = useState<ClearAfter>("today")

  async function save(next: { emoji: string; text: string } | null) {
    try {
      await update.mutateAsync({
        custom_status_emoji: next?.emoji || null,
        custom_status_text: next?.text.trim() || null,
        custom_status_expires_at: next ? (expiryFor(clearAfter)?.toISOString() ?? null) : null,
      })
      onOpenChange(false)
    } catch (error) {
      toast.error(errorMessage(error))
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-chat p-6 sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Set a custom status</DialogTitle>
          <DialogDescription>Let people know what you&apos;re up to.</DialogDescription>
        </DialogHeader>

        <Field>
          <FieldLabel htmlFor="custom-status" className={labelClass}>
            What&apos;s cookin&apos;?
          </FieldLabel>
          <div className="flex items-center gap-2 rounded-md bg-input pr-1 pl-2">
            <span className="text-lg" aria-hidden>
              {emoji || "🙂"}
            </span>
            <Input
              id="custom-status"
              value={text}
              maxLength={128}
              autoFocus
              placeholder="Support has arrived!"
              onChange={(e) => setText(e.target.value)}
              className="border-0 bg-transparent px-0 focus-visible:ring-0"
            />
            {(text || emoji) && (
              <button
                type="button"
                aria-label="Clear"
                onClick={() => {
                  setText("")
                  setEmoji("")
                }}
                className="text-interactive hover:text-interactive-hover"
              >
                <XIcon className="size-4" />
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-1" role="group" aria-label="Pick an emoji">
            {QUICK_EMOJI.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => setEmoji(emoji === e ? "" : e)}
                aria-pressed={emoji === e}
                className="flex size-8 items-center justify-center rounded-md text-lg hover:bg-item-hover aria-pressed:bg-item-selected"
              >
                {e}
              </button>
            ))}
          </div>
        </Field>

        <Field>
          <FieldLabel className={labelClass}>Clear after</FieldLabel>
          <Select value={clearAfter} onValueChange={(v) => setClearAfter(v as ClearAfter)}>
            <SelectTrigger className="w-full bg-input">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CLEAR_AFTER.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <DialogFooter className="-mx-6 -mb-6 mt-2 rounded-b-xl bg-sidebar px-4 py-3 sm:justify-between">
          {current ? (
            <Button variant="ghost" onClick={() => save(null)} disabled={update.isPending}>
              Clear Status
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={() => save({ emoji, text })} disabled={update.isPending || (!text.trim() && !emoji)}>
              Save
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
