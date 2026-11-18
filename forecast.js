// =====================================================================
// The Line: Demand Forecaster (baseline)
// Predicts plates per dish for the coming weeks from the Weekly Sales
// history, adjusted for the season and for holiday weeks.
//
// The model, in plain words:
//   1. Season: each month has a "season factor" (1.00 = a normal month).
//      Until there's a year of sales on file we use a starting profile for
//      a casual restaurant in East Tennessee (slow January, busy fall
//      football season, holiday December). With a year or more of history
//      the app learns your own months and blends them in.
//   2. Holidays: weeks with a known holiday get their own nudge
//      (Thanksgiving and Christmas weeks are slow, Valentine's and
//      Mother's Day weeks are busy).
//   3. Baseline: take each dish's recent weeks, remove the season from
//      them, and average them (newer weeks count more).
//   4. Trend: if the last 4 weeks are running above or below the 4 before
//      them, carry a small, fading share of that forward (capped).
//   5. Forecast = baseline x trend x season x holiday x your own % for
//      that week (e.g. +20% for a home game or a big event).
// Settings (season profile, weekly %) are saved in this browser per
// restaurant. Uses globals from app.js: rest, dishes, salesByWeek,
// ingredients, $, esc, fmt0, fmtDay, addDays, parseDay, dayStr, mondayOf.
// =====================================================================
"use strict";

const FC_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
// Starting season profile (1.00 = normal). Why each month is where it is:
const FC_DEFAULT_SEASON = [0.86, 0.92, 0.98, 1.00, 1.04, 1.02, 0.98, 0.98, 1.06, 1.08, 1.00, 1.04];
const FC_SEASON_WHY = [
  "Post-holiday slump, resolutions, cold weather",
  "Still slow, cold weather",
  "Spring break, weather warming up",
  "Patio season starts",
  "Graduations, Mother's Day",
  "Summer travel, steady",
  "Locals on vacation, heat",
  "Back to school, students return",
  "Football season starts",
  "Peak fall: football, fall break",
  "Steady; holiday shopping starts",
  "Holiday parties and gatherings",
];

// ---------------------------------------------------------------- holidays
function fcNthWeekday(y, m, weekday, n) {            // e.g. 4th Thursday of November
  const d = new Date(y, m, 1);
  d.setDate(1 + ((weekday - d.getDay() + 7) % 7) + 7 * (n - 1));
  return d;
}
function fcLastWeekday(y, m, weekday) {
  const d = new Date(y, m + 1, 0);
  d.setDate(d.getDate() - ((d.getDay() - weekday + 7) % 7));
  return d;
}
function fcEaster(y) {                                // Anonymous Gregorian algorithm
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4;
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(y, month - 1, day);
}
function fcHolidays(y) {
  return [
    { name: "New Year's Day", date: new Date(y, 0, 1), f: 0.95 },
    { name: "Super Bowl", date: fcNthWeekday(y, 1, 0, 2), f: 1.03 },
    { name: "Valentine's Day", date: new Date(y, 1, 14), f: 1.10 },
    { name: "St. Patrick's Day", date: new Date(y, 2, 17), f: 1.03 },
    { name: "Easter", date: fcEaster(y), f: 1.04 },
    { name: "Mother's Day", date: fcNthWeekday(y, 4, 0, 2), f: 1.12 },
    { name: "Memorial Day", date: fcLastWeekday(y, 4, 1), f: 1.02 },
    { name: "Father's Day", date: fcNthWeekday(y, 5, 0, 3), f: 1.05 },
    { name: "Fourth of July", date: new Date(y, 6, 4), f: 0.94 },
    { name: "Labor Day", date: fcNthWeekday(y, 8, 1, 1), f: 1.02 },
    { name: "Halloween", date: new Date(y, 9, 31), f: 0.97 },
    { name: "Thanksgiving", date: fcNthWeekday(y, 10, 4, 4), f: 0.85 },
    { name: "Christmas", date: new Date(y, 11, 25), f: 0.80 },
    { name: "New Year's Eve", date: new Date(y, 11, 31), f: 1.06 },
  ];
}
// Holidays that fall in the Monday-Sunday week starting `week`.
function fcHolidaysIn(week) {
  const start = parseDay(week), end = parseDay(addDays(week, 6));
  return [start.getFullYear(), end.getFullYear()].filter((y, i, a) => a.indexOf(y) === i)
    .flatMap(fcHolidays).filter((h) => h.date >= start && h.date <= end);
}
function fcHolidayFactor(week) { return fcHolidaysIn(week).reduce((p, h) => p * h.f, 1); }

// ---------------------------------------------------------------- settings
let fcHorizon = 8;          // weeks ahead
let fcDishView = "next";    // per-dish table: "next" week or the whole "range"

function fcKey() { return "line.forecast." + (rest?.id || "none"); }
function fcSettings() {
  let s = {};
  try { s = JSON.parse(safeGet(fcKey()) || "{}") || {}; } catch { s = {}; }
  if (!Array.isArray(s.season) || s.season.length !== 12) s.season = null;   // null = use default/learned
  if (!s.adjust || typeof s.adjust !== "object") s.adjust = {};
  if (typeof s.useSeason !== "boolean") s.useSeason = true;
  if (typeof s.useHolidays !== "boolean") s.useHolidays = true;
  return s;
}
function fcSave(s) { safeSet(fcKey(), JSON.stringify(s)); }

// ---------------------------------------------------------------- the model
// Thursday decides which month a Monday-Sunday week belongs to.
function fcMonthOf(week) { return parseDay(addDays(week, 3)).getMonth(); }

// Weeks on file, oldest first, with total plates and plates per dish.
function fcHistory() {
  return [...salesByWeek.keys()].sort().map((w) => {
    const m = salesByWeek.get(w);
    let total = 0;
    for (const d of dishes) total += m.get(d.id) || 0;
    return { week: w, m, total };
  }).filter((h) => h.total > 0);
}

