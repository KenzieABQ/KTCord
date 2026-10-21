"use client"

import { useTheme } from "next-themes"

import { SettingsSection, SettingsToggle } from "@/components/settings/settings-layout"
import { Slider } from "@/components/ui/slider"
import {
  CHAT_FONT_SIZES,
  DEFAULT_CHAT_FONT_SIZE,
  usePrefsStore,
  type MessageDisplay,
} from "@/lib/stores/prefs-store"
import { cn } from "@/lib/utils"

const THEMES = [
  { value: "dark", label: "Dark", swatch: "bg-[#313338]" },
  { value: "light", label: "Light", swatch: "bg-white" },
  { value: "system", label: "Sync with computer", swatch: "bg-[linear-gradient(135deg,#fff_50%,#313338_50%)]" },
]

const DISPLAYS: { value: MessageDisplay; label: string; description: string }[] = [
  { value: "cozy", label: "Cozy", description: "Modern, beautiful, and easy on your eyes." },
  { value: "compact", label: "Compact", description: "Fit more messages on screen at one time." },
]

function Heading({ id, children }: { id?: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="text-xs font-bold tracking-wide text-muted-foreground uppercase">
      {children}
    </h2>
  )
}

/** A miniature of how messages will look with the chosen display and size. */
function MessagePreview({ display, fontSize }: { display: MessageDisplay; fontSize: number }) {
  const lines = [
    { name: "Ava", color: "#f47b67", text: "Look at me I'm a beautiful butterfly", head: true },
    { name: "Ava", color: "#f47b67", text: "Fluttering in the moonlight 🌙", head: false },
    { name: "Ben", color: "#5865f2", text: "Waiting for the day when compact mode would be turned on", head: true },
  ]
  return (
    <div aria-hidden className="rounded-lg border border-border bg-chat py-3" style={{ fontSize }}>
      {lines.map((line, i) => (
        <div key={i} className={cn("relative pr-4 pl-[72px]", line.head && i > 0 && (display === "compact" ? "mt-1.5" : "mt-4"))}>
          {display === "cozy" ? (
            <>
              {line.head && (
                <span className="absolute top-0.5 left-4 size-10 rounded-full" style={{ background: line.color }} />
              )}
              {line.head && (
                <p className="leading-[1.375em] font-medium" style={{ color: line.color }}>
                  {line.name} <span className="text-xs font-normal text-muted-foreground">Today at 4:20 PM</span>
                </p>
              )}
              <p className="leading-[1.375em] text-foreground">{line.text}</p>
            </>
          ) : (
            <p className="leading-[1.375em] text-foreground">
              <span className="absolute left-0 w-[72px] text-center text-[11px] text-muted-foreground">
                {line.head ? "4:20 PM" : ""}
              </span>
              {line.head && (
                <span className="mr-1.5 font-medium" style={{ color: line.color }}>
                  {line.name}
                </span>
              )}
              {line.text}
            </p>
          )}
        </div>
      ))}
    </div>
  )
}

export default function AppearanceSettingsPage() {
  const { theme, setTheme } = useTheme()
  const prefs = usePrefsStore()
  const sizeIndex = Math.max(0, CHAT_FONT_SIZES.findIndex((size) => size === prefs.chatFontSize))

  return (
    <SettingsSection title="Appearance">
      <MessagePreview display={prefs.messageDisplay} fontSize={prefs.chatFontSize} />

      <div className="mt-8">
        <Heading>Theme</Heading>
        <div role="radiogroup" aria-label="Theme" className="mt-3 flex flex-wrap gap-4">
          {THEMES.map((t) => (
            <button
              key={t.value}
              type="button"
              role="radio"
              aria-checked={theme === t.value}
              onClick={() => setTheme(t.value)}
              className="flex flex-col items-center gap-2 rounded-md text-sm text-foreground"
            >
              <span
                className={cn(
                  "size-16 rounded-full border border-border",
                  t.swatch,
                  theme === t.value && "ring-2 ring-primary ring-offset-2 ring-offset-background"
                )}
              />
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-8">
        <Heading id="message-display">Message Display</Heading>
        <div role="radiogroup" aria-labelledby="message-display" className="mt-3 flex flex-col gap-2">
          {DISPLAYS.map((d) => {
            const selected = prefs.messageDisplay === d.value
            return (
              <button
                key={d.value}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => prefs.set({ messageDisplay: d.value })}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2.5 text-left",
                  selected ? "bg-item-selected" : "bg-sidebar hover:bg-item-hover"
                )}
              >
                <span
                  className={cn(
                    "flex size-5 shrink-0 items-center justify-center rounded-full border-2",
                    selected ? "border-primary" : "border-interactive"
                  )}
                >
                  {selected && <span className="size-2.5 rounded-full bg-primary" />}
                </span>
                <span>
                  <span className="block font-medium text-header">{d.label}</span>
                  <span className="block text-sm text-muted-foreground">{d.description}</span>
                </span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="mt-8">
        <Heading id="chat-font-scaling">Chat Font Scaling</Heading>
        <Slider
          thumbProps={{ "aria-labelledby": "chat-font-scaling", "aria-valuetext": `${prefs.chatFontSize}px` }}
          className="mt-5"
          min={0}
          max={CHAT_FONT_SIZES.length - 1}
          step={1}
          value={[sizeIndex]}
          onValueChange={([i]) => prefs.set({ chatFontSize: CHAT_FONT_SIZES[i] })}
        />
        <div aria-hidden className="mt-2 flex justify-between text-xs text-muted-foreground">
          {CHAT_FONT_SIZES.map((size) => (
            <span key={size} className={cn(size === DEFAULT_CHAT_FONT_SIZE && "font-semibold text-status-online")}>
              {size}px
            </span>
          ))}
        </div>
      </div>

      <div className="mt-8">
        <Heading>Accessibility</Heading>
        <SettingsToggle
          id="reduced-motion"
          label="Reduce Motion"
          description="Turn off animations and smooth scrolling. KTCord also follows your system's reduced motion setting."
          checked={prefs.reducedMotion}
          onCheckedChange={(reducedMotion) => prefs.set({ reducedMotion })}
        />
      </div>
    </SettingsSection>
  )
}
