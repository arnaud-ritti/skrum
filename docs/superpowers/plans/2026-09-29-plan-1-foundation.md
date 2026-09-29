# Plan 1 — Foundation (UUIDs, i18n, Workspaces, Teams, Invitations, Signup Gate) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the starter kit into a multi-tenant, four-language foundation: UUID keys everywhere, FR/EN/ES/DE UI, workspaces with roles, teams with membership, email invitations, and a configurable signup gate.

**Architecture:** Plain Laravel + Inertia React. Domain logic lives in small action classes (`app/Actions/...`) and policies; controllers stay CRUD-shaped. Translations have one source of truth (`lang/*.json`) shared to React through an Inertia prop and a `useTrans()` hook. Every piece of request state (locale, current workspace, invitation token) is resolved per request, never cached statically (Octane-ready).

**Tech Stack:** PHP 8.4, Laravel 13, Fortify, Inertia v3 + React 19, Tailwind 4, Wayfinder, Pest, PostgreSQL (via Sail), `laravel-lang/common` (dev).

**Spec:** `docs/superpowers/specs/2026-09-29-retro-board-core-design.md`

This is **plan 1 of 5**. Later plans: (2) SSO, (3) Retro backend, (4) Board UI + realtime, (5) Packaging. This plan covers spec ACs: AC0–AC3, AC7–AC10, AC34–AC36.

## Global Constraints

- All commands run through Sail: `vendor/bin/sail artisan …`, `vendor/bin/sail composer …`, `vendor/bin/sail bin pint …`. npm runs on the host.
- Run tests with `vendor/bin/sail artisan test --compact <path-or---filter>`.
- Every table has a UUID primary key (`HasUuids`, UUIDv7) or, for pivot tables, a composite primary key of UUID foreign keys. Foreign keys use `foreignUuid`. Only framework queue/migration tables (`migrations`, `jobs`, `failed_jobs`, `job_batches`) keep integer ids — Laravel's database queue needs them and they are never exposed.
- Supported locales: `en` (default/fallback), `fr`, `es`, `de`. Every user-facing string goes through `__()` (PHP) or `t()` (React). Translation keys are the English text. Every new key is added to `lang/en.json`, `lang/fr.json`, `lang/es.json`, `lang/de.json` in the same commit.
- No request-specific state in static properties or singletons (Octane). Use `request()` / `$request` inside methods, never constructor-injected `Request` in long-lived services.
- Migrations: `up()` only — delete the generated `down()` method.
- Controllers: plural names, CRUD method names only (`index`, `create`, `store`, `show`, `edit`, `update`, `destroy`). URLs kebab-case, route params camelCase, route names follow existing dotted style (`workspaces.show`).
- PHP: typed properties, return types (incl. `void`), early returns, no `else`, curly braces always, string interpolation, one trait per line, no comments that restate code.
- Tests: Pest function style (`it(...)`), no comments in tests, factories for models.
- After PHP changes: `vendor/bin/sail bin pint --dirty --format agent`. After TS changes: `vendor/bin/sail artisan wayfinder:generate --with-form && npm run types:check && npm run check`.
- No new dependencies except `laravel-lang/common` (dev).
- Commit messages: Conventional Commits, ending with the line `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`.

## Review Focus

1. **Email case mismatch** — an invitation to `Bob@Example.com` must be usable by someone registering or logged in as `bob@example.com`. Pinned in Task 6 (`matchesEmail`) and Task 8 (registration).
2. **Re-accepting / accepting while already a member** — accepting an invitation must never change an existing member's role (an Owner accepting a Member invite stays Owner). Pinned in Task 6.
3. **Stale `current_workspace_id`** — after being removed from a workspace (or its deletion), `/dashboard` must redirect to another workspace or to the create page, never 403. Pinned in Task 5 and Task 10.
4. **Expired or revoked invitation link** — shows a clear "expired" page and does not unlock registration in `invite` mode. Pinned in Task 8.
5. **Garbage locale input** — unsupported cookie value (`xx`), unsupported stored user locale, or odd `Accept-Language` must fall back to `en`, never error. Pinned in Task 2.

---

## File Structure

```
app/
  Actions/
    Auth/SignupGate.php                         signup decision (mode × invitation × domain × first user)
    Fortify/CreateNewUser.php                   (modify) gate + first-user admin + invitation acceptance
    Workspaces/CreateWorkspace.php              create workspace, attach owner, set current
    Workspaces/CreateWorkspaceInvitation.php    issue invitation, returns IssuedInvitation
    Workspaces/AcceptWorkspaceInvitation.php    attach invitee, mark accepted
    Workspaces/IssuedInvitation.php             value object: invitation + plain token
  Enums/SignupMode.php
  Enums/WorkspaceRole.php
  Http/Controllers/
    CurrentWorkspaceController.php              GET /dashboard → redirect to current workspace
    WorkspacesController.php                    create, store, show, destroy
    WorkspaceMembersController.php              index, update, destroy
    WorkspaceInvitationsController.php          store, destroy
    InvitationLinksController.php               show (public invitation page)
    InvitationAcceptancesController.php         store (accept as logged-in user)
    TeamsController.php                         store, show, update, destroy
    TeamMembersController.php                   store, destroy
    LocalesController.php                       update (language switch)
  Http/Middleware/SetLocale.php
  Http/Middleware/RememberCurrentWorkspace.php
  Http/Middleware/HandleInertiaRequests.php     (modify) shared props
  Models/Passkey.php                            UUID passkey model
  Models/Workspace.php, WorkspaceMembership.php, WorkspaceInvitation.php, Team.php
  Models/User.php                               (modify)
  Notifications/WorkspaceInvitationNotification.php
  Policies/WorkspacePolicy.php, TeamPolicy.php
config/skrum.php
lang/{en,fr,es,de}.json + lang/{fr,es,de}/*.php (laravel-lang)
resources/js/
  hooks/use-trans.ts
  types/workspaces.ts
  components/language-switcher.tsx, workspace-switcher.tsx
  pages/workspaces/{create,show,members}.tsx, teams/show.tsx, invitations/show.tsx
tests/Feature/
  UuidPrimaryKeysTest.php, LocaleTest.php, TranslationKeysTest.php
  Workspaces/{WorkspaceModelTest,WorkspacesTest,WorkspaceMembersTest,WorkspaceInvitationsTest}.php
  Teams/TeamsTest.php
  Auth/{SignupGateTest,InvitationRegistrationTest}.php
```

---

### Task 1: UUID primary keys

**Files:**
- Modify: `database/migrations/0001_01_01_000000_create_users_table.php`
- Modify: `database/migrations/2024_01_01_000000_create_passkeys_table.php`
- Create: `app/Models/Passkey.php`
- Modify: `app/Models/User.php`, `app/Providers/AppServiceProvider.php`
- Modify: `resources/js/types/auth.ts`
- Test: `tests/Feature/UuidPrimaryKeysTest.php`

**Interfaces:**
- Produces: `User::$id` is a `string` UUID. `App\Models\Passkey` is the passkey model. TS `User.id: string`.

- [ ] **Step 1: Write the failing test**

`vendor/bin/sail artisan make:test --pest UuidPrimaryKeysTest`, then replace its content:

```php
<?php

use App\Models\Passkey;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Laravel\Passkeys\Passkeys;

it('has no integer key columns on application tables', function () {
    $integerKeyColumns = DB::table('information_schema.columns')
        ->where('table_schema', 'public')
        ->whereNotIn('table_name', ['migrations', 'jobs', 'failed_jobs', 'job_batches'])
        ->where(fn ($query) => $query->where('column_name', 'id')->orWhere('column_name', 'like', '%\_id'))
        ->whereIn('data_type', ['smallint', 'integer', 'bigint'])
        ->get(['table_name', 'column_name'])
        ->map(fn (object $column) => "{$column->table_name}.{$column->column_name}");

    expect($integerKeyColumns)->toBeEmpty();
});

it('gives users a uuid primary key', function () {
    expect(Str::isUuid(User::factory()->create()->id))->toBeTrue();
});

it('uses the uuid passkey model', function () {
    expect(Passkeys::passkeyModel())->toBe(Passkey::class);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `vendor/bin/sail artisan test --compact tests/Feature/UuidPrimaryKeysTest.php`
Expected: FAIL — `users.id`, `sessions.user_id`, `passkeys.id`, `passkeys.user_id` listed; `App\Models\Passkey` not found.

- [ ] **Step 3: Implement**

In `0001_01_01_000000_create_users_table.php`: replace `$table->id();` with `$table->uuid('id')->primary();`, and in `sessions` replace `$table->foreignId('user_id')->nullable()->index();` with `$table->foreignUuid('user_id')->nullable()->index();`. Delete the `down()` method.

In `2024_01_01_000000_create_passkeys_table.php`: replace `$table->id();` with `$table->uuid('id')->primary();` and `$table->foreignId('user_id')->constrained()->cascadeOnDelete();` with `$table->foreignUuid('user_id')->constrained()->cascadeOnDelete();`. Delete the `down()` method.

`app/Models/Passkey.php`:

```php
<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Laravel\Passkeys\Passkey as BasePasskey;

class Passkey extends BasePasskey
{
    use HasUuids;
}
```

`app/Models/User.php`: add `use Illuminate\Database\Eloquent\Concerns\HasUuids;`, add `use HasUuids;` as its own line in the class (keep the existing `use HasFactory, …` line but split it one trait per line), and change the docblock `@property int $id` to `@property string $id`.

`app/Providers/AppServiceProvider.php` — in `boot()` after `$this->configureDefaults();` add `Passkeys::usePasskeyModel(Passkey::class);` with imports `App\Models\Passkey` and `Laravel\Passkeys\Passkeys`.

`resources/js/types/auth.ts`: `id: number;` → `id: string;` in both `User` and `Passkey`.

- [ ] **Step 4: Run tests**

Run: `vendor/bin/sail artisan migrate:fresh --no-interaction && vendor/bin/sail artisan test --compact`
Expected: all tests PASS (new + the 40 existing).

- [ ] **Step 5: Format, type-check, commit**

```bash
vendor/bin/sail bin pint --dirty --format agent
npm run types:check
git add -A && git commit -m "feat: use uuid primary keys for users, sessions and passkeys

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Internationalization foundation

**Files:**
- Create: `config/skrum.php`, `app/Http/Middleware/SetLocale.php`, `app/Http/Controllers/LocalesController.php`
- Create: migration `add_locale_to_users_table`
- Create: `lang/en.json` (+ laravel-lang generated `lang/fr|es|de/*`, `lang/fr|es|de.json`)
- Create: `resources/js/hooks/use-trans.ts`, `resources/js/components/language-switcher.tsx`
- Modify: `app/Models/User.php`, `app/Http/Middleware/HandleInertiaRequests.php`, `bootstrap/app.php`, `routes/web.php`, `resources/js/types/global.d.ts`, `resources/js/layouts/auth-layout.tsx`, `resources/js/pages/settings/appearance.tsx`
- Test: `tests/Feature/LocaleTest.php`, `tests/Feature/TranslationKeysTest.php`

**Interfaces:**
- Produces: `config('skrum.locales')` = `['en','fr','es','de']`; `users.locale` (nullable string); User implements `HasLocalePreference`; Inertia shared props `locale: string`, `locales: string[]`, `translations: Record<string,string>`; React hook `useTrans(): { t(key: string, replacements?: Record<string, string|number>): string }`; component `<LanguageSwitcher />`; route `locale.update` (`PUT /locale`, body `locale`).

- [ ] **Step 1: Install framework translations**

```bash
vendor/bin/sail composer require --dev laravel-lang/common
vendor/bin/sail artisan lang:add fr es de
```

Expected: `lang/fr/validation.php`, `lang/es/…`, `lang/de/…` and `lang/fr.json` etc. exist. If `lang/en.json` was not created, create it with `{}`.

- [ ] **Step 2: Write the failing tests**

`vendor/bin/sail artisan make:test --pest LocaleTest`:

```php
<?php

use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

it('defaults to english', function () {
    $this->get(route('login'))
        ->assertInertia(fn (Assert $page) => $page->where('locale', 'en'));
});

it('uses the accept-language header', function () {
    $this->get(route('login'), ['Accept-Language' => 'de-DE,de;q=0.9,en;q=0.5'])
        ->assertInertia(fn (Assert $page) => $page->where('locale', 'de'));
});

it('prefers the locale cookie over the header', function () {
    $this->withCookie('locale', 'es')
        ->get(route('login'), ['Accept-Language' => 'de'])
        ->assertInertia(fn (Assert $page) => $page->where('locale', 'es'));
});

it('prefers the user locale over the cookie', function () {
    $user = User::factory()->create(['locale' => 'fr']);

    $this->actingAs($user)
        ->withCookie('locale', 'es')
        ->get(route('appearance.edit'))
        ->assertInertia(fn (Assert $page) => $page->where('locale', 'fr'));
});

it('falls back to english for unsupported values', function () {
    $user = User::factory()->create(['locale' => 'xx']);

    $this->actingAs($user)
        ->withCookie('locale', 'zz')
        ->get(route('appearance.edit'), ['Accept-Language' => 'ja-JP'])
        ->assertInertia(fn (Assert $page) => $page->where('locale', 'en'));
});

it('shares the active locale translations', function () {
    $this->withCookie('locale', 'fr')
        ->get(route('login'))
        ->assertInertia(fn (Assert $page) => $page
            ->where('translations.Language', 'Langue')
            ->where('locales', ['en', 'fr', 'es', 'de']));
});

it('lets a visitor switch language with a cookie', function () {
    $this->put(route('locale.update'), ['locale' => 'de'])
        ->assertRedirect()
        ->assertCookie('locale', 'de');
});

it('stores the language of a logged in user', function () {
    $user = User::factory()->create();

    $this->actingAs($user)->put(route('locale.update'), ['locale' => 'es']);

    expect($user->fresh()->locale)->toBe('es');
});

it('rejects unsupported languages', function () {
    $this->put(route('locale.update'), ['locale' => 'xx'])
        ->assertSessionHasErrors('locale');
});

it('shows validation errors in the active locale', function () {
    $this->withCookie('locale', 'fr')
        ->post(route('register.store'), [])
        ->assertSessionHasErrors('email');

    expect(session('errors')->first('email'))->toContain('obligatoire');
});
```

`vendor/bin/sail artisan make:test --pest TranslationKeysTest`:

```php
<?php

use Illuminate\Support\Facades\File;

function usedTranslationKeys(): array
{
    $patterns = [
        '/\bt\(\s*\'((?:[^\'\\\\]|\\\\.)+)\'/',
        '/\bt\(\s*"((?:[^"\\\\]|\\\\.)+)"/',
        '/__\(\s*\'((?:[^\'\\\\]|\\\\.)+)\'/',
    ];

    $files = collect([
        ...File::allFiles(resource_path('js/pages')),
        ...File::allFiles(resource_path('js/components')),
        ...File::allFiles(resource_path('js/layouts')),
        ...File::allFiles(app_path()),
    ])->filter(fn (SplFileInfo $file) => in_array($file->getExtension(), ['ts', 'tsx', 'php'], true));

    return $files
        ->flatMap(function (SplFileInfo $file) use ($patterns) {
            return collect($patterns)->flatMap(function (string $pattern) use ($file) {
                preg_match_all($pattern, File::get($file->getPathname()), $matches);

                return array_map(fn (string $key) => stripslashes($key), $matches[1]);
            });
        })
        ->unique()
        ->values()
        ->all();
}

it('defines every used key in every locale', function (string $locale) {
    $translations = json_decode(File::get(lang_path("{$locale}.json")), true);

    $missingKeys = array_values(array_diff(usedTranslationKeys(), array_keys($translations)));

    expect($missingKeys)->toBe([]);
})->with(['en', 'fr', 'es', 'de']);

it('keeps every english key in every other locale', function (string $locale) {
    $englishKeys = array_keys(json_decode(File::get(lang_path('en.json')), true));
    $localeKeys = array_keys(json_decode(File::get(lang_path("{$locale}.json")), true));

    expect(array_values(array_diff($englishKeys, $localeKeys)))->toBe([]);
})->with(['fr', 'es', 'de']);
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `vendor/bin/sail artisan test --compact tests/Feature/LocaleTest.php tests/Feature/TranslationKeysTest.php`
Expected: FAIL — `locale` prop missing, route `locale.update` not defined, column `locale` missing.

- [ ] **Step 4: Implement backend**

`config/skrum.php`:

```php
<?php

