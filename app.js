// =====================================================================
// The Line — app logic
// Talks to Supabase (database + logins). Each account owns one or more
// restaurants; the database's security rules (see supabase/schema.sql)
// make sure nobody can see another account's restaurants.
// =====================================================================
"use strict";

const $ = (id) => document.getElementById(id);
const cfg = window.APP_CONFIG || {};

// ---------------------------------------------------------------- utils
const SCREENS = ["boot", "setupNeeded", "authScreen", "onboardScreen", "appScreen"];
function show(id) { SCREENS.forEach((s) => $(s).classList.toggle("hidden", s !== id)); }

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function fmt(n) { return "$" + Number(n).toFixed(2); }
function fmt0(n) { return "$" + Number(n).toLocaleString(undefined, { maximumFractionDigits: 0 }); }
function fmtPct(n) { return Number(n).toFixed(1) + "%"; }
function trimNum(n) { return String(Number(Number(n).toFixed(3))); }

let toastTimer;
function toast(msg, kind = "ok") {
  const t = $("toast");
  t.textContent = msg;
  t.className = "toast show " + kind;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.className = "toast"), kind === "err" ? 6000 : 2500);
}

function friendlyError(err) {
  if (!err) return "Something went wrong.";
  const code = err.code || "";
  if (code === "23505") return "That name is already used. Pick a different one.";
  if (code === "23503") return "That item is still used somewhere (for example, in a recipe). Remove it there first.";
  if (code === "23514") return "One of the numbers isn't allowed (check for negatives or blanks).";
  if (code === "42501" || /row-level security/i.test(err.message || "")) return "Permission denied — try signing out and back in.";
  if (code === "42P01" || /does not exist|schema cache/i.test(err.message || "")) return "The database tables are missing. Did you run supabase/schema.sql?";
  if (/Failed to fetch|NetworkError/i.test(err.message || "")) return "Can't reach the database. Check your internet, and check config.js.";
  return err.message || String(err);
}

// Runs a Supabase request. Shows an error toast and throws if it fails.
async function run(request) {
  const { data, error } = await request;
  if (error) { toast(friendlyError(error), "err"); throw error; }
  return data;
}

function safeGet(k) { try { return localStorage.getItem(k); } catch { return null; } }
function safeSet(k, v) { try { localStorage.setItem(k, v); } catch { /* ignore */ } }

// Dates: weeks are keyed by their Monday, as "YYYY-MM-DD" (local time).
function parseDay(s) { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); }
function dayStr(dt) {
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}
function mondayOf(dt) {
  const d = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
}
function addDays(s, n) { const d = parseDay(s); d.setDate(d.getDate() + n); return dayStr(d); }
function fmtDay(s) { return parseDay(s).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }); }
function fmtWeek(s) { return "Week of " + fmtDay(s); }
function weekPhrase(s) { return "week of " + fmtDay(s); }

// ---------------------------------------------------------------- state
let sb = null;            // Supabase client
let user = null;          // logged-in user
let restaurants = [];     // all restaurants this user owns
let rest = null;          // the restaurant being viewed

let ingredients = new Map();   // id -> {id, name, unit, cost}
let dishes = [];               // [{id, name, category, price, sort_order, items:[{ingredient_id, qty}]}]
let salesByWeek = new Map();   // "YYYY-MM-DD" -> Map(dishId -> units)
let scenarios = [];

let selectedWeek = null;       // week used by Cost Tracker + Performance
let salesWeek = dayStr(mondayOf(new Date()));  // week shown on the Sales tab
let priceMultipliers = {};     // ingredientId -> multiplier (what-if)
let adjustments = {};          // ingredientId -> signed % (what-if)
let selectedDishId = null;     // Cost Tracker
let editingDishId = null;      // Recipes ("new" for a new dish)
let draft = null;              // working copy of the dish being edited
let draftDirty = false;
let activePage = "cost";
let sign = 1;
let authMode = "signin";

const targets = () => ({ low: Number(rest.target_low), mid: Number(rest.target_mid), high: Number(rest.target_high) });

// ================================================================ STARTUP
document.addEventListener("DOMContentLoaded", () => {
  const configured = cfg.SUPABASE_URL && cfg.SUPABASE_KEY &&
    !cfg.SUPABASE_URL.includes("PASTE_") && !cfg.SUPABASE_KEY.includes("PASTE_");
  if (!window.supabase) {
    $("setupMsg").textContent = "Couldn't load the Supabase library. Check your internet connection and reload.";
    show("setupNeeded");
    return;
  }
  if (!configured) { show("setupNeeded"); return; }
  const url = cleanSupabaseUrl(cfg.SUPABASE_URL);
  if (!url) {
    $("setupMsg").innerHTML = `The Project URL in <code>config.js</code> doesn't look right. It should look like <code>https://abcdefgh.supabase.co</code>, with nothing after <code>.supabase.co</code>. You currently have: <code>${esc(cfg.SUPABASE_URL)}</code>`;
    show("setupNeeded");
    return;
  }
  init(url).catch((e) => { console.error(e); toast(friendlyError(e), "err"); });
});

