-- BlogDex: run this entire file in your configured Supabase project's SQL Editor.
-- This script creates only blogdex_* objects. It adds no sample data.
-- Safe to run again; existing BlogDex records are preserved.
begin;

create table if not exists public.blogdex_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique check (username ~ '^[a-z0-9_]{3,24}$'),
  display_name text not null check (char_length(btrim(display_name)) between 1 and 50),
  bio text not null default '' check (char_length(bio) <= 160),
  location text not null default '' check (char_length(location) <= 60),
  website text not null default '' check (website = '' or (website ~ '^https?://' and char_length(website) <= 300)),
  is_suspended boolean not null default false,
  created_at timestamptz not null default now()
);

-- Exactly one admin. Only SQL Editor / the database owner may change this row.
create table if not exists public.blogdex_admin (
  slot boolean primary key default true check (slot = true),
  user_id uuid not null unique references public.blogdex_profiles(id) on delete cascade
);

create or replace function public.blogdex_is_admin()
returns boolean language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.blogdex_admin where user_id = auth.uid()) $$;

create or replace function public.blogdex_is_active()
returns boolean language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.blogdex_profiles where id = auth.uid() and not is_suspended) $$;

create table if not exists public.blogdex_posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.blogdex_profiles(id) on delete cascade,
  body text not null default '' check (char_length(body) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  removed_at timestamptz,
  check (char_length(btrim(body)) > 0)
);

create or replace function public.blogdex_can_view_post(target_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.blogdex_posts p join public.blogdex_profiles a on a.id = p.author_id
    where p.id = target_id and ((p.removed_at is null and not a.is_suspended)
      or p.author_id = auth.uid() or public.blogdex_is_admin())
  )
$$;

create table if not exists public.blogdex_likes (
  post_id uuid not null references public.blogdex_posts(id) on delete cascade,
  user_id uuid not null references public.blogdex_profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
create table if not exists public.blogdex_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.blogdex_posts(id) on delete cascade,
  author_id uuid not null references public.blogdex_profiles(id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 500),
  created_at timestamptz not null default now()
);
create table if not exists public.blogdex_follows (
  follower_id uuid not null references public.blogdex_profiles(id) on delete cascade,
  following_id uuid not null references public.blogdex_profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id),
  check (follower_id <> following_id)
);
create table if not exists public.blogdex_bookmarks (
  user_id uuid not null references public.blogdex_profiles(id) on delete cascade,
  post_id uuid not null references public.blogdex_posts(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)
);
create table if not exists public.blogdex_notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.blogdex_profiles(id) on delete cascade,
  actor_id uuid not null references public.blogdex_profiles(id) on delete cascade,
  kind text not null check (kind in ('like','comment','follow')),
  post_id uuid references public.blogdex_posts(id) on delete cascade,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index if not exists blogdex_notifications_unique
  on public.blogdex_notifications(recipient_id, actor_id, kind, coalesce(post_id, '00000000-0000-0000-0000-000000000000'::uuid));

create table if not exists public.blogdex_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.blogdex_profiles(id) on delete cascade,
  post_id uuid not null references public.blogdex_posts(id) on delete cascade,
  reason text not null check (char_length(btrim(reason)) between 5 and 500),
  status text not null default 'open' check (status in ('open','resolved','dismissed')),
  created_at timestamptz not null default now(),
  unique (reporter_id, post_id)
);
create table if not exists public.blogdex_audit_log (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid references public.blogdex_profiles(id) on delete set null,
  action text not null,
  target_id uuid,
  created_at timestamptz not null default now()
);

create index if not exists blogdex_posts_author_date on public.blogdex_posts(author_id, created_at desc);
create index if not exists blogdex_posts_date on public.blogdex_posts(created_at desc);
create index if not exists blogdex_likes_user on public.blogdex_likes(user_id);
create index if not exists blogdex_comments_post on public.blogdex_comments(post_id, created_at);
create index if not exists blogdex_comments_author on public.blogdex_comments(author_id);
create index if not exists blogdex_follows_following on public.blogdex_follows(following_id);
create index if not exists blogdex_bookmarks_post on public.blogdex_bookmarks(post_id);
create index if not exists blogdex_notifications_recipient on public.blogdex_notifications(recipient_id, created_at desc);
create index if not exists blogdex_notifications_actor on public.blogdex_notifications(actor_id);
create index if not exists blogdex_notifications_post on public.blogdex_notifications(post_id);
create index if not exists blogdex_reports_post on public.blogdex_reports(post_id);

