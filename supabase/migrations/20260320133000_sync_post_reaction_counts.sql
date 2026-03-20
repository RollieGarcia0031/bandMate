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

create or replace function public.sync_post_reaction_counts_from_swipes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform public.apply_post_swipe_delta(new.post_id, new.direction, 1);
    return new;
  end if;

  if tg_op = 'UPDATE' then
    perform public.apply_post_swipe_delta(old.post_id, old.direction, -1);
    perform public.apply_post_swipe_delta(new.post_id, new.direction, 1);
    return new;
  end if;

  perform public.apply_post_swipe_delta(old.post_id, old.direction, -1);
  return old;
end;
$$;

drop trigger if exists trig_swipes_sync_post_reaction_counts on public.swipes;

create trigger trig_swipes_sync_post_reaction_counts
after insert or update or delete on public.swipes
for each row
execute function public.sync_post_reaction_counts_from_swipes();

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
