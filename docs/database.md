# BandMate Database Model (Source of Truth: Initial Migration)

This document explains the **actual** database model defined in:

- `supabase/migrations/20260317134714_initial_tables.sql`

It replaces assumptions with what is explicitly enforced by SQL constraints, keys, checks, and triggers.

## Scope and Core Principle

- Application user identity is stored in `auth.users` (Supabase Auth).
- App-facing profile data is stored in `public.profiles`.
- `public.profiles.id` is both:
  - the primary key of `profiles`, and
  - a foreign key to `auth.users(id)` (`ON DELETE CASCADE`).

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
- Additional fields:
  - `bio TEXT`
  - `age SMALLINT CHECK (age >= 13)`
  - `gender VARCHAR(20)`
  - `latitude DECIMAL(10,8)`
  - `longitude DECIMAL(11,8)`
  - `city VARCHAR(100)`
  - `experience_years SMALLINT`
  - `spotify_url TEXT`
  - `soundcloud_url TEXT`
  - `youtube_url TEXT`
  - `looking_for TEXT[]`
  - `last_active TIMESTAMPTZ DEFAULT NOW()`
  - `deleted_at TIMESTAMPTZ`
  - `created_at TIMESTAMPTZ DEFAULT NOW()`
  - `updated_at TIMESTAMPTZ DEFAULT NOW()`

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
3. **Uniqueness prevents duplicates** in:
   - `profiles.username`
   - `profile_photos(user_id, order)`
   - `swipes(user_id, post_id)`
   - `matches(user1_id, user2_id)`
   - `conversations.match_id`
4. **Enums are modeled as `VARCHAR + CHECK`**, not PostgreSQL enum types.
5. **Soft delete exists only on profiles** (`deleted_at`), while hard deletes are still possible and cascaded.

---

## Known Model Gaps / Ambiguities

These are not errors in SQL syntax, but design realities in the current migration:

- No explicit index definitions beyond PK/UNIQUE (query performance may depend on implicit indexes only).
- Counter fields on `posts` (`likes_count`, `comments_count`) are not maintained by DB triggers in this migration.
- `conversations.match_id` is not `NOT NULL`; schema allows a conversation without a match row.
- No check preventing `matches.user1_id = user2_id` explicitly (UUID ordering check likely prevents equality in practice, but explicit check would be clearer).
- No domain checks on coordinates (`latitude`, `longitude`) or non-negative checks for fields like `duration_sec`, `experience_years`.
- RLS/policies are not created in this migration (comment says to configure them after).

---

## Suggestions for Future Updates

1. **Add explicit indexes for read-heavy paths**
   - Example targets: `posts(user_id, created_at)`, `messages(conversation_id, sent_at)`, `swipes(post_id)`.

2. **Tighten data quality constraints**
   - Add checks:
     - `latitude BETWEEN -90 AND 90`
     - `longitude BETWEEN -180 AND 180`
     - `duration_sec >= 0`
     - `experience_years >= 0`
   - Consider `CHECK (user1_id <> user2_id)` in `matches`.

3. **Make conversation linkage stricter**
   - If business rule is “every conversation belongs to a match”, make `conversations.match_id NOT NULL`.

4. **Decide and formalize soft-delete strategy**
   - If soft-delete is desired platform-wide, add `deleted_at` patterns (or archive tables) beyond `profiles`.

5. **Move status-like `VARCHAR + CHECK` to reusable enums or reference tables (optional)**
   - Improves consistency and discoverability when domain values expand.

6. **Add trigger/function strategy for denormalized counters**
   - Either maintain `posts.likes_count/comments_count` via DB logic, or remove and compute dynamically.

7. **Ship RLS policies in migrations**
   - Add explicit row-level policies for profiles, posts, messages, projects, files.
   - This avoids security drift between environments.

8. **Document lifecycle flows as sequence diagrams**
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
