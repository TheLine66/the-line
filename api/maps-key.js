// =====================================================================
// The Line: GET /api/maps-key
// Hands the Google Maps key to people signed in to The Line, so the
// Procurement map can load. The key is kept in Vercel's settings
// (Settings -> Environment Variables -> GOOGLE_MAPS_KEY), not in this code.
// A Maps key is used in the browser by design, so lock it to your website
// in Google Cloud (see the README, "Procurement (Google Maps)").
// =====================================================================
"use strict";

module.exports = async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Use GET." });
  res.setHeader("Cache-Control", "no-store");

  const key = String(process.env.GOOGLE_MAPS_KEY || "").trim();
  const sbUrl = String(process.env.SUPABASE_URL || "").trim().replace(/\/+$/, "");
  const sbKey = String(process.env.SUPABASE_KEY || "").trim();
  if (!key || !sbUrl || !sbKey) return res.status(503).json({ error: "not_configured" });

  // Only people signed in to this app's Supabase project get the key.
  const token = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!token) return res.status(401).json({ error: "Please sign in again." });
  try {
    const who = await fetch(`${sbUrl}/auth/v1/user`, { headers: { apikey: sbKey, Authorization: `Bearer ${token}` } });
    if (!who.ok) return res.status(401).json({ error: "Please sign in again." });
  } catch {
    return res.status(502).json({ error: "Couldn't check your sign-in. Try again in a minute." });
  }
  return res.status(200).json({ key });
};
