function parseBody(body) {
  if (body && typeof body === "object") return body;
  if (typeof body === "string") {
    try { return JSON.parse(body); } catch (error) { return {}; }
  }
  return {};
}

function clean(value, max) {
  return typeof value === "string" ? value.replace(/[\u0000-\u001F\u007F]/g, "").slice(0, max || 120) : "";
}

export default function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const body = parseBody(req.body);
  const event = {
    event: clean(body.event, 80),
    timestamp: clean(body.timestamp, 40),
    path: clean(body.path, 160),
    properties: body.properties && typeof body.properties === "object" ? body.properties : {}
  };
  if (!event.event) return res.status(400).json({ error: "event is required" });

  // V2 has no database by design. Runtime logs provide a temporary, privacy-safe event stream
  // until persistent analytics storage is selected.
  console.log("[hx-analytics]", JSON.stringify(event));
  return res.status(202).json({ ok: true });
}