// Learn month factors from your own sales once there's at least a year.
function fcLearnedSeason(hist) {
  if (hist.length < 2) return null;
  const spanWeeks = (parseDay(hist[hist.length - 1].week) - parseDay(hist[0].week)) / (7 * 864e5) + 1;
  if (spanWeeks < 52) return null;
  const overall = hist.reduce((a, h) => a + h.total, 0) / hist.length;
  const sums = Array(12).fill(0), counts = Array(12).fill(0);
  for (const h of hist) { const mo = fcMonthOf(h.week); sums[mo] += h.total; counts[mo]++; }
  const weight = Math.min(1, 0.5 + (spanWeeks - 52) / 104);       // 50% at 1 year, 100% at 2+ years
  const learned = sums.map((s, i) => (counts[i] >= 2 ? s / counts[i] / overall : null));
  return { learned, weight, spanWeeks };
}

// The 12 month factors actually used, and where they came from.
function fcSeasonProfile(hist, s) {
  if (!s.useSeason) return { f: Array(12).fill(1), source: "off" };
  if (s.season) return { f: s.season, source: "custom" };
  const L = fcLearnedSeason(hist);
  if (!L) return { f: FC_DEFAULT_SEASON.slice(), source: "default" };
  // Learned months are relative to your average; the starting profile is too, so they blend directly.
  const f = FC_DEFAULT_SEASON.map((d, i) => (L.learned[i] == null ? d : d * (1 - L.weight) + L.learned[i] * L.weight));
  return { f, source: "learned", weight: L.weight };
}

function fcWeekFactor(week, season, s) {
  return season[fcMonthOf(week)] * (s.useHolidays ? fcHolidayFactor(week) : 1);
}

// Forecast one series (an array of {week, units} oldest first) for `weeks`.
function fcSeries(points, weeks, season, s) {
  const recent = points.slice(-12);
  if (!recent.length) return { base: 0, trend: 1, cv: 0, out: weeks.map(() => 0) };
  const des = recent.map((p) => p.units / fcWeekFactor(p.week, season, s));     // season removed
  // Baseline: weighted average, newest weeks count most (weights 1, 1.25, 1.5, ...).
  let num = 0, den = 0;
  des.forEach((v, i) => { const w = 1 + i * 0.25; num += v * w; den += w; });
  const base = num / den;
  // Trend: last 4 vs. the 4 before, as a weekly rate, capped at +/-3% a week.
  let rate = 0;
  if (des.length >= 8) {
    const a = des.slice(-4).reduce((x, y) => x + y, 0) / 4, b = des.slice(-8, -4).reduce((x, y) => x + y, 0) / 4;
    if (b > 0) rate = Math.max(-0.03, Math.min(0.03, (a / b - 1) / 4));
  }
  // How bumpy the history is (for the low-high range).
  const mean = des.reduce((x, y) => x + y, 0) / des.length;
  const sd = Math.sqrt(des.reduce((x, y) => x + (y - mean) ** 2, 0) / Math.max(1, des.length - 1));
  const cv = mean > 0 ? sd / mean : 0;
  let lift = 1, damp = 1;
  const out = weeks.map((w) => {
    damp *= 0.85; lift *= 1 + rate * damp;                                       // trend fades out
    const adj = 1 + (Number(s.adjust[w]) || 0) / 100;
    return Math.max(0, base * lift * fcWeekFactor(w, season, s) * adj);
  });
  // With a year or more on file, lean on the same weeks last year.
  const yoy = fcYoY(points, weeks, s);
  if (yoy) yoy.out.forEach((v, i) => { if (v != null) out[i] = Math.max(0, FC_YOY_WEIGHT * v + (1 - FC_YOY_WEIGHT) * out[i]); });
  return { base, rate, cv, out, yoy: yoy ? yoy.growth : null };
}

// Year over year: next week ≈ the same week last year × how this year is
// running against last year (last 8 weeks vs. the same 8 weeks a year
// before). Holidays that moved (Thanksgiving, Easter) are evened out.
const FC_YOY_WEIGHT = 0.7;   // 70% last year's pattern, 30% the recent-weeks model
function fcYoY(points, weeks, s) {
  if (points.length < 52) return null;
  const span = (parseDay(points[points.length - 1].week) - parseDay(points[0].week)) / (7 * 864e5) + 1;
  if (span < 52) return null;
  const map = new Map(points.map((p) => [p.week, p.units]));
  const hol = (w) => (s.useHolidays ? fcHolidayFactor(w) : 1);
  // Last year's week, holiday removed, smoothed with the weeks either side (1-2-1).
  const lastYear = (w) => {
    const c = addDays(w, -364);
    let num = 0, den = 0;
    [[-7, 1], [0, 2], [7, 1]].forEach(([d, k]) => {
      const wk = addDays(c, d);
      if (map.has(wk)) { num += (map.get(wk) / hol(wk)) * k; den += k; }
    });
    return den && map.has(c) ? num / den : null;
  };
  let now = 0, then = 0;
  for (const p of points.slice(-8)) {
    const ly = map.get(addDays(p.week, -364));
    if (ly != null) { now += p.units; then += ly; }
  }
  if (then <= 0) return null;
  const growth = Math.max(0.75, Math.min(1.35, now / then));
  const out = weeks.map((w) => {
    const ly = lastYear(w);
    return ly == null ? null : ly * growth * hol(w) * (1 + (Number(s.adjust[w]) || 0) / 100);
  });
  return out.some((v) => v != null) ? { growth, out } : null;
}

