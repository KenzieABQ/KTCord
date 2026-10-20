import { beforeEach, describe, expect, it } from "vitest"

import { useVoiceStore } from "./voice-store"

describe("voice controls", () => {
  beforeEach(() => useVoiceStore.setState({ selfMute: false, selfDeaf: false }))

  it("deafening also mutes, and undeafening unmutes", () => {
    useVoiceStore.getState().toggleDeaf()
    expect(useVoiceStore.getState()).toMatchObject({ selfMute: true, selfDeaf: true })
    useVoiceStore.getState().toggleDeaf()
    expect(useVoiceStore.getState()).toMatchObject({ selfMute: false, selfDeaf: false })
  })

  it("unmuting while deafened undeafens too", () => {
    useVoiceStore.getState().toggleDeaf()
    useVoiceStore.getState().toggleMute()
    expect(useVoiceStore.getState()).toMatchObject({ selfMute: false, selfDeaf: false })
  })

  it("mute toggles on its own when not deafened", () => {
    useVoiceStore.getState().toggleMute()
    expect(useVoiceStore.getState()).toMatchObject({ selfMute: true, selfDeaf: false })
  })
})
