"use client"

import { useRouter } from "next/navigation"
import { useEffect, type ReactNode } from "react"

import { SplashScreen } from "@/components/brand/splash-screen"
import { signOut } from "@/lib/api/auth"
import { errorMessage } from "@/lib/api/errors"
import { nextFromLocation } from "@/lib/navigation"
import { useProfile } from "@/lib/queries/profiles"
import { useAuthStore } from "@/lib/stores/auth-store"

/**
 * Renders children only for a signed-in user with a loaded profile.
 * `mode="app"` also requires onboarding to be finished; `mode="onboarding"` requires it not to be.
 */
export function AuthGate({
  children,
  mode = "app",
}: {
  children: ReactNode
  mode?: "app" | "onboarding"
}) {
  const router = useRouter()
  const status = useAuthStore((s) => s.status)
  const userId = useAuthStore((s) => s.userId)
  const profile = useProfile(userId)
  const onboarded = Boolean(profile.data?.onboarded_at)

  useEffect(() => {
    if (status !== "signed-out") return
    const next = window.location.pathname + window.location.search
    router.replace(`/login?next=${encodeURIComponent(next)}`)
  }, [status, router])

  useEffect(() => {
    if (!profile.data) return
    if (mode === "app" && !onboarded) {
      const here = window.location.pathname + window.location.search
      router.replace(`/onboarding?next=${encodeURIComponent(here)}`)
    }
    if (mode === "onboarding" && onboarded) router.replace(nextFromLocation())
  }, [profile.data, onboarded, mode, router])

  if (profile.error) {
    return (
      <SplashScreen
        error={`We couldn't load your profile. ${errorMessage(profile.error)}`}
        onRetry={() => profile.refetch()}
        onSignOut={() => signOut()}
      />
    )
  }

  const ready =
    status === "signed-in" &&
    profile.data &&
    (mode === "app" ? onboarded : !onboarded)

  if (!ready) return <SplashScreen />
  return children
}
