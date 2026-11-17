-- =====================================================================
-- The Line: a full address for every restaurant
-- Run once in Supabase -> SQL Editor -> New query. Safe to run again.
-- Restaurants made before this have a blank address; owners fill it in
-- under Settings. New restaurants must have one.
-- =====================================================================

alter table public.restaurants
  add column if not exists address_line1 text check (char_length(address_line1) <= 200),  -- street address
  add column if not exists address_line2 text check (char_length(address_line2) <= 100),  -- suite, unit, floor (optional)
  add column if not exists city          text check (char_length(city) <= 100),
  add column if not exists state         text check (state ~ '^[A-Z]{2}$'),                 -- two-letter code, like TN
  add column if not exists postal_code   text check (postal_code ~ '^[0-9]{5}(-[0-9]{4})?$'); -- 37902 or 37902-1234

-- Nothing else to do: the "own restaurants" rule already covers every
-- column, so owners can only read and change their own restaurant's address.
