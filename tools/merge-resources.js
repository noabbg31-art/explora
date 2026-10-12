// Fusionne les lots de ressources (générés par les agents de la phase 2) dans topics.json.
// Usage : node merge-resources.js <fichier1.json> <fichier2.json> ...
// Chaque fichier doit contenir un tableau de { slug, resources: [{title,url,type}, ...] }.
const fs = require('fs');
const path = require('path');

const PROJECT = 'C:\\Users\\Admin\\OneDrive - Groupe IGENSIA Education\\Documents\\cours\\learn\\offi\\explora\\explora';
const topicsPath = path.join(PROJECT, 'data', 'topics.json');
const topics = JSON.parse(fs.readFileSync(topicsPath, 'utf8'));
const bySlug = new Map(topics.map((t) => [t.slug, t]));

const files = process.argv.slice(2);
if (!files.length) {
  console.error('Usage: node merge-resources.js <fichier1.json> [fichier2.json ...]');
  process.exit(1);
}

let updated = 0;
let skippedUnknown = 0;
let skippedEmpty = 0;
let skippedAlready = 0;
const warnings = [];

for (const file of files) {
  if (!fs.existsSync(file)) {
    warnings.push(`Fichier introuvable : ${file}`);
    continue;
  }
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  for (const entry of data) {
    const topic = bySlug.get(entry.slug);
    if (!topic) {
      warnings.push(`[${path.basename(file)}] slug inconnu "${entry.slug}" — ignoré`);
      skippedUnknown++;
      continue;
    }
    if (!entry.resources || !entry.resources.length) {
      warnings.push(`[${path.basename(file)}] aucune ressource pour "${entry.slug}" — ignoré`);
      skippedEmpty++;
      continue;
    }
    if (topic.resources && topic.resources.length) {
      skippedAlready++;
      continue; // déjà peuplé par un lot précédent, on ne l'écrase pas
    }
    // Valide la forme de chaque ressource
    // Les PDF sont exclus : on privilégie wikis, blogs, GitHub, forums et sites de ressources
    const valid = entry.resources.filter((r) => {
      if (!(r && r.title && r.url && r.type)) return false;
      if (/\.pdf(?:$|[?#])/i.test(r.url)) {
        warnings.push(`[${path.basename(file)}] PDF écarté pour "${entry.slug}" : ${r.url}`);
        return false;
      }
      return true;
    });
    if (!valid.length) {
      warnings.push(`[${path.basename(file)}] ressources mal formées pour "${entry.slug}" — ignoré`);
      skippedEmpty++;
      continue;
    }
    topic.resources = valid;
    updated++;
  }
}

fs.writeFileSync(topicsPath, JSON.stringify(topics, null, 2), 'utf8');

console.log(`Sujets mis à jour : ${updated}`);
console.log(`Déjà peuplés (ignorés) : ${skippedAlready}`);
console.log(`Slugs inconnus : ${skippedUnknown}`);
console.log(`Entrées vides/mal formées : ${skippedEmpty}`);
if (warnings.length) {
  console.log(`\n${warnings.length} avertissements :`);
  warnings.slice(0, 30).forEach((w) => console.log(' - ' + w));
  if (warnings.length > 30) console.log(`   … et ${warnings.length - 30} de plus`);
}

const remaining = topics.filter((t) => !t.resources || !t.resources.length).length;
console.log(`\nSujets encore sans ressources : ${remaining} / ${topics.length}`);
