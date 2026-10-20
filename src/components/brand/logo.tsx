import { cn } from "@/lib/utils"

/** The KTCord mark: a speech bubble carrying a "KT" monogram. */
export function KtcordMark({
  className,
  title = "KTCord",
}: {
  className?: string
  title?: string
}) {
  return (
    <svg
      viewBox="0 0 48 48"
      role="img"
      aria-label={title}
      className={cn("size-8", className)}
    >
      <path
        fill="currentColor"
        d="M16 6h16c6.6 0 12 5.4 12 12v8c0 6.6-5.4 12-12 12H21l-9.2 6.6c-.7.5-1.6 0-1.6-.8v-6.9C6.5 35.5 4 31.1 4 26v-8C4 11.4 9.4 6 16 6Z"
      />
      <g
        fill="none"
        stroke="var(--logo-glyph, #fff)"
        strokeWidth={4}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M14 14v16" />
        <path d="M22.5 14 15.5 22l7 8" />
        <path d="M26.5 14h9" />
        <path d="M31 14v16" />
      </g>
    </svg>
  )
}

/** Mark + "KTCord" wordmark, for the login, onboarding and welcome screens. */
export function KtcordLogo({
  className,
  markClassName,
}: {
  className?: string
  markClassName?: string
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2.5 font-heading text-2xl font-extrabold tracking-tight text-header",
        className
      )}
    >
      <KtcordMark className={cn("size-9 text-primary", markClassName)} />
      <span>
        KT<span className="text-primary">Cord</span>
      </span>
    </span>
  )
}