alter table public.blogdex_profiles enable row level security;
alter table public.blogdex_admin enable row level security;
alter table public.blogdex_posts enable row level security;
alter table public.blogdex_likes enable row level security;
alter table public.blogdex_comments enable row level security;
alter table public.blogdex_follows enable row level security;
alter table public.blogdex_bookmarks enable row level security;
alter table public.blogdex_notifications enable row level security;
alter table public.blogdex_reports enable row level security;
alter table public.blogdex_audit_log enable row level security;

revoke all on public.blogdex_profiles, public.blogdex_admin, public.blogdex_posts,
  public.blogdex_likes, public.blogdex_comments, public.blogdex_follows,
  public.blogdex_bookmarks, public.blogdex_notifications, public.blogdex_reports,
  public.blogdex_audit_log from anon, authenticated;
grant select on public.blogdex_profiles, public.blogdex_posts to anon, authenticated;
grant insert (id, username, display_name, bio, location, website) on public.blogdex_profiles to authenticated;
grant update (username, display_name, bio, location, website) on public.blogdex_profiles to authenticated;
grant insert (id, author_id, body) on public.blogdex_posts to authenticated;
grant update (body) on public.blogdex_posts to authenticated;
grant delete on public.blogdex_posts to authenticated;
grant select, insert, delete on public.blogdex_likes, public.blogdex_follows, public.blogdex_bookmarks to authenticated;
grant select, insert, delete on public.blogdex_comments to authenticated;
grant select on public.blogdex_admin, public.blogdex_notifications, public.blogdex_reports, public.blogdex_audit_log to authenticated;
grant insert (reporter_id, post_id, reason) on public.blogdex_reports to authenticated;
grant update (read_at) on public.blogdex_notifications to authenticated;

drop policy if exists blogdex_profiles_read on public.blogdex_profiles;
create policy blogdex_profiles_read on public.blogdex_profiles for select
  using (not is_suspended or id = auth.uid() or public.blogdex_is_admin());
drop policy if exists blogdex_profiles_insert on public.blogdex_profiles;
create policy blogdex_profiles_insert on public.blogdex_profiles for insert to authenticated
  with check (id = auth.uid() and not is_suspended);
drop policy if exists blogdex_profiles_update on public.blogdex_profiles;
create policy blogdex_profiles_update on public.blogdex_profiles for update to authenticated
  using (id = auth.uid() and public.blogdex_is_active()) with check (id = auth.uid());
drop policy if exists blogdex_admin_read on public.blogdex_admin;
create policy blogdex_admin_read on public.blogdex_admin for select to authenticated using (user_id = auth.uid());

drop policy if exists blogdex_posts_read on public.blogdex_posts;
create policy blogdex_posts_read on public.blogdex_posts for select using (public.blogdex_can_view_post(id));
drop policy if exists blogdex_posts_insert on public.blogdex_posts;
create policy blogdex_posts_insert on public.blogdex_posts for insert to authenticated
  with check (author_id = auth.uid() and public.blogdex_is_active() and removed_at is null
    and char_length(btrim(body)) > 0);
drop policy if exists blogdex_posts_update on public.blogdex_posts;
create policy blogdex_posts_update on public.blogdex_posts for update to authenticated
  using (author_id = auth.uid() and public.blogdex_is_active() and removed_at is null)
  with check (author_id = auth.uid() and removed_at is null and char_length(btrim(body)) > 0);
drop policy if exists blogdex_posts_delete on public.blogdex_posts;
create policy blogdex_posts_delete on public.blogdex_posts for delete to authenticated using (author_id = auth.uid());

drop policy if exists blogdex_likes_read on public.blogdex_likes;
create policy blogdex_likes_read on public.blogdex_likes for select to authenticated using (public.blogdex_can_view_post(post_id));
drop policy if exists blogdex_likes_insert on public.blogdex_likes;
create policy blogdex_likes_insert on public.blogdex_likes for insert to authenticated
  with check (user_id = auth.uid() and public.blogdex_is_active() and exists (select 1 from public.blogdex_posts where id = post_id and removed_at is null));
drop policy if exists blogdex_likes_delete on public.blogdex_likes;
create policy blogdex_likes_delete on public.blogdex_likes for delete to authenticated using (user_id = auth.uid());

drop policy if exists blogdex_comments_read on public.blogdex_comments;
create policy blogdex_comments_read on public.blogdex_comments for select to authenticated using (public.blogdex_can_view_post(post_id));
drop policy if exists blogdex_comments_insert on public.blogdex_comments;
create policy blogdex_comments_insert on public.blogdex_comments for insert to authenticated
  with check (author_id = auth.uid() and public.blogdex_is_active() and exists (select 1 from public.blogdex_posts where id = post_id and removed_at is null));
