# Skrum — Installer env template and unprivileged Docker ports — Design

Date: 2026-10-06
Status: **approved for execution, 2026-10-06.** The owner took the three decisions of §3 and approved this design the same day.
Parent specs: `docs/superpowers/specs/2026-09-29-retro-board-core-design.md` §6 (packaging), `docs/superpowers/plans/2026-09-29-plan-5-packaging.md` (the image, the Caddyfile, the s6 services, the Compose files).

What was read: `.env.example`, every `env()` call under `config/`, `Dockerfile`, `docker/Caddyfile`, `docker/healthcheck`, `docker/scripts/prepare`, `docker/s6-rc.d/octane/run`, the three `compose.production*.yaml`, `config/reverb.php`, `config/broadcasting.php`, `app/Support/ReverbClientConfig.php`, `app/Support/Status/InstanceStatus.php` (realtime check), `README.md` (Run with Docker, Upgrading, SERVER_NAME, Configuration), `docs/database.md` (Installing), `phpunit.xml`, `tests/Feature/Mcp/McpPackagingTest.php`. Nothing was run.

## 1. Problem statement

A self-hoster copies `.env.example` as `.env`. That file has 267 lines and 117 active keys and is written for Sail development: it ships `APP_ENV=local`, `APP_DEBUG=true`, `DB_USERNAME=sail`, `DB_PASSWORD=password`, `REVERB_CLIENT_HOST=localhost`. The README then lists about twelve hand edits. Several are already fixed by the image or by the Compose files (`APP_ENV`, `APP_DEBUG`, `LOG_CHANNEL`, `DB_USERNAME`). Three exist only because `docker/scripts/prepare` refuses to start without them (`REVERB_APP_ID`, `REVERB_APP_KEY`, `REVERB_APP_SECRET`), although Reverb and its only client run in the same container. Three more must be emptied by hand (`REVERB_CLIENT_*`).

The image listens on ports 80 and 443, and the production Compose files publish host ports 80 and 443 by default. The owner's rule: Docker must not use protected ports (below 1024).

## 2. Goals

1. An installer fills three values (`APP_URL`, `APP_KEY`, `DB_PASSWORD`) and starts the instance.
2. Nothing in the production Docker setup uses a port below 1024, in the container or on the host, by default.
3. An existing install that sets its own values keeps them.
4. Development (Sail, CI, `composer setup`) does not change.

## 3. Decisions (owner, 2026-10-06)

1. **Ports:** the container and the host defaults both move to high ports. Automatic HTTPS becomes opt-in.
2. **Template:** a separate short `.env.production.example`. `.env.example` stays the development reference.
3. **Secrets:** the Reverb credentials are derived from `APP_KEY` when they are not set. `APP_KEY` stays manual.

## 4. Design

### 4.1 Reverb credentials derived from `APP_KEY`

- New class `App\Support\ReverbCredentials` with one static method, `resolve(mixed $explicit, string $purpose, mixed $appKey): ?string`. It returns `$explicit` when that is a non-empty string; otherwise the first 32 characters of `hash_hmac('sha256', "skrum-reverb-{$purpose}", $appKey)`; or `null` when the app key is not a non-empty string. It calls no `env()`: the config file passes both values in. An empty `REVERB_APP_KEY=` line therefore counts as unset.
- `config/broadcasting.php` (connection `reverb`: `key`, `secret`, `app_id`) and `config/reverb.php` (first app: `key`, `secret`, `app_id`) read `ReverbCredentials::resolve(env('REVERB_APP_KEY'), 'key', env('APP_KEY'))`, and the same with `REVERB_APP_SECRET` / `'secret'` and `REVERB_APP_ID` / `'id'`.
- `docker/scripts/prepare` no longer requires the three `REVERB_APP_*` variables. Its "missing variables" message names `.env.production.example`.
- One label per value: the public key that `ReverbClientConfig` hands to browsers reveals neither `APP_KEY` nor the secret. Rotating `APP_KEY` rotates the three values; every process of the container restarts together, so they cannot drift apart.

### 4.2 Unprivileged ports

HTTP is **8000**, HTTPS is **8443**. Reverb keeps loopback port 8080: no collision, and a Compose copy that pins `REVERB_SERVER_PORT=8080` keeps working.

| File | Change |
|---|---|
| `docker/Caddyfile` | the global options gain `http_port 8000` and `https_port 8443`; the site address default becomes `{$SERVER_NAME::8000}` |
| `docker/s6-rc.d/octane/run` | `--port=8000` |
| `Dockerfile` | `SERVER_NAME=:8000`; `EXPOSE 8000 8443 8443/udp`; `LOG_LEVEL=warning` joins the `ENV` block (a value in `.env` still wins) |
| `docker/healthcheck` | the default is `:8000`; the domain branch resolves and calls port 8443 |
| `compose.production.yaml`, `compose.production.mariadb.yaml`, `compose.production.sqlite.yaml` | `'${SKRUM_HTTP_PORT:-8000}:8000'`, `'${SKRUM_HTTPS_PORT:-8443}:8443'`, `'8443:8443/udp'` (fixed: Caddy advertises HTTP/3 on the port it listens on, `Alt-Svc: h3=":8443"`, so the host must publish that same UDP port whatever `SKRUM_HTTPS_PORT` is; found on the running container) |
| `docker/scripts/prepare` | a warning, not a failure, when `SERVER_NAME` is `:N` with N below 1024; it names the fix |

Caddy's `http_port` and `https_port` are internal: its redirects and its certificate challenges still assume the public ports 80 and 443. Two ways to run follow:

- **Default:** plain HTTP on host port 8000, behind the installer's own TLS-terminating proxy, with `TRUSTED_PROXIES` set.
- **Automatic HTTPS:** `SERVER_NAME=skrum.example.com`, `SKRUM_HTTP_PORT=80`, `SKRUM_HTTPS_PORT=443`. Three lines of `.env`, no edit of the Compose file. The container still binds 8000 and 8443 only; the host publishes 80 and 443 by the installer's choice.

### 4.3 `.env.production.example`

A new file at the repository root, about 35 lines. Its only uncommented keys are the ones an installer must fill:

```dotenv
APP_URL=https://skrum.example.com
APP_KEY=
DB_PASSWORD=
```

Below them, commented, each with its default and one line of explanation: `SERVER_NAME`, `TRUSTED_PROXIES`, `SKRUM_HTTP_PORT`, `SKRUM_HTTPS_PORT`, the three-line automatic HTTPS recipe, `SKRUM_IMAGE`, `APP_NAME`, `APP_TIMEZONE`, `APP_LOCALE`, `SKRUM_SIGNUP_MODE`, the SMTP block (`MAIL_MAILER`, `MAIL_HOST`, `MAIL_PORT`, `MAIL_USERNAME`, `MAIL_PASSWORD`, `MAIL_FROM_ADDRESS`). A closing line sends the reader to README › Configuration for the other variables and to Administration for SSO, SMTP and integrations.

The file has no `REVERB_*` key. The credentials are derived (§4.1), and an unset `REVERB_CLIENT_*` already means "the page's own origin" (`ReverbClientConfig`), so the step "empty these three keys" disappears.

`.env.example` changes in three places only: the comment of its production block points to `.env.production.example`; `SERVER_NAME=:80` becomes `SERVER_NAME=:8000`; the Reverb comment says the three credentials are optional. CI (`cp .env.example .env`), `composer setup` and `McpPackagingTest` are untouched.

`.dockerignore` already excludes `.env.*` except `.env.example`: the new template stays out of the image, which does not need it.

### 4.4 Documentation (existing files only)

- `README.md` › Run with Docker: fetch `.env.production.example` as `.env`, generate `APP_KEY`, fill the three values, `up -d`, open `http://<host>:8000`. The list of hand edits and the "empty `REVERB_CLIENT_*`" block go.
- `README.md` › SERVER_NAME: the new port numbers, the automatic HTTPS recipe, the host port defaults.
- `README.md` › Configuration: the introduction names both templates; the `REVERB_APP_*` row says the values are optional and derived from `APP_KEY`.
- `README.md` › Upgrading: one note for existing installs (§7).
- `docs/database.md` › Installing: it references the production template and says that `DB_PASSWORD` alone is needed with the bundled Compose files.

## 5. Acceptance criteria

1. With a `.env` that holds only `APP_URL`, `APP_KEY` and `DB_PASSWORD`, and the stock `compose.production.yaml`, the container becomes healthy and `GET http://localhost:8000/up` answers 200.
2. With no `REVERB_APP_*` set, `/status` reports realtime as operational and a browser opens its websocket on the page's own origin.
3. `REVERB_APP_ID`, `REVERB_APP_KEY` and `REVERB_APP_SECRET`, when set and not empty, win over the derived values, field by field.
4. The derived id, key and secret are stable for one `APP_KEY`, differ from one another, and none contains `APP_KEY`.
5. No port below 1024 appears in `Dockerfile` (`EXPOSE`, `SERVER_NAME`), `docker/Caddyfile`, `docker/s6-rc.d/octane/run`, `docker/healthcheck`, or on either side of a `ports:` entry of a `compose.production*.yaml`.
6. With `SERVER_NAME` set to a domain, Caddy listens on 8000 and 8443 in the container and the healthcheck passes.
7. An existing `.env` that sets `REVERB_APP_*` keeps its credentials. One that sets `SERVER_NAME=:80` gets a start-up warning that names the fix.
8. Every key of `.env.production.example`, commented or not, is read by `config/`, `Dockerfile`, `docker/` or a `compose.production*.yaml`.
9. Development is unchanged: `cp .env.example .env && php artisan key:generate` still yields a working Sail setup, and the existing suites pass.

## 6. Tests

- `tests/Unit/Support/ReverbCredentialsTest.php`: criteria 3 and 4, on `ReverbCredentials::resolve` alone (no environment to arrange).
- `tests/Feature/Retros/ReverbConfigTest.php` gains one test: the Reverb server and the broadcaster hold the same, non-empty id, key and secret.
- `tests/Feature/DockerPackagingTest.php`, in the manner of `McpPackagingTest`: criterion 5 (every port number read from those files is at least 1024), criterion 8, and the three required keys of the production template.
- Criteria 1, 2, 6 and 7 are checked on a real container: the image is built, started three times (three-value `.env`; `SERVER_NAME=localhost`, where Caddy uses its internal certificate; `SERVER_NAME=:80`), and `/up`, `/status`, the container's listeners and its logs are read.

## 7. Known break

The new image listens on 8000 and 8443. An install that pulls it while keeping an old copy of the Compose file (`80:80`, `443:443`) stops answering when it has no explicit `SERVER_NAME`, or a domain as `SERVER_NAME`, until the Compose file is fetched again. An install with `SERVER_NAME=:80` and its old Compose copy keeps working, and gets the warning of §4.2. The README upgrade note says so. There is no compatibility shim.

## 8. Non-goals

- Sail development: `compose.yaml` still publishes host port 80 by default (`APP_PORT`), and the Sail image listens on 80 inside. Moving it changes `APP_URL` for every developer and the browser-test setup.
- Generating `APP_KEY` at first start.
- Running the image as a non-root user (s6 runs as root, the services as `www-data`, as today).
- Trimming `.env.example`, or a new configuration reference page.
- The `DB_CONNECTION: pgsql` line of `compose.production.yaml`, which the MySQL instructions of `docs/database.md` contradict.