function fcCompute() {
  const s = fcSettings();
  const hist = fcHistory();
  const prof = fcSeasonProfile(hist, s);
  const start = dayStr(mondayOf(new Date()));
  const lastOnFile = hist.length ? hist[hist.length - 1].week : null;
  // Forecast from the week after the last saved week, or this week, whichever is later.
  const first = lastOnFile && addDays(lastOnFile, 7) > start ? addDays(lastOnFile, 7) : start;
  const weeks = Array.from({ length: fcHorizon }, (_, i) => addDays(first, 7 * i));
  const perDish = dishes.map((d) => {
    const pts = hist.map((h) => ({ week: h.week, units: h.m.get(d.id) || 0 }));
    const r = fcSeries(pts, weeks, prof.f, s);
    const last4 = pts.slice(-4);
    const avg4 = last4.length ? last4.reduce((a, p) => a + p.units, 0) / last4.length : 0;
    return { d, ...r, avg4 };
  });
  const totals = weeks.map((_, i) => perDish.reduce((a, r) => a + r.out[i], 0));
  const revenue = weeks.map((_, i) => perDish.reduce((a, r) => a + r.out[i] * r.d.price, 0));
  const totalSeries = fcSeries(hist.map((h) => ({ week: h.week, units: h.total })), weeks, prof.f, s);
  const spread = Math.max(0.08, Math.min(0.35, totalSeries.cv * (hist.length < 6 ? 1.5 : 1)));
  return { s, hist, prof, weeks, perDish, totals, revenue, spread, yoy: totalSeries.yoy };
}

