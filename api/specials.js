// =====================================================================
// The Line: POST /api/specials
// Runs on Vercel's server, never in the browser, so the Gemini key stays
// secret. It checks that the caller is signed in to The Line, then asks
// Google Gemini for a menu (weekly specials, a party, a game day or event,
// or "anything goes") built from the restaurant's own ingredients, prices
// and use-by dates. Before writing an occasion menu it looks the occasion up
// with Google Search, so team colors, mascots and sayings are real.
// Other actions: { action: "ideas" } gives 3 menu ideas to choose from,
// { action: "image" } draws a banner picture, and { action: "invoice" }
// reads a photo of a supplier invoice into ingredient lines.
//
// Needs three environment variables in Vercel (Settings → Environment
// Variables): GEMINI_API_KEY, SUPABASE_URL, SUPABASE_KEY. Optional:
// GEMINI_MODEL (defaults to Gemini 3 Flash) and GEMINI_IMAGE_MODEL
// (defaults to Gemini 2.5 Flash Image). Pictures need billing turned on
// for the key in Google AI Studio.
// =====================================================================
"use strict";

const GEMINI = "https://generativelanguage.googleapis.com/v1beta";
// Flash (not Flash-Lite): better at facts, team colors and reading invoices.
const DEFAULT_MODEL = "gemini-3-flash-preview";
const DEFAULT_IMAGE_MODEL = "gemini-2.5-flash-image";
const MAX_BODY = 60000;          // characters; a restaurant's whole pantry fits easily
const MAX_INVOICE = 4200000;     // an invoice photo, already shrunk in the browser (Vercel's limit is 4.5 MB)

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Use POST." });
  const started = Date.now();   // Vercel stops this function at 60 s; answer clearly before that

  const key = process.env.GEMINI_API_KEY;
  const sbUrl = String(process.env.SUPABASE_URL || "").trim().replace(/\/+$/, "");
  const sbKey = String(process.env.SUPABASE_KEY || "").trim();
  if (!key || !sbUrl || !sbKey) return res.status(503).json({ error: "not_configured" });

  // 1. Only people signed in to this app's Supabase project can use it.
  const token = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!token) return res.status(401).json({ error: "Please sign in again." });
  try {
    const who = await fetch(`${sbUrl}/auth/v1/user`, { headers: { apikey: sbKey, Authorization: `Bearer ${token}` } });
    if (!who.ok) return res.status(401).json({ error: "Please sign in again." });
  } catch {
    return res.status(502).json({ error: "Couldn't check your sign-in. Try again in a minute." });
  }

  // 2. Read and sanity-check what the app sent.
  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = null; } }
  if (!body || typeof body !== "object") return res.status(400).json({ error: "Nothing to work with." });
  const size = JSON.stringify(body).length;
  if (body.action === "invoice") {
    if (size > MAX_INVOICE) return res.status(413).json({ error: "That picture is too big. Try a closer, smaller photo." });
    return readInvoice(body, key, res);
  }
  if (size > MAX_BODY) return res.status(413).json({ error: "Too much data in one request." });
  if (body.action === "image") return makeImage(body, key, res);
  if (body.action === "vibe") return readVibe(body, key, res);
  if (body.action === "prices") return estimatePrices(body, key, res);
  if (!Array.isArray(body.pantry) || !body.pantry.length) return res.status(400).json({ error: "Add some ingredients first." });
  const mode = ["party", "event", "free"].includes(body.mode) ? body.mode : "weekly";

  const ideas = body.action === "ideas";
  try {
    let model = await pickModel(key);
    // 3. Look the occasion up first (team colors, mascots, sayings, theme ideas).
    const research = await lookUp(mode, body, key, model);
    // 4. Ask Gemini for the menu (or 3 ideas), with a fixed answer format.
    let ask = buildRequest(mode, body);
    if (research.facts) ask += `\n\nFACTS FROM A GOOGLE SEARCH (more accurate than memory; use them, especially exact team colors):\n${research.facts}`;
    if (ideas) ask += `\n\nDon't write the menu yet. Give 3 clearly different ideas for it: different themes, angles or styles, each one specific to this request.`;
    const payload = {
      systemInstruction: { parts: [{ text: SYSTEM }] },
      contents: [{ role: "user", parts: [{ text: ask }] }],
      // Gemini 3 works best at its default temperature (1.0); the "avoid" list keeps versions different.
      generationConfig: { responseMimeType: "application/json", responseSchema: ideas ? IDEAS_SCHEMA : SCHEMA },
    };
    let r = await callGemini(model, payload, key, Math.max(10000, 55000 - (Date.now() - started)));
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      const msg = String(data?.error?.message || "");
      if (r.status === 429) return res.status(429).json({ error: "Gemini is busy or out of quota. Try again in a minute." });
      if (r.status === 403 || /api key/i.test(msg)) return res.status(502).json({ error: "Gemini didn't accept the API key. Check GEMINI_API_KEY in Vercel's settings." });
      return res.status(502).json({ error: msg || `Gemini returned an error (${r.status}).` });
    }
    if (data?.promptFeedback?.blockReason) return res.status(422).json({ error: "Gemini wouldn't answer that request. Try different notes." });
    const text = (data?.candidates?.[0]?.content?.parts || []).map((p) => p.text || "").join("");
    let menu;
    try { menu = JSON.parse(text); } catch { return res.status(502).json({ error: "Gemini's answer came back garbled. Try again." }); }
    if (ideas) {
      if (!menu || !Array.isArray(menu.ideas) || !menu.ideas.length) return res.status(502).json({ error: "Gemini didn't come up with ideas. Try again." });
      return res.status(200).json({ mode, model, ideas: menu.ideas.slice(0, 3), sources: research.sources });
    }
    if (!menu || !Array.isArray(menu.items) || !menu.items.length) return res.status(502).json({ error: "Gemini didn't suggest any dishes. Try again." });
    return res.status(200).json({ mode, model, menu, sources: research.sources });
  } catch (e) {
    if (e?.name === "AbortError") return res.status(504).json({ error: "Gemini took too long to write this menu. Try again, or ask for fewer items." });
    return res.status(502).json({ error: "Couldn't reach Gemini. Try again in a minute." });
  }
};

