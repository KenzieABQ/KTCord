"use client"

import { useParams } from "next/navigation"
import { useEffect, useRef, type ReactNode } from "react"

import { ServerSidebar } from "@/components/servers/server-sidebar"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"
import { useBreakpoint } from "@/hooks/use-breakpoint"
import { useSwipe } from "@/hooks/use-swipe"
import { useUiStore } from "@/lib/stores/ui-store"

import { HomeSidebar } from "./home-sidebar"
import { ServerRail } from "./server-rail"
import { UserPanel } from "./user-panel"

/** Server rail + the channel sidebar for the current section, with the user panel at the bottom. */
function Navigation() {
  const params = useParams<{ serverId?: string }>()
  return (
    <div className="flex h-full min-h-0">
      <ServerRail />
      <aside className="flex w-60 min-w-0 flex-col overflow-hidden bg-sidebar md:rounded-tl-lg">
        {params.serverId ? (
          <ServerSidebar serverId={params.serverId} />
        ) : (
          <HomeSidebar />
        )}
        <UserPanel />
      </aside>
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

  // Close the drawer after navigating somewhere from it.
  const routeKey = JSON.stringify(params)
  useEffect(() => {
    setNavDrawerOpen(false)
  }, [routeKey, setNavDrawerOpen])

  useSwipe(
    mainRef,
    { onSwipeRight: () => setNavDrawerOpen(true) },
    breakpoint === "mobile"
  )

  return (
    <div className="flex h-dvh overflow-hidden bg-rail">
      <div className="hidden md:flex">
        <Navigation />
      </div>

      {breakpoint === "mobile" && (
        <Sheet open={navDrawerOpen} onOpenChange={setNavDrawerOpen}>
          <SheetContent
            side="left"
            showCloseButton={false}
            className="w-[312px] max-w-[88vw] gap-0 border-0 bg-rail p-0 sm:max-w-[312px]"
          >
            <SheetTitle className="sr-only">Navigation</SheetTitle>
            <Navigation />
          </SheetContent>
        </Sheet>
      )}

      <main ref={mainRef} className="flex min-w-0 flex-1 bg-chat">
        {children}
      </main>
    </div>
  )
}
