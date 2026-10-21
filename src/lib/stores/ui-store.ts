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
  | { kind: "create-thread"; serverId: string; channelId: string; messageId: string; defaultName: string }
  | { kind: "quick-switcher" }
  | { kind: "shortcuts" }

/** What's in the right-hand panel instead of the member list. */
export type SidePanel =
  | { kind: "thread"; channelId: string; threadId: string }
  | { kind: "search"; scopeKey: string; query: string }

type UiState = {
  /** Mobile: the left drawer holding the server rail + channel list. */
  navDrawerOpen: boolean
  /** Desktop: whether the member list column is shown (remembered). */
  memberListVisible: boolean
  /** Tablet/mobile: the member list slide-over. */
  memberSheetOpen: boolean
  dialog: AppDialog | null
  sidePanel: SidePanel | null
  /** Collapsed categories, by category id (remembered). */
  collapsedCategories: Record<string, true>
  /** The channel last opened in each server, so returning to a server lands there (remembered). */
  lastChannelByServer: Record<string, string>
  /** Recently opened channels and DMs, newest first, for the quick switcher (remembered). */
  recentChannelIds: string[]

  setNavDrawerOpen: (open: boolean) => void
  toggleMemberList: () => void
  setMemberSheetOpen: (open: boolean) => void
  openDialog: (dialog: AppDialog) => void
  closeDialog: () => void
  openSidePanel: (panel: SidePanel) => void
  closeSidePanel: () => void
  toggleCategory: (categoryId: string) => void
  rememberChannel: (serverId: string, channelId: string) => void
  visitChannel: (channelId: string) => void
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      navDrawerOpen: false,
      memberListVisible: true,
      memberSheetOpen: false,
      dialog: null,
      sidePanel: null,
      collapsedCategories: {},
      lastChannelByServer: {},
      recentChannelIds: [],

      setNavDrawerOpen: (navDrawerOpen) => set({ navDrawerOpen }),
      toggleMemberList: () => set((s) => ({ memberListVisible: !s.memberListVisible })),
      setMemberSheetOpen: (memberSheetOpen) => set({ memberSheetOpen }),
      openDialog: (dialog) => set({ dialog, navDrawerOpen: false }),
      closeDialog: () => set({ dialog: null }),
      openSidePanel: (sidePanel) => set({ sidePanel }),
      closeSidePanel: () => set({ sidePanel: null }),
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
      visitChannel: (channelId) =>
        set((s) =>
          s.recentChannelIds[0] === channelId
            ? s
            : { recentChannelIds: [channelId, ...s.recentChannelIds.filter((id) => id !== channelId)].slice(0, 20) }
        ),
    }),
    {
      name: "ktcord-ui",
      partialize: (s) => ({
        memberListVisible: s.memberListVisible,
        collapsedCategories: s.collapsedCategories,
        lastChannelByServer: s.lastChannelByServer,
        recentChannelIds: s.recentChannelIds,
      }),
    }
  )
)
