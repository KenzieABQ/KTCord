"use client"

import { PlusIcon, SmilePlusIcon, XIcon } from "lucide-react"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { PollDraft } from "@/lib/messages/types"

import { Emoji } from "./emoji"
import { EmojiPickerPopover } from "./emoji-picker"

const labelClass = "text-xs font-bold tracking-wide uppercase text-muted-foreground"

export const POLL_DURATIONS = [
  { hours: 1, label: "1 hour" },
  { hours: 4, label: "4 hours" },
  { hours: 8, label: "8 hours" },
  { hours: 24, label: "24 hours" },
  { hours: 72, label: "3 days" },
  { hours: 168, label: "1 week" },
  { hours: 336, label: "2 weeks" },
]
const MAX_ANSWERS = 10

type AnswerDraft = { key: number; text: string; emoji: string | null }

/** Discord's Create Poll: a question, 2-10 answers (each with an optional emoji), a duration. */
export function PollDialog({
  open,
  onOpenChange,
  channelLabel,
  onPost,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  channelLabel: string
  onPost: (poll: PollDraft) => void
}) {
  const [question, setQuestion] = useState("")
  const [answers, setAnswers] = useState<AnswerDraft[]>([
    { key: 1, text: "", emoji: null },
    { key: 2, text: "", emoji: null },
  ])
  const [hours, setHours] = useState("24")
  const [multiselect, setMultiselect] = useState(false)
  const [showError, setShowError] = useState(false)

  const filled = answers.filter((a) => a.text.trim())
  const error = !question.trim()
    ? "Ask a question."
    : filled.length < 2
      ? "Add at least two answers."
      : null

  const update = (key: number, patch: Partial<AnswerDraft>) =>
    setAnswers((list) => list.map((a) => (a.key === key ? { ...a, ...patch } : a)))

  function reset() {
    setQuestion("")
    setAnswers([
      { key: 1, text: "", emoji: null },
      { key: 2, text: "", emoji: null },
    ])
    setHours("24")
    setMultiselect(false)
    setShowError(false)
  }

  function post() {
    if (error) {
      setShowError(true)
      return
    }
    onPost({
      question: question.trim(),
      answers: filled.map((a) => ({ text: a.text.trim(), emoji: a.emoji })),
      multiselect,
      duration_hours: Number(hours),
    })
    reset()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto bg-chat p-6 sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create a Poll</DialogTitle>
          <DialogDescription>Posts to {channelLabel}. Everyone who can see it can vote.</DialogDescription>
        </DialogHeader>
        <form
          className="mt-2 flex flex-col gap-5"
          onSubmit={(e) => {
            e.preventDefault()
            post()
          }}
        >
          <Field>
            <FieldLabel htmlFor="poll-question" className={labelClass}>
              Question
            </FieldLabel>
            <Input
              id="poll-question"
              value={question}
              maxLength={300}
              placeholder="What question do you want to ask?"
              onChange={(e) => setQuestion(e.target.value)}
              className="bg-input"
              autoFocus
            />
          </Field>

          <fieldset className="flex flex-col gap-2">
            <legend className={`${labelClass} mb-2`}>Answers</legend>
            {answers.map((answer, i) => (
              <div key={answer.key} className="flex items-center gap-2">
                <EmojiPickerPopover side="left" align="start" onPick={(emoji) => update(answer.key, { emoji })}>
                  <button
                    type="button"
                    aria-label={answer.emoji ? "Change emoji" : "Add an emoji"}
                    className="flex size-9 shrink-0 items-center justify-center rounded-md bg-input text-interactive hover:text-interactive-hover"
                  >
                    {answer.emoji ? <Emoji value={answer.emoji} /> : <SmilePlusIcon className="size-4" />}
                  </button>
                </EmojiPickerPopover>
                <Input
                  value={answer.text}
                  maxLength={55}
                  placeholder="Type your answer"
                  aria-label={`Answer ${i + 1}`}
                  onChange={(e) => update(answer.key, { text: e.target.value })}
                  className="bg-input"
                />
                {answers.length > 2 && (
                  <button
                    type="button"
                    aria-label={`Remove answer ${i + 1}`}
                    onClick={() => setAnswers((list) => list.filter((a) => a.key !== answer.key))}
                    className="shrink-0 rounded text-interactive hover:text-interactive-hover"
                  >
                    <XIcon className="size-4" />
                  </button>
                )}
              </div>
            ))}
            {answers.length < MAX_ANSWERS && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="w-fit"
                onClick={() =>
                  setAnswers((list) => [...list, { key: Math.max(...list.map((a) => a.key)) + 1, text: "", emoji: null }])
                }
              >
                <PlusIcon /> Add another answer
              </Button>
            )}
          </fieldset>

          <div className="flex flex-wrap items-end justify-between gap-4">
            <Field className="w-40">
              <FieldLabel className={labelClass}>Duration</FieldLabel>
              <Select value={hours} onValueChange={setHours}>
                <SelectTrigger className="w-full bg-input" aria-label="Duration">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {POLL_DURATIONS.map((d) => (
                    <SelectItem key={d.hours} value={String(d.hours)}>
                      {d.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <label className="flex cursor-pointer items-center gap-2 pb-2 text-sm text-foreground">
              <Checkbox checked={multiselect} onCheckedChange={(on) => setMultiselect(on === true)} />
              Allow multiple answers
            </label>
          </div>

          {showError && error && <FieldError>{error}</FieldError>}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">Post</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
