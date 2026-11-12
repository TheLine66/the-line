-- =====================================================================
-- The Line: refresh the sample use-by dates for Kelley's
-- Run this in Supabase -> SQL Editor -> New query whenever the sample
-- walk-in has gone "spoiled". It sets every Kelley's ingredient's use-by
-- date to count from today again (the soonest is tomorrow), and fills in
-- the amount on hand if it's blank. Safe to run as many times as you like.
-- =====================================================================

-- 1. The sample ingredients: (name, amount on hand, days until use-by)
update public.ingredients i
set use_by  = current_date + s.days,
    on_hand = coalesce(i.on_hand, s.on_hand)
from (values
  ('Butter lettuce', 16, 1),
  ('Guinness beer batter', 40, 1),
  ('Atlantic cod fillet', 60, 2),
  ('Heavy cream', 64, 2),
  ('Colcannon mash', 60, 2),
  ('Tomato', 24, 2),
  ('Brown soda bread', 40, 2),
  ('Ground chuck (80/20)', 80, 3),
  ('Ground lamb', 35, 3),
  ('Hand-cut chips', 150, 3),
  ('Chives', 4, 3),
  ('Mushy peas', 40, 3),
  ('Bavarian soft pretzel', 24, 3),
  ('Chicken wings', 90, 4),
  ('Leeks', 30, 4),
  ('Blue cheese dip', 24, 4),
  ('Onion gravy', 30, 4),
  ('Potato bun', 36, 4),
  ('Sticky toffee sponge', 18, 4),
  ('Root vegetable mix', 80, 5),
  ('Tartar sauce', 30, 5),
  ('Beer cheese', 30, 5),
  ('Caramelized onions', 20, 5),
  ('Chicken stock', 160, 5),
  ('Marbled rye bread (2 slices)', 20, 5),
  ('Lamb shank', 8, 6),
  ('Celery sticks', 30, 6),
  ('Whole-grain mustard cream', 20, 6),
  ('Pork bangers', 50, 7),
  ('Chip-shop curry sauce', 36, 7),
  ('Corned beef brisket', 70, 9),
  ('Lemon', 20, 9),
  ('Irish bacon rashers', 24, 10),
  ('Kelley''s pub sauce', 32, 10),
  ('Yukon gold potatoes', 200, 14),
  ('Toffee sauce', 30, 14),
  ('Egg', 36, 18),
  ('Swiss cheese', 20, 21),
  ('Guinness BBQ sauce', 40, 21),
  ('Aged Irish cheddar', 40, 25),
  ('Sauerkraut', 48, 30),
  ('Vanilla ice cream', 96, 60),
  ('Guinness stout (kitchen)', 128, 60),
  ('Panko breadcrumbs', 64, 120)
) as s(name, on_hand, days)
where i.name = s.name
  and i.restaurant_id in (select id from public.restaurants where name = 'Kelley''s');

-- 2. Anything else at Kelley's with a use-by date before tomorrow moves to tomorrow.
update public.ingredients
set use_by = current_date + 1
where use_by < current_date + 1
  and restaurant_id in (select id from public.restaurants where name = 'Kelley''s');

-- 3. Check: the soonest use-by dates (none should be before tomorrow).
select i.name, i.on_hand, i.use_by
from public.ingredients i
join public.restaurants r on r.id = i.restaurant_id
where r.name = 'Kelley''s' and i.use_by is not null
order by i.use_by, i.name
limit 10;
