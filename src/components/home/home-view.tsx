"use client"

import { CompassIcon, PlusIcon, UserPlusIcon, UsersIcon } from "lucide-react"
import type { ReactNode } from "react"

import { KtcordLogo } from "@/components/brand/logo"
import { ViewHeader } from "@/components/layout/view-header"
import { displayNameOf } from "@/lib/profile-display"
import { useMyProfile } from "@/lib/queries/profiles"
import { useUiStore } from "@/lib/stores/ui-store"

function ActionCard({
  icon,
  title,
  description,
  onClick,
}: {
  icon: ReactNode
  title: string
  description: string
  onClick?: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className="group flex items-center gap-4 rounded-lg border border-border bg-sidebar p-4 text-left transition-colors hover:bg-item-hover disabled:cursor-not-allowed disabled:opacity-60"
    >
      <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary transition-colors group-enabled:group-hover:bg-primary group-enabled:group-hover:text-white">
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block font-semibold text-header">{title}</span>
        <span className="block text-sm text-muted-foreground">{description}</span>
      </span>
    </button>
  )
}

/** Home (Friends) view. Until friends and DMs exist (Milestone 6), it's the branded welcome screen. */
export function HomeView() {
  const { data: profile } = useMyProfile()
  const openDialog = useUiStore((s) => s.openDialog)

  return (
    <div className="flex min-w-0 flex-1">
      <div className="flex min-w-0 flex-1 flex-col">
        <ViewHeader>
          <UsersIcon className="size-5 text-muted-foreground" />
          <h1 className="font-semibold text-header">Friends</h1>
        </ViewHeader>

        <div className="scrollbar-thin flex-1 overflow-y-auto">
          <div className="mx-auto flex max-w-xl flex-col items-center gap-8 px-4 py-12 text-center sm:py-20">
            <KtcordLogo className="text-4xl" markClassName="size-14" />
            <div>
              <h2 className="text-2xl font-bold text-header">
                Welcome to KTCord{profile ? `, ${displayNameOf(profile)}` : ""}!
              </h2>
              <p className="mt-2 text-muted-foreground">
                Your place to talk with friends and communities. Here are some steps to get
                you started.
              </p>
            </div>
            <div className="grid w-full gap-3 text-left">
              <ActionCard
                icon={<PlusIcon className="size-6" />}
                title="Create your own server"
                description="Start a space for your friends or community."
                onClick={() => openDialog({ kind: "create-server" })}
              />
              <ActionCard
                icon={<CompassIcon className="size-6" />}
                title="Join a server"
                description="Got an invite link or code? Jump right in."
                onClick={() => openDialog({ kind: "join-server" })}
              />
              <ActionCard
                icon={<UserPlusIcon className="size-6" />}
                title="Add a friend"
                description="Find people by their username."
              />
            </div>
          </div>
        </div>
      </div>

      {/* Fourth column: "Active Now", desktop only. */}
      <aside className="hidden w-[340px] shrink-0 flex-col border-l border-border p-4 xl:flex">
        <h2 className="text-xl font-bold text-header">Active Now</h2>
        <div className="mt-4 rounded-lg bg-transparent p-4 text-center">
          <p className="font-semibold text-header">It&apos;s quiet for now...</p>
          <p className="mt-1 text-sm text-muted-foreground">
            When friends start an activity, like chatting in a voice channel, we&apos;ll show
            it here!
          </p>
        </div>
      </aside>
    </div>
  )
}
