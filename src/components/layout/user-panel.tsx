"use client"

import {
  HeadphoneOffIcon,
  HeadphonesIcon,
  LogOutIcon,
  MicIcon,
  MicOffIcon,
  PencilIcon,
  SettingsIcon,
  SmileIcon,
} from "lucide-react"
import Link from "next/link"
import { useState } from "react"
import { toast } from "sonner"

import { CustomStatusDialog } from "@/components/profile/custom-status-dialog"
import { StatusDot, type PresenceStatus } from "@/components/profile/status-dot"
import { UserAvatar } from "@/components/profile/user-avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { signOut } from "@/lib/api/auth"
import { errorMessage } from "@/lib/api/errors"
import type { ChosenStatus } from "@/lib/api/settings"
import { activeCustomStatus } from "@/lib/custom-status"
import { displayNameOf } from "@/lib/profile-display"
import { useMyProfile } from "@/lib/queries/profiles"
import { useChosenStatus, useSetStatus } from "@/lib/queries/settings"
import { useOwnLiveStatus } from "@/lib/realtime/use-presence"
import { useVoiceStore } from "@/lib/stores/voice-store"
import { cn } from "@/lib/utils"

export const CHOSEN_LABEL: Record<ChosenStatus, string> = {
  online: "Online",
  idle: "Idle",
  dnd: "Do Not Disturb",
  invisible: "Invisible",
}

const STATUS_OPTIONS: { value: ChosenStatus; dot: PresenceStatus; hint?: string }[] = [
  { value: "online", dot: "online" },
  { value: "idle", dot: "idle" },
  { value: "dnd", dot: "dnd", hint: "You won't get notification toasts" },
  { value: "invisible", dot: "offline", hint: "You'll appear offline but have full access" },
]

function PanelButton({
  label,
  active = false,
  onClick,
  href,
  children,
}: {
  label: string
  active?: boolean
  onClick?: () => void
  href?: string
  children: React.ReactNode
}) {
  const className = cn(
    "flex size-8 items-center justify-center rounded-md text-interactive transition-colors hover:bg-item-hover hover:text-interactive-hover",
    // Muted/deafened: tinted red, as in Discord.
    active && "bg-destructive/15 text-destructive hover:bg-destructive/25 hover:text-destructive"
  )
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {href ? (
          <Link href={href} aria-label={label} className={className}>
            {children}
          </Link>
        ) : (
          <button type="button" aria-label={label} aria-pressed={active} onClick={onClick} className={className}>
            {children}
          </button>
        )}
      </TooltipTrigger>
      <TooltipContent side="top">{label}</TooltipContent>
    </Tooltip>
  )
}

/** Bottom-of-sidebar panel: who you are, your status, and mute/deafen/settings. */
export function UserPanel() {
  const { data: profile } = useMyProfile()
  const chosen = useChosenStatus()
  const live = useOwnLiveStatus()
  const setStatus = useSetStatus()
  const { selfMute, selfDeaf, toggleMute, toggleDeaf } = useVoiceStore()
  const [customOpen, setCustomOpen] = useState(false)

  if (!profile) return <div className="h-14 shrink-0" />

  const name = displayNameOf(profile)
  const custom = activeCustomStatus(profile)
  const dot: PresenceStatus = live ?? "offline"
  const statusLine = custom
    ? [custom.emoji, custom.text].filter(Boolean).join(" ")
    : live === "idle" && chosen === "online"
      ? "Idle"
      : CHOSEN_LABEL[chosen]

  return (
    <div className="flex h-14 shrink-0 items-center gap-1 px-2">
      <DropdownMenu>
        <DropdownMenuTrigger className="group flex min-w-0 flex-1 items-center gap-2 rounded-md py-1 pr-1 pl-0.5 text-left outline-none hover:bg-item-hover focus-visible:ring-2 focus-visible:ring-ring">
          <UserAvatar userId={profile.id} name={name} src={profile.avatar_url} status={dot} surface="card" />
          <span className="min-w-0 leading-tight">
            <span className="block truncate text-sm font-semibold text-header">{name}</span>
            <span className="relative block h-4 overflow-hidden text-xs text-muted-foreground">
              <span className="block truncate transition-transform group-hover:-translate-y-4">{statusLine}</span>
              <span className="absolute inset-x-0 top-4 block truncate transition-transform group-hover:-translate-y-4">
                {profile.username}
              </span>
            </span>
          </span>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="top" align="start" className="w-64 bg-floating p-2">
          <DropdownMenuItem onSelect={() => setCustomOpen(true)}>
            <SmileIcon /> {custom ? "Edit Custom Status" : "Set Custom Status"}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuLabel className="text-xs font-bold tracking-wide text-muted-foreground uppercase">
            Set status
          </DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={chosen}
            onValueChange={(value) =>
              setStatus.mutate(value as ChosenStatus, { onError: (e) => toast.error(errorMessage(e)) })
            }
          >
            {STATUS_OPTIONS.map((option) => (
              <DropdownMenuRadioItem key={option.value} value={option.value} className="items-start py-1.5">
                <StatusDot status={option.dot} surface="floating" className="mt-0.5 size-3 ring-0" />
                <span className="flex flex-col">
                  <span>{CHOSEN_LABEL[option.value]}</span>
                  {option.hint && <span className="text-xs text-muted-foreground">{option.hint}</span>}
                </span>
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href="/settings/profile">
              <PencilIcon /> Edit Profile
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem variant="destructive" onSelect={() => signOut()}>
            <LogOutIcon /> Log Out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <div className="flex shrink-0 items-center">
        <PanelButton label={selfMute ? "Unmute" : "Mute"} active={selfMute} onClick={toggleMute}>
          {selfMute ? <MicOffIcon className="size-5" /> : <MicIcon className="size-5" />}
        </PanelButton>
        <PanelButton label={selfDeaf ? "Undeafen" : "Deafen"} active={selfDeaf} onClick={toggleDeaf}>
          {selfDeaf ? <HeadphoneOffIcon className="size-5" /> : <HeadphonesIcon className="size-5" />}
        </PanelButton>
        <PanelButton label="User Settings" href="/settings/account">
          <SettingsIcon className="size-5" />
        </PanelButton>
      </div>

      <CustomStatusDialog key={String(customOpen)} open={customOpen} onOpenChange={setCustomOpen} />
    </div>
  )
}
