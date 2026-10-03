# Skrum

Skrum is an open-source, self-hostable realtime retrospective board. It is multi-tenant (workspaces contain teams, teams run retros), lets guests join a retro through a link, and is available in English, French, Spanish and German. It is released under the GNU Affero General Public License v3.0 (AGPL-3.0-only, see [`LICENSE`](LICENSE)).

## Run with Docker

The image is published to GitHub Container Registry.

```bash
curl -O https://raw.githubusercontent.com/arnaud-ritti/skrum/main/compose.production.yaml
curl -o .env https://raw.githubusercontent.com/arnaud-ritti/skrum/main/.env.example
docker run --rm --entrypoint php ghcr.io/arnaud-ritti/skrum:latest artisan key:generate --show
```

The last command prints the value for `APP_KEY`. The copied `.env` ships development defaults, so edit it before starting:

- set `APP_NAME`, `APP_KEY`, `APP_URL` and `SERVER_NAME`;
- set `APP_ENV=production`, `APP_DEBUG=false`, `LOG_CHANNEL=stderr` and `LOG_LEVEL=warning`;
- replace the default `DB_USERNAME=sail` with your own user name, and `DB_PASSWORD=password` with a strong value (required);
- set `REVERB_APP_ID`, `REVERB_APP_KEY` and `REVERB_APP_SECRET` to random strings;
- optionally set `SKRUM_IMAGE` to pin a version, e.g. `ghcr.io/arnaud-ritti/skrum:1.0`;
- mail goes to the log (`MAIL_MAILER=log`) until you set the `MAIL_*` variables.

Compose reads `.env` from the project directory twice: to fill the `${...}` values in `compose.production.yaml` (image, ports, database name, user and password) and as the app container's environment. To use a file with another name, pass `--env-file <file>` to every `docker compose` command; it feeds the `${...}` values, so also point the `env_file:` entry of the `app` service at that file.

Then empty the realtime client settings, keeping the keys with empty values, so browsers use the page's own host through Caddy:

```dotenv
REVERB_CLIENT_HOST=
REVERB_CLIENT_PORT=
REVERB_CLIENT_SCHEME=
```

Start it:

```bash
docker compose -f compose.production.yaml up -d
```

> [!WARNING]
> The first account to sign up becomes the instance admin. Create it right after starting, and consider `SKRUM_SIGNUP_MODE` to control who can sign up afterwards.

If a container keeps restarting, `docker compose -f compose.production.yaml logs app` shows why (for example a missing variable, or `APP_DEBUG` left enabled).

### Upgrading

Back up the database first (the `pgsql-data` volume with the default Compose file), then pull the new image and recreate the containers:

```bash
docker compose -f compose.production.yaml pull && docker compose -f compose.production.yaml up -d
```

Migrations run automatically when the container starts. Prefer pinning `SKRUM_IMAGE` to a version tag over `latest`, so upgrades happen when you choose.

To show a maintenance page while you work, run `php artisan down --retry=<seconds>` in the application container (`docker compose -f compose.production.yaml exec app php artisan down --retry=1800`) and `php artisan up` when done. The page shows the time of return taken from `--retry`, and the maintenance message saved in Administration › General (the message in force when `down` runs, with its author); it reloads by itself every 30 seconds and links to the status page.

The admin footer shows the running version (`SKRUM_VERSION`, set by the published images). The check for a newer release is off by default: turn it on in Administration › General; the instance then asks `SKRUM_UPDATE_FEED` once a day and sends nothing about itself.

Upgrading to the release with team surveys: the retro's health-check phase is gone and every health check becomes a team survey. Health scores are now read on 1 to 5; scores given on the old 1-to-10 scale are kept as given and read halved. Right after the migrations of this release, run `php artisan surveys:verify-health-import` (in the application container: `docker compose -f compose.production.yaml exec app php artisan surveys:verify-health-import`): it compares the old and the new health tables retro by retro and fails on any difference. The old tables are kept for one release.

### SERVER_NAME

`SERVER_NAME` tells the built-in Caddy what to serve. Accepted forms:

- a bare domain such as `skrum.example.com`: Caddy obtains and renews a certificate automatically (a `https://` prefix is also accepted). Ports 80 and 443 must be reachable from the internet;
- `:PORT` for plain HTTP, such as `:80` behind a TLS-terminating reverse proxy (`http://:80` is also accepted). Also set `TRUSTED_PROXIES` so generated URLs and cookies use `https`.

Several addresses, or a domain with an explicit port, are not supported by the container healthcheck.

Certificates live in the `caddy-data` volume. Keep `/data` and `/config` on named volumes as in `compose.production.yaml`; if you switch to bind mounts, they must be writable by uid 82 (`www-data`) or Caddy cannot store certificates.

Web traffic and websockets share one port: Caddy proxies Reverb's `/app/*` and `/apps/*` paths to Reverb inside the container, so nothing else needs to be exposed. Host ports are set with `SKRUM_HTTP_PORT` (default `80`) and `SKRUM_HTTPS_PORT` (default `443`). Changing them away from 443 and 80 breaks automatic HTTPS certificate issuance, so use them only with `SERVER_NAME=:80` behind a proxy or for local testing.

## Configuration

All configuration is read from the environment. `.env.example` documents every variable.

PostgreSQL is the default database. MariaDB, MySQL and SQLite are supported too: [docs/database.md](docs/database.md) says which to choose, what each needs and what an upgrade does, and `compose.production.mariadb.yaml` and `compose.production.sqlite.yaml` replace `compose.production.yaml` for the first and the last.

