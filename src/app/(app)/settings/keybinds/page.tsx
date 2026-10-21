"use client"

import { ShortcutList } from "@/components/layout/shortcuts-dialog"
import { SettingsSection } from "@/components/settings/settings-layout"

export default function KeybindSettingsPage() {
  return (
    <SettingsSection
      title="Keybinds"
      description="Shortcuts that work anywhere in KTCord. Press Ctrl+/ (⌘/ on Mac) to see these at any time."
    >
      <ShortcutList />
    </SettingsSection>
  )
}
