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
    let r = await callGemini(model, payload, key);
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
  } catch {
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
    const r = await callGemini(model, { contents: [{ role: "user", parts: [{ text: prompt }] }], tools: [{ google_search: {} }] }, key);
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

For each product line:
- "name": a short, plain ingredient name. If it is the same product as one on our list, set "existing" to that exact name from our list and use it as "name" too. Otherwise leave "existing" empty.
- "unit" and the numbers: if it matches one of ours, convert to OUR unit (1 lb = 16 oz, 1 kg = 35.27 oz, 1 gal = 128 fl oz, 1 case = the count or weight printed on the line). Otherwise pick a sensible unit (oz, lb, each, fl oz, gal, bottle).
- "quantity": how much was delivered, in that unit.
- "unit_cost": the price per ONE of that unit (line total divided by quantity), in dollars.
- "line_total": the line's total in dollars as printed.
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

function callGemini(model, payload, key) {
  return fetch(`${GEMINI}/models/${encodeURIComponent(model)}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify(payload),
  });
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
