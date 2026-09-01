export default function handler(req, res) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const avalaiConfigured = Boolean(process.env.AVALAI_API_KEY);
  return res.status(200).json({
    status: "ok",
    version: "v2",
    diagnosis: {
      provider: avalaiConfigured ? "avalai" : "rules",
      avalai_configured: avalaiConfigured,
      fallback: "rules",
      model: avalaiConfigured ? (process.env.AVALAI_MODEL || "gpt-4o-mini") : null
    }
  });
}
