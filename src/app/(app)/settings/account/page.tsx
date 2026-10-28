"use client"

import Link from "next/link"
import { useState } from "react"
import { toast } from "@/lib/toast"

import { UserAvatar } from "@/components/profile/user-avatar"
import { SettingsSection } from "@/components/settings/settings-layout"
import { Button } from "@/components/ui/button"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { authErrorMessage, signOut } from "@/lib/api/auth"
import { displayNameOf } from "@/lib/profile-display"
import { useMyProfile } from "@/lib/queries/profiles"
import { useAuthStore } from "@/lib/stores/auth-store"
import { getSupabase } from "@/lib/supabase/client"
import { passwordSchema } from "@/lib/validation"

function maskEmail(email: string) {
  const [local, domain] = email.split("@")
  return `${"*".repeat(Math.max(local.length, 4))}@${domain}`
}

function Row({ label, value, action }: { label: string; value: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0">
        <p className="text-xs font-bold tracking-wide text-muted-foreground uppercase">{label}</p>
        <p className="truncate text-foreground">{value}</p>
      </div>
      {action}
    </div>
  )
}

function ChangePassword() {
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const parsed = passwordSchema.safeParse(password)
    if (!parsed.success) {
      setError(parsed.error.issues[0].message)
      return
    }
    setSaving(true)
    setError(null)
    const { error: authError } = await getSupabase().auth.updateUser({ password })
    setSaving(false)
    if (authError) {
      setError(authErrorMessage(authError))
      return
    }
    setPassword("")
    toast.success("Password changed.")
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3 sm:max-w-sm">
      <Field data-invalid={Boolean(error)}>
        <FieldLabel htmlFor="new-password" className="text-xs font-bold tracking-wide uppercase">
          New password
        </FieldLabel>
        <Input
          id="new-password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          aria-invalid={Boolean(error)}
        />
        {error && <FieldError>{error}</FieldError>}
      </Field>
      <Button type="submit" className="self-start" disabled={saving || !password}>
        {saving ? "Saving…" : "Change Password"}
      </Button>
    </form>
  )
}

export default function AccountSettingsPage() {
  const { data: profile } = useMyProfile()
  const email = useAuthStore((s) => s.session?.user.email ?? "")
  const [revealEmail, setRevealEmail] = useState(false)

  if (!profile) return null
  const name = displayNameOf(profile)

  return (
    <>
      <SettingsSection title="My Account">
        <div className="overflow-hidden rounded-lg bg-rail">
          <div className="h-24" style={{ backgroundColor: profile.banner_color }} />
          <div className="flex items-end gap-4 px-4 pb-4">
            <div className="-mt-10 rounded-full bg-rail p-1.5">
              <UserAvatar
                userId={profile.id}
                name={name}
                src={profile.avatar_url}
                className="size-20"
              />
            </div>
            <p className="min-w-0 flex-1 truncate pb-1 text-xl font-bold text-header">{name}</p>
            <Button asChild className="mb-1">
              <Link href="/settings/profile">Edit User Profile</Link>
            </Button>
          </div>
          <div className="m-4 mt-0 flex flex-col gap-5 rounded-lg bg-sidebar p-4">
            <Row label="Display Name" value={profile.display_name || "You haven't set one."} />
            <Row label="Username" value={profile.username} />
            <Row
              label="Email"
              value={revealEmail ? email : maskEmail(email || "you@example.com")}
              action={
                <Button variant="link" className="text-link" onClick={() => setRevealEmail((v) => !v)}>
                  {revealEmail ? "Hide" : "Reveal"}
                </Button>
              }
            />
          </div>
        </div>
      </SettingsSection>

      <SettingsSection title="Password and Authentication">
        <ChangePassword />
      </SettingsSection>

      <SettingsSection title="Log Out" description="Sign out of KTCord on this device.">
        <Button variant="destructive" onClick={() => signOut()}>
          Log Out
        </Button>
      </SettingsSection>
    </>
  )
}
