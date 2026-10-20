"use client"

import { format } from "date-fns"
import { BellIcon, BellOffIcon, CheckCheckIcon } from "lucide-react"
import { toast } from "sonner"

import {
  ContextMenuItem,
  ContextMenuRadioGroup,
  ContextMenuRadioItem,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
} from "@/components/ui/context-menu"
import {
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu"
import { errorMessage } from "@/lib/api/errors"
import type { NotificationLevel, NotificationSetting } from "@/lib/api/settings"
import { DEFAULT_LEVEL, isMutedSetting, MUTE_DURATIONS } from "@/lib/notifications"
import {
  useMarkChannelRead,
  useMarkServerRead,
  useNotificationPrefs,
  useSetNotificationSettings,
} from "@/lib/queries/settings"

const PARTS = {
  dropdown: {
    Item: DropdownMenuItem,
    Sub: DropdownMenuSub,
    SubTrigger: DropdownMenuSubTrigger,
    SubContent: DropdownMenuSubContent,
    RadioGroup: DropdownMenuRadioGroup,
    RadioItem: DropdownMenuRadioItem,
  },
  context: {
    Item: ContextMenuItem,
    Sub: ContextMenuSub,
    SubTrigger: ContextMenuSubTrigger,
    SubContent: ContextMenuSubContent,
    RadioGroup: ContextMenuRadioGroup,
    RadioItem: ContextMenuRadioItem,
  },
} as const

const LEVELS: { value: NotificationLevel; label: string }[] = [
  { value: "all", label: "All Messages" },
  { value: "mentions", label: "Only @mentions" },
  { value: "nothing", label: "Nothing" },
]

function mutedLabel(setting: NotificationSetting | undefined) {
  const until = setting?.muted_until
  if (!until || until === "infinity") return null
  return `Muted until ${format(new Date(until), "MMM d, h:mm a")}`
}

/** Mute (with durations) / Unmute, for a server or a channel. */
function MuteItems({
  kind,
  target,
  setting,
  noun,
}: {
  kind: keyof typeof PARTS
  target: { serverId?: string; channelId?: string }
  setting: NotificationSetting | undefined
  noun: "Server" | "Channel"
}) {
  const P = PARTS[kind]
  const save = useSetNotificationSettings()
  const onError = (e: unknown) => toast.error(errorMessage(e))
  const muted = isMutedSetting(setting)

  if (muted) {
    return (
      <P.Item onSelect={() => save.mutate({ ...target, mutedUntil: null }, { onError })}>
        <BellIcon />
        <span className="flex flex-col">
          Unmute {noun}
          {mutedLabel(setting) && <span className="text-xs text-muted-foreground">{mutedLabel(setting)}</span>}
        </span>
      </P.Item>
    )
  }
  return (
    <P.Sub>
      <P.SubTrigger>
        <BellOffIcon /> Mute {noun}
      </P.SubTrigger>
      <P.SubContent className="w-52 bg-floating">
        {MUTE_DURATIONS.map((d) => (
          <P.Item
            key={d.label}
            onSelect={() =>
              save.mutate(
                { ...target, mutedUntil: d.minutes === null ? "forever" : new Date(Date.now() + d.minutes * 60_000) },
                { onError }
              )
            }
          >
            {d.label}
          </P.Item>
        ))}
      </P.SubContent>
    </P.Sub>
  )
}

export function ServerNotificationItems({ kind, serverId }: { kind: keyof typeof PARTS; serverId: string }) {
  const P = PARTS[kind]
  const prefs = useNotificationPrefs()
  const save = useSetNotificationSettings()
  const markRead = useMarkServerRead()
  const setting = prefs.servers.get(serverId)

  return (
    <>
      <P.Item onSelect={() => markRead.mutate(serverId, { onError: (e) => toast.error(errorMessage(e)) })}>
        <CheckCheckIcon /> Mark As Read
      </P.Item>
      <MuteItems kind={kind} target={{ serverId }} setting={setting} noun="Server" />
      <P.Sub>
        <P.SubTrigger>
          <BellIcon /> Notification Settings
        </P.SubTrigger>
        <P.SubContent className="w-52 bg-floating">
          <P.RadioGroup
            value={setting?.level ?? DEFAULT_LEVEL}
            onValueChange={(level) =>
              save.mutate(
                { serverId, level: level as NotificationLevel },
                { onError: (e) => toast.error(errorMessage(e)) }
              )
            }
          >
            {LEVELS.map((l) => (
              <P.RadioItem key={l.value} value={l.value}>
                {l.label}
              </P.RadioItem>
            ))}
          </P.RadioGroup>
        </P.SubContent>
      </P.Sub>
    </>
  )
}

export function ChannelNotificationItems({ kind, channelId }: { kind: keyof typeof PARTS; channelId: string }) {
  const P = PARTS[kind]
  const prefs = useNotificationPrefs()
  const markRead = useMarkChannelRead()
  return (
    <>
      <P.Item onSelect={() => markRead.mutate(channelId, { onError: (e) => toast.error(errorMessage(e)) })}>
        <CheckCheckIcon /> Mark As Read
      </P.Item>
      <MuteItems kind={kind} target={{ channelId }} setting={prefs.channels.get(channelId)} noun="Channel" />
    </>
  )
}