// ---------------------------------------------------------------- pictures
// A banner picture for the top of a menu, from Gemini's picture model.
// Returns { image: "data:image/png;base64,..." }.
async function makeImage(b, key, res) {
  const m = b.menu || {};
  const items = (Array.isArray(m.items) ? m.items : []).slice(0, 4).map((it) => `${clip(it.name, 80)} (${clip(it.description, 160)})`);
  const colors = (Array.isArray(b.colors) ? b.colors : []).filter((c) => /^#[0-9a-f]{6}$/i.test(c)).slice(0, 4);
  const style = b.style === "illustration"
    ? "A bold, friendly hand-drawn illustration with flat colors, like a screen-printed poster."
    : "A bright, appetizing overhead food photograph on a rustic wooden pub table, natural light.";
  const prompt = `${style}
It goes across the top of a printed restaurant menu called "${clip(m.title, 80)}" for ${clip(b.occasion, 200) || "this week's specials"}.
Show these dishes together: ${items.join("; ") || "the restaurant's specials"}.
${clip(b.details, 400) ? `Fit this theme: ${clip(b.details, 400)}.` : ""}
${colors.length ? `Use this color palette for props, napkins and the background: ${colors.join(", ")}.` : ""}
Wide banner, 16:9. Leave a calm area with no clutter.
Do not include any words, letters, numbers, logos, trademarks, team mascots or recognizable people.`;
  const payload = {
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: { responseModalities: ["TEXT", "IMAGE"], imageConfig: { aspectRatio: "16:9" } },
  };
  try {
    let model = String(process.env.GEMINI_IMAGE_MODEL || DEFAULT_IMAGE_MODEL).trim();
    let r = await callGemini(model, payload, key);
    if (r.status === 404) {
      const found = (await findModel(key, /flash.*image/i, model)) || (await findModel(key, /image/i, model));   // cheaper Flash first
      if (found) { model = found; r = await callGemini(model, payload, key); }
    }
    if (r.status === 400) {   // an older picture model may not know the 16:9 setting
      delete payload.generationConfig.imageConfig;
      r = await callGemini(model, payload, key);
    }
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      const msg = String(data?.error?.message || "");
      if (r.status === 429 || /quota|billing|free tier/i.test(msg)) {
        return res.status(429).json({ error: "Your Gemini key can't make pictures yet. Picture models need billing turned on for the key in Google AI Studio (aistudio.google.com, then Billing). Or click \"Add your own picture\"." });
      }
      if (r.status === 403 || /api key/i.test(msg)) return res.status(502).json({ error: "Gemini didn't accept the API key. Check GEMINI_API_KEY in Vercel's settings." });
      return res.status(502).json({ error: msg || `Gemini returned an error (${r.status}).` });
    }
    const parts = data?.candidates?.[0]?.content?.parts || [];
    const pic = parts.map((p) => p.inlineData || p.inline_data).find((x) => x && x.data);
    if (!pic) return res.status(422).json({ error: "Gemini didn't send back a picture. Try again, or pick the other picture style." });
    return res.status(200).json({ model, image: `data:${pic.mimeType || pic.mime_type || "image/png"};base64,${pic.data}` });
  } catch {
    return res.status(502).json({ error: "Couldn't reach Gemini. Try again in a minute." });
  }
}

// The text model: GEMINI_MODEL if set, else Gemini 3 Flash. If Google
// names it differently for this key, use the newest Flash, then Flash-Lite.
let modelCache = null;
async function pickModel(key) {
  const want = String(process.env.GEMINI_MODEL || DEFAULT_MODEL).trim();
  if (modelCache?.want === want) return modelCache.model;
  let model = want;
  try {
    const r = await fetch(`${GEMINI}/models/${encodeURIComponent(want)}`, { headers: { "x-goog-api-key": key } });
    if (r.status === 404) model = (await findModel(key, /gemini-[\d.]+-flash(-preview|-latest|-\d+)?$/i)) || (await findFlashLite(key)) || want;
  } catch { /* use what was asked for */ }
  modelCache = { want, model };
  return model;
}

// A quick Google Search for the facts that make an occasion menu accurate.
// Returns { facts, sources }; on any problem it returns nothing and the menu
// is written without it.
async function lookUp(mode, b, key, model) {
  const about = mode === "event" ? `${clip(b.event?.name)}. ${clip(b.event?.personal, 400)}`
    : mode === "party" ? `${clip(b.party?.type)}. ${clip(b.party?.personal, 400)}`
    : mode === "free" ? clip(b.brief, 600)
    : clip(b.notes, 400);
  if (!about.replace(/[.\s]/g, "")) return { facts: "", sources: [] };
  const prompt = `I'm planning a themed menu at a small restaurant (${clip(b.restaurant)}, today is ${clip(b.today)}) for: ${about}
Look up and list the facts that would make it accurate and personal. Short bullet points, under 180 words, facts only:
- Every sports team mentioned: its official colors with hex codes, mascot, nicknames, stadium, best-known chants or slogans, and the home city's famous foods. If a game is named, the date and where it's played.
- A birthday, holiday or theme: what kids or guests that age love about it, real details of the theme (for golf: carts, tees, flags, holes-in-one), and the usual colors.
- Anything else mentioned that you can check (a band, a movie, a place, a decade).`;
  try {
    // At most 15 seconds: a slow search is skipped, not allowed to use up the time the menu needs.
    const r = await callGemini(model, { contents: [{ role: "user", parts: [{ text: prompt }] }], tools: [{ google_search: {} }] }, key, 15000);
    if (!r.ok) return { facts: "", sources: [] };
    const data = await r.json();
    const cand = data?.candidates?.[0];
    const facts = (cand?.content?.parts || []).map((p) => p.text || "").join("").trim().slice(0, 2500);
    const sources = (cand?.groundingMetadata?.groundingChunks || []).map((c) => c.web).filter((w) => w && w.uri)
      .slice(0, 4).map((w) => ({ title: String(w.title || "").slice(0, 80), uri: w.uri }));
    return { facts, sources };
  } catch { return { facts: "", sources: [] }; }
}

