import { getSupabase } from "@/lib/supabase/client"
import type { Tables } from "@/lib/supabase/database.types"

import { toApiError, unwrap } from "./errors"
import type { MemberProfile } from "./members"

const PROFILE = "id, username, display_name, avatar_url, banner_color, banner_url, theme_primary, theme_accent, cosmetics, pronouns, bio, custom_status_text, custom_status_emoji, custom_status_expires_at, created_at"

export type Friendship = Tables<"friendships"> & {
  requester: MemberProfile
  addressee: MemberProfile
}

/** A friendship from the viewer's side: the other person and which way a pending request goes. */
export type Relationship = {
  id: string
  user: MemberProfile
  kind: "friend" | "incoming" | "outgoing"
  since: string
}

export async function listFriendships(): Promise<Friendship[]> {
  return unwrap(
    await getSupabase()
      .from("friendships")
      .select(
        `*, requester:profiles!friendships_requester_id_fkey(${PROFILE}), addressee:profiles!friendships_addressee_id_fkey(${PROFILE})`
      )
      .returns<Friendship[]>()
  )
}

export function toRelationships(rows: Friendship[], selfId: string): Relationship[] {
  return rows.map((row) => {
    const outgoing = row.requester_id === selfId
    return {
      id: row.id,
      user: outgoing ? row.addressee : row.requester,
      kind: row.status === "accepted" ? "friend" : outgoing ? "outgoing" : "incoming",
      since: row.accepted_at ?? row.created_at,
    }
  })
}

export async function sendFriendRequest(username: string) {
  const { data, error } = await getSupabase().rpc("send_friend_request", { p_username: username })
  if (error) throw toApiError(error)
  return data
}

export async function respondToRequest(requestId: string, accept: boolean) {
  const { error } = await getSupabase().rpc("respond_friend_request", { p_request: requestId, p_accept: accept })
  if (error) throw toApiError(error)
}

/** Removes a friend, or cancels/ignores a pending request. */
export async function removeFriend(userId: string) {
  const { error } = await getSupabase().rpc("remove_friend", { p_user: userId })
  if (error) throw toApiError(error)
}
