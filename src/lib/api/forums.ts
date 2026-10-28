import { getSupabase } from "@/lib/supabase/client"

import { toApiError, unwrap } from "./errors"

export type ForumTag = { id: string; name: string; emoji: string | null }

export type ForumPost = {
  id: string
  name: string
  owner_id: string | null
  created_at: string
  applied_tags: string[]
  last_message_at: string
  message_count: number
  first_message: string | null
}

export function forumTags(channel: { available_tags: unknown }): ForumTag[] {
  return Array.isArray(channel.available_tags) ? (channel.available_tags as ForumTag[]) : []
}

/** A forum's posts, most recently active first. */
export async function listForumPosts(forumId: string): Promise<ForumPost[]> {
  return unwrap(await getSupabase().rpc("forum_posts", { p_forum: forumId })) as ForumPost[]
}

/** Starts a post (a thread with its first message); returns the thread id. */
export async function createForumPost(input: {
  forumId: string
  title: string
  content: string
  tags: string[]
}): Promise<string> {
  const { data, error } = await getSupabase().rpc("create_forum_post", {
    p_forum: input.forumId,
    p_title: input.title,
    p_message: crypto.randomUUID(),
    p_content: input.content,
    p_tags: input.tags,
  })
  if (error) throw toApiError(error)
  return data
}
