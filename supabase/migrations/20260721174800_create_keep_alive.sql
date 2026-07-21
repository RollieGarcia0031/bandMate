-- Migration: Create keep_alive table to prevent Supabase project pausing
CREATE TABLE IF NOT EXISTS public.keep_alive (
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.keep_alive ENABLE ROW LEVEL SECURITY;