// ---------------------------------------------------------------- invoices
// Reads a photo (or PDF) of a supplier invoice into ingredient lines, matched
// to the restaurant's own ingredient names and units where it can.
async function readInvoice(b, key, res) {
  const mime = String(b.mime || "");
  if (!/^(image\/(jpeg|png|webp|heic|heif)|application\/pdf)$/.test(mime) || typeof b.data !== "string" || !b.data) {
    return res.status(400).json({ error: "Send a photo (JPG or PNG) or a PDF of the invoice." });
  }
  const ours = (Array.isArray(b.ingredients) ? b.ingredients : []).slice(0, 300)
    .map((i) => `- ${clip(i.name, 100)} (${clip(i.unit, 20)}, now $${Number(i.cost || 0).toFixed(2)} per ${clip(i.unit, 20)})`).join("\n");
  const prompt = `This is a supplier invoice or delivery receipt for a restaurant (from a food distributor like Sysco or US Foods, a bar or liquor supplier, a produce company or similar). Today is ${clip(b.today)}.
Read every product line. Skip taxes, fuel surcharges, delivery fees, deposits and credits.

Our ingredient list (name, the unit we cost it in, current cost):
${ours || "- (empty)"}

For each product line, copy what is PRINTED. Don't do the math; the app does it.
- "name": a short, plain ingredient name. If it is the same product as one on our list, set "existing" to that exact name from our list and use it as "name" too. Otherwise leave "existing" empty.
- "cases": how many were SHIPPED or delivered (the shipped / delivered quantity column, not "ordered" if they differ), counted in whatever the line sells by: cases, boxes, bags, bottles, each.
- "pack_count", "pack_size", "pack_unit": what ONE of those contains, from the pack or size column. "6/10 LB" means pack_count 6, pack_size 10, pack_unit "lb". "4/1 GAL" means 4, 1, "gal". "24/12 OZ" means 24, 12, "oz". "30 DZ" means 30, 1, "dozen". "1/750 ML" means 1, 750, "ml". A single item with no pack (one 10 lb bag) means 1, 10, "lb". Sold loose by weight ("12.4 LB" in the quantity column) means cases 12.4, pack_count 1, pack_size 1, pack_unit "lb". Sold by the each: pack_unit "each".
- "pack": the pack / size text exactly as printed, like "6/10 LB".
- "unit_price": the printed price per case (or per pound if sold by weight).
- "line_total": the line's total (extended price) in dollars as printed.
- "unit": the unit we should cost it in: OUR unit if it matches one of ours, otherwise a sensible one (oz, lb, each, fl oz, gal, bottle).
- "quantity" and "unit_cost": your best guess of the total delivered in "unit", and the cost per one "unit". The app checks these against the pack math.
- "shelf_life_days": how many days it usually keeps from delivery, stored properly (fresh fish 2, fresh meat 4, leafy greens 5, other produce 7, dairy 10, eggs 21, frozen 90, dry goods and canned 180, beer 120, wine and liquor 365).
- "confidence": "high" if the line was easy to read, otherwise "low".
Also give the supplier's name and the invoice date (YYYY-MM-DD) if they're printed.`;
  const payload = {
    contents: [{ role: "user", parts: [{ inlineData: { mimeType: mime, data: b.data } }, { text: prompt }] }],
    generationConfig: { responseMimeType: "application/json", responseSchema: INVOICE_SCHEMA },
  };
  try {
    const model = await pickModel(key);
    const r = await callGemini(model, payload, key);
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      const msg = String(data?.error?.message || "");
      if (r.status === 429) return res.status(429).json({ error: "Gemini is busy or out of quota. Try again in a minute." });
      if (r.status === 403 || /api key/i.test(msg)) return res.status(502).json({ error: "Gemini didn't accept the API key. Check GEMINI_API_KEY in Vercel's settings." });
      return res.status(502).json({ error: msg || `Gemini returned an error (${r.status}).` });
    }
    const text = (data?.candidates?.[0]?.content?.parts || []).map((p) => p.text || "").join("");
    let inv;
    try { inv = JSON.parse(text); } catch { return res.status(502).json({ error: "Couldn't read that invoice. Try a clearer, straight-on photo." }); }
    if (!inv || !Array.isArray(inv.items) || !inv.items.length) return res.status(422).json({ error: "No product lines found. Try a clearer, straight-on photo of the whole invoice." });
    inv.items = inv.items.map((x) => withPackMath(x, b.ingredients));
    return res.status(200).json({ model, invoice: inv });
  } catch {
    return res.status(502).json({ error: "Couldn't reach Gemini. Try again in a minute." });
  }
}

