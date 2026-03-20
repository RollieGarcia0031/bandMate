-- =============================================================================
-- Migration: Feed read access and swipe policies for cross-user discovery
-- Created: 2026-03-20
-- =============================================================================
-- The /feed experience needs to show public posts from other musicians and let
-- authenticated viewers react to them. The feed UI now only renders the post
-- video plus the author's display name/title/likes, so the cross-user access
-- here is intentionally limited to those exact data dependencies.

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
-- Feed read policies: only expose author names for users who already have at
-- least one public post. This keeps cross-user profile reads narrow and
-- read-only while allowing the feed to label videos correctly.
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

-- =============================================================================
-- Storage: feed viewers need read access to videos referenced by public posts so
-- the client can create signed playback URLs for those rows.
-- =============================================================================
DROP POLICY IF EXISTS storage_user_posts_select_public_feed ON storage.objects;
CREATE POLICY storage_user_posts_select_public_feed
ON storage.objects
FOR SELECT
TO authenticated
USING (
    bucket_id = public.user_posts_bucket()
    AND EXISTS (
        SELECT 1
        FROM public.posts
        WHERE posts.visibility = 'public'
          AND posts.video_url = name
    )
);