// ---------------------------------------------------------------- render
function renderForecast() {
  const page = $("forecastWrap");
  if (!dishes.length) {
    page.innerHTML = `<div class="chart-card empty"><h3>No dishes yet</h3><p>Add your dishes and their recipes first. The forecast is built from them.</p>
      <button class="applybtn" data-goto="recipes" type="button">Go to Recipes</button></div>`;
    return;
  }
  const F = fcCompute();
  if (!F.hist.length) {
    page.innerHTML = `<div class="chart-card empty"><h3>No sales history yet</h3><p>The forecaster learns from the plates you've sold. Enter at least a few weeks of sales to get a forecast. More weeks give a better one.</p>
      <div class="row-actions"><button class="applybtn" data-goto="sales" type="button">Enter weekly sales</button>
      <button class="ghostbtn dark" id="fcLoadSample" type="button">Load last year's sample POS sales</button></div></div>`;
    return;
  }
  const { s, hist, prof, weeks, perDish, totals, revenue, spread, yoy } = F;
  const n = weeks.length;
  const next = totals[0], nextRev = revenue[0];
  const lastActual = hist[hist.length - 1].total;
  const rangeRev = revenue.reduce((a, b) => a + b, 0);
  const curMonth = fcMonthOf(weeks[0]);
  const seasonPct = Math.round((prof.f[curMonth] - 1) * 100);
  const chg = lastActual ? ((next - lastActual) / lastActual) * 100 : 0;
  const conf = hist.length >= 52 ? "Good" : hist.length >= 12 ? "Fair" : "Low";
  const yoyPct = yoy ? Math.round((yoy - 1) * 100) : 0;
  const confWhy = yoy ? `built from the same weeks last year, and you're running ${yoyPct >= 0 ? "+" : ""}${yoyPct}% vs. last year`
    : hist.length >= 52 ? "a year or more of sales on file"
    : `${hist.length} week${hist.length === 1 ? "" : "s"} of sales on file. ${hist.length < 12 ? "12+ weeks makes this much steadier" : "A full year lets it learn your own seasons"}`;
  const sourceText = { off: "Seasons are turned off.", custom: "Using your own season profile.",
    default: "Using the starting season profile. Once you have a year of sales, the app learns your own months.",
    learned: `Blending your own sales history (${Math.round((prof.weight || 0) * 100)}%) with the starting profile.` }[prof.source];

  page.innerHTML = `
    ${fcSampleCard(hist, s)}
    <div class="metrics flush">
      <div class="metric"><div class="num mono">${Math.round(next).toLocaleString()}</div><div class="label">Plates forecast, ${fmtFcWeek(weeks[0])} (${chg >= 0 ? "+" : ""}${chg.toFixed(0)}% vs. last week on file)</div></div>
      <div class="metric"><div class="num mono">${fmt0(nextRev)}</div><div class="label">Sales forecast, ${fmtFcWeek(weeks[0])}</div></div>
      <div class="metric"><div class="num mono">${fmt0(rangeRev)}</div><div class="label">Sales forecast, next ${n} weeks</div></div>
      <div class="metric"><div class="num mono">${seasonPct >= 0 ? "+" : ""}${seasonPct}%</div><div class="label">Season effect in ${FC_MONTHS[curMonth]}: ${esc(FC_SEASON_WHY[curMonth].toLowerCase())}</div></div>
    </div>

    <div class="chart-card">
      <div class="chart-head">
        <h3>Plates per week: what you sold, and what's coming</h3>
        <span class="note">Confidence: <strong>${conf}</strong>, ${esc(confWhy)}.</span>
      </div>
      <div class="toolbar">
        <label class="stack">Weeks ahead
          <select id="fcHorizon">${[4, 8, 12, 16].map((v) => `<option value="${v}" ${v === fcHorizon ? "selected" : ""}>${v} weeks</option>`).join("")}</select>
        </label>
        <label class="inline fc-check"><input type="checkbox" id="fcUseSeason" ${s.useSeason ? "checked" : ""}> Adjust for the season</label>
        <label class="inline fc-check"><input type="checkbox" id="fcUseHolidays" ${s.useHolidays ? "checked" : ""}> Adjust for holidays</label>
      </div>
      <div id="fcChart" class="fc-chart"></div>
      <p class="note fc-legend"><span class="fc-key fc-key-actual"></span>Plates sold <span class="fc-key fc-key-fc"></span>Forecast <span class="fc-key fc-key-band"></span>Likely range (±${Math.round(spread * 100)}%)</p>
    </div>

    <div class="chart-card">
      <div class="chart-head"><h3>Week by week</h3><span class="note">Know about a home game, a festival or a big party? Add a % to that week.</span></div>
      <div class="scroll-x"><table class="edit" id="fcWeeksTable">
        <thead><tr><th>Week</th><th>What's going on</th><th class="num">Season</th><th class="num">Your adjustment (%)</th><th class="num">Plates</th><th class="num">Likely range</th><th class="num">Sales</th></tr></thead>
        <tbody>${weeks.map((w, i) => {
          const hol = s.useHolidays ? fcHolidaysIn(w) : [];
          const sf = fcWeekFactor(w, prof.f, s);
          const notes = hol.map((h) => `${esc(h.name)} (${h.f >= 1 ? "+" : ""}${Math.round((h.f - 1) * 100)}%)`);
          if (s.useSeason) notes.push(esc(FC_SEASON_WHY[fcMonthOf(w)]));
          return `<tr><td>${fmtFcWeek(w)}</td><td class="used">${notes.join("; ") || "—"}</td>
            <td class="num mono">${sfLabel(sf)}</td>
            <td class="num"><input class="num mono short" type="number" step="5" min="-90" max="300" data-fc-adjust="${w}" value="${s.adjust[w] ?? ""}" placeholder="0"></td>
            <td class="num mono"><strong>${Math.round(totals[i]).toLocaleString()}</strong></td>
            <td class="num mono">${Math.round(totals[i] * (1 - spread)).toLocaleString()}–${Math.round(totals[i] * (1 + spread)).toLocaleString()}</td>
            <td class="num mono">${fmt0(revenue[i])}</td></tr>`;
        }).join("")}</tbody>
      </table></div>
    </div>

    <div class="chart-card">
      <div class="chart-head">
        <h3>By dish</h3>
        <div class="mode-pick" role="group" aria-label="Which weeks">
          <button type="button" data-fc-dishview="next" aria-pressed="${fcDishView === "next"}">${fmtFcWeek(weeks[0])}</button>
          <button type="button" data-fc-dishview="range" aria-pressed="${fcDishView === "range"}">Next ${n} weeks</button>
        </div>
      </div>
      <div class="scroll-x"><table class="perf">
        <thead><tr><th>Dish</th><th>Category</th><th class="num">Avg. last 4 weeks</th><th class="num">Forecast</th><th class="num">Change</th><th>Trend</th></tr></thead>
        <tbody>${[...perDish].sort((a, b) => b.out[0] - a.out[0]).map((r) => {
          const fc = fcDishView === "next" ? r.out[0] : r.out.reduce((a, b) => a + b, 0);
          const cmp = fcDishView === "next" ? r.avg4 : r.avg4 * n;
          const c = cmp ? ((fc - cmp) / cmp) * 100 : 0;
          const tr = !r.rate || Math.abs(r.rate) < 0.004 ? "Steady" : r.rate > 0 ? "▲ Picking up" : "▼ Slowing";
          return `<tr><td>${esc(r.d.name)}</td><td class="used">${esc(r.d.category || "")}</td>
            <td class="num mono">${Math.round(cmp).toLocaleString()}</td><td class="num mono"><strong>${Math.round(fc).toLocaleString()}</strong></td>
            <td class="num mono">${cmp ? `${c >= 0 ? "+" : ""}${c.toFixed(0)}%` : "new"}</td><td>${tr}</td></tr>`;
        }).join("")}</tbody>
      </table></div>
    </div>

    <div class="chart-card">
      <div class="chart-head"><h3>What to have on hand for ${fmtFcWeek(weeks[0])}</h3><span class="note">Forecast plates × your recipes, plus 10% buffer</span></div>
      <div class="scroll-x"><table class="perf">${fcPrepRows(perDish)}</table></div>
    </div>

    <div class="chart-card">
      <div class="chart-head"><h3>Season profile</h3><span class="note">${esc(sourceText)}</span></div>
      <p class="note" style="margin:0 0 12px">100 = a normal month. 110 means expect about 10% more plates that month. Change a month to match your restaurant.</p>
      <div class="fc-season">${prof.f.map((v, i) => `<label class="fc-month">
          <span class="fc-bar"><span style="height:${Math.max(4, Math.min(100, (v - 0.6) / 0.6 * 100)).toFixed(0)}%"></span></span>
          <span class="fc-mname">${FC_MONTHS[i]}</span>
          <input class="num mono" type="number" min="30" max="200" step="1" data-fc-month="${i}" value="${Math.round(v * 100)}" ${s.useSeason ? "" : "disabled"} title="${esc(FC_SEASON_WHY[i])}" aria-label="${FC_MONTHS[i]} season factor">
        </label>`).join("")}</div>
      <div class="row-actions">
        <button class="ghostbtn dark" id="fcResetSeason" type="button" ${s.season ? "" : "disabled"}>Go back to the automatic profile</button>
        <button class="ghostbtn dark" id="fcClearAdjust" type="button" ${Object.keys(s.adjust).length ? "" : "disabled"}>Clear my weekly adjustments</button>
      </div>
    </div>`;

  fcDrawChart(hist.slice(-16), weeks, totals, spread);
}

function fmtFcWeek(w) { return "week of " + parseDay(w).toLocaleDateString(undefined, { month: "short", day: "numeric" }); }
function sfLabel(f) { const p = Math.round((f - 1) * 100); return p === 0 ? "normal" : (p > 0 ? "+" : "") + p + "%"; }