return [
    'locales' => ['en', 'fr', 'es', 'de'],
];
```

`vendor/bin/sail artisan make:migration add_locale_to_users_table --no-interaction`, `up()` only:

```php
public function up(): void
{
    Schema::table('users', function (Blueprint $table) {
        $table->string('locale', 5)->nullable();
    });
}
```

`app/Models/User.php`: add `'locale'` to `#[Fillable]`, implement `Illuminate\Contracts\Translation\HasLocalePreference`, add `@property string|null $locale`, and:

```php
public function preferredLocale(): ?string
{
    return $this->locale;
}
```

`app/Http/Middleware/SetLocale.php` (`vendor/bin/sail artisan make:middleware SetLocale --no-interaction`):

```php
<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class SetLocale
{
    public function handle(Request $request, Closure $next): Response
    {
        app()->setLocale($this->resolveLocale($request));

        return $next($request);
    }

    private function resolveLocale(Request $request): string
    {
        /** @var array<int, string> $supportedLocales */
        $supportedLocales = config('skrum.locales');

        $userLocale = $request->user()?->locale;

        if (in_array($userLocale, $supportedLocales, true)) {
            return $userLocale;
        }

        $cookieLocale = $request->cookie('locale');

        if (in_array($cookieLocale, $supportedLocales, true)) {
            return $cookieLocale;
        }

        return $request->getPreferredLanguage($supportedLocales) ?? $supportedLocales[0];
    }
}
```

Note: `getPreferredLanguage` returns `de` for `de-DE` because it matches the language prefix; for no match it returns the first supported locale (`en`).

`bootstrap/app.php` — insert `SetLocale::class` between `HandleAppearance::class` and `HandleInertiaRequests::class` in `$middleware->web(append: [...])` (import `App\Http\Middleware\SetLocale`).

`app/Http/Middleware/HandleInertiaRequests.php` — add to `share()`:

```php
'locale' => app()->getLocale(),
'locales' => config('skrum.locales'),
'translations' => fn () => $this->translations(app()->getLocale()),
```

and the method:

```php
/**
 * @return array<string, string>
 */
private function translations(string $locale): array
{
    $path = lang_path("{$locale}.json");

    if (! is_file($path)) {
        return [];
    }

    return json_decode((string) file_get_contents($path), true) ?? [];
}
```

`app/Http/Controllers/LocalesController.php`:

```php
<?php

namespace App\Http\Controllers;

use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class LocalesController extends Controller
{
    public function update(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'locale' => ['required', 'string', Rule::in(config('skrum.locales'))],
        ]);

        $request->user()?->update(['locale' => $validated['locale']]);

        return back()->withCookie(cookie()->forever('locale', $validated['locale']));
    }
}
```

`routes/web.php` — add (outside auth groups): `Route::put('locale', [LocalesController::class, 'update'])->name('locale.update');`

`lang/en.json` — add the two keys already used in PHP (`"Profile updated."`, `"Password updated."` in `app/Http/Controllers/Settings/*`) with translations in all four files, then add `"Language": "Language"`; `lang/fr.json` `"Language": "Langue"`; `lang/es.json` `"Language": "Idioma"`; `lang/de.json` `"Language": "Sprache"`. Also add the four language names used by the switcher (each file, same keys, native names as values in every locale): `"English": "English"`, `"Français": "Français"`, `"Español": "Español"`, `"Deutsch": "Deutsch"`.

- [ ] **Step 5: Implement frontend**

`resources/js/types/global.d.ts` — extend `sharedPageProps`:

```ts
locale: string;
locales: string[];
translations: Record<string, string>;
```

`resources/js/hooks/use-trans.ts`:

```ts
import { usePage } from '@inertiajs/react';

type Replacements = Record<string, string | number>;

export function useTrans() {
    const { translations } = usePage().props;

    const t = (key: string, replacements: Replacements = {}): string => {
        let line = translations[key] ?? key;

        for (const [name, value] of Object.entries(replacements)) {
            line = line.replaceAll(`:${name}`, String(value));
        }

        return line;
    };

    return { t };
}
```

`resources/js/components/language-switcher.tsx`:

```tsx
import { router, usePage } from '@inertiajs/react';
import LocalesController from '@/actions/App/Http/Controllers/LocalesController';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { useTrans } from '@/hooks/use-trans';

const localeNames: Record<string, string> = {
    en: 'English',
    fr: 'Français',
    es: 'Español',
    de: 'Deutsch',
};

export function LanguageSwitcher() {
    const { locale, locales } = usePage().props;
    const { t } = useTrans();

    return (
        <Select
            value={locale}
            onValueChange={(value) =>
                router.put(
                    LocalesController.update.url(),
                    { locale: value },
                    { preserveScroll: true },
                )
            }
        >
            <SelectTrigger className="w-40" aria-label={t('Language')}>
                <SelectValue />
            </SelectTrigger>
            <SelectContent>
                {locales.map((code) => (
                    <SelectItem key={code} value={code}>
                        {t(localeNames[code])}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
}
```

`resources/js/layouts/auth-layout.tsx` — render `<LanguageSwitcher />` in a `div` positioned `absolute top-4 right-4` around the existing content (wrap the returned tree in `<div className="relative">…</div>` if needed).

`resources/js/pages/settings/appearance.tsx` — below the existing appearance section add:

```tsx
<div className="space-y-6">
    <Heading variant="small" title={t('Language')} description={t('Choose the language of the interface')} />
    <LanguageSwitcher />
</div>
```

(with `const { t } = useTrans();` and imports). Add key `"Choose the language of the interface"` to the four JSON files (fr: `"Choisissez la langue de l'interface"`, es: `"Elige el idioma de la interfaz"`, de: `"Wähle die Sprache der Oberfläche"`).

- [ ] **Step 6: Run tests**

Run: `vendor/bin/sail artisan migrate --no-interaction && vendor/bin/sail artisan test --compact tests/Feature/LocaleTest.php tests/Feature/TranslationKeysTest.php`
Expected: PASS. (`TranslationKeysTest` passes because only the keys above are used so far; if it lists any other pre-existing `__()` key, add it to the four files now.)

- [ ] **Step 7: Format, check, commit**

```bash
vendor/bin/sail bin pint --dirty --format agent
vendor/bin/sail artisan wayfinder:generate --with-form && npm run types:check && npm run check
git add -A && git commit -m "feat: add en/fr/es/de locale resolution and translation sharing

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Translate existing starter-kit UI

**Files:**
- Modify: every `.tsx` under `resources/js/pages/auth/`, `resources/js/pages/settings/`, `resources/js/pages/welcome.tsx`, `resources/js/pages/dashboard.tsx`, `resources/js/layouts/**`, and these components: `app-header.tsx`, `app-sidebar.tsx`, `appearance-tabs.tsx`, `delete-user.tsx`, `manage-passkeys.tsx`, `manage-two-factor.tsx`, `nav-main.tsx`, `nav-user.tsx`, `passkey-item.tsx`, `passkey-register.tsx`, `passkey-verify.tsx`, `password-input.tsx`, `two-factor-recovery-codes.tsx`, `two-factor-setup-modal.tsx`, `user-menu-content.tsx`
- Modify: PHP files in `app/` that return user-visible strings (e.g. status messages in `app/Http/Controllers/Settings/*`, `app/Providers/FortifyServiceProvider.php`)
- Modify: `lang/{en,fr,es,de}.json`
- Test: `tests/Feature/TranslationKeysTest.php` (existing — it enforces completeness)

**Interfaces:**
- Consumes: `useTrans()` from Task 2.
- Produces: no new interfaces.

- [ ] **Step 1: Wrap every user-visible string**

In each listed file, add `const { t } = useTrans();` at the top of each component that renders text, and wrap every visible literal — JSX text, `placeholder`, `title`, `description`, `aria-label`, `<Head title>`, breadcrumb titles, nav item titles, toast messages — in `t('…')` with the exact English text as the key. Example from `login.tsx`:

```tsx
<Head title={t('Log in')} />
<Label htmlFor="email">{t('Email address')}</Label>
<Input … placeholder={t('email@example.com')} />
```

For strings with dynamic parts use Laravel placeholders: `t('Signed in as :name', { name: user.name })`.

Breadcrumbs and nav items declared at module scope (e.g. `mainNavItems`, `Dashboard.layout.breadcrumbs`) must be moved into the component or store the English key and be translated at render time in `nav-main.tsx` / `breadcrumbs.tsx` (`{t(item.title)}`). Choose the render-time approach: keep `title: 'Dashboard'` data and translate where it's rendered.

In `app-sidebar.tsx` delete `footerNavItems` and the `<NavFooter …/>` element (they link to the starter-kit repository and docs, which are not part of Skrum).

In PHP, wrap user-visible strings with `__('…')`.

- [ ] **Step 2: Add the keys**

Run `vendor/bin/sail artisan test --compact tests/Feature/TranslationKeysTest.php` — it lists every missing key per locale. Add each key to `lang/en.json` (value = key) and a proper translation to `lang/fr.json`, `lang/es.json`, `lang/de.json`. Keep keys sorted alphabetically in each file. Keys already provided by laravel-lang in `fr.json` etc. keep their existing translation.

- [ ] **Step 3: Check for missed literals**

Run:

```bash
grep -rnE ">[^<>{}]*[A-Za-z]{3,}[^<>{}]*<|(placeholder|title|description|aria-label)=\"[^\"]*[A-Za-z]{3,}" resources/js/pages resources/js/layouts resources/js/components --include=*.tsx | grep -v "components/ui/"
```

Expected: no output (or only non-text such as class names / icon ids — inspect each hit).

- [ ] **Step 4: Run tests**

Run: `vendor/bin/sail artisan test --compact`
Expected: all PASS.

- [ ] **Step 5: Manual check**

Run `npm run dev` (Sail app on `http://localhost`), switch language on the login page to each of FR/ES/DE and confirm login, register, forgot-password and settings pages show no English leftovers.

- [ ] **Step 6: Commit**

```bash
vendor/bin/sail bin pint --dirty --format agent
npm run types:check && npm run check
git add -A && git commit -m "feat: translate starter-kit pages into fr, es and de

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Workspace domain model and policy

**Files:**
- Create: `app/Enums/WorkspaceRole.php`, `app/Models/Workspace.php`, `app/Models/WorkspaceMembership.php`, `app/Actions/Workspaces/CreateWorkspace.php`, `app/Policies/WorkspacePolicy.php`, `database/factories/WorkspaceFactory.php`
- Create: migrations `create_workspaces_table`, `create_workspace_user_table`, `add_workspace_columns_to_users_table`
- Modify: `app/Models/User.php`
- Test: `tests/Feature/Workspaces/WorkspaceModelTest.php`

**Interfaces:**
- Produces:
  - `enum WorkspaceRole: string { Owner = 'owner'; Admin = 'admin'; Member = 'member'; public function canManageWorkspace(): bool }`
  - `Workspace::members(): BelongsToMany<User>` (pivot accessor `membership`, pivot `role` cast to `WorkspaceRole`)
  - `Workspace::owners(): BelongsToMany<User>`
  - `User::workspaces(): BelongsToMany<Workspace>`, `User::currentWorkspace(): BelongsTo<Workspace>`, `User::roleIn(Workspace): ?WorkspaceRole`, `User::canManage(Workspace): bool`, `User::belongsToWorkspace(Workspace): bool`
  - `users.is_instance_admin` (bool), `users.current_workspace_id` (nullable uuid)
  - `CreateWorkspace::handle(User $owner, string $name): Workspace`
  - `WorkspacePolicy::view|manageMembers|delete(User, Workspace): bool`
  - `WorkspaceFactory::withMember(User $user, WorkspaceRole $role): static`

- [ ] **Step 1: Write the failing test**

`vendor/bin/sail artisan make:test --pest Workspaces/WorkspaceModelTest`:

```php
<?php

use App\Actions\Workspaces\CreateWorkspace;
use App\Enums\WorkspaceRole;
use App\Models\User;
use App\Models\Workspace;

it('creates a workspace owned by its creator', function () {
    $user = User::factory()->create();

    $workspace = app(CreateWorkspace::class)->handle($user, 'Acme Corp');

    expect($workspace->name)->toBe('Acme Corp')
        ->and($workspace->slug)->toMatch('/^acme-corp-[a-z0-9]{6}$/')
        ->and($user->roleIn($workspace))->toBe(WorkspaceRole::Owner)
        ->and($user->fresh()->current_workspace_id)->toBe($workspace->id);
});

it('falls back to a generic slug when the name has no latin characters', function () {
    $workspace = app(CreateWorkspace::class)->handle(User::factory()->create(), '!!!');

    expect($workspace->slug)->toMatch('/^workspace-[a-z0-9]{6}$/');
});

it('returns no role for non members', function () {
    $workspace = Workspace::factory()->create();

    expect(User::factory()->create()->roleIn($workspace))->toBeNull();
});

it('authorizes workspace abilities by role', function (WorkspaceRole $role, bool $canManage, bool $canDelete) {
    $user = User::factory()->create();
    $workspace = Workspace::factory()->withMember($user, $role)->create();

    expect($user->can('view', $workspace))->toBeTrue()
        ->and($user->can('manageMembers', $workspace))->toBe($canManage)
        ->and($user->can('delete', $workspace))->toBe($canDelete);
})->with([
    'owner' => [WorkspaceRole::Owner, true, true],
    'admin' => [WorkspaceRole::Admin, true, false],
    'member' => [WorkspaceRole::Member, false, false],
]);

it('denies every workspace ability to outsiders', function () {
    $user = User::factory()->create();
    $workspace = Workspace::factory()->create();

    expect($user->can('view', $workspace))->toBeFalse()
        ->and($user->can('manageMembers', $workspace))->toBeFalse()
        ->and($user->can('delete', $workspace))->toBeFalse();
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Workspaces/WorkspaceModelTest.php`
Expected: FAIL — classes not found.

- [ ] **Step 3: Migrations**

`vendor/bin/sail artisan make:migration create_workspaces_table --no-interaction`:

```php
public function up(): void
{
    Schema::create('workspaces', function (Blueprint $table) {
        $table->uuid('id')->primary();
        $table->string('name');
        $table->string('slug')->unique();
        $table->timestamps();
    });
}
```

`vendor/bin/sail artisan make:migration create_workspace_user_table --no-interaction`:

```php
public function up(): void
{
    Schema::create('workspace_user', function (Blueprint $table) {
        $table->foreignUuid('workspace_id')->constrained()->cascadeOnDelete();
        $table->foreignUuid('user_id')->constrained()->cascadeOnDelete();
        $table->string('role');
        $table->timestamps();

        $table->primary(['workspace_id', 'user_id']);
    });
}
```

`vendor/bin/sail artisan make:migration add_workspace_columns_to_users_table --no-interaction`:

```php
public function up(): void
{
    Schema::table('users', function (Blueprint $table) {
        $table->boolean('is_instance_admin')->default(false);
        $table->foreignUuid('current_workspace_id')->nullable()->constrained('workspaces')->nullOnDelete();
    });
}
```

Delete `down()` in all three.

- [ ] **Step 4: Enum, models, factory**

`app/Enums/WorkspaceRole.php`:

```php
<?php

namespace App\Enums;

enum WorkspaceRole: string
{
    case Owner = 'owner';
    case Admin = 'admin';
    case Member = 'member';

    public function canManageWorkspace(): bool
    {
        return $this === self::Owner || $this === self::Admin;
    }
}
```

`app/Models/WorkspaceMembership.php`:

```php
<?php

namespace App\Models;

use App\Enums\WorkspaceRole;
use Illuminate\Database\Eloquent\Relations\Pivot;

/**
 * @property string $workspace_id
 * @property string $user_id
 * @property WorkspaceRole $role
 */
class WorkspaceMembership extends Pivot
{
    protected $table = 'workspace_user';

    protected function casts(): array
    {
        return [
            'role' => WorkspaceRole::class,
        ];
    }
}
```

`app/Models/Workspace.php`:

```php
<?php

