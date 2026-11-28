# Bosco

Outil open source et auto-hébergé qui réunit le travail quotidien d'un
engineering manager : les personnes, les tâches, les projets et les
métriques d'équipe.

Bosco simplifie la vie des managers ; ce n'est pas un SIRH. Seuls les
managers l'utilisent, chacun en autonomie : les personnes qu'ils encadrent
sont des fiches tenues par le manager, sans compte. Une installation est
partagée par toute l'entreprise : tout compte Google du domaine de
l'entreprise (réglé dans le `.env` par qui déploie) devient manager à sa
première connexion. La v0 n'a ni administrateur ni invitation ; un rôle
d'administration viendra avec l'hébergement cloud.

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
défaut, et les variables obligatoires : base de données, URL publique,
client OAuth Google) sont documentées dans `apps/api/.env.example` ; la
connexion Google est décrite dans le
[guide d'authentification](docs/authentication.fr.md)
([english version](docs/authentication.en.md)).

Voir [le guide du contributeur](CONTRIBUTING.md) et la
[charte de collecte des données](docs/data-collection-charter.fr.md)
([english version](docs/data-collection-charter.en.md)).

## Licence

Apache-2.0 — voir [LICENSE](LICENSE).
