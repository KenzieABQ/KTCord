"use client"

import { PlusIcon, SmilePlusIcon, XIcon } from "@/components/icons"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "@/lib/toast"

import { Emoji } from "@/components/chat/emoji"
import { EmojiPickerPopover } from "@/components/chat/emoji-picker"
import { isTextLike } from "@/components/servers/channel-icon"
import { SettingsSection, UnsavedChangesBar } from "@/components/settings/settings-layout"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Slider } from "@/components/ui/slider"
import { Textarea } from "@/components/ui/textarea"
import { normalizeTextChannelName, type Channel } from "@/lib/api/channels"
import { errorMessage } from "@/lib/api/errors"
import { forumTags, type ForumTag } from "@/lib/api/forums"
import { hasPermission, Permission } from "@/lib/permissions"
import { useChannel, useDeleteChannel, useServerPermissions, useUpdateChannel } from "@/lib/queries/servers"
import { formatSlowmode, SLOWMODE_STEPS } from "@/lib/slowmode"

import { useChannelSettingsParams } from "./channel-settings-shell"

const labelClass = "text-xs font-bold tracking-wide uppercase text-muted-foreground"

/** A forum's tags: name and optional emoji, up to 20. */
function TagsEditor({ tags, onChange }: { tags: ForumTag[]; onChange: (tags: ForumTag[]) => void }) {
  return (
    <div>
      <p className={labelClass}>Tags</p>
      <p className="mt-1 mb-3 text-sm text-muted-foreground">Posters can pick up to five to make their post easier to find.</p>
      <ul className="flex flex-col gap-2">
        {tags.map((tag, i) => (
          <li key={tag.id} className="flex items-center gap-2">
            <EmojiPickerPopover side="right" align="start" onPick={(emoji) => onChange(tags.map((t, j) => (j === i ? { ...t, emoji } : t)))}>
              <button
                type="button"
                aria-label={tag.emoji ? "Change tag emoji" : "Add a tag emoji"}
                className="flex size-9 shrink-0 items-center justify-center rounded-md bg-input text-interactive hover:text-interactive-hover"
              >
                {tag.emoji ? <Emoji value={tag.emoji} /> : <SmilePlusIcon className="size-4" />}
              </button>
            </EmojiPickerPopover>
            <Input
              value={tag.name}
              maxLength={20}
              aria-label={`Tag ${i + 1} name`}
              onChange={(e) => onChange(tags.map((t, j) => (j === i ? { ...t, name: e.target.value } : t)))}
            />
            <button
              type="button"
              aria-label={`Remove tag ${tag.name || i + 1}`}
              onClick={() => onChange(tags.filter((_, j) => j !== i))}
              className="shrink-0 rounded text-interactive hover:text-interactive-hover"
            >
              <XIcon className="size-4" />
            </button>
          </li>
        ))}
      </ul>
      {tags.length < 20 && (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="mt-3"
          onClick={() => onChange([...tags, { id: crypto.randomUUID().slice(0, 8), name: "", emoji: null }])}
        >
          <PlusIcon /> Add Tag
        </Button>
      )}
    </div>
  )
}

