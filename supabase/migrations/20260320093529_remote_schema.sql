drop extension if exists "pg_net";


  create table "public"."feed_impressions" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" uuid not null,
    "post_id" uuid not null,
    "seen_at" timestamp with time zone not null default now(),
    "dwell_ms" integer,
    "session_id" text,
    "source" text not null default 'feed'::text,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."feed_impressions" enable row level security;

alter table "public"."swipes" enable row level security;

CREATE UNIQUE INDEX feed_impressions_pkey ON public.feed_impressions USING btree (id);

CREATE INDEX feed_impressions_post_id_seen_at_idx ON public.feed_impressions USING btree (post_id, seen_at DESC);

CREATE INDEX feed_impressions_user_id_seen_at_idx ON public.feed_impressions USING btree (user_id, seen_at DESC);

CREATE UNIQUE INDEX feed_impressions_user_post_unique ON public.feed_impressions USING btree (user_id, post_id);

alter table "public"."feed_impressions" add constraint "feed_impressions_pkey" PRIMARY KEY using index "feed_impressions_pkey";

alter table "public"."feed_impressions" add constraint "feed_impressions_dwell_ms_nonnegative" CHECK (((dwell_ms IS NULL) OR (dwell_ms >= 0))) not valid;

alter table "public"."feed_impressions" validate constraint "feed_impressions_dwell_ms_nonnegative";

alter table "public"."feed_impressions" add constraint "feed_impressions_source_not_blank" CHECK ((char_length(TRIM(BOTH FROM source)) > 0)) not valid;

alter table "public"."feed_impressions" validate constraint "feed_impressions_source_not_blank";

alter table "public"."feed_impressions" add constraint "feed_impressions_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE not valid;

alter table "public"."feed_impressions" validate constraint "feed_impressions_user_id_fkey";

alter table "public"."feed_impressions" add constraint "feed_impressions_user_post_unique" UNIQUE using index "feed_impressions_user_post_unique";

grant delete on table "public"."feed_impressions" to "anon";

grant insert on table "public"."feed_impressions" to "anon";

grant references on table "public"."feed_impressions" to "anon";

grant select on table "public"."feed_impressions" to "anon";

grant trigger on table "public"."feed_impressions" to "anon";

grant truncate on table "public"."feed_impressions" to "anon";

grant update on table "public"."feed_impressions" to "anon";

grant delete on table "public"."feed_impressions" to "authenticated";

grant insert on table "public"."feed_impressions" to "authenticated";

grant references on table "public"."feed_impressions" to "authenticated";

grant select on table "public"."feed_impressions" to "authenticated";

grant trigger on table "public"."feed_impressions" to "authenticated";

grant truncate on table "public"."feed_impressions" to "authenticated";

grant update on table "public"."feed_impressions" to "authenticated";

grant delete on table "public"."feed_impressions" to "service_role";

grant insert on table "public"."feed_impressions" to "service_role";

grant references on table "public"."feed_impressions" to "service_role";

grant select on table "public"."feed_impressions" to "service_role";

grant trigger on table "public"."feed_impressions" to "service_role";

grant truncate on table "public"."feed_impressions" to "service_role";

grant update on table "public"."feed_impressions" to "service_role";


  create policy "feed_impressions_insert_own"
  on "public"."feed_impressions"
  as permissive
  for insert
  to authenticated
with check ((auth.uid() = user_id));



  create policy "feed_impressions_select_own"
  on "public"."feed_impressions"
  as permissive
  for select
  to authenticated
using ((auth.uid() = user_id));



  create policy "posts_select_own"
  on "public"."posts"
  as permissive
  for select
  to authenticated
using ((auth.uid() = user_id));



  create policy "profile_photos_select_feed_public_post_authors"
  on "public"."profile_photos"
  as permissive
  for select
  to authenticated
using ((EXISTS ( SELECT 1
   FROM public.posts
  WHERE ((posts.user_id = profile_photos.user_id) AND ((posts.visibility)::text = 'public'::text)))));



  create policy "profiles_select_feed_public_post_authors"
  on "public"."profiles"
  as permissive
  for select
  to authenticated
using ((EXISTS ( SELECT 1
   FROM public.posts
  WHERE ((posts.user_id = profiles.id) AND ((posts.visibility)::text = 'public'::text)))));



  create policy "profiles_select_public_post_authors"
  on "public"."profiles"
  as permissive
  for select
  to authenticated
using ((EXISTS ( SELECT 1
   FROM public.posts
  WHERE ((posts.user_id = profiles.id) AND ((posts.visibility)::text = 'public'::text)))));



  create policy "swipes_delete_own"
  on "public"."swipes"
  as permissive
  for delete
  to authenticated
using ((auth.uid() = user_id));



  create policy "swipes_insert_own"
  on "public"."swipes"
  as permissive
  for insert
  to authenticated
with check ((auth.uid() = user_id));



  create policy "swipes_select_own"
  on "public"."swipes"
  as permissive
  for select
  to authenticated
using ((auth.uid() = user_id));



  create policy "swipes_update_own"
  on "public"."swipes"
  as permissive
  for update
  to authenticated
using ((auth.uid() = user_id))
with check ((auth.uid() = user_id));



  create policy "user_genres_select_feed_public_post_authors"
  on "public"."user_genres"
  as permissive
  for select
  to authenticated
using ((EXISTS ( SELECT 1
   FROM public.posts
  WHERE ((posts.user_id = user_genres.user_id) AND ((posts.visibility)::text = 'public'::text)))));



  create policy "user_instruments_select_feed_public_post_authors"
  on "public"."user_instruments"
  as permissive
  for select
  to authenticated
using ((EXISTS ( SELECT 1
   FROM public.posts
  WHERE ((posts.user_id = user_instruments.user_id) AND ((posts.visibility)::text = 'public'::text)))));



  create policy "storage_user_posts_select_public_feed"
  on "storage"."objects"
  as permissive
  for select
  to authenticated
using (((bucket_id = public.user_posts_bucket()) AND (EXISTS ( SELECT 1
   FROM public.posts
  WHERE ((posts.video_url = objects.name) AND ((posts.visibility)::text = 'public'::text))))));



