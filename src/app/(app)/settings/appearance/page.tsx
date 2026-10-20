"use client"

import { useTheme } from "next-themes"

import { SettingsSection } from "@/components/settings/settings-layout"
import { cn } from "@/lib/utils"

const THEMES = [
  { value: "dark", label: "Dark", swatch: "bg-[#313338]" },
  { value: "light", label: "Light", swatch: "bg-white" },
  { value: "system", label: "Sync with computer", swatch: "bg-[linear-gradient(135deg,#fff_50%,#313338_50%)]" },
]

export default function AppearanceSettingsPage() {
  const { theme, setTheme } = useTheme()

  return (
    <SettingsSection title="Appearance">
      <h2 className="text-xs font-bold tracking-wide text-muted-foreground uppercase">Theme</h2>
      <div role="radiogroup" aria-label="Theme" className="mt-3 flex flex-wrap gap-4">
        {THEMES.map((t) => (
          <button
            key={t.value}
            type="button"
            role="radio"
            aria-checked={theme === t.value}
            onClick={() => setTheme(t.value)}
            className="flex flex-col items-center gap-2 text-sm text-foreground"
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
    </SettingsSection>
  )
}