// Accepts the many ways people paste their Supabase address and returns
// just "https://<project>.supabase.co". Returns null if it can't tell.
function cleanSupabaseUrl(raw) {
  let s = String(raw || "").trim().replace(/^["'<\s]+|["'>\s]+$/g, "");
  if (!/^https?:\/\//i.test(s)) s = "https://" + s;
  let u;
  try { u = new URL(s); } catch { return null; }
  const host = u.hostname.toLowerCase();
  // Pasted the dashboard link, e.g. https://supabase.com/dashboard/project/abcdefgh/settings/api
  const dash = u.pathname.match(/\/project\/([a-z0-9]{10,})/i);
  if ((host === "supabase.com" || host.endsWith(".supabase.com")) && dash) return `https://${dash[1].toLowerCase()}.supabase.co`;
  // Normal project address, possibly with /rest/v1/ or a trailing slash: keep only the start.
  if (host.endsWith(".supabase.co") || host.endsWith(".supabase.in")) return `https://${host}`;
  // Self-hosted or custom domain: keep scheme + host + port only.
  if (host.includes(".")) return u.origin;
  return null;
}

async function init(url) {
  sb = window.supabase.createClient(url, cfg.SUPABASE_KEY.trim());
  wireControls();
  const { data } = await sb.auth.getSession();
  await handleSession(data.session);
  sb.auth.onAuthStateChange((event, session) => {
    // setTimeout avoids calling Supabase from inside its own callback.
    if (event === "SIGNED_OUT") setTimeout(() => handleSession(null), 0);
    else if (event === "SIGNED_IN" && session?.user?.id !== user?.id) setTimeout(() => handleSession(session), 0);
  });
}

async function handleSession(session) {
  user = session?.user || null;
  rest = null;
  resetWhatIf();
  if (!user) { show("authScreen"); return; }
  $("userEmail").textContent = user.email || "";
  try { await loadRestaurants(); }
  catch (e) { console.error(e); show("onboardScreen"); $("onboardMsg").textContent = friendlyError(e); }
}

async function loadRestaurants(preferId) {
  restaurants = await run(sb.from("restaurants").select("*").order("created_at"));
  if (!restaurants.length) { openOnboarding(false); return; }
  const want = preferId || safeGet("line.restaurant");
  const pick = restaurants.find((r) => r.id === want) || restaurants[0];
  await selectRestaurant(pick.id);
}

async function selectRestaurant(id) {
  rest = restaurants.find((r) => r.id === id);
  safeSet("line.restaurant", id);
  resetWhatIf();
  selectedWeek = null;
  selectedDishId = null;
  editingDishId = null;
  draft = null; draftDirty = false;
  await loadRestaurantData();
  renderRestaurantSelect();
  show("appScreen");
  render();
}

async function loadRestaurantData() {
  const rid = rest.id;
  const results = await Promise.all([
    sb.from("ingredients").select("id,name,unit,cost").eq("restaurant_id", rid).order("name"),
    sb.from("dishes").select("id,name,category,price,sort_order").eq("restaurant_id", rid).order("sort_order").order("created_at"),
    sb.from("dish_items").select("dish_id,ingredient_id,qty").eq("restaurant_id", rid),
    sb.from("weekly_sales").select("dish_id,week_start,units").eq("restaurant_id", rid).order("week_start", { ascending: false }),
    sb.from("scenarios").select("id,name,adjustments").eq("restaurant_id", rid).order("created_at"),
  ]);
  for (const r of results) if (r.error) { toast(friendlyError(r.error), "err"); throw r.error; }
  const [ing, dsh, items, sales, scen] = results.map((r) => r.data);

  ingredients = new Map(ing.map((i) => [i.id, { ...i, cost: Number(i.cost) }]));
  dishes = dsh.map((d) => ({
    ...d,
    price: Number(d.price),
    items: items.filter((it) => it.dish_id === d.id).map((it) => ({ ingredient_id: it.ingredient_id, qty: Number(it.qty) })),
  }));
  salesByWeek = new Map();
  for (const s of sales) {
    if (!salesByWeek.has(s.week_start)) salesByWeek.set(s.week_start, new Map());
    salesByWeek.get(s.week_start).set(s.dish_id, s.units);
  }
  scenarios = scen;

  // Drop what-if changes for ingredients that no longer exist.
  for (const k of Object.keys(adjustments)) if (!ingredients.has(k)) { delete adjustments[k]; delete priceMultipliers[k]; }
  if (!selectedWeek || !salesByWeek.has(selectedWeek)) selectedWeek = sortedWeeks()[0] || null;
  if (!dishes.some((d) => d.id === selectedDishId)) selectedDishId = dishes[0]?.id || null;
}

function sortedWeeks() { return [...salesByWeek.keys()].sort().reverse(); }

// Copies the sample menu (seed-data.js) into a new restaurant.
async function seedRestaurant(rid, key) {
  const S = (window.SEEDS || {})[key];
  if (!S) return;
  const keys = Object.keys(S.ingredients);
  const ingRows = await run(sb.from("ingredients").insert(keys.map((k) => ({ restaurant_id: rid, ...S.ingredients[k] }))).select("id,name"));
  const ingIdByName = new Map(ingRows.map((r) => [r.name, r.id]));
  const ingId = (k) => ingIdByName.get(S.ingredients[k].name);

  const dishRows = await run(sb.from("dishes").insert(S.dishes.map((d, i) => ({
    restaurant_id: rid, name: d.name, category: d.category, price: d.price, sort_order: i,
  }))).select("id,name"));
  const dishIdByName = new Map(dishRows.map((r) => [r.name, r.id]));

  await run(sb.from("dish_items").insert(S.dishes.flatMap((d) => d.items.map(([k, q]) => ({
    restaurant_id: rid, dish_id: dishIdByName.get(d.name), ingredient_id: ingId(k), qty: q,
  })))));

  const thisMonday = dayStr(mondayOf(new Date()));
  const n = S.weekFactors.length;
  const sales = [];
  S.weekFactors.forEach((f, w) => {
    const week = addDays(thisMonday, -7 * (n - w));  // the last n finished weeks
    S.dishes.forEach((d) => sales.push({
      restaurant_id: rid, dish_id: dishIdByName.get(d.name), week_start: week, units: Math.round(d.weeklyUnits * f),
    }));
  });
  await run(sb.from("weekly_sales").insert(sales));

  // Pre-saved what-if scenarios: translate ingredient keys into real ids.
  if (S.scenarios?.length) {
    await run(sb.from("scenarios").insert(S.scenarios.map((sc) => ({
      restaurant_id: rid, name: sc.name,
      adjustments: Object.fromEntries(Object.entries(sc.adjustments).map(([k, v]) => [ingId(k), v]).filter(([id]) => id)),
    }))));
  }
}

// ================================================================ CALCS
function ingCost(id) { const i = ingredients.get(id); return i ? i.cost * (priceMultipliers[id] || 1) : 0; }
function dishCost(d) { return d.items.reduce((s, it) => s + ingCost(it.ingredient_id) * it.qty, 0); }
function statusOf(pct) { const t = targets(); return pct <= t.low ? "green" : pct <= t.high ? "amber" : "red"; }
function statusLabel(s) { return s === "green" ? "On target" : s === "amber" ? "Trending high" : "Over target"; }
function unitsFor(dishId) { return salesByWeek.get(selectedWeek)?.get(dishId) || 0; }

function computeAll() {
  return dishes.map((d) => {
    const cost = dishCost(d);
    const pct = (cost / d.price) * 100;
    const units = unitsFor(d.id);
    const marginPerPlate = d.price - cost;
    return {
      d, cost, pct, units, status: statusOf(pct), marginPerPlate,
      weeklyRevenue: d.price * units, weeklyMargin: marginPerPlate * units,
    };
  });
}

// ================================================================ RENDER
function render() {
  if (!rest) return;
  document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("active", t.dataset.page === activePage));
  document.querySelectorAll(".page").forEach((p) => p.classList.toggle("active", p.id === "page-" + activePage));
  $("simbar").classList.toggle("hidden", !(activePage === "cost" || activePage === "perf"));
  renderWeekSelect();
  populateIngredientSelect();
  renderScenarioSelect();
  renderActiveAdj();
  if (activePage === "cost") { renderMetrics(); renderDishList(); renderPanel(); }
  else if (activePage === "perf") renderPerf();
  else if (activePage === "sales") renderSales();
  else if (activePage === "ingredients") renderIngredients();
  else if (activePage === "recipes") renderRecipes();
}

function renderRestaurantSelect() {
  $("restaurantSelect").innerHTML =
    restaurants.map((r) => `<option value="${r.id}" ${r.id === rest?.id ? "selected" : ""}>${esc(r.name)}</option>`).join("") +
    `<option value="__new">+ Add another restaurant</option>`;
}

function renderWeekSelect() {
  const sel = $("weekSelect");
  const weeks = sortedWeeks();
  sel.disabled = !weeks.length;
  sel.innerHTML = weeks.length
    ? weeks.map((w) => `<option value="${w}" ${w === selectedWeek ? "selected" : ""}>${fmtWeek(w)}</option>`).join("")
    : `<option value="">No sales entered yet</option>`;
}

function populateIngredientSelect() {
  const sel = $("ingredientSelect");
  const prev = sel.value;
  const list = [...ingredients.values()].sort((a, b) => a.name.localeCompare(b.name));
  sel.innerHTML = list.length
    ? list.map((i) => `<option value="${i.id}">${esc(i.name)}</option>`).join("")
    : `<option value="">No ingredients yet</option>`;
  if (ingredients.has(prev)) sel.value = prev;
}

function renderScenarioSelect() {
  const sel = $("scenarioSelect");
  const prev = sel.value;
  sel.innerHTML = `<option value="">${scenarios.length ? "Load a scenario…" : "None saved yet"}</option>` +
    scenarios.map((s) => `<option value="${s.id}">${esc(s.name)}</option>`).join("");
  if (scenarios.some((s) => s.id === prev)) sel.value = prev;
}

function renderActiveAdj() {
  $("activeAdj").innerHTML = Object.keys(adjustments).map((k) => {
    const v = adjustments[k];
    return `<span class="chip ${v > 0 ? "up" : "down"}">${esc(ingredients.get(k)?.name)} ${v > 0 ? "+" : ""}${v}% <button type="button" data-key="${k}" aria-label="Remove">✕</button></span>`;
  }).join("");
}

// ---------------------------------------------------------- Cost Tracker
function renderMetrics() {
  const el = $("metrics");
  if (!dishes.length) { el.innerHTML = ""; return; }
  const t = targets();
  const rows = computeAll();
  const avgPct = rows.reduce((s, r) => s + r.pct, 0) / rows.length;
  const atRisk = rows.filter((r) => r.status !== "green").length;
  const red = rows.filter((r) => r.status === "red").length;
  el.innerHTML = `
    <div class="metric"><div class="num mono">${fmtPct(avgPct)}</div><div class="label">Average food cost across menu</div></div>
    <div class="metric ${atRisk ? "warn" : ""}"><div class="num mono">${atRisk} / ${dishes.length}</div><div class="label">Dishes above target range</div></div>
    <div class="metric ${red ? "warn" : ""}"><div class="num mono">${red}</div><div class="label">Dishes in the red (&gt;${t.high}% cost)</div></div>
    <div class="metric"><div class="num mono">${t.low}–${t.high}%</div><div class="label">Target food cost range</div></div>`;
}

function renderDishList() {
  const el = $("dishList");
  if (!dishes.length) { el.innerHTML = `<div class="rail-empty">No dishes yet.</div>`; return; }
  el.innerHTML = dishes.map((d) => {
    const pct = (dishCost(d) / d.price) * 100;
    const st = statusOf(pct);
    return `<button type="button" class="dish-row ${d.id === selectedDishId ? "selected" : ""}" data-id="${d.id}">
        <span class="dot ${st}"></span>
        <span class="info"><span class="name">${esc(d.name)}</span><span class="cat">${esc(d.category || "Uncategorized")} · ${fmt(d.price)}</span></span>
        <span class="pct mono ${st === "red" ? "up" : ""}">${fmtPct(pct)}</span>
      </button>`;
  }).join("");
}

function suggestedAction(dish, cost, pct) {
  const t = targets();
  if (pct <= t.low) {
    return { ok: true, text: `Healthy margin. This dish is <strong>${fmtPct(t.low - pct)}</strong> below your ${t.low}% target — no action needed.` };
  }
  const idealPrice = cost / (t.mid / 100);
  const delta = idealPrice - dish.price;
  const portionCut = (1 - (dish.price * (t.mid / 100)) / cost) * 100;
  if (pct <= t.high) {
    return { ok: false, text: `Trending high. Raise the price by <strong>${fmt(delta)}</strong> (to ${fmt(idealPrice)}) to bring this back to a ${t.mid}% target — or watch it, since it's still inside range.` };
  }
  return { ok: false, text: `Over target. Raise the price to <strong>${fmt(idealPrice)}</strong> (+${fmt(delta)}), or cut the portion by roughly <strong>${portionCut.toFixed(0)}%</strong> to bring food cost back to ${t.mid}%.` };
}

// A simple bar showing where this dish's food cost sits vs. the target zone.
function targetBar(pct, st) {
  const t = targets();
  const max = Math.max(50, Math.ceil((Math.max(pct, t.high) + 6) / 10) * 10);
  const at = (v) => Math.min(100, Math.max(0, (v / max) * 100)).toFixed(2);
  const zoneMid = ((t.low + t.high) / 2 / max) * 100;
  return `
    <div class="gauge" role="img" aria-label="Food cost ${fmtPct(pct)}; target ${t.low} to ${t.high} percent">
      <div class="gauge-track">
        <div class="gauge-zone" style="left:${at(t.low)}%;width:${(at(t.high) - at(t.low)).toFixed(2)}%"></div>
        <div class="gauge-mark ${st}" style="left:${at(pct)}%"><span>${fmtPct(pct)}</span></div>
      </div>
      <div class="gauge-scale">
        <span style="left:0">0%</span>
        <span class="zone-label" style="left:${zoneMid.toFixed(2)}%">Target ${t.low}–${t.high}%</span>
        <span style="right:0">${max}%</span>
      </div>
    </div>`;
}

function renderPanel() {
  const el = $("panel");
  const dish = dishes.find((d) => d.id === selectedDishId);
  if (!dish) {
    el.className = "panel empty";
    el.innerHTML = `<h2>No dishes yet</h2><p>Add ingredients and build your first recipe, and the cost math shows up here.</p>
      <button class="applybtn" data-goto="recipes" type="button">Go to Recipes</button>`;
    return;
  }
  el.className = "panel";
  const t = targets();
  const cost = dishCost(dish);
  const pct = (cost / dish.price) * 100;
  const st = statusOf(pct);
  const action = suggestedAction(dish, cost, pct);
  const units = unitsFor(dish.id);
  const soldText = selectedWeek ? `${units} sold ${weekPhrase(selectedWeek)}` : "no sales entered";

  const rows = dish.items.map((it) => {
    const ing = ingredients.get(it.ingredient_id);
    const m = priceMultipliers[it.ingredient_id] || 1;
    const cls = m > 1 ? "bumped" : m < 1 ? "dropped" : "";
    return `<tr class="${cls}"><td class="ingname">${esc(ing?.name)}</td><td class="num mono">${trimNum(it.qty)} ${esc(ing?.unit)}</td><td class="num mono cost">${fmt(ingCost(it.ingredient_id) * it.qty)}</td></tr>`;
  }).join("") || `<tr><td colspan="3" class="muted">No ingredients in this recipe yet.</td></tr>`;

  el.innerHTML = `
    <div class="panel-head">
      <div><h2>${esc(dish.name)}</h2><div class="cat">${esc(dish.category || "Uncategorized")} · Menu price ${fmt(dish.price)} · ${soldText}</div></div>
      <span class="status-chip ${st}">${statusLabel(st)}</span>
    </div>
    <div class="cost-summary">
      <div><div class="val mono ${st === "red" ? "rust" : ""}">${fmt(cost)}</div><div class="lbl">Recipe cost</div></div>
      <div><div class="val mono ${st === "red" ? "rust" : ""}">${fmtPct(pct)}</div><div class="lbl">Food cost % (target ${t.low}–${t.high}%)</div></div>
      <div><div class="val mono">${fmt(dish.price - cost)}</div><div class="lbl">Gross margin per plate</div></div>
    </div>
    ${targetBar(pct, st)}
    <div class="section-label">Recipe breakdown</div>
    <table class="ingredients">
      <thead><tr><th>Ingredient</th><th class="num">Qty</th><th class="num">Cost</th></tr></thead>
      <tbody>${rows}</tbody>
      <tfoot><tr><td>Total</td><td></td><td class="num mono">${fmt(cost)}</td></tr></tfoot>
    </table>
    <div class="section-label">Suggested action</div>
    <div class="action-box ${action.ok ? "ok" : ""}"><div class="tag">${action.ok ? "No action needed" : "Margin at risk"}</div><p>${action.text}</p></div>
    <p><button class="linkbtn" data-edit-dish="${dish.id}" type="button">Edit this recipe</button></p>`;
}

// ---------------------------------------------------------- Performance
function quadrantOf(units, margin, avgUnits, avgMargin) {
  const hiPop = units >= avgUnits, hiMar = margin >= avgMargin;
  return hiPop && hiMar ? "star" : hiPop ? "plowhorse" : hiMar ? "puzzle" : "dog";
}
const qLabel = { star: "Star", plowhorse: "Plowhorse", puzzle: "Puzzle", dog: "Dog" };

function renderPerf() {
  const rows = computeAll();
  const totalUnits = rows.reduce((s, r) => s + r.units, 0);
  const empty = !dishes.length || !selectedWeek || totalUnits === 0;
  $("perfWrap").classList.toggle("hidden", empty);
  $("perfEmpty").classList.toggle("hidden", !empty);
  if (empty) return;

  const t = targets();
  const totalRevenue = rows.reduce((s, r) => s + r.weeklyRevenue, 0);
  const totalMargin = rows.reduce((s, r) => s + r.weeklyMargin, 0);
  const weightedPct = (rows.reduce((s, r) => s + r.cost * r.units, 0) / totalRevenue) * 100;
  const avgUnits = totalUnits / rows.length;
  const avgMargin = rows.reduce((s, r) => s + r.marginPerPlate, 0) / rows.length;

  $("perfMetrics").innerHTML = `
    <div class="metric"><div class="num mono">${fmt0(totalRevenue)}</div><div class="label">Revenue, ${weekPhrase(selectedWeek)}</div></div>
    <div class="metric good"><div class="num mono">${fmt0(totalMargin)}</div><div class="label">Gross margin, full menu</div></div>
    <div class="metric"><div class="num mono">${fmtPct(weightedPct)}</div><div class="label">Volume-weighted food cost %</div></div>
    <div class="metric"><div class="num mono">${avgUnits.toFixed(0)}</div><div class="label">Average units sold / dish</div></div>`;

  const byMargin = [...rows].sort((a, b) => b.weeklyMargin - a.weeklyMargin);
  const over = byMargin.filter((r) => r.status !== "green" && r.units > 0);
  if (over.length) {
    const top = over[0];
    const rank = byMargin.indexOf(top) + 1;
    const diff = top.pct - t.mid;
    const vsMid = diff >= 0 ? `running ${diff.toFixed(1)} points over your ${t.mid}% target food cost` : `above your ${t.low}% comfort line`;
    $("callout").innerHTML = `
      <div class="tag">Cost % vs. dollars — the real tradeoff</div>
      <p><strong>${esc(top.d.name)}</strong> is ${vsMid}, but it's your <strong>#${rank} earner by weekly dollar margin</strong> at ${fmt0(top.weeklyMargin)}/week from ${top.units} plates sold. Tightening the recipe or nudging the price even slightly here is worth more in real dollars than fixing a lower-volume dish with a "worse" percentage. That's the gap a percentage-only view misses.</p>`;
  } else {
    $("callout").innerHTML = `<div class="tag">Cost % vs. dollars</div><p>Every dish that sold this week is within your target food cost range — no percentage-vs-volume tradeoffs to flag.</p>`;
  }
  renderQuadrantChart(rows, avgUnits, avgMargin);
  renderPerfTable(byMargin, totalMargin, avgUnits, avgMargin);
}

function renderQuadrantChart(rows, avgUnits, avgMargin) {
  const W = 680, H = 380, PAD = 46;
  const maxUnits = Math.max(1, ...rows.map((r) => r.units)) * 1.1;
  const maxMargin = Math.max(1, ...rows.map((r) => r.marginPerPlate)) * 1.15;
  const minMargin = Math.min(0, Math.min(...rows.map((r) => r.marginPerPlate)) * 1.15);
  const maxRevenue = Math.max(1, ...rows.map((r) => r.weeklyRevenue));
  const x = (u) => PAD + (u / maxUnits) * (W - PAD * 2);
  const y = (m) => H - PAD - ((m - minMargin) / (maxMargin - minMargin)) * (H - PAD * 2);
  const color = { green: "var(--sage)", amber: "var(--amber)", red: "var(--rust)" };
  const ax = x(avgUnits).toFixed(1), ay = y(avgMargin).toFixed(1);

  // Only the 6 biggest sellers get a name label, so the chart stays readable.
  // Hover (or tap) any bubble to see its name.
  // Labels that would overlap one already placed are skipped.
  const labeled = new Set();
  const boxes = [];
  for (const r of [...rows].filter((r) => r.units > 0).sort((a, b) => b.weeklyRevenue - a.weeklyRevenue).slice(0, 6)) {
    const name = r.d.name.length > 22 ? 22 : r.d.name.length;
    const w = name * 6 + 6, cx = x(r.units), top = y(r.marginPerPlate) - (6 + (r.weeklyRevenue / maxRevenue) * 16) - 17;
    const box = { l: cx - w / 2, r: cx + w / 2, t: top, b: top + 14 };
    if (boxes.some((o) => box.l < o.r && box.r > o.l && box.t < o.b && box.b > o.t)) continue;
    boxes.push(box); labeled.add(r.d.id);
  }
  const points = rows.map((r) => {
    const cx = x(r.units), cy = y(r.marginPerPlate);
    const rad = 6 + (r.weeklyRevenue / maxRevenue) * 16;
    const label = r.d.name.length > 22 ? r.d.name.slice(0, 21) + "…" : r.d.name;
    const text = labeled.has(r.d.id) ? `<text x="${cx.toFixed(1)}" y="${(cy - rad - 5).toFixed(1)}" font-size="10.5" font-weight="600" font-family="Figtree, system-ui, sans-serif" fill="#1C2421" fill-opacity="0.8" text-anchor="middle">${esc(label)}</text>` : "";
    return `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${rad.toFixed(1)}" fill="${color[r.status]}" fill-opacity="0.82" stroke="#1C2421" stroke-opacity="0.15"><title>${esc(r.d.name)}: ${r.units} sold, ${fmt(r.marginPerPlate)} margin/plate</title></circle>
      ${text}`;
  }).join("");

  const lbl = (xx, yy, fill, anchor, text) =>
    `<text x="${xx}" y="${yy}" font-size="11" font-family="Figtree, system-ui, sans-serif" fill="${fill}" text-anchor="${anchor}" font-weight="600">${text}</text>`;
  $("quadrantChart").innerHTML = `
    <svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;display:block" role="img" aria-label="Popularity versus profitability chart">
      <line x1="${PAD}" y1="${H - PAD}" x2="${W - PAD}" y2="${H - PAD}" stroke="#1C2421" stroke-opacity="0.25"/>
      <line x1="${PAD}" y1="${PAD - 10}" x2="${PAD}" y2="${H - PAD}" stroke="#1C2421" stroke-opacity="0.25"/>
      <line x1="${ax}" y1="${PAD - 10}" x2="${ax}" y2="${H - PAD}" stroke="#1C2421" stroke-opacity="0.15" stroke-dasharray="4 4"/>
      <line x1="${PAD}" y1="${ay}" x2="${W - PAD}" y2="${ay}" stroke="#1C2421" stroke-opacity="0.15" stroke-dasharray="4 4"/>
      ${lbl(W - PAD, PAD - 16, "#2E7D4F", "end", "Stars: popular and profitable")}
      ${lbl(W - PAD, H - PAD + 22, "#9A6410", "end", "Plowhorses: popular, thinner margin")}
      ${lbl(PAD, PAD - 16, "#5853A3", "start", "Puzzles: profitable, sell more of these")}
      ${lbl(PAD, H - PAD + 22, "#C0402B", "start", "Dogs: slow and thin")}
      <text x="${W / 2}" y="${H - 8}" font-size="11" font-family="Figtree, system-ui, sans-serif" fill="#1C2421" fill-opacity="0.5" text-anchor="middle">Units sold per week →</text>
      <text x="14" y="${H / 2}" font-size="11" font-family="Figtree, system-ui, sans-serif" fill="#1C2421" fill-opacity="0.5" text-anchor="middle" transform="rotate(-90 14 ${H / 2})">Margin $ per plate →</text>
      ${points}
    </svg>`;
}

function renderPerfTable(sorted, totalMargin, avgUnits, avgMargin) {
  const body = sorted.map((r) => {
    const q = quadrantOf(r.units, r.marginPerPlate, avgUnits, avgMargin);
    const share = totalMargin ? (r.weeklyMargin / totalMargin) * 100 : 0;
    return `<tr>
        <td class="dishname"><span class="dot ${r.status}" style="margin-right:8px;vertical-align:middle"></span>${esc(r.d.name)}</td>
        <td class="num mono">${r.units}</td>
        <td class="num mono">${fmt(r.d.price)}</td>
        <td class="num mono">${fmtPct(r.pct)}</td>
        <td class="num mono">${fmt(r.marginPerPlate)}</td>
        <td class="num mono">${fmt0(r.weeklyMargin)}</td>
        <td class="num mono">${share.toFixed(1)}%</td>
        <td class="num"><span class="qtag ${q}">${qLabel[q]}</span></td>
      </tr>`;
  }).join("");
  $("perfTable").innerHTML = `
    <thead><tr><th>Dish</th><th class="num">Units/wk</th><th class="num">Price</th><th class="num">Food cost %</th>
      <th class="num">Margin/plate</th><th class="num">Weekly margin $</th><th class="num">% of total margin</th><th class="num">Type</th></tr></thead>
    <tbody>${body}</tbody>`;
}

// ---------------------------------------------------------- Weekly Sales
function renderSales() {
  $("salesWeek").value = salesWeek;
  const existing = salesByWeek.get(salesWeek);
  $("salesWeekNote").textContent = existing ? "Saved numbers loaded — edit and save again to update." : "Nothing saved for this week yet.";
  if (!dishes.length) {
    $("salesTable").innerHTML = `<tbody><tr><td class="muted">Add dishes on the Recipes tab first.</td></tr></tbody>`;
  } else {
    $("salesTable").innerHTML = `
      <thead><tr><th>Dish</th><th>Category</th><th class="num">Price</th><th class="num">Plates sold</th></tr></thead>
      <tbody>${dishes.map((d) => {
        const v = existing?.get(d.id);
        return `<tr><td>${esc(d.name)}</td><td class="used">${esc(d.category)}</td><td class="num mono">${fmt(d.price)}</td>
          <td class="num"><input class="num mono" type="number" min="0" step="1" inputmode="numeric" data-dish="${d.id}" value="${v ?? ""}" placeholder="—"></td></tr>`;
      }).join("")}</tbody>`;
  }
  updateSalesTotal();

  const weeks = sortedWeeks();
  $("weeksTable").innerHTML = weeks.length ? `
    <thead><tr><th>Week</th><th class="num">Plates</th><th class="num">Revenue</th><th></th></tr></thead>
    <tbody>${weeks.map((w) => {
      const m = salesByWeek.get(w);
      let plates = 0, rev = 0;
      for (const d of dishes) { const u = m.get(d.id) || 0; plates += u; rev += u * d.price; }
      return `<tr><td>${fmtWeek(w)}</td><td class="num mono">${plates}</td><td class="num mono">${fmt0(rev)}</td>
        <td class="num"><button class="linkbtn" data-open-week="${w}" type="button">${w === salesWeek ? "Showing" : "Open"}</button></td></tr>`;
    }).join("")}</tbody>` : `<tbody><tr><td class="muted">No weeks saved yet.</td></tr></tbody>`;
}

function updateSalesTotal() {
  let plates = 0, rev = 0;
  document.querySelectorAll("#salesTable input[data-dish]").forEach((inp) => {
    const u = parseInt(inp.value, 10);
    if (u > 0) { plates += u; rev += u * (dishes.find((d) => d.id === inp.dataset.dish)?.price || 0); }
  });
  $("salesTotal").textContent = `${plates} plates · ${fmt0(rev)} revenue`;
}

async function saveSales() {
  const rows = [];
  for (const inp of document.querySelectorAll("#salesTable input[data-dish]")) {
    if (inp.value.trim() === "") continue;
    const u = Number(inp.value);
    if (!Number.isInteger(u) || u < 0) { toast("Plates sold must be whole numbers, 0 or more.", "err"); inp.focus(); return; }
    rows.push({ restaurant_id: rest.id, dish_id: inp.dataset.dish, week_start: salesWeek, units: u });
  }
  if (!rows.length) { toast("Type at least one number first.", "err"); return; }
  const btn = $("saveSalesBtn");
  btn.disabled = true;
  try {
    await run(sb.from("weekly_sales").upsert(rows, { onConflict: "dish_id,week_start" }));
    selectedWeek = salesWeek;
    await loadRestaurantData();
    selectedWeek = salesWeek;
    render();
    toast(`Saved ${weekPhrase(salesWeek)}.`);
  } catch { /* toast already shown */ } finally { btn.disabled = false; }
}

// ---------------------------------------------------------- Ingredients
function usageMap() {
  const m = new Map();
  for (const d of dishes) for (const it of d.items) {
    if (!m.has(it.ingredient_id)) m.set(it.ingredient_id, []);
    m.get(it.ingredient_id).push(d.name);
  }
  return m;
}

function renderIngredients() {
  const q = $("ingSearch").value.trim().toLowerCase();
  const usage = usageMap();
  const list = [...ingredients.values()].filter((i) => !q || i.name.toLowerCase().includes(q)).sort((a, b) => a.name.localeCompare(b.name));
  if (!ingredients.size) { $("ingTable").innerHTML = `<tbody><tr><td class="muted">No ingredients yet — add one above.</td></tr></tbody>`; return; }
  $("ingTable").innerHTML = `
    <thead><tr><th>Ingredient</th><th>Unit</th><th class="num">Cost per unit ($)</th><th>Used in</th><th></th></tr></thead>
    <tbody>${list.map((i) => {
      const used = usage.get(i.id) || [];
      return `<tr data-row="${i.id}">
        <td><input data-id="${i.id}" data-field="name" value="${esc(i.name)}" maxlength="100" aria-label="Name"></td>
        <td style="width:90px"><input data-id="${i.id}" data-field="unit" value="${esc(i.unit)}" maxlength="20" list="unitList" aria-label="Unit"></td>
        <td class="num" style="width:150px"><input class="num mono" data-id="${i.id}" data-field="cost" type="number" min="0" step="0.01" value="${trimNum(i.cost)}" aria-label="Cost"></td>
        <td class="used" title="${esc(used.join(", "))}">${used.length ? `${used.length} dish${used.length > 1 ? "es" : ""}` : "—"}</td>
        <td class="num"><button class="iconbtn" data-del-ing="${i.id}" type="button" aria-label="Delete ${esc(i.name)}">✕</button></td>
      </tr>`;
    }).join("") || `<tr><td colspan="5" class="muted">Nothing matches "${esc(q)}".</td></tr>`}</tbody>`;
}

async function updateIngredient(input) {
  const id = input.dataset.id, field = input.dataset.field;
  const ing = ingredients.get(id);
  if (!ing) return;
  let val = input.value.trim();
  if (field === "cost") {
    val = Number(val);
    if (input.value.trim() === "" || !Number.isFinite(val) || val < 0) { toast("Cost must be a number, 0 or more.", "err"); input.value = trimNum(ing.cost); return; }
    if (val === ing.cost) return;
  } else {
    if (!val) { toast("That can't be blank.", "err"); input.value = ing[field]; return; }
    if (val === ing[field]) return;
  }
  try {
    const row = await run(sb.from("ingredients").update({ [field]: val, updated_at: new Date().toISOString() }).eq("id", id).select("id,name,unit,cost").single());
    ingredients.set(id, { ...row, cost: Number(row.cost) });
    const tr = input.closest("tr");
    tr.classList.remove("saved"); void tr.offsetWidth; tr.classList.add("saved");
    toast(`Saved ${row.name}.`);
  } catch { input.value = field === "cost" ? trimNum(ing.cost) : ing[field]; }
}

async function addIngredient(e) {
  e.preventDefault();
  const name = $("newIngName").value.trim(), unit = $("newIngUnit").value.trim(), cost = Number($("newIngCost").value);
  if (!name || !unit || !Number.isFinite(cost) || cost < 0) { toast("Fill in a name, unit, and a cost of 0 or more.", "err"); return; }
  try {
    const row = await run(sb.from("ingredients").insert({ restaurant_id: rest.id, name, unit, cost }).select("id,name,unit,cost").single());
    ingredients.set(row.id, { ...row, cost: Number(row.cost) });
    $("newIngName").value = ""; $("newIngCost").value = "";
    $("newIngName").focus();
    renderIngredients();
    toast(`Added ${row.name}.`);
  } catch { /* toast shown */ }
}

async function deleteIngredient(id) {
  const ing = ingredients.get(id);
  const used = usageMap().get(id) || [];
  if (used.length) { toast(`${ing.name} is used in ${used.join(", ")}. Remove it from those recipes first.`, "err"); return; }
  if (!confirm(`Delete "${ing.name}"?`)) return;
  try {
    await run(sb.from("ingredients").delete().eq("id", id));
    ingredients.delete(id);
    delete adjustments[id]; delete priceMultipliers[id];
    renderIngredients();
    toast(`Deleted ${ing.name}.`);
  } catch { /* toast shown */ }
}

// ---------------------------------------------------------- Recipes
function startEditing(id) {
  if (draftDirty && !confirm("You have unsaved changes to this dish. Throw them away?")) return false;
  editingDishId = id;
  if (id === "new") {
    draft = { id: null, name: "", category: "", price: "", items: [{ ingredient_id: "", qty: "" }] };
  } else {
    const d = dishes.find((x) => x.id === id);
    draft = d ? { id: d.id, name: d.name, category: d.category, price: d.price, items: d.items.map((it) => ({ ...it })) } : null;
  }
  draftDirty = false;
  return true;
}

function renderRecipes() {
  if (editingDishId !== "new" && !dishes.some((d) => d.id === editingDishId)) {
    editingDishId = null; draft = null; draftDirty = false;
  }
  if (!draft) {
    if (dishes.length) startEditing(dishes[0].id);
    else startEditing("new");
  }
  $("recipeList").innerHTML = (editingDishId === "new"
    ? `<button type="button" class="dish-row selected"><span class="info"><span class="name">${esc(draft.name) || "New dish"}</span><span class="cat">Not saved yet</span></span></button>` : "") +
    dishes.map((d) => `<button type="button" class="dish-row ${d.id === editingDishId ? "selected" : ""}" data-recipe="${d.id}">
        <span class="info"><span class="name">${esc(d.name)}</span><span class="cat">${esc(d.category || "Uncategorized")} · ${fmt(d.price)} · ${d.items.length} ingredient${d.items.length === 1 ? "" : "s"}</span></span>
      </button>`).join("");
  renderRecipeEditor();
}

function renderRecipeEditor() {
  const el = $("recipeEditor");
  if (!ingredients.size) {
    el.className = "panel empty";
    el.innerHTML = `<h2>Add ingredients first</h2><p>A recipe is a list of ingredients with amounts. Add a few ingredients and their prices, then come back.</p>
      <button class="applybtn" data-goto="ingredients" type="button">Go to Ingredients</button>`;
    return;
  }
  el.className = "panel";
  const cats = [...new Set(dishes.map((d) => d.category).filter(Boolean))].sort();
  const ingList = [...ingredients.values()].sort((a, b) => a.name.localeCompare(b.name));
  const opts = (sel) => `<option value="">Choose an ingredient…</option>` +
    ingList.map((i) => `<option value="${i.id}" ${i.id === sel ? "selected" : ""}>${esc(i.name)} (${fmt(i.cost)}/${esc(i.unit)})</option>`).join("");

  el.innerHTML = `
    <div class="panel-head">
      <div><h2>${draft.id ? "Edit dish" : "New dish"}</h2><div class="cat">Changes are saved when you click "Save dish".</div></div>
    </div>
    <div class="editor-grid">
      <label>Dish name<input id="rName" maxlength="100" value="${esc(draft.name)}" placeholder="e.g. Short Rib Ragu"></label>
      <label>Category<input id="rCat" maxlength="40" value="${esc(draft.category)}" list="catList" placeholder="e.g. Mains"></label>
      <label>Menu price ($)<input id="rPrice" type="number" min="0.01" step="0.01" value="${draft.price === "" ? "" : Number(draft.price).toFixed(2)}" placeholder="0.00"></label>
    </div>
    <datalist id="catList">${cats.map((c) => `<option value="${esc(c)}">`).join("")}</datalist>
    <div class="section-label">Ingredients in this dish</div>
    <div class="scroll-x"><table class="recipe">
      <thead><tr><th>Ingredient</th><th class="num">Amount</th><th>Unit</th><th class="num">Line cost</th><th></th></tr></thead>
      <tbody>${draft.items.map((it, idx) => {
        const ing = ingredients.get(it.ingredient_id);
        return `<tr>
          <td><select data-item-ing="${idx}">${opts(it.ingredient_id)}</select></td>
          <td class="num"><input type="number" min="0" step="0.1" data-item-qty="${idx}" value="${it.qty === "" ? "" : trimNum(it.qty)}" placeholder="0"></td>
          <td class="unit">${esc(ing?.unit || "")}</td>
          <td class="num mono" data-line="${idx}">${fmt(ing && it.qty ? ing.cost * it.qty : 0)}</td>
          <td class="num"><button class="iconbtn" data-item-del="${idx}" type="button" aria-label="Remove line">✕</button></td>
        </tr>`;
      }).join("")}</tbody>
    </table></div>
    <button class="ghostbtn dark" id="addLineBtn" type="button">+ Add ingredient line</button>
    <div class="preview" id="recipePreview"></div>
    <div class="row-actions">
      <button class="applybtn" id="saveDishBtn" type="button">Save dish</button>
      ${draft.id ? `<button class="ghostbtn dark" id="revertDishBtn" type="button">Undo changes</button>` : ""}
      <span class="spacer"></span>
      ${draft.id ? `<button class="linkbtn danger" id="deleteDishBtn" type="button">Delete dish</button>` : ""}
    </div>`;
  updateRecipePreview();
}

function updateRecipePreview() {
  let cost = 0;
  draft.items.forEach((it, idx) => {
    const ing = ingredients.get(it.ingredient_id);
    const line = ing && Number(it.qty) > 0 ? ing.cost * Number(it.qty) : 0;
    cost += line;
    const cell = document.querySelector(`[data-line="${idx}"]`);
    if (cell) cell.textContent = fmt(line);
  });
  const price = Number(draft.price);
  const box = $("recipePreview");
  if (!(price > 0)) {
    box.innerHTML = `<div><div class="val mono">${fmt(cost)}</div><div class="lbl">Recipe cost</div></div><div class="note">Enter a menu price to see food cost %.</div>`;
    return;
  }
  const pct = (cost / price) * 100, st = statusOf(pct);
  box.innerHTML = `
    <div><div class="val mono">${fmt(cost)}</div><div class="lbl">Recipe cost (real prices)</div></div>
    <div><div class="val mono">${fmtPct(pct)}</div><div class="lbl">Food cost %</div></div>
    <div><div class="val mono">${fmt(price - cost)}</div><div class="lbl">Margin per plate</div></div>
    <span class="status-chip ${st}">${statusLabel(st)}</span>`;
}

async function saveDish() {
  const name = draft.name.trim();
  const category = draft.category.trim();
  const price = Number(draft.price);
  if (!name) { toast("Give the dish a name.", "err"); $("rName").focus(); return; }
  if (!(price > 0)) { toast("Menu price must be more than $0.", "err"); $("rPrice").focus(); return; }
  const items = [];
  const seen = new Set();
  for (const it of draft.items) {
    if (!it.ingredient_id && (it.qty === "" || Number(it.qty) === 0)) continue;  // blank line
    if (!it.ingredient_id) { toast("One line has an amount but no ingredient picked.", "err"); return; }
    const q = Number(it.qty);
    if (!(q > 0)) { toast(`Give ${ingredients.get(it.ingredient_id).name} an amount above 0.`, "err"); return; }
    if (seen.has(it.ingredient_id)) { toast(`${ingredients.get(it.ingredient_id).name} is listed twice. Combine them into one line.`, "err"); return; }
    seen.add(it.ingredient_id);
    items.push({ ingredient_id: it.ingredient_id, qty: q });
  }
  const btn = $("saveDishBtn");
  btn.disabled = true;
  try {
    let id = draft.id;
    if (id) {
      await run(sb.from("dishes").update({ name, category, price }).eq("id", id));
    } else {
      const sort = dishes.reduce((m, d) => Math.max(m, d.sort_order || 0), -1) + 1;
      const row = await run(sb.from("dishes").insert({ restaurant_id: rest.id, name, category, price, sort_order: sort }).select("id").single());
      id = row.id;
    }
    // Replace this dish's recipe lines with the new list.
    await run(sb.from("dish_items").delete().eq("dish_id", id));
    if (items.length) {
      await run(sb.from("dish_items").insert(items.map((it) => ({ restaurant_id: rest.id, dish_id: id, ...it }))));
    }
    await loadRestaurantData();
    draftDirty = false;
    startEditing(id);
    render();
    toast(`Saved ${name}.`);
  } catch { /* toast shown */ } finally { if (document.body.contains(btn)) btn.disabled = false; }
}

async function deleteDish() {
  const d = dishes.find((x) => x.id === draft.id);
  if (!d || !confirm(`Delete "${d.name}"? Its recipe and all of its sales history will be deleted too.`)) return;
  try {
    await run(sb.from("dishes").delete().eq("id", d.id));
    draftDirty = false; draft = null; editingDishId = null;
    await loadRestaurantData();
    render();
    toast(`Deleted ${d.name}.`);
  } catch { /* toast shown */ }
}

// ---------------------------------------------------------- What-if + scenarios
function resetWhatIf() {
  adjustments = {}; priceMultipliers = {};
  const s = $("scenarioSelect"); if (s) s.value = "";
}

async function saveScenario() {
  if (!Object.keys(adjustments).length) { toast("Apply at least one what-if price change first.", "err"); return; }
  const name = (prompt("Name this scenario (e.g. \"Beef +15%\"):") || "").trim();
  if (!name) return;
  try {
    const row = await run(sb.from("scenarios").insert({ restaurant_id: rest.id, name, adjustments: { ...adjustments } }).select("id,name,adjustments").single());
    scenarios.push(row);
    renderScenarioSelect();
    $("scenarioSelect").value = row.id;
    toast(`Saved scenario "${row.name}".`);
  } catch { /* toast shown */ }
}

function loadScenario(id) {
  const s = scenarios.find((x) => x.id === id);
  if (!s) return;
  adjustments = {}; priceMultipliers = {};
  let skipped = 0;
  for (const [k, v] of Object.entries(s.adjustments || {})) {
    if (!ingredients.has(k)) { skipped++; continue; }
    adjustments[k] = Number(v);
    priceMultipliers[k] = 1 + Number(v) / 100;
  }
  render();
  $("scenarioSelect").value = id;
  toast(`Loaded "${s.name}"` + (skipped ? ` (${skipped} deleted ingredient${skipped > 1 ? "s" : ""} skipped)` : "") + ".");
}

async function deleteScenario() {
  const id = $("scenarioSelect").value;
  const s = scenarios.find((x) => x.id === id);
  if (!s) { toast("Pick a saved scenario from the list first.", "err"); return; }
  if (!confirm(`Delete scenario "${s.name}"?`)) return;
  try {
    await run(sb.from("scenarios").delete().eq("id", id));
    scenarios = scenarios.filter((x) => x.id !== id);
    resetWhatIf();
    render();
    toast("Scenario deleted.");
  } catch { /* toast shown */ }
}

// ---------------------------------------------------------- Restaurants
function openOnboarding(canCancel) {
  $("onboardName").value = "";
  const sel = $("onboardSeed");
  sel.innerHTML = `<option value="">Blank: I'll add my own menu</option>` +
    Object.entries(window.SEEDS || {}).map(([k, v]) => `<option value="${k}">Sample: ${esc(v.label)}</option>`).join("");
  sel.value = "";
  $("onboardMsg").textContent = "";
  $("onboardMsg").className = "form-msg";
  $("onboardCancel").classList.toggle("hidden", !canCancel);
  show("onboardScreen");
  $("onboardName").focus();
}

async function createRestaurant(e) {
  e.preventDefault();
  const name = $("onboardName").value.trim();
  if (!name) return;
  const msg = $("onboardMsg"), btn = $("onboardSubmit");
  btn.disabled = true;
  msg.className = "form-msg ok";
  msg.textContent = "Creating your restaurant…";
  let created = null;
  try {
    const seedKey = $("onboardSeed").value;
    const t = window.SEEDS?.[seedKey]?.targets;
    const row = t ? { name, target_low: t.low, target_mid: t.mid, target_high: t.high } : { name };
    created = await run(sb.from("restaurants").insert(row).select("*").single());
    if (seedKey) {
      msg.textContent = "Loading the sample menu (a few seconds)…";
      await seedRestaurant(created.id, seedKey);
    }
    await loadRestaurants(created.id);
    toast(`Welcome to ${created.name}!`);
  } catch (err) {
    msg.className = "form-msg";
    msg.textContent = friendlyError(err);
    if (created) await loadRestaurants(created.id).catch(() => {});
  } finally { btn.disabled = false; }
}

function openSettings() {
  $("setName").value = rest.name;
  $("setLow").value = Number(rest.target_low);
  $("setMid").value = Number(rest.target_mid);
  $("setHigh").value = Number(rest.target_high);
  $("settingsMsg").textContent = "";
  $("settingsDialog").showModal();
}

async function saveSettings(e) {
  e.preventDefault();
  const name = $("setName").value.trim();
  const low = Number($("setLow").value), mid = Number($("setMid").value), high = Number($("setHigh").value);
  if (!name) { $("settingsMsg").textContent = "Name can't be blank."; return; }
  if (![low, mid, high].every((n) => Number.isFinite(n) && n >= 0 && n <= 100)) { $("settingsMsg").textContent = "Targets must be between 0 and 100."; return; }
  if (!(low <= mid && mid <= high)) { $("settingsMsg").textContent = "Targets must go low ≤ mid ≤ high."; return; }
  try {
    const row = await run(sb.from("restaurants").update({ name, target_low: low, target_mid: mid, target_high: high }).eq("id", rest.id).select("*").single());
    restaurants = restaurants.map((r) => (r.id === row.id ? row : r));
    rest = row;
    $("settingsDialog").close();
    renderRestaurantSelect();
    render();
    toast("Settings saved.");
  } catch (err) { $("settingsMsg").textContent = friendlyError(err); }
}

async function deleteRestaurant() {
  const typed = prompt(`This permanently deletes "${rest.name}" and ALL of its ingredients, recipes, sales, and scenarios.\n\nType the restaurant name to confirm:`);
  if (typed === null) return;
  if (typed.trim() !== rest.name) { $("settingsMsg").textContent = "Name didn't match — nothing was deleted."; return; }
  try {
    await run(sb.from("restaurants").delete().eq("id", rest.id));
    $("settingsDialog").close();
    toast("Restaurant deleted.");
    safeSet("line.restaurant", "");
    await loadRestaurants();
  } catch (err) { $("settingsMsg").textContent = friendlyError(err); }
}

// ---------------------------------------------------------- Auth
function setAuthMode(mode) {
  authMode = mode;
  const signup = mode === "signup";
  $("authTitle").textContent = signup ? "Create an account" : "Sign in";
  $("authSubmit").textContent = signup ? "Create account" : "Sign in";
  $("authToggle").textContent = signup ? "Already have an account? Sign in" : "New here? Create an account";
  $("authPassword").autocomplete = signup ? "new-password" : "current-password";
  $("authMsg").textContent = "";
}

async function submitAuth(e) {
  e.preventDefault();
  const email = $("authEmail").value.trim(), password = $("authPassword").value;
  const msg = $("authMsg"), btn = $("authSubmit");
  msg.className = "form-msg"; msg.textContent = "";
  btn.disabled = true;
  try {
    if (authMode === "signup") {
      const { data, error } = await sb.auth.signUp({ email, password, options: { emailRedirectTo: location.origin } });
      if (error) throw error;
      if (!data.session) {
        msg.className = "form-msg ok";
        msg.textContent = "Account created! Check your email for a confirmation link, then come back and sign in.";
        setTimeout(() => setAuthMode("signin"), 50);
      }
    } else {
      const { error } = await sb.auth.signInWithPassword({ email, password });
      if (error) throw error;
    }
  } catch (err) {
    msg.textContent = /Invalid login/i.test(err.message) ? "Wrong email or password." :
      /not confirmed/i.test(err.message) ? "Please click the confirmation link in your email first." : friendlyError(err);
  } finally { btn.disabled = false; }
}

async function signOut() {
  if (draftDirty && !confirm("You have unsaved recipe changes. Sign out anyway?")) return;
  draftDirty = false;
  await sb.auth.signOut();
  handleSession(null);
}

// ================================================================ WIRING
function goTo(page) {
  if (activePage === "recipes" && page !== "recipes" && draftDirty) {
    if (!confirm("You have unsaved changes to this dish. Leave without saving?")) return;
    draftDirty = false; draft = null;
  }
  activePage = page;
  window.scrollTo({ top: 0 });
  render();
}

function wireControls() {
  // Auth + onboarding
  $("authForm").addEventListener("submit", submitAuth);
  $("authToggle").addEventListener("click", () => setAuthMode(authMode === "signin" ? "signup" : "signin"));
  $("onboardForm").addEventListener("submit", createRestaurant);
  $("onboardCancel").addEventListener("click", () => { renderRestaurantSelect(); show("appScreen"); });
  $("onboardSignOut").addEventListener("click", signOut);

  // Header
  $("signOutBtn").addEventListener("click", signOut);
  $("settingsBtn").addEventListener("click", openSettings);
  $("restaurantSelect").addEventListener("change", (e) => {
    const v = e.target.value;
    if (draftDirty && !confirm("You have unsaved recipe changes. Switch anyway?")) { e.target.value = rest.id; return; }
    draftDirty = false;
    if (v === "__new") { e.target.value = rest.id; openOnboarding(true); }
    else selectRestaurant(v).catch(() => {});
  });
  document.querySelectorAll(".tab").forEach((t) => t.addEventListener("click", () => goTo(t.dataset.page)));

  // Settings dialog
  $("settingsForm").addEventListener("submit", saveSettings);
  $("settingsCancel").addEventListener("click", () => $("settingsDialog").close());
  $("deleteRestaurantBtn").addEventListener("click", deleteRestaurant);

  // What-if bar
  $("weekSelect").addEventListener("change", (e) => { selectedWeek = e.target.value || null; render(); });
  $("signPlus").addEventListener("click", () => { sign = 1; $("signPlus").classList.add("active"); $("signMinus").classList.remove("active"); });
  $("signMinus").addEventListener("click", () => { sign = -1; $("signMinus").classList.add("active"); $("signPlus").classList.remove("active"); });
  $("applyBtn").addEventListener("click", () => {
    const key = $("ingredientSelect").value;
    if (!key) return;
    let pct = parseFloat($("pctInput").value);
    if (!Number.isFinite(pct) || pct < 0) pct = 0;
    if (sign < 0 && pct > 100) pct = 100;
    const signed = sign * pct;
    if (signed === 0) { delete adjustments[key]; delete priceMultipliers[key]; }
    else { adjustments[key] = signed; priceMultipliers[key] = 1 + signed / 100; }
    $("scenarioSelect").value = "";
    render();
  });
  $("resetBtn").addEventListener("click", () => { resetWhatIf(); render(); });
  $("activeAdj").addEventListener("click", (e) => {
    const b = e.target.closest("button[data-key]");
    if (!b) return;
    delete adjustments[b.dataset.key]; delete priceMultipliers[b.dataset.key];
    $("scenarioSelect").value = "";
    render();
  });
  $("scenarioSelect").addEventListener("change", (e) => { if (e.target.value) loadScenario(e.target.value); });
  $("saveScenarioBtn").addEventListener("click", saveScenario);
  $("deleteScenarioBtn").addEventListener("click", deleteScenario);

  // Cost tracker list
  $("dishList").addEventListener("click", (e) => {
    const b = e.target.closest(".dish-row");
    if (b) { selectedDishId = b.dataset.id; render(); }
  });

  // Buttons that jump to another tab or open a recipe
  document.addEventListener("click", (e) => {
    const g = e.target.closest("[data-goto]");
    if (g) { goTo(g.dataset.goto); return; }
    const ed = e.target.closest("[data-edit-dish]");
    if (ed) { if (startEditing(ed.dataset.editDish)) goTo("recipes"); }
  });

  // Weekly sales
  $("salesWeek").addEventListener("change", (e) => {
    if (!e.target.value) return;
    salesWeek = dayStr(mondayOf(parseDay(e.target.value)));
    renderSales();
  });
  $("salesPrev").addEventListener("click", () => { salesWeek = addDays(salesWeek, -7); renderSales(); });
  $("salesNext").addEventListener("click", () => { salesWeek = addDays(salesWeek, 7); renderSales(); });
  $("salesTable").addEventListener("input", updateSalesTotal);
  $("saveSalesBtn").addEventListener("click", saveSales);
  $("weeksTable").addEventListener("click", (e) => {
    const b = e.target.closest("[data-open-week]");
    if (b) { salesWeek = b.dataset.openWeek; renderSales(); }
  });

  // Ingredients
  $("addIngForm").addEventListener("submit", addIngredient);
  $("ingSearch").addEventListener("input", renderIngredients);
  $("ingTable").addEventListener("change", (e) => { if (e.target.matches("input[data-id]")) updateIngredient(e.target); });
  $("ingTable").addEventListener("click", (e) => {
    const b = e.target.closest("[data-del-ing]");
    if (b) deleteIngredient(b.dataset.delIng);
  });

  // Recipes
  $("newDishBtn").addEventListener("click", () => { if (startEditing("new")) renderRecipes(); });
  $("recipeList").addEventListener("click", (e) => {
    const b = e.target.closest("[data-recipe]");
    if (b && b.dataset.recipe !== editingDishId && startEditing(b.dataset.recipe)) renderRecipes();
  });
  const ed = $("recipeEditor");
  ed.addEventListener("input", (e) => {
    if (!draft) return;
    const t = e.target;
    if (t.id === "rName") { draft.name = t.value; draftDirty = true; }
    else if (t.id === "rCat") { draft.category = t.value; draftDirty = true; }
    else if (t.id === "rPrice") { draft.price = t.value; draftDirty = true; updateRecipePreview(); }
    else if (t.dataset.itemQty !== undefined) { draft.items[+t.dataset.itemQty].qty = t.value; draftDirty = true; updateRecipePreview(); }
  });
  ed.addEventListener("change", (e) => {
    const t = e.target;
    if (t.dataset.itemIng !== undefined) { draft.items[+t.dataset.itemIng].ingredient_id = t.value; draftDirty = true; renderRecipeEditor(); }
  });
  ed.addEventListener("click", (e) => {
    const t = e.target.closest("button");
    if (!t || !draft) return;
    if (t.id === "addLineBtn") { draft.items.push({ ingredient_id: "", qty: "" }); draftDirty = true; renderRecipeEditor(); }
    else if (t.dataset.itemDel !== undefined) { draft.items.splice(+t.dataset.itemDel, 1); draftDirty = true; renderRecipeEditor(); }
    else if (t.id === "saveDishBtn") saveDish();
    else if (t.id === "deleteDishBtn") deleteDish();
    else if (t.id === "revertDishBtn") { draftDirty = false; startEditing(draft.id); renderRecipeEditor(); }
  });

  // Warn before closing the tab with unsaved recipe edits.
  window.addEventListener("beforeunload", (e) => { if (draftDirty) { e.preventDefault(); e.returnValue = ""; } });
}
