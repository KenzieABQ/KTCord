"use client"

import { HashIcon, LockIcon, Volume2Icon } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { normalizeTextChannelName } from "@/lib/api/channels"
import { errorMessage } from "@/lib/api/errors"
import { useChannels, useRoles, useCreateChannel } from "@/lib/queries/servers"
import { useUiStore } from "@/lib/stores/ui-store"
import { cn } from "@/lib/utils"

const labelClass = "text-xs font-bold tracking-wide uppercase text-muted-foreground"
const footerClass = "mt-6 -mx-6 -mb-6 rounded-b-xl bg-sidebar px-4 py-3"

const TYPES = [
  { value: "text", label: "Text", hint: "Send messages, images, GIFs, emoji, opinions, and puns", icon: HashIcon },
  { value: "voice", label: "Voice", hint: "Hang out together with voice, video, and screen share", icon: Volume2Icon },
] as const

export function CreateChannelDialog({
  serverId,
  parentId,
  initialType = "text",
}: {
  serverId: string
  parentId: string | null
  initialType?: "text" | "voice"
}) {
  const router = useRouter()
  const closeDialog = useUiStore((s) => s.closeDialog)
  const createChannel = useCreateChannel(serverId)
  const { data: channels } = useChannels(serverId)
  const category = channels?.find((c) => c.id === parentId)

  const [type, setType] = useState<"text" | "voice">(initialType)
  const [name, setName] = useState("")
  const [error, setError] = useState<string | null>(null)

  const finalName = type === "text" ? normalizeTextChannelName(name) : name.trim()

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!finalName) {
      setError("Give the channel a name.")
      return
    }
    try {
      const channel = await createChannel.mutateAsync({ type, name: finalName, parentId })
      closeDialog()
      if (channel.type === "text") router.push(`/channels/${serverId}/${channel.id}`)
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  const Icon = type === "text" ? HashIcon : Volume2Icon

  return (
    <form onSubmit={submit} noValidate>
      <DialogHeader>
        <DialogTitle>Create Channel</DialogTitle>
        {category && <DialogDescription>in {category.name}</DialogDescription>}
      </DialogHeader>

      <fieldset className="mt-5">
        <legend className={cn(labelClass, "mb-2")}>Channel type</legend>
        <div role="radiogroup" className="flex flex-col gap-2">
          {TYPES.map((t) => (
            <button
              key={t.value}
              type="button"
              role="radio"
              aria-checked={type === t.value}
              onClick={() => setType(t.value)}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2.5 text-left transition-colors",
                type === t.value ? "bg-item-selected" : "bg-sidebar hover:bg-item-hover"
              )}
            >
              <t.icon className="size-6 shrink-0 text-interactive" />
              <span className="min-w-0 flex-1">
                <span className="block font-medium text-header">{t.label}</span>
                <span className="block text-sm text-muted-foreground">{t.hint}</span>
              </span>
              <span
                className={cn(
                  "size-5 shrink-0 rounded-full border-2",
                  type === t.value ? "border-primary bg-primary ring-4 ring-inset ring-background" : "border-interactive"
                )}
              />
            </button>
          ))}
        </div>
      </fieldset>

      <Field className="mt-5" data-invalid={Boolean(error)}>
        <FieldLabel htmlFor="channel-name" className={labelClass}>
          Channel name
        </FieldLabel>
        <div className="relative">
          <Icon className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="channel-name"
            className="pl-8"
            placeholder={type === "text" ? "new-channel" : "New Voice Channel"}
            value={type === "text" ? name.toLowerCase().replace(/\s/g, "-") : name}
            maxLength={100}
            autoFocus
            onChange={(e) => {
              setName(e.target.value)
              setError(null)
            }}
            aria-invalid={Boolean(error)}
          />
        </div>
        {error && <FieldError>{error}</FieldError>}
      </Field>

      <DialogFooter className={footerClass}>
        <Button type="button" variant="ghost" onClick={closeDialog}>
          Cancel
        </Button>
        <Button type="submit" disabled={!finalName || createChannel.isPending}>
          Create Channel
        </Button>
      </DialogFooter>
    </form>
  )
}

export function CreateCategoryDialog({ serverId }: { serverId: string }) {
  const closeDialog = useUiStore((s) => s.closeDialog)
  const createChannel = useCreateChannel(serverId)
  const [name, setName] = useState("")
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) {
      setError("Give the category a name.")
      return
    }
    try {
      await createChannel.mutateAsync({ type: "category", name: name.trim() })
      closeDialog()
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  return (
    <form onSubmit={submit} noValidate>
      <DialogHeader>
        <DialogTitle>Create Category</DialogTitle>
      </DialogHeader>
      <Field className="mt-5" data-invalid={Boolean(error)}>
        <FieldLabel htmlFor="category-name" className={labelClass}>
          Category name
        </FieldLabel>
        <Input
          id="category-name"
          placeholder="New Category"
          value={name}
          maxLength={100}
          autoFocus
          onChange={(e) => {
            setName(e.target.value)
            setError(null)
          }}
          aria-invalid={Boolean(error)}
        />
        {error && <FieldError>{error}</FieldError>}
        <FieldDescription className="text-xs">
          Private categories (visible to chosen roles only) arrive with roles.
        </FieldDescription>
      </Field>
      <DialogFooter className={footerClass}>
        <Button type="button" variant="ghost" onClick={closeDialog}>
          Cancel
        </Button>
        <Button type="submit" disabled={!name.trim() || createChannel.isPending}>
          Create Category
        </Button>
      </DialogFooter>
    </form>
  )
}

export type AccessValue = { isPrivate: boolean; roleIds: string[] }

/** "Private Channel" switch plus the roles that can see it. */
export function PrivateChannelFields({
  serverId,
  value,
  loading,
  onChange,
}: {
  serverId: string
  value: AccessValue
  loading: boolean
  onChange: (value: AccessValue) => void
}) {
  const { data: roles } = useRoles(serverId)
  const choices = (roles ?? []).filter((r) => !r.is_default)

  return (
    <div className="mt-5 rounded-lg bg-sidebar p-3">
      <label className="flex items-start gap-3">
        <LockIcon className="mt-0.5 size-4 shrink-0 text-interactive" />
        <span className="flex-1">
          <span className="block text-sm font-medium text-header">Private Channel</span>
          <span className="block text-xs text-muted-foreground">
            Only selected roles (and admins) can see it.
          </span>
        </span>
        <Switch
          checked={value.isPrivate}
          disabled={loading}
          onCheckedChange={(isPrivate) => onChange({ ...value, isPrivate })}
        />
      </label>
      {value.isPrivate && (
        <fieldset className="mt-3 border-t border-border pt-3">
          <legend className={cn(labelClass, "mb-2")}>Who can access this channel?</legend>
          {choices.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              This server has no roles yet. Create one in Server Settings → Roles.
            </p>
          ) : (
            <div className="flex max-h-40 flex-col gap-1.5 overflow-y-auto">
              {choices.map((role) => (
                <label key={role.id} className="flex items-center gap-2 text-sm text-foreground">
                  <Checkbox
                    checked={value.roleIds.includes(role.id)}
                    onCheckedChange={(checked) =>
                      onChange({
                        ...value,
                        roleIds: checked
                          ? [...value.roleIds, role.id]
                          : value.roleIds.filter((id) => id !== role.id),
                      })
                    }
                  />
                  <span className="size-2.5 rounded-full" style={{ backgroundColor: role.color ?? "#99aab5" }} />
                  {role.name}
                </label>
              ))}
            </div>
          )}
        </fieldset>
      )}
    </div>
  )
}
