import { getSupabase } from "@/lib/supabase/client"

import { toApiError, unwrap } from "./errors"

export type PollVote = { user_id: string; answer_id: number }

/** Everyone's votes on a poll (votes are visible to whoever can see the poll). */
export async function listPollVotes(messageId: string): Promise<PollVote[]> {
  return unwrap(await getSupabase().from("poll_votes").select("user_id, answer_id").eq("message_id", messageId))
}

/** Replaces your votes; an empty list removes them. */
export async function votePoll(messageId: string, answerIds: number[]): Promise<void> {
  const { error } = await getSupabase().rpc("vote_poll", { p_message: messageId, p_answers: answerIds })
  if (error) throw toApiError(error)
}

export async function endPoll(messageId: string): Promise<void> {
  const { error } = await getSupabase().rpc("end_poll", { p_message: messageId })
  if (error) throw toApiError(error)
}
