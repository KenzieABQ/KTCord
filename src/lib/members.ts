import type { Member, Role } from "@/lib/api/members"

export function memberDisplayName(member: Pick<Member, "nickname" | "profile">): string {
  return member.nickname || member.profile.display_name || member.profile.username
}

/** The color of the member's highest-positioned role that has one, as in Discord. */
export function memberColor(
  member: Pick<Member, "role_ids">,
  rolesById: Map<string, Role>
): string | undefined {
  let best: Role | undefined
  for (const id of member.role_ids) {
    const role = rolesById.get(id)
    if (role?.color && (!best || role.position > best.position)) best = role
  }
  return best?.color ?? undefined
}

/** The member's highest hoisted role, which decides their group in the member list. */
export function memberHoistRole(
  member: Pick<Member, "role_ids">,
  rolesById: Map<string, Role>
): Role | undefined {
  let best: Role | undefined
  for (const id of member.role_ids) {
    const role = rolesById.get(id)
    if (role?.hoist && (!best || role.position > best.position)) best = role
  }
  return best
}
