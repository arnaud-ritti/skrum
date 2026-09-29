# Skrum

Skrum is an open-source, self-hostable realtime retrospective board. It is multi-tenant (workspaces contain teams, teams run retros), lets guests join a retro through a link, and is available in English, French, Spanish and German.

## Run with Docker

The image is published to GitHub Container Registry. The repository has no remote yet, so the commands below use the literal placeholder `<owner>`: replace it with the GitHub owner once the image is published.

```bash
curl -O https://raw.githubusercontent.com/<owner>/skrum/main/compose.production.yaml
curl -o .env https://raw.githubusercontent.com/<owner>/skrum/main/.env.example
docker run --rm --entrypoint php ghcr.io/<owner>/skrum:latest artisan key:generate --show
```

The last command prints the value for `APP_KEY`. Then edit `.env`:

- set `APP_KEY`, `APP_URL`, `SERVER_NAME` and `DB_PASSWORD` (required);
- set `REVERB_APP_ID`, `REVERB_APP_KEY` and `REVERB_APP_SECRET` to random strings;
- clear `REVERB_CLIENT_HOST`, `REVERB_CLIENT_PORT` and `REVERB_CLIENT_SCHEME`, so browsers connect to the page's own origin;
- add `SKRUM_IMAGE=ghcr.io/<owner>/skrum:latest`.

Start it:

```bash
docker compose -f compose.production.yaml up -d
```

The first account to sign up becomes the instance admin.

### SERVER_NAME

`SERVER_NAME` tells the built-in Caddy what to serve. Accepted forms:

- a bare domain such as `skrum.example.com`: Caddy obtains and renews a certificate automatically (a `https://` prefix is also accepted). Ports 80 and 443 must be reachable from the internet;
- `:PORT` for plain HTTP, such as `:80` behind a TLS-terminating reverse proxy (`http://:80` is also accepted). Also set `TRUSTED_PROXIES` so generated URLs and cookies use `https`.

Several addresses, or a domain with an explicit port, are not supported by the container healthcheck.

Certificates live in the `caddy-data` volume. Keep `/data` and `/config` on named volumes as in `compose.production.yaml`; if you switch to bind mounts, they must be writable by uid 33 (`www-data`) or Caddy cannot store certificates.

Web traffic and websockets share one port: Caddy proxies Reverb's `/app/*` and `/apps/*` paths to Reverb inside the container, so nothing else needs to be exposed. Host ports are set with `SKRUM_HTTP_PORT` (default `80`) and `SKRUM_HTTPS_PORT` (default `443`). `SKRUM_ENV_FILE` selects another env file (default `.env`).

## Configuration

All configuration is read from the environment. `.env.example` documents every variable.

| Variable                                                           | Purpose                                                                                          |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| `APP_URL`                                                          | Public URL of the instance.                                                                      |
| `SERVER_NAME`                                                      | Address Caddy serves, see above.                                                                 |
| `DB_PASSWORD`                                                      | PostgreSQL password. Required.                                                                   |
| `TRUSTED_PROXIES`                                                  | `*` or a comma-separated list of proxy IPs, when a reverse proxy sits in front.                  |
| `SKRUM_SIGNUP_MODE`                                                | Who may create an account (default `invite`).                                                    |
| `SKRUM_ALLOWED_EMAIL_DOMAINS`                                      | Optional list of email domains allowed to sign up.                                               |
| `SKRUM_AVATAR_STYLE`                                               | DiceBear avatar style (default `thumbs`).                                                        |
| `GOOGLE_*`, `GITHUB_*`, `ENTRA_*`, `OIDC_*`                        | Single sign-on providers; a provider is enabled when all its values are set. See `.env.example`. |
| `MAIL_*`                                                           | Outgoing mail settings (Laravel mailer configuration).                                           |
| `REVERB_APP_ID`, `REVERB_APP_KEY`, `REVERB_APP_SECRET`             | Reverb credentials. The container refuses to start without them.                                 |
| `REVERB_CLIENT_HOST`, `REVERB_CLIENT_PORT`, `REVERB_CLIENT_SCHEME` | Where browsers connect. Leave empty in production.                                               |
| `SKRUM_RUN_MIGRATIONS`                                             | Run migrations at container start (default `true`).                                              |
| `OCTANE_WORKERS`                                                   | Octane worker count (default `auto`, one per CPU).                                               |
| `OCTANE_MAX_REQUESTS`                                              | Requests per worker before it is recycled (default `500`).                                       |

`APP_KEY` is also required; the container stops with an explanation if it is missing.

## Processes

The image runs FrankenPHP with Laravel Octane. s6-overlay supervises four services: Octane, Reverb, the queue worker and the scheduler. Each is restarted after a crash. Migrations run once at start-up. The compose file sets `stop_grace_period: 20s` because s6 waits up to 10 seconds for services on shutdown, and Docker's default of 10 seconds would kill the container first.

## Local development

Development uses Laravel Sail:

```bash
vendor/bin/sail up -d
vendor/bin/sail composer run dev
npm run dev
```

Optional demo data (local environment only; the seeder refuses to run elsewhere):

```bash
vendor/bin/sail artisan db:seed --class=DemoSeeder
```

Demo accounts (local development only): `facilitator@skrum.test` and `member@skrum.test`, password `password`.

## Avatars

Avatars are generated with [DiceBear](https://www.dicebear.com). The default style, [`thumbs`](https://www.dicebear.com/styles/thumbs/), is released under CC0 1.0. Other styles have their own licences, listed on dicebear.com.
