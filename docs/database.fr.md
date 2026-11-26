# Base de données

[English](database.en.md) · Français

bosco stocke tout dans PostgreSQL, sa seule dépendance externe. Le paquet
`@bosco/db` (`packages/db`) contient le schéma Drizzle, les migrations
rejouables et le jeu de démonstration.

## Lancer Postgres en local

```bash
docker compose up -d postgres   # postgres:19, lié à 127.0.0.1 uniquement
cp .env.example .env            # définit DATABASE_URL
pnpm db:migrate                 # applique les migrations ; relançable
pnpm db:seed                    # données de démonstration fictives (example.com)
```

Le port hôte est `${POSTGRES_PORT:-5432}` ; si 5432 est pris, changer
`POSTGRES_PORT` et `DATABASE_URL` ensemble dans `.env`.

Le seed est idempotent et refuse de tourner quand la base contient déjà une
organisation, des personnes ou des équipes qui ne sont pas des données de
démonstration.

## Tests

- `pnpm test` n'a besoin d'aucune base ;
- `pnpm test:integration` lance les tests du schéma sur un vrai Postgres. Il
  faut `DATABASE_URL` et un rôle autorisé à `CREATE DATABASE` : il crée une
  base jetable et la supprime à la fin.

## Nouvelles migrations

Modifier `packages/db/src/schema.ts`, puis générer la migration avec
`pnpm --filter @bosco/db db:generate` (drizzle-kit). Les contraintes qui
interdisent le chevauchement des périodes sont des contraintes `EXCLUDE`,
que drizzle-kit ne sait pas exprimer : elles vivent dans une migration
écrite à la main (`0001_period_overlap.sql`).

## Le modèle de données `core`

- `organisation` : exactement une ligne — une organisation par installation ;
- `person` : un nom affiché et un e-mail, unique sans tenir compte de la
  casse. Une personne est une fiche, sans lien avec un compte de connexion ;
- `team` ;
- `team_membership` et `manager_attachment` : historique avec un début et
  une fin facultative (`[started_at, ended_at)`, ouverte tant que la fin est
  vide). Les périodes ne se chevauchent jamais : à tout instant, une
  personne est au plus une fois dans une équipe donnée et a au plus un
  manager ; personne n'est son propre manager ;
- les clés étrangères restreignent les suppressions : une personne ou une
  équipe encore référencée ne peut pas être supprimée.

bosco s'adresse aux seuls managers, pour leur propre usage : un manager crée
des fiches pour des personnes qui ne se connectent jamais, et aucun compte
collaborateur n'est prévu. Les personnes sont saisies à la main ou importées
en CSV ; les deux arrivent dans des lots ultérieurs, avec
l'authentification.
