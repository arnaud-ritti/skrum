# Installer env template and unprivileged Docker ports Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: use superpowers:subagent-driven-development to run this plan task by task (through the Workflow tool, as the project does). Steps use checkbox (`- [ ]`) syntax. Read **Global Constraints** and your own task before anything else.

**Status: executed 2026-10-06, then revised.** The four tasks were built and Task 5 was run. The owner then withdrew the port change: the image keeps the default ports of `dunglas/frankenphp` (80, 443, 443/udp) in the container and on the host. Task 2 was reverted whole, except `LOG_LEVEL=warning` in the `Dockerfile`; the port test of `DockerPackagingTest`, the port lines of Tasks 3 and 4 and Review Focus 1, 3, 4 and 5 went with it. The spec is rewritten on that answer; this plan is kept as written, as the record of what was run.

**Goal:** A self-hoster fills three values (`APP_URL`, `APP_KEY`, `DB_PASSWORD`) and starts Skrum; nothing in the production Docker setup uses a port below 1024.

**Architecture:** Reverb credentials fall back to values derived from `APP_KEY` (one small class called from two config files). The image listens on 8000 (HTTP) and 8443 (HTTPS) through Caddy's `http_port` / `https_port`, and the three production Compose files publish those host ports by default. A new short `.env.production.example` replaces `.env.example` as the installer's starting point.

**Tech Stack:** Laravel 13, PHP 8.4, Pest (unit, feature), FrankenPHP + Octane, Caddy, s6-overlay, Docker Compose.

**Spec:** `docs/superpowers/specs/2026-10-06-installer-env-and-ports-design.md`

## Global Constraints

