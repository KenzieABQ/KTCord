"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "@/lib/toast"

import { KtcordLogo } from "@/components/brand/logo"
import { Button } from "@/components/ui/button"
import { errorMessage } from "@/lib/api/errors"
import { nextFromLocation } from "@/lib/navigation"
import { displayNameOf } from "@/lib/profile-display"
import { useMyProfile, useUpdateMyProfile } from "@/lib/queries/profiles"

import { ProfileEditor } from "./profile-editor"

export function OnboardingView() {
  const router = useRouter()
  const { data: profile } = useMyProfile()
  const updateProfile = useUpdateMyProfile()
  const [skipping, setSkipping] = useState(false)

  if (!profile) return null

  async function skip() {
    setSkipping(true)
    try {
      await updateProfile.mutateAsync({ onboarded_at: new Date().toISOString() })
      router.replace(nextFromLocation())
    } catch (error) {
      toast.error(errorMessage(error))
      setSkipping(false)
    }
  }

  return (
    <div className="h-full overflow-y-auto bg-rail">
      <div className="mx-auto flex max-w-4xl flex-col gap-8 px-4 py-10 sm:px-8 sm:py-14">
        <header className="flex flex-col gap-4">
          <KtcordLogo />
          <div>
            <h1 className="text-3xl font-bold text-header">
              Welcome, {displayNameOf(profile)}!
            </h1>
            <p className="mt-1 text-muted-foreground">
              Set up your profile so friends know it&apos;s you. You can change any of this
              later in User Settings.
            </p>
          </div>
        </header>

        <div className="rounded-lg bg-chat p-5 shadow-xl sm:p-8">
          <ProfileEditor
            profile={profile}
            submitLabel="Finish"
            markOnboarded
            onSaved={() => router.replace(nextFromLocation())}
            secondaryAction={
              <Button type="button" variant="ghost" onClick={skip} disabled={skipping}>
                Skip for now
              </Button>
            }
          />
        </div>
      </div>
    </div>
  )
}
