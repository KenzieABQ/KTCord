import { TokenVerifier } from "livekit-server-sdk"
import { describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))

const { createVoiceToken, liveKitConfig } = await import("./server")

const KEY = "test-key"
const SECRET = "test-secret-that-is-long-enough-for-hs256"

describe("createVoiceToken", () => {
  it("lets a speaker join and publish only their microphone in the channel's room", async () => {
    const jwt = await createVoiceToken({
      apiKey: KEY,
      apiSecret: SECRET,
      userId: "user-1",
      name: "Ava",
      channelId: "channel-1",
      canSpeak: true,
    })
    const claims = await new TokenVerifier(KEY, SECRET).verify(jwt)
    expect(claims.sub).toBe("user-1")
    expect(claims.name).toBe("Ava")
    expect(claims.video).toMatchObject({
      room: "channel-1",
      roomJoin: true,
      canSubscribe: true,
      canPublish: true,
      canPublishData: false,
    })
    expect(claims.video?.canPublishSources).toEqual(["microphone"])
    expect(claims.exp! - claims.nbf!).toBeLessThanOrEqual(10 * 60)
  })

  it("makes people without SPEAK listen-only", async () => {
    const jwt = await createVoiceToken({
      apiKey: KEY,
      apiSecret: SECRET,
      userId: "user-2",
      name: "Ben",
      channelId: "channel-1",
      canSpeak: false,
    })
    const claims = await new TokenVerifier(KEY, SECRET).verify(jwt)
    expect(claims.video?.canPublish).toBe(false)
    expect(claims.video?.canPublishSources).toEqual([])
  })
})

describe("liveKitConfig", () => {
  it("is null until all three settings are present", () => {
    vi.stubEnv("NEXT_PUBLIC_LIVEKIT_URL", "wss://example.livekit.cloud")
    vi.stubEnv("LIVEKIT_API_KEY", KEY)
    vi.stubEnv("LIVEKIT_API_SECRET", "")
    expect(liveKitConfig()).toBeNull()
    vi.stubEnv("LIVEKIT_API_SECRET", SECRET)
    expect(liveKitConfig()).toMatchObject({ url: "wss://example.livekit.cloud", apiKey: KEY })
    vi.unstubAllEnvs()
  })
})
