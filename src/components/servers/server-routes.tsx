"use client"

import { ServerCrashIcon } from "lucide-react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { useEffect } from "react"

import { ChannelView } from "@/components/chat/channel-view"
import { MessageFeedSkeleton } from "@/components/layout/skeletons"
import { ViewHeader } from "@/components/layout/view-header"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { firstTextChannel } from "@/lib/channels/tree"
import { useChannelTree, useMyServers } from "@/lib/queries/servers"
import { useUiStore } from "@/lib/stores/ui-store"

function MainSkeleton() {
  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <ViewHeader>
        <Skeleton className="h-4 w-32 bg-item-selected/60" />
      </ViewHeader>
      <div className="flex flex-1 flex-col justify-end">
        <MessageFeedSkeleton />
      </div>
    </div>
  )
}

function EmptyMain({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <ViewHeader>
        <span className="font-semibold text-header">{title}</span>
      </ViewHeader>
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
        <ServerCrashIcon className="size-14 text-muted-foreground" />
        <div>
          <h2 className="text-xl font-bold text-header">{title}</h2>
          <p className="mt-1 max-w-sm text-muted-foreground">{body}</p>
        </div>
        <Button asChild variant="secondary">
          <Link href="/channels/me">Go Home</Link>
        </Button>
      </div>
    </div>
  )
}

function useServerExists(serverId: string) {
  const { data: servers, isPending } = useMyServers()
  return { known: !isPending, exists: Boolean(servers?.some((s) => s.id === serverId)) }
}

/** /channels/[serverId]: jump to the last channel opened here, else the first text channel. */
export function ServerIndexRoute() {
  const { serverId } = useParams<{ serverId: string }>()
  const router = useRouter()
  const server = useServerExists(serverId)
  const { tree, data: channels } = useChannelTree(server.exists ? serverId : undefined)
  const last = useUiStore((s) => s.lastChannelByServer[serverId])

  const target =
    channels?.find((c) => c.id === last && c.type !== "category")?.id ??
    (tree ? firstTextChannel(tree)?.id : undefined)

  useEffect(() => {
    if (target) router.replace(`/channels/${serverId}/${target}`)
  }, [target, serverId, router])

  if (server.known && !server.exists) {
    return <EmptyMain title="Server not found" body="It may have been deleted, or you're no longer a member." />
  }
  if (tree && !target) {
    return <EmptyMain title="No text channels" body="You don't have access to any text channels in this server yet." />
  }
  return <MainSkeleton />
}

/** /channels/[serverId]/[channelId]: the channel view, or a redirect if it's gone. */
export function ChannelRoute() {
  const { serverId, channelId, messageId } = useParams<{
    serverId: string
    channelId: string
    messageId?: string[]
  }>()
  const router = useRouter()
  const server = useServerExists(serverId)
  const { data: channels } = useChannelTree(server.exists ? serverId : undefined)
  const rememberChannel = useUiStore((s) => s.rememberChannel)
  const channel = channels?.find((c) => c.id === channelId && c.type !== "category")

  useEffect(() => {
    if (channel) rememberChannel(serverId, channel.id)
  }, [channel, serverId, rememberChannel])

  // Deleted, hidden or bogus channel: fall back to the server's default channel.
  useEffect(() => {
    if (channels && !channel) router.replace(`/channels/${serverId}`)
  }, [channels, channel, serverId, router])

  if (server.known && !server.exists) {
    return <EmptyMain title="Server not found" body="It may have been deleted, or you're no longer a member." />
  }
  if (!channel) return <MainSkeleton />
  return <ChannelView serverId={serverId} channel={channel} initialJumpId={messageId?.[0]} />
}
