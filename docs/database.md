# BandMate Database Model (Source of Truth: Applied Migrations)

This document explains the database model defined in:

- `supabase/migrations/20260317134714_initial_tables.sql`
- `supabase/migrations/20260319000558_profile_update.sql`

It focuses on what the SQL migrations currently enforce, especially for the `public.profiles` table that powers the `/settings` page.

## Scope and Core Principle

- Application user identity is stored in `auth.users`.
- App-facing profile data is stored in `public.profiles`.
- `public.profiles.id` is both:
  - the primary key of `profiles`, and
  - a foreign key to `auth.users(id)` with `ON DELETE CASCADE`.

So the model is effectively **Auth User 1 → 1 Profile**.

---

## Entities and Relationships

## 1) Reference tables

### `instruments`
- Purpose: canonical instrument list.
- Columns:
  - `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
  - `name VARCHAR(50) UNIQUE NOT NULL`
  - `created_at TIMESTAMPTZ DEFAULT NOW()`

### `genres`
- Purpose: canonical genre list.
- Columns:
  - `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
  - `name VARCHAR(50) UNIQUE NOT NULL`
  - `created_at TIMESTAMPTZ DEFAULT NOW()`

---

## 2) User profile aggregate

### `profiles`
- Purpose: public/user-editable profile data tied to auth identity.
- Primary key and foreign key:
  - `id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE`
- Key identity fields:
  - `username VARCHAR(50) UNIQUE NOT NULL`
  - `display_name VARCHAR(100) NOT NULL`
- Additional profile fields:
  - `bio TEXT`
  - `birthday DATE`
    - enforced as either `NULL` or a value from `1900-01-01` through at least 13 years before the current date
    - this replaces the old stored `age` column as the source of truth for age-related UI
  - `gender VARCHAR(20)`
    - allowed values: `Male`, `Female`, `Other`, `Prefer not to say`
  - `latitude DECIMAL(10,8)`
  - `longitude DECIMAL(11,8)`
  - `city VARCHAR(100)`
  - `experience_years SMALLINT`
    - must be `NULL` or `>= 0`
  - `experience_level VARCHAR(20)`
    - allowed values: `Beginner`, `Intermediate`, `Expert`
  - `spotify_url TEXT`
  - `soundcloud_url TEXT`
  - `youtube_url TEXT`
  - `looking_for TEXT[]`
    - each value must be one of:
      - `Form a band`
      - `Collaborate`
      - `Jam sessions`
      - `Find a teacher`
      - `Teach`
      - `Tour & perform`
  - `last_active TIMESTAMPTZ DEFAULT NOW()`
  - `deleted_at TIMESTAMPTZ`
  - `created_at TIMESTAMPTZ DEFAULT NOW()`
  - `updated_at TIMESTAMPTZ DEFAULT NOW()`

### Profile/settings mapping
The `/settings` page currently edits these `profiles` columns directly or conceptually:

- `username`
- `display_name`
- `bio`
- `birthday`
- `gender`
- `city`
- `experience_years`
- `experience_level`
- `youtube_url`
- `spotify_url`
- `looking_for`

Notes:
- The UI should derive a display age from `birthday` rather than persisting a separate `age` value.
- Instruments and genres selected on `/settings` belong in `user_instruments` and `user_genres`, not as columns on `profiles`.
- Profile pictures are represented by `profile_photos`, not a dedicated `avatar_url` column on `profiles`.

### Auto-maintenance
- Trigger `trig_profiles_updated_at` calls `public.update_updated_at_column()` before update.
- This guarantees `updated_at` refresh on row updates.

---

## 3) Profile media and preference links

