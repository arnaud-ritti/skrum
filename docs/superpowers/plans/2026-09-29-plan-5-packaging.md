# Plan 5 — Packaging (FrankenPHP + Octane + s6) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Skrum as one Docker image (FrankenPHP + Laravel Octane, Reverb, queue worker and scheduler supervised by s6-overlay) that any self-hoster can run with `docker compose -f compose.production.yaml up`, on any host name, behind or without a reverse proxy.

**Architecture:** A multi-stage Dockerfile builds PHP dependencies and frontend assets, then produces a runtime image whose PID 1 is s6-overlay. A `prepare` oneshot caches config and runs migrations; four longruns (Octane/FrankenPHP, Reverb, queue, scheduler) start after it. A custom Caddyfile serves the app through Octane's FrankenPHP worker and reverse-proxies Reverb's `/app/*` and `/apps/*` paths, so web and websocket share one port. The browser learns Reverb's public key and address from a `<meta>` tag rendered at request time, so the same image works on any domain.

**Tech Stack:** Laravel 13 (PHP 8.4), `laravel/octane` (new, FrankenPHP driver), `dunglas/frankenphp:1-php8.4-bookworm`, s6-overlay 3.2.1.0, Laravel Reverb, PostgreSQL 18, GitHub Actions + GHCR, Pest, React 19 + `@laravel/echo-react`.

