import { AuthGate } from "@/components/auth/auth-gate"
import { AppDialogs } from "@/components/servers/app-dialogs"
import { VoiceSync } from "@/components/voice/voice-sync"
import { RealtimeSync } from "@/lib/realtime/use-realtime-sync"

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGate>
      <RealtimeSync />
      <VoiceSync />
      {children}
      <AppDialogs />
    </AuthGate>
  )
}
