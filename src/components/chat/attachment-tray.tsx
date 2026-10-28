"use client"

import { EyeIcon, EyeOffIcon, FileIcon, TrashIcon } from "lucide-react"
import { toast } from "@/lib/toast"

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { formatBytes, MAX_ATTACHMENTS, MAX_FILE_BYTES } from "@/lib/api/attachments"
import { useUploadStore, type PendingFile } from "@/lib/stores/upload-store"
import { cn } from "@/lib/utils"

/** Adds files to a channel's composer after checking the 10-file and 25 MB limits. */
export function stageFiles(channelId: string, files: File[]) {
  if (files.length === 0) return
  const store = useUploadStore.getState()
  const already = store.staged[channelId]?.length ?? 0
  const tooBig = files.filter((f) => f.size > MAX_FILE_BYTES)
  if (tooBig.length) toast.error(`${tooBig.map((f) => f.name).join(", ")} ${tooBig.length === 1 ? "is" : "are"} over 25 MB.`)
  const ok = files.filter((f) => f.size <= MAX_FILE_BYTES).slice(0, Math.max(0, MAX_ATTACHMENTS - already))
  if (already + files.length - tooBig.length > MAX_ATTACHMENTS) toast.error(`You can attach up to ${MAX_ATTACHMENTS} files.`)
  store.stage(channelId, ok)
}

function TrayButton({ label, onClick, danger, children }: { label: string; onClick: () => void; danger?: boolean; children: React.ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={label}
          onClick={onClick}
          className={cn(
            "flex size-7 items-center justify-center text-interactive hover:bg-item-hover",
            danger ? "hover:text-mention" : "hover:text-interactive-hover"
          )}
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent side="top">{label}</TooltipContent>
    </Tooltip>
  )
}

/** Files waiting to be sent: preview, mark as spoiler, or remove. The message text is the caption. */
export function AttachmentTray({ channelId, items, rounded }: { channelId: string; items: PendingFile[]; rounded: boolean }) {
  const unstage = useUploadStore((s) => s.unstage)
  const toggleSpoiler = useUploadStore((s) => s.toggleSpoiler)

  return (
    <div
      className={cn(
        "scrollbar-thin flex gap-3 overflow-x-auto border-b border-border bg-composer p-3",
        rounded && "rounded-t-lg"
      )}
      aria-label="Attachments to send"
    >
      {items.map((item) => (
        <div key={item.id} className="relative flex w-48 shrink-0 flex-col rounded-md bg-sidebar p-2">
          <div className="absolute -top-2 right-2 flex overflow-hidden rounded-md border border-border bg-chat shadow">
            <TrayButton label={item.spoiler ? "Remove spoiler" : "Mark as spoiler"} onClick={() => toggleSpoiler(channelId, item.id)}>
              {item.spoiler ? <EyeIcon className="size-4" /> : <EyeOffIcon className="size-4" />}
            </TrayButton>
            <TrayButton label="Remove attachment" danger onClick={() => unstage(channelId, item.id)}>
              <TrashIcon className="size-4" />
            </TrayButton>
          </div>
          <div className="relative flex h-32 items-center justify-center overflow-hidden rounded bg-floating/50">
            {item.previewUrl && item.file.type.startsWith("image/") ? (
              // eslint-disable-next-line @next/next/no-img-element -- local object URL
              <img src={item.previewUrl} alt="" className={cn("max-h-full max-w-full object-contain", item.spoiler && "blur-xl")} />
            ) : item.previewUrl && item.file.type.startsWith("video/") ? (
              <video src={item.previewUrl} className={cn("max-h-full max-w-full", item.spoiler && "blur-xl")} muted />
            ) : (
              <FileIcon className="size-12 text-primary" />
            )}
            {item.spoiler && (
              <span className="absolute rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-bold text-white uppercase">
                Spoiler
              </span>
            )}
          </div>
          <p className="mt-1.5 truncate text-sm text-foreground">
            {item.file.name}
          </p>
          <p className="text-xs text-muted-foreground">{formatBytes(item.file.size)}</p>
        </div>
      ))}
    </div>
  )
}
