"use client"

import { useQueryClient } from "@tanstack/react-query"
import { useParams, useRouter } from "next/navigation"
import { useEffect } from "react"

import { composerInputId, focusComposer, pickComposerFiles } from "@/components/chat/composer"
import type { Channel } from "@/lib/api/channels"
import type { DmChannel } from "@/lib/api/dms"
import { buildChannelTree, flattenTree } from "@/lib/channels/tree"
import { qk } from "@/lib/queries/keys"
import { useMarkChannelRead, useMarkServerRead } from "@/lib/queries/settings"
import { adjacentId, isApplePlatform, isPrintableKey, isTextField, MARK_READ_EVENT } from "@/lib/shortcuts"
import { useUserId } from "@/lib/stores/auth-store"
import { useUiStore } from "@/lib/stores/ui-store"
import { isChannelUnread, useUnreadStore } from "@/lib/stores/unread-store"

/** Dialogs, menus and popovers get first claim on the keyboard. */
function overlayOpen() {
  return Boolean(
    document.querySelector("[role=dialog], [role=alertdialog], [role=menu], [data-radix-popper-content-wrapper]")
  )
}

/**
 * App-wide keyboard shortcuts (see SHORTCUT_GROUPS), plus typing anywhere to start a
 * message in the open channel. Also records visited channels for the quick switcher.
 */
export function useGlobalShortcuts() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const userId = useUserId()
  const { serverId, channelId } = useParams<{ serverId?: string; channelId?: string }>()
  const visitChannel = useUiStore((s) => s.visitChannel)
  const { mutate: markChannelRead } = useMarkChannelRead()
  const { mutate: markServerRead } = useMarkServerRead()

  useEffect(() => {
    if (channelId) visitChannel(channelId)
  }, [channelId, visitChannel])

  useEffect(() => {
    const apple = isApplePlatform()

    /** The channels Alt+↑/↓ steps through, in sidebar order: a server's text channels, or the DM list. */
    function navigable(): { ids: string[]; href: (id: string) => string } {
      if (serverId) {
        const channels = queryClient.getQueryData<Channel[]>(qk.channels(serverId)) ?? []
        const ids = flattenTree(buildChannelTree(channels))
          .filter((c) => c.type === "text")
          .map((c) => c.id)
        return { ids, href: (id) => `/channels/${serverId}/${id}` }
      }
      const dms = queryClient.getQueryData<DmChannel[]>(qk.dms(userId)) ?? []
      const ids = dms.filter((dm) => !dm.recipients.find((r) => r.user_id === userId)?.hidden).map((dm) => dm.id)
      return { ids, href: (id) => `/channels/me/${id}` }
    }

    function onKeyDown(e: KeyboardEvent) {
      if (e.isComposing) return
      const mod = apple ? e.metaKey : e.ctrlKey
      const key = e.key.toLowerCase()
      const ui = useUiStore.getState()

      if (mod && !e.altKey && !e.shiftKey && key === "k") {
        e.preventDefault()
        if (ui.dialog?.kind === "quick-switcher") ui.closeDialog()
        else ui.openDialog({ kind: "quick-switcher" })
        return
      }
      if (mod && !e.altKey && key === "/") {
        e.preventDefault()
        ui.openDialog({ kind: "shortcuts" })
        return
      }
      if (mod && e.shiftKey && key === "u") {
        if (!channelId || overlayOpen()) return
        e.preventDefault()
        pickComposerFiles(channelId)
        return
      }

      if (e.altKey && !mod && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
        if (overlayOpen()) return
        e.preventDefault()
        const { ids, href } = navigable()
        const unread = useUnreadStore.getState().channels
        const next = adjacentId(
          ids,
          channelId,
          e.key === "ArrowUp" ? -1 : 1,
          e.shiftKey ? (id) => isChannelUnread(unread[id]) : undefined
        )
        if (next) router.push(href(next))
        return
      }

      if (e.key === "Escape") {
        if (e.defaultPrevented || overlayOpen()) return
        // Escape in a text field belongs to it, except in the message box (as in Discord).
        const inComposer = channelId && (e.target as Element | null)?.id === composerInputId(channelId)
        if (isTextField(e.target) && !inComposer) return
        if (e.shiftKey) {
          if (serverId) markServerRead(serverId)
        } else if (ui.sidePanel) {
          ui.closeSidePanel()
        } else if (channelId) {
          markChannelRead(channelId)
          window.dispatchEvent(new CustomEvent(MARK_READ_EVENT, { detail: channelId }))
        }
        return
      }

      // Type anywhere to start a message; the keystroke lands in the newly focused box.
      if (channelId && isPrintableKey(e) && !isTextField(e.target) && !overlayOpen()) {
        focusComposer(channelId)
      }
    }

    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [serverId, channelId, userId, queryClient, router, markChannelRead, markServerRead])
}
