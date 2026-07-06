import { getGithubToken, setGithubToken, getV2GistId, setV2GistId } from './gist-sync.js';

// --- Mock localStorage minimal ---
function creerStorageMock() {
  const data = {};
  return {
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => { data[k] = v; },
    _dump: () => ({ ...data })
  };
}

console.log('--- getGithubToken / setGithubToken ---');
const storage1 = creerStorageMock();
console.log('Token avant set :', getGithubToken(storage1), '(attendu: "")');
setGithubToken('abc123', storage1);
console.log('Token après set :', getGithubToken(storage1), '(attendu: "abc123")');

console.log('\n--- getV2GistId / setV2GistId ---');
const storage2 = creerStorageMock();
console.log('GistId avant set :', getV2GistId(storage2), '(attendu: "")');
setV2GistId('gist-xyz', storage2);
console.log('GistId après set :', getV2GistId(storage2), '(attendu: "gist-xyz")');

console.log('\n--- Isolation entre storages distincts (pas de fuite globale) ---');
const storageA = creerStorageMock();
const storageB = creerStorageMock();
setGithubToken('token-A', storageA);
setGithubToken('token-B', storageB);
console.log('storageA:', getGithubToken(storageA), '(attendu: "token-A")');
console.log('storageB:', getGithubToken(storageB), '(attendu: "token-B")');

console.log('\n--- chargerPlans sans token ni gistId ---');
// Import dynamique pour tester avec un fetch non défini (ne doit pas planter,
// doit retourner [] avant même d'appeler fetch)
import('./gist-sync.js').then(async ({ chargerPlans }) => {
  const storageVide = creerStorageMock();
  const plans = await chargerPlans(storageVide);
  console.log('Plans (sans token/gistId) :', plans, '(attendu: [])');
});
