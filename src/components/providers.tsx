"use client"

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { ThemeProvider } from "next-themes"
import { useEffect, useState, type ReactNode } from "react"

import { PrefsEffects } from "@/components/prefs-effects"
import { FeedbackHost } from "@/components/feedback/notices"
import { TooltipProvider } from "@/components/ui/tooltip"
import { ApiError } from "@/lib/api/errors"
import { useAuthStore } from "@/lib/stores/auth-store"
import { useVoiceStore } from "@/lib/stores/voice-store"
import { getSupabase } from "@/lib/supabase/client"
import { isSupabaseConfigured } from "@/lib/supabase/env"

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: false,
        // Permission and not-found errors won't fix themselves on retry.
        retry: (count, error) =>
          !(error instanceof ApiError && error.code && error.code !== "P0001") &&
          count < 2,
      },
    },
  })
}

/** Mirrors Supabase Auth into the auth store and clears cached data on sign-out. */
function AuthListener({ queryClient }: { queryClient: QueryClient }) {
  const setSession = useAuthStore((s) => s.setSession)

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setSession(null)
      return
    }
    const { data } = getSupabase().auth.onAuthStateChange((event, session) => {
      setSession(session)
      if (event === "SIGNED_OUT") {
        queryClient.clear()
        useVoiceStore.getState().leave()
      }
    })
    return () => data.subscription.unsubscribe()
  }, [queryClient, setSession])

  return null
}

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(makeQueryClient)

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem
      disableTransitionOnChange
    >
      <QueryClientProvider client={queryClient}>
        <TooltipProvider delayDuration={200}>
          <AuthListener queryClient={queryClient} />
          <PrefsEffects />
          {children}
          <FeedbackHost />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  )
}
