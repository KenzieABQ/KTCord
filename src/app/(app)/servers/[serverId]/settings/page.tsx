import { redirect } from "next/navigation"

export default async function ServerSettingsIndex({ params }: PageProps<"/servers/[serverId]/settings">) {
  const { serverId } = await params
  redirect(`/servers/${serverId}/settings/overview`)
}
