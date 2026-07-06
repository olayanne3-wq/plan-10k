import * as PdfExport from './pdf-export.js';

console.log('--- Chargement du module pdf-export.js ---');
console.log('Exports:', Object.keys(PdfExport));
console.log('genererEtTelechargerPDF est une fonction :', typeof PdfExport.genererEtTelechargerPDF === 'function');

// Note : on ne peut pas tester l'exécution réelle de genererEtTelechargerPDF
// ici, car elle dépend de window.jspdf (librairie chargée via <script src>
// dans le navigateur, absente de l'environnement Node). Ce test vérifie
// uniquement que le module se charge sans erreur de syntaxe/référence et
// exporte la fonction attendue — la génération PDF elle-même reste à
// vérifier manuellement dans le navigateur après déploiement.
