-- =====================================================================
-- The Line — database setup
-- Paste this whole file into Supabase → SQL Editor → New query → Run.
-- It is safe to run on a brand-new project. (Running it twice will
-- error with "already exists" — that just means it's already done.)
-- =====================================================================

-- ---------- 1. Restaurants -------------------------------------------
-- One row per restaurant. Each restaurant belongs to the account that
-- created it (owner_id is filled in automatically from the login).
create table public.restaurants (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 100),
  target_low  numeric(5,2) not null default 28 check (target_low  between 0 and 100),
  target_mid  numeric(5,2) not null default 32 check (target_mid  between 0 and 100),
  target_high numeric(5,2) not null default 35 check (target_high between 0 and 100),
  created_at  timestamptz not null default now(),
  check (target_low <= target_mid and target_mid <= target_high)
);
create index on public.restaurants (owner_id);

-- ---------- 2. Ingredients (with current price) ----------------------
create table public.ingredients (
  id            uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  name          text not null check (char_length(name) between 1 and 100),
  unit          text not null default 'oz' check (char_length(unit) between 1 and 20),
  cost          numeric(10,4) not null check (cost >= 0),
  updated_at    timestamptz not null default now(),
  unique (restaurant_id, name),
  unique (id, restaurant_id)
);

-- ---------- 3. Dishes (menu items) ------------------------------------
create table public.dishes (
  id            uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  name          text not null check (char_length(name) between 1 and 100),
  category      text not null default '',
  price         numeric(10,2) not null check (price > 0),
  sort_order    int not null default 0,
  created_at    timestamptz not null default now(),
  unique (restaurant_id, name),
  unique (id, restaurant_id)
);

-- ---------- 4. Recipe lines (which ingredients, how much) ------------
-- The two-column foreign keys guarantee a recipe can only use
-- ingredients from the SAME restaurant as the dish.
create table public.dish_items (
  id            uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  dish_id       uuid not null,
  ingredient_id uuid not null,
  qty           numeric(10,3) not null check (qty > 0),
  unique (dish_id, ingredient_id),
  foreign key (dish_id, restaurant_id)       references public.dishes(id, restaurant_id)      on delete cascade,
  foreign key (ingredient_id, restaurant_id) references public.ingredients(id, restaurant_id) on delete restrict
);
create index on public.dish_items (restaurant_id);

-- ---------- 5. Weekly sales (plates sold per dish per week) ----------
create table public.weekly_sales (
  id            uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  dish_id       uuid not null,
  week_start    date not null,               -- the Monday of that week
  units         int  not null check (units >= 0),
  unique (dish_id, week_start),
  foreign key (dish_id, restaurant_id) references public.dishes(id, restaurant_id) on delete cascade
);
create index on public.weekly_sales (restaurant_id, week_start);

-- ---------- 6. Saved what-if scenarios -------------------------------
-- adjustments looks like: {"<ingredient id>": 15, "<ingredient id>": -10}
create table public.scenarios (
  id            uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  name          text not null check (char_length(name) between 1 and 100),
  adjustments   jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);
create index on public.scenarios (restaurant_id);

-- =====================================================================
-- SECURITY: Row Level Security (RLS)
-- This is what keeps Restaurant A from seeing Restaurant B's data.
-- Every table is locked; a logged-in user can only touch rows that
-- belong to a restaurant they own.
-- =====================================================================

create or replace function public.owns_restaurant(rid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.restaurants r
    where r.id = rid and r.owner_id = (select auth.uid())
  );
$$;

alter table public.restaurants  enable row level security;
alter table public.ingredients  enable row level security;
alter table public.dishes       enable row level security;
alter table public.dish_items   enable row level security;
alter table public.weekly_sales enable row level security;
alter table public.scenarios    enable row level security;

create policy "own restaurants" on public.restaurants
  for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy "own ingredients" on public.ingredients
  for all to authenticated
  using (public.owns_restaurant(restaurant_id))
  with check (public.owns_restaurant(restaurant_id));

create policy "own dishes" on public.dishes
  for all to authenticated
  using (public.owns_restaurant(restaurant_id))
  with check (public.owns_restaurant(restaurant_id));

create policy "own dish items" on public.dish_items
  for all to authenticated
  using (public.owns_restaurant(restaurant_id))
  with check (public.owns_restaurant(restaurant_id));

create policy "own weekly sales" on public.weekly_sales
  for all to authenticated
  using (public.owns_restaurant(restaurant_id))
  with check (public.owns_restaurant(restaurant_id));

create policy "own scenarios" on public.scenarios
  for all to authenticated
  using (public.owns_restaurant(restaurant_id))
  with check (public.owns_restaurant(restaurant_id));

-- Let logged-in users reach these tables through the website's API
-- (RLS above still decides WHICH rows they see). Logged-out visitors
-- get nothing.
grant usage on schema public to authenticated;
grant select, insert, update, delete on
  public.restaurants, public.ingredients, public.dishes,
  public.dish_items, public.weekly_sales, public.scenarios
  to authenticated;
revoke all on
  public.restaurants, public.ingredients, public.dishes,
  public.dish_items, public.weekly_sales, public.scenarios
  from anon;
grant execute on function public.owns_restaurant(uuid) to authenticated;

-- ---------- "Delete my account" (Settings → Delete my account) -------
-- Deletes only the signed-in user's own login; their restaurants and
-- everything in them go with it.
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