namespace App\Models;

use App\Enums\WorkspaceRole;
use Database\Factories\WorkspaceFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Support\Carbon;

/**
 * @property string $id
 * @property string $name
 * @property string $slug
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
#[Fillable(['name', 'slug'])]
class Workspace extends Model
{
    /** @use HasFactory<WorkspaceFactory> */
    use HasFactory;

    use HasUuids;

    /** @return BelongsToMany<User, $this, WorkspaceMembership, 'membership'> */
    public function members(): BelongsToMany
    {
        return $this->belongsToMany(User::class)
            ->using(WorkspaceMembership::class)
            ->as('membership')
            ->withPivot('role')
            ->withTimestamps();
    }

    /** @return BelongsToMany<User, $this, WorkspaceMembership, 'membership'> */
    public function owners(): BelongsToMany
    {
        return $this->members()->wherePivot('role', WorkspaceRole::Owner->value);
    }
}
```

`app/Models/User.php` — add `'is_instance_admin' => 'boolean'` to `casts()`, docblock `@property bool $is_instance_admin`, `@property string|null $current_workspace_id`, and:

```php
/** @return BelongsToMany<Workspace, $this, WorkspaceMembership, 'membership'> */
public function workspaces(): BelongsToMany
{
    return $this->belongsToMany(Workspace::class)
        ->using(WorkspaceMembership::class)
        ->as('membership')
        ->withPivot('role')
        ->withTimestamps();
}

/** @return BelongsTo<Workspace, $this> */
public function currentWorkspace(): BelongsTo
{
    return $this->belongsTo(Workspace::class, 'current_workspace_id');
}

public function roleIn(Workspace $workspace): ?WorkspaceRole
{
    return WorkspaceMembership::query()
        ->where('workspace_id', $workspace->id)
        ->where('user_id', $this->id)
        ->first()
        ?->role;
}

public function belongsToWorkspace(Workspace $workspace): bool
{
    return $this->roleIn($workspace) !== null;
}

public function canManage(Workspace $workspace): bool
{
    return $this->roleIn($workspace)?->canManageWorkspace() ?? false;
}
```

`vendor/bin/sail artisan make:factory WorkspaceFactory --no-interaction`:

```php
<?php

namespace Database\Factories;

use App\Enums\WorkspaceRole;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<Workspace>
 */
class WorkspaceFactory extends Factory
{
    public function definition(): array
    {
        $name = fake()->company();

        return [
            'name' => $name,
            'slug' => Str::slug($name).'-'.Str::lower(Str::random(6)),
        ];
    }

    public function withMember(User $user, WorkspaceRole $role = WorkspaceRole::Member): static
    {
        return $this->hasAttached($user, ['role' => $role->value], 'members');
    }
}
```

- [ ] **Step 5: Action and policy**

`app/Actions/Workspaces/CreateWorkspace.php`:

```php
<?php

namespace App\Actions\Workspaces;

use App\Enums\WorkspaceRole;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class CreateWorkspace
{
    public function handle(User $owner, string $name): Workspace
    {
        return DB::transaction(function () use ($owner, $name): Workspace {
            $workspace = Workspace::create([
                'name' => $name,
                'slug' => $this->uniqueSlug($name),
            ]);

            $workspace->members()->attach($owner, ['role' => WorkspaceRole::Owner->value]);

            $owner->forceFill(['current_workspace_id' => $workspace->id])->save();

            return $workspace;
        });
    }

    private function uniqueSlug(string $name): string
    {
        $base = Str::slug($name) ?: 'workspace';

        do {
            $slug = "{$base}-".Str::lower(Str::random(6));
        } while (Workspace::query()->where('slug', $slug)->exists());

        return $slug;
    }
}
```

`vendor/bin/sail artisan make:policy WorkspacePolicy --model=Workspace --no-interaction`, replace body:

```php
<?php

namespace App\Policies;

use App\Enums\WorkspaceRole;
use App\Models\User;
use App\Models\Workspace;

class WorkspacePolicy
{
    public function view(User $user, Workspace $workspace): bool
    {
        return $user->belongsToWorkspace($workspace);
    }

    public function manageMembers(User $user, Workspace $workspace): bool
    {
        return $user->canManage($workspace);
    }

    public function delete(User $user, Workspace $workspace): bool
    {
        return $user->roleIn($workspace) === WorkspaceRole::Owner;
    }
}
```

- [ ] **Step 6: Run tests**

Run: `vendor/bin/sail artisan migrate --no-interaction && vendor/bin/sail artisan test --compact tests/Feature/Workspaces/WorkspaceModelTest.php tests/Feature/UuidPrimaryKeysTest.php`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
vendor/bin/sail bin pint --dirty --format agent
git add -A && git commit -m "feat: add workspaces with owner/admin/member roles

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Workspace onboarding, home and switcher

**Files:**
- Create: `app/Http/Controllers/WorkspacesController.php`, `app/Http/Controllers/CurrentWorkspaceController.php`, `app/Http/Middleware/RememberCurrentWorkspace.php`
- Create: `resources/js/types/workspaces.ts`, `resources/js/pages/workspaces/create.tsx`, `resources/js/pages/workspaces/show.tsx`, `resources/js/components/workspace-switcher.tsx`
- Modify: `routes/web.php`, `app/Http/Middleware/HandleInertiaRequests.php`, `resources/js/types/global.d.ts`, `resources/js/types/index.ts`, `resources/js/components/app-sidebar.tsx`, `lang/*.json`
- Modify: `tests/Feature/DashboardTest.php`
- Test: `tests/Feature/Workspaces/WorkspacesTest.php`

**Interfaces:**
- Consumes: `CreateWorkspace`, `WorkspacePolicy`, `User::workspaces()`, `User::roleIn()` (Task 4).
- Produces:
  - Routes: `dashboard` (GET `/dashboard`), `workspaces.create` (GET `/workspaces/create`), `workspaces.store` (POST `/workspaces`), `workspaces.show` (GET `/w/{workspace:slug}`), `workspaces.destroy` (DELETE `/w/{workspace:slug}`). The `w/{workspace:slug}` group uses `can:view,workspace`, `RememberCurrentWorkspace`, and `scopeBindings()` — later tasks add routes inside it.
  - Inertia shared props `workspaces: WorkspaceSummary[]`, `currentWorkspace: CurrentWorkspace | null`.
  - Page `workspaces/show` props: `workspace: { id, name, slug }` (Task 9 adds `teams` and `canManage`).
  - TS types `WorkspaceRole`, `WorkspaceSummary`, `CurrentWorkspace` in `resources/js/types/workspaces.ts`.

- [ ] **Step 1: Write the failing tests**

`vendor/bin/sail artisan make:test --pest Workspaces/WorkspacesTest`:

```php
<?php

use App\Enums\WorkspaceRole;
use App\Models\User;
use App\Models\Workspace;
use Inertia\Testing\AssertableInertia as Assert;

it('sends users without a workspace to the create page', function () {
    $this->actingAs(User::factory()->create())
        ->get(route('dashboard'))
        ->assertRedirect(route('workspaces.create'));
});

it('creates a workspace and opens it', function () {
    $user = User::factory()->create();

    $response = $this->actingAs($user)->post(route('workspaces.store'), ['name' => 'Acme']);

    $workspace = $user->workspaces()->sole();

    $response->assertRedirect(route('workspaces.show', $workspace));
    expect($workspace->name)->toBe('Acme');
});

it('requires a workspace name', function () {
    $this->actingAs(User::factory()->create())
        ->post(route('workspaces.store'), ['name' => ''])
        ->assertSessionHasErrors('name');
});

it('sends users to their current workspace', function () {
    $user = User::factory()->create();
    $workspace = Workspace::factory()->withMember($user)->create();
    $user->forceFill(['current_workspace_id' => $workspace->id])->save();

    $this->actingAs($user)
        ->get(route('dashboard'))
        ->assertRedirect(route('workspaces.show', $workspace));
});

it('ignores a current workspace the user no longer belongs to', function () {
    $user = User::factory()->create();
    $formerWorkspace = Workspace::factory()->create();
    $otherWorkspace = Workspace::factory()->withMember($user)->create();
    $user->forceFill(['current_workspace_id' => $formerWorkspace->id])->save();

    $this->actingAs($user)
        ->get(route('dashboard'))
        ->assertRedirect(route('workspaces.show', $otherWorkspace));
});

it('remembers the last visited workspace', function () {
    $user = User::factory()->create();
    $first = Workspace::factory()->withMember($user)->create();
    $second = Workspace::factory()->withMember($user)->create();
    $user->forceFill(['current_workspace_id' => $first->id])->save();

    $this->actingAs($user)->get(route('workspaces.show', $second))->assertOk();

    expect($user->fresh()->current_workspace_id)->toBe($second->id);
});

it('shares the workspace list and current workspace', function () {
    $user = User::factory()->create();
    $workspace = Workspace::factory()->withMember($user, WorkspaceRole::Admin)->create();

    $this->actingAs($user)
        ->get(route('workspaces.show', $workspace))
        ->assertInertia(fn (Assert $page) => $page
            ->component('workspaces/show')
            ->where('currentWorkspace.slug', $workspace->slug)
            ->where('currentWorkspace.role', 'admin')
            ->has('workspaces', 1));
});

it('forbids opening a workspace the user does not belong to', function () {
    $this->actingAs(User::factory()->create())
        ->get(route('workspaces.show', Workspace::factory()->create()))
        ->assertForbidden();
});

it('lets only owners delete a workspace', function (WorkspaceRole $role, int $expectedStatus) {
    $user = User::factory()->create();
    $workspace = Workspace::factory()->withMember($user, $role)->create();

    $response = $this->actingAs($user)->delete(route('workspaces.destroy', $workspace));

    $expectedStatus === 302
        ? $response->assertRedirect(route('dashboard'))
        : $response->assertStatus($expectedStatus);
    expect(Workspace::query()->whereKey($workspace->id)->exists())->toBe($expectedStatus !== 302);
})->with([
    'owner' => [WorkspaceRole::Owner, 302],
    'admin' => [WorkspaceRole::Admin, 403],
    'member' => [WorkspaceRole::Member, 403],
]);
```

Modify `tests/Feature/DashboardTest.php` — rename `test_authenticated_users_can_visit_the_dashboard` to `test_authenticated_users_without_workspace_are_sent_to_workspace_creation` and replace its assertion with `$response->assertRedirect(route('workspaces.create'));`.

- [ ] **Step 2: Run to verify failure**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Workspaces/WorkspacesTest.php tests/Feature/DashboardTest.php`
Expected: FAIL — routes not defined.

- [ ] **Step 3: Backend**

`app/Http/Middleware/RememberCurrentWorkspace.php`:

```php
<?php

namespace App\Http\Middleware;

use App\Models\Workspace;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class RememberCurrentWorkspace
{
    public function handle(Request $request, Closure $next): Response
    {
        $workspace = $request->route('workspace');
        $user = $request->user();

        if (! $workspace instanceof Workspace) {
            return $next($request);
        }

        if ($user->current_workspace_id !== $workspace->id) {
            $user->forceFill(['current_workspace_id' => $workspace->id])->save();
        }

        return $next($request);
    }
}
```

`app/Http/Controllers/CurrentWorkspaceController.php`:

```php
<?php

namespace App\Http\Controllers;

use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

class CurrentWorkspaceController extends Controller
{
    public function show(Request $request): RedirectResponse
    {
        $user = $request->user();

        $workspace = $user->workspaces()->whereKey($user->current_workspace_id)->first()
            ?? $user->workspaces()->orderBy('name')->first();

        if ($workspace === null) {
            return to_route('workspaces.create');
        }

        return to_route('workspaces.show', $workspace);
    }
}
```

`app/Http/Controllers/WorkspacesController.php`:

```php
<?php

namespace App\Http\Controllers;

use App\Actions\Workspaces\CreateWorkspace;
use App\Models\Workspace;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

class WorkspacesController extends Controller
{
    public function create(): Response
    {
        return Inertia::render('workspaces/create');
    }

    public function store(Request $request, CreateWorkspace $createWorkspace): RedirectResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:100'],
        ]);

        $workspace = $createWorkspace->handle($request->user(), $validated['name']);

        return to_route('workspaces.show', $workspace);
    }

    public function show(Workspace $workspace): Response
    {
        return Inertia::render('workspaces/show', [
            'workspace' => $workspace->only(['id', 'name', 'slug']),
        ]);
    }

    public function destroy(Workspace $workspace): RedirectResponse
    {
        Gate::authorize('delete', $workspace);

        $workspace->delete();

        return to_route('dashboard');
    }
}
```

Add `public function getRouteKeyName(): string { return 'slug'; }` to `Workspace` so `route('workspaces.show', $workspace)` produces the slug.

`routes/web.php` — replace the `dashboard` group with:

```php
Route::middleware(['auth', 'verified'])->group(function () {
    Route::get('dashboard', [CurrentWorkspaceController::class, 'show'])->name('dashboard');
    Route::get('workspaces/create', [WorkspacesController::class, 'create'])->name('workspaces.create');
    Route::post('workspaces', [WorkspacesController::class, 'store'])->name('workspaces.store');

    Route::prefix('w/{workspace}')
        ->middleware(['can:view,workspace', RememberCurrentWorkspace::class])
        ->scopeBindings()
        ->group(function () {
            Route::get('/', [WorkspacesController::class, 'show'])->name('workspaces.show');
            Route::delete('/', [WorkspacesController::class, 'destroy'])->name('workspaces.destroy');
        });
});
```

`HandleInertiaRequests::share()` — add:

```php
'workspaces' => fn () => $request->user()?->workspaces()
    ->orderBy('name')
    ->get()
    ->map(fn (Workspace $workspace) => $workspace->only(['id', 'name', 'slug']))
    ->all() ?? [],
'currentWorkspace' => fn () => $this->currentWorkspace($request),
```

and:

```php
/**
 * @return array{
 *     id: string,
 *     name: string,
 *     slug: string,
 *     role: string
 * }|null
 */
private function currentWorkspace(Request $request): ?array
{
    $user = $request->user();
    $workspace = $request->route('workspace');

    if ($user === null) {
        return null;
    }

    if (! $workspace instanceof Workspace) {
        $workspace = $user->currentWorkspace;
    }

    $role = $workspace === null ? null : $user->roleIn($workspace);

    if ($role === null) {
        return null;
    }

    return [
        ...$workspace->only(['id', 'name', 'slug']),
        'role' => $role->value,
    ];
}
```

- [ ] **Step 4: Frontend**

`resources/js/types/workspaces.ts`:

```ts
export type WorkspaceRole = 'owner' | 'admin' | 'member';

export type WorkspaceSummary = {
    id: string;
    name: string;
    slug: string;
};

export type CurrentWorkspace = WorkspaceSummary & {
    role: WorkspaceRole;
};
```

Add `export type * from './workspaces';` to `resources/js/types/index.ts`; in `global.d.ts` add `workspaces: WorkspaceSummary[]; currentWorkspace: CurrentWorkspace | null;` to `sharedPageProps` (import the types).

`resources/js/pages/workspaces/create.tsx`:

```tsx
import { Form, Head } from '@inertiajs/react';
import WorkspacesController from '@/actions/App/Http/Controllers/WorkspacesController';
import Heading from '@/components/heading';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useTrans } from '@/hooks/use-trans';

export default function CreateWorkspace() {
    const { t } = useTrans();

    return (
        <>
            <Head title={t('Create a workspace')} />
            <div className="mx-auto w-full max-w-md space-y-6 p-4">
                <Heading
                    title={t('Create a workspace')}
                    description={t('A workspace groups your teams and their retrospectives.')}
                />
                <Form {...WorkspacesController.store.form()} className="space-y-4">
                    {({ processing, errors }) => (
                        <>
                            <div className="grid gap-2">
                                <Label htmlFor="name">{t('Workspace name')}</Label>
                                <Input id="name" name="name" required autoFocus maxLength={100} />
                                <InputError message={errors.name} />
                            </div>
                            <Button disabled={processing}>{t('Create workspace')}</Button>
                        </>
                    )}
                </Form>
            </div>
        </>
    );
}
```

`resources/js/pages/workspaces/show.tsx` (Task 9 fills in teams):

```tsx
import { Head } from '@inertiajs/react';
import Heading from '@/components/heading';
import { useTrans } from '@/hooks/use-trans';
import type { WorkspaceSummary } from '@/types';

