import { randomUUID } from "node:crypto"

import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { cleanupTestUsers, createTestUser, dbTestsEnabled, type TestUser } from "./helpers"

/**
 * Friends and DMs (Milestone 6) against the real project, including the PostgREST embeds
 * the app's queries rely on (PGlite covers the SQL rules but not the REST layer).
 */
describe.skipIf(!dbTestsEnabled)("friends and DMs (REST + RLS)", () => {
  let ava: TestUser
  let ben: TestUser
  let cy: TestUser

  beforeAll(async () => {
    ;[ava, ben, cy] = await Promise.all([createTestUser("sava"), createTestUser("sben"), createTestUser("scy")])
  }, 60_000)

  afterAll(cleanupTestUsers, 60_000)

  it("makes friends and embeds both sides' profiles", async () => {
    const { error } = await ava.client.rpc("send_friend_request", { p_username: ben.username })
    expect(error).toBeNull()
    const { data: accepted } = await ben.client.rpc("send_friend_request", { p_username: ava.username })
    expect(accepted?.status).toBe("accepted")

    const { data, error: listError } = await ava.client
      .from("friendships")
      .select(
        "*, requester:profiles!friendships_requester_id_fkey(id, username), addressee:profiles!friendships_addressee_id_fkey(id, username)"
      )
    expect(listError).toBeNull()
    expect(data?.[0]).toMatchObject({ requester: { id: ava.id }, addressee: { id: ben.id } })
  })

  it("opens a DM and lists it with recipients and activity", async () => {
    const { data: dmId, error } = await ava.client.rpc("open_dm", { p_user: ben.id })
    expect(error).toBeNull()
    await ben.client.rpc("send_message", { p_id: randomUUID(), p_channel: dmId!, p_content: "hey" })

    const { data: dms, error: listError } = await ava.client
      .from("channels")
      .select(
        "*, recipients:channel_recipients(user_id, hidden, joined_at, profile:profiles!inner(id, username)), activity:channel_activity(last_message_at)"
      )
      .in("type", ["dm", "group_dm"])
    expect(listError).toBeNull()
    expect(dms).toHaveLength(1)
    expect(dms?.[0].recipients.map((r: { user_id: string }) => r.user_id).sort()).toEqual([ava.id, ben.id].sort())
    expect(dms?.[0].activity).toBeTruthy()

    const { data: hidden } = await cy.client.from("channels").select("id").eq("id", dmId!)
    expect(hidden).toEqual([])
  })

  it("refuses DMs between strangers", async () => {
    const { error } = await cy.client.rpc("open_dm", { p_user: ava.id })
    expect(error?.message).toMatch(/friends or people you share a server/)
  })
})
