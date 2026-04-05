# Supabase Storage cache-control policy

BandMate now serves public Supabase Storage assets through a Next.js proxy route:

- Route: `/api/storage/public/:bucket/:path*`
- Source of truth implementation:
  - `app/api/storage/public/[bucket]/[...objectPath]/route.ts`
  - `lib/supabase/storage-cache-control.ts`

## Policy

### 1) Versioned URLs (`?v=` query) or content-hashed object paths

Use a long-lived immutable cache policy:

- `Cache-Control: public, max-age=31536000, immutable`

This is applied when either condition is true:

- Request URL has a `v` query parameter, or
- Request pathname looks content-hashed (e.g. `avatar.abcd1234.png`, `image-9f3a67c2.webp`)

### 2) Non-versioned URLs

Use a short TTL policy:

- `Cache-Control: public, max-age=300, stale-while-revalidate=60`

This keeps stale-avatar risk low while still giving the browser/CDN a small reuse window.

## Avatar URL construction contract

All primary avatar URL construction paths now use `resolveProfilePhotoUrl(...)` to ensure:

1. Existing `?v=` cache-busting semantics are preserved.
2. Supabase-hosted assets are normalized to the proxy route so cache headers are consistent.
3. External non-Supabase image URLs keep their original host and only get optional `?v=` appended.

Updated call sites:

- `hooks/use-profile.ts`
- `lib/profile/current-user-profile.ts`
- `app/(authenticated)/inbox/page.tsx`
- `app/(authenticated)/inbox/[id]/page.tsx`

## Next.js image optimization decision

`next.config.mjs` was updated to enable the default optimized image pipeline (removed `unoptimized: true`) and to allow remote hosts used by BandMate:

- Supabase project host (`NEXT_PUBLIC_SUPABASE_URL`) for storage objects
- `images.unsplash.com`

This improves browser/CDN cache reuse **when** surfaces render with `next/image`.

> Note: Several avatar surfaces still use CSS `background-image` or plain `<img>`, so they won't use the optimizer until migrated to `<Image />`.
