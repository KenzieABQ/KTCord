"use client"

import { UploadIcon, XIcon } from "lucide-react"
import { useParams } from "next/navigation"
import { useRef, useState } from "react"
import { toast } from "sonner"

import { Emoji } from "@/components/chat/emoji"
import { UserAvatar } from "@/components/profile/user-avatar"
import { SettingsSection } from "@/components/settings/settings-layout"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { emojiNameFromFile, type ServerEmoji } from "@/lib/api/emoji"
import { errorMessage } from "@/lib/api/errors"
import { customEmojiToken } from "@/lib/emoji"
import { memberDisplayName } from "@/lib/members"
import { hasPermission, Permission } from "@/lib/permissions"
import { useCreateServerEmoji, useDeleteServerEmoji, useRenameServerEmoji, useServerEmojis } from "@/lib/queries/emoji"
import { useMembers, useServerPermissions } from "@/lib/queries/servers"

const LIMIT = 50
const NAME_RE = /^[A-Za-z0-9_]{2,32}$/

function EmojiRow({ emoji, serverId }: { emoji: ServerEmoji; serverId: string }) {
  const { data: members } = useMembers(serverId)
  const rename = useRenameServerEmoji()
  const remove = useDeleteServerEmoji()
  const [name, setName] = useState(emoji.name)
  const uploader = members?.find((m) => m.user_id === emoji.created_by)

  function save() {
    const next = name.trim()
    if (next === emoji.name) return
    if (!NAME_RE.test(next)) {
      toast.error("Emoji names use letters, numbers and underscores, 2–32 characters.")
      setName(emoji.name)
      return
    }
    rename.mutate(
      { id: emoji.id, name: next },
      {
        onError: (error) => {
          toast.error(errorMessage(error))
          setName(emoji.name)
        },
      }
    )
  }

  return (
    <tr className="group border-b border-border last:border-b-0">
      <td className="py-2 pr-3">
        <Emoji value={customEmojiToken(emoji)} className="size-8" />
      </td>
      <td className="py-2 pr-3">
        <div className="flex items-center rounded-md bg-rail px-2 focus-within:ring-2 focus-within:ring-ring">
          <span className="text-muted-foreground">:</span>
          <input
            value={name}
            aria-label={`Name for :${emoji.name}:`}
            maxLength={32}
            onChange={(e) => setName(e.target.value.replace(/[^A-Za-z0-9_]/g, "_"))}
            onBlur={save}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur()
              if (e.key === "Escape") setName(emoji.name)
            }}
            className="h-8 min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none"
          />
          <span className="text-muted-foreground">:</span>
        </div>
      </td>
      <td className="py-2 pr-3">
        <span className="flex items-center gap-2 text-sm text-foreground">
          {uploader && (
            <UserAvatar
              userId={uploader.user_id}
              name={memberDisplayName(uploader)}
              src={uploader.profile.avatar_url}
              className="size-6"
            />
          )}
          <span className="truncate">{uploader ? memberDisplayName(uploader) : "Unknown"}</span>
        </span>
      </td>
      <td className="w-10 py-2 text-right">
        <button
          type="button"
          aria-label={`Delete :${emoji.name}:`}
          disabled={remove.isPending}
          onClick={() => remove.mutate(emoji.id, { onError: (error) => toast.error(errorMessage(error)) })}
          className="flex size-8 items-center justify-center rounded-full text-muted-foreground opacity-0 group-focus-within:opacity-100 group-hover:opacity-100 hover:bg-destructive/15 hover:text-destructive focus-visible:opacity-100"
        >
          <XIcon className="size-4" />
        </button>
      </td>
    </tr>
  )
}

/** Server Settings → Emoji: upload, rename and remove the server's custom emoji. */
export function EmojiSettings() {
  const { serverId } = useParams<{ serverId: string }>()
  const { permissions } = useServerPermissions(serverId)
  const allowed = hasPermission(permissions, Permission.MANAGE_EXPRESSIONS)
  const { data: emojis, isPending } = useServerEmojis(serverId)
  const create = useCreateServerEmoji(serverId)
  const input = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(0)

  if (!allowed) {
    return (
      <SettingsSection title="Emoji">
        <p className="text-muted-foreground">You need the Manage Expressions permission for this page.</p>
      </SettingsSection>
    )
  }

  const count = emojis?.length ?? 0
  const slots = Math.max(0, LIMIT - count)

  async function upload(files: File[]) {
    const taken = new Set((emojis ?? []).map((e) => e.name.toLowerCase()))
    const queue = files.slice(0, slots)
    if (files.length > slots) toast(`Only ${slots} more emoji fit, so the rest were skipped.`)
    setUploading(queue.length)
    for (const file of queue) {
      // Give clashing names a number, like Discord does.
      let name = emojiNameFromFile(file.name)
      for (let n = 1; taken.has(name.toLowerCase()); n++) name = `${emojiNameFromFile(file.name).slice(0, 29)}_${n}`
      taken.add(name.toLowerCase())
      try {
        await create.mutateAsync({ name, file })
      } catch (error) {
        toast.error(`${file.name}: ${errorMessage(error)}`)
      }
      setUploading((u) => u - 1)
    }
  }

  return (
    <SettingsSection
      title="Emoji"
      description="Add up to 50 custom emoji that anyone in this server can use. Animated GIFs work too, and members can use them from other servers they share."
    >
      <div className="rounded-lg bg-sidebar p-4 text-sm text-muted-foreground">
        <p className="font-semibold text-header uppercase">Upload Requirements</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>File type: PNG, GIF, WebP or JPEG</li>
          <li>Recommended size: 128×128 pixels</li>
          <li>Maximum file size: 256 KB</li>
          <li>Names must be at least 2 characters: letters, numbers and underscores</li>
        </ul>
        <Button className="mt-4" disabled={slots === 0 || uploading > 0} onClick={() => input.current?.click()}>
          <UploadIcon /> {uploading > 0 ? `Uploading ${uploading}…` : "Upload Emoji"}
        </Button>
        <input
          ref={input}
          type="file"
          multiple
          accept="image/png,image/gif,image/webp,image/jpeg"
          className="hidden"
          onChange={(e) => {
            void upload([...(e.target.files ?? [])])
            e.target.value = ""
          }}
        />
      </div>

      <h2 className="mt-8 text-xs font-bold tracking-wide text-muted-foreground uppercase">
        Emoji — {slots} {slots === 1 ? "slot" : "slots"} available
      </h2>
      {isPending ? (
        <div className="mt-3 space-y-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-12 w-full bg-item-selected/60" />
          ))}
        </div>
      ) : count === 0 ? (
        <p className="mt-3 rounded-lg border border-dashed border-border p-8 text-center text-muted-foreground">
          No emoji yet. Upload some to give your server its own flavor.
        </p>
      ) : (
        <table className="mt-3 w-full table-fixed">
          <thead>
            <tr className="text-left text-xs font-bold tracking-wide text-muted-foreground uppercase">
              <th className="w-14 pb-2">Image</th>
              <th className="pb-2">Name</th>
              <th className="pb-2">Uploaded By</th>
              <th className="w-10 pb-2">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {emojis!.map((emoji) => (
              <EmojiRow key={emoji.id} emoji={emoji} serverId={serverId} />
            ))}
          </tbody>
        </table>
      )}
    </SettingsSection>
  )
}
