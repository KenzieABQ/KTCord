"use client"

import { useParams } from "next/navigation"
import { useEffect, useRef, useState, type ReactNode } from "react"

import { composerInputId, focusComposer } from "@/components/chat/composer"
import { ServerSidebar } from "@/components/servers/server-sidebar"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"
import { VoicePanel } from "@/components/voice/voice-panel"
import { useBreakpoint } from "@/hooks/use-breakpoint"
import { useGlobalShortcuts } from "@/hooks/use-global-shortcuts"
import { useSwipe } from "@/hooks/use-swipe"
import { visibleElementById } from "@/lib/dom"
import { useUiStore } from "@/lib/stores/ui-store"

import { HomeSidebar } from "./home-sidebar"
import { ServerRail } from "./server-rail"
import { TitleBar } from "./title-bar"
import { UserPanel } from "./user-panel"

/** Height of an element, kept current as it resizes. */
function useHeight<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [height, setHeight] = useState(0)
  useEffect(() => {
    const element = ref.current
    if (!element) return
    const observer = new ResizeObserver(() => setHeight(element.offsetHeight))
    observer.observe(element)
    return () => observer.disconnect()
  }, [])
  return [ref, height] as const
}

/**
 * Server rail + the channel sidebar for the current section. The user panel (and voice
 * panel) float over the bottom of both, as in Discord's newer look.
 */
function Navigation() {
  const params = useParams<{ serverId?: string }>()
  const [panelRef, panelHeight] = useHeight<HTMLDivElement>()
  const inset = panelHeight + 16
  return (
    <div className="relative flex h-full min-h-0">
      <ServerRail bottomInset={inset} />
      <aside
        aria-label={params.serverId ? "Channels" : "Direct messages"}
        className="flex w-[272px] min-w-0 flex-col overflow-hidden border-t border-l border-border bg-sidebar md:rounded-tl-xl"
        style={{ paddingBottom: inset }}
      >
        {params.serverId ? <ServerSidebar serverId={params.serverId} /> : <HomeSidebar />}
      </aside>
      <div
        ref={panelRef}
        className="absolute inset-x-2 bottom-2 z-10 overflow-hidden rounded-lg border border-border bg-card shadow-lg"
      >
        <VoicePanel />
        <UserPanel />
      </div>
    </div>
  )
}

/**
 * The persistent four-column layout.
 * Desktop and tablet show the rail and sidebar inline; phones get them in a left drawer
 * (hamburger button or swipe right). Views render the main panel and, when they have one,
 * the right-hand column themselves.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const breakpoint = useBreakpoint()
  const navDrawerOpen = useUiStore((s) => s.navDrawerOpen)
  const setNavDrawerOpen = useUiStore((s) => s.setNavDrawerOpen)
  const params = useParams()
  const mainRef = useRef<HTMLElement>(null)
  useGlobalShortcuts()

  // Close the drawer after navigating somewhere from it.
  const routeKey = JSON.stringify(params)
  useEffect(() => {
    setNavDrawerOpen(false)
  }, [routeKey, setNavDrawerOpen])

  useSwipe(mainRef, { onSwipeRight: () => setNavDrawerOpen(true) }, breakpoint === "mobile")
  // Swipe the open drawer back to the left to close it.
  const drawerRef = useRef<HTMLDivElement>(null)
  useSwipe(drawerRef, { onSwipeLeft: () => setNavDrawerOpen(false) }, breakpoint === "mobile" && navDrawerOpen)

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-rail">
      <a
        href="#app-main"
        onClick={(e) => {
          // In a channel, the message box is the most useful place to land.
          const channelId = typeof params.channelId === "string" ? params.channelId : undefined
          if (channelId && visibleElementById(composerInputId(channelId))) {
            e.preventDefault()
            focusComposer(channelId)
          }
        }}
        className="sr-only z-50 rounded-md bg-primary px-3 py-2 text-sm font-semibold text-white focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        Skip to content
      </a>
      <div className="hidden md:block">
        <TitleBar />
      </div>
      <div className="flex min-h-0 flex-1">
        <div className="hidden md:flex">
          <Navigation />
        </div>

        {breakpoint === "mobile" && (
          <Sheet open={navDrawerOpen} onOpenChange={setNavDrawerOpen}>
            <SheetContent
              ref={drawerRef}
              side="left"
              showCloseButton={false}
              className="w-[344px] max-w-[90vw] gap-0 border-0 bg-rail p-0 sm:max-w-[344px]"
            >
              <SheetTitle className="sr-only">Navigation</SheetTitle>
              <Navigation />
            </SheetContent>
          </Sheet>
        )}

        <main
          id="app-main"
          ref={mainRef}
          tabIndex={-1}
          className="flex min-w-0 flex-1 bg-chat outline-none md:border-t md:border-l md:border-border"
        >
          {children}
        </main>
      </div>
    </div>
  )
}
