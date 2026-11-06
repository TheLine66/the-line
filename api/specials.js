// =====================================================================
// The Line: POST /api/specials
// Runs on Vercel's server, never in the browser, so the Gemini key stays
// secret. It checks that the caller is signed in to The Line, then asks
// Google Gemini for a weekly specials menu or a party menu built from the
// restaurant's own ingredients, prices and use-by dates.
//
// Needs three environment variables in Vercel (Settings → Environment
// Variables): GEMINI_API_KEY, SUPABASE_URL, SUPABASE_KEY. Optional:
// GEMINI_MODEL (defaults to Gemini 3.1 Flash-Lite).
// =====================================================================
"use strict";

const GEMINI = "https://generativelanguage.googleapis.com/v1beta";
const DEFAULT_MODEL = "gemini-3.1-flash-lite-preview";
const MAX_BODY = 60000;   // characters; a restaurant's whole pantry fits easily

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
  if (JSON.stringify(body).length > MAX_BODY) return res.status(413).json({ error: "Too much data in one request." });
  if (!Array.isArray(body.pantry) || !body.pantry.length) return res.status(400).json({ error: "Add some ingredients first." });
  const mode = body.mode === "party" ? "party" : body.mode === "event" ? "event" : "weekly";

  // 3. Ask Gemini, with a fixed answer format.
  const payload = {
    systemInstruction: { parts: [{ text: SYSTEM }] },
    contents: [{ role: "user", parts: [{ text: buildRequest(mode, body) }] }],
    generationConfig: { responseMimeType: "application/json", responseSchema: SCHEMA },
  };
  try {
    let model = String(process.env.GEMINI_MODEL || DEFAULT_MODEL).trim();
    let r = await callGemini(model, payload, key);
    if (r.status === 404) {   // that model name isn't available: find this key's Flash-Lite model
      const found = await findFlashLite(key);
      if (found) { model = found; r = await callGemini(model, payload, key); }
    }
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
    if (!menu || !Array.isArray(menu.items) || !menu.items.length) return res.status(502).json({ error: "Gemini didn't suggest any dishes. Try again." });
    return res.status(200).json({ mode, model, menu });
  } catch {
    return res.status(502).json({ error: "Couldn't reach Gemini. Try again in a minute." });
  }
};