| Variable                                                           | Purpose                                                                                                                                  |
| ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `APP_URL`                                                          | Public URL of the instance.                                                                                                              |
| `SERVER_NAME`                                                      | Address Caddy serves, see above.                                                                                                         |
| `DB_CONNECTION`                                                    | `pgsql` (default), `mariadb`, `mysql` or `sqlite`. See `docs/database.md`.                                                               |
| `DB_PASSWORD`                                                      | Database password. Required, except with SQLite.                                                                                         |
| `TRUSTED_PROXIES`                                                  | `*` or a comma-separated list of proxy IPs, when a reverse proxy sits in front.                                                          |
| `SKRUM_SIGNUP_MODE`                                                | Who may create an account (default `invite`).                                                                                            |
| `SKRUM_ALLOWED_EMAIL_DOMAINS`                                      | Optional list of email domains allowed to sign up.                                                                                       |
| `SKRUM_AVATAR_STYLE`                                               | DiceBear avatar style (default `thumbs`).                                                                                                |
| `SKRUM_MCP_ENABLED`                                                | Serve the MCP server at `/mcp` and show the "API tokens" settings page (default `true`).                                                 |
| `SKRUM_MCP_RATE_LIMIT`                                             | MCP requests per minute per API token (default `120`).                                                                                   |
| `SKRUM_MCP_WRITE_RATE_LIMIT`                                       | MCP write and delete tool calls per minute per API token (default `30`).                                                                 |
| `GOOGLE_*`, `GITHUB_*`, `ENTRA_*`, `OIDC_*`                        | Single sign-on providers; a provider is enabled when all its values are set. See `.env.example`.                                         |
| `MAIL_*`                                                           | Outgoing mail settings (Laravel mailer configuration).                                                                                   |
| `SLACK_*`, `JIRA_*`, `LINEAR_*`… (see `.env.example`)              | Integration apps; a provider is available when its app credentials are set.                                                              |
| `SKRUM_VERSION`                                                    | Version shown in the admin and on the error pages; the published images set it.                                                          |
| `SKRUM_UPDATE_FEED`                                                | Release feed asked by the optional update check (default: the project's latest GitHub release).                                          |
| `REVERB_APP_ID`, `REVERB_APP_KEY`, `REVERB_APP_SECRET`             | Reverb credentials. The container refuses to start without them.                                                                         |
| `REVERB_CLIENT_HOST`, `REVERB_CLIENT_PORT`, `REVERB_CLIENT_SCHEME` | Where browsers connect. Leave empty in production.                                                                                       |
| `SKRUM_RUN_MIGRATIONS`                                             | Run migrations at container start (default `true`).                                                                                      |
| `OCTANE_WORKERS`                                                   | Octane worker count. With the default `auto`, Octane sets no count and FrankenPHP starts 2 workers per CPU; set a number on large hosts. |
| `OCTANE_MAX_REQUESTS`                                              | Requests per worker before it is recycled (default `500`).                                                                               |

`APP_KEY` is also required; the container stops with an explanation if it is missing.

The SSO providers, the SMTP settings and the integration apps can also be set in Administration (SSO authentication, SMTP, Integrations). A value saved there wins over its environment variable, field by field; the environment stays the default, and "Use the environment value" returns to it. Saving needs a password confirmation of less than five minutes, every change is written to the audit log, and every SSO or SMTP change is mailed to every instance admin. Saved secrets are encrypted with `APP_KEY`: after rotating `APP_KEY` they can no longer be read, the instance falls back to the environment values and the admin shows a warning; enter them again. Some keys stay environment only and have no field in the admin: `APP_URL` and the redirect URIs derived from it, `OUTGOING_WEBHOOKS_ALLOW_PRIVATE_NETWORKS`, `OUTGOING_WEBHOOKS_ALLOW_HTTP`, `GITHUB_APP_PRIVATE_KEY_PATH`, `INTEGRATIONS_*`, mailers other than SMTP and `log`, and the Laravel Slack notification channel keys (`SLACK_BOT_USER_*`).

## Processes

The image runs FrankenPHP with Laravel Octane. s6-overlay supervises four services: Octane, Reverb, the queue worker and the scheduler. Each is restarted after a crash. Migrations run once at start-up. The scheduler runs `skrum:heartbeat` every minute; the public page `/status` reads those heartbeats to tell whether the queue and the scheduler are alive, beside the database, cache, realtime and mail checks. It answers during maintenance too. The compose file sets `stop_grace_period: 20s` because s6 waits up to 10 seconds for services on shutdown, and Docker's default of 10 seconds would kill the container first.

## Connect an AI assistant

Skrum serves a [Model Context Protocol](https://modelcontextprotocol.io) server at `{APP_URL}/mcp`, so an AI assistant can read your team's retrospectives, action items and planning poker games, and make the changes you allow.

1. In skrum, open **Settings → API tokens** and create a token. Reading is always included; tick **Create and update** to let the assistant add or change action items, messages and poker games, and **Delete my messages** to let it delete messages you wrote. You can limit a token to one team and choose when it expires (90 days by default).
2. Copy the token when it is shown: skrum stores only its hash and cannot show it again.
3. Add the server to a client that can send an `Authorization` header. With Claude Code:

    ```bash
    claude mcp add --transport http skrum https://skrum.example.com/mcp --header "Authorization: Bearer <token>"
    ```

    Other clients (Cursor, VS Code, scripts) take the same URL and header, for example:

    ```json
    {
        "mcpServers": {
            "skrum": {
                "type": "http",
                "url": "https://skrum.example.com/mcp",
                "headers": { "Authorization": "Bearer <token>" }
            }
        }
    }
    ```

What the assistant can do matches what you can do in skrum, for the teams you can see (and only the bound team when the token has one). Everything the board hides stays hidden: other people's cards while they are still being written, the authors of anonymous messages, who voted for what, individual health check and ROTI answers, and poker cards before they are revealed (and, in anonymous rounds, who played which card). No tool returns email addresses, retro guest links or credentials; `poker.game.get` shows the poker guest link only while guest access is on, as the game does. No tool votes or sets a poker estimate for you.

Sign-in through OAuth is not supported yet, so web connectors that require it (claude.ai, ChatGPT) cannot connect. Revoking a token on the settings page takes effect on the next request; changing your password does not revoke tokens. Data you read through the server is sent to the AI application you use.

The four tracker tools arrive with integrations (spec 6), and the three insight tools appear only when an AI provider is configured.

Set `SKRUM_MCP_ENABLED=false` to turn the server and the settings page off; existing tokens are kept but refused. Restart the app or container after changing `SKRUM_MCP_ENABLED`.

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