### `profile_photos`
- Purpose: ordered photos per profile.
- Columns:
  - `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
  - `user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE`
  - `url TEXT NOT NULL`
  - `order SMALLINT NOT NULL DEFAULT 0` (quoted as `"order"` in SQL)
  - `uploaded_at TIMESTAMPTZ DEFAULT NOW()`
- Constraint:
  - `UNIQUE (user_id, order)`
- Effect:
  - a user can have multiple photos, but each order slot is unique per user.

### `user_instruments` (join table)
- Purpose: many-to-many between profiles and instruments + skill level.
- Keys:
  - `PRIMARY KEY (user_id, instrument_id)`
- Foreign keys:
  - `user_id → profiles(id) ON DELETE CASCADE`
  - `instrument_id → instruments(id) ON DELETE CASCADE`
- Domain rule:
  - `proficiency` must be one of `Beginner | Intermediate | Advanced | Pro`

### `user_genres` (join table)
- Purpose: many-to-many between profiles and genres.
- Keys:
  - `PRIMARY KEY (user_id, genre_id)`
- Foreign keys:
  - `user_id → profiles(id) ON DELETE CASCADE`
  - `genre_id → genres(id) ON DELETE CASCADE`

---

## 4) Social content and discovery flow

### `posts`
- Purpose: user posts (video-first in current schema).
- Columns:
  - `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
  - `user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE`
  - `title VARCHAR(120)`
  - `description TEXT`
  - `video_url TEXT NOT NULL`
  - `thumbnail_url TEXT`
  - `duration_sec SMALLINT`
  - `visibility VARCHAR(20) DEFAULT 'public'`
  - `likes_count INTEGER DEFAULT 0`
  - `comments_count INTEGER DEFAULT 0`
  - `created_at TIMESTAMPTZ DEFAULT NOW()`
  - `updated_at TIMESTAMPTZ DEFAULT NOW()`
- Constraint:
  - `visibility IN ('public', 'followers', 'private')`
- Trigger:
  - `trig_posts_updated_at` updates `updated_at` on row update.
- Authenticated `/posts` page integration:
  - uploads store videos in the Supabase Storage bucket configured by `app.user_posts_bucket` (default `user-posts`) under `<auth.uid()>/<uuid>.<ext>`.
  - row-level security policies limit post row and storage object access to the owning authenticated user.

### `swipes`
- Purpose: reaction from a user to a post.
- Columns:
  - `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
  - `user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE`
  - `post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE`
  - `direction VARCHAR(10) NOT NULL`
  - `created_at TIMESTAMPTZ DEFAULT NOW()`
- Constraints:
  - `direction IN ('like', 'pass', 'superlike')`
  - `UNIQUE (user_id, post_id)`
- Effect:
  - one user can only swipe once per post.

### `matches`
- Purpose: canonical mutual-user pairing.
- Columns:
  - `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
  - `user1_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE`
  - `user2_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE`
  - `created_at TIMESTAMPTZ DEFAULT NOW()`
- Constraints:
  - `CHECK (user1_id < user2_id)` (forces deterministic ordering)
  - `UNIQUE (user1_id, user2_id)`
- Effect:
  - same pair cannot be duplicated or stored in reverse order.

### `conversations`
- Purpose: chat channel linked to a match.
- Columns:
  - `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
  - `match_id UUID UNIQUE REFERENCES matches(id) ON DELETE CASCADE`
  - `created_at TIMESTAMPTZ DEFAULT NOW()`
- Effect:
  - at most one conversation per match (`UNIQUE`).

### `messages`
- Purpose: message events in a conversation.
- Columns:
  - `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
  - `conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE`
  - `sender_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE`
  - `content TEXT NOT NULL`
  - `media_url TEXT`
  - `sent_at TIMESTAMPTZ DEFAULT NOW()`
  - `read_at TIMESTAMPTZ`

---

## 5) Collaboration model

### `projects`
- Purpose: collaboration project container.
- Columns:
  - `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
  - `title VARCHAR(100) NOT NULL`
  - `description TEXT`
  - `created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE`
  - `status VARCHAR(20) DEFAULT 'active'`
  - `created_at TIMESTAMPTZ DEFAULT NOW()`
  - `updated_at TIMESTAMPTZ DEFAULT NOW()`
- Constraint:
  - `status IN ('draft','active','completed','archived')`
- Trigger:
  - `trig_projects_updated_at` updates `updated_at` on row update.

### `project_members` (join table)
- Purpose: many-to-many between projects and profiles.
- Keys:
  - `PRIMARY KEY (project_id, user_id)`
- Foreign keys:
  - `project_id → projects(id) ON DELETE CASCADE`
  - `user_id → profiles(id) ON DELETE CASCADE`
- Extra fields:
  - `role VARCHAR(50)`
  - `joined_at TIMESTAMPTZ DEFAULT NOW()`

### `project_files`
- Purpose: files attached to projects.
- Columns:
  - `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
  - `project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE`
  - `uploaded_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE`
  - `filename VARCHAR(255)`
  - `url TEXT NOT NULL`
  - `file_type VARCHAR(20)`
  - `title VARCHAR(100)`
  - `uploaded_at TIMESTAMPTZ DEFAULT NOW()`
