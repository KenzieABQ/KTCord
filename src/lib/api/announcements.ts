import { getSupabase } from "@/lib/supabase/client"

import { toApiError } from "./errors"

/** Sends an announcement to every channel following it; returns how many got it. */
export async function publishMessage(messageId: string): Promise<number> {
  const { data, error } = await getSupabase().rpc("publish_message", { p_message: messageId })
  if (error) throw toApiError(error)
  return data
}

/** Follows an announcement channel into a text channel of another server. */
export async function followChannel(sourceId: string, targetId: string): Promise<void> {
  const { error } = await getSupabase().rpc("follow_channel", { p_source: sourceId, p_target: targetId })
  if (error) throw toApiError(error)
}
