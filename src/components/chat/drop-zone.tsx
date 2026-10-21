"use client"

import { UploadIcon } from "lucide-react"
import { useRef, useState, type ReactNode } from "react"

import { cn } from "@/lib/utils"

import { stageFiles } from "./attachment-tray"
import { focusComposer } from "./composer"

/** Drop files anywhere on the chat to stage them in the composer. */
export function ChatDropZone({
  channelId,
  label,
  enabled,
  className,
  children,
}: {
  channelId: string
  label: string
  enabled: boolean
  className?: string
  children: ReactNode
}) {
  const [dragging, setDragging] = useState(false)
  const depth = useRef(0)
  const hasFiles = (e: React.DragEvent) => [...e.dataTransfer.types].includes("Files")

  return (
    <div
      className={cn("relative", className)}
      onDragEnter={(e) => {
        if (!enabled || !hasFiles(e)) return
        e.preventDefault()
        depth.current++
        setDragging(true)
      }}
      onDragOver={(e) => {
        if (!enabled || !hasFiles(e)) return
        e.preventDefault()
        e.dataTransfer.dropEffect = "copy"
      }}
      onDragLeave={() => {
        if (!enabled) return
        depth.current = Math.max(0, depth.current - 1)
        if (depth.current === 0) setDragging(false)
      }}
      onDrop={(e) => {
        if (!enabled || !hasFiles(e)) return
        e.preventDefault()
        depth.current = 0
        setDragging(false)
        stageFiles(channelId, [...e.dataTransfer.files])
        focusComposer(channelId)
      }}
    >
      {children}
      {dragging && (
        <div className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center bg-black/60 p-6">
          <div className="flex flex-col items-center gap-3 rounded-xl border-2 border-dashed border-white/60 bg-primary px-10 py-8 text-center text-white shadow-2xl">
            <UploadIcon className="size-10" />
            <p className="text-xl font-bold">Upload to {label}</p>
            <p className="text-sm text-white/80">Drop files to add them to your message.</p>
          </div>
        </div>
      )}
    </div>
  )
}
