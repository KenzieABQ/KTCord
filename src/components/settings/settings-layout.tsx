"use client"

import { LogOutIcon, XIcon } from "lucide-react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useCallback, useEffect, type ReactNode } from "react"

import { signOut } from "@/lib/api/auth"
import { cn } from "@/lib/utils"

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

  const close = useCallback(() => router.push(closeHref), [router, closeHref])

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
    <div className="flex h-dvh flex-col bg-chat md:flex-row">
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

      <div className="scrollbar-thin flex min-h-0 flex-[1_1_800px] items-start overflow-y-auto">
        <main className="w-full max-w-[740px] px-4 py-6 sm:px-10 md:py-[60px]">{children}</main>
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
    </div>
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
