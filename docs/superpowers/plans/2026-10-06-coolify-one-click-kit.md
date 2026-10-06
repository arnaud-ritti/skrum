# Coolify One-Click Service Kit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship, inside this repository, the three artefacts Coolify asks of a one-click service (Compose template, logo, documentation page), usable today through "Docker Compose Empty" and ready to submit upstream unchanged.

**Architecture:** Four static files under `docs/coolify/`, commented lines added to `.env.production.example`, no application code. One Pest feature test parses the template and the documentation page and fails when they drift from the rules of Coolify's contribution guide or from what the image needs to start. A final task starts the template with `docker compose` against a locally built image.

**Tech Stack:** Docker Compose file format, Coolify magic variables (`SERVICE_URL_*`, `SERVICE_REALBASE64_*`, `SERVICE_USER_*`, `SERVICE_PASSWORD_*`), Pest 5, `symfony/yaml` (already installed for development through `laravel/sail`).

**Spec:** `docs/superpowers/specs/2026-10-06-coolify-one-click-kit-design.md`

## Global Constraints

- No dependency is added to `composer.json` or `package.json`.
- The image, `docker/` and the three `compose.production*.yaml` files are not modified. `.env.production.example` gains commented lines only: its three uncommented values stay `APP_URL`, `APP_KEY`, `DB_PASSWORD`.
- Image tags are pinned: `ghcr.io/arnaud-ritti/skrum:0.0.1` and `postgres:18-alpine`. Never `latest`.
- The container port is `80`, the one the `Dockerfile` sets in `SERVER_NAME=:80`. The test reads it from there; it is written nowhere else than the template's header and its `SERVICE_URL_SKRUM_80` variable. The template does not set `SERVER_NAME`, `REVERB_CLIENT_*`, `REVERB_APP_*`, `SKRUM_VERSION` or `SKRUM_ALLOW_DEBUG`.
- An optional variable is never required: `${VAR:-default}` when the config has a default, `${VAR}` otherwise, never `${VAR:?}`.
- No plan or spec identifier in code, tests or file names (`CoolifyTemplateTest`, not a numbered name).
- Tests are created with `php artisan make:test --pest <Name> --no-interaction`, carry no comments, and follow arrange, act, assert.
- After any PHP change: `vendor/bin/pint --dirty --format agent`.
- Commits follow Conventional Commits, `type(scope): sentence saying what is now true`, and end with the trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- The pull requests against `coollabsio/coolify` and Coolify's documentation repository are **not** opened: the repository needs 1,000 stars first.

## Review Focus

What the spec implies and a Coolify user will meet, most likely first. Each line names the test that pins it.

1. **TLS is terminated by Coolify's proxy.** Without `TRUSTED_PROXIES`, generated URLs are `http://` and the secure session cookie is refused. Pinned by "leaves the address to the proxy in front" (Task 1).
2. **The domain is chosen, and later changed, in Coolify.** `APP_URL` must follow the generated URL, never a literal. Same test.
3. **The websocket must go through the same port.** A `REVERB_CLIENT_*` or `SERVER_NAME` value in the template would send browsers to a port the proxy does not route. Same test.
4. **A redeploy recreates the container.** Uploads kept outside a named volume are lost. Pinned by "keeps uploads on a named volume" (Task 1).
5. **Coolify passes a variable it shows empty as an empty string**, which replaces the default of the config. Mail without a sender is the one case that breaks. Pinned by "asks for none of the optional settings and always names a sender" (Task 1) and by Task 4 Step 4.
6. **Nobody types a value.** A `${VAR:?}` or an empty `${VAR}` on a variable the container refuses to start without makes the first deploy fail. Pinned by "fills every variable the container refuses to start without" (Task 1).

---

### Task 1: The template, its logo and the test that keeps them true

**Files:**
- Create: `tests/Feature/CoolifyTemplateTest.php`
- Create: `docs/coolify/skrum.yaml`
- Create: `docs/coolify/skrum.svg` (copy of `public/brand/skrum-symbol-light.svg`)

**Interfaces:**
- Consumes: `Dockerfile` (the line `SERVER_NAME=:80`), `public/brand/skrum-symbol-light.svg`.
- Produces: `docs/coolify/skrum.yaml` with the services `skrum` and `postgres`; `docs/coolify/skrum.svg`. Tasks 2 and 3 each add one test to `tests/Feature/CoolifyTemplateTest.php`, and Task 4 starts the template.

- [ ] **Step 1: Create the test file**

Run: `php artisan make:test --pest CoolifyTemplateTest --no-interaction`

Replace the content of `tests/Feature/CoolifyTemplateTest.php` with:

```php
<?php

use Symfony\Component\Yaml\Yaml;

beforeEach(function () {
    $this->source = (string) file_get_contents(base_path('docs/coolify/skrum.yaml'));
    $this->template = Yaml::parse($this->source);
    $this->environment = collect($this->template['services']['skrum']['environment'])
        ->mapWithKeys(function (string $entry): array {
            [$name, $value] = array_pad(explode('=', $entry, 2), 2, null);

            return [$name => $value];
        });
});

it('carries the six header comments Coolify reads, with the port the image serves', function () {
    preg_match_all('/^# (\w+): (.+)$/m', $this->source, $matches);
    preg_match('/SERVER_NAME=:(\d+)/', (string) file_get_contents(base_path('Dockerfile')), $served);

    $header = array_combine($matches[1], $matches[2]);

    expect(array_keys($header))->toBe(['documentation', 'slogan', 'category', 'tags', 'logo', 'port'])
        ->and($header['port'])->toBe($served[1])
        ->and($this->environment->keys())->toContain("SERVICE_URL_SKRUM_{$served[1]}");
});

it('pins every image to a version and builds nothing', function () {
    expect($this->template['services'])->toHaveKeys(['skrum', 'postgres']);

    foreach ($this->template['services'] as $service) {
        expect($service)->not->toHaveKey('build')
            ->and($service)->not->toHaveKey('ports')
            ->and($service)->not->toHaveKey('env_file')
            ->and($service['image'])->toMatch('/:\d[\w.-]*$/')
            ->and($service['image'])->not->toEndWith(':latest');
    }
});

it('fills every variable the container refuses to start without', function (string $name) {
    $value = $this->environment->get($name);

    expect($value)->toBeString()
        ->and($value)->not->toBe('')
        ->and($value)->not->toContain(':?')
        ->and($value)->not->toMatch('/^\$\{(?!SERVICE_)[A-Z0-9_]+\}$/');
})->with(['APP_KEY', 'DB_CONNECTION', 'DB_PASSWORD']);

it('leaves the address to the proxy in front', function () {
    $names = $this->environment->keys();

    expect($this->environment->get('APP_URL'))->toBe('${SERVICE_URL_SKRUM}')
        ->and($names)->toContain('TRUSTED_PROXIES')
        ->and($names)->not->toContain('SERVER_NAME')
        ->and($names->filter(fn (string $name): bool => str_starts_with($name, 'REVERB_CLIENT_'))->all())->toBeEmpty();
});

it('offers every Skrum setting the application reads', function () {
    $config = collect(glob(base_path('config/*.php')))
        ->map(fn (string $path): string => (string) file_get_contents($path))
        ->implode("\n");

    preg_match_all("/env\('(SKRUM_[A-Z_]+)'/", $config, $matches);

    $expected = collect($matches[1])->push('SKRUM_RUN_MIGRATIONS')->unique()->diff(['SKRUM_VERSION'])->values();
    $offered = $this->environment->keys();

    expect($expected->all())->not->toBeEmpty()
        ->and($expected->diff($offered)->all())->toBeEmpty()
        ->and($offered)->not->toContain('SKRUM_VERSION')
        ->and($offered)->not->toContain('SKRUM_ALLOW_DEBUG');
});

it('asks for none of the optional settings and always names a sender', function () {
    $optional = $this->environment->filter(
        fn (?string $value): bool => $value !== null && str_starts_with($value, '${') && ! str_starts_with($value, '${SERVICE_'),
    );

    expect($optional->keys())->toContain('MAIL_HOST', 'GOOGLE_CLIENT_ID', 'OIDC_BASE_URL', 'SKRUM_GIF_PROVIDER', 'SLACK_CLIENT_ID', 'GITHUB_APP_PRIVATE_KEY')
        ->and($optional->filter(fn (string $value): bool => str_contains($value, ':?'))->all())->toBeEmpty()
        ->and($this->environment->get('MAIL_FROM_ADDRESS'))->toBe('${MAIL_FROM_ADDRESS:-hello@example.com}');
});

it('keeps uploads on a named volume', function () {
    expect($this->template['services']['skrum']['volumes'])->toContain('skrum-storage:/app/storage/app');
});

it('ships the logo its header names, identical to the brand symbol', function () {
    preg_match('/^# logo: svgs\/(.+)$/m', $this->source, $logo);

    expect(base_path("docs/coolify/{$logo[1]}"))->toBeFile()
        ->and(file_get_contents(base_path("docs/coolify/{$logo[1]}")))
        ->toBe(file_get_contents(base_path('public/brand/skrum-symbol-light.svg')));
});
```

The third test reads: the value is a non-empty string that asks nothing of the operator. A literal passes (`pgsql`), so does a magic variable (`${SERVICE_PASSWORD_POSTGRES}`, `base64:${SERVICE_REALBASE64_SKRUM}`); a required marker (`${VAR:?}`) or a bare variable Coolify would show empty (`${DB_PASSWORD}`) fails.

- [ ] **Step 2: Run the test and see it fail**

Run: `php artisan test --compact tests/Feature/CoolifyTemplateTest.php`
Expected: FAIL, every test, with `file_get_contents(…/docs/coolify/skrum.yaml): Failed to open stream: No such file or directory`.

