# Skrum — Coolify one-click service kit — Design

Date: 2026-10-06
Status: **draft, awaiting the owner's review.** The owner approved the design in conversation on 2026-10-06 (scope: submission-ready kit, upstream pull requests later; location: `docs/coolify/`). The container port is 80: the image moved to 8000 and back the same day (commit `25cc1c93`), and this spec follows it (§5.2). Extended the same day at the owner's request: mail, single sign-on, GIFs, every Skrum setting and the integration apps are offered in the template and listed in `.env.production.example` (§5.2, §5.5).
Source of the requirements: <https://coolify.io/docs/contribute/service>, read on 2026-10-06, and the magic variables of <https://coolify.io/docs/knowledge-base/docker/compose>.

What was read: `Dockerfile`, `docker/scripts/prepare`, `docker/Caddyfile`, `docker/healthcheck`, `compose.production.yaml`, `.env.production.example`, `.github/workflows/docker-image.yml`, `config/reverb.php`, `config/broadcasting.php`, `config/skrum.php`, the README sections "Run with Docker" and "SERVER_NAME", and five templates of `coollabsio/coolify` on `next` (`invoice-ninja`, `vikunja`, `leantime`, `excalidraw`, `docmost`). Nothing was deployed.

## 1. Problem statement

Coolify installs a "one-click service" from a Compose template kept in `coollabsio/coolify`. Skrum has a production image and three Compose files, but none is in Coolify's format: they build from source (`build: .`), read an `.env` file, follow `latest`, publish host ports and ask the operator to generate `APP_KEY` by hand.

Coolify accepts a service only when its repository has at least 1,000 GitHub stars. `arnaud-ritti/skrum` has none today, so no pull request is opened now. The kit is prepared so that it is usable at once on any Coolify instance through "Docker Compose Empty", and ready to submit unchanged the day the repository is eligible.

## 2. Goals

1. A Coolify user pastes one file into "Docker Compose Empty", presses Deploy, and reaches a working Skrum on the domain Coolify generated, without typing a single value.
2. The file meets every rule of the contribution guide, so that the upstream pull request is a copy.
3. The three artefacts Coolify asks for (template, logo, documentation page) live in this repository and are kept true by a test.
4. Every setting an operator may give through the environment (mail, single sign-on, GIFs, AI, MCP, the integration apps and the other `SKRUM_*` variables) shows in Coolify as an optional variable, and is listed, commented, in `.env.production.example`.

## 3. Non-goals

- Opening the pull requests against `coollabsio/coolify` and the Coolify documentation repository. They wait for the 1,000 stars.
- MariaDB and SQLite variants of the template. One template, PostgreSQL, the reference engine (`docs/database.md`).
- Redis and S3 variables in the template.
- Changing the image, the startup script or the existing Compose files.

## 4. Prerequisite, the owner's

The template pins `ghcr.io/arnaud-ritti/skrum:0.0.1`. That tag exists once `main` is pushed and a release `v0.0.1` is published: `docker-image.yml` builds on `v*` tags and names the image from the tag, without the `v`. The package must be public on GitHub Container Registry. Until then the template cannot be deployed on Coolify; §7 says how it is checked before.

## 5. Design

### 5.1 Files

| Path | Role | Upstream destination |
|---|---|---|
| `docs/coolify/skrum.yaml` | The template | `coollabsio/coolify`: `templates/compose/skrum.yaml` |
| `docs/coolify/skrum.svg` | The logo, a copy of `public/brand/skrum-symbol-light.svg` | `coollabsio/coolify`: `svgs/skrum.svg`; documentation repository: `public/images/services/skrum.svg` |
| `docs/coolify/skrum.mdx` | The documentation page | Documentation repository: `content/docs/services/skrum.mdx` |
| `docs/coolify/README.md` | How to use the kit today, and the submission checklist | None |

`docs/` is already excluded from the image by `.dockerignore`.

### 5.2 The template

Header comments, as the guide requires:

```yaml
# documentation: https://github.com/arnaud-ritti/skrum#readme
# slogan: Realtime retrospectives, planning poker and whiteboards for agile teams.
# category: productivity
# tags: retrospective,agile,scrum,planning-poker,whiteboard,realtime
# logo: svgs/skrum.svg
# port: 80
```

`productivity` is the category of the comparable templates read (`vikunja`, `leantime`, `excalidraw`, `docmost`).

Two services.

**`skrum`**, image `ghcr.io/arnaud-ritti/skrum:0.0.1`. No `build`, no `ports`, no `env_file`. Environment:

