-- =====================================================================
-- The Line — "Delete my account" add-on
-- Already ran schema.sql? Paste THIS file into Supabase → SQL Editor →
-- New query → Run. (It's safe to run more than once.)
--
-- Lets a signed-in user delete their own login. Their restaurants and
-- everything in them are deleted along with it. Nobody can delete
-- anyone else's account: it only ever deletes the caller.
-- =====================================================================

create or replace function public.delete_my_account()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from auth.users where id = (select auth.uid());
$$;

revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- Done! You should see "Success. No rows returned".
