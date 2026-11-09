// =====================================================================
// The Line: app logic
// Talks to Supabase (database + logins). Each account owns one or more
// restaurants; the database's security rules (see supabase/schema.sql)
// make sure nobody can see another account's restaurants.
// =====================================================================
"use strict";

const $ = (id) => document.getElementById(id);
const cfg = window.APP_CONFIG || {};

// ---------------------------------------------------------------- utils
const SCREENS = ["boot", "setupNeeded", "authScreen", "onboardScreen", "appScreen"];
function show(id) {
  SCREENS.forEach((s) => $(s).classList.toggle("hidden", s !== id));
  if (id === "authScreen") playLogoSplice($("authLogo"));
}

// Sign-in logo: start it whole ("TheLine"), then let the CSS transitions in
// styles.css cut it and open the space between the words.
function playLogoSplice(wm) {
  if (!wm || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  // Measure a space in this font so the words close up exactly.
  const probe = document.createElement("i");
  probe.style.cssText = "position:absolute;visibility:hidden;white-space:pre;word-spacing:0;font:inherit";
  wm.appendChild(probe);
  probe.textContent = "The Line"; const wide = probe.getBoundingClientRect().width;
  probe.textContent = "TheLine";  const tight = probe.getBoundingClientRect().width;
  probe.remove();
  const size = parseFloat(getComputedStyle(wm).fontSize);
  if (size && wide > tight) wm.style.setProperty("--sp", ((wide - tight) / size).toFixed(4) + "em");
  wm.classList.add("no-anim", "is-whole");
  wm.classList.remove("is-cutting");
  void wm.offsetWidth;                      // lock in the "whole" look before animating
  wm.classList.remove("no-anim", "is-whole");
  wm.classList.add("is-cutting");
}

// Numbers that move: used instead of render() when a what-if, scenario or sales
// week changes. It notes what each number and status color showed, re-renders,
// then counts each changed number from its old value, fades changed colors
// (CSS transitions in styles.css) and glows the rows that changed.
const MOVE_NUM = ".metric .num, .dish-row .pct, .cost-summary .val, td.num.mono";
const MOVE_CLS = ".dot, .status-chip, .qtag, .metric, .dish-row .pct, .cost-summary .val";
const MOVE_ROW = ".dish-row, #perfTable tbody tr, #panel table.ingredients tbody tr";

function moveKeys(sel) {             // the same element gets the same key before and after a render
  const out = new Map(), counts = {};
  const page = document.querySelector(".page.active");
  if (!page) return out;
  page.querySelectorAll(sel).forEach((el) => {
    const scope = el.closest("[data-id]")?.dataset.id || el.closest("[id]")?.id || "";
    counts[scope] = (counts[scope] || 0) + 1;
    out.set(scope + "|" + counts[scope], el);
  });
  return out;
}

function splitNum(text) {            // "$1,234.50" -> { pre: "$", val: 1234.5, dec: 2, comma: true, post: "" }
  const m = /^([^\d-]*)(-?[\d,]*\d(?:\.(\d+))?)(.*)$/s.exec(String(text).trim());
  if (!m) return null;
  return { pre: m[1], val: parseFloat(m[2].replace(/,/g, "")), dec: (m[3] || "").length, comma: m[2].includes(","), post: m[4] };
}

function countNum(el, from, to, comma) {
  const final = el.textContent, t0 = performance.now(), dur = 450;
  const show = (v) => to.pre + (comma ? v.toLocaleString("en-US", { minimumFractionDigits: to.dec, maximumFractionDigits: to.dec }) : v.toFixed(to.dec)) + to.post;
  el.textContent = show(from);
  const step = (now) => {
    if (!el.isConnected) return;
    const k = Math.min(1, (now - t0) / dur);
    if (k >= 1) { el.textContent = final; return; }
    el.textContent = show(from + (to.val - from) * (1 - Math.pow(1 - k, 3)));
    requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
  setTimeout(() => { if (el.isConnected) el.textContent = final; }, dur + 100);   // lands even if frames are paused (tab in background)
}

function renderMoving() {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) { render(); return; }
  const pageBefore = document.querySelector(".page.active")?.id;
  const oldNums = new Map([...moveKeys(MOVE_NUM)].map(([k, el]) => [k, el.textContent]));
  const oldCls = new Map([...moveKeys(MOVE_CLS)].map(([k, el]) => [k, el.className]));
  render();
  if (document.querySelector(".page.active")?.id !== pageBefore) return;

  const moved = new Set(), fades = [];
  moveKeys(MOVE_CLS).forEach((el, k) => {
    const was = oldCls.get(k);
    if (was == null || was === el.className) return;
    fades.push([el, el.className]); el.className = was;      // show the old color for one frame…
    const row = el.closest(MOVE_ROW); if (row) moved.add(row);
  });
  moveKeys(MOVE_NUM).forEach((el, k) => {
    const was = oldNums.get(k);
    if (was == null || was === el.textContent) return;
    const a = splitNum(was), b = splitNum(el.textContent);
    if (!a || !b || a.pre !== b.pre || a.post !== b.post || a.val === b.val) return;
    countNum(el, a.val, b, a.comma || b.comma);
    const row = el.closest(MOVE_ROW); if (row) moved.add(row);
  });
  if (fades.length) { void document.body.offsetWidth; fades.forEach(([el, c]) => { el.className = c; }); }   // …then fade to the new one
  moved.forEach((row) => { row.classList.add("moved"); row.addEventListener("animationend", () => row.classList.remove("moved"), { once: true }); });
}

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
  if (code === "42501" || /row-level security/i.test(err.message || "")) return "Permission denied. Try signing out and back in.";
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
let staff = [];                // [{id, name, role, department, pay_type, rate, active}]
let laborByWeek = new Map();   // "YYYY-MM-DD" -> Map(staffId -> hours)
let modReports = [];           // newest first: [{id, report_date, shift, manager, data}]
let extrasReady = true;        // false until supabase/labor-and-mod.sql has been run
let posEnabled = false;       // this restaurant has The Line POS add-on (and its tables exist)
let stockReady = true;         // false until supabase/spoilage.sql has been run (on hand + use by)
let menuMode = "weekly";       // Specials page: "weekly" or "party"
let lastMenu = null;           // the last menu Gemini wrote (not saved)
let laborWeek = null;          // week shown on the Labor Costs tab
let laborRaise = { dept: "all", pct: 0 };  // what-if wage change (not saved)
let editingReportId = null;    // MOD Report ("new" for a new report)
let modDraft = null;           // working copy of the report being edited
let modAutoPull = false;       // pull POS numbers into the report once it's on screen
let modPosNote = "";           // what the last POS pull did, shown under the button
let modDirty = false;
let activePage = "cost";
let sign = 1;
let authMode = "signin";

const targets = () => ({ low: Number(rest.target_low), mid: Number(rest.target_mid), high: Number(rest.target_high) });

// ================================================================ STARTUP
document.addEventListener("DOMContentLoaded", () => {
  applyTheme();
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
  editingReportId = null; modDraft = null; modDirty = false;
  laborWeek = null; laborRaise = { dept: "all", pct: 0 };
  lastMenu = null;
  await loadRestaurantData();
  renderRestaurantSelect();
  show("appScreen");
  render();
}

async function loadRestaurantData() {
  const rid = rest.id;
  // On hand / use by come from an add-on SQL file; work without them if it hasn't been run.
  let ingRes = await sb.from("ingredients").select(ingCols()).eq("restaurant_id", rid).order("name");
  if (ingRes.error && stockReady && isMissingColumn(ingRes.error)) {
    stockReady = false;
    ingRes = await sb.from("ingredients").select(ingCols()).eq("restaurant_id", rid).order("name");
  }
  const results = await Promise.all([
    ingRes,
    sb.from("dishes").select("id,name,category,price,sort_order").eq("restaurant_id", rid).order("sort_order").order("created_at"),
    sb.from("dish_items").select("dish_id,ingredient_id,qty").eq("restaurant_id", rid),
    sb.from("weekly_sales").select("dish_id,week_start,units").eq("restaurant_id", rid).order("week_start", { ascending: false }),
    sb.from("scenarios").select("id,name,adjustments").eq("restaurant_id", rid).order("created_at"),
  ]);
  for (const r of results) if (r.error) { toast(friendlyError(r.error), "err"); throw r.error; }
  const [ing, dsh, items, sales, scen] = results.map((r) => r.data);

  ingredients = new Map(ing.map((i) => [i.id, ingRow(i)]));
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
  await loadExtras();
}

function ingCols() { return stockReady ? "id,name,unit,cost,on_hand,use_by" : "id,name,unit,cost"; }
function ingRow(i) { return { ...i, cost: Number(i.cost), on_hand: i.on_hand == null ? null : Number(i.on_hand), use_by: i.use_by || null }; }
function isMissingColumn(err) {
  return /42703|PGRST204/.test(err?.code || "") || /on_hand|use_by/.test(err?.message || "");
}

// Days until an ingredient's use-by date (negative = already past). null if no date.
function daysLeft(useBy) {
  if (!useBy) return null;
  const today = parseDay(dayStr(new Date()));
  return Math.round((parseDay(useBy) - today) / 86400000);
}
function spoilTag(i) {
  const d = daysLeft(i.use_by);
  if (d === null) return "";
  if (d < 0) return `<span class="spoil red">Expired</span>`;
  if (d === 0) return `<span class="spoil red">Use today</span>`;
  const cls = d <= 2 ? "red" : d <= 5 ? "amber" : "ok";
  return `<span class="spoil ${cls}">${d <= 7 ? `Spoils in ${d} day${d === 1 ? "" : "s"}` : fmtDay(i.use_by)}</span>`;
}

// The Labor + MOD tables come from a separate SQL file. If it hasn't been
// run yet, the rest of the app still works and those two tabs explain why.
function isMissingTable(err) {
  return /PGRST205|42P01/.test(err?.code || "") || /schema cache|does not exist/i.test(err?.message || "");
}

async function loadExtras() {
  const rid = rest.id;
  posEnabled = false;
  const results = await Promise.all([
    sb.from("staff").select("id,name,role,department,pay_type,rate,active").eq("restaurant_id", rid).order("created_at"),
    sb.from("labor_hours").select("staff_id,week_start,hours").eq("restaurant_id", rid),
    sb.from("mod_reports").select("id,report_date,shift,manager,data").eq("restaurant_id", rid)
      .order("report_date", { ascending: false }).order("created_at", { ascending: false }),
  ]);
  const bad = results.find((r) => r.error);
  if (bad && isMissingTable(bad.error)) { extrasReady = false; staff = []; laborByWeek = new Map(); modReports = []; return; }
  if (bad) { toast(friendlyError(bad.error), "err"); throw bad.error; }
  extrasReady = true;
  const [st, hrs, reps] = results.map((r) => r.data);
  const deptOrder = { Mgmt: 0, BOH: 1, FOH: 2 };
  staff = st.map((x) => ({ ...x, rate: Number(x.rate) }))
    .sort((a, b) => deptOrder[a.department] - deptOrder[b.department] || a.name.localeCompare(b.name));
  laborByWeek = new Map();
  for (const h of hrs) {
    if (!laborByWeek.has(h.week_start)) laborByWeek.set(h.week_start, new Map());
    laborByWeek.get(h.week_start).set(h.staff_id, Number(h.hours));
  }
  const addon = await sb.from("addons").select("pos_enabled").eq("restaurant_id", rid);
  posEnabled = !addon.error && !!addon.data?.[0]?.pos_enabled;
  modReports = reps.sort((a, b) => b.report_date.localeCompare(a.report_date) || SHIFTS.indexOf(b.shift) - SHIFTS.indexOf(a.shift));
}

function sortedWeeks() { return [...salesByWeek.keys()].sort().reverse(); }

// Copies the sample menu (seed-data.js) into a new restaurant.
async function seedRestaurant(rid, key) {
  const S = (window.SEEDS || {})[key];
  if (!S) return;
  const keys = Object.keys(S.ingredients);
  const today = dayStr(new Date());
  const rows = (withStock) => keys.map((k) => {
    const { name, unit, cost } = S.ingredients[k];
    const st = S.stock?.[k];
    return withStock && st ? { restaurant_id: rid, name, unit, cost, on_hand: st[0], use_by: st[1] == null ? null : addDays(today, st[1]) }
      : { restaurant_id: rid, name, unit, cost };
  });
  let ins = await sb.from("ingredients").insert(rows(stockReady)).select("id,name");
  if (ins.error && stockReady && isMissingColumn(ins.error)) { stockReady = false; ins = await sb.from("ingredients").insert(rows(false)).select("id,name"); }
  if (ins.error) { toast(friendlyError(ins.error), "err"); throw ins.error; }
  const ingRows = ins.data;
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

  // Sample team, timesheets and MOD reports. Skipped quietly if the
  // Labor/MOD tables haven't been added yet (supabase/labor-and-mod.sql).
  if (S.staff?.length) {
    const ins = await sb.from("staff").insert(S.staff.map((p) => ({
      restaurant_id: rid, name: p.name, role: p.role, department: p.department, pay_type: p.pay_type, rate: p.rate,
    }))).select("id,name");
    if (ins.error) { if (isMissingTable(ins.error)) return; toast(friendlyError(ins.error), "err"); throw ins.error; }
    const staffId = new Map(ins.data.map((r) => [r.name, r.id]));
    const hours = [];
    S.weekFactors.forEach((f, w) => {
      const week = addDays(thisMonday, -7 * (n - w));
      S.staff.forEach((p) => hours.push({
        restaurant_id: rid, staff_id: staffId.get(p.name), week_start: week,
        hours: p.pay_type === "salary" ? p.hours : Math.round(p.hours * f * 2) / 2,
      }));
    });
    await run(sb.from("labor_hours").insert(hours));
  }
  if (S.modReports?.length) {
    const today = dayStr(new Date());
    const { error } = await sb.from("mod_reports").insert(S.modReports.map((r) => ({
      restaurant_id: rid, report_date: addDays(today, r.daysAgo * -1), shift: r.shift, manager: r.manager, data: r.data,
    })));
    if (error && !isMissingTable(error)) { toast(friendlyError(error), "err"); throw error; }
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
const PAGE_NAMES = { cost: "Cost Tracker", perf: "Performance", sales: "Weekly Sales", ingredients: "Ingredients",
  recipes: "Recipes", specials: "Specials", labor: "Labor Costs", mod: "MOD Report" };

// Which pages show as tabs in the row under the logo. Saved in this
// browser; every page is always reachable from the Menu.
const TABS_KEY = "line.tabs";
const DEFAULT_TABS = ["cost", "perf", "specials", "labor", "mod"];
function pinnedTabs() {
  try {
    const v = JSON.parse(safeGet(TABS_KEY) || "null");
    if (Array.isArray(v)) return v.filter((p) => p in PAGE_NAMES);
  } catch { /* fall through */ }
  return DEFAULT_TABS.slice();
}
function setAllPinned(on) {
  safeSet(TABS_KEY, JSON.stringify(on ? Object.keys(PAGE_NAMES) : []));
  renderTabs();
}
function setPinned(page, on) {
  const set = new Set(pinnedTabs());
  on ? set.add(page) : set.delete(page);
  safeSet(TABS_KEY, JSON.stringify(Object.keys(PAGE_NAMES).filter((p) => set.has(p))));
  renderTabs();
}
function renderTabs() {
  const pinned = new Set(pinnedTabs());
  const shown = Object.keys(PAGE_NAMES).filter((p) => pinned.has(p) || p === activePage);
  $("pinnedTabs").innerHTML = shown.map((p) =>
    `<button class="tab ${p === activePage ? "active" : ""} ${pinned.has(p) ? "" : "temp"}" data-page="${p}" type="button"${p === activePage ? ' aria-current="page"' : ""}>${PAGE_NAMES[p]}</button>`).join("");
  const all = Object.keys(PAGE_NAMES).every((p) => pinned.has(p));
  $("pinAll").textContent = all ? "Unselect all" : "Select all";
  $("pinAll").setAttribute("aria-label", all ? "Hide all pages from the tab row" : "Show every page as a tab");
  $("sideNav").innerHTML = Object.keys(PAGE_NAMES).map((p) => `<div class="side-row">
      <button class="tab ${p === activePage ? "active" : ""}" data-page="${p}" type="button">${PAGE_NAMES[p]}</button>
      <label class="pin"><input type="checkbox" data-pin="${p}" ${pinned.has(p) ? "checked" : ""} aria-label="Show ${PAGE_NAMES[p]} as a tab"></label>
    </div>`).join("");
}

function render() {
  if (!rest) return;
  $("whereRest").textContent = rest.name;
  $("wherePage").textContent = PAGE_NAMES[activePage];
  renderTabs();
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
  else if (activePage === "specials") renderSpecials();
  else if (activePage === "labor") renderLabor();
  else if (activePage === "mod") renderMod();
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

// What to do about a dish, shown right under its target bar. Red dishes
// get the loudest treatment: what's driving the cost and two ways out.
function suggestedAction(dish, cost, pct) {
  const t = targets();
  if (pct <= t.low) {
    return `<div class="fix fix-ok"><strong>On target.</strong> ${fmtPct(pct)} food cost, ${(t.low - pct).toFixed(1)} points under your ${t.low}% line. Nothing to change.</div>`;
  }
  const idealPrice = cost / (t.mid / 100);
  const delta = idealPrice - dish.price;
  const portionCut = (1 - (dish.price * (t.mid / 100)) / cost) * 100;
  const big = dish.items.map((it) => ({ ing: ingredients.get(it.ingredient_id), line: ingCost(it.ingredient_id) * it.qty }))
    .sort((a, b) => b.line - a.line)[0];
  const driver = big && cost > 0
    ? `${esc(big.ing?.name)} is the biggest cost: ${fmt(big.line)} of the ${fmt(cost)} plate (${Math.round((big.line / cost) * 100)}%).`
    : "";
  const priceMove = `<div class="move"><div class="move-label">Raise the price to</div><div class="move-val">${fmt(idealPrice)}</div><div class="move-note">+${fmt(delta)} a plate</div></div>`;
  if (pct <= t.high) {
    return `<section class="fix fix-watch" aria-label="Suggested action">
      <div class="fix-head"><span class="fix-flag">Suggested action</span><span class="fix-why">${fmtPct(pct)} food cost: inside your range, above your ${t.mid}% goal</span></div>
      <div class="fix-moves">${priceMove}<div class="move-or">or</div>
        <div class="move"><div class="move-label">Leave it and</div><div class="move-val small">watch it</div><div class="move-note">check again next week</div></div></div>
      <p class="fix-lede">${driver} Raising the price brings it back to your ${t.mid}% goal.</p>
    </section>`;
  }
  return `<section class="fix fix-red" aria-label="Suggested action">
    <div class="fix-head"><span class="fix-flag">Suggested action</span><span class="fix-why">${fmtPct(pct)} food cost, ${(pct - t.high).toFixed(1)} points over your ${t.high}% limit</span></div>
    <div class="fix-moves">${priceMove}<div class="move-or">or</div>
      <div class="move"><div class="move-label">Trim the portion by</div><div class="move-val">${portionCut.toFixed(0)}%</div><div class="move-note">keep the ${fmt(dish.price)} price</div></div></div>
    <p class="fix-lede">${driver} Either change brings food cost back to your ${t.mid}% goal.</p>
  </section>`;
}

// A simple bar showing where this dish's food cost sits vs. the target zone.
function targetBar(pct, st, t = targets(), what = "Food cost") {
  const max = Math.max(50, Math.ceil((Math.max(pct, t.high) + 6) / 10) * 10);
  const at = (v) => Math.min(100, Math.max(0, (v / max) * 100)).toFixed(2);
  const zoneMid = ((t.low + t.high) / 2 / max) * 100;
  return `
    <div class="gauge" role="img" aria-label="${what} ${fmtPct(pct)}; target ${t.low} to ${t.high} percent">
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
    ${action}
    <div class="section-label">Recipe breakdown</div>
    <table class="ingredients">
      <thead><tr><th>Ingredient</th><th class="num">Qty</th><th class="num">Cost</th></tr></thead>
      <tbody>${rows}</tbody>
      <tfoot><tr><td>Total</td><td></td><td class="num mono">${fmt(cost)}</td></tr></tfoot>
    </table>
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
      <div class="tag">Your biggest earner is over target</div>
      <p><strong>${esc(top.d.name)}</strong> is ${vsMid}, but it's <strong>#${rank} on the menu for weekly margin</strong>: ${fmt0(top.weeklyMargin)} this week from ${top.units} plates. A small price bump or a slightly smaller portion here is worth more in real dollars than fixing a slow seller with a worse percentage.</p>`;
  } else {
    $("callout").innerHTML = `<div class="tag">Food cost vs. sales</div><p>Every dish that sold this week is within your target food cost range. Nothing to flag.</p>`;
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
    const text = labeled.has(r.d.id) ? `<text x="${cx.toFixed(1)}" y="${(cy - rad - 5).toFixed(1)}" font-size="10.5" font-weight="600" font-family="Figtree, system-ui, sans-serif" style="fill:var(--ink)" fill-opacity="0.85" text-anchor="middle">${esc(label)}</text>` : "";
    return `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${rad.toFixed(1)}" fill="${color[r.status]}" fill-opacity="0.82" style="stroke:var(--ink)" stroke-opacity="0.2"><title>${esc(r.d.name)}: ${r.units} sold, ${fmt(r.marginPerPlate)} margin/plate</title></circle>
      ${text}`;
  }).join("");

  const lbl = (xx, yy, fill, anchor, text) =>
    `<text x="${xx}" y="${yy}" font-size="11" font-family="Figtree, system-ui, sans-serif" style="fill:${fill}" text-anchor="${anchor}" font-weight="600">${text}</text>`;
  $("quadrantChart").innerHTML = `
    <svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;display:block" role="img" aria-label="Popularity versus profitability chart">
      <line x1="${PAD}" y1="${H - PAD}" x2="${W - PAD}" y2="${H - PAD}" style="stroke:var(--ink)" stroke-opacity="0.3"/>
      <line x1="${PAD}" y1="${PAD - 10}" x2="${PAD}" y2="${H - PAD}" style="stroke:var(--ink)" stroke-opacity="0.3"/>
      <line x1="${ax}" y1="${PAD - 10}" x2="${ax}" y2="${H - PAD}" style="stroke:var(--ink)" stroke-opacity="0.2" stroke-dasharray="4 4"/>
      <line x1="${PAD}" y1="${ay}" x2="${W - PAD}" y2="${ay}" style="stroke:var(--ink)" stroke-opacity="0.2" stroke-dasharray="4 4"/>
      ${lbl(W - PAD, PAD - 16, "var(--good)", "end", "Stars: popular and profitable")}
      ${lbl(W - PAD, H - PAD + 22, "var(--watch)", "end", "Plowhorses: popular, thinner margin")}
      ${lbl(PAD, PAD - 16, "var(--puzzle)", "start", "Puzzles: profitable, sell more of these")}
      ${lbl(PAD, H - PAD + 22, "var(--over)", "start", "Dogs: slow and thin")}
      <text x="${W / 2}" y="${H - 8}" font-size="11" font-family="Figtree, system-ui, sans-serif" style="fill:var(--ink)" fill-opacity="0.6" text-anchor="middle">Units sold per week →</text>
      <text x="14" y="${H / 2}" font-size="11" font-family="Figtree, system-ui, sans-serif" style="fill:var(--ink)" fill-opacity="0.6" text-anchor="middle" transform="rotate(-90 14 ${H / 2})">Margin $ per plate →</text>
      ${points}
    </svg>`;
}

function renderPerfTable(sorted, totalMargin, avgUnits, avgMargin) {
  const body = sorted.map((r) => {
    const q = quadrantOf(r.units, r.marginPerPlate, avgUnits, avgMargin);
    const share = totalMargin ? (r.weeklyMargin / totalMargin) * 100 : 0;
    return `<tr data-id="${r.d.id}">
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
  $("salesFromPosBtn").classList.toggle("hidden", !posEnabled || !dishes.length);
  const existing = salesByWeek.get(salesWeek);
  $("salesWeekNote").textContent = existing ? "Saved numbers loaded. Edit and save again to update." : "Nothing saved for this week yet.";
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
  document.querySelectorAll(".stock-field").forEach((el) => el.classList.toggle("hidden", !stockReady));
  const list = [...ingredients.values()].filter((i) => !q || i.name.toLowerCase().includes(q)).sort((a, b) => a.name.localeCompare(b.name));
  if (!ingredients.size) { $("ingTable").innerHTML = `<tbody><tr><td class="muted">No ingredients yet. Add one above.</td></tr></tbody>`; return; }
  const cols = stockReady ? 7 : 5;
  $("ingTable").innerHTML = `
    <thead><tr><th>Ingredient</th><th>Unit</th><th class="num">Cost per unit ($)</th>${stockReady ? `<th class="num">On hand</th><th>Use by</th>` : ""}<th>Used in</th><th></th></tr></thead>
    <tbody>${list.map((i) => {
      const used = usage.get(i.id) || [];
      return `<tr data-row="${i.id}">
        <td><input data-id="${i.id}" data-field="name" value="${esc(i.name)}" maxlength="100" aria-label="Name"></td>
        <td style="width:90px"><input data-id="${i.id}" data-field="unit" value="${esc(i.unit)}" maxlength="20" list="unitList" aria-label="Unit"></td>
        <td class="num" style="width:140px"><input class="num mono" data-id="${i.id}" data-field="cost" type="number" min="0" step="0.01" value="${trimNum(i.cost)}" aria-label="Cost"></td>
        ${stockReady ? `<td class="num" style="width:110px"><input class="num mono" data-id="${i.id}" data-field="on_hand" type="number" min="0" step="0.5" value="${i.on_hand == null ? "" : trimNum(i.on_hand)}" placeholder="—" aria-label="On hand"></td>
        <td style="width:250px"><div class="useby"><input data-id="${i.id}" data-field="use_by" type="date" value="${i.use_by || ""}" aria-label="Use by"><span data-tag="${i.id}">${spoilTag(i)}</span></div></td>` : ""}
        <td class="used" title="${esc(used.join(", "))}">${used.length ? `${used.length} dish${used.length > 1 ? "es" : ""}` : "—"}</td>
        <td class="num"><button class="iconbtn" data-del-ing="${i.id}" type="button" aria-label="Delete ${esc(i.name)}">✕</button></td>
      </tr>`;
    }).join("") || `<tr><td colspan="${cols}" class="muted">Nothing matches "${esc(q)}".</td></tr>`}</tbody>`;
}

async function updateIngredient(input) {
  const id = input.dataset.id, field = input.dataset.field;
  const ing = ingredients.get(id);
  if (!ing) return;
  const shown = (f) => (f === "cost" ? trimNum(ing.cost) : f === "on_hand" ? (ing.on_hand == null ? "" : trimNum(ing.on_hand)) : ing[f] ?? "");
  let val = input.value.trim();
  if (field === "cost") {
    val = Number(val);
    if (input.value.trim() === "" || !Number.isFinite(val) || val < 0) { toast("Cost must be a number, 0 or more.", "err"); input.value = shown(field); return; }
    if (val === ing.cost) return;
  } else if (field === "on_hand") {
    val = val === "" ? null : Number(val);
    if (val !== null && (!Number.isFinite(val) || val < 0)) { toast("On hand must be a number, 0 or more (or blank).", "err"); input.value = shown(field); return; }
    if (val === ing.on_hand) return;
  } else if (field === "use_by") {
    val = val || null;
    if (val === ing.use_by) return;
  } else {
    if (!val) { toast("That can't be blank.", "err"); input.value = ing[field]; return; }
    if (val === ing[field]) return;
  }
  try {
    const row = await run(sb.from("ingredients").update({ [field]: val, updated_at: new Date().toISOString() }).eq("id", id).select(ingCols()).single());
    const fresh = ingRow(row);
    ingredients.set(id, fresh);
    const tag = document.querySelector(`[data-tag="${id}"]`);
    if (tag) tag.innerHTML = spoilTag(fresh);
    const tr = input.closest("tr");
    tr.classList.remove("saved"); void tr.offsetWidth; tr.classList.add("saved");
    toast(`Saved ${row.name}.`);
  } catch { input.value = shown(field); }
}

async function addIngredient(e) {
  e.preventDefault();
  const name = $("newIngName").value.trim(), unit = $("newIngUnit").value.trim(), cost = Number($("newIngCost").value);
  if (!name || !unit || !Number.isFinite(cost) || cost < 0) { toast("Fill in a name, unit, and a cost of 0 or more.", "err"); return; }
  const row = { restaurant_id: rest.id, name, unit, cost };
  if (stockReady) {
    const oh = $("newIngOnHand").value.trim();
    if (oh !== "") {
      const n = Number(oh);
      if (!Number.isFinite(n) || n < 0) { toast("On hand must be a number, 0 or more (or blank).", "err"); return; }
      row.on_hand = n;
    }
    if ($("newIngUseBy").value) row.use_by = $("newIngUseBy").value;
  }
  try {
    const saved = await run(sb.from("ingredients").insert(row).select(ingCols()).single());
    ingredients.set(saved.id, ingRow(saved));
    $("newIngName").value = ""; $("newIngCost").value = ""; $("newIngOnHand").value = ""; $("newIngUseBy").value = "";
    $("newIngName").focus();
    renderIngredients();
    toast(`Added ${saved.name}.`);
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

// ---------------------------------------------------------- Labor Costs
const DEPTS = ["FOH", "BOH", "Mgmt"];
const DEPT_LABEL = { FOH: "Front of house", BOH: "Back of house", Mgmt: "Management" };
const OT_AFTER = 40;  // weekly hours before overtime (time and a half)

function numOr(v, d) { const n = Number(v); return v === null || v === undefined || v === "" || !Number.isFinite(n) ? d : n; }
const laborTargets = () => ({ low: numOr(rest.labor_low, 25), mid: numOr(rest.labor_mid, 28), high: numOr(rest.labor_high, 32) });
const laborBurden = () => numOr(rest.labor_burden, 10);
function statusVs(pct, t) { return pct <= t.low ? "green" : pct <= t.high ? "amber" : "red"; }

function setupCard(what) {
  return `<h3>One more database step</h3>
    <p>${what} needs three new database tables. In Supabase, open <strong>SQL Editor</strong> → <strong>New query</strong>, paste in everything from <code>supabase/labor-and-mod.sql</code>, click <strong>Run</strong>, then reload this page.</p>`;
}

// One person's wages for one week. Hourly staff get time and a half past 40 hours.
function staffWages(s, hours, raisePct = 0) {
  const rate = Number(s.rate) * (1 + raisePct / 100);
  if (s.pay_type === "salary") return { ot: 0, wages: rate, otPremium: 0 };
  const ot = Math.max(0, hours - OT_AFTER);
  return { ot, wages: rate * (hours - ot) + rate * 1.5 * ot, otPremium: rate * 0.5 * ot };
}
function raiseFor(s) { return laborRaise.pct && (laborRaise.dept === "all" || laborRaise.dept === s.department) ? laborRaise.pct : 0; }

// Labor totals for a week. "hours" is a Map(staffId -> hours) of who worked.
function laborTotals(hours, withWhatIf = false) {
  const burden = 1 + laborBurden() / 100;
  const out = { hours: 0, hourlyHours: 0, hourlyCost: 0, ot: 0, otPremium: 0, wages: 0, total: 0, byDept: {} };
  for (const d of DEPTS) out.byDept[d] = { hours: 0, total: 0 };
  for (const s of staff) {
    if (!hours.has(s.id)) continue;
    const h = hours.get(s.id);
    const w = staffWages(s, h, withWhatIf ? raiseFor(s) : 0);
    const cost = w.wages * burden;
    out.hours += h; out.wages += w.wages; out.total += cost;
    out.ot += w.ot; out.otPremium += w.otPremium * burden;
    if (s.pay_type !== "salary") { out.hourlyHours += h; out.hourlyCost += cost; }
    out.byDept[s.department].hours += h;
    out.byDept[s.department].total += cost;
  }
  return out;
}

// Sales and (real, not what-if) food cost for a week, from the Weekly Sales tab.
function salesForWeek(week) {
  const m = salesByWeek.get(week);
  let revenue = 0, food = 0;
  if (m) for (const d of dishes) {
    const u = m.get(d.id) || 0;
    revenue += u * d.price;
    food += u * d.items.reduce((s, it) => s + (ingredients.get(it.ingredient_id)?.cost || 0) * it.qty, 0);
  }
  return { revenue, food };
}

function laborWeeks() { return [...laborByWeek.keys()].sort().reverse(); }

function renderLabor() {
  $("laborSetup").classList.toggle("hidden", extrasReady);
  $("laborWrap").classList.toggle("hidden", !extrasReady);
  if (!extrasReady) { $("laborSetup").innerHTML = setupCard("Labor Costs"); return; }
  if (!laborWeek) laborWeek = laborWeeks()[0] || sortedWeeks()[0] || dayStr(mondayOf(new Date()));
  $("laborWeek").value = laborWeek;
  renderLaborSummary();
  renderLaborHours();
  renderStaffTable();
  renderLaborWeeks();
}

function renderLaborSummary() {
  const t = laborTargets();
  const whatIf = laborRaise.pct !== 0;
  const who = laborRaise.dept === "all" ? "All" : laborRaise.dept;
  $("laborRaiseChip").innerHTML = whatIf
    ? `<span class="chip ${laborRaise.pct > 0 ? "up" : "down"}">What-if: ${who} wages ${laborRaise.pct > 0 ? "+" : ""}${laborRaise.pct}% <button type="button" id="laborRaiseClear" aria-label="Remove what-if">✕</button></span>`
    : "";
  if (!laborByWeek.has(laborWeek)) {
    $("laborMetrics").innerHTML = "";
    $("laborSummary").innerHTML = `<p class="muted">No hours saved for the ${weekPhrase(laborWeek)} yet. Enter them under <strong>Hours worked</strong> and click <strong>Save hours</strong>.</p>`;
    return;
  }
  const L = laborTotals(laborByWeek.get(laborWeek), whatIf);
  const { revenue, food } = salesForWeek(laborWeek);
  const pct = revenue ? (L.total / revenue) * 100 : null;
  const prime = revenue ? ((L.total + food) / revenue) * 100 : null;
  const st = pct === null ? "" : statusVs(pct, t);
  $("laborMetrics").innerHTML = `
    <div class="metric"><div class="num mono">${fmt0(L.total)}</div><div class="label">Labor cost${whatIf ? " (what-if)" : ""}, incl. ${laborBurden()}% taxes &amp; benefits</div></div>
    <div class="metric ${st === "red" ? "warn" : st === "green" ? "good" : ""}"><div class="num mono">${pct === null ? "—" : fmtPct(pct)}</div><div class="label">Labor cost % of sales (target ${t.low}–${t.high}%)</div></div>
    <div class="metric ${prime > 65 ? "warn" : ""}"><div class="num mono">${prime === null ? "—" : fmtPct(prime)}</div><div class="label">Prime cost % (food + labor)</div></div>
    <div class="metric"><div class="num mono">${revenue && L.hours ? fmt(revenue / L.hours) : "—"}</div><div class="label">Sales per labor hour</div></div>`;

  if (!revenue) {
    $("laborSummary").innerHTML = `<div class="action-box"><div class="tag">No sales for this week</div><p>Labor cost % compares labor to sales. Enter plates sold for the ${weekPhrase(laborWeek)} on the Weekly Sales tab to see it.</p></div>`;
    return;
  }
  const deptRows = DEPTS.filter((d) => L.byDept[d].hours || L.byDept[d].total).map((d) => {
    const x = L.byDept[d];
    return `<tr><td>${DEPT_LABEL[d]}</td><td class="num mono">${trimNum(x.hours)}</td><td class="num mono">${fmt0(x.total)}</td>
      <td class="num mono">${fmtPct((x.total / revenue) * 100)}</td><td class="num mono">${L.total ? fmtPct((x.total / L.total) * 100) : "—"}</td></tr>`;
  }).join("");
  const action = laborAction(L, revenue, pct, t);
  $("laborSummary").innerHTML = `
    ${targetBar(pct, st, t, "Labor cost")}
    <div class="section-label">By department</div>
    <table class="ingredients">
      <thead><tr><th>Department</th><th class="num">Hours</th><th class="num">Labor $</th><th class="num">% of sales</th><th class="num">Share of labor</th></tr></thead>
      <tbody>${deptRows}</tbody>
      <tfoot><tr><td>Total</td><td class="num mono">${trimNum(L.hours)}</td><td class="num mono">${fmt0(L.total)}</td><td class="num mono">${fmtPct(pct)}</td><td></td></tr></tfoot>
    </table>
    <div class="section-label">Suggested action</div>
    <div class="action-box ${action.ok ? "ok" : ""}"><div class="tag">${action.ok ? "No action needed" : "Labor running high"}</div><p>${action.text}</p></div>`;
}

function laborAction(L, revenue, pct, t) {
  const otText = L.ot ? ` <strong>${trimNum(L.ot)} overtime hour${L.ot === 1 ? "" : "s"}</strong> cost ${fmt0(L.otPremium)} extra in time-and-a-half pay; spreading those shifts out would save that.` : "";
  if (pct <= t.mid) {
    const where = pct <= t.low ? `under your ${t.low}% target` : `inside your range and under your ${t.mid}% goal`;
    return { ok: !L.ot, text: `Labor is ${fmtPct(pct)} of sales, ${where}.${otText}` };
  }
  const goal = revenue * (t.mid / 100);
  const over = L.total - goal;
  const avg = L.hourlyHours ? L.hourlyCost / L.hourlyHours : 0;
  const moreSales = L.total / (t.mid / 100) - revenue;
  let text = `${pct <= t.high ? "Trending high" : "Over target"}. At this week's sales (${fmt0(revenue)}), labor needs to be <strong>${fmt0(goal)}</strong> to hit your ${t.mid}% goal, which is <strong>${fmt0(over)}</strong> less.`;
  if (avg) text += ` That's about <strong>${Math.ceil(over / avg)} fewer hourly staff hours</strong> (they cost ${fmt(avg)}/hr on average, incl. taxes), or about <strong>${fmt0(moreSales)}</strong> more in sales on the same schedule.`;
  return { ok: false, text: text + otText };
}

// Hours already typed in the table (so re-drawing it doesn't lose them).
function typedLaborHours() {
  const typed = new Map();
  document.querySelectorAll("#laborTable input[data-hours]").forEach((inp) => {
    const paid = document.querySelector(`#laborTable input[data-paid="${inp.dataset.hours}"]`);
    typed.set(inp.dataset.hours, { h: inp.value, paid: paid ? paid.checked : null });
  });
  return typed;
}

function renderLaborHours(typed = null) {
  const saved = laborByWeek.get(laborWeek);
  $("laborWeekNote").textContent = saved ? "Saved hours loaded. Edit and save again to update." : "Nothing saved for this week yet.";
  const people = staff.filter((s) => s.active || saved?.has(s.id));
  if (!people.length) {
    $("laborTable").innerHTML = `<tbody><tr><td class="muted">Add your team under <strong>Your team</strong> first.</td></tr></tbody>`;
    updateLaborTotal();
    return;
  }
  const body = DEPTS.map((dep) => {
    const list = people.filter((s) => s.department === dep);
    if (!list.length) return "";
    return `<tr class="group"><td colspan="6">${DEPT_LABEL[dep]}</td></tr>` + list.map((s) => {
      const tv = typed?.get(s.id);
      const h = tv ? tv.h : saved?.has(s.id) ? trimNum(saved.get(s.id)) : "";
      const salary = s.pay_type === "salary";
      const paid = tv && tv.paid !== null ? tv.paid : saved ? saved.has(s.id) : s.active;
      return `<tr>
        <td>${esc(s.name)}</td><td class="used">${esc(s.role)}</td>
        <td class="num mono">${salary
          ? `${fmt(s.rate)}/wk <label class="paid"><input type="checkbox" data-paid="${s.id}" ${paid ? "checked" : ""}> Paid</label>`
          : `${fmt(s.rate)}/hr`}</td>
        <td class="num"><input class="num mono" type="number" min="0" max="168" step="0.25" inputmode="decimal" data-hours="${s.id}" value="${h}" placeholder="${salary ? "optional" : "—"}" aria-label="Hours for ${esc(s.name)}"></td>
        <td class="num mono" data-ot="${s.id}"></td>
        <td class="num mono" data-wage="${s.id}"></td>
      </tr>`;
    }).join("");
  }).join("");
  $("laborTable").innerHTML = `
    <thead><tr><th>Name</th><th>Role</th><th class="num">Pay</th><th class="num">Hours</th><th class="num">Overtime</th><th class="num">Wages</th></tr></thead>
    <tbody>${body}</tbody>`;
  updateLaborTotal();
}

// Reads the hours table: Map(staffId -> hours) of everyone being paid this week.
function laborFromTable() {
  const m = new Map();
  for (const s of staff) {
    const inp = document.querySelector(`#laborTable input[data-hours="${s.id}"]`);
    if (!inp) continue;
    const h = inp.value.trim() === "" ? null : Number(inp.value);
    if (s.pay_type === "salary") {
      if (document.querySelector(`#laborTable input[data-paid="${s.id}"]`)?.checked) m.set(s.id, Number.isFinite(h) && h > 0 ? h : 0);
    } else if (h !== null && Number.isFinite(h)) m.set(s.id, h);
  }
  return m;
}

function updateLaborTotal() {
  const m = laborFromTable();
  for (const s of staff) {
    const otCell = document.querySelector(`[data-ot="${s.id}"]`), wageCell = document.querySelector(`[data-wage="${s.id}"]`);
    if (!wageCell) continue;
    const w = m.has(s.id) ? staffWages(s, m.get(s.id)) : null;
    otCell.textContent = w && w.ot ? trimNum(w.ot) + " h" : "";
    wageCell.textContent = w ? fmt(w.wages) : "—";
  }
  const L = laborTotals(m);
  const { revenue } = salesForWeek(laborWeek);
  $("laborTotal").textContent = m.size
    ? `${trimNum(L.hours)} hours · ${fmt0(L.wages)} wages + ${laborBurden()}% taxes & benefits = ${fmt0(L.total)}` + (revenue ? ` · ${fmtPct((L.total / revenue) * 100)} of sales` : "")
    : "";
}

async function saveLabor() {
  const rows = [], removes = [];
  for (const s of staff) {
    const inp = document.querySelector(`#laborTable input[data-hours="${s.id}"]`);
    if (!inp) continue;
    const raw = inp.value.trim();
    const h = raw === "" ? null : Number(raw);
    if (h !== null && (!Number.isFinite(h) || h < 0 || h > 168)) { toast("Hours must be between 0 and 168.", "err"); inp.focus(); return; }
    const paid = s.pay_type === "salary" ? document.querySelector(`#laborTable input[data-paid="${s.id}"]`)?.checked : h !== null;
    if (paid) rows.push({ restaurant_id: rest.id, staff_id: s.id, week_start: laborWeek, hours: h ?? 0 });
    else removes.push(s.id);
  }
  if (!rows.length) { toast("Enter hours for at least one person first.", "err"); return; }
  const btn = $("saveLaborBtn");
  btn.disabled = true;
  try {
    await run(sb.from("labor_hours").upsert(rows, { onConflict: "staff_id,week_start" }));
    const had = laborByWeek.get(laborWeek);
    const gone = removes.filter((id) => had?.has(id));
    if (gone.length) await run(sb.from("labor_hours").delete().eq("restaurant_id", rest.id).eq("week_start", laborWeek).in("staff_id", gone));
    await loadExtras();
    renderLabor();
    toast(`Saved hours for the ${weekPhrase(laborWeek)}.`);
  } catch { /* toast shown */ } finally { btn.disabled = false; }
}

function copyLastWeek() {
  const prev = laborWeeks().find((w) => w < laborWeek);
  if (!prev) { toast("There's no earlier week with hours to copy.", "err"); return; }
  const m = laborByWeek.get(prev);
  const typed = new Map(staff.map((s) => [s.id, { h: m.has(s.id) ? trimNum(m.get(s.id)) : "", paid: m.has(s.id) }]));
  renderLaborHours(typed);
  toast(`Copied hours from the ${weekPhrase(prev)}. Click "Save hours" to keep them.`);
}

function renderStaffTable() {
  if (!staff.length) { $("staffTable").innerHTML = `<tbody><tr><td class="muted">No one on the team yet. Add people above.</td></tr></tbody>`; return; }
  const deptOpts = (v) => DEPTS.map((d) => `<option value="${d}" ${d === v ? "selected" : ""}>${DEPT_LABEL[d]}</option>`).join("");
  $("staffTable").innerHTML = `
    <thead><tr><th>Name</th><th>Role</th><th>Department</th><th>Pay</th><th class="num">Rate ($)</th><th>Active</th><th></th></tr></thead>
    <tbody>${staff.map((s) => `<tr>
      <td><input data-sid="${s.id}" data-field="name" value="${esc(s.name)}" maxlength="100" aria-label="Name"></td>
      <td><input data-sid="${s.id}" data-field="role" value="${esc(s.role)}" maxlength="40" list="roleList" aria-label="Role"></td>
      <td><select data-sid="${s.id}" data-field="department" aria-label="Department">${deptOpts(s.department)}</select></td>
      <td><select data-sid="${s.id}" data-field="pay_type" aria-label="Pay type">
        <option value="hourly" ${s.pay_type === "hourly" ? "selected" : ""}>Hourly</option>
        <option value="salary" ${s.pay_type === "salary" ? "selected" : ""}>Salary (per week)</option></select></td>
      <td class="num" style="width:120px"><input class="num mono" data-sid="${s.id}" data-field="rate" type="number" min="0" step="0.01" value="${trimNum(s.rate)}" aria-label="Rate"></td>
      <td><input type="checkbox" data-sid="${s.id}" data-field="active" ${s.active ? "checked" : ""} aria-label="Active"></td>
      <td class="num"><button class="iconbtn" data-del-staff="${s.id}" type="button" aria-label="Delete ${esc(s.name)}">✕</button></td>
    </tr>`).join("")}</tbody>`;
}

async function addStaff(e) {
  e.preventDefault();
  const name = $("newStaffName").value.trim(), role = $("newStaffRole").value.trim(), rate = Number($("newStaffRate").value);
  if (!name || $("newStaffRate").value === "" || !Number.isFinite(rate) || rate < 0) { toast("Fill in a name and a pay rate of 0 or more.", "err"); return; }
  try {
    const typed = typedLaborHours();
    await run(sb.from("staff").insert({ restaurant_id: rest.id, name, role, department: $("newStaffDept").value, pay_type: $("newStaffPay").value, rate }));
    await loadExtras();
    $("newStaffName").value = ""; $("newStaffRole").value = ""; $("newStaffRate").value = "";
    $("newStaffName").focus();
    renderStaffTable(); renderLaborHours(typed); renderLaborSummary(); renderLaborWeeks();
    toast(`Added ${name}.`);
  } catch { /* toast shown */ }
}

async function updateStaff(input) {
  const s = staff.find((x) => x.id === input.dataset.sid);
  if (!s) return;
  const field = input.dataset.field;
  let val = input.type === "checkbox" ? input.checked : input.value.trim();
  if (field === "rate") {
    val = Number(val);
    if (input.value.trim() === "" || !Number.isFinite(val) || val < 0) { toast("Rate must be a number, 0 or more.", "err"); input.value = trimNum(s.rate); return; }
  } else if (field === "name" && !val) { toast("Name can't be blank.", "err"); input.value = s.name; return; }
  if (val === s[field]) return;
  try {
    const typed = typedLaborHours();
    await run(sb.from("staff").update({ [field]: val }).eq("id", s.id));
    await loadExtras();
    renderLaborHours(typed); renderLaborSummary(); renderLaborWeeks();
    if (field === "department") renderStaffTable();
    toast(`Saved ${s.name}.`);
  } catch { input.type === "checkbox" ? (input.checked = s[field]) : (input.value = field === "rate" ? trimNum(s.rate) : s[field]); }
}

async function deleteStaff(id) {
  const s = staff.find((x) => x.id === id);
  if (!s || !confirm(`Delete ${s.name}? Their hours in every past week are deleted too.\n\nTip: untick "Active" instead to hide them but keep history.`)) return;
  try {
    const typed = typedLaborHours();
    await run(sb.from("staff").delete().eq("id", id));
    await loadExtras();
    renderStaffTable(); renderLaborHours(typed); renderLaborSummary(); renderLaborWeeks();
    toast(`Deleted ${s.name}.`);
  } catch { /* toast shown */ }
}

function renderLaborWeeks() {
  const weeks = laborWeeks();
  const t = laborTargets();
  $("laborWeeksTable").innerHTML = weeks.length ? `
    <thead><tr><th>Week</th><th class="num">Hours</th><th class="num">Labor $</th><th class="num">Sales</th><th class="num">Labor %</th><th class="num">Prime cost %</th><th></th></tr></thead>
    <tbody>${weeks.map((w) => {
      const L = laborTotals(laborByWeek.get(w));
      const { revenue, food } = salesForWeek(w);
      const pct = revenue ? (L.total / revenue) * 100 : null;
      return `<tr><td>${fmtWeek(w)}</td><td class="num mono">${trimNum(L.hours)}</td><td class="num mono">${fmt0(L.total)}</td>
        <td class="num mono">${revenue ? fmt0(revenue) : "—"}</td>
        <td class="num mono">${pct === null ? "—" : `<span class="dot ${statusVs(pct, t)}" style="margin-right:6px"></span>${fmtPct(pct)}`}</td>
        <td class="num mono">${revenue ? fmtPct(((L.total + food) / revenue) * 100) : "—"}</td>
        <td class="num"><button class="linkbtn" data-labor-week="${w}" type="button">${w === laborWeek ? "Showing" : "Open"}</button></td></tr>`;
    }).join("")}</tbody>` : `<tbody><tr><td class="muted">No weeks saved yet.</td></tr></tbody>`;
}

function setLaborWeek(w) {
  laborWeek = w;
  renderLabor();
}

// ---------------------------------------------------------- MOD Report
const SHIFTS = ["Breakfast", "Brunch", "Lunch", "Dinner", "Late night", "All day"];
// Usual first and last hour for each shift (the last hour is the hour the last tables sit down).
const SHIFT_HOURS = { Breakfast: [7, 10], Brunch: [10, 14], Lunch: [11, 14], Dinner: [17, 21], "Late night": [21, 25], "All day": [11, 22] };
const WEATHER = ["Sunny", "Partly cloudy", "Cloudy", "Rain", "Thunderstorms", "Snow / ice", "Fog", "Windy", "Extreme heat", "Extreme cold"];
const EMP_ISSUES = ["Called out sick", "No call / no show", "Late arrival", "Left early / sent home", "Injury: cut", "Injury: burn",
  "Injury: slip or fall", "Coworker dispute", "Guest complaint about employee", "Conduct / policy issue", "Other"];
const GUEST_ISSUES = ["Guest injury / accident", "Food: undercooked", "Food: overcooked / wrong temp", "Food: quality or taste",
  "Foreign object in food", "Allergy concern", "Wrong order", "Slow service / long wait", "Staff attitude", "Billing / payment issue", "Other"];
const COMP_TYPES = ["Comp: VIP / regular", "Comp: kitchen mistake", "Comp: service mistake", "Void: rung in wrong", "Recook",
  "Refund", "Discount", "Event", "Buyout", "Employee / manager meal", "Promo / marketing", "Other"];
const CHECKS = [["temps", "Temperature logs done"], ["cleaning", "Cleaning checklist done"], ["deposit", "Cash deposit made"], ["alarm", "Doors locked & alarm set"]];
const LIST_ROWS = {
  employee: () => ({ dept: "FOH", name: "", type: "", notes: "", action: "" }),
  guest: () => ({ type: "", table: "", notes: "", resolution: "" }),
  comps: () => ({ type: "", item: "", amount: "", reason: "", approved: "" }),
};

function clone(o) { return JSON.parse(JSON.stringify(o)); }
function fmtHour(h) { h %= 24; return h === 0 ? "12 AM" : h < 12 ? `${h} AM` : h === 12 ? "12 PM" : `${h - 12} PM`; }
function fmtReportDay(s) { return parseDay(s).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" }); }

function blankReportData() {
  return {
    weather: "", temp: "", weather_notes: "", sales: "", hours_from: 11, hours_to: 22, hourly: {},
    staffing: { foh_sched: "", foh_actual: "", boh_sched: "", boh_actual: "" },
    employee: [], guest: [], comps: [], eighty_six: "", maintenance: "",
    cash_over_short: "", checks: {},
    forecast: { covers: "", sales: "", reservations: "", events: "", staffing: "", prep: "" },
    summary: "", wins: "", followups: "",
  };
}

function reportFrom(r) {
  const b = blankReportData(), d = r.data || {};
  return {
    id: r.id, report_date: r.report_date, shift: r.shift, manager: r.manager || "",
    data: { ...b, ...clone(d), staffing: { ...b.staffing, ...(d.staffing || {}) }, forecast: { ...b.forecast, ...(d.forecast || {}) } },
  };
}

function startReport(id) {
  if (modDirty && !confirm("You have unsaved changes to this report. Throw them away?")) return false;
  editingReportId = id;
  if (id === "new") {
    const now = new Date();
    const last = modReports[0];
    modDraft = { id: null, report_date: dayStr(now), shift: now.getHours() < 16 ? "Lunch" : "Dinner", manager: last?.manager || "", data: blankReportData() };
    [modDraft.data.hours_from, modDraft.data.hours_to] = SHIFT_HOURS[modDraft.shift];
    modAutoPull = true;
  } else {
    const r = modReports.find((x) => x.id === id);
    modDraft = r ? reportFrom(r) : null;
    // A saved report with no numbers yet gets them from the POS; one that has numbers is left alone.
    const d = modDraft?.data;
    modAutoPull = !!d && !d.pos_pulled && !String(d.sales).trim() && !Object.keys(d.hourly || {}).length;
  }
  modPosNote = "";
  modDirty = false;
  return true;
}

function reportStats(d) {
  let covers = 0, peak = null, rush = null;
  const c = (h) => Number(d.hourly[h]) || 0;
  for (let h = d.hours_from; h <= d.hours_to; h++) {
    covers += c(h);
    if (c(h) > 0 && (!peak || c(h) > peak.covers)) peak = { h, covers: c(h) };
    if (h < d.hours_to && c(h) + c(h + 1) > 0 && (!rush || c(h) + c(h + 1) > rush.covers)) rush = { h, covers: c(h) + c(h + 1) };
  }
  const comps = (d.comps || []).reduce((s, x) => s + (Number(x.amount) || 0), 0);
  const sales = Number(d.sales) || 0;
  const injuries = [...(d.employee || []), ...(d.guest || [])].filter((x) => /injury/i.test(x.type)).length;
  return { covers, peak, rush, comps, sales, avgCheck: covers && sales ? sales / covers : 0,
    emp: (d.employee || []).length, guest: (d.guest || []).length, injuries };
}

function renderMod() {
  if (!extrasReady) {
    $("modMetrics").innerHTML = "";
    $("reportList").innerHTML = `<div class="rail-empty">Not set up yet.</div>`;
    $("modEditor").className = "panel";
    $("modEditor").innerHTML = setupCard("The MOD Report");
    return;
  }
  if (editingReportId !== "new" && !modReports.some((r) => r.id === editingReportId)) { editingReportId = null; modDraft = null; modDirty = false; }
  if (!modDraft) startReport(modReports[0]?.id || "new");
  renderModMetrics();
  renderReportList();
  renderModEditor();
  if (modAutoPull) { modAutoPull = false; if (posEnabled) pullMod(true); }
}

function renderModMetrics() {
  const since = addDays(dayStr(new Date()), -6);
  const recent = modReports.filter((r) => r.report_date >= since).map((r) => reportStats(reportFrom(r).data));
  if (!modReports.length) { $("modMetrics").innerHTML = ""; return; }
  const sum = (k) => recent.reduce((s, x) => s + x[k], 0);
  const inj = sum("injuries");
  $("modMetrics").innerHTML = `
    <div class="metric"><div class="num mono">${sum("covers").toLocaleString()}</div><div class="label">Covers, last 7 days (${recent.length} report${recent.length === 1 ? "" : "s"})</div></div>
    <div class="metric"><div class="num mono">${fmt0(sum("comps"))}</div><div class="label">Comps, voids &amp; refunds, last 7 days</div></div>
    <div class="metric ${sum("emp") ? "warn" : ""}"><div class="num mono">${sum("emp")}</div><div class="label">Employee issues, last 7 days</div></div>
    <div class="metric ${sum("guest") ? "warn" : ""}"><div class="num mono">${sum("guest")}</div><div class="label">Guest issues, last 7 days${inj ? ` · ${inj} injur${inj === 1 ? "y" : "ies"}` : ""}</div></div>`;
}

function renderReportList() {
  const draftRow = editingReportId === "new"
    ? `<button type="button" class="dish-row selected"><span class="info"><span class="name">${fmtReportDay(modDraft.report_date || dayStr(new Date()))} · ${esc(modDraft.shift)}</span><span class="cat">New report, not saved yet</span></span></button>`
    : "";
  $("reportList").innerHTML = draftRow + (modReports.map((r) => {
    const st = reportStats(reportFrom(r).data);
    const issues = st.emp + st.guest;
    const dot = st.injuries ? "red" : issues ? "amber" : "green";
    const bits = [r.manager, st.covers ? `${st.covers} covers` : "", st.sales ? fmt0(st.sales) : "", issues ? `${issues} issue${issues === 1 ? "" : "s"}` : "no issues"].filter(Boolean);
    return `<button type="button" class="dish-row ${r.id === editingReportId ? "selected" : ""}" data-report="${r.id}">
        <span class="dot ${dot}"></span>
        <span class="info"><span class="name">${fmtReportDay(r.report_date)} · ${esc(r.shift)}</span><span class="cat">${esc(bits.join(" · "))}</span></span>
      </button>`;
  }).join("") || (draftRow ? "" : `<div class="rail-empty">No reports yet.</div>`));
}

function renderModEditor() {
  const el = $("modEditor");
  el.className = "panel mod";
  const r = modDraft, d = r.data;
  const opts = (list, v, blank) => (blank ? `<option value="">${blank}</option>` : "") +
    list.map((x) => `<option ${x === v ? "selected" : ""}>${esc(x)}</option>`).join("");
  const hourOpts = (from, to, v) => { let o = ""; for (let h = from; h <= to; h++) o += `<option value="${h}" ${h === v ? "selected" : ""}>${fmtHour(h)}</option>`; return o; };
  const input = (label, path, val, attrs = "") => `<label>${label}<input data-f="${path}" value="${esc(val)}" ${attrs}></label>`;
  const area = (label, path, val, ph) => `<label class="wide">${label}<textarea data-f="${path}" rows="3" placeholder="${esc(ph)}">${esc(val)}</textarea></label>`;
  // Each issue / comp is a small card: short fields side by side, long ones full width.
  const rowsTable = (list, cols, addLabel, empty) => {
    const cards = d[list].map((row, i) => `<div class="row-card">
        <button class="iconbtn" data-del-row="${list}:${i}" type="button" aria-label="Remove this line">✕</button>
        <div class="form-grid">${cols.map((c) => `<label${c.wide ? ` class="wide"` : ""}>${c.label}${c.options
          ? `<select data-row="${list}" data-i="${i}" data-k="${c.k}">${opts(c.options, row[c.k], c.blank)}</select>`
          : `<input data-row="${list}" data-i="${i}" data-k="${c.k}" value="${esc(row[c.k])}" placeholder="${esc(c.ph || "")}" ${c.money ? `type="number" step="0.01" min="0" class="mono"` : `maxlength="300"`}>`}</label>`).join("")}
        </div></div>`).join("");
    return (cards || `<p class="muted small">${empty}</p>`) + `<button class="ghostbtn dark" data-add="${list}" type="button">${addLabel}</button>`;
  };
  const hours = [];
  for (let h = d.hours_from; h <= d.hours_to; h++) hours.push(h);

  // Same shift, one week before tomorrow: a starting point for the forecast.
  const ref = modReports.find((x) => x.report_date === addDays(r.report_date || dayStr(new Date()), -6) && x.shift === r.shift);
  const refStats = ref ? reportStats(reportFrom(ref).data) : null;
  const tomorrow = r.report_date ? parseDay(addDays(r.report_date, 1)).toLocaleDateString(undefined, { weekday: "long" }) : "tomorrow";

  el.innerHTML = `
    <div class="panel-head">
      <div><h2>${esc(rest.name)}: MOD report</h2><div class="cat">${r.id ? "Saved report. Changes are kept when you click \"Save report\"." : "New report. Nothing is saved until you click \"Save report\"."}</div></div>
    </div>
    <div class="form-grid">
      ${input("Date", "report_date", r.report_date, `type="date" required`)}
      <label>Shift<select data-f="shift">${opts(SHIFTS, r.shift)}</select></label>
      ${input("Manager on duty", "manager", r.manager, `maxlength="100" placeholder="Your name" id="modManager"`)}
      ${input("Net sales ($)", "data.sales", d.sales, `type="number" min="0" step="0.01" placeholder="From the POS"`)}
    </div>
    ${posEnabled
      ? `<div class="pos-bar"><button class="applybtn" id="pullPosBtn" type="button">Pull again from the POS</button><span class="note"><span id="posNote">${esc(modPosNote || "Covers by hour, net sales, comps, voids and discounts fill in on their own from the POS for this date and these hours.")}</span> You can still edit anything before you save.</span></div>`
      : `<div class="pos-bar off"><span class="note"><strong>Tired of typing these numbers?</strong> The Line POS add-on fills this report from your register in one tap.</span></div>`}
    <div class="preview" id="modSummary"></div>

    <div class="mod-section">
      <div class="section-label">Covers (guests) by hour</div>
      <div class="toolbar">
        <label class="stack">First hour<select data-f="data.hours_from">${hourOpts(5, 23, d.hours_from)}</select></label>
        <label class="stack">Last hour<select data-f="data.hours_to">${hourOpts(d.hours_from, 27, d.hours_to)}</select></label>
      </div>
      <table class="hours">
        <thead><tr><th>Hour</th><th class="num">Covers</th><th></th></tr></thead>
        <tbody>${hours.map((h) => `<tr data-hrow="${h}"><td>${fmtHour(h)}–${fmtHour(h + 1)}</td>
          <td class="num"><input type="number" min="0" step="1" inputmode="numeric" class="num mono" data-hour="${h}" value="${esc(d.hourly[h] ?? "")}" placeholder="—" aria-label="Covers ${fmtHour(h)}"></td>
          <td class="barcell"><span class="hbar" data-bar="${h}"></span></td></tr>`).join("")}</tbody>
        <tfoot><tr><td>Total</td><td class="num mono" id="coverTotal"></td><td class="note" id="peakNote"></td></tr></tfoot>
      </table>
    </div>

    <div class="mod-section">
      <div class="section-label">Staffing</div>
      <div class="form-grid">
        ${input("FOH scheduled", "data.staffing.foh_sched", d.staffing.foh_sched, `type="number" min="0" step="1"`)}
        ${input("FOH showed up", "data.staffing.foh_actual", d.staffing.foh_actual, `type="number" min="0" step="1"`)}
        ${input("BOH scheduled", "data.staffing.boh_sched", d.staffing.boh_sched, `type="number" min="0" step="1"`)}
        ${input("BOH showed up", "data.staffing.boh_actual", d.staffing.boh_actual, `type="number" min="0" step="1"`)}
      </div>
    </div>

    <div class="mod-section">
      <div class="section-label">Employee issues <span class="note" id="empCounts"></span></div>
      ${rowsTable("employee", [
        { k: "dept", label: "Department", options: DEPTS },
        { k: "name", label: "Employee", ph: "Name" },
        { k: "type", label: "Issue", options: EMP_ISSUES, blank: "Choose…" },
        { k: "notes", label: "What happened", ph: "e.g. Cut finger on mandoline, 6:40 PM", wide: true },
        { k: "action", label: "Action taken", ph: "e.g. First aid, incident form filed", wide: true },
      ], "+ Add employee issue", "No employee issues this shift.")}
    </div>

    <div class="mod-section">
      <div class="section-label">Guest issues</div>
      ${rowsTable("guest", [
        { k: "type", label: "Issue", options: GUEST_ISSUES, blank: "Choose…" },
        { k: "table", label: "Table / guest", ph: "e.g. Table 12" },
        { k: "notes", label: "What happened", ph: "e.g. Burger ordered medium came out rare", wide: true },
        { k: "resolution", label: "How it was resolved", ph: "e.g. Recooked, comped dessert", wide: true },
      ], "+ Add guest issue", "No guest issues this shift.")}
      <p class="note">Any injury (guest or employee): write up an incident report tonight, with times and witness names, and tell the owner.</p>
    </div>

    <div class="mod-section">
      <div class="section-label">Comps, voids &amp; refunds <span class="note" id="compTotal"></span></div>
      ${rowsTable("comps", [
        { k: "type", label: "Type", options: COMP_TYPES, blank: "Choose…" },
        { k: "item", label: "Item(s)", ph: "e.g. Sticky Toffee Pudding" },
        { k: "amount", label: "Amount ($)", money: true },
        { k: "reason", label: "Reason", ph: "e.g. Recook for Table 12", wide: true },
        { k: "approved", label: "Approved by", ph: "Manager" },
      ], "+ Add comp / void", "No comps or voids this shift.")}
    </div>

    <div class="mod-section">
      <div class="section-label">Kitchen &amp; building</div>
      <div class="form-grid">
        ${area("86'd items &amp; low stock", "data.eighty_six", d.eighty_six, "e.g. Fish & Chips 86'd at 9:15 PM, cod short 10 lb")}
        ${area("Equipment &amp; maintenance", "data.maintenance", d.maintenance, "e.g. Walk-in door gasket torn; fryer 2 slow to heat")}
      </div>
    </div>

    <div class="mod-section">
      <div class="section-label">Cash &amp; closing</div>
      <div class="form-grid">
        ${input("Cash over (+) / short (−) ($)", "data.cash_over_short", d.cash_over_short, `type="number" step="0.01" placeholder="0.00"`)}
      </div>
      <div class="checks">${CHECKS.map(([k, label]) => `<label class="check"><input type="checkbox" data-f="data.checks.${k}" ${d.checks[k] ? "checked" : ""}> ${label}</label>`).join("")}</div>
    </div>

    <div class="mod-section">
      <div class="section-label">Forecast for tomorrow's shift (${tomorrow})</div>
      ${refStats ? `<p class="note">Last ${tomorrow}'s ${esc(r.shift)}: ${refStats.covers} covers${refStats.sales ? `, ${fmt0(refStats.sales)} in sales` : ""}.</p>` : ""}
      <div class="form-grid">
        ${input("Expected covers", "data.forecast.covers", d.forecast.covers, `type="number" min="0" step="1"`)}
        ${input("Expected sales ($)", "data.forecast.sales", d.forecast.sales, `type="number" min="0" step="1"`)}
        ${area("Reservations &amp; large parties", "data.forecast.reservations", d.forecast.reservations, "e.g. Party of 14 at 7 PM")}
        ${area("Events, weather &amp; outside factors", "data.forecast.events", d.forecast.events, "e.g. Home game ends 6:30 PM, expect a rush")}
        ${area("Staffing plan", "data.forecast.staffing", d.forecast.staffing, "e.g. Add a 4th server 6–10 PM")}
        ${area("Prep &amp; ordering", "data.forecast.prep", d.forecast.prep, "e.g. Double batch of batter; confirm cod delivery")}
      </div>
    </div>

    <div class="mod-section">
      <div class="section-label">Shift notes</div>
      <div class="form-grid">
        ${area("Shift summary", "data.summary", d.summary, "How the shift went overall")}
        ${area("Wins &amp; shout-outs", "data.wins", d.wins, "Who went above and beyond")}
        ${area("Follow-ups for the next manager", "data.followups", d.followups, "What needs to happen next")}
      </div>
    </div>

    <div class="row-actions">
      <button class="applybtn" id="saveReportBtn" type="button">Save report</button>
      <button class="ghostbtn dark" id="printReportBtn" type="button">Print / save as PDF</button>
      <span class="spacer"></span>
      ${r.id ? `<button class="linkbtn danger" id="deleteReportBtn" type="button">Delete report</button>` : ""}
    </div>`;
  updateModSummary();
}

function updateModSummary() {
  const d = modDraft.data;
  const s = reportStats(d);
  const max = Math.max(1, ...Object.keys(d.hourly).map((h) => (h >= d.hours_from && h <= d.hours_to ? Number(d.hourly[h]) || 0 : 0)));
  document.querySelectorAll("#modEditor [data-bar]").forEach((bar) => {
    const h = Number(bar.dataset.bar), c = Number(d.hourly[h]) || 0;
    bar.style.width = `${(c / max) * 100}%`;
    bar.closest("tr").classList.toggle("peak", !!s.peak && c === s.peak.covers);
  });
  $("coverTotal").textContent = s.covers;
  $("peakNote").textContent = s.peak
    ? `Peak: ${fmtHour(s.peak.h)} (${s.peak.covers})` + (s.rush ? ` · busiest 2 hours: ${fmtHour(s.rush.h)}–${fmtHour(s.rush.h + 2)} (${s.rush.covers})` : "")
    : "";
  const byDept = DEPTS.map((dep) => [dep, d.employee.filter((x) => x.dept === dep).length]).filter(([, n]) => n);
  $("empCounts").textContent = byDept.length ? "· " + byDept.map(([dep, n]) => `${dep}: ${n}`).join(" · ") : "";
  $("compTotal").textContent = s.comps ? `· ${fmt(s.comps)} total` + (s.sales ? ` (${fmtPct((s.comps / s.sales) * 100)} of sales)` : "") : "";
  $("modSummary").innerHTML = `
    <div><div class="val mono">${s.covers}</div><div class="lbl">Covers</div></div>
    <div><div class="val mono">${s.sales ? fmt0(s.sales) : "—"}</div><div class="lbl">Net sales</div></div>
    <div><div class="val mono">${s.avgCheck ? fmt(s.avgCheck) : "—"}</div><div class="lbl">Average per guest</div></div>
    <div><div class="val mono">${s.peak ? fmtHour(s.peak.h) : "—"}</div><div class="lbl">Peak hour</div></div>
    <div><div class="val mono">${fmt(s.comps)}</div><div class="lbl">Comps &amp; voids</div></div>
    <div><div class="val mono">${s.emp + s.guest}</div><div class="lbl">Issues${s.injuries ? ` (${s.injuries} injury)` : ""}</div></div>`;
}

function setPath(obj, path, val) {
  const keys = path.split(".");
  let o = obj;
  for (const k of keys.slice(0, -1)) o = o[k] ??= {};
  o[keys.at(-1)] = val;
}

async function saveReport() {
  const r = modDraft;
  if (!r.report_date) { toast("Pick the date for this report.", "err"); return; }
  if (!r.manager.trim()) { toast("Add the manager on duty's name.", "err"); $("modManager")?.focus(); return; }
  const data = clone(r.data);
  // Drop lines that were added but never filled in.
  for (const k of Object.keys(LIST_ROWS)) data[k] = data[k].filter((row) => Object.entries(row).some(([f, v]) => f !== "dept" && String(v ?? "").trim() !== ""));
  for (const k of ["employee", "guest", "comps"]) {
    if (data[k].some((row) => !row.type)) { toast(`Pick a type for every line under ${k === "comps" ? "Comps, voids & refunds" : k === "guest" ? "Guest issues" : "Employee issues"}.`, "err"); return; }
  }
  data.hourly = Object.fromEntries(Object.entries(data.hourly).filter(([h, v]) => h >= data.hours_from && h <= data.hours_to && String(v).trim() !== ""));
  const row = { restaurant_id: rest.id, report_date: r.report_date, shift: r.shift, manager: r.manager.trim(), data, updated_at: new Date().toISOString() };
  const btn = $("saveReportBtn");
  btn.disabled = true;
  try {
    const res = r.id
      ? await sb.from("mod_reports").update(row).eq("id", r.id).select("id").single()
      : await sb.from("mod_reports").insert(row).select("id").single();
    if (res.error) {
      toast(res.error.code === "23505" ? `There's already a ${r.shift} report for ${fmtReportDay(r.report_date)}. Open it from the list, or pick a different shift.` : friendlyError(res.error), "err");
      return;
    }
    await loadExtras();
    modDirty = false;
    startReport(res.data.id);
    renderMod();
    toast(`Saved the ${r.shift} report for ${fmtReportDay(r.report_date)}.`);
  } finally { if (document.body.contains(btn)) btn.disabled = false; }
}

async function deleteReport() {
  const r = modDraft;
  if (!r?.id || !confirm(`Delete the ${r.shift} report for ${fmtReportDay(r.report_date)}? This can't be undone.`)) return;
  try {
    await run(sb.from("mod_reports").delete().eq("id", r.id));
    modDirty = false; modDraft = null; editingReportId = null;
    await loadExtras();
    renderMod();
    toast("Report deleted.");
  } catch { /* toast shown */ }
}

// ---------------------------------------------------------- Specials (Google Gemini)
// The page asks /api/specials (a Vercel server function holding the Gemini
// key) for a menu, then re-does the cost math itself from real prices.

function soonToSpoil(withinDays = 7) {
  return [...ingredients.values()]
    .map((i) => ({ i, d: daysLeft(i.use_by) }))
    .filter((x) => x.d !== null && x.d <= withinDays)
    .sort((a, b) => a.d - b.d || a.i.name.localeCompare(b.i.name));
}

function renderSpecials() {
  $("specialsSetup").classList.toggle("hidden", stockReady);
  if (!stockReady) {
    $("specialsSetup").innerHTML = `<h3>One more database step</h3><p>To track what's spoiling, the Ingredients tab needs two new columns. In Supabase, open <strong>SQL Editor</strong> → <strong>New query</strong>, paste in everything from <code>supabase/spoilage.sql</code>, click <strong>Run</strong>, then reload this page. You can still make menus without it.</p>`;
  }
  const soon = soonToSpoil();
  const atRisk = soon.reduce((s, x) => s + (x.i.on_hand || 0) * x.i.cost, 0);
  $("spoilList").innerHTML = soon.length ? `
    <p class="spoil-total">About <strong>${fmt0(atRisk)}</strong> of food spoils in the next 7 days if it isn't used.</p>
    <table class="edit"><thead><tr><th>Ingredient</th><th class="num">On hand</th><th class="num">Worth</th><th>Use by</th></tr></thead>
    <tbody>${soon.map(({ i }) => `<tr><td>${esc(i.name)}</td>
      <td class="num mono">${i.on_hand == null ? "—" : `${trimNum(i.on_hand)} ${esc(i.unit)}`}</td>
      <td class="num mono">${i.on_hand == null ? "—" : fmt(i.on_hand * i.cost)}</td>
      <td>${spoilTag(i)}</td></tr>`).join("")}</tbody></table>`
    : `<p class="muted">Nothing is due to spoil in the next 7 days. Add "Use by" dates on the Ingredients tab to see what's coming up.</p>`;
  document.querySelectorAll("[data-mode]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.mode === menuMode)));
  $("weeklyFields").classList.toggle("hidden", menuMode !== "weekly");
  $("partyFields").classList.toggle("hidden", menuMode !== "party");
  $("eventFields").classList.toggle("hidden", menuMode !== "event");
  if (lastMenu) renderMenuResult(); else $("menuResult").classList.add("hidden");
}

// Everything Gemini needs to know, in a compact form.
function menuRequest() {
  const t = targets();
  const body = {
    mode: menuMode, restaurant: rest.name, today: dayStr(new Date()), targets: t,
    pantry: [...ingredients.values()].map((i) => ({ name: i.name, unit: i.unit, cost: i.cost, on_hand: i.on_hand, days_left: daysLeft(i.use_by) })),
    menu: dishes.map((d) => {
      const c = d.items.reduce((s, it) => s + (ingredients.get(it.ingredient_id)?.cost || 0) * it.qty, 0);
      return { name: d.name, category: d.category, price: d.price, food_cost_pct: d.price ? (c / d.price) * 100 : 0, weekly_units: salesByWeek.get(sortedWeeks()[0])?.get(d.id) ?? null };
    }),
  };
  if (menuMode === "event") {
    body.event = { name: $("evName").value, colors: $("evColors").value, count: Number($("evCount").value) || 5, crowd: $("evCrowd").value, personal: $("evPersonal").value, notes: $("evNotes").value };
  } else if (menuMode === "party") {
    body.party = { type: $("ptType").value, guests: Number($("ptGuests").value) || 20, style: $("ptStyle").value, personal: $("ptPersonal").value, notes: $("ptNotes").value };
  } else {
    body.count = Number($("spCount").value) || 3;
    body.notes = $("spNotes").value;
  }
  return body;
}

async function makeMenu() {
  if (!ingredients.size) { toast("Add some ingredients first.", "err"); return; }
  if (menuMode === "event" && !$("evName").value.trim()) { toast("Say what the event is first.", "err"); $("evName").focus(); return; }
  const btn = $("makeMenuBtn"), note = $("makeMenuNote");
  btn.disabled = true; note.textContent = "Gemini is writing your menu. This takes a few seconds…";
  $("makeMenuBlade").classList.remove("hidden");
  try {
    const { data } = await sb.auth.getSession();
    const request = menuRequest();
    const r = await fetch("/api/specials", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session?.access_token || ""}` },
      body: JSON.stringify(request),
    });
    const out = await r.json().catch(() => ({}));
    if (r.status === 503 || r.status === 404) {
      note.textContent = "";
      $("menuResult").classList.remove("hidden");
      $("menuResult").innerHTML = `<h3>The menu assistant isn't connected yet</h3><p>Whoever set up The Line needs to add the Gemini key in Vercel. The steps are in the README under "Specials (Google Gemini)".</p>`;
      return;
    }
    if (!r.ok) { note.textContent = ""; toast(out.error || "Something went wrong. Try again.", "err"); return; }
    lastMenu = { ...out, request, picture: lastMenu?.picture };   // keep an added picture across new versions
    note.textContent = "";
    renderMenuResult();
    $("menuResult").scrollIntoView({ behavior: "smooth", block: "start" });
  } catch {
    note.textContent = "";
    toast("Couldn't reach the menu assistant. Check your internet and try again.", "err");
  } finally { btn.disabled = false; $("makeMenuBlade").classList.add("hidden"); }
}

// Match the ingredient names Gemini used to the real ingredient list.
function findIngredient(name) {
  const n = String(name || "").trim().toLowerCase();
  const all = [...ingredients.values()];
  return all.find((i) => i.name.toLowerCase() === n)
    || all.find((i) => i.name.toLowerCase().includes(n) || n.includes(i.name.toLowerCase())) || null;
}

function costItem(item) {
  let cost = 0;
  const lines = (item.ingredients || []).map((x) => {
    const ing = x.not_stocked ? null : findIngredient(x.name);
    const amount = Number(x.amount) || 0;
    const line = ing ? ing.cost * amount : 0;
    cost += line;
    return { name: ing ? ing.name : x.name, ing, amount, line, d: ing ? daysLeft(ing.use_by) : null };
  });
  return { cost, lines, missing: lines.filter((l) => !l.ing).map((l) => l.name) };
}

// The printed menu's look, from Gemini's suggestion. Colors must be real
// hex codes and readable together; anything else falls back safely.
const HEX = /^#[0-9a-f]{6}$/i;
function hexOr(v, fallback) { const x = String(v || "").trim(); return HEX.test(x) ? x : fallback; }
function luminance(hex) {
  const c = [1, 3, 5].map((k) => parseInt(hex.slice(k, k + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
function contrast(a, b) { const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); }
const MENU_FONTS = {
  bold: "Impact, Haettenschweiler, 'Arial Narrow Bold', 'Arial Black', sans-serif",
  classic: "Georgia, 'Times New Roman', serif",
  playful: "'Trebuchet MS', 'Segoe UI', Verdana, sans-serif",
  elegant: "Palatino, 'Palatino Linotype', 'Book Antiqua', Georgia, serif",
};
function menuTheme(t = {}) {
  const bg = hexOr(t.background, "#FBF9F5");
  let ink = hexOr(t.text, "#262624");
  if (contrast(bg, ink) < 4.5) ink = contrast(bg, "#111111") >= contrast(bg, "#FFFFFF") ? "#111111" : "#FFFFFF";
  let accent = hexOr(t.accent, ink);
  if (contrast(bg, accent) < 3) accent = ink;
  let accent2 = hexOr(t.accent2, accent);
  if (contrast(bg, accent2) < 3) accent2 = accent;
  const style = String(t.style || "").toLowerCase().trim();
  return { bg, ink, accent, accent2, style: MENU_FONTS[style] ? style : "classic" };
}

// Small hand-drawn pictures for the menu card (48×48). "c" parts use the
// card's background color so they read as cut-outs.
const MOTIFS = {
  football: `<ellipse cx="24" cy="24" rx="21" ry="12.5" transform="rotate(-35 24 24)"/><path class="c" d="M17 31 31 17M20 24l4 4M23 21l4 4M26 18l4 4" stroke-width="2.2" fill="none"/>`,
  basketball: `<circle cx="24" cy="24" r="20"/><path class="c" d="M4 24h40M24 4v40M10 10c8 8 8 20 0 28M38 10c-8 8-8 20 0 28" stroke-width="2" fill="none"/>`,
  baseball: `<circle cx="24" cy="24" r="20"/><path class="c" d="M12 9c6 8 6 22 0 30M36 9c-6 8-6 22 0 30" stroke-width="2" fill="none" stroke-dasharray="3 2"/>`,
  paw: `<ellipse cx="24" cy="32" rx="11" ry="9"/><circle cx="11" cy="20" r="4.6"/><circle cx="19" cy="12" r="4.8"/><circle cx="29" cy="12" r="4.8"/><circle cx="37" cy="20" r="4.6"/>`,
  golf_ball: `<circle cx="24" cy="21" r="16"/><g class="c"><circle cx="18" cy="15" r="1.8"/><circle cx="25" cy="13" r="1.8"/><circle cx="31" cy="18" r="1.8"/><circle cx="19" cy="23" r="1.8"/><circle cx="26" cy="21" r="1.8"/><circle cx="31" cy="27" r="1.8"/><circle cx="23" cy="29" r="1.8"/></g><path d="M20 37h8l-2.5 8h-3z"/>`,
  golf_flag: `<path d="M15 6h2.6v34H15z"/><path d="M17.6 6 37 12.5 17.6 19z"/><ellipse cx="17" cy="41" rx="13" ry="3.6"/>`,
  golf_cart: `<path d="M7 9h30v3H7z"/><path d="M10 12h2.5v14H10zM33 12h2.5v14H33z"/><path d="M5 26h34l4 8H5z"/><path d="M38 20h3l-2 6h-3z"/><circle cx="13" cy="36" r="5"/><circle cx="35" cy="36" r="5"/><circle class="c" cx="13" cy="36" r="1.8"/><circle class="c" cx="35" cy="36" r="1.8"/>`,
  balloon: `<ellipse cx="24" cy="18" rx="12" ry="14"/><path d="M21.5 31.5h5L24 35z"/><path d="M24 35c-3 4 3 6 0 11" stroke-width="1.6" fill="none" class="line"/>`,
  cake: `<path d="M9 26h30v14H9z"/><path d="M12 18h24v8H12z"/><path class="c" d="M9 31c3 2 5 2 7.5 0s5-2 7.5 0 5 2 7.5 0 5-2 7.5 0" stroke-width="2" fill="none"/><path d="M23 9h2.2v9H23z"/><path d="M24.1 3c2 2.5 2 4.5 0 5.6-2-1.1-2-3.1 0-5.6z"/>`,
  party_hat: `<path d="M24 4 38 42H10z"/><g class="c"><circle cx="22" cy="20" r="2"/><circle cx="27" cy="29" r="2"/><circle cx="19" cy="34" r="2"/></g><circle cx="24" cy="4" r="3.4"/>`,
  star: `<path d="M24 4l5.9 12.6 13.8 1.7-10.2 9.4 2.7 13.6L24 34.6 11.8 41.3l2.7-13.6L4.3 18.3l13.8-1.7z"/>`,
  trophy: `<path d="M14 6h20v10c0 7-4.5 12-10 12s-10-5-10-12z"/><path d="M14 9H7c0 7 3 10 8 10M34 9h7c0 7-3 10-8 10" stroke-width="2.6" fill="none" class="line"/><path d="M21.5 28h5v7h-5zM15 35h18v6H15z"/>`,
  shamrock: `<circle cx="17" cy="18" r="8"/><circle cx="31" cy="18" r="8"/><circle cx="24" cy="29" r="8"/><path d="M24 30c1 6 3 10 7 14" stroke-width="2.8" fill="none" class="line"/>`,
  pint: `<path d="M12 8h24l-3 34H15z"/><path class="c" d="M14 15h20" stroke-width="2" fill="none"/><path d="M11 6c3-3 7-2 9 0 2-2 7-3 9 0 2-2 6-2 8 0v4H11z"/>`,
  heart: `<path d="M24 42 7 25C1 18 5 7 14 7c5 0 8 3 10 6 2-3 5-6 10-6 9 0 13 11 7 18z"/>`,
  rings: `<circle cx="18" cy="26" r="11" stroke-width="4" fill="none" class="line"/><circle cx="30" cy="26" r="11" stroke-width="4" fill="none" class="line"/><path d="M27 8l3-4 3 4-3 4z"/>`,
  pumpkin: `<ellipse cx="16" cy="28" rx="9" ry="13"/><ellipse cx="32" cy="28" rx="9" ry="13"/><ellipse cx="24" cy="28" rx="9" ry="14"/><path d="M22.5 8h3v7h-3z"/>`,
  snowflake: `<path d="M24 4v40M6.7 14l34.6 20M6.7 34l34.6-20M19 8l5 5 5-5M19 40l5-5 5 5" stroke-width="3" fill="none" class="line"/>`,
  music: `<path d="M18 10 38 5v26" stroke-width="3.4" fill="none" class="line"/><path d="M18 10v26" stroke-width="3.4" fill="none" class="line"/><ellipse cx="13" cy="37" rx="6" ry="4.6"/><ellipse cx="33" cy="32" rx="6" ry="4.6"/>`,
  sun: `<circle cx="24" cy="24" r="9"/><path d="M24 4v7M24 37v7M4 24h7M37 24h7M10 10l5 5M33 33l5 5M10 38l5-5M33 15l5-5" stroke-width="3" fill="none" class="line"/>`,
  crown: `<path d="M6 36 9 14l9 9 6-13 6 13 9-9 3 22z"/><path d="M6 38h36v4H6z"/>`,
  flower: `<circle cx="24" cy="12" r="7"/><circle cx="35" cy="21" r="7"/><circle cx="31" cy="34" r="7"/><circle cx="17" cy="34" r="7"/><circle cx="13" cy="21" r="7"/><circle class="c" cx="24" cy="24" r="5"/>`,
  leaf: `<path d="M8 40C8 18 22 8 42 6c-2 20-12 34-34 34z"/><path class="c" d="M10 38 34 14" stroke-width="2" fill="none"/>`,
};
const PATTERNS = ["checkerboard", "stripes", "dots"];
function motifSvg(name, color) {
  return `<svg class="mp-motif" viewBox="0 0 48 48" aria-hidden="true" style="color:${color}">${MOTIFS[name]}</svg>`;
}

function renderMenuResult() {
  const { menu, mode, model, request } = lastMenu;
  const t = targets();
  const party = mode === "party";
  const costed = menu.items.map((it) => ({ it, ...costItem(it) }));

  // 1. The menu guests see, in the theme's colors.
  const th = menuTheme(menu.theme);
  const kicker = mode === "event" ? request.event.name : party ? (request.party.type || "Party menu") : "This week's specials";
  const motifs = (Array.isArray(menu.motifs) ? menu.motifs : []).map((m) => String(m).trim().toLowerCase()).filter((m) => MOTIFS[m]).slice(0, 4);
  const pattern = PATTERNS.includes(String(menu.pattern || "").toLowerCase()) ? String(menu.pattern).toLowerCase() : "none";
  const sayings = (Array.isArray(menu.sayings) ? menu.sayings : []).map((x) => String(x).trim()).filter(Boolean).slice(0, 4);
  const band = pattern === "none" ? "" : `<div class="mp-band pat-${pattern}" aria-hidden="true"></div>`;
  const poster = `<div class="menu-poster mp-${th.style}${pattern === "none" ? "" : " has-band"}" style="--mp-bg:${th.bg};--mp-ink:${th.ink};--mp-accent:${th.accent};--mp-accent2:${th.accent2};--mp-font:${MENU_FONTS[th.style]}">
      ${band}
      ${lastMenu.picture ? `<img class="mp-picture" src="${lastMenu.picture}" alt="">` : ""}
      ${motifs.length ? `<div class="mp-motifs">${motifs.map((m, i) => motifSvg(m, i % 2 ? "var(--mp-accent2)" : "var(--mp-accent)")).join("")}</div>` : ""}
      <div class="mp-kicker">${esc(rest.name)} · ${esc(kicker)}</div>
      <h3 class="mp-title">${esc(menu.title)}</h3>
      ${menu.tagline ? `<p class="mp-tag">${esc(menu.tagline)}</p>` : ""}
      <div class="mp-items">${menu.items.map((it) => `<div class="mp-item">
        <div class="mp-line">${party && it.course ? `<span class="mp-course">${esc(it.course)}</span>` : ""}<span class="mp-name">${esc(it.name)}</span><span class="mp-dots"></span>${Number(it.price) > 0 ? `<span class="mp-price">${fmt(Number(it.price))}</span>` : ""}</div>
        <div class="mp-desc">${esc(it.description)}</div></div>`).join("")}</div>
      ${sayings.length ? `<div class="mp-sayings">${sayings.map((x) => `<span>${esc(x)}</span>`).join("")}</div>` : ""}
      ${band}
    </div>`;

  // 2. Behind the numbers: costs checked against real ingredient prices.
  const items = costed.map(({ it, cost, lines, missing }) => {
    const p = Number(it.price);
    const pct = p > 0 ? (cost / p) * 100 : null;
    const st = pct === null ? "" : statusOf(pct);
    const usesSoon = lines.filter((l) => l.d !== null && l.d <= 5).map((l) => `${esc(l.name)} (${l.d < 0 ? "expired" : l.d === 0 ? "today" : `${l.d} day${l.d === 1 ? "" : "s"}`})`);
    return `<article class="special">
      <div class="special-head">
        <div>${party && it.course ? `<div class="special-course">${esc(it.course)}</div>` : ""}<h4>${esc(it.name)}</h4></div>
        ${p > 0 ? `<div class="special-price mono">${fmt(p)}</div>` : ""}
      </div>
      <div class="special-nums">
        <div><div class="lbl">Food cost</div><div class="val mono">${fmt(cost)}</div></div>
        ${pct === null ? "" : `<div><div class="lbl">Food cost %</div><div class="val mono ${st === "red" ? "rust" : ""}"><span class="dot ${st}"></span> ${fmtPct(pct)}</div></div>
        <div><div class="lbl">Margin per plate</div><div class="val mono">${fmt(p - cost)}</div></div>`}
      </div>
      ${usesSoon.length ? `<p class="special-uses"><strong>Uses up:</strong> ${usesSoon.join(", ")}</p>` : ""}
      <p class="special-why">${esc(it.why)}</p>
      <details><summary>Ingredients per plate</summary>
        <ul>${lines.map((l) => `<li>${esc(l.name)}: ${trimNum(l.amount)} ${esc(l.ing?.unit || "")}${l.ing ? ` (${fmt(l.line)})` : " <em>(not in your ingredient list, not costed)</em>"}</li>`).join("")}</ul>
      </details>
      ${missing.length ? `<p class="special-warn">Needs ${missing.map(esc).join(", ")}, which you don't stock. Add it on the Ingredients tab to cost it.</p>` : ""}
    </article>`;
  }).join("");
  const el = $("menuResult");
  el.classList.remove("hidden");
  el.innerHTML = `
    <div class="chart-head"><h3>Your menu</h3><span class="note">Suggested by ${esc(model)}. Check it over before you print it.</span></div>
    ${poster}
    <div class="row-actions">
      <button class="applybtn" id="printMenuBtn" type="button">Print the menu</button>
      <button class="ghostbtn dark" id="remakeMenuBtn" type="button">Try another version</button>
      <label class="ghostbtn dark pic-btn">${lastMenu.picture ? "Change picture" : "Add your own picture"}<input type="file" id="menuPicture" accept="image/*" hidden></label>
      ${lastMenu.picture ? `<button class="linkbtn" id="removePicture" type="button">Remove picture</button>` : ""}
    </div>
    <p class="note pic-note">Pictures stay in this browser and are only used on this menu. Only add logos or photos you have permission to use.</p>
    <div class="mp-details">
      <div class="section-label">Behind the numbers</div>
      ${menu.intro ? `<p class="menu-intro">${esc(menu.intro)}</p>` : ""}
      <div class="specials">${items}</div>
      ${(menu.tips || []).length ? `<div class="section-label">Tips</div><ul class="menu-tips">${menu.tips.slice(0, 3).map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}
    </div>`;
}

// ---------------------------------------------------------- Voice typing
// The browser's own speech-to-text (Chrome, Edge, Safari). Where it isn't
// available the Speak buttons stay hidden.
const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
let voice = null;   // the one recording in progress: { rec, btn }

function setVoiceButton(btn, listening) {
  btn.classList.toggle("listening", listening);
  btn.setAttribute("aria-pressed", String(listening));
  btn.querySelector(".mic-text").textContent = listening ? "Listening… tap to stop" : "Speak";
}

function toggleVoice(btn) {
  if (voice) {
    const same = voice.btn === btn;
    voice.rec.stop();
    if (same) return;
  }
  const input = $(btn.dataset.voiceFor);
  const rec = new SpeechRec();
  rec.lang = navigator.language || "en-US";
  rec.interimResults = true;
  const before = input.value.trim();
  voice = { rec, btn };
  setVoiceButton(btn, true);
  rec.onresult = (e) => {
    let said = "";
    for (const r of e.results) said += r[0].transcript;
    input.value = ((before ? before + " " : "") + said.trim()).slice(0, input.maxLength > 0 ? input.maxLength : 300);
  };
  rec.onerror = (e) => {
    if (e.error === "not-allowed" || e.error === "service-not-allowed") toast("Allow microphone access for this site to use voice typing.", "err");
    else if (e.error !== "aborted" && e.error !== "no-speech") toast("Voice typing stopped. Try again.", "err");
  };
  rec.onend = () => {
    setVoiceButton(btn, false);
    if (voice && voice.rec === rec) voice = null;
  };
  try { rec.start(); } catch { rec.onend(); }
}

// ---------------------------------------------------------- From The Line POS (add-on)
// Reads the register's checks for a date and fills the MOD report or the
// week's plates sold. The POS lives in its own app; both share this database.
const POS_COMP_TYPES = { "VIP / regular": "Comp: VIP / regular", "Kitchen mistake": "Comp: kitchen mistake", "Service mistake": "Comp: service mistake",
  "Employee / manager meal": "Employee / manager meal", "Promo / marketing": "Promo / marketing" };

async function posChecks(fromDate, toDate) {
  const ord = await run(sb.from("pos_orders").select("*").eq("restaurant_id", rest.id).gte("business_date", fromDate).lte("business_date", toDate));
  const ids = ord.map((o) => o.id);
  const items = ids.length ? await run(sb.from("pos_order_items").select("*").in("order_id", ids)) : [];
  return ord.map((o) => ({ ...o, items: items.filter((i) => i.order_id === o.id) }));
}

// auto = true when the report opened or its date, shift or hours changed:
// no error toasts, and if there's nothing to pull, any numbers pulled for
// another date or shift are cleared so they can't be saved by mistake.
async function pullMod(auto = false) {
  const r = modDraft, d = r.data;
  if (!r.report_date) { if (!auto) toast("Pick the report's date first.", "err"); return; }
  const btn = $("pullPosBtn"); if (btn) btn.disabled = true;
  const note = (msg) => { modPosNote = msg; if ($("posNote")) $("posNote").textContent = msg; };
  if (auto) note("Checking the POS…");
  try {
    const all = await posChecks(r.report_date, r.report_date);
    if (modDraft !== r) return;   // they opened a different report while this was loading
    const hourOf = (o) => { const h = new Date(o.opened_at).getHours(); return h < 5 ? h + 24 : h; };   // after midnight counts as late night
    const inShift = all.filter((o) => { const h = hourOf(o); return h >= d.hours_from && h <= d.hours_to; });
    if (!inShift.length) {
      const msg = all.length ? `No POS checks between ${fmtHour(d.hours_from)} and ${fmtHour(d.hours_to + 1)}. Change "First hour" and "Last hour" to match the shift.` : "No POS checks on this date yet.";
      if (auto && d.pos_pulled) {
        d.hourly = {}; d.sales = ""; d.comps = d.comps.filter((c) => !c.pos); d.pos_pulled = false;
        modDirty = true; renderModEditor();
      }
      note(msg);
      if (!auto) toast(msg, "err");
      return;
    }
    const paid = inShift.filter((o) => o.status === "paid");
    const hourly = {};
    for (const o of paid) { const h = hourOf(o); hourly[h] = (Number(hourly[h]) || 0) + (Number(o.guests) || 0); }
    const net = paid.reduce((s, o) => s + Number(o.subtotal) - Number(o.discount_amount), 0);
    const pulled = [];
    for (const o of inShift) {
      for (const i of o.items.filter((x) => x.status !== "ok")) {
        pulled.push({ type: i.status === "void" ? "Void: rung in wrong" : POS_COMP_TYPES[i.reason] || "Other", item: i.name,
          amount: (Number(i.price) * i.qty).toFixed(2), reason: i.reason, approved: i.approved_by, pos: true });
      }
      if (Number(o.discount_amount) > 0) {
        pulled.push({ type: "Discount", item: `Check at ${new Date(o.opened_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}${o.table_label ? `, table ${o.table_label}` : ""}`,
          amount: Number(o.discount_amount).toFixed(2), reason: o.discount_reason, approved: o.discount_by, pos: true });
      }
    }
    d.hourly = hourly;
    d.sales = net.toFixed(2);
    d.comps = d.comps.filter((c) => !c.pos).concat(pulled);   // replace earlier pulls, keep anything typed by hand
    d.pos_pulled = true;
    modDirty = true;
    const covers = Object.values(hourly).reduce((s, n) => s + n, 0);
    const c = pulled.filter((x) => x.type !== "Discount" && !x.type.startsWith("Void")).length, v = pulled.filter((x) => x.type.startsWith("Void")).length, k = pulled.filter((x) => x.type === "Discount").length;
    const n = (x, word) => `${x} ${word}${x === 1 ? "" : "s"}`;
    const time = new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    modPosNote = `Pulled ${n(paid.length, "check")} from the POS at ${time}: ${fmt0(net)} net sales, ${n(covers, "cover")}, ${n(c, "comp")}, ${n(v, "void")}, ${n(k, "discount")}.`;
    renderModEditor();
    toast(`${auto ? "Filled in from the POS" : "Pulled again from the POS"}: ${n(paid.length, "check")}, ${fmt0(net)} net sales, ${n(covers, "cover")}. Review, then Save report.`);
  } catch { if (auto) note("Couldn't reach the POS. Click \"Pull again from the POS\" to try again."); } finally { const b = $("pullPosBtn"); if (b) b.disabled = false; }
}

async function pullWeekSales() {
  const btn = $("salesFromPosBtn"); btn.disabled = true;
  try {
    const checks = (await posChecks(salesWeek, addDays(salesWeek, 6))).filter((o) => o.status === "paid");
    if (!checks.length) { toast("No POS sales for this week yet.", "err"); return; }
    const plates = new Map();
    for (const o of checks) for (const i of o.items) if (i.status !== "void" && i.dish_id) plates.set(i.dish_id, (plates.get(i.dish_id) || 0) + i.qty);
    document.querySelectorAll("#salesTable input[data-dish]").forEach((inp) => { inp.value = plates.get(inp.dataset.dish) || 0; });
    updateSalesTotal();
    toast(`Filled from ${checks.length} POS checks. Click "Save this week" to keep it.`);
  } catch { /* toast shown */ } finally { btn.disabled = false; }
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
  renderMoving();
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
  const hasLabor = "labor_low" in rest;
  $("laborSettings").classList.toggle("hidden", !hasLabor);
  if (hasLabor) {
    $("setLaborLow").value = Number(rest.labor_low);
    $("setLaborMid").value = Number(rest.labor_mid);
    $("setLaborHigh").value = Number(rest.labor_high);
    $("setBurden").value = Number(rest.labor_burden);
  }
  $("settingsMsg").textContent = "";
  $("setEmail").textContent = user?.email || "";
  $("settingsDialog").showModal();
}

async function saveSettings(e) {
  e.preventDefault();
  const name = $("setName").value.trim();
  const low = Number($("setLow").value), mid = Number($("setMid").value), high = Number($("setHigh").value);
  if (!name) { $("settingsMsg").textContent = "Name can't be blank."; return; }
  if (![low, mid, high].every((n) => Number.isFinite(n) && n >= 0 && n <= 100)) { $("settingsMsg").textContent = "Targets must be between 0 and 100."; return; }
  if (!(low <= mid && mid <= high)) { $("settingsMsg").textContent = "Targets must go low ≤ mid ≤ high."; return; }
  const changes = { name, target_low: low, target_mid: mid, target_high: high };
  if ("labor_low" in rest) {
    const ll = Number($("setLaborLow").value), lm = Number($("setLaborMid").value), lh = Number($("setLaborHigh").value), lb = Number($("setBurden").value);
    if (![ll, lm, lh, lb].every((n) => $("setLaborLow").value !== "" && Number.isFinite(n) && n >= 0 && n <= 100)) { $("settingsMsg").textContent = "Labor targets and the add-on must be between 0 and 100."; return; }
    if (!(ll <= lm && lm <= lh)) { $("settingsMsg").textContent = "Labor targets must go low ≤ mid ≤ high."; return; }
    Object.assign(changes, { labor_low: ll, labor_mid: lm, labor_high: lh, labor_burden: lb });
  }
  try {
    const row = await run(sb.from("restaurants").update(changes).eq("id", rest.id).select("*").single());
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
  if (typed.trim() !== rest.name) { $("settingsMsg").textContent = "Name didn't match, so nothing was deleted."; return; }
  try {
    await run(sb.from("restaurants").delete().eq("id", rest.id));
    $("settingsDialog").close();
    toast("Restaurant deleted.");
    safeSet("line.restaurant", "");
    await loadRestaurants();
  } catch (err) { $("settingsMsg").textContent = friendlyError(err); }
}

async function deleteAccount() {
  const email = user?.email || "";
  const typed = prompt(`This permanently deletes your account (${email}) and ALL of your restaurants, ingredients, recipes, sales, and scenarios. It can't be undone.\n\nAfterwards you can sign up again with the same email.\n\nType your email to confirm:`);
  if (typed === null) return;
  if (typed.trim().toLowerCase() !== email.toLowerCase()) { toast("Email didn't match, so nothing was deleted.", "err"); return; }
  if (!confirm("Are you sure you want to delete your account?\n\nThis is your last chance. Click OK to delete it forever, or Cancel to keep it.")) {
    toast("Nothing was deleted. Your account is safe.");
    return;
  }
  const { error } = await sb.rpc("delete_my_account");
  if (error) {
    toast(/delete_my_account/.test(error.message || "") ?
      "Account deleting isn't set up yet. Run supabase/delete-account.sql in Supabase first." : friendlyError(error), "err");
    return;
  }
  if ($("settingsDialog").open) $("settingsDialog").close();
  draftDirty = false; modDirty = false;
  safeSet("line.restaurant", "");
  await sb.auth.signOut({ scope: "local" });   // the login no longer exists; just clear it from this browser
  handleSession(null);
  setAuthMode("signup");
  toast("Your account was deleted. You can sign up again anytime.");
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
  if ((draftDirty || modDirty) && !confirm("You have unsaved changes. Sign out anyway?")) return;
  draftDirty = false; modDirty = false;
  await sb.auth.signOut();
  handleSession(null);
}

// ---------------------------------------------------------- Light / dark
// "auto" follows the device; "light" or "dark" overrides it. The choice is
// remembered in this browser only.
const THEME_KEY = "line.theme";
const darkQuery = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;
function themeChoice() { const v = safeGet(THEME_KEY); return v === "light" || v === "dark" ? v : "auto"; }
function applyTheme() {
  const choice = themeChoice();
  const dark = choice === "dark" || (choice === "auto" && !!darkQuery?.matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  document.querySelectorAll("[data-theme-choice]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.themeChoice === choice)));
}

// ---------------------------------------------------------- Side menu
function menuOpen() { return $("sideMenu").classList.contains("open"); }
function openMenu() {
  $("sideMenu").classList.add("open");
  $("menuScrim").classList.add("open");
  $("menuBtn").setAttribute("aria-expanded", "true");
  ($("sideMenu").querySelector(".tab.active") || $("menuClose")).focus();
}
function closeMenu() {
  if (!menuOpen()) return;
  $("sideMenu").classList.remove("open");
  $("menuScrim").classList.remove("open");
  $("menuBtn").setAttribute("aria-expanded", "false");
  $("menuBtn").focus();
}

// ================================================================ WIRING
function goTo(page) {
  if (activePage === "recipes" && page !== "recipes" && draftDirty) {
    if (!confirm("You have unsaved changes to this dish. Leave without saving?")) return;
    draftDirty = false; draft = null;
  }
  if (activePage === "mod" && page !== "mod" && modDirty) {
    if (!confirm("You have unsaved changes to this report. Leave without saving?")) return;
    modDirty = false; modDraft = null; editingReportId = null;
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
  $("onboardDeleteAccount").addEventListener("click", deleteAccount);

  // Side menu
  $("menuBtn").addEventListener("click", () => (menuOpen() ? closeMenu() : openMenu()));
  $("menuClose").addEventListener("click", closeMenu);
  $("menuScrim").addEventListener("click", closeMenu);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && menuOpen()) closeMenu(); });
  document.querySelectorAll("[data-theme-choice]").forEach((b) => b.addEventListener("click", () => {
    const v = b.dataset.themeChoice;
    safeSet(THEME_KEY, v === "auto" ? "" : v);
    applyTheme();
  }));
  darkQuery?.addEventListener?.("change", applyTheme);
  $("signOutBtn").addEventListener("click", () => { closeMenu(); signOut(); });
  $("settingsBtn").addEventListener("click", () => { closeMenu(); openSettings(); });
  $("restaurantSelect").addEventListener("change", (e) => {
    const v = e.target.value;
    if ((draftDirty || modDirty) && !confirm("You have unsaved changes. Switch anyway?")) { e.target.value = rest.id; return; }
    draftDirty = false; modDirty = false;
    closeMenu();
    if (v === "__new") { e.target.value = rest.id; openOnboarding(true); }
    else selectRestaurant(v).catch(() => {});
  });
  // Tabs (in the row and in the Menu) are drawn by renderTabs, so listen on the page.
  document.addEventListener("click", (e) => {
    const t = e.target.closest(".tab[data-page]");
    if (t) { closeMenu(); goTo(t.dataset.page); }
  });
  $("sideNav").addEventListener("change", (e) => { if (e.target.dataset.pin) setPinned(e.target.dataset.pin, e.target.checked); });
  $("pinAll").addEventListener("click", () => { const on = new Set(pinnedTabs()); setAllPinned(!Object.keys(PAGE_NAMES).every((p) => on.has(p))); });

  // Settings dialog
  $("settingsForm").addEventListener("submit", saveSettings);
  $("settingsCancel").addEventListener("click", () => $("settingsDialog").close());
  $("deleteRestaurantBtn").addEventListener("click", deleteRestaurant);
  $("deleteAccountBtn").addEventListener("click", deleteAccount);

  // What-if bar
  $("weekSelect").addEventListener("change", (e) => { selectedWeek = e.target.value || null; renderMoving(); });
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
    renderMoving();
  });
  $("resetBtn").addEventListener("click", () => { resetWhatIf(); renderMoving(); });
  $("activeAdj").addEventListener("click", (e) => {
    const b = e.target.closest("button[data-key]");
    if (!b) return;
    delete adjustments[b.dataset.key]; delete priceMultipliers[b.dataset.key];
    $("scenarioSelect").value = "";
    renderMoving();
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
  $("salesFromPosBtn").addEventListener("click", pullWeekSales);
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

  // Voice typing for the "Anything to keep in mind" boxes
  document.querySelectorAll("[data-voice-for]").forEach((btn) => {
    btn.hidden = !SpeechRec;
    btn.addEventListener("click", (e) => { e.preventDefault(); toggleVoice(btn); });
  });

  // Specials
  document.querySelectorAll("[data-mode]").forEach((b) => b.addEventListener("click", () => { if (voice) voice.rec.stop(); menuMode = b.dataset.mode; renderSpecials(); }));
  $("makeMenuBtn").addEventListener("click", makeMenu);
  $("menuResult").addEventListener("change", (e) => {
    if (e.target.id !== "menuPicture" || !e.target.files[0] || !lastMenu) return;
    const file = e.target.files[0];
    if (!/^image\//.test(file.type)) { toast("That file isn't a picture.", "err"); return; }
    if (file.size > 5 * 1024 * 1024) { toast("Pick a picture under 5 MB.", "err"); return; }
    const reader = new FileReader();
    reader.onload = () => { lastMenu.picture = String(reader.result); renderMenuResult(); };
    reader.readAsDataURL(file);
  });
  $("menuResult").addEventListener("click", (e) => {
    if (e.target.closest("#removePicture")) { if (lastMenu) { delete lastMenu.picture; renderMenuResult(); } return; }
    if (e.target.closest("#remakeMenuBtn")) makeMenu();
    else if (e.target.closest("#printMenuBtn")) window.print();
  });

  // Labor Costs
  $("laborWeek").addEventListener("change", (e) => { if (e.target.value) setLaborWeek(dayStr(mondayOf(parseDay(e.target.value)))); });
  $("laborPrev").addEventListener("click", () => setLaborWeek(addDays(laborWeek, -7)));
  $("laborNext").addEventListener("click", () => setLaborWeek(addDays(laborWeek, 7)));
  $("laborWeeksTable").addEventListener("click", (e) => {
    const b = e.target.closest("[data-labor-week]");
    if (b) setLaborWeek(b.dataset.laborWeek);
  });
  $("laborTable").addEventListener("input", updateLaborTotal);
  $("saveLaborBtn").addEventListener("click", saveLabor);
  $("copyLaborBtn").addEventListener("click", copyLastWeek);
  $("laborRaiseApply").addEventListener("click", () => {
    let pct = parseFloat($("laborRaisePct").value);
    if (!Number.isFinite(pct)) pct = 0;
    laborRaise = { dept: $("laborRaiseDept").value, pct: Math.max(-50, Math.min(100, pct)) };
    renderLaborSummary();
  });
  $("laborRaiseChip").addEventListener("click", (e) => {
    if (e.target.closest("#laborRaiseClear")) { laborRaise = { dept: "all", pct: 0 }; renderLaborSummary(); }
  });
  $("addStaffForm").addEventListener("submit", addStaff);
  $("staffTable").addEventListener("change", (e) => { if (e.target.matches("[data-sid]")) updateStaff(e.target); });
  $("staffTable").addEventListener("click", (e) => {
    const b = e.target.closest("[data-del-staff]");
    if (b) deleteStaff(b.dataset.delStaff);
  });

  // MOD Report
  $("newReportBtn").addEventListener("click", () => { if (startReport("new")) renderMod(); });
  $("reportList").addEventListener("click", (e) => {
    const b = e.target.closest("[data-report]");
    if (b && b.dataset.report !== editingReportId && startReport(b.dataset.report)) renderMod();
  });
  const mod = $("modEditor");
  const onModInput = (e) => {
    if (!modDraft) return;
    const t = e.target;
    const val = t.type === "checkbox" ? t.checked : t.value;
    if (t.dataset.f) {
      const f = t.dataset.f;
      if (f === "data.hours_from" || f === "data.hours_to") {
        setPath(modDraft, f, Number(val));
        modDraft.data.hours_to = Math.max(modDraft.data.hours_to, modDraft.data.hours_from);
        modDirty = true;
        renderModEditor();
        if (posEnabled) pullMod(true);
        return;
      }
      if (f === "shift" && SHIFT_HOURS[val]) {
        // A new shift brings its usual hours, then the POS numbers for them.
        modDraft.shift = val;
        [modDraft.data.hours_from, modDraft.data.hours_to] = SHIFT_HOURS[val];
        modDirty = true;
        renderModEditor();
        if (posEnabled) pullMod(true);
        return;
      }
      setPath(modDraft, f, val);
      if (f === "report_date" && posEnabled && val) { modDirty = true; pullMod(true); }
    } else if (t.dataset.row) {
      modDraft.data[t.dataset.row][+t.dataset.i][t.dataset.k] = val;
    } else if (t.dataset.hour !== undefined) {
      modDraft.data.hourly[t.dataset.hour] = val;
    } else return;
    modDirty = true;
    updateModSummary();
  };
  mod.addEventListener("input", onModInput);
  mod.addEventListener("change", (e) => { if (e.target.tagName === "SELECT" || e.target.type === "checkbox") onModInput(e); });
  mod.addEventListener("click", (e) => {
    const t = e.target.closest("button");
    if (!t || !modDraft) return;
    if (t.dataset.add) { modDraft.data[t.dataset.add].push(LIST_ROWS[t.dataset.add]()); modDirty = true; renderModEditor(); }
    else if (t.dataset.delRow) { const [list, i] = t.dataset.delRow.split(":"); modDraft.data[list].splice(+i, 1); modDirty = true; renderModEditor(); }
    else if (t.id === "pullPosBtn") pullMod();
    else if (t.id === "saveReportBtn") saveReport();
    else if (t.id === "deleteReportBtn") deleteReport();
    else if (t.id === "printReportBtn") window.print();
  });

  // Warn before closing the tab with unsaved recipe or report edits.
  window.addEventListener("beforeunload", (e) => { if (draftDirty || modDirty) { e.preventDefault(); e.returnValue = ""; } });
}
