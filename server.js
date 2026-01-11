import express from "express";

const app = express();
app.use(express.json({ limit: "200kb" }));

// Basic CORS (lock this down to your GitHub Pages URL later)
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

app.get("/", (req, res) => res.send("OK"));

app.post("/packing-suggestions", async (req, res) => {
  try {
    const { destination, dates, nights, activities, notes } = req.body || {};

    // Minimal validation
    if (!destination || !nights) {
      return res.status(400).json({ error: "Missing destination or nights" });
    }

    const prompt = `
Return JSON only.

Create packing suggestions for a trip with:
Destination: ${destination}
Dates: ${dates || ""}
Nights: ${nights}
Activities: ${(activities || []).join(", ")}
Notes: ${notes || ""}

Return JSON in this exact format:
{
  "suggestions": [
    { "category": "Clothing", "item": "Socks", "qty": 5, "reason": "..." },
    ...
  ]
}

Rules:
- Include quantities when it makes sense
- Group into practical categories (Clothing, Toiletries, Tech, Outdoors, Misc)
- Keep it concise (max 40 items)
- No markdown, no extra keys, JSON only
    `.trim();

    // Call OpenAI Responses API
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: "Server missing OPENAI_API_KEY" });

    const r = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        input: prompt,
        temperature: 0.4
      })
    });

    if (!r.ok) {
      const txt = await r.text();
      return res.status(500).json({ error: "OpenAI error", detail: txt.slice(0, 500) });
    }

    const data = await r.json();

    // Responses API text output extraction (simple approach)
    const text = data.output_text || "";
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      return res.status(500).json({ error: "AI did not return valid JSON", raw: text.slice(0, 500) });
    }

    return res.json(parsed);
  } catch (e) {
    return res.status(500).json({ error: "Server error", detail: String(e) });
  }
});

const port = process.env.PORT || 10000;
app.listen(port, () => console.log("Listening on", port));
