# Skrum — Installer env template — Design

Date: 2026-10-06
Status: **approved for execution, 2026-10-06; revised the same day.** The owner took the three decisions of §3 and approved the design. After the work was built and checked on a running container, the owner withdrew decision 1: the image keeps the default ports of `dunglas/frankenphp`, in the container and on the host. This text is written on that answer; the file keeps its first name.
Parent specs: `docs/superpowers/specs/2026-09-29-retro-board-core-design.md` §6 (packaging), `docs/superpowers/plans/2026-09-29-plan-5-packaging.md` (the image, the Caddyfile, the s6 services, the Compose files).

What was read: `.env.example`, every `env()` call under `config/`, `Dockerfile`, `docker/Caddyfile`, `docker/healthcheck`, `docker/scripts/prepare`, `docker/s6-rc.d/octane/run`, the three `compose.production*.yaml`, `config/reverb.php`, `config/broadcasting.php`, `app/Support/ReverbClientConfig.php`, `app/Support/Status/InstanceStatus.php` (realtime check), `README.md` (Run with Docker, Upgrading, SERVER_NAME, Configuration), `docs/database.md` (Installing), `phpunit.xml`, `tests/Feature/Mcp/McpPackagingTest.php`.

## 1. Problem statement

A self-hoster copies `.env.example` as `.env`. That file has 267 lines and 117 active keys and is written for Sail development: it ships `APP_ENV=local`, `APP_DEBUG=true`, `DB_USERNAME=sail`, `DB_PASSWORD=password`, `REVERB_CLIENT_HOST=localhost`. The README then lists about twelve hand edits. Several are already fixed by the image or by the Compose files (`APP_ENV`, `APP_DEBUG`, `LOG_CHANNEL`, `DB_USERNAME`). Three exist only because `docker/scripts/prepare` refuses to start without them (`REVERB_APP_ID`, `REVERB_APP_KEY`, `REVERB_APP_SECRET`), although Reverb and its only client run in the same container. Three more must be emptied by hand (`REVERB_CLIENT_*`).

## 2. Goals

1. An installer fills three values (`APP_URL`, `APP_KEY`, `DB_PASSWORD`) and starts the instance.
2. An existing install keeps working without a change to its `.env` or to its copy of the Compose file.
3. Development (Sail, CI, `composer setup`) does not change.

## 3. Decisions (owner, 2026-10-06)

1. **Ports: unchanged.** First decided: the container and the host defaults move to 8000 and 8443. Built, then withdrawn by the owner: the container listens on 80 and 443 (and 443/udp) as the base image does, and the Compose files publish host ports 80 and 443 by default, as before. Nothing of the port change remains in the code.
2. **Template:** a separate short `.env.production.example`. `.env.example` stays the development reference.
3. **Secrets:** the Reverb credentials are derived from `APP_KEY` when they are not set. `APP_KEY` stays manual.

## 4. Design

### 4.1 Reverb credentials derived from `APP_KEY`

- New class `App\Support\ReverbCredentials` with one static method, `resolve(mixed $explicit, string $purpose, mixed $appKey): ?string`. It returns `$explicit` when that is a non-empty string; otherwise the first 32 characters of `hash_hmac('sha256', "skrum-reverb-{$purpose}", $appKey)`; or `null` when the app key is not a non-empty string. It calls no `env()`: the config file passes both values in. An empty `REVERB_APP_KEY=` line therefore counts as unset.
- `config/broadcasting.php` (connection `reverb`: `key`, `secret`, `app_id`) and `config/reverb.php` (first app: `key`, `secret`, `app_id`) read `ReverbCredentials::resolve(env('REVERB_APP_KEY'), 'key', env('APP_KEY'))`, and the same with `REVERB_APP_SECRET` / `'secret'` and `REVERB_APP_ID` / `'id'`.
- `docker/scripts/prepare` no longer requires the three `REVERB_APP_*` variables. Its "missing variables" message names `.env.production.example`.
- One label per value: the public key that `ReverbClientConfig` hands to browsers reveals neither `APP_KEY` nor the secret. Rotating `APP_KEY` rotates the three values; every process of the container restarts together, so they cannot drift apart.

### 4.2 Image defaults

`LOG_LEVEL=warning` joins the `ENV` block of the `Dockerfile`, beside `APP_ENV`, `APP_DEBUG` and `LOG_CHANNEL`: one hand edit less. A value in `.env` still wins.

Ports are not touched: `SERVER_NAME=:80`, `EXPOSE 80 443 443/udp`, Octane on 80, the healthcheck on 80 or 443, and the Compose mappings `'${SKRUM_HTTP_PORT:-80}:80'`, `'${SKRUM_HTTPS_PORT:-443}:443'`, `'${SKRUM_HTTPS_PORT:-443}:443/udp'`.

