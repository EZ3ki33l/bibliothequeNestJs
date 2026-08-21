---
name: prettier
description: Prettier formatting for this NestJS + Vite repo. Use when formatting TS/TSX, adding a formatter, or touching prettier.config.mjs / format scripts.
---

# Prettier

Config racine : `prettier.config.mjs` (découverte en remontant depuis `backend/` et `frontend/`).

Scripts : `pnpm format` / `pnpm format:check` dans `backend/` et `frontend/`.

Sauvegarde : `.vscode/settings.json` → `esbenp.prettier-vscode` + `formatOnSave`.

## Règles

- Laisser Prettier formater — ne pas réindenter à la main
- Une seule config, à la racine — pas de `.prettierrc` dans `backend/` ou `frontend/`
- Pas de second formateur (Biome, dprint) ; le frontend garde oxlint pour le lint, Prettier pour le style
- `endOfLine: "lf"` ; ne pas remettre `{ endOfLine: "auto" }` dans ESLint sauf besoin Windows réel
