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
  wm.dataset.cutAt = Date.now();            // so a hover doesn't restart a cut that's still running
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
let menuMode = "weekly";       // Specials page: "weekly", "party", "event" or "free"
let recentDishes = [];         // dish names Gemini suggested lately, so it doesn't repeat itself
let lastMenu = null;           // the last menu Gemini wrote (not saved)
let laborWeek = null;          // week shown on the Labor Costs tab
let laborRaise = { dept: "all", pct: 0 };  // what-if wage change (not saved)
let editingReportId = null;    // MOD Report ("new" for a new report)
let modDraft = null;           // working copy of the report being edited
let modOpen = new Set(["sales"]);   // MOD report sections that are opened
let modEditing = new Set();          // MOD report sections being edited
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
  // Every sign-in, sign-out and page refresh starts fresh: no tabs kept, Tonight open.
  activePage = "home";
  safeSet(TABS_KEY, "[]");
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
  const opening = $("appScreen").classList.contains("hidden");
  show("appScreen");
  render();
  if (opening) playLogoSplice($("headerLogo"));      // the blade cut, every time the app opens
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
// Labor Costs is put away for now. Its code, tables and saved hours are all
// kept: set this back to true to bring the tab (and labor on Tonight and in
// Settings) back exactly as it was.
const LABOR_ON = false;

const PAGE_NAMES = { home: "Tonight", cost: "Cost Tracker", perf: "Performance", sales: "Weekly Sales", ingredients: "Ingredients",
  recipes: "Recipes", specials: "Specials", labor: "Labor Costs", mod: "MOD Report", procurement: "Procurement" };
if (!LABOR_ON) delete PAGE_NAMES.labor;

// Which pages show as tabs in the row under the logo. Saved in this
// browser; every page is always reachable from the Menu.
const TABS_KEY = "line.tabs";
const DEFAULT_TABS = ["cost", "perf", "specials", "labor", "mod"].filter((p) => p in PAGE_NAMES);
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
  if (!(activePage in PAGE_NAMES)) activePage = "cost";   // e.g. a page that's been put away
  const overview = viewMode === "overview";
  document.body.classList.toggle("mode-overview", overview);
  document.querySelectorAll("[data-viewmode]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.viewmode === viewMode)));
  $("whereRest").textContent = rest.name;
  $("wherePage").textContent = overview ? "Overview" : PAGE_NAMES[activePage];
  renderTabs();
  if (overview) {
    document.querySelectorAll(".page").forEach((p) => p.classList.toggle("active", p.id === "page-overview"));
    $("simbar").classList.add("hidden");
    renderOverview();
    return;
  }
  document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("active", t.dataset.page === activePage));
  document.querySelectorAll(".page").forEach((p) => p.classList.toggle("active", p.id === "page-" + activePage));
  $("simbar").classList.toggle("hidden", !(activePage === "cost" || activePage === "perf"));
  renderWeekSelect();
  populateIngredientSelect();
  renderScenarioSelect();
  renderActiveAdj();
  if (activePage === "cost") { renderMetrics(); renderDishList(); renderPanel(); }
  else if (activePage === "home") renderHome();
  else if (activePage === "perf") renderPerf();
  else if (activePage === "sales") renderSales();
  else if (activePage === "ingredients") renderIngredients();
  else if (activePage === "recipes") renderRecipes();
  else if (activePage === "specials") renderSpecials();
  else if (activePage === "labor") renderLabor();
  else if (activePage === "mod") renderMod();
  else if (activePage === "procurement") renderProcurement();
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
        <span class="info"><span class="name">${esc(d.name)}</span></span>
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
      <div><h2>${esc(dish.name)}</h2><div class="cat">${esc(dish.category || "Uncategorized")} | Menu price ${fmt(dish.price)} | ${soldText}</div></div>
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

// The menu matrix: every dish placed by how many plates it sells (across)
// and how much profit each plate makes (up). The dashed lines are the
// average dish, so each corner is a type with its own advice. One color per
// corner, every dish named, nothing else encoded: readable in five seconds.
const QUADS = {
  star:      { name: "Stars",      act: "Keep them as they are",   color: "var(--good)" },
  plowhorse: { name: "Plowhorses", act: "Raise price or trim cost", color: "var(--watch)" },
  puzzle:    { name: "Puzzles",    act: "Promote them more",        color: "var(--puzzle)" },
  dog:       { name: "Dogs",       act: "Fix them or drop them",    color: "var(--over)" },
};
function renderQuadrantChart(rows, avgUnits, avgMargin) {
  const W = 760, H = 470, L = 62, R = 18, T = 18, B = 52;
  const pts = rows.filter((r) => r.units > 0);
  const maxU = Math.max(1, ...pts.map((r) => r.units)) * 1.12;
  const hiM = Math.max(1, ...pts.map((r) => r.marginPerPlate)) * 1.3;   // headroom so dots stay clear of the corner labels
  const loM = Math.min(0, ...pts.map((r) => r.marginPerPlate));
  const x = (u) => L + (u / maxU) * (W - L - R);
  const y = (m) => T + (1 - (m - loM) / (hiM - loM)) * (H - T - B);
  const ax = x(avgUnits), ay = y(avgMargin);
  const font = `font-family="Verdana, Geneva, sans-serif"`;
  const tx = (xx, yy, txt, o = "") => `<text x="${xx.toFixed(1)}" y="${yy.toFixed(1)}" ${font} ${o}>${txt}</text>`;

  // Shaded corners, each with its name and what to do
  const area = (x1, y1, x2, y2, k) => `<rect x="${x1.toFixed(1)}" y="${y1.toFixed(1)}" width="${(x2 - x1).toFixed(1)}" height="${(y2 - y1).toFixed(1)}" style="fill:${QUADS[k].color}" fill-opacity="0.09"/>`;
  const corner = (k, left, top) => {
    const q = QUADS[k], xx = left ? L + 10 : W - R - 10, yy = top ? T + 22 : H - B - 26, anchor = left ? "start" : "end";
    return tx(xx, yy, q.name, `font-size="17" font-weight="700" text-anchor="${anchor}" style="fill:${q.color}"`) +
      tx(xx, yy + 17, q.act, `font-size="12" font-weight="600" text-anchor="${anchor}" style="fill:var(--ink)"`);
  };
  // Keep dish names off the corner titles, the dots and each other.
  const boxes = [
    { l: L, r: L + 190, t: T, b: T + 46 }, { l: W - R - 190, r: W - R, t: T, b: T + 46 },
    { l: L, r: L + 190, t: H - B - 46, b: H - B }, { l: W - R - 190, r: W - R, t: H - B - 46, b: H - B },
  ];
  const hit = (bx) => bx.l < L || bx.r > W - R || bx.t < T || bx.b > H - B || boxes.some((o) => bx.l < o.r && bx.r > o.l && bx.t < o.b && bx.b > o.t);
  for (const r of pts) { const cx = x(r.units), cy = y(r.marginPerPlate); boxes.push({ l: cx - 7, r: cx + 7, t: cy - 7, b: cy + 7 }); }
  const dots = [], labels = [];
  for (const r of [...pts].sort((a, b) => b.weeklyMargin - a.weeklyMargin)) {
    const q = quadrantOf(r.units, r.marginPerPlate, avgUnits, avgMargin);
    const cx = x(r.units), cy = y(r.marginPerPlate);
    const name = r.d.name.length > 24 ? r.d.name.slice(0, 23) + "…" : r.d.name;
    const w = name.length * 6.6 + 4, h = 14;
    const spots = [[cx + 10, cy + 4, "start"], [cx - 10, cy + 4, "end"], [cx, cy - 11, "middle"], [cx, cy + 20, "middle"],
      [cx + 10, cy - 8, "start"], [cx - 10, cy - 8, "end"], [cx + 10, cy + 16, "start"], [cx - 10, cy + 16, "end"]];
    let placed = null;
    for (const [lx, ly, an] of spots) {
      const l = an === "start" ? lx : an === "end" ? lx - w : lx - w / 2;
      const bx = { l, r: l + w, t: ly - h + 3, b: ly + 3 };
      if (!hit(bx)) { placed = [lx, ly, an]; boxes.push(bx); break; }
    }
    dots.push(`<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="6.5" style="fill:${QUADS[q].color};stroke:var(--surface)" stroke-width="2"><title>${esc(r.d.name)}: ${r.units} sold a week, ${fmt(r.marginPerPlate)} profit per plate</title></circle>`);
    if (placed) labels.push(tx(placed[0], placed[1], esc(name), `font-size="11.5" font-weight="600" text-anchor="${placed[2]}" style="fill:var(--ink)"`));
  }
  // Light tick marks so the numbers can be read off
  const step = (span, n) => { const raw = span / n, p = 10 ** Math.floor(Math.log10(raw)); return [1, 2, 5, 10].map((m) => m * p).find((v) => v >= raw); };
  const ux = step(maxU, 5), my = step(hiM - loM, 4);
  let ticks = "";
  for (let u = 0; u <= maxU; u += ux) ticks += `<line x1="${x(u)}" y1="${H - B}" x2="${x(u)}" y2="${H - B + 5}" style="stroke:var(--ink)" stroke-opacity="0.4"/>` + tx(x(u), H - B + 18, String(u), `font-size="11" text-anchor="middle" style="fill:var(--ink)"`);
  for (let m = Math.ceil(loM / my) * my; m <= hiM; m += my) ticks += `<line x1="${L - 5}" y1="${y(m)}" x2="${L}" y2="${y(m)}" style="stroke:var(--ink)" stroke-opacity="0.4"/>` + tx(L - 9, y(m) + 4, `$${m}`, `font-size="11" text-anchor="end" style="fill:var(--ink)"`);

  $("matrixNote").textContent = `Dashed lines = your average dish: ${Math.round(avgUnits)} sold a week, ${fmt(avgMargin)} profit per plate`;
  $("quadrantChart").innerHTML = `
    <svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;display:block" role="img" aria-label="Menu matrix: plates sold per week versus profit per plate">
      ${area(L, T, ax, ay, "puzzle")}${area(ax, T, W - R, ay, "star")}${area(L, ay, ax, H - B, "dog")}${area(ax, ay, W - R, H - B, "plowhorse")}
      <line x1="${ax}" y1="${T}" x2="${ax}" y2="${H - B}" style="stroke:var(--ink)" stroke-opacity="0.45" stroke-dasharray="5 4"/>
      <line x1="${L}" y1="${ay}" x2="${W - R}" y2="${ay}" style="stroke:var(--ink)" stroke-opacity="0.45" stroke-dasharray="5 4"/>
      <line x1="${L}" y1="${H - B}" x2="${W - R}" y2="${H - B}" style="stroke:var(--ink)" stroke-opacity="0.6"/>
      <line x1="${L}" y1="${T}" x2="${L}" y2="${H - B}" style="stroke:var(--ink)" stroke-opacity="0.6"/>
      ${corner("puzzle", true, true)}${corner("star", false, true)}${corner("dog", true, false)}${corner("plowhorse", false, false)}
      ${ticks}
      ${tx((L + W - R) / 2, H - 8, "Plates sold per week →", `font-size="13" font-weight="700" text-anchor="middle" style="fill:var(--ink)"`)}
      ${tx(16, (T + H - B) / 2, "Profit per plate →", `font-size="13" font-weight="700" text-anchor="middle" transform="rotate(-90 16 ${(T + H - B) / 2})" style="fill:var(--ink)"`)}
      ${dots.join("")}${labels.join("")}
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

// ---------------------------------------------------------- Overview mode
// The high-level view for owners and executives: four big numbers in plain
// words, up to three things that need someone today, and sales by day.
// Every card links into Details mode (the full app) for the math.
let viewMode = safeGet("line.mode") === "overview" ? "overview" : "details";
function setViewMode(mode) {
  viewMode = mode === "overview" ? "overview" : "details";
  safeSet("line.mode", viewMode);
  if (viewMode === "details" && activePage === "overview") activePage = "home";
  window.scrollTo({ top: 0 });
  render();
}

function renderOverview() {
  const el = $("page-overview");
  const t = targets();
  const now = new Date();
  const hello = now.getHours() < 12 ? "Good morning." : now.getHours() < 17 ? "Good afternoon." : "Good evening.";
  const pill = (cls, text) => `<span class="ov-pill ${cls}">${esc(text)}</span>`;
  const card = (k, goto, label, value, pillHtml, sub) => `
    <button type="button" class="ov-card" data-goto="${goto}" aria-label="${esc(label)}: ${esc(String(value).replace(/<[^>]+>/g, ""))}. Open details.">
      <span class="ov-k">${label}</span><span class="ov-v mono">${value}</span>${pillHtml || ""}<span class="ov-s">${sub || ""}</span>
    </button>`;
  const pct = (a, b) => (b ? ((a - b) / b) * 100 : null);
  const upDown = (p, word = "") => (p === null ? "" : pill(p >= 0 ? "ok" : "bad", `${p >= 0 ? "Up" : "Down"} ${Math.abs(p).toFixed(0)}%${word}`));

  // Dishes at real cost (what-ifs ignored, like Tonight)
  const week = sortedWeeks()[0] || null;
  const rows = dishes.map((d) => {
    const cost = realCost(d), p = d.price ? (cost / d.price) * 100 : 0;
    const units = week ? (salesByWeek.get(week)?.get(d.id) || 0) : 0;
    return { d, cost, pct: p, st: statusOf(p), units, margin: (d.price - cost) * units };
  });

  // 1. Sales this week
  const cards = [];
  if (week) {
    const weeks = sortedWeeks(), prev = weeks[1];
    const rev = salesForWeek(week).revenue, before = prev ? salesForWeek(prev).revenue : 0;
    cards.push(card("sales", "sales", "Sales this week", fmt0(rev), upDown(pct(rev, before)), before ? `vs. ${fmt0(before)} the week before` : weekPhrase(week)));
  } else cards.push(card("sales", "sales", "Sales this week", "—", pill("watch", "Not entered yet"), "Add a week on Weekly Sales"));

  // 2. Last shift (latest MOD report)
  const last = extrasReady ? modReports[0] : null;
  if (last) {
    const s = reportStats(reportFrom(last).data);
    const lw = modReports.find((x) => x.report_date === addDays(last.report_date, -7) && x.shift === last.shift);
    const ls = lw ? reportStats(reportFrom(lw).data) : null;
    const day = parseDay(last.report_date).toLocaleDateString(undefined, { weekday: "long" });
    cards.push(card("shift", "mod", `Last shift (${esc(day)} ${esc(last.shift.toLowerCase())})`, s.sales ? fmt0(s.sales) : `${s.covers} guests`,
      ls && s.sales && ls.sales ? upDown(pct(s.sales, ls.sales)) : "",
      `${s.covers} guests${ls ? ` vs. ${ls.covers} the ${day} before` : ""}`));
  } else cards.push(card("shift", "mod", "Last shift", "—", pill("watch", "No report yet"), "Managers fill this in on the MOD Report"));

  // 3. Food cost
  if (rows.length) {
    const avg = rows.reduce((a, r) => a + r.pct, 0) / rows.length;
    cards.push(card("food", "cost", "Food cost", fmtPct(avg), avg <= t.high ? pill("ok", "On target") : pill("bad", "Too high"),
      `Goal is ${t.low} to ${t.high}%`));
  } else cards.push(card("food", "recipes", "Food cost", "—", pill("watch", "No dishes yet"), "Add your recipes first"));

  // 4. Food at risk (or menu health without use-by dates)
  if (stockReady) {
    const soon = soonToSpoil(7).filter((x) => x.i.on_hand == null || Number(x.i.on_hand) > 0);
    const worth = soon.reduce((a, x) => a + (Number(x.i.on_hand) || 0) * x.i.cost, 0);
    const urgent = soon.filter((x) => x.d <= 2).length;
    cards.push(card("risk", "specials", "Food at risk this week", fmt0(worth), urgent ? pill("watch", `${urgent} ${urgent === 1 ? "item spoils" : "items spoil"} in 2 days`) : pill("ok", "Nothing urgent"),
      `${soon.length} ${soon.length === 1 ? "item" : "items"} to use within 7 days`));
  } else {
    const red = rows.filter((r) => r.st === "red").length;
    cards.push(card("menu", "cost", "Dishes on target", `${rows.length - red} of ${rows.length}`, red ? pill("bad", `${red} over target`) : pill("ok", "All on target"), ""));
  }

  // What needs someone today: at most three, most money first.
  const todo = [];
  const byMargin = rows.filter((r) => r.units > 0).sort((a, b) => b.margin - a.margin);
  const fixDish = byMargin.find((r) => r.st === "red") || rows.filter((r) => r.st === "red").sort((a, b) => b.pct - a.pct)[0];
  if (fixDish) {
    const newPrice = Math.ceil(fixDish.cost / (t.high / 100));
    todo.push({ goto: "cost", dish: fixDish.d.id, text: `Raise <b>${esc(fixDish.d.name)}</b> from ${fmt(fixDish.d.price)} to ${fmt(newPrice)}.`, why: `It costs ${fmtPct(fixDish.pct)} of its price to make; your limit is ${t.high}%.` });
  }
  const out86 = stockReady ? eightySixNow() : [];
  if (out86.length) {
    const stops = [...new Set(out86.flatMap((x) => x.dishes))];
    todo.push({ goto: "ingredients", text: `<b>${esc(out86.map((x) => x.name).join(", "))}</b> ${out86.length === 1 ? "is" : "are"} 86'd.`, why: stops.length ? `That stops ${stops.map(esc).join(", ")}. Reorder or tell the servers.` : "Reorder or take it off tonight." });
  }
  if (stockReady) {
    const urgent = soonToSpoil(2).filter((x) => x.i.on_hand == null || Number(x.i.on_hand) > 0)
      .sort((a, b) => (Number(b.i.on_hand) || 0) * b.i.cost - (Number(a.i.on_hand) || 0) * a.i.cost).slice(0, 3);
    if (urgent.length) todo.push({ goto: "specials", text: `Use up <b>${esc(urgent.map((x) => x.i.name).join(", "))}</b> in a special.`, why: "They spoil in the next two days." });
  }
  if (last) {
    const d = reportFrom(last).data, s = reportStats(d);
    if (s.injuries) todo.push({ goto: "mod", text: `Read last shift's <b>injury report</b>.`, why: `${s.injuries} injury noted by ${esc(last.manager || "the manager")}.` });
    else if (String(d.followups || "").trim()) todo.push({ goto: "mod", text: `Follow up: ${esc(String(d.followups).split(/(?<=[.!?])\s+|\n+/)[0])}`, why: `From ${esc(last.manager || "the manager")}'s last report.` });
  }

  // Sales by day, last 7 days of shift reports
  let chart = "";
  if (last) {
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const ds = addDays(last.report_date, -i);
      const reps = modReports.filter((x) => x.report_date === ds);
      const sales = reps.reduce((a, x) => a + (Number(reportFrom(x).data.sales) || 0), 0);
      days.push({ ds, sales, has: reps.length > 0 });
    }
    const max = Math.max(1, ...days.map((x) => x.sales));
    const best = days.reduce((a, x) => (x.sales > a.sales ? x : a), days[0]);
    chart = `<section class="ov-block">
      <div class="ov-h"><h3>Sales by Day</h3><span>Last 7 days from shift reports | best day: ${parseDay(best.ds).toLocaleDateString(undefined, { weekday: "long" })}</span></div>
      <div class="ov-bars">${days.map((x) => `<div class="ov-bar${x === best ? " best" : ""}">
        <span class="ov-day">${parseDay(x.ds).toLocaleDateString(undefined, { weekday: "short" })}</span>
        <span class="ov-track">${x.has ? `<span style="width:${((x.sales / max) * 100).toFixed(1)}%"></span>` : ""}</span>
        <span class="ov-amt mono">${x.has ? fmt0(x.sales) : "Closed"}</span></div>`).join("")}</div>
    </section>`;
  }

  el.innerHTML = `
    <div class="ov-wrap">
      <div class="ov-hello"><h2>${hello}</h2><p>${now.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })} | ${esc(rest.name)}</p></div>
      <div class="ov-cards">${cards.join("")}</div>
      <section class="ov-block ov-todo">
        <div class="ov-h"><h3>What Needs You Today</h3></div>
        ${todo.length ? `<ol>${todo.slice(0, 3).map((x) => `<li><button type="button" class="ov-do" data-goto="${x.goto}"${x.dish ? ` data-ov-dish="${x.dish}"` : ""}><span class="ov-do-t">${x.text}</span><span class="ov-do-w">${x.why}</span></button></li>`).join("")}</ol>`
          : `<p class="ov-clear">Nothing needs you right now. Enjoy the shift.</p>`}
      </section>
      ${chart}
      <p class="ov-more"><button type="button" class="linkbtn" data-goto="home">Show me the details</button></p>
    </div>`;
}