### 4.3 `.env.production.example`

A new file at the repository root, about 45 lines. Its only uncommented keys are the ones an installer must fill:

```dotenv
APP_URL=https://skrum.example.com
APP_KEY=
DB_PASSWORD=
```

Below them, commented, each with its default (or an example where the comment says so) and one line of explanation: `SERVER_NAME`, `TRUSTED_PROXIES`, `SKRUM_HTTP_PORT`, `SKRUM_HTTPS_PORT`, `SKRUM_IMAGE`, `APP_NAME`, `APP_TIMEZONE`, `APP_LOCALE`, `SKRUM_SIGNUP_MODE`, the SMTP block (`MAIL_MAILER`, `MAIL_HOST`, `MAIL_PORT`, `MAIL_USERNAME`, `MAIL_PASSWORD`, `MAIL_FROM_ADDRESS`). A closing line sends the reader to README › Configuration for the other variables and to Administration for SSO, SMTP and integrations.

The file has no `REVERB_*` key. The credentials are derived (§4.1), and an unset `REVERB_CLIENT_*` already means "the page's own origin" (`ReverbClientConfig`), so the step "empty these three keys" disappears.

`.env.example` changes in two places only: the comment of its production block points to `.env.production.example`, and the Reverb comment says the three credentials are optional. CI (`cp .env.example .env`), `composer setup` and `McpPackagingTest` are untouched.

`.dockerignore` already excludes `.env.*` except `.env.example`: the new template stays out of the image, which does not need it.

### 4.4 Documentation (existing files only)

- `README.md` › Run with Docker: fetch `.env.production.example` as `.env`, generate `APP_KEY`, fill the three values, `up -d`. The list of hand edits and the "empty `REVERB_CLIENT_*`" block go.
- `README.md` › Configuration: the introduction names both templates; the `REVERB_APP_*` row says the values are optional and derived from `APP_KEY`.
- `README.md` › Upgrading: one note, that the three Reverb variables are now optional and that values already set are kept.
- `README.md` › SERVER_NAME: unchanged from before this work.
- `docs/database.md` › Installing: it references the production template and says that `DB_PASSWORD` alone is needed with the bundled Compose files.

## 5. Acceptance criteria

1. With a `.env` that holds only `APP_URL`, `APP_KEY` and `DB_PASSWORD`, and the stock `compose.production.yaml`, the container becomes healthy and `GET /up` answers 200 on the published HTTP port.
2. With no `REVERB_APP_*` set, `/status` reports realtime as operational and a browser opens its websocket on the page's own origin.
3. `REVERB_APP_ID`, `REVERB_APP_KEY` and `REVERB_APP_SECRET`, when set and not empty, win over the derived values, field by field.
4. The derived id, key and secret are stable for one `APP_KEY`, differ from one another, and none contains `APP_KEY`.
5. `Dockerfile` (`EXPOSE`, `SERVER_NAME`), `docker/Caddyfile`, `docker/healthcheck`, `docker/s6-rc.d/octane/run` and the `ports:` entries of the three `compose.production*.yaml` are as they were before this work.
6. An existing `.env` that sets `REVERB_APP_*` keeps its credentials.
7. Every key of `.env.production.example`, commented or not, is read by `config/`, `Dockerfile`, `docker/` or a `compose.production*.yaml`.
8. Development is unchanged: `cp .env.example .env && php artisan key:generate` still yields a working Sail setup, and the existing suites pass.

## 6. Tests

- `tests/Unit/Support/ReverbCredentialsTest.php`: criteria 3 and 4, on `ReverbCredentials::resolve` alone (no environment to arrange).
- `tests/Feature/Retros/ReverbConfigTest.php` gains one test: the Reverb server and the broadcaster hold the same, non-empty id, key and secret.
- `tests/Feature/DockerPackagingTest.php`, in the manner of `McpPackagingTest`: criterion 7, and the three required keys of the production template.
- Criterion 5 is read from `git diff` against the commit that precedes this work.
- Criteria 1 and 2 are checked on a real container: the image is built and started with a three-value `.env`, and `/up`, `/status`, the container's listeners, a signed call to Reverb and a websocket upgrade through Caddy are read.

## 7. Known break

None. An existing `.env` and an existing copy of the Compose file keep working as they are.

## 8. Non-goals

- Any change of port, in the image, in the Compose files or in Sail.
- Generating `APP_KEY` at first start.
- Running the image as a non-root user (s6 runs as root, the services as `www-data`, as today).
- Trimming `.env.example`, or a new configuration reference page.
- The `DB_CONNECTION: pgsql` line of `compose.production.yaml`, which the MySQL instructions of `docs/database.md` contradict.
