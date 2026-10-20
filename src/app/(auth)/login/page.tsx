import type { Metadata } from "next"
import { Suspense } from "react"

import { LoginForm } from "@/components/auth/login-form"
import { Skeleton } from "@/components/ui/skeleton"

export const metadata: Metadata = { title: "Log in" }

export default function LoginPage() {
  return (
    <Suspense fallback={<Skeleton className="h-80 w-full bg-muted" />}>
      <LoginForm />
    </Suspense>
  )
}
