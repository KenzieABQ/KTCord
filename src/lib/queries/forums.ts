import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { createForumPost, listForumPosts } from "@/lib/api/forums"

import { qk } from "./keys"

export function useForumPosts(forumId: string) {
  // New replies don't arrive as channel events, so refresh now and then too.
  return useQuery({ queryKey: qk.forumPosts(forumId), queryFn: () => listForumPosts(forumId), refetchInterval: 60_000 })
}

export function useCreateForumPost(forumId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { title: string; content: string; tags: string[] }) => createForumPost({ forumId, ...input }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: qk.forumPosts(forumId) }),
  })
}
