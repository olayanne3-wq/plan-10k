/**
 * strava.js
 * Intégration Strava — Run by Léa v2.0
 *
 * Module pur (aucune dépendance DOM) — testable en isolation.
 * Réutilise le point d'entrée serverless existant de v1 (api/strava.js,
 * endpoints /auth /callback /refresh /activities), avec un paramètre
 * "state=v2" ajouté pour que le callback redirige vers v2. Tokens stockés
 * sous des clés distinctes de v1 (v2_strava_*) pour ne pas interférer avec
 * sa propre session Strava.
 *
 * Le storage (localStorage par défaut) est injectable pour rester testable
 * hors navigateur et réutilisable dans d'autres contextes (ex: Capacitor).
 */

const STORAGE_KEYS = {
  accessToken: 'v2_strava_access_token',
  refreshToken: 'v2_strava_refresh_token',
  expiresAt: 'v2_strava_expires_at'
};

export function getStravaTokens(storage = localStorage) {
  return {
    accessToken: storage.getItem(STORAGE_KEYS.accessToken),
    refreshToken: storage.getItem(STORAGE_KEYS.refreshToken),
    expiresAt: parseInt(storage.getItem(STORAGE_KEYS.expiresAt) || '0', 10)
  };
}

export function setStravaTokens({ accessToken, refreshToken, expiresAt }, storage = localStorage) {
  if (accessToken) storage.setItem(STORAGE_KEYS.accessToken, accessToken);
  if (refreshToken) storage.setItem(STORAGE_KEYS.refreshToken, refreshToken);
  if (expiresAt) storage.setItem(STORAGE_KEYS.expiresAt, expiresAt);
}

// Efface les tokens Strava stockés (déconnexion locale — ne révoque pas
// l'autorisation côté Strava lui-même, seulement les tokens conservés
// dans ce storage). Utile notamment pour retester le flux OAuth complet
// sans devoir passer par les réglages du navigateur.
export function clearStravaTokens(storage = localStorage) {
  storage.removeItem(STORAGE_KEYS.accessToken);
  storage.removeItem(STORAGE_KEYS.refreshToken);
  storage.removeItem(STORAGE_KEYS.expiresAt);
}

// Construit l'URL d'autorisation Strava (state=v2 pour que le callback
// redirige vers v2). La navigation elle-même (window.location.href = ...)
// reste à la charge de l'appelant : effet de bord hors du périmètre de ce
// module pur.
export function urlConnexionStrava() {
  return '/api/strava/auth?state=v2';
}

// Extrait les tokens depuis les search params d'une URL (typiquement
// window.location.search après retour de Strava). Ne modifie rien :
// le nettoyage de l'URL (history.replaceState) reste à la charge de
// l'appelant.
export function extraireTokensDepuisUrl(search) {
  const params = new URLSearchParams(search);
  const accessToken = params.get('access_token');
  if (!accessToken) return null;
  return {
    accessToken,
    refreshToken: params.get('refresh_token'),
    expiresAt: params.get('expires_at')
  };
}

// Rafraîchit le token si expiré (ou proche de l'être), sinon renvoie tel
// quel. Persiste le nouveau token dans le storage fourni si rafraîchi.
export async function assurerTokenStravaValide(storage = localStorage) {
  let { accessToken, refreshToken, expiresAt } = getStravaTokens(storage);
  if (!accessToken) return null;
  const maintenant = Math.floor(Date.now() / 1000);
  if (expiresAt && expiresAt < maintenant + 60 && refreshToken) {
    try {
      const resp = await fetch('/api/strava/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken })
      });
      const data = await resp.json();
      if (data.access_token) {
        setStravaTokens({ accessToken: data.access_token, refreshToken: data.refresh_token, expiresAt: data.expires_at }, storage);
        accessToken = data.access_token;
      }
    } catch (e) {
      console.warn('Rafraîchissement token Strava échoué :', e.message);
    }
  }
  return accessToken;
}

// Médiane (pas moyenne, cf. doc — moins sensible aux semaines atypiques) du
// volume hebdomadaire (km) sur les activités de type Run fournies
export function calculerMedianeVolumeHebdo(activites) {
  const semaineDe = (dateStr) => {
    const d = new Date(dateStr + 'T00:00:00Z');
    const jour = (d.getUTCDay() + 6) % 7; // 0 = Lundi
    const lundi = new Date(d);
    lundi.setUTCDate(d.getUTCDate() - jour);
    return lundi.toISOString().slice(0, 10);
  };
  const totalParSemaine = {};
  activites.forEach(a => {
    if (a.type !== 'Run') return;
    const dateLocal = (a.start_date_local || a.start_date || '').slice(0, 10);
    if (!dateLocal) return;
    const cle = semaineDe(dateLocal);
    totalParSemaine[cle] = (totalParSemaine[cle] || 0) + (a.distance || 0) / 1000;
  });
  const valeurs = Object.values(totalParSemaine).sort((a, b) => a - b);
  if (valeurs.length === 0) return null;
  const milieu = Math.floor(valeurs.length / 2);
  return Math.round(valeurs.length % 2 === 0 ? (valeurs[milieu - 1] + valeurs[milieu]) / 2 : valeurs[milieu]);
}

// Récupère le volume hebdomadaire médian des 8 dernières semaines depuis
// Strava, à partir d'un access token déjà validé. Fonction pure côté
// résultat : retourne soit { mediane } soit { erreur }, ne touche à aucun
// élément du DOM. L'appelant décide comment refléter ce résultat à l'écran.
export async function recupererVolumeStrava(accessToken) {
  const huitSemaines = new Date();
  huitSemaines.setDate(huitSemaines.getDate() - 8 * 7);
  const planStart = huitSemaines.toISOString().slice(0, 10);

  try {
    const resp = await fetch(`/api/strava/activities?token=${accessToken}&plan_start=${planStart}`);
    const activites = await resp.json();
    if (!Array.isArray(activites)) throw new Error('Réponse Strava invalide');
    const mediane = calculerMedianeVolumeHebdo(activites);
    return { mediane };
  } catch (e) {
    return { erreur: e.message };
  }
}
