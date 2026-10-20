import { randomUUID } from "node:crypto"

import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { cleanupTestUsers, createTestUser, dbTestsEnabled, type TestUser } from "./helpers"

const P = {
  VIEW: 1,
  SEND: 2,
  MANAGE_MESSAGES: 4,
  MANAGE_CHANNELS: 16,
  MANAGE_ROLES: 32,
  KICK: 128,
  BAN: 256,
  ADMIN: 512,
  MODERATE: 2048,
}

/** Role hierarchy and moderation rules (Milestone 4). */
describe.skipIf(!dbTestsEnabled)("roles and moderation (RLS)", () => {
  let owner: TestUser
  let mod: TestUser
  let member: TestUser
  let other: TestUser
  let serverId: string
  let generalId: string
  let modRoleId: string
  let helperRoleId: string

  async function join(user: TestUser) {
    const { data: invite } = await owner.client.rpc("create_invite", { p_server: serverId })
    await user.client.rpc("join_server_by_invite", { p_code: invite!.code })
  }

  beforeAll(async () => {
    ;[owner, mod, member, other] = await Promise.all([
      createTestUser("rolesowner"),
      createTestUser("rolesmod"),
      createTestUser("rolesmember"),
      createTestUser("rolesother"),
    ])
    const { data } = await owner.client.rpc("create_server", { p_name: "Roles Tests" })
    serverId = data!
    await Promise.all([join(mod), join(member), join(other)])

    const { data: general } = await owner.client
      .from("channels")
      .select("id")
      .eq("server_id", serverId)
      .eq("name", "general")
      .single()
    generalId = general!.id

    // Helper (lower) is created first, then Moderator lands at the bottom; move Moderator above.
    const { data: helper } = await owner.client.rpc("create_role", { p_server: serverId, p_name: "Helper" })
    const { data: modRole } = await owner.client.rpc("create_role", {
      p_server: serverId,
      p_name: "Moderator",
      p_permissions: P.MANAGE_ROLES | P.KICK | P.MODERATE | P.MANAGE_MESSAGES,
    })
    helperRoleId = helper!.id
    modRoleId = modRole!.id
    await owner.client.rpc("reorder_roles", { p_server: serverId, p_role_ids: [modRoleId, helperRoleId] })
    await owner.client.rpc("set_member_roles", { p_server: serverId, p_user: mod.id, p_role_ids: [modRoleId] })
  }, 90_000)

  afterAll(cleanupTestUsers, 60_000)

  it("orders roles with the newest at the bottom until reordered", async () => {
    const { data: roles } = await owner.client
      .from("roles")
      .select("name, position")
      .eq("server_id", serverId)
      .order("position", { ascending: false })
    expect(roles?.map((r) => r.name)).toEqual(["Moderator", "Helper", "@everyone"])
  })

  it("stops members without Manage Roles from assigning roles", async () => {
    const { error } = await member.client.rpc("set_member_roles", {
      p_server: serverId,
      p_user: member.id,
      p_role_ids: [helperRoleId],
    })
    expect(error?.message).toMatch(/permission to manage roles/)
  })

  it("lets a moderator assign roles below theirs, but not their own role or higher", async () => {
    const ok = await mod.client.rpc("set_member_roles", {
      p_server: serverId,
      p_user: member.id,
      p_role_ids: [helperRoleId],
    })
    expect(ok.error).toBeNull()

    const tooHigh = await mod.client.rpc("set_member_roles", {
      p_server: serverId,
      p_user: other.id,
      p_role_ids: [modRoleId],
    })
    expect(tooHigh.error?.message).toMatch(/below your highest role/)
  })

  it("blocks granting permissions you don't have", async () => {
    const { error } = await mod.client.rpc("update_role", { p_role: helperRoleId, p_permissions: P.ADMIN })
    expect(error?.message).toMatch(/can't grant permissions/)

    const { error: ownRole } = await mod.client.rpc("update_role", { p_role: modRoleId, p_name: "Supreme" })
    expect(ownRole?.message).toMatch(/below your highest role/)
  })

  it("enforces the hierarchy for kicks", async () => {
    const { error: upward } = await member.client.rpc("kick_member", { p_server: serverId, p_user: mod.id })
    expect(upward?.message).toMatch(/permission to kick/)

    const { error: owner_ } = await mod.client.rpc("kick_member", { p_server: serverId, p_user: owner.id })
    expect(owner_?.message).toMatch(/owner can't be moderated/)

    const { error } = await mod.client.rpc("kick_member", { p_server: serverId, p_user: other.id })
    expect(error).toBeNull()
    const { data } = await other.client.from("servers").select("id").eq("id", serverId)
    expect(data).toEqual([])
  })

  it("times members out, which blocks sending until it's lifted", async () => {
    const until = new Date(Date.now() + 10 * 60_000).toISOString()
    const { error } = await mod.client.rpc("timeout_member", { p_server: serverId, p_user: member.id, p_until: until })
    expect(error).toBeNull()

    const { error: sendError } = await member.client.rpc("send_message", {
      p_id: randomUUID(),
      p_channel: generalId,
      p_content: "can I talk?",
    })
    expect(sendError?.message).toMatch(/timed out/)

    await mod.client.rpc("timeout_member", { p_server: serverId, p_user: member.id, p_until: null })
    const { error: afterLift } = await member.client.rpc("send_message", {
      p_id: randomUUID(),
      p_channel: generalId,
      p_content: "thanks",
    })
    expect(afterLift).toBeNull()
  })

  it("rejects timeouts longer than 28 days", async () => {
    const tooLong = new Date(Date.now() + 40 * 24 * 60 * 60_000).toISOString()
    const { error } = await mod.client.rpc("timeout_member", { p_server: serverId, p_user: member.id, p_until: tooLong })
    expect(error?.message).toMatch(/28 days/)
  })

  it("lets Manage Messages delete someone else's message", async () => {
    const id = randomUUID()
    await member.client.rpc("send_message", { p_id: id, p_channel: generalId, p_content: "remove me" })
    const { count } = await mod.client.from("messages").delete({ count: "exact" }).eq("id", id)
    expect(count).toBe(1)
  })

  it("makes channels private to chosen roles", async () => {
    const { data: secret } = await owner.client
      .from("channels")
      .insert({ server_id: serverId, type: "text", name: "helpers" })
      .select()
      .single()
    const { error } = await owner.client.rpc("set_channel_access", {
      p_channel: secret!.id,
      p_private: true,
      p_role_ids: [helperRoleId],
    })
    expect(error).toBeNull()

    // member has Helper; mod doesn't (and isn't an admin).
    const { data: memberSees } = await member.client.from("channels").select("id").eq("id", secret!.id)
    const { data: modSees } = await mod.client.from("channels").select("id").eq("id", secret!.id)
    expect(memberSees).toHaveLength(1)
    expect(modSees).toEqual([])
  })

  it("bans with message cleanup, and blocks rejoining until unbanned", async () => {
    const msg = randomUUID()
    await member.client.rpc("send_message", { p_id: msg, p_channel: generalId, p_content: "last words" })

    const { error } = await owner.client.rpc("ban_member", {
      p_server: serverId,
      p_user: member.id,
      p_reason: "test",
      p_delete_seconds: 3600,
    })
    expect(error).toBeNull()
    const { data: gone } = await owner.client.from("messages").select("id").eq("id", msg)
    expect(gone).toEqual([])

    const { data: invite } = await owner.client.rpc("create_invite", { p_server: serverId })
    const { error: rejoin } = await member.client.rpc("join_server_by_invite", { p_code: invite!.code })
    expect(rejoin?.message).toMatch(/banned/)

    await owner.client.rpc("unban_member", { p_server: serverId, p_user: member.id })
    const { error: afterUnban } = await member.client.rpc("join_server_by_invite", { p_code: invite!.code })
    expect(afterUnban).toBeNull()
  })
})
