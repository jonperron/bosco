# Authentication

English · [Français](authentication.fr.md)

One bosco install serves one company. Managers sign in with their Google
Workspace account; bosco keeps no passwords.

## Who can sign in

Any Google account of the company's Workspace domain
(`GOOGLE_WORKSPACE_DOMAIN`) with a verified email signs itself in as a
manager: its account is created at its first login. There is no
administrator, no invitation and no role. The domain is checked on the
`hd` claim of the Google ID token, not on the email suffix, so a personal
Gmail address or an account of another Workspace cannot get in.

## Creating the Google OAuth client

In the [Google Cloud console](https://console.cloud.google.com/):

1. Create a project inside the company's Workspace organisation.
2. OAuth consent screen: user type "Internal" (only accounts of the
   organisation can consent).
3. Credentials > Create credentials > OAuth client ID, application type
   "Web application".
4. Authorized redirect URI: `<PUBLIC_URL>/api/auth/callback`, for example
   `https://bosco.example.com/api/auth/callback`.
5. Copy the client ID and client secret into the API's environment.

## Configuration

The API reads these variables (sample in `apps/api/.env.example`) and
refuses to start if one is missing or invalid:

| Variable                  | Value                                                                 |
| ------------------------- | --------------------------------------------------------------------- |
| `DATABASE_URL`            | the Postgres database                                                 |
| `PUBLIC_URL`              | public origin of the install, no path; `https`, except on `localhost` |
| `GOOGLE_CLIENT_ID`        | the OAuth client ID                                                   |
| `GOOGLE_CLIENT_SECRET`    | the OAuth client secret                                               |
| `GOOGLE_WORKSPACE_DOMAIN` | the company's Workspace domain, e.g. `example.com`                    |

At startup the API applies pending migrations before it listens (see the
[database guide](database.en.md)).

## Routes

- `GET /api/auth/login`: redirects to Google (authorization code flow with
  PKCE).
- `GET /api/auth/callback`: Google redirects back here. On success the
  browser gets a session cookie and returns to the web app. On failure it
  returns to the web app with `?auth_error=denied` (account not allowed:
  wrong domain, unverified email, or an email already held by another
  Google account) or `?auth_error=failed` (the exchange with Google
  failed). Neither creates an account or a session.
- `GET /api/auth/me`: the signed-in manager (`id`, `email`, `displayName`),
  or 401.
- `POST /api/auth/logout`: deletes the session and clears the cookie;
  answers 204. Refused with 403 unless the `Origin` header is `PUBLIC_URL`.

## Sessions

The session cookie (`__Host-bosco_session`) is HttpOnly, Secure and
SameSite=Lax. A session lasts 7 days from sign-in, fixed: using it does not
extend it. Sessions live in the database, so logging out revokes them.
Expired sessions are purged at each login. A new sign-in ends the session
the browser held before.

## Upgrading

Existing installs must add the five variables above to their environment
before upgrading: without them the new version does not start.

## Known limits / deferred

- No "log out everywhere": logging out ends only the current session.
- A manager who leaves the company keeps a valid session for up to 7 days:
  bosco does not re-check the account with Google.
- Session cookies are Secure, so the install must be served over HTTPS
  (`localhost` excepted).
