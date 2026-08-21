# AGENTS.md

Next.js 16 App Router + React 19 + TypeScript + Tailwind v4 + shadcn/ui + Supabase (auth, Postgres, storage). Single package, npm.

## Commands

```bash
npm run dev        # dev server on :3000
npm run build      # production build
npx tsc --noEmit   # the real typecheck gate
```

- **Do not trust `npm run build` to catch type errors**: `next.config.mjs` sets `typescript.ignoreBuildErrors: true`. Run `npx tsc --noEmit`.
- **`npm run lint` fails out of the box**: ESLint is referenced in scripts but not installed/configured.
- There are no tests and no test framework.

## Environment

- `.env` is required (copy from `.env.example`). All Supabase env vars go through `lib/supabase/env.ts`, which throws at runtime if missing — including in `proxy.ts`, so the app 500s on every request without them.
- `NEXT_PUBLIC_SUPABASE_PROFILE_PHOTOS_BUCKET=profile-photos`, `NEXT_PUBLIC_SUPABASE_USER_POSTS_BUCKET=user-posts`.

## Architecture

- **Middleware is `proxy.ts`** (repo root), not `middleware.ts` — Next.js 16 renamed it. It gates auth: `/feed /inbox /me /search /settings` require login; logged-in users hitting `/`, `/login`, `/signup` are redirected to `/feed`.
- Authed pages live in the `app/(authenticated)/` route group with a shared layout. Mutations use Server Actions in sibling `actions.ts` files (e.g. `inbox/actions.ts`, `settings/actions.ts`).
- Three Supabase clients in `lib/supabase/`: `client.ts` (browser), `server.ts` (RSC/actions, cookie session), `admin.ts` (service role — server only, never import client-side).
- Server-side reads are cached via `lib/cache.ts` (`unstable_cache` wrapper with key/tag helpers). After mutations, call the matching `revalidate*Tag` helper or stale data persists.
- Path alias `@/*` maps to repo root.

## Database (Supabase)

- Schema source of truth: `supabase/migrations/00000000000000_first_migration.sql` (all tables, RLS, buckets consolidated into this one file). New changes = new timestamped migration file in `supabase/migrations/`.
- Apply with `npx supabase db push` after `npx supabase link --project-ref <ref>` (see `docs/SETUP.md`). The project is linked to a remote Supabase instance, not run locally.
- `docs/database.md` documents the schema well but references pre-consolidation migration filenames that no longer exist.

## UI conventions

- Tailwind v4: **no `tailwind.config` file** — theme tokens/CSS variables live in `app/globals.css`.
- shadcn/ui "new-york" style; primitives in `components/ui/` (add via `npx shadcn@latest add <component>`). App-specific components in `components/app/` and `components/landing/`.

## Misc

- `/api/keep-alive` (plus an alias route at `/keep-alive`) is pinged daily by `.github/workflows/keep-alive.yml` to prevent Supabase free-tier pausing; auth via `KEEP_ALIVE_TOKEN`.
- Git history uses conventional commits (`feat:`, `fix:`) via PRs from `feature/...` / `fix/...` branches.
