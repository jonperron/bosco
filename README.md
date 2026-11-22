# Bosco

Outil open source et auto-hébergé qui réunit le travail quotidien d'un
engineering manager : les personnes, les tâches, les projets et les
métriques d'équipe.

## État

Socle v0, lot 2 (squelette applicatif) : API NestJS avec route de santé
typée et contrat OpenAPI vérifié en CI, client HTTP typé généré depuis ce
contrat, et interface React + Vite bilingue (français / anglais) servie
par le backend. Toujours aucune fonctionnalité de management.

## Développement

```bash
corepack pnpm install
pnpm test        # Vitest, tous les workspaces, via Turborepo
pnpm lint
pnpm format:check
pnpm typecheck
```

Les variables d'environnement de l'API (port, dossier du front à servir,
Swagger UI du contrat à `/api/docs` via `API_DOCS_ENABLED`, désactivé par
défaut) sont documentées dans `apps/api/.env.example`.

Voir [le guide du contributeur](CONTRIBUTING.md) et la
[charte de collecte des données](docs/data-collection-charter.fr.md)
([english version](docs/data-collection-charter.en.md)).

## Licence

Apache-2.0 — voir [LICENSE](LICENSE).
