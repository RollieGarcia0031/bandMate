# Feed algorithm

## Goal

The `/feed` page shows **public posts from other users** in a simple, deterministic order that already uses the two engagement tables we have today:

- `swipes`
- `feed_impressions`

This document describes the current implementation, why it exists, and what the supporting migrations must allow.

---

## Relevant database migrations

### Existing feed-related tables

1. `20260317134714_initial_tables.sql`
   - creates `posts`
   - creates `swipes`
   - establishes the core post/swipe schema used by discovery

2. `20260320020438_fix_public_post_visibility.sql`
   - enables authenticated users to `SELECT` public rows from `public.posts`
   - this is what makes cross-user feed post reads possible at the post table level

3. `20260320022917_feed_impression.sql`
   - adds `public.feed_impressions`
   - stores the first meaningful view of a post by a specific user
   - enforces one impression row per `(user_id, post_id)` pair

### New migration added for this feed update

4. `20260320031500_feed_read_access_and_swipes.sql`
   - enables RLS on `public.swipes`
   - lets authenticated users read/write only their own swipe rows
   - opens **read-only feed access** to the author metadata needed to render public posts:
     - `profiles`
     - `profile_photos`
     - `user_instruments`
     - `user_genres`

Without this additional migration, the app could read public posts but still could not reliably render the author details for those posts because those related tables were still owner-only.

---

## Current feed loading rules

The first version of the feed algorithm is intentionally simple.

### Step 1: build the candidate pool

Fetch up to 100 recent rows from `posts` where:

- `visibility = 'public'`
- `user_id != current_user_id`
- newest posts are fetched first by `created_at DESC`

This gives us the raw candidate pool. After filtering and ranking, the UI keeps the top 30 posts for display.

### Step 2: remove posts the user already swiped on

Query `swipes` for the authenticated user and drop any candidate post whose `post_id` already exists there.

**Effect:**
- a post disappears from the feed after the user likes or passes it
- `swipes` is currently treated as a hard exclusion signal

### Step 3: check whether the user has already seen each remaining post

Query `feed_impressions` for the authenticated user across the same candidate post ids.

**Effect:**
- if a post has no impression row, it is treated as **new/unseen**
- if a post has an impression row, it is treated as **seen before**

### Step 4: sort remaining posts

Sort with this priority:

1. unseen posts first
2. seen posts second
3. inside each group, newest posts first

That means the algorithm uses:

- `swipes` as a **hard filter**
- `feed_impressions` as a **soft ranking signal**

---

## Why this algorithm is a good starting point

This version is useful because it is:

- easy to reason about
- easy to debug from SQL
- deterministic for QA
- cheap to evolve later into a more advanced ranking model

It also matches current product expectations:

- swiped content should not keep resurfacing
- previously seen but unswiped content can still come back
- brand new content should be prioritized above already-viewed content

---

## Feed impression behavior

The client-side `useFeedImpressionTracker` hook writes a row to `feed_impressions` only after a card stays sufficiently visible for a minimum dwell time.

Current defaults:

- minimum intersection ratio: `0.6`
- minimum dwell time: `1500ms`

This means the feed ranking is based on **meaningful visibility**, not just because a card briefly entered the DOM.

---

## Swipe behavior

When a user taps **Like** or **Pass** on `/feed`:

1. the app writes a row into `swipes`
2. the post is optimistically removed from the current stack
3. future feed fetches exclude that post because `swipes` is part of candidate filtering

Both `like` and `pass` are currently terminal for feed inclusion.

---

## Data required to render each feed card

For each surviving post, the app loads:

- post fields from `posts`
- author identity/location fields from `profiles`
- author primary image from `profile_photos`
- author instruments from `user_instruments`
- author genres from `user_genres`

If a post does not have a thumbnail and the author does not have a profile photo, the UI falls back to a generated SVG placeholder so the card still renders cleanly.

---

## Known limitations

This algorithm is intentionally minimal. It does **not** yet consider:

- mutual likes or match probability
- collaborative filtering
- shared instruments/genres weighting
- geographic distance
- recency decay beyond newest-first sorting
- per-session diversity controls
- per-author caps
- follower-only visibility logic

Those can be layered in later once the basic data flow is proven.

---

## Future improvements

Good next steps would be:

1. move ranking into a SQL view or RPC for fewer client round trips
2. add author-level diversity so one user cannot dominate the first page
3. score by shared genres/instruments between viewer and author
4. support pagination/cursor loading
5. optionally allow old impressions to decay so long-unseen content can recover rank