function fcPrepRows(perDish) {
  const need = new Map();
  for (const r of perDish) for (const it of r.d.items) need.set(it.ingredient_id, (need.get(it.ingredient_id) || 0) + it.qty * r.out[0] * 1.1);
  const rows = [...need].map(([id, q]) => ({ ing: ingredients.get(id), q })).filter((x) => x.ing && x.q > 0)
    .sort((a, b) => b.q * b.ing.cost - a.q * a.ing.cost);
  if (!rows.length) return `<tbody><tr><td class="muted">Add recipes to your dishes to see ingredient amounts here.</td></tr></tbody>`;
  const showStock = rows.some((x) => x.ing.on_hand != null);
  const qty = (v) => (v >= 100 ? Math.round(v).toLocaleString() : v.toFixed(1));
  return `<thead><tr><th>Ingredient</th><th class="num">Need</th>${showStock ? `<th class="num">On hand</th><th class="num">Short by</th>` : ""}<th class="num">Est. cost</th></tr></thead>
    <tbody>${rows.map(({ ing, q }) => {
      const short = ing.on_hand == null ? null : Math.max(0, q - ing.on_hand);
      return `<tr><td>${esc(ing.name)}</td><td class="num mono">${qty(q)} ${esc(ing.unit)}</td>
        ${showStock ? `<td class="num mono">${ing.on_hand == null ? "—" : `${qty(ing.on_hand)} ${esc(ing.unit)}`}</td>
          <td class="num mono">${short == null ? "—" : short > 0 ? `<strong>${qty(short)} ${esc(ing.unit)}</strong>` : "Covered"}</td>` : ""}
        <td class="num mono">${fmt0(q * ing.cost)}</td></tr>`;
    }).join("")}</tbody>`;
}