| Variable | Value | Why |
|---|---|---|
| `SERVICE_URL_SKRUM_80` | declared, no value | Coolify generates the domain and routes its proxy to container port 80 |
| `APP_URL` | `${SERVICE_URL_SKRUM}` | Secure cookies, the allowed websocket origin and mail links follow it |
| `APP_KEY` | `base64:${SERVICE_REALBASE64_SKRUM}` | Base64 of 32 random bytes, the form Laravel expects; `invoice-ninja` does the same. The Reverb credentials derive from it (`ReverbCredentials::resolve`) |
| `TRUSTED_PROXIES` | `${TRUSTED_PROXIES:-*}` | Coolify's proxy terminates TLS; without it generated URLs are `http://` |
| `DB_CONNECTION`, `DB_HOST`, `DB_PORT` | `pgsql`, `postgres`, `5432` | The config default is `sqlite` |
| `DB_DATABASE` | `${POSTGRES_DB:-skrum}` | |
| `DB_USERNAME`, `DB_PASSWORD` | `${SERVICE_USER_POSTGRES}`, `${SERVICE_PASSWORD_POSTGRES}` | Generated once by Coolify, shared with the database service |
| `BROADCAST_CONNECTION` | `reverb` | The config default is `null` |
| `REVERB_HOST`, `REVERB_PORT`, `REVERB_SCHEME` | `127.0.0.1`, `8080`, `http` | The app publishes to Reverb inside the container, as in `compose.production.yaml` |
| `APP_NAME`, `APP_TIMEZONE`, `APP_LOCALE` | `${…:-Skrum}`, `${…:-UTC}`, `${…:-en}` | Shown as editable in Coolify with their defaults |
| Every `SKRUM_*` variable `config/*.php` reads, and `SKRUM_RUN_MIGRATIONS` | `${VAR:-default}` with the default of the config; `${VAR}` for the GIF provider and key, the four `SKRUM_LLM_*` and `SKRUM_ALLOWED_EMAIL_DOMAINS`, empty by default | Sign-up, avatars, reminders, breach check, GIFs, AI, MCP, migrations, update feed |
| `MAIL_MAILER`, `MAIL_HOST`, `MAIL_PORT`, `MAIL_USERNAME`, `MAIL_PASSWORD`, `MAIL_FROM_ADDRESS` | `${MAIL_MAILER:-log}`, `${MAIL_PORT:-587}`, `${MAIL_FROM_ADDRESS:-hello@example.com}`, the others `${VAR}` | Mail goes to the log until they are filled |
| `GOOGLE_*`, `GITHUB_CLIENT_*`, `ENTRA_*`, `OIDC_*` | `${VAR}`, and `${ENTRA_TENANT:-common}` | Single sign-on; a provider is on when all its values are filled |
| `SLACK_*`, `TELEGRAM_BOT_TOKEN`, `JIRA_*`, `LINEAR_*`, `JIRA_DC_*`, `GITHUB_APP_*`, `MSTEAMS_*`, `MATTERMOST_URL`, `OUTGOING_WEBHOOKS_*`, `INTEGRATIONS_*` | `${VAR}`, and `${VAR:-default}` for the seven that have one in `.env.example` | The integration apps |

