// ─────────────────────────────────────────────────────────────
// server.js — le backend Node/Express
// Rôle : 1) servir les fichiers du front (dossier public/)
//        2) exposer une petite API JSON que le front interroge
// ─────────────────────────────────────────────────────────────
const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Chargement des données au démarrage.
// Dans un vrai projet, ce serait une base (PostgreSQL, MongoDB…).
const topics = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'data', 'topics.json'), 'utf8')
);
const categories = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'data', 'categories.json'), 'utf8')
);

// Normalise une chaîne pour la recherche : minuscules, sans accents.
const normalize = (s) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

// Middleware : sert tout le contenu de public/ (index.html, style.css, app.js)
app.use(express.static(path.join(__dirname, 'public')));

// ── API ──────────────────────────────────────────────────────

// Petit helper : retrouve la catégorie {slug, name} d'un sujet
const categoryOf = (topic) => {
  const c = categories.find((cat) => cat.slug === topic.category);
  return c ? { slug: c.slug, name: c.name } : null;
};

// GET /api/search?q=jav  → suggestions pour la barre de recherche
app.get('/api/search', (req, res) => {
  const q = normalize(String(req.query.q || '').trim());
  if (!q) return res.json([]);

  const results = topics
    .filter((t) => normalize(t.name).includes(q) || t.slug.includes(q))
    // Les sujets qui COMMENCENT par la requête passent en premier
    .sort((a, b) => normalize(b.name).startsWith(q) - normalize(a.name).startsWith(q))
    .slice(0, 6)
    .map((t) => ({ slug: t.slug, name: t.name, category: categoryOf(t) }));

  res.json(results);
});

// Sujets "liés" : on utilise la liste écrite à la main si elle existe
// (anciens sujets), sinon on prend simplement quelques voisins de la
// même catégorie — indispensable dès qu'on a des centaines de sujets,
// impossible à curer un par un à la main.
const relatedOf = (topic) => {
  const explicit = topic.related || [];
  if (explicit.length) {
    return explicit
      .map((slug) => topics.find((t) => t.slug === slug))
      .filter(Boolean)
      .map(({ slug, name }) => ({ slug, name }));
  }
  const siblings = topics.filter((t) => t.category === topic.category && t.slug !== topic.slug);
  // Décalage déterministe basé sur le slug : des "voisins" stables, mais
  // pas toujours les 4 mêmes en tête de liste pour chaque sujet.
  const seed = topic.slug.split('').reduce((sum, c) => sum + c.charCodeAt(0), 0);
  const start = siblings.length ? seed % siblings.length : 0;
  const picked = [];
  for (let i = 0; i < Math.min(4, siblings.length); i++) {
    picked.push(siblings[(start + i) % siblings.length]);
  }
  return picked.map(({ slug, name }) => ({ slug, name }));
};

// GET /api/topics/:slug  → fiche complète d'un sujet
app.get('/api/topics/:slug', (req, res) => {
  const topic = topics.find((t) => t.slug === req.params.slug);
  if (!topic) return res.status(404).json({ error: 'Sujet introuvable' });

  res.json({
    ...topic,
    resources: topic.resources || [],
    related: relatedOf(topic),
    category: categoryOf(topic),
  });
});

// GET /api/topics  → liste de tous les sujets (recherche globale, etc.)
app.get('/api/topics', (_req, res) => {
  res.json(topics.map(({ slug, name, category }) => ({ slug, name, category })));
});

// GET /api/categories  → toutes les catégories, avec le nombre de sujets
app.get('/api/categories', (_req, res) => {
  res.json(
    categories.map((c) => ({
      ...c,
      count: topics.filter((t) => t.category === c.slug).length,
    }))
  );
});

// GET /api/categories/:slug  → fiche d'une catégorie + ses sujets
app.get('/api/categories/:slug', (req, res) => {
  const category = categories.find((c) => c.slug === req.params.slug);
  if (!category) return res.status(404).json({ error: 'Catégorie introuvable' });

  const categoryTopics = topics
    .filter((t) => t.category === category.slug)
    .map(({ slug, name, summary }) => ({ slug, name, summary }));

  res.json({ ...category, topics: categoryTopics });
});

// ── Fallback SPA ─────────────────────────────────────────────
// Toute autre URL (ex. /javascript) renvoie index.html :
// c'est le JS du front qui lit l'URL et affiche la bonne vue.
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Explora tourne sur http://localhost:${PORT}`);
});