// ---------------------------------------------------------------- vibe
// The owner describes a vibe ("cozy rainy pub night", "loud game day") and
// Gemini picks the printed menu's layout, lettering, colors and border to
// match. The dishes are not touched.
const LAYOUT_GUIDE = `- classic: simple and centered, fits anything
- chalk: a dark chalkboard in a wood frame, hand-lettered, prices circled (pub nights, cozy, casual, happy hour). Needs a DARK background and light text.
- diner: retro diner, script name, dotted lines to the prices (brunch, family nights, fun and retro)
- news: a newspaper front page; the first dish is the headline story (chef's features, fresh catch, dishes with a story)
- poster: a loud poster with a huge title and every dish in its own bold block (game days, watch parties, big events)
- bistro: quiet and elegant, lots of white space, centered italics (date night, wine dinners, holidays, anything fancy)`;
const FONT_GUIDE = `- pub: chunky slab headings (pubs, hearty, classic bar)
- chalk: hand-lettered chalk marker (chalkboards, casual, cozy)
- sports: tall condensed block letters (sports, loud, bold)
- diner: retro script (diners, brunch, playful retro)
- bistro: elegant thin serif (fine dining, romantic)
- news: newspaper headline serif (stories, features, old-fashioned)
- type: typewriter (vintage, rustic, handmade)
- kids: soft rounded letters (kids, birthdays, friendly)
- classic: plain serif (when nothing else fits)`;
const LAYOUTS = ["classic", "chalk", "diner", "news", "poster", "bistro"];
const FONTS = ["classic", "pub", "chalk", "sports", "diner", "bistro", "news", "type", "kids"];
const PATTERNS = ["none", "stripes", "dots", "confetti", "zigzag", "waves", "checkerboard"];
const VIBE_SCHEMA = {
  type: "OBJECT",
  properties: {
    layout: { type: "STRING", enum: LAYOUTS },
    font: { type: "STRING", enum: FONTS },
    background: { type: "STRING", description: "Hex color for the menu background" },
    text: { type: "STRING", description: "Hex color for the main text, easy to read on the background" },
    accent: { type: "STRING", description: "Hex color for the title and prices" },
    accent2: { type: "STRING", description: "A second hex color for small details" },
    pattern: { type: "STRING", enum: PATTERNS },
    summary: { type: "STRING", description: "One short, plain sentence describing the look you chose" },
  },
  required: ["layout", "font", "background", "text", "accent", "pattern", "summary"],
};

