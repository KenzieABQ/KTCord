"use client"

import { CameraIcon, CheckCircle2Icon } from "@/components/icons"
import { useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import { toast } from "@/lib/toast"

import { AvatarCropDialog } from "@/components/profile/avatar-crop-dialog"
import { Button } from "@/components/ui/button"
import {
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { useDebouncedValue } from "@/hooks/use-debounced-value"
import { errorMessage } from "@/lib/api/errors"
import { parseInviteCode } from "@/lib/api/invites"
import { readFileAsDataUrl } from "@/lib/image"
import { useMyProfile } from "@/lib/queries/profiles"
import { useCreateServer, useInvitePreview, useJoinServer } from "@/lib/queries/servers"
import { useUiStore } from "@/lib/stores/ui-store"

import { ServerIcon } from "./server-icon"

const labelClass = "text-xs font-bold tracking-wide uppercase text-muted-foreground"

/** Round "UPLOAD" picker with crop, shared by Create Server and Server Settings. */
export function IconPicker({
  previewUrl,
  onPicked,
  label = "Upload",
}: {
  previewUrl: string | null
  onPicked: (blob: Blob) => void
  label?: string
}) {
  const input = useRef<HTMLInputElement>(null)
  const [cropSrc, setCropSrc] = useState<string | null>(null)

  return (
    <>
      <button
        type="button"
        onClick={() => input.current?.click()}
        className="relative flex size-20 items-center justify-center overflow-hidden rounded-full border-2 border-dashed border-interactive text-interactive transition-colors hover:border-interactive-hover hover:text-interactive-hover"
        aria-label="Upload server icon"
      >
        {previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- local object URL preview
          <img src={previewUrl} alt="" className="size-full object-cover" />
        ) : (
          <span className="flex flex-col items-center gap-0.5 text-[10px] font-bold uppercase">
            <CameraIcon className="size-6" />
            {label}
          </span>
        )}
      </button>
      <input
        ref={input}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0]
          e.target.value = ""
          if (!file) return
          if (file.size > 10 * 1024 * 1024) {
            toast.error("That image is too large (max 10 MB).")
            return
          }
          // Animated icons keep their animation, so they skip the cropper.
          if (file.type === "image/gif") {
            if (file.size > 5 * 1024 * 1024) toast.error("Animated icons can be up to 5 MB.")
            else onPicked(file)
            return
          }
          setCropSrc(await readFileAsDataUrl(file))
        }}
      />
      <AvatarCropDialog
        src={cropSrc}
        title="Edit icon"
        onCancel={() => setCropSrc(null)}
        onApply={(blob) => {
          onPicked(blob)
          setCropSrc(null)
        }}
      />
    </>
  )
}

/** A wide banner picker with crop (16:9); GIFs are kept as they are so they still play. */
export function BannerPicker({
  previewUrl,
  onPicked,
  onRemove,
}: {
  previewUrl: string | null
  onPicked: (blob: Blob) => void
  onRemove?: () => void
}) {
  const input = useRef<HTMLInputElement>(null)
  const [cropSrc, setCropSrc] = useState<string | null>(null)

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={() => input.current?.click()}
        aria-label="Upload server banner"
        className="relative flex aspect-video w-full max-w-sm items-center justify-center overflow-hidden rounded-lg border-2 border-dashed border-interactive text-interactive transition-colors hover:border-interactive-hover hover:text-interactive-hover"
      >
        {previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- preview of a local or uploaded banner
          <img src={previewUrl} alt="" className="size-full object-cover" />
        ) : (
          <span className="flex flex-col items-center gap-1 text-xs font-bold uppercase">
            <CameraIcon className="size-6" />
            Upload Banner
          </span>
        )}
      </button>
      {onRemove && (
        <button type="button" onClick={onRemove} className="self-start text-xs text-muted-foreground hover:underline">
          Remove banner
        </button>
      )}
      <input
        ref={input}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0]
          e.target.value = ""
          if (!file) return
          if (file.size > 10 * 1024 * 1024) {
            toast.error("That image is too large (max 10 MB).")
            return
          }
          if (file.type === "image/gif") {
            if (file.size > 5 * 1024 * 1024) toast.error("Animated banners can be up to 5 MB.")
            else onPicked(file)
            return
          }
          setCropSrc(await readFileAsDataUrl(file))
        }}
      />
      <AvatarCropDialog
        src={cropSrc}
        title="Edit banner"
        output={{ width: 960, height: 540 }}
        round={false}
        onCancel={() => setCropSrc(null)}
        onApply={(blob) => {
          onPicked(blob)
          setCropSrc(null)
        }}
      />
    </div>
  )
}

