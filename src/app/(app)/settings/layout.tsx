"use client"

import { SettingsLayout, type SettingsNavGroup } from "@/components/settings/settings-layout"

const NAV: SettingsNavGroup[] = [
  {
    heading: "User Settings",
    items: [
      { href: "/settings/account", label: "My Account" },
      { href: "/settings/profile", label: "Profiles" },
    ],
  },
  {
    heading: "App Settings",
    items: [
      { href: "/settings/appearance", label: "Appearance" },
      { href: "/settings/notifications", label: "Notifications" },
      { href: "/settings/keybinds", label: "Keybinds" },
    ],
  },
]

export default function UserSettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <SettingsLayout nav={NAV} closeHref="/channels/me" showLogOut>
      {children}
    </SettingsLayout>
  )
}