- **Shared checkout.** The working tree holds uncommitted work that belongs to someone else (about 950 screenshots under `tests/visual/`, `.dockerignore`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md`, `.github/ISSUE_TEMPLATE/`, `.github/PULL_REQUEST_TEMPLATE.md`). Never run `git add -A`, `git add .`, `git commit -a`, `git stash`, `git checkout -- <path>`, `git restore`, `git clean`, or any formatter in "fix" mode over the whole tree. Stage only the files your task names, by path. Do not edit `.dockerignore`.
- Branch: stay on `navigation-redesign`. Do not create or switch branches.
- Ports: HTTP `8000`, HTTPS `8443`, Reverb stays `8080` on loopback. No port below 1024 anywhere in the production Docker files.
- `env()` only in `config/*.php`; application code uses `config()`.
- No plan or task identifier in code, tests, comments or commit messages.
- PHP: run `vendor/bin/pint --dirty --format agent` before committing, then check with `git status --short` that pint touched only your own files; if it reformatted a file that is not yours, undo that one file's formatting by hand before staging (do not use `git restore`).
- Tests carry no comments; names are sentences. Run the narrowest test set: `php artisan test --compact <path>`.
- Commit messages follow the repository's form, `type(scope): sentence in the present tense`, and end with the trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- `Caddyfile` is indented with tabs; the Compose files with four spaces and single quotes.

## Review Focus

1. **An existing `.env` with `SERVER_NAME=:80` and an old Compose copy (`80:80`)** must keep serving plain HTTP on 80: the new `http_port 8000` must not turn a `:80` site into something else. Checked on a real container in Task 5.
2. **`REVERB_APP_KEY=` present but empty** (every `.env` copied from the old template) must behave as unset, not as an empty key. Pinned in Task 1's unit test.
3. **`SERVER_NAME=http://:80`** (the prefixed form the healthcheck accepts) must get the same privileged-port warning as `:80`. The shell in Task 2 strips the prefix first; checked in Task 5.
4. **A domain as `SERVER_NAME`**: the healthcheck must call 8443, not 443, or the container is reported unhealthy forever. Pinned by the port test of Task 2 and checked in Task 5.
5. **A renamed line** (say `EXPOSE` split in two, or a Compose port written without the `${...}` form) must not let the port test pass with nothing matched: every pattern must match at least once. Pinned in Task 2's test.

---

### Task 1: Reverb credentials derived from the app key

**Files:**
- Create: `app/Support/ReverbCredentials.php`
- Create: `tests/Unit/Support/ReverbCredentialsTest.php`
- Modify: `config/broadcasting.php:35-37`, `config/reverb.php:76-78`
- Modify: `tests/Feature/Retros/ReverbConfigTest.php`
- Modify: `docker/scripts/prepare:8`, `docker/scripts/prepare:25`

**Interfaces:**
- Produces: `App\Support\ReverbCredentials::resolve(mixed $explicit, string $purpose, mixed $appKey): ?string`. Purposes used: `'id'`, `'key'`, `'secret'`.

- [ ] **Step 1: Create the two files**

```bash
php artisan make:class Support/ReverbCredentials --no-interaction
php artisan make:test --pest --unit Support/ReverbCredentialsTest --no-interaction
```

- [ ] **Step 2: Write the failing unit test**

Replace the content of `tests/Unit/Support/ReverbCredentialsTest.php` with:

```php
<?php

use App\Support\ReverbCredentials;

it('keeps a credential that is set', function () {
    expect(ReverbCredentials::resolve('my-own-key', 'key', 'base64:app-key'))->toBe('my-own-key');
});

it('derives a credential that is missing or empty', function (mixed $explicit) {
    $derived = ReverbCredentials::resolve($explicit, 'key', 'base64:app-key');

    expect($derived)->toBeString()->toHaveLength(32)
        ->and($derived)->toBe(ReverbCredentials::resolve(null, 'key', 'base64:app-key'))
        ->and($derived)->not->toContain('app-key');
})->with([null, '']);

it('derives a different value for each purpose and for each app key', function () {
    $derived = array_map(
        fn (string $purpose): ?string => ReverbCredentials::resolve(null, $purpose, 'base64:app-key'),
        ['id', 'key', 'secret'],
    );

    expect(array_unique($derived))->toHaveCount(3)
        ->and(ReverbCredentials::resolve(null, 'key', 'base64:other-key'))->not->toBe($derived[1]);
});

it('derives nothing without an app key', function (?string $appKey) {
    expect(ReverbCredentials::resolve(null, 'key', $appKey))->toBeNull();
})->with([null, '']);
```

- [ ] **Step 3: Run it, see it fail**

Run: `php artisan test --compact tests/Unit/Support/ReverbCredentialsTest.php`
Expected: FAIL, `Call to undefined method App\Support\ReverbCredentials::resolve()`.

- [ ] **Step 4: Write the class**

`app/Support/ReverbCredentials.php`:

```php
<?php

namespace App\Support;

class ReverbCredentials
{
    /**
     * Reverb and its only client run side by side: a credential nobody set is derived
     * from the app key, under one label per purpose, so none reveals another.
     */
    public static function resolve(mixed $explicit, string $purpose, mixed $appKey): ?string
    {
        if (is_string($explicit) && $explicit !== '') {
            return $explicit;
        }

        if (! is_string($appKey) || $appKey === '') {
            return null;
        }

        return substr(hash_hmac('sha256', "skrum-reverb-{$purpose}", $appKey), 0, 32);
    }
}
```

- [ ] **Step 5: Run it, see it pass**

Run: `php artisan test --compact tests/Unit/Support/ReverbCredentialsTest.php`
Expected: PASS, 6 tests.

- [ ] **Step 6: Write the failing config test**

Append to `tests/Feature/Retros/ReverbConfigTest.php`:

```php

