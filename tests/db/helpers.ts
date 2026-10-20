import { randomBytes, randomUUID } from "node:crypto"

import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import { config } from "dotenv"

import type { Database } from "../../src/lib/supabase/database.types"

config({ path: ".env.local", quiet: true })

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? ""
const secretKey = process.env.SUPABASE_SECRET_KEY ?? ""

/** DB tests talk to the real (dev) project, so they only run when asked to. */
export const dbTestsEnabled = process.env.RUN_DB_TESTS === "1" && Boolean(url && anonKey && secretKey)

const noSession = { auth: { persistSession: false, autoRefreshToken: false } }

/** Service-role client: bypasses RLS. Only for setup and cleanup. */
export const admin = createClient<Database>(url || "http://localhost", secretKey || "x", noSession)

export type TestUser = { id: string; username: string; client: SupabaseClient<Database> }

const created: string[] = []

/** Creates a confirmed user (no email is sent) and returns a client signed in as them. */
export async function createTestUser(label: string): Promise<TestUser> {
  const suffix = randomBytes(4).toString("hex")
  const username = `t_${label}_${suffix}`.slice(0, 32)
  const email = `ktcord-test-${username}@example.com`
  const password = `Test-${randomUUID()}`

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { username, display_name: label },
  })
  if (error || !data.user) throw error ?? new Error("createUser failed")
  created.push(data.user.id)

  const client = createClient<Database>(url, anonKey, noSession)
  const { error: signInError } = await client.auth.signInWithPassword({ email, password })
  if (signInError) throw signInError
  return { id: data.user.id, username, client }
}

/** Deletes every user made by createTestUser (cascades to their profiles and owned servers). */
export async function cleanupTestUsers() {
  await Promise.all(created.splice(0).map((id) => admin.auth.admin.deleteUser(id)))
}
