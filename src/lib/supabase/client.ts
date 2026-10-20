import { createBrowserClient } from "@supabase/ssr"
import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database } from "./database.types"
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "./env"

export type TypedSupabaseClient = SupabaseClient<Database>

let client: TypedSupabaseClient | undefined

/** The browser Supabase client. One instance per tab, so Realtime shares one socket. */
export function getSupabase(): TypedSupabaseClient {
  client ??= createBrowserClient<Database>(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY
  )
  return client
}
