-- BlogDex: remove the image/video feature from an EXISTING installation.
-- Run this once in the Supabase SQL Editor. Safe to run again.
-- Fresh installs do not need this file; supabase/schema.sql is already text-only.
--
-- What it does:
--   * drops the blogdex-media storage policies and helper function
--   * drops posts.media and profiles.avatar_url (and everything that depends on them)
--   * recreates the views and the admin users function without those columns
--   * hides (does not delete) any old posts that had no text, i.e. image/video-only posts
-- It does NOT delete files from Storage. After it succeeds, delete the
-- "blogdex-media" bucket in Supabase Dashboard -> Storage (empty it first).
begin;

drop policy if exists blogdex_storage_read on storage.objects;
drop policy if exists blogdex_storage_read_guard on storage.objects;
drop policy if exists blogdex_storage_insert on storage.objects;
drop policy if exists blogdex_storage_insert_guard on storage.objects;
drop policy if exists blogdex_storage_update_guard on storage.objects;
drop policy if exists blogdex_storage_delete on storage.objects;
drop policy if exists blogdex_storage_delete_guard on storage.objects;
drop function if exists public.blogdex_media_is_public(text);

-- Old image/video-only posts have an empty body; keep them but hide them.
update public.blogdex_posts set removed_at = now() where btrim(body) = '' and removed_at is null;

drop policy if exists blogdex_posts_insert on public.blogdex_posts;
create policy blogdex_posts_insert on public.blogdex_posts for insert to authenticated
  with check (author_id = auth.uid() and public.blogdex_is_active() and removed_at is null
    and char_length(btrim(body)) > 0);

drop view if exists public.blogdex_feed;
drop view if exists public.blogdex_people;
drop function if exists public.blogdex_admin_users();

alter table public.blogdex_posts drop column if exists media;
alter table public.blogdex_profiles drop column if exists avatar_url;
drop function if exists public.blogdex_valid_media(jsonb, uuid);

do $$ begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.blogdex_posts'::regclass and conname = 'blogdex_posts_body_not_empty') then
    alter table public.blogdex_posts add constraint blogdex_posts_body_not_empty check (char_length(btrim(body)) > 0) not valid;
  end if;
end $$;

create or replace function public.blogdex_admin_users()
returns table(id uuid, username text, display_name text, is_suspended boolean,
  created_at timestamptz, email text, last_sign_in_at timestamptz)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.blogdex_is_admin() then raise exception 'Admin access required' using errcode = '42501'; end if;
  return query select p.id, p.username, p.display_name, p.is_suspended,
    p.created_at, u.email::text, u.last_sign_in_at
    from public.blogdex_profiles p join auth.users u on u.id = p.id order by p.created_at desc;
end;
$$;
revoke execute on function public.blogdex_is_active() from anon;
revoke all on function public.blogdex_admin_users() from public;
grant execute on function public.blogdex_admin_users() to authenticated;

create or replace view public.blogdex_feed with (security_invoker = true) as
select p.*, a.username, a.display_name,
  (select count(*) from public.blogdex_likes l where l.post_id = p.id) as like_count,
  (select count(*) from public.blogdex_comments c where c.post_id = p.id) as comment_count,
  exists(select 1 from public.blogdex_likes l where l.post_id = p.id and l.user_id = auth.uid()) as liked,
  exists(select 1 from public.blogdex_bookmarks b where b.post_id = p.id and b.user_id = auth.uid()) as bookmarked,
  to_tsvector('simple', p.body || ' ' || a.username || ' ' || a.display_name) as search_document
from public.blogdex_posts p join public.blogdex_profiles a on a.id = p.author_id
where p.removed_at is null and not a.is_suspended;

create or replace view public.blogdex_people with (security_invoker = true) as
select a.*,
  (select count(*) from public.blogdex_posts p where p.author_id = a.id and p.removed_at is null) as post_count,
  (select count(*) from public.blogdex_follows f where f.following_id = a.id) as follower_count,
  (select count(*) from public.blogdex_follows f where f.follower_id = a.id) as following_count,
  to_tsvector('simple', a.username || ' ' || a.display_name || ' ' || a.bio) as search_document
from public.blogdex_profiles a;

revoke all on public.blogdex_feed, public.blogdex_people from anon, authenticated;
grant select on public.blogdex_feed, public.blogdex_people to authenticated;
commit;