function callGemini(model, payload, key) {
  return fetch(`${GEMINI}/models/${encodeURIComponent(model)}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify(payload),
  });
}

// Lists the models this key can use and picks the newest Flash-Lite one.
async function findFlashLite(key) {
  try {
    const r = await fetch(`${GEMINI}/models?pageSize=1000`, { headers: { "x-goog-api-key": key } });
    if (!r.ok) return null;
    const { models = [] } = await r.json();
    const names = models
      .filter((m) => /flash-lite/i.test(m.name) && (m.supportedGenerationMethods || []).includes("generateContent"))
      .map((m) => m.name.replace(/^models\//, ""));
    const version = (n) => Number((n.match(/gemini-(\d+(?:\.\d+)?)/) || [])[1] || 0);
    names.sort((a, b) => version(b) - version(a) || (/preview|exp/.test(a) ? 1 : 0) - (/preview|exp/.test(b) ? 1 : 0));
    return names[0] || null;
  } catch { return null; }
}

const SYSTEM = `You help the owner of a small restaurant plan menus. Write the way a friendly, experienced chef-manager talks: short, plain sentences a high school student would understand. No buzzwords.

Rules:
- Build dishes from the restaurant's own ingredient list. You may also assume basic pantry staples (salt, pepper, cooking oil, flour, sugar, water). Do not invent other ingredients; if a dish truly needs one that isn't listed, put it in the ingredients list with "not_stocked": true.
- Use up ingredients that are spoiling soon first, especially ones with a lot on hand.
- Keep each dish's food cost near the restaurant's goal food cost percent. Food cost = the cost of the ingredients in one portion divided by the menu price.
- Give amounts per ONE portion (per guest for party menus), in the same unit the ingredient list uses.
- Prices should fit this restaurant: look at its current menu prices.
- Fit the style and cuisine of the restaurant's current menu.
- "why" is one or two sentences: what it uses up and why it should sell or make money.

Theme (always fill in "theme" and "tagline"):
- Design the printed menu's look to fit the occasion. For a game day or event, use that event's team or event colors (or the colors the owner asks for), give the menu a short rallying title (for example a friendly rivalry slogan), and give every dish a fun themed name that still says what the food is. Keep it good-natured: no insults, no team logos.
- For a party, fit the occasion. For weekly specials, fit the season and this restaurant.
- Colors are 6-digit hex codes like #FF8200. Pick a background and a text color that are easy to read together.

Make it personal (this matters most):
- Use the specific details of THIS occasion, not generic ones. For a sports team: its mascot, nicknames, stadium, traditions, colors and well-known sayings or chants (a few words each, never song lyrics beyond a short phrase). For a birthday: the person's name, age and what they love (a golf-themed 2nd birthday means golf carts, tees, putts, hole-in-one and "par-tee" jokes). For a wedding or anniversary: the couple's names and story.
- Every dish name and description should connect to those details while still saying what the food is.
- "sayings": 2 to 4 short phrases to print on the menu (chants, slogans, birthday wishes, toasts).
- "motifs": 2 to 4 picture names from this list that fit the occasion: football, basketball, baseball, paw, golf_ball, golf_flag, golf_cart, balloon, cake, party_hat, star, trophy, shamrock, pint, heart, rings, pumpkin, snowflake, music, sun, crown, flower, leaf.
- "pattern": one of checkerboard, stripes, dots, none (checkerboard suits a team with checkerboard end zones or a race; dots suit a kid's party).
- Do not use emoji anywhere.
- Never describe or recreate a team's or company's logo artwork.`;

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
  if (mode === "party") {
    const p = b.party || {};
    ask = `Plan a party menu for: ${clip(p.type) || "a group"}.
Guests: ${num(p.guests, 20)}. Budget: about $${num(p.budget, 30)} per person (food only). Service style: ${clip(p.style) || "sit-down"}.
Make 4 to 6 items across courses (for example: starter, main, side, dessert). Set per_person_price close to the budget.
Personal details: ${clip(p.personal) || "none given; use the type of group"}
Notes from the owner: ${clip(p.notes) || "none"}`;
  } else if (mode === "event") {
    const e = b.event || {};
    ask = `Plan a game day / event menu for: ${clip(e.name) || "a big game"}.
Colors the owner wants: ${clip(e.colors) || "the event's or teams' usual colors"}.
Make ${Math.min(8, Math.max(2, num(e.count, 5)))} items guests can order: shareable snacks, a couple of mains, and a drink or dessert idea if it fits. Price them like the regular menu.
Expected crowd: ${clip(e.crowd) || "busier than usual"}.
Personal details: ${clip(e.personal) || "none given; use what you know about the event"}
Notes from the owner: ${clip(e.notes) || "none"}`;
  } else {
    ask = `Plan ${Math.min(6, Math.max(1, num(b.count, 3)))} weekly specials to run alongside the regular menu.
Notes from the owner: ${clip(b.notes) || "none"}`;
  }
  return `Restaurant: ${clip(b.restaurant) || "our restaurant"}. Today is ${clip(b.today)}.
Food cost goal: ${t.mid ?? 31}% (comfortable range ${t.low ?? 28}% to ${t.high ?? 34}%).

Ingredients we stock (name | unit | cost | on hand | freshness):
${pantry}

Current menu (name | price | food cost | sales):
${menu || "- (none yet)"}

${ask}`;
}

const clip = (s) => String(s ?? "").slice(0, 300).replace(/\s+/g, " ").trim();
const num = (v, d) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? Math.round(n) : d; };

// The answer format Gemini must follow.
const SCHEMA = {
  type: "OBJECT",
  properties: {
    title: { type: "STRING", description: "A short name for this menu" },
    intro: { type: "STRING", description: "One or two plain sentences about the menu" },
    per_person_price: { type: "NUMBER", description: "Party menus only: price per guest" },
    items: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          course: { type: "STRING", description: "Starter, main, side, dessert, etc." },
          name: { type: "STRING" },
          description: { type: "STRING", description: "Menu description, one sentence" },
          price: { type: "NUMBER", description: "Menu price for one portion (weekly specials)" },
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
    pattern: { type: "STRING", description: "Border pattern: checkerboard, stripes, dots or none" },
    theme: {
      type: "OBJECT",
      description: "The printed menu's look",
      properties: {
        background: { type: "STRING", description: "Hex color for the menu background, e.g. #FF8200" },
        text: { type: "STRING", description: "Hex color for the main text, readable on the background" },
        accent: { type: "STRING", description: "Hex color for the title and lines" },
        accent2: { type: "STRING", description: "A second hex color for small details" },
        style: { type: "STRING", description: "Lettering style: one of bold, classic, playful, elegant" },
      },
      required: ["background", "text", "accent", "style"],
    },
  },
  required: ["title", "items"],
};