// ---------------------------------------------------------- Procurement
// Where this restaurant can buy what it needs, on a Google map around its
// address. Places come from Google Maps (Places API), searched in the browser
// with a Google Maps key that the /api/maps-key helper hands to signed-in
// users (the key lives in Vercel's settings, never in this code):
//   - Distributors: Sysco, US Foods, Performance Foodservice, Gordon Food Service
//   - Wholesale clubs: Costco, Sam's Club, Restaurant Depot, BJ's
//   - Local: farmers markets, farm stands, butchers, seafood, produce and cheese shops
// Google's rules: its places are shown only on a Google map, and aren't saved;
// results are kept only while the page is open.
const PROC_TYPES = {
  distributor: { name: "Distributors", color: "#2B4C7E", what: "Broadline delivery, by account" },
  wholesale:   { name: "Wholesale clubs", color: "#B8902C", what: "Buy in bulk, pick up yourself" },
  local:       { name: "Local farms & markets", color: "#3F7D3A", what: "Farmers markets, farms, butchers, fish and produce shops" },
};
const LOCAL_KINDS = { market: "Farmers market", farm: "Farm stand", butcher: "Butcher", seafood: "Seafood market", greengrocer: "Produce market", cheese: "Cheese shop" };
// What to search Google for. Brand searches keep only results with that brand in the name.
const PLACE_SEARCHES = [
  { q: "Sysco foodservice distribution", type: "distributor", kind: "Distributor", brand: /sysco/i, far: true },
  { q: "US Foods distribution center", type: "distributor", kind: "Distributor", brand: /us ?foods/i, far: true },
  { q: "Performance Foodservice", type: "distributor", kind: "Distributor", brand: /performance food/i, far: true },
  { q: "Gordon Food Service", type: "distributor", kind: "Distributor", brand: /gordon food|gfs/i, far: true },
  { q: "Costco Wholesale", type: "wholesale", kind: "Wholesale club", brand: /costco/i },
  { q: "Sam's Club", type: "wholesale", kind: "Wholesale club", brand: /sam'?s club/i },
  { q: "Restaurant Depot", type: "wholesale", kind: "Wholesale club", brand: /restaurant depot/i },
  { q: "BJ's Wholesale Club", type: "wholesale", kind: "Wholesale club", brand: /bj'?s wholesale/i },
  { q: "farmers market", type: "local", kind: "market" },
  { q: "farm stand", type: "local", kind: "farm" },
  { q: "butcher shop", type: "local", kind: "butcher" },
  { q: "seafood market", type: "local", kind: "seafood" },
  { q: "produce market", type: "local", kind: "greengrocer" },
  { q: "cheese shop", type: "local", kind: "cheese" },
];
// Ingredient groups: the words that put an ingredient in a group, and where to buy that group.
const PROC_CATS = [
  { id: "seafood", name: "Seafood", words: /\b(cod|fish|salmon|shrimp|prawn|crab|lobster|oyster|clam|mussel|scallop|tuna|tilapia|haddock|halibut|catfish|trout)\b/i, from: ["seafood", "wholesale", "distributor"] },
  { id: "meat", name: "Meat", words: /\b(beef|chuck|brisket|steak|lamb|pork|bacon|rasher|banger|sausage|ham|chicken|wing|turkey|duck|veal|shank|rib|mince|corned)\b/i, from: ["butcher", "farm", "wholesale", "distributor"] },
  { id: "dairy", name: "Dairy & eggs", words: /\b(cheese|cheddar|swiss|brie|mozzarella|parmesan|cream|milk|butter|yogurt|egg|eggs|ice cream)\b/i, from: ["cheese", "farm", "market", "wholesale", "distributor"] },
  { id: "bar", name: "Beer, wine & spirits", words: /\b(stout|beer|ale|lager|wine|whiskey|whisky|vodka|gin|rum|tequila|bourbon|cider)\b/i, from: ["distributor"] },
  { id: "produce", name: "Produce", words: /\b(lettuce|tomato|onion|onions|potato|potatoes|leek|leeks|celery|chive|chives|lemon|lime|herb|herbs|parsley|vegetable|root|pepper|garlic|carrot|apple|berry|berries|mushroom|cabbage|fruit|greens|spinach|kale|cucumber|peas|corn|squash|avocado|yukon)\b/i, from: ["market", "farm", "greengrocer", "wholesale", "distributor"] },
  { id: "bakery", name: "Bread & bakery", words: /\b(bread|bun|buns|roll|rolls|rye|pretzel|sponge|cake|tortilla|bagel|brioche|baguette)\b/i, from: ["market", "wholesale", "distributor"] },
  { id: "pantry", name: "Pantry & dry goods", words: /./, from: ["wholesale", "distributor"] },
];
const CHAINS = [
  { name: "Sysco", match: /sysco/i, site: "https://www.sysco.com" },
  { name: "US Foods", match: /us ?foods/i, site: "https://www.usfoods.com" },
  { name: "Performance Foodservice", match: /performance food/i, site: "https://www.performancefoodservice.com" },
  { name: "Gordon Food Service", match: /gordon food|gfs/i, site: "https://gfs.com" },
];

let proc = { cat: "all", radius: 25, show: new Set(["distributor", "wholesale", "local"]), geo: null, sources: null, map: null, pins: [], info: null, loadingFor: "", found: {} };

function ingredientCategory(name) {
  // Sauces, gravies and batters are pantry items even if they name a food ("Guinness BBQ sauce").
  if (/\b(sauce|gravy|batter|dip|dressing|mash|chips|stock|crumbs|panko|flour|sugar|oil|vinegar|spice|seasoning|kraut|sauerkraut|curry)\b/i.test(name)) return "pantry";
  return PROC_CATS.find((c) => c.words.test(name)).id;
}
function procNeeds() {
  const groups = Object.fromEntries(PROC_CATS.map((c) => [c.id, []]));
  for (const i of ingredients.values()) {
    const out = i.on_hand !== null && Number(i.on_hand) === 0, d = daysLeft(i.use_by);
    groups[ingredientCategory(i.name)].push({ i, out, soon: d !== null && d <= 2 });
  }
  for (const k in groups) groups[k].sort((a, b) => b.out - a.out || b.soon - a.soon || a.i.name.localeCompare(b.i.name));
  return groups;
}
function milesBetween(a, b) {
  const R = 3958.8, rad = (x) => (x * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat), dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
function procCache(key, val) {
  if (val === undefined) { try { return JSON.parse(safeGet(key) || "null"); } catch { return null; } }
  try { safeSet(key, JSON.stringify(val)); } catch { /* storage full: skip */ }
}

// Google Maps loads only when this page is first opened, with the key from Vercel.
let gmapsReady = null;
function loadGoogleMaps() {
  if (window.google?.maps?.importLibrary) return Promise.resolve();
  if (gmapsReady) return gmapsReady;
  gmapsReady = (async () => {
    const { data } = await sb.auth.getSession();
    const r = await fetch("/api/maps-key", { headers: { Authorization: `Bearer ${data.session?.access_token || ""}` } });
    if (r.status === 503 || r.status === 404) { const e = new Error("not_configured"); e.code = "not_configured"; throw e; }
    const out = await r.json().catch(() => ({}));
    if (!r.ok || !out.key) throw new Error(out.error || "key");
    await new Promise((resolve, reject) => {
      window.__lineMapsReady = resolve;
      window.gm_authFailure = () => { proc.authFailed = true; procStatusLine("Google rejected the Maps key. Check that the key allows this website and that Maps JavaScript API and Places API (New) are turned on."); };
      const s = document.createElement("script");
      s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(out.key)}&v=weekly&libraries=places&loading=async&callback=__lineMapsReady`;
      s.async = true; s.onerror = () => reject(new Error("script"));
      document.head.appendChild(s);
    });
  })();
  gmapsReady.catch(() => { gmapsReady = null; });
  return gmapsReady;
}

// The restaurant's address on the map (OpenStreetMap's free Nominatim; cached in this browser).
async function geocodeRestaurant(r) {
  const addr = oneLineAddress(r);
  const cached = procCache(`line.geo.${r.id}`);
  if (cached && cached.addr === addr) return cached;
  const q = new URLSearchParams({ format: "jsonv2", limit: "1", countrycodes: "us", street: r.address_line1, city: r.city, state: r.state, postalcode: r.postal_code });
  let hit = null;
  for (const params of [q, new URLSearchParams({ format: "jsonv2", limit: "1", countrycodes: "us", postalcode: r.postal_code })]) {
    const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, { headers: { Accept: "application/json" } });
    if (!res.ok) continue;
    const list = await res.json();
    if (list[0]) { hit = { addr, lat: Number(list[0].lat), lon: Number(list[0].lon), exact: params === q }; break; }
  }
  if (hit) procCache(`line.geo.${r.id}`, hit);
  return hit;
}

// A box around the restaurant, so results stay nearby.
function boundsAround(home, miles) {
  const dLat = miles / 69, dLon = miles / (69 * Math.cos((home.lat * Math.PI) / 180));
  return { south: home.lat - dLat, north: home.lat + dLat, west: home.lon - dLon, east: home.lon + dLon };
}

// Search Google for every kind of source at once. Brand searches look out to
// 100 miles (distributors deliver regionally); the rest stay within the chosen distance.
async function findSources(home, miles) {
  const { Place } = await google.maps.importLibrary("places");
  const fields = ["id", "displayName", "location", "formattedAddress", "googleMapsURI", "businessStatus"];
  const runs = await Promise.allSettled(PLACE_SEARCHES.map(async (s) => {
    const { places } = await Place.searchByText({ textQuery: s.q, fields, locationRestriction: boundsAround(home, s.far ? 100 : miles), maxResultCount: 20 });
    return (places || []).filter((p) => p.businessStatus !== "CLOSED_PERMANENTLY" && (!s.brand || s.brand.test(p.displayName || "")))
      .map((p) => {
        const lat = typeof p.location.lat === "function" ? p.location.lat() : p.location.lat, lon = typeof p.location.lng === "function" ? p.location.lng() : p.location.lng;
        // A distributor's walk-in store (like a Gordon Food Service Store) is a wholesale stop, not delivery.
        const store = s.type === "distributor" && /\bstore\b/i.test(p.displayName || "");
        return { id: p.id, name: p.displayName || "", type: store ? "wholesale" : s.type, kind: store ? "Wholesale store" : s.kind, lat, lon, miles: milesBetween(home, { lat, lon }), address: p.formattedAddress || "", maps: p.googleMapsURI || "" };
      });
  }));
  const failed = runs.filter((r) => r.status === "rejected");
  if (failed.length === runs.length) {
    const e = new Error("places"); e.details = [...new Set(failed.map((r) => String(r.reason?.message || r.reason).slice(0, 200)))]; throw e;
  }
  // One place can show up in more than one search (a market that's also a farm stand): keep the first.
  const seen = new Set(), list = [];
  for (const r of runs) if (r.status === "fulfilled") for (const s of r.value) { if (!seen.has(s.id)) { seen.add(s.id); list.push(s); } }
  list.sort((a, b) => a.miles - b.miles);
  list.partial = failed.length > 0;
  return list;
}

// Which sources fit the chosen ingredient group.
function procVisible() {
  const cat = PROC_CATS.find((c) => c.id === proc.cat);
  return (proc.sources || []).filter((s) => {
    if (!proc.show.has(s.type)) return false;
    if (s.type !== "distributor" && s.miles > proc.radius) return false;
    if (!cat) return true;
    return s.type === "local" ? cat.from.includes(s.kind) : cat.from.includes(s.type);
  });
}

function procStatusLine(msg) { const el = $("procStatus"); if (el) el.textContent = msg; }

async function renderProcurement() {
  const el = $("page-procurement");
  if (!hasAddressCols(rest) || !rest.address_line1) {
    procClearMap();
    el.innerHTML = `<div class="perf-wrap"><div class="chart-card empty">
      <h3>Add Your Restaurant's Address First</h3>
      <p>Procurement maps the places near ${esc(rest.name)} where you can buy what you need. It needs the full street address.</p>
      ${hasAddressCols(rest) ? `<button class="applybtn" id="procAddAddress" type="button">Add the address in Settings</button>` : `<p>${esc(ADDRESS_SETUP)}</p>`}
    </div></div>`;
    return;
  }
  const needs = procNeeds();
  const cats = PROC_CATS.filter((c) => needs[c.id].length);
  if (proc.cat !== "all" && !cats.some((c) => c.id === proc.cat)) proc.cat = "all";
  const cat = PROC_CATS.find((c) => c.id === proc.cat);
  if (!el.querySelector("#procMap")) {
    procClearMap();
    el.innerHTML = `<div class="perf-wrap proc">
      <div class="chart-card">
        <div class="chart-head"><h3>Sourcing Near ${esc(rest.name)}</h3><span class="note" id="procWhere"></span></div>
        <div class="proc-need-head"><strong>What do you need?</strong><span class="note">Pick a group to see only the places that sell it.</span></div>
        <div class="proc-cats" id="procCats" role="group" aria-label="Ingredient groups"></div>
        <p class="proc-detail" id="procDetail"></p>
        <div class="proc-controls">
          <label class="inline">Within <select id="procRadius">${[10, 25, 50].map((m) => `<option value="${m}" ${m === proc.radius ? "selected" : ""}>${m} miles</option>`).join("")}</select></label>
          ${Object.entries(PROC_TYPES).map(([k, v]) => `<label class="proc-toggle"><input type="checkbox" data-proc-type="${k}" ${proc.show.has(k) ? "checked" : ""}><span class="proc-dot" style="background:${v.color}"></span>${v.name}</label>`).join("")}
          <span class="note" id="procStatus" aria-live="polite"></span>
        </div>
      </div>
      <div class="proc-grid">
        <div class="chart-card proc-map-card"><div id="procMap" role="region" aria-label="Map of nearby sources"></div>
          <p class="note proc-credit"><span class="proc-dot proc-home"></span> ${esc(rest.name)} | dashed ring = your distance. Places from Google Maps; check hours before you go.</p></div>
        <div class="chart-card proc-list-card"><div class="chart-head"><h3>Nearby Sources</h3><span class="note" id="procCount"></span></div><div id="procList"></div></div>
      </div>
      <div class="chart-card"><div class="chart-head"><h3>Large Distributors</h3><span class="note">They deliver to restaurants by account, not walk-in</span></div><div id="procChains"></div></div>
      <div id="procPricing"></div>
    </div>`;
  }
  // The price book loads alongside the map; the first time, Gemini fills in typical prices.
  loadPriceBook().then(() => {
    renderPricing();
    if (priceBook.ready === true && !priceBook.points.some((p) => p.source === "estimate") && weeklyUse().size) estimatePrices(true);
  });
  $("procCats").innerHTML = [`<button type="button" class="proc-cat" data-proc-cat="all" aria-pressed="${proc.cat === "all"}">Everything <span>${ingredients.size}</span></button>`,
    ...cats.map((c) => { const out = needs[c.id].filter((x) => x.out).length;
      return `<button type="button" class="proc-cat${out ? " has-out" : ""}" data-proc-cat="${c.id}" aria-pressed="${proc.cat === c.id}">${c.name} <span>${needs[c.id].length}</span>${out ? `<b class="proc-out">${out} 86'd</b>` : ""}</button>`; })].join("");
  if (cat) {
    const list = needs[cat.id];
    const where = cat.from.map((k) => (LOCAL_KINDS[k] || PROC_TYPES[k]?.name || k).toLowerCase()).join(", ");
    $("procDetail").innerHTML = `<strong>${cat.name}:</strong> ${list.slice(0, 8).map((x) => `${esc(x.i.name)}${x.out ? ` <b class="proc-out">86'd</b>` : x.soon ? ` <span class="proc-soon">spoils soon</span>` : ""}`).join(", ")}${list.length > 8 ? `, and ${list.length - 8} more` : ""}.
      <span class="proc-where">Best bought from: ${esc(where)}.</span>${cat.id === "bar" ? ` <span class="proc-where">Most states require restaurants to buy alcohol from a licensed wholesaler, not a store.</span>` : ""}`;
  } else {
    const out = [...ingredients.values()].filter((i) => i.on_hand !== null && Number(i.on_hand) === 0);
    $("procDetail").innerHTML = out.length ? `<strong>Reorder now:</strong> ${out.map((i) => `${esc(i.name)} <b class="proc-out">86'd</b>`).join(", ")}.` : "Showing every kind of source near you.";
  }
  $("procWhere").textContent = oneLineAddress(rest);
  await procLoad();
}

async function procLoad() {
  const want = `${rest.id}|${oneLineAddress(rest)}|${Math.max(proc.radius, 25)}`;
  const say = (msg, opts = {}) => {
    procStatusLine(msg);
    if (!proc.sources) $("procList").innerHTML = `<p class="proc-msg">${msg}</p>${opts.retry ? `<button class="ghostbtn dark" id="procRetry" type="button">Try again</button>` : ""}${opts.details?.length ? `<details class="proc-why" open><summary>What Google said</summary><ul>${opts.details.map((d) => `<li>${esc(d)}</li>`).join("")}</ul></details>` : ""}`;
  };
  if (!proc.geo || proc.geo.addr !== oneLineAddress(rest) || !proc.loadingFor.startsWith(rest.id)) {
    proc.sources = null;
    say("Finding your restaurant on the map…");
    try { proc.geo = await geocodeRestaurant(rest); } catch { proc.geo = null; }
    if (!proc.geo) { say("Couldn't find that address on the map. Check it in Settings.", { retry: true }); return; }
  }
  try {
    await loadGoogleMaps();
  } catch (err) {
    if (err.code === "not_configured") {
      say(`Google Maps isn't connected yet. Whoever set up The Line needs to add a <strong>GOOGLE_MAPS_KEY</strong> in Vercel's settings. The steps are in the README under "Procurement (Google Maps)".`);
    } else say("Google Maps couldn't load. Check your internet connection.", { retry: true });
    return;
  }
  procDrawMap();
  if (proc.found[want]) proc.sources = proc.found[want];
  if (!proc.sources || proc.loadingFor !== want) {
    proc.loadingFor = want;
    proc.sources = null;
    procDrawSources();                              // your restaurant's pin, right away
    say("Searching Google Maps for places nearby…");
    try {
      const found = await findSources(proc.geo, Math.max(proc.radius, 25));
      if (proc.loadingFor !== want) return;         // the distance or restaurant changed meanwhile
      proc.sources = proc.found[want] = found;
    } catch (err) {
      if (proc.loadingFor !== want) return;
      proc.loadingFor = "";
      say("Google Maps didn't return any places.", { retry: true, details: err.details || [String(err.message || err)] });
      return;
    }
  }
  procStatusLine(proc.sources.partial ? "Some searches didn't answer; the rest are shown." : proc.geo.exact ? "" : "Placed by ZIP code; the street address wasn't found.");
  procDrawSources();
}

function procClearMap() {
  proc.pins.forEach((p) => p.setMap(null)); proc.pins = [];
  proc.map = null;
}
function procDrawMap() {
  const box = $("procMap");
  if (!box) return;
  if (proc.map && proc.map.getDiv() !== box) procClearMap();
  if (!proc.map) {
    proc.map = new google.maps.Map(box, { center: { lat: proc.geo.lat, lng: proc.geo.lon }, zoom: 11, mapTypeControl: false, streetViewControl: false, fullscreenControl: true, clickableIcons: false, gestureHandling: "cooperative" });
    proc.info = new google.maps.InfoWindow();
  }
}
const dotIcon = (color, scale = 7, ring = "#FFFFFF", ringW = 2) => ({ path: google.maps.SymbolPath.CIRCLE, scale, fillColor: color, fillOpacity: 1, strokeColor: ring, strokeWeight: ringW });
function procDrawSources() {
  if (!proc.map) return;
  const home = { lat: proc.geo.lat, lng: proc.geo.lon }, list = procVisible();
  procClearPins();
  const ring = new google.maps.Circle({ map: proc.map, center: home, radius: proc.radius * 1609.34, strokeColor: "#163829", strokeOpacity: 0.5, strokeWeight: 1, fillOpacity: 0, clickable: false });
  proc.pins.push(ring);
  const label = (s) => (s.type === "local" ? LOCAL_KINDS[s.kind] : s.kind);
  for (const s of list) {
    const m = new google.maps.Marker({ map: proc.map, position: { lat: s.lat, lng: s.lon }, title: s.name, icon: dotIcon(PROC_TYPES[s.type].color) });
    m.addListener("click", () => procOpen(s, m));
    s.pin = m;
    proc.pins.push(m);
  }
  // The restaurant goes on last so it's never hidden under a source next door.
  const you = new google.maps.Marker({ map: proc.map, position: home, title: rest.name, icon: dotIcon("#163829", 10, "#B8902C", 4), zIndex: 9999 });
  you.addListener("click", () => { proc.info.setContent(`<div class="proc-info"><strong>${esc(rest.name)}</strong><br>${esc(oneLineAddress(rest))}</div>`); proc.info.open({ map: proc.map, anchor: you }); });
  proc.pins.push(you);
  if (!proc.sources) { proc.map.setCenter(home); proc.map.setZoom(11); return; }
  const nearby = list.filter((s) => s.miles <= proc.radius);
  if (nearby.length) {
    const b = new google.maps.LatLngBounds(); b.extend(home); nearby.forEach((s) => b.extend({ lat: s.lat, lng: s.lon }));
    proc.map.fitBounds(b, 40);
  } else proc.map.fitBounds(ring.getBounds(), 20);
  $("procCount").textContent = `${list.length} ${list.length === 1 ? "place" : "places"}`;
  $("procList").innerHTML = list.length ? `<ul class="proc-list">${list.slice(0, 80).map((s) => `<li>
      <span class="proc-dot" style="background:${PROC_TYPES[s.type].color}"></span>
      <div><button type="button" class="proc-name" data-proc-go="${esc(s.id)}">${esc(s.name)}</button>
      <div class="proc-meta">${esc(label(s))} | ${s.miles.toFixed(1)} mi${s.address ? ` | ${esc(s.address.replace(/, USA$/, ""))}` : ""}</div>
      <div class="proc-links"><a href="${procDirections(s)}" target="_blank" rel="noopener">Directions</a>${s.maps ? ` <a href="${esc(s.maps)}" target="_blank" rel="noopener">Hours &amp; phone on Google Maps</a>` : ""}</div></div></li>`).join("")}</ul>`
    : `<p class="ms-empty">No ${proc.cat === "all" ? "" : PROC_CATS.find((c) => c.id === proc.cat).name.toLowerCase() + " "}sources found within ${proc.radius} miles. Try a wider distance.</p>`;
  $("procChains").innerHTML = `<div class="proc-chains">${CHAINS.map((c) => {
    const near = (proc.sources || []).filter((s) => s.type === "distributor" && c.match.test(s.name)).sort((a, b) => a.miles - b.miles)[0];
    return `<div class="proc-chain"><strong>${c.name}</strong>
      <span>${near ? `Nearest location: ${esc(near.name)}, ${near.miles.toFixed(0)} mi` : "No location found within 100 miles. Most deliver across a region; ask for a sales rep."}</span>
      <a href="${c.site}" target="_blank" rel="noopener">Set up an account</a></div>`; }).join("")}</div>`;
  renderPricing();
}
function procClearPins() { proc.pins.forEach((p) => p.setMap(null)); proc.pins = []; }
function procOpen(s, marker) {
  const label = s.type === "local" ? LOCAL_KINDS[s.kind] : s.kind;
  proc.info.setContent(`<div class="proc-info"><strong>${esc(s.name)}</strong><br>${esc(label)} | ${s.miles.toFixed(1)} mi${s.address ? `<br>${esc(s.address.replace(/, USA$/, ""))}` : ""}<br><a href="${procDirections(s)}" target="_blank" rel="noopener">Directions</a>${s.maps ? ` | <a href="${esc(s.maps)}" target="_blank" rel="noopener">Google Maps</a>` : ""}</div>`);
  proc.info.open({ map: proc.map, anchor: marker });
}
function procDirections(s) {
  return `https://www.google.com/maps/dir/?api=1&origin=${proc.geo.lat},${proc.geo.lon}&destination=${encodeURIComponent(s.name)}&destination_place_id=${encodeURIComponent(s.id)}`;
}
function procFocus(id) {
  const s = (proc.sources || []).find((x) => x.id === id);
  if (!s || !proc.map || !s.pin) return;
  proc.map.setCenter({ lat: s.lat, lng: s.lon }); proc.map.setZoom(14);
  procOpen(s, s.pin);
  $("procMap").scrollIntoView({ behavior: "smooth", block: "center" });
}

// ---------------------------------------------------------- Price book & smartest places to buy
// Every price The Line learns goes in the price book (supabase/prices.sql):
// real prices from scanned invoices and receipts, quotes the owner types in,
// and typical-price estimates from Gemini with Google Search to fill gaps.
// The buying plan compares, for each food group, the true weekly cost of
// buying it at each kind of place: price x what you use a week, plus the trip
// (miles and staff time) for places you drive to, plus a spoilage allowance
// for perishables bought in big packs. It shows how sure it is: real prices
// count more than estimates.
const PLAN = {
  milesCost: 0.70,          // $ per mile driven (about the IRS mileage rate)
  mph: 30,                  // average driving speed in town
  shopMinutes: 30,          // time in the store
  wage: 18,                 // $ per hour for whoever does the run
  tripsPerWeek: 1,
  spoil: { distributor: 0.02, wholesale: 0.08, local: 0 },   // extra waste from pack sizes, perishables only
  perishable: new Set(["produce", "seafood", "meat", "dairy", "bakery"]),
  estimateDays: 14,         // estimates older than this get looked up again
};
let priceBook = { rid: null, ready: null, points: [], estimating: false, addFor: null, msg: "" };

function supplierType(name) {
  const n = String(name || "");
  if (/gordon food service store|gfs store|costco|sam'?s club|restaurant depot|bj'?s wholesale|smart ?& ?final|chef'?store|jetro|webstaurant/i.test(n)) return "wholesale";
  if (/sysco|us ?foods|performance food|gordon food|\bgfs\b|reinhart|ben e\.? ?keith|shamrock foods|cheney|chefs'? warehouse/i.test(n)) return "distributor";
  if (/farm|market|butcher|seafood|fish|produce|creamery|dairy|bakery|orchard|grocer|cheese/i.test(n)) return "local";
  return "other";
}
const BRANDS = ["costco", "sam's club", "restaurant depot", "bj's", "sysco", "us foods", "performance food", "gordon food"];
function brandOf(name) {
  const n = String(name || "").toLowerCase().replace(/’/g, "'");
  return BRANDS.find((b) => n.includes(b)) || n.trim();
}

async function loadPriceBook() {
  if (priceBook.rid === rest.id && priceBook.ready !== null) return;
  priceBook = { rid: rest.id, ready: null, points: [], estimating: false, addFor: null, msg: "" };
  const res = await sb.from("price_points").select("*").eq("restaurant_id", rest.id).order("observed_on", { ascending: false }).order("created_at", { ascending: false });
  if (res.error) { priceBook.ready = isMissingTable(res.error) ? false : null; if (priceBook.ready === null) priceBook.msg = esc(friendlyError(res.error)); return; }
  priceBook.ready = true;
  priceBook.points = res.data.map((p) => ({ ...p, unit_cost: Number(p.unit_cost), low_cost: p.low_cost == null ? null : Number(p.low_cost), high_cost: p.high_cost == null ? null : Number(p.high_cost) }));
}

// How much of each ingredient a week, from the latest week of sales x recipes.
function weeklyUse() {
  const week = sortedWeeks()[0], units = week ? salesByWeek.get(week) : null, use = new Map();
  if (!units) return use;
  for (const d of dishes) {
    const u = units.get(d.id) || 0;
    if (!u) continue;
    for (const it of d.items) use.set(it.ingredient_id, (use.get(it.ingredient_id) || 0) + u * it.qty);
  }
  return use;
}

// The newest price for an ingredient that passes a test.
function latestPrice(ingId, test) {
  return priceBook.points.find((p) => p.ingredient_id === ingId && test(p)) || null;
}
const isReal = (p) => p.source !== "estimate";

// Trip cost for one run to a place this many miles away.
function tripCost(miles) {
  const rt = miles * 2;
  return PLAN.tripsPerWeek * (rt * PLAN.milesCost + ((rt / PLAN.mph) * 60 + PLAN.shopMinutes) / 60 * PLAN.wage);
}

function buildPlan() {
  const use = weeklyUse();
  const near = (test) => (proc.sources || []).filter(test).sort((a, b) => a.miles - b.miles)[0] || null;
  const realWholesale = priceBook.points.filter((p) => isReal(p) && p.supplier_type === "wholesale");
  // The wholesale clubs to compare: the nearest location of every club you have real prices from, plus the nearest club.
  const clubs = [...new Set(realWholesale.map((p) => brandOf(p.supplier)))]
    .map((brand) => near((s) => s.type === "wholesale" && brandOf(s.name) === brand))
    .concat([near((s) => s.type === "wholesale")]).filter(Boolean)
    .filter((c, i, all) => all.findIndex((x) => x.id === c.id) === i).slice(0, 4);
  const distName = (priceBook.points.find((p) => isReal(p) && p.supplier_type === "distributor") || {}).supplier;
  const rows = [], checks = [];
  let totalNow = 0, totalPlan = 0;
  for (const cat of PROC_CATS) {
    const items = [...ingredients.values()].filter((i) => ingredientCategory(i.name) === cat.id && (use.get(i.id) || 0) > 0);
    if (!items.length) continue;
    const now = items.reduce((t, i) => t + use.get(i.id) * i.cost, 0);
    const local = cat.from.some((k) => LOCAL_KINDS[k]) ? near((s) => s.type === "local" && cat.from.includes(s.kind)) : null;
    const options = [
      { key: "distributor", name: distName || "A distributor (Sysco, US Foods)", delivered: true, miles: 0, test: (p) => p.supplier_type === "distributor" },
      ...(cat.from.includes("wholesale") ? clubs : []).map((club) => ({ key: "wholesale", name: club.name, miles: club.miles, test: (p) => p.supplier_type === "wholesale" && (p.source === "estimate" || brandOf(p.supplier) === brandOf(club.name)) })),
      local ? { key: "local", name: local.name, miles: local.miles, test: (p) => p.supplier_type === "local" } : null,
    ].filter(Boolean);
    for (const o of options) {
      let goods = 0, priced = 0, real = 0;
      o.lines = items.map((i) => {
        const q = use.get(i.id), base = q * i.cost;
        const r = latestPrice(i.id, (p) => isReal(p) && o.test(p));
        const fresh = (p) => p.source === "estimate" && daysLeft(addDays(p.observed_on, 60)) >= 0;   // estimates count for 60 days
        const e = r ? null : latestPrice(i.id, (p) => fresh(p) && o.test(p) && p.supplier.startsWith("Typical"));
        const p = r || e;
        goods += p ? q * p.unit_cost : base;
        if (p) priced += base;
        if (r) real += base;
        return { i, q, price: p };
      });
      o.goods = goods;
      o.spoil = PLAN.perishable.has(cat.id) ? goods * PLAN.spoil[o.key] : 0;
      o.cost = goods + o.spoil;
      o.pricedShare = now ? priced / now : 0;
      o.realShare = now ? real / now : 0;
    }
    const usable = options.filter((o) => o.pricedShare >= 0.5);
    rows.push({ cat, now, items, options, usable });
    // Price checks: an estimate says it's cheaper somewhere, but there's no real price there yet.
    for (const o of options) for (const l of o.lines) {
      if (!l.price || l.price.source !== "estimate") continue;
      const save = l.q * (l.i.cost - l.price.unit_cost);
      if (save >= 3) checks.push({ i: l.i, where: o.name, key: o.key, est: l.price.unit_cost, save });
    }
  }
  // Pick the cheapest option per group, then make sure each trip pays for itself.
  for (const r of rows) {
    r.pick = [...r.usable].sort((a, b) => a.cost - b.cost)[0] || null;
    if (r.pick && r.pick.cost >= r.now) r.pick = null;          // nothing beats what you pay now
  }
  const byPlace = new Map();
  for (const r of rows) if (r.pick && !r.pick.delivered) {
    const k = r.pick.name;
    if (!byPlace.has(k)) byPlace.set(k, { miles: r.pick.miles, rows: [] });
    byPlace.get(k).rows.push(r);
  }
  for (const [, g] of byPlace) {
    g.trip = tripCost(g.miles);
    const save = g.rows.reduce((t, r) => t + (r.now - r.pick.cost), 0);
    if (save <= g.trip) {               // the drive costs more than it saves: fall back to delivery or staying put
      for (const r of g.rows) { const d = r.usable.find((o) => o.delivered); r.pick = d && d.cost < r.now ? d : null; r.tripDropped = true; }
    } else for (const r of g.rows) r.trip = g.trip * ((r.now - r.pick.cost) / save);   // share the trip by savings
  }
  for (const r of rows) {
    r.planCost = r.pick ? r.pick.cost + (r.trip || 0) : r.now;
    totalNow += r.now; totalPlan += r.planCost;
  }
  checks.sort((a, b) => b.save - a.save);
  const seen = new Set();
  return { rows, totalNow, totalPlan, checks: checks.filter((c) => !seen.has(c.i.id) && seen.add(c.i.id)).slice(0, 3), hasSales: use.size > 0 };
}

const dots = (share) => (share >= 0.6 ? "●●●" : share > 0.15 ? "●●○" : "●○○");
const sourceWord = { invoice: "Invoice", receipt: "Receipt", quote: "Quote", estimate: "Estimate" };

function renderPricing() {
  const el = $("procPricing");
  if (!el) return;
  if (priceBook.ready === false) {
    el.innerHTML = `<div class="chart-card"><div class="chart-head"><h3>Smartest Places to Buy</h3></div>
      <p>One more database step: in Supabase, open <strong>SQL Editor</strong> → <strong>New query</strong>, paste in everything from <code>supabase/prices.sql</code>, click <strong>Run</strong>, then reload this page. That adds the price book this page learns prices into.</p></div>`;
    return;
  }
  if (priceBook.ready !== true) { el.innerHTML = ""; return; }
  const plan = buildPlan(), use = weeklyUse();
  const save = plan.totalNow - plan.totalPlan;
  const anyReal = priceBook.points.some(isReal);
  const planRows = plan.rows.map((r) => {
    const p = r.pick, by = p ? p.name : "Where you buy now";
    const why = p
      ? `${fmt0(r.now - r.planCost)} less a week${p.delivered ? ", delivered" : ` after a ${Math.round(p.miles * 2)}-mile round trip`}${p.spoil ? `, with ${Math.round(PLAN.spoil[p.key] * 100)}% extra for bigger packs` : ""}.`
      : r.tripDropped ? "A cheaper place is too far to be worth the drive." : r.usable.length ? "You already pay the best price we know of." : "Not enough prices yet to compare.";
    return `<tr><td><strong>${r.cat.name}</strong></td><td>${esc(by)}${p && !p.delivered ? `<div class="pp-sub">${p.miles.toFixed(1)} mi</div>` : ""}</td>
      <td class="num mono">${fmt0(r.now)}</td><td class="num mono">${fmt0(r.planCost)}</td>
      <td class="num mono ${r.now - r.planCost > 0.5 ? "pp-save" : ""}">${r.now - r.planCost > 0.5 ? fmt0(r.now - r.planCost) : "—"}</td>
      <td class="pp-conf" title="How sure: ●●● mostly your real prices, ●●○ some, ●○○ estimates only">${p ? dots(p.realShare) : ""}</td>
      <td class="pp-why">${why}</td></tr>`;
  }).join("");
  const checks = plan.checks.length ? `<div class="pp-checks"><h4>Price Checks Worth Doing</h4><ol>${plan.checks.map((c) => `<li>
      <span>Check <strong>${esc(c.i.name)}</strong> at <strong>${esc(c.where)}</strong> next time: estimated ${fmt(c.est)} vs. ${fmt(c.i.cost)} now per ${esc(c.i.unit)}. Could save about <strong>${fmt0(c.save)} a week</strong>.</span>
      <button class="linkbtn" type="button" data-pp-add="${c.i.id}" data-pp-where="${esc(c.where)}">Add the price</button></li>`).join("")}</ol></div>` : "";
  // Price book: ingredients by weekly spend
  const list = [...ingredients.values()].map((i) => ({ i, q: use.get(i.id) || 0 })).sort((a, b) => b.q * b.i.cost - a.q * a.i.cost || a.i.name.localeCompare(b.i.name));
  const nearbyNames = [...new Set([...(proc.sources || []).map((s) => s.name), ...priceBook.points.filter(isReal).map((p) => p.supplier)])];
  const bookRow = ({ i, q }) => {
    const pts = priceBook.points.filter((p) => p.ingredient_id === i.id);
    const bySupplier = new Map();
    for (const p of pts) if (!bySupplier.has(p.supplier)) bySupplier.set(p.supplier, p);   // newest per place
    const best = [...bySupplier.values()].sort((a, b) => a.unit_cost - b.unit_cost)[0];
    const adding = priceBook.addFor === i.id;
    return `<tr${adding ? ' class="pp-adding"' : ""}><td><strong>${esc(i.name)}</strong><div class="pp-sub">${ingredientCategoryName(i.name)}</div></td>
      <td class="num mono">${q ? `${trimNum(Math.round(q * 10) / 10)} ${esc(i.unit)}` : "—"}</td>
      <td class="num mono">${fmt(i.cost)}</td>
      <td>${best ? `<span class="mono">${fmt(best.unit_cost)}</span> at ${esc(best.supplier)} <span class="pp-src ${best.source}">${sourceWord[best.source]}, ${fmtDay(best.observed_on)}</span>` : `<span class="pp-sub">No prices yet</span>`}
        ${bySupplier.size > 1 ? `<details class="pp-all"><summary>All ${bySupplier.size} places</summary><ul>${[...bySupplier.values()].sort((a, b) => a.unit_cost - b.unit_cost).map((p) => `<li><span class="mono">${fmt(p.unit_cost)}</span> ${esc(p.supplier)} <span class="pp-src ${p.source}">${sourceWord[p.source]}, ${fmtDay(p.observed_on)}</span>${p.low_cost && p.high_cost ? ` <span class="pp-sub">(usually ${fmt(p.low_cost)}–${fmt(p.high_cost)})</span>` : ""}</li>`).join("")}</ul></details>` : ""}</td>
      <td class="num"><button class="ghostbtn dark pp-addbtn" type="button" data-pp-add="${i.id}">+ Price</button></td></tr>
      ${adding ? `<tr class="pp-form-row"><td colspan="5"><form class="pp-form" data-pp-form="${i.id}">
        <label>Place<input name="where" list="ppPlaces" maxlength="120" required value="${esc(priceBook.addWhere || "")}" placeholder="e.g. Costco Wholesale"></label>
        <label>Price per ${esc(i.unit)} ($)<input name="price" type="number" min="0" step="0.0001" required class="mono"></label>
        <label>Date<input name="date" type="date" value="${dayStr(new Date())}" required></label>
        <label>Kind<select name="source"><option value="quote">Quote or shelf price</option><option value="receipt">From a receipt</option><option value="invoice">From an invoice</option></select></label>
        <button class="applybtn" type="submit">Save price</button><button class="linkbtn" type="button" data-pp-cancel>Cancel</button>
        <span class="pp-sub">Tip: a case price? Divide by how many ${esc(i.unit)} are in the case.</span></form></td></tr>` : ""}`;
  };
  const top = list.filter((x) => x.q > 0), rest_ = list.filter((x) => !x.q);
  el.innerHTML = `
    <div class="chart-card">
      <div class="chart-head"><h3>Smartest Places to Buy</h3>
        <div class="pp-actions">${priceBook.points.length ? "" : `<button class="ghostbtn dark" id="ppSample" type="button">Fill sample prices (demo)</button>`}
          <button class="ghostbtn dark" id="ppEstimate" type="button" ${priceBook.estimating ? "disabled" : ""}>${priceBook.estimating ? "Looking up prices…" : "Estimate missing prices"}</button></div></div>
      ${priceBook.msg ? `<p class="pp-msg">${priceBook.msg}</p>` : ""}
      ${!plan.hasSales ? `<p>Enter a week on <strong>Weekly Sales</strong> first. The plan needs to know how much of each ingredient you use.</p>` : `
      <div class="pp-total"><div><span class="pp-big mono">${save > 0.5 ? fmt0(save) : "$0"}</span><span>could be saved each week${save > 0.5 ? ` (about ${fmt0(save * 52)} a year)` : ""}</span></div>
        <p>${anyReal ? "Based on your invoices and quotes, with estimates filling the gaps." : "Based on estimates so far. Scan invoices and receipts, or add a few prices, to make it sharper."}</p></div>
      <div class="scroll-x"><table class="pp-plan"><thead><tr><th>Food group</th><th>Buy at</th><th class="num">Now / week</th><th class="num">Plan / week</th><th class="num">Saves</th><th>How sure</th><th>Why</th></tr></thead><tbody>${planRows}</tbody></table></div>
      ${checks}
      <details class="pp-how"><summary>How this is figured</summary><p>For each food group: what you use a week (your recipes × last week's sales) × the price at each kind of place. Places you drive to add ${fmt(PLAN.milesCost)} a mile and ${fmt(PLAN.wage)} an hour of staff time for the round trip and ${PLAN.shopMinutes} minutes in the store, once a week, shared across everything bought there; a trip that costs more than it saves isn't suggested. Perishables bought at a warehouse club add ${Math.round(PLAN.spoil.wholesale * 100)}% for the bigger packs going bad (${Math.round(PLAN.spoil.distributor * 100)}% for distributor cases). Real prices (invoices, receipts, quotes) always win over estimates; a group needs prices for at least half of its spending before a place is compared.</p></details>`}
    </div>
    <div class="chart-card">
      <div class="chart-head"><h3>Price Book</h3><span class="note">Every price The Line has seen, newest first. Scanned invoices add theirs on their own.</span></div>
      <datalist id="ppPlaces">${nearbyNames.map((n) => `<option value="${esc(n)}">`).join("")}</datalist>
      <div class="scroll-x"><table class="pp-book"><thead><tr><th>Ingredient</th><th class="num">Used / week</th><th class="num">Paying now</th><th>Best price found</th><th></th></tr></thead>
        <tbody>${top.map(bookRow).join("")}</tbody></table></div>
      ${rest_.length ? `<details class="pp-more"><summary>${rest_.length} ingredients not in last week's sales</summary><div class="scroll-x"><table class="pp-book"><tbody>${rest_.map(bookRow).join("")}</tbody></table></div></details>` : ""}
    </div>`;
}
function ingredientCategoryName(name) { return PROC_CATS.find((c) => c.id === ingredientCategory(name)).name; }

async function addPricePoints(rows) {
  if (!rows.length) return;
  const saved = await run(sb.from("price_points").insert(rows).select("*"));
  priceBook.points = [...saved.map((p) => ({ ...p, unit_cost: Number(p.unit_cost), low_cost: p.low_cost == null ? null : Number(p.low_cost), high_cost: p.high_cost == null ? null : Number(p.high_cost) })), ...priceBook.points]
    .sort((a, b) => String(b.observed_on).localeCompare(String(a.observed_on)));
}

async function savePriceForm(form) {
  const ing = ingredients.get(form.dataset.ppForm), f = new FormData(form);
  const where = String(f.get("where") || "").trim(), price = Number(f.get("price"));
  if (!ing || !where || !Number.isFinite(price) || price < 0) { toast("Add the place and a price of 0 or more.", "err"); return; }
  const placed = (proc.sources || []).find((s) => s.name.toLowerCase() === where.toLowerCase());
  try {
    await addPricePoints([{ restaurant_id: rest.id, ingredient_id: ing.id, item_name: ing.name, supplier: where, supplier_type: placed ? placed.type : supplierType(where),
      unit: ing.unit, unit_cost: price, source: String(f.get("source")), observed_on: String(f.get("date")) || dayStr(new Date()) }]);
    priceBook.addFor = null; priceBook.addWhere = "";
    renderPricing();
    toast(`Saved: ${ing.name} at ${where}.`);
  } catch { /* toast shown */ }
}

// After a scanned invoice or receipt is added: remember what was paid where.
async function logInvoicePrices(draft, rows) {
  if (priceBook.ready === false) return;
  const supplier = String(draft.supplier || "").trim() || "Supplier on a scanned invoice";
  const type = supplierType(supplier);
  const out = [];
  for (const x of rows) {
    const ing = [...ingredients.values()].find((i) => i.name.toLowerCase() === String(x.name).trim().toLowerCase());
    if (!ing || !(Number(x.cost) >= 0)) continue;
    out.push({ restaurant_id: rest.id, ingredient_id: ing.id, item_name: ing.name, supplier, supplier_type: type, unit: ing.unit, unit_cost: Number(x.cost),
      source: type === "wholesale" || type === "local" ? "receipt" : "invoice", observed_on: draft.date || dayStr(new Date()) });
  }
  try { await addPricePoints(out); } catch { /* the ingredients still saved */ }
}

// Gemini looks up typical prices for the ingredients you spend the most on.
async function estimatePrices(auto = false) {
  if (priceBook.estimating || priceBook.ready !== true) return;
  const use = weeklyUse(), fresh = (p) => p.source === "estimate" && daysLeft(addDays(p.observed_on, PLAN.estimateDays)) >= 0;
  const need = [...ingredients.values()].filter((i) => (use.get(i.id) || 0) > 0 && !priceBook.points.some((p) => p.ingredient_id === i.id && fresh(p)))
    .sort((a, b) => use.get(b.id) * b.cost - use.get(a.id) * a.cost).slice(0, 25);
  if (!need.length) { if (!auto) { priceBook.msg = "Every ingredient you use already has a recent estimate."; renderPricing(); } return; }
  priceBook.estimating = true; priceBook.msg = `Looking up typical prices near ${esc(rest.city || "you")} for ${need.length} ingredients. This takes about 30 seconds…`; renderPricing();
  try {
    const { data } = await sb.auth.getSession();
    const r = await fetch("/api/specials", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session?.access_token || ""}` },
      body: JSON.stringify({ action: "prices", where: [rest.city, rest.state].filter(Boolean).join(", "), today: dayStr(new Date()), items: need.map((i) => ({ name: i.name, unit: i.unit, cost: i.cost })) }) });
    const out = await r.json().catch(() => ({}));
    if (r.status === 503 || r.status === 404) { priceBook.msg = "Price estimates use the Gemini helper, which isn't connected yet (see the README's Specials section)."; return; }
    if (!r.ok) { priceBook.msg = esc(out.error || "Couldn't look up prices. Try again."); return; }
    const names = { distributor: "Typical distributor", wholesale: "Typical wholesale club", local: "Typical farmers market" };
    const rows = [];
    for (const x of out.items || []) {
      const ing = need.find((i) => i.name.toLowerCase() === String(x.name).toLowerCase());
      if (!ing) continue;
      for (const k of ["distributor", "wholesale", "local"]) if (x[k]?.price > 0) rows.push({ restaurant_id: rest.id, ingredient_id: ing.id, item_name: ing.name, supplier: names[k], supplier_type: k,
        unit: ing.unit, unit_cost: x[k].price, low_cost: x[k].low, high_cost: x[k].high, source: "estimate", observed_on: dayStr(new Date()), note: [x.note, ...(out.sources || []).slice(0, 2).map((s) => s.uri)].filter(Boolean).join(" | ").slice(0, 500) });
    }
    await addPricePoints(rows);
    priceBook.msg = `Added ${rows.length} estimated prices for ${new Set(rows.map((r) => r.ingredient_id)).size} ingredients${out.sources?.length ? `, checked with Google Search (${out.sources.slice(0, 3).map((s) => `<a href="${esc(s.uri)}" target="_blank" rel="noopener">${esc(s.title || "source")}</a>`).join(", ")})` : ""}. Estimates are a starting point: real prices from invoices, receipts and quotes replace them.`;
  } catch { priceBook.msg = "Couldn't reach the price lookup. Check your internet and try again."; }
  finally { priceBook.estimating = false; renderPricing(); }
}

// Demo only: a believable price history for a sample restaurant.
async function fillSamplePrices() {
  const day = (n) => addDays(dayStr(new Date()), -n);
  const club = proc.sources?.find((s) => s.type === "wholesale")?.name || "Costco Wholesale";
  const fish = proc.sources?.find((s) => s.type === "local" && s.kind === "seafood")?.name || "Local seafood market";
  const market = proc.sources?.find((s) => s.type === "local" && s.kind === "market")?.name || "Farmers market";
  const rows = [];
  const add = (i, supplier, type, cost, source, ago) => rows.push({ restaurant_id: rest.id, ingredient_id: i.id, item_name: i.name, supplier, supplier_type: type, unit: i.unit,
    unit_cost: Math.round(cost * 10000) / 10000, source, observed_on: day(ago), note: "Sample price for the demo" });
  for (const i of ingredients.values()) add(i, "Sysco", "distributor", i.cost, "invoice", 9);
  const club_ = { wing: 0.82, chuck: 0.88, potato: 0.78, cheddar: 0.85, cream: 0.9, egg: 0.8, bacon: 0.9, lemon: 0.75 };
  const local_ = { tomato: 1.25, lettuce: 1.2, leek: 1.1, chive: 1.15 };
  for (const i of ingredients.values()) {
    const n = i.name.toLowerCase();
    for (const [w, f] of Object.entries(club_)) if (n.includes(w)) add(i, club, "wholesale", i.cost * f, "quote", 5);
    for (const [w, f] of Object.entries(local_)) if (n.includes(w)) add(i, market, "local", i.cost * f, "quote", 3);
    if (/\bcod\b/.test(n)) add(i, fish, "local", i.cost * 0.94, "quote", 4);
  }
  try { await addPricePoints(rows); priceBook.msg = `Added ${rows.length} sample prices: last week's Sysco invoice for everything, plus a few quotes from ${esc(club)}, ${esc(market)} and ${esc(fish)}.`; renderPricing(); } catch { /* toast shown */ }
}

// ---------------------------------------------------------- Tonight
// The home page: what needs the manager tonight ("On the pass") and how the
// week is going, as order tickets hanging from a gold rail. Uses real costs
// (what-if price changes are ignored here). Tickets marked Done stay done
// for the rest of the day in this browser.
function realCost(d) { return d.items.reduce((s, it) => s + (ingredients.get(it.ingredient_id)?.cost || 0) * it.qty, 0); }
const doneKey = () => `line.done.${rest?.id}.${dayStr(new Date())}`;
function doneToday() { try { return new Set(JSON.parse(safeGet(doneKey()) || "[]")); } catch { return new Set(); } }
function markDone(kind) { const s = doneToday(); s.add(kind); safeSet(doneKey(), JSON.stringify([...s])); }

let tonightTimers = [];
const tnFmt = (v, dec = 0, pre = "", suf = "") => pre + Number(v).toLocaleString("en-US", { minimumFractionDigits: dec, maximumFractionDigits: dec }) + suf;
const tnNum = (v, o = {}) => `<span class="n ${o.cls || ""}" data-to="${v}" data-dec="${o.dec || 0}" data-pre="${o.pre || ""}" data-suf="${o.suf || ""}">${tnFmt(v, o.dec || 0, o.pre, o.suf)}</span>`;
const tnLines = (rows) => `<ul class="t-lines">${rows.map(([a, b, c]) => `<li><span>${esc(a)}</span><b class="${c || ""}">${esc(b)}</b></li>`).join("")}</ul>`;
const plural = (n, one, many) => (n === 1 ? one : many);

function passTickets(t, week) {
  const out = [];
  const rows = dishes.map((d) => {
    const cost = realCost(d), pct = d.price ? (cost / d.price) * 100 : 0;
    const units = week ? (salesByWeek.get(week)?.get(d.id) || 0) : 0;
    return { d, cost, pct, st: statusOf(pct), units, margin: (d.price - cost) * units };
  });

  // 1. Dishes over target
  const flagged = rows.filter((r) => r.st !== "green").sort((a, b) => b.pct - a.pct);
  if (flagged.length) {
    const red = flagged.filter((r) => r.st === "red").length;
    out.push({ kind: "over", title: "Over target", goto: "cost", link: "Open Cost Tracker",
      body: `<div class="t-big">${red ? `${tnNum(red, { cls: "over" })} ${plural(red, "dish", "dishes")} in the red` : `${tnNum(flagged.length)} trending high`}</div>` +
        tnLines(flagged.slice(0, 3).map((r) => [r.d.name, fmtPct(r.pct), r.st === "red" ? "over" : "watch"])) +
        `<div class="t-sub">Your target is ${t.low}–${t.high}% food cost.</div>` });
  }

  // 2. Ingredients about to expire
  if (stockReady) {
    const soon = [...ingredients.values()]
      .filter((i) => i.use_by && daysLeft(i.use_by) <= 2 && (i.on_hand == null || i.on_hand > 0))
      .sort((a, b) => daysLeft(a.use_by) - daysLeft(b.use_by));
    if (soon.length) {
      const when = (n) => (n < 0 ? "expired" : n === 0 ? "today" : n === 1 ? "tmrw" : `${n} days`);
      out.push({ kind: "useby", title: "Use it or lose it", goto: "specials", link: "Make a specials menu",
        body: `<div class="t-big">${tnNum(soon.length)} ${plural(soon.length, "item expires", "items expire")} within 2 days</div>` +
          tnLines(soon.slice(0, 4).map((i) => { const n = daysLeft(i.use_by);
            return [i.name, (i.on_hand != null ? `${trimNum(i.on_hand)} ${i.unit} | ` : "") + when(n), n <= 0 ? "over" : "watch"]; })) });
    }
  }

  // 3. The biggest earner that's over target
  const byMargin = rows.filter((r) => r.units > 0).sort((a, b) => b.margin - a.margin);
  const top = byMargin.find((r) => r.st !== "green");
  if (top) {
    const rank = byMargin.indexOf(top) + 1;
    const fix = top.pct > t.high
      ? `It runs ${(top.pct - t.high).toFixed(1)} points over your ${t.high}% limit. At $${Math.ceil(top.cost / (t.high / 100))} instead of ${fmt(top.d.price)} it drops back under.`
      : `It sits ${(top.pct - t.low).toFixed(1)} points above your ${t.low}% comfort line.`;
    out.push({ kind: "earner", title: "Biggest earner, over target", goto: "perf", link: "Open Performance",
      body: `<div class="t-big">${tnNum(Math.round(top.margin), { pre: "$" })} margin</div>` +
        `<p class="t-body"><b>${esc(top.d.name)}</b> is #${rank} on the menu for weekly margin, from ${top.units} plates. ${fix}</p>` });
  }
  return out;
}

function weekTickets(t, week) {
  const out = [];
  // Sales
  if (week) {
    const weeks = sortedWeeks(), prev = weeks[weeks.indexOf(week) + 1];
    const m = salesByWeek.get(week);
    const revenue = salesForWeek(week).revenue, before = prev ? salesForWeek(prev).revenue : 0;
    let plates = 0, best = null;
    for (const d of dishes) { const u = m?.get(d.id) || 0; plates += u; if (u && (!best || u > best.u)) best = { d, u }; }
    const change = before ? ((revenue - before) / before) * 100 : null;
    out.push({ kind: "sales", title: "Sales", goto: "sales", link: "Open Weekly Sales",
      body: `<div class="t-big">${tnNum(Math.round(revenue), { pre: "$" })}</div>` +
        (change !== null ? `<div class="t-sub"><span class="${change >= 0 ? "up" : "down"}">${change >= 0 ? "▲" : "▼"} ${Math.abs(change).toFixed(1)}%</span> vs. last week (${fmt0(before)})</div>` : "") +
        tnLines([["Plates sold", plates.toLocaleString()], ...(best ? [["Top seller", best.d.name]] : [])]) });
  } else {
    out.push({ kind: "sales", title: "Sales", goto: "sales", link: "Enter this week's sales",
      body: `<p class="t-body">No sales entered yet. Add a week's plates sold to see revenue, margins and your best sellers here.</p>` });
  }
  // Food cost
  if (dishes.length) {
    const pcts = dishes.map((d) => (d.price ? (realCost(d) / d.price) * 100 : 0));
    const avg = pcts.reduce((a, b) => a + b, 0) / pcts.length;
    const red = pcts.filter((p) => statusOf(p) === "red").length, ok = pcts.filter((p) => statusOf(p) === "green").length;
    const lo = Math.min(t.low - 8, avg - 2), hi = Math.max(t.high + 10, avg + 2), at = (v) => ((v - lo) / (hi - lo)) * 100;
    out.push({ kind: "food", title: "Food cost", goto: "cost", link: "Open Cost Tracker",
      body: `<div class="t-big">${tnNum(avg, { dec: 1, suf: "%", cls: statusOf(avg) === "red" ? "over" : statusOf(avg) === "green" ? "good" : "" })} menu average</div>` +
        `<div class="t-gauge" role="img" aria-label="Average food cost ${fmtPct(avg)}, target ${t.low} to ${t.high} percent">
           <span class="zone" style="left:${at(t.low)}%;width:${at(t.high) - at(t.low)}%"></span><span class="mark" style="left:${at(avg)}%"></span>
           <span class="lbl" style="left:${at(t.low)}%">${t.low}%</span><span class="lbl" style="left:${at(t.high)}%">${t.high}%</span></div>` +
        tnLines([["Dishes in the red", `${red} of ${dishes.length}`, red ? "over" : ""], ["On target", `${ok} of ${dishes.length}`, "good"]]) });
  }
  // Labor
  if (LABOR_ON && extrasReady && week && laborByWeek.has(week)) {
    const lt = laborTotals(laborByWeek.get(week)), revenue = salesForWeek(week).revenue;
    out.push({ kind: "labor", title: "Labor", goto: "labor", link: "Open Labor Costs",
      body: `<div class="t-big">${revenue ? `${tnNum(lt.total / revenue * 100, { dec: 1, suf: "%" })} of sales` : tnNum(Math.round(lt.total), { pre: "$" })}</div>` +
        tnLines([["Labor cost", fmt0(lt.total)], ["Hours", String(Math.round(lt.hours))], ["Overtime", `${trimNum(lt.ot)} hrs`, lt.ot ? "watch" : ""]]) });
  }
  // Last MOD report
  const r = extrasReady && modReports[0];
  if (r) {
    const d = reportFrom(r).data, s = reportStats(d);
    const notes = String(d.followups || "").split(/(?<=[.!?])\s+|\n+/).map((x) => x.trim()).filter(Boolean).slice(0, 2);
    out.push({ kind: "mod", title: "Last MOD report", goto: "mod", link: "Open MOD Report",
      body: `<div class="t-big">${s.covers ? `${tnNum(s.covers)} covers` : esc(r.shift || "Report")}</div>` +
        tnLines([["Shift", `${fmtReportDay(r.report_date).replace(/, \d{4}$/, "")} | ${r.shift || ""}`],
          ...(r.manager ? [["Manager", r.manager]] : []), ...(d.weather ? [["Weather", d.weather + (d.temp ? `, ${d.temp}°` : "")]] : []),
          ...(s.comps ? [["Comps", fmt0(s.comps)]] : [])]) +
        (notes.length ? `<ol class="t-notes">${notes.map((x) => `<li>${esc(x)}</li>`).join("")}</ol>` : "") });
  }
  return out;
}

function tonightTicket(tk, i, no, time, canDone) {
  return `<article class="ticket" style="--i:${i}" data-kind="${tk.kind}">
      <div class="t-meta"><span>No. ${String(no).padStart(2, "0")}</span><span>${time}</span></div>
      <h4>${tk.title}</h4>
      ${tk.body}
      <div class="t-actions"><button class="t-link" type="button" data-goto="${tk.goto}">${tk.link}</button>${canDone ? `<button class="t-done" type="button">Done</button>` : ""}</div>
    </article>`;
}

const PASS_CLEAR = `<div class="t-clear"><em>The pass is clear.</em>Nothing needs you right now.</div>`;

function renderHome() {
  const el = $("tonight"), t = targets(), week = selectedWeek;
  const now = new Date(), time = now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const done = doneToday();
  const pass = passTickets(t, week).filter((tk) => !done.has(tk.kind));
  const wk = weekTickets(t, week);
  el.innerHTML = `
    <div class="tn-title">
      <h2>Tonight</h2>
      <div class="tn-when">${now.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })} | ${esc(rest.name)}</div>
    </div>
    <section>
      <div class="tn-head"><h3>On the pass</h3><span class="hint">Needs you tonight | tap a ticket, or mark it done</span></div>
      <div class="tn-scroller"><div class="tn-track" id="tnPass">${pass.length ? pass.map((tk, i) => tonightTicket(tk, i, i + 1, time, true)).join("") : PASS_CLEAR}</div></div>
    </section>
    <section>
      <div class="tn-head"><h3>This week</h3><span class="hint">${week ? fmtWeek(week) : "No sales entered yet"}</span></div>
      <div class="tn-scroller"><div class="tn-track">${wk.map((tk, i) => tonightTicket(tk, i + 1, pass.length + i + 1, time, false)).join("")}</div></div>
    </section>`;
  playTonight(el);
}

// Entrance: the rail draws, each ticket slides in along it, swings on its clip
// and settles; its numbers count up as it lands.
function playTonight(el) {
  tonightTimers.forEach(clearTimeout); tonightTimers = [];
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  el.classList.remove("play", "entering"); void el.offsetWidth; el.classList.add("play", "entering");
  el.querySelectorAll(".ticket").forEach((tk) => {
    const i = Number(tk.style.getPropertyValue("--i"));
    tk.querySelectorAll(".n").forEach((n) => { n.textContent = tnFmt(0, Number(n.dataset.dec), n.dataset.pre, n.dataset.suf); });
    tonightTimers.push(setTimeout(() => tonightCount(tk), 550 + i * 140 + 580));
  });
  const last = el.querySelectorAll(".ticket").length;
  tonightTimers.push(setTimeout(() => {
    el.classList.remove("entering");
    el.querySelectorAll(".tn-scroller").forEach((s) => { s.scrollLeft = 0; });
  }, 550 + last * 140 + 1150));
}

function tonightCount(tk) {
  tk.querySelectorAll(".n").forEach((n) => {
    const to = Number(n.dataset.to), dec = Number(n.dataset.dec), pre = n.dataset.pre, suf = n.dataset.suf;
    const t0 = performance.now(), dur = 700;
    const step = (now) => {
      if (!n.isConnected) return;
      const k = Math.min(1, (now - t0) / dur);
      n.textContent = tnFmt(to * (1 - Math.pow(1 - k, 3)), dec, pre, suf);
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
    tonightTimers.push(setTimeout(() => { n.textContent = tnFmt(to, dec, pre, suf); }, dur + 120));
  });
}

function onTonightClick(e) {
  const tk = e.target.closest(".ticket");
  if (!tk || e.target.closest(".t-link")) return;          // links are handled by the data-goto listener
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (e.target.closest(".t-done")) {                          // Done: drop it off the rail, close the gap
    markDone(tk.dataset.kind);
    const track = tk.parentElement;
    const finish = () => {
      if (!tk.isConnected) return;
      const sibs = [...track.querySelectorAll(".ticket")].filter((x) => x !== tk);
      const before = new Map(sibs.map((s) => [s, s.getBoundingClientRect().left]));
      tk.remove();
      if (!reduce) sibs.forEach((s) => {
        const dx = before.get(s) - s.getBoundingClientRect().left;
        if (dx) s.animate([{ transform: `translateX(${dx}px)` }, { transform: "translateX(0)" }], { duration: 380, easing: "cubic-bezier(.2,.8,.2,1)" });
      });
      if (!track.querySelector(".ticket")) track.innerHTML = PASS_CLEAR;
    };
    if (reduce) { finish(); return; }
    tk.classList.add("spiked");
    setTimeout(finish, 620);
    return;
  }
  if (reduce) return;                                         // tap a ticket: it swings on its clip
  tk.classList.remove("swing"); void tk.offsetWidth; tk.classList.add("swing");
  setTimeout(() => tk.classList.remove("swing"), 1000);
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
  $("salesTotal").textContent = `${plates} plates | ${fmt0(rev)} revenue`;
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
  // 86'd list (0 on hand) and the dishes it stops
  const out86 = stockReady ? eightySixNow() : [];
  $("card86").classList.toggle("hidden", !out86.length);
  $("list86").innerHTML = out86.length ? `<ul class="list86">${out86.map((x) => {
    const ing = [...ingredients.values()].find((i) => i.name === x.name);
    return `<li><strong>${esc(x.name)}</strong>${x.dishes.length ? `<span>Stops: ${x.dishes.map(esc).join(", ")}</span>` : ""}<button class="linkbtn" data-86="${ing?.id}" type="button">Back in stock</button></li>`; }).join("")}</ul>` : "";
  if (!ingredients.size) { $("ingTable").innerHTML = `<tbody><tr><td class="muted">No ingredients yet. Add one above.</td></tr></tbody>`; return; }
  const cols = stockReady ? 8 : 5;
  $("ingTable").innerHTML = `
    <thead><tr>${stockReady ? `<th class="c86">86</th>` : ""}<th>Ingredient</th><th>Unit</th><th class="num">Cost per unit ($)</th>${stockReady ? `<th class="num">On hand</th><th>Use by</th>` : ""}<th>Used in</th><th></th></tr></thead>
    <tbody>${list.map((i) => {
      const used = usage.get(i.id) || [];
      const out = i.on_hand !== null && Number(i.on_hand) === 0;
      return `<tr data-row="${i.id}" class="${out ? "is86" : ""}">
        ${stockReady ? `<td class="c86"><button class="btn86 ${out ? "on" : ""}" data-86="${i.id}" type="button" aria-pressed="${out}" title="${out ? "Back in stock" : "Out of it: 86 it"}">${out ? "86'd" : "86"}</button></td>` : ""}
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

// 86 = out of it: on hand goes to 0, and the MOD Report lists it. Back in
// stock clears the amount so the next count can be typed in.
async function toggle86(id) {
  const ing = ingredients.get(id);
  if (!ing) return;
  const out = ing.on_hand !== null && Number(ing.on_hand) === 0;
  try {
    const row = await run(sb.from("ingredients").update({ on_hand: out ? null : 0, updated_at: new Date().toISOString() }).eq("id", id).select(ingCols()).single());
    ingredients.set(id, ingRow(row));
    renderIngredients();
    if (out) { toast(`${row.name} is back. Type in how much you have.`); document.querySelector(`[data-id="${id}"][data-field="on_hand"]`)?.focus(); }
    else toast(`${row.name} is 86'd. It's on tonight's MOD Report.`);
  } catch { /* toast shown */ }
}

// ---------------------------------------------------------- Invoice scanning
// A photo of a supplier invoice → Gemini reads the lines → the owner checks
// and edits them → matched ingredients get the new cost, more on hand and a
// new use-by date; new ones are added.
let invoiceDraft = null;   // { supplier, date, rows: [{ use, name, unit, qty, cost, useBy, low }] }

function shrinkImage(file, max = 1800) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file), img = new Image();
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL("image/jpeg", 0.85).split(",")[1]);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("bad image")); };
    img.src = url;
  });
}
const fileB64 = (file) => new Promise((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(String(r.result).split(",")[1]); r.onerror = reject; r.readAsDataURL(file); });

async function scanInvoice(file) {
  if (!file) return;
  const pdf = file.type === "application/pdf";
  if (!pdf && !/^image\//.test(file.type)) { toast("Pick a photo or a PDF of the invoice.", "err"); return; }
  if (pdf && file.size > 3 * 1024 * 1024) { toast("That PDF is too big. Try a photo of the page instead.", "err"); return; }
  const note = $("invoiceNote");
  note.textContent = "Gemini is reading the invoice. This takes 10 to 20 seconds…";
  $("invoiceBtn").classList.add("disabled"); $("invoiceBlade").classList.remove("hidden");
  try {
    const data = pdf ? await fileB64(file) : await shrinkImage(file);
    const { data: sess } = await sb.auth.getSession();
    const r = await fetch("/api/specials", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${sess.session?.access_token || ""}` },
      body: JSON.stringify({ action: "invoice", mime: pdf ? "application/pdf" : "image/jpeg", data, today: dayStr(new Date()),
        ingredients: [...ingredients.values()].map((i) => ({ name: i.name, unit: i.unit, cost: i.cost })) }),
    });
    const out = await r.json().catch(() => ({}));
    if (r.status === 503 || r.status === 404) { note.textContent = ""; toast("The Gemini helper isn't connected yet. See the README's Specials section.", "err"); return; }
    if (!r.ok) { note.textContent = ""; toast(out.error || "Couldn't read that invoice. Try again.", "err"); return; }
    const inv = out.invoice, base = /^\d{4}-\d{2}-\d{2}$/.test(inv.invoice_date || "") ? inv.invoice_date : dayStr(new Date());
    invoiceDraft = { supplier: inv.supplier || "", date: base, rows: inv.items.map((x) => {
      const match = findIngredient(x.existing || "") && x.existing ? findIngredient(x.existing) : [...ingredients.values()].find((i) => i.name.toLowerCase() === String(x.name).toLowerCase());
      const days = Number(x.shelf_life_days);
      const qty = Number(x.quantity) || 0, total = Number(x.line_total) || 0;
      return { use: true, name: match ? match.name : String(x.name || "").trim(), unit: match ? match.unit : String(x.unit || "each"),
        qty, total: total || Math.round((Number(x.unit_cost) || 0) * qty * 100) / 100,
        cost: qty && total ? Math.round((total / qty) * 10000) / 10000 : Math.round((Number(x.unit_cost) || 0) * 10000) / 10000,
        math: x.math || "", pack: x.pack || "",
        useBy: Number.isFinite(days) && days > 0 ? addDays(base, Math.round(days)) : "", low: x.confidence === "low" || x.checked === false };
    }) };
    note.textContent = "";
    renderInvoice();
  } catch { note.textContent = ""; toast("Couldn't read that file. Try another photo.", "err"); }
  finally { $("invoiceBtn").classList.remove("disabled"); $("invoiceBlade").classList.add("hidden"); $("invoiceFile").value = ""; }
}

// How a matched line's price compares with what the ingredient costs now:
// a red ▲ when it went up, a green ▼ when it went down, with the old price.
function invoicePriceChange(old, cost) {
  const now = Number(cost);
  if (old === null || !Number.isFinite(now) || Math.abs(old - now) <= 0.004) return old === null ? "" : `<span class="inv-same">Same price</span>`;
  const pct = old > 0 ? ((now - old) / old) * 100 : 100, up = now > old;
  return `<span class="inv-chg ${up ? "up" : "down"}" title="${up ? "Price went up" : "Price went down"}">${up ? "▲" : "▼"} ${Math.abs(pct).toFixed(1)}%</span><span class="inv-was">was ${fmt(old)}</span>`;
}
const invoiceKnown = (n) => [...ingredients.values()].find((i) => i.name.toLowerCase() === String(n).trim().toLowerCase());

function renderInvoice() {
  const el = $("invoiceResult");
  if (!invoiceDraft) { el.innerHTML = ""; return; }
  const v = invoiceDraft;
  const used = v.rows.filter((x) => x.use);
  const known = invoiceKnown;
  const moves = v.rows.map((x) => { const k = known(x.name); return k ? Number(x.cost) - k.cost : 0; });
  const ups = moves.filter((d) => d > 0.004).length, downs = moves.filter((d) => d < -0.004).length;
  const tally = ups || downs ? ` <span class="inv-tally">${ups ? `<span class="inv-chg up">▲ ${ups} up</span>` : ""}${downs ? `<span class="inv-chg down">▼ ${downs} down</span>` : ""}</span>` : "";
  el.innerHTML = `
    <div class="inv-head"><strong>${esc(v.supplier || "Invoice")}</strong> | ${fmtDay(v.date)} | ${v.rows.length} line${v.rows.length === 1 ? "" : "s"} read.${tally} Check them, change anything, then add.</div>
    <datalist id="ingNames">${[...ingredients.values()].map((i) => `<option value="${esc(i.name)}">`).join("")}</datalist>
    <div class="scroll-x"><table class="edit inv-table">
      <thead><tr><th></th><th>Ingredient</th><th></th><th>Unit</th><th class="num">Received</th><th class="num">Line total ($)</th><th class="num">Cost per unit ($)</th>${stockReady ? "<th>Use by</th>" : ""}</tr></thead>
      <tbody>${v.rows.map((x, i) => { const k = known(x.name), old = k ? k.cost : null;
        return `<tr class="${x.use ? "" : "skip"} ${x.low ? "low" : ""}">
        <td><input type="checkbox" data-inv="${i}" data-k="use" ${x.use ? "checked" : ""} aria-label="Include this line"></td>
        <td><input data-inv="${i}" data-k="name" value="${esc(x.name)}" list="ingNames" maxlength="100" aria-label="Ingredient">${x.math ? `<div class="inv-math">${esc(x.pack ? `${x.pack}: ` : "")}${esc(x.math)}</div>` : ""}</td>
        <td class="inv-tag">${k ? `<span class="tag-upd">Updates yours</span><span data-chg="${i}">${invoicePriceChange(old, x.cost)}</span>` : `<span class="tag-new">New</span>`}${x.low ? `<span class="inv-low">Check this line</span>` : ""}</td>
        <td style="width:90px"><input data-inv="${i}" data-k="unit" value="${esc(x.unit)}" list="unitList" maxlength="20" aria-label="Unit"></td>
        <td class="num" style="width:110px"><input class="num mono" type="number" min="0" step="0.5" data-inv="${i}" data-k="qty" value="${trimNum(x.qty)}" aria-label="Received"></td>
        <td class="num" style="width:120px"><input class="num mono" type="number" min="0" step="0.01" data-inv="${i}" data-k="total" value="${trimNum(x.total)}" aria-label="Line total"></td>
        <td class="num" style="width:130px"><input class="num mono" type="number" min="0" step="0.0001" data-inv="${i}" data-k="cost" value="${trimNum(x.cost)}" aria-label="Cost per unit"></td>
        ${stockReady ? `<td style="width:170px"><input type="date" data-inv="${i}" data-k="useBy" value="${esc(x.useBy)}" aria-label="Use by"></td>` : ""}
      </tr>`; }).join("")}</tbody>
    </table></div>
    <div class="row-actions">
      <button class="applybtn" id="invoiceSave" type="button" ${used.length ? "" : "disabled"}>Add ${used.length} to my ingredients</button>
      <button class="ghostbtn dark" id="invoiceCancel" type="button">Cancel</button>
      <span class="note">Matched items get the new cost${stockReady ? ", the delivered amount added to on hand, and the new use-by date" : ""}. Recipe costs update right away.</span>
    </div>`;
}

async function saveInvoice() {
  const rows = invoiceDraft.rows.filter((x) => x.use && String(x.name).trim());
  if (rows.some((x) => !Number.isFinite(Number(x.cost)) || Number(x.cost) < 0 || !String(x.unit).trim())) { toast("Every line needs a unit and a cost of 0 or more.", "err"); return; }
  const btn = $("invoiceSave"); btn.disabled = true;
  let updated = 0, added = 0;
  try {
    for (const x of rows) {
      const k = [...ingredients.values()].find((i) => i.name.toLowerCase() === String(x.name).trim().toLowerCase());
      const qty = Number(x.qty) || 0;
      const change = { cost: Number(x.cost), updated_at: new Date().toISOString() };
      if (stockReady) { change.on_hand = (k && k.on_hand ? Number(k.on_hand) : 0) + qty; if (x.useBy) change.use_by = x.useBy; }
      if (k) { await run(sb.from("ingredients").update(change).eq("id", k.id)); updated++; }
      else { delete change.updated_at; await run(sb.from("ingredients").insert({ restaurant_id: rest.id, name: String(x.name).trim(), unit: String(x.unit).trim(), ...change })); added++; }
    }
    await loadRestaurantData();
    const draft = invoiceDraft;
    invoiceDraft = null;
    await loadPriceBook();
    await logInvoicePrices(draft, rows);       // remember what was paid where, for Procurement
    render();
    toast(`From the invoice: ${updated} updated, ${added} added.`);
  } catch { btn.disabled = false; }
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
        <span class="info"><span class="name">${esc(d.name)}</span></span>
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
    ? `${trimNum(L.hours)} hours | ${fmt0(L.wages)} wages + ${laborBurden()}% taxes & benefits = ${fmt0(L.total)}` + (revenue ? ` | ${fmtPct((L.total / revenue) * 100)} of sales` : "")
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
  modEditing = new Set();
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
    <div class="metric ${sum("guest") ? "warn" : ""}"><div class="num mono">${sum("guest")}</div><div class="label">Guest issues, last 7 days${inj ? ` | ${inj} injur${inj === 1 ? "y" : "ies"}` : ""}</div></div>`;
}

function renderReportList() {
  const draftRow = editingReportId === "new"
    ? `<button type="button" class="dish-row selected"><span class="info"><span class="name">${fmtReportDay(modDraft.report_date || dayStr(new Date()))} | ${esc(modDraft.shift)}</span><span class="cat">New report, not saved yet</span></span></button>`
    : "";
  $("reportList").innerHTML = draftRow + (modReports.map((r) => {
    const st = reportStats(reportFrom(r).data);
    const issues = st.emp + st.guest;
    const dot = st.injuries ? "red" : issues ? "amber" : "green";
    const bits = [r.manager, st.covers ? `${st.covers} covers` : "", st.sales ? fmt0(st.sales) : "", issues ? `${issues} issue${issues === 1 ? "" : "s"}` : "no issues"].filter(Boolean);
    return `<button type="button" class="dish-row ${r.id === editingReportId ? "selected" : ""}" data-report="${r.id}">
        <span class="dot ${dot}"></span>
        <span class="info"><span class="name">${fmtReportDay(r.report_date)} | ${esc(r.shift)}</span><span class="cat">${esc(bits.join(" | "))}</span></span>
      </button>`;
  }).join("") || (draftRow ? "" : `<div class="rail-empty">No reports yet.</div>`));
}

// ---- The schedule, as if synced from a scheduling app. It's made from the
// team list (same people, roles and usual hours each time for a date and
// shift), then saved with the report. Times are "HH:MM", 24-hour.
function seededRandom(text) {
  let h = 2166136261;
  for (const ch of text) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  return () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return ((h >>> 0) % 10000) / 10000; };
}
const toMin = (t) => { const [h, m] = String(t || "").split(":").map(Number); return Number.isFinite(h) ? h * 60 + (m || 0) : null; };
const toHHMM = (m) => { m = ((Math.round(m / 1) % 1440) + 1440) % 1440; return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`; };
function fmtClock(t) {
  const m = toMin(t); if (m === null) return "—";
  const h = Math.floor(m / 60) % 24, mm = String(m % 60).padStart(2, "0");
  return `${h % 12 || 12}:${mm} ${h < 12 ? "AM" : "PM"}`;
}
function shiftHours(a, b) { const x = toMin(a), y = toMin(b); if (x === null || y === null) return 0; return ((y - x + 1440) % 1440) / 60; }
function scheduleFor(date, shift, manager = "") {
  const rnd = seededRandom(`${rest?.id}|${date}|${shift}`);
  const lunch = /lunch|breakfast|brunch/i.test(shift);
  const [from, to] = SHIFT_HOURS[shift] || [11, 22];
  const base = (role, dept) => {
    // [start, end] in minutes, by role, around the shift's hours
    const r = String(role).toLowerCase();
    const s0 = from * 60, e0 = (to + 1) * 60;
    if (dept === "Mgmt") return [s0 - 60, e0 + 30];
    if (/chef|line/.test(r)) return [s0 - 90, e0 + 15];
    if (/prep|dish/.test(r)) return [s0 - (lunch ? 120 : 60), e0 + 30];
    if (/bar/.test(r)) return [s0 - 30, e0 + 60];
    if (/host|bus/.test(r)) return [s0, e0 - 30];
    return [s0 - 30, e0 - 15];   // servers and everyone else
  };
  let team = staff.filter((p) => p.active !== false);
  if (!team.length) return [];
  // Lunch runs lighter: one manager, and a server or host may be off.
  if (lunch) {
    const mgmt = team.filter((p) => p.department === "Mgmt");
    const mod = mgmt.find((p) => manager && p.name.toLowerCase() === manager.trim().toLowerCase()) || mgmt[mgmt.length - 1];
    team = team.filter((p) => p.department !== "Mgmt" || p === mod);
    team = team.filter((p) => !(/host|bus/i.test(p.role) && rnd() < 0.6));
  }
  return team.map((p) => {
    const [a, b] = base(p.role, p.department);
    const late = rnd() < 0.12 ? 8 + Math.round(rnd() * 12) : Math.round(rnd() * 9) - 6;
    return { name: p.name, role: p.role || "", dept: p.department || "", sched_in: toHHMM(a), sched_out: toHHMM(b),
      in: toHHMM(a + late), out: toHHMM(b + Math.round(rnd() * 25) - 10) };
  });
}
function ensureSchedule(r) {
  const d = r.data;
  if (Array.isArray(d.shifts) && d.shifts.length) return;
  d.shifts = scheduleFor(r.report_date || dayStr(new Date()), r.shift, r.manager);
  d.shifts_synced = new Date().toISOString();
  d.shifts_edited = false;
}

// ---- 86'd: anything on the Ingredients tab with 0 on hand, and the dishes it stops.
function eightySixNow() {
  return [...ingredients.values()].filter((i) => i.on_hand !== null && Number(i.on_hand) === 0).sort((a, b) => a.name.localeCompare(b.name))
    .map((i) => ({ name: i.name, dishes: dishes.filter((d) => d.items.some((it) => it.ingredient_id === i.id)).map((d) => d.name) }));
}
// Today's (or a new) report shows the live list; older reports show what was 86'd when they were saved.
function eightySixFor(r) {
  const live = !r.id || r.report_date === dayStr(new Date());
  return live || !Array.isArray(r.data.eighty_six_items) ? eightySixNow() : r.data.eighty_six_items;
}

function renderModEditor() {
  const el = $("modEditor");
  el.className = "panel mod";
  const r = modDraft, d = r.data;
  ensureSchedule(r);
  const ed = (k) => modEditing.has(k);
  const opts = (list, v, blank) => (blank ? `<option value="">${blank}</option>` : "") +
    list.map((x) => `<option ${x === v ? "selected" : ""}>${esc(x)}</option>`).join("");
  const hourOpts = (from, to, v) => { let o = ""; for (let h = from; h <= to; h++) o += `<option value="${h}" ${h === v ? "selected" : ""}>${fmtHour(h)}</option>`; return o; };
  const input = (label, path, val, attrs = "") => `<label>${label}<input data-f="${path}" value="${esc(val)}" ${attrs}></label>`;
  const area = (label, path, val, ph) => `<label class="wide">${label}<span class="voice-field"><textarea data-f="${path}" rows="3" placeholder="${esc(ph)}">${esc(val)}</textarea>${micBtn()}</span></label>`;
  const para = (v) => (String(v ?? "").trim() ? `<p class="ms-text">${esc(v).replace(/\n/g, "<br>")}</p>` : `<p class="ms-empty">Nothing written.</p>`);
  const field = (label, v) => `<div class="ms-field"><div class="ms-lbl">${label}</div>${para(v)}</div>`;
  // Each issue / comp is a small card: short fields side by side, long ones full width.
  const rowsTable = (list, cols, addLabel, empty) => {
    const cards = d[list].map((row, i) => `<div class="row-card">
        <button class="iconbtn" data-del-row="${list}:${i}" type="button" aria-label="Remove this line">✕</button>
        <div class="form-grid">${cols.map((c) => `<label${c.wide ? ` class="wide"` : ""}>${c.label}${c.options
          ? `<select data-row="${list}" data-i="${i}" data-k="${c.k}">${opts(c.options, row[c.k], c.blank)}</select>`
          : c.money ? `<input data-row="${list}" data-i="${i}" data-k="${c.k}" value="${esc(row[c.k])}" type="number" step="0.01" min="0" class="mono">`
          : `<span class="voice-field"><input data-row="${list}" data-i="${i}" data-k="${c.k}" value="${esc(row[c.k])}" placeholder="${esc(c.ph || "")}" maxlength="300">${micBtn()}</span>`}</label>`).join("")}
        </div></div>`).join("");
    return (cards || `<p class="ms-empty">${empty}</p>`) + `<button class="ghostbtn dark" data-add="${list}" type="button">${addLabel}</button>`;
  };
  // Read-only list of issues / comps
  const rowsView = (list, line, empty) => d[list].length
    ? `<div class="ms-rows">${d[list].map((row) => `<div class="ms-row">${line(row)}</div>`).join("")}</div>` : `<p class="ms-empty">${empty}</p>`;
  // One collapsible section with its own Edit button.
  const sec = (key, title, badge, view, edit, canEdit = true) => `
    <details class="mod-sec${ed(key) ? " editing" : ""}" data-sec="${key}" ${modOpen.has(key) || ed(key) ? "open" : ""}>
      <summary><span class="ms-title">${title}</span><span class="ms-badge" data-badge="${key}">${badge}</span>
        ${canEdit ? `<button type="button" class="ms-edit ${ed(key) ? "applybtn" : "ghostbtn dark"}" data-edit-sec="${key}">${ed(key) ? "Done" : "Edit"}</button>` : ""}
        <span class="ms-chev" aria-hidden="true"></span></summary>
      <div class="ms-body">${ed(key) ? edit : view}</div>
    </details>`;

  const hours = [];
  for (let h = d.hours_from; h <= d.hours_to; h++) hours.push(h);
  const s = reportStats(d);
  // Same shift one week earlier, for comparison, and tomorrow's reference.
  const lastWeek = modReports.find((x) => x.report_date === addDays(r.report_date || dayStr(new Date()), -7) && x.shift === r.shift && x.id !== r.id);
  const lw = lastWeek ? reportStats(reportFrom(lastWeek).data) : null;
  const ref = modReports.find((x) => x.report_date === addDays(r.report_date || dayStr(new Date()), -6) && x.shift === r.shift);
  const refStats = ref ? reportStats(reportFrom(ref).data) : null;
  const tomorrow = r.report_date ? parseDay(addDays(r.report_date, 1)).toLocaleDateString(undefined, { weekday: "long" }) : "tomorrow";
  const lwDay = r.report_date ? parseDay(addDays(r.report_date, -7)).toLocaleDateString(undefined, { weekday: "short" }) : "";

  // Staffing numbers
  const sh = d.shifts || [];
  const schedHrs = sh.reduce((t, x) => t + shiftHours(x.sched_in, x.sched_out), 0);
  const workHrs = sh.reduce((t, x) => t + shiftHours(x.in, x.out), 0);
  const lateBy = (x) => { const a = toMin(x.sched_in), b = toMin(x.in); if (a === null || b === null) return 0; const m = ((b - a + 720 + 1440) % 1440) - 720; return m > 5 ? m : 0; };
  const late = sh.filter((x) => lateBy(x));
  const synced = d.shifts_synced ? new Date(d.shifts_synced).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "";
  const staffView = `
    <div class="sync-line"><span class="sync-dot" aria-hidden="true"></span>Synced from your scheduling app${synced ? ` at ${synced}` : ""}${d.shifts_edited ? " | edited by a manager" : ""}</div>
    <div class="scroll-x"><table class="sched">
      <thead><tr><th>Name</th><th>Role</th><th>Scheduled</th><th>Clocked in</th><th>Clocked out</th><th class="num">Hours</th></tr></thead>
      <tbody>${sh.map((x) => `<tr><td><strong>${esc(x.name)}</strong></td><td>${esc(x.role)}</td>
        <td>${fmtClock(x.sched_in)} – ${fmtClock(x.sched_out)}</td>
        <td>${fmtClock(x.in)}${lateBy(x) ? ` <span class="late">Late ${lateBy(x)} min</span>` : ""}</td><td>${fmtClock(x.out)}</td>
        <td class="num mono">${shiftHours(x.in, x.out).toFixed(2)}</td></tr>`).join("") || `<tr><td colspan="6">No one on the schedule. Add your team in The Line first.</td></tr>`}</tbody>
      <tfoot><tr><td colspan="5">Total (scheduled ${schedHrs.toFixed(1)} hrs)</td><td class="num mono">${workHrs.toFixed(2)}</td></tr></tfoot>
    </table></div>`;
  const staffEdit = `
    <div class="sync-line"><span class="sync-dot" aria-hidden="true"></span>Fix a missed punch here. Changes are kept with this report.</div>
    <div class="scroll-x"><table class="sched">
      <thead><tr><th>Name</th><th>Role</th><th>Scheduled</th><th>Clocked in</th><th>Clocked out</th><th class="num">Hours</th></tr></thead>
      <tbody>${sh.map((x, i) => `<tr><td><strong>${esc(x.name)}</strong></td><td>${esc(x.role)}</td>
        <td>${fmtClock(x.sched_in)} – ${fmtClock(x.sched_out)}</td>
        <td><input type="time" data-shift="${i}" data-k="in" value="${esc(x.in)}" aria-label="${esc(x.name)} clocked in"></td>
        <td><input type="time" data-shift="${i}" data-k="out" value="${esc(x.out)}" aria-label="${esc(x.name)} clocked out"></td>
        <td class="num mono" data-shift-hrs="${i}">${shiftHours(x.in, x.out).toFixed(2)}</td></tr>`).join("")}</tbody>
    </table></div>`;

  // Covers & sales
  const maxC = Math.max(1, ...hours.map((h) => Number(d.hourly[h]) || 0));
  const salesView = `
    <table class="hours view">
      <tbody>${hours.map((h) => { const c = Number(d.hourly[h]) || 0; return `<tr class="${s.peak && c === s.peak.covers ? "peak" : ""}"><td>${fmtHour(h)}–${fmtHour(h + 1)}</td>
        <td class="num mono">${d.hourly[h] ?? "—"}</td><td class="barcell"><span class="hbar" style="width:${(c / maxC) * 100}%"></span></td></tr>`; }).join("")}</tbody>
      <tfoot><tr><td>Total</td><td class="num mono">${s.covers}</td><td class="note">${s.peak ? `Peak: ${fmtHour(s.peak.h)} (${s.peak.covers})` + (s.rush ? ` | busiest 2 hours: ${fmtHour(s.rush.h)}–${fmtHour(s.rush.h + 2)} (${s.rush.covers})` : "") : ""}</td></tr></tfoot>
    </table>`;
  const salesEdit = `
    <div class="toolbar">
      <label class="stack">Net sales ($)<input data-f="data.sales" value="${esc(d.sales)}" type="number" min="0" step="0.01" placeholder="From the POS" class="mono"></label>
      <label class="stack">First hour<select data-f="data.hours_from">${hourOpts(5, 23, d.hours_from)}</select></label>
      <label class="stack">Last hour<select data-f="data.hours_to">${hourOpts(d.hours_from, 27, d.hours_to)}</select></label>
    </div>
    <table class="hours">
      <thead><tr><th>Hour</th><th class="num">Covers</th><th></th></tr></thead>
      <tbody>${hours.map((h) => `<tr data-hrow="${h}"><td>${fmtHour(h)}–${fmtHour(h + 1)}</td>
        <td class="num"><input type="number" min="0" step="1" inputmode="numeric" class="num mono" data-hour="${h}" value="${esc(d.hourly[h] ?? "")}" placeholder="—" aria-label="Covers ${fmtHour(h)}"></td>
        <td class="barcell"><span class="hbar" data-bar="${h}"></span></td></tr>`).join("")}</tbody>
      <tfoot><tr><td>Total</td><td class="num mono" id="coverTotal"></td><td class="note" id="peakNote"></td></tr></tfoot>
    </table>`;

  const e86 = eightySixFor(r);
  const live86 = !r.id || r.report_date === dayStr(new Date());
  const list86 = e86.length
    ? `<ul class="list86">${e86.map((x) => `<li><strong>${esc(x.name)}</strong>${x.dishes.length ? `<span>Stops: ${x.dishes.map(esc).join(", ")}</span>` : ""}</li>`).join("")}</ul>`
    : `<p class="ms-empty">Nothing is 86'd.</p>`;
  const from86 = `<div class="sync-line"><span class="sync-dot" aria-hidden="true"></span>${live86 ? "Live from the Ingredients tab" : "As it was when this report was saved"} | <button type="button" class="linkbtn" data-goto="ingredients">Manage 86'd items</button></div>`;

  const byDept = DEPTS.map((dep) => [dep, d.employee.filter((x) => x.dept === dep).length]).filter(([, n]) => n);
  const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;

  el.innerHTML = `
    <div class="panel-head">
      <div><h2>${esc(rest.name)}: MOD Report</h2><div class="cat">${r.id ? "Saved report. Changes are kept when you click \"Save report\"." : "New report. Nothing is saved until you click \"Save report\"."}</div></div>
    </div>
    <div class="form-grid mod-top">
      ${input("Date", "report_date", r.report_date, `type="date" required`)}
      <label>Shift<select data-f="shift">${opts(SHIFTS, r.shift)}</select></label>
      ${input("Manager on duty", "manager", r.manager, `maxlength="100" placeholder="Your name" id="modManager"`)}
    </div>
    ${posEnabled
      ? `<div class="pos-bar"><button class="applybtn" id="pullPosBtn" type="button">Pull again from the POS</button><span class="note"><span id="posNote">${esc(modPosNote || "Covers by hour, net sales, comps, voids and discounts fill in on their own from the POS for this date and these hours.")}</span> You can still edit anything before you save.</span></div>`
      : `<div class="pos-bar off"><span class="note"><strong>Tired of typing these numbers?</strong> The Line POS add-on fills this report from your register in one tap.</span></div>`}

    <div class="mod-hero">
      <div class="hero-card"><div class="hero-lbl">Covers</div><div class="hero-num mono" id="heroCovers">${s.covers}</div>
        <div class="hero-sub" id="heroCoversSub"></div></div>
      <div class="hero-card"><div class="hero-lbl">Net Sales</div><div class="hero-num mono" id="heroSales">${s.sales ? fmt0(s.sales) : "—"}</div>
        <div class="hero-sub" id="heroSalesSub"></div></div>
    </div>
    <div class="preview" id="modSummary"></div>

    <div class="mod-secs">
    ${sec("sales", "Covers &amp; Sales", `${plural(s.covers, "cover")} | ${s.sales ? fmt0(s.sales) : "no sales yet"}`, salesView, salesEdit)}
    ${sec("staff", "Staffing", `${sh.length} on | ${workHrs.toFixed(1)} hrs${late.length ? ` | ${late.length} late` : ""}`, staffView, staffEdit)}
    ${sec("employee", "Employee Issues", d.employee.length ? plural(d.employee.length, "issue") + (byDept.length ? " | " + byDept.map(([dep, n]) => `${dep} ${n}`).join(", ") : "") : "None",
      rowsView("employee", (x) => `<div class="ms-row-head"><strong>${esc(x.type || "Issue")}</strong> | ${esc(x.dept)}${x.name ? ` | ${esc(x.name)}` : ""}</div>${x.notes ? `<div>${esc(x.notes)}</div>` : ""}${x.action ? `<div class="ms-sub">Action: ${esc(x.action)}</div>` : ""}`, "No employee issues this shift."),
      rowsTable("employee", [
        { k: "dept", label: "Department", options: DEPTS },
        { k: "name", label: "Employee", ph: "Name" },
        { k: "type", label: "Issue", options: EMP_ISSUES, blank: "Choose…" },
        { k: "notes", label: "What happened", ph: "e.g. Cut finger on mandoline, 6:40 PM", wide: true },
        { k: "action", label: "Action taken", ph: "e.g. First aid, incident form filed", wide: true },
      ], "+ Add employee issue", "No employee issues this shift."))}
    ${sec("guest", "Guest Issues", d.guest.length ? plural(d.guest.length, "issue") : "None",
      rowsView("guest", (x) => `<div class="ms-row-head"><strong>${esc(x.type || "Issue")}</strong>${x.table ? ` | ${esc(x.table)}` : ""}</div>${x.notes ? `<div>${esc(x.notes)}</div>` : ""}${x.resolution ? `<div class="ms-sub">Resolved: ${esc(x.resolution)}</div>` : ""}`, "No guest issues this shift.") +
        `<p class="note">Any injury (guest or employee): write up an incident report tonight, with times and witness names, and tell the owner.</p>`,
      rowsTable("guest", [
        { k: "type", label: "Issue", options: GUEST_ISSUES, blank: "Choose…" },
        { k: "table", label: "Table / guest", ph: "e.g. Table 12" },
        { k: "notes", label: "What happened", ph: "e.g. Burger ordered medium came out rare", wide: true },
        { k: "resolution", label: "How it was resolved", ph: "e.g. Recooked, comped dessert", wide: true },
      ], "+ Add guest issue", "No guest issues this shift."))}
    ${sec("comps", "Comps, Voids &amp; Refunds", s.comps ? `${fmt(s.comps)}${s.sales ? ` | ${fmtPct((s.comps / s.sales) * 100)} of sales` : ""}` : "None",
      d.comps.length ? `<div class="scroll-x"><table class="sched"><thead><tr><th>Type</th><th>Item</th><th>Reason</th><th>Approved by</th><th class="num">Amount</th></tr></thead>
        <tbody>${d.comps.map((x) => `<tr><td>${esc(x.type)}</td><td>${esc(x.item)}</td><td>${esc(x.reason)}</td><td>${esc(x.approved)}</td><td class="num mono">${x.amount ? fmt(Number(x.amount)) : "—"}</td></tr>`).join("")}</tbody>
        <tfoot><tr><td colspan="4">Total</td><td class="num mono">${fmt(s.comps)}</td></tr></tfoot></table></div>` : `<p class="ms-empty">No comps or voids this shift.</p>`,
      rowsTable("comps", [
        { k: "type", label: "Type", options: COMP_TYPES, blank: "Choose…" },
        { k: "item", label: "Item(s)", ph: "e.g. Sticky Toffee Pudding" },
        { k: "amount", label: "Amount ($)", money: true },
        { k: "reason", label: "Reason", ph: "e.g. Recook for Table 12", wide: true },
        { k: "approved", label: "Approved by", ph: "Manager" },
      ], "+ Add comp / void", "No comps or voids this shift."))}
    ${sec("kitchen", "86'd Items &amp; Kitchen", e86.length ? `${e86.length} 86'd` : "Nothing 86'd",
      from86 + list86 + field("Other kitchen notes", d.eighty_six) + field("Equipment &amp; maintenance", d.maintenance),
      from86 + list86 + `<div class="form-grid">
        ${area("Other kitchen notes", "data.eighty_six", d.eighty_six, "e.g. Running low on cod, 10 lb left")}
        ${area("Equipment &amp; maintenance", "data.maintenance", d.maintenance, "e.g. Walk-in door gasket torn; fryer 2 slow to heat")}</div>`)}
    ${sec("cash", "Cash &amp; Closing", `${CHECKS.filter(([k]) => d.checks[k]).length} of ${CHECKS.length} done`,
      `<div class="ms-field"><div class="ms-lbl">Cash over (+) / short (−)</div><p class="ms-text mono">${d.cash_over_short === "" || d.cash_over_short == null ? "—" : fmt(Number(d.cash_over_short))}</p></div>
       <ul class="ms-checks">${CHECKS.map(([k, label]) => `<li class="${d.checks[k] ? "done" : ""}">${d.checks[k] ? "✓" : "○"} ${label}</li>`).join("")}</ul>`,
      `<div class="form-grid">${input("Cash over (+) / short (−) ($)", "data.cash_over_short", d.cash_over_short, `type="number" step="0.01" placeholder="0.00"`)}</div>
       <div class="checks">${CHECKS.map(([k, label]) => `<label class="check"><input type="checkbox" data-f="data.checks.${k}" ${d.checks[k] ? "checked" : ""}> ${label}</label>`).join("")}</div>`)}
    ${sec("forecast", `Forecast for Tomorrow (${tomorrow})`, d.forecast.covers || d.forecast.sales ? `${d.forecast.covers ? plural(Number(d.forecast.covers), "cover") : ""}${d.forecast.covers && d.forecast.sales ? " | " : ""}${d.forecast.sales ? fmt0(Number(d.forecast.sales)) : ""}` : "Not filled in",
      (refStats ? `<p class="note">Last ${tomorrow}'s ${esc(r.shift)}: ${refStats.covers} covers${refStats.sales ? `, ${fmt0(refStats.sales)} in sales` : ""}.</p>` : "") +
      `<div class="ms-pair"><div class="ms-field"><div class="ms-lbl">Expected covers</div><p class="ms-text mono">${esc(d.forecast.covers) || "—"}</p></div>
       <div class="ms-field"><div class="ms-lbl">Expected sales</div><p class="ms-text mono">${d.forecast.sales ? fmt0(Number(d.forecast.sales)) : "—"}</p></div></div>` +
      field("Reservations &amp; large parties", d.forecast.reservations) + field("Events, weather &amp; outside factors", d.forecast.events) +
      field("Staffing plan", d.forecast.staffing) + field("Prep &amp; ordering", d.forecast.prep),
      (refStats ? `<p class="note">Last ${tomorrow}'s ${esc(r.shift)}: ${refStats.covers} covers${refStats.sales ? `, ${fmt0(refStats.sales)} in sales` : ""}.</p>` : "") +
      `<div class="form-grid">
        ${input("Expected covers", "data.forecast.covers", d.forecast.covers, `type="number" min="0" step="1"`)}
        ${input("Expected sales ($)", "data.forecast.sales", d.forecast.sales, `type="number" min="0" step="1"`)}
        ${area("Reservations &amp; large parties", "data.forecast.reservations", d.forecast.reservations, "e.g. Party of 14 at 7 PM")}
        ${area("Events, weather &amp; outside factors", "data.forecast.events", d.forecast.events, "e.g. Home game ends 6:30 PM, expect a rush")}
        ${area("Staffing plan", "data.forecast.staffing", d.forecast.staffing, "e.g. Add a 4th server 6–10 PM")}
        ${area("Prep &amp; ordering", "data.forecast.prep", d.forecast.prep, "e.g. Double batch of batter; confirm cod delivery")}
      </div>`)}
    ${sec("notes", "Shift Notes", [d.summary, d.wins, d.followups].filter((x) => String(x || "").trim()).length ? "Written" : "Not filled in",
      field("Shift summary", d.summary) + field("Wins &amp; shout-outs", d.wins) + field("Follow-ups for the next manager", d.followups),
      `<div class="form-grid">
        ${area("Shift summary", "data.summary", d.summary, "How the shift went overall")}
        ${area("Wins &amp; shout-outs", "data.wins", d.wins, "Who went above and beyond")}
        ${area("Follow-ups for the next manager", "data.followups", d.followups, "What needs to happen next")}
      </div>`)}
    </div>

    <div class="row-actions">
      <button class="applybtn" id="saveReportBtn" type="button">Save report</button>
      <button class="ghostbtn dark" id="printReportBtn" type="button">Print / save as PDF</button>
      <span class="spacer"></span>
      ${r.id ? `<button class="linkbtn danger" id="deleteReportBtn" type="button">Delete report</button>` : ""}
    </div>`;
  el.dataset.lw = lw ? JSON.stringify({ day: lwDay, covers: lw.covers, sales: lw.sales }) : "";
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
  const set = (id, html) => { const x = $(id); if (x) x.innerHTML = html; };
  set("coverTotal", String(s.covers));
  set("peakNote", s.peak
    ? `Peak: ${fmtHour(s.peak.h)} (${s.peak.covers})` + (s.rush ? ` | busiest 2 hours: ${fmtHour(s.rush.h)}–${fmtHour(s.rush.h + 2)} (${s.rush.covers})` : "")
    : "");
  // The two numbers that matter most, big, with last week's same shift beside them.
  let lw = null; try { lw = JSON.parse($("modEditor").dataset.lw || "null"); } catch { /* none */ }
  const vs = (now, then, money) => {
    if (!then) return "";
    const diff = now - then, pct = (diff / then) * 100;
    return `<span class="${diff >= 0 ? "up" : "down"}">${diff >= 0 ? "▲" : "▼"} ${Math.abs(pct).toFixed(0)}%</span> vs. last ${lw.day} (${money ? fmt0(then) : then})`;
  };
  set("heroCovers", String(s.covers));
  set("heroSales", s.sales ? fmt0(s.sales) : "—");
  set("heroCoversSub", [s.peak ? `Peak ${fmtHour(s.peak.h)} (${s.peak.covers})` : "", lw ? vs(s.covers, lw.covers, false) : ""].filter(Boolean).join(" | "));
  set("heroSalesSub", [s.avgCheck ? `${fmt(s.avgCheck)} per guest` : "", lw && s.sales ? vs(s.sales, lw.sales, true) : ""].filter(Boolean).join(" | "));
  const badge = document.querySelector('#modEditor [data-badge="sales"]');
  if (badge) badge.textContent = `${s.covers} cover${s.covers === 1 ? "" : "s"} | ${s.sales ? fmt0(s.sales) : "no sales yet"}`;
  set("modSummary", `
    <div><div class="val mono">${s.peak ? fmtHour(s.peak.h) : "—"}</div><div class="lbl">Peak hour</div></div>
    <div><div class="val mono">${s.avgCheck ? fmt(s.avgCheck) : "—"}</div><div class="lbl">Average per guest</div></div>
    <div><div class="val mono">${fmt(s.comps)}</div><div class="lbl">Comps &amp; voids</div></div>
    <div><div class="val mono">${s.emp + s.guest}</div><div class="lbl">Issues${s.injuries ? ` (${s.injuries} injury)` : ""}</div></div>`);
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
  // Head counts from the synced schedule, and what was 86'd, kept with the report.
  const sh = data.shifts || [];
  const count = (dept, worked) => sh.filter((x) => (dept === "FOH" ? x.dept === "FOH" : x.dept !== "FOH") && (!worked || x.in)).length;
  data.staffing = { foh_sched: count("FOH"), foh_actual: count("FOH", true), boh_sched: count("BOH"), boh_actual: count("BOH", true) };
  data.eighty_six_items = eightySixFor(r);
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

// Print the whole report: open every section first, then put them back.
function printReport() {
  const secs = [...document.querySelectorAll("#modEditor details.mod-sec")];
  const was = secs.map((x) => x.open);
  secs.forEach((x) => { x.open = true; });
  window.print();
  secs.forEach((x, i) => { x.open = was[i]; });
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
  $("freeFields").classList.toggle("hidden", menuMode !== "free");
  renderColorPreview();
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
  const colors = $("menuColors").value.trim();
  const pal = menuPalette();
  body.colors = colors || pal.label;
  body.colors_hex = pal.hex;
  body.teams = pal.teams.map((t) => ({ name: t.name, colors: t.colors.map(([n, h]) => `${n} ${h}`) }));
  body.avoid = recentDishes.slice(0, 24);
  if (menuMode === "free") {
    body.brief = $("fsBrief").value;
    body.count = Number($("fsCount").value) || 4;
  } else if (menuMode === "event") {
    body.event = { name: $("evName").value, count: Number($("evCount").value) || 5, crowd: $("evCrowd").value, personal: $("evPersonal").value, notes: $("evNotes").value };
  } else if (menuMode === "party") {
    body.party = { type: $("ptType").value, guests: Number($("ptGuests").value) || 20, style: $("ptStyle").value, personal: $("ptPersonal").value, notes: $("ptNotes").value };
  } else {
    body.count = Number($("spCount").value) || 3;
    body.notes = $("spNotes").value;
  }
  return body;
}

// Official colors for teams people plan game days around: every NFL team and
// the SEC. If the owner leaves Colors blank and names a team, its real colors
// are used. [match words, name, [[color name, hex], ...]]
const TEAMS = [
  [["cardinals"], "Arizona Cardinals", [["cardinal red", "#97233F"], ["black", "#000000"], ["gold", "#FFB612"]], ["st. louis", "louisville"]],
  [["falcons"], "Atlanta Falcons", [["red", "#A71930"], ["black", "#000000"], ["silver", "#A5ACAF"]]],
  [["ravens"], "Baltimore Ravens", [["purple", "#241773"], ["black", "#000000"], ["gold", "#9E7C0C"]]],
  [["bills"], "Buffalo Bills", [["royal blue", "#00338D"], ["red", "#C60C30"], ["white", "#FFFFFF"]]],
  [["panthers"], "Carolina Panthers", [["process blue", "#0085CA"], ["black", "#101820"], ["silver", "#BFC0BF"]]],
  [["bears"], "Chicago Bears", [["navy", "#0B162A"], ["orange", "#C83803"], ["white", "#FFFFFF"]]],
  [["bengals"], "Cincinnati Bengals", [["orange", "#FB4F14"], ["black", "#000000"], ["white", "#FFFFFF"]]],
  [["browns"], "Cleveland Browns", [["brown", "#311D00"], ["orange", "#FF3C00"], ["white", "#FFFFFF"]]],
  [["cowboys"], "Dallas Cowboys", [["royal blue", "#003594"], ["navy", "#041E42"], ["silver", "#869397"]]],
  [["broncos"], "Denver Broncos", [["orange", "#FB4F14"], ["navy", "#002244"], ["white", "#FFFFFF"]]],
  [["lions"], "Detroit Lions", [["Honolulu blue", "#0076B6"], ["silver", "#B0B7BC"], ["white", "#FFFFFF"]]],
  [["packers"], "Green Bay Packers", [["green", "#203731"], ["gold", "#FFB612"], ["white", "#FFFFFF"]]],
  [["texans"], "Houston Texans", [["deep steel blue", "#03202F"], ["battle red", "#A71930"], ["white", "#FFFFFF"]]],
  [["colts"], "Indianapolis Colts", [["speed blue", "#002C5F"], ["white", "#FFFFFF"], ["gray", "#A2AAAD"]]],
  [["jaguars", "jags"], "Jacksonville Jaguars", [["teal", "#006778"], ["gold", "#D7A22A"], ["black", "#101820"]]],
  [["chiefs"], "Kansas City Chiefs", [["red", "#E31837"], ["gold", "#FFB81C"], ["white", "#FFFFFF"]]],
  [["raiders"], "Las Vegas Raiders", [["silver", "#A5ACAF"], ["black", "#000000"], ["white", "#FFFFFF"]]],
  [["chargers"], "Los Angeles Chargers", [["powder blue", "#0080C6"], ["sunshine gold", "#FFC20E"], ["white", "#FFFFFF"]]],
  [["rams"], "Los Angeles Rams", [["royal blue", "#003594"], ["sol yellow", "#FFD100"], ["white", "#FFFFFF"]]],
  [["dolphins", "fins"], "Miami Dolphins", [["aqua", "#008E97"], ["orange", "#FC4C02"], ["white", "#FFFFFF"]]],
  [["vikings"], "Minnesota Vikings", [["purple", "#4F2683"], ["gold", "#FFC62F"], ["white", "#FFFFFF"]]],
  [["patriots", "pats"], "New England Patriots", [["navy", "#002244"], ["red", "#C60C30"], ["silver", "#B0B7BC"]]],
  [["saints"], "New Orleans Saints", [["old gold", "#D3BC8D"], ["black", "#101820"], ["white", "#FFFFFF"]]],
  [["giants"], "New York Giants", [["royal blue", "#0B2265"], ["red", "#A71930"], ["white", "#FFFFFF"]]],
  [["jets"], "New York Jets", [["gotham green", "#125740"], ["white", "#FFFFFF"], ["black", "#000000"]]],
  [["eagles"], "Philadelphia Eagles", [["midnight green", "#004C54"], ["silver", "#A5ACAF"], ["black", "#000000"]]],
  [["steelers"], "Pittsburgh Steelers", [["gold", "#FFB612"], ["black", "#101820"], ["white", "#FFFFFF"]]],
  [["49ers", "niners"], "San Francisco 49ers", [["red", "#AA0000"], ["gold", "#B3995D"], ["white", "#FFFFFF"]]],
  [["seahawks"], "Seattle Seahawks", [["college navy", "#002244"], ["action green", "#69BE28"], ["wolf gray", "#A5ACAF"]]],
  [["buccaneers", "bucs"], "Tampa Bay Buccaneers", [["red", "#D50A0A"], ["pewter", "#34302B"], ["orange", "#FF7900"]]],
  [["titans"], "Tennessee Titans", [["navy", "#0C2340"], ["titans blue", "#4B92DB"], ["red", "#C8102E"]]],
  [["commanders"], "Washington Commanders", [["burgundy", "#5A1414"], ["gold", "#FFB612"], ["white", "#FFFFFF"]]],
  [["vols", "volunteers", "tennessee", "rocky top", "neyland"], "Tennessee Volunteers", [["Tennessee orange", "#FF8200"], ["white", "#FFFFFF"], ["Smokey gray", "#58595B"]], ["titans", "tennessee state", "middle tennessee", "east tennessee"]],
  [["kentucky", "uk wildcats"], "Kentucky Wildcats", [["Kentucky blue", "#0033A0"], ["white", "#FFFFFF"]], ["western kentucky", "eastern kentucky", "northern kentucky"]],
  [["alabama", "crimson tide", "roll tide", "bama"], "Alabama Crimson Tide", [["crimson", "#9E1B32"], ["white", "#FFFFFF"], ["gray", "#828A8F"]], ["alabama state", "south alabama", "uab"]],
  [["georgia bulldogs", "uga", "dawgs"], "Georgia Bulldogs", [["red", "#BA0C2F"], ["black", "#000000"], ["silver", "#9EA2A2"]]],
  [["gators", "florida"], "Florida Gators", [["blue", "#0021A5"], ["orange", "#FA4616"], ["white", "#FFFFFF"]], ["florida state", "fsu", "south florida", "florida atlantic", "florida international"]],
  [["lsu", "geaux tigers"], "LSU Tigers", [["purple", "#461D7C"], ["gold", "#FDD023"], ["white", "#FFFFFF"]]],
  [["auburn", "war eagle"], "Auburn Tigers", [["navy", "#0C2340"], ["orange", "#E87722"], ["white", "#FFFFFF"]]],
  [["ole miss", "rebels"], "Ole Miss Rebels", [["red", "#CE1126"], ["navy", "#14213D"], ["white", "#FFFFFF"]]],
  [["mississippi state", "miss state"], "Mississippi State Bulldogs", [["maroon", "#660000"], ["white", "#FFFFFF"]]],
  [["razorbacks", "arkansas", "hogs"], "Arkansas Razorbacks", [["cardinal", "#9D2235"], ["white", "#FFFFFF"]], ["arkansas state"]],
  [["gamecocks", "south carolina"], "South Carolina Gamecocks", [["garnet", "#73000A"], ["black", "#000000"], ["white", "#FFFFFF"]]],
  [["mizzou", "missouri"], "Missouri Tigers", [["gold", "#F1B82D"], ["black", "#000000"], ["white", "#FFFFFF"]], ["missouri state"]],
  [["texas a&m", "aggies", "a&m"], "Texas A&M Aggies", [["maroon", "#500000"], ["white", "#FFFFFF"]]],
  [["longhorns", "texas"], "Texas Longhorns", [["burnt orange", "#BF5700"], ["white", "#FFFFFF"]], ["texas a&m", "texas tech", "north texas", "texas state", "utep", "utsa", "a&m", "texans"]],
  [["sooners", "oklahoma"], "Oklahoma Sooners", [["crimson", "#841617"], ["cream", "#FDF9D8"]], ["oklahoma state"]],
  [["commodores", "vanderbilt", "vandy"], "Vanderbilt Commodores", [["black", "#000000"], ["gold", "#866D4B"], ["white", "#FFFFFF"]]],
];
// Teams named in the text, in the order they're named.
function teamsIn(text) {
  const t = " " + String(text || "").toLowerCase().replace(/[^a-z0-9&. ]+/g, " ").replace(/\s+/g, " ") + " ";
  const found = [];
  for (const [keys, name, colors, unless = []] of TEAMS) {
    if (unless.some((u) => t.includes(` ${u} `))) continue;
    const at = Math.min(...keys.map((k) => { const i = t.indexOf(` ${k} `); return i < 0 ? Infinity : i; }));
    if (at < Infinity) found.push({ at, name, colors });
  }
  return found.sort((a, b) => a.at - b.at).slice(0, 2);
}
// What colors the next menu will use: the owner's own (typed in Colors), or
// the first team's colors plus the other team's main color.
function menuPalette() {
  const typed = $("menuColors").value.trim();
  const words = menuMode === "event" ? `${$("evName").value} ${$("evPersonal").value}` : menuMode === "party" ? `${$("ptType").value} ${$("ptPersonal").value}`
    : menuMode === "free" ? $("fsBrief").value : $("spNotes").value;
  const teams = teamsIn(words);
  if (typed) return { hex: parseColors(typed), teams, label: typed, from: "typed" };
  if (!teams.length) return { hex: [], teams, label: "", from: "" };
  const [a, b] = teams;
  const hex = [...new Set([...a.colors.map((c) => c[1]), ...(b ? [b.colors[0][1]] : [])])];
  return { hex, teams, label: teams.map((t) => `${t.name}: ${t.colors.map((c) => c[0]).join(", ")}`).join("; "), from: "teams" };
}
function renderColorPreview() {
  const p = menuPalette(), el = $("colorPreview");
  if (!p.hex.length) { el.innerHTML = p.from === "typed" ? `<span class="cp-note">Couldn't match those colors. Try plain names like "navy and gold" or codes like #FF8200.</span>` : ""; return; }
  const chips = (list) => list.map(([n, h]) => `<span class="cp-chip"><span class="cp-sw" style="background:${h}"></span>${esc(n)}</span>`).join("");
  el.innerHTML = p.from === "teams"
    ? p.teams.map((t, i) => `<div class="cp-row"><span class="cp-team">${esc(t.name)}${i === 0 ? "" : " (accent)"}</span>${chips(i === 0 ? t.colors : t.colors.slice(0, 1))}</div>`).join("") + `<span class="cp-note">Official team colors. Type your own in Colors to change them.</span>`
    : `<div class="cp-row">${chips(p.hex.map((h) => [h, h]))}</div>`;
}

// Turn "orange and white" or "#FF8200, navy" into exact hex codes, so the
// menu uses the same colors every time instead of Gemini's guess.
const COLOR_NAMES = {
  "tennessee orange": "#FF8200", "vols orange": "#FF8200", "smokey gray": "#58595B", "smokey grey": "#58595B",
  "kentucky blue": "#0033A0", "wildcat blue": "#0033A0", "carolina blue": "#7BAFD4", "crimson": "#9E1B32",
  "kelly green": "#4CBB17", "forest green": "#228B22", "hunter green": "#355E3B", "dark green": "#1F4D3A", "lime green": "#32CD32", "mint green": "#98E2C6", "mint": "#98E2C6", "sage": "#9CAF88", "olive": "#708238",
  "navy blue": "#1B2A4A", "navy": "#1B2A4A", "royal blue": "#1D4ED8", "sky blue": "#87CEEB", "light blue": "#9CC9F0", "baby blue": "#A7C7E7", "powder blue": "#B0D4E8", "dark blue": "#13294B", "teal": "#0F7C80", "turquoise": "#30C5C0", "aqua": "#3FD0D4",
  "dark red": "#8B1A1A", "cardinal": "#C41E3A", "scarlet": "#BB0000", "maroon": "#6E1A2D", "burgundy": "#7A1F33", "wine": "#722F37", "brick": "#A4442A", "rust": "#B7410E",
  "hot pink": "#FF4FA3", "light pink": "#F8C8DC", "blush": "#F4C2C2", "pink": "#F48FB1", "magenta": "#C2187A", "coral": "#FF7F6B", "peach": "#FFCBA4", "salmon": "#F28B72",
  "lavender": "#B9A6E0", "lilac": "#C8A2C8", "purple": "#5B2A86", "violet": "#7F3FBF",
  "burnt orange": "#BF5700", "orange": "#FF8200", "gold": "#C9A227", "old gold": "#B3995D", "mustard": "#D4A017", "lemon": "#FFF44F", "yellow": "#FFD100", "butter": "#F6E3A1",
  "cream": "#FBF5E6", "ivory": "#FFFFF0", "beige": "#E8DCC4", "tan": "#D2B48C", "khaki": "#C3B091", "brown": "#6B4226", "chocolate": "#4E2A1E", "copper": "#B87333", "bronze": "#A97142",
  "silver": "#A7A9AC", "light gray": "#D9D9D6", "light grey": "#D9D9D6", "charcoal": "#36454F", "gray": "#808080", "grey": "#808080",
  "black": "#111111", "white": "#FFFFFF", "red": "#C8102E", "blue": "#1F5BB5", "green": "#2E7D32",
};
function parseColors(text) {
  let rest = " " + String(text || "").toLowerCase().replace(/[^a-z0-9# ]+/g, " ") + " ";
  const found = [];
  for (const m of rest.matchAll(/#([0-9a-f]{6}|[0-9a-f]{3})\b/g)) {
    const h = m[1].length === 3 ? m[1].split("").map((c) => c + c).join("") : m[1];
    found.push({ at: m.index, hex: "#" + h.toUpperCase() });
  }
  // Longest names first, so "burnt orange" wins over "orange".
  for (const name of Object.keys(COLOR_NAMES).sort((a, b) => b.length - a.length)) {
    const re = new RegExp(` ${name} `, "g");
    let m;
    while ((m = re.exec(rest))) {
      found.push({ at: m.index, hex: COLOR_NAMES[name] });
      rest = rest.slice(0, m.index + 1) + " ".repeat(name.length) + rest.slice(m.index + 1 + name.length);
      re.lastIndex = 0;
    }
  }
  return [...new Set(found.sort((a, b) => a.at - b.at).map((f) => f.hex))].slice(0, 6);
}

// When the menu server's reply has no message of its own (Vercel cut it off,
// or it crashed), say what kind of problem it was instead of a blank "error".
function serverTrouble(status) {
  if (status === 504) return "Gemini took too long to answer. Try again, or ask for fewer items.";
  if (status === 413) return "That's too much to send in one go. Try fewer items or shorter notes.";
  if (status >= 500) return `The menu server had a problem (error ${status}). Try again in a minute.`;
  return `Something went wrong (error ${status}). Try again.`;
}

// "Show me 3 ideas first": three different directions to pick from.
let lastIdeas = null;
async function showIdeas() {
  if (!ingredients.size) { toast("Add some ingredients first.", "err"); return; }
  if (menuMode === "event" && !$("evName").value.trim()) { toast("Say what the event is first.", "err"); $("evName").focus(); return; }
  if (menuMode === "free" && !$("fsBrief").value.trim()) { toast("Throw in a few words first: a theme, a guest, a mood, anything.", "err"); $("fsBrief").focus(); return; }
  const btn = $("ideasBtn"), note = $("makeMenuNote");
  btn.disabled = true; $("makeMenuBtn").disabled = true; note.textContent = "Looking it up and thinking of 3 ideas…";
  $("makeMenuBlade").classList.remove("hidden");
  try {
    const { data } = await sb.auth.getSession();
    const request = { ...menuRequest(), action: "ideas" };
    const r = await fetch("/api/specials", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session?.access_token || ""}` }, body: JSON.stringify(request) });
    const out = await r.json().catch(() => ({}));
    note.textContent = "";
    if (!r.ok) { toast(out.error || serverTrouble(r.status), "err"); return; }
    lastIdeas = out;
    const el = $("ideasResult");
    el.classList.remove("hidden");
    el.innerHTML = `<div class="chart-head"><h3>Pick an Idea</h3><span class="note">Each one becomes a full menu, priced and costed</span></div>
      <div class="ideas">${out.ideas.map((x, i) => `<article class="idea">
        ${Array.isArray(x.colors) && x.colors.length ? `<div class="idea-sw">${x.colors.filter((c) => HEX.test(c)).slice(0, 3).map((c) => `<span style="background:${c}"></span>`).join("")}</div>` : ""}
        <h4>${esc(x.title)}</h4><p>${esc(x.pitch)}</p>
        <ul>${(x.dishes || []).slice(0, 5).map((d) => `<li>${esc(d)}</li>`).join("")}</ul>
        ${x.decor ? `<p class="idea-decor"><strong>Decor:</strong> ${esc(x.decor)}</p>` : ""}
        <button class="applybtn" data-idea="${i}" type="button">Make this menu</button></article>`).join("")}</div>
      ${sourcesLine(out.sources)}`;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch { note.textContent = ""; toast("Couldn't reach the menu assistant. Check your internet and try again.", "err"); }
  finally { btn.disabled = false; $("makeMenuBtn").disabled = false; $("makeMenuBlade").classList.add("hidden"); }
}
function sourcesLine(sources) {
  return Array.isArray(sources) && sources.length
    ? `<p class="note sources">Checked with Google Search: ${sources.map((x) => `<a href="${esc(x.uri)}" target="_blank" rel="noopener">${esc(x.title || "source")}</a>`).join(" | ")}</p>` : "";
}

async function makeMenu(again = false, idea = null) {
  if (!ingredients.size) { toast("Add some ingredients first.", "err"); return; }
  if (menuMode === "event" && !$("evName").value.trim()) { toast("Say what the event is first.", "err"); $("evName").focus(); return; }
  if (menuMode === "free" && !$("fsBrief").value.trim()) { toast("Throw in a few words first: a theme, a guest, a mood, anything.", "err"); $("fsBrief").focus(); return; }
  const btn = $("makeMenuBtn"), note = $("makeMenuNote");
  btn.disabled = true; note.textContent = "Gemini is writing your menu. This takes a few seconds…";
  $("makeMenuBlade").classList.remove("hidden");
  try {
    const { data } = await sb.auth.getSession();
    const request = menuRequest();
    if (idea) request.idea = idea;
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
    if (!r.ok) { note.textContent = ""; toast(out.error || serverTrouble(r.status), "err"); return; }
    // "Try another version" keeps the picture and any colors or border you picked.
    lastMenu = { ...out, request, picture: again ? lastMenu?.picture : undefined, look: again ? lastMenu?.look : undefined };
    recentDishes = [...out.menu.items.map((it) => String(it.name || "")).filter(Boolean), ...recentDishes].slice(0, 24);
    note.textContent = "";
    renderMenuResult();
    $("menuResult").scrollIntoView({ behavior: "smooth", block: "start" });
  } catch {
    note.textContent = "";
    toast("Couldn't reach the menu assistant. Check your internet and try again.", "err");
  } finally { btn.disabled = false; $("makeMenuBlade").classList.add("hidden"); }
}

// A picture for the top of the menu from Gemini's picture model.
let lookTimer = null;
async function makePicture() {
  if (!lastMenu) return;
  const btn = $("makePictureBtn"), note = $("pictureNote");
  btn.disabled = true; note.textContent = "Gemini is making a picture. This can take 10 to 20 seconds…";
  $("pictureBlade").classList.remove("hidden");
  try {
    const { data } = await sb.auth.getSession();
    const { menu, mode, request } = lastMenu;
    const th = menuTheme(menu.theme, request.colors_hex || []), look = lastMenu.look || {};
    const occasion = mode === "event" ? request.event.name : mode === "party" ? `${request.party.type || "a party"}${request.party.personal ? `: ${request.party.personal}` : ""}` : mode === "free" ? request.brief : "this week's specials";
    const details = [request.event?.personal, request.party?.personal, menu.tagline, request.colors].filter(Boolean).join(". ");
    const r = await fetch("/api/specials", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session?.access_token || ""}` },
      body: JSON.stringify({ action: "image", style: $("pictureStyle").value, occasion, details,
        colors: [look.bg || th.bg, look.accent || th.accent, th.accent2],
        menu: { title: menu.title, items: menu.items.map((it) => ({ name: it.name, description: it.description })) } }),
    });
    const out = await r.json().catch(() => ({}));
    if (!r.ok || !out.image) { note.textContent = ""; toast(out.error || "Couldn't make a picture. Try again.", "err"); return; }
    if (lastMenu.menu !== menu) return;   // a new menu came in meanwhile
    lastMenu.picture = out.image;
    renderMenuResult();
  } catch {
    note.textContent = "";
    toast("Couldn't reach the menu assistant. Check your internet and try again.", "err");
  } finally { if ($("makePictureBtn")) $("makePictureBtn").disabled = false; if ($("pictureBlade")) $("pictureBlade").classList.add("hidden"); }
}

// Describe a vibe: Gemini picks the layout, lettering, colors and border; the
// dishes stay the same. The owner's exact colors (if any) still win.
async function applyVibe() {
  if (!lastMenu) return;
  const input = $("vibeInput"), vibe = input.value.trim();
  if (!vibe) { toast("Describe the vibe first, like \"cozy rainy pub night\".", "err"); input.focus(); return; }
  if (voice) voice.rec.stop();
  const btn = $("vibeBtn"), note = $("vibeNote");
  btn.disabled = true; note.textContent = "Gemini is restyling the menu…"; $("vibeBlade").classList.remove("hidden");
  lastMenu.vibe = vibe;
  try {
    const { data } = await sb.auth.getSession();
    const { menu, request } = lastMenu;
    const r = await fetch("/api/specials", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session?.access_token || ""}` },
      body: JSON.stringify({ action: "vibe", vibe, colors: request.colors_hex || [],
        current: lastMenu.look?.layout || menu.theme?.layout || "classic",
        menu: { title: menu.title, kicker: menu.tagline || "", items: menu.items.map((it) => String(it.name || "")) } }),
    });
    const out = await r.json().catch(() => ({}));
    if (!r.ok || !out.look) { note.textContent = ""; toast(out.error || "Couldn't change the look. Try again.", "err"); return; }
    if (lastMenu.menu !== menu) return;            // a new menu came in meanwhile
    const v = out.look, th = menuTheme({ background: v.background, text: v.text, accent: v.accent, accent2: v.accent2, style: "classic" }, request.colors_hex || []);
    lastMenu.look = { ...(lastMenu.look || {}), layout: v.layout, font: MENU_PAIRS[v.font] ? v.font : LAYOUT_FONT[v.layout],
      bg: th.bg, ink: th.ink, accent: th.accent, accent2: th.accent2, pattern: PATTERNS.includes(v.pattern) ? v.pattern : "none" };
    lastMenu.vibeSummary = v.summary || "";
    lastMenu.restyled = true; renderMenuResult(); lastMenu.restyled = false;
  } catch {
    note.textContent = "";
    toast("Couldn't reach the menu assistant. Check your internet and try again.", "err");
  } finally {
    if ($("vibeBtn")) $("vibeBtn").disabled = false;
    if ($("vibeBlade")) $("vibeBlade").classList.add("hidden");
  }
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
// Printed-menu layouts (CSS in design.css, "lay-…") and font pairings (Google
// Fonts, loaded in index.html). Gemini picks both; the owner can change either,
// or describe a vibe and let Gemini restyle the menu.
const MENU_LAYOUTS = { classic: "Classic", chalk: "Chalkboard", diner: "Diner", news: "Broadsheet", poster: "Game-day poster", bistro: "Bistro card" };
const LAYOUT_FONT = { classic: "classic", chalk: "chalk", diner: "diner", news: "news", poster: "sports", bistro: "bistro" };
const MENU_PAIRS = {
  classic: { label: "Gemini's lettering" },
  pub:    { label: "Pub slab",       d: "'Alfa Slab One', Rockwell, serif",             b: "'Source Serif 4', Georgia, serif" },
  chalk:  { label: "Chalk hand",     d: "'Permanent Marker', 'Comic Sans MS', cursive", b: "Kalam, 'Comic Sans MS', cursive" },
  sports: { label: "Game day",       d: "'Bebas Neue', Impact, sans-serif",             b: "Barlow, 'Arial Narrow', sans-serif" },
  diner:  { label: "Retro diner",    d: "Lobster, 'Brush Script MT', cursive",          b: "Oswald, 'Arial Narrow', sans-serif" },
  bistro: { label: "Bistro",         d: "'Cormorant Garamond', Garamond, serif",        b: "'Cormorant Garamond', Garamond, serif" },
  news:   { label: "Newspaper",      d: "'Abril Fatface', 'Bodoni MT', serif",          b: "'Libre Baskerville', Baskerville, serif" },
  type:   { label: "Typewriter",     d: "'Special Elite', 'Courier New', monospace",    b: "'Courier Prime', 'Courier New', monospace" },
  kids:   { label: "Friendly round", d: "Fredoka, 'Trebuchet MS', sans-serif",          b: "Nunito, 'Trebuchet MS', sans-serif" },
};

// The owner's colors are the only ones allowed (plus white and near-black
// for readable text): each color Gemini picked snaps to the closest one.
function rgb(hex) { return [1, 3, 5].map((k) => parseInt(hex.slice(k, k + 2), 16)); }
function nearest(hex, allowed) {
  const [r, g, b] = rgb(hex);
  return allowed.reduce((best, c) => { const [x, y, z] = rgb(c), d = (r - x) ** 2 + (g - y) ** 2 + (b - z) ** 2; return d < best.d ? { c, d } : best; }, { c: allowed[0], d: Infinity }).c;
}
function menuTheme(t = {}, owner = []) {
  if (owner.length) {
    const allowed = [...owner, "#FFFFFF", "#111111"];
    const snap = (v) => (HEX.test(String(v || "").trim()) ? nearest(String(v).trim(), allowed) : v);
    t = { ...t, background: snap(t.background), text: snap(t.text), accent: snap(t.accent), accent2: snap(t.accent2) };
    // Make sure the owner's colors actually show up somewhere.
    if (![t.background, t.accent, t.accent2].some((c) => owner.includes(c))) t.accent = owner[0];
    if (owner[1] && ![t.background, t.accent, t.accent2].includes(owner[1])) t.accent2 = owner[1];
  }
  const bg = hexOr(t.background, "#FBF9F5");
  let ink = hexOr(t.text, "#262624");
  if (contrast(bg, ink) < 4.5) ink = contrast(bg, "#111111") >= contrast(bg, "#FFFFFF") ? "#111111" : "#FFFFFF";
  // The title, prices and borders are big and bold, so a team color like
  // Tennessee orange on white is fine. Only a color that nearly disappears
  // (yellow on white, navy on black) is swapped for the text color.
  let accent = hexOr(t.accent, ink);
  if (contrast(bg, accent) < 2) accent = ink;
  let accent2 = hexOr(t.accent2, accent);
  if (contrast(bg, accent2) < 2) accent2 = accent;
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
const PATTERNS = ["stripes", "dots", "confetti", "zigzag", "waves", "checkerboard"];
const PATTERN_NAMES = { none: "No border", stripes: "Stripes", dots: "Dots", confetti: "Confetti", zigzag: "Zigzag", waves: "Waves", checkerboard: "Checkerboard" };
function motifSvg(name, color) {
  return `<svg class="mp-motif" viewBox="0 0 48 48" aria-hidden="true" style="color:${color}">${MOTIFS[name]}</svg>`;
}

// Waves and confetti are drawn as small repeating SVG tiles (cleaner than CSS).
function bandSvg(pattern, th, n) {
  const id = `mpband${n}`;
  const tile = {
    waves: `<pattern id="${id}" width="32" height="18" patternUnits="userSpaceOnUse"><path d="M0 9 Q8 2 16 9 T32 9" fill="none" stroke="${th.accent}" stroke-width="3" stroke-linecap="round"/></pattern>`,
    confetti: `<pattern id="${id}" width="64" height="24" patternUnits="userSpaceOnUse">
      <circle cx="7" cy="7" r="3.5" fill="${th.accent}"/><rect x="20" y="13" width="9" height="4" rx="1" fill="${th.accent2}" transform="rotate(-25 24 15)"/>
      <circle cx="38" cy="6" r="2.5" fill="${th.accent2}"/><rect x="46" y="11" width="8" height="4" rx="1" fill="${th.accent}" transform="rotate(30 50 13)"/>
      <circle cx="58" cy="19" r="2" fill="${th.accent}"/><circle cx="14" cy="19" r="2" fill="${th.accent2}"/></pattern>`,
  }[pattern];
  return tile ? `<svg aria-hidden="true"><defs>${tile}</defs><rect width="100%" height="100%" fill="url(#${id})"/></svg>` : "";
}

function renderMenuResult() {
  const { menu, mode, model, request } = lastMenu;
  const t = targets();
  const party = mode === "party";
  const costed = menu.items.map((it) => ({ it, ...costItem(it) }));

  // 1. The menu guests see, in the theme's colors.
  // Colors and border: Gemini's pick, then anything the owner changed below the menu.
  const look = lastMenu.look || {};
  let th = menuTheme(menu.theme, request.colors_hex || []);
  if (look.bg || look.ink || look.accent) th = { ...th, bg: look.bg || th.bg, ink: look.ink || th.ink, accent: look.accent || th.accent, accent2: look.accent2 || look.accent || th.accent2 };
  // Layout and lettering: the owner's pick or the vibe's, else Gemini's, else the layout's own font.
  const layout = MENU_LAYOUTS[look.layout] ? look.layout : MENU_LAYOUTS[menu.theme?.layout] ? menu.theme.layout : "classic";
  const fontKey = MENU_PAIRS[look.font] ? look.font : MENU_PAIRS[menu.theme?.font] && !look.layout ? menu.theme.font : LAYOUT_FONT[layout];
  const pair = MENU_PAIRS[fontKey];
  const fontD = pair.d || MENU_FONTS[th.style], fontB = pair.b || MENU_FONTS[th.style];
  const dateline = layout === "news" ? `<div class="mp-dateline"><span>${esc(rest.name)}</span><span>${new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</span><span>Specials edition</span></div>` : "";
  const kicker = mode === "event" ? request.event.name : party ? (request.party.type || "Party menu") : mode === "free" ? "" : "This week's specials";
  const motifs = (Array.isArray(menu.motifs) ? menu.motifs : []).map((m) => String(m).trim().toLowerCase()).filter((m) => MOTIFS[m]).slice(0, 4);
  const pattern = look.pattern || (PATTERNS.includes(String(menu.pattern || "").toLowerCase()) ? String(menu.pattern).toLowerCase() : "none");
  const sayings = (Array.isArray(menu.sayings) ? menu.sayings : []).map((x) => String(x).trim()).filter(Boolean).slice(0, 4);
  const band = (n) => (pattern === "none" ? "" : `<div class="mp-band pat-${pattern}" aria-hidden="true">${bandSvg(pattern, th, n)}</div>`);
  const poster = `<div class="menu-poster mp-${th.style} lay-${layout}${pattern === "none" ? "" : " has-band"}${lastMenu.restyled ? " restyled" : ""}" style="--mp-bg:${th.bg};--mp-ink:${th.ink};--mp-accent:${th.accent};--mp-accent2:${th.accent2};--mp-font:${fontD};--mp-body:${fontB}">
      ${band(1)}
      ${lastMenu.picture ? `<img class="mp-picture" src="${lastMenu.picture}" alt="">` : ""}
      ${motifs.length ? `<div class="mp-motifs">${motifs.map((m, i) => motifSvg(m, i % 2 ? "var(--mp-accent2)" : "var(--mp-accent)")).join("")}</div>` : ""}
      <div class="mp-kicker">${esc(rest.name)}${kicker ? ` | ${esc(kicker)}` : ""}</div>
      <h3 class="mp-title">${esc(menu.title)}</h3>
      ${dateline}
      ${menu.tagline ? `<p class="mp-tag">${esc(menu.tagline)}</p>` : ""}
      <div class="mp-items">${menu.items.map((it) => `<div class="mp-item">
        <div class="mp-line">${party && it.course ? `<span class="mp-course">${esc(it.course)}</span>` : ""}<span class="mp-name">${esc(it.name)}</span><span class="mp-dots"></span>${Number(it.price) > 0 ? `<span class="mp-price">${fmt(Number(it.price))}</span>` : ""}</div>
        <div class="mp-desc">${esc(it.description)}</div></div>`).join("")}</div>
      ${sayings.length ? `<div class="mp-sayings">${sayings.map((x) => `<span>${esc(x)}</span>`).join("")}</div>` : ""}
      ${band(2)}
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
    <div class="chart-head"><h3>Your Menu</h3><span class="note">Suggested by ${esc(model)}. Check it over before you print it.</span></div>
    ${sourcesLine(lastMenu.sources)}
    ${poster}
    <div class="menu-vibe">
      <label for="vibeInput">Describe the vibe</label>
      <div class="vibe-row">
        <span class="voice-field"><input id="vibeInput" maxlength="200" placeholder="e.g. cozy rainy pub night, loud game day, fancy date night" value="${esc(lastMenu.vibe || "")}">${micBtn()}</span>
        <button class="applybtn" id="vibeBtn" type="button">Change the look</button>
      </div>
      <span class="note" id="vibeNote">${lastMenu.vibeSummary ? esc(lastMenu.vibeSummary) : "Type or say a vibe and Gemini restyles the menu: layout, lettering, colors and border. The dishes stay the same."}</span>
      <div class="blade-track menu-wait hidden" id="vibeBlade" aria-hidden="true"></div>
    </div>
    <div class="menu-look" role="group" aria-label="Change the menu's look">
      <label>Layout<select data-look="layout">${Object.entries(MENU_LAYOUTS).map(([k, v]) => `<option value="${k}" ${k === layout ? "selected" : ""}>${v}</option>`).join("")}</select></label>
      <label>Font<select data-look="font">${Object.entries(MENU_PAIRS).map(([k, v]) => `<option value="${k}" ${k === fontKey ? "selected" : ""}>${v.label}</option>`).join("")}</select></label>
      <label>Background<input type="color" data-look="bg" value="${th.bg}"></label>
      <label>Text<input type="color" data-look="ink" value="${th.ink}"></label>
      <label>Title and prices<input type="color" data-look="accent" value="${th.accent}"></label>
      <label>Border<select data-look="pattern">${Object.entries(PATTERN_NAMES).map(([k, v]) => `<option value="${k}" ${k === pattern ? "selected" : ""}>${v}</option>`).join("")}</select></label>
      ${look.bg || look.ink || look.accent || look.pattern || look.layout || look.font ? `<button class="linkbtn" id="resetLook" type="button">Back to Gemini's look</button>` : ""}
      ${contrast(th.bg, th.ink) < 4.5 ? `<span class="look-warn">The text is hard to read on this background.</span>` : ""}
    </div>
    <div class="row-actions">
      <button class="applybtn" id="printMenuBtn" type="button">Print the menu</button>
      <button class="ghostbtn dark" id="remakeMenuBtn" type="button">Try another version</button>
      <button class="ghostbtn dark" id="makePictureBtn" type="button">${lastMenu.picture ? "Make a new picture" : "Make a picture with Gemini"}</button>
      <select id="pictureStyle" aria-label="Picture style"><option value="photo" ${lastMenu.pictureStyle !== "illustration" ? "selected" : ""}>Food photo</option><option value="illustration" ${lastMenu.pictureStyle === "illustration" ? "selected" : ""}>Illustration</option></select>
      <label class="ghostbtn dark pic-btn">${lastMenu.picture ? "Use my own picture" : "Add your own picture"}<input type="file" id="menuPicture" accept="image/*" hidden></label>
      ${lastMenu.picture ? `<button class="linkbtn" id="removePicture" type="button">Remove picture</button>` : ""}
      <span class="note" id="pictureNote"></span>
    </div>
    <div class="blade-track menu-wait hidden" id="pictureBlade" aria-hidden="true"></div>
    <p class="note pic-note">Pictures stay in this browser and are only used on this menu. Only add logos or photos you have permission to use. Gemini's pictures never include logos, mascots or words.</p>
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

// A microphone button for a text box drawn by JavaScript. Put it and the box
// inside <span class="voice-field">.
const MIC_SVG = `<svg class="mic-icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M8.5 21h7"/></svg>`;
const micBtn = () => `<button type="button" class="ghostbtn mic-btn" aria-pressed="false" aria-label="Speak instead of typing" title="Speak instead of typing"${SpeechRec ? "" : " hidden"}>${MIC_SVG}</button>`;

function setVoiceButton(btn, listening) {
  btn.classList.toggle("listening", listening);
  btn.setAttribute("aria-pressed", String(listening));
  btn.setAttribute("aria-label", listening ? "Listening. Tap to stop." : "Speak instead of typing");
  btn.title = listening ? "Listening… tap to stop" : "Speak instead of typing";
}

function toggleVoice(btn) {
  if (voice) {
    const same = voice.btn === btn;
    voice.rec.stop();
    if (same) return;
  }
  const input = $(btn.dataset.voiceFor) || btn.closest(".voice-field")?.querySelector("input, textarea");
  if (!input) return;
  const rec = new SpeechRec();
  rec.lang = navigator.language || "en-US";
  rec.interimResults = true;
  const before = input.value.trim();
  voice = { rec, btn };
  setVoiceButton(btn, true);
  rec.onresult = (e) => {
    let said = "";
    for (const r of e.results) said += r[0].transcript;
    input.value = ((before ? before + " " : "") + said.trim()).slice(0, input.maxLength > 0 ? input.maxLength : 2000);
    input.dispatchEvent(new Event("input", { bubbles: true }));   // so forms that save as you type see it
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
// ---------------------------------------------------------- Address
// Each restaurant's full address (supabase/address.sql). Street, city, state
// and ZIP are required for a new restaurant; suite / unit is optional.
const US_STATES = [["AL", "Alabama"], ["AK", "Alaska"], ["AZ", "Arizona"], ["AR", "Arkansas"], ["CA", "California"], ["CO", "Colorado"], ["CT", "Connecticut"],
  ["DE", "Delaware"], ["DC", "District of Columbia"], ["FL", "Florida"], ["GA", "Georgia"], ["HI", "Hawaii"], ["ID", "Idaho"], ["IL", "Illinois"], ["IN", "Indiana"],
  ["IA", "Iowa"], ["KS", "Kansas"], ["KY", "Kentucky"], ["LA", "Louisiana"], ["ME", "Maine"], ["MD", "Maryland"], ["MA", "Massachusetts"], ["MI", "Michigan"],
  ["MN", "Minnesota"], ["MS", "Mississippi"], ["MO", "Missouri"], ["MT", "Montana"], ["NE", "Nebraska"], ["NV", "Nevada"], ["NH", "New Hampshire"],
  ["NJ", "New Jersey"], ["NM", "New Mexico"], ["NY", "New York"], ["NC", "North Carolina"], ["ND", "North Dakota"], ["OH", "Ohio"], ["OK", "Oklahoma"],
  ["OR", "Oregon"], ["PA", "Pennsylvania"], ["RI", "Rhode Island"], ["SC", "South Carolina"], ["SD", "South Dakota"], ["TN", "Tennessee"], ["TX", "Texas"],
  ["UT", "Utah"], ["VT", "Vermont"], ["VA", "Virginia"], ["WA", "Washington"], ["WV", "West Virginia"], ["WI", "Wisconsin"], ["WY", "Wyoming"]];
document.querySelectorAll(".state-select").forEach((sel) => {
  sel.innerHTML = `<option value="">Choose…</option>` + US_STATES.map(([c, n]) => `<option value="${c}">${n}</option>`).join("");
});
const ADDRESS_COLS = ["address_line1", "address_line2", "city", "state", "postal_code"];
const hasAddressCols = (r) => !!r && "address_line1" in r;
function readAddress(p) {
  return { address_line1: $(p + "Street").value.trim(), address_line2: $(p + "Street2").value.trim() || null,
    city: $(p + "City").value.trim(), state: $(p + "State").value, postal_code: $(p + "Zip").value.trim() };
}
function fillAddress(p, r) {
  $(p + "Street").value = r?.address_line1 || ""; $(p + "Street2").value = r?.address_line2 || "";
  $(p + "City").value = r?.city || ""; $(p + "State").value = r?.state || ""; $(p + "Zip").value = r?.postal_code || "";
}
// A problem with the address in words, or "" if it's fine.
function addressProblem(a) {
  if (!a.address_line1) return "Add the street address.";
  if (!a.city) return "Add the city.";
  if (!a.state) return "Choose the state.";
  if (!/^\d{5}(-\d{4})?$/.test(a.postal_code)) return "ZIP should be 5 digits, like 37902.";
  return "";
}
const isMissingAddress = (err) => /42703|PGRST204/.test(err?.code || "") && /address_line|postal_code|city|state/.test(err?.message || "");
const ADDRESS_SETUP = "One more database step: in Supabase, open SQL Editor, run supabase/address.sql, then try again.";
function oneLineAddress(r) {
  if (!r?.address_line1) return "";
  return `${r.address_line1}${r.address_line2 ? `, ${r.address_line2}` : ""}, ${r.city}, ${r.state} ${r.postal_code}`;
}

function openOnboarding(canCancel) {
  $("onboardName").value = "";
  fillAddress("onb", null);
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
  const address = readAddress("onb"), bad = addressProblem(address);
  if (bad) { msg.className = "form-msg"; msg.textContent = bad; return; }
  btn.disabled = true;
  msg.className = "form-msg ok";
  msg.textContent = "Creating your restaurant…";
  let created = null;
  try {
    const seedKey = $("onboardSeed").value;
    const t = window.SEEDS?.[seedKey]?.targets;
    const row = { name, ...address, ...(t ? { target_low: t.low, target_mid: t.mid, target_high: t.high } : {}) };
    const res = await sb.from("restaurants").insert(row).select("*").single();
    if (res.error && isMissingAddress(res.error)) { msg.className = "form-msg"; msg.textContent = ADDRESS_SETUP; return; }
    if (res.error) throw res.error;
    created = res.data;
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
  // The address section shows once supabase/address.sql has been run.
  $("setAddress").classList.toggle("hidden", !hasAddressCols(rest));
  $("setAddress").querySelectorAll("input:not(#setStreet2), select").forEach((x) => { x.required = hasAddressCols(rest); });
  fillAddress("set", rest);
  $("setLow").value = Number(rest.target_low);
  $("setMid").value = Number(rest.target_mid);
  $("setHigh").value = Number(rest.target_high);
  const hasLabor = LABOR_ON && "labor_low" in rest;
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
  if (hasAddressCols(rest)) {
    const address = readAddress("set"), bad = addressProblem(address);
    if (bad) { $("settingsMsg").textContent = bad; return; }
    Object.assign(changes, address);
  }
  if (LABOR_ON && "labor_low" in rest) {
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
  const fromOverview = viewMode === "overview";
  if (fromOverview) { viewMode = "details"; safeSet("line.mode", viewMode); }
  const toTonight = page === "home" && (activePage !== "home" || fromOverview);
  activePage = page;
  window.scrollTo({ top: 0 });
  render();
  if (toTonight) playLogoSplice($("headerLogo"));
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

  // Procurement
  $("page-procurement").addEventListener("click", (e) => {
    if (e.target.closest("#procAddAddress")) { openSettings(); return; }
    const c = e.target.closest("[data-proc-cat]");
    if (c) { proc.cat = c.dataset.procCat; renderProcurement(); return; }
    const go = e.target.closest("[data-proc-go]");
    if (go) procFocus(go.dataset.procGo);
    const ppAdd = e.target.closest("[data-pp-add]");
    if (ppAdd) { priceBook.addFor = ppAdd.dataset.ppAdd; priceBook.addWhere = ppAdd.dataset.ppWhere || ""; renderPricing(); document.querySelector(`[data-pp-form="${ppAdd.dataset.ppAdd}"] input[name=${priceBook.addWhere ? "price" : "where"}]`)?.focus(); return; }
    if (e.target.closest("[data-pp-cancel]")) { priceBook.addFor = null; renderPricing(); return; }
    if (e.target.closest("#ppEstimate")) { estimatePrices(); return; }
    if (e.target.closest("#ppSample")) { e.target.closest("#ppSample").disabled = true; fillSamplePrices(); return; }
    if (e.target.closest("#procRetry")) { proc.loadingFor = ""; proc.sources = null; proc.found = {}; procLoad(); }
  });
  $("page-procurement").addEventListener("submit", (e) => {
    const f = e.target.closest("[data-pp-form]");
    if (f) { e.preventDefault(); savePriceForm(f); }
  });
  $("page-procurement").addEventListener("change", (e) => {
    if (e.target.id === "procRadius") { proc.radius = Number(e.target.value); renderProcurement(); }
    else if (e.target.dataset.procType) { e.target.checked ? proc.show.add(e.target.dataset.procType) : proc.show.delete(e.target.dataset.procType); if (proc.sources) procDrawSources(); }
  });
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
  $("pinAll").addEventListener("click", () => {
    const on = new Set(pinnedTabs());
    const pinAll = !Object.keys(PAGE_NAMES).every((p) => on.has(p));
    setAllPinned(pinAll);
    if (!pinAll) goTo("home");                          // no tabs left: show Tonight
  });
  $("brandHome").addEventListener("click", () => (viewMode === "overview" ? render() : goTo("home")));
  // Hover the logo with a mouse and the blade cuts it again (not on touch; waits for a run to finish).
  const spliceOnHover = (area, logo) => area && logo && area.addEventListener("pointerenter", (e) => {
    if (e.pointerType !== "mouse") return;
    if (Date.now() - (Number(logo.dataset.cutAt) || 0) < 1500) return;
    playLogoSplice(logo);
  });
  spliceOnHover($("headerLogo")?.closest(".brand"), $("headerLogo"));
  spliceOnHover($("authLogo"), $("authLogo"));
  document.querySelectorAll("[data-viewmode]").forEach((b) => b.addEventListener("click", () => setViewMode(b.dataset.viewmode)));
  $("tonight").addEventListener("click", onTonightClick);

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
    if (g) { if (g.dataset.ovDish) selectedDishId = g.dataset.ovDish; goTo(g.dataset.goto); return; }
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
  $("invoiceFile").addEventListener("change", (e) => scanInvoice(e.target.files[0]));
  $("invoiceResult").addEventListener("input", (e) => {
    const t = e.target; if (t.dataset.inv === undefined || !invoiceDraft) return;
    const row = invoiceDraft.rows[+t.dataset.inv], k = t.dataset.k;
    row[k] = t.type === "checkbox" ? t.checked : t.value;
    // Cost per unit = line total / amount received. Change the amount or the total and the cost follows;
    // change the cost and the total follows.
    const q = Number(row.qty), tot = Number(row.total), c = Number(row.cost);
    const put = (key, v) => { row[key] = v; const box = document.querySelector(`#invoiceResult [data-inv="${t.dataset.inv}"][data-k="${key}"]`); if (box) box.value = trimNum(v); };
    if ((k === "qty" || k === "total") && q > 0 && tot >= 0) put("cost", Math.round((tot / q) * 10000) / 10000);
    else if (k === "cost" && q > 0 && c >= 0) put("total", Math.round(c * q * 100) / 100);
    if (["cost", "qty", "total"].includes(t.dataset.k)) {           // keep the arrow in step with the cost per unit
      const row = invoiceDraft.rows[+t.dataset.inv], k = invoiceKnown(row.name), chg = $("invoiceResult").querySelector(`[data-chg="${t.dataset.inv}"]`);
      if (chg && k) chg.innerHTML = invoicePriceChange(k.cost, row.cost);
    }
    if (t.type === "checkbox" || t.dataset.k === "name") { const at = t.selectionStart; renderInvoice(); const again = document.querySelector(`#invoiceResult [data-inv="${t.dataset.inv}"][data-k="${t.dataset.k}"]`); if (again && t.type !== "checkbox") { again.focus(); try { again.setSelectionRange(at, at); } catch { /* ok */ } } }
  });
  $("invoiceResult").addEventListener("click", (e) => {
    if (e.target.closest("#invoiceSave")) saveInvoice();
    else if (e.target.closest("#invoiceCancel")) { invoiceDraft = null; renderInvoice(); }
  });
  $("page-ingredients").addEventListener("click", (e) => { const b = e.target.closest("[data-86]"); if (b && b.dataset["86"]) toggle86(b.dataset["86"]); });
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

  // Voice typing: a microphone button beside every text box (some are drawn later, so listen on the page)
  document.querySelectorAll("[data-voice-for]").forEach((btn) => { btn.hidden = !SpeechRec; });
  document.addEventListener("click", (e) => {
    const btn = e.target.closest(".mic-btn");
    if (btn) { e.preventDefault(); toggleVoice(btn); }
  });

  // Specials
  document.querySelectorAll("[data-mode]").forEach((b) => b.addEventListener("click", () => { if (voice) voice.rec.stop(); menuMode = b.dataset.mode; renderSpecials(); }));
  $("makeMenuBtn").addEventListener("click", () => makeMenu(false));
  $("ideasBtn").addEventListener("click", showIdeas);
  $("ideasResult").addEventListener("click", (e) => {
    const b = e.target.closest("[data-idea]");
    if (b && lastIdeas) { const x = lastIdeas.ideas[+b.dataset.idea]; makeMenu(false, { title: x.title, pitch: x.pitch, dishes: x.dishes }); }
  });
  ["menuColors", "evName", "evPersonal", "ptType", "ptPersonal", "fsBrief", "spNotes"].forEach((id) => $(id).addEventListener("input", renderColorPreview));
  $("menuResult").addEventListener("input", (e) => {
    const k = e.target.dataset.look;
    if (!k || !lastMenu || e.target.type !== "color") return;
    lastMenu.look = { ...(lastMenu.look || {}), [k]: e.target.value.toUpperCase() };
    clearTimeout(lookTimer); lookTimer = setTimeout(renderMenuResult, 120);   // redraw while dragging, not on every pixel
  });
  $("menuResult").addEventListener("change", (e) => {
    if (e.target.dataset.look === "pattern" && lastMenu) { lastMenu.look = { ...(lastMenu.look || {}), pattern: e.target.value }; renderMenuResult(); return; }
    if ((e.target.dataset.look === "layout" || e.target.dataset.look === "font") && lastMenu) {
      lastMenu.look = { ...(lastMenu.look || {}), [e.target.dataset.look]: e.target.value };
      lastMenu.restyled = true; renderMenuResult(); lastMenu.restyled = false; return;
    }
    if (e.target.id === "pictureStyle" && lastMenu) { lastMenu.pictureStyle = e.target.value; return; }
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
    if (e.target.closest("#resetLook")) { if (lastMenu) { delete lastMenu.look; delete lastMenu.vibeSummary; renderMenuResult(); } return; }
    if (e.target.closest("#vibeBtn")) { applyVibe(); return; }
  });
  $("menuResult").addEventListener("keydown", (e) => {
    if (e.target.id === "vibeInput" && e.key === "Enter") { e.preventDefault(); applyVibe(); }
  });
  $("menuResult").addEventListener("click", (e) => {
    if (e.target.closest("#makePictureBtn")) { makePicture(); return; }
    if (e.target.closest("#remakeMenuBtn")) makeMenu(true);
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
        // A new shift brings its usual hours, its schedule, then the POS numbers for them.
        modDraft.shift = val;
        if (!modDraft.data.shifts_edited) modDraft.data.shifts = null;
        [modDraft.data.hours_from, modDraft.data.hours_to] = SHIFT_HOURS[val];
        modDirty = true;
        renderModEditor();
        if (posEnabled) pullMod(true);
        return;
      }
      setPath(modDraft, f, val);
      if (f === "report_date" && val && !modDraft.data.shifts_edited) { modDraft.data.shifts = null; modDirty = true; renderModEditor(); }
      if (f === "report_date" && posEnabled && val) { modDirty = true; pullMod(true); }
    } else if (t.dataset.row) {
      modDraft.data[t.dataset.row][+t.dataset.i][t.dataset.k] = val;
    } else if (t.dataset.hour !== undefined) {
      modDraft.data.hourly[t.dataset.hour] = val;
    } else if (t.dataset.shift !== undefined) {
      const x = modDraft.data.shifts[+t.dataset.shift];
      x[t.dataset.k] = val;
      modDraft.data.shifts_edited = true;
      const cell = document.querySelector(`#modEditor [data-shift-hrs="${t.dataset.shift}"]`);
      if (cell) cell.textContent = shiftHours(x.in, x.out).toFixed(2);
    } else return;
    modDirty = true;
    updateModSummary();
  };
  mod.addEventListener("input", onModInput);
  mod.addEventListener("change", (e) => { if (e.target.tagName === "SELECT" || e.target.type === "checkbox") onModInput(e); });
  // Remember which sections are open while the report is redrawn.
  mod.addEventListener("toggle", (e) => {
    const sec = e.target.closest?.("details[data-sec]");
    if (sec) sec.open ? modOpen.add(sec.dataset.sec) : modOpen.delete(sec.dataset.sec);
  }, true);
  mod.addEventListener("click", (e) => {
    const t = e.target.closest("button");
    if (!t || !modDraft) return;
    if (t.dataset.editSec) {
      e.preventDefault();   // don't fold the section when Edit / Done is clicked
      const k = t.dataset.editSec;
      if (modEditing.has(k)) modEditing.delete(k); else { modEditing.add(k); modOpen.add(k); }
      renderModEditor();
      if (modEditing.has(k)) document.querySelector(`#modEditor [data-sec="${k}"] .ms-body input, #modEditor [data-sec="${k}"] .ms-body textarea, #modEditor [data-sec="${k}"] .ms-body select`)?.focus();
      return;
    }
    if (t.dataset.add) { modDraft.data[t.dataset.add].push(LIST_ROWS[t.dataset.add]()); modDirty = true; renderModEditor(); }
    else if (t.dataset.delRow) { const [list, i] = t.dataset.delRow.split(":"); modDraft.data[list].splice(+i, 1); modDirty = true; renderModEditor(); }
    else if (t.id === "pullPosBtn") pullMod();
    else if (t.id === "saveReportBtn") saveReport();
    else if (t.id === "deleteReportBtn") deleteReport();
    else if (t.id === "printReportBtn") printReport();
  });

  // Warn before closing the tab with unsaved recipe or report edits.
  window.addEventListener("beforeunload", (e) => { if (draftDirty || modDirty) { e.preventDefault(); e.returnValue = ""; } });
}