it('gives the Reverb server and the broadcaster the same credentials', function () {
    foreach (['key', 'secret', 'app_id'] as $field) {
        expect(config("reverb.apps.apps.0.{$field}"))
            ->toBeString()
            ->not->toBeEmpty()
            ->toBe(config("broadcasting.connections.reverb.{$field}"));
    }

    expect(config('reverb.apps.apps.0.key'))->not->toBe(config('reverb.apps.apps.0.secret'));
});
```

- [ ] **Step 7: Run it with the three variables blank, see it fail**

A local `.env` may set the three variables, which would hide the failure; blank them for the run.

Run: `REVERB_APP_ID= REVERB_APP_KEY= REVERB_APP_SECRET= php artisan test --compact tests/Feature/Retros/ReverbConfigTest.php`
Expected: FAIL on the new test (the value is `''` or `null`, not a non-empty string).

- [ ] **Step 8: Wire the two config files**

In `config/broadcasting.php`, add `use App\Support\ReverbCredentials;` after `<?php` (with a blank line on each side), and replace lines 35-37:

```php
            'key' => ReverbCredentials::resolve(env('REVERB_APP_KEY'), 'key', env('APP_KEY')),
            'secret' => ReverbCredentials::resolve(env('REVERB_APP_SECRET'), 'secret', env('APP_KEY')),
            'app_id' => ReverbCredentials::resolve(env('REVERB_APP_ID'), 'id', env('APP_KEY')),
```

In `config/reverb.php`, add the same `use` line, and replace lines 76-78:

```php
                'key' => ReverbCredentials::resolve(env('REVERB_APP_KEY'), 'key', env('APP_KEY')),
                'secret' => ReverbCredentials::resolve(env('REVERB_APP_SECRET'), 'secret', env('APP_KEY')),
                'app_id' => ReverbCredentials::resolve(env('REVERB_APP_ID'), 'id', env('APP_KEY')),
```

- [ ] **Step 9: Run it, see it pass; run the neighbours**

Run: `REVERB_APP_ID= REVERB_APP_KEY= REVERB_APP_SECRET= php artisan test --compact tests/Feature/Retros/ReverbConfigTest.php`
Expected: PASS, 2 tests.

Run: `php artisan test --compact tests/Feature/ReverbClientConfigTest.php tests/Feature/Support/InstanceStatusTest.php tests/Arch`
Expected: PASS.

- [ ] **Step 10: Stop requiring the three variables at container start**

`docker/scripts/prepare` line 8 becomes:

```sh
required="APP_KEY DB_CONNECTION"
```

and line 25 becomes:

```sh
    echo "skrum: missing required environment variables:$missing (see .env.production.example)" >&2
```

- [ ] **Step 11: Format and commit**

```bash
vendor/bin/pint --dirty --format agent
git status --short | grep -v 'tests/visual/'
git add app/Support/ReverbCredentials.php tests/Unit/Support/ReverbCredentialsTest.php tests/Feature/Retros/ReverbConfigTest.php config/broadcasting.php config/reverb.php docker/scripts/prepare
git commit -m "feat(realtime): Reverb credentials nobody set are derived from the app key

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: The image and the Compose files leave ports 80 and 443

**Files:**
- Create: `tests/Feature/DockerPackagingTest.php`
- Modify: `docker/Caddyfile:1-2`, `docker/Caddyfile:13`
- Modify: `docker/s6-rc.d/octane/run:6`
- Modify: `Dockerfile:66-70`, `Dockerfile:85`
- Modify: `docker/healthcheck`
- Modify: `compose.production.yaml:24-26`, `compose.production.mariadb.yaml:24-26`, `compose.production.sqlite.yaml:23-25`
- Modify: `docker/scripts/prepare` (after the `LOG_CHANNEL` warning)

**Interfaces:**
- Produces: `tests/Feature/DockerPackagingTest.php`, which Task 3 extends.

- [ ] **Step 1: Create the test file**

```bash
php artisan make:test --pest DockerPackagingTest --no-interaction
```

- [ ] **Step 2: Write the failing test**

Replace the content of `tests/Feature/DockerPackagingTest.php` with:

