-- =====================================================================
-- The Line: the price book (Procurement -> smartest places to buy)
-- Run once in Supabase -> SQL Editor -> New query. Safe to run again.
--
-- Every price the app learns goes here, one row per item, place and day:
--   invoice  - from a scanned supplier invoice (real price you paid)
--   receipt  - from a scanned store receipt (real price you paid)
--   quote    - typed in by the owner (a rep's quote, a shelf price)
--   estimate - looked up by Gemini with Google Search (a typical price)
-- =====================================================================

create table if not exists public.price_points (
  id            uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  ingredient_id uuid references public.ingredients(id) on delete cascade,
  item_name     text not null check (char_length(item_name) between 1 and 120),
  supplier      text not null check (char_length(supplier) between 1 and 120),
  supplier_type text not null check (supplier_type in ('distributor', 'wholesale', 'local', 'other')),
  unit          text not null check (char_length(unit) between 1 and 20),
  unit_cost     numeric(12,4) not null check (unit_cost >= 0),
  low_cost      numeric(12,4) check (low_cost >= 0),   -- estimates: the usual range
  high_cost     numeric(12,4) check (high_cost >= 0),
  source        text not null check (source in ('invoice', 'receipt', 'quote', 'estimate')),
  observed_on   date not null default current_date,
  note          text check (char_length(note) <= 500),
  created_at    timestamptz not null default now()
);
create index if not exists price_points_by_item on public.price_points (restaurant_id, ingredient_id, observed_on desc);

-- Owners see and change only their own restaurants' prices.
alter table public.price_points enable row level security;
drop policy if exists "own price points" on public.price_points;
create policy "own price points" on public.price_points
  for all to authenticated
  using (public.owns_restaurant(restaurant_id))
  with check (public.owns_restaurant(restaurant_id));

grant select, insert, update, delete on public.price_points to authenticated;
