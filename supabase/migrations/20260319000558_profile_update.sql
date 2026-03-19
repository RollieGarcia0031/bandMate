-- =============================================================================
-- Migration: Align profiles schema with settings page profile fields
-- Created: 2026-03-19
-- =============================================================================

-- The settings page stores a birthday, not a mutable age value. This migration
-- makes birthday the source of truth and adds guardrails around other profile
-- fields that are edited on /settings.

ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS birthday DATE,
    ADD COLUMN IF NOT EXISTS experience_level VARCHAR(20);

-- Preserve existing age data as an approximate birthday so old rows do not lose
-- age information entirely. Users can later replace this with their exact date.
UPDATE public.profiles
SET birthday = (CURRENT_DATE - make_interval(years => age::INTEGER))::DATE
WHERE birthday IS NULL
  AND age IS NOT NULL;

-- Normalize values before adding stricter checks.
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
