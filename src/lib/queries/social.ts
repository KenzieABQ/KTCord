"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { useMemo } from "react"

import {
  addGroupDmRecipients,
  closeDm,
  createGroupDm,
  leaveGroupDm,
  listDms,
  openDm,
  renameGroupDm,
  type DmChannel,
} from "@/lib/api/dms"
import {
  listFriendships,
  removeFriend,
  respondToRequest,
  sendFriendRequest,
  toRelationships,
} from "@/lib/api/friends"
import { useUserId } from "@/lib/stores/auth-store"

import { qk } from "./keys"

// ---------------------------------------------------------------------------
// Friends
// ---------------------------------------------------------------------------

export function useFriendships() {
  const userId = useUserId()
  return useQuery({ queryKey: qk.friendships(userId), queryFn: listFriendships, staleTime: Infinity })
}

export function useRelationships() {
  const userId = useUserId()
  const { data, ...rest } = useFriendships()
  const relationships = useMemo(() => (data ? toRelationships(data, userId) : undefined), [data, userId])
  return { ...rest, data: relationships }
}

function useInvalidateFriends() {
  const userId = useUserId()
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: qk.friendships(userId) })
}

export function useSendFriendRequest() {
  const invalidate = useInvalidateFriends()
  return useMutation({ mutationFn: sendFriendRequest, onSuccess: invalidate })
}

export function useRespondToRequest() {
  const invalidate = useInvalidateFriends()
  return useMutation({
    mutationFn: ({ requestId, accept }: { requestId: string; accept: boolean }) => respondToRequest(requestId, accept),
    onSuccess: invalidate,
  })
}

export function useRemoveFriend() {
  const invalidate = useInvalidateFriends()
  return useMutation({ mutationFn: removeFriend, onSuccess: invalidate })
}

// ---------------------------------------------------------------------------
// DMs
// ---------------------------------------------------------------------------

export function useDms() {
  const userId = useUserId()
  return useQuery({ queryKey: qk.dms(userId), queryFn: listDms, staleTime: Infinity })
}

export function useDm(channelId: string | undefined) {
  const { data, ...rest } = useDms()
  return { ...rest, data: data?.find((dm) => dm.id === channelId) }
}

/** DMs shown in the sidebar: not closed by the user. */
export function useVisibleDms() {
  const userId = useUserId()
  const { data, ...rest } = useDms()
  const visible = useMemo(
    () => data?.filter((dm) => !dm.recipients.find((r) => r.user_id === userId)?.hidden),
    [data, userId]
  )
  return { ...rest, data: visible }
}

function useInvalidateDms() {
  const userId = useUserId()
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: qk.dms(userId) })
}

/** Opens (or reuses) a DM with someone and navigates to it. */
export function useOpenDm() {
  const router = useRouter()
  const invalidate = useInvalidateDms()
  return useMutation({
    mutationFn: openDm,
    onSuccess: async (channelId) => {
      await invalidate()
      router.push(`/channels/me/${channelId}`)
    },
  })
}

export function useCreateGroupDm() {
  const router = useRouter()
  const invalidate = useInvalidateDms()
  return useMutation({
    mutationFn: createGroupDm,
    onSuccess: async (channelId) => {
      await invalidate()
      router.push(`/channels/me/${channelId}`)
    },
  })
}

export function useAddGroupDmRecipients() {
  const invalidate = useInvalidateDms()
  return useMutation({
    mutationFn: ({ channelId, userIds }: { channelId: string; userIds: string[] }) =>
      addGroupDmRecipients(channelId, userIds),
    onSuccess: invalidate,
  })
}

export function useRenameGroupDm() {
  const userId = useUserId()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ channelId, name }: { channelId: string; name: string }) => renameGroupDm(channelId, name),
    onSuccess: (_d, { channelId, name }) =>
      queryClient.setQueryData<DmChannel[]>(qk.dms(userId), (list) =>
        list?.map((dm) => (dm.id === channelId ? { ...dm, name: name.trim() || null } : dm))
      ),
  })
}

export function useLeaveGroupDm() {
  const router = useRouter()
  const userId = useUserId()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: leaveGroupDm,
    onSuccess: (_d, channelId) => {
      queryClient.setQueryData<DmChannel[]>(qk.dms(userId), (list) => list?.filter((dm) => dm.id !== channelId))
      router.replace("/channels/me")
    },
  })
}

export function useCloseDm() {
  const userId = useUserId()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: closeDm,
    onMutate: (channelId) =>
      queryClient.setQueryData<DmChannel[]>(qk.dms(userId), (list) =>
        list?.map((dm) =>
          dm.id === channelId
            ? { ...dm, recipients: dm.recipients.map((r) => (r.user_id === userId ? { ...r, hidden: true } : r)) }
            : dm
        )
      ),
  })
}
