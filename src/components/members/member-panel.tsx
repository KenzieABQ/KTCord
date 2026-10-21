"use client"

import { useRef } from "react"

import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"
import { useBreakpoint } from "@/hooks/use-breakpoint"
import { useSwipe } from "@/hooks/use-swipe"
import { useUiStore } from "@/lib/stores/ui-store"

import { MemberList } from "./member-list"

/**
 * The right-hand member column. Inline on desktop (toggleable); a slide-over sheet on
 * tablet and phone, opened from the header button or by swiping left on phones.
 */
export function MemberPanel({ serverId }: { serverId: string }) {
  const breakpoint = useBreakpoint()
  const visible = useUiStore((s) => s.memberListVisible)
  const sheetOpen = useUiStore((s) => s.memberSheetOpen)
  const setSheetOpen = useUiStore((s) => s.setMemberSheetOpen)
  const sheetRef = useRef<HTMLDivElement>(null)
  useSwipe(sheetRef, { onSwipeRight: () => setSheetOpen(false) }, breakpoint !== "desktop" && sheetOpen)

  if (breakpoint === "desktop") {
    if (!visible) return null
    return (
      <aside aria-label="Members" className="w-60 shrink-0 bg-sidebar">
        <MemberList serverId={serverId} />
      </aside>
    )
  }

  return (
    <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
      <SheetContent ref={sheetRef} side="right" className="w-72 max-w-[85vw] gap-0 border-0 bg-sidebar p-0 sm:max-w-72">
        <SheetTitle className="px-4 pt-4 text-base text-header">Members</SheetTitle>
        <MemberList serverId={serverId} />
      </SheetContent>
    </Sheet>
  )
}

/** The header button that shows/hides the member list for the current layout. */
export function useToggleMembers() {
  const breakpoint = useBreakpoint()
  const visible = useUiStore((s) => s.memberListVisible)
  const toggleMemberList = useUiStore((s) => s.toggleMemberList)
  const setSheetOpen = useUiStore((s) => s.setMemberSheetOpen)
  return {
    active: breakpoint === "desktop" && visible,
    toggle: () => (breakpoint === "desktop" ? toggleMemberList() : setSheetOpen(true)),
  }
}
