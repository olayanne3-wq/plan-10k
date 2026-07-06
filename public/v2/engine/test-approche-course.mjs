import { injecterApprocheCourse, NOTES_APPROCHE_COURSE } from './plan-generator.js';

function creerPlanAvecCourse(jours) {
  return { semaines: [{ semaineNum: 1, assignment: jours }] };
}

console.log('--- Test 1 : notes J-3, J-2, veille présentes aux bons jours ---');
{
  const plan = creerPlanAvecCourse({
    0: { type: 'ef', contenu: 'EF lundi' },
    1: { type: 'ef', contenu: 'EF mardi' },
    2: { type: 'ef', contenu: 'EF mercredi' },  // J-3
    3: { type: 'ef', contenu: 'EF jeudi' },
    4: { type: 'ef', contenu: 'EF vendredi' },  // J-2
    5: { type: 'ef', contenu: 'EF samedi' },    // veille
    6: { type: 'race', contenu: 'Course', estCourse: true }
  });
  injecterApprocheCourse(plan);
  const j3 = plan.semaines[0].assignment[3].contenu; // jeudi, index 3 = indexCourse(6) - 3
  const j2 = plan.semaines[0].assignment[4].contenu;
  const veille = plan.semaines[0].assignment[5].contenu;
  console.log('J-3 (jeudi) a sa note :', NOTES_APPROCHE_COURSE['j3'].some(v => j3.includes(v)) ? 'OK' : 'ÉCHEC');
  console.log('J-2 (vendredi) a sa note :', NOTES_APPROCHE_COURSE['j2'].some(v => j2.includes(v)) ? 'OK' : 'ÉCHEC');
  console.log('Veille (samedi) a sa note :', NOTES_APPROCHE_COURSE['veille'].some(v => veille.includes(v)) ? 'OK' : 'ÉCHEC');
}

console.log('\n--- Test 2 : garde-fou — séance qualité en J-2 convertie en EF léger ---');
console.log('(bug trouvé le 6 juillet 2026 : la note "repos total, hydratation" collée sur');
console.log(' une vraie séance qualité allure-course encore présente à J-2)');
{
  const plan = creerPlanAvecCourse({
    4: { type: 'qualite', sousType: 'allure-course', contenu: 'Séance allure course', kmEstime: 6 },
    5: { type: 'ef', contenu: 'EF samedi' },
    6: { type: 'race', contenu: 'Course', estCourse: true }
  });
  injecterApprocheCourse(plan);
  const j2 = plan.semaines[0].assignment[4];
  console.log('Type converti en "ef" :', j2.type === 'ef' ? 'OK' : 'ÉCHEC');
  console.log('kmEstime réduit (moins que 6km d\'origine) :', j2.kmEstime < 6 ? 'OK' : 'ÉCHEC');
  console.log('Contenu ne mentionne plus "allure course" :', !j2.contenu.includes('allure') ? 'OK' : 'ÉCHEC');
}

console.log('\n--- Test 3 : garde-fou — séance qualité en veille (J-1) convertie aussi ---');
{
  const plan = creerPlanAvecCourse({
    5: { type: 'qualite', sousType: 'seuil-court', contenu: 'Séance seuil veille', kmEstime: 5 },
    6: { type: 'race', contenu: 'Course', estCourse: true }
  });
  injecterApprocheCourse(plan);
  const veille = plan.semaines[0].assignment[5];
  console.log('Type converti en "ef" :', veille.type === 'ef' ? 'OK' : 'ÉCHEC');
}

console.log('\n--- Test 4 : séance qualité à J-4 ou plus n\'est PAS convertie (hors garde-fou) ---');
{
  const plan = creerPlanAvecCourse({
    2: { type: 'qualite', sousType: 'seuil-court', contenu: 'Séance seuil J-4', kmEstime: 7 },
    6: { type: 'race', contenu: 'Course', estCourse: true }
  });
  injecterApprocheCourse(plan);
  const j4 = plan.semaines[0].assignment[2];
  console.log('Type toujours "qualite" (hors garde-fou J-2/veille) :', j4.type === 'qualite' ? 'OK' : 'ÉCHEC');
}

console.log('\n--- Test 5 : silencieux si aucun jour de course trouvé ---');
{
  const plan = creerPlanAvecCourse({ 0: { type: 'ef', contenu: 'EF' } });
  try {
    injecterApprocheCourse(plan);
    console.log('Pas de crash sans jour de course : OK');
  } catch (e) {
    console.log('Pas de crash sans jour de course : ÉCHEC -', e.message);
  }
}