- [ ] **Step 3: Write the template**

Create `docs/coolify/skrum.yaml`:

```yaml
# documentation: https://github.com/arnaud-ritti/skrum#readme
# slogan: Realtime retrospectives, planning poker and whiteboards for agile teams.
# category: productivity
# tags: retrospective,agile,scrum,planning-poker,whiteboard,realtime
# logo: svgs/skrum.svg
# port: 80

services:
  skrum:
    image: ghcr.io/arnaud-ritti/skrum:0.0.1
    environment:
      - SERVICE_URL_SKRUM_80
      - APP_URL=${SERVICE_URL_SKRUM}
      - APP_KEY=base64:${SERVICE_REALBASE64_SKRUM}
      - APP_NAME=${APP_NAME:-Skrum}
      - APP_TIMEZONE=${APP_TIMEZONE:-UTC}
      - APP_LOCALE=${APP_LOCALE:-en}
      - TRUSTED_PROXIES=${TRUSTED_PROXIES:-*}
      - DB_CONNECTION=pgsql
      - DB_HOST=postgres
      - DB_PORT=5432
      - DB_DATABASE=${POSTGRES_DB:-skrum}
      - DB_USERNAME=${SERVICE_USER_POSTGRES}
      - DB_PASSWORD=${SERVICE_PASSWORD_POSTGRES}
      - BROADCAST_CONNECTION=reverb
      - REVERB_HOST=127.0.0.1
      - REVERB_PORT=8080
      - REVERB_SCHEME=http
      - SKRUM_SIGNUP_MODE=${SKRUM_SIGNUP_MODE:-invite}
      - SKRUM_ALLOWED_EMAIL_DOMAINS=${SKRUM_ALLOWED_EMAIL_DOMAINS}
      - SKRUM_AVATAR_STYLE=${SKRUM_AVATAR_STYLE:-thumbs}
      - SKRUM_ACTION_ITEM_REMINDERS=${SKRUM_ACTION_ITEM_REMINDERS:-true}
      - SKRUM_ACTION_ITEM_REMINDER_TIME=${SKRUM_ACTION_ITEM_REMINDER_TIME:-08:00}
      - SKRUM_PASSWORD_BREACH_CHECK=${SKRUM_PASSWORD_BREACH_CHECK:-true}
      - SKRUM_PASSWORD_BREACH_CHECK_TIMEOUT=${SKRUM_PASSWORD_BREACH_CHECK_TIMEOUT:-5}
      - SKRUM_GIF_PROVIDER=${SKRUM_GIF_PROVIDER}
      - SKRUM_GIF_API_KEY=${SKRUM_GIF_API_KEY}
      - SKRUM_GIF_RATING=${SKRUM_GIF_RATING:-g}
      - SKRUM_LLM_PROVIDER=${SKRUM_LLM_PROVIDER}
      - SKRUM_LLM_API_KEY=${SKRUM_LLM_API_KEY}
      - SKRUM_LLM_MODEL=${SKRUM_LLM_MODEL}
      - SKRUM_LLM_BASE_URL=${SKRUM_LLM_BASE_URL}
      - SKRUM_MCP_ENABLED=${SKRUM_MCP_ENABLED:-true}
      - SKRUM_MCP_RATE_LIMIT=${SKRUM_MCP_RATE_LIMIT:-120}
      - SKRUM_MCP_WRITE_RATE_LIMIT=${SKRUM_MCP_WRITE_RATE_LIMIT:-30}
      - SKRUM_RUN_MIGRATIONS=${SKRUM_RUN_MIGRATIONS:-true}
      - SKRUM_UPDATE_FEED=${SKRUM_UPDATE_FEED:-https://api.github.com/repos/arnaud-ritti/skrum/releases/latest}
      - MAIL_MAILER=${MAIL_MAILER:-log}
      - MAIL_HOST=${MAIL_HOST}
      - MAIL_PORT=${MAIL_PORT:-587}
      - MAIL_USERNAME=${MAIL_USERNAME}
      - MAIL_PASSWORD=${MAIL_PASSWORD}
      - MAIL_FROM_ADDRESS=${MAIL_FROM_ADDRESS:-hello@example.com}
      - GOOGLE_CLIENT_ID=${GOOGLE_CLIENT_ID}
      - GOOGLE_CLIENT_SECRET=${GOOGLE_CLIENT_SECRET}
      - GITHUB_CLIENT_ID=${GITHUB_CLIENT_ID}
      - GITHUB_CLIENT_SECRET=${GITHUB_CLIENT_SECRET}
      - ENTRA_TENANT=${ENTRA_TENANT:-common}
      - ENTRA_CLIENT_ID=${ENTRA_CLIENT_ID}
      - ENTRA_CLIENT_SECRET=${ENTRA_CLIENT_SECRET}
      - OIDC_BASE_URL=${OIDC_BASE_URL}
      - OIDC_CLIENT_ID=${OIDC_CLIENT_ID}
      - OIDC_CLIENT_SECRET=${OIDC_CLIENT_SECRET}
      - OIDC_LABEL=${OIDC_LABEL}
      - SLACK_CLIENT_ID=${SLACK_CLIENT_ID}
      - SLACK_CLIENT_SECRET=${SLACK_CLIENT_SECRET}
      - TELEGRAM_BOT_TOKEN=${TELEGRAM_BOT_TOKEN}
      - JIRA_CLIENT_ID=${JIRA_CLIENT_ID}
      - JIRA_CLIENT_SECRET=${JIRA_CLIENT_SECRET}
      - LINEAR_CLIENT_ID=${LINEAR_CLIENT_ID}
      - LINEAR_CLIENT_SECRET=${LINEAR_CLIENT_SECRET}
      - LINEAR_WEBHOOK_SECRET=${LINEAR_WEBHOOK_SECRET}
      - JIRA_DC_BASE_URL=${JIRA_DC_BASE_URL}
      - JIRA_DC_CLIENT_ID=${JIRA_DC_CLIENT_ID}
      - JIRA_DC_CLIENT_SECRET=${JIRA_DC_CLIENT_SECRET}
      - JIRA_DC_PERSONAL_TOKENS=${JIRA_DC_PERSONAL_TOKENS:-true}
      - GITHUB_APP_ID=${GITHUB_APP_ID}
      - GITHUB_APP_SLUG=${GITHUB_APP_SLUG}
      - GITHUB_APP_CLIENT_ID=${GITHUB_APP_CLIENT_ID}
      - GITHUB_APP_CLIENT_SECRET=${GITHUB_APP_CLIENT_SECRET}
      - GITHUB_APP_PRIVATE_KEY=${GITHUB_APP_PRIVATE_KEY}
      - GITHUB_APP_PRIVATE_KEY_PATH=${GITHUB_APP_PRIVATE_KEY_PATH}
      - GITHUB_APP_WEBHOOK_SECRET=${GITHUB_APP_WEBHOOK_SECRET}
      - MSTEAMS_ENABLED=${MSTEAMS_ENABLED:-false}
      - MSTEAMS_ALLOWED_HOSTS=${MSTEAMS_ALLOWED_HOSTS}
      - MATTERMOST_URL=${MATTERMOST_URL}
      - OUTGOING_WEBHOOKS_ENABLED=${OUTGOING_WEBHOOKS_ENABLED:-false}
      - OUTGOING_WEBHOOKS_ALLOW_PRIVATE_NETWORKS=${OUTGOING_WEBHOOKS_ALLOW_PRIVATE_NETWORKS:-false}
      - OUTGOING_WEBHOOKS_ALLOW_HTTP=${OUTGOING_WEBHOOKS_ALLOW_HTTP:-false}
      - INTEGRATIONS_INBOUND_WEBHOOKS=${INTEGRATIONS_INBOUND_WEBHOOKS:-auto}
      - INTEGRATIONS_POLL_MINUTES=${INTEGRATIONS_POLL_MINUTES:-5}
    volumes:
      - skrum-storage:/app/storage/app
    depends_on:
      postgres:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "skrum-healthcheck"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 90s
  postgres:
    image: postgres:18-alpine
    environment:
      - POSTGRES_DB=${POSTGRES_DB:-skrum}
      - POSTGRES_USER=${SERVICE_USER_POSTGRES}
      - POSTGRES_PASSWORD=${SERVICE_PASSWORD_POSTGRES}
    volumes:
      - skrum-postgres:/var/lib/postgresql
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U $${POSTGRES_USER} -d $${POSTGRES_DB}"]
      interval: 5s
      timeout: 5s
      retries: 10
```

