import { isSupabaseConfigured } from "@/lib/supabase/env"

/** Developer hint shown on the auth screens until .env.local is filled in. */
export function SetupNotice() {
  if (isSupabaseConfigured) return null
  return (
    <div className="w-full rounded-md border border-status-idle/40 bg-status-idle/10 p-3 text-sm text-foreground">
      <p className="font-semibold">Supabase isn&apos;t configured yet.</p>
      <p className="mt-1 text-muted-foreground">
        Copy <code className="font-mono">.env.example</code> to{" "}
        <code className="font-mono">.env.local</code>, add your project URL and
        publishable key, then restart the dev server.
      </p>
    </div>
  )
}
