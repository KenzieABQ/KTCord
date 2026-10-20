import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

const bar = "bg-item-selected/60"

export function RailSkeleton() {
  return (
    <div className="flex w-[72px] shrink-0 flex-col items-center gap-2 bg-rail py-3" aria-hidden>
      <Skeleton className={cn("size-12 rounded-2xl", bar)} />
      <div className="h-0.5 w-8 rounded-full bg-item-selected" />
      {Array.from({ length: 4 }, (_, i) => (
        <Skeleton key={i} className={cn("size-12 rounded-full", bar)} />
      ))}
    </div>
  )
}

const CHANNEL_WIDTHS = ["w-24", "w-32", "w-20", "w-28", "w-36", "w-24"]

export function ChannelListSkeleton() {
  return (
    <div className="flex flex-col gap-4 px-2 py-4" aria-hidden>
      {[0, 1].map((group) => (
        <div key={group} className="flex flex-col gap-2.5">
          <Skeleton className={cn("ml-2 h-3 w-24", bar)} />
          {CHANNEL_WIDTHS.slice(group * 2, group * 2 + 4).map((w, i) => (
            <div key={i} className="flex items-center gap-2 px-2">
              <Skeleton className={cn("size-5 rounded", bar)} />
              <Skeleton className={cn("h-3.5", w, bar)} />
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

const LINE_WIDTHS = ["w-3/4", "w-1/2", "w-2/3", "w-5/6", "w-1/3", "w-3/5"]

export function MessageFeedSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-6 px-4 py-6" aria-hidden>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex gap-4">
          <Skeleton className={cn("size-10 shrink-0 rounded-full", bar)} />
          <div className="flex flex-1 flex-col gap-2 pt-1">
            <div className="flex gap-2">
              <Skeleton className={cn("h-3.5 w-28", bar)} />
              <Skeleton className={cn("h-3.5 w-16 opacity-60", bar)} />
            </div>
            <Skeleton className={cn("h-3.5", LINE_WIDTHS[i % LINE_WIDTHS.length], bar)} />
            {i % 2 === 0 && (
              <Skeleton className={cn("h-3.5", LINE_WIDTHS[(i + 2) % LINE_WIDTHS.length], bar)} />
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

export function MemberListSkeleton() {
  return (
    <div className="flex flex-col gap-3 px-4 py-5" aria-hidden>
      <Skeleton className={cn("h-3 w-20", bar)} />
      {Array.from({ length: 8 }, (_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className={cn("size-8 rounded-full", bar)} />
          <Skeleton className={cn("h-3.5", CHANNEL_WIDTHS[i % CHANNEL_WIDTHS.length], bar)} />
        </div>
      ))}
    </div>
  )
}

/** The whole four-column shell, shown while the URL-dependent app shell renders. */
export function AppShellSkeleton() {
  return (
    <div className="flex h-dvh overflow-hidden bg-rail">
      <div className="hidden md:flex">
        <RailSkeleton />
        <div className="flex w-60 flex-col rounded-tl-lg bg-sidebar">
          <div className="h-12 border-b border-sidebar-border" />
          <ChannelListSkeleton />
        </div>
      </div>
      <div className="flex min-w-0 flex-1 bg-chat">
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="h-12 border-b border-sidebar-border" />
          <MessageFeedSkeleton />
        </div>
        <div className="hidden w-60 bg-sidebar xl:block">
          <MemberListSkeleton />
        </div>
      </div>
    </div>
  )
}
