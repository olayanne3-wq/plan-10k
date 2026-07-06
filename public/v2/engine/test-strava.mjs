import { calculerMedianeVolumeHebdo, extraireTokensDepuisUrl, urlConnexionStrava } from './strava.js';

console.log('--- urlConnexionStrava ---');
console.log(urlConnexionStrava());
console.log('Attendu : /api/strava/auth?state=v2');

console.log('\n--- extraireTokensDepuisUrl ---');
const tokens = extraireTokensDepuisUrl('?access_token=abc123&refresh_token=xyz789&expires_at=1234567890');
console.log(tokens);
console.log('Attendu : { accessToken: "abc123", refreshToken: "xyz789", expiresAt: "1234567890" }');

const sansToken = extraireTokensDepuisUrl('?foo=bar');
console.log('Sans access_token :', sansToken, '(attendu : null)');

console.log('\n--- calculerMedianeVolumeHebdo ---');

// Cas 1 : 3 semaines de volumes différents -> médiane = valeur du milieu
const activites1 = [
  { type: 'Run', start_date_local: '2026-06-01', distance: 10000 }, // semaine du 2026-06-01 (lundi)
  { type: 'Run', start_date_local: '2026-06-08', distance: 20000 }, // semaine suivante
  { type: 'Run', start_date_local: '2026-06-15', distance: 30000 }, // semaine suivante
];
console.log('3 semaines (10km, 20km, 30km) -> médiane:', calculerMedianeVolumeHebdo(activites1), '(attendu: 20)');

// Cas 2 : nombre pair de semaines -> moyenne des deux valeurs centrales
const activites2 = [
  { type: 'Run', start_date_local: '2026-06-01', distance: 10000 },
  { type: 'Run', start_date_local: '2026-06-08', distance: 20000 },
  { type: 'Run', start_date_local: '2026-06-15', distance: 30000 },
  { type: 'Run', start_date_local: '2026-06-22', distance: 40000 },
];
console.log('4 semaines (10,20,30,40km) -> médiane:', calculerMedianeVolumeHebdo(activites2), '(attendu: 25)');

// Cas 3 : activités non-Run ignorées
const activites3 = [
  { type: 'Run', start_date_local: '2026-06-01', distance: 10000 },
  { type: 'Ride', start_date_local: '2026-06-01', distance: 50000 }, // doit être ignoré
];
console.log('Run + Ride (Ride ignoré) -> médiane:', calculerMedianeVolumeHebdo(activites3), '(attendu: 10)');

// Cas 4 : aucune activité -> null
console.log('Aucune activité -> médiane:', calculerMedianeVolumeHebdo([]), '(attendu: null)');

// Cas 5 : plusieurs activités dans la même semaine -> cumulées
const activites5 = [
  { type: 'Run', start_date_local: '2026-06-01', distance: 5000 }, // lundi
  { type: 'Run', start_date_local: '2026-06-03', distance: 5000 }, // mercredi, même semaine
];
console.log('2 sorties même semaine (5+5km) -> médiane:', calculerMedianeVolumeHebdo(activites5), '(attendu: 10)');
