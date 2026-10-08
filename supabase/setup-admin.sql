-- FIRST: create your account through BlogDex, verify your email, and complete your profile.
-- SECOND: replace the email below with YOUR account email, then run in SQL Editor.
-- The slot constraint allows one BlogDex admin. Running again replaces that admin.
do $$
declare admin_id uuid;
begin
  select p.id into admin_id from public.blogdex_profiles p
    join auth.users u on u.id = p.id
    where lower(u.email) = lower('YOUR_ADMIN_EMAIL_HERE');
  if admin_id is null then
    raise exception 'No BlogDex profile found for this email. Sign up and finish your profile first.';
  end if;
  insert into public.blogdex_admin(slot, user_id) values(true, admin_id)
    on conflict (slot) do update set user_id = excluded.user_id;
  update public.blogdex_profiles set is_suspended = false where id = admin_id;
end;
$$;