**Spec:** `docs/superpowers/specs/2026-09-29-retro-board-core-design.md` — §6 Packaging and deployment, AC31–AC33 (updated in this plan's commit: `compose.production.yaml`, runtime Reverb client config, SSR off, `TRUSTED_PROXIES`).

## Global Constraints

- Commands run through Sail: `vendor/bin/sail artisan …`, `vendor/bin/sail composer …`, `vendor/bin/sail bin pint --dirty --format agent`, `vendor/bin/sail bin phpstan analyse` (level 7, must stay at 0 errors). npm runs on the host. Docker commands (`docker build`, `docker compose -f compose.production.yaml …`) run on the host.
- Only new dependency allowed: `laravel/octane` (composer, runtime). No new npm packages.
- Single Docker image based on FrankenPHP (Caddy built in) running Laravel Octane in worker mode. No nginx/PHP-FPM.
- Caddy reverse-proxies Reverb's websocket paths (`/app/*`, `/apps/*`) to Reverb on localhost, so only one port is exposed. Automatic HTTPS applies when `SERVER_NAME` is a public domain.
- s6-overlay supervises four long-running services: Octane, Reverb, queue worker, scheduler. Migrations run as an s6 oneshot at start-up (opt-out via `SKRUM_RUN_MIGRATIONS=false`).
- Image published to GHCR. Production example: `compose.production.yaml` (app + PostgreSQL). `compose.yaml` stays the Sail dev file.
- All configuration is env-driven; `.env.example` documents signup mode, SSO providers, Reverb, mail, avatar style, and the production variables added here.
- Inertia SSR is off in production (`INERTIA_SSR_ENABLED`, default `false`); the runtime image carries no Node.
- Octane constraint: no request-specific state in singletons or static properties.
- Services run as `www-data`, never as root (s6 itself runs as root to set up `/run`).
- Frontend checks: `vendor/bin/sail artisan wayfinder:generate --with-form && npm run types:check && npm run check` (known pre-existing `npm run check` failures only in `.devcontainer/devcontainer.json` and `docs/superpowers/*.md`). Format only touched files with `npx vp fmt <files>` — never `npx prettier` on the repo.
- Use `config()` in code, `env()` only in `config/*.php`.
- Commit messages: Conventional Commits, ending with exactly:
  `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`
  `Claude-Session: https://claude.ai/code/session_01FcMxGGHCZcDTndQCc57VPC`

## Review Focus

1. **Deployed behind a TLS-terminating reverse proxy (Traefik, nginx, Cloudflare Tunnel) with `SERVER_NAME=:80`** → generated URLs are `https://`, secure cookies work, and the browser opens `wss://<same host>/app/…`. Pinned by `TrustedProxiesTest` (Task 2) and the client falling back to `window.location.protocol` (Task 1); exercised in Task 6 Step 7.
2. **Container started without `APP_KEY` or Reverb credentials** → the container stops with a one-line explanation instead of serving 500s or crash-looping silently. Pinned by the `prepare` script checks (Task 4) and Task 6 Step 9.
3. **Container restarted on an existing database** → migrations are idempotent, data survives; `SKRUM_RUN_MIGRATIONS=false` skips them. Exercised in Task 6 Step 8.
4. **Octane worker reuse** → one request's locale, user or participant never leaks into the next request served by the same worker. Pinned by `RequestIsolationTest` (Task 3) plus the static-state audit; exercised in Task 6 Step 6 (two browsers, two languages).
5. **Instance published on a non-default host port (e.g. `:8088`) or on 443** → the websocket connects to the page's own origin and port, not to a build-time `localhost:8080`. Pinned by `ReverbClientConfigTest` (Task 1); exercised in Task 6 Step 6.

---

### Task 1: Runtime Reverb client config and request timeout

The browser currently reads `VITE_REVERB_*` at build time, so a published image would point every deployment at the builder's host. Replace that with a `<meta name="reverb-config">` tag rendered per request. Also give board API requests a timeout (a hung snapshot refetch would otherwise hold buffered realtime events forever — Plan 4 carried minor).

**Files:**
- Create: `app/Support/ReverbClientConfig.php`
- Create: `resources/js/lib/reverb-config.ts`
- Modify: `config/broadcasting.php` (reverb connection)
- Modify: `resources/views/app.blade.php` (head)
- Modify: `resources/js/app.tsx` (configureEcho)
- Modify: `resources/js/lib/retro/api.ts` (request timeout)
- Modify: `.env.example` (replace `VITE_REVERB_*` with `REVERB_CLIENT_*`)
- Test: `tests/Feature/ReverbClientConfigTest.php`

**Interfaces:**
- Produces: `App\Support\ReverbClientConfig::toArray(): array{key: ?string, host: ?string, port: ?int, scheme: ?string}`; meta tag `<meta name="reverb-config" content="{json}">`; TS `echoConnection(): EchoConnection | null` with `EchoConnection = { key: string; wsHost: string; wsPort: number; wssPort: number; forceTLS: boolean }`.
- Env: `REVERB_CLIENT_HOST`, `REVERB_CLIENT_PORT`, `REVERB_CLIENT_SCHEME` (all optional; empty = page origin).

- [ ] **Step 1: Write the failing test**

`tests/Feature/ReverbClientConfigTest.php`:

```php
<?php

use App\Support\ReverbClientConfig;

it('falls back to the page origin when no client address is configured', function () {
    config([
        'broadcasting.connections.reverb.key' => 'public-key',
        'broadcasting.connections.reverb.client' => ['host' => null, 'port' => null, 'scheme' => null],
    ]);

    expect(ReverbClientConfig::toArray())->toBe([
        'key' => 'public-key',
        'host' => null,
        'port' => null,
        'scheme' => null,
    ]);
});

it('uses an explicit client address when configured', function () {
    config([
        'broadcasting.connections.reverb.key' => 'public-key',
        'broadcasting.connections.reverb.client' => ['host' => 'localhost', 'port' => '8080', 'scheme' => 'http'],
    ]);

    expect(ReverbClientConfig::toArray())->toBe([
        'key' => 'public-key',
        'host' => 'localhost',
        'port' => 8080,
        'scheme' => 'http',
    ]);
});

it('renders the client config on pages without leaking the reverb secret', function () {
    config([
        'broadcasting.connections.reverb.key' => 'public-key',
        'broadcasting.connections.reverb.secret' => 'top-secret-value',
    ]);

    $this->get(route('login'))
        ->assertOk()
        ->assertSee('name="reverb-config"', false)
        ->assertSee('public-key')
        ->assertDontSee('top-secret-value');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `vendor/bin/sail artisan test --compact tests/Feature/ReverbClientConfigTest.php`
Expected: FAIL — `Class "App\Support\ReverbClientConfig" not found`.

- [ ] **Step 3: Implement the server side**

`config/broadcasting.php`, inside `'reverb' => [ … ]`, after `'app_id' => …`:

```php
            'client' => [
                'host' => env('REVERB_CLIENT_HOST'),
                'port' => env('REVERB_CLIENT_PORT'),
                'scheme' => env('REVERB_CLIENT_SCHEME'),
            ],
```

`app/Support/ReverbClientConfig.php` (create with `vendor/bin/sail artisan make:class Support/ReverbClientConfig --no-interaction`, then replace the body):

```php
<?php

namespace App\Support;

class ReverbClientConfig
{
    /**
     * @return array{
     *     key: ?string,
     *     host: ?string,
     *     port: ?int,
     *     scheme: ?string
     * }
     */
    public static function toArray(): array
    {
        $key = config('broadcasting.connections.reverb.key');
        $host = config('broadcasting.connections.reverb.client.host');
        $port = config('broadcasting.connections.reverb.client.port');
        $scheme = config('broadcasting.connections.reverb.client.scheme');

        return [
            'key' => is_string($key) && $key !== '' ? $key : null,
            'host' => is_string($host) && $host !== '' ? $host : null,
            'port' => is_numeric($port) ? (int) $port : null,
            'scheme' => is_string($scheme) && $scheme !== '' ? $scheme : null,
        ];
    }
}
```

`resources/views/app.blade.php`, right after the viewport meta tag:

```blade
        <meta name="reverb-config" content="{{ json_encode(\App\Support\ReverbClientConfig::toArray()) }}">
```

- [ ] **Step 4: Run test to verify it passes**

Run: `vendor/bin/sail artisan test --compact tests/Feature/ReverbClientConfigTest.php`
Expected: PASS (3 tests).

- [ ] **Step 5: Implement the client side**

`resources/js/lib/reverb-config.ts`:

```ts
type ReverbClientConfig = {
    key: string | null;
    host: string | null;
    port: number | null;
    scheme: 'http' | 'https' | null;
};

export type EchoConnection = {
    key: string;
    wsHost: string;
    wsPort: number;
    wssPort: number;
    forceTLS: boolean;
};

function readConfig(): ReverbClientConfig | null {
    const content = document
        .querySelector('meta[name="reverb-config"]')
        ?.getAttribute('content');

    if (!content) {
        return null;
    }

    try {
        return JSON.parse(content) as ReverbClientConfig;
    } catch {
        return null;
    }
}

export function echoConnection(): EchoConnection | null {
    const config = readConfig();

    if (!config?.key) {
        return null;
    }

    const scheme = config.scheme ?? window.location.protocol.replace(':', '');
    const secure = scheme === 'https';
    const pagePort = window.location.port
        ? Number(window.location.port)
        : secure
          ? 443
          : 80;
    const port = config.port ?? pagePort;

    return {
        key: config.key,
        wsHost: config.host ?? window.location.hostname,
        wsPort: port,
        wssPort: port,
        forceTLS: secure,
    };
}
```

`resources/js/app.tsx`: import `echoConnection` from `@/lib/reverb-config` and change the Echo block to (keep the existing `channelAuthorization` object exactly as it is):

```tsx
const connection = typeof window !== 'undefined' ? echoConnection() : null;

if (connection) {
    configureEcho({
        broadcaster: 'reverb',
        ...connection,
        enabledTransports: ['ws', 'wss'],
        channelAuthorization: {
            // … unchanged customHandler …
        },
    });
}
```

(`configureEcho` spreads the given options over its `VITE_REVERB_*` defaults, so these runtime values win.)

`resources/js/lib/retro/api.ts`: add a module constant and pass a timeout signal in `retroRequest`:

```ts
const RequestTimeoutMs = 15_000;
```

```ts
        const response = await http.getClient().request({
            method: route.method as 'get',
            url: route.url,
            data,
            headers,
            signal: AbortSignal.timeout(RequestTimeoutMs),
        });
```

- [ ] **Step 6: Update `.env.example`**

Replace the four `VITE_REVERB_*` lines and the comment above `REVERB_HOST` with:

```dotenv
# Server-side connection from Laravel to Reverb (publishing events).
REVERB_HOST=localhost
REVERB_PORT=8080
REVERB_SCHEME=http

# Where browsers connect. Leave empty in production: the browser then uses the
# page's own host and port, which the image's Caddy proxies to Reverb.
# Local Sail development runs Reverb on :8080, so set it explicitly here.
REVERB_CLIENT_HOST=localhost
REVERB_CLIENT_PORT=8080
REVERB_CLIENT_SCHEME=http
```

Also change `APP_URL=http://localhost:8000` to `APP_URL=http://localhost`.

- [ ] **Step 7: Verify**

Run: `vendor/bin/sail artisan wayfinder:generate --with-form && npm run types:check && npm run check` → types clean, only the known lint failures.
Run: `vendor/bin/sail bin pint --dirty --format agent && vendor/bin/sail bin phpstan analyse --no-progress` → clean, 0 errors.
Local dev `.env` needs the three `REVERB_CLIENT_*` lines above (tell the controller in the report; do not edit `.env` yourself — it is not tracked). Manual (best-effort): with `npm run build` and Reverb running, the board still connects (no "Reconnecting…" banner).

- [ ] **Step 8: Commit**

```bash
git add app/Support/ReverbClientConfig.php config/broadcasting.php resources/views/app.blade.php resources/js/lib/reverb-config.ts resources/js/app.tsx resources/js/lib/retro/api.ts .env.example tests/Feature/ReverbClientConfigTest.php
git commit -m "feat: configure the realtime client at runtime instead of build time"
```

---

### Task 2: Production runtime settings — trusted proxies, SSR toggle, Reverb dev port

**Files:**
- Create: `app/Http/Middleware/TrustProxies.php`
- Modify: `bootstrap/app.php` (replace framework TrustProxies)
- Modify: `config/skrum.php` (`trusted_proxies`)
- Modify: `config/inertia.php` (`ssr.enabled`)
- Modify: `app/Providers/AppServiceProvider.php` (Reverb dev command port)
- Modify: `compose.yaml` (Reverb port mapping)
- Test: `tests/Feature/TrustedProxiesTest.php`

**Interfaces:**
- Produces: config `skrum.trusted_proxies` (`?string`, `*` or comma list), env `TRUSTED_PROXIES`; env `INERTIA_SSR_ENABLED` (default `false`).

- [ ] **Step 1: Write the failing test**

`tests/Feature/TrustedProxiesTest.php`:

```php
<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

beforeEach(function () {
    Route::get('/_proxy-check', fn (Request $request) => $request->isSecure() ? 'https' : 'http');
});

it('ignores forwarded headers when no proxy is trusted', function () {
    config(['skrum.trusted_proxies' => null]);

    $this->get('/_proxy-check', ['X-Forwarded-Proto' => 'https'])->assertContent('http');
});

it('honours forwarded https from any proxy when all proxies are trusted', function () {
    config(['skrum.trusted_proxies' => '*']);

    $this->get('/_proxy-check', ['X-Forwarded-Proto' => 'https'])->assertContent('https');
});

it('only honours forwarded headers from listed proxy addresses', function () {
    config(['skrum.trusted_proxies' => '10.0.0.1, 10.0.0.2']);

    $this->get('/_proxy-check', ['X-Forwarded-Proto' => 'https'])->assertContent('http');

    $this->withServerVariables(['REMOTE_ADDR' => '10.0.0.2'])
        ->get('/_proxy-check', ['X-Forwarded-Proto' => 'https'])
        ->assertContent('https');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `vendor/bin/sail artisan test --compact tests/Feature/TrustedProxiesTest.php`
Expected: FAIL — the "all proxies trusted" and "listed proxy" cases return `http`.

- [ ] **Step 3: Implement**

`config/skrum.php`, add:

```php
    'trusted_proxies' => env('TRUSTED_PROXIES'),
```

`app/Http/Middleware/TrustProxies.php`:

```php
<?php

namespace App\Http\Middleware;

use Illuminate\Http\Middleware\TrustProxies as Middleware;

class TrustProxies extends Middleware
{
    /**
     * @return array<int, string>|string|null
     */
    protected function proxies()
    {
        $proxies = config('skrum.trusted_proxies');

        if (! is_string($proxies) || trim($proxies) === '') {
            return null;
        }

        if (trim($proxies) === '*') {
            return '*';
        }

        return array_values(array_filter(array_map('trim', explode(',', $proxies))));
    }
}
```

`bootstrap/app.php`, inside `withMiddleware`, first line:

```php
        $middleware->replace(\Illuminate\Http\Middleware\TrustProxies::class, \App\Http\Middleware\TrustProxies::class);
```

(Import both classes with `use` statements at the top instead of fully qualified names, aliasing the framework one as `FrameworkTrustProxies`.)

`config/inertia.php`: change `'enabled' => true,` under `'ssr'` to:

```php
        'enabled' => (bool) env('INERTIA_SSR_ENABLED', false),
```

`app/Providers/AppServiceProvider.php`: replace the hard-coded dev command with the configured port:

```php
        if ($this->app->environment('local')) {
            $reverbPort = config()->integer('reverb.servers.reverb.port');

            DevCommands::artisan("reverb:start --host=0.0.0.0 --port={$reverbPort}", 'reverb');
        }
```

`compose.yaml` (Sail): change `'${REVERB_PORT:-8080}:8080'` to `'${REVERB_CLIENT_PORT:-8080}:${REVERB_SERVER_PORT:-8080}'`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `vendor/bin/sail artisan test --compact tests/Feature/TrustedProxiesTest.php tests/Feature/LocaleTest.php`
Expected: PASS.

- [ ] **Step 5: Verify and commit**

Run: `vendor/bin/sail bin pint --dirty --format agent && vendor/bin/sail bin phpstan analyse --no-progress` → clean.

```bash
git add app/Http/Middleware/TrustProxies.php bootstrap/app.php config/skrum.php config/inertia.php app/Providers/AppServiceProvider.php compose.yaml tests/Feature/TrustedProxiesTest.php
git commit -m "feat: add trusted proxies and production-safe ssr and reverb settings"
```

---

### Task 3: Laravel Octane (FrankenPHP) and request isolation

**Files:**
- Modify: `composer.json`, `composer.lock` (`laravel/octane`)
- Create: `config/octane.php` (published)
- Modify: `.gitignore`
- Test: `tests/Feature/RequestIsolationTest.php`

**Interfaces:**
- Produces: `php artisan octane:frankenphp …` available; `config('octane.server') === 'frankenphp'`.

- [ ] **Step 1: Write the failing-by-absence test**

`tests/Feature/RequestIsolationTest.php`:

```php
<?php

use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

it('resolves the locale again on every request served by the same application', function () {
    $this->get(route('login'), ['Accept-Language' => 'de'])
        ->assertInertia(fn (Assert $page) => $page->where('locale', 'de'));

    $this->get(route('login'), ['Accept-Language' => 'en-US'])
        ->assertInertia(fn (Assert $page) => $page->where('locale', 'en'));
});

it('does not carry the previous user into the next request', function () {
    $first = User::factory()->create(['locale' => 'fr']);
    $second = User::factory()->create(['locale' => 'es']);

    $this->actingAs($first)
        ->get(route('dashboard'))
        ->assertInertia(fn (Assert $page) => $page
            ->where('auth.user.id', $first->id)
            ->where('locale', 'fr'));

    $this->actingAs($second)
        ->get(route('dashboard'))
        ->assertInertia(fn (Assert $page) => $page
            ->where('auth.user.id', $second->id)
            ->where('locale', 'es'));
});

it('uses octane with the frankenphp server', function () {
    expect(config('octane.server'))->toBe('frankenphp');
});
```

If `route('dashboard')` redirects for a user without a workspace, create one with the existing workspace factory/state the other dashboard tests use (check `tests/Feature/DashboardTest.php`) — keep the assertions the same.

- [ ] **Step 2: Run test to verify it fails**

Run: `vendor/bin/sail artisan test --compact tests/Feature/RequestIsolationTest.php`
Expected: the first two tests PASS (they pin current behaviour), `uses octane with the frankenphp server` FAILS (`null`).

- [ ] **Step 3: Install and configure Octane**

```bash
vendor/bin/sail composer require laravel/octane --no-interaction
vendor/bin/sail artisan vendor:publish --tag=octane-config --no-interaction
```

In `config/octane.php` set the default server:

```php
    'server' => env('OCTANE_SERVER', 'frankenphp'),
```

Do **not** run `octane:install` (it downloads a FrankenPHP binary into the project; the Docker image provides it). Add to `.gitignore`:

```gitignore
/frankenphp
/public/frankenphp-worker.php
```

- [ ] **Step 4: Audit request state (Octane constraint)**

Run: `grep -rnE 'static \$|static ::\$|->singleton\(|->instance\(' app bootstrap`
Expected: no matches that hold request, user, participant, workspace or locale data. If any appear, report them as DONE_WITH_CONCERNS with the file:line — do not refactor them in this task.

- [ ] **Step 5: Run tests to verify they pass**

Run: `vendor/bin/sail artisan test --compact tests/Feature/RequestIsolationTest.php`
Expected: PASS (3 tests). Then the full suite once: `vendor/bin/sail artisan test --compact` → all pass (AC33).

- [ ] **Step 6: Verify and commit**

Run: `vendor/bin/sail bin pint --dirty --format agent && vendor/bin/sail bin phpstan analyse --no-progress` → clean.

```bash
git add composer.json composer.lock config/octane.php .gitignore tests/Feature/RequestIsolationTest.php
git commit -m "feat: run the app on laravel octane with frankenphp"
```

---

### Task 4: Docker image — Dockerfile, Caddyfile, s6 services

**Files:**
- Create: `Dockerfile`
- Create: `.dockerignore`
- Create: `docker/Caddyfile`
- Create: `docker/healthcheck`
- Create: `docker/scripts/prepare`
- Create: `docker/s6-rc.d/prepare/type`, `docker/s6-rc.d/prepare/up`
- Create: `docker/s6-rc.d/{octane,reverb,queue,scheduler}/type`, `…/run`, `…/dependencies.d/prepare`
- Create: `docker/s6-rc.d/user/contents.d/{prepare,octane,reverb,queue,scheduler}`

**Interfaces:**
- Consumes: Task 1 meta tag + `REVERB_CLIENT_*`; Task 2 `TRUSTED_PROXIES`, `INERTIA_SSR_ENABLED`; Task 3 `octane:frankenphp`.
- Produces: image entrypoint `/init`; env contract `SERVER_NAME` (default `:80`), `SKRUM_RUN_MIGRATIONS` (default `true`), `OCTANE_WORKERS` (default `auto`), `OCTANE_MAX_REQUESTS` (default `500`), `REVERB_SERVER_PORT` (default `8080`); volumes `/data`, `/config` (Caddy certificates/state).

- [ ] **Step 1: `.dockerignore`**

```gitignore
.git
.github
.devcontainer
.idea
.vscode
.env
.env.*
!.env.example
node_modules
vendor
public/build
public/hot
public/frankenphp-worker.php
bootstrap/cache/*.php
bootstrap/ssr
storage/logs/*
storage/framework/cache/data/*
storage/framework/sessions/*
storage/framework/views/*
storage/pail
tests
docs
.superpowers
frankenphp
compose.yaml
compose.production.yaml
```

- [ ] **Step 2: `Dockerfile`**

```dockerfile
# syntax=docker/dockerfile:1

ARG PHP_VERSION=8.4
ARG NODE_VERSION=22

FROM node:${NODE_VERSION}-bookworm-slim AS node

FROM dunglas/frankenphp:1-php${PHP_VERSION}-bookworm AS base

ARG S6_OVERLAY_VERSION=3.2.1.0
ARG TARGETARCH

RUN apt-get update \
    && apt-get install -y --no-install-recommends curl libcap2-bin xz-utils \
    && rm -rf /var/lib/apt/lists/*

RUN install-php-extensions bcmath intl opcache pcntl pdo_pgsql zip \
    && cp "$PHP_INI_DIR/php.ini-production" "$PHP_INI_DIR/php.ini"

RUN case "${TARGETARCH}" in \
        amd64) s6_arch=x86_64 ;; \
        arm64) s6_arch=aarch64 ;; \
        *) echo "Unsupported architecture: ${TARGETARCH}" >&2; exit 1 ;; \
    esac \
    && curl -fsSL "https://github.com/just-containers/s6-overlay/releases/download/v${S6_OVERLAY_VERSION}/s6-overlay-noarch.tar.xz" | tar -C / -Jxp \
    && curl -fsSL "https://github.com/just-containers/s6-overlay/releases/download/v${S6_OVERLAY_VERSION}/s6-overlay-${s6_arch}.tar.xz" | tar -C / -Jxp

COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

WORKDIR /app

FROM base AS build

COPY --from=node /usr/local/bin/node /usr/local/bin/node
COPY --from=node /usr/local/lib/node_modules /usr/local/lib/node_modules
RUN ln -s ../lib/node_modules/npm/bin/npm-cli.js /usr/local/bin/npm

COPY composer.json composer.lock ./
RUN composer install --no-dev --no-interaction --no-scripts --no-autoloader --prefer-dist

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN composer dump-autoload --no-dev --optimize --classmap-authoritative \
    && npm run build \
    && cp vendor/laravel/octane/src/Commands/stubs/frankenphp-worker.php public/frankenphp-worker.php \
    && rm -rf node_modules resources/js/actions resources/js/routes resources/js/wayfinder

FROM base AS runtime

ENV APP_ENV=production \
    APP_DEBUG=false \
    LOG_CHANNEL=stderr \
    SERVER_NAME=:80 \
    S6_BEHAVIOUR_IF_STAGE2_FAILS=2 \
    S6_CMD_WAIT_FOR_SERVICES_MAXTIME=0 \
    S6_KILL_GRACETIME=10000

COPY --from=build --chown=www-data:www-data /app /app
COPY docker/s6-rc.d /etc/s6-overlay/s6-rc.d
COPY docker/scripts /etc/s6-overlay/scripts
COPY docker/healthcheck /usr/local/bin/skrum-healthcheck

RUN chmod +x /etc/s6-overlay/scripts/* /etc/s6-overlay/s6-rc.d/*/run /usr/local/bin/skrum-healthcheck \
    && setcap CAP_NET_BIND_SERVICE=+eip /usr/local/bin/frankenphp \
    && mkdir -p /data/caddy /config/caddy \
    && chown -R www-data:www-data /data /config

EXPOSE 80 443 443/udp
VOLUME ["/data", "/config"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=90s --retries=3 CMD ["skrum-healthcheck"]

ENTRYPOINT ["/init"]
CMD []
```

- [ ] **Step 3: `docker/Caddyfile`**

Extends Octane's FrankenPHP stub (`vendor/laravel/octane/src/Commands/stubs/Caddyfile`): the site address comes from `SERVER_NAME` (automatic HTTPS for a public domain, `:80` behind a proxy) and Reverb is proxied before PHP handles the request.

```caddyfile
{
	admin {$CADDY_SERVER_ADMIN_HOST}:{$CADDY_SERVER_ADMIN_PORT}

	frankenphp {
		worker {
			file "{$APP_PUBLIC_PATH}/frankenphp-worker.php"
			{$CADDY_SERVER_WORKER_DIRECTIVE}
			{$CADDY_SERVER_WATCH_DIRECTIVES}
		}
	}
}

{$SERVER_NAME::80} {
	log {
		level {$CADDY_SERVER_LOG_LEVEL}

		format filter {
			wrap {$CADDY_SERVER_LOGGER}
			fields {
				request>uri query {
					replace authorization REDACTED
				}
			}
		}
	}

	route {
		@reverb path /app/* /apps/*
		reverse_proxy @reverb 127.0.0.1:{$REVERB_SERVER_PORT:8080}

		root * "{$APP_PUBLIC_PATH}"
		encode zstd br gzip

		php_server {
			index frankenphp-worker.php
			try_files {path} frankenphp-worker.php
			resolve_root_symlink
		}
	}
}
```

- [ ] **Step 4: s6 services**

`docker/scripts/prepare`:

```sh
#!/command/with-contenv sh
set -e

cd /app

missing=""

for variable in APP_KEY REVERB_APP_ID REVERB_APP_KEY REVERB_APP_SECRET DB_PASSWORD; do
    eval "value=\${$variable:-}"

    if [ -z "$value" ]; then
        missing="$missing $variable"
    fi
done

if [ -n "$missing" ]; then
    echo "skrum: missing required environment variables:$missing (see .env.example)" >&2
    exit 1
fi

s6-setuidgid www-data php artisan optimize

if [ "${SKRUM_RUN_MIGRATIONS:-true}" = "true" ]; then
    s6-setuidgid www-data php artisan migrate --force
else
    echo "skrum: SKRUM_RUN_MIGRATIONS is not true, skipping migrations"
fi
```

`docker/s6-rc.d/prepare/type`:

```
oneshot
```

`docker/s6-rc.d/prepare/up` (execline, one line):

```
/etc/s6-overlay/scripts/prepare
```

`docker/s6-rc.d/octane/type`, `reverb/type`, `queue/type`, `scheduler/type`: each contains

```
longrun
```

`docker/s6-rc.d/octane/run`:

```sh
#!/command/with-contenv sh
cd /app

exec s6-setuidgid www-data php artisan octane:frankenphp \
    --host=0.0.0.0 \
    --port=80 \
    --admin-port=2019 \
    --caddyfile=/app/docker/Caddyfile \
    --workers="${OCTANE_WORKERS:-auto}" \
    --max-requests="${OCTANE_MAX_REQUESTS:-500}"
```

`docker/s6-rc.d/reverb/run`:

```sh
#!/command/with-contenv sh
cd /app

exec s6-setuidgid www-data php artisan reverb:start --host=127.0.0.1 --port="${REVERB_SERVER_PORT:-8080}"
```

`docker/s6-rc.d/queue/run`:

```sh
#!/command/with-contenv sh
cd /app

exec s6-setuidgid www-data php artisan queue:work --sleep=1 --tries=3 --max-time=3600
```

`docker/s6-rc.d/scheduler/run`:

```sh
#!/command/with-contenv sh
cd /app

exec s6-setuidgid www-data php artisan schedule:work
```

Empty files (dependency markers and bundle membership):
`docker/s6-rc.d/{octane,reverb,queue,scheduler}/dependencies.d/prepare` and `docker/s6-rc.d/user/contents.d/{prepare,octane,reverb,queue,scheduler}`.

Make the scripts executable in git: `chmod +x docker/scripts/prepare docker/s6-rc.d/*/run docker/healthcheck`.

- [ ] **Step 5: `docker/healthcheck`**

```sh
#!/bin/sh
server_name="${SERVER_NAME:-:80}"

case "$server_name" in
    :*)
        exec curl -fsS -o /dev/null "http://127.0.0.1${server_name}/up"
        ;;
    *)
        exec curl -fsSk -o /dev/null --resolve "${server_name}:443:127.0.0.1" "https://${server_name}/up"
        ;;
esac
```

- [ ] **Step 6: Build**

Run: `docker build -t skrum:latest .`
Expected: build succeeds; `docker run --rm --entrypoint php skrum:latest artisan --version` prints `Laravel Framework 13.…`; `docker run --rm --entrypoint sh skrum:latest -c 'ls /app/public/build/manifest.json /app/public/frankenphp-worker.php && getcap /usr/local/bin/frankenphp'` lists both files and `cap_net_bind_service=eip`.

- [ ] **Step 7: Missing-configuration check (Review Focus 2)**

Run: `docker run --rm skrum:latest`
Expected: the container exits within seconds with `skrum: missing required environment variables: APP_KEY REVERB_APP_ID REVERB_APP_KEY REVERB_APP_SECRET DB_PASSWORD` and a non-zero status.

- [ ] **Step 8: Commit**

```bash
git add Dockerfile .dockerignore docker
git commit -m "feat: build a frankenphp octane image supervised by s6"
```

---

### Task 5: Production compose, environment docs, README and GHCR workflow

**Files:**
- Create: `compose.production.yaml`
- Create: `README.md`
- Create: `.github/workflows/docker-image.yml`
- Modify: `.env.example` (production section)

**Interfaces:**
- Consumes: Task 4 image and env contract.
- Produces: `SKRUM_IMAGE` (default `skrum:latest`, built locally when absent), `SKRUM_ENV_FILE` (default `.env`), `SKRUM_HTTP_PORT` (default `80`), `SKRUM_HTTPS_PORT` (default `443`).

- [ ] **Step 1: `compose.production.yaml`**

```yaml
services:
    app:
        image: '${SKRUM_IMAGE:-skrum:latest}'
        build: .
        restart: unless-stopped
        env_file: '${SKRUM_ENV_FILE:-.env}'
        environment:
            APP_ENV: production
            APP_DEBUG: 'false'
            LOG_CHANNEL: stderr
            DB_CONNECTION: pgsql
            DB_HOST: pgsql
            DB_PORT: '5432'
            BROADCAST_CONNECTION: reverb
            REVERB_HOST: 127.0.0.1
            REVERB_PORT: '8080'
            REVERB_SCHEME: http
            REVERB_SERVER_HOST: 127.0.0.1
            REVERB_SERVER_PORT: '8080'
        ports:
            - '${SKRUM_HTTP_PORT:-80}:80'
            - '${SKRUM_HTTPS_PORT:-443}:443'
            - '${SKRUM_HTTPS_PORT:-443}:443/udp'
        volumes:
            - 'caddy-data:/data'
            - 'caddy-config:/config'
        depends_on:
            pgsql:
                condition: service_healthy
    pgsql:
        image: 'postgres:18-alpine'
        restart: unless-stopped
        environment:
            POSTGRES_DB: '${DB_DATABASE:-skrum}'
            POSTGRES_USER: '${DB_USERNAME:-skrum}'
            POSTGRES_PASSWORD: '${DB_PASSWORD:?Set DB_PASSWORD in your env file}'
        volumes:
            - 'pgsql-data:/var/lib/postgresql'
        healthcheck:
            test: ['CMD-SHELL', 'pg_isready -q -d "$${POSTGRES_DB}" -U "$${POSTGRES_USER}"']
            interval: 5s
            timeout: 5s
            retries: 10
volumes:
    caddy-data:
    caddy-config:
    pgsql-data:
```

Run: `docker compose -f compose.production.yaml config --quiet` with a throwaway env (`DB_PASSWORD=x docker compose -f compose.production.yaml config --quiet`) → exits 0.

- [ ] **Step 2: `.env.example` production section**

Append:

```dotenv
# --- Production (Docker image, see README) ---
# SERVER_NAME: a public domain (e.g. skrum.example.com) turns on automatic HTTPS;
# ":80" serves plain HTTP, e.g. behind a TLS-terminating reverse proxy.
SERVER_NAME=:80
# Set when a reverse proxy sits in front of Skrum: "*" or a comma-separated list of proxy IPs.
TRUSTED_PROXIES=
# Run database migrations when the container starts.
SKRUM_RUN_MIGRATIONS=true
# Octane worker count (auto = number of CPUs) and requests per worker before recycling.
OCTANE_WORKERS=auto
OCTANE_MAX_REQUESTS=500
# Inertia server-side rendering is not shipped in the image; keep false.
INERTIA_SSR_ENABLED=false
```

- [ ] **Step 3: `README.md`**

Write a README with these sections (plain, accurate, no marketing):

1. **Skrum** — one paragraph: open-source, self-hostable realtime retrospective board; multi-tenant (workspaces → teams → retros); guests via link; en/fr/es/de.
2. **Run with Docker** — steps:
   ```bash
   curl -O https://raw.githubusercontent.com/<owner>/skrum/main/compose.production.yaml
   curl -o .env https://raw.githubusercontent.com/<owner>/skrum/main/.env.example
   docker run --rm --entrypoint php ghcr.io/<owner>/skrum:latest artisan key:generate --show   # → APP_KEY
   # set APP_URL, SERVER_NAME, DB_PASSWORD, REVERB_APP_ID/KEY/SECRET (random strings), clear REVERB_CLIENT_* and set SKRUM_IMAGE=ghcr.io/<owner>/skrum:latest in .env
   docker compose -f compose.production.yaml up -d
   ```
   The first account to sign up becomes the instance admin. Explain `SERVER_NAME` (domain → automatic HTTPS with certificates stored in the `caddy-data` volume; `:80` behind a proxy + `TRUSTED_PROXIES`), and that web and websocket share one port.
3. **Configuration** — a table of: `APP_URL`, `SERVER_NAME`, `TRUSTED_PROXIES`, `SKRUM_SIGNUP_MODE`, `SKRUM_ALLOWED_EMAIL_DOMAINS`, `SKRUM_AVATAR_STYLE`, SSO variables (point to `.env.example`), `MAIL_*`, `REVERB_APP_*`, `REVERB_CLIENT_*`, `SKRUM_RUN_MIGRATIONS`, `OCTANE_WORKERS`, `OCTANE_MAX_REQUESTS`.
4. **Processes** — s6 supervises Octane (FrankenPHP), Reverb, queue worker, scheduler; each restarts after a crash; migrations run once at start.
5. **Local development** — Sail: `vendor/bin/sail up -d`, `vendor/bin/sail composer run dev` (or `vendor/bin/sail artisan dev`), `npm run dev`; optional demo data `vendor/bin/sail artisan db:seed --class=DemoSeeder` (local only; accounts `facilitator@skrum.test` / `member@skrum.test`, password `password`).
6. **Avatars** — generated with DiceBear; the default style `thumbs` is released under CC0 1.0 (https://www.dicebear.com/styles/thumbs/); other styles have their own licences listed on dicebear.com.

Use the literal placeholder `<owner>` for the GitHub owner (the repository has no remote yet); say so in one sentence.

- [ ] **Step 4: `.github/workflows/docker-image.yml`**

```yaml
name: Docker image

on:
    push:
        branches: [main]
        tags: ['v*']
    pull_request:

permissions:
    contents: read
    packages: write

jobs:
    image:
        runs-on: ubuntu-latest
        steps:
            - uses: actions/checkout@v4

            - uses: docker/setup-qemu-action@v3

            - uses: docker/setup-buildx-action@v3

            - uses: docker/login-action@v3
              if: github.event_name != 'pull_request'
              with:
                  registry: ghcr.io
                  username: ${{ github.actor }}
                  password: ${{ secrets.GITHUB_TOKEN }}

            - id: meta
              uses: docker/metadata-action@v5
              with:
                  images: ghcr.io/${{ github.repository }}
                  tags: |
                      type=ref,event=branch
                      type=semver,pattern={{version}}
                      type=semver,pattern={{major}}.{{minor}}
                      type=raw,value=latest,enable={{is_default_branch}}

            - uses: docker/build-push-action@v6
              with:
                  context: .
                  platforms: linux/amd64,linux/arm64
                  push: ${{ github.event_name != 'pull_request' }}
                  tags: ${{ steps.meta.outputs.tags }}
                  labels: ${{ steps.meta.outputs.labels }}
                  cache-from: type=gha
                  cache-to: type=gha,mode=max
```

- [ ] **Step 5: Commit**

```bash
git add compose.production.yaml README.md .github/workflows/docker-image.yml .env.example
git commit -m "docs: add production compose, readme and ghcr image workflow"
```

---

### Task 6: End-to-end verification (controller-driven)

No new feature. Prove AC31–AC33 and the Review Focus on a real container, fix what breaks (one commit per fix), and report.

- [ ] **Step 1: Env file** — create `.env.production` (git-ignored) from `.env.example` with: `APP_ENV=production`, `APP_DEBUG=false`, `APP_URL=http://localhost:8088`, `APP_KEY` from `docker run --rm --entrypoint php skrum:latest artisan key:generate --show`, `DB_DATABASE=skrum`, `DB_USERNAME=skrum`, `DB_PASSWORD=<random>`, `REVERB_APP_ID/KEY/SECRET=<random>`, empty `REVERB_CLIENT_*`, `SERVER_NAME=:80`, `SKRUM_SIGNUP_MODE=open`, `SESSION_DRIVER=database`, `CACHE_STORE=database`, `QUEUE_CONNECTION=database`, `MAIL_MAILER=log`.
- [ ] **Step 2: Start (AC31)** — `SKRUM_ENV_FILE=.env.production SKRUM_HTTP_PORT=8088 SKRUM_HTTPS_PORT=8443 docker compose -f compose.production.yaml --env-file .env.production up -d --build`; `docker compose -f compose.production.yaml logs app` shows `optimize` and migrations; `curl -fsS http://localhost:8088/up` → 200; `docker inspect --format '{{.State.Health.Status}}'` becomes `healthy`.
- [ ] **Step 3: Processes (AC32)** — `docker compose -f compose.production.yaml exec app ps -eo pid,user,args` shows frankenphp/octane, `reverb:start`, `queue:work`, `schedule:work`, all as `www-data`. Kill each in turn (`kill <pid>`), wait 5 s, and confirm a new pid for the same command.
- [ ] **Step 4: App** — in the browser: register the first user at `http://localhost:8088/register` (test account; record credentials only in `.env.production` comments), create workspace/team/retro; board loads without "Reconnecting…".
- [ ] **Step 5: Realtime through one port** — network panel shows the websocket to `ws://localhost:8088/app/<key>…` (not `:8080`) and `/broadcasting/auth` 200; a second participant (guest link opened on `127.0.0.1:8088`) sees placeholders and phase changes live.
- [ ] **Step 6: Octane isolation (Review Focus 4, 5)** — the two browsers use different languages (fr / en); switch each a few times, reload repeatedly; neither page ever shows the other's language or user.
- [ ] **Step 7: Behind a proxy (Review Focus 1)** — `curl -s -H 'X-Forwarded-Proto: https' http://localhost:8088/login | grep -o 'https://localhost:8088[^"]*' | head -3` shows no https URLs while `TRUSTED_PROXIES` is empty; set `TRUSTED_PROXIES=*`, `docker compose … up -d`, repeat → generated absolute URLs use https.
- [ ] **Step 8: Restart (Review Focus 3)** — `docker compose … restart app`: data still there, migrations report "Nothing to migrate"; set `SKRUM_RUN_MIGRATIONS=false`, restart → log says migrations skipped.
- [ ] **Step 9: Misconfiguration (Review Focus 2)** — blank `APP_KEY` in a copy of the env file, `up` → the app container stops with the missing-variables message.
- [ ] **Step 10: Full checks (AC33)** — `vendor/bin/sail artisan test --compact`, `vendor/bin/sail bin phpstan analyse --no-progress`, `npm run types:check`, `npm run check`.
- [ ] **Step 11: Clean up** — `docker compose -f compose.production.yaml --env-file .env.production down -v`; delete `.env.production`.
- [ ] **Step 12: Report** — every defect found with its fix commit; anything not fixed with a reason.

---

## Spec coverage (Plan 5)

| Spec item | Task |
|---|---|
| §6 FrankenPHP + Octane worker mode, no nginx/FPM | 3, 4 |
| §6 Caddy proxies `/app/*`, `/apps/*`; one port; auto HTTPS via `SERVER_NAME` | 4 |
| §6 s6: Octane, Reverb, queue, scheduler; migrations oneshot with opt-out | 4 |
| §6 GHCR image; `compose.production.yaml` (app + PostgreSQL) | 5 |
| §6 env-driven config documented in `.env.example` | 1, 2, 5 |
| §6 runtime Reverb client config; SSR off; `TRUSTED_PROXIES` | 1, 2 |
| §6 Local dev keeps Sail with Reverb | 2 (port from config) |
| §6 Octane constraint (no request state in singletons/statics) | 3 |
| §3 Avatars — README lists style licence | 5 |
| AC31 compose up → working instance, one port, migrations applied | 6 |
| AC32 each process supervised and restarted | 4, 6 |
| AC33 suite passes, no request-state leakage | 3, 6 |
| Plan 4 carried: SSR in production, Reverb port hard-coded, refetch timeout | 2, 2, 1 |
