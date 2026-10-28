"use client"

import { useEffect, useRef } from "react"

import { cn } from "@/lib/utils"

export const isAnimated = (src: string | null | undefined) => Boolean(src && /\.gif($|\?)/i.test(src))

/** Draws an image's first frame onto a canvas, cropped to cover it (a paused GIF). */
function FirstFrame({ src, className }: { src: string; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const image = new Image()
    image.onload = () => {
      const size = 256
      const ratio = Math.max(size / image.naturalWidth, size / image.naturalHeight)
      const w = image.naturalWidth * ratio
      const h = image.naturalHeight * ratio
      canvas.width = size
      canvas.height = Math.round(size * (canvas.clientHeight / Math.max(1, canvas.clientWidth)) || size)
      const ctx = canvas.getContext("2d")
      ctx?.drawImage(image, (canvas.width - w) / 2, (canvas.height - h) / 2, w, h)
    }
    image.src = src
  }, [src])
  return <canvas ref={ref} aria-hidden className={className} />
}

/**
 * An image that may be an animated GIF. As in Discord, GIF avatars and server icons sit
 * still until you hover them (or the row they're in: any `group` ancestor), and play
 * all the time where `animate="always"` (profile cards, previews).
 */
export function AnimatedImage({
  src,
  alt = "",
  className,
  animate = "hover",
}: {
  src: string
  alt?: string
  className?: string
  animate?: "hover" | "always"
}) {
  if (!isAnimated(src) || animate === "always") {
    // eslint-disable-next-line @next/next/no-img-element -- user-uploaded images from storage
    return <img src={src} alt={alt} draggable={false} className={cn("size-full object-cover", className)} />
  }
  return (
    <span className="group/animated relative block size-full">
      <FirstFrame
        src={src}
        className={cn("block size-full group-hover:hidden group-hover/animated:hidden", className)}
      />
      {/* eslint-disable-next-line @next/next/no-img-element -- user-uploaded images from storage */}
      <img
        src={src}
        alt={alt}
        draggable={false}
        className={cn("hidden size-full object-cover group-hover:block group-hover/animated:block", className)}
      />
    </span>
  )
}
