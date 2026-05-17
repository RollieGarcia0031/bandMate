-- =============================================================================
-- Migration: Combined Initialization for BandMate Project
-- Consolidates: all migrations from 2026-03-17 to 2026-03-22
-- Includes: Storage bucket creation
-- =============================================================================

-- =============================================================================
-- 0. Storage Buckets Initialization
-- =============================================================================
INSERT INTO storage.buckets (id, name, public)
VALUES
  ('profile-photos', 'profile-photos', true),
  ('user-posts', 'user-posts', false)
ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- 1. Initial Tables (20260317134714_initial_tables.sql)
-- =============================================================================

-- Helper function: update_updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Lookup / Reference tables
CREATE TABLE IF NOT EXISTS public.instruments (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        VARCHAR(50) UNIQUE NOT NULL,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.genres (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        VARCHAR(50) UNIQUE NOT NULL,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Profiles
CREATE TABLE IF NOT EXISTS public.profiles (
    id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username        VARCHAR(50) UNIQUE NOT NULL,
    display_name    VARCHAR(100) NOT NULL,
    bio             TEXT,
    age             SMALLINT CHECK (age >= 13),
    gender          VARCHAR(20),
    latitude        DECIMAL(10,8),
    longitude       DECIMAL(11,8),
    city            VARCHAR(100),
    experience_years SMALLINT,
    spotify_url     TEXT,
    soundcloud_url  TEXT,
    youtube_url     TEXT,
    looking_for     TEXT[],
    last_active     TIMESTAMPTZ DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER trig_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Profile photos
CREATE TABLE IF NOT EXISTS public.profile_photos (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    url         TEXT NOT NULL,
    "order"     SMALLINT NOT NULL DEFAULT 0,
    uploaded_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_user_photo_order UNIQUE (user_id, "order")
);

-- Many-to-many relationships
CREATE TABLE IF NOT EXISTS public.user_instruments (
    user_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    instrument_id   UUID NOT NULL REFERENCES public.instruments(id) ON DELETE CASCADE,
    proficiency     VARCHAR(20) DEFAULT 'Intermediate'
        CHECK (proficiency IN ('Beginner', 'Intermediate', 'Advanced', 'Pro')),
    PRIMARY KEY (user_id, instrument_id)
);

CREATE TABLE IF NOT EXISTS public.user_genres (
    user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    genre_id    UUID NOT NULL REFERENCES public.genres(id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, genre_id)
);

-- Posts
CREATE TABLE IF NOT EXISTS public.posts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    title           VARCHAR(120),
    description     TEXT,
    video_url       TEXT NOT NULL,
    thumbnail_url   TEXT,
    duration_sec    SMALLINT,
    visibility      VARCHAR(20) DEFAULT 'public'
        CHECK (visibility IN ('public', 'followers', 'private')),
    likes_count     INTEGER DEFAULT 0,
    comments_count  INTEGER DEFAULT 0,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER trig_posts_updated_at
    BEFORE UPDATE ON public.posts
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Swipes / Matches / Conversations / Messages
CREATE TABLE IF NOT EXISTS public.swipes (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    post_id     UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
    direction   VARCHAR(10) NOT NULL
        CHECK (direction IN ('like', 'pass', 'superlike')),
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (user_id, post_id)
);

CREATE TABLE IF NOT EXISTS public.matches (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user1_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    user2_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    CHECK (user1_id < user2_id),
    UNIQUE (user1_id, user2_id)
);

CREATE TABLE IF NOT EXISTS public.conversations (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    match_id    UUID UNIQUE REFERENCES public.matches(id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.messages (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
    sender_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    content         TEXT NOT NULL,
    media_url       TEXT,
    sent_at         TIMESTAMPTZ DEFAULT NOW(),
    read_at         TIMESTAMPTZ
);

-- Collaborative Projects
CREATE TABLE IF NOT EXISTS public.projects (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title       VARCHAR(100) NOT NULL,
    description TEXT,
    created_by  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    status      VARCHAR(20) DEFAULT 'active'
        CHECK (status IN ('draft','active','completed','archived')),
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER trig_projects_updated_at
    BEFORE UPDATE ON public.projects
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.project_members (
    project_id  UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    role        VARCHAR(50),
    joined_at   TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (project_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.project_files (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id  UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    uploaded_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    filename    VARCHAR(255),
    url         TEXT NOT NULL,
    file_type   VARCHAR(20)
        CHECK (file_type IN ('audio','sheet','video','lyrics','other')),
    title       VARCHAR(100),
    uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-create profile row when new user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, username, display_name)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'username', 'user_' || LEFT(NEW.id::text, 8)),
        COALESCE(NEW.raw_user_meta_data->>'full_name', 'New Musician')
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- =============================================================================
-- 2. Profile Updates (20260319000558_profile_update.sql)
-- =============================================================================

ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS birthday DATE,
    ADD COLUMN IF NOT EXISTS experience_level VARCHAR(20);

UPDATE public.profiles
SET birthday = (CURRENT_DATE - make_interval(years => age::INTEGER))::DATE
WHERE birthday IS NULL
  AND age IS NOT NULL;

UPDATE public.profiles
SET gender = NULL
WHERE gender IS NOT NULL
  AND gender NOT IN ('Male', 'Female', 'Other', 'Prefer not to say');

UPDATE public.profiles
SET experience_level = 'Intermediate'
WHERE experience_level IS NULL
  AND experience_years IS NOT NULL;

UPDATE public.profiles
SET looking_for = ARRAY(
    SELECT value
    FROM unnest(looking_for) AS value
    WHERE value IN (
        'Form a band',
        'Collaborate',
        'Jam sessions',
        'Find a teacher',
        'Teach',
        'Tour & perform'
    )
)
WHERE looking_for IS NOT NULL;

ALTER TABLE public.profiles
    DROP CONSTRAINT IF EXISTS profiles_age_check,
    DROP CONSTRAINT IF EXISTS profiles_gender_check,
    DROP CONSTRAINT IF EXISTS profiles_experience_years_check,
    DROP CONSTRAINT IF EXISTS profiles_experience_level_check,
    DROP CONSTRAINT IF EXISTS profiles_birthday_check,
    DROP CONSTRAINT IF EXISTS profiles_looking_for_check;

ALTER TABLE public.profiles
    ADD CONSTRAINT profiles_birthday_check
        CHECK (
            birthday IS NULL
            OR (
                birthday <= (CURRENT_DATE - INTERVAL '13 years')::DATE
                AND birthday >= DATE '1900-01-01'
            )
        ),
    ADD CONSTRAINT profiles_gender_check
        CHECK (
            gender IS NULL
            OR gender IN ('Male', 'Female', 'Other', 'Prefer not to say')
        ),
    ADD CONSTRAINT profiles_experience_years_check
        CHECK (experience_years IS NULL OR experience_years >= 0),
    ADD CONSTRAINT profiles_experience_level_check
        CHECK (
            experience_level IS NULL
            OR experience_level IN ('Beginner', 'Intermediate', 'Expert')
        ),
    ADD CONSTRAINT profiles_looking_for_check
        CHECK (
            looking_for IS NULL
            OR looking_for <@ ARRAY[
                'Form a band',
                'Collaborate',
                'Jam sessions',
                'Find a teacher',
                'Teach',
                'Tour & perform'
            ]::TEXT[]
        );

ALTER TABLE public.profiles
    DROP COLUMN IF EXISTS age;


-- =============================================================================
-- 3. Row Level Security & Storage Functions (20260319013111, 20260320020000)
-- =============================================================================

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

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_instruments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_genres ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.instruments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.genres ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;

-- Profiles policies
DROP POLICY IF EXISTS profiles_select_own ON public.profiles;
CREATE POLICY profiles_select_own ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);

DROP POLICY IF EXISTS profiles_insert_own ON public.profiles;
CREATE POLICY profiles_insert_own ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS profiles_update_own ON public.profiles;
CREATE POLICY profiles_update_own ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- Profile photos policies
DROP POLICY IF EXISTS profile_photos_select_own ON public.profile_photos;
CREATE POLICY profile_photos_select_own ON public.profile_photos FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS profile_photos_insert_own ON public.profile_photos;
CREATE POLICY profile_photos_insert_own ON public.profile_photos FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS profile_photos_update_own ON public.profile_photos;
CREATE POLICY profile_photos_update_own ON public.profile_photos FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS profile_photos_delete_own ON public.profile_photos;
CREATE POLICY profile_photos_delete_own ON public.profile_photos FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- user_instruments / user_genres
DROP POLICY IF EXISTS user_instruments_select_own ON public.user_instruments;
CREATE POLICY user_instruments_select_own ON public.user_instruments FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS user_instruments_insert_own ON public.user_instruments;
CREATE POLICY user_instruments_insert_own ON public.user_instruments FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS user_instruments_delete_own ON public.user_instruments;
CREATE POLICY user_instruments_delete_own ON public.user_instruments FOR DELETE TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS user_genres_select_own ON public.user_genres;
CREATE POLICY user_genres_select_own ON public.user_genres FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS user_genres_insert_own ON public.user_genres;
CREATE POLICY user_genres_insert_own ON public.user_genres FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS user_genres_delete_own ON public.user_genres;
CREATE POLICY user_genres_delete_own ON public.user_genres FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Lookup tables
CREATE POLICY instruments_select_authenticated ON public.instruments FOR SELECT TO authenticated USING (true);
CREATE POLICY instruments_insert_authenticated ON public.instruments FOR INSERT TO authenticated WITH CHECK (char_length(trim(name)) > 0);
CREATE POLICY instruments_update_authenticated ON public.instruments FOR UPDATE TO authenticated USING (true) WITH CHECK (char_length(trim(name)) > 0);

CREATE POLICY genres_select_authenticated ON public.genres FOR SELECT TO authenticated USING (true);
CREATE POLICY genres_insert_authenticated ON public.genres FOR INSERT TO authenticated WITH CHECK (char_length(trim(name)) > 0);
CREATE POLICY genres_update_authenticated ON public.genres FOR UPDATE TO authenticated USING (true) WITH CHECK (char_length(trim(name)) > 0);

-- Posts policies
DROP POLICY IF EXISTS posts_select_public_feed ON public.posts;
CREATE POLICY posts_select_public_feed ON public.posts FOR SELECT TO authenticated USING (visibility = 'public');

DROP POLICY IF EXISTS posts_insert_own ON public.posts;
CREATE POLICY posts_insert_own ON public.posts FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS posts_update_own ON public.posts;
CREATE POLICY posts_update_own ON public.posts FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS posts_delete_own ON public.posts;
CREATE POLICY posts_delete_own ON public.posts FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Storage policies (profile-photos)
DROP POLICY IF EXISTS storage_profile_photos_select_own ON storage.objects;
CREATE POLICY storage_profile_photos_select_own ON storage.objects FOR SELECT TO authenticated USING (bucket_id = public.settings_profile_photos_bucket() AND (storage.foldername(name))[1] = auth.uid()::TEXT);

DROP POLICY IF EXISTS storage_profile_photos_insert_own ON storage.objects;
CREATE POLICY storage_profile_photos_insert_own ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = public.settings_profile_photos_bucket() AND (storage.foldername(name))[1] = auth.uid()::TEXT);

DROP POLICY IF EXISTS storage_profile_photos_update_own ON storage.objects;
CREATE POLICY storage_profile_photos_update_own ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = public.settings_profile_photos_bucket() AND (storage.foldername(name))[1] = auth.uid()::TEXT) WITH CHECK (bucket_id = public.settings_profile_photos_bucket() AND (storage.foldername(name))[1] = auth.uid()::TEXT);

DROP POLICY IF EXISTS storage_profile_photos_delete_own ON storage.objects;
CREATE POLICY storage_profile_photos_delete_own ON storage.objects FOR DELETE TO authenticated USING (bucket_id = public.settings_profile_photos_bucket() AND (storage.foldername(name))[1] = auth.uid()::TEXT);

-- Storage policies (user-posts)
DROP POLICY IF EXISTS storage_user_posts_select_own ON storage.objects;
CREATE POLICY storage_user_posts_select_own ON storage.objects FOR SELECT TO authenticated USING (bucket_id = public.user_posts_bucket() AND (storage.foldername(name))[1] = auth.uid()::TEXT);

DROP POLICY IF EXISTS storage_user_posts_insert_own ON storage.objects;
CREATE POLICY storage_user_posts_insert_own ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = public.user_posts_bucket() AND (storage.foldername(name))[1] = auth.uid()::TEXT);

DROP POLICY IF EXISTS storage_user_posts_update_own ON storage.objects;
CREATE POLICY storage_user_posts_update_own ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = public.user_posts_bucket() AND (storage.foldername(name))[1] = auth.uid()::TEXT) WITH CHECK (bucket_id = public.user_posts_bucket() AND (storage.foldername(name))[1] = auth.uid()::TEXT);

DROP POLICY IF EXISTS storage_user_posts_delete_own ON storage.objects;
CREATE POLICY storage_user_posts_delete_own ON storage.objects FOR DELETE TO authenticated USING (bucket_id = public.user_posts_bucket() AND (storage.foldername(name))[1] = auth.uid()::TEXT);


-- =============================================================================
-- 4. Feed & Impressions (20260320093529_remote_schema.sql)
-- =============================================================================

DROP TABLE IF EXISTS public.feed_impressions CASCADE;
CREATE TABLE public.feed_impressions (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
    seen_at timestamp with time zone NOT NULL DEFAULT now(),
    dwell_ms integer CHECK (dwell_ms IS NULL OR dwell_ms >= 0),
    session_id text,
    source text NOT NULL DEFAULT 'feed'::text CHECK (char_length(TRIM(BOTH FROM source)) > 0),
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    PRIMARY KEY (id),
    UNIQUE (user_id, post_id)
);

CREATE INDEX feed_impressions_post_id_seen_at_idx ON public.feed_impressions (post_id, seen_at DESC);
CREATE INDEX feed_impressions_user_id_seen_at_idx ON public.feed_impressions (user_id, seen_at DESC);

ALTER TABLE public.feed_impressions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.swipes ENABLE ROW LEVEL SECURITY;

CREATE POLICY feed_impressions_insert_own ON public.feed_impressions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY feed_impressions_select_own ON public.feed_impressions FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY swipes_delete_own ON public.swipes FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY swipes_insert_own ON public.swipes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY swipes_select_own ON public.swipes FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY swipes_update_own ON public.swipes FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY profile_photos_select_feed_public_post_authors ON public.profile_photos FOR SELECT TO authenticated USING (EXISTS ( SELECT 1 FROM public.posts WHERE ((posts.user_id = profile_photos.user_id) AND ((posts.visibility)::text = 'public'::text)))));
CREATE POLICY profiles_select_feed_public_post_authors ON public.profiles FOR SELECT TO authenticated USING (EXISTS ( SELECT 1 FROM public.posts WHERE ((posts.user_id = profiles.id) AND ((posts.visibility)::text = 'public'::text)))));
CREATE POLICY user_genres_select_feed_public_post_authors ON public.user_genres FOR SELECT TO authenticated USING (EXISTS ( SELECT 1 FROM public.posts WHERE ((posts.user_id = user_genres.user_id) AND ((posts.visibility)::text = 'public'::text)))));
CREATE POLICY user_instruments_select_feed_public_post_authors ON public.user_instruments FOR SELECT TO authenticated USING (EXISTS ( SELECT 1 FROM public.posts WHERE ((posts.user_id = user_instruments.user_id) AND ((posts.visibility)::text = 'public'::text)))));


