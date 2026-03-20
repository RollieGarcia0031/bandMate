-- =============================================================================
-- Migration: Feed impression tracking for /feed visibility analytics
-- Created: 2026-03-20
-- =============================================================================
-- This migration stores first-seen feed impressions so the app can record when
-- an authenticated user meaningfully views a post in /feed. The current product
-- behavior only needs first-seen tracking, so the table enforces one row per
-- (user_id, post_id) pair and lets the client ignore duplicate inserts.

CREATE TABLE IF NOT EXISTS public.feed_impressions (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    post_id     UUID NOT NULL,
    seen_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    dwell_ms    INTEGER,
    session_id  TEXT,
    source      TEXT NOT NULL DEFAULT 'feed',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT feed_impressions_user_post_unique UNIQUE (user_id, post_id),
    CONSTRAINT feed_impressions_dwell_ms_nonnegative CHECK (dwell_ms IS NULL OR dwell_ms >= 0),
    CONSTRAINT feed_impressions_source_not_blank CHECK (char_length(trim(source)) > 0)
);

CREATE INDEX IF NOT EXISTS feed_impressions_post_id_seen_at_idx
    ON public.feed_impressions (post_id, seen_at DESC);

CREATE INDEX IF NOT EXISTS feed_impressions_user_id_seen_at_idx
    ON public.feed_impressions (user_id, seen_at DESC);

ALTER TABLE public.feed_impressions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS feed_impressions_select_own ON public.feed_impressions;
CREATE POLICY feed_impressions_select_own
ON public.feed_impressions
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS feed_impressions_insert_own ON public.feed_impressions;
CREATE POLICY feed_impressions_insert_own
ON public.feed_impressions
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);
