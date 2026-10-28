"use client"

import { LogOutIcon, XIcon } from "lucide-react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react"
import { createPortal } from "react-dom"

import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { signOut } from "@/lib/api/auth"
import { leaveBlocked, useUnsavedStore } from "@/lib/stores/unsaved-store"
import { cn } from "@/lib/utils"

/** Whether to skip decorative motion (the OS setting or Appearance → Reduce Motion). */
function prefersLessMotion() {
  return (
    window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
    document.documentElement.hasAttribute("data-reduced-motion")
  )
}

/** Where the unsaved-changes bar renders: the bottom center of the settings content. */
const UnsavedSlot = createContext<HTMLElement | null>(null)

export type SettingsNavGroup = {
  heading: string
  items: { href: string; label: string }[]
}

/**
 * Full-page settings layout shared by User Settings and (later) Server Settings:
 * a nav column, the content column, and a close button that also answers to Escape.
 */
export function SettingsLayout({
  nav,
  closeHref,
  showLogOut = false,
  children,
}: {
  nav: SettingsNavGroup[]
  closeHref: string
  showLogOut?: boolean
  children: ReactNode
}) {
  const pathname = usePathname()
  const router = useRouter()

  const rootRef = useRef<HTMLDivElement>(null)
  const closing = useRef(false)
  // Leaving settings plays the opening animation in reverse (fade and zoom out), as in Discord.
  const close = useCallback(() => {
    if (leaveBlocked() || closing.current) return
    closing.current = true
    const root = rootRef.current
    if (!root || prefersLessMotion()) {
      router.push(closeHref)
      return
    }
    root
      .animate(
        [
          { opacity: 1, transform: "scale(1)" },
          { opacity: 0, transform: "scale(0.97)" },
        ],
        { duration: 160, easing: "ease-in", fill: "forwards" }
      )
      .finished.finally(() => router.push(closeHref))
  }, [router, closeHref])
  const [slot, setSlot] = useState<HTMLElement | null>(null)
  // Switching settings pages with unsaved changes shakes the bar instead.
  const guard = (e: React.MouseEvent) => {
    if (leaveBlocked()) e.preventDefault()
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // Let open dialogs and menus handle Escape first.
      if (e.key !== "Escape" || e.defaultPrevented) return
      if (document.querySelector("[role=dialog], [role=menu]")) return
      close()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [close])

  const items = nav.flatMap((group) => group.items)

  return (
    <UnsavedSlot.Provider value={slot}>
      <div
      ref={rootRef}
      className="flex h-dvh flex-col bg-chat duration-200 animate-in fade-in-0 zoom-in-[0.97] md:flex-row"
    >
        {/* Phone: a top bar with horizontally scrolling tabs. */}
        <div className="shrink-0 border-b border-border bg-sidebar md:hidden">
          <div className="flex h-12 items-center justify-between px-3">
            <span className="font-semibold text-header">Settings</span>
            <button
              type="button"
              onClick={close}
              aria-label="Close settings"
              className="flex size-8 items-center justify-center rounded-full text-interactive hover:text-interactive-hover"
            >
              <XIcon className="size-5" />
            </button>
          </div>
          <nav className="scrollbar-none flex gap-1 overflow-x-auto px-2 pb-2">
            {items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={guard}
                className={cn(
                  "shrink-0 rounded-md px-3 py-1.5 text-sm font-medium",
                  pathname === item.href
                    ? "bg-item-selected text-interactive-active"
                    : "text-interactive hover:bg-item-hover"
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>

        {/* Desktop: Discord-style right-aligned nav column. */}
        <aside className="scrollbar-thin hidden flex-[1_0_218px] justify-end overflow-y-auto bg-sidebar md:flex">
          <nav className="w-[218px] px-2 py-[60px] pl-5">
            {nav.map((group) => (
              <div key={group.heading} className="mb-2">
                <h2 className="px-2.5 pb-1.5 text-xs font-bold tracking-wide text-muted-foreground uppercase">
                  {group.heading}
                </h2>
                {group.items.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={guard}
                    className={cn(
                      "mb-0.5 block rounded-md px-2.5 py-1.5 text-[15px] font-medium",
                      pathname === item.href
                        ? "bg-item-selected text-interactive-active"
                        : "text-interactive hover:bg-item-hover hover:text-interactive-hover"
                    )}
                  >
                    {item.label}
                  </Link>
                ))}
                <div className="mx-2.5 my-2 h-px bg-border" />
              </div>
            ))}
            {showLogOut && (
              <button
                type="button"
                onClick={() => signOut()}
                className="flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-[15px] font-medium text-interactive hover:bg-item-hover hover:text-interactive-hover"
              >
                Log Out <LogOutIcon className="size-4" />
              </button>
            )}
          </nav>
        </aside>

        <div className="relative flex min-h-0 flex-[1_1_800px] flex-col">
          <div className="scrollbar-thin flex min-h-0 flex-1 items-start overflow-y-auto">
            <main className="w-full max-w-[740px] px-4 pt-6 pb-28 sm:px-10 md:pt-[60px]">{children}</main>
            <div className="sticky top-0 hidden shrink-0 pt-[60px] pr-5 md:block">
              <button
                type="button"
                onClick={close}
                aria-label="Close settings"
                className="group flex flex-col items-center gap-1.5 text-interactive"
              >
                <span className="flex size-9 items-center justify-center rounded-full border-2 border-interactive transition-colors group-hover:border-interactive-hover group-hover:bg-item-hover group-hover:text-interactive-hover">
                  <XIcon className="size-5" />
                </span>
                <span className="text-xs font-semibold">ESC</span>
              </button>
            </div>
          </div>
          <div
            ref={setSlot}
            className="pointer-events-none absolute inset-x-0 bottom-5 z-20 flex justify-center px-4 md:justify-start md:px-10 md:pr-[76px]"
          />
        </div>
      </div>
    </UnsavedSlot.Provider>
  )
}

export function SettingsSection({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: ReactNode
}) {
  return (
    <section className="mb-10">
      <h1 className="text-xl font-bold text-header">{title}</h1>
      {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      <div className="mt-5">{children}</div>
    </section>
  )
}

/** A labelled on/off setting with an optional explanation, Discord-style. */
export function SettingsToggle({
  id,
  label,
  description,
  checked,
  disabled,
  onCheckedChange,
}: {
  id: string
  label: string
  description?: ReactNode
  checked: boolean
  disabled?: boolean
  onCheckedChange: (checked: boolean) => void
}) {
  return (
    <div className="flex items-start justify-between gap-6 border-b border-border py-4 last:border-b-0">
      <div className="min-w-0">
        <label htmlFor={id} className="font-medium text-header">
          {label}
        </label>
        {description && (
          <p id={`${id}-description`} className="mt-1 text-sm text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      <Switch
        id={id}
        checked={checked}
        disabled={disabled}
        onCheckedChange={onCheckedChange}
        aria-describedby={description ? `${id}-description` : undefined}
        className="mt-0.5"
      />
    </div>
  )
}

/** Discord's "Careful — you have unsaved changes!" bar, pinned to the bottom of a settings page. */
export function UnsavedChangesBar({
  onReset,
  onSave,
  saving,
}: {
  onReset: () => void
  onSave: () => void
  saving: boolean
}) {
  const slot = useContext(UnsavedSlot)
  const barRef = useRef<HTMLDivElement>(null)
  const attempts = useUnsavedStore((s) => s.attempts)
  const [warned, setWarned] = useState<number | null>(null)

  useEffect(() => useUnsavedStore.getState().register(), [])
  // Each blocked attempt to leave: shake and flash red for a moment.
  const [seen, setSeen] = useState(attempts)
  if (attempts !== seen) {
    setSeen(attempts)
    setWarned(attempts)
  }
  useEffect(() => {
    if (warned === null) return
    if (!prefersLessMotion()) {
      barRef.current?.animate(
        [0, -14, 14, -12, 12, -8, 8, -4, 4, 0].map((x) => ({ transform: `translateX(${x}px)` })),
        { duration: 550, easing: "ease-in-out" }
      )
    }
    const timer = setTimeout(() => setWarned(null), 1500)
    return () => clearTimeout(timer)
  }, [warned])

  const bar = (
    <div
      ref={barRef}
      role="status"
      className={cn(
        "pointer-events-auto flex w-full max-w-[700px] items-center justify-between gap-3 rounded-lg p-3 pl-4 shadow-2xl ring-1 transition-colors duration-200",
        warned !== null
          ? "bg-destructive text-white ring-destructive"
          : "bg-floating ring-border animate-in fade-in-0 slide-in-from-bottom-4"
      )}
    >
      <span className={cn("text-sm font-medium", warned !== null ? "text-white" : "text-header")}>
        Careful — you have unsaved changes!
      </span>
      <div className="flex shrink-0 gap-2">
        <Button
          variant="ghost"
          onClick={onReset}
          disabled={saving}
          className={warned !== null ? "text-white hover:bg-white/15 hover:text-white" : undefined}
        >
          Reset
        </Button>
        <Button className="bg-success text-white hover:bg-success/80" onClick={onSave} disabled={saving}>
          {saving ? "Saving…" : "Save Changes"}
        </Button>
      </div>
    </div>
  )
  return slot ? createPortal(bar, slot) : <div className="sticky bottom-4 z-10 mt-8 flex justify-center">{bar}</div>
}