There is no top-level `volumes:` key: Coolify declares the named volumes itself, as the upstream templates rely on (`templates/compose/invoice-ninja.yaml`).

- [ ] **Step 4: Copy the logo**

Run: `cp public/brand/skrum-symbol-light.svg docs/coolify/skrum.svg`

- [ ] **Step 5: Run the test and see it pass**

Run: `php artisan test --compact tests/Feature/CoolifyTemplateTest.php`
Expected: PASS, 10 tests (the dataset counts three).

- [ ] **Step 6: Prove the test catches the two mistakes the spec names (AC6)**

Run each command, expect the named test to FAIL, then restore the file.

```bash
sed -i.bak 's|skrum:0.0.1|skrum:latest|' docs/coolify/skrum.yaml
php artisan test --compact tests/Feature/CoolifyTemplateTest.php
mv docs/coolify/skrum.yaml.bak docs/coolify/skrum.yaml
```

Expected: FAIL on "pins every image to a version and builds nothing".

```bash
sed -i.bak '/APP_KEY=/d' docs/coolify/skrum.yaml
php artisan test --compact tests/Feature/CoolifyTemplateTest.php
mv docs/coolify/skrum.yaml.bak docs/coolify/skrum.yaml
```

Expected: FAIL on "fills every variable the container refuses to start without" with data set `APP_KEY`.

