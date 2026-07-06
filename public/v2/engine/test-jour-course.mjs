import { genererContenuRace, placerSeanceCourse } from './plan-generator.js';

console.log('--- Test 1 : 5K (quasi-plat, progression légère) ---');
{
  const r = genererContenuRace({ distance: '5K', alluresSec: { C: 252 } }); // 4:12/km
  console.log(r.contenu);
  const ok = r.sousType === 'race' && r.kmEstime === 5 && r.contenu.includes('Dernier km : tout donner');
  console.log('Structure attendue :', ok ? 'OK' : 'ÉCHEC');
}

console.log('\n--- Test 2 : 10K (2 segments nets) ---');
{
  const r = genererContenuRace({ distance: '10K', alluresSec: { C: 291 } }); // 4:51/km
  console.log(r.contenu);
  const ok = r.sousType === 'race' && r.kmEstime === 10 &&
    r.contenu.includes('Km 1-5') && r.contenu.includes('Km 6-10');
  console.log('2 segments nets présents :', ok ? 'OK' : 'ÉCHEC');
}

console.log('\n--- Test 3 : Semi (allure stable, pas de paliers) ---');
{
  const r = genererContenuRace({ distance: 'Semi', alluresSec: { C: 304 } }); // 5:04/km
  console.log(r.contenu);
  const ok = r.sousType === 'race' && Math.abs(r.kmEstime - 21.1) < 0.1 &&
    r.contenu.includes('ajuste au ressenti');
  console.log('Structure allure stable présente :', ok ? 'OK' : 'ÉCHEC');
}

console.log('\n--- Test 4 : Marathon (même structure que Semi) ---');
{
  const r = genererContenuRace({ distance: 'Marathon', alluresSec: { C: 327 } }); // 5:27/km
  console.log(r.contenu);
  const ok = r.sousType === 'race' && Math.abs(r.kmEstime - 42.2) < 0.1 &&
    r.contenu.includes('ajuste au ressenti');
  console.log('Structure allure stable présente :', ok ? 'OK' : 'ÉCHEC');
}

console.log('\n--- Test 5 : placerSeanceCourse remplace bien le dernier jour du plan ---');
{
  const plan = {
    distance: '10K',
    semaines: [
      { semaineNum: 1, assignment: { 6: { type: 'longue', contenu: 'Sortie longue générique' } } }
    ]
  };
  placerSeanceCourse(plan, { C: 291 });
  const dernierJour = plan.semaines[0].assignment[6];
  console.log('Type devenu "race" :', dernierJour.type === 'race' ? 'OK' : 'ÉCHEC');
  console.log('estCourse === true :', dernierJour.estCourse === true ? 'OK' : 'ÉCHEC');
  console.log('Contenu remplacé (plus générique) :', dernierJour.contenu !== 'Sortie longue générique' ? 'OK' : 'ÉCHEC');
}

console.log('\n--- Test 6 : placerSeanceCourse silencieux si pas de semaines ---');
{
  const plan = { distance: '10K', semaines: [] };
  try {
    placerSeanceCourse(plan, { C: 291 });
    console.log('Pas de crash sur plan vide : OK');
  } catch (e) {
    console.log('Pas de crash sur plan vide : ÉCHEC -', e.message);
  }
}
