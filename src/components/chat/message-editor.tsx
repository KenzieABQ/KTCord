"use client"

import { useEffect, useRef, useState } from "react"

import { useAutosize } from "@/hooks/use-autosize"

/** Inline editor: Enter saves, Shift+Enter adds a line, Escape cancels. Saving empty asks to delete. */
export function MessageEditor({
  initial,
  onSave,
  onCancel,
  onEmpty,
}: {
  initial: string
  onSave: (content: string) => void
  onCancel: () => void
  onEmpty: () => void
}) {
  const [value, setValue] = useState(initial)
  const ref = useRef<HTMLTextAreaElement>(null)
  useAutosize(ref, value)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.focus()
    el.setSelectionRange(el.value.length, el.value.length)
  }, [])

  function submit() {
    const trimmed = value.trim()
    if (!trimmed) return onEmpty()
    if (trimmed === initial.trim()) return onCancel()
    onSave(trimmed)
  }

  return (
    <div className="py-1">
      <div className="rounded-lg bg-composer px-3 py-2">
        <textarea
          ref={ref}
          value={value}
          rows={1}
          maxLength={2000}
          aria-label="Edit message"
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.preventDefault()
              e.stopPropagation()
              onCancel()
            } else if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault()
              submit()
            }
          }}
          className="block max-h-[50vh] w-full resize-none bg-transparent text-foreground outline-none"
        />
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        escape to{" "}
        <button type="button" className="text-link hover:underline" onClick={onCancel}>
          cancel
        </button>{" "}
        • enter to{" "}
        <button type="button" className="text-link hover:underline" onClick={submit}>
          save
        </button>
      </p>
    </div>
  )
}
