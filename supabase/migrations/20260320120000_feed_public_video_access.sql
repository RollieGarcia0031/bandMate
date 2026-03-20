-- =============================================================================
-- Migration: Public feed video/profile read access for authenticated users
-- Created: 2026-03-20
-- =============================================================================
-- The temporary /feed implementation loads every public post together with the
-- creator display name and the uploaded video object. These policies keep the
-- write path owner-scoped while granting authenticated readers the minimum
-- access required to render public feed cards.

DROP POLICY IF EXISTS profiles_select_public_post_authors ON public.profiles;
CREATE POLICY profiles_select_public_post_authors
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
        WHERE posts.video_url = storage.objects.name
          AND posts.visibility = 'public'
    )
);
