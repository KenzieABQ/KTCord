import { create } from "zustand"
import { persist } from "zustand/middleware"

/** App-wide dialogs, opened from anywhere and rendered once by <AppDialogs />. */
export type AppDialog =
  | { kind: "create-server" }
  | { kind: "join-server"; code?: string }
  | { kind: "create-channel"; serverId: string; parentId: string | null; type?: "text" | "voice" | "announcement" | "forum" }
  | { kind: "create-category"; serverId: string }
  | { kind: "invite"; serverId: string }
  | { kind: "leave-server"; serverId: string }
  | { kind: "kick-member"; serverId: string; userId: string }
  | { kind: "ban-member"; serverId: string; userId: string }
  | { kind: "create-dm"; addToChannelId?: string; preselect?: string[] }
  | { kind: "create-thread"; serverId: string; channelId: string; messageId: string; defaultName: string }
  | { kind: "forward-message"; messageId: string }
  | { kind: "events"; serverId: string }
  | { kind: "create-event"; serverId: string }
  | { kind: "server-rules"; serverId: string }
  | { kind: "welcome"; serverId: string }
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
  /** A voice channel's text chat is open beside the call. */
  voiceChatOpen: boolean
  /** The last page outside settings, so closing settings returns there. */
  lastAppPath: string | null
  /** Servers whose welcome screen this device has shown (remembered). */
  welcomedServers: Record<string, true>

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
  setVoiceChatOpen: (open: boolean) => void
  markWelcomed: (serverId: string) => void
  setLastAppPath: (path: string) => void
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      navDrawerOpen: false,
      memberListVisible: true,
      memberSheetOpen: false,
      dialog: null,
      sidePanel: null,
      voiceChatOpen: false,
      setVoiceChatOpen: (voiceChatOpen) => set({ voiceChatOpen }),
      welcomedServers: {},
      lastAppPath: null,
      setLastAppPath: (lastAppPath) => set((s) => (s.lastAppPath === lastAppPath ? s : { lastAppPath })),
      markWelcomed: (serverId) => set((s) => ({ welcomedServers: { ...s.welcomedServers, [serverId]: true } })),
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
        welcomedServers: s.welcomedServers,
        collapsedCategories: s.collapsedCategories,
        lastChannelByServer: s.lastChannelByServer,
        recentChannelIds: s.recentChannelIds,
      }),
    }
  )
)
