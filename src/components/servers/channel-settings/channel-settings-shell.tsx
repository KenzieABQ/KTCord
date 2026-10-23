"use client"

import { useParams, useRouter } from "next/navigation"
import { useEffect, type ReactNode } from "react"

import { SplashScreen } from "@/components/brand/splash-screen"
import { SettingsLayout, SettingsSection, type SettingsNavGroup } from "@/components/settings/settings-layout"
import { hasPermission, Permission } from "@/lib/permissions"
import { useChannel, useServerPermissions } from "@/lib/queries/servers"

export function useChannelSettingsParams() {
  return useParams<{ serverId: string; channelId: string }>()
}

const TYPE_LABEL: Record<string, string> = { text: "Text Channel", voice: "Voice Channel", category: "Category" }

/**
 * Full-page Channel Settings, like Discord's: Overview (Manage Channels) and Permissions
 * (Manage Roles). Escape or the close button returns to the channel.
 */
export function ChannelSettingsShell({ children }: { children: ReactNode }) {
  const { serverId, channelId } = useChannelSettingsParams()
  const router = useRouter()
  const { data: channel, isPending } = useChannel(serverId, channelId)
  const { ready, permissions } = useServerPermissions(serverId)

  useEffect(() => {
    if (!isPending && !channel) router.replace(`/channels/${serverId}`)
  }, [isPending, channel, serverId, router])

  if (!channel || !ready) return <SplashScreen message="Loading channel settings…" />

  const base = `/servers/${serverId}/channels/${channelId}/settings`
  const items = [
    hasPermission(permissions, Permission.MANAGE_CHANNELS) && { href: `${base}/overview`, label: "Overview" },
    channel.type !== "category" &&
      hasPermission(permissions, Permission.MANAGE_ROLES) && { href: `${base}/permissions`, label: "Permissions" },
  ].filter(Boolean) as SettingsNavGroup["items"]
  const prefix = channel.type === "text" ? "# " : ""
  const nav: SettingsNavGroup[] = items.length
    ? [{ heading: `${prefix}${channel.name} · ${TYPE_LABEL[channel.type] ?? "Channel"}`, items }]
    : []
  const closeHref = channel.type === "category" ? `/channels/${serverId}` : `/channels/${serverId}/${channelId}`

  return (
    <SettingsLayout nav={nav} closeHref={closeHref}>
      {nav.length > 0 ? (
        children
      ) : (
        <SettingsSection title="Channel Settings">
          <p className="text-muted-foreground">You don&apos;t have permission to manage this channel.</p>
        </SettingsSection>
      )}
    </SettingsLayout>
  )
}