Run once more: `php artisan test --compact tests/Feature/CoolifyTemplateTest.php`
Expected: PASS, and `git status --short docs/coolify` lists no `.bak` file.

- [ ] **Step 7: Format and commit**

```bash
vendor/bin/pint --dirty --format agent
git add docs/coolify/skrum.yaml docs/coolify/skrum.svg tests/Feature/CoolifyTemplateTest.php
git commit -m "feat(install): a Coolify template that deploys without a value to type

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: The documentation page, the kit's README and the pointer from the main README

**Files:**
- Modify: `tests/Feature/CoolifyTemplateTest.php` (append one test)
- Create: `docs/coolify/skrum.mdx`
- Create: `docs/coolify/README.md`
- Modify: `README.md` (insert one section before `## Configuration`)

**Interfaces:**
- Consumes: `docs/coolify/skrum.yaml` and `docs/coolify/skrum.svg` from Task 1.
- Produces: `docs/coolify/skrum.mdx` whose frontmatter has the keys `title`, `description`, `category`, `icon`, `og`.

- [ ] **Step 1: Write the failing test**

Append to `tests/Feature/CoolifyTemplateTest.php`:

```php
it('documents the service with the frontmatter the Coolify docs ask for', function () {
    $page = (string) file_get_contents(base_path('docs/coolify/skrum.mdx'));

    preg_match('/\A---\n(.+?)\n---\n/s', $page, $frontmatter);

    $meta = Yaml::parse($frontmatter[1]);

    expect($meta)->toHaveKeys(['title', 'description', 'category', 'icon', 'og'])
        ->and($meta['og'])->toHaveKey('description')
        ->and($meta['title'])->toBe('Skrum')
        ->and($meta['icon'])->toBe('/images/services/skrum.svg')
        ->and($page)->toContain('utm_source=coolify.io');
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `php artisan test --compact tests/Feature/CoolifyTemplateTest.php --filter="documents the service"`
Expected: FAIL with `Failed to open stream: No such file or directory` for `docs/coolify/skrum.mdx`.

- [ ] **Step 3: Write the documentation page**

Create `docs/coolify/skrum.mdx`:

```mdx
---
title: "Skrum"
description: "Realtime retrospectives, planning poker, whiteboards, surveys and games for agile teams."
category: "Productivity"
icon: "/images/services/skrum.svg"
og:
  description: "Deploy Skrum on Coolify: realtime retrospectives, planning poker and whiteboards for agile teams, open source and self-hosted."
---

# Skrum

![Skrum](/docs/images/services/skrum.svg)

## What is Skrum?

Skrum is an open-source place for a team's rituals: retrospectives with votes and action items, planning poker, whiteboards, team surveys and short games to open a session. Everything is realtime, guests join through a link, and the interface is available in English, French, Spanish and German.

One container runs the web server, the websockets, the queue worker and the scheduler. This template adds PostgreSQL beside it.

## After deploying

- **Sign up at once.** The first account created becomes the instance admin.
- **Sign-up is by invitation afterwards.** Change `SKRUM_SIGNUP_MODE` to `open` or `domain` to let people register by themselves.
- **Mail goes to the log** until SMTP is set, in Administration › SMTP or with the `MAIL_*` variables of the service.
- **Single sign-on, GIFs, AI and the integrations** are optional variables of the service, empty by default. Most can also be set in Administration.
- **Back up the database and the `skrum-storage` volume together.** The volume holds profile photos, brand assets and whiteboards.

## Links

