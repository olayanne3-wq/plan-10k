import { injecterNotesPratiques, NOTES_PRATIQUES } from './plan-generator.js';

function creerSemaineTest(assignment) {
  return { semaineNum: 1, phase: 'Construction', assignment };
}

console.log('--- Test 1 : sortie longue reçoit une note hydratation ---');
{
  const semaines = [creerSemaineTest({ 6: { type: 'longue', contenu: 'Sortie longue' } })];
  injecterNotesPratiques(semaines);
  const ok = NOTES_PRATIQUES['longue'].some(v => semaines[0].assignment[6].contenu.includes(v));
  console.log('Note longue présente :', ok ? 'OK' : 'ÉCHEC');
}

console.log('\n--- Test 2 : séance qualité Seuil reçoit une note famille seuil ---');
{
  const semaines = [creerSemaineTest({ 2: { type: 'qualite', sousType: 'seuil-court', contenu: 'Séance seuil' } })];
  injecterNotesPratiques(semaines);
  const ok = NOTES_PRATIQUES['seuil'].some(v => semaines[0].assignment[2].contenu.includes(v));
  console.log('Note seuil présente :', ok ? 'OK' : 'ÉCHEC');
}

console.log('\n--- Test 3 : séance qualité VMA reçoit une note famille vma ---');
{
  const semaines = [creerSemaineTest({ 4: { type: 'qualite', sousType: 'i-30-30', contenu: 'Séance VMA' } })];
  injecterNotesPratiques(semaines);
  const ok = NOTES_PRATIQUES['vma'].some(v => semaines[0].assignment[4].contenu.includes(v));
  console.log('Note VMA présente :', ok ? 'OK' : 'ÉCHEC');
}

console.log('\n--- Test 4 : séance qualité "test" ne reçoit aucune note pratique (traité à part, 2.6) ---');
{
  const semaines = [creerSemaineTest({ 2: { type: 'qualite', sousType: 'test', contenu: 'Séance test' } })];
  injecterNotesPratiques(semaines);
  const inchange = semaines[0].assignment[2].contenu === 'Séance test';
  console.log('Contenu inchangé :', inchange ? 'OK' : 'ÉCHEC');
}

console.log('\n--- Test 5 : séance EF simple ne reçoit aucune note ---');
{
  const semaines = [creerSemaineTest({ 1: { type: 'ef', contenu: 'Séance EF' } })];
  injecterNotesPratiques(semaines);
  const inchange = semaines[0].assignment[1].contenu === 'Séance EF';
  console.log('Contenu inchangé :', inchange ? 'OK' : 'ÉCHEC');
}

console.log('\n--- Test 6 : séance qualité allure-course reçoit une note famille allure-course ---');
{
  const semaines = [creerSemaineTest({ 2: { type: 'qualite', sousType: 'allure-course', contenu: 'Séance allure course' } })];
  injecterNotesPratiques(semaines);
  const ok = NOTES_PRATIQUES['allure-course'].some(v => semaines[0].assignment[2].contenu.includes(v));
  console.log('Note allure-course présente :', ok ? 'OK' : 'ÉCHEC');
}

console.log('\n--- Test 7 : seuil-2min (ex-fartlek) reçoit sa note dédiée, pas la note générique famille seuil ---');
console.log('(bug trouvé le 7 juillet 2026 : Laurent, en lisant sa séance réelle sur un plan Semi,');
console.log(' ne comprenait pas pourquoi une note "vise la régularité" accompagnait un contenu');
console.log(' explicitement alterné rapide/facile — le sous-type était alors nommé "fartlek", un nom');
console.log(' impropre corrigé le même jour : un vrai fartlek est non-structuré/basé sur le ressenti,');
console.log(' pas un protocole précis de répétitions comme celui-ci)');
{
  const semaines = [creerSemaineTest({ 3: { type: 'qualite', sousType: 'seuil-2min', contenu: 'Séance seuil-2min' } })];
  injecterNotesPratiques(semaines);
  const contenuFinal = semaines[0].assignment[3].contenu;
  const aNoteDediee = NOTES_PRATIQUES['seuil-2min'].some(v => contenuFinal.includes(v));
  const aNoteGenerique = NOTES_PRATIQUES['seuil'].some(v => contenuFinal.includes(v));
  console.log('Note seuil-2min dédiée présente :', aNoteDediee ? 'OK' : 'ÉCHEC');
  console.log('Note générique seuil ABSENTE (pas de mélange) :', !aNoteGenerique ? 'OK' : 'ÉCHEC');
}