export function CreateServerDialog() {
  const router = useRouter()
  const { data: profile } = useMyProfile()
  const openDialog = useUiStore((s) => s.openDialog)
  const closeDialog = useUiStore((s) => s.closeDialog)
  const createServer = useCreateServer()

  const [name, setName] = useState(() => (profile ? `${profile.username}'s server` : ""))
  const [icon, setIcon] = useState<{ blob: Blob; url: string } | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!icon) return
    return () => URL.revokeObjectURL(icon.url)
  }, [icon])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (name.trim().length < 2) {
      setError("Server names need at least 2 characters.")
      return
    }
    try {
      const serverId = await createServer.mutateAsync({ name: name.trim(), icon: icon?.blob ?? null })
      closeDialog()
      router.push(`/channels/${serverId}`)
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  return (
    <form onSubmit={submit} noValidate>
      <DialogHeader className="items-center text-center">
        <DialogTitle className="text-2xl">Customize your server</DialogTitle>
        <DialogDescription>
          Give your new server a personality with a name and an icon. You can always change it
          later.
        </DialogDescription>
      </DialogHeader>

      <div className="my-6 flex justify-center">
        <IconPicker
          previewUrl={icon?.url ?? null}
          onPicked={(blob) => setIcon({ blob, url: URL.createObjectURL(blob) })}
        />
      </div>

      <Field data-invalid={Boolean(error)}>
        <FieldLabel htmlFor="server-name" className={labelClass}>
          Server name
        </FieldLabel>
        <Input
          id="server-name"
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
      </Field>

      <DialogFooter className="mt-6 -mx-6 -mb-6 items-center rounded-b-xl bg-sidebar px-4 py-3 sm:justify-between">
        <Button
          type="button"
          variant="link"
          className="text-foreground"
          onClick={() => openDialog({ kind: "join-server" })}
        >
          Have an invite already?
        </Button>
        <Button type="submit" disabled={createServer.isPending}>
          {createServer.isPending ? "Creating…" : "Create"}
        </Button>
      </DialogFooter>
    </form>
  )
}

export function JoinServerDialog({ initialCode }: { initialCode?: string }) {
  const router = useRouter()
  const openDialog = useUiStore((s) => s.openDialog)
  const closeDialog = useUiStore((s) => s.closeDialog)
  const joinServer = useJoinServer()

  const [value, setValue] = useState(initialCode ?? "")
  const [error, setError] = useState<string | null>(null)
  const code = useDebouncedValue(parseInviteCode(value), 300)
  const preview = useInvitePreview(code)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const parsed = parseInviteCode(value)
    if (!parsed) {
      setError("Please enter a valid invite link or invite code.")
      return
    }
    try {
      const serverId = await joinServer.mutateAsync(parsed)
      closeDialog()
      router.push(`/channels/${serverId}`)
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  const invite = preview.data

  return (
    <form onSubmit={submit} noValidate>
      <DialogHeader className="items-center text-center">
        <DialogTitle className="text-2xl">Join a Server</DialogTitle>
        <DialogDescription>Enter an invite below to join an existing server.</DialogDescription>
      </DialogHeader>

      <Field className="mt-6" data-invalid={Boolean(error)}>
        <FieldLabel htmlFor="invite-code" className={labelClass}>
          Invite link <span className="text-destructive">*</span>
        </FieldLabel>
        <Input
          id="invite-code"
          value={value}
          autoFocus
          placeholder="https://ktcord.app/invite/hTKzmak2"
          onChange={(e) => {
            setValue(e.target.value)
            setError(null)
          }}
          aria-invalid={Boolean(error)}
        />
        {error ? (
          <FieldError>{error}</FieldError>
        ) : (
          <FieldDescription className="text-xs">
            Invites look like <code>hTKzmak2</code> or a full <code>/invite/hTKzmak2</code> link.
          </FieldDescription>
        )}
      </Field>

      {invite && (
        <div className="mt-4 flex items-center gap-3 rounded-lg bg-sidebar p-3">
          <div className="size-12 shrink-0 overflow-hidden rounded-2xl bg-rail-item text-foreground">
            <ServerIcon name={invite.server_name} iconUrl={invite.server_icon_url} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold text-header">{invite.server_name}</p>
            <p className="text-xs text-muted-foreground">
              {invite.is_member ? (
                <span className="inline-flex items-center gap-1 text-status-online">
                  <CheckCircle2Icon className="size-3" /> You&apos;re already a member
                </span>
              ) : invite.is_valid ? (
                `${invite.member_count} ${invite.member_count === 1 ? "member" : "members"}`
              ) : (
                <span className="text-destructive">This invite has expired</span>
              )}
            </p>
          </div>
        </div>
      )}
      {code && preview.isSuccess && !invite && (
        <p className="mt-3 text-sm text-destructive">That invite is invalid or has been revoked.</p>
      )}

      <DialogFooter className="mt-6 -mx-6 -mb-6 items-center rounded-b-xl bg-sidebar px-4 py-3 sm:justify-between">
        <Button
          type="button"
          variant="link"
          className="text-foreground"
          onClick={() => openDialog({ kind: "create-server" })}
        >
          Create a server instead
        </Button>
        <Button type="submit" disabled={joinServer.isPending || (invite ? !invite.is_valid && !invite.is_member : false)}>
          {joinServer.isPending ? "Joining…" : invite?.is_member ? "Go to Server" : "Join Server"}
        </Button>
      </DialogFooter>
    </form>
  )
}