async function readVibe(b, key, res) {
  const vibe = clip(b.vibe, 200);
  if (!vibe) return res.status(400).json({ error: "Describe the vibe first, like \"cozy rainy pub night\"." });
  const m = b.menu || {};
  const dishes = (Array.isArray(m.items) ? m.items : []).slice(0, 12).map((x) => clip(x, 80)).filter(Boolean);
  const owner = (Array.isArray(b.colors) ? b.colors : []).filter((c) => /^#[0-9a-f]{6}$/i.test(c)).slice(0, 6);
  const prompt = `A restaurant owner wants their printed specials menu to have this vibe: "${vibe}".
The menu is called "${clip(m.title, 80)}"${clip(m.kicker, 120) ? ` (${clip(m.kicker, 120)})` : ""}. Dishes: ${dishes.join("; ") || "(not given)"}.
${clip(b.current, 60) ? `It currently uses the "${clip(b.current, 60)}" layout. Pick a different one unless that one is clearly the best fit for this vibe.` : ""}

Pick the design that best fits the vibe.
"layout", one of:
${LAYOUT_GUIDE}
"font", one of:
${FONT_GUIDE}
Colors are 6-digit hex codes. ${owner.length ? `The owner's colors are ${owner.join(", ")}: use ONLY those, plus white or near-black for readable text.` : "Pick colors that fit the vibe; the background and text must be easy to read together."}
"pattern" is the border strip at the top and bottom: none, stripes, dots, confetti, zigzag, waves or checkerboard. Use "none" unless one clearly fits.
"summary": one short sentence a restaurant owner would understand, like "A cozy chalkboard in deep green with hand-lettered names." No emoji.`;
  const payload = {
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: { responseMimeType: "application/json", responseSchema: VIBE_SCHEMA },
  };
  try {
    const model = await pickModel(key);
    const r = await callGemini(model, payload, key);
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      const msg = String(data?.error?.message || "");
      if (r.status === 429) return res.status(429).json({ error: "Gemini is busy or out of quota. Try again in a minute." });
      if (r.status === 403 || /api key/i.test(msg)) return res.status(502).json({ error: "Gemini didn't accept the API key. Check GEMINI_API_KEY in Vercel's settings." });
      return res.status(502).json({ error: msg || `Gemini returned an error (${r.status}).` });
    }
    if (data?.promptFeedback?.blockReason) return res.status(422).json({ error: "Gemini wouldn't answer that. Try describing the vibe differently." });
    const text = (data?.candidates?.[0]?.content?.parts || []).map((p) => p.text || "").join("");
    let look;
    try { look = JSON.parse(text); } catch { return res.status(502).json({ error: "Gemini's answer came back garbled. Try again." }); }
    if (!look || !LAYOUTS.includes(look.layout)) return res.status(502).json({ error: "Gemini didn't pick a look. Try again." });
    return res.status(200).json({ model, look });
  } catch {
    return res.status(502).json({ error: "Couldn't reach Gemini. Try again in a minute." });
  }
}

// Gives up after "ms" (an AbortError), so the function always answers before
// Vercel's 60-second limit instead of being cut off with no message.
// The quantity math, done here instead of trusted to the AI:
// delivered = cases x items per case x size of each, converted to the unit
// the ingredient is costed in; cost per unit = line total / delivered.
const WEIGHT = { oz: 1, ounce: 1, ounces: 1, lb: 16, lbs: 16, pound: 16, pounds: 16, kg: 35.274, g: 0.035274, gram: 0.035274, grams: 0.035274 };
const VOLUME = { "fl oz": 1, floz: 1, gal: 128, gallon: 128, gallons: 128, qt: 32, quart: 32, pt: 16, pint: 16, cup: 8, l: 33.814, liter: 33.814, litre: 33.814, ml: 0.033814 };
const COUNT = { each: 1, ea: 1, ct: 1, count: 1, pc: 1, pcs: 1, piece: 1, bottle: 1, btl: 1, can: 1, dozen: 12, dz: 12, doz: 12 };
function unitKind(u) {
  u = String(u || "").trim().toLowerCase().replace(/\.$/, "");
  for (const [kind, table] of [["w", WEIGHT], ["v", VOLUME], ["c", COUNT]]) if (u in table) return { kind, per: table[u] };
  return null;
}
function convert(amount, from, to) {
  const a = unitKind(from), b = unitKind(to);
  if (!a || !b) return null;
  // Kitchens cost liquids in "oz": treat a fluid ounce and an ounce as the same.
  const liquid = (a.kind === "w" && b.kind === "v") || (a.kind === "v" && b.kind === "w");
  if (a.kind !== b.kind && !liquid) return null;
  return (amount * a.per) / b.per;
}
const round = (n, d) => Math.round(n * 10 ** d) / 10 ** d;
function withPackMath(x, ours) {
  const mine = (Array.isArray(ours) ? ours : []).find((i) => String(i.name).toLowerCase() === String(x.existing || x.name || "").toLowerCase());
  const unit = mine ? mine.unit : x.unit || x.pack_unit || "each";
  const cases = Number(x.cases), count = Number(x.pack_count) || 1, size = Number(x.pack_size) || 1, total = Number(x.line_total);
  const out = { ...x, unit };
  if (cases > 0) {
    const inPackUnit = cases * count * size;
    const delivered = convert(inPackUnit, x.pack_unit || "each", unit);
    if (delivered && delivered > 0) {
      out.quantity = round(delivered, 2);
      const lineTotal = total > 0 ? total : Number(x.unit_price) > 0 ? cases * Number(x.unit_price) : 0;
      if (lineTotal > 0) { out.line_total = round(lineTotal, 2); out.unit_cost = round(lineTotal / delivered, 4); }
      const n = (v) => round(v, 2).toLocaleString("en-US");
      const pu = String(x.pack_unit || "each").toLowerCase();
      // e.g. "2 × 10 lb = 20 lb = 320 oz", "1 × 30 dozen = 360 each", "6 each"
      const multiplied = count > 1 || size !== 1;
      const sameScale = Math.abs(delivered - inPackUnit) < 1e-9;
      out.math = `${n(cases)}${count > 1 ? ` × ${n(count)}` : ""}${size !== 1 ? ` × ${n(size)}` : ""} ${pu}` +
        (multiplied ? ` = ${n(inPackUnit)} ${pu}` : "") +
        (sameScale ? "" : ` = ${n(delivered)} ${unit}`);
      out.checked = true;
      return out;
    }
  }
  // Couldn't do the pack math (say, a case of "each" costed by the pound): use the AI's numbers, flagged.
  const q = Number(x.quantity);
  if (q > 0 && total > 0) out.unit_cost = round(total / q, 4);
  out.checked = false;
  out.confidence = "low";
  return out;
}

async function callGemini(model, payload, key, ms = 50000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    const r = await fetch(`${GEMINI}/models/${encodeURIComponent(model)}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify(payload),
      signal: ctrl.signal,
    });
    const body = await r.text();          // read it inside the time limit too
    return new Response(body, { status: r.status, headers: { "Content-Type": "application/json" } });
  } finally { clearTimeout(timer); }
}

