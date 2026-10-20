import { randomUUID } from "node:crypto"

import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { cleanupTestUsers, createTestUser, dbTestsEnabled, type TestUser } from "./helpers"

/** Messaging rules (Milestone 3), checked through RLS and the RPCs. */
describe.skipIf(!dbTestsEnabled)("messages (RLS)", () => {
  let owner: TestUser
  let member: TestUser
  let outsider: TestUser
  let channelId: string

  beforeAll(async () => {
    ;[owner, member, outsider] = await Promise.all([
      createTestUser("msgowner"),
      createTestUser("msgmember"),
      createTestUser("msgoutsider"),
    ])
    const { data: serverId } = await owner.client.rpc("create_server", { p_name: "Message Tests" })
    const { data: invite } = await owner.client.rpc("create_invite", { p_server: serverId! })
    await member.client.rpc("join_server_by_invite", { p_code: invite!.code })
    const { data: general } = await owner.client
      .from("channels")
      .select("id")
      .eq("server_id", serverId!)
      .eq("name", "general")
      .single()
    channelId = general!.id
  }, 60_000)

  afterAll(cleanupTestUsers, 60_000)

  it("sends idempotently and stamps the server time and author", async () => {
    const id = randomUUID()
    const send = () =>
      member.client.rpc("send_message", { p_id: id, p_channel: channelId, p_content: "hello **world**" })

    const first = await send()
    expect(first.error).toBeNull()
    expect(first.data?.[0]).toMatchObject({ id, author_id: member.id, content: "hello **world**" })

    const retry = await send()
    expect(retry.data?.[0]?.created_at).toBe(first.data?.[0]?.created_at)

    const { count } = await owner.client.from("messages").select("id", { count: "exact", head: true }).eq("id", id)
    expect(count).toBe(1)
  })

  it("ignores client-supplied timestamps and authors on direct inserts", async () => {
    const id = randomUUID()
    await member.client.from("messages").insert({
      id,
      channel_id: channelId,
      content: "backdated?",
      created_at: "2000-01-01T00:00:00Z",
    })
    const { data } = await owner.client.from("messages").select("created_at, author_id").eq("id", id).single()
    expect(new Date(data!.created_at).getFullYear()).toBeGreaterThan(2020)
    expect(data!.author_id).toBe(member.id)
  })

  it("keeps outsiders from reading or posting", async () => {
    const { data } = await outsider.client.from("messages").select("id").eq("channel_id", channelId)
    expect(data).toEqual([])
    const { error } = await outsider.client.rpc("send_message", {
      p_id: randomUUID(),
      p_channel: channelId,
      p_content: "let me in",
    })
    expect(error?.message).toMatch(/permission/)
  })

  it("parses mentions, but only honors @everyone with permission", async () => {
    const id = randomUUID()
    await member.client.rpc("send_message", {
      p_id: id,
      p_channel: channelId,
      p_content: `hi <@${owner.id}> and @everyone`,
    })
    const { data } = await owner.client.from("messages").select("mentions, mention_everyone").eq("id", id).single()
    expect(data?.mentions).toEqual([owner.id])
    expect(data?.mention_everyone).toBe(false) // @everyone role lacks MENTION_EVERYONE

    const ownerMsg = randomUUID()
    await owner.client.rpc("send_message", { p_id: ownerMsg, p_channel: channelId, p_content: "@everyone meeting" })
    const { data: ownerData } = await owner.client.from("messages").select("mention_everyone").eq("id", ownerMsg).single()
    expect(ownerData?.mention_everyone).toBe(true)
  })

  it("lets authors edit their own messages only", async () => {
    const id = randomUUID()
    await member.client.rpc("send_message", { p_id: id, p_channel: channelId, p_content: "typo" })

    const { data: edited } = await member.client.from("messages").update({ content: "fixed" }).eq("id", id).select().single()
    expect(edited?.content).toBe("fixed")
    expect(edited?.edited_at).not.toBeNull()

    const { data: hijack } = await owner.client.from("messages").update({ content: "owned" }).eq("id", id).select()
    expect(hijack).toEqual([])
  })

  it("lets authors and MANAGE_MESSAGES delete, but not other members", async () => {
    const ownersMessage = randomUUID()
    await owner.client.rpc("send_message", { p_id: ownersMessage, p_channel: channelId, p_content: "mine" })
    const { count: memberDeleted } = await member.client
      .from("messages")
      .delete({ count: "exact" })
      .eq("id", ownersMessage)
    expect(memberDeleted).toBe(0)

    const membersMessage = randomUUID()
    await member.client.rpc("send_message", { p_id: membersMessage, p_channel: channelId, p_content: "spam" })
    const { count: modDeleted } = await owner.client
      .from("messages")
      .delete({ count: "exact" })
      .eq("id", membersMessage)
    expect(modDeleted).toBe(1)
  })

  it("tracks unread state and mentions, and mark_read clears them", async () => {
    const id = randomUUID()
    await member.client.rpc("send_message", { p_id: id, p_channel: channelId, p_content: `ping <@${owner.id}>` })

    const { data: before } = await owner.client.rpc("get_unread_state")
    const row = before?.find((r) => r.channel_id === channelId)
    expect(row && row.last_message_at > row.last_read_at).toBe(true)
    expect(Number(row?.mention_count)).toBeGreaterThan(0)

    await owner.client.rpc("mark_read", { p_channel: channelId, p_message: id })
    const { data: after } = await owner.client.rpc("get_unread_state")
    const cleared = after?.find((r) => r.channel_id === channelId)
    expect(cleared && cleared.last_message_at <= cleared.last_read_at).toBe(true)
    expect(Number(cleared?.mention_count)).toBe(0)
  })
})
