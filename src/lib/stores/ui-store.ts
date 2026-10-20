import { create } from "zustand"
import { persist } from "zustand/middleware"

/** App-wide dialogs, opened from anywhere and rendered once by <AppDialogs />. */
export type AppDialog =
  | { kind: "create-server" }
  | { kind: "join-server"; code?: string }
  | { kind: "create-channel"; serverId: string; parentId: string | null; type?: "text" | "voice" }
  | { kind: "create-category"; serverId: string }
  | { kind: "edit-channel"; serverId: string; channelId: string }
  | { kind: "invite"; serverId: string }
  | { kind: "leave-server"; serverId: string }
  | { kind: "kick-member"; serverId: string; userId: string }
  | { kind: "ban-member"; serverId: string; userId: string }
  | { kind: "create-dm"; addToChannelId?: string; preselect?: string[] }
  | { kind: "find-conversation" }

type UiState = {
  /** Mobile: the left drawer holding the server rail + channel list. */
  navDrawerOpen: boolean
  /** Desktop: whether the member list column is shown (remembered). */
  memberListVisible: boolean
  /** Tablet/mobile: the member list slide-over. */
  memberSheetOpen: boolean
  dialog: AppDialog | null
  /** Collapsed categories, by category id (remembered). */
  collapsedCategories: Record<string, true>
  /** The channel last opened in each server, so returning to a server lands there (remembered). */
  lastChannelByServer: Record<string, string>

  setNavDrawerOpen: (open: boolean) => void
  toggleMemberList: () => void
  setMemberSheetOpen: (open: boolean) => void
  openDialog: (dialog: AppDialog) => void
  closeDialog: () => void
  toggleCategory: (categoryId: string) => void
  rememberChannel: (serverId: string, channelId: string) => void
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      navDrawerOpen: false,
      memberListVisible: true,
      memberSheetOpen: false,
      dialog: null,
      collapsedCategories: {},
      lastChannelByServer: {},

      setNavDrawerOpen: (navDrawerOpen) => set({ navDrawerOpen }),
      toggleMemberList: () => set((s) => ({ memberListVisible: !s.memberListVisible })),
      setMemberSheetOpen: (memberSheetOpen) => set({ memberSheetOpen }),
      openDialog: (dialog) => set({ dialog, navDrawerOpen: false }),
      closeDialog: () => set({ dialog: null }),
      toggleCategory: (id) =>
        set((s) => {
          const next = { ...s.collapsedCategories }
          if (next[id]) delete next[id]
          else next[id] = true
          return { collapsedCategories: next }
        }),
      rememberChannel: (serverId, channelId) =>
        set((s) =>
          s.lastChannelByServer[serverId] === channelId
            ? s
            : { lastChannelByServer: { ...s.lastChannelByServer, [serverId]: channelId } }
        ),
    }),
    {
      name: "ktcord-ui",
      partialize: (s) => ({
        memberListVisible: s.memberListVisible,
        collapsedCategories: s.collapsedCategories,
        lastChannelByServer: s.lastChannelByServer,
      }),
    }
  )
)
