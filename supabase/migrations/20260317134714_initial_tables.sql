-- =============================================================================
-- Migration: Music Collaboration / Matching App Schema for Supabase
-- Created: March 2025 (adapted 2026)
-- =============================================================================

-- =============================================================================
-- 0. Helper function: update_updated_at
-- =============================================================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- 1. Lookup / Reference tables
-- =============================================================================

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

-- =============================================================================
-- 2. Profiles (replaces custom users table – links to auth.users)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.profiles (
    id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Basic identity
    username        VARCHAR(50) UNIQUE NOT NULL,
    display_name    VARCHAR(100) NOT NULL,

    -- Profile details
    bio             TEXT,
    age             SMALLINT CHECK (age >= 13),
    gender          VARCHAR(20),           -- Male, Female, Non-binary, Other, Prefer not to say...
    latitude        DECIMAL(10,8),
    longitude       DECIMAL(11,8),
    city            VARCHAR(100),

    -- Music related
    experience_years SMALLINT,
    spotify_url     TEXT,
    soundcloud_url  TEXT,
    youtube_url     TEXT,
    looking_for     TEXT[],                 -- e.g. '{band,jam_session,recording,gig,producer}'

    -- Status / soft delete
    last_active     TIMESTAMPTZ DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ,

    -- Timestamps
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-update updated_at
CREATE TRIGGER trig_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================================================
-- 3. Profile photos (ordered)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.profile_photos (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    url         TEXT NOT NULL,                  -- storage path or external CDN url
    "order"     SMALLINT NOT NULL DEFAULT 0,    -- 0 = primary photo
    uploaded_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_user_photo_order UNIQUE (user_id, "order")
);

-- =============================================================================
-- 4. Many-to-many relationships
-- =============================================================================

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

-- =============================================================================
-- 5. Posts (short videos / audio clips / ideas)
-- =============================================================================

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

-- =============================================================================
-- 6. Swipes → Matches → Conversations → Messages
-- =============================================================================

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

-- =============================================================================
-- 7. Collaborative Projects
-- =============================================================================

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

-- =============================================================================
-- Optional: Auto-create profile row when new user signs up
-- =============================================================================

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
-- End of schema
-- =============================================================================

-- Tip: After running this migration, go to Authentication → Policies
-- and enable Row Level Security + create appropriate policies.
