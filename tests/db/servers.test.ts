import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { admin, cleanupTestUsers, createTestUser, dbTestsEnabled, type TestUser } from "./helpers"

/**
 * Permission matrix for Milestone 2, run against the real database through RLS.
 * Run with: RUN_DB_TESTS=1 npm test
 */
describe.skipIf(!dbTestsEnabled)("servers, channels and invites (RLS)", () => {
  let owner: TestUser
  let member: TestUser
  let outsider: TestUser
  let serverId: string

  beforeAll(async () => {
    ;[owner, member, outsider] = await Promise.all([
      createTestUser("owner"),
      createTestUser("member"),
      createTestUser("outsider"),
    ])
    const { data, error } = await owner.client.rpc("create_server", { p_name: "RLS Test Server" })
    if (error) throw error
    serverId = data
  }, 60_000)

  afterAll(cleanupTestUsers, 60_000)

  it("creates the default structure", async () => {
    const { data: channels } = await owner.client
      .from("channels")
      .select("type, name, parent_id")
      .eq("server_id", serverId)
      .order("position")
    expect(channels?.map((c) => `${c.type}:${c.name}`)).toEqual([
      "category:Text Channels",
      "text:general",
      "category:Voice Channels",
      "voice:General",
    ])

    const { data: roles } = await owner.client.from("roles").select("*").eq("server_id", serverId)
    expect(roles).toHaveLength(1)
    expect(roles?.[0]).toMatchObject({ name: "@everyone", is_default: true, permissions: 62467 })
  })

  it("hides the server from non-members", async () => {
    const { data: servers } = await outsider.client.from("servers").select("id").eq("id", serverId)
    const { data: channels } = await outsider.client.from("channels").select("id").eq("server_id", serverId)
    const { data: members } = await outsider.client.from("server_members").select("id").eq("server_id", serverId)
    expect(servers).toEqual([])
    expect(channels).toEqual([])
    expect(members).toEqual([])
  })

  it("stops non-members from creating channels", async () => {
    const { error } = await outsider.client
      .from("channels")
      .insert({ server_id: serverId, type: "text", name: "sneaky" })
    expect(error).not.toBeNull()
  })

  it("joins through an invite, and enforces max uses", async () => {
    const { data: invite, error } = await owner.client.rpc("create_invite", {
      p_server: serverId,
      p_max_age_seconds: 3600,
      p_max_uses: 1,
    })
    expect(error).toBeNull()

    const { data: preview } = await member.client.rpc("get_invite", { p_code: invite!.code })
    expect(preview?.[0]).toMatchObject({ server_name: "RLS Test Server", is_valid: true, is_member: false })

    const { data: joined, error: joinError } = await member.client.rpc("join_server_by_invite", {
      p_code: invite!.code,
    })
    expect(joinError).toBeNull()
    expect(joined).toBe(serverId)

    const { error: secondJoin } = await outsider.client.rpc("join_server_by_invite", {
      p_code: invite!.code,
    })
    expect(secondJoin?.message).toMatch(/maximum number of uses/)
  })

  it("refuses expired invites", async () => {
    await admin.from("invites").insert({
      code: "Expired1",
      server_id: serverId,
      expires_at: new Date(Date.now() - 60_000).toISOString(),
    })
    const { error } = await outsider.client.rpc("join_server_by_invite", { p_code: "Expired1" })
    expect(error?.message).toMatch(/expired/)
  })

  it("lets plain members read but not manage", async () => {
    const { data: channels } = await member.client.from("channels").select("id").eq("server_id", serverId)
    expect(channels).toHaveLength(4)

    const { error: createError } = await member.client
      .from("channels")
      .insert({ server_id: serverId, type: "text", name: "nope" })
    expect(createError).not.toBeNull()

    const { data: renamed } = await member.client
      .from("servers")
      .update({ name: "Hijacked" })
      .eq("id", serverId)
      .select()
    expect(renamed).toEqual([])

    const { error: reorderError } = await member.client.rpc("reorder_channels", {
      p_server: serverId,
      p_items: [],
    })
    expect(reorderError?.message).toMatch(/permission/)

    const { error: inviteError } = await member.client.rpc("create_invite", { p_server: serverId })
    expect(inviteError).toBeNull() // @everyone has CREATE_INVITE by default
  })

  it("hides private channels from members without access", async () => {
    const { data: secret } = await owner.client
      .from("channels")
      .insert({ server_id: serverId, type: "text", name: "Mods Only" })
      .select()
      .single()
    expect(secret?.name).toBe("mods-only") // normalized by the guard trigger

    await owner.client.from("channels").update({ is_private: true }).eq("id", secret!.id)

    const { data: seen } = await member.client.from("channels").select("id").eq("id", secret!.id)
    expect(seen).toEqual([])
    const { data: ownerSees } = await owner.client.from("channels").select("id").eq("id", secret!.id)
    expect(ownerSees).toHaveLength(1)
  })

  it("keeps banned users out", async () => {
    await admin.from("bans").insert({ server_id: serverId, user_id: outsider.id, banned_by: owner.id })
    const { data: invite } = await owner.client.rpc("create_invite", { p_server: serverId })
    const { error } = await outsider.client.rpc("join_server_by_invite", { p_code: invite!.code })
    expect(error?.message).toMatch(/banned/)
  })

  it("lets members leave but not owners", async () => {
    const { error: ownerLeave } = await owner.client.rpc("leave_server", { p_server: serverId })
    expect(ownerLeave?.message).toMatch(/Owners can't leave/)

    const { error: memberLeave } = await member.client.rpc("leave_server", { p_server: serverId })
    expect(memberLeave).toBeNull()
    const { data: after } = await member.client.from("servers").select("id").eq("id", serverId)
    expect(after).toEqual([])
  })

  it("only lets the owner delete the server", async () => {
    const { data: notDeleted } = await outsider.client.from("servers").delete().eq("id", serverId).select()
    expect(notDeleted).toEqual([])
    const { error } = await owner.client.from("servers").delete().eq("id", serverId)
    expect(error).toBeNull()
    const { data: gone } = await admin.from("servers").select("id").eq("id", serverId)
    expect(gone).toEqual([])
  })
})