```php
<?php

it('keeps every port of the production Docker setup out of the privileged range', function (string $file, string $pattern) {
    preg_match_all($pattern, (string) file_get_contents(base_path($file)), $matches);

    $captured = implode(' ', array_merge(...array_slice($matches, 1)));
    preg_match_all('/\d+/', $captured, $ports);

    expect($ports[0])->not->toBeEmpty();

    foreach ($ports[0] as $port) {
        expect((int) $port)->toBeGreaterThanOrEqual(1024);
    }
})->with([
    'the ports the image exposes' => ['Dockerfile', '/^EXPOSE (.+)$/m'],
    'the address the image serves by default' => ['Dockerfile', '/SERVER_NAME=:(\d+)/'],
    'the ports Caddy binds' => ['docker/Caddyfile', '/^\s*https?_port (\d+)$/m'],
    'the address Caddy serves by default' => ['docker/Caddyfile', '/\{\$SERVER_NAME::(\d+)\}/'],
    'the port Octane is started on' => ['docker/s6-rc.d/octane/run', '/--port=(\d+)/'],
    'the address the healthcheck calls by default' => ['docker/healthcheck', '/SERVER_NAME:-:(\d+)\}/'],
    'the port the healthcheck calls for a domain' => ['docker/healthcheck', '/\}:(\d+)\/up/'],
    'the ports published with PostgreSQL' => ['compose.production.yaml', '/_PORT:-(\d+)\}:(\d+)/'],
    'the ports published with MariaDB' => ['compose.production.mariadb.yaml', '/_PORT:-(\d+)\}:(\d+)/'],
    'the ports published with SQLite' => ['compose.production.sqlite.yaml', '/_PORT:-(\d+)\}:(\d+)/'],
]);
```

- [ ] **Step 3: Run it, see it fail**

Run: `php artisan test --compact tests/Feature/DockerPackagingTest.php`
Expected: FAIL on the ten cases (ports 80 and 443 are below 1024; the two `Caddy binds` and `healthcheck calls for a domain` cases fail on the empty match).

- [ ] **Step 4: Caddy**

`docker/Caddyfile`, the global options block opens with the two ports (tabs for indentation):

```
{
	http_port 8000
	https_port 8443

	admin {$CADDY_SERVER_ADMIN_HOST}:{$CADDY_SERVER_ADMIN_PORT}
```

and the site address (line 13 before the change) becomes:

```
{$SERVER_NAME::8000} {
```

- [ ] **Step 5: Octane**

`docker/s6-rc.d/octane/run` line 6:

```sh
    --port=8000 \
```

- [ ] **Step 6: The image**

`Dockerfile`, the `ENV` block:

```dockerfile
ENV APP_ENV=production \
    SKRUM_VERSION=${SKRUM_VERSION} \
    APP_DEBUG=false \
    LOG_CHANNEL=stderr \
    LOG_LEVEL=warning \
    SERVER_NAME=:8000 \
    S6_BEHAVIOUR_IF_STAGE2_FAILS=2 \
    S6_CMD_WAIT_FOR_SERVICES_MAXTIME=0 \
    S6_KILL_GRACETIME=10000
```

and the `EXPOSE` line:

```dockerfile
EXPOSE 8000 8443 8443/udp
```

- [ ] **Step 7: The healthcheck**

`docker/healthcheck`, whole file:

```sh
#!/bin/sh
server_name="${SERVER_NAME:-:8000}"
server_name="${server_name#http://}"
server_name="${server_name#https://}"

case "$server_name" in
    :*)
        exec curl -fsS -o /dev/null "http://127.0.0.1${server_name}/up"
        ;;
    *)
        exec curl -fsSk -o /dev/null --resolve "${server_name}:8443:127.0.0.1" "https://${server_name}:8443/up"
        ;;
esac
```

- [ ] **Step 8: The three Compose files**

In `compose.production.yaml`, `compose.production.mariadb.yaml` and `compose.production.sqlite.yaml`, the `ports:` entries of the `app` service become:

```yaml
        ports:
            - '${SKRUM_HTTP_PORT:-8000}:8000'
            - '${SKRUM_HTTPS_PORT:-8443}:8443'
            - '${SKRUM_HTTPS_PORT:-8443}:8443/udp'
```

- [ ] **Step 9: Warn an install that still names a privileged port**

In `docker/scripts/prepare`, after the `LOG_CHANNEL` warning block (the `fi` that precedes `s6-setuidgid www-data php artisan optimize`), insert:

```sh

server_port="${SERVER_NAME:-}"
server_port="${server_port#http://}"

case "$server_port" in
    :[0-9]*)
        if [ "${server_port#:}" -lt 1024 ] 2>/dev/null; then
            echo "skrum: warning: SERVER_NAME is '${SERVER_NAME}', a privileged port; the image serves :8000 by default and the Compose files publish 8000 and 8443. Remove SERVER_NAME (or set SERVER_NAME=:8000) and fetch the current Compose file." >&2
        fi
        ;;
esac
```

- [ ] **Step 10: Run the test, see it pass; check the shell**

Run: `php artisan test --compact tests/Feature/DockerPackagingTest.php`
Expected: PASS, 10 tests.

Run: `sh -n docker/scripts/prepare && sh -n docker/healthcheck && echo ok`
Expected: `ok`.

Run: `for name in :80 http://:80 :8000 skrum.example.com ''; do SERVER_NAME="$name" sh -c 'server_port="${SERVER_NAME:-}"; server_port="${server_port#http://}"; case "$server_port" in :[0-9]*) if [ "${server_port#:}" -lt 1024 ] 2>/dev/null; then echo "warn $SERVER_NAME"; fi ;; esac'; done`
Expected: exactly two lines, `warn :80` and `warn http://:80`.

- [ ] **Step 11: Commit**

```bash
vendor/bin/pint --dirty --format agent
git add tests/Feature/DockerPackagingTest.php docker/Caddyfile docker/s6-rc.d/octane/run Dockerfile docker/healthcheck docker/scripts/prepare compose.production.yaml compose.production.mariadb.yaml compose.production.sqlite.yaml
git commit -m "feat(docker): the image serves 8000 and 8443, no privileged port

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: The installer's env template

**Files:**
- Create: `.env.production.example`
- Modify: `tests/Feature/DockerPackagingTest.php`
- Modify: `.env.example:220`, `.env.example:250-256`

**Interfaces:**
- Consumes: `tests/Feature/DockerPackagingTest.php` from Task 2.

- [ ] **Step 1: Write the failing tests**

Append to `tests/Feature/DockerPackagingTest.php`:

```php

it('asks the installer for three values only', function () {
    preg_match_all('/^([A-Z][A-Z0-9_]*)=/m', (string) file_get_contents(base_path('.env.production.example')), $matches);

    expect($matches[1])->toBe(['APP_URL', 'APP_KEY', 'DB_PASSWORD']);
});

it('lists in the production template only variables the image reads', function () {
    preg_match_all('/^#? ?([A-Z][A-Z0-9_]*)=/m', (string) file_get_contents(base_path('.env.production.example')), $matches);

    $readers = collect([
        ...glob(base_path('config/*.php')),
        ...glob(base_path('compose.production*.yaml')),
        base_path('Dockerfile'),
        base_path('docker/Caddyfile'),
        base_path('docker/healthcheck'),
        base_path('docker/scripts/prepare'),
    ])->map(fn (string $path): string => (string) file_get_contents($path))->implode("\n");

    expect($matches[1])->not->toBeEmpty();

    foreach (array_unique($matches[1]) as $key) {
        expect($readers)->toContain($key);
    }
});
```

- [ ] **Step 2: Run them, see them fail**

Run: `php artisan test --compact tests/Feature/DockerPackagingTest.php`
Expected: the two new tests FAIL (`.env.production.example` does not exist: the list of keys is empty).

- [ ] **Step 3: Write the template**

Create `.env.production.example`:

```dotenv
# Skrum, production settings for the Docker image. See README.md, "Run with Docker".
# Save this file as .env beside the Compose file and fill the three values below.

# Public address of the instance, as typed in the browser.
APP_URL=https://skrum.example.com
# Print one with:
# docker run --rm --entrypoint php ghcr.io/arnaud-ritti/skrum:latest artisan key:generate --show
APP_KEY=
# Password of the database (not read with compose.production.sqlite.yaml).
DB_PASSWORD=