-- =============================================================================
-- 5. Public Feed Storage Access (20260320120000_feed_public_video_access.sql)
-- =============================================================================

CREATE POLICY storage_user_posts_select_public_feed ON storage.objects FOR SELECT TO authenticated USING (bucket_id = public.user_posts_bucket() AND EXISTS ( SELECT 1 FROM public.posts WHERE ((posts.video_url = objects.name) AND ((posts.visibility)::text = 'public'::text)))));


-- =============================================================================
-- 6. Reactions & Matching Synchronization (20260320133000_sync_post_reaction_counts.sql)
-- =============================================================================

ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS dislikes_count integer NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.apply_post_swipe_delta(target_post_id uuid, swipe_direction text, delta integer)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF swipe_direction = 'like' THEN
    UPDATE public.posts SET likes_count = greatest(coalesce(likes_count, 0) + delta, 0) WHERE id = target_post_id;
  ELSIF swipe_direction = 'pass' THEN
    UPDATE public.posts SET dislikes_count = greatest(coalesce(dislikes_count, 0) + delta, 0) WHERE id = target_post_id;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_match_for_users(first_user_id uuid, second_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  ordered_user1 uuid;
  ordered_user2 uuid;
  first_user_liked_second boolean;
  second_user_liked_first boolean;
BEGIN
  IF first_user_id IS NULL OR second_user_id IS NULL OR first_user_id = second_user_id THEN
    RETURN;
  END IF;
  ordered_user1 := least(first_user_id, second_user_id);
  ordered_user2 := greatest(first_user_id, second_user_id);
  SELECT exists(SELECT 1 FROM public.swipes AS swipes JOIN public.posts AS posts ON posts.id = swipes.post_id WHERE swipes.user_id = first_user_id AND swipes.direction = 'like' AND posts.user_id = second_user_id) INTO first_user_liked_second;
  SELECT exists(SELECT 1 FROM public.swipes AS swipes JOIN public.posts AS posts ON posts.id = swipes.post_id WHERE swipes.user_id = second_user_id AND swipes.direction = 'like' AND posts.user_id = first_user_id) INTO second_user_liked_first;
  IF first_user_liked_second AND second_user_liked_first THEN
    INSERT INTO public.matches (user1_id, user2_id) VALUES (ordered_user1, ordered_user2) ON CONFLICT (user1_id, user2_id) DO NOTHING;
  ELSE
    DELETE FROM public.matches WHERE user1_id = ordered_user1 AND user2_id = ordered_user2;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_post_reactions_and_matches_from_swipes()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  old_post_owner_id uuid;
  new_post_owner_id uuid;
BEGIN
  IF tg_op IN ('UPDATE', 'DELETE') THEN SELECT posts.user_id INTO old_post_owner_id FROM public.posts AS posts WHERE posts.id = old.post_id; END IF;
  IF tg_op IN ('INSERT', 'UPDATE') THEN SELECT posts.user_id INTO new_post_owner_id FROM public.posts AS posts WHERE posts.id = new.post_id; END IF;
  IF tg_op = 'INSERT' THEN
    PERFORM public.apply_post_swipe_delta(new.post_id, new.direction, 1);
    PERFORM public.sync_match_for_users(new.user_id, new_post_owner_id);
    RETURN new;
  ELSIF tg_op = 'UPDATE' THEN
    PERFORM public.apply_post_swipe_delta(old.post_id, old.direction, -1);
    PERFORM public.apply_post_swipe_delta(new.post_id, new.direction, 1);
    PERFORM public.sync_match_for_users(old.user_id, old_post_owner_id);
    IF old.user_id IS DISTINCT FROM new.user_id OR old_post_owner_id IS DISTINCT FROM new_post_owner_id THEN
      PERFORM public.sync_match_for_users(new.user_id, new_post_owner_id);
    END IF;
    RETURN new;
  END IF;
  PERFORM public.apply_post_swipe_delta(old.post_id, old.direction, -1);
  PERFORM public.sync_match_for_users(old.user_id, old_post_owner_id);
  RETURN old;
END;
$$;

DROP TRIGGER IF EXISTS trig_swipes_sync_post_reactions_and_matches ON public.swipes;
CREATE TRIGGER trig_swipes_sync_post_reactions_and_matches AFTER INSERT OR UPDATE OR DELETE ON public.swipes FOR EACH ROW EXECUTE FUNCTION public.sync_post_reactions_and_matches_from_swipes();


-- =============================================================================
-- 7. Block Self Swipes (20260320143000_block_self_swipes.sql)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.reject_self_swipes()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  post_owner_id uuid;
BEGIN
  SELECT posts.user_id INTO post_owner_id FROM public.posts AS posts WHERE posts.id = new.post_id;
  IF post_owner_id IS NULL THEN RAISE EXCEPTION 'Cannot create a swipe for a missing post (%).', new.post_id; END IF;
  IF new.user_id = post_owner_id THEN RAISE EXCEPTION 'Users cannot swipe on their own posts.'; END IF;
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS trig_swipes_reject_self_swipes ON public.swipes;
CREATE TRIGGER trig_swipes_reject_self_swipes BEFORE INSERT OR UPDATE ON public.swipes FOR EACH ROW EXECUTE FUNCTION public.reject_self_swipes();


-- =============================================================================
-- 8. Final RLS & Realtime (20260322170300, 20260322175500)
-- =============================================================================

-- Enable RLS for chat and project tables
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_files ENABLE ROW LEVEL SECURITY;

-- matches: users can see matches they are part of
DROP POLICY IF EXISTS matches_select_own ON public.matches;
CREATE POLICY matches_select_own ON public.matches
FOR SELECT TO authenticated USING (auth.uid() = user1_id OR auth.uid() = user2_id);

-- conversations: users can see conversations linked to their matches
DROP POLICY IF EXISTS conversations_select_own ON public.conversations;
CREATE POLICY conversations_select_own ON public.conversations
FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.matches WHERE public.matches.id = match_id AND (user1_id = auth.uid() OR user2_id = auth.uid())));