// Lists the models this key can use and picks the newest one whose name matches.
const findFlashLite = (key) => findModel(key, /flash-lite/i);
async function findModel(key, pattern, skip = "") {
  try {
    const r = await fetch(`${GEMINI}/models?pageSize=1000`, { headers: { "x-goog-api-key": key } });
    if (!r.ok) return null;
    const { models = [] } = await r.json();
    const names = models
      .filter((m) => pattern.test(m.name) && m.name !== `models/${skip}` && (m.supportedGenerationMethods || []).includes("generateContent"))
      .map((m) => m.name.replace(/^models\//, ""));
    const version = (n) => Number((n.match(/gemini-(\d+(?:\.\d+)?)/) || [])[1] || 0);
    names.sort((a, b) => version(b) - version(a) || (/preview|exp/.test(a) ? 1 : 0) - (/preview|exp/.test(b) ? 1 : 0));
    return names[0] || null;
  } catch { return null; }
}

const SYSTEM = `You help the owner of a small restaurant plan menus. Write the way a friendly, experienced chef-manager talks: short, plain sentences a high school student would understand. No buzzwords.

What matters, in this order:
1. THE OWNER'S BRIEF. Build the whole menu around what the owner wrote: the occasion, the personal details and the notes. Treat every word as part of the brief, even random ones. If they throw in a mix of things ("tacos, 80s, grandma's 90th, rain"), weave all of them together into one menu with a clear idea, so it could only have been written for this request. Never fall back on a generic menu.
2. Real food the kitchen can make from the ingredient list, priced to the food cost goal.
3. Using up ingredients that spoil soon, wherever they fit the brief.

Food rules:
- Build dishes from the restaurant's own ingredient list. You may also assume basic pantry staples (salt, pepper, cooking oil, flour, sugar, water). If the brief truly needs an ingredient that isn't listed, include it with "not_stocked": true.
- Keep each dish's food cost near the restaurant's goal food cost percent. Food cost = the cost of the ingredients in one portion divided by the menu price.
- Give amounts per ONE portion, in the same unit the ingredient list uses.
- Prices should fit this restaurant: look at its current menu prices.
- "why" is one or two sentences: what it uses up and why it should sell or make money.
- If you're given dishes to avoid, make different ones: new names, new ideas, a new angle on the brief.

Make it personal:
- Use the specific details of THIS occasion, not generic ones. For a sports team: its mascot, nicknames, stadium, traditions, colors and well-known sayings or chants (a few words each, never song lyrics beyond a short phrase). For a birthday: the person's name, age and what they love (a golf-themed 2nd birthday means golf carts, tees, putts, hole-in-one and "par-tee" jokes). For a wedding or anniversary: the couple's names and story.
- Every dish name and description should connect to those details while still saying what the food is.
- Give the menu a short title that fits the brief (a friendly rivalry slogan is fine for a game). Keep it good-natured: no insults.
- "sayings": 2 to 4 short phrases to print on the menu (chants, slogans, birthday wishes, toasts).
- "motifs": 2 to 4 picture names from this list that fit the occasion: football, basketball, baseball, paw, golf_ball, golf_flag, golf_cart, balloon, cake, party_hat, star, trophy, shamrock, pint, heart, rings, pumpkin, snowflake, music, sun, crown, flower, leaf.
- Do not use emoji anywhere. Never describe or recreate a team's or company's logo artwork.

The look (always fill in "theme", "tagline" and "pattern"):
- If the owner gives exact colors (hex codes), use ONLY those colors, plus white or near-black if you need them for readable text. Decide which one is the background and which are the title and details.
- Otherwise pick colors that fit the occasion: a team's real colors, a party's theme, or the season. Colors are 6-digit hex codes like #FF8200. The background and text must be easy to read together.
- "theme.layout" and "theme.font" set the printed menu's design. Pick what fits THIS occasion, and vary them; don't default to classic.
Layouts:
${LAYOUT_GUIDE}
Fonts:
${FONT_GUIDE}
- "pattern" is the border strip along the top and bottom. Choose what fits THIS occasion, and choose "none" when nothing fits: "none" suits most weekly specials and anything elegant. stripes = sporty or classic diner, dots = kids and playful parties, confetti = birthdays and celebrations, zigzag = retro, loud or fun, waves = summer, beach or seafood, checkerboard ONLY for something truly checkered (racing, a stadium with checkerboard end zones, a retro diner floor).`;

function buildRequest(mode, b) {
  const pantry = b.pantry.slice(0, 250).map((i) => {
    const bits = [`${i.name} | ${i.unit} | $${Number(i.cost).toFixed(2)} per ${i.unit}`];
    if (i.on_hand != null) bits.push(`on hand: ${i.on_hand} ${i.unit}`);
    if (i.days_left != null) bits.push(i.days_left < 0 ? "EXPIRED" : `spoils in ${i.days_left} day${i.days_left === 1 ? "" : "s"}`);
    return "- " + bits.join(" | ");
  }).join("\n");
  const menu = (b.menu || []).slice(0, 150).map((d) =>
    `- ${d.name} (${d.category || "uncategorized"}) | $${Number(d.price).toFixed(2)} | food cost ${Number(d.food_cost_pct).toFixed(1)}% | sold ${d.weekly_units ?? "?"} last week`).join("\n");
  const t = b.targets || {};
  let ask;
  if (mode === "free") {
    ask = `Plan a menu of ${Math.min(8, Math.max(2, num(b.count, 4)))} items built entirely around the owner's brief below. Work out the occasion and the feel from it, then make every item, the title and the look fit it.
THE OWNER'S BRIEF: ${clip(b.brief, 800) || "surprise me with something fun and seasonal"}`;
  } else if (mode === "party") {
    const p = b.party || {};
    ask = `Plan a party menu for: ${clip(p.type) || "a group"}.
Guests: ${num(p.guests, 20)}. Service style: ${clip(p.style) || "sit-down"}.
Make 4 to 6 items across courses (for example: starter, main, side, dessert). Give every item its own menu price, priced like the regular menu. Do not set a price per person.
Personal details: ${clip(p.personal, 600) || "none given; use the type of group"}
Notes from the owner: ${clip(p.notes, 600) || "none"}`;
  } else if (mode === "event") {
    const e = b.event || {};
    ask = `Plan a game day / event menu for: ${clip(e.name) || "a big game"}.
Make ${Math.min(8, Math.max(2, num(e.count, 5)))} items guests can order: shareable snacks, a couple of mains, and a drink or dessert idea if it fits. Price them like the regular menu.
Expected crowd: ${clip(e.crowd) || "busier than usual"}.
Personal details: ${clip(e.personal, 600) || "none given; use what you know about the event"}
Notes from the owner: ${clip(e.notes, 600) || "none"}`;
  } else {
    ask = `Plan ${Math.min(6, Math.max(1, num(b.count, 3)))} weekly specials to run alongside the regular menu.
Notes from the owner: ${clip(b.notes, 600) || "none; pick a fresh angle, such as the season, a holiday this week or a mood"}`;
  }
  const hex = (Array.isArray(b.colors_hex) ? b.colors_hex : []).filter((c) => /^#[0-9a-f]{6}$/i.test(c)).slice(0, 6);
  const colors = hex.length
    ? `Colors: the owner asked for "${clip(b.colors, 120)}". Use exactly these hex codes: ${hex.join(", ")}.`
    : clip(b.colors, 120) ? `Colors the owner wants: ${clip(b.colors, 120)}.` : "Colors: none given; choose what fits the brief.";
  const avoid = (Array.isArray(b.avoid) ? b.avoid : []).map((x) => clip(x, 80)).filter(Boolean).slice(0, 24);
  const teams = (Array.isArray(b.teams) ? b.teams : []).slice(0, 4).map((t) => `${clip(t.name, 40)}: ${(Array.isArray(t.colors) ? t.colors : []).slice(0, 4).map((c) => clip(c, 30)).join(", ")}`);
  const idea = b.idea && typeof b.idea === "object" ? `THE OWNER PICKED THIS IDEA. Build the menu around it: "${clip(b.idea.title, 100)}": ${clip(b.idea.pitch, 400)}${Array.isArray(b.idea.dishes) ? ` Dishes to start from: ${b.idea.dishes.slice(0, 8).map((x) => clip(x, 80)).join("; ")}.` : ""}` : "";
  return `Restaurant: ${clip(b.restaurant) || "our restaurant"}. Today is ${clip(b.today)}.
Food cost goal: ${t.mid ?? 31}% (comfortable range ${t.low ?? 28}% to ${t.high ?? 34}%).

Ingredients we stock (name | unit | cost | on hand | freshness):
${pantry}

Current menu (name | price | food cost | sales):
${menu || "- (none yet)"}

${ask}
${idea}
${teams.length ? `Teams and their official colors: ${teams.join(" | ")}. Theme the menu for the first team named unless the owner says otherwise.` : ""}
${colors}
${avoid.length ? `Dishes already suggested (make different ones): ${avoid.join("; ")}` : ""}`;
}

const clip = (s, max = 300) => String(s ?? "").slice(0, max).replace(/\s+/g, " ").trim();
const num = (v, d) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? Math.round(n) : d; };

// 3 ideas to choose from before writing a whole menu.
const IDEAS_SCHEMA = {
  type: "OBJECT",
  properties: {
    ideas: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          title: { type: "STRING", description: "The menu's name for this idea" },
          pitch: { type: "STRING", description: "Two plain sentences: the theme and why guests will love it" },
          dishes: { type: "ARRAY", items: { type: "STRING" }, description: "3 to 5 dish names with a few words each" },
          colors: { type: "ARRAY", items: { type: "STRING" }, description: "2 or 3 hex colors for this idea" },
          decor: { type: "STRING", description: "One sentence of table or decoration ideas, for parties and events" },
        },
        required: ["title", "pitch", "dishes"],
      },
    },
  },
  required: ["ideas"],
};

