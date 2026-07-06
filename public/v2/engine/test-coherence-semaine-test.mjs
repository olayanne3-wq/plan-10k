import { injecterCoherenceSemaineTest, NOTES_SEMAINE_TEST } from './plan-generator.js';

function creerPlanTest(assignment) {
  return {
    semaines: [{ semaineNum: 1, phase: 'Specifique', assignment }]
  };
}

console.log('--- Test 1 : annonce en tête de semaine ---');
{
  const plan = creerPlanTest({
    0: { type: 'repos', contenu: 'Repos' },
    2: { type: 'qualite', sousType: 'test', contenu: 'Séance test', estTest: true }
  });
  injecterCoherenceSemaineTest(plan);
  const ok = NOTES_SEMAINE_TEST['annonce'].some(v => plan.semaines[0].assignment[0].contenu.includes(v));
  console.log('Annonce présente sur le 1er jour :', ok ? 'OK' : 'ÉCHEC');
}

console.log('\n--- Test 2 : contexte veille-test sur le jour juste avant ---');
{
  const plan = creerPlanTest({
    0: { type: 'repos', contenu: 'Repos' },
    1: { type: 'ef', contenu: 'Séance EF veille', role: 'standard' },
    2: { type: 'qualite', sousType: 'test', contenu: 'Séance test', estTest: true }
  });
  injecterCoherenceSemaineTest(plan);
  const veille = plan.semaines[0].assignment[1];
  const noteOk = NOTES_SEMAINE_TEST['veille-test'].some(v => veille.contenu.includes(v));
  const roleOk = veille.role === 'standard+veille-test';
  console.log('Note veille-test présente :', noteOk ? 'OK' : 'ÉCHEC');
  console.log('Rôle existant préservé + veille-test ajouté :', roleOk ? 'OK' : 'ÉCHEC');
}

console.log('\n--- Test 3 : contexte lendemain-test sur le jour juste après ---');
{
  const plan = creerPlanTest({
    2: { type: 'qualite', sousType: 'test', contenu: 'Séance test', estTest: true },
    3: { type: 'ef', contenu: 'Séance EF lendemain', role: 'recuperation' }
  });
  injecterCoherenceSemaineTest(plan);
  const lendemain = plan.semaines[0].assignment[3];
  const noteOk = NOTES_SEMAINE_TEST['lendemain-test'].some(v => lendemain.contenu.includes(v));
  const roleOk = lendemain.role === 'recuperation+lendemain-test';
  console.log('Note lendemain-test présente :', noteOk ? 'OK' : 'ÉCHEC');
  console.log('Rôle existant préservé + lendemain-test ajouté :', roleOk ? 'OK' : 'ÉCHEC');
}

console.log('\n--- Test 4 : aucune modification si pas de séance test dans le plan ---');
{
  const plan = creerPlanTest({
    0: { type: 'repos', contenu: 'Repos' },
    1: { type: 'ef', contenu: 'Séance EF normale' }
  });
  const contenuAvant = plan.semaines[0].assignment[1].contenu;
  injecterCoherenceSemaineTest(plan);
  console.log('Contenu inchangé (pas de séance test) :', plan.semaines[0].assignment[1].contenu === contenuAvant ? 'OK' : 'ÉCHEC');
}

console.log('\n--- Test 5 : la séance test elle-même ne reçoit pas la note "annonce" ---');
{
  // Cas limite : la séance test est le 1er jour de sa semaine (peu probable
  // en pratique vu placerSeanceTest, mais le garde-fou doit tenir)
  const plan = creerPlanTest({
    0: { type: 'qualite', sousType: 'test', contenu: 'Séance test', estTest: true }
  });
  injecterCoherenceSemaineTest(plan);
  const inchange = plan.semaines[0].assignment[0].contenu === 'Séance test';
  console.log("Séance test non modifiée par l'annonce :", inchange ? 'OK' : 'ÉCHEC');
}