# --- Everything below is optional; each line shows its default. ---

# Address the built-in Caddy serves. ":8000" is plain HTTP, for a TLS-terminating
# reverse proxy in front; then also name the proxy ("*" or a list of its IPs).
# SERVER_NAME=:8000
# TRUSTED_PROXIES=
# Host ports the container is published on.
# SKRUM_HTTP_PORT=8000
# SKRUM_HTTPS_PORT=8443
#
# Automatic HTTPS without a proxy: uncomment these three lines instead.
# Ports 80 and 443 of the host must be reachable from the internet.
# SERVER_NAME=skrum.example.com
# SKRUM_HTTP_PORT=80
# SKRUM_HTTPS_PORT=443

# Pin a version instead of following "latest".
# SKRUM_IMAGE=ghcr.io/arnaud-ritti/skrum:1.0

# Name shown in the interface and the mails (also editable in Administration).
# APP_NAME=Skrum
# Decides the day an action item becomes overdue. Set before first use.
# APP_TIMEZONE=UTC
# en, fr, es or de.
# APP_LOCALE=en
# Who may create an account: invite or open.
# SKRUM_SIGNUP_MODE=invite

# Outgoing mail goes to the log until this is set (also editable in Administration).
# MAIL_MAILER=smtp
# MAIL_HOST=
# MAIL_PORT=587
# MAIL_USERNAME=
# MAIL_PASSWORD=
# MAIL_FROM_ADDRESS=

# Other variables: README.md, "Configuration". Single sign-on, SMTP and the
# integrations can be set in Administration instead of here.
```

Before keeping the two lines `# en, fr, es or de.` and `# Who may create an account: invite or open.`, check them against the code and correct the comment if the code says otherwise:

Run: `ls lang && grep -rn "signup_mode" config/skrum.php app/Support app/Enums | head -8`
Expected: the locale folders and the accepted signup modes. Write what you find.

- [ ] **Step 4: Point the development template at it**

`.env.example` line 220 becomes:

```dotenv
# Optional: left empty, the three values are derived from APP_KEY. Set them to pin your own.
```

`.env.example` lines 250-256 become:

```dotenv
# --- Production (Docker image, see README) ---
# A production install starts from .env.production.example, not from this file.
# The container refuses to start with APP_DEBUG=true unless SKRUM_ALLOW_DEBUG=true.
# SERVER_NAME: ":8000" serves plain HTTP, e.g. behind a TLS-terminating reverse proxy;
# a public domain (e.g. skrum.example.com) turns on automatic HTTPS, see README.
SERVER_NAME=:8000
```

- [ ] **Step 5: Run the tests, see them pass**

Run: `php artisan test --compact tests/Feature/DockerPackagingTest.php tests/Feature/Mcp/McpPackagingTest.php`
Expected: PASS (12 tests in the first file, 4 in the second).

Run: `git check-ignore -v .env.production.example || echo 'not ignored'`
Expected: `not ignored`.

- [ ] **Step 6: Commit**

```bash
vendor/bin/pint --dirty --format agent
git add .env.production.example .env.example tests/Feature/DockerPackagingTest.php
git commit -m "feat(install): a production env template that asks for three values

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: The documentation follows

**Files:**
- Modify: `README.md` (Run with Docker, Upgrading, SERVER_NAME, Configuration)
- Modify: `docs/database.md` (Installing, first sentence)

No test: copy only. `McpPackagingTest` reads `README.md`; run it at the end.

- [ ] **Step 1: README, "Run with Docker"**

Replace everything from the first ```` ```bash ```` block of the section down to, and including, the `REVERB_CLIENT_SCHEME=` code block (the paragraph "Compose reads `.env` from the project directory twice…" stays, moved as shown) with:

````markdown
```bash
curl -O https://raw.githubusercontent.com/arnaud-ritti/skrum/main/compose.production.yaml
curl -o .env https://raw.githubusercontent.com/arnaud-ritti/skrum/main/.env.production.example
docker run --rm --entrypoint php ghcr.io/arnaud-ritti/skrum:latest artisan key:generate --show
```