// Line chart: actual plates (solid), forecast (dashed) with a shaded likely range.
function fcDrawChart(past, weeks, totals, spread) {
  const W = 760, H = 300, L = 56, R = 16, T = 16, B = 40;
  const pts = [...past.map((h) => ({ week: h.week, v: h.total, kind: "actual" })),
    ...weeks.map((w, i) => ({ week: w, v: totals[i], kind: "fc", lo: totals[i] * (1 - spread), hi: totals[i] * (1 + spread) }))];
  const maxV = Math.max(1, ...pts.map((p) => p.hi || p.v)) * 1.08;
  const t0 = parseDay(pts[0].week).getTime(), t1 = parseDay(pts[pts.length - 1].week).getTime();
  const x = (w) => L + (t1 === t0 ? 0.5 : (parseDay(w).getTime() - t0) / (t1 - t0)) * (W - L - R);
  const y = (v) => T + (1 - v / maxV) * (H - T - B);
  const font = `font-family="Verdana, Geneva, sans-serif"`;
  const path = (arr) => arr.map((p, i) => `${i ? "L" : "M"}${x(p.week).toFixed(1)},${y(p.v).toFixed(1)}`).join("");
  const act = pts.filter((p) => p.kind === "actual"), fc = pts.filter((p) => p.kind === "fc");
  const fcLine = act.length ? [act[act.length - 1], ...fc] : fc;       // join the forecast to the last actual week
  const band = fc.length ? `M${fc.map((p) => `${x(p.week).toFixed(1)},${y(p.hi).toFixed(1)}`).join("L")}L${[...fc].reverse().map((p) => `${x(p.week).toFixed(1)},${y(p.lo).toFixed(1)}`).join("L")}Z` : "";
  const step = (() => { const raw = maxV / 4, p = 10 ** Math.floor(Math.log10(raw)); return [1, 2, 5, 10].map((m) => m * p).find((v) => v >= raw); })();
  let grid = "";
  for (let v = 0; v <= maxV; v += step) {
    grid += `<line x1="${L}" x2="${W - R}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}" style="stroke:var(--line)" stroke-width="1"/>` +
      `<text x="${L - 8}" y="${(y(v) + 4).toFixed(1)}" ${font} font-size="11" text-anchor="end" style="fill:var(--ink)">${v.toLocaleString()}</text>`;
  }
  const every = Math.ceil(pts.length / 8);
  const xl = pts.map((p, i) => (i % every === 0 || i === pts.length - 1)
    ? `<text x="${x(p.week).toFixed(1)}" y="${H - B + 18}" ${font} font-size="11" text-anchor="middle" style="fill:var(--ink)">${parseDay(p.week).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</text>` : "").join("");
  const todayX = fc.length ? x(fc[0].week) - (act.length ? (x(fc[0].week) - x(act[act.length - 1].week)) / 2 : 0) : null;
  const hits = pts.map((p, i) => {
    const prev = i ? x(pts[i - 1].week) : L, nxt = i < pts.length - 1 ? x(pts[i + 1].week) : W - R, cx = x(p.week);
    const l = i ? (prev + cx) / 2 : L, r = i < pts.length - 1 ? (cx + nxt) / 2 : W - R;
    return `<rect class="fc-hit" data-i="${i}" x="${l.toFixed(1)}" y="${T}" width="${(r - l).toFixed(1)}" height="${H - T - B}" fill="transparent"/>`;
  }).join("");
  const el = $("fcChart");
  el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;display:block" role="img" aria-label="Plates sold per week and the forecast for the coming weeks">
      ${grid}
      ${band ? `<path d="${band}" style="fill:var(--butter)" fill-opacity="0.22"/>` : ""}
      ${todayX ? `<line x1="${todayX.toFixed(1)}" x2="${todayX.toFixed(1)}" y1="${T}" y2="${H - B}" style="stroke:var(--ink)" stroke-opacity="0.4" stroke-dasharray="3 4"/>
        <text x="${(todayX + 6).toFixed(1)}" y="${T + 12}" ${font} font-size="11" style="fill:var(--ink)">Forecast →</text>` : ""}
      ${act.length > 1 ? `<path d="${path(act)}" fill="none" style="stroke:var(--green)" stroke-width="2" stroke-linejoin="round"/>` : ""}
      <path d="${path(fcLine)}" fill="none" style="stroke:var(--butter)" stroke-width="2" stroke-dasharray="6 4" stroke-linejoin="round"/>
      ${act.map((p) => `<circle cx="${x(p.week).toFixed(1)}" cy="${y(p.v).toFixed(1)}" r="4" style="fill:var(--green);stroke:var(--surface)" stroke-width="2"/>`).join("")}
      ${fc.map((p) => `<circle cx="${x(p.week).toFixed(1)}" cy="${y(p.v).toFixed(1)}" r="4" style="fill:var(--surface);stroke:var(--butter)" stroke-width="2"/>`).join("")}
      <line class="fc-cross" x1="0" x2="0" y1="${T}" y2="${H - B}" style="stroke:var(--ink)" stroke-opacity="0.5" visibility="hidden"/>
      <line x1="${L}" x2="${W - R}" y1="${H - B}" y2="${H - B}" style="stroke:var(--ink)" stroke-opacity="0.6"/>
      ${xl}${hits}
    </svg><div class="fc-tip" hidden></div>`;
  const svg = el.querySelector("svg"), tip = el.querySelector(".fc-tip"), cross = el.querySelector(".fc-cross");
  const hide = () => { tip.hidden = true; cross.setAttribute("visibility", "hidden"); };
  svg.addEventListener("pointermove", (e) => {
    const r = e.target.closest(".fc-hit");
    if (!r) return hide();
    const p = pts[Number(r.dataset.i)], cx = x(p.week);
    cross.setAttribute("x1", cx); cross.setAttribute("x2", cx); cross.setAttribute("visibility", "visible");
    tip.innerHTML = `<strong>${fmtFcWeek(p.week).replace(/^w/, "W")}</strong><br>` + (p.kind === "actual"
      ? `Sold: ${Math.round(p.v).toLocaleString()} plates`
      : `Forecast: ${Math.round(p.v).toLocaleString()} plates<br>Likely ${Math.round(p.lo).toLocaleString()}–${Math.round(p.hi).toLocaleString()}`);
    tip.hidden = false;
    const box = el.getBoundingClientRect(), px = (cx / W) * box.width;
    tip.style.left = Math.min(Math.max(0, px - tip.offsetWidth / 2), box.width - tip.offsetWidth) + "px";
  });
  svg.addEventListener("pointerleave", hide);
}

// ---------------------------------------------------------------- events
document.addEventListener("DOMContentLoaded", () => {
  const page = $("page-forecast");
  if (!page) return;
  const update = (fn) => { const s = fcSettings(); fn(s); fcSave(s); renderForecast(); };
  page.addEventListener("change", (e) => {
    const t = e.target;
    if (t.id === "fcHorizon") { fcHorizon = Number(t.value) || 8; renderForecast(); }
    else if (t.id === "fcUseSeason") update((s) => { s.useSeason = t.checked; });
    else if (t.id === "fcUseHolidays") update((s) => { s.useHolidays = t.checked; });
    else if (t.dataset.fcAdjust) update((s) => {
      const v = Number(t.value);
      if (t.value === "" || !v) delete s.adjust[t.dataset.fcAdjust];
      else s.adjust[t.dataset.fcAdjust] = Math.max(-90, Math.min(300, v));
    });
    else if (t.dataset.fcMonth) update((s) => {
      const cur = fcSeasonProfile(fcHistory(), s).f.slice();
      const v = Number(t.value);
      if (v > 0) cur[Number(t.dataset.fcMonth)] = Math.max(0.3, Math.min(2, v / 100));
      s.season = cur;
    });
  });
  page.addEventListener("click", (e) => {
    const t = e.target;
    if (t.id === "fcLoadSample") fcLoadSample(t);
    else if (t.id === "fcRemoveSample") fcRemoveSample(t);
    else if (t.id === "fcResetSeason") update((s) => { s.season = null; });
    else if (t.id === "fcClearAdjust") update((s) => { s.adjust = {}; });
    else if (t.dataset.fcDishview) { fcDishView = t.dataset.fcDishview; renderForecast(); }
  });
});

// ---------------------------------------------------------------- sample POS sales
// For the demo: a year of made-up weekly sales "as if from your POS", so
// the forecaster has last year to learn from. Each dish starts from its own
// recent average, then follows the season, holidays, fall football weeks
// and (for a pub) a big St. Patrick's week. Last year runs about 5% lower.
const FC_SAMPLE_WEEKS = 60;

function fcRand(seed) {                               // small seeded random, 0..1
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function fcHash(str) { let h = 2166136261; for (const c of str) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; }

function fcLongDay(w) { return parseDay(w).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }); }
function fcSampleCard(hist, s) {
  const span = hist.length ? (parseDay(hist[hist.length - 1].week) - parseDay(hist[0].week)) / (7 * 864e5) + 1 : 0;
  if (s.sample) {
    return `<div class="chart-card fc-sample"><div class="chart-head"><h3>Includes sample POS sales</h3>
      <span class="note">The weeks of ${fcLongDay(s.sample.from)} through ${fcLongDay(s.sample.to)} are sample sales, loaded as if from your POS.</span></div>
      <div class="row-actions"><button class="ghostbtn dark" id="fcRemoveSample" type="button">Remove the sample sales</button></div></div>`;
  }
  if (span >= 52) return "";
  return `<div class="chart-card fc-sample"><div class="chart-head"><h3>Forecast from last year</h3>
    <span class="note">With a year of sales on file, the forecast follows the same weeks last year.</span></div>
    <p class="note" style="margin:0 0 12px">You have ${Math.round(span)} week${Math.round(span) === 1 ? "" : "s"} on file. Load a year of sample sales, as if pulled from your POS, to see it work.</p>
    <div class="row-actions"><button class="applybtn" id="fcLoadSample" type="button">Load last year's sample POS sales</button></div></div>`;
}

