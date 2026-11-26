# Guide du contributeur — bosco

[English](CONTRIBUTING.md) · Français

Merci de votre intérêt pour bosco, un outil open source (Apache-2.0),
auto-hébergé, qui réunit le travail quotidien d'un engineering manager.

## Environnement

- Node.js 24 ou plus récent, pnpm via corepack (`corepack pnpm`).
- cloner puis installer : `pnpm install` ;
- vérification complète (lint, format, types, tests) :

  ```bash
  pnpm lint
  pnpm format:check
  pnpm typecheck
  pnpm test
  ```

- tout nouveau workspace reprend le même jeu de scripts (`build`, `lint`,
  `test`, `typecheck`), orchestrés par Turborepo.

## Versioning

Les versions sont gérées par [release-please](https://github.com/googleapis/release-please)
: il lit les Conventional Commits fusionnés sur `main` et ouvre une PR de
release qui monte la version et met à jour `CHANGELOG.md` (`fix` → patch,
`feat` → mineure, `!` → majeure, ou mineure tant que la version est
inférieure à 1.0.0). Fusionner cette PR crée le tag de release.

## Commits

- Conventional Commits : `type(scope): résumé`, types `feat`, `fix`, `chore`,
  `refactor`, `test`, `docs` ;
- toute nouvelle dépendance doit être compatible avec la licence
  Apache-2.0 : ni GPL, ni AGPL, ni SSPL.

## Propriété d'un dossier

- une branche par contributeur, ouverte sur `main` ;
- toujours travailler dans son propre worktree ou clone, jamais sur la
  branche courante d'un autre ;
- ne pas merger une PR soi-même : la revue passe d'abord par les
  mainteneurs.

## Charte de collecte des données

Toute contribution qui touche les données personnelles doit respecter la
[charte de collecte des données](docs/data-collection-charter.fr.md).