type Props = {
    workspace: WorkspaceSummary;
};

export default function ShowWorkspace({ workspace }: Props) {
    const { t } = useTrans();

    return (
        <>
            <Head title={workspace.name} />
            <div className="space-y-6 p-4">
                <Heading title={workspace.name} description={t('Teams in this workspace')} />
            </div>
        </>
    );
}
```

`resources/js/components/workspace-switcher.tsx`:

```tsx
import { Link, usePage } from '@inertiajs/react';
import { Check, ChevronsUpDown, Plus } from 'lucide-react';
import WorkspacesController from '@/actions/App/Http/Controllers/WorkspacesController';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { SidebarMenuButton } from '@/components/ui/sidebar';
import { useTrans } from '@/hooks/use-trans';

export function WorkspaceSwitcher() {
    const { workspaces, currentWorkspace } = usePage().props;
    const { t } = useTrans();

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <SidebarMenuButton className="justify-between">
                    <span className="truncate">{currentWorkspace?.name ?? t('Select a workspace')}</span>
                    <ChevronsUpDown className="size-4" />
                </SidebarMenuButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
                {workspaces.map((workspace) => (
                    <DropdownMenuItem key={workspace.id} asChild>
                        <Link href={WorkspacesController.show(workspace.slug)}>
                            <span className="flex-1 truncate">{workspace.name}</span>
                            {workspace.id === currentWorkspace?.id && <Check className="size-4" />}
                        </Link>
                    </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                    <Link href={WorkspacesController.create()}>
                        <Plus className="size-4" />
                        {t('New workspace')}
                    </Link>
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
```

`app-sidebar.tsx` — add a `<SidebarMenuItem><WorkspaceSwitcher /></SidebarMenuItem>` under the logo item in `SidebarHeader`. Replace the `Dashboard` nav item with `{ title: 'Teams', href: currentWorkspace ? WorkspacesController.show(currentWorkspace.slug) : dashboard(), icon: LayoutGrid }` built inside the component (read `currentWorkspace` via `usePage().props`).

Delete `resources/js/pages/dashboard.tsx` (the route no longer renders it).

Add all new keys (`Create a workspace`, `A workspace groups your teams and their retrospectives.`, `Workspace name`, `Create workspace`, `Teams in this workspace`, `Select a workspace`, `New workspace`, `Teams`) to the four JSON files with translations.

- [ ] **Step 5: Run tests**

Run: `vendor/bin/sail artisan test --compact`
Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
vendor/bin/sail bin pint --dirty --format agent
vendor/bin/sail artisan wayfinder:generate --with-form && npm run types:check && npm run check
git add -A && git commit -m "feat: add workspace onboarding, home page and switcher

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Workspace invitations model and actions

**Files:**
- Create: migration `create_workspace_invitations_table`, `app/Models/WorkspaceInvitation.php`, `database/factories/WorkspaceInvitationFactory.php`
- Create: `app/Actions/Workspaces/IssuedInvitation.php`, `app/Actions/Workspaces/CreateWorkspaceInvitation.php`, `app/Actions/Workspaces/AcceptWorkspaceInvitation.php`
- Modify: `app/Models/Workspace.php` (add `invitations()`)
- Test: `tests/Feature/Workspaces/WorkspaceInvitationModelTest.php`

**Interfaces:**
- Consumes: `Workspace`, `WorkspaceRole`, `User::roleIn()` (Task 4).
- Produces:
  - `WorkspaceInvitation` fields: `id`, `workspace_id`, `email`, `role` (`WorkspaceRole`), `token_hash`, `invited_by_id`, `expires_at`, `accepted_at`; relations `workspace()`, `invitedBy()`.
  - `WorkspaceInvitation::findByToken(?string $token): ?WorkspaceInvitation`
  - `WorkspaceInvitation::isPending(): bool`, `WorkspaceInvitation::matchesEmail(string $email): bool`
  - `Workspace::invitations(): HasMany<WorkspaceInvitation>`
  - `IssuedInvitation { public WorkspaceInvitation $invitation; public string $token; }`
  - `CreateWorkspaceInvitation::handle(Workspace $workspace, User $inviter, string $email, WorkspaceRole $role): IssuedInvitation`
  - `AcceptWorkspaceInvitation::handle(WorkspaceInvitation $invitation, User $user): void`
  - `WorkspaceInvitationFactory::withToken(string $token): static`, `::expired(): static`, `::accepted(): static`

- [ ] **Step 1: Write the failing test**

`vendor/bin/sail artisan make:test --pest Workspaces/WorkspaceInvitationModelTest`:

```php
<?php

use App\Actions\Workspaces\AcceptWorkspaceInvitation;
use App\Actions\Workspaces\CreateWorkspaceInvitation;
use App\Enums\WorkspaceRole;
use App\Models\User;
use App\Models\Workspace;
use App\Models\WorkspaceInvitation;

it('issues an invitation that can be found by its plain token only', function () {
    $inviter = User::factory()->create();
    $workspace = Workspace::factory()->withMember($inviter, WorkspaceRole::Owner)->create();

    $issued = app(CreateWorkspaceInvitation::class)->handle($workspace, $inviter, 'new@example.com', WorkspaceRole::Admin);

    expect($issued->invitation->token_hash)->not->toBe($issued->token)
        ->and(WorkspaceInvitation::findByToken($issued->token)?->id)->toBe($issued->invitation->id)
        ->and(WorkspaceInvitation::findByToken('wrong'))->toBeNull()
        ->and(WorkspaceInvitation::findByToken(null))->toBeNull()
        ->and($issued->invitation->role)->toBe(WorkspaceRole::Admin)
        ->and($issued->invitation->expires_at->isFuture())->toBeTrue();
});

it('replaces a previous pending invitation for the same email', function () {
    $inviter = User::factory()->create();
    $workspace = Workspace::factory()->withMember($inviter, WorkspaceRole::Owner)->create();
    $createInvitation = app(CreateWorkspaceInvitation::class);

    $first = $createInvitation->handle($workspace, $inviter, 'new@example.com', WorkspaceRole::Member);
    $second = $createInvitation->handle($workspace, $inviter, 'NEW@example.com', WorkspaceRole::Admin);

    expect($workspace->invitations()->count())->toBe(1)
        ->and(WorkspaceInvitation::findByToken($first->token))->toBeNull()
        ->and(WorkspaceInvitation::findByToken($second->token))->not->toBeNull();
});

it('matches emails case-insensitively', function () {
    $invitation = WorkspaceInvitation::factory()->create(['email' => 'Bob@Example.com']);

    expect($invitation->matchesEmail('bob@example.com'))->toBeTrue()
        ->and($invitation->matchesEmail('alice@example.com'))->toBeFalse();
});

it('is only pending while unexpired and unaccepted', function () {
    expect(WorkspaceInvitation::factory()->create()->isPending())->toBeTrue()
        ->and(WorkspaceInvitation::factory()->expired()->create()->isPending())->toBeFalse()
        ->and(WorkspaceInvitation::factory()->accepted()->create()->isPending())->toBeFalse();
});

it('adds the invitee with the invited role and marks the invitation accepted', function () {
    $invitation = WorkspaceInvitation::factory()->create(['role' => WorkspaceRole::Admin]);
    $user = User::factory()->create();

    app(AcceptWorkspaceInvitation::class)->handle($invitation, $user);

    expect($user->roleIn($invitation->workspace))->toBe(WorkspaceRole::Admin)
        ->and($invitation->fresh()->accepted_at)->not->toBeNull()
        ->and($user->fresh()->current_workspace_id)->toBe($invitation->workspace_id);
});

it('never changes the role of an existing member', function () {
    $user = User::factory()->create();
    $workspace = Workspace::factory()->withMember($user, WorkspaceRole::Owner)->create();
    $invitation = WorkspaceInvitation::factory()->for($workspace)->create(['role' => WorkspaceRole::Member]);

    app(AcceptWorkspaceInvitation::class)->handle($invitation, $user);

    expect($user->roleIn($workspace))->toBe(WorkspaceRole::Owner);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Workspaces/WorkspaceInvitationModelTest.php`
Expected: FAIL — classes not found.

- [ ] **Step 3: Implement**

Migration (`make:migration create_workspace_invitations_table`), `up()` only:

```php
Schema::create('workspace_invitations', function (Blueprint $table) {
    $table->uuid('id')->primary();
    $table->foreignUuid('workspace_id')->constrained()->cascadeOnDelete();
    $table->string('email');
    $table->string('role');
    $table->string('token_hash', 64)->unique();
    $table->foreignUuid('invited_by_id')->nullable()->constrained('users')->nullOnDelete();
    $table->timestamp('expires_at');
    $table->timestamp('accepted_at')->nullable();
    $table->timestamps();

    $table->index(['workspace_id', 'email']);
});
```

`app/Models/WorkspaceInvitation.php`:

```php
<?php

namespace App\Models;

use App\Enums\WorkspaceRole;
use Database\Factories\WorkspaceInvitationFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;

/**
 * @property string $id
 * @property string $workspace_id
 * @property string $email
 * @property WorkspaceRole $role
 * @property string $token_hash
 * @property string|null $invited_by_id
 * @property Carbon $expires_at
 * @property Carbon|null $accepted_at
 * @property-read Workspace $workspace
 */
#[Fillable(['email', 'role', 'token_hash', 'invited_by_id', 'expires_at', 'accepted_at'])]
class WorkspaceInvitation extends Model
{
    /** @use HasFactory<WorkspaceInvitationFactory> */
    use HasFactory;

    use HasUuids;

    public static function hashToken(string $token): string
    {
        return hash('sha256', $token);
    }

    public static function findByToken(?string $token): ?self
    {
        if ($token === null || $token === '') {
            return null;
        }

        return static::query()->where('token_hash', static::hashToken($token))->first();
    }

    /** @return BelongsTo<Workspace, $this> */
    public function workspace(): BelongsTo
    {
        return $this->belongsTo(Workspace::class);
    }

    /** @return BelongsTo<User, $this> */
    public function invitedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'invited_by_id');
    }

    public function isPending(): bool
    {
        if ($this->accepted_at !== null) {
            return false;
        }

        return $this->expires_at->isFuture();
    }

    public function matchesEmail(string $email): bool
    {
        return Str::lower($this->email) === Str::lower($email);
    }

    protected function casts(): array
    {
        return [
            'role' => WorkspaceRole::class,
            'expires_at' => 'datetime',
            'accepted_at' => 'datetime',
        ];
    }
}
```

`Workspace::invitations()`:

```php
/** @return HasMany<WorkspaceInvitation, $this> */
public function invitations(): HasMany
{
    return $this->hasMany(WorkspaceInvitation::class);
}
```

`database/factories/WorkspaceInvitationFactory.php`:

```php
<?php

namespace Database\Factories;

use App\Enums\WorkspaceRole;
use App\Models\Workspace;
use App\Models\WorkspaceInvitation;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<WorkspaceInvitation>
 */
class WorkspaceInvitationFactory extends Factory
{
    public function definition(): array
    {
        return [
            'workspace_id' => Workspace::factory(),
            'email' => fake()->unique()->safeEmail(),
            'role' => WorkspaceRole::Member,
            'token_hash' => WorkspaceInvitation::hashToken(Str::random(40)),
            'expires_at' => now()->addDays(7),
            'accepted_at' => null,
        ];
    }

    public function withToken(string $token): static
    {
        return $this->state(fn () => ['token_hash' => WorkspaceInvitation::hashToken($token)]);
    }

    public function expired(): static
    {
        return $this->state(fn () => ['expires_at' => now()->subMinute()]);
    }

    public function accepted(): static
    {
        return $this->state(fn () => ['accepted_at' => now()]);
    }
}
```

`app/Actions/Workspaces/IssuedInvitation.php`:

```php
<?php

namespace App\Actions\Workspaces;

use App\Models\WorkspaceInvitation;

class IssuedInvitation
{
    public function __construct(
        public WorkspaceInvitation $invitation,
        public string $token,
    ) {}
}
```

`app/Actions/Workspaces/CreateWorkspaceInvitation.php`:

```php
<?php

namespace App\Actions\Workspaces;

use App\Enums\WorkspaceRole;
use App\Models\User;
use App\Models\Workspace;
use App\Models\WorkspaceInvitation;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class CreateWorkspaceInvitation
{
    public const ValidForDays = 7;

    public function handle(Workspace $workspace, User $inviter, string $email, WorkspaceRole $role): IssuedInvitation
    {
        $token = Str::random(40);

        $invitation = DB::transaction(function () use ($workspace, $inviter, $email, $role, $token): WorkspaceInvitation {
            $workspace->invitations()
                ->whereRaw('lower(email) = ?', [Str::lower($email)])
                ->whereNull('accepted_at')
                ->delete();

            return $workspace->invitations()->create([
                'email' => $email,
                'role' => $role,
                'token_hash' => WorkspaceInvitation::hashToken($token),
                'invited_by_id' => $inviter->id,
                'expires_at' => now()->addDays(self::ValidForDays),
            ]);
        });

        return new IssuedInvitation($invitation, $token);
    }
}
```

`app/Actions/Workspaces/AcceptWorkspaceInvitation.php`:

```php
<?php

namespace App\Actions\Workspaces;

use App\Models\User;
use App\Models\WorkspaceInvitation;
use Illuminate\Support\Facades\DB;

class AcceptWorkspaceInvitation
{
    public function handle(WorkspaceInvitation $invitation, User $user): void
    {
        DB::transaction(function () use ($invitation, $user): void {
            $workspace = $invitation->workspace;

            if (! $user->belongsToWorkspace($workspace)) {
                $workspace->members()->attach($user, ['role' => $invitation->role->value]);
            }

            $invitation->update(['accepted_at' => now()]);

            $user->forceFill(['current_workspace_id' => $workspace->id])->save();
        });
    }
}
```

- [ ] **Step 4: Run tests**

Run: `vendor/bin/sail artisan migrate --no-interaction && vendor/bin/sail artisan test --compact tests/Feature/Workspaces/WorkspaceInvitationModelTest.php`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
vendor/bin/sail bin pint --dirty --format agent
git add -A && git commit -m "feat: add hashed-token workspace invitations

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: Signup gate

**Files:**
- Create: `app/Enums/SignupMode.php`, `app/Actions/Auth/SignupGate.php`
- Modify: `config/skrum.php`, `.env.example`
- Test: `tests/Feature/Auth/SignupGateTest.php`

**Interfaces:**
- Consumes: `WorkspaceInvitation::isPending()`, `::matchesEmail()` (Task 6).
- Produces:
  - `enum SignupMode: string { Open = 'open'; Invite = 'invite'; Domain = 'domain'; public static function fromConfig(): self }`
  - `config('skrum.signup_mode')`, `config('skrum.allowed_email_domains')` (array of lowercase domains)
  - `SignupGate::allows(string $email, ?WorkspaceInvitation $invitation = null): bool`
  - `SignupGate::canShowRegistration(?WorkspaceInvitation $invitation = null): bool`

- [ ] **Step 1: Write the failing test**

`vendor/bin/sail artisan make:test --pest Auth/SignupGateTest`:

```php
<?php

use App\Actions\Auth\SignupGate;
use App\Models\User;
use App\Models\WorkspaceInvitation;

function signupGate(): SignupGate
{
    return app(SignupGate::class);
}

it('always allows the very first user', function (string $mode) {
    config(['skrum.signup_mode' => $mode, 'skrum.allowed_email_domains' => []]);

    expect(signupGate()->allows('first@example.com'))->toBeTrue()
        ->and(signupGate()->canShowRegistration())->toBeTrue();
})->with(['open', 'invite', 'domain']);

it('decides by mode once users exist', function (string $mode, string $email, bool $expected) {
    User::factory()->create();
    config(['skrum.signup_mode' => $mode, 'skrum.allowed_email_domains' => ['acme.test']]);

    expect(signupGate()->allows($email))->toBe($expected);
})->with([
    'open allows anyone' => ['open', 'someone@else.test', true],
    'invite refuses without invitation' => ['invite', 'someone@acme.test', false],
    'domain allows listed domain' => ['domain', 'someone@acme.test', true],
    'domain allows listed domain case-insensitively' => ['domain', 'someone@ACME.test', true],
    'domain refuses other domains' => ['domain', 'someone@else.test', false],
    'unknown mode behaves like invite' => ['nonsense', 'someone@acme.test', false],
]);

it('allows a matching pending invitation in invite and domain modes', function (string $mode) {
    User::factory()->create();
    config(['skrum.signup_mode' => $mode, 'skrum.allowed_email_domains' => ['acme.test']]);
    $invitation = WorkspaceInvitation::factory()->create(['email' => 'Guest@Else.test']);

    expect(signupGate()->allows('guest@else.test', $invitation))->toBeTrue()
        ->and(signupGate()->canShowRegistration($invitation))->toBeTrue();
})->with(['invite', 'domain']);

it('refuses invitations that do not match, expired or were accepted', function (WorkspaceInvitation $invitation) {
    User::factory()->create();
    config(['skrum.signup_mode' => 'invite']);

    expect(signupGate()->allows('guest@else.test', $invitation))->toBeFalse();
})->with([
    'other email' => fn () => WorkspaceInvitation::factory()->create(['email' => 'other@else.test']),
    'expired' => fn () => WorkspaceInvitation::factory()->expired()->create(['email' => 'guest@else.test']),
    'accepted' => fn () => WorkspaceInvitation::factory()->accepted()->create(['email' => 'guest@else.test']),
]);

it('hides registration in invite mode without a pending invitation', function () {
    User::factory()->create();
    config(['skrum.signup_mode' => 'invite']);

    expect(signupGate()->canShowRegistration())->toBeFalse()
        ->and(signupGate()->canShowRegistration(WorkspaceInvitation::factory()->expired()->create()))->toBeFalse();
});

it('shows registration in open and domain modes', function (string $mode) {
    User::factory()->create();
    config(['skrum.signup_mode' => $mode]);

    expect(signupGate()->canShowRegistration())->toBeTrue();
})->with(['open', 'domain']);
```

- [ ] **Step 2: Run to verify failure**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Auth/SignupGateTest.php`
Expected: FAIL — `SignupGate` not found.

- [ ] **Step 3: Implement**

`config/skrum.php` — add:

```php
'signup_mode' => env('SKRUM_SIGNUP_MODE', 'invite'),

'allowed_email_domains' => array_values(array_filter(array_map(
    fn (string $domain) => strtolower(trim($domain)),
    explode(',', (string) env('SKRUM_ALLOWED_EMAIL_DOMAINS', '')),
))),
```

`.env.example` — append:

```
SKRUM_SIGNUP_MODE=invite
SKRUM_ALLOWED_EMAIL_DOMAINS=
```

`app/Enums/SignupMode.php`:

```php
<?php

namespace App\Enums;

enum SignupMode: string
{
    case Open = 'open';
    case Invite = 'invite';
    case Domain = 'domain';

    public static function fromConfig(): self
    {
        return self::tryFrom((string) config('skrum.signup_mode')) ?? self::Invite;
    }
}
```

`app/Actions/Auth/SignupGate.php`:

```php
<?php

namespace App\Actions\Auth;

use App\Enums\SignupMode;
use App\Models\User;
use App\Models\WorkspaceInvitation;
use Illuminate\Support\Str;

class SignupGate
{
    public function allows(string $email, ?WorkspaceInvitation $invitation = null): bool
    {
        if ($this->isFirstUser()) {
            return true;
        }

        if ($this->isUsableInvitation($invitation) && $invitation->matchesEmail($email)) {
            return true;
        }

        return match (SignupMode::fromConfig()) {
            SignupMode::Open => true,
            SignupMode::Invite => false,
            SignupMode::Domain => $this->hasAllowedDomain($email),
        };
    }

    public function canShowRegistration(?WorkspaceInvitation $invitation = null): bool
    {
        if ($this->isFirstUser()) {
            return true;
        }

        if ($this->isUsableInvitation($invitation)) {
            return true;
        }

        return SignupMode::fromConfig() !== SignupMode::Invite;
    }

    private function isFirstUser(): bool
    {
        return User::query()->doesntExist();
    }

    private function isUsableInvitation(?WorkspaceInvitation $invitation): bool
    {
        return $invitation !== null && $invitation->isPending();
    }

    private function hasAllowedDomain(string $email): bool
    {
        $domain = Str::lower(Str::afterLast($email, '@'));

        return in_array($domain, config('skrum.allowed_email_domains'), true);
    }
}
```

- [ ] **Step 4: Run tests**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Auth/SignupGateTest.php`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
vendor/bin/sail bin pint --dirty --format agent
git add -A && git commit -m "feat: add configurable signup gate (open, invite, domain)

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: Registration through the gate and invitation links

**Files:**
- Create: `app/Http/Controllers/InvitationLinksController.php`, `app/Http/Controllers/InvitationAcceptancesController.php`, `resources/js/pages/invitations/show.tsx`
- Modify: `app/Actions/Fortify/CreateNewUser.php`, `app/Providers/FortifyServiceProvider.php`, `routes/web.php`, `resources/js/pages/auth/register.tsx`, `resources/js/pages/auth/login.tsx`, `resources/js/pages/welcome.tsx`, `lang/*.json`
- Modify: `tests/Feature/Auth/RegistrationTest.php` (existing tests must set `skrum.signup_mode` to `open` in `setUp()` or rely on the first-user rule — they create no users first, so they already pass; leave as is unless they fail)
- Test: `tests/Feature/Auth/InvitationRegistrationTest.php`

**Interfaces:**
- Consumes: `SignupGate` (Task 7), `WorkspaceInvitation::findByToken()`, `AcceptWorkspaceInvitation` (Task 6).
- Produces:
  - Routes: `invitations.show` (GET `/invitations/{token}`, public), `invitations.acceptance.store` (POST `/invitations/{token}/acceptance`, auth).
  - Session key `invitation_token` (plain token of the invitation being followed). Plan 2 (SSO) reads it.
  - Register page props: `passwordRules`, `invitationEmail: string | null`. Login and welcome pages receive `canRegister: boolean`.

- [ ] **Step 1: Write the failing test**

`vendor/bin/sail artisan make:test --pest Auth/InvitationRegistrationTest`:

```php
<?php

use App\Enums\WorkspaceRole;
use App\Models\User;
use App\Models\WorkspaceInvitation;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    User::factory()->create();
    config(['skrum.signup_mode' => 'invite']);
});

function registrationPayload(string $email): array
{
    return [
        'name' => 'New Person',
        'email' => $email,
        'password' => 'password',
        'password_confirmation' => 'password',
    ];
}

it('makes the first user an instance admin', function () {
    User::query()->delete();

    $this->post(route('register.store'), registrationPayload('first@example.com'));

    expect(User::sole()->is_instance_admin)->toBeTrue();
});

it('does not make later users instance admins', function () {
    config(['skrum.signup_mode' => 'open']);

    $this->post(route('register.store'), registrationPayload('later@example.com'));

    expect(User::firstWhere('email', 'later@example.com')->is_instance_admin)->toBeFalse();
});

it('hides the registration page in invite mode', function () {
    $this->get(route('register'))->assertForbidden();
});

it('refuses registration in invite mode without an invitation', function () {
    $this->post(route('register.store'), registrationPayload('stranger@example.com'))
        ->assertSessionHasErrors('email');

    $this->assertGuest();
});

it('registers an invited person, verifies the email and joins the workspace', function () {
    $invitation = WorkspaceInvitation::factory()->withToken('secret-token')->create([
        'email' => 'Invited@Example.com',
        'role' => WorkspaceRole::Admin,
    ]);

    $this->get(route('invitations.show', 'secret-token'))->assertOk();
    $this->get(route('register'))
        ->assertInertia(fn (Assert $page) => $page->where('invitationEmail', 'Invited@Example.com'));

    $this->post(route('register.store'), registrationPayload('invited@example.com'));

    $user = User::firstWhere('email', 'invited@example.com');

    $this->assertAuthenticatedAs($user);
    expect($user->email_verified_at)->not->toBeNull()
        ->and($user->roleIn($invitation->workspace))->toBe(WorkspaceRole::Admin)
        ->and($invitation->fresh()->accepted_at)->not->toBeNull()
        ->and(session('invitation_token'))->toBeNull();
});

it('refuses an invitation token used with another email', function () {
    WorkspaceInvitation::factory()->withToken('secret-token')->create(['email' => 'invited@example.com']);

    $this->get(route('invitations.show', 'secret-token'));

    $this->post(route('register.store'), registrationPayload('intruder@example.com'))
        ->assertSessionHasErrors('email');
});

it('shows expired invitations as expired and keeps registration closed', function () {
    WorkspaceInvitation::factory()->expired()->withToken('old-token')->create();

    $this->get(route('invitations.show', 'old-token'))
        ->assertInertia(fn (Assert $page) => $page
            ->component('invitations/show')
            ->where('isExpired', true)
            ->where('canRegister', false));

    $this->get(route('register'))->assertForbidden();
});

it('returns not found for unknown invitation tokens', function () {
    $this->get(route('invitations.show', 'unknown'))->assertNotFound();
});

it('lets a logged in user with the invited email accept', function () {
    $user = User::factory()->create(['email' => 'member@example.com']);
    $invitation = WorkspaceInvitation::factory()->withToken('secret-token')->create(['email' => 'MEMBER@example.com']);

    $this->actingAs($user)
        ->post(route('invitations.acceptance.store', 'secret-token'))
        ->assertRedirect(route('workspaces.show', $invitation->workspace));

    expect($user->roleIn($invitation->workspace))->toBe(WorkspaceRole::Member);
});

it('forbids accepting an invitation addressed to someone else', function () {
    $user = User::factory()->create(['email' => 'member@example.com']);
    WorkspaceInvitation::factory()->withToken('secret-token')->create(['email' => 'other@example.com']);

    $this->actingAs($user)
        ->post(route('invitations.acceptance.store', 'secret-token'))
        ->assertForbidden();
});

it('refuses to accept an expired invitation', function () {
    $user = User::factory()->create(['email' => 'member@example.com']);
    WorkspaceInvitation::factory()->expired()->withToken('secret-token')->create(['email' => 'member@example.com']);

    $this->actingAs($user)
        ->post(route('invitations.acceptance.store', 'secret-token'))
        ->assertStatus(410);
});

it('tells the login page whether registration is available', function (string $mode, bool $canRegister) {
    config(['skrum.signup_mode' => $mode]);

    $this->get(route('login'))
        ->assertInertia(fn (Assert $page) => $page->where('canRegister', $canRegister));
})->with([
    ['invite', false],
    ['open', true],
]);
```

- [ ] **Step 2: Run to verify failure**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Auth/InvitationRegistrationTest.php`
Expected: FAIL — routes missing, registration not gated.

- [ ] **Step 3: Implement backend**

`app/Actions/Fortify/CreateNewUser.php`:

```php
<?php

namespace App\Actions\Fortify;

use App\Actions\Auth\SignupGate;
use App\Actions\Workspaces\AcceptWorkspaceInvitation;
use App\Concerns\PasswordValidationRules;
use App\Concerns\ProfileValidationRules;
use App\Models\User;
use App\Models\WorkspaceInvitation;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\ValidationException;
use Laravel\Fortify\Contracts\CreatesNewUsers;

class CreateNewUser implements CreatesNewUsers
{
    use PasswordValidationRules;
    use ProfileValidationRules;

    /**
     * @param  array<string, string>  $input
     */
    public function create(array $input): User
    {
        Validator::make($input, [
            ...$this->profileRules(),
            'password' => $this->passwordRules(),
        ])->validate();

        $invitation = WorkspaceInvitation::findByToken(request()->session()->get('invitation_token'));

        if (! app(SignupGate::class)->allows($input['email'], $invitation)) {
            throw ValidationException::withMessages([
                'email' => __('Signups are restricted on this instance.'),
            ]);
        }

        return DB::transaction(function () use ($input, $invitation): User {
            $isFirstUser = User::query()->doesntExist();

            $user = User::create([
                'name' => $input['name'],
                'email' => $input['email'],
                'password' => $input['password'],
                'locale' => app()->getLocale(),
            ]);

            $user->forceFill(['is_instance_admin' => $isFirstUser])->save();

            if ($invitation?->isPending() && $invitation->matchesEmail($user->email)) {
                $user->forceFill(['email_verified_at' => now()])->save();

                app(AcceptWorkspaceInvitation::class)->handle($invitation, $user);

                request()->session()->forget('invitation_token');
            }

            return $user;
        });
    }
}
```

`FortifyServiceProvider::configureViews()` — replace `registerView` and extend `loginView`:

```php
Fortify::loginView(fn (Request $request) => Inertia::render('auth/login', [
    'canResetPassword' => Features::enabled(Features::resetPasswords()),
    'canRegister' => app(SignupGate::class)->canShowRegistration($this->followedInvitation($request)),
    'status' => $request->session()->get('status'),
]));

Fortify::registerView(function (Request $request) {
    $invitation = $this->followedInvitation($request);

    abort_unless(app(SignupGate::class)->canShowRegistration($invitation), 403);

    return Inertia::render('auth/register', [
        'passwordRules' => Password::defaults()->toPasswordRulesString(),
        'invitationEmail' => $invitation?->isPending() ? $invitation->email : null,
    ]);
});
```

and add:

```php
private function followedInvitation(Request $request): ?WorkspaceInvitation
{
    return WorkspaceInvitation::findByToken($request->session()->get('invitation_token'));
}
```

`routes/web.php` — pass `canRegister` to welcome: replace `Route::inertia('/', 'welcome')->name('home');` with

```php
Route::get('/', fn () => Inertia::render('welcome', [
    'canRegister' => app(SignupGate::class)->canShowRegistration(),
]))->name('home');
```

and add:

```php
Route::get('invitations/{token}', [InvitationLinksController::class, 'show'])->name('invitations.show');

Route::post('invitations/{token}/acceptance', [InvitationAcceptancesController::class, 'store'])
    ->middleware('auth')
    ->name('invitations.acceptance.store');
```

`app/Http/Controllers/InvitationLinksController.php`:

```php
<?php

namespace App\Http\Controllers;

use App\Actions\Auth\SignupGate;
use App\Models\WorkspaceInvitation;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class InvitationLinksController extends Controller
{
    public function show(Request $request, string $token, SignupGate $signupGate): Response
    {
        $invitation = WorkspaceInvitation::findByToken($token);

        abort_if($invitation === null, 404);

        $user = $request->user();

        $request->session()->put('invitation_token', $token);

        if ($user === null) {
            redirect()->setIntendedUrl($request->fullUrl());
        }

        return Inertia::render('invitations/show', [
            'token' => $token,
            'workspaceName' => $invitation->workspace->name,
            'email' => $invitation->email,
            'isExpired' => ! $invitation->isPending(),
            'isLoggedIn' => $user !== null,
            'emailMatches' => $user !== null && $invitation->matchesEmail($user->email),
            'canRegister' => $signupGate->canShowRegistration($invitation),
        ]);
    }
}
```

`app/Http/Controllers/InvitationAcceptancesController.php`:

```php
<?php

namespace App\Http\Controllers;

use App\Actions\Workspaces\AcceptWorkspaceInvitation;
use App\Models\WorkspaceInvitation;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

class InvitationAcceptancesController extends Controller
{
    public function store(Request $request, string $token, AcceptWorkspaceInvitation $acceptInvitation): RedirectResponse
    {
        $invitation = WorkspaceInvitation::findByToken($token);

        abort_if($invitation === null, 404);
        abort_unless($invitation->isPending(), 410);
        abort_unless($invitation->matchesEmail($request->user()->email), 403);

        $acceptInvitation->handle($invitation, $request->user());

        $request->session()->forget('invitation_token');

        return to_route('workspaces.show', $invitation->workspace);
    }
}
```

- [ ] **Step 4: Implement frontend**

`register.tsx` — accept `invitationEmail: string | null` prop; when set, render the email input with `defaultValue={invitationEmail}` and `readOnly`.

`login.tsx` — accept `canRegister: boolean` and wrap the "Don't have an account? Sign up" block in `{canRegister && (…)}`.

`welcome.tsx` — accept `canRegister: boolean` and render the register link only when true.

`resources/js/pages/invitations/show.tsx`:

```tsx
import { Form, Head, Link } from '@inertiajs/react';
import InvitationAcceptancesController from '@/actions/App/Http/Controllers/InvitationAcceptancesController';
import Heading from '@/components/heading';
import { Button } from '@/components/ui/button';
import { useTrans } from '@/hooks/use-trans';
import { login, register } from '@/routes';

type Props = {
    token: string;
    workspaceName: string;
    email: string;
    isExpired: boolean;
    isLoggedIn: boolean;
    emailMatches: boolean;
    canRegister: boolean;
};

export default function ShowInvitation({ token, workspaceName, email, isExpired, isLoggedIn, emailMatches, canRegister }: Props) {
    const { t } = useTrans();

    return (
        <>
            <Head title={t('Invitation')} />
            <div className="space-y-6">
                <Heading
                    title={t('Join :workspace', { workspace: workspaceName })}
                    description={t('This invitation was sent to :email.', { email })}
                />

                {isExpired && <p className="text-destructive">{t('This invitation has expired or was already used.')}</p>}

                {!isExpired && isLoggedIn && emailMatches && (
                    <Form {...InvitationAcceptancesController.store.form(token)}>
                        {({ processing }) => <Button disabled={processing}>{t('Accept invitation')}</Button>}
                    </Form>
                )}

                {!isExpired && isLoggedIn && !emailMatches && (
                    <p className="text-destructive">{t('You are logged in with another email address. Log out and sign in as :email to accept.', { email })}</p>
                )}

                {!isExpired && !isLoggedIn && (
                    <div className="flex gap-3">
                        <Button asChild>
                            <Link href={login()}>{t('Log in')}</Link>
                        </Button>
                        {canRegister && (
                            <Button variant="outline" asChild>
                                <Link href={register()}>{t('Create an account')}</Link>
                            </Button>
                        )}
                    </div>
                )}
            </div>
        </>
    );
}
```

In `resources/js/app.tsx` layout switch, add `case name.startsWith('invitations/'): return AuthLayout;` before the default.

Add new keys (`Signups are restricted on this instance.`, `Invitation`, `Join :workspace`, `This invitation was sent to :email.`, `This invitation has expired or was already used.`, `Accept invitation`, `You are logged in with another email address. Log out and sign in as :email to accept.`, `Create an account`) to the four JSON files.

- [ ] **Step 5: Run tests**

Run: `vendor/bin/sail artisan test --compact`
Expected: all PASS (including existing `RegistrationTest`, which registers the first user).

- [ ] **Step 6: Commit**

```bash
vendor/bin/sail bin pint --dirty --format agent
vendor/bin/sail artisan wayfinder:generate --with-form && npm run types:check && npm run check
git add -A && git commit -m "feat: gate registration and add invitation links

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 9: Teams and team membership

**Files:**
- Create: migrations `create_teams_table`, `create_team_user_table`; `app/Models/Team.php`; `database/factories/TeamFactory.php`; `app/Policies/TeamPolicy.php`; `app/Http/Controllers/TeamsController.php`; `app/Http/Controllers/TeamMembersController.php`; `resources/js/pages/teams/show.tsx`
- Modify: `app/Models/Workspace.php`, `app/Models/User.php`, `app/Http/Controllers/WorkspacesController.php`, `routes/web.php`, `resources/js/pages/workspaces/show.tsx`, `resources/js/types/workspaces.ts`, `lang/*.json`
- Test: `tests/Feature/Teams/TeamsTest.php`

**Interfaces:**
- Consumes: `Workspace`, `User::canManage()`, `User::belongsToWorkspace()` (Task 4), `w/{workspace}` route group (Task 5).
- Produces:
  - `Team` (`id`, `workspace_id`, `name`), relations `workspace()`, `members()`; `Workspace::teams()`, `User::teams()`
  - `Workspace::teamsVisibleTo(User $user): Collection<int, Team>`
  - `TeamPolicy::view|update|delete|manageMembers(User, Team): bool`, `TeamPolicy::create(User, Workspace): bool`
  - Routes (inside `w/{workspace}`): `teams.store` POST `teams`, `teams.show` GET `teams/{team}`, `teams.update` PATCH `teams/{team}`, `teams.destroy` DELETE `teams/{team}`, `teams.members.store` POST `teams/{team}/members`, `teams.members.destroy` DELETE `teams/{team}/members/{member}`
  - `TeamFactory::withMember(User $user): static`
  - TS type `TeamSummary { id: string; name: string }`
  - Plan 3 will add retros under `teams/{team}`.

- [ ] **Step 1: Write the failing test**

`vendor/bin/sail artisan make:test --pest Teams/TeamsTest`:

```php
<?php

use App\Enums\WorkspaceRole;
use App\Models\Team;
use App\Models\User;
use App\Models\Workspace;
use Inertia\Testing\AssertableInertia as Assert;

function workspaceWith(User $user, WorkspaceRole $role): Workspace
{
    return Workspace::factory()->withMember($user, $role)->create();
}

it('lets managers create teams', function (WorkspaceRole $role) {
    $user = User::factory()->create();
    $workspace = workspaceWith($user, $role);

    $this->actingAs($user)
        ->post(route('teams.store', $workspace), ['name' => 'Backend'])
        ->assertRedirect();

    expect($workspace->teams()->sole()->name)->toBe('Backend');
})->with([WorkspaceRole::Owner, WorkspaceRole::Admin]);

it('forbids members from creating teams', function () {
    $user = User::factory()->create();
    $workspace = workspaceWith($user, WorkspaceRole::Member);

    $this->actingAs($user)
        ->post(route('teams.store', $workspace), ['name' => 'Backend'])
        ->assertForbidden();
});

it('shows managers every team and members only their own', function () {
    $admin = User::factory()->create();
    $member = User::factory()->create();
    $workspace = Workspace::factory()
        ->withMember($admin, WorkspaceRole::Admin)
        ->withMember($member, WorkspaceRole::Member)
        ->create();
    Team::factory()->for($workspace)->withMember($member)->create(['name' => 'Mine']);
    Team::factory()->for($workspace)->create(['name' => 'Other']);

    $this->actingAs($admin)
        ->get(route('workspaces.show', $workspace))
        ->assertInertia(fn (Assert $page) => $page->has('teams', 2)->where('canManage', true));

    $this->actingAs($member)
        ->get(route('workspaces.show', $workspace))
        ->assertInertia(fn (Assert $page) => $page
            ->has('teams', 1)
            ->where('teams.0.name', 'Mine')
            ->where('canManage', false));
});

it('forbids members from opening teams they do not belong to', function () {
    $member = User::factory()->create();
    $workspace = workspaceWith($member, WorkspaceRole::Member);
    $team = Team::factory()->for($workspace)->create();

    $this->actingAs($member)->get(route('teams.show', [$workspace, $team]))->assertForbidden();
});

it('returns not found for a team of another workspace', function () {
    $admin = User::factory()->create();
    $workspace = workspaceWith($admin, WorkspaceRole::Admin);
    $foreignTeam = Team::factory()->create();

    $this->actingAs($admin)->get(route('teams.show', [$workspace, $foreignTeam]))->assertNotFound();
});

it('lets team members view their team', function () {
    $member = User::factory()->create();
    $workspace = workspaceWith($member, WorkspaceRole::Member);
    $team = Team::factory()->for($workspace)->withMember($member)->create();

    $this->actingAs($member)
        ->get(route('teams.show', [$workspace, $team]))
        ->assertInertia(fn (Assert $page) => $page
            ->component('teams/show')
            ->has('members', 1)
            ->where('canManage', false));
});

it('lets managers rename and delete teams', function () {
    $admin = User::factory()->create();
    $workspace = workspaceWith($admin, WorkspaceRole::Admin);
    $team = Team::factory()->for($workspace)->create();

    $this->actingAs($admin)->patch(route('teams.update', [$workspace, $team]), ['name' => 'Renamed']);
    expect($team->fresh()->name)->toBe('Renamed');

    $this->actingAs($admin)->delete(route('teams.destroy', [$workspace, $team]))
        ->assertRedirect(route('workspaces.show', $workspace));
    expect(Team::query()->whereKey($team->id)->exists())->toBeFalse();
});

it('lets managers add and remove workspace members from a team', function () {
    $admin = User::factory()->create();
    $colleague = User::factory()->create();
    $workspace = Workspace::factory()
        ->withMember($admin, WorkspaceRole::Admin)
        ->withMember($colleague, WorkspaceRole::Member)
        ->create();
    $team = Team::factory()->for($workspace)->create();

    $this->actingAs($admin)->post(route('teams.members.store', [$workspace, $team]), ['user_id' => $colleague->id]);
    expect($team->members()->whereKey($colleague->id)->exists())->toBeTrue();

    $this->actingAs($admin)->delete(route('teams.members.destroy', [$workspace, $team, $colleague]));
    expect($team->members()->whereKey($colleague->id)->exists())->toBeFalse();
});

it('refuses to add someone outside the workspace to a team', function () {
    $admin = User::factory()->create();
    $workspace = workspaceWith($admin, WorkspaceRole::Admin);
    $team = Team::factory()->for($workspace)->create();

    $this->actingAs($admin)
        ->post(route('teams.members.store', [$workspace, $team]), ['user_id' => User::factory()->create()->id])
        ->assertSessionHasErrors('user_id');
});

it('forbids members from managing team membership', function () {
    $member = User::factory()->create();
    $workspace = workspaceWith($member, WorkspaceRole::Member);
    $team = Team::factory()->for($workspace)->withMember($member)->create();

    $this->actingAs($member)
        ->post(route('teams.members.store', [$workspace, $team]), ['user_id' => $member->id])
        ->assertForbidden();
});
```

- [ ] **Step 2: Run to verify failure**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Teams/TeamsTest.php`
Expected: FAIL.

- [ ] **Step 3: Migrations, model, factory, policy**

`create_teams_table`:

```php
Schema::create('teams', function (Blueprint $table) {
    $table->uuid('id')->primary();
    $table->foreignUuid('workspace_id')->constrained()->cascadeOnDelete();
    $table->string('name');
    $table->timestamps();
});
```

`create_team_user_table`:

```php
Schema::create('team_user', function (Blueprint $table) {
    $table->foreignUuid('team_id')->constrained()->cascadeOnDelete();
    $table->foreignUuid('user_id')->constrained()->cascadeOnDelete();
    $table->timestamps();

    $table->primary(['team_id', 'user_id']);
});
```

`app/Models/Team.php`:

```php
<?php

namespace App\Models;

use Database\Factories\TeamFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

/**
 * @property string $id
 * @property string $workspace_id
 * @property string $name
 * @property-read Workspace $workspace
 */
#[Fillable(['name'])]
class Team extends Model
{
    /** @use HasFactory<TeamFactory> */
    use HasFactory;

    use HasUuids;

    /** @return BelongsTo<Workspace, $this> */
    public function workspace(): BelongsTo
    {
        return $this->belongsTo(Workspace::class);
    }

    /** @return BelongsToMany<User, $this> */
    public function members(): BelongsToMany
    {
        return $this->belongsToMany(User::class)->withTimestamps();
    }

    public function hasMember(User $user): bool
    {
        return $this->members()->whereKey($user->id)->exists();
    }
}
```

`Workspace`:

```php
/** @return HasMany<Team, $this> */
public function teams(): HasMany
{
    return $this->hasMany(Team::class);
}

/** @return Collection<int, Team> */
public function teamsVisibleTo(User $user): Collection
{
    $teams = $this->teams()->orderBy('name');

    if (! $user->canManage($this)) {
        $teams->whereHas('members', fn (Builder $query) => $query->whereKey($user->id));
    }

    return $teams->get();
}
```

(imports `Illuminate\Database\Eloquent\Builder`, `Illuminate\Database\Eloquent\Collection`, `HasMany`).

`User`:

```php
/** @return BelongsToMany<Team, $this> */
public function teams(): BelongsToMany
{
    return $this->belongsToMany(Team::class)->withTimestamps();
}
```

`database/factories/TeamFactory.php`:

```php
<?php

namespace Database\Factories;

use App\Models\Team;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Team>
 */
class TeamFactory extends Factory
{
    public function definition(): array
    {
        return [
            'workspace_id' => Workspace::factory(),
            'name' => fake()->words(2, true),
        ];
    }

    public function withMember(User $user): static
    {
        return $this->hasAttached($user, [], 'members');
    }
}
```

`app/Policies/TeamPolicy.php`:

```php
<?php

namespace App\Policies;

use App\Models\Team;
use App\Models\User;
use App\Models\Workspace;

class TeamPolicy
{
    public function view(User $user, Team $team): bool
    {
        if ($user->canManage($team->workspace)) {
            return true;
        }

        return $team->hasMember($user);
    }

    public function create(User $user, Workspace $workspace): bool
    {
        return $user->canManage($workspace);
    }

    public function update(User $user, Team $team): bool
    {
        return $user->canManage($team->workspace);
    }

    public function delete(User $user, Team $team): bool
    {
        return $user->canManage($team->workspace);
    }

    public function manageMembers(User $user, Team $team): bool
    {
        return $user->canManage($team->workspace);
    }
}
```

- [ ] **Step 4: Controllers and routes**

`WorkspacesController::show`:

```php
public function show(Request $request, Workspace $workspace): Response
{
    $user = $request->user();

    return Inertia::render('workspaces/show', [
        'workspace' => $workspace->only(['id', 'name', 'slug']),
        'teams' => $workspace->teamsVisibleTo($user)->map->only(['id', 'name'])->values(),
        'canManage' => $user->canManage($workspace),
    ]);
}
```

`app/Http/Controllers/TeamsController.php`:

```php
<?php

namespace App\Http\Controllers;

use App\Models\Team;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

class TeamsController extends Controller
{
    public function store(Request $request, Workspace $workspace): RedirectResponse
    {
        Gate::authorize('create', [Team::class, $workspace]);

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:100'],
        ]);

        $team = $workspace->teams()->create($validated);

        return to_route('teams.show', [$workspace, $team]);
    }

    public function show(Request $request, Workspace $workspace, Team $team): Response
    {
        Gate::authorize('view', $team);

        $canManage = $request->user()->can('manageMembers', $team);

        return Inertia::render('teams/show', [
            'workspace' => $workspace->only(['id', 'name', 'slug']),
            'team' => $team->only(['id', 'name']),
            'members' => $team->members()->orderBy('name')->get()
                ->map(fn (User $member) => $member->only(['id', 'name', 'email'])),
            'availableMembers' => $canManage
                ? $workspace->members()->whereNotIn('users.id', $team->members()->select('users.id'))->orderBy('name')->get()
                    ->map(fn (User $member) => $member->only(['id', 'name', 'email']))
                : [],
            'canManage' => $canManage,
        ]);
    }

    public function update(Request $request, Workspace $workspace, Team $team): RedirectResponse
    {
        Gate::authorize('update', $team);

        $team->update($request->validate([
            'name' => ['required', 'string', 'max:100'],
        ]));

        return back();
    }

    public function destroy(Workspace $workspace, Team $team): RedirectResponse
    {
        Gate::authorize('delete', $team);

        $team->delete();

        return to_route('workspaces.show', $workspace);
    }
}
```

`app/Http/Controllers/TeamMembersController.php`:

```php
<?php

namespace App\Http\Controllers;

use App\Models\Team;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;

class TeamMembersController extends Controller
{
    public function store(Request $request, Workspace $workspace, Team $team): RedirectResponse
    {
        Gate::authorize('manageMembers', $team);

        $validated = $request->validate([
            'user_id' => [
                'required',
                'uuid',
                Rule::exists('workspace_user', 'user_id')->where('workspace_id', $workspace->id),
            ],
        ]);

        $team->members()->syncWithoutDetaching([$validated['user_id']]);

        return back();
    }

    public function destroy(Workspace $workspace, Team $team, User $member): RedirectResponse
    {
        Gate::authorize('manageMembers', $team);

        $team->members()->detach($member);

        return back();
    }
}
```

`routes/web.php` — inside the `w/{workspace}` group:

```php
Route::post('teams', [TeamsController::class, 'store'])->name('teams.store');
Route::get('teams/{team}', [TeamsController::class, 'show'])->name('teams.show');
Route::patch('teams/{team}', [TeamsController::class, 'update'])->name('teams.update');
Route::delete('teams/{team}', [TeamsController::class, 'destroy'])->name('teams.destroy');
Route::post('teams/{team}/members', [TeamMembersController::class, 'store'])->name('teams.members.store');
Route::delete('teams/{team}/members/{member}', [TeamMembersController::class, 'destroy'])->name('teams.members.destroy');
```

`scopeBindings()` makes `{team}` resolve through `$workspace->teams()` (foreign team → 404) and `{member}` through `$team->members()`.

- [ ] **Step 5: Frontend**

Add to `resources/js/types/workspaces.ts`:

```ts
export type TeamSummary = {
    id: string;
    name: string;
};

export type MemberSummary = {
    id: string;
    name: string;
    email: string;
};
```

`resources/js/pages/workspaces/show.tsx`:

```tsx
import { Form, Head, Link } from '@inertiajs/react';
import TeamsController from '@/actions/App/Http/Controllers/TeamsController';
import Heading from '@/components/heading';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useTrans } from '@/hooks/use-trans';
import type { TeamSummary, WorkspaceSummary } from '@/types';