The last command prints the value for `APP_KEY`. Fill the three values at the top of `.env`:

- `APP_URL`: the public address of the instance, as typed in the browser;
- `APP_KEY`: the value just printed;
- `DB_PASSWORD`: a strong password for the database.

Everything else has a working default. The same file lists, commented, what an install most often changes: the address Caddy serves, the host ports, the image version (`SKRUM_IMAGE`), the instance name and time zone, and outgoing mail, which goes to the log until the `MAIL_*` variables are set.
````

Keep the existing paragraph "Compose reads `.env` from the project directory twice: …" unchanged right after it. After the `docker compose -f compose.production.yaml up -d` block, add:

```markdown
Skrum answers on `http://<host>:8000`: plain HTTP on an unprivileged port, meant for a TLS-terminating reverse proxy in front (set `TRUSTED_PROXIES`). To let the built-in Caddy obtain certificates itself, see [SERVER_NAME](#server_name).
```

- [ ] **Step 2: README, "Upgrading"**

Insert this paragraph before the one that begins "Upgrading to the release with account photos, active sessions and linked accounts:":

```markdown
Upgrading to the release that leaves ports 80 and 443: the container now listens on 8000 (HTTP) and 8443 (HTTPS), and the Compose files publish those two host ports by default. Fetch the Compose file again, then:

- behind a reverse proxy: remove `SERVER_NAME=:80` from `.env` (or set `SERVER_NAME=:8000`) and point the proxy at port 8000, or keep the old host port with `SKRUM_HTTP_PORT=80`;
- with a domain as `SERVER_NAME`: add `SKRUM_HTTP_PORT=80` and `SKRUM_HTTPS_PORT=443`.

An install that keeps `SERVER_NAME=:80` with its old copy of the Compose file goes on working and logs a warning at start. `REVERB_APP_ID`, `REVERB_APP_KEY` and `REVERB_APP_SECRET` are now optional; values already set are kept.
```

- [ ] **Step 3: README, "SERVER_NAME"**

Replace the two list items and the sentence "Several addresses, or a domain with an explicit port, are not supported by the container healthcheck." with:

```markdown
- `:PORT` for plain HTTP, `:8000` by default, behind a TLS-terminating reverse proxy (`http://:8000` is also accepted). Also set `TRUSTED_PROXIES` so generated URLs and cookies use `https`;
- a bare domain such as `skrum.example.com`: Caddy obtains and renews a certificate automatically (a `https://` prefix is also accepted). Ports 80 and 443 of the host must be reachable from the internet and published: set `SKRUM_HTTP_PORT=80` and `SKRUM_HTTPS_PORT=443` beside it.

