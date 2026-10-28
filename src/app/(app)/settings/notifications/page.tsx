"use client"

import { toast } from "@/lib/toast"

import { SettingsSection, SettingsToggle } from "@/components/settings/settings-layout"
import { Button } from "@/components/ui/button"
import { useNotificationPermission } from "@/hooks/use-notification-permission"
import { playNotificationSound } from "@/lib/sound"
import { usePrefsStore } from "@/lib/stores/prefs-store"

export default function NotificationSettingsPage() {
  const prefs = usePrefsStore()
  const { permission, request } = useNotificationPermission()

  async function setDesktop(enabled: boolean) {
    if (enabled && permission === "default") {
      const result = await request()
      if (result !== "granted") {
        toast.error("Notifications weren't allowed. You can change this in your browser's site settings.")
        return
      }
    }
    prefs.set({ desktopNotifications: enabled })
  }

  function sendTest() {
    if (permission === "granted") {
      new Notification("KTCord", { body: "This is what notifications look like.", tag: "ktcord-test" })
    } else {
      toast.dm({
        authorId: "ktcord",
        author: "KTCord",
        avatarUrl: null,
        place: "Direct Message",
        preview: "This is what a new direct message looks like.",
        onOpen: () => {},
      })
    }
    if (prefs.notificationSound) playNotificationSound()
  }

  const desktopDescription =
    permission === "unsupported"
      ? "This browser doesn't support desktop notifications."
      : permission === "denied"
        ? "Notifications are blocked for this site. Allow them in your browser's site settings, then come back."
        : "Get notified about new messages while KTCord is in the background."

  return (
    <SettingsSection
      title="Notifications"
      description="These settings apply to this device. Choose which servers and channels notify you from each server's menu."
    >
      <SettingsToggle
        id="desktop-notifications"
        label="Enable Desktop Notifications"
        description={desktopDescription}
        checked={prefs.desktopNotifications && permission === "granted"}
        disabled={permission === "unsupported" || permission === "denied"}
        onCheckedChange={(checked) => void setDesktop(checked)}
      />
      <SettingsToggle
        id="in-app-toasts"
        label="Direct Message Pop-ups"
        description="Show a card when someone sends you a direct message while KTCord is open."
        checked={prefs.inAppToasts}
        onCheckedChange={(inAppToasts) => prefs.set({ inAppToasts })}
      />
      <SettingsToggle
        id="notification-sound"
        label="Notification Sound"
        description="Play a short chime with each notification."
        checked={prefs.notificationSound}
        onCheckedChange={(notificationSound) => {
          prefs.set({ notificationSound })
          if (notificationSound) playNotificationSound()
        }}
      />
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Button variant="secondary" onClick={sendTest}>
          Send a Test Notification
        </Button>
        <p className="text-sm text-muted-foreground">
          Do Not Disturb silences all notifications, whatever these settings say.
        </p>
      </div>
    </SettingsSection>
  )
}