type Props = {
    workspace: WorkspaceSummary;
    teams: TeamSummary[];
    canManage: boolean;
};

export default function ShowWorkspace({ workspace, teams, canManage }: Props) {
    const { t } = useTrans();

    return (
        <>
            <Head title={workspace.name} />
            <div className="space-y-6 p-4">
                <Heading title={workspace.name} description={t('Teams in this workspace')} />

                {canManage && (
                    <Form {...TeamsController.store.form(workspace.slug)} resetOnSuccess className="flex max-w-md items-start gap-2">
                        {({ processing, errors }) => (
                            <>
                                <div className="flex-1">
                                    <Input name="name" required maxLength={100} placeholder={t('New team name')} aria-label={t('New team name')} />
                                    <InputError message={errors.name} />
                                </div>
                                <Button disabled={processing}>{t('Create team')}</Button>
                            </>
                        )}
                    </Form>
                )}

                {teams.length === 0 && (
                    <p className="text-muted-foreground">
                        {canManage ? t('No teams yet. Create the first one.') : t('You are not a member of any team yet.')}
                    </p>
                )}

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {teams.map((team) => (
                        <Link key={team.id} href={TeamsController.show({ workspace: workspace.slug, team: team.id })}>
                            <Card className="transition hover:border-primary">
                                <CardHeader>
                                    <CardTitle>{team.name}</CardTitle>
                                </CardHeader>
                            </Card>
                        </Link>
                    ))}
                </div>
            </div>
        </>
    );
}
```

`resources/js/pages/teams/show.tsx`:

```tsx
import { Form, Head } from '@inertiajs/react';
import TeamMembersController from '@/actions/App/Http/Controllers/TeamMembersController';
import TeamsController from '@/actions/App/Http/Controllers/TeamsController';
import Heading from '@/components/heading';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useTrans } from '@/hooks/use-trans';
import type { MemberSummary, TeamSummary, WorkspaceSummary } from '@/types';

