-- =====================================================================
-- The Line: "On hand" and "Use by" for ingredients (for the Specials page)
-- Paste this file into Supabase → SQL Editor → New query → Run.
-- It is safe to run more than once.
-- =====================================================================

alter table public.ingredients
  add column if not exists on_hand numeric(10,2) check (on_hand >= 0),   -- how much is in stock, in the ingredient's unit
  add column if not exists use_by  date;                                 -- the date it spoils / must be used by

-- Done! You should see "Success. No rows returned".
