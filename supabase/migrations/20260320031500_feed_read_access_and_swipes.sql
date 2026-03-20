-- =============================================================================
-- Migration: Feed read access and swipe policies for cross-user discovery
-- Created: 2026-03-20
-- =============================================================================
-- The /feed experience needs to show public posts from other musicians, which
-- means authenticated users must be able to read a limited subset of cross-user
-- profile metadata for authors who already chose to publish a public post.
--
-- The same surface also needs to read and write the current viewer's own swipe
-- rows so the feed can skip posts that were already liked/passed.

ALTER TABLE public.swipes ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- swipes: viewers can read/write only their own reactions.
-- =============================================================================
DROP POLICY IF EXISTS swipes_select_own ON public.swipes;
CREATE POLICY swipes_select_own
ON public.swipes
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS swipes_insert_own ON public.swipes;
CREATE POLICY swipes_insert_own
ON public.swipes
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS swipes_update_own ON public.swipes;
CREATE POLICY swipes_update_own
ON public.swipes
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS swipes_delete_own ON public.swipes;
CREATE POLICY swipes_delete_own
ON public.swipes
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- =============================================================================
-- Feed read policies: only expose metadata for users who already have at least
-- one public post. These policies intentionally stay read-only and narrow in
-- scope so future follower/private feed rules can build on top.
-- =============================================================================
DROP POLICY IF EXISTS profiles_select_feed_public_post_authors ON public.profiles;
CREATE POLICY profiles_select_feed_public_post_authors
ON public.profiles
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.posts
        WHERE posts.user_id = profiles.id
          AND posts.visibility = 'public'
    )
);

DROP POLICY IF EXISTS profile_photos_select_feed_public_post_authors ON public.profile_photos;
CREATE POLICY profile_photos_select_feed_public_post_authors
ON public.profile_photos
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.posts
        WHERE posts.user_id = profile_photos.user_id
          AND posts.visibility = 'public'
    )
);

DROP POLICY IF EXISTS user_instruments_select_feed_public_post_authors ON public.user_instruments;
CREATE POLICY user_instruments_select_feed_public_post_authors
ON public.user_instruments
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.posts
        WHERE posts.user_id = user_instruments.user_id
          AND posts.visibility = 'public'
    )
);

DROP POLICY IF EXISTS user_genres_select_feed_public_post_authors ON public.user_genres;
CREATE POLICY user_genres_select_feed_public_post_authors
ON public.user_genres
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.posts
        WHERE posts.user_id = user_genres.user_id
          AND posts.visibility = 'public'
    )
);
