import { Suspense } from "react"

import { SplashScreen } from "@/components/brand/splash-screen"
import { ChannelSettingsShell } from "@/components/servers/channel-settings/channel-settings-shell"

export default function ChannelSettingsLayout({ children }: LayoutProps<"/servers/[serverId]/channels/[channelId]/settings">) {
  return (
    <Suspense fallback={<SplashScreen message="Loading channel settings…" />}>
      <ChannelSettingsShell>{children}</ChannelSettingsShell>
    </Suspense>
  )
}
