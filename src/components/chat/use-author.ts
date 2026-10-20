"use client"

import { memberColor, memberDisplayName } from "@/lib/members"
import { displayNameOf } from "@/lib/profile-display"
import { useProfile } from "@/lib/queries/profiles"

import { useChat } from "./chat-context"

export type AuthorInfo = {
  id: string | null
  name: string
  avatarUrl: string | null
  color?: string
}

/** Name, avatar and role color for a message author: from the member list, else their profile. */
export function useAuthor(authorId: string | null): AuthorInfo {
  const { membersById, rolesById } = useChat()
  const member = authorId ? membersById.get(authorId) : undefined
  const { data: profile } = useProfile(member ? null : authorId)

  if (member) {
    return {
      id: authorId,
      name: memberDisplayName(member),
      avatarUrl: member.profile.avatar_url,
      color: memberColor(member, rolesById),
    }
  }
  if (profile) {
    return { id: authorId, name: displayNameOf(profile), avatarUrl: profile.avatar_url }
  }
  return { id: authorId, name: authorId ? "…" : "Deleted User", avatarUrl: null }
}
