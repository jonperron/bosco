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

`pnpm db:migrate` prend un verrou consultatif Postgres : plusieurs instances
de l'API qui démarrent en même temps migrent sans risque, chacune à son
tour. Il n'y a pas encore de limite d'attente.

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
- `account` : le compte de connexion d'un manager (voir plus bas) ;
- `session` : une session ouverte d'un compte ;
- les clés étrangères restreignent les suppressions : une personne ou une
  équipe encore référencée ne peut pas être supprimée. Les sessions font
  exception : elles sont supprimées avec leur compte.

bosco s'adresse aux seuls managers, pour leur propre usage : un manager crée
des fiches pour des personnes qui ne se connectent jamais, et aucun compte
collaborateur n'est prévu. Les personnes sont saisies à la main ou importées
en CSV ; les écrans et les routes de l'une et l'autre arrivent dans des lots
ultérieurs, avec l'authentification.

## Comptes et sessions

Tout compte Google vérifié du domaine de l'entreprise se connecte comme
manager, et son compte est créé à la première connexion : ni
administrateur, ni invitation, ni rôle. Un compte contient le sujet OIDC
(l'identité stable, unique), un e-mail (unique sans tenir compte de la
casse) et un nom affiché. Il n'est pas lié à une fiche `person` : savoir si
le compte d'un manager correspond à une personne est une question ouverte.

Les sessions vivent en base, donc se déconnecter les révoque. Une session
ne stocke que l'empreinte SHA-256 d'un jeton aléatoire de 256 bits ; son
expiration est calculée sur l'horloge de la base.

`@bosco/db` exporte les fonctions ; aucune route ne les appelle encore :

- `upsertAccountFromOidc(db, { subject, email, displayName })` : l'appelant
  doit avoir vérifié l'ID token. Reconnaît le compte par son sujet, suit les
  changements d'e-mail et de nom. Un e-mail détenu par un autre sujet lève
  `AccountEmailConflictError` : les comptes ne sont jamais fusionnés ;
- `createSession(db, accountId, lifetimeSeconds)` renvoie le jeton brut,
  lisible cette seule fois, et son expiration. Une durée qui n'est pas un
  nombre positif lève une `RangeError` ;
- `findSession(db, token)` renvoie le compte et l'expiration, ou `null` si
  le jeton est inconnu ou expiré ;
- `deleteSession(db, token)` déconnecte, et indique si une session
  correspondait ;
- `deleteExpiredSessions(db)` supprime les sessions expirées et renvoie
  leur nombre.

## Importer des personnes en CSV

`importPeopleCsv(db, csvText)`, dans `@bosco/db`, importe des personnes
depuis un fichier CSV. Aucune route ni aucun écran ne l'appelle encore.

```csv
display_name,email,manager_email
Ada Alpha,ada@example.com,
Bo Beta,bo@example.com,ada@example.com
```

- CSV RFC 4180 : séparateur virgule, champs entre guillemets doubles
  facultatifs, un guillemet doublé pour un guillemet, fins de ligne CRLF, LF
  ou CR. Les lignes vides sont ignorées.
- La ligne d'en-tête est obligatoire. Les colonnes `display_name` et `email`
  sont obligatoires, `manager_email` est facultative ; l'ordre et la casse
  des colonnes sont libres. Toute autre colonne, ou une colonne répétée,
  fait rejeter le fichier. Chaque ligne a autant de champs que l'en-tête ;
  les espaces autour d'une valeur sont ignorés.
- Les e-mails sont en ASCII imprimable, avec un seul `@` et un point dans le
  domaine ; rien ne vérifie qu'ils sont distribuables.
  Les noms affichés ne peuvent pas contenir de caractères de contrôle
  (tabulation, NUL...). Un e-mail répété dans le fichier, ou une personne
  désignée comme son propre manager, est une erreur.
- Tout ou rien : une seule ligne invalide fait rejeter tout le fichier, et
  rien n'est écrit. L'erreur liste chaque problème par ligne et par colonne,
  jamais une valeur du fichier ; le message montre les 20 premiers.
- Les personnes sont reconnues par leur e-mail, sans tenir compte de la
  casse : un e-mail connu met à jour le nom affiché, un nouveau crée une
  personne. L'import renvoie le nombre de personnes créées, renommées et
  ayant changé de manager.
- Un `manager_email` non vide doit désigner quelqu'un du fichier ou déjà en
  base. S'il désigne un nouveau manager, le rattachement ouvert se termine
  et un nouveau commence au même instant ; l'historique est conservé. Un
  `manager_email` vide laisse le manager actuel tel quel.
- Les imports passent un par un (un verrou consultatif Postgres). Les
  autres écritures dans `core.person` ne prennent pas ce verrou.

Pas encore pris en charge : les équipes, le retrait d'un manager, les
fichiers séparés par `;`, les e-mails hors ASCII, une taille maximale ou une
attente maximale du verrou (toutes deux pour la route qui appellera
l'import), et les cycles de managers (A manage B, B manage A), que le lot
des droits empêchera. Un fichier compte au plus 20 000 lignes environ (la
limite de paramètres d'une requête Postgres). La reconnaissance des e-mails
suppose une locale de base où `lower()` transforme `I` en `i` : une locale
turque ne le fait pas.
