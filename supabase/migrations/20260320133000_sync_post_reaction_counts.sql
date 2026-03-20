-- =============================================================================
-- Keep feed reaction counts and reciprocal matches synchronized from swipes.
--
-- Why this migration exists:
-- - Feed swipes are stored per (user_id, post_id) in `public.swipes`.
-- - Feed UI also needs durable aggregate reaction counts on `public.posts`.
-- - A mutual like should create a row in `public.matches`, but only when two
--   different users have each liked at least one public post created by the
--   other user.
--
-- What this migration does:
-- 1. Adds `posts.dislikes_count` for persisted pass/dislike totals.
-- 2. Creates helper functions that keep post reaction counters in sync with the
--    latest contents of `public.swipes`.
-- 3. Creates helper functions that derive reciprocal user-to-user matches from
--    post swipes, inserting matches only when the like is mutual and removing
--    them when it is no longer mutual.
-- 4. Installs an AFTER trigger on `public.swipes` so every insert/update/delete
--    keeps both `public.posts` and `public.matches` consistent.
-- 5. Backfills both reaction counts and matches from the current swipe data.
-- =============================================================================

alter table public.posts
  add column if not exists dislikes_count integer not null default 0;

create or replace function public.apply_post_swipe_delta(target_post_id uuid, swipe_direction text, delta integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if swipe_direction = 'like' then
    update public.posts
    set likes_count = greatest(coalesce(likes_count, 0) + delta, 0)
    where id = target_post_id;
  elsif swipe_direction = 'pass' then
    update public.posts
    set dislikes_count = greatest(coalesce(dislikes_count, 0) + delta, 0)
    where id = target_post_id;
  end if;
end;
$$;

create or replace function public.sync_match_for_users(first_user_id uuid, second_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  ordered_user1 uuid;
  ordered_user2 uuid;
  first_user_liked_second boolean;
  second_user_liked_first boolean;
begin
  if first_user_id is null or second_user_id is null or first_user_id = second_user_id then
    return;
  end if;

  ordered_user1 := least(first_user_id, second_user_id);
  ordered_user2 := greatest(first_user_id, second_user_id);

  select exists(
    select 1
    from public.swipes as swipes
    join public.posts as posts
      on posts.id = swipes.post_id
    where swipes.user_id = first_user_id
      and swipes.direction = 'like'
      and posts.user_id = second_user_id
  )
  into first_user_liked_second;

  select exists(
    select 1
    from public.swipes as swipes
    join public.posts as posts
      on posts.id = swipes.post_id
    where swipes.user_id = second_user_id
      and swipes.direction = 'like'
      and posts.user_id = first_user_id
  )
  into second_user_liked_first;

  if first_user_liked_second and second_user_liked_first then
    insert into public.matches (user1_id, user2_id)
    values (ordered_user1, ordered_user2)
    on conflict (user1_id, user2_id) do nothing;
  else
    delete from public.matches
    where user1_id = ordered_user1
      and user2_id = ordered_user2;
  end if;
end;
$$;

create or replace function public.sync_post_reactions_and_matches_from_swipes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  old_post_owner_id uuid;
  new_post_owner_id uuid;
begin
  if tg_op in ('UPDATE', 'DELETE') then
    select posts.user_id
    into old_post_owner_id
    from public.posts as posts
    where posts.id = old.post_id;
  end if;

  if tg_op in ('INSERT', 'UPDATE') then
    select posts.user_id
    into new_post_owner_id
    from public.posts as posts
    where posts.id = new.post_id;
  end if;

  if tg_op = 'INSERT' then
    perform public.apply_post_swipe_delta(new.post_id, new.direction, 1);
    perform public.sync_match_for_users(new.user_id, new_post_owner_id);
    return new;
  end if;

  if tg_op = 'UPDATE' then
    perform public.apply_post_swipe_delta(old.post_id, old.direction, -1);
    perform public.apply_post_swipe_delta(new.post_id, new.direction, 1);

    perform public.sync_match_for_users(old.user_id, old_post_owner_id);

    if old.user_id is distinct from new.user_id or old_post_owner_id is distinct from new_post_owner_id then
      perform public.sync_match_for_users(new.user_id, new_post_owner_id);
    end if;

    return new;
  end if;

  perform public.apply_post_swipe_delta(old.post_id, old.direction, -1);
  perform public.sync_match_for_users(old.user_id, old_post_owner_id);
  return old;
end;
$$;

drop trigger if exists trig_swipes_sync_post_reactions_and_matches on public.swipes;

create trigger trig_swipes_sync_post_reactions_and_matches
after insert or update or delete on public.swipes
for each row
execute function public.sync_post_reactions_and_matches_from_swipes();

update public.posts as posts
set likes_count = coalesce(reaction_counts.likes_count, 0),
    dislikes_count = coalesce(reaction_counts.dislikes_count, 0)
from (
  select
    swipes.post_id,
    count(*) filter (where swipes.direction = 'like') as likes_count,
    count(*) filter (where swipes.direction = 'pass') as dislikes_count
  from public.swipes as swipes
  group by swipes.post_id
) as reaction_counts
where posts.id = reaction_counts.post_id;

update public.posts
set likes_count = 0,
    dislikes_count = 0
where id not in (
  select distinct swipes.post_id
  from public.swipes as swipes
);

with mutual_like_pairs as (
  select distinct
    least(swipes.user_id, posts.user_id) as user1_id,
    greatest(swipes.user_id, posts.user_id) as user2_id
  from public.swipes as swipes
  join public.posts as posts
    on posts.id = swipes.post_id
  where swipes.direction = 'like'
    and swipes.user_id <> posts.user_id
    and exists (
      select 1
      from public.swipes as reciprocal_swipes
      join public.posts as reciprocal_posts
        on reciprocal_posts.id = reciprocal_swipes.post_id
      where reciprocal_swipes.user_id = posts.user_id
        and reciprocal_swipes.direction = 'like'
        and reciprocal_posts.user_id = swipes.user_id
    )
)
insert into public.matches (user1_id, user2_id)
select mutual_like_pairs.user1_id, mutual_like_pairs.user2_id
from mutual_like_pairs
on conflict (user1_id, user2_id) do nothing;

delete from public.matches as matches
where not exists (
  select 1
  from public.swipes as swipes
  join public.posts as posts
    on posts.id = swipes.post_id
  where swipes.direction = 'like'
    and swipes.user_id <> posts.user_id
    and least(swipes.user_id, posts.user_id) = matches.user1_id
    and greatest(swipes.user_id, posts.user_id) = matches.user2_id
    and exists (
      select 1
      from public.swipes as reciprocal_swipes
      join public.posts as reciprocal_posts
        on reciprocal_posts.id = reciprocal_swipes.post_id
      where reciprocal_swipes.user_id = posts.user_id
        and reciprocal_swipes.direction = 'like'
        and reciprocal_posts.user_id = swipes.user_id
    )
);