type Props = {
    workspace: WorkspaceSummary;
    team: TeamSummary;
    members: MemberSummary[];
    availableMembers: MemberSummary[];
    canManage: boolean;
};

export default function ShowTeam({ workspace, team, members, availableMembers, canManage }: Props) {
    const { t } = useTrans();
    const params = { workspace: workspace.slug, team: team.id };

    return (
        <>
            <Head title={team.name} />
            <div className="max-w-2xl space-y-8 p-4">
                <Heading title={team.name} description={t('Retrospectives will appear here.')} />

                {canManage && (
                    <Form {...TeamsController.update.form(params)} className="flex items-start gap-2">
                        {({ processing, errors }) => (
                            <>
                                <div className="flex-1">
                                    <Input name="name" defaultValue={team.name} required maxLength={100} aria-label={t('Team name')} />
                                    <InputError message={errors.name} />
                                </div>
                                <Button variant="outline" disabled={processing}>{t('Rename')}</Button>
                            </>
                        )}
                    </Form>
                )}

                <section className="space-y-3">
                    <Heading variant="small" title={t('Members')} />
                    <ul className="divide-y rounded-md border">
                        {members.map((member) => (
                            <li key={member.id} className="flex items-center justify-between p-3">
                                <div>
                                    <div className="font-medium">{member.name}</div>
                                    <div className="text-sm text-muted-foreground">{member.email}</div>
                                </div>
                                {canManage && (
                                    <Form {...TeamMembersController.destroy.form({ ...params, member: member.id })}>
                                        {({ processing }) => (
                                            <Button variant="ghost" size="sm" disabled={processing}>{t('Remove')}</Button>
                                        )}
                                    </Form>
                                )}
                            </li>
                        ))}
                    </ul>

                    {canManage && availableMembers.length > 0 && (
                        <Form {...TeamMembersController.store.form(params)} className="flex items-start gap-2">
                            {({ processing, errors }) => (
                                <>
                                    <div className="flex-1">
                                        <Select name="user_id">
                                            <SelectTrigger aria-label={t('Add a member')}>
                                                <SelectValue placeholder={t('Add a member')} />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {availableMembers.map((member) => (
                                                    <SelectItem key={member.id} value={member.id}>{member.name}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <InputError message={errors.user_id} />
                                    </div>
                                    <Button disabled={processing}>{t('Add')}</Button>
                                </>
                            )}
                        </Form>
                    )}
                </section>

                {canManage && (
                    <Form {...TeamsController.destroy.form(params)}>
                        {({ processing }) => (
                            <Button variant="destructive" disabled={processing}>{t('Delete team')}</Button>
                        )}
                    </Form>
                )}
            </div>
        </>
    );
}
```

Add new keys (`New team name`, `Create team`, `No teams yet. Create the first one.`, `You are not a member of any team yet.`, `Retrospectives will appear here.`, `Team name`, `Rename`, `Members`, `Remove`, `Add a member`, `Add`, `Delete team`) to the four JSON files.

- [ ] **Step 6: Run tests**

Run: `vendor/bin/sail artisan migrate --no-interaction && vendor/bin/sail artisan test --compact`
Expected: all PASS.

- [ ] **Step 7: Commit**

```bash
vendor/bin/sail bin pint --dirty --format agent
vendor/bin/sail artisan wayfinder:generate --with-form && npm run types:check && npm run check
git add -A && git commit -m "feat: add teams with membership and per-team visibility

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 10: Workspace members and invitations management

**Files:**
- Create: `app/Http/Controllers/WorkspaceMembersController.php`, `app/Http/Controllers/WorkspaceInvitationsController.php`, `app/Notifications/WorkspaceInvitationNotification.php`, `resources/js/pages/workspaces/members.tsx`
- Modify: `routes/web.php`, `resources/js/components/app-sidebar.tsx`, `resources/js/types/workspaces.ts`, `lang/*.json`
- Test: `tests/Feature/Workspaces/WorkspaceMembersTest.php`, `tests/Feature/Workspaces/WorkspaceInvitationsTest.php`

**Interfaces:**
- Consumes: `CreateWorkspaceInvitation`, `WorkspaceInvitation` (Task 6), `WorkspacePolicy` (Task 4), `Team`, `User::teams()` (Task 9).
- Produces:
  - Routes (inside `w/{workspace}`): `workspaces.members.index` GET `members`, `workspaces.members.update` PATCH `members/{member}`, `workspaces.members.destroy` DELETE `members/{member}`, `workspaces.invitations.store` POST `invitations`, `workspaces.invitations.destroy` DELETE `invitations/{invitation}`
  - `WorkspaceInvitationNotification(string $workspaceName, string $inviterName, string $url, CarbonInterface $expiresAt)`
  - Inertia flash key `invitationUrl` (only when `config('mail.default') === 'log'`)

Rules (spec §3): Owner/Admin manage members; only an Owner may grant, change or remove the Owner role; the last Owner cannot be demoted or removed; any member may leave (remove themself) unless they are the last Owner. Removing a member also detaches them from the workspace's teams and clears their `current_workspace_id` if it pointed to this workspace. Invitations may grant `admin` or `member` only.

- [ ] **Step 1: Write the failing tests**

`vendor/bin/sail artisan make:test --pest Workspaces/WorkspaceMembersTest`:

```php
<?php

use App\Enums\WorkspaceRole;
use App\Models\Team;
use App\Models\User;
use App\Models\Workspace;
use Inertia\Testing\AssertableInertia as Assert;

it('lists members and pending invitations for managers', function () {
    $admin = User::factory()->create();
    $workspace = Workspace::factory()->withMember($admin, WorkspaceRole::Admin)->create();
    $workspace->invitations()->create([
        'email' => 'pending@example.com',
        'role' => WorkspaceRole::Member,
        'token_hash' => str_repeat('a', 64),
        'expires_at' => now()->addDay(),
    ]);

    $this->actingAs($admin)
        ->get(route('workspaces.members.index', $workspace))
        ->assertInertia(fn (Assert $page) => $page
            ->component('workspaces/members')
            ->has('members', 1)
            ->has('invitations', 1)
            ->where('canManage', true));
});

it('forbids members from the members page', function () {
    $member = User::factory()->create();
    $workspace = Workspace::factory()->withMember($member)->create();

    $this->actingAs($member)->get(route('workspaces.members.index', $workspace))->assertForbidden();
});

it('lets admins change a member role but not grant ownership', function () {
    $admin = User::factory()->create();
    $member = User::factory()->create();
    $workspace = Workspace::factory()
        ->withMember($admin, WorkspaceRole::Admin)
        ->withMember($member, WorkspaceRole::Member)
        ->create();

    $this->actingAs($admin)->patch(route('workspaces.members.update', [$workspace, $member]), ['role' => 'admin']);
    expect($member->roleIn($workspace))->toBe(WorkspaceRole::Admin);

    $this->actingAs($admin)
        ->patch(route('workspaces.members.update', [$workspace, $member]), ['role' => 'owner'])
        ->assertForbidden();
});

it('forbids admins from changing an owner', function () {
    $owner = User::factory()->create();
    $admin = User::factory()->create();
    $workspace = Workspace::factory()
        ->withMember($owner, WorkspaceRole::Owner)
        ->withMember($admin, WorkspaceRole::Admin)
        ->create();

    $this->actingAs($admin)
        ->patch(route('workspaces.members.update', [$workspace, $owner]), ['role' => 'member'])
        ->assertForbidden();
    $this->actingAs($admin)
        ->delete(route('workspaces.members.destroy', [$workspace, $owner]))
        ->assertForbidden();
});

it('lets an owner transfer ownership then step down', function () {
    $owner = User::factory()->create();
    $admin = User::factory()->create();
    $workspace = Workspace::factory()
        ->withMember($owner, WorkspaceRole::Owner)
        ->withMember($admin, WorkspaceRole::Admin)
        ->create();

    $this->actingAs($owner)->patch(route('workspaces.members.update', [$workspace, $admin]), ['role' => 'owner']);
    $this->actingAs($owner)->patch(route('workspaces.members.update', [$workspace, $owner]), ['role' => 'admin']);

    expect($admin->roleIn($workspace))->toBe(WorkspaceRole::Owner)
        ->and($owner->roleIn($workspace))->toBe(WorkspaceRole::Admin);
});

it('protects the last owner from demotion and removal', function () {
    $owner = User::factory()->create();
    $workspace = Workspace::factory()->withMember($owner, WorkspaceRole::Owner)->create();

    $this->actingAs($owner)
        ->patch(route('workspaces.members.update', [$workspace, $owner]), ['role' => 'admin'])
        ->assertSessionHasErrors('role');
    $this->actingAs($owner)
        ->delete(route('workspaces.members.destroy', [$workspace, $owner]))
        ->assertSessionHasErrors('member');

    expect($owner->roleIn($workspace))->toBe(WorkspaceRole::Owner);
});

it('lets a member leave and cleans up teams and current workspace', function () {
    $member = User::factory()->create();
    $workspace = Workspace::factory()->withMember($member)->create();
    $team = Team::factory()->for($workspace)->withMember($member)->create();
    $member->forceFill(['current_workspace_id' => $workspace->id])->save();

    $this->actingAs($member)
        ->delete(route('workspaces.members.destroy', [$workspace, $member]))
        ->assertRedirect(route('dashboard'));

    expect($member->belongsToWorkspace($workspace))->toBeFalse()
        ->and($team->hasMember($member))->toBeFalse()
        ->and($member->fresh()->current_workspace_id)->toBeNull();

    $this->actingAs($member->fresh())->get(route('dashboard'))->assertRedirect(route('workspaces.create'));
});

it('forbids members from removing others', function () {
    $member = User::factory()->create();
    $other = User::factory()->create();
    $workspace = Workspace::factory()->withMember($member)->withMember($other)->create();

    $this->actingAs($member)
        ->delete(route('workspaces.members.destroy', [$workspace, $other]))
        ->assertForbidden();
});
```

`vendor/bin/sail artisan make:test --pest Workspaces/WorkspaceInvitationsTest`:

```php
<?php

use App\Enums\WorkspaceRole;
use App\Models\User;
use App\Models\Workspace;
use App\Models\WorkspaceInvitation;
use App\Notifications\WorkspaceInvitationNotification;
use Illuminate\Support\Facades\Notification;

it('invites someone by email', function () {
    Notification::fake();
    $admin = User::factory()->create(['locale' => 'fr']);
    $workspace = Workspace::factory()->withMember($admin, WorkspaceRole::Admin)->create();

    $this->actingAs($admin)
        ->post(route('workspaces.invitations.store', $workspace), ['email' => 'new@example.com', 'role' => 'member'])
        ->assertRedirect()
        ->assertInertiaFlashMissing('invitationUrl');

    expect($workspace->invitations()->sole()->email)->toBe('new@example.com');
    Notification::assertSentOnDemand(
        WorkspaceInvitationNotification::class,
        fn (WorkspaceInvitationNotification $notification, array $channels, object $notifiable) => $notifiable->routes['mail'] === 'new@example.com'
            && $notification->locale === 'fr',
    );
});

it('uses the recipient language when the recipient already has an account', function () {
    Notification::fake();
    $admin = User::factory()->create(['locale' => 'fr']);
    User::factory()->create(['email' => 'known@example.com', 'locale' => 'de']);
    $workspace = Workspace::factory()->withMember($admin, WorkspaceRole::Admin)->create();

    $this->actingAs($admin)->post(route('workspaces.invitations.store', $workspace), ['email' => 'known@example.com', 'role' => 'member']);

    Notification::assertSentOnDemand(
        WorkspaceInvitationNotification::class,
        fn (WorkspaceInvitationNotification $notification) => $notification->locale === 'de',
    );
});

it('flashes a copyable link when mail is only logged', function () {
    Notification::fake();
    config(['mail.default' => 'log']);
    $admin = User::factory()->create();
    $workspace = Workspace::factory()->withMember($admin, WorkspaceRole::Admin)->create();

    $this->actingAs($admin)
        ->post(route('workspaces.invitations.store', $workspace), ['email' => 'new@example.com', 'role' => 'member'])
        ->assertInertiaFlash('invitationUrl');
});

it('refuses ownership invitations and existing members', function (array $payload, string $errorField) {
    $admin = User::factory()->create(['email' => 'admin@example.com']);
    $workspace = Workspace::factory()->withMember($admin, WorkspaceRole::Admin)->create();

    $this->actingAs($admin)
        ->post(route('workspaces.invitations.store', $workspace), $payload)
        ->assertSessionHasErrors($errorField);
})->with([
    'owner role' => [['email' => 'new@example.com', 'role' => 'owner'], 'role'],
    'existing member' => [['email' => 'ADMIN@example.com', 'role' => 'member'], 'email'],
    'invalid email' => [['email' => 'not-an-email', 'role' => 'member'], 'email'],
]);

it('forbids members from inviting', function () {
    $member = User::factory()->create();
    $workspace = Workspace::factory()->withMember($member)->create();

    $this->actingAs($member)
        ->post(route('workspaces.invitations.store', $workspace), ['email' => 'new@example.com', 'role' => 'member'])
        ->assertForbidden();
});

it('lets managers revoke an invitation', function () {
    $admin = User::factory()->create();
    $workspace = Workspace::factory()->withMember($admin, WorkspaceRole::Admin)->create();
    $invitation = WorkspaceInvitation::factory()->for($workspace)->create();

    $this->actingAs($admin)->delete(route('workspaces.invitations.destroy', [$workspace, $invitation]));

    expect(WorkspaceInvitation::query()->whereKey($invitation->id)->exists())->toBeFalse();
});
```

- [ ] **Step 2: Run to verify failure**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Workspaces/WorkspaceMembersTest.php tests/Feature/Workspaces/WorkspaceInvitationsTest.php`
Expected: FAIL — routes missing.

- [ ] **Step 3: Notification**

`vendor/bin/sail artisan make:notification WorkspaceInvitationNotification --no-interaction`:

```php
<?php

namespace App\Notifications;

use Carbon\CarbonInterface;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class WorkspaceInvitationNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(
        public string $workspaceName,
        public string $inviterName,
        public string $url,
        public CarbonInterface $expiresAt,
    ) {}

    /** @return array<int, string> */
    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        return (new MailMessage)
            ->subject(__('You are invited to join :workspace', ['workspace' => $this->workspaceName]))
            ->line(__(':inviter invited you to join the :workspace workspace.', [
                'inviter' => $this->inviterName,
                'workspace' => $this->workspaceName,
            ]))
            ->action(__('Accept invitation'), $this->url)
            ->line(__('This invitation expires on :date.', ['date' => $this->expiresAt->isoFormat('LL')]));
    }
}
```

- [ ] **Step 4: Controllers and routes**

`app/Http/Controllers/WorkspaceMembersController.php`:

```php
<?php

namespace App\Http\Controllers;

use App\Enums\WorkspaceRole;
use App\Models\User;
use App\Models\Workspace;
use App\Models\WorkspaceInvitation;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class WorkspaceMembersController extends Controller
{
    public function index(Request $request, Workspace $workspace): Response
    {
        Gate::authorize('manageMembers', $workspace);

        return Inertia::render('workspaces/members', [
            'workspace' => $workspace->only(['id', 'name', 'slug']),
            'members' => $workspace->members()->orderBy('name')->get()->map(fn (User $member) => [
                ...$member->only(['id', 'name', 'email']),
                'role' => $member->membership->role->value,
            ]),
            'invitations' => $workspace->invitations()->whereNull('accepted_at')->latest()->get()
                ->map(fn (WorkspaceInvitation $invitation) => [
                    'id' => $invitation->id,
                    'email' => $invitation->email,
                    'role' => $invitation->role->value,
                    'isExpired' => ! $invitation->isPending(),
                ]),
            'canManage' => true,
            'isOwner' => $request->user()->roleIn($workspace) === WorkspaceRole::Owner,
        ]);
    }

    public function update(Request $request, Workspace $workspace, User $member): RedirectResponse
    {
        Gate::authorize('manageMembers', $workspace);

        $validated = $request->validate([
            'role' => ['required', Rule::enum(WorkspaceRole::class)],
        ]);

        $newRole = WorkspaceRole::from($validated['role']);
        $currentRole = $member->roleIn($workspace);
        $actorIsOwner = $request->user()->roleIn($workspace) === WorkspaceRole::Owner;

        if ($newRole === WorkspaceRole::Owner && ! $actorIsOwner) {
            abort(403);
        }

        if ($currentRole === WorkspaceRole::Owner && ! $actorIsOwner) {
            abort(403);
        }

        if ($currentRole === WorkspaceRole::Owner && $newRole !== WorkspaceRole::Owner && $this->isLastOwner($workspace)) {
            throw ValidationException::withMessages(['role' => __('A workspace needs at least one owner.')]);
        }

        $workspace->members()->updateExistingPivot($member->id, ['role' => $newRole->value]);

        return back();
    }

    public function destroy(Request $request, Workspace $workspace, User $member): RedirectResponse
    {
        $actor = $request->user();
        $isLeaving = $actor->is($member);
        $memberRole = $member->roleIn($workspace);

        if (! $isLeaving) {
            Gate::authorize('manageMembers', $workspace);
        }

        if (! $isLeaving && $memberRole === WorkspaceRole::Owner && $actor->roleIn($workspace) !== WorkspaceRole::Owner) {
            abort(403);
        }

        if ($memberRole === WorkspaceRole::Owner && $this->isLastOwner($workspace)) {
            throw ValidationException::withMessages(['member' => __('A workspace needs at least one owner.')]);
        }

        DB::transaction(function () use ($workspace, $member): void {
            $member->teams()->detach($workspace->teams()->pluck('id'));
            $workspace->members()->detach($member);

            if ($member->current_workspace_id === $workspace->id) {
                $member->forceFill(['current_workspace_id' => null])->save();
            }
        });

        if ($isLeaving) {
            return to_route('dashboard');
        }

        return back();
    }

    private function isLastOwner(Workspace $workspace): bool
    {
        return $workspace->owners()->count() === 1;
    }
}
```

`app/Http/Controllers/WorkspaceInvitationsController.php`:

```php
<?php

namespace App\Http\Controllers;

use App\Actions\Workspaces\CreateWorkspaceInvitation;
use App\Enums\WorkspaceRole;
use App\Models\User;
use App\Models\Workspace;
use App\Models\WorkspaceInvitation;
use App\Notifications\WorkspaceInvitationNotification;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;

class WorkspaceInvitationsController extends Controller
{
    public function store(Request $request, Workspace $workspace, CreateWorkspaceInvitation $createInvitation): RedirectResponse
    {
        Gate::authorize('manageMembers', $workspace);

        $validated = $request->validate([
            'email' => ['required', 'email', 'max:255'],
            'role' => ['required', Rule::in([WorkspaceRole::Admin->value, WorkspaceRole::Member->value])],
        ]);

        $isAlreadyMember = $workspace->members()
            ->whereRaw('lower(users.email) = ?', [Str::lower($validated['email'])])
            ->exists();

        if ($isAlreadyMember) {
            throw ValidationException::withMessages(['email' => __('This person is already a member of the workspace.')]);
        }

        $inviter = $request->user();
        $issued = $createInvitation->handle($workspace, $inviter, $validated['email'], WorkspaceRole::from($validated['role']));
        $url = route('invitations.show', $issued->token);

        $recipientLocale = User::query()
            ->whereRaw('lower(email) = ?', [Str::lower($validated['email'])])
            ->value('locale');

        Notification::route('mail', $validated['email'])->notify(
            (new WorkspaceInvitationNotification($workspace->name, $inviter->name, $url, $issued->invitation->expires_at))
                ->locale($recipientLocale ?? app()->getLocale()),
        );

        if (config('mail.default') === 'log') {
            Inertia::flash('invitationUrl', $url);
        }

        return back();
    }

    public function destroy(Workspace $workspace, WorkspaceInvitation $invitation): RedirectResponse
    {
        Gate::authorize('manageMembers', $workspace);

        $invitation->delete();

        return back();
    }
}
```

Note: `app()->getLocale()` is the inviter's resolved locale (their `users.locale` via `SetLocale`).

`routes/web.php` — inside the `w/{workspace}` group:

```php
Route::get('members', [WorkspaceMembersController::class, 'index'])->name('workspaces.members.index');
Route::patch('members/{member}', [WorkspaceMembersController::class, 'update'])->name('workspaces.members.update');
Route::delete('members/{member}', [WorkspaceMembersController::class, 'destroy'])->name('workspaces.members.destroy');
Route::post('invitations', [WorkspaceInvitationsController::class, 'store'])->name('workspaces.invitations.store');
Route::delete('invitations/{invitation}', [WorkspaceInvitationsController::class, 'destroy'])->name('workspaces.invitations.destroy');
```

`{member}` scopes through `$workspace->members()`, `{invitation}` through `$workspace->invitations()`.

- [ ] **Step 5: Frontend**

Add to `resources/js/types/workspaces.ts`:

```ts
export type WorkspaceMember = MemberSummary & {
    role: WorkspaceRole;
};

export type PendingInvitation = {
    id: string;
    email: string;
    role: WorkspaceRole;
    isExpired: boolean;
};
```

and add `invitationUrl?: string` to the flash data type in `global.d.ts`:

```ts
flashDataType: {
    invitationUrl?: string;
};
```

(inside `InertiaConfig`).

`resources/js/pages/workspaces/members.tsx`:

```tsx
import { Form, Head, usePage } from '@inertiajs/react';
import WorkspaceInvitationsController from '@/actions/App/Http/Controllers/WorkspaceInvitationsController';
import WorkspaceMembersController from '@/actions/App/Http/Controllers/WorkspaceMembersController';
import WorkspacesController from '@/actions/App/Http/Controllers/WorkspacesController';
import Heading from '@/components/heading';
import InputError from '@/components/input-error';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useTrans } from '@/hooks/use-trans';
import type { PendingInvitation, WorkspaceMember, WorkspaceRole, WorkspaceSummary } from '@/types';

