"use client"

import {
  HeadphoneOffIcon,
  HeadphonesIcon,
  LogOutIcon,
  MicIcon,
  MicOffIcon,
  PencilIcon,
  SettingsIcon,
} from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"

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
import type { Profile } from "@/lib/api/profiles"
import { displayNameOf } from "@/lib/profile-display"
import { useMyProfile, useUpdateMyProfile } from "@/lib/queries/profiles"
import { useVoiceStore } from "@/lib/stores/voice-store"
import { cn } from "@/lib/utils"

type ChosenStatus = Profile["status"]

const CHOSEN_LABEL: Record<ChosenStatus, string> = {
  online: "Online",
  idle: "Idle",
  dnd: "Do Not Disturb",
  invisible: "Invisible",
}

const STATUS_OPTIONS: { value: ChosenStatus; dot: PresenceStatus; hint?: string }[] = [
  { value: "online", dot: "online" },
  { value: "idle", dot: "idle" },
  { value: "dnd", dot: "dnd", hint: "You won't get notifications on your desktop" },
  { value: "invisible", dot: "offline", hint: "You'll appear offline but have full access" },
]

/** How a chosen status shows on the dot. Invisible looks offline. */
export function dotFor(status: ChosenStatus): PresenceStatus {
  return status === "invisible" ? "offline" : status
}

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
    active && "text-mention hover:text-mention"
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
  const updateProfile = useUpdateMyProfile()
  const { selfMute, selfDeaf, toggleMute, toggleDeaf } = useVoiceStore()

  if (!profile) return <div className="h-[52px] shrink-0 bg-card/60" />

  const name = displayNameOf(profile)
  const statusLine = profile.custom_status_text || CHOSEN_LABEL[profile.status]

  return (
    <div className="flex h-[52px] shrink-0 items-center gap-1 bg-card/80 px-2 dark:bg-[#232428]">
      <DropdownMenu>
        <DropdownMenuTrigger className="group flex min-w-0 flex-1 items-center gap-2 rounded-md py-1 pr-1 pl-0.5 text-left outline-none hover:bg-item-hover focus-visible:ring-2 focus-visible:ring-ring">
          <UserAvatar
            userId={profile.id}
            name={name}
            src={profile.avatar_url}
            status={dotFor(profile.status)}
            surface="card"
          />
          <span className="min-w-0 leading-tight">
            <span className="block truncate text-sm font-semibold text-header">{name}</span>
            <span className="relative block h-4 overflow-hidden text-xs text-muted-foreground">
              <span className="block truncate transition-transform group-hover:-translate-y-4">
                {statusLine}
              </span>
              <span className="absolute inset-x-0 top-4 block truncate transition-transform group-hover:-translate-y-4">
                {profile.username}
              </span>
            </span>
          </span>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="top" align="start" className="w-64 bg-floating p-2">
          <DropdownMenuLabel className="text-xs font-bold tracking-wide text-muted-foreground uppercase">
            Set status
          </DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={profile.status}
            onValueChange={async (value) => {
              try {
                await updateProfile.mutateAsync({ status: value as ChosenStatus })
              } catch (error) {
                toast.error(errorMessage(error))
              }
            }}
          >
            {STATUS_OPTIONS.map((option) => (
              <DropdownMenuRadioItem key={option.value} value={option.value} className="items-start py-1.5">
                <StatusDot status={option.dot} surface="floating" className="mt-0.5 size-3 ring-0" />
                <span className="flex flex-col">
                  <span>{CHOSEN_LABEL[option.value]}</span>
                  {option.hint && (
                    <span className="text-xs text-muted-foreground">{option.hint}</span>
                  )}
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
    </div>
  )
}
