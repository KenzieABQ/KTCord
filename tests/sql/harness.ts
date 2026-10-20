import { randomUUID } from "node:crypto"
import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"

import { PGlite } from "@electric-sql/pglite"

const root = join(__dirname, "../..")

/** A fresh in-memory Postgres with the Supabase stand-ins and every migration applied. */
export async function createDb(): Promise<PGlite> {
  const db = new PGlite()
  await db.exec(readFileSync(join(__dirname, "supabase-stubs.sql"), "utf8"))
  const dir = join(root, "supabase/migrations")
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
    try {
      await db.exec(readFileSync(join(dir, file), "utf8"))
    } catch (error) {
      throw new Error(`${file}: ${(error as Error).message}`)
    }
  }
  return db
}

/** Signs a user up the way Supabase Auth does: an auth.users row whose trigger makes the profile. */
export async function signUp(db: PGlite, username: string): Promise<string> {
  const id = randomUUID()
  await db.query(
    "insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3)",
    [id, `${username}@example.test`, { username, display_name: username }]
  )
  return id
}

/**
 * Runs `fn` as a signed-in client (role `authenticated`, auth.uid() = userId), like a
 * PostgREST request. Pass null for an anonymous visitor.
 */
export async function as<T>(db: PGlite, userId: string | null, fn: () => Promise<T>): Promise<T> {
  await db.exec(userId ? "set role authenticated" : "set role anon")
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [userId ?? ""])
  try {
    return await fn()
  } finally {
    await db.exec("reset role")
    await db.query("select set_config('request.jwt.claim.sub', '', false)")
  }
}

/** Runs a query and returns its rows. */
export async function rows<T = Record<string, unknown>>(db: PGlite, sql: string, params: unknown[] = []) {
  return (await db.query<T>(sql, params)).rows
}

/** Runs a query that should fail and returns the error message. */
export async function failure(db: PGlite, sql: string, params: unknown[] = []): Promise<string> {
  try {
    await db.query(sql, params)
  } catch (error) {
    return (error as Error).message
  }
  throw new Error(`Expected this to fail: ${sql}`)
}
