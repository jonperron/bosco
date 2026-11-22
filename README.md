# Bosco

Outil open source et auto-hébergé qui réunit le travail quotidien d'un
engineering manager : les personnes, les tâches, les projets et les
métriques d'équipe.

## État

Socle v0, lot 1 (dépôt et outillage) : monorepo pnpm + Turborepo, outillage
lint/format/tests en place, CI GitHub Actions (tests + DCO). Aucune
fonctionnalité applicative n'est encore livrée.

## Développement

```bash
corepack pnpm install
pnpm test        # Vitest, tous les workspaces, via Turborepo
pnpm lint
pnpm format:check
pnpm typecheck
```

Voir [le guide du contributeur](CONTRIBUTING.md) et la
[charte de collecte des données](docs/data-collection-charter.fr.md)
([english version](docs/data-collection-charter.en.md)).

## Licence

Apache-2.0 — voir [LICENSE](LICENSE).
