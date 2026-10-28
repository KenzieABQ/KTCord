"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useEffect, useRef, useState, type ReactNode } from "react"
import { useForm, useWatch } from "react-hook-form"
import { toast } from "@/lib/toast"

import { UsernameStatus } from "@/components/auth/username-status"
import { UnsavedChangesBar } from "@/components/settings/settings-layout"
import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { useUsernameAvailability } from "@/hooks/use-username-availability"
import { errorMessage } from "@/lib/api/errors"
import type { Profile } from "@/lib/api/profiles"
import { uploadAvatar, uploadBanner } from "@/lib/api/storage"
import { readFileAsDataUrl } from "@/lib/image"
import { BANNER_PRESETS, displayNameOf, THEME_PRESETS } from "@/lib/profile-display"
import { useUpdateMyProfile } from "@/lib/queries/profiles"
import { cn } from "@/lib/utils"
import { profileSchema, type ProfileValues } from "@/lib/validation"

import { AvatarCropDialog } from "./avatar-crop-dialog"
import { ProfileCard } from "./profile-card"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

type ImageChange = { kind: "unchanged" } | { kind: "new"; blob: Blob; previewUrl: string } | { kind: "removed" }

const MAX_SOURCE_BYTES = 10 * 1024 * 1024
/** The avatars bucket's limit; GIFs are uploaded as they are. */
const MAX_GIF_BYTES = 5 * 1024 * 1024
const labelClass = "text-xs font-bold tracking-wide uppercase"
const BANNER_SIZE = { width: 960, height: 340 }

function valuesOf(profile: Profile): ProfileValues {
  return {
    displayName: profile.display_name ?? "",
    username: profile.username,
    pronouns: profile.pronouns ?? "",
    bannerColor: profile.banner_color,
    themePrimary: profile.theme_primary ?? "",
    themeAccent: profile.theme_accent ?? "",
    bio: profile.bio,
  }
}

