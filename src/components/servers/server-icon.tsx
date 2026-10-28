import { AnimatedImage } from "@/components/ui/animated-image"
import { cn } from "@/lib/utils"

/** "KTCord Fan Club" → "KFC". Discord-style initials for servers without an icon. */
export function serverAcronym(name: string): string {
  return (
    name
      .trim()
      .split(/\s+/)
      .map((word) => Array.from(word)[0] ?? "")
      .join("")
      .slice(0, 3) || "?"
  )
}

/** A server's icon image (GIFs play on hover), or its initials. Size and shape come from the caller. */
export function ServerIcon({
  name,
  iconUrl,
  className,
  animate,
}: {
  name: string
  iconUrl: string | null
  className?: string
  animate?: "hover" | "always"
}) {
  if (iconUrl) return <AnimatedImage src={iconUrl} className={className} animate={animate} />
  const acronym = serverAcronym(name)
  return (
    <span
      className={cn(
        "flex size-full items-center justify-center font-medium",
        acronym.length > 2 ? "text-xs" : "text-base",
        className
      )}
    >
      {acronym}
    </span>
  )
}