The container itself never listens below port 1024: inside, Caddy serves HTTP on 8000 and HTTPS on 8443, whatever the host publishes. Several addresses, or a domain with an explicit port, are not supported by the container healthcheck.
```

In the last paragraph of the section, replace the two sentences that begin "Host ports are set with `SKRUM_HTTP_PORT`" and "Changing them away from 443 and 80" with:

```markdown
Host ports are set with `SKRUM_HTTP_PORT` (default `8000`) and `SKRUM_HTTPS_PORT` (default `8443`). Automatic HTTPS certificate issuance needs them at `80` and `443`.
```

- [ ] **Step 4: README, "Configuration"**

Replace "All configuration is read from the environment. `.env.example` documents every variable." with:

```markdown
All configuration is read from the environment. `.env.production.example` holds what an install needs; `.env.example`, the development template, comments most of the other variables.
```

In the table, the `REVERB_APP_ID`, `REVERB_APP_KEY`, `REVERB_APP_SECRET` row's purpose becomes `Reverb credentials. Optional: derived from `APP_KEY` when empty.` and the `REVERB_CLIENT_*` row's purpose becomes `Where browsers connect. Leave unset in production.`. Pad each cell with spaces so the closing `|` stays aligned with the rows around it.

- [ ] **Step 5: `docs/database.md`, "Installing"**

Replace the sentence "`.env.example` has one block per engine; uncomment the one you want. Three Compose files start the image:" with:

```markdown
Three Compose files start the image. Each fixes the engine, its host and its port, so `.env.production.example` asks for `DB_PASSWORD` only (and for nothing with SQLite). For development, `.env.example` has one block per engine; uncomment the one you want.
```

- [ ] **Step 6: Check and commit**

Run: `grep -n -e ':80\b' -e '\b443\b' -e 'REVERB_CLIENT_HOST=' -e 'DB_USERNAME=sail' README.md docs/database.md`
Expected: only the upgrade note, the automatic HTTPS sentences and "ports 80 and 443 of the host"; no instruction to set `:80`, to empty `REVERB_CLIENT_*` or to replace `DB_USERNAME=sail`.

Run: `php artisan test --compact tests/Feature/Mcp/McpPackagingTest.php tests/Feature/LicenceDeclarationTest.php`
Expected: PASS.

Run: `npm run check 2>&1 | grep -e README.md -e 'docs/database.md' || echo 'no report on these two files'`
Expected: `no report on these two files`. If a line of one of them is reported, fix that line by hand; do not run `npm run check:fix`.

```bash
git add README.md docs/database.md
git commit -m "docs(install): three values to fill, ports 8000 and 8443

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: The container, for real

Checks spec criteria 1, 2, 6, 7 and Review Focus 1, 3, 4. Run by the session owner, not delegated: it needs Docker and reads results.

**Files:** none in the repository. Work in a scratch directory outside it.

- [ ] **Step 1: Build**

```bash
docker build -t skrum:ports .
```

- [ ] **Step 2: Three values, stock Compose file**

In a scratch directory, copy `compose.production.yaml`, and write `.env` with `APP_URL=http://localhost:8000`, `APP_KEY=<docker run --rm --entrypoint php skrum:ports artisan key:generate --show>`, `DB_PASSWORD=verify-only`, `SKRUM_IMAGE=skrum:ports`. Then:

```bash
docker compose -p skrum-verify -f compose.production.yaml up -d --no-build
docker compose -p skrum-verify -f compose.production.yaml ps
curl -fsS -o /dev/null -w '%{http_code}\n' http://localhost:8000/up
docker compose -p skrum-verify -f compose.production.yaml exec app sh -c 'netstat -ltn'
docker compose -p skrum-verify -f compose.production.yaml exec app php artisan tinker --execute 'dump(Illuminate\Support\Facades\Broadcast::connection("reverb")->getPusher()->get("/channels"));'
```

Expected: `app` healthy; `200`; no listener below 1024; the Reverb call returns a channel list (a 401 would mean the server and the broadcaster disagree on the derived credentials). Then read the Reverb key from the page's meta tag and open a websocket through Caddy with `curl -i -N -H 'Connection: Upgrade' -H 'Upgrade: websocket' -H 'Sec-WebSocket-Version: 13' -H 'Sec-WebSocket-Key: c2tydW0tdmVyaWZ5LWtleQ==' -H 'Origin: http://localhost:8000' http://localhost:8000/app/<key>`; expected `101 Switching Protocols`.

- [ ] **Step 3: A domain**

Add `SERVER_NAME=localhost` to `.env`, `up -d` again. Expected: `curl -fsSk -o /dev/null -w '%{http_code}\n' https://localhost:8443/up` prints `200`; `ps` shows `app` healthy; listeners are 8000 and 8443.

- [ ] **Step 4: A legacy address**

Set `SERVER_NAME=http://:80`, `up -d` again. Expected: `logs app` shows the privileged-port warning; inside the container `curl -fsS -o /dev/null -w '%{http_code}\n' http://127.0.0.1:80/up` prints `200` (an old Compose copy mapping `80:80` keeps working).

- [ ] **Step 5: Clean up**

```bash
docker compose -p skrum-verify -f compose.production.yaml down -v
```

- [ ] **Step 6: Ask the owner to run the complete suite**

`php artisan test --compact`
