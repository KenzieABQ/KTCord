"use client"

import { useTheme } from "next-themes"

import { SettingsSection, SettingsToggle } from "@/components/settings/settings-layout"
import { Slider } from "@/components/ui/slider"
import {
  ACCENT_PRESETS,
  CHAT_FONT_SIZES,
  DEFAULT_CHAT_FONT_SIZE,
  DEFAULT_GROUP_SPACING,
  GROUP_SPACINGS,
  usePrefsStore,
  type DarkPalette,
  type MessageDisplay,
} from "@/lib/stores/prefs-store"
import { RefreshCwIcon } from "@/components/icons"
import { cn } from "@/lib/utils"

/** Discord's themes: Light, three dark palettes, or follow the computer. */
const THEMES: { id: string; label: string; theme: string; palette?: DarkPalette; swatch: string }[] = [
  { id: "light", label: "Light", theme: "light", swatch: "#ffffff" },
  { id: "ash", label: "Ash", theme: "dark", palette: "ash", swatch: "#313338" },
  { id: "dark", label: "Dark", theme: "dark", palette: "dark", swatch: "#1e1f22" },
  { id: "onyx", label: "Onyx", theme: "dark", palette: "onyx", swatch: "#000000" },
  // Follows the computer: shown as just the sync arrows.
  { id: "system", label: "Sync", theme: "system", swatch: "var(--item-selected)" },
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
        <div key={i} className={cn("relative pr-4 pl-[72px]", line.head && i > 0 && (display === "compact" ? "mt-1.5" : "mt-(--group-spacing)"))}>
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
          {THEMES.map((t) => {
            const selected = theme === t.theme && (t.palette === undefined || prefs.darkPalette === t.palette)
            return (
              <button
                key={t.id}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => {
                  setTheme(t.theme)
                  if (t.palette) prefs.set({ darkPalette: t.palette })
                }}
                className="flex flex-col items-center gap-2 rounded-md text-sm text-foreground"
              >
                <span
                  className={cn(
                    "relative flex size-14 items-center justify-center overflow-hidden rounded-full border border-border",
                    selected && "ring-2 ring-primary ring-offset-2 ring-offset-chat"
                  )}
                  style={{ background: t.swatch }}
                >
                  {t.id === "system" && (
                    <RefreshCwIcon className="size-7 text-header" />
                  )}
                </span>
                {t.label}
              </button>
            )
          })}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Onyx is true black, easy on OLED screens. Sync uses your dark palette when your computer is in dark mode.
        </p>
      </div>

      <div className="mt-8">
        <Heading id="accent-color">Accent Color</Heading>
        <div role="radiogroup" aria-labelledby="accent-color" className="mt-3 flex flex-wrap items-center gap-2">
          {ACCENT_PRESETS.map((preset) => {
            const selected = prefs.accentColor.toLowerCase() === preset.color
            return (
              <button
                key={preset.name}
                type="button"
                role="radio"
                aria-checked={selected}
                aria-label={preset.name}
                title={preset.name}
                onClick={() => prefs.set({ accentColor: preset.color })}
                className={cn(
                  "size-9 rounded-full ring-offset-2 ring-offset-background transition-transform hover:scale-105",
                  selected && "ring-2 ring-foreground"
                )}
                style={{ backgroundColor: preset.color || "#5865f2" }}
              />
            )
          })}
          <label
            title="Custom color"
            className="relative flex size-9 cursor-pointer items-center justify-center overflow-hidden rounded-full border border-dashed border-muted-foreground/60 text-sm text-muted-foreground"
          >
            <span aria-hidden>+</span>
            <input
              type="color"
              aria-label="Custom accent color"
              className="absolute inset-0 cursor-pointer opacity-0"
              value={prefs.accentColor || "#5865f2"}
              onChange={(e) => prefs.set({ accentColor: e.target.value })}
            />
          </label>
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
        <Heading id="group-spacing">Space Between Message Groups</Heading>
        <Slider
          thumbProps={{ "aria-labelledby": "group-spacing", "aria-valuetext": `${prefs.groupSpacing}px` }}
          className="mt-5"
          min={0}
          max={GROUP_SPACINGS.length - 1}
          step={1}
          value={[Math.max(0, GROUP_SPACINGS.findIndex((v) => v === prefs.groupSpacing))]}
          onValueChange={([i]) => prefs.set({ groupSpacing: GROUP_SPACINGS[i] })}
        />
        <div aria-hidden className="mt-2 flex justify-between text-xs text-muted-foreground">
          {GROUP_SPACINGS.map((v) => (
            <span key={v} className={cn(v === DEFAULT_GROUP_SPACING && "font-semibold text-status-online")}>
              {v}px
            </span>
          ))}
        </div>
      </div>

      <div className="mt-8">
        <Heading>Text &amp; Images</Heading>
        <SettingsToggle
          id="link-previews"
          label="Show embeds and preview website links pasted into chat"
          description="Links show a preview with the page's title, description and image. Images load through KTCord, so sites don't see your IP address."
          checked={prefs.linkPreviews}
          onCheckedChange={(linkPreviews) => prefs.set({ linkPreviews })}
        />
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