// ---------------------------------------------------------------- price estimates
// Typical prices for a restaurant's top ingredients at three kinds of places
// near it (broadline distributor, warehouse club, farmers market / local farm),
// looked up with Google Search, then written out in the restaurant's own units.
// These are estimates to fill gaps until real prices come in from invoices,
// receipts and quotes; the app labels them that way.
async function estimatePrices(b, key, res) {
  const items = (Array.isArray(b.items) ? b.items : []).slice(0, 25)
    .map((i) => ({ name: clip(i.name, 80), unit: clip(i.unit, 20), cost: Number(i.cost) || 0 })).filter((i) => i.name && i.unit);
  if (!items.length) return res.status(400).json({ error: "No ingredients to price." });
  const where = clip(b.where, 120) || "the United States";
  const list = items.map((i) => `- ${i.name} (we cost it per ${i.unit}; we pay about $${i.cost.toFixed(2)} per ${i.unit} now)`).join("\n");
  try {
    const model = await pickModel(key);
    // 1. Look up current typical prices.
    let facts = "", sources = [];
    try {
      const r = await callGemini(model, {
        contents: [{ role: "user", parts: [{ text: `A small restaurant in ${where} wants to compare what it pays for ingredients. Today is ${clip(b.today)}.
For each item below, find current typical prices in or near ${where} at:
(a) broadline foodservice distributors like Sysco or US Foods (case prices),
(b) warehouse clubs like Costco, Sam's Club or Restaurant Depot,
(c) farmers markets or local farms (only for fresh produce, meat, eggs, dairy, bread).
Use USDA Market News reports, store websites and recent price reports. Short bullet points with dollar prices and the pack size or unit, facts only.
${list}` }] }],
        tools: [{ google_search: {} }],
      }, key, 25000);
      if (r.ok) {
        const data = await r.json();
        const cand = data?.candidates?.[0];
        facts = (cand?.content?.parts || []).map((p) => p.text || "").join("").trim().slice(0, 6000);
        sources = (cand?.groundingMetadata?.groundingChunks || []).map((c) => c.web).filter((w) => w && w.uri)
          .slice(0, 6).map((w) => ({ title: String(w.title || "").slice(0, 80), uri: w.uri }));
      }
    } catch { /* no search results: estimate from general knowledge */ }
    // 2. Turn them into numbers in the restaurant's units.
    const r = await callGemini(model, {
      contents: [{ role: "user", parts: [{ text: `Estimate the typical price of each item at three kinds of places near ${where}: "distributor" (Sysco / US Foods case price), "wholesale" (Costco / Sam's Club / Restaurant Depot), "local" (farmers market or local farm).
Give every price per ONE of the unit we cost the item in (convert pack and case prices: 1 lb = 16 oz, 1 gal = 128 fl oz, treat fl oz and oz the same for liquids, 1 dozen = 12 each).
Give a low and high for the usual range. Set a place to null if that kind of place doesn't sell it (alcohol is only sold to restaurants by licensed distributors; dry goods aren't sold at farmers markets).
Be realistic, not optimistic. Warehouse clubs are usually a little cheaper than distributors for staples but sell bigger packs; farmers markets are usually more expensive but fresher.
${facts ? `Prices found with a web search:\n${facts}\n` : ""}
Items:
${list}` }] }],
      generationConfig: { responseMimeType: "application/json", responseSchema: PRICE_SCHEMA },
    }, key, 30000);   // both steps together stay under Vercel's 60-second limit
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      const msg = String(data?.error?.message || "");
      if (r.status === 429) return res.status(429).json({ error: "Gemini is busy or out of quota. Try again in a minute." });
      return res.status(502).json({ error: msg || `Gemini returned an error (${r.status}).` });
    }
    const text = (data?.candidates?.[0]?.content?.parts || []).map((p) => p.text || "").join("");
    let out;
    try { out = JSON.parse(text); } catch { return res.status(502).json({ error: "Gemini's answer came back garbled. Try again." }); }
    const ok = (p) => p && Number(p.price) > 0 ? { price: Number(p.price), low: Number(p.low) > 0 ? Number(p.low) : null, high: Number(p.high) > 0 ? Number(p.high) : null } : null;
    const rows = (Array.isArray(out?.items) ? out.items : []).map((x) => ({ name: clip(x.name, 80), distributor: ok(x.distributor), wholesale: ok(x.wholesale), local: ok(x.local), note: clip(x.note, 200) }));
    return res.status(200).json({ model, items: rows, sources });
  } catch {
    return res.status(502).json({ error: "Couldn't reach Gemini. Try again in a minute." });
  }
}
const PRICE_ONE = { type: "OBJECT", nullable: true, properties: { price: { type: "NUMBER" }, low: { type: "NUMBER" }, high: { type: "NUMBER" } }, required: ["price"] };
const PRICE_SCHEMA = {
  type: "OBJECT",
  properties: {
    items: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          name: { type: "STRING", description: "Exactly as given" },
          distributor: PRICE_ONE, wholesale: PRICE_ONE, local: PRICE_ONE,
          note: { type: "STRING", description: "A few words on pack size or what drives the price" },
        },
        required: ["name"],
      },
    },
  },
  required: ["items"],
};