/** A swatch that opens the native color picker. */
function ColorPicker({ label, value, onChange }: { label: string; value: string; onChange: (hex: string) => void }) {
  return (
    <label className="flex flex-col items-center gap-1.5 text-xs text-muted-foreground">
      <span
        className="relative size-16 cursor-pointer overflow-hidden rounded-lg border border-border shadow-inner"
        style={{ backgroundColor: value }}
      >
        <input
          type="color"
          aria-label={label}
          className="absolute inset-0 cursor-pointer opacity-0"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      </span>
      {label}
    </label>
  )
}

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
  const avatarInput = useRef<HTMLInputElement>(null)
  const bannerInput = useRef<HTMLInputElement>(null)
  const [crop, setCrop] = useState<{ src: string; target: "avatar" | "banner" } | null>(null)
  const [avatar, setAvatar] = useState<ImageChange>({ kind: "unchanged" })
  const [banner, setBanner] = useState<ImageChange>({ kind: "unchanged" })

  const form = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: valuesOf(profile),
    reValidateMode: "onChange",
  })
  const { errors, isSubmitting, isDirty } = form.formState
  const values = useWatch({ control: form.control }) as ProfileValues
  const availability = useUsernameAvailability(values.username, profile.username)
  const themed = Boolean(values.themePrimary && values.themeAccent)
  const set = (name: keyof ProfileValues, value: string) => form.setValue(name, value, { shouldDirty: true })

  // Release preview object URLs when they're replaced or the editor unmounts.
  useEffect(() => {
    if (avatar.kind !== "new") return
    return () => URL.revokeObjectURL(avatar.previewUrl)
  }, [avatar])
  useEffect(() => {
    if (banner.kind !== "new") return
    return () => URL.revokeObjectURL(banner.previewUrl)
  }, [banner])

  async function onPickFile(file: File | undefined, target: "avatar" | "banner") {
    if (!file) return
    if (!file.type.startsWith("image/")) {
      toast.error("Pick an image file.")
      return
    }
    if (file.size > MAX_SOURCE_BYTES) {
      toast.error("That image is too large (max 10 MB).")
      return
    }
    // GIFs keep their animation, so they skip the cropper (re-encoding would freeze them).
    if (file.type === "image/gif") {
      if (file.size > MAX_GIF_BYTES) {
        toast.error("Animated images can be up to 5 MB.")
        return
      }
      const change = { kind: "new" as const, blob: file, previewUrl: URL.createObjectURL(file) }
      if (target === "banner") setBanner(change)
      else setAvatar(change)
      return
    }
    setCrop({ src: await readFileAsDataUrl(file), target })
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
      let bannerUrl = profile.banner_url
      if (banner.kind === "new") bannerUrl = await uploadBanner(profile.id, banner.blob)
      if (banner.kind === "removed") bannerUrl = null
      const theme = next.themePrimary && next.themeAccent

      const saved = await updateProfile.mutateAsync({
        display_name: next.displayName || null,
        username: next.username,
        pronouns: next.pronouns || null,
        banner_color: next.bannerColor,
        banner_url: bannerUrl,
        theme_primary: theme ? next.themePrimary : null,
        theme_accent: theme ? next.themeAccent : null,
        bio: next.bio,
        avatar_url: avatarUrl,
        ...(markOnboarded && { onboarded_at: new Date().toISOString() }),
      })
      setAvatar({ kind: "unchanged" })
      setBanner({ kind: "unchanged" })
      form.reset(valuesOf(saved))
      if (!markOnboarded) toast.success("Profile saved.")
      onSaved?.(saved)
    } catch (error) {
      toast.error(errorMessage(error))
    }
  }

  const previewAvatar =
    avatar.kind === "new" ? avatar.previewUrl : avatar.kind === "removed" ? null : profile.avatar_url
  const previewBanner =
    banner.kind === "new" ? banner.previewUrl : banner.kind === "removed" ? null : profile.banner_url
  const dirty = isDirty || avatar.kind !== "unchanged" || banner.kind !== "unchanged"
  const validHex = (v: string | undefined) => Boolean(v && /^#[0-9a-f]{6}$/i.test(v))

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="grid gap-8 md:grid-cols-[minmax(0,1fr)_300px]">
      <FieldGroup className="gap-6">
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

        <Field data-invalid={Boolean(errors.pronouns)}>
          <FieldLabel htmlFor="pronouns" className={labelClass}>
            Pronouns
          </FieldLabel>
          <Input
            id="pronouns"
            maxLength={40}
            placeholder="Add your pronouns"
            aria-invalid={Boolean(errors.pronouns)}
            {...form.register("pronouns")}
          />
          <FieldError errors={[errors.pronouns]} />
        </Field>

        <div className="h-px bg-border" />

        <Field>
          <FieldLabel className={labelClass}>Avatar</FieldLabel>
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={() => avatarInput.current?.click()}>
              Change Avatar
            </Button>
            {previewAvatar && (
              <Button type="button" variant="ghost" onClick={() => setAvatar({ kind: "removed" })}>
                Remove Avatar
              </Button>
            )}
          </div>
          <input
            ref={avatarInput}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            className="hidden"
            onChange={(e) => {
              void onPickFile(e.target.files?.[0], "avatar")
              e.target.value = ""
            }}
          />
        </Field>

        <Field>
          <FieldLabel className={labelClass}>Profile Banner</FieldLabel>
          <FieldDescription>An image across the top of your profile. Without one, your banner color shows.</FieldDescription>
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={() => bannerInput.current?.click()}>
              {previewBanner ? "Change Banner" : "Upload Banner"}
            </Button>
            {previewBanner && (
              <Button type="button" variant="ghost" onClick={() => setBanner({ kind: "removed" })}>
                Remove Banner
              </Button>
            )}
          </div>
          <input
            ref={bannerInput}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            className="hidden"
            onChange={(e) => {
              void onPickFile(e.target.files?.[0], "banner")
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
                aria-pressed={values.bannerColor?.toLowerCase() === color}
                onClick={() => set("bannerColor", color)}
                className={cn(
                  "size-8 rounded-md ring-offset-2 ring-offset-background transition-transform hover:scale-105",
                  values.bannerColor?.toLowerCase() === color && "ring-2 ring-foreground"
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
                onChange={(e) => set("bannerColor", e.target.value)}
              />
            </label>
          </div>
          <FieldError errors={[errors.bannerColor]} />
        </Field>

        <Field>
          <FieldLabel className={labelClass}>Profile Theme</FieldLabel>
          <FieldDescription>Two colors that wash across your whole profile card.</FieldDescription>
          <div className="flex flex-wrap gap-2">
            {THEME_PRESETS.map((preset) => {
              const selected =
                values.themePrimary?.toLowerCase() === preset.primary && values.themeAccent?.toLowerCase() === preset.accent
              return (
                <Tooltip key={preset.name}>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      aria-label={`${preset.name} theme`}
                      aria-pressed={selected}
                      onClick={() => {
                        set("themePrimary", preset.primary)
                        set("themeAccent", preset.accent)
                      }}
                      className={cn(
                        "size-10 rounded-full ring-offset-2 ring-offset-background transition-transform hover:scale-105",
                        selected && "ring-2 ring-foreground"
                      )}
                      style={{ background: `linear-gradient(180deg, ${preset.primary}, ${preset.accent})` }}
                    />
                  </TooltipTrigger>
                  <TooltipContent side="top">{preset.name}</TooltipContent>
                </Tooltip>
              )
            })}
          </div>
          <div className="mt-2 flex items-end gap-4">
            <ColorPicker
              label="Primary"
              value={validHex(values.themePrimary) ? values.themePrimary : "#5865f2"}
              onChange={(hex) => {
                set("themePrimary", hex)
                if (!values.themeAccent) set("themeAccent", "#1e1f22")
              }}
            />
            <ColorPicker
              label="Accent"
              value={validHex(values.themeAccent) ? values.themeAccent : "#1e1f22"}
              onChange={(hex) => {
                set("themeAccent", hex)
                if (!values.themePrimary) set("themePrimary", "#5865f2")
              }}
            />
            {themed && (
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  set("themePrimary", "")
                  set("themeAccent", "")
                }}
              >
                Remove Theme
              </Button>
            )}
          </div>
        </Field>

        <div className="h-px bg-border" />

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
          <FieldDescription className="text-right text-xs">{(values.bio ?? "").length}/190</FieldDescription>
          <FieldError errors={[errors.bio]} />
        </Field>

        <div className="flex flex-wrap items-center gap-2">
          {/* In settings, saving happens from the unsaved-changes bar, as in Discord. */}
          {markOnboarded && (
            <Button type="submit" size="lg" disabled={isSubmitting || availability === "taken"}>
              {isSubmitting ? "Saving…" : submitLabel}
            </Button>
          )}
          {secondaryAction}
        </div>
        {!markOnboarded && dirty && (
          <UnsavedChangesBar
            onReset={() => {
              form.reset()
              setAvatar({ kind: "unchanged" })
              setBanner({ kind: "unchanged" })
            }}
            onSave={() => {
              if (availability === "taken") form.setError("username", { message: "That username is taken" })
              else void form.handleSubmit(onSubmit)()
            }}
            saving={isSubmitting}
          />
        )}
      </FieldGroup>

      <div className="md:sticky md:top-0 md:self-start">
        <p className={cn(labelClass, "mb-2 text-muted-foreground")}>Preview</p>
        <ProfileCard
          status="online"
          profile={{
            id: profile.id,
            username: values.username,
            displayName: displayNameOf({ display_name: values.displayName, username: values.username }),
            avatarUrl: previewAvatar,
            bannerColor: validHex(values.bannerColor) ? values.bannerColor : profile.banner_color,
            bannerUrl: previewBanner,
            themePrimary: themed && validHex(values.themePrimary) ? values.themePrimary : null,
            themeAccent: themed && validHex(values.themeAccent) ? values.themeAccent : null,
            pronouns: values.pronouns || null,
            bio: values.bio ?? "",
            createdAt: profile.created_at,
          }}
        />
      </div>

      <AvatarCropDialog
        src={crop?.src ?? null}
        title={crop?.target === "banner" ? "Edit banner" : "Edit avatar"}
        output={crop?.target === "banner" ? BANNER_SIZE : undefined}
        round={crop?.target !== "banner"}
        onCancel={() => setCrop(null)}
        onApply={(blob) => {
          const change = { kind: "new" as const, blob, previewUrl: URL.createObjectURL(blob) }
          if (crop?.target === "banner") setBanner(change)
          else setAvatar(change)
          setCrop(null)
        }}
      />
    </form>
  )
}
