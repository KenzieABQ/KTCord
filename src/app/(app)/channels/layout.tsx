import { Suspense } from "react"

import { AppShell } from "@/components/layout/app-shell"
import { AppShellSkeleton } from "@/components/layout/skeletons"

export default function ChannelsLayout({ children }: LayoutProps<"/channels">) {
  // The shell reads the URL (server/channel ids), so it renders behind a skeleton boundary.
  return (
    <Suspense fallback={<AppShellSkeleton />}>
      <AppShell>{children}</AppShell>
    </Suspense>
  )
}
