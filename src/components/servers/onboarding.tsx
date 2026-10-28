"use client"

import { useQueryClient } from "@tanstack/react-query"
import { ScrollTextIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { toast } from "@/lib/toast"

import { Emoji } from "@/components/chat/emoji"
import { AnimatedImage } from "@/components/ui/animated-image"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { errorMessage } from "@/lib/api/errors"
import { acceptRules } from "@/lib/api/servers"
import { qk } from "@/lib/queries/keys"
import { useChannels, useServer } from "@/lib/queries/servers"
import { useUserId } from "@/lib/stores/auth-store"
import { useUiStore } from "@/lib/stores/ui-store"

import { ChannelIcon } from "./channel-icon"
import { ServerIcon } from "./server-icon"

export type WelcomeChannel = { channel_id: string; description: string; emoji: string | null }

export function welcomeChannels(server: { welcome_channels: unknown }): WelcomeChannel[] {
  return Array.isArray(server.welcome_channels) ? (server.welcome_channels as WelcomeChannel[]) : []
}

/** Rules a new member reads and accepts before they can talk (Discord's membership screening). */
export function RulesDialog({ serverId }: { serverId: string }) {
  const userId = useUserId()
  const queryClient = useQueryClient()
  const closeDialog = useUiStore((s) => s.closeDialog)
  const { data: server } = useServer(serverId)
  const [agreed, setAgreed] = useState(false)
  const [saving, setSaving] = useState(false)
  if (!server) return null

  async function accept() {
    setSaving(true)
    try {
      await acceptRules(serverId)
      await queryClient.invalidateQueries({ queryKey: qk.servers(userId) })
      toast.success(`Welcome to ${server!.name}!`)
      closeDialog()
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <ScrollTextIcon className="size-5" /> {server.name} rules
        </DialogTitle>
        <DialogDescription>Read and agree to these before you start talking.</DialogDescription>
      </DialogHeader>
      <ol className="flex max-h-80 flex-col gap-2 overflow-y-auto">
        {server.rules.map((rule, i) => (
          <li key={i} className="flex gap-3 rounded-md bg-sidebar p-3 text-sm">
            <span className="font-bold text-header">{i + 1}.</span>
            <span className="break-words text-foreground">{rule}</span>
          </li>
        ))}
      </ol>
      {server.pending ? (
        <>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
            <Checkbox checked={agreed} onCheckedChange={(on) => setAgreed(on === true)} />
            I&apos;ve read and agree to the rules
          </label>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={closeDialog}>
              Not now
            </Button>
            <Button disabled={!agreed || saving} onClick={() => void accept()}>
              Submit
            </Button>
          </div>
        </>
      ) : (
        <div className="flex justify-end">
          <Button onClick={closeDialog}>Got it</Button>
        </div>
      )}
    </div>
  )
}

/** The welcome screen: what the server is about, and channels to start in. */
export function WelcomeDialog({ serverId }: { serverId: string }) {
  const router = useRouter()
  const closeDialog = useUiStore((s) => s.closeDialog)
  const { data: server } = useServer(serverId)
  const { data: channels } = useChannels(serverId)
  if (!server) return null
  const picks = welcomeChannels(server)
    .map((w) => ({ ...w, channel: channels?.find((c) => c.id === w.channel_id) }))
    .filter((w) => w.channel)

  return (
    <div className="flex flex-col items-center gap-4 text-center">
      {server.banner_url && (
        <div className="-mx-6 -mt-6 -mb-14 h-36 w-[calc(100%+3rem)] overflow-hidden rounded-t-xl">
          <AnimatedImage src={server.banner_url} animate="always" />
        </div>
      )}
      <span className="relative flex size-20 ring-4 ring-chat items-center justify-center overflow-hidden rounded-3xl bg-primary text-2xl font-semibold text-white">
        <ServerIcon name={server.name} iconUrl={server.icon_url} />
      </span>
      <DialogHeader className="items-center">
        <DialogTitle className="text-2xl">Welcome to {server.name}!</DialogTitle>
        {server.description && <DialogDescription className="text-base">{server.description}</DialogDescription>}
      </DialogHeader>
      {picks.length > 0 && (
        <div className="flex w-full flex-col gap-2 text-left">
          <p className="text-xs font-bold tracking-wide text-muted-foreground uppercase">Here are some channels to start with</p>
          {picks.map((w) => (
            <button
              key={w.channel_id}
              type="button"
              onClick={() => {
                closeDialog()
                router.push(`/channels/${serverId}/${w.channel_id}`)
              }}
              className="flex items-center gap-3 rounded-md bg-sidebar p-3 hover:bg-item-hover"
            >
              <span className="flex size-9 shrink-0 items-center justify-center text-xl">
                {w.emoji ? <Emoji value={w.emoji} /> : <ChannelIcon type={w.channel!.type} className="size-5 text-muted-foreground" />}
              </span>
              <span className="min-w-0">
                <span className="block text-sm break-words text-header">{w.description || w.channel!.name}</span>
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <ChannelIcon type={w.channel!.type} className="size-3" /> {w.channel!.name}
                </span>
              </span>
            </button>
          ))}
        </div>
      )}
      <Button className="w-full" onClick={closeDialog}>
        Let&apos;s go
      </Button>
    </div>
  )
}

/**
 * On entering a server: its rules if you still have to accept them, otherwise its welcome
 * screen the first time on this device.
 */
export function ServerOnboarding({ serverId }: { serverId: string }) {
  const { data: server } = useServer(serverId)
  const welcomed = useUiStore((s) => Boolean(s.welcomedServers[serverId]))
  const needsRules = Boolean(server?.pending && server.rules_enabled && server.rules.length)
  const showWelcome = Boolean(server?.welcome_enabled && !welcomed)

  useEffect(() => {
    const ui = useUiStore.getState()
    if (ui.dialog) return
    if (needsRules) ui.openDialog({ kind: "server-rules", serverId })
    else if (showWelcome) {
      ui.markWelcomed(serverId)
      ui.openDialog({ kind: "welcome", serverId })
    }
  }, [serverId, needsRules, showWelcome])
  return null
}