drop policy if exists blogdex_comments_delete on public.blogdex_comments;
create policy blogdex_comments_delete on public.blogdex_comments for delete to authenticated
  using (author_id = auth.uid() or public.blogdex_is_admin());

drop policy if exists blogdex_follows_read on public.blogdex_follows;
create policy blogdex_follows_read on public.blogdex_follows for select to authenticated using (true);
drop policy if exists blogdex_follows_insert on public.blogdex_follows;
create policy blogdex_follows_insert on public.blogdex_follows for insert to authenticated
  with check (follower_id = auth.uid() and public.blogdex_is_active() and exists (select 1 from public.blogdex_profiles where id = following_id and not is_suspended));
drop policy if exists blogdex_follows_delete on public.blogdex_follows;
create policy blogdex_follows_delete on public.blogdex_follows for delete to authenticated using (follower_id = auth.uid());

drop policy if exists blogdex_bookmarks_read on public.blogdex_bookmarks;
create policy blogdex_bookmarks_read on public.blogdex_bookmarks for select to authenticated using (user_id = auth.uid());
drop policy if exists blogdex_bookmarks_insert on public.blogdex_bookmarks;
create policy blogdex_bookmarks_insert on public.blogdex_bookmarks for insert to authenticated
  with check (user_id = auth.uid() and public.blogdex_is_active() and public.blogdex_can_view_post(post_id));
drop policy if exists blogdex_bookmarks_delete on public.blogdex_bookmarks;
create policy blogdex_bookmarks_delete on public.blogdex_bookmarks for delete to authenticated using (user_id = auth.uid());

drop policy if exists blogdex_notifications_read on public.blogdex_notifications;
create policy blogdex_notifications_read on public.blogdex_notifications for select to authenticated using (recipient_id = auth.uid());
drop policy if exists blogdex_notifications_update on public.blogdex_notifications;
create policy blogdex_notifications_update on public.blogdex_notifications for update to authenticated
  using (recipient_id = auth.uid()) with check (recipient_id = auth.uid());
drop policy if exists blogdex_reports_read on public.blogdex_reports;
create policy blogdex_reports_read on public.blogdex_reports for select to authenticated
  using (reporter_id = auth.uid() or public.blogdex_is_admin());
drop policy if exists blogdex_reports_insert on public.blogdex_reports;
create policy blogdex_reports_insert on public.blogdex_reports for insert to authenticated
  with check (reporter_id = auth.uid() and public.blogdex_is_active() and status = 'open' and public.blogdex_can_view_post(post_id));
drop policy if exists blogdex_audit_read on public.blogdex_audit_log;
create policy blogdex_audit_read on public.blogdex_audit_log for select to authenticated using (public.blogdex_is_admin());

create or replace function public.blogdex_notify()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare recipient uuid; actor uuid; post uuid; notification_kind text;
begin
  if tg_table_name = 'blogdex_follows' then
    recipient := new.following_id; actor := new.follower_id; notification_kind := 'follow';
  else
    post := new.post_id;
    select author_id into recipient from public.blogdex_posts where id = post;
    if tg_table_name = 'blogdex_likes' then actor := new.user_id; notification_kind := 'like';
    else actor := new.author_id; notification_kind := 'comment'; end if;
  end if;
  if recipient is not null and recipient <> actor then
    insert into public.blogdex_notifications (recipient_id, actor_id, kind, post_id)
      values (recipient, actor, notification_kind, post) on conflict do nothing;
  end if;
  return new;
end;
$$;
drop trigger if exists blogdex_like_notification on public.blogdex_likes;
create trigger blogdex_like_notification after insert on public.blogdex_likes for each row execute function public.blogdex_notify();
drop trigger if exists blogdex_comment_notification on public.blogdex_comments;
create trigger blogdex_comment_notification after insert on public.blogdex_comments for each row execute function public.blogdex_notify();
drop trigger if exists blogdex_follow_notification on public.blogdex_follows;
create trigger blogdex_follow_notification after insert on public.blogdex_follows for each row execute function public.blogdex_notify();

create or replace function public.blogdex_stamp_post()
returns trigger language plpgsql set search_path = ''
as $$ begin if new.body is distinct from old.body then new.updated_at := now(); end if; return new; end $$;
drop trigger if exists blogdex_post_updated on public.blogdex_posts;
create trigger blogdex_post_updated before update on public.blogdex_posts for each row execute function public.blogdex_stamp_post();

