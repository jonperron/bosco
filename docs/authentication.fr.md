# Authentification

[English](authentication.en.md) · Français

Une installation de bosco sert une entreprise. Les managers se connectent
avec leur compte Google Workspace ; bosco ne garde aucun mot de passe.

## Qui peut se connecter

Tout compte Google du domaine Workspace de l'entreprise
(`GOOGLE_WORKSPACE_DOMAIN`) dont l'e-mail est vérifié se connecte comme
manager : son compte est créé à sa première connexion. Ni administrateur,
ni invitation, ni rôle. Le domaine est vérifié sur la claim `hd` de l'ID
token Google, pas sur le suffixe de l'e-mail : une adresse Gmail
personnelle ou un compte d'un autre Workspace ne peut pas entrer.

## Créer le client OAuth Google

Dans la [console Google Cloud](https://console.cloud.google.com/) :

1. Créer un projet dans l'organisation Workspace de l'entreprise.
2. Écran de consentement OAuth : type d'utilisateur « Interne » (seuls les
   comptes de l'organisation peuvent consentir).
3. Identifiants > Créer des identifiants > ID client OAuth, type
   d'application « Application Web ».
4. URI de redirection autorisé : `<PUBLIC_URL>/api/auth/callback`, par
   exemple `https://bosco.example.com/api/auth/callback`.
5. Copier l'ID client et le code secret du client dans l'environnement de
   l'API.

## Configuration

L'API lit ces variables (exemple dans `apps/api/.env.example`) et refuse de
démarrer si l'une manque ou est invalide :

| Variable                  | Valeur                                                                          |
| ------------------------- | ------------------------------------------------------------------------------- |
| `DATABASE_URL`            | la base Postgres                                                                |
| `PUBLIC_URL`              | origine publique de l'installation, sans chemin ; `https`, sauf sur `localhost` |
| `GOOGLE_CLIENT_ID`        | l'ID du client OAuth                                                            |
| `GOOGLE_CLIENT_SECRET`    | le code secret du client OAuth                                                  |
| `GOOGLE_WORKSPACE_DOMAIN` | le domaine Workspace de l'entreprise, par ex. `example.com`                     |

Au démarrage, l'API applique les migrations en attente avant d'écouter (voir
le [guide de la base de données](database.fr.md)).

## Se connecter depuis l'application web

La page d'accueil a un panneau Compte. Déconnecté, il affiche un lien
« Se connecter avec Google » vers `/api/auth/login`. Connecté, il affiche
le nom et l'e-mail du manager et un bouton « Se déconnecter », qui met fin
à la session et ramène le panneau à l'état déconnecté. Après une connexion
refusée, il affiche « Ce compte n'est pas autorisé à se connecter à cette
installation. » (`denied`) ou « La connexion a échoué. Veuillez
réessayer. » (`failed`), puis retire `auth_error` de la barre d'adresse.

## Routes

- `GET /api/auth/login` : redirige vers Google (flux authorization code
  avec PKCE).
- `GET /api/auth/callback` : Google redirige ici. En cas de succès, le
  navigateur reçoit un cookie de session et revient sur l'application web.
  En cas d'échec, il revient sur l'application web avec
  `?auth_error=denied` (compte non autorisé : mauvais domaine, e-mail non
  vérifié, ou e-mail déjà détenu par un autre compte Google) ou
  `?auth_error=failed` (l'échange avec Google a échoué). Aucun des deux ne
  crée de compte ni de session.
- `GET /api/auth/me` : le manager connecté (`id`, `email`, `displayName`),
  ou 401.
- `POST /api/auth/logout` : supprime la session et efface le cookie ;
  répond 204. Refusé en 403 sauf si l'en-tête `Origin` vaut `PUBLIC_URL`.

## Sessions

Le cookie de session (`__Host-bosco_session`) est HttpOnly, Secure et
SameSite=Lax. Une session dure 7 jours à partir de la connexion, durée
fixe : l'utiliser ne la prolonge pas. Les sessions vivent en base, donc se
déconnecter les révoque. Les sessions expirées sont purgées à chaque
connexion. Une nouvelle connexion met fin à la session que le navigateur
détenait avant.

## Mise à jour

Les installations existantes doivent ajouter les cinq variables ci-dessus à
leur environnement avant la mise à jour : sans elles, la nouvelle version
ne démarre pas.

## Limites connues / reporté

- Pas de « se déconnecter partout » : la déconnexion ne termine que la
  session courante.
- Un manager qui quitte l'entreprise garde une session valide jusqu'à
  7 jours : bosco ne revérifie pas le compte auprès de Google.
- Les cookies de session sont Secure : l'installation doit donc être servie
  en HTTPS (`localhost` excepté).
