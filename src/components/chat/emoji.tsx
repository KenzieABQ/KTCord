import { customEmojiUrl, parseCustomEmoji } from "@/lib/emoji"
import { cn } from "@/lib/utils"

/** A standard emoji character or a custom server emoji token (<:name:id>), drawn inline. */
export function Emoji({ value, className }: { value: string; className?: string }) {
  const custom = parseCustomEmoji(value)
  if (custom) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- tiny user-uploaded images from storage
      <img
        src={customEmojiUrl(custom.id)}
        alt={`:${custom.name}:`}
        title={`:${custom.name}:`}
        draggable={false}
        loading="lazy"
        className={cn("custom-emoji inline-block size-[1.375em] object-contain align-bottom", className)}
      />
    )
  }
  return <span className={className}>{value}</span>
}