- Constraint:
  - `file_type IN ('audio','sheet','video','lyrics','other')`

---

## 6) Database functions and triggers

### `public.update_updated_at_column()`
- Generic trigger function to set `NEW.updated_at = NOW()`.
- Used by:
  - `profiles`
  - `posts`
  - `projects`

### `public.handle_new_user()` + trigger `on_auth_user_created`
- On insert into `auth.users`, it attempts to auto-create `public.profiles` row.
- Behavior:
  - `id = NEW.id`
  - `username = raw_user_meta_data.username` fallback `user_<first8uuid>`
  - `display_name = raw_user_meta_data.full_name` fallback `New Musician`
  - `ON CONFLICT (id) DO NOTHING`

This means profile bootstrap is handled in DB, not only at application layer.

---

## Key Integrity Rules (Important)

1. **Most user-facing tables reference `profiles(id)`, not `auth.users` directly.**
2. **Cascade deletes are widely used**, so deleting an auth user cascades to profile, then to dependent rows.
3. **`profiles` now stores `birthday`, not a persisted `age` column.**
   - Age should be derived at read time for feeds, cards, and profile displays.
4. **Uniqueness prevents duplicates** in:
   - `profiles.username`
   - `profile_photos(user_id, order)`
   - `swipes(user_id, post_id)`
   - `matches(user1_id, user2_id)`
   - `conversations.match_id`
5. **Enums are modeled as `VARCHAR + CHECK`**, not PostgreSQL enum types.
6. **Soft delete exists only on profiles** (`deleted_at`), while hard deletes are still possible and cascaded.

---

## Known Model Gaps / Ambiguities

These are not syntax errors in SQL, but design realities in the current migrations:

- No explicit index definitions beyond PK/UNIQUE, so query performance may rely on implicit indexes only.
- Counter fields on `posts` (`likes_count`, `comments_count`) are not maintained by DB triggers in these migrations.
- `conversations.match_id` is not `NOT NULL`, so the schema still allows a conversation without a match row.
- No explicit check prevents `matches.user1_id = user2_id`; UUID ordering likely prevents equality in practice, but an explicit check would be clearer.
- No URL-format validation exists for `spotify_url`, `soundcloud_url`, or `youtube_url`.
- The birthday age-floor check is enforced on writes, but age itself is not materialized in the database.
- RLS/policies are not created in these migrations.

---

## Suggestions for Future Updates

1. **Expose derived age consistently**
   - Add a query helper, database view, or API-layer mapper that computes age from `birthday` for feed cards and profile pages.

2. **Add explicit indexes for read-heavy paths**
   - Example targets: `posts(user_id, created_at)`, `messages(conversation_id, sent_at)`, `swipes(post_id)`.

3. **Tighten data quality constraints further**
   - Add checks:
     - `latitude BETWEEN -90 AND 90`
     - `longitude BETWEEN -180 AND 180`
     - `duration_sec >= 0`
   - Consider `CHECK (user1_id <> user2_id)` in `matches`.

4. **Make conversation linkage stricter**
   - If the business rule is “every conversation belongs to a match”, make `conversations.match_id NOT NULL`.

5. **Decide and formalize soft-delete strategy**
   - If soft-delete is desired platform-wide, add `deleted_at` patterns (or archive tables) beyond `profiles`.

6. **Move status-like `VARCHAR + CHECK` to reusable enums or reference tables (optional)**
   - Improves consistency and discoverability when domain values expand.

7. **Add trigger/function strategy for denormalized counters**
   - Either maintain `posts.likes_count/comments_count` via DB logic, or remove and compute dynamically.

8. **Ship RLS policies in migrations**
   - Add explicit row-level policies for profiles, posts, messages, projects, files.
   - This avoids security drift between environments.

9. **Document lifecycle flows as sequence diagrams**
   - Sign-up → profile bootstrap → posting → swipe/match → conversation/message.
   - This helps future contributors reason about data ownership and cascade effects.

---

## Migration Operations (Supabase CLI)

```bash
npx supabase login
npx supabase link --project-ref <your-project-ref>
npx supabase start
npx supabase migration new <migration-name>
npx supabase db push
npx supabase db reset
npx supabase db push --linked
```

Use `db push --linked` only after validating locally.