const INVOICE_SCHEMA = {
  type: "OBJECT",
  properties: {
    supplier: { type: "STRING" },
    invoice_date: { type: "STRING", description: "YYYY-MM-DD, empty if not printed" },
    items: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          name: { type: "STRING" },
          existing: { type: "STRING", description: "Exact name from our ingredient list, or empty" },
          cases: { type: "NUMBER", description: "How many were shipped, in the line's selling unit (cases, bags, each, or pounds if sold by weight)" },
          pack_count: { type: "NUMBER", description: "Items inside one case (6 in 6/10 LB); 1 if none" },
          pack_size: { type: "NUMBER", description: "Size of each item (10 in 6/10 LB); 1 if sold by the each" },
          pack_unit: { type: "STRING", description: "Unit of pack_size: lb, oz, kg, g, gal, qt, pt, fl oz, l, ml, dozen or each" },
          pack: { type: "STRING", description: "Pack / size text as printed" },
          unit_price: { type: "NUMBER", description: "Printed price per case (or per pound if sold by weight)" },
          unit: { type: "STRING" },
          quantity: { type: "NUMBER" },
          unit_cost: { type: "NUMBER" },
          line_total: { type: "NUMBER" },
          shelf_life_days: { type: "NUMBER" },
          confidence: { type: "STRING", enum: ["high", "low"] },
        },
        required: ["name", "unit", "quantity", "unit_cost"],
      },
    },
  },
  required: ["items"],
};

// The answer format Gemini must follow.
const SCHEMA = {
  type: "OBJECT",
  properties: {
    title: { type: "STRING", description: "A short name for this menu" },
    intro: { type: "STRING", description: "One or two plain sentences about the menu" },
    items: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          course: { type: "STRING", description: "Starter, main, side, dessert, etc." },
          name: { type: "STRING" },
          description: { type: "STRING", description: "Menu description, one sentence" },
          price: { type: "NUMBER", description: "Menu price for one portion" },
          ingredients: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: {
                name: { type: "STRING", description: "Exactly as written in the ingredient list" },
                amount: { type: "NUMBER", description: "Per one portion, in the ingredient's unit" },
                not_stocked: { type: "BOOLEAN" },
              },
              required: ["name", "amount"],
            },
          },
          why: { type: "STRING" },
        },
        required: ["name", "description", "ingredients", "why"],
      },
    },
    tips: { type: "ARRAY", items: { type: "STRING" }, description: "Up to 3 short practical tips" },
    tagline: { type: "STRING", description: "A short line printed under the title on the menu" },
    sayings: { type: "ARRAY", items: { type: "STRING" }, description: "2 to 4 short phrases printed on the menu" },
    motifs: { type: "ARRAY", items: { type: "STRING" }, description: "2 to 4 picture names from the allowed list" },
    pattern: { type: "STRING", enum: ["none", "stripes", "dots", "confetti", "zigzag", "waves", "checkerboard"], description: "Border strip; none unless a pattern fits this occasion" },
    theme: {
      type: "OBJECT",
      description: "The printed menu's look",
      properties: {
        background: { type: "STRING", description: "Hex color for the menu background, e.g. #FF8200" },
        text: { type: "STRING", description: "Hex color for the main text, readable on the background" },
        accent: { type: "STRING", description: "Hex color for the title and lines" },
        accent2: { type: "STRING", description: "A second hex color for small details" },
        style: { type: "STRING", description: "Lettering style: one of bold, classic, playful, elegant" },
        layout: { type: "STRING", enum: ["classic", "chalk", "diner", "news", "poster", "bistro"], description: "The printed menu's layout" },
        font: { type: "STRING", enum: ["classic", "pub", "chalk", "sports", "diner", "bistro", "news", "type", "kids"], description: "The printed menu's font pairing" },
      },
      required: ["background", "text", "accent", "style"],
    },
  },
  required: ["title", "items", "theme", "pattern"],
};
