-- =============================================================================
-- Migration: Authenticated post uploads and personal post library policies
-- Created: 2026-03-20
-- =============================================================================
-- This migration wires the /posts page to Supabase by allowing authenticated
-- users to insert, read, update, and delete only their own post rows, while
-- also scoping Storage access to a dedicated user-posts bucket.
--
-- If your Storage bucket name is not `user-posts`, set the Postgres config
-- value `app.user_posts_bucket` in your Supabase project so these policies keep
-- working without editing SQL in multiple places.

CREATE OR REPLACE FUNCTION public.user_posts_bucket()
RETURNS TEXT
LANGUAGE SQL
STABLE
AS $$
    SELECT COALESCE(
        NULLIF(current_setting('app.user_posts_bucket', true), ''),
        'user-posts'
    );
$$;

COMMENT ON FUNCTION public.user_posts_bucket() IS
    'Returns the Storage bucket used for uploaded user posts. Override with the app.user_posts_bucket Postgres setting when your bucket name differs.';

ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- posts: write operations stay owner-scoped, while feed reads for public posts
-- use a dedicated policy so follower-only access can be added later in a
-- separate policy or RPC instead of expanding owner-only rules.
-- =============================================================================
DROP POLICY IF EXISTS posts_select_own ON public.posts;
DROP POLICY IF EXISTS posts_select_public_feed ON public.posts;
CREATE POLICY posts_select_public_feed
ON public.posts
FOR SELECT
TO authenticated
USING (visibility = 'public');

DROP POLICY IF EXISTS posts_insert_own ON public.posts;
CREATE POLICY posts_insert_own
ON public.posts
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS posts_update_own ON public.posts;
CREATE POLICY posts_update_own
ON public.posts
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS posts_delete_own ON public.posts;
CREATE POLICY posts_delete_own
ON public.posts
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- =============================================================================
-- Storage: users can manage only videos inside their own folder for the bucket
-- configured by public.user_posts_bucket(). The upload path used by the posts
-- UI is `${auth.uid()}/<uuid>.<ext>`.
-- =============================================================================
DROP POLICY IF EXISTS storage_user_posts_select_own ON storage.objects;
CREATE POLICY storage_user_posts_select_own
ON storage.objects
FOR SELECT
TO authenticated
USING (
    bucket_id = public.user_posts_bucket()
    AND (storage.foldername(name))[1] = auth.uid()::TEXT
);

DROP POLICY IF EXISTS storage_user_posts_insert_own ON storage.objects;
CREATE POLICY storage_user_posts_insert_own
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = public.user_posts_bucket()
    AND (storage.foldername(name))[1] = auth.uid()::TEXT
);

DROP POLICY IF EXISTS storage_user_posts_update_own ON storage.objects;
CREATE POLICY storage_user_posts_update_own
ON storage.objects
FOR UPDATE
TO authenticated
USING (
    bucket_id = public.user_posts_bucket()
    AND (storage.foldername(name))[1] = auth.uid()::TEXT
)
WITH CHECK (
    bucket_id = public.user_posts_bucket()
    AND (storage.foldername(name))[1] = auth.uid()::TEXT
);

DROP POLICY IF EXISTS storage_user_posts_delete_own ON storage.objects;
CREATE POLICY storage_user_posts_delete_own
ON storage.objects
FOR DELETE
TO authenticated
USING (
    bucket_id = public.user_posts_bucket()
    AND (storage.foldername(name))[1] = auth.uid()::TEXT
);
