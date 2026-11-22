# Guide du contributeur — bosco

Merci de votre intérêt pour bosco, un outil open source (Apache-2.0),
auto-hébergé, qui réunit le travail quotidien d'un engineering manager.

## Environnement

- Node.js 22.12 ou plus récent (engines du vitest 5 du socle), pnpm via
  corepack (`corepack pnpm`).
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

Les versions sont arbitrées par [Changesets](https://github.com/changesets/changesets)
: pour tout changement visible, ajouter une entrée avec `pnpm changeset`.

## Commits

- Conventional Commits : `type(scope): résumé`, types `feat`, `fix`, `chore`,
  `refactor`, `test`, `docs` ;
- chaque commit porte un `Signed-off-by:` conforme à l'identité git
  (`git commit -s`), vérifié en CI (DCO) ;
- toute nouvelle dépendance doit être compatible avec la licence
  Apache-2.0 : ni GPL, ni AGPL, ni SSPL.

## Propriété d'un dossier

- une branche par contributeur, ouverte sur `main` ;
- toujours travailler dans son propre worktree ou clone, jamais sur la
  branche courante d'un autre ;
- ne pas merger une PR soi-même : la revue passe d'abord par les
  mainteneurs.

## Charte de collecte des données

Toute contribution qui touche les données Personnelles doit respecter la
[charte de collecte des données](docs/data-collection-charter.fr.md).
