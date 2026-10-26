import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { endPoll, listPollVotes, votePoll, type PollVote } from "@/lib/api/polls"
import { useUserId } from "@/lib/stores/auth-store"

import { qk } from "./keys"

export function usePollVotes(messageId: string, enabled = true) {
  return useQuery({ queryKey: qk.pollVotes(messageId), queryFn: () => listPollVotes(messageId), enabled })
}

/** Votes (or, with no answers, un-votes) right away; Realtime brings everyone else's. */
export function useVotePoll(messageId: string) {
  const queryClient = useQueryClient()
  const userId = useUserId()
  return useMutation({
    mutationFn: (answerIds: number[]) => votePoll(messageId, answerIds),
    onMutate: async (answerIds) => {
      await queryClient.cancelQueries({ queryKey: qk.pollVotes(messageId) })
      const previous = queryClient.getQueryData<PollVote[]>(qk.pollVotes(messageId))
      queryClient.setQueryData<PollVote[]>(qk.pollVotes(messageId), (votes = []) => [
        ...votes.filter((v) => v.user_id !== userId),
        ...answerIds.map((answer_id) => ({ user_id: userId, answer_id })),
      ])
      return { previous }
    },
    onError: (_error, _answers, context) => queryClient.setQueryData(qk.pollVotes(messageId), context?.previous),
    onSettled: () => queryClient.invalidateQueries({ queryKey: qk.pollVotes(messageId) }),
  })
}

export function useEndPoll() {
  return useMutation({ mutationFn: endPoll })
}