function Overview({ serverId, channel }: { serverId: string; channel: Channel }) {
  const router = useRouter()
  const update = useUpdateChannel(serverId)
  const remove = useDeleteChannel(serverId)
  const [name, setName] = useState(channel.name ?? "")
  const [topic, setTopic] = useState(channel.topic ?? "")
  const [slowmode, setSlowmode] = useState(channel.slowmode_seconds ?? 0)
  const [tags, setTags] = useState<ForumTag[]>(forumTags(channel))
  const [confirmDelete, setConfirmDelete] = useState(false)

  const isText = isTextLike(channel.type)
  const isForum = channel.type === "forum"
  const hasSlowmode = channel.type === "text" || channel.type === "announcement"
  const noun = channel.type === "category" ? "Category" : "Channel"
  const finalName = isText ? normalizeTextChannelName(name) : name.trim()
  const cleanTags = tags.map((t) => ({ ...t, name: t.name.trim() })).filter((t) => t.name)
  const dirty =
    finalName !== channel.name ||
    (isText && topic.trim() !== (channel.topic ?? "")) ||
    (hasSlowmode && slowmode !== channel.slowmode_seconds) ||
    (isForum && JSON.stringify(cleanTags) !== JSON.stringify(forumTags(channel)))

  function reset() {
    setName(channel.name ?? "")
    setTopic(channel.topic ?? "")
    setSlowmode(channel.slowmode_seconds ?? 0)
    setTags(forumTags(channel))
  }

  async function save() {
    if (!finalName) {
      toast.error(`Give the ${noun.toLowerCase()} a name.`)
      return
    }
    try {
      await update.mutateAsync({
        id: channel.id,
        name: finalName,
        ...(isText && { topic: topic.trim() || null }),
        ...(hasSlowmode && { slowmode_seconds: slowmode }),
        ...(isForum && { available_tags: cleanTags }),
      })
      toast.success(`${noun} saved.`)
    } catch (error) {
      toast.error(errorMessage(error))
    }
  }

  async function confirmRemove() {
    try {
      await remove.mutateAsync(channel.id)
      toast.success(`Deleted ${isText ? "#" : ""}${channel.name}.`)
      router.replace(`/channels/${serverId}`)
    } catch (error) {
      toast.error(errorMessage(error))
    }
  }

  return (
    <>
      <SettingsSection title="Overview">
        <div className="flex flex-col gap-6">
          <Field>
            <FieldLabel htmlFor="channel-name" className={labelClass}>
              {noun} Name
            </FieldLabel>
            <Input
              id="channel-name"
              value={isText ? name.toLowerCase().replace(/\s/g, "-") : name}
              maxLength={100}
              onChange={(e) => setName(e.target.value)}
            />
          </Field>

          {isText && (
            <Field>
              <FieldLabel htmlFor="channel-topic" className={labelClass}>
                Channel Topic
              </FieldLabel>
              <Textarea
                id="channel-topic"
                rows={4}
                maxLength={1024}
                placeholder="Let everyone know how to use this channel!"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                className="resize-none"
              />
              <FieldDescription className="text-right text-xs">{topic.length}/1024</FieldDescription>
            </Field>
          )}

          {isForum && <TagsEditor tags={tags} onChange={setTags} />}

          {hasSlowmode && (
            <div>
              <p id="slowmode-label" className={labelClass}>
                Slowmode
              </p>
              <Slider
                className="mt-5"
                min={0}
                max={SLOWMODE_STEPS.length - 1}
                step={1}
                value={[Math.max(0, SLOWMODE_STEPS.indexOf(slowmode))]}
                onValueChange={([i]) => setSlowmode(SLOWMODE_STEPS[i])}
                thumbProps={{ "aria-labelledby": "slowmode-label", "aria-valuetext": formatSlowmode(slowmode) }}
              />
              <div aria-hidden className="mt-2 flex justify-between text-[11px] text-muted-foreground">
                {SLOWMODE_STEPS.map((s) => (
                  <span key={s} className={s === slowmode ? "font-semibold text-header" : undefined}>
                    {formatSlowmode(s)}
                  </span>
                ))}
              </div>
              <p className="mt-3 text-sm text-muted-foreground">
                Members can send one message per interval, unless they have Manage Channels or Manage Messages.
              </p>
            </div>
          )}
        </div>

        {dirty && <UnsavedChangesBar onReset={reset} onSave={() => void save()} saving={update.isPending} />}
      </SettingsSection>

      <SettingsSection
        title={`Delete ${noun}`}
        description={
          channel.type === "category"
            ? "Its channels will move out of the category."
            : "Deleting a channel removes all of its messages. This can't be undone."
        }
      >
        <Button variant="destructive" onClick={() => setConfirmDelete(true)}>
          Delete {noun}
        </Button>
      </SettingsSection>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent className="bg-chat">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {noun}</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong className="text-foreground">{isText ? `#${channel.name}` : channel.name}</strong>?
              {channel.type !== "category" && " This can't be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/80"
              onClick={(e) => {
                e.preventDefault()
                void confirmRemove()
              }}
              disabled={remove.isPending}
            >
              Delete {noun}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

/** Channel Settings → Overview: name, topic, slow mode, and Delete. */
export function ChannelOverviewSettings() {
  const { serverId, channelId } = useChannelSettingsParams()
  const { data: channel } = useChannel(serverId, channelId)
  const { permissions } = useServerPermissions(serverId)
  if (!channel) return null
  if (!hasPermission(permissions, Permission.MANAGE_CHANNELS)) {
    return (
      <SettingsSection title="Overview">
        <p className="text-muted-foreground">You need the Manage Channels permission for this page.</p>
      </SettingsSection>
    )
  }
  // Keyed so the form resets when the channel changes elsewhere (e.g. renamed live).
  return <Overview key={`${channel.id}:${channel.name}:${channel.topic}:${channel.slowmode_seconds}:${JSON.stringify(channel.available_tags)}`} serverId={serverId} channel={channel} />
}
