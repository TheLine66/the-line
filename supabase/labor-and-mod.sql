-- =====================================================================
-- The Line — Labor Costs + MOD Report add-on
-- Already ran schema.sql? Paste THIS file into Supabase → SQL Editor →
-- New query → Run. (It's safe to run more than once.)
-- =====================================================================

-- ---------- Labor targets on each restaurant -------------------------
alter table public.restaurants
  add column if not exists labor_low    numeric(5,2) not null default 25 check (labor_low    between 0 and 100),
  add column if not exists labor_mid    numeric(5,2) not null default 28 check (labor_mid    between 0 and 100),
  add column if not exists labor_high   numeric(5,2) not null default 32 check (labor_high   between 0 and 100),
  add column if not exists labor_burden numeric(5,2) not null default 10 check (labor_burden between 0 and 100);

-- ---------- Team members ---------------------------------------------
-- rate = dollars per hour (hourly) or dollars per week (salary).
create table if not exists public.staff (
  id            uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  name          text not null check (char_length(name) between 1 and 100),
  role          text not null default '' check (char_length(role) <= 40),
  department    text not null default 'FOH' check (department in ('FOH', 'BOH', 'Mgmt')),
  pay_type      text not null default 'hourly' check (pay_type in ('hourly', 'salary')),
  rate          numeric(10,2) not null check (rate >= 0),
  active        boolean not null default true,
  created_at    timestamptz not null default now(),
  unique (id, restaurant_id)
);
create index if not exists staff_restaurant_idx on public.staff (restaurant_id);

-- ---------- Hours worked per person per week -------------------------
create table if not exists public.labor_hours (
  id            uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  staff_id      uuid not null,
  week_start    date not null,               -- the Monday of that week
  hours         numeric(6,2) not null check (hours between 0 and 168),
  unique (staff_id, week_start),
  foreign key (staff_id, restaurant_id) references public.staff(id, restaurant_id) on delete cascade
);
create index if not exists labor_hours_restaurant_idx on public.labor_hours (restaurant_id, week_start);

-- ---------- Manager-on-duty (MOD) shift reports ----------------------
-- One report per restaurant, date and shift. Everything the manager
-- fills in (weather, covers by hour, issues, comps, forecast…) lives in
-- the "data" column.
create table if not exists public.mod_reports (
  id            uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  report_date   date not null,
  shift         text not null check (char_length(shift) between 1 and 30),
  manager       text not null default '' check (char_length(manager) <= 100),
  data          jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (restaurant_id, report_date, shift)
);

-- ---------- Security: only a restaurant's owner can see or change these
alter table public.staff       enable row level security;
alter table public.labor_hours enable row level security;
alter table public.mod_reports enable row level security;

drop policy if exists "own staff" on public.staff;
create policy "own staff" on public.staff
  for all to authenticated
  using (public.owns_restaurant(restaurant_id))
  with check (public.owns_restaurant(restaurant_id));

drop policy if exists "own labor hours" on public.labor_hours;
create policy "own labor hours" on public.labor_hours
  for all to authenticated
  using (public.owns_restaurant(restaurant_id))
  with check (public.owns_restaurant(restaurant_id));

drop policy if exists "own mod reports" on public.mod_reports;
create policy "own mod reports" on public.mod_reports
  for all to authenticated
  using (public.owns_restaurant(restaurant_id))
  with check (public.owns_restaurant(restaurant_id));

grant select, insert, update, delete on public.staff, public.labor_hours, public.mod_reports to authenticated;
revoke all on public.staff, public.labor_hours, public.mod_reports from anon;

-- Done! You should see "Success. No rows returned".