function fcBuildSample() {
  const hist = fcHistory();
  const season = FC_DEFAULT_SEASON;
  const lastMonday = addDays(dayStr(mondayOf(new Date())), -7);
  const latest = hist.length ? hist[hist.length - 1].week : lastMonday;
  const earliest = hist.length ? hist[0].week : addDays(lastMonday, 7);
  const first = addDays(latest, -7 * (FC_SAMPLE_WEEKS - 1));
  const pub = /irish|pub|kelley|tavern/i.test(rest?.name || "");
  const base = new Map(dishes.map((d) => {
    const pts = hist.map((h) => ({ week: h.week, u: h.m.get(d.id) || 0 })).filter((p) => p.u > 0);
    const b = pts.length ? pts.reduce((a, p) => a + p.u / (season[fcMonthOf(p.week)] * fcHolidayFactor(p.week)), 0) / pts.length : 25;
    return [d.id, b];
  }));
  const rows = [];
  for (let w = first; w < earliest; w = addDays(w, 7)) {
    const back = (parseDay(latest) - parseDay(w)) / (7 * 864e5);       // weeks before the latest week
    const growth = 1 - 0.05 * Math.min(1, back / 52);                    // last year ran ~5% lower
    let f = season[fcMonthOf(w)] * fcHolidayFactor(w) * growth;
    const sat = parseDay(addDays(w, 5)), mo = sat.getMonth();
    if (mo >= 8 && mo <= 10 && Math.floor(sat.getDate() / 7) % 2 === 0) f *= 1.08;   // home football Saturdays
    if (pub && fcHolidaysIn(w).some((h) => h.name === "St. Patrick's Day")) f *= 1.35;
    for (const d of dishes) {
      const r = fcRand(fcHash(d.id + w));
      const noise = 1 + (r() + r() - 1) * 0.08;
      rows.push({ restaurant_id: rest.id, dish_id: d.id, week_start: w, units: Math.max(0, Math.round(base.get(d.id) * f * noise)) });
    }
  }
  return { rows, from: first, to: addDays(earliest, -7) };
}

async function fcLoadSample(btn) {
  if (!dishes.length) { toast("Add your dishes first.", "err"); return; }
  const { rows, from, to } = fcBuildSample();
  if (!rows.length) { toast("You already have a year of sales on file.", "err"); return; }
  btn.disabled = true;
  try {
    for (let i = 0; i < rows.length; i += 500) {
      await run(sb.from("weekly_sales").upsert(rows.slice(i, i + 500), { onConflict: "dish_id,week_start" }));
    }
    const s = fcSettings(); s.sample = { from, to }; fcSave(s);
    await loadRestaurantData();
    render();
    toast(`Loaded ${Math.round(rows.length / dishes.length)} weeks of sample POS sales.`);
  } catch { btn.disabled = false; }
}

async function fcRemoveSample(btn) {
  const s = fcSettings();
  if (!s.sample) return;
  if (!confirm("Remove the sample sales? Your own weeks stay.")) return;
  btn.disabled = true;
  try {
    await run(sb.from("weekly_sales").delete().eq("restaurant_id", rest.id).gte("week_start", s.sample.from).lte("week_start", s.sample.to));
    delete s.sample; fcSave(s);
    await loadRestaurantData();
    render();
    toast("Removed the sample sales.");
  } catch { btn.disabled = false; }
}

// ---------------------------------------------------------------- forecast these changes
// Cost Tracker's "Forecast these changes": what keeping the price, raising
// it, or trimming the portion does to plates, sales and profit.
let fcChangesFor = null;   // dish id whose comparison is open

// How much plates drop when the price goes up (price sensitivity). A typical
// restaurant rule of thumb by kind of dish, until there's price history.
function fcSensitivity(cat) {
  const c = String(cat || "").toLowerCase();
  if (/dessert|sweet/.test(c)) return { e: -1.3, kind: "desserts" };
  if (/side/.test(c)) return { e: -1.2, kind: "sides" };
  if (/starter|app|snack|share/.test(c)) return { e: -1.1, kind: "starters" };
  if (/drink|bev|bar|beer|wine|cocktail/.test(c)) return { e: -0.8, kind: "drinks" };
  if (/main|entr|burger|sandwich|plate|dinner|lunch/.test(c)) return { e: -0.9, kind: "mains" };
  return { e: -1.0, kind: "dishes like this" };
}
const FC_TRIM_DIP = 0.03;   // a smaller portion: assume about 3% fewer plates

