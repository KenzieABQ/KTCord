import { AuthGate } from "@/components/auth/auth-gate"
import { AppDialogs } from "@/components/servers/app-dialogs"
import { RealtimeSync } from "@/lib/realtime/use-realtime-sync"

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGate>
      <RealtimeSync />
      {children}
      <AppDialogs />
    </AuthGate>
  )
}
