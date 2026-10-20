import type { Metadata } from "next"

import { AuthGate } from "@/components/auth/auth-gate"

export const metadata: Metadata = { title: "Set up your profile" }

export default function OnboardingLayout({ children }: LayoutProps<"/onboarding">) {
  return <AuthGate mode="onboarding">{children}</AuthGate>
}