- [GitHub](https://github.com/arnaud-ritti/skrum?utm_source=coolify.io)
- [Documentation](https://github.com/arnaud-ritti/skrum?utm_source=coolify.io#readme)
```

- [ ] **Step 4: Write the kit's README**

Create `docs/coolify/README.md`:

````markdown
# Skrum on Coolify

The files Coolify asks of a one-click service, kept here until Skrum can be submitted upstream.

| File | What it is |
| --- | --- |
| `skrum.yaml` | The Compose template |
| `skrum.svg` | The logo |
| `skrum.mdx` | The page for Coolify's documentation |

## Deploy it today

The image `ghcr.io/arnaud-ritti/skrum:0.0.1` must be published and public.

1. In Coolify, open a project and add a resource: **Docker Compose Empty**.
2. Paste the content of [`skrum.yaml`](skrum.yaml) and save.
3. Press **Deploy**. Coolify generates the domain, the application key and the database credentials.
4. Open the generated domain and sign up: the first account becomes the instance admin.

To update, change the tag of the `skrum` image in the service's Compose file and deploy again. Migrations run when the container starts.

## Submitting upstream

Coolify accepts a service whose repository has at least 1,000 GitHub stars. Until then, nothing is submitted.

Two pull requests, opened together and linked to each other:

1. **Template**, against the `next` branch of [`coollabsio/coolify`](https://github.com/coollabsio/coolify):
    - `skrum.yaml` → `templates/compose/skrum.yaml`
    - `skrum.svg` → `svgs/skrum.svg`
    - tested from a fresh "Docker Compose Empty" resource
2. **Documentation**, against Coolify's documentation repository:
    - `skrum.mdx` → `content/docs/services/skrum.mdx`
    - `skrum.svg` → `public/images/services/skrum.svg`
    - then `bun run generate:services`

The template pull request cannot be merged before the documentation one is approved.

Contribution guide: <https://coolify.io/docs/contribute/service>.
````

- [ ] **Step 5: Point to the kit from the main README**

In `README.md`, insert this section immediately before the line `## Configuration`:

```markdown
## Run on Coolify

A Compose template for [Coolify](https://coolify.io) is in [`docs/coolify`](docs/coolify/README.md): paste it into a "Docker Compose Empty" resource and deploy. Coolify generates the domain, the application key and the database credentials, and terminates TLS in front of the container.

```

- [ ] **Step 6: Run the tests**

Run: `php artisan test --compact tests/Feature/CoolifyTemplateTest.php tests/Feature/ReadmeImagesTest.php tests/Feature/LicenceDeclarationTest.php tests/Feature/Mcp/McpPackagingTest.php`
Expected: PASS. The last three read `README.md`.

- [ ] **Step 7: Check the Markdown formatting**

Run: `npx vp fmt --check README.md docs/coolify/README.md`
Expected: `All matched files use the correct format.` If not, run `npx vp fmt README.md docs/coolify/README.md` and look at the diff.

- [ ] **Step 8: Read the page against the spec (AC5, AC8)**

Open `docs/coolify/skrum.mdx` and confirm it states the four points of spec §5.3: first account is admin, sign-up by invitation, mail to the log until SMTP is set, back up database and storage volume together. Open `docs/coolify/README.md` and confirm it names both pull requests, the branch `next`, the four destinations of spec §5.1 and the 1,000-star condition.

- [ ] **Step 9: Format and commit**

```bash
vendor/bin/pint --dirty --format agent
git add docs/coolify/skrum.mdx docs/coolify/README.md README.md tests/Feature/CoolifyTemplateTest.php
git commit -m "docs(install): the Coolify documentation page and how to submit the service

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: The production env template lists the same settings

**Files:**
- Modify: `tests/Feature/CoolifyTemplateTest.php` (append one test)
- Modify: `.env.production.example` (commented lines only)

**Interfaces:**
- Consumes: `docs/coolify/skrum.yaml` from Task 1; `tests/Feature/DockerPackagingTest.php`, which requires that the template's uncommented keys are exactly `APP_URL`, `APP_KEY`, `DB_PASSWORD` and that every listed variable is read by the image.
- Produces: nothing a later task uses.

- [ ] **Step 1: Write the failing test**

Append to `tests/Feature/CoolifyTemplateTest.php`:

```php
it('offers on Coolify the optional settings the production env template lists, and no other', function () {
    preg_match_all('/^#? ?([A-Z][A-Z0-9_]*)=/m', (string) file_get_contents(base_path('.env.production.example')), $matches);

    $listed = collect($matches[1])->unique()->diff(['SERVER_NAME', 'SKRUM_IMAGE', 'SKRUM_HTTP_PORT', 'SKRUM_HTTPS_PORT'])->values();
    $offered = $this->environment->keys();
    $editable = $this->environment
        ->filter(fn (?string $value): bool => $value !== null && str_starts_with($value, '${') && ! str_starts_with($value, '${SERVICE_'))
        ->keys()
        ->diff(['DB_DATABASE'])
        ->values();

    expect($listed->diff($offered)->all())->toBeEmpty()
        ->and($editable->diff($listed)->all())->toBeEmpty();
});
```

The four names left out are read by the Compose files and the built-in Caddy only; `DB_DATABASE` is the database name the template shares with its PostgreSQL service.

- [ ] **Step 2: Run it and see it fail**

Run: `php artisan test --compact tests/Feature/CoolifyTemplateTest.php --filter="production env template"`
Expected: FAIL on the second expectation: the template offers `SKRUM_ALLOWED_EMAIL_DOMAINS`, `GOOGLE_CLIENT_ID`, `SLACK_CLIENT_ID` and the others, which `.env.production.example` does not list yet.

- [ ] **Step 3: List the settings in the production env template**

In `.env.production.example`, insert the block below immediately before the line that starts with `# Other variables: README.md, "Configuration".`, keeping one blank line between the block and that line:

```dotenv
# Email domains allowed to sign up when SKRUM_SIGNUP_MODE=domain, comma-separated.
# SKRUM_ALLOWED_EMAIL_DOMAINS=
# DiceBear avatar style (thumbs is CC0 and needs no attribution).
# SKRUM_AVATAR_STYLE=thumbs
# Daily reminders for action items, sent at this time in APP_TIMEZONE.
# SKRUM_ACTION_ITEM_REMINDERS=true
# SKRUM_ACTION_ITEM_REMINDER_TIME=08:00
# New passwords are checked against known data breaches (api.pwnedpasswords.com,
# by k-anonymity). Set to false on an instance without outbound access.
# SKRUM_PASSWORD_BREACH_CHECK=true
# SKRUM_PASSWORD_BREACH_CHECK_TIMEOUT=5
# GIFs in cards: giphy or tenor, with your own API key. Empty hides GIFs.
# SKRUM_GIF_PROVIDER=
# SKRUM_GIF_API_KEY=
# SKRUM_GIF_RATING=g
# AI features, with your own key: anthropic, or openai for any OpenAI-compatible
# server (then set SKRUM_LLM_BASE_URL). Empty hides every AI feature.
# SKRUM_LLM_PROVIDER=
# SKRUM_LLM_API_KEY=
# SKRUM_LLM_MODEL=
# SKRUM_LLM_BASE_URL=
# MCP server at /mcp for AI assistants, and its limits per token and per minute.
# SKRUM_MCP_ENABLED=true
# SKRUM_MCP_RATE_LIMIT=120
# SKRUM_MCP_WRITE_RATE_LIMIT=30
# Run database migrations when the container starts.
# SKRUM_RUN_MIGRATIONS=true
# Release feed asked by the optional update check.
# SKRUM_UPDATE_FEED=https://api.github.com/repos/arnaud-ritti/skrum/releases/latest

# Single sign-on: a provider is enabled when all its values are set.
# Callback URLs: ${APP_URL}/auth/{google|github|entra|oidc}/callback
# GOOGLE_CLIENT_ID=
# GOOGLE_CLIENT_SECRET=
# GITHUB_CLIENT_ID=
# GITHUB_CLIENT_SECRET=
# ENTRA_TENANT=common
# ENTRA_CLIENT_ID=
# ENTRA_CLIENT_SECRET=
# OIDC_BASE_URL=
# OIDC_CLIENT_ID=
# OIDC_CLIENT_SECRET=
# OIDC_LABEL=

# Integrations: a provider appears on each team's integrations page when all its
# values are set. What each app needs (scopes, callback URLs) is in .env.example.
# SLACK_CLIENT_ID=
# SLACK_CLIENT_SECRET=
# TELEGRAM_BOT_TOKEN=
# JIRA_CLIENT_ID=
# JIRA_CLIENT_SECRET=
# LINEAR_CLIENT_ID=
# LINEAR_CLIENT_SECRET=
# LINEAR_WEBHOOK_SECRET=
# JIRA_DC_BASE_URL=
# JIRA_DC_CLIENT_ID=
# JIRA_DC_CLIENT_SECRET=
# JIRA_DC_PERSONAL_TOKENS=true
# GITHUB_APP_ID=
# GITHUB_APP_SLUG=
# GITHUB_APP_CLIENT_ID=
# GITHUB_APP_CLIENT_SECRET=
# GITHUB_APP_PRIVATE_KEY=
# GITHUB_APP_PRIVATE_KEY_PATH=
# GITHUB_APP_WEBHOOK_SECRET=
# MSTEAMS_ENABLED=false
# MSTEAMS_ALLOWED_HOSTS=
# MATTERMOST_URL=
# OUTGOING_WEBHOOKS_ENABLED=false
# OUTGOING_WEBHOOKS_ALLOW_PRIVATE_NETWORKS=false
# OUTGOING_WEBHOOKS_ALLOW_HTTP=false
# How trackers report changes: auto, on or off; otherwise polled every N minutes.
# INTEGRATIONS_INBOUND_WEBHOOKS=auto
# INTEGRATIONS_POLL_MINUTES=5
```

Every line is a comment: nothing changes for an install that copies the file as it is.

- [ ] **Step 4: Run the tests and see them pass**

Run: `php artisan test --compact tests/Feature/CoolifyTemplateTest.php tests/Feature/DockerPackagingTest.php`
Expected: PASS. `DockerPackagingTest` confirms the file still asks for three values only and lists only variables the image reads.

- [ ] **Step 5: Format and commit**

```bash
vendor/bin/pint --dirty --format agent
git add .env.production.example tests/Feature/CoolifyTemplateTest.php
git commit -m "docs(install): the production env template lists single sign-on, GIFs, AI and the integrations

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Start the template against a locally built image (AC2, AC3, AC9)

No file of the repository changes. Scratch files go in a temporary directory.

**Files:**
- Create (temporary, outside the repository): `$SCRATCH/coolify.env`, `$SCRATCH/volumes.yaml`

**Interfaces:**
- Consumes: `docs/coolify/skrum.yaml` from Task 1, the `Dockerfile`.
- Produces: nothing a later task uses.

- [ ] **Step 1: Build the image under the tag the template pins**

Run: `docker build -t ghcr.io/arnaud-ritti/skrum:0.0.1 --build-arg SKRUM_VERSION=0.0.1 .`
Expected: the build ends with `naming to ghcr.io/arnaud-ritti/skrum:0.0.1`. It takes several minutes.

- [ ] **Step 2: Stand in for what Coolify generates**

```bash
SCRATCH="$(mktemp -d)"
cat > "$SCRATCH/coolify.env" <<EOF
SERVICE_URL_SKRUM=http://localhost
SERVICE_REALBASE64_SKRUM=$(openssl rand -base64 32)
SERVICE_USER_POSTGRES=skrum
SERVICE_PASSWORD_POSTGRES=$(openssl rand -hex 16)
EOF
cat > "$SCRATCH/volumes.yaml" <<'EOF'
volumes:
  skrum-storage:
  skrum-postgres:
EOF
```

The second file declares the two named volumes, which Coolify declares itself.

- [ ] **Step 3: Start both services**

Run:

```bash
docker compose -p skrum-coolify-check --env-file "$SCRATCH/coolify.env" \
  -f docs/coolify/skrum.yaml -f "$SCRATCH/volumes.yaml" up -d --wait --wait-timeout 240
```

Expected: both containers reported `Healthy`. If `skrum` is not, run `docker compose -p skrum-coolify-check logs skrum` and read the first line starting with `skrum:`: the startup script names the missing variable.

- [ ] **Step 4: Ask the application itself**

Run:

```bash
docker compose -p skrum-coolify-check exec skrum curl -fsS -o /dev/null -w '%{http_code}\n' http://127.0.0.1/up
docker compose -p skrum-coolify-check exec skrum curl -fsS -o /dev/null -w '%{http_code}\n' http://127.0.0.1/register
docker compose -p skrum-coolify-check exec skrum php artisan tinker --execute 'echo config("app.url"), " ", config("database.default"), " ", config("broadcasting.default"), " ", config("skrum.version");'
docker compose -p skrum-coolify-check exec skrum php artisan tinker --execute 'echo config("mail.default"), " ", config("mail.from.address"), " ", count(App\Enums\SsoProvider::enabled()), " ", var_export(config("skrum.mcp.enabled"), true), " ", config("skrum.update_feed");'
```

Expected: `200`, `200`, then `http://localhost pgsql reverb 0.0.1`, then `log hello@example.com 0 true https://api.github.com/repos/arnaud-ritti/skrum/releases/latest`.

The last line is AC9: every optional variable reached the container empty or at its default, mail keeps a sender, no single sign-on provider is on, and the defaults written in the template (a boolean, a URL) arrive intact. Compose warns that the optional variables are not set; that is the empty value Coolify would pass.

- [ ] **Step 5: Confirm the uploads volume is the mounted one**

Run: `docker compose -p skrum-coolify-check exec skrum sh -c 'mount | grep /app/storage/app'`
Expected: one line naming `/app/storage/app`.

- [ ] **Step 6: Tear down**

Run:

```bash
docker compose -p skrum-coolify-check --env-file "$SCRATCH/coolify.env" \
  -f docs/coolify/skrum.yaml -f "$SCRATCH/volumes.yaml" down -v
rm -rf "$SCRATCH"
```

Expected: containers, network and both volumes removed. `git status --short` shows nothing new.

- [ ] **Step 7: Record what is left for the owner (AC7)**

Nothing to commit. Report to the owner that AC7 remains: once `main` is pushed and release `v0.0.1` is published, deploy `docs/coolify/skrum.yaml` on their Coolify instance through "Docker Compose Empty", and check that the generated `https://` domain shows the sign-up page, that the first account is instance admin, and that a card added in a retro in one browser appears in a second one without reloading.

---

## Self-review

| Spec item | Where |
| --- | --- |
| §5.1 four files in `docs/coolify/` | Tasks 1 and 2 |
| §5.2 header, two services, environment, volume, healthcheck, `depends_on` | Task 1 Step 3 |
| §5.2 nothing set for `SERVER_NAME`, `REVERB_CLIENT_*`, `MAIL_*` | Task 1 test "leaves the address to the proxy in front" |
| §5.3 documentation page, four points | Task 2 Steps 3 and 8 |
| §5.4 README paragraph | Task 2 Step 5 |
| §5.5 production env template | Task 3 |
| §6 the test and what it fails on | Task 1 Steps 1 and 6, Task 2 Step 1 |
| §7 local verification | Task 4 |
| AC1 | Task 1 tests "carries the six header comments…", "pins every image…" |
| AC2 | Task 4 Steps 3 and 4 |
| AC3 | Task 1 test "fills every variable…", Task 4 Step 3 |
| AC4 | Task 1 test "ships the logo…" |
| AC5 | Task 2 test and Step 8 |
| AC6 | Task 1 Step 6 |
| AC7 | Owner's, Task 4 Step 7 |
| AC8 | Task 2 Steps 4 and 8 |
| AC9 | Task 1 tests "offers every Skrum setting…", "asks for none of the optional settings…"; Task 4 Step 4 |
| AC10 | Task 3 |
