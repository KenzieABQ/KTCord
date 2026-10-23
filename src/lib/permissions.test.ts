import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

import {
  ALL_PERMISSIONS,
  applyOverwrites,
  CHANNEL_OVERWRITE_MASK,
  computeServerPermissions,
  DEFAULT_EVERYONE_PERMISSIONS,
  hasPermission,
  Permission,
  topRolePosition,
} from "./permissions"

const everyone = { id: "everyone", permissions: DEFAULT_EVERYONE_PERMISSIONS, is_default: true, position: 0 }
const mod = { id: "mod", permissions: Permission.MANAGE_MESSAGES | Permission.KICK_MEMBERS, is_default: false, position: 2 }
const admin = { id: "admin", permissions: Permission.ADMINISTRATOR, is_default: false, position: 5 }
const roles = [everyone, mod, admin]

describe("computeServerPermissions", () => {
  it("gives the owner everything", () => {
    expect(computeServerPermissions({ userId: "o", ownerId: "o", roles, memberRoleIds: [] })).toBe(ALL_PERMISSIONS)
  })

  it("combines @everyone with assigned roles", () => {
    const perms = computeServerPermissions({ userId: "u", ownerId: "o", roles, memberRoleIds: ["mod"] })
    expect(hasPermission(perms, Permission.SEND_MESSAGES)).toBe(true)
    expect(hasPermission(perms, Permission.KICK_MEMBERS)).toBe(true)
    expect(hasPermission(perms, Permission.BAN_MEMBERS)).toBe(false)
  })

  it("expands ADMINISTRATOR to every permission", () => {
    const perms = computeServerPermissions({ userId: "u", ownerId: "o", roles, memberRoleIds: ["admin"] })
    expect(perms).toBe(ALL_PERMISSIONS)
  })

  it("gives non-members nothing", () => {
    expect(
      computeServerPermissions({ userId: "u", ownerId: "o", roles, memberRoleIds: [], isMember: false })
    ).toBe(0)
  })
})

describe("topRolePosition", () => {
  it("uses the highest assigned role", () => {
    expect(topRolePosition({ userId: "u", ownerId: "o", roles, memberRoleIds: ["mod", "admin"] })).toBe(5)
    expect(topRolePosition({ userId: "u", ownerId: "o", roles, memberRoleIds: [] })).toBe(0)
  })
})

describe("SQL mirror", () => {
  it("matches the bit table in the migrations", () => {
    // The bit table starts in the servers migration; later migrations add bits in the same format.
    const dir = join(__dirname, "../../supabase/migrations")
    const sql = readdirSync(dir)
      .filter((f) => f.endsWith(".sql"))
      .map((f) => readFileSync(join(dir, f), "utf8"))
      .join("\n")
    for (const [name, bit] of Object.entries(Permission)) {
      expect(sql, name).toMatch(new RegExp(`${name}\\s+${bit}\\b`))
    }
    expect(sql).toContain(`= ${DEFAULT_EVERYONE_PERMISSIONS}`)
    expect(sql).toContain(String(ALL_PERMISSIONS))
    expect(sql).toContain(`${CHANNEL_OVERWRITE_MASK}::bigint`)
  })
})

describe("applyOverwrites", () => {
  const base = DEFAULT_EVERYONE_PERMISSIONS
  const SEND = Permission.SEND_MESSAGES
  const args = (overwrites: { role_id: string | null; user_id: string | null; allow: number; deny: number }[], roles: string[] = []) => ({
    base,
    overwrites,
    everyoneRoleId: "everyone",
    memberRoleIds: roles,
    userId: "u",
  })

  it("denies through @everyone and allows back through a role", () => {
    const ow = [
      { role_id: "everyone", user_id: null, allow: 0, deny: SEND },
      { role_id: "mod", user_id: null, allow: SEND, deny: 0 },
    ]
    expect(applyOverwrites(args(ow)) & SEND).toBe(0)
    expect(applyOverwrites(args(ow, ["mod"])) & SEND).toBe(SEND)
  })

  it("lets a member override win over roles", () => {
    const ow = [
      { role_id: "mod", user_id: null, allow: SEND, deny: 0 },
      { role_id: null, user_id: "u", allow: 0, deny: SEND },
    ]
    expect(applyOverwrites(args(ow, ["mod"])) & SEND).toBe(0)
  })

  it("loses everything without View Channel, but never for admins", () => {
    const hide = [{ role_id: "everyone", user_id: null, allow: 0, deny: Permission.VIEW_CHANNEL }]
    expect(applyOverwrites(args(hide))).toBe(0)
    expect(applyOverwrites({ ...args(hide), base: ALL_PERMISSIONS })).toBe(ALL_PERMISSIONS)
  })
})