-- messages: users can read and send messages in their conversations
DROP POLICY IF EXISTS messages_select_own ON public.messages;
CREATE POLICY messages_select_own ON public.messages
FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.conversations c JOIN public.matches m ON c.match_id = m.id WHERE c.id = conversation_id AND (m.user1_id = auth.uid() OR m.user2_id = auth.uid())));

DROP POLICY IF EXISTS messages_insert_own ON public.messages;
CREATE POLICY messages_insert_own ON public.messages
FOR INSERT TO authenticated WITH CHECK (auth.uid() = sender_id AND EXISTS (SELECT 1 FROM public.conversations c JOIN public.matches m ON c.match_id = m.id WHERE c.id = conversation_id AND (m.user1_id = auth.uid() OR m.user2_id = auth.uid())));

-- projects: owners can manage, members can see
DROP POLICY IF EXISTS projects_select_own ON public.projects;
CREATE POLICY projects_select_own ON public.projects
FOR SELECT TO authenticated USING (created_by = auth.uid() OR EXISTS (SELECT 1 FROM public.project_members WHERE project_id = id AND user_id = auth.uid()));

DROP POLICY IF EXISTS projects_insert_authenticated ON public.projects;
CREATE POLICY projects_insert_authenticated ON public.projects
FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);

DROP POLICY IF EXISTS projects_update_own ON public.projects;
CREATE POLICY projects_update_own ON public.projects
FOR UPDATE TO authenticated USING (auth.uid() = created_by) WITH CHECK (auth.uid() = created_by);

DROP POLICY IF EXISTS projects_delete_own ON public.projects;
CREATE POLICY projects_delete_own ON public.projects
FOR DELETE TO authenticated USING (auth.uid() = created_by);

-- project_members: members of the same project can see each other
DROP POLICY IF EXISTS project_members_select_own ON public.project_members;
CREATE POLICY project_members_select_own ON public.project_members
FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.project_members pm WHERE pm.project_id = project_id AND pm.user_id = auth.uid()));

-- project_files: members of the project can see files
DROP POLICY IF EXISTS project_files_select_own ON public.project_files;
CREATE POLICY project_files_select_own ON public.project_files
FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.project_members WHERE project_id = public.project_files.project_id AND user_id = auth.uid()));

CREATE POLICY "swipes_select_post_owners" ON "public"."swipes" AS PERMISSIVE FOR SELECT TO authenticated USING (EXISTS ( SELECT 1 FROM public.posts WHERE posts.id = swipes.post_id AND posts.user_id = auth.uid() ));

-- Enable real-time for the messages table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
  END IF;
END $$;
