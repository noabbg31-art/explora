# Explora — mini plateforme d'apprentissage

Projet pédagogique : une barre « Je veux apprendre… », de l'autocomplétion, une page par sujet avec ressources et sujets liés.

## Lancer

```bash
npm install
npm start          # ou : npm run dev (redémarre à chaque modif)
```
→ http://localhost:3000

## Arborescence

```
explora/
├── server.js             # Backend Node/Express : API + sert le front
├── package.json          # Dépendances et scripts npm
├── data/
│   ├── categories.json   # Les grandes catégories (développement, histoire…)
│   └── topics.json       # Les sujets, chacun rattaché à une catégorie
└── public/                # Tout ce qui part au navigateur
    ├── index.html         # Squelette + <template> des vues (accueil, catégorie, sujet)
    ├── style.css           # Thème (variables CSS, mode sombre, curseur animé)
    └── app.js             # Routeur SPA, appels API, autocomplétion, effets de curseur
```

## Le flux, en une phrase par étape

1. Le navigateur demande `/javascript` → Express ne trouve pas de fichier, renvoie `index.html` (fallback SPA).
2. `app.js` lit l'URL : `/` → accueil, `/c/histoire` → page catégorie, `/javascript` → page sujet.
3. Pour un sujet, `app.js` appelle `GET /api/topics/javascript`.
4. `server.js` cherche le sujet dans `topics.json`, résout sa catégorie et ses sujets liés, renvoie du JSON.
5. `app.js` clone le `<template>` correspondant, le remplit, l'injecte dans `<main>`.
6. Un clic sur un lien `data-link` → `history.pushState` + nouveau rendu, **sans recharger la page**.

## API

| Route | Renvoie |
|---|---|
| `GET /api/categories` | toutes les catégories, avec le nombre de sujets de chacune |
| `GET /api/categories/:slug` | fiche d'une catégorie + la liste de ses sujets |
| `GET /api/topics` | tous les sujets `{slug, name, category}` |
| `GET /api/search?q=jav` | 6 suggestions max, avec la catégorie de chaque sujet |
| `GET /api/topics/:slug` | fiche complète (sujets liés résolus, catégorie incluse ; 404 si inconnu) |

## Catégories actuelles

Développement, Cybersécurité, Informatique, Histoire, Géopolitique, Philosophie, Littérature, Sciences, Économie — chacune avec quelques sujets de départ dans `data/topics.json`. Pour ajouter un sujet : lui donner un `slug` unique, le rattacher à une `category` existante (voir `data/categories.json`), puis renseigner `summary`, `related` (slugs d'autres sujets) et `resources` (`title`, `url`, `type` — `doc`, `cours`, `jeu`, `site` ou `outil`).

## Pistes pour aller plus loin

- Remplacer les fichiers JSON par PostgreSQL ou SQLite
- Ajouter des comptes (suivre ses sujets, marquer une ressource comme « lue »)
- Réécrire le front en framework (React, Svelte, Solid) pour comparer
- Afficher les sujets liés en graphe (D3.js, Cytoscape)
- Étoffer chaque catégorie avec davantage de sujets
