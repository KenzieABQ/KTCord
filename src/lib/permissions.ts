/**
 * Permission bits. Mirrors the table at the top of
 * supabase/migrations/20261020000200_servers.sql. Postgres is the authority;
 * this copy only decides which controls the UI shows.
 */
export const Permission = {
  VIEW_CHANNEL: 1 << 0,
  SEND_MESSAGES: 1 << 1,
  MANAGE_MESSAGES: 1 << 2,
  MENTION_EVERYONE: 1 << 3,
  MANAGE_CHANNELS: 1 << 4,
  MANAGE_ROLES: 1 << 5,
  MANAGE_SERVER: 1 << 6,
  KICK_MEMBERS: 1 << 7,
  BAN_MEMBERS: 1 << 8,
  ADMINISTRATOR: 1 << 9,
  CREATE_INVITE: 1 << 10,
  MODERATE_MEMBERS: 1 << 11,
  ATTACH_FILES: 1 << 12,
  ADD_REACTIONS: 1 << 13,
  CONNECT: 1 << 14,
  SPEAK: 1 << 15,
  MANAGE_EXPRESSIONS: 1 << 16,
  VIEW_AUDIT_LOG: 1 << 17,
  VIDEO: 1 << 18,
} as const

export type PermissionName = keyof typeof Permission

export const ALL_PERMISSIONS = 0x7fffffff

export const DEFAULT_EVERYONE_PERMISSIONS =
  Permission.VIEW_CHANNEL |
  Permission.SEND_MESSAGES |
  Permission.CREATE_INVITE |
  Permission.ATTACH_FILES |
  Permission.ADD_REACTIONS |
  Permission.CONNECT |
  Permission.SPEAK |
  Permission.VIDEO

export function hasPermission(perms: number, bit: number): boolean {
  return (perms & bit) === bit
}

type RoleLike = { id: string; permissions: number; is_default: boolean; position: number }

/** Same rules as public.server_permissions(): owner and ADMINISTRATOR get everything. */
export function computeServerPermissions({
  userId,
  ownerId,
  roles,
  memberRoleIds,
  isMember = true,
}: {
  userId: string
  ownerId: string
  roles: RoleLike[]
  memberRoleIds: Iterable<string>
  isMember?: boolean
}): number {
  if (userId === ownerId) return ALL_PERMISSIONS
  if (!isMember) return 0
  const mine = new Set(memberRoleIds)
  let perms = 0
  for (const role of roles) {
    if (role.is_default || mine.has(role.id)) perms |= role.permissions
  }
  return hasPermission(perms, Permission.ADMINISTRATOR) ? ALL_PERMISSIONS : perms
}

/** Same rule as public.member_top_position(): the highest role position, or max for the owner. */
export function topRolePosition({
  userId,
  ownerId,
  roles,
  memberRoleIds,
}: {
  userId: string
  ownerId: string
  roles: RoleLike[]
  memberRoleIds: Iterable<string>
}): number {
  if (userId === ownerId) return ALL_PERMISSIONS
  const mine = new Set(memberRoleIds)
  let top = 0
  for (const role of roles) if (mine.has(role.id)) top = Math.max(top, role.position)
  return top
}

/**
 * Permissions a channel override may allow or deny: the ones checked per channel. Mirrors
 * public.channel_overwrite_mask() (VIEW | SEND | MANAGE_MESSAGES | ATTACH | REACT | CONNECT | SPEAK | VIDEO).
 */
export const CHANNEL_OVERWRITE_MASK =
  Permission.VIEW_CHANNEL |
  Permission.SEND_MESSAGES |
  Permission.MANAGE_MESSAGES |
  Permission.ATTACH_FILES |
  Permission.ADD_REACTIONS |
  Permission.CONNECT |
  Permission.SPEAK |
  Permission.VIDEO

export type OverwriteLike = { role_id: string | null; user_id: string | null; allow: number; deny: number }

/**
 * Same rules as public.channel_row_permissions() after the private-channel check: the
 * @everyone override, then the member's role overrides together, then their own override.
 * Without View Channel nothing else counts. Owners and administrators keep everything.
 */
export function applyOverwrites({
  base,
  overwrites,
  everyoneRoleId,
  memberRoleIds,
  userId,
}: {
  base: number
  overwrites: OverwriteLike[]
  everyoneRoleId: string | undefined
  memberRoleIds: Iterable<string>
  userId: string
}): number {
  if (base === ALL_PERMISSIONS) return base
  if (!hasPermission(base, Permission.VIEW_CHANNEL)) return 0
  let perms = base
  const everyone = overwrites.find((o) => o.role_id && o.role_id === everyoneRoleId)
  if (everyone) perms = (perms & ~everyone.deny) | everyone.allow

  const mine = new Set(memberRoleIds)
  let allow = 0
  let deny = 0
  for (const o of overwrites) {
    if (o.role_id && o.role_id !== everyoneRoleId && mine.has(o.role_id)) {
      allow |= o.allow
      deny |= o.deny
    }
  }
  perms = (perms & ~deny) | allow

  const member = overwrites.find((o) => o.user_id === userId)
  if (member) perms = (perms & ~member.deny) | member.allow
  return hasPermission(perms, Permission.VIEW_CHANNEL) ? perms : 0
}