create or replace function public.blogdex_log_comment_removal()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if public.blogdex_is_admin() and old.author_id <> auth.uid() then
    insert into public.blogdex_audit_log(admin_id, action, target_id) values(auth.uid(), 'Comment removed', old.id);
  end if;
  return old;
end;
$$;
drop trigger if exists blogdex_comment_removed on public.blogdex_comments;
create trigger blogdex_comment_removed after delete on public.blogdex_comments for each row execute function public.blogdex_log_comment_removal();

create or replace function public.blogdex_moderate_post(target_id uuid, remove_post boolean)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if not public.blogdex_is_admin() then raise exception 'Admin access required' using errcode = '42501'; end if;
  if remove_post is null then raise exception 'Choose hide or restore'; end if;
  update public.blogdex_posts set removed_at = case when remove_post then now() else null end where id = target_id;
  if not found then raise exception 'Post not found'; end if;
  insert into public.blogdex_audit_log(admin_id, action, target_id)
    values(auth.uid(), case when remove_post then 'Post hidden' else 'Post restored' end, target_id);
end;
$$;

create or replace function public.blogdex_suspend_user(target_id uuid, suspend_user boolean)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if not public.blogdex_is_admin() then raise exception 'Admin access required' using errcode = '42501'; end if;
  if suspend_user is null then raise exception 'Choose suspend or restore'; end if;
  if exists (select 1 from public.blogdex_admin where user_id = target_id) then raise exception 'The admin account cannot be suspended'; end if;
  update public.blogdex_profiles set is_suspended = suspend_user where id = target_id;
  if not found then raise exception 'User not found'; end if;
  insert into public.blogdex_audit_log(admin_id, action, target_id)
    values(auth.uid(), case when suspend_user then 'User suspended' else 'User restored' end, target_id);
end;
$$;

create or replace function public.blogdex_resolve_report(target_id uuid, resolution text)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if not public.blogdex_is_admin() then raise exception 'Admin access required' using errcode = '42501'; end if;
  if resolution is null or resolution not in ('resolved','dismissed') then raise exception 'Invalid resolution'; end if;
  update public.blogdex_reports set status = resolution where id = target_id;
  if not found then raise exception 'Report not found'; end if;
  insert into public.blogdex_audit_log(admin_id, action, target_id)
    values(auth.uid(), 'Report ' || resolution, target_id);
end;
$$;

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

revoke all on function public.blogdex_is_admin(), public.blogdex_is_active(),
  public.blogdex_can_view_post(uuid), public.blogdex_notify(), public.blogdex_log_comment_removal(),
  public.blogdex_stamp_post(), public.blogdex_moderate_post(uuid,boolean),
  public.blogdex_suspend_user(uuid,boolean), public.blogdex_resolve_report(uuid,text), public.blogdex_admin_users() from public;
grant execute on function public.blogdex_is_admin(), public.blogdex_can_view_post(uuid) to anon, authenticated;
grant execute on function public.blogdex_is_active(),
  public.blogdex_moderate_post(uuid,boolean), public.blogdex_suspend_user(uuid,boolean),
  public.blogdex_resolve_report(uuid,text), public.blogdex_admin_users() to authenticated;

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

create or replace view public.blogdex_trending with (security_invoker = true) as
select lower(tag[1]) as tag, count(distinct p.id) as post_count
from public.blogdex_posts p join public.blogdex_profiles a on a.id = p.author_id,
  lateral regexp_matches(p.body, '#([A-Za-z][A-Za-z0-9_]{1,39})', 'g') as tag
where p.removed_at is null and not a.is_suspended and p.created_at > now() - interval '7 days'
group by lower(tag[1]) order by post_count desc, tag;
revoke all on public.blogdex_feed, public.blogdex_people, public.blogdex_trending from anon, authenticated;
grant select on public.blogdex_feed, public.blogdex_people, public.blogdex_trending to authenticated;

-- Only these new tables are added to Realtime; previous project tables are untouched.
do $$
declare table_name text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach table_name in array array['blogdex_profiles','blogdex_posts','blogdex_likes',
      'blogdex_comments','blogdex_follows','blogdex_bookmarks','blogdex_notifications','blogdex_reports'] loop
      if not exists(select 1 from pg_publication_tables where pubname = 'supabase_realtime'
        and schemaname = 'public' and tablename = table_name) then
        execute format('alter publication supabase_realtime add table public.%I', table_name);
      end if;
    end loop;
  end if;
end;
$$;
commit;
