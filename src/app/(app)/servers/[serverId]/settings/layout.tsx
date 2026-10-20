import { Suspense } from "react"

import { SplashScreen } from "@/components/brand/splash-screen"
import { ServerSettingsShell } from "@/components/servers/server-settings"

export default function ServerSettingsLayout({ children }: LayoutProps<"/servers/[serverId]/settings">) {
  return (
    <Suspense fallback={<SplashScreen message="Loading settings…" />}>
      <ServerSettingsShell>{children}</ServerSettingsShell>
    </Suspense>
  )
}
