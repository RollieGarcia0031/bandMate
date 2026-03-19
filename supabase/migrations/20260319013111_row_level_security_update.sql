-- =============================================================================
-- Migration: Row level security updates for settings/profile writes
-- Created: 2026-03-19
-- =============================================================================
-- This migration enables the policies required by the authenticated settings
-- flow. The settings page reads and writes the current user's profile row,
-- primary profile photo row, selected instruments/genres, and uploads profile
-- pictures into Supabase Storage under a user-scoped folder.
--
-- If your Storage bucket name is not `profile-photos`, set the Postgres config
-- value `app.settings_profile_photos_bucket` in your Supabase project so the
-- storage policies target the correct bucket without repeating the name across
-- policy definitions.

CREATE OR REPLACE FUNCTION public.settings_profile_photos_bucket()
RETURNS TEXT
LANGUAGE SQL
STABLE
AS $$
    SELECT COALESCE(
        NULLIF(current_setting('app.settings_profile_photos_bucket', true), ''),
        'profile-photos'
    );
$$;

COMMENT ON FUNCTION public.settings_profile_photos_bucket() IS
    'Returns the Storage bucket used for settings profile photos. Override with the app.settings_profile_photos_bucket Postgres setting when your bucket name differs.';

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_instruments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_genres ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.instruments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.genres ENABLE ROW LEVEL SECURITY;

-- `storage.objects` is managed by Supabase's storage schema and is already RLS-
-- protected in hosted projects. `supabase db push` runs migrations with a role
-- that can create policies there but does not own the table, so attempting to
-- re-run `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` fails with SQLSTATE 42501.

-- =============================================================================
-- profiles: each authenticated user can read and edit only their own profile.
-- =============================================================================
DROP POLICY IF EXISTS profiles_select_own ON public.profiles;
CREATE POLICY profiles_select_own
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = id);

DROP POLICY IF EXISTS profiles_insert_own ON public.profiles;
CREATE POLICY profiles_insert_own
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS profiles_update_own ON public.profiles;
CREATE POLICY profiles_update_own
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- =============================================================================
-- profile_photos: users manage only their own ordered photo rows.
-- =============================================================================
DROP POLICY IF EXISTS profile_photos_select_own ON public.profile_photos;
CREATE POLICY profile_photos_select_own
ON public.profile_photos
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS profile_photos_insert_own ON public.profile_photos;
CREATE POLICY profile_photos_insert_own
ON public.profile_photos
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS profile_photos_update_own ON public.profile_photos;
CREATE POLICY profile_photos_update_own
ON public.profile_photos
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS profile_photos_delete_own ON public.profile_photos;
CREATE POLICY profile_photos_delete_own
ON public.profile_photos
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- =============================================================================
-- user_instruments / user_genres: users can replace only their own join rows.
-- =============================================================================
DROP POLICY IF EXISTS user_instruments_select_own ON public.user_instruments;
CREATE POLICY user_instruments_select_own
ON public.user_instruments
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS user_instruments_insert_own ON public.user_instruments;
CREATE POLICY user_instruments_insert_own
ON public.user_instruments
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS user_instruments_delete_own ON public.user_instruments;
CREATE POLICY user_instruments_delete_own
ON public.user_instruments
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS user_genres_select_own ON public.user_genres;
CREATE POLICY user_genres_select_own
ON public.user_genres
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS user_genres_insert_own ON public.user_genres;
CREATE POLICY user_genres_insert_own
ON public.user_genres
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS user_genres_delete_own ON public.user_genres;
CREATE POLICY user_genres_delete_own
ON public.user_genres
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- =============================================================================
-- Lookup tables: authenticated users can read options, and the current settings
-- save flow may upsert names before attaching the join rows.
-- =============================================================================
DROP POLICY IF EXISTS instruments_select_authenticated ON public.instruments;
CREATE POLICY instruments_select_authenticated
ON public.instruments
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS instruments_insert_authenticated ON public.instruments;
CREATE POLICY instruments_insert_authenticated
ON public.instruments
FOR INSERT
TO authenticated
WITH CHECK (char_length(trim(name)) > 0);

DROP POLICY IF EXISTS instruments_update_authenticated ON public.instruments;
CREATE POLICY instruments_update_authenticated
ON public.instruments
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (char_length(trim(name)) > 0);

DROP POLICY IF EXISTS genres_select_authenticated ON public.genres;
CREATE POLICY genres_select_authenticated
ON public.genres
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS genres_insert_authenticated ON public.genres;
CREATE POLICY genres_insert_authenticated
ON public.genres
FOR INSERT
TO authenticated
WITH CHECK (char_length(trim(name)) > 0);

DROP POLICY IF EXISTS genres_update_authenticated ON public.genres;
CREATE POLICY genres_update_authenticated
ON public.genres
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (char_length(trim(name)) > 0);

-- =============================================================================
-- Storage: users can manage only files inside their own folder for the bucket
-- configured by public.settings_profile_photos_bucket(). The upload path used by
-- the settings UI is `${auth.uid()}/profile.<ext>`.
-- =============================================================================
DROP POLICY IF EXISTS storage_profile_photos_select_own ON storage.objects;
CREATE POLICY storage_profile_photos_select_own
ON storage.objects
FOR SELECT
TO authenticated
USING (
    bucket_id = public.settings_profile_photos_bucket()
    AND (storage.foldername(name))[1] = auth.uid()::TEXT
);

DROP POLICY IF EXISTS storage_profile_photos_insert_own ON storage.objects;
CREATE POLICY storage_profile_photos_insert_own
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = public.settings_profile_photos_bucket()
    AND (storage.foldername(name))[1] = auth.uid()::TEXT
);

DROP POLICY IF EXISTS storage_profile_photos_update_own ON storage.objects;
CREATE POLICY storage_profile_photos_update_own
ON storage.objects
FOR UPDATE
TO authenticated
USING (
    bucket_id = public.settings_profile_photos_bucket()
    AND (storage.foldername(name))[1] = auth.uid()::TEXT
)
WITH CHECK (
    bucket_id = public.settings_profile_photos_bucket()
    AND (storage.foldername(name))[1] = auth.uid()::TEXT
);

DROP POLICY IF EXISTS storage_profile_photos_delete_own ON storage.objects;
CREATE POLICY storage_profile_photos_delete_own
ON storage.objects
FOR DELETE
TO authenticated
USING (
    bucket_id = public.settings_profile_photos_bucket()
    AND (storage.foldername(name))[1] = auth.uid()::TEXT
);
