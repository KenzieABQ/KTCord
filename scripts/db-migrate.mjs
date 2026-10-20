#!/usr/bin/env node
// Applies pending supabase/migrations/*.sql to the project in .env.local through the
// Supabase Management API (needs `npx supabase login`, but not the database password).
// Applied versions are recorded in supabase_migrations.schema_migrations, the same table
// `supabase db push` uses, so the two stay interchangeable.

import { execFileSync } from "node:child_process"
import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"

import { config } from "dotenv"

config({ path: ".env.local", quiet: true })

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
if (!url) {
  console.error("NEXT_PUBLIC_SUPABASE_URL is missing from .env.local")
  process.exit(1)
}
const projectRef = new URL(url).hostname.split(".")[0]
const dir = "supabase/migrations"

function query(sqlOrFile, { file = false } = {}) {
  const args = ["supabase", "db", "query", "--project-ref", projectRef, "-o", "json"]
  args.push(...(file ? ["-f", sqlOrFile] : [sqlOrFile]))
  const out = execFileSync("npx", args, { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] })
  try {
    return JSON.parse(out)
  } catch {
    return out
  }
}

query(`
  create schema if not exists supabase_migrations;
  create table if not exists supabase_migrations.schema_migrations (
    version text primary key,
    statements text[],
    name text
  );
`)

const appliedRows = query("select version from supabase_migrations.schema_migrations")
const applied = new Set(
  (Array.isArray(appliedRows) ? appliedRows : (appliedRows?.rows ?? [])).map((r) => r.version)
)

const pending = readdirSync(dir)
  .filter((f) => /^\d+_.+\.sql$/.test(f))
  .sort()
  .filter((f) => !applied.has(f.split("_")[0]))

if (pending.length === 0) {
  console.log("Database is up to date.")
  process.exit(0)
}

for (const file of pending) {
  const [version, ...rest] = file.replace(/\.sql$/, "").split("_")
  const name = rest.join("_")
  process.stdout.write(`Applying ${file} … `)
  query(join(dir, file), { file: true })
  const sql = readFileSync(join(dir, file), "utf8").replaceAll("'", "''")
  query(
    `insert into supabase_migrations.schema_migrations (version, name, statements)
     values ('${version}', '${name}', array['${sql}'])`
  )
  console.log("done")
}
