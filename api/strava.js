export default async function handler(req, res) {
  const CLIENT_ID = process.env.STRAVA_CLIENT_ID;
  const CLIENT_SECRET = process.env.STRAVA_CLIENT_SECRET;

  const host = req.headers?.host || req.headers?.["x-forwarded-host"];
  const BASE_URL = `https://${host}`;
  const REDIRECT_URI = `${BASE_URL}/api/strava/callback`;

  // Extraire le path après /api/strava
  const path = (req.url || "")
    .replace(/^\/api\/strava/, "")
    .split("?")[0] || "/";

  // ── /auth ────────────────────────────────────────────────────────────────
  if (path === "/auth" || path === "/" || path === "") {
    const params = new URLSearchParams({
      client_id: CLIENT_ID,
      redirect_uri: REDIRECT_URI,
      response_type: "code",
      scope: "activity:read_all",
    });
    return res.redirect(302, `https://www.strava.com/oauth/authorize?${params}`);
  }

  // ── /callback ────────────────────────────────────────────────────────────
  if (path === "/callback") {
    const code = req.query?.code;
    if (!code) return res.status(400).json({ error: "No code" });

    const resp = await fetch("https://www.strava.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        code,
        grant_type: "authorization_code",
      }),
    });
    const data = await resp.json();
    if (data.errors) return res.status(400).json({ error: data.message });

    const params = new URLSearchParams({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: data.expires_at,
    });
    return res.redirect(302, `${BASE_URL}/?${params}`);
  }

  // ── /refresh ─────────────────────────────────────────────────────────────
  if (path === "/refresh") {
    const { refresh_token } = req.body || {};
    const resp = await fetch("https://www.strava.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        refresh_token,
        grant_type: "refresh_token",
      }),
    });
    const data = await resp.json();
    res.setHeader("Access-Control-Allow-Origin", "*");
    return res.status(200).json(data);
  }

  // ── /activities ──────────────────────────────────────────────────────────
  if (path === "/activities") {
    const token = req.query?.token;
    if (!token) return res.status(401).json({ error: "No token" });

    const intervalDatesParam = req.query?.interval_dates;
    const INTERVAL_DATES = intervalDatesParam ? intervalDatesParam.split(",") : [];
    const planStartParam = req.query?.plan_start;
    const after = Math.floor(new Date((planStartParam || "2026-06-22") + "T00:00:00Z").getTime() / 1000);

    const resp = await fetch(
      `https://www.strava.com/api/v3/athlete/activities?after=${after}&per_page=100`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const activities = await resp.json();

    if (!Array.isArray(activities)) {
      res.setHeader("Access-Control-Allow-Origin", "*");
      return res.status(200).json(activities);
    }

    const enriched = await Promise.all(activities.map(async (act) => {
      const dateLocal = act.start_date_local?.slice(0, 10);
      if (act.type === "Run" && INTERVAL_DATES.includes(dateLocal)) {
        try {
          const actId = act.id_str || act.id;
          const lapsResp = await fetch(
            `https://www.strava.com/api/v3/activities/${actId}/laps`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          const laps = await lapsResp.json();
          return { ...act, laps: Array.isArray(laps) ? laps : [] };
        } catch {
          return { ...act, laps: [] };
        }
      }
      return act;
    }));

    res.setHeader("Access-Control-Allow-Origin", "*");
    return res.status(200).json(enriched);
  }

  return res.status(404).send("Not found");
}