function fcChangesHtml(dish, cost) {
  const hist = fcHistory();
  const head = `<div class="fcx-head"><h3>Forecast these changes</h3><button class="linkbtn" type="button" data-fc-changes="${dish.id}">Close</button></div>`;
  if (!hist.length) {
    return `<section class="fcx" aria-label="Forecast these changes">${head}
      <p class="note">There are no sales on file yet, so there's nothing to forecast from. Enter weekly sales, or load last year's sample POS sales on the Demand Forecaster.</p>
      <button class="applybtn" data-goto="forecast" type="button">Open the Demand Forecaster</button></section>`;
  }
  const t = targets();
  const F = fcCompute();
  const r = F.perDish.find((x) => x.d.id === dish.id);
  const n = F.weeks.length;
  const p = dish.price;
  const newPrice = cost / (t.mid / 100);
  const sens = fcSensitivity(dish.category);
  const keepMult = 1, raiseMult = Math.pow(newPrice / p, sens.e), trimMult = 1 - FC_TRIM_DIP;
  const trimCost = p * (t.mid / 100);
  const opts = [
    { key: "keep", name: "Keep it as is", price: p, cost, mult: keepMult },
    { key: "raise", name: `Raise the price to ${fmt(newPrice)}`, price: newPrice, cost, mult: raiseMult },
    { key: "trim", name: `Trim the portion by ${((1 - trimCost / cost) * 100).toFixed(0)}%`, price: p, cost: trimCost, mult: trimMult },
  ].map((o) => {
    const plates = r.out.map((u) => u * o.mult);
    const profit = plates.map((u) => u * (o.price - o.cost));
    const sum = (a) => a.reduce((x, y) => x + y, 0);
    return { ...o, plates, profit, totPlates: sum(plates), totSales: sum(plates) * o.price, totProfit: sum(profit), pct: (o.cost / o.price) * 100 };
  });
  const keep = opts[0];
  const best = opts.reduce((a, b) => (b.totProfit > a.totProfit ? b : a));
  const perWeek = (v) => Math.round(v / n).toLocaleString();
  const diff = (v) => (Math.abs(v) < 0.5 ? "—" : `${v > 0 ? "+" : "−"}${fmt0(Math.abs(v))}`);
  const tenPct = Math.round((1 - Math.pow(1.1, sens.e)) * 100);
  const raise = opts[1], trim = opts[2];
  const lostPlates = Math.round((keep.totPlates - raise.totPlates) / n);
  const summary = best.key === "keep"
    ? `Keeping it as is earns the most over the next ${n} weeks, but food cost stays at ${fmtPct(keep.pct)}.`
    : `${best.key === "raise" ? `Raising the price likely costs about ${lostPlates} plate${lostPlates === 1 ? "" : "s"} a week` : "Trimming the portion likely costs a few plates a week"}, but adds ${fmt0(best.totProfit - keep.totProfit)} in profit over the next ${n} weeks.`;

  return `<section class="fcx" aria-label="Forecast these changes">${head}
    <p class="fcx-lede">${esc(summary)}</p>
    <div class="toolbar"><label class="stack">Weeks ahead
      <select id="fcxHorizon">${[4, 8, 12, 16].map((v) => `<option value="${v}" ${v === fcHorizon ? "selected" : ""}>${v} weeks</option>`).join("")}</select></label></div>
    <div class="scroll-x"><table class="perf fcx-table">
      <thead><tr><th>Option</th><th class="num">Food cost</th><th class="num">Plates a week</th><th class="num">Sales, ${n} wks</th><th class="num">Profit, ${n} wks</th><th class="num">Vs. keeping it</th></tr></thead>
      <tbody>${opts.map((o) => `<tr class="fcx-${o.key}${o === best ? " fcx-best" : ""}">
        <td><span class="fcx-dot"></span>${esc(o.name)}${o === best ? ` <span class="fcx-tag">Most profit</span>` : ""}</td>
        <td class="num mono">${fmtPct(o.pct)}</td>
        <td class="num mono">${perWeek(o.totPlates)}</td>
        <td class="num mono">${fmt0(o.totSales)}</td>
        <td class="num mono"><strong>${fmt0(o.totProfit)}</strong></td>
        <td class="num mono">${o.key === "keep" ? "—" : diff(o.totProfit - keep.totProfit)}</td></tr>`).join("")}</tbody>
    </table></div>
    ${fcChangesChart(F.weeks, opts)}
    <p class="note fcx-note">Profit here is sales minus food cost for this dish. Plates come from the Demand Forecaster${F.yoy ? ", built from the same weeks last year" : ""}.
      After a price change we assume typical price sensitivity for ${esc(sens.kind)}: a 10% price rise usually means about ${tenPct}% fewer plates. Trimming the portion assumes about ${Math.round(FC_TRIM_DIP * 100)}% fewer plates. These are rules of thumb until your POS has price-change history.</p>
  </section>`;
}

// Small line chart: weekly profit for each option.
function fcChangesChart(weeks, opts) {
  const W = 640, H = 200, L = 52, R = 12, T = 12, B = 30;
  const all = opts.flatMap((o) => o.profit);
  const maxV = Math.max(1, ...all) * 1.1, minV = Math.max(0, Math.min(...all) * 0.85);
  const x = (i) => L + (weeks.length === 1 ? 0.5 : i / (weeks.length - 1)) * (W - L - R);
  const y = (v) => T + (1 - (v - minV) / (maxV - minV)) * (H - T - B);
  const font = `font-family="Verdana, Geneva, sans-serif" font-size="11" style="fill:var(--ink)"`;
  const color = { keep: "var(--ink)", raise: "var(--green)", trim: "var(--butter)" };
  const ticks = [minV, (minV + maxV) / 2, maxV].map((v) => `<line x1="${L}" x2="${W - R}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}" style="stroke:var(--line)"/>
    <text x="${L - 6}" y="${(y(v) + 4).toFixed(1)}" text-anchor="end" ${font}>${fmt0(v)}</text>`).join("");
  const every = Math.ceil(weeks.length / 6);
  const xl = weeks.map((w, i) => (i % every === 0)
    ? `<text x="${x(i).toFixed(1)}" y="${H - 10}" text-anchor="middle" ${font}>${parseDay(w).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</text>` : "").join("");
  const lines = opts.map((o) => `<path d="${o.profit.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join("")}" fill="none" style="stroke:${color[o.key]}" stroke-width="2"${o.key === "keep" ? ` stroke-dasharray="5 4" stroke-opacity="0.6"` : ""}/>`).join("");
  return `<div class="fcx-chart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Weekly profit for each option">${ticks}${lines}${xl}</svg>
    <p class="note fc-legend">${opts.map((o) => `<span class="fcx-key fcx-key-${o.key}"></span>${o.key === "keep" ? "Keep it" : o.key === "raise" ? "Raise the price" : "Trim the portion"}`).join(" ")} <span>| profit per week</span></p></div>`;
}

document.addEventListener("click", (e) => {
  const b = e.target.closest("[data-fc-changes]");
  if (!b) return;
  fcChangesFor = fcChangesFor === b.dataset.fcChanges ? null : b.dataset.fcChanges;
  renderPanel();
  if (fcChangesFor) document.querySelector(".fcx")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
});
document.addEventListener("change", (e) => {
  if (e.target.id !== "fcxHorizon") return;
  fcHorizon = Number(e.target.value) || 8;
  renderPanel();
});
