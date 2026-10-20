import type { Metadata } from "next"
import { Suspense } from "react"

import { SplashScreen } from "@/components/brand/splash-screen"
import { InviteLanding } from "@/components/servers/invite-landing"

export const metadata: Metadata = { title: "Invite" }

export default function InvitePage() {
  return (
    <Suspense fallback={<SplashScreen message="Loading invite…" />}>
      <InviteLanding />
    </Suspense>
  )
}
