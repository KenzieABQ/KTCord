import { create } from "zustand"

/** Per-channel composer state: unsent drafts, the message being replied to, and inline editing. */
type ComposerState = {
  drafts: Record<string, string>
  replyTo: Record<string, string | undefined>
  /** Whether the reply mentions (pings) the person replied to; on for each new reply. */
  replyPing: Record<string, boolean>
  /** The message id being edited inline (only one at a time, app-wide). */
  editingId: string | null
  /** Slow mode: when each channel lets you send again (ms since epoch). */
  cooldowns: Record<string, number>

  setDraft: (channelId: string, text: string) => void
  setReplyTo: (channelId: string, messageId: string | undefined) => void
  setReplyPing: (channelId: string, ping: boolean) => void
  setEditing: (messageId: string | null) => void
  setCooldown: (channelId: string, until: number) => void
}

export const useComposerStore = create<ComposerState>()((set) => ({
  drafts: {},
  replyTo: {},
  replyPing: {},
  editingId: null,
  cooldowns: {},

  setDraft: (channelId, text) => set((s) => ({ drafts: { ...s.drafts, [channelId]: text } })),
  setReplyTo: (channelId, messageId) =>
    set((s) => ({
      replyTo: { ...s.replyTo, [channelId]: messageId },
      replyPing: { ...s.replyPing, [channelId]: true },
    })),
  setReplyPing: (channelId, ping) => set((s) => ({ replyPing: { ...s.replyPing, [channelId]: ping } })),
  setEditing: (editingId) => set({ editingId }),
  setCooldown: (channelId, until) => set((s) => ({ cooldowns: { ...s.cooldowns, [channelId]: until } })),
}))
