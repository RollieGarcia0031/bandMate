-- =============================================================================
-- Prevent users from swiping on their own posts.
--
-- Why this migration exists:
-- - Feed swipes are stored in `public.swipes` and then fan out to post reaction
--   counters and reciprocal matches through trigger-based synchronization.
-- - If a user can swipe on their own post, those downstream counters become
--   invalid and the client can appear to like/dislike its own content.
--
-- What this migration does:
-- 1. Adds a `BEFORE INSERT OR UPDATE` trigger on `public.swipes`.
-- 2. Looks up the owner of `NEW.post_id` and rejects the write when the swiper
--    and the post owner are the same user.
-- 3. Deletes any legacy self-swipes so existing data also respects the rule;
--    the previously-installed AFTER trigger on `public.swipes` will reconcile
--    post counters and matches as those invalid rows are removed.
-- =============================================================================

create or replace function public.reject_self_swipes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  post_owner_id uuid;
begin
  select posts.user_id
  into post_owner_id
  from public.posts as posts
  where posts.id = new.post_id;

  if post_owner_id is null then
    raise exception 'Cannot create a swipe for a missing post (%).', new.post_id;
  end if;

  if new.user_id = post_owner_id then
    raise exception 'Users cannot swipe on their own posts.';
  end if;

  return new;
end;
$$;

drop trigger if exists trig_swipes_reject_self_swipes on public.swipes;

create trigger trig_swipes_reject_self_swipes
before insert or update on public.swipes
for each row
execute function public.reject_self_swipes();

delete from public.swipes as swipes
using public.posts as posts
where posts.id = swipes.post_id
  and posts.user_id = swipes.user_id;
