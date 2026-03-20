# Feed algorithm

## Goal

The `/feed` page shows **public posts from other users** in a simple, deterministic order that already uses the two engagement tables we have today:

- `swipes`
- `feed_impressions`

The current UI is intentionally minimal. Each feed card only renders:

- the author's `display_name`
- the post/video title
- the post like count
- the post video itself

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
   - opens read-only profile access for public-post authors so the feed can show `display_name`
   - opens read access to Storage objects referenced by public posts so the feed can create signed video playback URLs

Without this additional migration, the app could read public post rows but would still fail to either:

- load the author's display name, or
- load the actual video for many storage-backed posts

---

## Current feed loading rules

The first version of the feed algorithm is intentionally simple.

### Step 1: build the candidate pool

Fetch up to 100 recent rows from `posts` where:

- `visibility = 'public'`
- `user_id != current_user_id`
- newest posts are fetched first by `created_at DESC`

The loader only selects the fields that the current card design needs:

- `title`
- `video_url`
- `likes_count`
- author id
- timestamps used for ordering

After filtering and ranking, the UI keeps the top 30 posts for display.

### Step 2: remove posts the user already swiped on

Query `swipes` for the authenticated user and drop any candidate post whose `post_id` already exists there.

**Effect:**
- a post disappears from the feed after the user likes or passes it
- `swipes` is currently treated as a hard exclusion signal

### Step 3: check whether the user has already seen each remaining post

Query `feed_impressions` for the authenticated user across the same candidate post ids.

**Effect:**
- if a post has no impression row, it is treated as **new/unseen**
- if a post has an impression row, it is treated as **seen before** for ranking purposes only

### Step 4: sort remaining posts

Sort with this priority:

1. unseen posts first
2. seen posts second
3. inside each group, newest posts first

That means the algorithm uses:

- `swipes` as a **hard filter**
- `feed_impressions` as a **soft ranking signal**

### Step 5: resolve playable video URLs

For each ranked row:

- if `video_url` is already a full HTTP URL, use it directly
- otherwise treat it as a Supabase Storage path and create a signed URL from the `user-posts` bucket

This is what allows `/feed` to render the **actual uploaded video** instead of falling back to a profile image.

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

For each surviving post, the app now loads only:

- post title from `posts`
- post like count from `posts`
- post video from `posts.video_url`
- author display name from `profiles`

The feed deliberately hides descriptions and other profile metadata for now.

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
