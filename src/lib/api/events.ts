import { getSupabase } from "@/lib/supabase/client"
import type { Tables } from "@/lib/supabase/database.types"

import { unwrap } from "./errors"

export type ScheduledEvent = Tables<"scheduled_events"> & { interests: { user_id: string }[] }

export type EventInput = {
  name: string
  description: string | null
  channel_id: string | null
  location: string | null
  starts_at: string
  ends_at: string | null
}

/** A server's events that haven't finished, soonest first. */
export async function listEvents(serverId: string): Promise<ScheduledEvent[]> {
  return unwrap(
    await getSupabase()
      .from("scheduled_events")
      .select("*, interests:event_interests(user_id)")
      .eq("server_id", serverId)
      .in("status", ["scheduled", "active"])
      .order("starts_at")
  ) as ScheduledEvent[]
}

export async function createEvent(serverId: string, userId: string, input: EventInput) {
  unwrap(await getSupabase().from("scheduled_events").insert({ ...input, server_id: serverId, created_by: userId }).select("id"))
}

export async function setEventStatus(id: string, status: "active" | "completed" | "canceled") {
  unwrap(await getSupabase().from("scheduled_events").update({ status }).eq("id", id).select("id"))
}

export async function setInterest(eventId: string, userId: string, interested: boolean) {
  const table = getSupabase().from("event_interests")
  if (interested) unwrap(await table.insert({ event_id: eventId, user_id: userId }).select("id"))
  else unwrap(await table.delete().eq("event_id", eventId).eq("user_id", userId).select("id"))
}

/** Whether an event is happening now: started by its host, or past its start time and not over. */
export function isLive(event: Pick<ScheduledEvent, "status" | "starts_at" | "ends_at">, now = Date.now()) {
  if (event.status === "active") return true
  return event.status === "scheduled" && Date.parse(event.starts_at) <= now && (!event.ends_at || Date.parse(event.ends_at) > now)
}

/** Events worth showing: not ended by time. */
export function upcoming(events: ScheduledEvent[], now = Date.now()) {
  return events.filter((e) => e.status === "active" || !e.ends_at || Date.parse(e.ends_at) > now)
}