type Props = {
    workspace: WorkspaceSummary;
    members: WorkspaceMember[];
    invitations: PendingInvitation[];
    isOwner: boolean;
};

const roleLabels: Record<WorkspaceRole, string> = {
    owner: 'Owner',
    admin: 'Admin',
    member: 'Member',
};

export default function WorkspaceMembers({ workspace, members, invitations, isOwner }: Props) {
    const { t } = useTrans();
    const page = usePage();
    const { auth } = page.props;
    const invitationUrl = page.flash.invitationUrl;
    const assignableRoles: WorkspaceRole[] = isOwner ? ['owner', 'admin', 'member'] : ['admin', 'member'];

    return (
        <>
            <Head title={t('Members')} />
            <div className="max-w-3xl space-y-10 p-4">
                <Heading title={t('Members')} description={workspace.name} />

                <ul className="divide-y rounded-md border">
                    {members.map((member) => (
                        <li key={member.id} className="flex items-center justify-between gap-4 p-3">
                            <div>
                                <div className="font-medium">{member.name}</div>
                                <div className="text-sm text-muted-foreground">{member.email}</div>
                            </div>
                            <div className="flex items-center gap-2">
                                {member.role === 'owner' && !isOwner ? (
                                    <Badge>{t(roleLabels.owner)}</Badge>
                                ) : (
                                    <Form {...WorkspaceMembersController.update.form({ workspace: workspace.slug, member: member.id })} options={{ preserveScroll: true }}>
                                        {({ errors, submit }) => (
                                            <>
                                                <Select name="role" defaultValue={member.role} onValueChange={() => setTimeout(submit)}>
                                                    <SelectTrigger className="w-32" aria-label={t('Role')}>
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {assignableRoles.map((role) => (
                                                            <SelectItem key={role} value={role}>{t(roleLabels[role])}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                                <InputError message={errors.role} />
                                            </>
                                        )}
                                    </Form>
                                )}
                                {(member.role !== 'owner' || isOwner) && (
                                    <Form {...WorkspaceMembersController.destroy.form({ workspace: workspace.slug, member: member.id })} options={{ preserveScroll: true }}>
                                        {({ processing, errors }) => (
                                            <>
                                                <Button variant="ghost" size="sm" disabled={processing}>
                                                    {member.id === auth.user.id ? t('Leave') : t('Remove')}
                                                </Button>
                                                <InputError message={errors.member} />
                                            </>
                                        )}
                                    </Form>
                                )}
                            </div>
                        </li>
                    ))}
                </ul>

                <section className="space-y-4">
                    <Heading variant="small" title={t('Invite people')} />
                    <Form {...WorkspaceInvitationsController.store.form(workspace.slug)} resetOnSuccess={['email']} options={{ preserveScroll: true }} className="flex flex-wrap items-start gap-2">
                        {({ processing, errors }) => (
                            <>
                                <div className="min-w-64 flex-1">
                                    <Input type="email" name="email" required placeholder={t('Email address')} aria-label={t('Email address')} />
                                    <InputError message={errors.email} />
                                </div>
                                <Select name="role" defaultValue="member">
                                    <SelectTrigger className="w-32" aria-label={t('Role')}>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="member">{t(roleLabels.member)}</SelectItem>
                                        <SelectItem value="admin">{t(roleLabels.admin)}</SelectItem>
                                    </SelectContent>
                                </Select>
                                <Button disabled={processing}>{t('Send invitation')}</Button>
                            </>
                        )}
                    </Form>

                    {invitationUrl && (
                        <div className="space-y-1 rounded-md border p-3 text-sm">
                            <p>{t('Email is not configured on this instance. Share this link with the invited person:')}</p>
                            <Input readOnly value={invitationUrl} onFocus={(event) => event.currentTarget.select()} />
                        </div>
                    )}

                    <ul className="divide-y rounded-md border">
                        {invitations.map((invitation) => (
                            <li key={invitation.id} className="flex items-center justify-between p-3">
                                <div className="flex items-center gap-2">
                                    <span>{invitation.email}</span>
                                    <Badge variant="secondary">{t(roleLabels[invitation.role])}</Badge>
                                    {invitation.isExpired && <Badge variant="destructive">{t('Expired')}</Badge>}
                                </div>
                                <Form {...WorkspaceInvitationsController.destroy.form({ workspace: workspace.slug, invitation: invitation.id })} options={{ preserveScroll: true }}>
                                    {({ processing }) => (
                                        <Button variant="ghost" size="sm" disabled={processing}>{t('Revoke')}</Button>
                                    )}
                                </Form>
                            </li>
                        ))}
                    </ul>
                </section>

                {isOwner && (
                    <section className="space-y-3">
                        <Heading variant="small" title={t('Delete workspace')} description={t('This permanently deletes the workspace, its teams and their retrospectives.')} />
                        <Form {...WorkspacesController.destroy.form(workspace.slug)}>
                            {({ processing }) => (
                                <Button variant="destructive" disabled={processing}>{t('Delete workspace')}</Button>
                            )}
                        </Form>
                    </section>
                )}
            </div>
        </>
    );
}
```

`usePage().flash` is typed by the `flashDataType` declaration above (flash lives on the page object, not in `props`).

`app-sidebar.tsx` — when `currentWorkspace` is `owner` or `admin`, add nav item `{ title: 'Members', href: WorkspaceMembersController.index(currentWorkspace.slug), icon: Users }`.

Add new keys (`Owner`, `Admin`, `Member`, `Role`, `Leave`, `Invite people`, `Send invitation`, `Email is not configured on this instance. Share this link with the invited person:`, `Expired`, `Revoke`, `Delete workspace`, `This permanently deletes the workspace, its teams and their retrospectives.`, `A workspace needs at least one owner.`, `This person is already a member of the workspace.`, `You are invited to join :workspace`, `:inviter invited you to join the :workspace workspace.`, `This invitation expires on :date.`) to the four JSON files.

- [ ] **Step 6: Run tests**

Run: `vendor/bin/sail artisan test --compact`
Expected: all PASS.

- [ ] **Step 7: Manual check**

With `npm run dev`: create a workspace, invite `someone@example.com` (MAIL_MAILER=log → link shown), open the link in a private window, register, verify you land in the workspace as Member. Switch the language to DE and check the members page and the invitation page.

- [ ] **Step 8: Commit**

```bash
vendor/bin/sail bin pint --dirty --format agent
vendor/bin/sail artisan wayfinder:generate --with-form && npm run types:check && npm run check
git add -A && git commit -m "feat: manage workspace members and email invitations

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

## Spec coverage (Plan 1)

| Spec item | Task |
|---|---|
| AC0 UUID keys | 1 (+ every migration in 4, 6, 9) |
| AC1 first user admin | 7, 8 |
| AC2 invite mode | 7, 8 |
| AC3 domain mode | 7 |
| AC7 create/switch workspace | 4, 5 |
| AC8 owners/admins manage | 9, 10 |
| AC9 member team visibility | 9 |
| AC10 last owner | 10 |
| AC34 four locales, key parity | 2, 3 (enforced in every task) |
| AC35 locale resolution + switching | 2 |
| AC36 localized validation | 2 |
| AC4–AC6 SSO | Plan 2 |
| AC11–AC30 retro | Plans 3–4 |
| AC31–AC33 packaging | Plan 5 |
