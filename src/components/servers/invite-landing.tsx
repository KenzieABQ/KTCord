"use client"

import { useQuery, useQueryClient } from "@tanstack/react-query"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { useState } from "react"

import { KtcordLogo } from "@/components/brand/logo"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { errorMessage } from "@/lib/api/errors"
import { getInvitePreview, joinServerByInvite } from "@/lib/api/invites"
import { qk } from "@/lib/queries/keys"
import { useAuthStore } from "@/lib/stores/auth-store"

import { ServerIcon } from "./server-icon"

/** /invite/[code]: preview the server and accept. Works signed out (log in first, then return here). */
export function InviteLanding() {
  const { code } = useParams<{ code: string }>()
  const router = useRouter()
  const queryClient = useQueryClient()
  const status = useAuthStore((s) => s.status)
  const userId = useAuthStore((s) => s.userId)
  const [joining, setJoining] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Refetch once signed in so is_member reflects the user.
  const preview = useQuery({
    queryKey: [...qk.invitePreview(code), status],
    queryFn: () => getInvitePreview(code),
    enabled: status !== "loading",
    retry: false,
  })
  const invite = preview.data

  async function accept() {
    if (!invite) return
    if (invite.is_member) {
      router.push(`/channels/${invite.server_id}`)
      return
    }
    setJoining(true)
    setError(null)
    try {
      const serverId = await joinServerByInvite(code)
      if (userId) await queryClient.invalidateQueries({ queryKey: qk.servers(userId) })
      router.push(`/channels/${serverId}`)
    } catch (err) {
      setError(errorMessage(err))
      setJoining(false)
    }
  }

  let body: React.ReactNode
  if (preview.isPending) {
    body = (
      <div className="flex flex-col items-center gap-3">
        <Skeleton className="size-20 rounded-3xl bg-item-selected/60" />
        <Skeleton className="h-5 w-48 bg-item-selected/60" />
        <Skeleton className="h-10 w-full bg-item-selected/60" />
      </div>
    )
  } else if (!invite || !invite.is_valid) {
    body = (
      <div className="text-center">
        <h1 className="text-2xl font-semibold text-header">
          {invite ? "This invite has expired" : "Invite invalid"}
        </h1>
        <p className="mt-2 text-muted-foreground">
          {invite
            ? "Ask whoever sent it for a new one."
            : "This invite may be expired, or you might not have permission to join."}
        </p>
        <Button asChild className="mt-6 w-full" size="lg">
          <Link href="/channels/me">Continue to KTCord</Link>
        </Button>
      </div>
    )
  } else {
    body = (
      <div className="flex flex-col items-center text-center">
        <div className="size-20 overflow-hidden rounded-3xl bg-rail-item text-2xl text-foreground">
          <ServerIcon name={invite.server_name} iconUrl={invite.server_icon_url} className="text-2xl" />
        </div>
        <p className="mt-4 text-muted-foreground">You&apos;ve been invited to join</p>
        <h1 className="text-2xl font-semibold text-header">{invite.server_name}</h1>
        <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
          <span className="size-2 rounded-full bg-status-offline" />
          {invite.member_count} {invite.member_count === 1 ? "Member" : "Members"}
        </p>
        {error && <p className="mt-4 text-sm text-destructive">{error}</p>}
        {status === "signed-in" ? (
          <Button className="mt-6 w-full" size="lg" onClick={accept} disabled={joining}>
            {invite.is_member ? "Go to Server" : joining ? "Joining…" : "Accept Invite"}
          </Button>
        ) : (
          <div className="mt-6 flex w-full flex-col gap-2">
            <Button asChild size="lg" className="w-full">
              <Link href={`/login?next=${encodeURIComponent(`/invite/${code}`)}`}>Log in to accept</Link>
            </Button>
            <Button asChild variant="link" className="text-link">
              <Link href={`/register?next=${encodeURIComponent(`/invite/${code}`)}`}>
                New here? Create an account
              </Link>
            </Button>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="relative flex h-full overflow-y-auto bg-rail">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(60rem_40rem_at_15%_-10%,color-mix(in_oklab,var(--brand)_35%,transparent),transparent)]"
      />
      <main className="relative m-auto flex w-full max-w-md flex-col items-center gap-6 px-4 py-10">
        <KtcordLogo className="text-3xl" markClassName="size-11" />
        <div className="w-full rounded-lg bg-chat p-8 shadow-2xl">{body}</div>
      </main>
    </div>
  )
}
