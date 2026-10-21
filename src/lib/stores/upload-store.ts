import { create } from "zustand"

export type PendingFile = {
  id: string
  file: File
  /** Object URL for image/video previews. */
  previewUrl: string | null
  spoiler: boolean
}

type UploadState = {
  /** Files staged in each channel's composer, before sending. */
  staged: Record<string, PendingFile[]>
  /** Files for messages being sent, by message id (kept for retry). */
  files: Record<string, { path: string; file: File }[]>
  /** Upload progress 0–1 per storage path, and local preview URLs per path. */
  progress: Record<string, number>
  localUrls: Record<string, string>

  stage: (channelId: string, files: File[]) => void
  unstage: (channelId: string, id: string) => void
  toggleSpoiler: (channelId: string, id: string) => void
  clearStaged: (channelId: string) => void
  track: (messageId: string, items: { path: string; file: File; previewUrl: string | null }[]) => void
  setProgress: (path: string, fraction: number) => void
  done: (messageId: string) => void
}

export const useUploadStore = create<UploadState>()((set) => ({
  staged: {},
  files: {},
  progress: {},
  localUrls: {},

  stage: (channelId, files) =>
    set((s) => ({
      staged: {
        ...s.staged,
        [channelId]: [
          ...(s.staged[channelId] ?? []),
          ...files.map((file) => ({
            id: crypto.randomUUID(),
            file,
            previewUrl:
              file.type.startsWith("image/") || file.type.startsWith("video/") ? URL.createObjectURL(file) : null,
            spoiler: false,
          })),
        ],
      },
    })),
  unstage: (channelId, id) =>
    set((s) => {
      const item = s.staged[channelId]?.find((f) => f.id === id)
      if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl)
      return { staged: { ...s.staged, [channelId]: (s.staged[channelId] ?? []).filter((f) => f.id !== id) } }
    }),
  toggleSpoiler: (channelId, id) =>
    set((s) => ({
      staged: {
        ...s.staged,
        [channelId]: (s.staged[channelId] ?? []).map((f) => (f.id === id ? { ...f, spoiler: !f.spoiler } : f)),
      },
    })),
  // Previews move to `localUrls` when sent, so clearing doesn't revoke them.
  clearStaged: (channelId) => set((s) => ({ staged: { ...s.staged, [channelId]: [] } })),
  track: (messageId, items) =>
    set((s) => {
      const localUrls = { ...s.localUrls }
      for (const item of items) if (item.previewUrl) localUrls[item.path] = item.previewUrl
      return {
        files: { ...s.files, [messageId]: items.map(({ path, file }) => ({ path, file })) },
        localUrls,
      }
    }),
  setProgress: (path, fraction) => set((s) => ({ progress: { ...s.progress, [path]: fraction } })),
  done: (messageId) =>
    set((s) => {
      const files = { ...s.files }
      delete files[messageId]
      return { files }
    }),
}))
