import { create } from "zustand"

/** Per-channel composer state: unsent drafts, the message being replied to, and inline editing. */
type ComposerState = {
  drafts: Record<string, string>
  replyTo: Record<string, string | undefined>
  /** The message id being edited inline (only one at a time, app-wide). */
  editingId: string | null

  setDraft: (channelId: string, text: string) => void
  setReplyTo: (channelId: string, messageId: string | undefined) => void
  setEditing: (messageId: string | null) => void
}

export const useComposerStore = create<ComposerState>()((set) => ({
  drafts: {},
  replyTo: {},
  editingId: null,

  setDraft: (channelId, text) => set((s) => ({ drafts: { ...s.drafts, [channelId]: text } })),
  setReplyTo: (channelId, messageId) =>
    set((s) => ({ replyTo: { ...s.replyTo, [channelId]: messageId } })),
  setEditing: (editingId) => set({ editingId }),
}))
