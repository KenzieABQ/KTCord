import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { createEvent, listEvents, setEventStatus, setInterest, type EventInput } from "@/lib/api/events"
import { useUserId } from "@/lib/stores/auth-store"

import { qk } from "./keys"

export function useEvents(serverId: string) {
  return useQuery({ queryKey: qk.events(serverId), queryFn: () => listEvents(serverId) })
}

function useInvalidateEvents(serverId: string) {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: qk.events(serverId) })
}

export function useCreateEvent(serverId: string) {
  const userId = useUserId()
  const onSettled = useInvalidateEvents(serverId)
  return useMutation({ mutationFn: (input: EventInput) => createEvent(serverId, userId, input), onSettled })
}

export function useSetEventStatus(serverId: string) {
  const onSettled = useInvalidateEvents(serverId)
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: "active" | "completed" | "canceled" }) => setEventStatus(id, status),
    onSettled,
  })
}

export function useSetInterest(serverId: string) {
  const userId = useUserId()
  const onSettled = useInvalidateEvents(serverId)
  return useMutation({
    mutationFn: ({ id, interested }: { id: string; interested: boolean }) => setInterest(id, userId, interested),
    onSettled,
  })
}
