// Proxy simple vers Open-Meteo (https://open-meteo.com/) — pas de clé API,
// pas d'inscription. Choisi pour l'absence de friction et un volume gratuit
// large (10 000 appels/jour en usage non commercial), cf.
// docs/v2-methodologie/convergence-v1-v2.md section 2.2. Limite explicitement
// actée : à revoir si l'app passe en usage commercial (v2.5).
//
// Reçoit latitude/longitude (géolocalisation GPS de l'utilisateur, pas une
// ville renseignée manuellement, cf. décision du doc) et une date cible,
// renvoie la température maximale prévue pour ce jour + un flag
// "alerteChaleur" si elle dépasse le seuil de 28°C (repris de v1, fixe).
export default async function handler(req, res) {
  const { lat, lon, date } = req.query || {};
  if (!lat || !lon) {
    return res.status(400).json({ error: "Paramètres lat/lon manquants" });
  }

  const SEUIL_CHALEUR_C = 28;

  try {
    const params = new URLSearchParams({
      latitude: lat,
      longitude: lon,
      daily: "temperature_2m_max",
      timezone: "auto",
      forecast_days: "7" // Open-Meteo fiabilise ses prévisions à J+7 max
    });
    const resp = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
    if (!resp.ok) {
      return res.status(502).json({ error: "Open-Meteo indisponible", status: resp.status });
    }
    const data = await resp.json();

    const dateCible = date || new Date().toISOString().slice(0, 10);
    const index = (data.daily?.time || []).indexOf(dateCible);
    if (index === -1) {
      // Date hors de la fenêtre de prévision disponible (ex. trop loin dans
      // le futur) — pas une erreur, juste rien à renvoyer pour ce jour.
      res.setHeader("Access-Control-Allow-Origin", "*");
      return res.status(200).json({ disponible: false });
    }

    const temperatureMaxC = data.daily.temperature_2m_max[index];
    res.setHeader("Access-Control-Allow-Origin", "*");
    return res.status(200).json({
      disponible: true,
      date: dateCible,
      temperatureMaxC,
      alerteChaleur: temperatureMaxC > SEUIL_CHALEUR_C
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
