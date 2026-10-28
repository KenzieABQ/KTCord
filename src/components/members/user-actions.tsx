"use client"

import { CopyIcon, MessageCircleIcon, PhoneIcon, VideoIcon } from "@/components/icons"
import { startDmCall } from "@/components/voice/dm-call"
import { errorMessage } from "@/lib/api/errors"
import { useOpenDm } from "@/lib/queries/social"
import { useUserId } from "@/lib/stores/auth-store"
import { toast } from "@/lib/toast"

import { PARTS } from "./member-actions"

/** Message, voice call and video call someone (each opens your DM with them). */
export function UserContactItems({
  kind,
  userId,
  message = true,
}: {
  kind: keyof typeof PARTS
  userId: string
  /** Leave out "Message" (e.g. you're already in your DM with them). */
  message?: boolean
}) {
  const P = PARTS[kind]
  const selfId = useUserId()
  const openDm = useOpenDm()
  if (userId === selfId) return null
  const onError = (error: unknown) => toast.error(errorMessage(error))
  const call = (video: boolean) =>
    openDm.mutate(userId, { onSuccess: (channelId) => startDmCall(channelId, video), onError })

  return (
    <>
      {message && (
        <P.Item onSelect={() => openDm.mutate(userId, { onError })}>
          <MessageCircleIcon /> Message
        </P.Item>
      )}
      <P.Item onSelect={() => call(false)}>
        <PhoneIcon /> Call
      </P.Item>
      <P.Item onSelect={() => call(true)}>
        <VideoIcon /> Video Call
      </P.Item>
    </>
  )
}

/** Copy someone's username or user id. */
export function UserCopyItems({ kind, userId, username }: { kind: keyof typeof PARTS; userId: string; username?: string }) {
  const P = PARTS[kind]
  const copy = (text: string) => void navigator.clipboard.writeText(text)
  return (
    <>
      {username && (
        <P.Item onSelect={() => copy(username)}>
          <CopyIcon /> Copy Username
        </P.Item>
      )}
      <P.Item onSelect={() => copy(userId)}>
        <CopyIcon /> Copy User ID
      </P.Item>
    </>
  )
}
