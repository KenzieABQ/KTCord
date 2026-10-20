"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useEffect, useRef, useState, type ReactNode } from "react"
import { useForm, useWatch } from "react-hook-form"
import { toast } from "sonner"

import { UsernameStatus } from "@/components/auth/username-status"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { useUsernameAvailability } from "@/hooks/use-username-availability"
import { errorMessage } from "@/lib/api/errors"
import type { Profile } from "@/lib/api/profiles"
import { uploadAvatar } from "@/lib/api/storage"
import { readFileAsDataUrl } from "@/lib/image"
import { BANNER_PRESETS, displayNameOf } from "@/lib/profile-display"
import { useUpdateMyProfile } from "@/lib/queries/profiles"
import { cn } from "@/lib/utils"
import { profileSchema, type ProfileValues } from "@/lib/validation"

import { AvatarCropDialog } from "./avatar-crop-dialog"
import { ProfileCard } from "./profile-card"

type AvatarChange =
  | { kind: "unchanged" }
  | { kind: "new"; blob: Blob; previewUrl: string }
  | { kind: "removed" }

const MAX_SOURCE_BYTES = 10 * 1024 * 1024
const labelClass = "text-xs font-bold tracking-wide uppercase"

export function ProfileEditor({
  profile,
  submitLabel = "Save Changes",
  markOnboarded = false,
  secondaryAction,
  onSaved,
}: {
  profile: Profile
  submitLabel?: string
  /** Set onboarded_at on save (the onboarding flow). */
  markOnboarded?: boolean
  secondaryAction?: ReactNode
  onSaved?: (profile: Profile) => void
}) {
  const updateProfile = useUpdateMyProfile()
  const fileInput = useRef<HTMLInputElement>(null)
  const [cropSrc, setCropSrc] = useState<string | null>(null)
  const [avatar, setAvatar] = useState<AvatarChange>({ kind: "unchanged" })

  const form = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      displayName: profile.display_name ?? "",
      username: profile.username,
      bannerColor: profile.banner_color,
      bio: profile.bio,
    },
    reValidateMode: "onChange",
  })
  const { errors, isSubmitting, isDirty } = form.formState
  const [displayName, username, bannerColor, bio] = useWatch({
    control: form.control,
    name: ["displayName", "username", "bannerColor", "bio"],
  })
  const values = { displayName, username, bannerColor, bio }
  const availability = useUsernameAvailability(values.username, profile.username)

  // Release preview object URLs when they're replaced or the editor unmounts.
  useEffect(() => {
    if (avatar.kind !== "new") return
    return () => URL.revokeObjectURL(avatar.previewUrl)
  }, [avatar])

  async function onPickFile(file: File | undefined) {
    if (!file) return
    if (!file.type.startsWith("image/")) {
      toast.error("Pick an image file.")
      return
    }
    if (file.size > MAX_SOURCE_BYTES) {
      toast.error("That image is too large (max 10 MB).")
      return
    }
    setCropSrc(await readFileAsDataUrl(file))
  }

  async function onSubmit(next: ProfileValues) {
    if (availability === "taken") {
      form.setError("username", { message: "That username is taken" })
      return
    }
    try {
      let avatarUrl = profile.avatar_url
      if (avatar.kind === "new") avatarUrl = await uploadAvatar(profile.id, avatar.blob)
      if (avatar.kind === "removed") avatarUrl = null

      const saved = await updateProfile.mutateAsync({
        display_name: next.displayName || null,
        username: next.username,
        banner_color: next.bannerColor,
        bio: next.bio,
        avatar_url: avatarUrl,
        ...(markOnboarded && { onboarded_at: new Date().toISOString() }),
      })
      setAvatar({ kind: "unchanged" })
      form.reset({
        displayName: saved.display_name ?? "",
        username: saved.username,
        bannerColor: saved.banner_color,
        bio: saved.bio,
      })
      if (!markOnboarded) toast.success("Profile saved.")
      onSaved?.(saved)
    } catch (error) {
      toast.error(errorMessage(error))
    }
  }

  const previewAvatar =
    avatar.kind === "new" ? avatar.previewUrl : avatar.kind === "removed" ? null : profile.avatar_url
  const hasAvatar = Boolean(previewAvatar)
  const dirty = isDirty || avatar.kind !== "unchanged"

  return (
    <form
      onSubmit={form.handleSubmit(onSubmit)}
      noValidate
      className="grid gap-8 md:grid-cols-[minmax(0,1fr)_300px]"
    >
      <FieldGroup className="gap-5">
        <Field data-invalid={Boolean(errors.displayName)}>
          <FieldLabel htmlFor="displayName" className={labelClass}>
            Display Name
          </FieldLabel>
          <Input
            id="displayName"
            placeholder={values.username}
            aria-invalid={Boolean(errors.displayName)}
            {...form.register("displayName")}
          />
          <FieldError errors={[errors.displayName]} />
        </Field>

        <Field data-invalid={Boolean(errors.username) || availability === "taken"}>
          <FieldLabel htmlFor="username" className={labelClass}>
            Username
          </FieldLabel>
          <Input
            id="username"
            autoCapitalize="none"
            spellCheck={false}
            aria-invalid={Boolean(errors.username) || availability === "taken"}
            {...form.register("username", { setValueAs: (v: string) => v.toLowerCase() })}
          />
          {errors.username ? (
            <FieldError errors={[errors.username]} />
          ) : (
            values.username !== profile.username && <UsernameStatus status={availability} />
          )}
        </Field>

        <Field>
          <FieldLabel className={labelClass}>Avatar</FieldLabel>
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={() => fileInput.current?.click()}>
              Change Avatar
            </Button>
            {hasAvatar && (
              <Button type="button" variant="ghost" onClick={() => setAvatar({ kind: "removed" })}>
                Remove Avatar
              </Button>
            )}
          </div>
          <input
            ref={fileInput}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            className="hidden"
            onChange={(e) => {
              void onPickFile(e.target.files?.[0])
              e.target.value = ""
            }}
          />
        </Field>

        <Field data-invalid={Boolean(errors.bannerColor)}>
          <FieldLabel className={labelClass}>Banner Color</FieldLabel>
          <div className="flex flex-wrap items-center gap-2">
            {BANNER_PRESETS.map((color) => (
              <button
                key={color}
                type="button"
                aria-label={`Banner color ${color}`}
                aria-pressed={values.bannerColor.toLowerCase() === color}
                onClick={() => form.setValue("bannerColor", color, { shouldDirty: true })}
                className={cn(
                  "size-8 rounded-md ring-offset-2 ring-offset-background transition-transform hover:scale-105",
                  values.bannerColor.toLowerCase() === color && "ring-2 ring-foreground"
                )}
                style={{ backgroundColor: color }}
              />
            ))}
            <label className="relative flex size-8 cursor-pointer items-center justify-center overflow-hidden rounded-md border border-dashed border-muted-foreground/50 text-xs text-muted-foreground">
              <span aria-hidden>+</span>
              <span className="sr-only">Custom banner color</span>
              <input
                type="color"
                className="absolute inset-0 cursor-pointer opacity-0"
                value={values.bannerColor}
                onChange={(e) =>
                  form.setValue("bannerColor", e.target.value, { shouldDirty: true })
                }
              />
            </label>
          </div>
          <FieldError errors={[errors.bannerColor]} />
        </Field>

        <Field data-invalid={Boolean(errors.bio)}>
          <FieldLabel htmlFor="bio" className={labelClass}>
            About Me
          </FieldLabel>
          <Textarea
            id="bio"
            rows={4}
            maxLength={190}
            placeholder="Tell everyone a little about yourself"
            className="min-h-24 resize-none"
            aria-invalid={Boolean(errors.bio)}
            {...form.register("bio")}
          />
          <FieldDescription className="text-right text-xs">
            {values.bio.length}/190
          </FieldDescription>
          <FieldError errors={[errors.bio]} />
        </Field>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="submit"
            size="lg"
            disabled={isSubmitting || availability === "taken" || (!markOnboarded && !dirty)}
          >
            {isSubmitting ? "Saving…" : submitLabel}
          </Button>
          {!markOnboarded && dirty && (
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                form.reset()
                setAvatar({ kind: "unchanged" })
              }}
            >
              Reset
            </Button>
          )}
          {secondaryAction}
        </div>
      </FieldGroup>

      <div className="md:sticky md:top-0 md:self-start">
        <p className={cn(labelClass, "mb-2 text-muted-foreground")}>Preview</p>
        <ProfileCard
          status="online"
          profile={{
            id: profile.id,
            username: values.username,
            displayName: displayNameOf({
              display_name: values.displayName,
              username: values.username,
            }),
            avatarUrl: previewAvatar,
            bannerColor: /^#[0-9a-f]{6}$/i.test(values.bannerColor)
              ? values.bannerColor
              : profile.banner_color,
            bio: values.bio,
            createdAt: profile.created_at,
          }}
        />
      </div>

      <AvatarCropDialog
        src={cropSrc}
        title="Edit avatar"
        onCancel={() => setCropSrc(null)}
        onApply={(blob) => {
          setAvatar({ kind: "new", blob, previewUrl: URL.createObjectURL(blob) })
          setCropSrc(null)
        }}
      />
    </form>
  )
}
