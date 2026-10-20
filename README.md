# KTCord

Real-time community chat inspired by Discord: servers, channels, roles, DMs, threads and voice.
Built with Next.js 16, shadcn/ui and Supabase (Postgres + RLS, Realtime, Storage, Auth).

## Set up

1. **Create a Supabase project** (the free tier is fine).
2. **Environment:** copy `.env.example` to `.env.local` and fill in the project URL and the
   publishable (or anon) key from *Project Settings → API*. `SUPABASE_SECRET_KEY` is only used
   by the dev seed script and DB tests.
3. **Auth settings** (*Authentication → URL Configuration*): set the Site URL to
   `http://localhost:3000`. For local development, turning off *Confirm email* under
   *Authentication → Sign In / Providers → Email* saves waiting on the rate-limited mailer.
4. **Apply migrations.** Log the CLI in once (it opens a browser), then apply and regenerate types.
   `db:migrate` goes through the Management API, so it doesn't need the database password:

   ```bash
   npx supabase login
   npm run db:migrate
   npm run db:types
   ```

5. **Run it:**

   ```bash
   npm install
   npm run dev
   ```

   Open http://localhost:3000.

## Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Dev server |
| `npm run build` | Production build |
| `npm run typecheck` | TypeScript, no emit |
| `npm run lint` | ESLint |
| `npm test` | Vitest unit tests |
| `npm run test:db` | RLS/RPC integration tests against the dev project (creates and deletes test users) |
| `npm run db:migrate` | Apply pending `supabase/migrations` to the project in `.env.local` |
| `npm run db:types` | Regenerate `src/lib/supabase/database.types.ts` |

## Architecture

| Layer | Where | Notes |
| --- | --- | --- |
| Database | `supabase/migrations` | Tables, RLS policies, permission helpers and RPCs. All authorization lives here. |
| Data access | `src/lib/api` | Typed wrappers over Supabase queries and RPCs. Throw `ApiError` with user-facing messages. |
| Server cache | `src/lib/queries` | TanStack Query hooks and keys (`qk`). |
| Client state | `src/lib/stores` | Zustand stores for auth, UI panels, voice controls and (later) unread, typing and presence. |
| Real-time | `src/lib/realtime` | Subscriptions that patch the query cache and stores (Milestone 3). |
| Views | `src/components`, `src/app` | `proxy.ts` refreshes the session and keeps signed-out users on `/login`. |

Next 16 has Cache Components on, so components that read the URL render inside a
`<Suspense>` boundary. The chat shell's fallback is the skeleton layout.
