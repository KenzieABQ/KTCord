import { redirect } from "next/navigation"

export default async function ChannelSettingsIndex({ params }: PageProps<"/servers/[serverId]/channels/[channelId]/settings">) {
  const { serverId, channelId } = await params
  redirect(`/servers/${serverId}/channels/${channelId}/settings/overview`)
}