Not set, on purpose: `SKRUM_VERSION` (the image carries it; setting it makes the instance lie about its version), `SKRUM_ALLOW_DEBUG` (it lets debug pages expose the configuration), `SERVER_NAME` (the image default `:80` is the plain-HTTP mode a proxy needs), `REVERB_CLIENT_*` (empty, the browser then opens the websocket on the page's own origin, through the same port), `REVERB_APP_*` (derived from `APP_KEY`), `APP_ENV`, `APP_DEBUG`, `LOG_CHANNEL` (set by the image).

A variable Coolify shows empty reaches the container as an empty string, which replaces the default of the config. The application reads these values through `filled()` (single sign-on, the configuration screens) or ships them empty in `.env.example`, which CI runs on, so an empty value means "not set". One exception gets a default for that reason: an empty `MAIL_FROM_ADDRESS` would leave mails without a sender.

Volume: `skrum-storage:/app/storage/app`, where profile photos, brand assets and whiteboards live. The image's `/data` and `/config` volumes hold Caddy's certificates; behind a proxy Caddy obtains none, so they are left anonymous.

Healthcheck: `["CMD", "skrum-healthcheck"]`, the script the image already runs against `/up`, with a `start_period` of 90 s as in the `Dockerfile`: migrations run before the web server starts.

`depends_on` the database, `condition: service_healthy`.

**`postgres`**, image `postgres:18-alpine`, the tag `compose.production.yaml` uses. `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD` from the same three variables. Volume `skrum-postgres:/var/lib/postgresql`. Healthcheck `pg_isready`.

The design approved in conversation said `SERVER_NAME=:80` and `port: 80`. The port stands. `SERVER_NAME` is left unset because `:80` is the image's default, and the test reads the port from the `Dockerfile`, so the template follows if it moves again.

### 5.3 The documentation page

`skrum.mdx`, in the format of the guide: frontmatter (`title`, `description`, `category`, `icon`, `og.description`), "What is Skrum?", and links to the repository with `?utm_source=coolify.io`. It also says, because a Coolify user will not read the README first:

- the first account to sign up becomes the instance admin; sign up right after deploying;
- sign-up is by invitation afterwards (`SKRUM_SIGNUP_MODE`);
- mail goes to the log until SMTP is set, in Administration › SMTP or with the `MAIL_*` variables of the service;
- back up the database and the `skrum-storage` volume together.

No screenshot in this version: the guide makes them optional.

### 5.4 README

One paragraph "Run on Coolify" after "Run with Docker", linking `docs/coolify/README.md`.

### 5.5 The production env template

`.env.production.example` gains, commented and with their defaults, the variables the template offers and it did not list: the `SKRUM_*` settings, single sign-on and the integration apps. Its three uncommented values do not change (`APP_URL`, `APP_KEY`, `DB_PASSWORD`). The comments come from `.env.example`, shortened.

## 6. Keeping the template true

One feature test, `tests/Feature/CoolifyTemplateTest.php`, parsing `docs/coolify/skrum.yaml` with `symfony/yaml` (already installed for development, through `laravel/sail`; no dependency is added). It fails when:

- a header comment of the six is missing, or `port` is not the port of the `Dockerfile`'s `SERVER_NAME`;
- a service has a `build` key, or an image without a tag, or tagged `latest`;
- one of the variables `prepare` refuses to start without (`APP_KEY`, `DB_CONNECTION`, `DB_PASSWORD`) is absent from the `skrum` service;
- the logo the header names does not exist beside the template.

It also fails when a `SKRUM_*` variable read by `config/*.php` is missing from the template (except `SKRUM_VERSION`), when an optional variable is marked required, when `MAIL_FROM_ADDRESS` has no default, and when the template and `.env.production.example` do not list the same optional settings (apart from the four that only the Compose files read: `SERVER_NAME`, `SKRUM_IMAGE`, `SKRUM_HTTP_PORT`, `SKRUM_HTTPS_PORT`).

It does not start containers.

## 7. Verification

Before the image is published, on the owner's machine: build the image, tag it `ghcr.io/arnaud-ritti/skrum:0.0.1` locally, and start the template with `docker compose`, an env file standing in for the values Coolify generates. Expected: both containers healthy, `/up` answers 200 on port 80, the sign-up page loads.

After the image is published, on the owner's Coolify instance: a new "Docker Compose Empty" resource, the template pasted, Deploy.

## 8. Acceptance criteria

- **AC1.** `docs/coolify/skrum.yaml` carries the six header comments, pins both images to a version tag, and has no `build`, `ports` or `env_file` key.
- **AC2.** Started locally as in §7, both services become healthy and `GET /up` on port 80 answers 200.
- **AC3.** No value has to be typed: every variable the app refuses to start without is filled by a Coolify magic variable or a literal.
- **AC4.** `docs/coolify/skrum.svg` is byte-identical to `public/brand/skrum-symbol-light.svg`.
- **AC5.** `docs/coolify/skrum.mdx` has the five frontmatter keys of the guide and states the four points of §5.3.
- **AC6.** `CoolifyTemplateTest` passes, and fails when the template is given `image: …:latest` or loses `APP_KEY`.
- **AC7.** On the owner's Coolify instance, after the image is published: the deployment reaches "healthy", the generated `https://` domain shows the sign-up page, the first account is instance admin, and a card added in a retro in one browser appears in a second browser without reloading (the websocket goes through the proxy).
- **AC8.** `docs/coolify/README.md` lists the steps of the upstream submission: the two pull requests, the branch `next`, the destinations of §5.1, and the 1,000-star condition.

- **AC9.** The template offers mail, single sign-on, GIFs, AI, MCP, the integration apps and every other `SKRUM_*` setting as optional variables: none is required, and started with all of them empty the application sends mail from `hello@example.com` and enables no single sign-on provider.
- **AC10.** `.env.production.example` lists the same optional settings, commented; `DockerPackagingTest` still passes (three values to fill, only variables the image reads).

AC7 cannot be checked before §4 is done. The kit is delivered on AC1 to AC6 and AC8 to AC10; AC7 is run by the owner, or with them, once the image is public.
