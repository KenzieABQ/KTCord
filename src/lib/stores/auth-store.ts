import type { Session } from "@supabase/supabase-js"
import { create } from "zustand"

type AuthStatus = "loading" | "signed-in" | "signed-out"

type AuthState = {
  status: AuthStatus
  session: Session | null
  userId: string | null
  setSession: (session: Session | null) => void
}

export const useAuthStore = create<AuthState>()((set) => ({
  status: "loading",
  session: null,
  userId: null,
  setSession: (session) =>
    set({
      session,
      userId: session?.user.id ?? null,
      status: session ? "signed-in" : "signed-out",
    }),
}))

/** The signed-in user's id. Only call this inside <AuthGate>, which guarantees a session. */
export function useUserId(): string {
  const userId = useAuthStore((s) => s.userId)
  if (!userId) throw new Error("useUserId() called outside <AuthGate>")
  return userId
}
