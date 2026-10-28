import { customEmojiUrl, parseCustomEmoji } from "@/lib/emoji"
import { cn } from "@/lib/utils"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

/** A standard emoji character or a custom server emoji token (<:name:id>), drawn inline. */
export function Emoji({ value, className }: { value: string; className?: string }) {
  const custom = parseCustomEmoji(value)
  if (custom) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          {/* eslint-disable-next-line @next/next/no-img-element -- tiny user-uploaded images from storage */}
          <img
            src={customEmojiUrl(custom.id)}
            alt={`:${custom.name}:`}
            draggable={false}
            loading="lazy"
            className={cn("custom-emoji inline-block size-[1.375em] object-contain align-bottom", className)}
          />
        </TooltipTrigger>
        <TooltipContent side="top">:{custom.name}:</TooltipContent>
      </Tooltip>
    )
  }
  return <span className={className}>{value}</span>
}
