# Plan 11a — MCP foundation, API tokens and retro reads Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** skrum serves an authenticated MCP server at `/mcp` for personal API tokens (created and revoked on a new settings page), with scope/feature gating, team visibility, rate limits, and the retrospective read tools of the QRetro contract.

**Architecture:** Sanctum personal access tokens (custom UUID model with a team binding) authenticate a stateless `laravel/mcp` web server through `AuthenticateMcpRequest`, which binds a request-scoped `McpGrant`. Every tool extends `SkrumTool`, which decides registration (`shouldRegister`) from the grant's scopes and `McpFeature`, re-checks, rate-limits writes and maps domain exceptions to translated tool errors. `McpContext` resolves boards, games and action items only inside `VisibleTeams`, so invisible and missing resources are indistinguishable; tools present data only through the existing board presenters.

**Tech Stack:** Laravel 13 (PHP 8.4), `laravel/mcp`, `laravel/sanctum`, PostgreSQL, Pest, React 19, Inertia v3, Wayfinder, Tailwind 4.

**Spec:** `docs/superpowers/specs/2026-09-29-mcp-server-design.md` (§1–§5, §6.1, §8, §9, §10, §11 parts, §13 foundation and retro-read tests, §14 criteria 1–5, 11, 12 and the read parts of 6 and 8) with the contract `docs/superpowers/research/qretro/mcp-readme.md`. Plan 11b (`docs/superpowers/plans/2026-10-03-plan-11b-mcp-writes-poker-prompts.md`) delivers the write, delete and poker tools, the prompts, packaging and the walkthrough.

## Global Constraints

- Work on branch `feat/plan-11-mcp`, created from the HEAD of `feat/plan-10-planning-poker` (Plans 10a/10b implemented, unmerged). Plan 11b continues on the same branch after 11a.
- The only new Composer dependencies are `laravel/mcp` and `laravel/sanctum` (spec §1.4, approved 2026-09-30); no new npm dependency.
- Spec 6 is not built: the four tracker tools are out of scope (spec §6.5 planning note); `McpFeature::Trackers` is never available; 25 tools in total.
- `/mcp` is authenticated only by a Sanctum token in `Authorization: Bearer`; sessions and cookies never authenticate it (`config/sanctum.php`: `guard => []`, `stateful => []`, `expiration => null`, `token_prefix => 'skrum_'`). Missing/invalid → 401 with `WWW-Authenticate: Bearer realm="skrum"`.
- Scopes: `mcp:read` always, `mcp:write` and `mcp:delete` opt-in; `*` never issued. Tools outside the grant's scopes or unavailable features are neither listed nor callable.
- Access = scope ∩ team visibility (`TeamPolicy::view`) ∩ bound team; an invisible resource is reported exactly like a missing one: tool error "Not found.".
- UI parity: every write goes through the same guards and action classes as the web endpoint; every read through the same presenters. No tool re-implements a redaction filter.
- Reads never create participants or poker players; writes that need one create it like opening the board/game (poker players never spectators, existing roles kept).
- Inputs snake_case, outputs camelCase, lists `{items, page, hasMore}` with `limit` (default 20, max 50 unless stated) and `page`; every board, action item and poker game carries an absolute `url`.
- No payload, error or log line contains an email, a retro guest token or guest URL, a guest secret, or a credential; `Authorization` headers are excluded from exception context.
- Config `config/skrum.php` → `mcp.enabled` (`SKRUM_MCP_ENABLED`, true), `mcp.rate_limit` (`SKRUM_MCP_RATE_LIMIT`, 120/min/token), `mcp.write_rate_limit` (`SKRUM_MCP_WRITE_RATE_LIMIT`, 30/min/token).
- Tool errors are translated (`SetMcpLocale` applies `users.locale`); strings in `lang/{en,fr,es,de}.json` (German "du", French "vous", Spanish "tú"), appended; `TranslationKeysTest` green.
- Commands through Sail (`vendor/bin/sail …`), shells prefixed with `export PATH="$HOME/.orbstack/bin:/opt/homebrew/bin:$PATH";`. Migration prefix `2026_10_04_1000xx`, `up()` only, UUID keys.
- PHP conventions of the repo (constructor promotion, typed, early returns, curly braces, PascalCase constants, array-shape docblocks on presenters); frontend: function components, Wayfinder imports, `npm run types:check && npm run check`.
- Commit messages: Conventional Commits with the committing agent's own Co-Authored-By trailer and `Claude-Session: https://claude.ai/code/session_01SosW8d2Uj7QxsF1tws5ssS`.

## Review Focus

1. **A token bound to a team the user no longer sees** (removed from the team, or the Admin lost the role) → every tool returns "Not found." or an empty list on the next request, never data, and the settings list flags "No access to this team anymore". Pinned in Task 5 ("returns nothing for a bound team the user no longer sees") and Task 2 ("flags tokens bound to a team the user can no longer see").
2. **A valid UUID of a board, game or action item of another workspace** → "Not found.", identical to a random UUID (same message, same shape), for every resolver of `McpContext`. Pinned in Task 5 ("reports invisible resources exactly like missing ones").
3. **Search input with `%`, `_`, `\` or text that only appears in another participant's Writing-phase card** → wildcards are literal and the hidden card never matches (no snippet, no board hit). Pinned in Task 8 ("escapes wildcards", "never matches hidden cards").
4. **A token that expires or is revoked between two requests of the same client session** → the next request is 401 with `WWW-Authenticate`, even though the MCP client keeps its session id. Pinned in Task 4 ("refuses a token revoked or expired after initialize").
5. **A user with several workspaces and teams of the same name** → `retro.teams.list` keeps them apart (workspace name and id on each row) and `retro.actions.list` merges items of all visible workspaces in spec 3 order without duplicates. Pinned in Task 5 ("lists teams of every workspace") and Task 6 ("merges action items across workspaces").

## File map

| Area | Files |
|---|---|
| Dependencies & config | `composer.json`, `composer.lock`, `config/sanctum.php`, `config/skrum.php` (`mcp`, `version`), `.env.example`, `routes/console.php` (prune schedule) |
| Tokens (model) | `database/migrations/2026_10_04_100000_create_personal_access_tokens_table.php`, `app/Enums/McpScope.php`, `app/Models/PersonalAccessToken.php`, `app/Models/User.php` (`HasApiTokens`), `database/factories/PersonalAccessTokenFactory.php` |
| Tokens (settings) | `app/Actions/Mcp/{IssueMcpToken,RevokeMcpToken}.php`, `app/Http/Controllers/Settings/ApiTokensController.php`, `app/Http/Middleware/EnsureMcpIsEnabled.php`, `routes/settings.php`, `app/Http/Middleware/HandleInertiaRequests.php` (`features.mcp`) |
| Tokens (UI) | `resources/js/pages/settings/api-tokens.tsx`, `resources/js/components/settings/{create-token-dialog,new-token-dialog,revoke-token-dialog}.tsx`, `resources/js/layouts/settings/layout.tsx`, `resources/js/types/{api-tokens,index,global.d}.ts` |
| Endpoint & auth | `routes/ai.php`, `app/Mcp/Servers/SkrumServer.php`, `app/Mcp/{McpGrant,McpGrantContext}.php`, `app/Http/Middleware/{AuthenticateMcpRequest,SetMcpLocale}.php`, `app/Providers/AppServiceProvider.php` (Sanctum model, grant context, `mcp` limiter, scoped `VisibleTeams`) |
| Tool base | `app/Mcp/Tools/SkrumTool.php`, `app/Mcp/{McpFeature,VisibleTeams,McpContext}.php`, `app/Mcp/Presenters/{McpBoard,McpActionItem,McpMessage}.php`, `app/Mcp/Support/LikePattern.php` |
| Retro read tools | `app/Mcp/Tools/Retro/{ListTeams,ListTeamMembers,ListBoards,ListActionItems,ListBoardActionItems,ListMessages,GetSummary,SearchBoards,ListInsights,GetHealth,GetRoti}.php` |
| Shared retro code touched | `app/Actions/ActionItems/ActionItemQuery.php` (`filter()`), `app/Models/Retro.php` (`showsVoteTotals()`), `app/Actions/Retros/BuildBoardSnapshot.php`, `app/Enums/RetroPhase.php` (`hidingOthersCards()`), `app/Actions/Retros/{SummarizeRoti,BuildResults}.php` |
| Tests | `tests/Pest.php` (`issueTestMcpToken`, `postMcp`, `bindMcpGrant`, `actingAsMcp`, `mcpStructured`, `mcpToolNames`), `tests/Feature/Mcp/{TokenModelTest,ApiTokensTest,McpAuthenticationTest,ToolBaseTest,ListTeamsTest,RetroListToolsTest,MessagesAndSummaryTest,SearchBoardsTest,InsightsHealthRotiTest,CatalogueTest,ReadPrivacyTest}.php` |
| Translations | `lang/{en,fr,es,de}.json` |

## Contract for Plan 11b

Plan 11b builds on exactly these names; renaming any of them breaks it:

- `App\Enums\McpScope` (`Read`, `Write`, `Delete`); `App\Mcp\McpFeature` (`Insights`, `Trackers`; `isAvailable(): bool`).
- `App\Mcp\McpGrant` (`user`, `tokenId`, `scopes`, `teamId`; `has(McpScope): bool`; `static current(): self`; `bind()`), resolved from the container per request through `McpGrantContext`.
- `App\Mcp\Tools\SkrumTool`: `abstract protected function requiredScope(): McpScope`, `protected function requiredFeature(): ?McpFeature`, `abstract protected function run(Request $request): Response|ResponseFactory`, `final public function handle(Request $request)` (gating, write limit for Write/Delete, exception → translated tool error), `protected const DefaultLimit = 20`, `paginationRules(int $maxLimit = 50)`, `pagination(array $validated, int $maxLimit = 50): array{0: int, 1: int}`, `paginate(Builder $query, int $page, int $limit, callable $present): array{items, page, hasMore}`. Tools may use constructor injection (the server resolves them through the container).
- `App\Mcp\McpContext` (injectable): `grant()`, `user()`, `visibleTeamIds()`, `team(string)`, `retro(string)`, `pokerGame(string)`, `actionItem(string)` (all "Not found." outside the visible teams), `participant(Retro): ?Participant`, `participantForWrite(Retro): Participant`, `pokerPlayer(PokerGame): ?PokerPlayer`, `pokerPlayerForWrite(PokerGame): PokerPlayer`.
- `App\Mcp\VisibleTeams::ids(McpGrant): array<int, string>`.
- Presenters: `McpBoard::withCounts(Builder)`, `McpBoard::handle(Retro): array`; `McpActionItem::relations(): array`, `McpActionItem::handle(ActionItem $item, User $viewer): array`; `McpMessage::handle(Card $card, Retro $retro, ?Participant $viewer, ?array $voteTotals): array`.
- `Retro::showsVoteTotals(): bool`; `ActionItemQuery::filter(Builder, User, ActionItemFilters): Builder`.
- Read tool classes (prompts call them): `App\Mcp\Tools\Retro\{ListTeams, ListTeamMembers, ListBoards, ListActionItems, ListBoardActionItems, ListMessages, GetSummary, SearchBoards, ListInsights, GetHealth, GetRoti}` with the output shapes of Tasks 5–9 (`ListMessages` → `{columns: [{id, title, description, messages}], page, hasMore}`; list tools → `{items, page, hasMore}`; `ListBoardActionItems` → `{items}`; `GetHealth`/`GetRoti` trends under `trend`).
- `SkrumServer::$tools` (append-only list) and `$prompts`.
- `App\Actions\Mcp\IssueMcpToken::handle(User $user, string $name, array $scopes, ?Team $team, ?CarbonInterface $expiresAt): NewAccessToken`.
- Pest helpers: `issueTestMcpToken(User, array $scopes = [McpScope::Read], ?Team = null, ?CarbonInterface = null): string`, `postMcp(?string $token, array $payload = tools/list, array $headers = []): TestResponse` (HTTP), `bindMcpGrant(User, array $scopes = [McpScope::Read], ?Team = null): McpGrant`, `actingAsMcp(User, array $scopes = [McpScope::Read], ?Team = null): PendingTestResponse`, `mcpStructured(McpTestResponse): array`, `mcpToolNames(PendingTestResponse): array<int, string>` (never `TestListResponse`'s registration assertions: they build tools with `new`).

---

### Task 1: Dependencies, token model and configuration

**Files:**
- Modify: `composer.json`, `composer.lock` (through `composer require`), `app/Models/User.php`, `app/Providers/AppServiceProvider.php`, `config/skrum.php`, `.env.example`, `routes/console.php`, `lang/{en,fr,es,de}.json`
- Create: `config/sanctum.php`, `database/migrations/2026_10_04_100000_create_personal_access_tokens_table.php`, `app/Enums/McpScope.php`, `app/Models/PersonalAccessToken.php`, `database/factories/PersonalAccessTokenFactory.php`
- Test: create `tests/Feature/Mcp/TokenModelTest.php`

**Interfaces:**
- Consumes: `User` (UUID, `HasFactory`), `Team` (UUID), `Illuminate\Console\Scheduling\Schedule`.
- Produces:
  - Composer: `laravel/mcp` and `laravel/sanctum` as direct `require` entries.
  - `config('sanctum')`: `guard => []`, `stateful => []`, `expiration => null`, `token_prefix => 'skrum_'`.
  - `config('skrum.mcp')`: `['enabled' => bool (SKRUM_MCP_ENABLED, true), 'rate_limit' => int (SKRUM_MCP_RATE_LIMIT, 120), 'write_rate_limit' => int (SKRUM_MCP_WRITE_RATE_LIMIT, 30)]`.
  - Table `personal_access_tokens` (UUID `id`, `uuidMorphs('tokenable')`, `name` string 60, `token` string 64 unique, `abilities` json, `team_id` nullable UUID FK → `teams` cascade on delete, `token_hint` string 4, `last_used_at` nullable timestamp, `expires_at` nullable indexed timestamp, timestamps).
  - `App\Enums\McpScope: string` — `Read = 'mcp:read'`, `Write = 'mcp:write'`, `Delete = 'mcp:delete'`; `label(): string` (translated "Read", "Create and update", "Delete my messages").
  - `App\Models\PersonalAccessToken extends Laravel\Sanctum\PersonalAccessToken` (`HasFactory`, `HasUuids`; fillable `name, token, abilities, expires_at, team_id, token_hint`): `team(): BelongsTo<Team>`, `scopes(): array<int, McpScope>` (known abilities only, in stored order), `isExpired(CarbonInterface $now): bool`. Registered with `Sanctum::usePersonalAccessTokenModel()`.
  - `User` uses `Laravel\Sanctum\HasApiTokens` (`createToken(string $name, array $abilities, ?DateTimeInterface $expiresAt): NewAccessToken`, `tokens(): MorphMany`, `currentAccessToken()`, `withAccessToken()`).
  - `Database\Factories\PersonalAccessTokenFactory` — default: a new `User` as tokenable, `abilities ['mcp:read']`, random hashed token, `token_hint '0000'`, `expires_at` in 90 days; states `expired()`, `boundTo(Team $team)`, `withScopes(McpScope ...$scopes)` (always keeps `mcp:read` first), `for`-style ownership via `forUser(User $user)`.
  - Schedule: `sanctum:prune-expired --hours=720` daily, on one server.

- [ ] **Step 1: Create the branch**

```bash
git checkout feat/plan-10-planning-poker
git checkout -b feat/plan-11-mcp
```

- [ ] **Step 2: Install the two approved dependencies**

Run (Sail, PATH prefix as in Global Constraints):

```bash
export PATH="$HOME/.orbstack/bin:/opt/homebrew/bin:$PATH"; vendor/bin/sail composer require laravel/mcp laravel/sanctum
```

Expected: both appear under `"require"` in `composer.json` (`laravel/mcp` was only a transitive dependency of Boost until now). Do **not** run `php artisan install:api` and do not publish Sanctum's migration (this task writes its own, UUID-based one).

- [ ] **Step 3: Write the failing tests**

Create `tests/Feature/Mcp/TokenModelTest.php`:

```php
<?php

use App\Enums\McpScope;
use App\Models\PersonalAccessToken;
use App\Models\Team;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Console\Scheduling\Event as ScheduledEvent;
use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

it('stores tokens with uuid ids and uuid morphs', function () {
    $user = User::factory()->create();

    $newToken = $user->createToken('Laptop', [McpScope::Read->value]);
    $token = $newToken->accessToken;

    expect($token)->toBeInstanceOf(PersonalAccessToken::class)
        ->and(Str::isUuid($token->id))->toBeTrue()
        ->and($token->tokenable_id)->toBe($user->id)
        ->and($token->tokenable_type)->toBe($user->getMorphClass());
});

it('stores only the hash of the token and prefixes it', function () {
    $user = User::factory()->create();

    $plainText = $user->createToken('Laptop', [McpScope::Read->value])->plainTextToken;
    [$id, $secret] = explode('|', $plainText, 2);

    expect(Str::isUuid($id))->toBeTrue()
        ->and($secret)->toStartWith('skrum_')
        ->and(DB::table('personal_access_tokens')->where('token', $secret)->exists())->toBeFalse()
        ->and(DB::table('personal_access_tokens')->where('token', hash('sha256', $secret))->exists())->toBeTrue()
        ->and(PersonalAccessToken::findToken($plainText)?->id)->toBe($id);
});

it('parses scopes and ignores unknown abilities', function () {
    $token = PersonalAccessToken::factory()->withScopes(McpScope::Delete)->create();
    $legacy = PersonalAccessToken::factory()->create(['abilities' => ['mcp:read', 'admin:everything']]);

    expect($token->scopes())->toBe([McpScope::Read, McpScope::Delete])
        ->and($legacy->scopes())->toBe([McpScope::Read]);
});

it('knows when it expired', function () {
    $now = CarbonImmutable::parse('2026-10-04 12:00:00');
    $expired = PersonalAccessToken::factory()->create(['expires_at' => $now->subMinute()]);
    $boundary = PersonalAccessToken::factory()->create(['expires_at' => $now]);
    $valid = PersonalAccessToken::factory()->create(['expires_at' => $now->addDay()]);
    $never = PersonalAccessToken::factory()->create(['expires_at' => null]);

    expect($expired->isExpired($now))->toBeTrue()
        ->and($boundary->isExpired($now))->toBeTrue()
        ->and($valid->isExpired($now))->toBeFalse()
        ->and($never->isExpired($now))->toBeFalse();
});

it('deletes the tokens bound to a deleted team', function () {
    $team = Team::factory()->create();
    $bound = PersonalAccessToken::factory()->boundTo($team)->create();
    $unbound = PersonalAccessToken::factory()->create();

    $team->delete();

    expect(PersonalAccessToken::query()->whereKey($bound->id)->exists())->toBeFalse()
        ->and(PersonalAccessToken::query()->whereKey($unbound->id)->exists())->toBeTrue()
        ->and($unbound->fresh()->team)->toBeNull();
});

it('prunes tokens 30 days after they expired, every day', function () {
    $event = collect(app(Schedule::class)->events())
        ->first(fn (ScheduledEvent $event) => str_contains((string) $event->command, 'sanctum:prune-expired --hours=720'));

    expect($event)->not->toBeNull()
        ->and($event->expression)->toBe('0 0 * * *')
        ->and($event->onOneServer)->toBeTrue();
});

it('reads the mcp configuration with its defaults', function () {
    expect(config('skrum.mcp'))->toBe([
        'enabled' => true,
        'rate_limit' => 120,
        'write_rate_limit' => 30,
    ])
        ->and(config('sanctum.guard'))->toBe([])
        ->and(config('sanctum.stateful'))->toBe([])
        ->and(config('sanctum.expiration'))->toBeNull()
        ->and(config('sanctum.token_prefix'))->toBe('skrum_');
});

it('labels scopes', function () {
    expect(McpScope::Read->label())->toBe('Read')
        ->and(McpScope::Write->label())->toBe('Create and update')
        ->and(McpScope::Delete->label())->toBe('Delete my messages');
});
```

- [ ] **Step 4: Run the tests to verify they fail**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Mcp/TokenModelTest.php`
Expected: FAIL — `Class "App\Enums\McpScope" not found` (and `Call to undefined method App\Models\User::createToken()`).

- [ ] **Step 5: Sanctum configuration**

Create `config/sanctum.php` (replaces Sanctum's published default; do not keep the `stateful` domain list or the `middleware` block — the app never uses Sanctum's SPA mode):

```php
<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Stateful domains and guards
    |--------------------------------------------------------------------------
    |
    | Sanctum only authenticates the MCP endpoint, and only through bearer
    | tokens: no stateful domain and no fallback guard, so a browser session
    | cookie never authenticates a token-protected route.
    |
    */

    'stateful' => [],

    'guard' => [],

    /*
    |--------------------------------------------------------------------------
    | Expiration
    |--------------------------------------------------------------------------
    |
    | Every token carries its own expires_at (chosen on creation), so there is
    | no global lifetime.
    |
    */

    'expiration' => null,

    /*
    |--------------------------------------------------------------------------
    | Token prefix
    |--------------------------------------------------------------------------
    |
    | Makes leaked skrum tokens detectable by secret scanners.
    |
    */

    'token_prefix' => 'skrum_',

];
```

- [ ] **Step 6: Scope enum**

Create `app/Enums/McpScope.php`:

```php
<?php

namespace App\Enums;

enum McpScope: string
{
    case Read = 'mcp:read';
    case Write = 'mcp:write';
    case Delete = 'mcp:delete';

    public function label(): string
    {
        return match ($this) {
            self::Read => __('Read'),
            self::Write => __('Create and update'),
            self::Delete => __('Delete my messages'),
        };
    }
}
```

- [ ] **Step 7: Migration**

Create `database/migrations/2026_10_04_100000_create_personal_access_tokens_table.php`:

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('personal_access_tokens', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuidMorphs('tokenable');
            $table->string('name', 60);
            $table->string('token', 64)->unique();
            $table->json('abilities');
            $table->foreignUuid('team_id')->nullable()->constrained()->cascadeOnDelete();
            $table->string('token_hint', 4);
            $table->timestamp('last_used_at')->nullable();
            $table->timestamp('expires_at')->nullable()->index();
            $table->timestamps();
        });
    }
};
```

- [ ] **Step 8: Token model and factory**

Create `app/Models/PersonalAccessToken.php`:

```php
<?php

namespace App\Models;

use App\Enums\McpScope;
use Carbon\CarbonInterface;
use Database\Factories\PersonalAccessTokenFactory;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Laravel\Sanctum\PersonalAccessToken as SanctumPersonalAccessToken;

/**
 * @property string $id
 * @property string $tokenable_type
 * @property string $tokenable_id
 * @property string $name
 * @property string $token
 * @property array<int, string>|null $abilities
 * @property string|null $team_id
 * @property string $token_hint
 * @property CarbonInterface|null $last_used_at
 * @property CarbonInterface|null $expires_at
 * @property CarbonInterface|null $created_at
 * @property-read Team|null $team
 */
class PersonalAccessToken extends SanctumPersonalAccessToken
{
    /** @use HasFactory<PersonalAccessTokenFactory> */
    use HasFactory;

    use HasUuids;

    /**
     * @var list<string>
     */
    protected $fillable = [
        'name',
        'token',
        'abilities',
        'expires_at',
        'team_id',
        'token_hint',
    ];

    /** @return BelongsTo<Team, $this> */
    public function team(): BelongsTo
    {
        return $this->belongsTo(Team::class);
    }

    /**
     * @return array<int, McpScope>
     */
    public function scopes(): array
    {
        return array_values(array_filter(array_map(
            fn (string $ability): ?McpScope => McpScope::tryFrom($ability),
            $this->abilities ?? [],
        )));
    }

    public function isExpired(CarbonInterface $now): bool
    {
        if ($this->expires_at === null) {
            return false;
        }

        return $this->expires_at->lessThanOrEqualTo($now);
    }
}
```

Create `database/factories/PersonalAccessTokenFactory.php`:

```php
<?php

namespace Database\Factories;

use App\Enums\McpScope;
use App\Models\PersonalAccessToken;
use App\Models\Team;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<PersonalAccessToken>
 */
class PersonalAccessTokenFactory extends Factory
{
    public function definition(): array
    {
        return [
            'tokenable_type' => (new User)->getMorphClass(),
            'tokenable_id' => User::factory(),
            'name' => fake()->unique()->words(2, true),
            'token' => hash('sha256', 'skrum_'.Str::random(40)),
            'abilities' => [McpScope::Read->value],
            'token_hint' => '0000',
            'expires_at' => now()->addDays(90),
        ];
    }

    public function forUser(User $user): static
    {
        return $this->state(fn () => [
            'tokenable_type' => $user->getMorphClass(),
            'tokenable_id' => $user->id,
        ]);
    }

    public function withScopes(McpScope ...$scopes): static
    {
        $abilities = collect([McpScope::Read, ...$scopes])
            ->map(fn (McpScope $scope): string => $scope->value)
            ->unique()
            ->values()
            ->all();

        return $this->state(fn () => ['abilities' => $abilities]);
    }

    public function boundTo(Team $team): static
    {
        return $this->state(fn () => ['team_id' => $team->id]);
    }

    public function expired(): static
    {
        return $this->state(fn () => ['expires_at' => now()->subDay()]);
    }
}
```

- [ ] **Step 9: Wire Sanctum into the user and the container**

In `app/Models/User.php` add `use Laravel\Sanctum\HasApiTokens;` to the imports and the trait line `use HasApiTokens;` next to the other traits (one trait per line):

```php
    use HasApiTokens;
    use HasUuids;
    use Notifiable;
```

In `app/Providers/AppServiceProvider.php` import `App\Models\PersonalAccessToken` and `Laravel\Sanctum\Sanctum`, and in `boot()` after `Gate::policy(SavedPokerDeck::class, PokerDeckPolicy::class);` add:

```php
        Sanctum::usePersonalAccessTokenModel(PersonalAccessToken::class);
```

- [ ] **Step 10: Instance configuration, environment example and schedule**

In `config/skrum.php`, after the `action_item_reminders` block, add:

```php
    'mcp' => [
        'enabled' => (bool) env('SKRUM_MCP_ENABLED', true),
        'rate_limit' => (int) env('SKRUM_MCP_RATE_LIMIT', 120),
        'write_rate_limit' => (int) env('SKRUM_MCP_WRITE_RATE_LIMIT', 30),
    ],
```

In `.env.example`, after the `SKRUM_LLM_BASE_URL=` line (and its blank line), add:

```dotenv
# MCP server at {APP_URL}/mcp for AI assistants that send an API token
# (created under Settings → API tokens). Requests and write/delete calls
# are limited per token and per minute.
SKRUM_MCP_ENABLED=true
SKRUM_MCP_RATE_LIMIT=120
SKRUM_MCP_WRITE_RATE_LIMIT=30

```

In `routes/console.php`, after the `action-items:send-reminders` schedule, add:

```php

Schedule::command('sanctum:prune-expired --hours=720')
    ->daily()
    ->onOneServer();
```

- [ ] **Step 11: Translations**

Add each key only if missing from the file (`grep -c '"Read":' lang/en.json` etc.), appended at the end of each file (keep the previous last entry's comma):

`lang/en.json`:
```json
    "Read": "Read",
    "Create and update": "Create and update",
    "Delete my messages": "Delete my messages"
```

`lang/fr.json`:
```json
    "Read": "Lecture",
    "Create and update": "Créer et modifier",
    "Delete my messages": "Supprimer mes messages"
```

`lang/es.json`:
```json
    "Read": "Lectura",
    "Create and update": "Crear y actualizar",
    "Delete my messages": "Eliminar mis mensajes"
```

`lang/de.json`:
```json
    "Read": "Lesen",
    "Create and update": "Erstellen und bearbeiten",
    "Delete my messages": "Meine Nachrichten löschen"
```

- [ ] **Step 12: Run the tests to verify they pass**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Mcp/TokenModelTest.php tests/Feature/UuidPrimaryKeysTest.php tests/Feature/TranslationKeysTest.php`
Expected: PASS (the UUID test proves `personal_access_tokens` has no integer key or morph column).

- [ ] **Step 13: Static checks**

Run: `vendor/bin/sail bin pint --dirty --format agent` then `vendor/bin/sail bin phpstan analyse --no-progress`
Expected: pint clean, 0 errors.

- [ ] **Step 14: Commit**

```bash
git add composer.json composer.lock config/sanctum.php config/skrum.php .env.example routes/console.php \
  database/migrations/2026_10_04_100000_create_personal_access_tokens_table.php \
  database/factories/PersonalAccessTokenFactory.php app/Enums/McpScope.php app/Models/PersonalAccessToken.php \
  app/Models/User.php app/Providers/AppServiceProvider.php lang/en.json lang/fr.json lang/es.json lang/de.json \
  tests/Feature/Mcp/TokenModelTest.php
git commit -m "feat: add mcp api token storage with sanctum

<Co-Authored-By trailer of the committing agent>
Claude-Session: https://claude.ai/code/session_01SosW8d2Uj7QxsF1tws5ssS"
```

#### Implementer notes

- `PersonalAccessToken` overrides Sanctum's `$fillable` as a property (the parent declares the property; the repo's `#[Fillable]` attribute would not merge with it).
- Sanctum's own migration is never published; this migration replaces it (UUID id and morphs, parent spec AC0). `sanctum:prune-expired` works on it unchanged.

### Task 2: Issuing and revoking tokens (backend)

**Files:**
- Create: `app/Actions/Mcp/IssueMcpToken.php`, `app/Actions/Mcp/RevokeMcpToken.php`, `app/Http/Controllers/Settings/ApiTokensController.php`, `app/Http/Middleware/EnsureMcpIsEnabled.php`, `resources/js/pages/settings/api-tokens.tsx` (placeholder, replaced by Task 3)
- Modify: `routes/settings.php`, `app/Http/Middleware/HandleInertiaRequests.php`, `lang/{en,fr,es,de}.json`
- Test: create `tests/Feature/Mcp/ApiTokensTest.php`

**Interfaces:**
- Consumes (Task 1): `PersonalAccessToken` (`scopes()`, `isExpired()`, `team()`), `McpScope`, `User::createToken()`, `User::tokens()`, `PersonalAccessTokenFactory` (`forUser`, `withScopes`, `boundTo`, `expired`), `config('skrum.mcp.enabled')`.
- Produces:
  - `App\Actions\Mcp\IssueMcpToken::MaxActiveTokens = 25`; `IssueMcpToken::handle(User $user, string $name, array $scopes, ?Team $team, ?CarbonInterface $expiresAt): Laravel\Sanctum\NewAccessToken` — `$scopes` is `array<int, McpScope>`; abilities always `['mcp:read', …]` in enum order, never `*`; sets `team_id` and `token_hint` (last 4 characters of the plain token); 422 on `name` "You can have at most 25 active tokens." when 25 unexpired tokens exist (checked under a lock on the user row).
  - `App\Actions\Mcp\RevokeMcpToken::handle(User $user, PersonalAccessToken $token): void` — 404 unless the token belongs to `$user`; deletes the row.
  - `App\Http\Middleware\EnsureMcpIsEnabled` — `abort_unless(config('skrum.mcp.enabled'), 404)`; Task 4 reuses it on `/mcp`.
  - Routes (`auth` + `verified`, `EnsureMcpIsEnabled`): `GET settings/api-tokens` `apiTokens.index` (`RequirePassword`), `POST settings/api-tokens` `apiTokens.store` (`RequirePassword`, `throttle:10,1`), `DELETE settings/api-tokens/{token}` `apiTokens.destroy` (`whereUuid('token')`).
  - `ApiTokensController::index` → Inertia `settings/api-tokens` with props:
    - `tokens: [{id, name, hint, scopes: string[], team: {id, name}|null, teamAccessible: bool, createdAt, expiresAt|null, lastUsedAt|null, isExpired: bool}]` (newest first; `hint` = the 4 stored characters),
    - `teams: [{workspace: {id, name}, teams: [{id, name}]}]` (every team the user can view, grouped by workspace, both alphabetical),
    - `mcpUrl: string` (`url('/mcp')`),
    - `expirationOptions: [{value: '30_days'|'90_days'|'1_year'|'never', label}]`, `defaultExpiration: '90_days'`.
  - `ApiTokensController::store` validates `name` (required, string, max 60, unique among the user's tokens), `scopes` (optional array of `mcp:write` / `mcp:delete`), `team_id` (nullable UUID of a team the user can view), `expiration` (one of the four values); redirects back with Inertia flash `newToken: {name, plainText}`.
  - `ApiTokensController::destroy` → back with toast "Token revoked.".
  - Shared Inertia prop `features: {mcp: bool}`.

- [ ] **Step 1: Write the failing tests**

Create `tests/Feature/Mcp/ApiTokensTest.php`:

```php
<?php

use App\Enums\McpScope;
use App\Enums\WorkspaceRole;
use App\Models\PersonalAccessToken;
use App\Models\Team;
use App\Models\User;
use App\Models\Workspace;
use Carbon\CarbonImmutable;
use Inertia\Support\SessionKey;
use Inertia\Testing\AssertableInertia as Assert;

function apiTokenOwner(): User
{
    return User::factory()->create();
}

it('asks for the password before showing or creating tokens', function () {
    $user = apiTokenOwner();

    $this->actingAs($user)
        ->get(route('apiTokens.index'))
        ->assertRedirect(route('password.confirm'));

    $this->actingAs($user)
        ->post(route('apiTokens.store'), ['name' => 'Laptop', 'expiration' => '90_days'])
        ->assertRedirect(route('password.confirm'));

    expect(PersonalAccessToken::query()->count())->toBe(0);
});

it('requires a verified email', function () {
    $user = User::factory()->unverified()->create();

    $this->actingAs($user)
        ->withSession(['auth.password_confirmed_at' => time()])
        ->get(route('apiTokens.index'))
        ->assertRedirect(route('verification.notice'));
});

it('lists the user tokens without their secrets', function () {
    $user = apiTokenOwner();
    $team = Team::factory()->withMember($user)->create(['name' => 'Platform']);
    $team->workspace->members()->attach($user, ['role' => WorkspaceRole::Member->value]);
    $active = PersonalAccessToken::factory()->forUser($user)->withScopes(McpScope::Write)->boundTo($team)
        ->create(['name' => 'Claude Code', 'token_hint' => 'ab12']);
    PersonalAccessToken::factory()->forUser($user)->expired()->create(['name' => 'Old laptop']);
    PersonalAccessToken::factory()->create(['name' => 'Somebody else']);

    $response = $this->actingAs($user)
        ->withSession(['auth.password_confirmed_at' => time()])
        ->get(route('apiTokens.index'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('settings/api-tokens')
            ->has('tokens', 2)
            ->where('mcpUrl', url('/mcp'))
            ->where('defaultExpiration', '90_days')
            ->has('expirationOptions', 4)
            ->has('teams', 1)
            ->where('teams.0.teams.0.name', 'Platform'));

    $tokens = collect($response->viewData('page')['props']['tokens'])->keyBy('name');

    expect($tokens['Claude Code'])->toMatchArray([
        'id' => $active->id,
        'hint' => 'ab12',
        'scopes' => ['mcp:read', 'mcp:write'],
        'team' => ['id' => $team->id, 'name' => 'Platform'],
        'teamAccessible' => true,
        'isExpired' => false,
        'lastUsedAt' => null,
    ])
        ->and($tokens['Old laptop']['isExpired'])->toBeTrue()
        ->and(json_encode($response->viewData('page')['props']))->not->toContain($active->token);
});

it('flags tokens bound to a team the user can no longer see', function () {
    $user = apiTokenOwner();
    $team = Team::factory()->create();
    PersonalAccessToken::factory()->forUser($user)->boundTo($team)->create(['name' => 'Former team']);

    $this->actingAs($user)
        ->withSession(['auth.password_confirmed_at' => time()])
        ->get(route('apiTokens.index'))
        ->assertInertia(fn (Assert $page) => $page
            ->where('tokens.0.name', 'Former team')
            ->where('tokens.0.teamAccessible', false));
});

it('creates a token and shows it only once', function () {
    $this->travelTo(CarbonImmutable::parse('2026-10-04 10:00:00'));
    $user = apiTokenOwner();
    $team = Team::factory()->withMember($user)->create();

    $response = $this->actingAs($user)
        ->withSession(['auth.password_confirmed_at' => time()])
        ->post(route('apiTokens.store'), [
            'name' => 'Claude Code',
            'scopes' => [McpScope::Write->value],
            'team_id' => $team->id,
            'expiration' => '30_days',
        ])
        ->assertRedirect()
        ->assertSessionHasNoErrors()
        ->assertInertiaFlash('newToken.name', 'Claude Code');

    $plainText = $response->session()->get(SessionKey::FLASH_DATA)['newToken']['plainText'];
    $token = PersonalAccessToken::query()->sole();

    expect($plainText)->toStartWith("{$token->id}|skrum_")
        ->and($token->abilities)->toBe(['mcp:read', 'mcp:write'])
        ->and($token->team_id)->toBe($team->id)
        ->and($token->token_hint)->toBe(substr($plainText, -4))
        ->and($token->expires_at?->toDateTimeString())->toBe('2026-11-03 10:00:00')
        ->and($token->token)->not->toBe(explode('|', $plainText, 2)[1]);

    $this->actingAs($user)
        ->withSession(['auth.password_confirmed_at' => time()])
        ->get(route('apiTokens.index'))
        ->assertInertiaFlashMissing('newToken');
});

it('always grants read and never everything', function () {
    $user = apiTokenOwner();

    $this->actingAs($user)
        ->withSession(['auth.password_confirmed_at' => time()])
        ->post(route('apiTokens.store'), ['name' => 'Wildcard', 'scopes' => ['*'], 'expiration' => '90_days'])
        ->assertSessionHasErrors('scopes.0');

    $this->actingAs($user)
        ->withSession(['auth.password_confirmed_at' => time()])
        ->post(route('apiTokens.store'), ['name' => 'Reader', 'expiration' => '90_days'])
        ->assertSessionHasNoErrors();

    $this->actingAs($user)
        ->withSession(['auth.password_confirmed_at' => time()])
        ->post(route('apiTokens.store'), [
            'name' => 'Everything',
            'scopes' => [McpScope::Delete->value, McpScope::Write->value, McpScope::Write->value],
            'expiration' => '90_days',
        ])
        ->assertSessionHasNoErrors();

    expect(PersonalAccessToken::query()->where('name', 'Reader')->sole()->abilities)->toBe(['mcp:read'])
        ->and(PersonalAccessToken::query()->where('name', 'Everything')->sole()->abilities)->toBe(['mcp:read', 'mcp:write', 'mcp:delete']);
});

it('offers four expirations', function (string $expiration, ?string $expected) {
    $this->travelTo(CarbonImmutable::parse('2026-10-04 10:00:00'));
    $user = apiTokenOwner();

    $this->actingAs($user)
        ->withSession(['auth.password_confirmed_at' => time()])
        ->post(route('apiTokens.store'), ['name' => 'Laptop', 'expiration' => $expiration])
        ->assertSessionHasNoErrors();

    expect(PersonalAccessToken::query()->sole()->expires_at?->toDateTimeString())->toBe($expected);
})->with([
    '30 days' => ['30_days', '2026-11-03 10:00:00'],
    '90 days' => ['90_days', '2027-01-02 10:00:00'],
    '1 year' => ['1_year', '2027-10-04 10:00:00'],
    'never' => ['never', null],
]);

it('refuses unknown expirations', function () {
    $this->actingAs(apiTokenOwner())
        ->withSession(['auth.password_confirmed_at' => time()])
        ->post(route('apiTokens.store'), ['name' => 'Laptop', 'expiration' => 'forever'])
        ->assertSessionHasErrors('expiration');
});

it('keeps token names unique per user', function () {
    $user = apiTokenOwner();
    PersonalAccessToken::factory()->forUser($user)->create(['name' => 'Laptop']);
    PersonalAccessToken::factory()->create(['name' => 'Desktop']);

    $this->actingAs($user)
        ->withSession(['auth.password_confirmed_at' => time()])
        ->post(route('apiTokens.store'), ['name' => 'Laptop', 'expiration' => '90_days'])
        ->assertSessionHasErrors(['name' => 'You already have a token with this name.']);

    $this->actingAs($user)
        ->withSession(['auth.password_confirmed_at' => time()])
        ->post(route('apiTokens.store'), ['name' => 'Desktop', 'expiration' => '90_days'])
        ->assertSessionHasNoErrors();
});

it('limits a user to 25 active tokens', function () {
    $user = apiTokenOwner();
    PersonalAccessToken::factory()->forUser($user)->count(24)->create();
    PersonalAccessToken::factory()->forUser($user)->expired()->count(3)->create();

    $this->actingAs($user)
        ->withSession(['auth.password_confirmed_at' => time()])
        ->post(route('apiTokens.store'), ['name' => 'Twenty-fifth', 'expiration' => '90_days'])
        ->assertSessionHasNoErrors();

    $this->actingAs($user)
        ->withSession(['auth.password_confirmed_at' => time()])
        ->post(route('apiTokens.store'), ['name' => 'Twenty-sixth', 'expiration' => '90_days'])
        ->assertSessionHasErrors(['name' => 'You can have at most 25 active tokens.']);

    expect($user->tokens()->count())->toBe(28);
});

it('binds tokens only to teams the user can see', function () {
    $user = apiTokenOwner();
    $managed = Workspace::factory()->withMember($user, WorkspaceRole::Admin)->create();
    $managedTeam = Team::factory()->create(['workspace_id' => $managed->id]);
    $foreignTeam = Team::factory()->create();

    $this->actingAs($user)
        ->withSession(['auth.password_confirmed_at' => time()])
        ->post(route('apiTokens.store'), ['name' => 'Foreign', 'team_id' => $foreignTeam->id, 'expiration' => '90_days'])
        ->assertSessionHasErrors(['team_id' => 'Choose a team you can see.']);

    $this->actingAs($user)
        ->withSession(['auth.password_confirmed_at' => time()])
        ->post(route('apiTokens.store'), ['name' => 'Managed', 'team_id' => $managedTeam->id, 'expiration' => '90_days'])
        ->assertSessionHasNoErrors();

    expect(PersonalAccessToken::query()->sole()->team_id)->toBe($managedTeam->id);
});

it('revokes only the user own tokens', function () {
    $user = apiTokenOwner();
    $own = PersonalAccessToken::factory()->forUser($user)->create();
    $other = PersonalAccessToken::factory()->create();

    $this->actingAs($user)
        ->delete(route('apiTokens.destroy', $other->id))
        ->assertNotFound();

    $this->actingAs($user)
        ->delete(route('apiTokens.destroy', $own->id))
        ->assertRedirect();

    expect(PersonalAccessToken::query()->whereKey($own->id)->exists())->toBeFalse()
        ->and(PersonalAccessToken::query()->whereKey($other->id)->exists())->toBeTrue();
});

it('hides the api tokens pages when mcp is disabled', function () {
    config(['skrum.mcp.enabled' => false]);
    $user = apiTokenOwner();
    $token = PersonalAccessToken::factory()->forUser($user)->create();

    $this->actingAs($user)->withSession(['auth.password_confirmed_at' => time()])
        ->get(route('apiTokens.index'))->assertNotFound();
    $this->actingAs($user)->withSession(['auth.password_confirmed_at' => time()])
        ->post(route('apiTokens.store'), ['name' => 'Laptop', 'expiration' => '90_days'])->assertNotFound();
    $this->actingAs($user)
        ->delete(route('apiTokens.destroy', $token->id))->assertNotFound();

    $this->actingAs($user)
        ->get(route('profile.edit'))
        ->assertInertia(fn (Assert $page) => $page->where('features.mcp', false));
});

it('shares that mcp is enabled', function () {
    $this->actingAs(apiTokenOwner())
        ->get(route('profile.edit'))
        ->assertInertia(fn (Assert $page) => $page->where('features.mcp', true));
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Mcp/ApiTokensTest.php`
Expected: FAIL — `Route [apiTokens.index] not defined.`

- [ ] **Step 3: Feature switch middleware**

Create `app/Http/Middleware/EnsureMcpIsEnabled.php`:

```php
<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureMcpIsEnabled
{
    public function handle(Request $request, Closure $next): Response
    {
        abort_unless((bool) config('skrum.mcp.enabled'), 404);

        return $next($request);
    }
}
```

- [ ] **Step 4: Actions**

Create `app/Actions/Mcp/IssueMcpToken.php`:

```php
<?php

namespace App\Actions\Mcp;

use App\Enums\McpScope;
use App\Models\PersonalAccessToken;
use App\Models\Team;
use App\Models\User;
use Carbon\CarbonInterface;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Laravel\Sanctum\NewAccessToken;

class IssueMcpToken
{
    public const MaxActiveTokens = 25;

    /**
     * @param  array<int, McpScope>  $scopes
     */
    public function handle(User $user, string $name, array $scopes, ?Team $team, ?CarbonInterface $expiresAt): NewAccessToken
    {
        return DB::transaction(function () use ($user, $name, $scopes, $team, $expiresAt): NewAccessToken {
            User::query()->whereKey($user->id)->lockForUpdate()->firstOrFail();

            $this->ensureRoom($user);

            $newToken = $user->createToken($name, $this->abilities($scopes), $expiresAt);

            $token = $newToken->accessToken;

            assert($token instanceof PersonalAccessToken);

            $token->forceFill([
                'team_id' => $team?->id,
                'token_hint' => substr($newToken->plainTextToken, -4),
            ])->save();

            return $newToken;
        });
    }

    private function ensureRoom(User $user): void
    {
        $active = $user->tokens()
            ->where(fn ($query) => $query->whereNull('expires_at')->orWhere('expires_at', '>', now()))
            ->count();

        if ($active < self::MaxActiveTokens) {
            return;
        }

        throw ValidationException::withMessages([
            'name' => __('You can have at most 25 active tokens.'),
        ]);
    }

    /**
     * @param  array<int, McpScope>  $scopes
     * @return array<int, string>
     */
    private function abilities(array $scopes): array
    {
        return collect(McpScope::cases())
            ->filter(fn (McpScope $scope): bool => $scope === McpScope::Read || in_array($scope, $scopes, true))
            ->map(fn (McpScope $scope): string => $scope->value)
            ->values()
            ->all();
    }
}
```

Create `app/Actions/Mcp/RevokeMcpToken.php`:

```php
<?php

namespace App\Actions\Mcp;

use App\Models\PersonalAccessToken;
use App\Models\User;

class RevokeMcpToken
{
    public function handle(User $user, PersonalAccessToken $token): void
    {
        abort_unless(
            $token->tokenable_type === $user->getMorphClass() && $token->tokenable_id === $user->id,
            404,
        );

        $token->delete();
    }
}
```

- [ ] **Step 5: Controller**

Create `app/Http/Controllers/Settings/ApiTokensController.php`:

```php
<?php

namespace App\Http\Controllers\Settings;

use App\Actions\Mcp\IssueMcpToken;
use App\Actions\Mcp\RevokeMcpToken;
use App\Enums\McpScope;
use App\Http\Controllers\Controller;
use App\Models\PersonalAccessToken;
use App\Models\Team;
use App\Models\User;
use App\Models\Workspace;
use Carbon\CarbonInterface;
use Closure;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class ApiTokensController extends Controller
{
    private const Expirations = ['30_days', '90_days', '1_year', 'never'];

    private const DefaultExpiration = '90_days';

    public function index(Request $request): Response
    {
        $user = $request->user();

        return Inertia::render('settings/api-tokens', [
            'tokens' => $user->tokens()
                ->with('team.workspace')
                ->latest()
                ->get()
                ->map(fn (PersonalAccessToken $token): array => $this->presentToken($user, $token))
                ->values(),
            'teams' => $this->teamsByWorkspace($user),
            'mcpUrl' => url('/mcp'),
            'expirationOptions' => collect(self::Expirations)
                ->map(fn (string $value): array => ['value' => $value, 'label' => $this->expirationLabel($value)])
                ->all(),
            'defaultExpiration' => self::DefaultExpiration,
        ]);
    }

    public function store(Request $request, IssueMcpToken $issueMcpToken): RedirectResponse
    {
        $user = $request->user();

        $validated = $request->validate([
            'name' => [
                'required',
                'string',
                'max:60',
                Rule::unique('personal_access_tokens', 'name')
                    ->where('tokenable_type', $user->getMorphClass())
                    ->where('tokenable_id', $user->id),
            ],
            'scopes' => ['sometimes', 'array'],
            'scopes.*' => ['string', Rule::in([McpScope::Write->value, McpScope::Delete->value])],
            'team_id' => ['nullable', 'uuid', $this->viewableTeam($user)],
            'expiration' => ['required', 'string', Rule::in(self::Expirations)],
        ], [
            'name.unique' => __('You already have a token with this name.'),
        ]);

        $newToken = $issueMcpToken->handle(
            $user,
            $validated['name'],
            array_map(fn (string $scope): McpScope => McpScope::from($scope), $validated['scopes'] ?? []),
            isset($validated['team_id']) ? Team::query()->findOrFail($validated['team_id']) : null,
            $this->expiresAt($validated['expiration']),
        );

        Inertia::flash('newToken', [
            'name' => $validated['name'],
            'plainText' => $newToken->plainTextToken,
        ]);

        return back();
    }

    public function destroy(Request $request, string $token, RevokeMcpToken $revokeMcpToken): RedirectResponse
    {
        $user = $request->user();

        $model = $user->tokens()->whereKey($token)->first();

        abort_unless($model instanceof PersonalAccessToken, 404);

        $revokeMcpToken->handle($user, $model);

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Token revoked.')]);

        return back();
    }

    /**
     * @return array{
     *     id: string,
     *     name: string,
     *     hint: string,
     *     scopes: array<int, string>,
     *     team: array{id: string, name: string}|null,
     *     teamAccessible: bool,
     *     createdAt: ?string,
     *     expiresAt: ?string,
     *     lastUsedAt: ?string,
     *     isExpired: bool
     * }
     */
    private function presentToken(User $user, PersonalAccessToken $token): array
    {
        $team = $token->team;

        return [
            'id' => $token->id,
            'name' => $token->name,
            'hint' => $token->token_hint,
            'scopes' => array_map(fn (McpScope $scope): string => $scope->value, $token->scopes()),
            'team' => $team === null ? null : ['id' => $team->id, 'name' => $team->name],
            'teamAccessible' => $team === null || $user->can('view', $team),
            'createdAt' => $token->created_at?->toIso8601String(),
            'expiresAt' => $token->expires_at?->toIso8601String(),
            'lastUsedAt' => $token->last_used_at?->toIso8601String(),
            'isExpired' => $token->isExpired(now()),
        ];
    }

    /**
     * @return array<int, array{workspace: array{id: string, name: string}, teams: array<int, array{id: string, name: string}>}>
     */
    private function teamsByWorkspace(User $user): array
    {
        return $user->workspaces()
            ->orderBy('name')
            ->get()
            ->map(fn (Workspace $workspace): array => [
                'workspace' => ['id' => $workspace->id, 'name' => $workspace->name],
                'teams' => $workspace->teamsVisibleTo($user)
                    ->map(fn (Team $team): array => ['id' => $team->id, 'name' => $team->name])
                    ->values()
                    ->all(),
            ])
            ->filter(fn (array $group): bool => $group['teams'] !== [])
            ->values()
            ->all();
    }

    private function viewableTeam(User $user): Closure
    {
        return function (string $attribute, mixed $value, Closure $fail) use ($user): void {
            $team = is_string($value) ? Team::query()->find($value) : null;

            if ($team !== null && $user->can('view', $team)) {
                return;
            }

            $fail(__('Choose a team you can see.'));
        };
    }

    private function expiresAt(string $expiration): ?CarbonInterface
    {
        return match ($expiration) {
            '30_days' => now()->addDays(30),
            '90_days' => now()->addDays(90),
            '1_year' => now()->addYear(),
            default => null,
        };
    }

    private function expirationLabel(string $expiration): string
    {
        return match ($expiration) {
            '30_days' => __('30 days'),
            '90_days' => __('90 days'),
            '1_year' => __('1 year'),
            default => __('Never'),
        };
    }
}
```

(`Workspace::teamsVisibleTo(User)` already implements "members see their teams, Owners/Admins see every team", alphabetical.)

- [ ] **Step 6: Routes and shared prop**

In `routes/settings.php` import `App\Http\Controllers\Settings\ApiTokensController` and `App\Http\Middleware\EnsureMcpIsEnabled`, and inside the existing `Route::middleware(['auth', 'verified'])->group(...)`, after the notifications routes, add:

```php
    Route::middleware(EnsureMcpIsEnabled::class)->group(function () {
        Route::get('settings/api-tokens', [ApiTokensController::class, 'index'])
            ->middleware(RequirePassword::class)
            ->name('apiTokens.index');

        Route::post('settings/api-tokens', [ApiTokensController::class, 'store'])
            ->middleware([RequirePassword::class, 'throttle:10,1'])
            ->name('apiTokens.store');

        Route::delete('settings/api-tokens/{token}', [ApiTokensController::class, 'destroy'])
            ->whereUuid('token')
            ->name('apiTokens.destroy');
    });
```

In `app/Http/Middleware/HandleInertiaRequests.php`, in `share()` after `'locales' => config('skrum.locales'),` add:

```php
            'features' => [
                'mcp' => (bool) config('skrum.mcp.enabled'),
            ],
```

- [ ] **Step 7: Placeholder page**

Create `resources/js/pages/settings/api-tokens.tsx` (`inertia.testing.ensure_pages_exist` is on; Task 3 replaces it):

```tsx
import { Head } from '@inertiajs/react';
import { useTrans } from '@/hooks/use-trans';

export default function ApiTokens() {
    const { t } = useTrans();

    return <Head title={t('API tokens')} />;
}
```

Run: `vendor/bin/sail artisan wayfinder:generate --with-form` (never stage `resources/js/actions` or `resources/js/routes`).

- [ ] **Step 8: Translations**

Append only missing keys (`Never` is new; check each with `grep -c`):

`lang/en.json`:
```json
    "You can have at most 25 active tokens.": "You can have at most 25 active tokens.",
    "You already have a token with this name.": "You already have a token with this name.",
    "Choose a team you can see.": "Choose a team you can see.",
    "Token revoked.": "Token revoked.",
    "30 days": "30 days",
    "90 days": "90 days",
    "1 year": "1 year",
    "Never": "Never",
    "API tokens": "API tokens"
```

`lang/fr.json`:
```json
    "You can have at most 25 active tokens.": "Vous pouvez avoir au plus 25 jetons actifs.",
    "You already have a token with this name.": "Vous avez déjà un jeton portant ce nom.",
    "Choose a team you can see.": "Choisissez une équipe à laquelle vous avez accès.",
    "Token revoked.": "Jeton révoqué.",
    "30 days": "30 jours",
    "90 days": "90 jours",
    "1 year": "1 an",
    "Never": "Jamais",
    "API tokens": "Jetons d'API"
```

`lang/es.json`:
```json
    "You can have at most 25 active tokens.": "Puedes tener como máximo 25 tokens activos.",
    "You already have a token with this name.": "Ya tienes un token con este nombre.",
    "Choose a team you can see.": "Elige un equipo al que tengas acceso.",
    "Token revoked.": "Token revocado.",
    "30 days": "30 días",
    "90 days": "90 días",
    "1 year": "1 año",
    "Never": "Nunca",
    "API tokens": "Tokens de API"
```

`lang/de.json`:
```json
    "You can have at most 25 active tokens.": "Du kannst höchstens 25 aktive Tokens haben.",
    "You already have a token with this name.": "Du hast bereits ein Token mit diesem Namen.",
    "Choose a team you can see.": "Wähle ein Team, auf das du Zugriff hast.",
    "Token revoked.": "Token widerrufen.",
    "30 days": "30 Tage",
    "90 days": "90 Tage",
    "1 year": "1 Jahr",
    "Never": "Nie",
    "API tokens": "API-Tokens"
```

- [ ] **Step 9: Run the tests to verify they pass**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Mcp/ApiTokensTest.php tests/Feature/TranslationKeysTest.php tests/Feature/Settings`
Expected: PASS.

- [ ] **Step 10: Static checks**

Run: `vendor/bin/sail bin pint --dirty --format agent`, `vendor/bin/sail bin phpstan analyse --no-progress`, `npm run types:check`
Expected: clean, 0 errors.

- [ ] **Step 11: Commit**

```bash
git add app/Actions/Mcp app/Http/Controllers/Settings/ApiTokensController.php app/Http/Middleware/EnsureMcpIsEnabled.php \
  app/Http/Middleware/HandleInertiaRequests.php routes/settings.php resources/js/pages/settings/api-tokens.tsx \
  lang/en.json lang/fr.json lang/es.json lang/de.json tests/Feature/Mcp/ApiTokensTest.php
git commit -m "feat: issue and revoke mcp api tokens from settings

<Co-Authored-By trailer of the committing agent>
Claude-Session: https://claude.ai/code/session_01SosW8d2Uj7QxsF1tws5ssS"
```

#### Implementer notes

- Spec §8.2 puts `RequirePassword` on the POST only. It is also on the GET here: with Inertia, a POST blocked by `RequirePassword` redirects to the confirmation page and then to the *intended* URL, which would be a GET on the POST route (405). Confirming when the page opens (like the security page) keeps the flow working; the POST keeps the middleware as the spec requires.
- `EnsureMcpIsEnabled` is shared with `/mcp` (Task 4).

### Task 3: API tokens settings page (frontend)

**Files:**
- Create: `resources/js/types/api-tokens.ts`, `resources/js/components/settings/create-token-dialog.tsx`, `resources/js/components/settings/new-token-dialog.tsx`, `resources/js/components/settings/revoke-token-dialog.tsx`
- Modify: `resources/js/pages/settings/api-tokens.tsx` (replaces the Task 2 placeholder), `resources/js/layouts/settings/layout.tsx`, `resources/js/types/index.ts`, `resources/js/types/global.d.ts`, `lang/{en,fr,es,de}.json`

**Interfaces:**
- Consumes (Task 2): Inertia page `settings/api-tokens` props `tokens`, `teams`, `mcpUrl`, `expirationOptions`, `defaultExpiration`; flash `newToken: {name, plainText}`; shared prop `features.mcp`; Wayfinder `@/actions/App/Http/Controllers/Settings/ApiTokensController` (`store()`, `destroy.form(id)`), named routes `@/routes/apiTokens` (`index`); request fields `name`, `scopes[]`, `team_id`, `expiration`.
- Produces: the page of spec §8.1 and the "API tokens" settings navigation entry shown only when `features.mcp`. Types:

```ts
// resources/js/types/api-tokens.ts
export type ApiTokenScope = 'mcp:read' | 'mcp:write' | 'mcp:delete';
export type ApiToken = { id: string; name: string; hint: string; scopes: ApiTokenScope[]; team: { id: string; name: string } | null; teamAccessible: boolean; createdAt: string | null; expiresAt: string | null; lastUsedAt: string | null; isExpired: boolean };
export type ApiTokenTeamGroup = { workspace: { id: string; name: string }; teams: { id: string; name: string }[] };
export type ApiTokenExpiration = '30_days' | '90_days' | '1_year' | 'never';
export type ApiTokenExpirationOption = { value: ApiTokenExpiration; label: string };
export type NewApiToken = { name: string; plainText: string };
```

- [ ] **Step 1: Types and shared props**

Create `resources/js/types/api-tokens.ts` with exactly the block above.

In `resources/js/types/index.ts` append:

```ts
export type * from './api-tokens';
```

In `resources/js/types/global.d.ts` import `NewApiToken` (`import type { NewApiToken } from '@/types/api-tokens';`), add to `sharedPageProps` (before the index signature):

```ts
            features: { mcp: boolean };
```

and to `flashDataType`:

```ts
            newToken?: NewApiToken;
```

- [ ] **Step 2: Settings navigation**

Replace `resources/js/layouts/settings/layout.tsx` with (same markup as today; the list becomes computed so "API tokens" appears only when MCP is enabled):

```tsx
import { Link, usePage } from '@inertiajs/react';
import type { PropsWithChildren } from 'react';
import Heading from '@/components/heading';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useCurrentUrl } from '@/hooks/use-current-url';
import { useTrans } from '@/hooks/use-trans';
import { cn, toUrl } from '@/lib/utils';
import { index as apiTokens } from '@/routes/apiTokens';
import { edit as editAppearance } from '@/routes/appearance';
import { edit as editNotifications } from '@/routes/notificationPreferences';
import { edit } from '@/routes/profile';
import { edit as editSecurity } from '@/routes/security';
import type { NavItem } from '@/types';

const sidebarNavItems: NavItem[] = [
    {
        title: 'Profile',
        href: edit(),
        icon: null,
    },
    {
        title: 'Security',
        href: editSecurity(),
        icon: null,
    },
    {
        title: 'Appearance',
        href: editAppearance(),
        icon: null,
    },
    {
        title: 'Notifications',
        href: editNotifications(),
        icon: null,
    },
];

const apiTokensNavItem: NavItem = {
    title: 'API tokens',
    href: apiTokens(),
    icon: null,
};

export default function SettingsLayout({ children }: PropsWithChildren) {
    const { isCurrentOrParentUrl } = useCurrentUrl();
    const { t } = useTrans();
    const { features } = usePage().props;
    const navItems = features.mcp
        ? [...sidebarNavItems, apiTokensNavItem]
        : sidebarNavItems;

    return (
        <div className="px-4 py-6">
            <Heading
                title={t('Settings')}
                description={t('Manage your profile and account settings')}
            />

            <div className="flex flex-col lg:flex-row lg:space-x-12">
                <aside className="w-full max-w-xl lg:w-48">
                    <nav
                        className="flex flex-col space-y-1 space-x-0"
                        aria-label={t('Settings')}
                    >
                        {navItems.map((item, index) => (
                            <Button
                                key={`${toUrl(item.href)}-${index}`}
                                size="sm"
                                variant="ghost"
                                asChild
                                className={cn('w-full justify-start', {
                                    'bg-muted': isCurrentOrParentUrl(item.href),
                                })}
                            >
                                <Link href={item.href}>
                                    {item.icon && (
                                        <item.icon className="h-4 w-4" />
                                    )}
                                    {t(item.title)}
                                </Link>
                            </Button>
                        ))}
                    </nav>
                </aside>

                <Separator className="my-6 lg:hidden" />

                <div className="flex-1 md:max-w-2xl">
                    <section className="max-w-xl space-y-12">
                        {children}
                    </section>
                </div>
            </div>
        </div>
    );
}
```


- [ ] **Step 3: Create-token dialog**

Create `resources/js/components/settings/create-token-dialog.tsx`:

```tsx
import { useForm } from '@inertiajs/react';
import { useState } from 'react';
import ApiTokensController from '@/actions/App/Http/Controllers/Settings/ApiTokensController';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectLabel,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { useTrans } from '@/hooks/use-trans';
import type {
    ApiTokenExpiration,
    ApiTokenExpirationOption,
    ApiTokenTeamGroup,
} from '@/types';

const AllTeams = 'all';

type Props = {
    teams: ApiTokenTeamGroup[];
    expirationOptions: ApiTokenExpirationOption[];
    defaultExpiration: ApiTokenExpiration;
};

type TokenForm = {
    name: string;
    scopes: string[];
    team_id: string | null;
    expiration: ApiTokenExpiration;
};

export function CreateTokenDialog({
    teams,
    expirationOptions,
    defaultExpiration,
}: Props) {
    const { t } = useTrans();
    const [open, setOpen] = useState(false);
    const form = useForm<TokenForm>({
        name: '',
        scopes: [],
        team_id: null,
        expiration: defaultExpiration,
    });

    const toggleScope = (scope: string, checked: boolean) =>
        form.setData(
            'scopes',
            checked
                ? [...form.data.scopes, scope]
                : form.data.scopes.filter((value) => value !== scope),
        );

    const submit = () =>
        form.submit(ApiTokensController.store(), {
            preserveScroll: true,
            onSuccess: () => {
                form.reset();
                setOpen(false);
            },
        });

    return (
        <Dialog
            open={open}
            onOpenChange={(next) => {
                setOpen(next);

                if (!next) {
                    form.reset();
                    form.clearErrors();
                }
            }}
        >
            <DialogTrigger asChild>
                <Button>{t('Create token')}</Button>
            </DialogTrigger>
            <DialogContent aria-describedby={undefined}>
                <DialogTitle>{t('Create token')}</DialogTitle>

                <form
                    className="space-y-4"
                    onSubmit={(event) => {
                        event.preventDefault();
                        submit();
                    }}
                >
                    <div className="grid gap-2">
                        <Label htmlFor="token-name">{t('Name')}</Label>
                        <Input
                            id="token-name"
                            value={form.data.name}
                            maxLength={60}
                            required
                            autoFocus
                            onChange={(event) =>
                                form.setData('name', event.target.value)
                            }
                        />
                        <InputError message={form.errors.name} />
                    </div>

                    <fieldset className="grid gap-2">
                        <legend className="mb-1 text-sm font-medium">
                            {t('Permissions')}
                        </legend>
                        <div className="flex items-center gap-3">
                            <Checkbox id="scope-read" checked disabled />
                            <Label htmlFor="scope-read">{t('Read')}</Label>
                        </div>
                        <div className="flex items-center gap-3">
                            <Checkbox
                                id="scope-write"
                                checked={form.data.scopes.includes('mcp:write')}
                                onCheckedChange={(checked) =>
                                    toggleScope('mcp:write', checked === true)
                                }
                            />
                            <Label htmlFor="scope-write">
                                {t('Create and update')}
                            </Label>
                        </div>
                        <div className="flex items-start gap-3">
                            <Checkbox
                                id="scope-delete"
                                checked={form.data.scopes.includes(
                                    'mcp:delete',
                                )}
                                onCheckedChange={(checked) =>
                                    toggleScope('mcp:delete', checked === true)
                                }
                            />
                            <div className="grid gap-1">
                                <Label htmlFor="scope-delete">
                                    {t('Delete my messages')}
                                </Label>
                                <p className="text-xs text-muted-foreground">
                                    {t(
                                        'Lets the client delete messages you wrote.',
                                    )}
                                </p>
                            </div>
                        </div>
                        <InputError message={form.errors.scopes} />
                    </fieldset>

                    <div className="grid gap-2">
                        <Label htmlFor="token-team">{t('Team')}</Label>
                        <Select
                            value={form.data.team_id ?? AllTeams}
                            onValueChange={(value) =>
                                form.setData(
                                    'team_id',
                                    value === AllTeams ? null : value,
                                )
                            }
                        >
                            <SelectTrigger id="token-team">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value={AllTeams}>
                                    {t('All my teams')}
                                </SelectItem>
                                {teams.map((group) => (
                                    <SelectGroup key={group.workspace.id}>
                                        <SelectLabel>
                                            {group.workspace.name}
                                        </SelectLabel>
                                        {group.teams.map((team) => (
                                            <SelectItem
                                                key={team.id}
                                                value={team.id}
                                            >
                                                {team.name}
                                            </SelectItem>
                                        ))}
                                    </SelectGroup>
                                ))}
                            </SelectContent>
                        </Select>
                        <InputError message={form.errors.team_id} />
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="token-expiration">
                            {t('Expiration')}
                        </Label>
                        <Select
                            value={form.data.expiration}
                            onValueChange={(value) =>
                                form.setData(
                                    'expiration',
                                    value as ApiTokenExpiration,
                                )
                            }
                        >
                            <SelectTrigger id="token-expiration">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {expirationOptions.map((option) => (
                                    <SelectItem
                                        key={option.value}
                                        value={option.value}
                                    >
                                        {option.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <InputError message={form.errors.expiration} />
                    </div>

                    <DialogFooter className="gap-2">
                        <Button
                            type="button"
                            variant="secondary"
                            onClick={() => setOpen(false)}
                        >
                            {t('Cancel')}
                        </Button>
                        <Button disabled={form.processing}>
                            {t('Create token')}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
```

- [ ] **Step 4: One-time token dialog**

Create `resources/js/components/settings/new-token-dialog.tsx`:

```tsx
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useClipboard } from '@/hooks/use-clipboard';
import { useTrans } from '@/hooks/use-trans';
import type { NewApiToken } from '@/types';

type Snippet = 'claude' | 'json';

type Props = {
    token: NewApiToken | null;
    mcpUrl: string;
    onClose: () => void;
};

export function NewTokenDialog({ token, mcpUrl, onClose }: Props) {
    const { t } = useTrans();
    const [, copy] = useClipboard();
    const [snippet, setSnippet] = useState<Snippet>('claude');

    if (token === null) {
        return null;
    }

    const snippets: Record<Snippet, string> = {
        claude: `claude mcp add --transport http skrum ${mcpUrl} --header "Authorization: Bearer ${token.plainText}"`,
        json: JSON.stringify(
            {
                mcpServers: {
                    skrum: {
                        type: 'http',
                        url: mcpUrl,
                        headers: {
                            Authorization: `Bearer ${token.plainText}`,
                        },
                    },
                },
            },
            null,
            2,
        ),
    };

    const copyText = async (text: string, message: string) => {
        if (await copy(text)) {
            toast(message);

            return;
        }

        toast.error(t('Something went wrong. Please try again.'));
    };

    return (
        <Dialog
            open
            onOpenChange={(open) => {
                if (!open) {
                    onClose();
                }
            }}
        >
            <DialogContent className="sm:max-w-2xl">
                <DialogTitle>{token.name}</DialogTitle>
                <DialogDescription>
                    {t("Copy your token now. You won't be able to see it again.")}
                </DialogDescription>

                <div className="flex gap-2">
                    <Input
                        readOnly
                        value={token.plainText}
                        aria-label={t('API token')}
                        className="font-mono"
                        onFocus={(event) => event.currentTarget.select()}
                    />
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() =>
                            void copyText(token.plainText, t('Token copied'))
                        }
                    >
                        {t('Copy')}
                    </Button>
                </div>

                <div className="space-y-2">
                    <div
                        role="tablist"
                        aria-label={t('Client configuration')}
                        className="flex gap-2"
                    >
                        <Button
                            type="button"
                            role="tab"
                            size="sm"
                            variant={snippet === 'claude' ? 'default' : 'outline'}
                            aria-selected={snippet === 'claude'}
                            onClick={() => setSnippet('claude')}
                        >
                            Claude Code
                        </Button>
                        <Button
                            type="button"
                            role="tab"
                            size="sm"
                            variant={snippet === 'json' ? 'default' : 'outline'}
                            aria-selected={snippet === 'json'}
                            onClick={() => setSnippet('json')}
                        >
                            {t('Other clients (JSON)')}
                        </Button>
                    </div>
                    <pre
                        role="tabpanel"
                        className="max-h-60 overflow-auto rounded-md bg-muted p-3 text-xs whitespace-pre-wrap break-all"
                    >
                        {snippets[snippet]}
                    </pre>
                    <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() =>
                            void copyText(snippets[snippet], t('Copied'))
                        }
                    >
                        {t('Copy configuration')}
                    </Button>
                </div>

                <DialogFooter>
                    <Button type="button" onClick={onClose}>
                        {t('Done')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
```

- [ ] **Step 5: Revoke dialog**

Create `resources/js/components/settings/revoke-token-dialog.tsx`:

```tsx
import ApiTokensController from '@/actions/App/Http/Controllers/Settings/ApiTokensController';
import ConfirmFormDialog from '@/components/confirm-form-dialog';
import { Button } from '@/components/ui/button';
import { useTrans } from '@/hooks/use-trans';
import type { ApiToken } from '@/types';

export function RevokeTokenDialog({ token }: { token: ApiToken }) {
    const { t } = useTrans();

    return (
        <ConfirmFormDialog
            form={{
                ...ApiTokensController.destroy.form(token.id),
                options: { preserveScroll: true },
            }}
            title={t('Revoke this token?')}
            description={t(
                'Clients using ":name" lose access on their next request.',
                { name: token.name },
            )}
            confirmLabel={t('Revoke')}
            trigger={
                <Button size="sm" variant="ghost">
                    {t('Revoke')}
                </Button>
            }
        />
    );
}
```

- [ ] **Step 6: The page**

Replace `resources/js/pages/settings/api-tokens.tsx`:

```tsx
import { Head, usePage } from '@inertiajs/react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import Heading from '@/components/heading';
import { CreateTokenDialog } from '@/components/settings/create-token-dialog';
import { NewTokenDialog } from '@/components/settings/new-token-dialog';
import { RevokeTokenDialog } from '@/components/settings/revoke-token-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useClipboard } from '@/hooks/use-clipboard';
import { useTrans } from '@/hooks/use-trans';
import type {
    ApiToken,
    ApiTokenExpiration,
    ApiTokenExpirationOption,
    ApiTokenScope,
    ApiTokenTeamGroup,
    NewApiToken,
} from '@/types';

type Props = {
    tokens: ApiToken[];
    teams: ApiTokenTeamGroup[];
    mcpUrl: string;
    expirationOptions: ApiTokenExpirationOption[];
    defaultExpiration: ApiTokenExpiration;
};

const ScopeLabels: Record<ApiTokenScope, string> = {
    'mcp:read': 'Read',
    'mcp:write': 'Create and update',
    'mcp:delete': 'Delete my messages',
};

export default function ApiTokens({
    tokens,
    teams,
    mcpUrl,
    expirationOptions,
    defaultExpiration,
}: Props) {
    const { t } = useTrans();
    const page = usePage();
    const { locale } = page.props;
    const flashedToken = page.flash.newToken ?? null;
    const [newToken, setNewToken] = useState<NewApiToken | null>(
        flashedToken,
    );
    const [, copy] = useClipboard();
    const dateFormat = new Intl.DateTimeFormat(locale, { dateStyle: 'medium' });
    const formatDate = (value: string | null) =>
        value === null ? t('Never') : dateFormat.format(new Date(value));

    useEffect(() => {
        if (flashedToken !== null) {
            setNewToken(flashedToken);
        }
    }, [flashedToken]);

    const copyUrl = async () => {
        if (await copy(mcpUrl)) {
            toast(t('Link copied'));

            return;
        }

        toast.error(t('Something went wrong. Please try again.'));
    };

    return (
        <>
            <Head title={t('API tokens')} />

            <h1 className="sr-only">{t('API tokens')}</h1>

            <div className="space-y-6">
                <Heading
                    variant="small"
                    title={t('API tokens')}
                    description={t(
                        'Connect an AI assistant that supports MCP to skrum with a personal token.',
                    )}
                />

                <div className="space-y-2">
                    <label
                        htmlFor="mcp-url"
                        className="text-sm font-medium"
                    >
                        {t('Server URL')}
                    </label>
                    <div className="flex gap-2">
                        <Input
                            id="mcp-url"
                            readOnly
                            value={mcpUrl}
                            className="font-mono"
                            onFocus={(event) => event.currentTarget.select()}
                        />
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => void copyUrl()}
                        >
                            {t('Copy')}
                        </Button>
                    </div>
                    <p className="text-sm text-muted-foreground">
                        {t(
                            'Use a client that can send an Authorization header (Claude Code, Cursor, VS Code…). Web connectors that require a sign-in are not supported yet.',
                        )}
                    </p>
                </div>

                <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                    <li>
                        {t(
                            'Data you read through this connection is sent to the AI application you use.',
                        )}
                    </li>
                    <li>
                        {t(
                            'Tokens stay valid after a password change. Revoke them here.',
                        )}
                    </li>
                </ul>

                <CreateTokenDialog
                    teams={teams}
                    expirationOptions={expirationOptions}
                    defaultExpiration={defaultExpiration}
                />

                {tokens.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                        {t('No API tokens yet.')}
                    </p>
                ) : (
                    <div className="overflow-x-auto rounded-md border">
                        <table className="w-full text-sm">
                            <thead className="bg-muted/50 text-left">
                                <tr>
                                    <th className="p-2 font-medium">
                                        {t('Name')}
                                    </th>
                                    <th className="p-2 font-medium">
                                        {t('Permissions')}
                                    </th>
                                    <th className="p-2 font-medium">
                                        {t('Team')}
                                    </th>
                                    <th className="p-2 font-medium">
                                        {t('Created')}
                                    </th>
                                    <th className="p-2 font-medium">
                                        {t('Expires')}
                                    </th>
                                    <th className="p-2 font-medium">
                                        {t('Last used')}
                                    </th>
                                    <th className="p-2 font-medium">
                                        {t('Status')}
                                    </th>
                                    <th className="p-2">
                                        <span className="sr-only">
                                            {t('Revoke')}
                                        </span>
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {tokens.map((token) => (
                                    <tr
                                        key={token.id}
                                        className={
                                            token.isExpired
                                                ? 'text-muted-foreground'
                                                : undefined
                                        }
                                    >
                                        <td className="p-2">
                                            <div className="font-medium">
                                                {token.name}
                                            </div>
                                            <div className="font-mono text-xs text-muted-foreground">
                                                skrum_…{token.hint}
                                            </div>
                                        </td>
                                        <td className="p-2">
                                            <div className="flex flex-wrap gap-1">
                                                {token.scopes.map((scope) => (
                                                    <Badge
                                                        key={scope}
                                                        variant="secondary"
                                                    >
                                                        {t(ScopeLabels[scope])}
                                                    </Badge>
                                                ))}
                                            </div>
                                        </td>
                                        <td className="p-2">
                                            {token.team === null
                                                ? t('All teams')
                                                : token.team.name}
                                            {!token.teamAccessible && (
                                                <div className="text-xs text-destructive">
                                                    {t(
                                                        'No access to this team anymore',
                                                    )}
                                                </div>
                                            )}
                                        </td>
                                        <td className="p-2">
                                            {formatDate(token.createdAt)}
                                        </td>
                                        <td className="p-2">
                                            {token.isExpired &&
                                            token.expiresAt !== null
                                                ? t('Expired on :date', {
                                                      date: formatDate(
                                                          token.expiresAt,
                                                      ),
                                                  })
                                                : formatDate(token.expiresAt)}
                                        </td>
                                        <td className="p-2">
                                            {formatDate(token.lastUsedAt)}
                                        </td>
                                        <td className="p-2">
                                            <Badge
                                                variant={
                                                    token.isExpired
                                                        ? 'outline'
                                                        : 'default'
                                                }
                                            >
                                                {token.isExpired
                                                    ? t('Expired')
                                                    : t('Active')}
                                            </Badge>
                                        </td>
                                        <td className="p-2 text-right">
                                            <RevokeTokenDialog token={token} />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            <NewTokenDialog
                token={newToken}
                mcpUrl={mcpUrl}
                onClose={() => setNewToken(null)}
            />
        </>
    );
}
```

- [ ] **Step 7: Translations**

Append only keys missing from each file (already present and skipped: "Copy", "Cancel", "Name", "Team", "Revoke", "Expired", "Status", "All teams", "Done", "Link copied", "Something went wrong. Please try again."; from Tasks 1–2: "Read", "Create and update", "Delete my messages", "Never", "API tokens"). Check each with `grep -c '"KEY":' lang/en.json` first.

`lang/en.json`:
```json
    "Connect an AI assistant that supports MCP to skrum with a personal token.": "Connect an AI assistant that supports MCP to skrum with a personal token.",
    "Server URL": "Server URL",
    "Use a client that can send an Authorization header (Claude Code, Cursor, VS Code…). Web connectors that require a sign-in are not supported yet.": "Use a client that can send an Authorization header (Claude Code, Cursor, VS Code…). Web connectors that require a sign-in are not supported yet.",
    "Data you read through this connection is sent to the AI application you use.": "Data you read through this connection is sent to the AI application you use.",
    "Tokens stay valid after a password change. Revoke them here.": "Tokens stay valid after a password change. Revoke them here.",
    "Create token": "Create token",
    "Permissions": "Permissions",
    "Lets the client delete messages you wrote.": "Lets the client delete messages you wrote.",
    "All my teams": "All my teams",
    "Expiration": "Expiration",
    "Copy your token now. You won't be able to see it again.": "Copy your token now. You won't be able to see it again.",
    "API token": "API token",
    "Token copied": "Token copied",
    "Client configuration": "Client configuration",
    "Other clients (JSON)": "Other clients (JSON)",
    "Copied": "Copied",
    "Copy configuration": "Copy configuration",
    "Revoke this token?": "Revoke this token?",
    "Clients using \":name\" lose access on their next request.": "Clients using \":name\" lose access on their next request.",
    "No API tokens yet.": "No API tokens yet.",
    "Created": "Created",
    "Expires": "Expires",
    "Last used": "Last used",
    "No access to this team anymore": "No access to this team anymore",
    "Expired on :date": "Expired on :date",
    "Active": "Active"
```

`lang/fr.json`:
```json
    "Connect an AI assistant that supports MCP to skrum with a personal token.": "Connectez à skrum un assistant IA compatible MCP avec un jeton personnel.",
    "Server URL": "URL du serveur",
    "Use a client that can send an Authorization header (Claude Code, Cursor, VS Code…). Web connectors that require a sign-in are not supported yet.": "Utilisez un client capable d'envoyer un en-tête Authorization (Claude Code, Cursor, VS Code…). Les connecteurs web qui exigent une connexion ne sont pas encore pris en charge.",
    "Data you read through this connection is sent to the AI application you use.": "Les données lues via cette connexion sont envoyées à l'application d'IA que vous utilisez.",
    "Tokens stay valid after a password change. Revoke them here.": "Les jetons restent valides après un changement de mot de passe. Révoquez-les ici.",
    "Create token": "Créer un jeton",
    "Permissions": "Permissions",
    "Lets the client delete messages you wrote.": "Permet au client de supprimer les messages que vous avez écrits.",
    "All my teams": "Toutes mes équipes",
    "Expiration": "Expiration",
    "Copy your token now. You won't be able to see it again.": "Copiez votre jeton maintenant. Vous ne pourrez plus le voir ensuite.",
    "API token": "Jeton d'API",
    "Token copied": "Jeton copié",
    "Client configuration": "Configuration du client",
    "Other clients (JSON)": "Autres clients (JSON)",
    "Copied": "Copié",
    "Copy configuration": "Copier la configuration",
    "Revoke this token?": "Révoquer ce jeton ?",
    "Clients using \":name\" lose access on their next request.": "Les clients qui utilisent « :name » perdent l'accès à leur prochaine requête.",
    "No API tokens yet.": "Aucun jeton d'API pour le moment.",
    "Created": "Créé",
    "Expires": "Expire",
    "Last used": "Dernière utilisation",
    "No access to this team anymore": "Plus d'accès à cette équipe",
    "Expired on :date": "Expiré le :date",
    "Active": "Actif"
```

`lang/es.json`:
```json
    "Connect an AI assistant that supports MCP to skrum with a personal token.": "Conecta a skrum un asistente de IA compatible con MCP usando un token personal.",
    "Server URL": "URL del servidor",
    "Use a client that can send an Authorization header (Claude Code, Cursor, VS Code…). Web connectors that require a sign-in are not supported yet.": "Usa un cliente que pueda enviar una cabecera Authorization (Claude Code, Cursor, VS Code…). Los conectores web que requieren iniciar sesión aún no son compatibles.",
    "Data you read through this connection is sent to the AI application you use.": "Los datos que lees a través de esta conexión se envían a la aplicación de IA que usas.",
    "Tokens stay valid after a password change. Revoke them here.": "Los tokens siguen siendo válidos tras cambiar la contraseña. Revócalos aquí.",
    "Create token": "Crear token",
    "Permissions": "Permisos",
    "Lets the client delete messages you wrote.": "Permite al cliente eliminar los mensajes que escribiste.",
    "All my teams": "Todos mis equipos",
    "Expiration": "Caducidad",
    "Copy your token now. You won't be able to see it again.": "Copia tu token ahora. No podrás volver a verlo.",
    "API token": "Token de API",
    "Token copied": "Token copiado",
    "Client configuration": "Configuración del cliente",
    "Other clients (JSON)": "Otros clientes (JSON)",
    "Copied": "Copiado",
    "Copy configuration": "Copiar configuración",
    "Revoke this token?": "¿Revocar este token?",
    "Clients using \":name\" lose access on their next request.": "Los clientes que usan «:name» pierden el acceso en su próxima solicitud.",
    "No API tokens yet.": "Aún no hay tokens de API.",
    "Created": "Creado",
    "Expires": "Caduca",
    "Last used": "Último uso",
    "No access to this team anymore": "Ya sin acceso a este equipo",
    "Expired on :date": "Caducó el :date",
    "Active": "Activo"
```

`lang/de.json`:
```json
    "Connect an AI assistant that supports MCP to skrum with a personal token.": "Verbinde einen KI-Assistenten mit MCP-Unterstützung über ein persönliches Token mit skrum.",
    "Server URL": "Server-URL",
    "Use a client that can send an Authorization header (Claude Code, Cursor, VS Code…). Web connectors that require a sign-in are not supported yet.": "Verwende einen Client, der einen Authorization-Header senden kann (Claude Code, Cursor, VS Code…). Web-Connectoren, die eine Anmeldung verlangen, werden noch nicht unterstützt.",
    "Data you read through this connection is sent to the AI application you use.": "Daten, die du über diese Verbindung liest, werden an die KI-Anwendung gesendet, die du verwendest.",
    "Tokens stay valid after a password change. Revoke them here.": "Tokens bleiben nach einer Passwortänderung gültig. Widerrufe sie hier.",
    "Create token": "Token erstellen",
    "Permissions": "Berechtigungen",
    "Lets the client delete messages you wrote.": "Erlaubt dem Client, von dir geschriebene Nachrichten zu löschen.",
    "All my teams": "Alle meine Teams",
    "Expiration": "Ablauf",
    "Copy your token now. You won't be able to see it again.": "Kopiere dein Token jetzt. Du kannst es später nicht mehr sehen.",
    "API token": "API-Token",
    "Token copied": "Token kopiert",
    "Client configuration": "Client-Konfiguration",
    "Other clients (JSON)": "Andere Clients (JSON)",
    "Copied": "Kopiert",
    "Copy configuration": "Konfiguration kopieren",
    "Revoke this token?": "Dieses Token widerrufen?",
    "Clients using \":name\" lose access on their next request.": "Clients, die „:name“ verwenden, verlieren bei ihrer nächsten Anfrage den Zugriff.",
    "No API tokens yet.": "Noch keine API-Tokens.",
    "Created": "Erstellt",
    "Expires": "Läuft ab",
    "Last used": "Zuletzt verwendet",
    "No access to this team anymore": "Kein Zugriff mehr auf dieses Team",
    "Expired on :date": "Abgelaufen am :date",
    "Active": "Aktiv"
```

- [ ] **Step 8: Checks**

Run: `vendor/bin/sail artisan wayfinder:generate --with-form`, then `npm run types:check && npm run check` (only the known pre-existing failures in `.devcontainer/devcontainer.json` and `docs/superpowers/*.md`), `npx vp check --fix resources/js/pages/settings/api-tokens.tsx resources/js/components/settings resources/js/layouts/settings/layout.tsx resources/js/types/api-tokens.ts resources/js/types/index.ts resources/js/types/global.d.ts`, and `vendor/bin/sail artisan test --compact tests/Feature/TranslationKeysTest.php tests/Feature/Mcp/ApiTokensTest.php`.
Expected: types clean, lint clean on the touched files, tests pass.

Manual check (`npm run build` or `npm run dev`): Settings shows "API tokens"; the page asks for the password first; create a token with "Create and update", a team and 30 days → the one-time dialog shows the token, both snippets copy; closing it and reloading never shows it again; the table shows `skrum_…abcd`, badges, team, dates, "Active"; revoke asks for confirmation and removes the row.

- [ ] **Step 9: Commit**

```bash
git add resources/js/pages/settings/api-tokens.tsx resources/js/components/settings resources/js/layouts/settings/layout.tsx \
  resources/js/types/api-tokens.ts resources/js/types/index.ts resources/js/types/global.d.ts \
  lang/en.json lang/fr.json lang/es.json lang/de.json
git commit -m "feat: add the api tokens settings page

<Co-Authored-By trailer of the committing agent>
Claude-Session: https://claude.ai/code/session_01SosW8d2Uj7QxsF1tws5ssS"
```

#### Implementer notes

- "Claude Code" (snippet tab) and the snippet texts are product names and shell/JSON, not translated.
- The flashed token lives in page state only: once the dialog closes it is gone; Inertia pulls flash data once, so a reload never shows it again (Task 2 test "creates a token and shows it only once").

### Task 4: MCP endpoint and authentication

**Files:**
- Create: `routes/ai.php`, `app/Mcp/Servers/SkrumServer.php`, `app/Mcp/McpGrant.php`, `app/Mcp/McpGrantContext.php`, `app/Http/Middleware/AuthenticateMcpRequest.php`, `app/Http/Middleware/SetMcpLocale.php`
- Modify: `app/Providers/AppServiceProvider.php` (scoped grant context, `McpGrant` binding, `mcp` rate limiter), `config/skrum.php` (`version`), `tests/Pest.php` (helpers `issueTestMcpToken`, `postMcp`), `lang/{en,fr,es,de}.json`
- Test: create `tests/Feature/Mcp/McpAuthenticationTest.php`

**Interfaces:**
- Consumes: Task 1 (`PersonalAccessToken`, `McpScope`, `User::createToken`, `config('skrum.mcp.*')`, Sanctum config), Task 2 (`EnsureMcpIsEnabled`).
- Produces:
  - `POST {APP_URL}/mcp` (route name `mcp`) served by `laravel/mcp` (`Mcp::web`), middleware `EnsureMcpIsEnabled`, `AuthenticateMcpRequest`, `SetMcpLocale`, `throttle:mcp`; `laravel/mcp`'s `AddWwwAuthenticateHeader` is removed from the route (it would rewrite the header to `realm="mcp"`). The route is registered only when `skrum.mcp.enabled` is true at boot; `EnsureMcpIsEnabled` also answers 404 when the switch is off at runtime.
  - `App\Mcp\Servers\SkrumServer extends Laravel\Mcp\Server` — `#[Name('skrum')]`, `#[Instructions(...)]`; `boot()` sets `$version` from `config('skrum.version')`; `protected array $tools = []` and `protected array $prompts = []` (filled by later tasks); `public int $defaultPaginationLength = 50` (so `tools/list` returns every tool on one page).
  - `App\Mcp\McpGrant` — `__construct(public User $user, public string $tokenId, public array $scopes, public ?string $teamId)` (`$scopes`: `array<int, McpScope>`); `has(McpScope $scope): bool`; `bind(): void` (stores the grant in the request-scoped `McpGrantContext`); `static bound(): bool`; `static current(): self` (throws `RuntimeException` when nothing is bound). The container resolves `McpGrant` to `McpGrant::current()`, so tools may type-hint it.
  - `App\Mcp\McpGrantContext` — `public ?McpGrant $grant = null`; registered with `$this->app->scoped(...)` (Octane resets it per request).
  - `AuthenticateMcpRequest` — bearer required; user from `Auth::guard('sanctum')`; token must be an unexpired `App\Models\PersonalAccessToken` containing `mcp:read`; user's email verified; then `Auth::shouldUse('sanctum')` and the grant is bound. Any failure → HTTP 401 JSON `{"error": "Unauthenticated."}` with `WWW-Authenticate: Bearer realm="skrum"`.
  - `SetMcpLocale` — the grant user's `locale` when supported (`config('skrum.locales')`), else `en`.
  - Rate limiter `mcp`: `config('skrum.mcp.rate_limit')` per minute keyed `mcp-token:{tokenId}` (IP when no grant is bound) → 429 with `Retry-After`.
  - `config('skrum.version')` (`SKRUM_VERSION`, default `'1.0.0'`).
  - Pest helpers: `issueTestMcpToken(User $user, array $scopes = [McpScope::Read], ?Team $team = null, ?CarbonInterface $expiresAt = null): string` (plain token through `createToken`, with `team_id`/`token_hint` set), `postMcp(?string $token, array $payload = ['jsonrpc' => '2.0', 'id' => 1, 'method' => 'tools/list'], array $headers = []): TestResponse` (forgets cached guards and scoped instances first — Sanctum's `RequestGuard` caches the user and scoped singletons survive across requests of one test — and posts JSON to `/mcp`).

- [ ] **Step 1: Test helpers**

In `tests/Pest.php` add the imports `use App\Enums\McpScope;`, `use App\Models\PersonalAccessToken;`, `use Carbon\CarbonInterface;` and `use Illuminate\Testing\TestResponse;` (keep the existing ones) and append:

```php
/**
 * @param  array<int, McpScope>  $scopes
 */
function issueTestMcpToken(User $user, array $scopes = [McpScope::Read], ?Team $team = null, ?CarbonInterface $expiresAt = null): string
{
    $abilities = collect([McpScope::Read, ...$scopes])
        ->map(fn (McpScope $scope): string => $scope->value)
        ->unique()
        ->values()
        ->all();

    $newToken = $user->createToken('Test client', $abilities, $expiresAt);

    $token = $newToken->accessToken;

    assert($token instanceof PersonalAccessToken);

    $token->forceFill([
        'team_id' => $team?->id,
        'token_hint' => substr($newToken->plainTextToken, -4),
    ])->save();

    return $newToken->plainTextToken;
}

/**
 * @param  array<string, mixed>  $payload
 * @param  array<string, string>  $headers
 */
function postMcp(?string $token, array $payload = ['jsonrpc' => '2.0', 'id' => 1, 'method' => 'tools/list'], array $headers = []): TestResponse
{
    app('auth')->forgetGuards();
    app()->forgetScopedInstances();

    if ($token !== null) {
        $headers['Authorization'] = "Bearer {$token}";
    }

    return test()->postJson('/mcp', $payload, [
        'Accept' => 'application/json, text/event-stream',
        ...$headers,
    ]);
}
```

- [ ] **Step 2: Write the failing tests**

Create `tests/Feature/Mcp/McpAuthenticationTest.php`:

```php
<?php

use App\Enums\McpScope;
use App\Models\PersonalAccessToken;
use App\Models\User;
use Illuminate\Log\Events\MessageLogged;
use Illuminate\Support\Facades\Event;

function initializeMcpPayload(): array
{
    return [
        'jsonrpc' => '2.0',
        'id' => 1,
        'method' => 'initialize',
        'params' => [
            'protocolVersion' => '2025-06-18',
            'capabilities' => [],
            'clientInfo' => ['name' => 'pest', 'version' => '1.0'],
        ],
    ];
}

it('refuses requests without a bearer token', function () {
    postMcp(null)
        ->assertUnauthorized()
        ->assertHeader('WWW-Authenticate', 'Bearer realm="skrum"')
        ->assertExactJson(['error' => 'Unauthenticated.']);
});

it('serves the skrum server to a valid token', function () {
    $token = issueTestMcpToken(User::factory()->create());

    postMcp($token, initializeMcpPayload())
        ->assertOk()
        ->assertJsonPath('result.serverInfo.name', 'skrum')
        ->assertJsonPath('result.serverInfo.version', '1.0.0');

    postMcp($token)
        ->assertOk()
        ->assertJsonStructure(['result' => ['tools']]);
});

it('refuses wrong, revoked and expired tokens', function (Closure $makeToken) {
    postMcp($makeToken())
        ->assertUnauthorized()
        ->assertHeader('WWW-Authenticate', 'Bearer realm="skrum"');
})->with([
    'unknown' => fn () => fn () => 'not-a-token',
    'forged secret' => fn () => function () {
        $token = issueTestMcpToken(User::factory()->create());

        return explode('|', $token)[0].'|skrum_forged';
    },
    'revoked' => fn () => function () {
        $token = issueTestMcpToken(User::factory()->create());
        PersonalAccessToken::query()->delete();

        return $token;
    },
    'expired' => fn () => fn () => issueTestMcpToken(User::factory()->create(), expiresAt: now()->subMinute()),
]);

it('refuses a token revoked or expired after initialize', function () {
    $user = User::factory()->create();
    $revoked = issueTestMcpToken($user);
    $expiring = issueTestMcpToken($user, expiresAt: now()->addMinutes(5));

    postMcp($revoked, initializeMcpPayload())->assertOk();
    postMcp($expiring, initializeMcpPayload())->assertOk();

    PersonalAccessToken::query()->whereKey(explode('|', $revoked)[0])->delete();
    $this->travel(6)->minutes();

    postMcp($revoked, ['jsonrpc' => '2.0', 'id' => 2, 'method' => 'tools/list'], ['Mcp-Session-Id' => 'kept-by-the-client'])
        ->assertUnauthorized()
        ->assertHeader('WWW-Authenticate', 'Bearer realm="skrum"');
    postMcp($expiring, ['jsonrpc' => '2.0', 'id' => 2, 'method' => 'tools/list'], ['Mcp-Session-Id' => 'kept-by-the-client'])
        ->assertUnauthorized();
});

it('refuses a token without the read scope', function () {
    $user = User::factory()->create();
    $plainText = $user->createToken('Legacy', ['mcp:write'])->plainTextToken;

    postMcp($plainText)->assertUnauthorized();
});

it('never authenticates with a session cookie', function () {
    $user = User::factory()->create();

    $this->actingAs($user);

    postMcp(null)->assertUnauthorized();
});

it('refuses users whose email is not verified', function () {
    $token = issueTestMcpToken(User::factory()->unverified()->create());

    postMcp($token)->assertUnauthorized();
});

it('answers 404 when mcp is disabled', function () {
    $token = issueTestMcpToken(User::factory()->create());
    config(['skrum.mcp.enabled' => false]);

    postMcp($token)->assertNotFound();
});

it('records when a token was last used', function () {
    $this->freezeTime();
    $token = issueTestMcpToken(User::factory()->create());

    postMcp($token)->assertOk();

    expect(PersonalAccessToken::query()->sole()->last_used_at?->toDateTimeString())->toBe(now()->toDateTimeString());
});

it('limits requests per token', function () {
    config(['skrum.mcp.rate_limit' => 2]);
    $user = User::factory()->create();
    $limited = issueTestMcpToken($user);
    $other = issueTestMcpToken($user);

    postMcp($limited)->assertOk();
    postMcp($limited)->assertOk();
    postMcp($limited)
        ->assertStatus(429)
        ->assertHeader('Retry-After');

    postMcp($other)->assertOk();
});

it('answers in the user locale', function () {
    $user = User::factory()->create(['locale' => 'fr']);
    $token = issueTestMcpToken($user);

    postMcp($token)->assertOk();

    expect(app()->getLocale())->toBe('fr');
});

it('never logs the plain token', function () {
    $messages = [];
    Event::listen(MessageLogged::class, function (MessageLogged $event) use (&$messages): void {
        $messages[] = $event->message.json_encode($event->context);
    });
    $token = issueTestMcpToken(User::factory()->create());

    postMcp($token)->assertOk();
    postMcp($token.'tampered')->assertUnauthorized();

    expect(implode("\n", $messages))->not->toContain(explode('|', $token)[1]);
});

it('keeps sanctum tokens away from every other route', function () {
    $token = issueTestMcpToken(User::factory()->create());

    $this->withHeader('Authorization', "Bearer {$token}")
        ->get(route('profile.edit'))
        ->assertRedirect(route('login'));
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Mcp/McpAuthenticationTest.php`
Expected: FAIL — 404 on `/mcp` (no route yet) for every test except "keeps sanctum tokens away from every other route".

- [ ] **Step 4: Grant value object and its request-scoped holder**

Create `app/Mcp/McpGrantContext.php`:

```php
<?php

namespace App\Mcp;

class McpGrantContext
{
    public ?McpGrant $grant = null;
}
```

Create `app/Mcp/McpGrant.php`:

```php
<?php

namespace App\Mcp;

use App\Enums\McpScope;
use App\Models\User;
use RuntimeException;

class McpGrant
{
    /**
     * @param  array<int, McpScope>  $scopes
     */
    public function __construct(
        public User $user,
        public string $tokenId,
        public array $scopes,
        public ?string $teamId,
    ) {}

    public function has(McpScope $scope): bool
    {
        return in_array($scope, $this->scopes, true);
    }

    public function bind(): void
    {
        app(McpGrantContext::class)->grant = $this;
    }

    public static function bound(): bool
    {
        return app(McpGrantContext::class)->grant !== null;
    }

    public static function current(): self
    {
        return app(McpGrantContext::class)->grant
            ?? throw new RuntimeException('No MCP grant is bound to this request.');
    }
}
```

- [ ] **Step 5: Middleware**

Create `app/Http/Middleware/AuthenticateMcpRequest.php`:

```php
<?php

namespace App\Http\Middleware;

use App\Enums\McpScope;
use App\Mcp\McpGrant;
use App\Models\PersonalAccessToken;
use App\Models\User;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

class AuthenticateMcpRequest
{
    public function handle(Request $request, Closure $next): Response
    {
        if ($request->bearerToken() === null) {
            return $this->unauthorized();
        }

        $user = Auth::guard('sanctum')->user();

        if (! $user instanceof User) {
            return $this->unauthorized();
        }

        $token = $user->currentAccessToken();

        if (! $token instanceof PersonalAccessToken) {
            return $this->unauthorized();
        }

        if ($token->isExpired(now())) {
            return $this->unauthorized();
        }

        if (! in_array(McpScope::Read, $token->scopes(), true)) {
            return $this->unauthorized();
        }

        if (! $user->hasVerifiedEmail()) {
            return $this->unauthorized();
        }

        Auth::shouldUse('sanctum');

        (new McpGrant($user, $token->id, $token->scopes(), $token->team_id))->bind();

        return $next($request);
    }

    private function unauthorized(): Response
    {
        return response()->json(
            ['error' => __('Unauthenticated.')],
            401,
            ['WWW-Authenticate' => 'Bearer realm="skrum"'],
        );
    }
}
```

Create `app/Http/Middleware/SetMcpLocale.php`:

```php
<?php

namespace App\Http\Middleware;

use App\Mcp\McpGrant;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class SetMcpLocale
{
    public function handle(Request $request, Closure $next): Response
    {
        /** @var array<int, string> $supportedLocales */
        $supportedLocales = config('skrum.locales');

        $locale = McpGrant::bound() ? McpGrant::current()->user->locale : null;

        app()->setLocale(in_array($locale, $supportedLocales, true) ? $locale : 'en');

        return $next($request);
    }
}
```

- [ ] **Step 6: Server and route**

In `config/skrum.php` add at the top of the array (after `'locales' => …`):

```php
    'version' => env('SKRUM_VERSION', '1.0.0'),
```

Create `app/Mcp/Servers/SkrumServer.php`:

```php
<?php

namespace App\Mcp\Servers;

use Laravel\Mcp\Server;
use Laravel\Mcp\Server\Attributes\Instructions;
use Laravel\Mcp\Server\Attributes\Name;

#[Name('skrum')]
#[Instructions(<<<'MARKDOWN'
    skrum is a self-hosted tool for agile team rituals.
    Teams belong to workspaces. Each team runs retrospective boards; a board holds messages (cards) in template columns,
    moves through phases (health check, icebreaker, writing, grouping, voting, discussing, completed) and ends with
    action items (agreements), a health check score and a ROTI rating. Teams also run planning poker games: a game holds
    tasks, and each task is estimated in rounds of hidden votes that the facilitator reveals.
    Content that the user cannot see on a board (hidden cards, anonymous authors, unrevealed votes) is never returned.
    MARKDOWN)]
class SkrumServer extends Server
{
    public int $defaultPaginationLength = 50;

    protected array $tools = [];

    protected array $resources = [];

    protected array $prompts = [];

    protected function boot(): void
    {
        $this->version = (string) config('skrum.version');
    }
}
```

Create `routes/ai.php` (loaded automatically by `laravel/mcp`'s service provider, outside the `web` group: no session, cookies or CSRF):

```php
<?php

use App\Http\Middleware\AuthenticateMcpRequest;
use App\Http\Middleware\EnsureMcpIsEnabled;
use App\Http\Middleware\SetMcpLocale;
use App\Mcp\Servers\SkrumServer;
use Laravel\Mcp\Facades\Mcp;
use Laravel\Mcp\Server\Middleware\AddWwwAuthenticateHeader;

if (config('skrum.mcp.enabled')) {
    Mcp::web('/mcp', SkrumServer::class)
        ->middleware([
            EnsureMcpIsEnabled::class,
            AuthenticateMcpRequest::class,
            SetMcpLocale::class,
            'throttle:mcp',
        ])
        ->withoutMiddleware(AddWwwAuthenticateHeader::class)
        ->name('mcp');
}
```

- [ ] **Step 7: Container bindings and rate limiter**

In `app/Providers/AppServiceProvider.php` import `App\Mcp\McpGrant`, `App\Mcp\McpGrantContext`, `Illuminate\Cache\RateLimiting\Limit`, `Illuminate\Http\Request` and `Illuminate\Support\Facades\RateLimiter`.

In `register()` add:

```php
        $this->app->scoped(McpGrantContext::class);
        $this->app->bind(McpGrant::class, fn (): McpGrant => McpGrant::current());
```

In `boot()` add (after the Sanctum line of Task 1):

```php
        RateLimiter::for('mcp', fn (Request $request): Limit => Limit::perMinute((int) config('skrum.mcp.rate_limit'))
            ->by('mcp-token:'.(McpGrant::bound() ? McpGrant::current()->tokenId : $request->ip())));
```

- [ ] **Step 8: Translations**

Append only if missing (`grep -c '"Unauthenticated.":' lang/en.json`):

`lang/en.json`: `"Unauthenticated.": "Unauthenticated."`
`lang/fr.json`: `"Unauthenticated.": "Non authentifié."`
`lang/es.json`: `"Unauthenticated.": "No autenticado."`
`lang/de.json`: `"Unauthenticated.": "Nicht authentifiziert."`

- [ ] **Step 9: Run the tests to verify they pass**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Mcp tests/Feature/TranslationKeysTest.php`
Expected: PASS. If "limits requests per token" shows the third call passing, check the route's middleware order with `vendor/bin/sail artisan route:list --path=mcp -v`: `throttle:mcp` must run after `AuthenticateMcpRequest` (the limiter keys on the bound grant).

- [ ] **Step 10: Static checks**

Run: `vendor/bin/sail bin pint --dirty --format agent` and `vendor/bin/sail bin phpstan analyse --no-progress`
Expected: clean, 0 errors.

- [ ] **Step 11: Commit**

```bash
git add routes/ai.php app/Mcp app/Http/Middleware/AuthenticateMcpRequest.php app/Http/Middleware/SetMcpLocale.php \
  app/Providers/AppServiceProvider.php config/skrum.php tests/Pest.php tests/Feature/Mcp/McpAuthenticationTest.php \
  lang/en.json lang/fr.json lang/es.json lang/de.json
git commit -m "feat: serve an authenticated mcp endpoint for api tokens

<Co-Authored-By trailer of the committing agent>
Claude-Session: https://claude.ai/code/session_01SosW8d2Uj7QxsF1tws5ssS"
```

#### Implementer notes

- The grant lives in a scoped `McpGrantContext` instead of a scoped `McpGrant` binding: a closure binding registered inside a request would survive in Octane workers and resolve the previous request's grant; the scoped holder is reset per request and `McpGrant::current()` throws when nothing was bound.
- `laravel/mcp`'s `AddWwwAuthenticateHeader` (route and global middleware) sets `Bearer realm="mcp", error="invalid_token"` on every 401; removing it from the route keeps spec §2.1's `Bearer realm="skrum"` (the global copy only acts on routes that carry it).
- The spec wants no route at all when MCP is off; `routes/ai.php` does that at boot, and `EnsureMcpIsEnabled` keeps the 404 correct when the switch changes without a route-cache rebuild (and in tests).
- There is no application version in the repo; `config('skrum.version')` (`SKRUM_VERSION`, default `1.0.0`) feeds the server's `#[Version]` equivalent.

### Task 5: Tool base, features, visibility and the first tool

**Files:**
- Create: `app/Mcp/Tools/SkrumTool.php`, `app/Mcp/McpFeature.php`, `app/Mcp/VisibleTeams.php`, `app/Mcp/McpContext.php`, `app/Mcp/Presenters/McpBoard.php`, `app/Mcp/Tools/Retro/ListTeams.php`
- Modify: `app/Mcp/Servers/SkrumServer.php` (register `ListTeams`), `app/Providers/AppServiceProvider.php` (scoped `VisibleTeams`), `tests/Pest.php` (helpers `bindMcpGrant`, `actingAsMcp`, `mcpStructured`, `mcpToolNames`), `lang/{en,fr,es,de}.json`
- Test: create `tests/Feature/Mcp/ToolBaseTest.php`, `tests/Feature/Mcp/ListTeamsTest.php`

**Interfaces:**
- Consumes: Task 4 (`McpGrant`, `McpGrantContext`, `SkrumServer`), Task 1 (`McpScope`, `PersonalAccessToken` factory), `App\Support\Llm\Llm::isConfigured()`, `TeamPolicy` semantics (members, and workspace Owners/Admins for every team of their workspaces), existing Pest helpers `teamMember(Team)`, `workspaceManager(Workspace, WorkspaceRole)`, `configureLlm()`.
- Produces:
  - `App\Mcp\McpFeature` (pure enum `Insights`, `Trackers`): `isAvailable(): bool` — `Insights` = `app(Llm::class)->isConfigured()`; `Trackers` = `false` until spec 6.
  - `abstract App\Mcp\Tools\SkrumTool extends Laravel\Mcp\Server\Tool`:
    - `abstract protected function requiredScope(): McpScope;`
    - `protected function requiredFeature(): ?McpFeature` (null by default);
    - `public function shouldRegister(): bool` — a grant is bound, it has the scope, the feature (if any) is available;
    - `final public function handle(Request $request): Response|ResponseFactory` — re-checks registration ("Not found."), applies the write limit to `Write`/`Delete` tools (key `mcp-write:{tokenId}`, `config('skrum.mcp.write_rate_limit')` per minute, "Too many changes, wait a moment."), runs `run()`, maps: `ModelNotFoundException` / 404 `HttpException` → "Not found."; `AuthorizationException` → its message; `ValidationException` → `Laravel\Mcp\Support\ValidationMessages::from($e)`; `HttpException` 423 → "The board is closed for editing."; other `HttpException` → its message (or "Something went wrong."); any other `Throwable` → logged as `Log::error('MCP tool failed.', ['tool', 'exception' => class, 'file', 'line'])` (never the message or arguments) and "Something went wrong.";
    - `abstract protected function run(Request $request): Response|ResponseFactory;`
    - `protected function context(): McpContext`;
    - `protected function pagination(array $validated, int $maxLimit = 50): array{0: int, 1: int}` → `[$page, $limit]` (defaults page 1, limit 20);
    - `protected function paginate(Builder $query, int $page, int $limit, callable $present): array{items: array<int, mixed>, page: int, hasMore: bool}` (fetches `limit + 1` rows);
    - `protected function paginationRules(int $maxLimit = 50): array` (`limit` nullable integer 1..max, `page` nullable integer ≥ 1).
    - Subclasses set `protected string $name` (the contract name) and `protected string $description`; they may take constructor dependencies (the server resolves tools through the container). Tests never use `TestListResponse`'s registration assertions (they build tools with `new`); they compare names with the Pest helper `mcpToolNames()`.
  - `App\Mcp\VisibleTeams` (scoped): `ids(McpGrant $grant): array<int, string>` — teams the user belongs to plus every team of workspaces where the user is Owner/Admin, intersected with `$grant->teamId`; memoized per token id.
  - `App\Mcp\McpContext` (`__construct(McpGrant $grant, VisibleTeams $visibleTeams)`): `grant(): McpGrant`, `user(): User`, `visibleTeamIds(): array<int, string>`, `team(string $id): Team`, `retro(string $id): Retro`, `pokerGame(string $id): PokerGame`, `actionItem(string $id): ActionItem` (each throws `ModelNotFoundException` for a malformed id, an unknown id, or a resource outside the visible teams — identical), `participant(Retro $retro): ?Participant` (never creates), `participantForWrite(Retro $retro): Participant` (`firstOrCreate` on `retro_id` + `user_id`), `pokerPlayer(PokerGame $game): ?PokerPlayer` (never creates), `pokerPlayerForWrite(PokerGame $game): PokerPlayer` (`firstOrCreate` as a non-spectator; an existing row keeps its role).
  - `App\Mcp\Presenters\McpBoard`: `static withCounts(Builder<Retro> $query): Builder<Retro>` (eager `team`, counts `participants`, `cards`, open `actionItems`), `handle(Retro $retro): array{id, title, teamId, teamName, phase, isFinished, isAnonymous, participantCount, messageCount, openActionItemCount, createdAt, completedAt, url}`.
  - Tool `retro.teams.list` (`App\Mcp\Tools\Retro\ListTeams`, read): arguments `workspace_id?` (UUID), `limit?` (1–50), `page?`; returns `{items: [{id, name, workspaceId, workspaceName, isMember, finishedBoards, unfinishedBoards}], page, hasMore}`, alphabetical by team name then workspace name.
  - Pest helpers: `bindMcpGrant(User $user, array $scopes = [McpScope::Read], ?Team $team = null): McpGrant` (forgets scoped instances, creates a token row, binds the grant), `actingAsMcp(User $user, array $scopes = [McpScope::Read], ?Team $team = null): PendingTestResponse` (binds and returns `SkrumServer::actingAs($user, 'sanctum')`), `mcpStructured(McpTestResponse $response): array` (the tool result's structured content, `[]` when none), `mcpToolNames(PendingTestResponse $pending): array<int, string>` (sorted tool names from `tools/list`; used instead of `TestListResponse`'s registration assertions, which build tools with `new` and fail on constructor dependencies).

- [ ] **Step 1: Test helpers**

In `tests/Pest.php` add `use App\Mcp\McpGrant;`, `use App\Mcp\Servers\SkrumServer;`, `use Laravel\Mcp\Server\Testing\PendingTestResponse;` and `use Laravel\Mcp\Server\Testing\TestResponse as McpTestResponse;`, then append:

```php
/**
 * @param  array<int, McpScope>  $scopes
 */
function bindMcpGrant(User $user, array $scopes = [McpScope::Read], ?Team $team = null): McpGrant
{
    app()->forgetScopedInstances();

    $token = PersonalAccessToken::factory()
        ->forUser($user)
        ->withScopes(...$scopes)
        ->create(['team_id' => $team?->id]);

    $grant = new McpGrant($user, $token->id, $token->scopes(), $team?->id);
    $grant->bind();

    return $grant;
}

/**
 * @param  array<int, McpScope>  $scopes
 */
function actingAsMcp(User $user, array $scopes = [McpScope::Read], ?Team $team = null): PendingTestResponse
{
    bindMcpGrant($user, $scopes, $team);

    return SkrumServer::actingAs($user, 'sanctum');
}

/**
 * @return array<string, mixed>
 */
function mcpStructured(McpTestResponse $response): array
{
    return (fn (): ?array => $this->structuredContent())->call($response) ?? [];
}

/**
 * Tool names from tools/list. TestListResponse's registration assertions build each
 * class with `new`, which fails for tools with constructor dependencies, so
 * tests compare names instead.
 *
 * @return array<int, string>
 */
function mcpToolNames(PendingTestResponse $pending): array
{
    $items = (fn (): array => $this->items)->call($pending->tools());

    return collect($items)->pluck('name')->sort()->values()->all();
}
```

- [ ] **Step 2: Write the failing tests**

Create `tests/Feature/Mcp/ToolBaseTest.php`:

```php
<?php

use App\Enums\McpScope;
use App\Enums\RetroPhase;
use App\Enums\WorkspaceRole;
use App\Mcp\McpContext;
use App\Mcp\McpFeature;
use App\Mcp\Presenters\McpBoard;
use App\Mcp\Servers\SkrumServer;
use App\Mcp\Tools\SkrumTool;
use App\Models\ActionItem;
use App\Models\Card;
use App\Models\Participant;
use App\Models\PokerGame;
use App\Models\PokerPlayer;
use App\Models\Retro;
use App\Models\Team;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Log\Events\MessageLogged;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Str;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\ResponseFactory;
use Symfony\Component\HttpKernel\Exception\HttpException;

class ToolBaseReadTool extends SkrumTool
{
    protected string $name = 'test.read';

    protected function requiredScope(): McpScope
    {
        return McpScope::Read;
    }

    protected function run(Request $request): Response|ResponseFactory
    {
        return Response::structured(['ok' => true]);
    }
}

class ToolBaseWriteTool extends ToolBaseReadTool
{
    protected string $name = 'test.write';

    protected function requiredScope(): McpScope
    {
        return McpScope::Write;
    }
}

class ToolBaseDeleteTool extends ToolBaseReadTool
{
    protected string $name = 'test.delete';

    protected function requiredScope(): McpScope
    {
        return McpScope::Delete;
    }
}

class ToolBaseInsightsTool extends ToolBaseReadTool
{
    protected string $name = 'test.insights';

    protected function requiredFeature(): ?McpFeature
    {
        return McpFeature::Insights;
    }
}

class ToolBaseTrackersTool extends ToolBaseReadTool
{
    protected string $name = 'test.trackers';

    protected function requiredFeature(): ?McpFeature
    {
        return McpFeature::Trackers;
    }
}

class ToolBaseFailingTool extends ToolBaseReadTool
{
    protected string $name = 'test.fail';

    protected function run(Request $request): Response|ResponseFactory
    {
        return match ($request->get('kind')) {
            'missing' => throw new ModelNotFoundException,
            'not-found-http' => abort(404),
            'forbidden' => throw new AuthorizationException('Only the facilitator can do this.'),
            'locked' => throw new HttpException(423),
            'invalid' => $request->validate(['title' => ['required', 'string']]),
            default => throw new RuntimeException('secret-argument-value'),
        };
    }
}

class ToolBaseTestServer extends SkrumServer
{
    protected array $tools = [
        ToolBaseReadTool::class,
        ToolBaseWriteTool::class,
        ToolBaseDeleteTool::class,
        ToolBaseInsightsTool::class,
        ToolBaseTrackersTool::class,
        ToolBaseFailingTool::class,
    ];
}

it('offers only the tools of the granted scopes', function (array $scopes, array $registered, array $hidden) {
    $user = User::factory()->create();
    bindMcpGrant($user, $scopes);

    $names = mcpToolNames(ToolBaseTestServer::actingAs($user));

    expect($names)->toContain(...$registered);

    foreach ($hidden as $name) {
        expect($names)->not->toContain($name);
    }
})->with([
    'read' => [[], ['test.read'], ['test.write', 'test.delete']],
    'read and write' => [[McpScope::Write], ['test.read', 'test.write'], ['test.delete']],
    'read and delete' => [[McpScope::Delete], ['test.read', 'test.delete'], ['test.write']],
    'everything' => [[McpScope::Write, McpScope::Delete], ['test.read', 'test.write', 'test.delete'], []],
]);

it('refuses calls to tools outside the scopes', function () {
    $user = User::factory()->create();
    bindMcpGrant($user);

    ToolBaseTestServer::actingAs($user)->tool(ToolBaseWriteTool::class)->assertHasErrors(['Tool [test.write] not found.']);
    ToolBaseTestServer::actingAs($user)->tool(ToolBaseDeleteTool::class)->assertHasErrors(['Tool [test.delete] not found.']);
});

it('offers insight tools only with an llm provider and tracker tools never', function () {
    $user = User::factory()->create();
    bindMcpGrant($user);

    expect(mcpToolNames(ToolBaseTestServer::actingAs($user)))
        ->not->toContain('test.insights')
        ->not->toContain('test.trackers');

    configureLlm();

    expect(mcpToolNames(ToolBaseTestServer::actingAs($user)))
        ->toContain('test.insights')
        ->not->toContain('test.trackers');

    expect(McpFeature::Trackers->isAvailable())->toBeFalse();
});

it('turns domain exceptions into translated tool errors', function (string $kind, string $message) {
    $user = User::factory()->create();
    bindMcpGrant($user);

    ToolBaseTestServer::actingAs($user)
        ->tool(ToolBaseFailingTool::class, ['kind' => $kind])
        ->assertHasErrors([$message]);
})->with([
    'missing model' => ['missing', 'Not found.'],
    'http 404' => ['not-found-http', 'Not found.'],
    'forbidden' => ['forbidden', 'Only the facilitator can do this.'],
    'locked' => ['locked', 'The board is closed for editing.'],
    'invalid' => ['invalid', 'The title field is required.'],
    'crash' => ['crash', 'Something went wrong.'],
]);

it('translates tool errors into the user locale', function () {
    $user = User::factory()->create(['locale' => 'fr']);
    bindMcpGrant($user);
    app()->setLocale('fr');

    ToolBaseTestServer::actingAs($user)
        ->tool(ToolBaseFailingTool::class, ['kind' => 'missing'])
        ->assertHasErrors(['Introuvable.']);
});

it('logs unexpected failures without their content', function () {
    $messages = [];
    Event::listen(MessageLogged::class, function (MessageLogged $event) use (&$messages): void {
        $messages[] = $event->message.json_encode($event->context);
    });
    $user = User::factory()->create();
    bindMcpGrant($user);

    ToolBaseTestServer::actingAs($user)
        ->tool(ToolBaseFailingTool::class, ['kind' => 'crash'])
        ->assertHasErrors(['Something went wrong.'])
        ->assertDontSee('secret-argument-value');

    expect(implode("\n", $messages))->toContain('MCP tool failed.')
        ->not->toContain('secret-argument-value');
});

it('limits write and delete calls per token while reads keep working', function () {
    config(['skrum.mcp.write_rate_limit' => 2]);
    $user = User::factory()->create();
    bindMcpGrant($user, [McpScope::Write, McpScope::Delete]);

    ToolBaseTestServer::actingAs($user)->tool(ToolBaseWriteTool::class)->assertOk();
    ToolBaseTestServer::actingAs($user)->tool(ToolBaseDeleteTool::class)->assertOk();
    ToolBaseTestServer::actingAs($user)->tool(ToolBaseWriteTool::class)
        ->assertHasErrors(['Too many changes, wait a moment.']);
    ToolBaseTestServer::actingAs($user)->tool(ToolBaseReadTool::class)->assertOk();
});

it('reports invisible resources exactly like missing ones', function (string $resolver, Closure $foreign) {
    $user = User::factory()->create();
    bindMcpGrant($user);
    $context = app(McpContext::class);

    foreach ([$foreign()->id, (string) Str::uuid(), 'not-a-uuid'] as $id) {
        expect(fn () => $context->{$resolver}($id))->toThrow(ModelNotFoundException::class);
    }
})->with([
    'team' => ['team', fn () => fn () => Team::factory()->create()],
    'board' => ['retro', fn () => fn () => Retro::factory()->create()],
    'poker game' => ['pokerGame', fn () => fn () => PokerGame::factory()->create()],
    'action item' => ['actionItem', fn () => fn () => ActionItem::factory()->create()],
]);

it('resolves resources of teams the user can see', function () {
    $team = Team::factory()->create();
    $member = teamMember($team);
    $admin = workspaceManager($team->workspace);
    $retro = Retro::factory()->create(['team_id' => $team->id]);
    $game = PokerGame::factory()->create(['team_id' => $team->id]);
    $item = ActionItem::factory()->create(['retro_id' => $retro->id]);

    foreach ([$member, $admin] as $user) {
        bindMcpGrant($user);
        $context = app(McpContext::class);

        expect($context->team($team->id)->id)->toBe($team->id)
            ->and($context->retro($retro->id)->id)->toBe($retro->id)
            ->and($context->pokerGame($game->id)->id)->toBe($game->id)
            ->and($context->actionItem($item->id)->id)->toBe($item->id);
    }
});

it('limits a bound token to its team', function () {
    $user = User::factory()->create();
    $bound = Team::factory()->withMember($user)->create();
    $other = Team::factory()->withMember($user)->create();
    bindMcpGrant($user, team: $bound);
    $context = app(McpContext::class);

    expect($context->visibleTeamIds())->toBe([$bound->id])
        ->and(fn () => $context->team($other->id))->toThrow(ModelNotFoundException::class);
});

it('returns nothing for a bound team the user no longer sees', function () {
    $team = Team::factory()->create();
    $user = teamMember($team);
    $grant = bindMcpGrant($user, team: $team);

    SkrumServer::actingAs($user, 'sanctum')
        ->tool(App\Mcp\Tools\Retro\ListTeams::class)
        ->assertStructuredContent(fn ($json) => $json->has('items', 1)->etc());

    $team->members()->detach($user);
    app()->forgetScopedInstances();
    $grant->bind();

    SkrumServer::actingAs($user, 'sanctum')
        ->tool(App\Mcp\Tools\Retro\ListTeams::class)
        ->assertStructuredContent(['items' => [], 'page' => 1, 'hasMore' => false]);

    expect(fn () => app(McpContext::class)->team($team->id))->toThrow(ModelNotFoundException::class);
});

it('reads existing participants and players without creating any', function () {
    $team = Team::factory()->create();
    $user = teamMember($team);
    $retro = Retro::factory()->create(['team_id' => $team->id]);
    $game = PokerGame::factory()->create(['team_id' => $team->id]);
    bindMcpGrant($user);
    $context = app(McpContext::class);

    expect($context->participant($retro))->toBeNull()
        ->and($context->pokerPlayer($game))->toBeNull()
        ->and(Participant::query()->count())->toBe(0)
        ->and(PokerPlayer::query()->count())->toBe(0);
});

it('creates participants and players once for writes and keeps spectators', function () {
    $team = Team::factory()->create();
    $user = teamMember($team);
    $retro = Retro::factory()->create(['team_id' => $team->id]);
    $game = PokerGame::factory()->create(['team_id' => $team->id]);
    $watchedGame = PokerGame::factory()->create(['team_id' => $team->id]);
    $spectator = PokerPlayer::factory()->spectator()->create(['poker_game_id' => $watchedGame->id, 'user_id' => $user->id]);
    bindMcpGrant($user);
    $context = app(McpContext::class);

    $participant = $context->participantForWrite($retro);
    $player = $context->pokerPlayerForWrite($game);

    expect($context->participantForWrite($retro)->id)->toBe($participant->id)
        ->and($participant->user_id)->toBe($user->id)
        ->and($player->is_spectator)->toBeFalse()
        ->and($context->pokerPlayerForWrite($game)->id)->toBe($player->id)
        ->and($context->pokerPlayerForWrite($watchedGame)->id)->toBe($spectator->id)
        ->and($spectator->fresh()->is_spectator)->toBeTrue()
        ->and(Participant::query()->count())->toBe(1);
});

it('presents boards with their counts and link', function () {
    $team = Team::factory()->create(['name' => 'Platform']);
    $retro = Retro::factory()->inPhase(RetroPhase::Completed)->anonymous()->create([
        'team_id' => $team->id,
        'title' => 'Sprint 12',
        'completed_at' => now(),
    ]);
    Participant::factory()->count(2)->create(['retro_id' => $retro->id]);
    Card::factory()->count(3)->create(['retro_id' => $retro->id]);
    ActionItem::factory()->create(['retro_id' => $retro->id]);
    ActionItem::factory()->completed()->create(['retro_id' => $retro->id]);

    $board = app(McpBoard::class)->handle(McpBoard::withCounts(Retro::query())->findOrFail($retro->id));

    expect($board)->toMatchArray([
        'id' => $retro->id,
        'title' => 'Sprint 12',
        'teamId' => $team->id,
        'teamName' => 'Platform',
        'phase' => 'completed',
        'isFinished' => true,
        'isAnonymous' => true,
        'openActionItemCount' => 1,
        'url' => route('retros.show', $retro),
    ])
        ->and($board['participantCount'])->toBeGreaterThanOrEqual(2)
        ->and($board['messageCount'])->toBe(3)
        ->and($board['completedAt'])->not->toBeNull();
});
```

Create `tests/Feature/Mcp/ListTeamsTest.php`:

```php
<?php

use App\Enums\McpScope;
use App\Enums\RetroPhase;
use App\Enums\WorkspaceRole;
use App\Mcp\Tools\Retro\ListTeams;
use App\Models\Retro;
use App\Models\Team;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Testing\Fluent\AssertableJson;

it('lists the teams the user can see alphabetically with board counts', function () {
    $user = User::factory()->create();
    $workspace = Workspace::factory()->withMember($user)->create(['name' => 'Acme']);
    $beta = Team::factory()->withMember($user)->create(['workspace_id' => $workspace->id, 'name' => 'Beta']);
    $alpha = Team::factory()->withMember($user)->create(['workspace_id' => $workspace->id, 'name' => 'Alpha']);
    Team::factory()->create(['workspace_id' => $workspace->id, 'name' => 'Not mine']);
    Team::factory()->create(['name' => 'Elsewhere']);
    Retro::factory()->inPhase(RetroPhase::Completed)->count(2)->create(['team_id' => $alpha->id]);
    Retro::factory()->inPhase(RetroPhase::Writing)->create(['team_id' => $alpha->id]);

    actingAsMcp($user)
        ->tool(ListTeams::class)
        ->assertOk()
        ->assertStructuredContent([
            'items' => [
                [
                    'id' => $alpha->id,
                    'name' => 'Alpha',
                    'workspaceId' => $workspace->id,
                    'workspaceName' => 'Acme',
                    'isMember' => true,
                    'finishedBoards' => 2,
                    'unfinishedBoards' => 1,
                ],
                [
                    'id' => $beta->id,
                    'name' => 'Beta',
                    'workspaceId' => $workspace->id,
                    'workspaceName' => 'Acme',
                    'isMember' => true,
                    'finishedBoards' => 0,
                    'unfinishedBoards' => 0,
                ],
            ],
            'page' => 1,
            'hasMore' => false,
        ]);
});

it('lets workspace admins see every team of their workspaces', function () {
    $workspace = Workspace::factory()->create();
    $team = Team::factory()->create(['workspace_id' => $workspace->id]);
    $admin = workspaceManager($workspace, WorkspaceRole::Admin);

    actingAsMcp($admin)
        ->tool(ListTeams::class)
        ->assertStructuredContent(fn (AssertableJson $json) => $json
            ->has('items', 1)
            ->where('items.0.id', $team->id)
            ->where('items.0.isMember', false)
            ->etc());
});

it('lists teams of every workspace', function () {
    $user = User::factory()->create();
    $first = Workspace::factory()->withMember($user)->create(['name' => 'First']);
    $second = Workspace::factory()->withMember($user)->create(['name' => 'Second']);
    $a = Team::factory()->withMember($user)->create(['workspace_id' => $first->id, 'name' => 'Platform']);
    $b = Team::factory()->withMember($user)->create(['workspace_id' => $second->id, 'name' => 'Platform']);

    $items = mcpStructured(actingAsMcp($user)->tool(ListTeams::class))['items'];

    expect(collect($items)->map(fn (array $item): array => [$item['id'], $item['workspaceName']])->all())
        ->toBe([[$a->id, 'First'], [$b->id, 'Second']]);
});

it('filters by workspace', function () {
    $user = User::factory()->create();
    $first = Workspace::factory()->withMember($user)->create();
    $second = Workspace::factory()->withMember($user)->create();
    $kept = Team::factory()->withMember($user)->create(['workspace_id' => $first->id]);
    Team::factory()->withMember($user)->create(['workspace_id' => $second->id]);

    actingAsMcp($user)
        ->tool(ListTeams::class, ['workspace_id' => $first->id])
        ->assertStructuredContent(fn (AssertableJson $json) => $json
            ->has('items', 1)
            ->where('items.0.id', $kept->id)
            ->etc());
});

it('paginates', function () {
    $user = User::factory()->create();
    $workspace = Workspace::factory()->withMember($user)->create();
    foreach (['A', 'B', 'C'] as $name) {
        Team::factory()->withMember($user)->create(['workspace_id' => $workspace->id, 'name' => $name]);
    }

    actingAsMcp($user)
        ->tool(ListTeams::class, ['limit' => 2, 'page' => 1])
        ->assertStructuredContent(fn (AssertableJson $json) => $json
            ->has('items', 2)->where('page', 1)->where('hasMore', true)->etc());

    actingAsMcp($user)
        ->tool(ListTeams::class, ['limit' => 2, 'page' => 2])
        ->assertStructuredContent(fn (AssertableJson $json) => $json
            ->has('items', 1)->where('items.0.name', 'C')->where('hasMore', false)->etc());
});

it('limits a bound token to its team', function () {
    $user = User::factory()->create();
    $workspace = Workspace::factory()->withMember($user)->create();
    $bound = Team::factory()->withMember($user)->create(['workspace_id' => $workspace->id]);
    Team::factory()->withMember($user)->create(['workspace_id' => $workspace->id]);

    actingAsMcp($user, [McpScope::Read], $bound)
        ->tool(ListTeams::class)
        ->assertStructuredContent(fn (AssertableJson $json) => $json
            ->has('items', 1)->where('items.0.id', $bound->id)->etc());
});

it('validates its arguments', function (array $arguments) {
    actingAsMcp(User::factory()->create())
        ->tool(ListTeams::class, $arguments)
        ->assertHasErrors();
})->with([
    'malformed workspace' => [['workspace_id' => 'not-a-uuid']],
    'limit too high' => [['limit' => 51]],
    'page zero' => [['page' => 0]],
]);
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Mcp/ToolBaseTest.php tests/Feature/Mcp/ListTeamsTest.php`
Expected: FAIL — `Class "App\Mcp\Tools\SkrumTool" not found`.

- [ ] **Step 4: Feature switch and visibility**

Create `app/Mcp/McpFeature.php`:

```php
<?php

namespace App\Mcp;

use App\Support\Llm\Llm;

enum McpFeature
{
    case Insights;
    case Trackers;

    /**
     * Trackers stays unavailable until spec 6 (integrations) ships the
     * tracker connections the four tracker tools read.
     */
    public function isAvailable(): bool
    {
        return match ($this) {
            self::Insights => app(Llm::class)->isConfigured(),
            self::Trackers => false,
        };
    }
}
```

Create `app/Mcp/VisibleTeams.php`:

```php
<?php

namespace App\Mcp;

use App\Enums\WorkspaceRole;
use App\Models\Team;

class VisibleTeams
{
    /**
     * @var array<string, array<int, string>>
     */
    private array $idsByToken = [];

    /**
     * @return array<int, string>
     */
    public function ids(McpGrant $grant): array
    {
        return $this->idsByToken[$grant->tokenId] ??= $this->resolve($grant);
    }

    /**
     * @return array<int, string>
     */
    private function resolve(McpGrant $grant): array
    {
        $user = $grant->user;

        $managedWorkspaceIds = $user->workspaces()
            ->wherePivotIn('role', [WorkspaceRole::Owner->value, WorkspaceRole::Admin->value])
            ->pluck('workspaces.id');

        return Team::query()
            ->where(fn ($query) => $query
                ->whereIn('workspace_id', $managedWorkspaceIds)
                ->orWhereHas('members', fn ($members) => $members->whereKey($user->id)))
            ->when($grant->teamId !== null, fn ($query) => $query->whereKey($grant->teamId))
            ->pluck('id')
            ->all();
    }
}
```

- [ ] **Step 5: Context resolvers**

Create `app/Mcp/McpContext.php`:

```php
<?php

namespace App\Mcp;

use App\Models\ActionItem;
use App\Models\Participant;
use App\Models\PokerGame;
use App\Models\PokerPlayer;
use App\Models\Retro;
use App\Models\Team;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Support\Str;

class McpContext
{
    public function __construct(
        private McpGrant $grant,
        private VisibleTeams $visibleTeams,
    ) {}

    public function grant(): McpGrant
    {
        return $this->grant;
    }

    public function user(): User
    {
        return $this->grant->user;
    }

    /**
     * @return array<int, string>
     */
    public function visibleTeamIds(): array
    {
        return $this->visibleTeams->ids($this->grant);
    }

    public function team(string $id): Team
    {
        return $this->find(Team::query()->whereIn('id', $this->visibleTeamIds()), $id);
    }

    public function retro(string $id): Retro
    {
        return $this->find(Retro::query()->whereIn('team_id', $this->visibleTeamIds()), $id);
    }

    public function pokerGame(string $id): PokerGame
    {
        return $this->find(PokerGame::query()->whereIn('team_id', $this->visibleTeamIds()), $id);
    }

    public function actionItem(string $id): ActionItem
    {
        return $this->find(ActionItem::query()->whereIn('team_id', $this->visibleTeamIds()), $id);
    }

    public function participant(Retro $retro): ?Participant
    {
        return Participant::query()
            ->where('retro_id', $retro->id)
            ->where('user_id', $this->user()->id)
            ->first();
    }

    public function participantForWrite(Retro $retro): Participant
    {
        return Participant::query()->firstOrCreate([
            'retro_id' => $retro->id,
            'user_id' => $this->user()->id,
        ]);
    }

    public function pokerPlayer(PokerGame $game): ?PokerPlayer
    {
        return PokerPlayer::query()
            ->where('poker_game_id', $game->id)
            ->where('user_id', $this->user()->id)
            ->first();
    }

    public function pokerPlayerForWrite(PokerGame $game): PokerPlayer
    {
        return PokerPlayer::query()->firstOrCreate(
            ['poker_game_id' => $game->id, 'user_id' => $this->user()->id],
            ['is_spectator' => false],
        );
    }

    /**
     * @template TModel of Model
     *
     * @param  Builder<TModel>  $query
     * @return TModel
     */
    private function find(Builder $query, string $id): Model
    {
        if (! Str::isUuid($id)) {
            throw (new ModelNotFoundException)->setModel($query->getModel()::class);
        }

        return $query->whereKey($id)->firstOrFail();
    }
}
```

In `app/Providers/AppServiceProvider.php` `register()` add (import `App\Mcp\VisibleTeams`):

```php
        $this->app->scoped(VisibleTeams::class);
```

- [ ] **Step 6: Tool base class**

Create `app/Mcp/Tools/SkrumTool.php`:

```php
<?php

namespace App\Mcp\Tools;

use App\Enums\McpScope;
use App\Mcp\McpContext;
use App\Mcp\McpFeature;
use App\Mcp\McpGrant;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Validation\ValidationException;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\ResponseFactory;
use Laravel\Mcp\Server\Tool;
use Laravel\Mcp\Support\ValidationMessages;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;
use Throwable;

abstract class SkrumTool extends Tool
{
    protected const DefaultLimit = 20;

    abstract protected function requiredScope(): McpScope;

    abstract protected function run(Request $request): Response|ResponseFactory;

    protected function requiredFeature(): ?McpFeature
    {
        return null;
    }

    public function shouldRegister(): bool
    {
        if (! McpGrant::bound()) {
            return false;
        }

        if (! McpGrant::current()->has($this->requiredScope())) {
            return false;
        }

        return $this->requiredFeature()?->isAvailable() ?? true;
    }

    final public function handle(Request $request): Response|ResponseFactory
    {
        if (! $this->shouldRegister()) {
            return Response::error(__('Not found.'));
        }

        if ($this->requiredScope() !== McpScope::Read && ! $this->withinWriteLimit()) {
            return Response::error(__('Too many changes, wait a moment.'));
        }

        try {
            return $this->run($request);
        } catch (ModelNotFoundException) {
            return Response::error(__('Not found.'));
        } catch (AuthorizationException $exception) {
            return Response::error($exception->getMessage() !== '' ? $exception->getMessage() : __('This action is unauthorized.'));
        } catch (ValidationException $exception) {
            return Response::error(ValidationMessages::from($exception));
        } catch (HttpExceptionInterface $exception) {
            return Response::error($this->httpMessage($exception));
        } catch (Throwable $exception) {
            Log::error('MCP tool failed.', [
                'tool' => $this->name(),
                'exception' => $exception::class,
                'file' => $exception->getFile(),
                'line' => $exception->getLine(),
            ]);

            return Response::error(__('Something went wrong.'));
        }
    }

    protected function context(): McpContext
    {
        return app(McpContext::class);
    }

    /**
     * @return array<string, array<int, string>>
     */
    protected function paginationRules(int $maxLimit = 50): array
    {
        return [
            'limit' => ['nullable', 'integer', 'min:1', "max:{$maxLimit}"],
            'page' => ['nullable', 'integer', 'min:1'],
        ];
    }

    /**
     * @param  array<string, mixed>  $validated
     * @return array{0: int, 1: int}
     */
    protected function pagination(array $validated, int $maxLimit = 50): array
    {
        return [
            (int) ($validated['page'] ?? 1),
            min((int) ($validated['limit'] ?? self::DefaultLimit), $maxLimit),
        ];
    }

    /**
     * @template TModel of \Illuminate\Database\Eloquent\Model
     *
     * @param  Builder<TModel>  $query
     * @param  callable(TModel): mixed  $present
     * @return array{items: array<int, mixed>, page: int, hasMore: bool}
     */
    protected function paginate(Builder $query, int $page, int $limit, callable $present): array
    {
        $rows = $query->skip(($page - 1) * $limit)->take($limit + 1)->get();

        return [
            'items' => $rows->take($limit)->map($present)->values()->all(),
            'page' => $page,
            'hasMore' => $rows->count() > $limit,
        ];
    }

    private function withinWriteLimit(): bool
    {
        $key = 'mcp-write:'.McpGrant::current()->tokenId;
        $maxAttempts = (int) config('skrum.mcp.write_rate_limit');

        if (RateLimiter::tooManyAttempts($key, $maxAttempts)) {
            return false;
        }

        RateLimiter::hit($key, 60);

        return true;
    }

    private function httpMessage(HttpExceptionInterface $exception): string
    {
        return match (true) {
            $exception->getStatusCode() === 404 => __('Not found.'),
            $exception->getStatusCode() === 423 => __('The board is closed for editing.'),
            $exception instanceof Throwable && $exception->getMessage() !== '' => $exception->getMessage(),
            default => __('Something went wrong.'),
        };
    }
}
```

(`forPage()` + `limit + 1` keeps queries constant; a `Builder` passed in must already carry its `orderBy`.)

- [ ] **Step 7: Board presenter**

Create `app/Mcp/Presenters/McpBoard.php`:

```php
<?php

namespace App\Mcp\Presenters;

use App\Enums\RetroPhase;
use App\Models\Retro;
use Illuminate\Database\Eloquent\Builder;

class McpBoard
{
    /**
     * @param  Builder<Retro>  $query
     * @return Builder<Retro>
     */
    public static function withCounts(Builder $query): Builder
    {
        return $query
            ->with('team')
            ->withCount([
                'participants',
                'cards',
                'actionItems as open_action_items_count' => fn ($items) => $items->whereNull('completed_at'),
            ]);
    }

    /**
     * @return array{
     *     id: string,
     *     title: string,
     *     teamId: string,
     *     teamName: string,
     *     phase: string,
     *     isFinished: bool,
     *     isAnonymous: bool,
     *     participantCount: int,
     *     messageCount: int,
     *     openActionItemCount: int,
     *     createdAt: ?string,
     *     completedAt: ?string,
     *     url: string
     * }
     */
    public function handle(Retro $retro): array
    {
        return [
            'id' => $retro->id,
            'title' => $retro->title,
            'teamId' => $retro->team_id,
            'teamName' => $retro->team->name,
            'phase' => $retro->phase->value,
            'isFinished' => $retro->phase === RetroPhase::Completed,
            'isAnonymous' => $retro->is_anonymous,
            'participantCount' => (int) ($retro->participants_count ?? $retro->participants()->count()),
            'messageCount' => (int) ($retro->cards_count ?? $retro->cards()->count()),
            'openActionItemCount' => (int) ($retro->open_action_items_count ?? $retro->actionItems()->whereNull('completed_at')->count()),
            'createdAt' => $retro->created_at?->toIso8601String(),
            'completedAt' => $retro->completed_at?->toIso8601String(),
            'url' => route('retros.show', $retro),
        ];
    }
}
```

If phpstan flags the undeclared `*_count` attributes, add `@property-read int|null $participants_count`, `$cards_count` and `$open_action_items_count` to the `Retro` model docblock.

- [ ] **Step 8: The first tool**

Create `app/Mcp/Tools/Retro/ListTeams.php`:

```php
<?php

namespace App\Mcp\Tools\Retro;

use App\Enums\McpScope;
use App\Enums\RetroPhase;
use App\Mcp\Tools\SkrumTool;
use App\Models\Team;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\ResponseFactory;
use Laravel\Mcp\Server\Tools\Annotations\IsOpenWorld;
use Laravel\Mcp\Server\Tools\Annotations\IsReadOnly;

#[IsReadOnly]
#[IsOpenWorld(false)]
class ListTeams extends SkrumTool
{
    protected string $name = 'retro.teams.list';

    protected string $description = 'List the teams you can see, alphabetically, with their workspace, whether you are a member, and how many of their retrospective boards are finished or unfinished. Optionally filter by workspace_id. Paginated with limit and page.';

    protected function requiredScope(): McpScope
    {
        return McpScope::Read;
    }

    public function schema(JsonSchema $schema): array
    {
        return [
            'workspace_id' => $schema->string()->format('uuid')->description('Only teams of this workspace.'),
            'limit' => $schema->integer()->description('Items per page, 1 to 50 (default 20).'),
            'page' => $schema->integer()->description('Page number, starting at 1.'),
        ];
    }

    protected function run(Request $request): Response|ResponseFactory
    {
        $validated = $request->validate([
            'workspace_id' => ['nullable', 'uuid'],
            ...$this->paginationRules(),
        ]);

        [$page, $limit] = $this->pagination($validated);
        $user = $this->context()->user();

        $query = Team::query()
            ->select('teams.*')
            ->join('workspaces', 'workspaces.id', '=', 'teams.workspace_id')
            ->whereIn('teams.id', $this->context()->visibleTeamIds())
            ->when(isset($validated['workspace_id']), fn ($query) => $query->where('teams.workspace_id', $validated['workspace_id']))
            ->with('workspace')
            ->withExists(['members as is_member' => fn ($members) => $members->whereKey($user->id)])
            ->withCount([
                'retros as finished_boards_count' => fn ($retros) => $retros->where('phase', RetroPhase::Completed),
                'retros as unfinished_boards_count' => fn ($retros) => $retros->where('phase', '!=', RetroPhase::Completed),
            ])
            ->orderBy('teams.name')
            ->orderBy('workspaces.name')
            ->orderBy('teams.id');

        return Response::structured($this->paginate($query, $page, $limit, fn (Team $team): array => [
            'id' => $team->id,
            'name' => $team->name,
            'workspaceId' => $team->workspace_id,
            'workspaceName' => $team->workspace->name,
            'isMember' => (bool) $team->is_member,
            'finishedBoards' => (int) $team->finished_boards_count,
            'unfinishedBoards' => (int) $team->unfinished_boards_count,
        ]));
    }
}
```

Register it in `app/Mcp/Servers/SkrumServer.php` (import `App\Mcp\Tools\Retro\ListTeams`):

```php
    protected array $tools = [
        ListTeams::class,
    ];
```

(If phpstan reports the dynamic `is_member` / `*_boards_count` attributes, read them with `$team->getAttribute('is_member')` etc.)

- [ ] **Step 9: Translations**

Append only missing keys ("Something went wrong." exists; check "Not found.", "This action is unauthorized." and "The board is closed for editing." with `grep -c`):

`lang/en.json`:
```json
    "Not found.": "Not found.",
    "Too many changes, wait a moment.": "Too many changes, wait a moment."
```

`lang/fr.json`:
```json
    "Not found.": "Introuvable.",
    "Too many changes, wait a moment.": "Trop de modifications, patientez un instant."
```

`lang/es.json`:
```json
    "Not found.": "No encontrado.",
    "Too many changes, wait a moment.": "Demasiados cambios, espera un momento."
```

`lang/de.json`:
```json
    "Not found.": "Nicht gefunden.",
    "Too many changes, wait a moment.": "Zu viele Änderungen, warte einen Moment."
```

If "This action is unauthorized." is missing, add it with fr "Cette action n'est pas autorisée.", es "Esta acción no está autorizada.", de "Diese Aktion ist nicht erlaubt.".

- [ ] **Step 10: Run the tests to verify they pass**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Mcp tests/Feature/TranslationKeysTest.php`
Expected: PASS.

- [ ] **Step 11: Static checks**

Run: `vendor/bin/sail bin pint --dirty --format agent` and `vendor/bin/sail bin phpstan analyse --no-progress`
Expected: clean, 0 errors.

- [ ] **Step 12: Commit**

```bash
git add app/Mcp app/Providers/AppServiceProvider.php tests/Pest.php tests/Feature/Mcp/ToolBaseTest.php \
  tests/Feature/Mcp/ListTeamsTest.php lang/en.json lang/fr.json lang/es.json lang/de.json
git commit -m "feat: add the mcp tool base, team visibility and the teams list tool

<Co-Authored-By trailer of the committing agent>
Claude-Session: https://claude.ai/code/session_01SosW8d2Uj7QxsF1tws5ssS"
```

#### Implementer notes

- `laravel/mcp` already turns exceptions thrown by `handle()` into tool errors, but only with `$e->getMessage()`; the wrapper in `SkrumTool` gives the spec's §10 wording ("Not found.", locked board, validation list) and keeps unexpected messages (which can carry SQL bindings, i.e. argument content) out of both the result and the log.
- The spec's `McpGrant` "scoped binding" is realised through `McpGrantContext` (Task 4 note); `bindMcpGrant()` calls `forgetScopedInstances()` so each simulated request gets fresh `VisibleTeams` memoization.

### Task 6: Retro list tools (members, boards, action items)

**Files:**
- Create: `app/Mcp/Presenters/McpActionItem.php`, `app/Mcp/Tools/Retro/ListTeamMembers.php`, `app/Mcp/Tools/Retro/ListBoards.php`, `app/Mcp/Tools/Retro/ListActionItems.php`, `app/Mcp/Tools/Retro/ListBoardActionItems.php`
- Modify: `app/Actions/ActionItems/ActionItemQuery.php` (public `filter()` extracted from `forUser`, no behaviour change), `app/Mcp/Servers/SkrumServer.php` (register the four tools)
- Test: create `tests/Feature/Mcp/RetroListToolsTest.php`

**Interfaces:**
- Consumes (Task 5): `App\Mcp\Tools\SkrumTool` (`protected function requiredScope(): McpScope`, `protected function run(Request $request): Response|ResponseFactory`), `App\Mcp\McpGrant::current()` (`user`, `tokenId`, `teamId`), `App\Mcp\VisibleTeams::ids(McpGrant $grant): array<int, string>`, `App\Mcp\McpContext` (`team(string $id): Team`, `retro(string $id): Retro` — both throw `ModelNotFoundException` outside the visible teams), `App\Mcp\Presenters\McpBoard::handle(Retro $retro): array` (Board shape of spec §6), Pest helpers `actingAsMcp(User $user, array $scopes = [McpScope::Read], ?Team $team = null)` returning `SkrumServer::actingAs($user)` with the grant bound, `mcpStructured(McpTestResponse): array`, `mcpToolNames(PendingTestResponse): array<int, string>`. Existing: `ActionItemQuery::order()`, `ActionItemFilters`, `PresentActionItem::handle(ActionItem, ?ActionItemActor, ?CarbonInterface)`, `ActionItemActor::forUser(User)`, `ActionItem::presentationRelations()`.
- Produces:
  - `McpActionItem::handle(ActionItem $item, User $viewer): array` (spec §6 action item: `PresentActionItem` output with `retroId` renamed `boardId`, plus absolute `url` `route('workspaces.actionItems.index', ['workspace' => $item->team->workspace, 'item' => $item->id])`); `McpActionItem::relations(): array<int, string>` (`ActionItem::presentationRelations()` + `team.workspace`).
  - `ActionItemQuery::filter(Builder $query, User $user, ActionItemFilters $filters): Builder` (status, assignee, team — the logic `forUser` already applies).
  - Tools `retro.team.members.list` → `{members: [{userId, name, avatarUrl, permission}]}`; `retro.boards.list` → `{items: Board[], page, hasMore}`; `retro.actions.list` → `{items: ActionItem[], page, hasMore}`; `retro.board.actions.list` → `{items: ActionItem[]}`.

- [ ] **Step 1: Write the failing tests**

Create `tests/Feature/Mcp/RetroListToolsTest.php`:

```php
<?php

use App\Enums\ActionItemPriority;
use App\Enums\McpScope;
use App\Enums\RetroPhase;
use App\Enums\WorkspaceRole;
use App\Mcp\Tools\Retro\ListActionItems;
use App\Mcp\Tools\Retro\ListBoardActionItems;
use App\Mcp\Tools\Retro\ListBoards;
use App\Mcp\Tools\Retro\ListTeamMembers;
use App\Models\ActionItem;
use App\Models\Retro;
use App\Models\Team;
use App\Models\User;
use App\Models\Workspace;

it('lists the team roster with workspace permissions and no emails', function () {
    $team = Team::factory()->create();
    $member = teamMember($team);
    $admin = workspaceManager($team->workspace);
    $team->members()->attach($admin);

    $response = actingAsMcp($member)->tool(ListTeamMembers::class, ['team_id' => $team->id])->assertOk();
    $members = collect(mcpStructured($response)['members']);

    expect($members->pluck('permission', 'userId')->all())->toEqual([
        $member->id => 'member',
        $admin->id => 'admin',
    ])
        ->and(json_encode($members))->not->toContain('@')
        ->and($members->first())->toHaveKeys(['userId', 'name', 'avatarUrl', 'permission']);
});

it('hides the roster of teams the user cannot see', function () {
    $user = teamMember(Team::factory()->create());
    $other = Team::factory()->create();

    actingAsMcp($user)->tool(ListTeamMembers::class, ['team_id' => $other->id])->assertHasErrors(['Not found.']);
});

it('refuses malformed ids', function () {
    $user = teamMember(Team::factory()->create());

    actingAsMcp($user)->tool(ListTeamMembers::class, ['team_id' => 'not-a-uuid'])->assertHasErrors();
});

it('lists boards newest first with date and finished filters', function () {
    $team = Team::factory()->create();
    $user = teamMember($team);
    $old = Retro::factory()->for($team)->inPhase(RetroPhase::Completed)->create(['created_at' => '2026-09-01 10:00:00']);
    $recent = Retro::factory()->for($team)->create(['created_at' => '2026-09-20 10:00:00']);

    $all = mcpStructured(actingAsMcp($user)->tool(ListBoards::class, ['team_id' => $team->id])->assertOk());

    expect(collect($all['items'])->pluck('id')->all())->toBe([$recent->id, $old->id])
        ->and($all['items'][0])->toHaveKeys(['id', 'title', 'teamId', 'teamName', 'phase', 'isFinished', 'url'])
        ->and($all['hasMore'])->toBeFalse();

    $finished = mcpStructured(actingAsMcp($user)->tool(ListBoards::class, ['team_id' => $team->id, 'finished_only' => true]));
    $since = mcpStructured(actingAsMcp($user)->tool(ListBoards::class, ['team_id' => $team->id, 'since' => '2026-09-10']));
    $until = mcpStructured(actingAsMcp($user)->tool(ListBoards::class, ['team_id' => $team->id, 'until' => '2026-09-10']));

    expect(collect($finished['items'])->pluck('id')->all())->toBe([$old->id])
        ->and(collect($since['items'])->pluck('id')->all())->toBe([$recent->id])
        ->and(collect($until['items'])->pluck('id')->all())->toBe([$old->id]);
});

it('paginates boards', function () {
    $team = Team::factory()->create();
    $user = teamMember($team);
    Retro::factory()->for($team)->count(3)->create();

    $first = mcpStructured(actingAsMcp($user)->tool(ListBoards::class, ['team_id' => $team->id, 'limit' => 2]));
    $second = mcpStructured(actingAsMcp($user)->tool(ListBoards::class, ['team_id' => $team->id, 'limit' => 2, 'page' => 2]));

    expect($first['items'])->toHaveCount(2)
        ->and($first['hasMore'])->toBeTrue()
        ->and($second['items'])->toHaveCount(1)
        ->and($second['page'])->toBe(2)
        ->and($second['hasMore'])->toBeFalse();

    actingAsMcp($user)->tool(ListBoards::class, ['team_id' => $team->id, 'limit' => 51])->assertHasErrors();
});

it('lists open action items across the visible teams by default', function () {
    $team = Team::factory()->create();
    $user = teamMember($team);
    $open = ActionItem::factory()->withoutRetro($team, $user)->create(['content' => 'Open one']);
    ActionItem::factory()->withoutRetro($team, $user)->completed()->create(['content' => 'Done one']);
    ActionItem::factory()->withoutRetro(Team::factory()->create(), User::factory()->create())->create(['content' => 'Foreign']);

    $result = mcpStructured(actingAsMcp($user)->tool(ListActionItems::class)->assertOk());

    expect(collect($result['items'])->pluck('id')->all())->toBe([$open->id])
        ->and($result['items'][0])->toHaveKeys(['boardId', 'teamId', 'content', 'status', 'assignee', 'createdBy', 'subtasks', 'url'])
        ->and($result['items'][0]['boardId'])->toBeNull()
        ->and($result['items'][0]['url'])->toContain('/action-items?item='.$open->id);
});

it('filters action items by status, assignee and team', function () {
    $team = Team::factory()->create();
    $user = teamMember($team);
    $mate = teamMember($team);
    $mine = ActionItem::factory()->withoutRetro($team, $user)->assignedTo($user)->create();
    $theirs = ActionItem::factory()->withoutRetro($team, $user)->assignedTo($mate)->create();
    $unassigned = ActionItem::factory()->withoutRetro($team, $user)->create();
    $overdue = ActionItem::factory()->withoutRetro($team, $user)->overdue()->create();
    $done = ActionItem::factory()->withoutRetro($team, $user)->completed()->create();

    $ids = fn (array $arguments) => collect(mcpStructured(actingAsMcp($user)->tool(ListActionItems::class, $arguments))['items'])->pluck('id')->sort()->values()->all();

    expect($ids(['assignee' => 'me']))->toBe([$mine->id])
        ->and($ids(['assignee' => $mate->id]))->toBe([$theirs->id])
        ->and($ids(['assignee' => 'unassigned']))->toBe(collect([$unassigned->id, $overdue->id])->sort()->values()->all())
        ->and($ids(['status' => 'overdue']))->toBe([$overdue->id])
        ->and($ids(['status' => 'completed']))->toBe([$done->id])
        ->and($ids(['status' => 'all']))->toHaveCount(5)
        ->and($ids(['team_id' => $team->id]))->toHaveCount(4);

    actingAsMcp($user)->tool(ListActionItems::class, ['status' => 'someday'])->assertHasErrors();
    actingAsMcp($user)->tool(ListActionItems::class, ['team_id' => Team::factory()->create()->id])->assertHasErrors(['Not found.']);
});

it('merges action items across workspaces', function () {
    $user = User::factory()->create();
    $first = Team::factory()->create(['name' => 'Core']);
    $second = Team::factory()->create(['name' => 'Core']);

    foreach ([$first, $second] as $team) {
        $team->workspace->members()->attach($user, ['role' => WorkspaceRole::Member->value]);
        $team->members()->attach($user);
    }

    $high = ActionItem::factory()->withoutRetro($second, $user)->priority(ActionItemPriority::High)->create();
    $overdue = ActionItem::factory()->withoutRetro($first, $user)->overdue()->create();
    $low = ActionItem::factory()->withoutRetro($first, $user)->priority(ActionItemPriority::Low)->create();

    $items = mcpStructured(actingAsMcp($user)->tool(ListActionItems::class))['items'];

    expect(collect($items)->pluck('id')->all())->toBe([$overdue->id, $high->id, $low->id]);

    $onlySecond = mcpStructured(actingAsMcp($user)->tool(ListActionItems::class, ['workspace_id' => $second->workspace_id]))['items'];

    expect(collect($onlySecond)->pluck('id')->all())->toBe([$high->id]);

    actingAsMcp($user)->tool(ListActionItems::class, ['workspace_id' => Workspace::factory()->create()->id])->assertHasErrors(['Not found.']);
});

it('lets workspace managers list every team of their workspace', function () {
    $team = Team::factory()->create();
    $admin = workspaceManager($team->workspace);
    $item = ActionItem::factory()->withoutRetro($team, teamMember($team))->create();

    expect(collect(mcpStructured(actingAsMcp($admin)->tool(ListActionItems::class))['items'])->pluck('id')->all())->toBe([$item->id]);
});

it('keeps a bound token inside its team', function () {
    $user = User::factory()->create();
    $bound = Team::factory()->create();
    $sibling = Team::factory()->create(['workspace_id' => $bound->workspace_id]);
    $bound->workspace->members()->attach($user, ['role' => WorkspaceRole::Member->value]);
    $bound->members()->attach($user);
    $sibling->members()->attach($user);
    $inBound = ActionItem::factory()->withoutRetro($bound, $user)->create();
    ActionItem::factory()->withoutRetro($sibling, $user)->create();

    $items = mcpStructured(actingAsMcp($user, [McpScope::Read], $bound)->tool(ListActionItems::class))['items'];

    expect(collect($items)->pluck('id')->all())->toBe([$inBound->id]);

    actingAsMcp($user, [McpScope::Read], $bound)->tool(ListBoards::class, ['team_id' => $sibling->id])->assertHasErrors(['Not found.']);
});

it('lists a board action items in creation order and names creators on anonymous boards', function () {
    $retro = Retro::factory()->anonymous()->inPhase(RetroPhase::Discussing)->create();
    [$user, $participant] = retroMember($retro);
    $first = ActionItem::factory()->create(['retro_id' => $retro->id, 'created_by_participant_id' => $participant->id, 'created_by_user_id' => $user->id, 'created_at' => now()->subMinute()]);
    $second = ActionItem::factory()->create(['retro_id' => $retro->id]);

    $items = mcpStructured(actingAsMcp($user)->tool(ListBoardActionItems::class, ['board_id' => $retro->id])->assertOk())['items'];

    expect(collect($items)->pluck('id')->all())->toBe([$first->id, $second->id])
        ->and($items[0]['boardId'])->toBe($retro->id)
        ->and($items[0]['createdBy']['name'])->toBe($user->name);

    actingAsMcp(teamMember(Team::factory()->create()))->tool(ListBoardActionItems::class, ['board_id' => $retro->id])->assertHasErrors(['Not found.']);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `export PATH="$HOME/.orbstack/bin:/opt/homebrew/bin:$PATH"; vendor/bin/sail artisan test --compact tests/Feature/Mcp/RetroListToolsTest.php`
Expected: FAIL — `Class "App\Mcp\Tools\Retro\ListTeamMembers" not found`.

- [ ] **Step 3: Extract `ActionItemQuery::filter()`**

In `app/Actions/ActionItems/ActionItemQuery.php`, replace the body of `forUser()` and add `filter()` right after it:

```php
    /**
     * @return LengthAwarePaginator<int, ActionItem>
     */
    public function forUser(User $user, Workspace $workspace, ActionItemFilters $filters): LengthAwarePaginator
    {
        $query = $this->visibleTo($user, $workspace)
            ->with(ActionItem::presentationRelations())
            ->withCount('comments');

        return self::order($this->filter($query, $user, $filters))->paginate(self::PerPage)->withQueryString();
    }

    /**
     * @param  Builder<ActionItem>  $query
     * @return Builder<ActionItem>
     */
    public function filter(Builder $query, User $user, ActionItemFilters $filters): Builder
    {
        $this->filterByStatus($query, $filters->status);
        $this->filterByAssignee($query, $user, $filters->assignee);

        if ($filters->teamId !== null) {
            $query->where('team_id', $filters->teamId);
        }

        return $query;
    }
```

Run `vendor/bin/sail artisan test --compact tests/Feature/ActionItems/ActionItemsPageTest.php` — still green (no behaviour change).

- [ ] **Step 4: Action item presenter**

Create `app/Mcp/Presenters/McpActionItem.php`:

```php
<?php

namespace App\Mcp\Presenters;

use App\Actions\ActionItems\ActionItemActor;
use App\Actions\Retros\PresentActionItem;
use App\Models\ActionItem;
use App\Models\User;
use Illuminate\Support\Arr;

class McpActionItem
{
    public function __construct(private PresentActionItem $presentActionItem) {}

    /**
     * @return array<int, string>
     */
    public static function relations(): array
    {
        return [...ActionItem::presentationRelations(), 'team.workspace'];
    }

    /**
     * @return array<string, mixed>
     */
    public function handle(ActionItem $item, User $viewer): array
    {
        $presented = $this->presentActionItem->handle($item, ActionItemActor::forUser($viewer));

        return [
            'id' => $presented['id'],
            'boardId' => $presented['retroId'],
            ...Arr::except($presented, ['id', 'retroId']),
            'url' => route('workspaces.actionItems.index', ['workspace' => $item->team->workspace, 'item' => $item->id]),
        ];
    }
}
```

- [ ] **Step 5: Tools**

Create `app/Mcp/Tools/Retro/ListTeamMembers.php`:

```php
<?php

namespace App\Mcp\Tools\Retro;

use App\Enums\McpScope;
use App\Mcp\McpContext;
use App\Mcp\Tools\SkrumTool;
use App\Models\User;
use App\Models\WorkspaceMembership;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\ResponseFactory;
use Laravel\Mcp\Server\Tools\Annotations\IsOpenWorld;
use Laravel\Mcp\Server\Tools\Annotations\IsReadOnly;

#[IsReadOnly]
#[IsOpenWorld(false)]
class ListTeamMembers extends SkrumTool
{
    protected string $name = 'retro.team.members.list';

    protected string $description = 'List the members of a team with their permission (owner, admin or member). Their user ids are the valid assignee_user_id values for action items.';

    public function __construct(private McpContext $context) {}

    public function schema(JsonSchema $schema): array
    {
        return [
            'team_id' => $schema->string()->description('The team id (UUID).')->required(),
        ];
    }

    protected function requiredScope(): McpScope
    {
        return McpScope::Read;
    }

    protected function run(Request $request): Response|ResponseFactory
    {
        $validated = $request->validate(['team_id' => ['required', 'uuid']]);
        $team = $this->context->team($validated['team_id']);
        $members = $team->members()->orderBy('name')->get();
        $roles = WorkspaceMembership::query()
            ->where('workspace_id', $team->workspace_id)
            ->whereIn('user_id', $members->pluck('id'))
            ->get()
            ->mapWithKeys(fn (WorkspaceMembership $membership) => [$membership->user_id => $membership->role->value]);

        return Response::structured([
            'members' => $members->map(fn (User $member) => [
                'userId' => $member->id,
                'name' => $member->name,
                'avatarUrl' => url($member->avatarUrl()),
                'permission' => $roles->get($member->id, 'member'),
            ])->values()->all(),
        ]);
    }
}
```

Create `app/Mcp/Tools/Retro/ListBoards.php`:

```php
<?php

namespace App\Mcp\Tools\Retro;

use App\Enums\McpScope;
use App\Enums\RetroPhase;
use App\Mcp\McpContext;
use App\Mcp\Presenters\McpBoard;
use App\Mcp\Tools\SkrumTool;
use App\Models\Retro;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\ResponseFactory;
use Laravel\Mcp\Server\Tools\Annotations\IsOpenWorld;
use Laravel\Mcp\Server\Tools\Annotations\IsReadOnly;

#[IsReadOnly]
#[IsOpenWorld(false)]
class ListBoards extends SkrumTool
{
    protected string $name = 'retro.boards.list';

    protected string $description = 'List the retrospective boards of a team, newest first, optionally between two dates or only finished ones.';

    public function __construct(
        private McpContext $context,
        private McpBoard $presentBoard,
    ) {}

    public function schema(JsonSchema $schema): array
    {
        return [
            'team_id' => $schema->string()->description('The team id (UUID).')->required(),
            'since' => $schema->string()->format('date')->description('Only boards created on or after this date (YYYY-MM-DD).'),
            'until' => $schema->string()->format('date')->description('Only boards created on or before this date (YYYY-MM-DD).'),
            'finished_only' => $schema->boolean()->description('Only finished (completed) boards.')->default(false),
            'limit' => $schema->integer()->min(1)->max(50)->default(self::DefaultLimit),
            'page' => $schema->integer()->min(1)->default(1),
        ];
    }

    protected function requiredScope(): McpScope
    {
        return McpScope::Read;
    }

    protected function run(Request $request): Response|ResponseFactory
    {
        $validated = $request->validate([
            'team_id' => ['required', 'uuid'],
            'since' => ['nullable', 'date_format:Y-m-d'],
            'until' => ['nullable', 'date_format:Y-m-d'],
            'finished_only' => ['nullable', 'boolean'],
            ...$this->paginationRules(),
        ]);

        $team = $this->context->team($validated['team_id']);

        $query = McpBoard::withCounts(Retro::query())
            ->where('team_id', $team->id)
            ->when($validated['since'] ?? null, fn ($query, string $since) => $query->whereDate('created_at', '>=', $since))
            ->when($validated['until'] ?? null, fn ($query, string $until) => $query->whereDate('created_at', '<=', $until))
            ->when($validated['finished_only'] ?? false, fn ($query) => $query->where('phase', RetroPhase::Completed))
            ->latest()
            ->orderByDesc('id');

        [$page, $limit] = $this->pagination($validated);

        return Response::structured($this->paginate(
            $query,
            $page,
            $limit,
            fn (Retro $retro) => $this->presentBoard->handle($retro),
        ));
    }
}
```

Create `app/Mcp/Tools/Retro/ListActionItems.php`:

```php
<?php

namespace App\Mcp\Tools\Retro;

use App\Actions\ActionItems\ActionItemFilters;
use App\Actions\ActionItems\ActionItemQuery;
use App\Enums\McpScope;
use App\Mcp\McpContext;
use App\Mcp\McpGrant;
use App\Mcp\Presenters\McpActionItem;
use App\Mcp\Tools\SkrumTool;
use App\Mcp\VisibleTeams;
use App\Models\ActionItem;
use App\Models\Team;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Validation\Rule;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\ResponseFactory;
use Laravel\Mcp\Server\Tools\Annotations\IsOpenWorld;
use Laravel\Mcp\Server\Tools\Annotations\IsReadOnly;

#[IsReadOnly]
#[IsOpenWorld(false)]
class ListActionItems extends SkrumTool
{
    protected string $name = 'retro.actions.list';

    protected string $description = 'List action items (agreements) across every board of your teams at once: open by default, or overdue, completed or all; optionally only yours, unassigned or a teammate\'s, and only one team or workspace. Overdue items come first, then by due date, priority and creation date.';

    public function __construct(
        private McpContext $context,
        private VisibleTeams $visibleTeams,
        private ActionItemQuery $actionItemQuery,
        private McpActionItem $presentActionItem,
    ) {}

    public function schema(JsonSchema $schema): array
    {
        return [
            'team_id' => $schema->string()->description('Only this team (UUID).'),
            'workspace_id' => $schema->string()->description('Only the teams of this workspace (UUID).'),
            'status' => $schema->string()->enum(ActionItemFilters::Statuses)->default('open'),
            'assignee' => $schema->string()->description('"me", "unassigned" or a user id from retro.team.members.list.'),
            'limit' => $schema->integer()->min(1)->max(50)->default(self::DefaultLimit),
            'page' => $schema->integer()->min(1)->default(1),
        ];
    }

    protected function requiredScope(): McpScope
    {
        return McpScope::Read;
    }

    protected function run(Request $request): Response|ResponseFactory
    {
        $validated = $request->validate([
            'team_id' => ['nullable', 'uuid'],
            'workspace_id' => ['nullable', 'uuid'],
            'status' => ['nullable', Rule::in(ActionItemFilters::Statuses)],
            'assignee' => ['nullable', 'string', function (string $attribute, mixed $value, \Closure $fail): void {
                if (in_array($value, ['me', 'unassigned'], true) || \Illuminate\Support\Str::isUuid($value)) {
                    return;
                }

                $fail(__('Choose "me", "unassigned" or a member of the team.'));
            }],
            ...$this->paginationRules(),
        ]);

        $grant = McpGrant::current();
        $teamIds = $this->teamIds($grant, $validated['team_id'] ?? null, $validated['workspace_id'] ?? null);

        $query = ActionItem::query()
            ->whereIn('team_id', $teamIds)
            ->with(McpActionItem::relations())
            ->withCount('comments');

        $filters = new ActionItemFilters(
            status: $validated['status'] ?? 'open',
            assignee: $validated['assignee'] ?? null,
        );

        $query = ActionItemQuery::order($this->actionItemQuery->filter($query, $grant->user, $filters));

        [$page, $limit] = $this->pagination($validated);

        return Response::structured($this->paginate(
            $query,
            $page,
            $limit,
            fn (ActionItem $item) => $this->presentActionItem->handle($item, $grant->user),
        ));
    }

    /**
     * @return array<int, string>
     */
    private function teamIds(McpGrant $grant, ?string $teamId, ?string $workspaceId): array
    {
        if ($teamId !== null) {
            return [$this->context->team($teamId)->id];
        }

        $visible = $this->visibleTeams->ids($grant);

        if ($workspaceId === null) {
            return $visible;
        }

        $inWorkspace = Team::query()->whereIn('id', $visible)->where('workspace_id', $workspaceId)->pluck('id')->all();

        if ($inWorkspace === []) {
            throw new ModelNotFoundException;
        }

        return $inWorkspace;
    }
}
```

Replace the two fully-qualified names in the `assignee` closure with imports (`use Closure;`, `use Illuminate\Support\Str;`) and `Closure $fail` / `Str::isUuid($value)` before running pint.

Create `app/Mcp/Tools/Retro/ListBoardActionItems.php`:

```php
<?php

namespace App\Mcp\Tools\Retro;

use App\Enums\McpScope;
use App\Mcp\McpContext;
use App\Mcp\McpGrant;
use App\Mcp\Presenters\McpActionItem;
use App\Mcp\Tools\SkrumTool;
use App\Models\ActionItem;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\ResponseFactory;
use Laravel\Mcp\Server\Tools\Annotations\IsOpenWorld;
use Laravel\Mcp\Server\Tools\Annotations\IsReadOnly;

#[IsReadOnly]
#[IsOpenWorld(false)]
class ListBoardActionItems extends SkrumTool
{
    protected string $name = 'retro.board.actions.list';

    protected string $description = 'List the action items (agreements) decided on one board, in the order they were added, with status, priority and assignee. Action items are always named, also on anonymous boards.';

    public function __construct(
        private McpContext $context,
        private McpActionItem $presentActionItem,
    ) {}

    public function schema(JsonSchema $schema): array
    {
        return [
            'board_id' => $schema->string()->description('The board id (UUID).')->required(),
        ];
    }

    protected function requiredScope(): McpScope
    {
        return McpScope::Read;
    }

    protected function run(Request $request): Response|ResponseFactory
    {
        $validated = $request->validate(['board_id' => ['required', 'uuid']]);
        $retro = $this->context->retro($validated['board_id']);
        $viewer = McpGrant::current()->user;

        $items = $retro->actionItems()
            ->with(McpActionItem::relations())
            ->withCount('comments')
            ->orderBy('created_at')
            ->orderBy('id')
            ->get();

        return Response::structured([
            'items' => $items->map(fn (ActionItem $item) => $this->presentActionItem->handle($item, $viewer))->values()->all(),
        ]);
    }
}
```

In `app/Mcp/Servers/SkrumServer.php` add to `$tools` (after `ListTeams::class`) with their imports:

```php
        ListTeamMembers::class,
        ListBoards::class,
        ListActionItems::class,
        ListBoardActionItems::class,
```

- [ ] **Step 6: Translations**

Append to `lang/en.json`, `lang/fr.json`, `lang/es.json`, `lang/de.json` (skip a key already present):

| en | fr | es | de |
|---|---|---|---|
| `Choose "me", "unassigned" or a member of the team.` | `Choisissez « me », « unassigned » ou un membre de l'équipe.` | `Elige «me», «unassigned» o un miembro del equipo.` | `Wähle „me“, „unassigned“ oder ein Teammitglied.` |

JSON lines (escape the inner double quotes of the key):

```json
"Choose \"me\", \"unassigned\" or a member of the team.": "Choose \"me\", \"unassigned\" or a member of the team."
```
```json
"Choose \"me\", \"unassigned\" or a member of the team.": "Choisissez « me », « unassigned » ou un membre de l'équipe."
```
```json
"Choose \"me\", \"unassigned\" or a member of the team.": "Elige «me», «unassigned» o un miembro del equipo."
```
```json
"Choose \"me\", \"unassigned\" or a member of the team.": "Wähle „me“, „unassigned“ oder ein Teammitglied."
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Mcp/RetroListToolsTest.php tests/Feature/ActionItems tests/Feature/TranslationKeysTest.php`
Expected: PASS.

- [ ] **Step 8: Format and analyse**

Run: `vendor/bin/sail bin pint --dirty --format agent && vendor/bin/sail bin phpstan analyse --no-progress`
Expected: clean, 0 errors.

- [ ] **Step 9: Commit**

```bash
git add app/Mcp/Presenters/McpActionItem.php app/Mcp/Tools/Retro/ListTeamMembers.php app/Mcp/Tools/Retro/ListBoards.php app/Mcp/Tools/Retro/ListActionItems.php app/Mcp/Tools/Retro/ListBoardActionItems.php app/Actions/ActionItems/ActionItemQuery.php app/Mcp/Servers/SkrumServer.php tests/Feature/Mcp/RetroListToolsTest.php lang/en.json lang/fr.json lang/es.json lang/de.json
git commit -m "feat: list team members, boards and action items through MCP

Co-Authored-By: <your harness attribution>
Claude-Session: https://claude.ai/code/session_01SosW8d2Uj7QxsF1tws5ssS"
```

#### Implementer notes

- `Response::structured()` refuses an empty array, so every list result is wrapped in an object (`members`, `items`), never a bare list.
- Avatar URLs are made absolute with `url()` because MCP clients have no base URL.

### Task 7: Messages and summary

**Files:**
- Create: `app/Mcp/Presenters/McpMessage.php`, `app/Mcp/Tools/Retro/ListMessages.php`, `app/Mcp/Tools/Retro/GetSummary.php`
- Modify: `app/Models/Retro.php` (`showsVoteTotals(): bool`), `app/Actions/Retros/BuildBoardSnapshot.php` (uses `$retro->showsVoteTotals()` instead of its inline expression — no behaviour change), `app/Mcp/Servers/SkrumServer.php`, `lang/{en,fr,es,de}.json`
- Test: create `tests/Feature/Mcp/MessagesAndSummaryTest.php`

**Interfaces:**
- Consumes: Task 5 (`SkrumTool`, `McpContext::retro()`, `McpContext::participant(Retro $retro): ?Participant` — the user's existing participant, never created, `McpBoard::handle()`), Task 5 (`SkrumTool::paginationRules()`, `pagination()`, `paginate()`, `mcpStructured()`), existing `PresentCard::handle(Card, Retro, ?Participant)`, `SummarizeReactions::handle(Collection, Retro, ?Participant, ?bool)`, `PresentRetroSummary::handle(Retro)`, `Llm::isConfigured()`, `Retro::effectiveSummaryStatus()`.
- Produces:
  - `Retro::showsVoteTotals(): bool` — `Discussing` or `Completed`, or `Voting` while `hide_vote_counts` is off (the snapshot's rule, now shared).
  - `McpMessage::handle(Card $card, Retro $retro, ?Participant $viewer, ?array $voteTotals): array` — Message shape of spec §6.1 (`id, hidden, content, author: {id, name}|null, isMine, votes: ?int, sentiment, category, groupName, reactions: [{emoji, count}], commentCount, gif: {url}|null, grouped: Message[]`); expects `participant.user`, `reactions`, `comments`, `children` loaded on the card (children with the same relations); `$voteTotals` is `card id => total` or `null` when totals are hidden.
  - Tools `retro.board.messages.list` → `{columns: [{id, title, description, messages: Message[]}], page, hasMore}` and `retro.board.summary.get` → `{board, summary: {text, generatedAt, provider}|null, summaryStatus, participants: [{name, avatarUrl}]}`.

- [ ] **Step 1: Write the failing tests**

Create `tests/Feature/Mcp/MessagesAndSummaryTest.php`:

```php
<?php

use App\Enums\CardSentiment;
use App\Enums\RetroPhase;
use App\Enums\SummaryStatus;
use App\Mcp\Tools\Retro\GetSummary;
use App\Mcp\Tools\Retro\ListMessages;
use App\Models\Card;
use App\Models\CardComment;
use App\Models\CardReaction;
use App\Models\Column;
use App\Models\Participant;
use App\Models\Retro;
use App\Models\Team;
use App\Models\Vote;

/**
 * @return array{0: Retro, 1: \App\Models\User, 2: Participant, 3: Column}
 */
function mcpMessagesBoard(RetroPhase $phase, bool $anonymous = false): array
{
    $retro = Retro::factory()->inPhase($phase)->create(['is_anonymous' => $anonymous]);
    [$user, $participant] = retroMember($retro);
    $column = Column::factory()->create(['retro_id' => $retro->id, 'title' => 'Went well', 'description' => 'Wins']);

    return [$retro, $user, $participant, $column];
}

it('hides other participants cards in the writing phase and shows the viewer own', function () {
    configureLlm();
    [$retro, $user, $participant, $column] = mcpMessagesBoard(RetroPhase::Writing);
    $mine = Card::factory()->create(['retro_id' => $retro->id, 'column_id' => $column->id, 'participant_id' => $participant->id, 'content' => 'My idea']);
    $theirs = Card::factory()->create(['retro_id' => $retro->id, 'column_id' => $column->id, 'content' => 'Secret idea']);
    $theirs->forceFill(['sentiment' => CardSentiment::Negative, 'category' => 'Process'])->save();

    $response = actingAsMcp($user)->tool(ListMessages::class, ['board_id' => $retro->id])->assertOk();
    $messages = collect(mcpStructured($response)['columns'][0]['messages'])->keyBy('id');

    expect($messages[$mine->id])->toMatchArray(['hidden' => false, 'content' => 'My idea', 'isMine' => true])
        ->and($messages[$theirs->id])->toMatchArray(['hidden' => true, 'content' => null, 'author' => null, 'sentiment' => null, 'category' => null, 'groupName' => null, 'reactions' => [], 'commentCount' => 0]);

    $response->assertDontSee('Secret idea');
});

it('shows every card with authors, totals, reactions and insights once discussing', function () {
    configureLlm();
    [$retro, $user, $participant, $column] = mcpMessagesBoard(RetroPhase::Discussing);
    $lead = Card::factory()->create(['retro_id' => $retro->id, 'column_id' => $column->id, 'content' => 'Lead', 'group_name' => 'Deploys']);
    $lead->forceFill(['sentiment' => CardSentiment::Positive, 'category' => 'Delivery'])->save();
    $child = Card::factory()->create(['retro_id' => $retro->id, 'column_id' => $column->id, 'parent_card_id' => $lead->id, 'content' => 'Child']);
    Vote::factory()->count(2)->create(['retro_id' => $retro->id, 'card_id' => $lead->id]);
    CardReaction::factory()->create(['retro_id' => $retro->id, 'card_id' => $lead->id, 'emoji' => '🎉']);
    CardComment::factory()->create(['retro_id' => $retro->id, 'card_id' => $lead->id]);

    $messages = mcpStructured(actingAsMcp($user)->tool(ListMessages::class, ['board_id' => $retro->id]))['columns'][0]['messages'];

    expect($messages)->toHaveCount(1)
        ->and($messages[0])->toMatchArray([
            'id' => $lead->id,
            'content' => 'Lead',
            'votes' => 2,
            'sentiment' => 'positive',
            'category' => 'Delivery',
            'groupName' => 'Deploys',
            'reactions' => [['emoji' => '🎉', 'count' => 1]],
            'commentCount' => 1,
        ])
        ->and($messages[0]['author']['name'])->toBe($lead->participant->displayName())
        ->and(collect($messages[0]['grouped'])->pluck('id')->all())->toBe([$child->id]);
});

it('never names authors on anonymous boards except the viewer', function () {
    [$retro, $user, $participant, $column] = mcpMessagesBoard(RetroPhase::Discussing, anonymous: true);
    Card::factory()->create(['retro_id' => $retro->id, 'column_id' => $column->id, 'participant_id' => $participant->id]);
    Card::factory()->create(['retro_id' => $retro->id, 'column_id' => $column->id]);

    $messages = collect(mcpStructured(actingAsMcp($user)->tool(ListMessages::class, ['board_id' => $retro->id]))['columns'][0]['messages']);

    expect($messages->where('isMine', true)->first()['author'])->not->toBeNull()
        ->and($messages->where('isMine', false)->first()['author'])->toBeNull();
});

it('reads a board without joining it', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Discussing)->create();
    $user = teamMember($retro->team);
    Card::factory()->create(['retro_id' => $retro->id]);

    actingAsMcp($user)->tool(ListMessages::class, ['board_id' => $retro->id])->assertOk();

    expect(Participant::query()->where('retro_id', $retro->id)->where('user_id', $user->id)->exists())->toBeFalse();
});

it('hides vote totals when the board hides them and refuses sorting by votes', function () {
    [$retro, $user, , $column] = mcpMessagesBoard(RetroPhase::Voting);
    $retro->update(['hide_vote_counts' => true]);
    $card = Card::factory()->create(['retro_id' => $retro->id, 'column_id' => $column->id]);
    Vote::factory()->create(['retro_id' => $retro->id, 'card_id' => $card->id]);

    $messages = mcpStructured(actingAsMcp($user)->tool(ListMessages::class, ['board_id' => $retro->id]))['columns'][0]['messages'];

    expect($messages[0]['votes'])->toBeNull();

    actingAsMcp($user)->tool(ListMessages::class, ['board_id' => $retro->id, 'sort' => 'votes'])
        ->assertHasErrors(['Vote totals are not visible yet.']);
});

it('sorts by votes, filters a column and paginates', function () {
    [$retro, $user, , $column] = mcpMessagesBoard(RetroPhase::Discussing);
    $other = Column::factory()->create(['retro_id' => $retro->id, 'position' => 1]);
    $low = Card::factory()->create(['retro_id' => $retro->id, 'column_id' => $column->id, 'position' => 0]);
    $high = Card::factory()->create(['retro_id' => $retro->id, 'column_id' => $column->id, 'position' => 1]);
    Card::factory()->create(['retro_id' => $retro->id, 'column_id' => $other->id]);
    Vote::factory()->count(3)->create(['retro_id' => $retro->id, 'card_id' => $high->id]);

    $sorted = mcpStructured(actingAsMcp($user)->tool(ListMessages::class, ['board_id' => $retro->id, 'column_id' => $column->id, 'sort' => 'votes']));

    expect($sorted['columns'])->toHaveCount(1)
        ->and(collect($sorted['columns'][0]['messages'])->pluck('id')->all())->toBe([$high->id, $low->id]);

    $page = mcpStructured(actingAsMcp($user)->tool(ListMessages::class, ['board_id' => $retro->id, 'limit' => 2]));

    expect($page['hasMore'])->toBeTrue()
        ->and(collect($page['columns'])->flatMap(fn (array $column) => $column['messages'])->count())->toBe(2);

    actingAsMcp($user)->tool(ListMessages::class, ['board_id' => $retro->id, 'limit' => 201])->assertHasErrors();
});

it('hides boards of other teams', function () {
    $retro = Retro::factory()->create();

    actingAsMcp(teamMember(Team::factory()->create()))->tool(ListMessages::class, ['board_id' => $retro->id])->assertHasErrors(['Not found.']);
});

it('returns the ready summary of a completed board with its participants', function () {
    configureLlm();
    $retro = Retro::factory()->inPhase(RetroPhase::Completed)->create([
        'summary' => 'We shipped.',
        'summary_status' => SummaryStatus::Ready,
        'summary_generated_at' => now(),
    ]);
    [$user] = retroMember($retro);

    $result = mcpStructured(actingAsMcp($user)->tool(GetSummary::class, ['board_id' => $retro->id])->assertOk());

    expect($result['summary']['text'])->toBe('We shipped.')
        ->and($result['summaryStatus'])->toBe('ready')
        ->and($result['board']['id'])->toBe($retro->id)
        ->and($result['participants'][0])->toHaveKeys(['name', 'avatarUrl']);
});

it('returns no summary while pending, when opted out, without provider or before completion', function (string $case) {
    configureLlm();
    $retro = Retro::factory()->inPhase(RetroPhase::Completed)->create([
        'summary' => 'Text',
        'summary_status' => SummaryStatus::Ready,
        'summary_generated_at' => now(),
    ]);

    match ($case) {
        'pending' => $retro->update(['summary_status' => SummaryStatus::Pending, 'summary_requested_at' => now()]),
        'opted out' => $retro->update(['ai_summary_enabled' => false]),
        'no provider' => config(['services.llm.provider' => null]),
        'in progress' => $retro->update(['phase' => RetroPhase::Discussing]),
    };

    [$user] = retroMember($retro);

    expect(mcpStructured(actingAsMcp($user)->tool(GetSummary::class, ['board_id' => $retro->id]))['summary'])->toBeNull();
})->with(['pending', 'opted out', 'no provider', 'in progress']);
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Mcp/MessagesAndSummaryTest.php`
Expected: FAIL — `Class "App\Mcp\Tools\Retro\ListMessages" not found`.

- [ ] **Step 3: Share the vote-totals rule**

In `app/Models/Retro.php` add after `voteLimit()`:

```php
    public function showsVoteTotals(): bool
    {
        if (in_array($this->phase, [RetroPhase::Discussing, RetroPhase::Completed], true)) {
            return true;
        }

        return $this->phase === RetroPhase::Voting && ! $this->hide_vote_counts;
    }
```

In `app/Actions/Retros/BuildBoardSnapshot.php` replace

```php
        $showsTotals = in_array($retro->phase, [RetroPhase::Discussing, RetroPhase::Completed], true)
            || ($retro->phase === RetroPhase::Voting && ! $retro->hide_vote_counts);
```

with

```php
        $showsTotals = $retro->showsVoteTotals();
```

Run `vendor/bin/sail artisan test --compact tests/Feature/Retros/BoardSnapshotTest.php tests/Feature/Retros/VotingTest.php` — still green.

- [ ] **Step 4: Message presenter**

Create `app/Mcp/Presenters/McpMessage.php`:

```php
<?php

namespace App\Mcp\Presenters;

use App\Actions\Retros\PresentCard;
use App\Actions\Retros\SummarizeReactions;
use App\Models\Card;
use App\Models\CardComment;
use App\Models\Participant;
use App\Models\Retro;
use App\Support\Llm\Llm;

class McpMessage
{
    public function __construct(
        private PresentCard $presentCard,
        private SummarizeReactions $summarizeReactions,
        private Llm $llm,
    ) {}

    /**
     * Reactions are counted, never named: MCP output leaves the board.
     *
     * @param  array<string, int>|null  $voteTotals
     * @return array<string, mixed>
     */
    public function handle(Card $card, Retro $retro, ?Participant $viewer, ?array $voteTotals): array
    {
        $presented = $this->presentCard->handle($card, $retro, $viewer);
        $isHidden = $presented['hidden'];
        $showsInsights = $this->llm->isConfigured() && ! $isHidden;

        return [
            'id' => $presented['id'],
            'hidden' => $isHidden,
            'content' => $presented['content'],
            'author' => $presented['author'],
            'isMine' => $presented['isMine'],
            'votes' => $voteTotals === null ? null : ($voteTotals[$card->id] ?? 0),
            'sentiment' => $showsInsights ? $card->sentiment?->value : null,
            'category' => $showsInsights ? $card->category : null,
            'groupName' => $presented['groupName'],
            'reactions' => $isHidden ? [] : array_map(
                fn (array $reaction) => ['emoji' => $reaction['emoji'], 'count' => $reaction['count']],
                $this->summarizeReactions->handle($card->reactions, $retro, $viewer, showsNames: false),
            ),
            'commentCount' => $isHidden ? 0 : $card->comments->reject(fn (CardComment $comment) => $comment->isDeleted())->count(),
            'gif' => $presented['gif'] === null ? null : ['url' => url($presented['gif']['url'])],
            'grouped' => $card->children
                ->sortBy('position')
                ->map(fn (Card $child) => $this->handle($child, $retro, $viewer, $voteTotals))
                ->values()
                ->all(),
        ];
    }
}
```

- [ ] **Step 5: Tools**

Create `app/Mcp/Tools/Retro/ListMessages.php`:

```php
<?php

namespace App\Mcp\Tools\Retro;

use App\Enums\McpScope;
use App\Mcp\McpContext;
use App\Mcp\Presenters\McpMessage;
use App\Mcp\Tools\SkrumTool;
use App\Models\Card;
use App\Models\Column;
use App\Models\Retro;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Validation\Rule;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\ResponseFactory;
use Laravel\Mcp\Server\Tools\Annotations\IsOpenWorld;
use Laravel\Mcp\Server\Tools\Annotations\IsReadOnly;

#[IsReadOnly]
#[IsOpenWorld(false)]
class ListMessages extends SkrumTool
{
    private const MaxLimit = 200;

    protected string $name = 'retro.board.messages.list';

    protected string $description = 'List the messages (cards) of a board grouped by template column, with grouped cards under their lead card. While participants are still writing, other people\'s messages are hidden. Authors are never shown on anonymous boards (except your own). Vote totals appear only when the board shows them.';

    public function __construct(
        private McpContext $context,
        private McpMessage $presentMessage,
    ) {}

    public function schema(JsonSchema $schema): array
    {
        return [
            'board_id' => $schema->string()->description('The board id (UUID).')->required(),
            'column_id' => $schema->string()->description('Only this column (UUID).'),
            'sort' => $schema->string()->enum(['position', 'votes'])->default('position'),
            'limit' => $schema->integer()->min(1)->max(self::MaxLimit)->default(self::DefaultLimit),
            'page' => $schema->integer()->min(1)->default(1),
        ];
    }

    protected function requiredScope(): McpScope
    {
        return McpScope::Read;
    }

    protected function run(Request $request): Response|ResponseFactory
    {
        $validated = $request->validate([
            'board_id' => ['required', 'uuid'],
            'column_id' => ['nullable', 'uuid'],
            'sort' => ['nullable', Rule::in(['position', 'votes'])],
            ...$this->paginationRules(self::MaxLimit),
        ]);

        $retro = $this->context->retro($validated['board_id']);
        $sortsByVotes = ($validated['sort'] ?? 'position') === 'votes';

        if ($sortsByVotes && ! $retro->showsVoteTotals()) {
            abort(422, __('Vote totals are not visible yet.'));
        }

        $columns = $retro->columns()
            ->when($validated['column_id'] ?? null, fn (Builder $query, string $columnId) => $query->whereKey($columnId))
            ->get();

        if (($validated['column_id'] ?? null) !== null && $columns->isEmpty()) {
            abort(404);
        }

        $viewer = $this->context->participant($retro);
        $voteTotals = $retro->showsVoteTotals()
            ? $retro->votes()->selectRaw('card_id, count(*) as total')->groupBy('card_id')->pluck('total', 'card_id')->map(fn (mixed $total) => (int) $total)->all()
            : null;

        $relations = ['participant.user', 'reactions', 'comments'];
        $query = Card::query()
            ->where('cards.retro_id', $retro->id)
            ->whereNull('parent_card_id')
            ->whereIn('column_id', $columns->pluck('id'))
            ->with([...$relations, 'children' => fn ($query) => $query->with($relations)])
            ->select('cards.*')
            ->join('columns', 'columns.id', '=', 'cards.column_id');

        $sortsByVotes
            ? $query->withCount('votes')->orderByDesc('votes_count')->orderBy('columns.position')->orderBy('cards.position')
            : $query->orderBy('columns.position')->orderBy('cards.position');

        [$pageNumber, $limit] = $this->pagination($validated, self::MaxLimit);
        $page = $this->paginate($query->orderBy('cards.id'), $pageNumber, $limit, fn (Card $card) => $card);
        $cardsByColumn = collect($page['items'])->groupBy('column_id');

        return Response::structured([
            'columns' => $columns->map(fn (Column $column) => [
                'id' => $column->id,
                'title' => $column->title,
                'description' => $column->description,
                'messages' => $cardsByColumn->get($column->id, collect())
                    ->map(fn (Card $card) => $this->presentMessage->handle($card, $retro, $viewer, $voteTotals))
                    ->values()
                    ->all(),
            ])->values()->all(),
            'page' => $page['page'],
            'hasMore' => $page['hasMore'],
        ]);
    }
}
```

`abort(404)` is mapped to "Not found." by `SkrumTool` (Task 5 maps `NotFoundHttpException`). `abort(422, …)` is an `HttpException` whose message `SkrumTool` returns as the tool error.

Create `app/Mcp/Tools/Retro/GetSummary.php`:

```php
<?php

namespace App\Mcp\Tools\Retro;

use App\Actions\Retros\PresentRetroSummary;
use App\Enums\McpScope;
use App\Enums\RetroPhase;
use App\Enums\SummaryStatus;
use App\Mcp\McpContext;
use App\Mcp\Presenters\McpBoard;
use App\Mcp\Tools\SkrumTool;
use App\Models\Participant;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\ResponseFactory;
use Laravel\Mcp\Server\Tools\Annotations\IsOpenWorld;
use Laravel\Mcp\Server\Tools\Annotations\IsReadOnly;

#[IsReadOnly]
#[IsOpenWorld(false)]
class GetSummary extends SkrumTool
{
    protected string $name = 'retro.board.summary.get';

    protected string $description = 'Get the summary of a finished board and who took part. The summary is null while the board is not finished, while it is being generated, when the team turned it off or when no AI provider is configured. Participants are listed on anonymous boards too, never who wrote what.';

    public function __construct(
        private McpContext $context,
        private McpBoard $presentBoard,
        private PresentRetroSummary $presentRetroSummary,
    ) {}

    public function schema(JsonSchema $schema): array
    {
        return [
            'board_id' => $schema->string()->description('The board id (UUID).')->required(),
        ];
    }

    protected function requiredScope(): McpScope
    {
        return McpScope::Read;
    }

    protected function run(Request $request): Response|ResponseFactory
    {
        $validated = $request->validate(['board_id' => ['required', 'uuid']]);
        $retro = $this->context->retro($validated['board_id']);
        $presented = $this->presentRetroSummary->handle($retro);
        $status = $retro->effectiveSummaryStatus();
        $isReady = $retro->phase === RetroPhase::Completed
            && $retro->ai_summary_enabled
            && $presented !== null
            && $status === SummaryStatus::Ready;

        return Response::structured([
            'board' => $this->presentBoard->handle($retro),
            'summary' => $isReady ? [
                'text' => $presented['text'],
                'generatedAt' => $presented['generatedAt'],
                'provider' => $presented['provider'],
            ] : null,
            'summaryStatus' => $status?->value,
            'participants' => $retro->participants()->with('user')->orderBy('created_at')->get()
                ->map(fn (Participant $participant) => [
                    'name' => $participant->displayName(),
                    'avatarUrl' => url($participant->avatarUrl()),
                ])
                ->values()
                ->all(),
        ]);
    }
}
```

Register both in `SkrumServer::$tools` (after `ListBoardActionItems::class`): `ListMessages::class`, `GetSummary::class`.

- [ ] **Step 6: Translations**

Append (skip keys already present):

```json
"Vote totals are not visible yet.": "Vote totals are not visible yet."
```
```json
"Vote totals are not visible yet.": "Les totaux de votes ne sont pas encore visibles."
```
```json
"Vote totals are not visible yet.": "Los totales de votos aún no son visibles."
```
```json
"Vote totals are not visible yet.": "Die Stimmensummen sind noch nicht sichtbar."
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Mcp/MessagesAndSummaryTest.php tests/Feature/Retros/BoardSnapshotTest.php tests/Feature/TranslationKeysTest.php`
Expected: PASS.

- [ ] **Step 8: Format and analyse**

Run: `vendor/bin/sail bin pint --dirty --format agent && vendor/bin/sail bin phpstan analyse --no-progress`
Expected: clean, 0 errors.

- [ ] **Step 9: Commit**

```bash
git add app/Mcp/Presenters/McpMessage.php app/Mcp/Tools/Retro/ListMessages.php app/Mcp/Tools/Retro/GetSummary.php app/Models/Retro.php app/Actions/Retros/BuildBoardSnapshot.php app/Mcp/Servers/SkrumServer.php tests/Feature/Mcp/MessagesAndSummaryTest.php lang/en.json lang/fr.json lang/es.json lang/de.json
git commit -m "feat: read board messages and summaries through MCP

Co-Authored-By: <your harness attribution>
Claude-Session: https://claude.ai/code/session_01SosW8d2Uj7QxsF1tws5ssS"
```

#### Implementer notes

- `CardComment::factory()` must exist with `retro_id`/`card_id`; if the factory needs other attributes, use the ones `tests/Feature/Retros/CardCommentsTest.php` uses.
- `configureLlm()` (tests/Pest.php) sets the provider; the "no provider" case sets `services.llm.provider` to null after it — check `App\Support\Llm\Llm::isConfigured()` reads that key, otherwise clear the key it reads.
- Pagination counts top-level messages only; grouped cards travel with their lead card.

### Task 8: Search

**Files:**
- Create: `app/Mcp/Support/LikePattern.php`, `app/Mcp/Tools/Retro/SearchBoards.php`
- Modify: `app/Enums/RetroPhase.php` (`static hidingOthersCards(): array`), `app/Mcp/Servers/SkrumServer.php`, `lang/{en,fr,es,de}.json`
- Test: create `tests/Feature/Mcp/SearchBoardsTest.php`

**Interfaces:**
- Consumes: Task 5 (`SkrumTool`, `McpGrant::current()` (`user`, `tokenId`), `VisibleTeams::ids()`, `McpContext::team()`, `McpBoard::handle()`), Task 5 (`mcpStructured()`), `RetroPhase::hidesOthersCards()`.
- Produces:
  - `RetroPhase::hidingOthersCards(): array<int, RetroPhase>` (the cases whose `hidesOthersCards()` is true — the one list both `PresentCard` and the search's SQL use).
  - `LikePattern::contains(string $term): string` (`%term%` with `\`, `%` and `_` escaped for PostgreSQL's default `\` escape) and `LikePattern::snippet(string $text, string $term, int $length = 160): string` (≤ 160 characters around the first case-insensitive match, `…` on cut ends).
  - Tool `retro.boards.search` → `{results: [{board, matches: [{kind: title|summary|action|message, id: ?string, snippet}]}]}`; boards newest first, `limit` ≤ 20; 20 searches per minute per token.

- [ ] **Step 1: Write the failing tests**

Create `tests/Feature/Mcp/SearchBoardsTest.php`:

```php
<?php

use App\Enums\RetroPhase;
use App\Enums\SummaryStatus;
use App\Mcp\McpGrant;
use App\Mcp\Support\LikePattern;
use App\Mcp\Tools\Retro\SearchBoards;
use App\Models\ActionItem;
use App\Models\Card;
use App\Models\Retro;
use App\Models\Team;
use Illuminate\Support\Facades\RateLimiter;

/**
 * @return array{0: Team, 1: \App\Models\User}
 */
function mcpSearchTeam(): array
{
    $team = Team::factory()->create();

    return [$team, teamMember($team)];
}

/**
 * @return array<int, array{board: array<string, mixed>, matches: array<int, array<string, mixed>>}>
 */
function mcpSearch(\App\Models\User $user, array $arguments): array
{
    return mcpStructured(actingAsMcp($user)->tool(SearchBoards::class, $arguments)->assertOk())['results'];
}

it('finds titles, summaries, action items and messages', function () {
    [$team, $user] = mcpSearchTeam();
    $retro = Retro::factory()->for($team)->inPhase(RetroPhase::Completed)->create([
        'title' => 'Deploy week',
        'summary' => 'The deploy pipeline slowed us down.',
        'summary_status' => SummaryStatus::Ready,
    ]);
    $card = Card::factory()->create(['retro_id' => $retro->id, 'content' => 'Deploy on Fridays hurts']);
    $item = ActionItem::factory()->create(['retro_id' => $retro->id, 'content' => 'Automate the deploy']);

    $results = mcpSearch($user, ['query' => 'DEPLOY']);
    $matches = collect($results[0]['matches']);

    expect($results)->toHaveCount(1)
        ->and($results[0]['board']['id'])->toBe($retro->id)
        ->and($matches->pluck('kind')->sort()->values()->all())->toBe(['action', 'message', 'summary', 'title'])
        ->and($matches->firstWhere('kind', 'message')['id'])->toBe($card->id)
        ->and($matches->firstWhere('kind', 'action')['id'])->toBe($item->id)
        ->and($matches->firstWhere('kind', 'title')['id'])->toBeNull();
});

it('never matches hidden cards', function () {
    [$team, $user] = mcpSearchTeam();
    $retro = Retro::factory()->for($team)->inPhase(RetroPhase::Writing)->create(['title' => 'Sprint 9']);
    $participant = \App\Models\Participant::factory()->create(['retro_id' => $retro->id, 'user_id' => $user->id]);
    Card::factory()->create(['retro_id' => $retro->id, 'content' => 'Confidential salary remark']);
    $own = Card::factory()->create(['retro_id' => $retro->id, 'participant_id' => $participant->id, 'content' => 'My salary remark']);

    $results = mcpSearch($user, ['query' => 'salary']);

    expect($results)->toHaveCount(1)
        ->and(collect($results[0]['matches'])->pluck('id')->all())->toBe([$own->id])
        ->and(json_encode($results))->not->toContain('Confidential');

    expect(mcpSearch($user, ['query' => 'Confidential']))->toBe([]);
});

it('does not match summaries of unfinished or opted-out boards', function () {
    [$team, $user] = mcpSearchTeam();
    Retro::factory()->for($team)->inPhase(RetroPhase::Discussing)->create(['summary' => 'Draft about latency']);
    Retro::factory()->for($team)->inPhase(RetroPhase::Completed)->create(['summary' => 'Old latency text', 'ai_summary_enabled' => false]);

    expect(mcpSearch($user, ['query' => 'latency']))->toBe([]);
});

it('escapes wildcards', function () {
    [$team, $user] = mcpSearchTeam();
    Retro::factory()->for($team)->create(['title' => '100% done']);
    Retro::factory()->for($team)->create(['title' => '1000 done']);
    Retro::factory()->for($team)->create(['title' => 'snake_case names']);
    Retro::factory()->for($team)->create(['title' => 'snakeXcase names']);
    Retro::factory()->for($team)->create(['title' => 'path\\to\\file']);

    expect(collect(mcpSearch($user, ['query' => '0%']))->pluck('board.title')->all())->toBe(['100% done'])
        ->and(collect(mcpSearch($user, ['query' => 'e_c']))->pluck('board.title')->all())->toBe(['snake_case names'])
        ->and(collect(mcpSearch($user, ['query' => 'h\\t']))->pluck('board.title')->all())->toBe(['path\\to\\file']);
});

it('searches only visible boards and one team when asked', function () {
    [$team, $user] = mcpSearchTeam();
    $other = Team::factory()->create(['workspace_id' => $team->workspace_id]);
    $other->members()->attach($user);
    $mine = Retro::factory()->for($team)->create(['title' => 'Budget review']);
    $siblings = Retro::factory()->for($other)->create(['title' => 'Budget planning']);
    Retro::factory()->create(['title' => 'Budget secret']);

    expect(collect(mcpSearch($user, ['query' => 'budget']))->pluck('board.id')->sort()->values()->all())
        ->toBe(collect([$mine->id, $siblings->id])->sort()->values()->all())
        ->and(collect(mcpSearch($user, ['query' => 'budget', 'team_id' => $team->id]))->pluck('board.id')->all())->toBe([$mine->id]);

    actingAsMcp($user)->tool(SearchBoards::class, ['query' => 'budget', 'team_id' => Team::factory()->create()->id])->assertHasErrors(['Not found.']);
});

it('validates the query and the limit', function (array $arguments) {
    [, $user] = mcpSearchTeam();

    actingAsMcp($user)->tool(SearchBoards::class, $arguments)->assertHasErrors();
})->with([
    'too short' => [['query' => 'a']],
    'too long' => [['query' => str_repeat('a', 101)]],
    'limit above 20' => [['query' => 'retro', 'limit' => 21]],
]);

it('limits searches per token', function () {
    [, $user] = mcpSearchTeam();
    $pending = actingAsMcp($user);
    $tokenId = app(McpGrant::class)->tokenId;

    foreach (range(1, 20) as $attempt) {
        RateLimiter::hit("mcp-search:{$tokenId}");
    }

    $pending->tool(SearchBoards::class, ['query' => 'retro'])->assertHasErrors(['Too many searches, wait a moment.']);
});

it('builds snippets around the match', function () {
    $text = str_repeat('lorem ', 60).'the needle sits here '.str_repeat('ipsum ', 60);
    $snippet = LikePattern::snippet($text, 'NEEDLE');

    expect(mb_strlen($snippet))->toBeLessThanOrEqual(160)
        ->and($snippet)->toContain('needle')
        ->and($snippet)->toStartWith('…')
        ->and($snippet)->toEndWith('…')
        ->and(LikePattern::snippet('short text', 'text'))->toBe('short text');
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Mcp/SearchBoardsTest.php`
Expected: FAIL — `Class "App\Mcp\Support\LikePattern" not found`.

- [ ] **Step 3: One list of hiding phases**

In `app/Enums/RetroPhase.php` replace `hidesOthersCards()` with:

```php
    /**
     * @return array<int, self>
     */
    public static function hidingOthersCards(): array
    {
        return [self::HealthCheck, self::Icebreaker, self::Writing];
    }

    public function hidesOthersCards(): bool
    {
        return in_array($this, self::hidingOthersCards(), true);
    }
```

- [ ] **Step 4: Pattern and snippet helper**

Create `app/Mcp/Support/LikePattern.php`:

```php
<?php

namespace App\Mcp\Support;

class LikePattern
{
    public static function contains(string $term): string
    {
        return '%'.str_replace(['\\', '%', '_'], ['\\\\', '\\%', '\\_'], $term).'%';
    }

    public static function snippet(string $text, string $term, int $length = 160): string
    {
        $text = trim((string) preg_replace('/\s+/u', ' ', $text));

        if (mb_strlen($text) <= $length) {
            return $text;
        }

        $position = mb_stripos($text, $term);
        $position = $position === false ? 0 : $position;
        $room = $length - 2;
        $start = max(0, min($position - intdiv($room - mb_strlen($term), 2), mb_strlen($text) - $room));
        $snippet = mb_substr($text, $start, $room);

        return ($start > 0 ? '…' : '').$snippet.($start + $room < mb_strlen($text) ? '…' : '');
    }
}
```

- [ ] **Step 5: Tool**

Create `app/Mcp/Tools/Retro/SearchBoards.php`:

```php
<?php

namespace App\Mcp\Tools\Retro;

use App\Enums\McpScope;
use App\Enums\RetroPhase;
use App\Mcp\McpContext;
use App\Mcp\McpGrant;
use App\Mcp\Presenters\McpBoard;
use App\Mcp\Support\LikePattern;
use App\Mcp\Tools\SkrumTool;
use App\Mcp\VisibleTeams;
use App\Models\ActionItem;
use App\Models\Card;
use App\Models\Participant;
use App\Models\Retro;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\RateLimiter;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\ResponseFactory;
use Laravel\Mcp\Server\Tools\Annotations\IsOpenWorld;
use Laravel\Mcp\Server\Tools\Annotations\IsReadOnly;

#[IsReadOnly]
#[IsOpenWorld(false)]
class SearchBoards extends SkrumTool
{
    private const MaxLimit = 20;

    private const PerMinute = 20;

    private const MatchesPerKind = 5;

    protected string $name = 'retro.boards.search';

    protected string $description = 'Search your teams\' boards by keyword (case-insensitive) across board titles, summaries, action items and messages. Messages that are still hidden on the board are never searched. Returns each matching board with short snippets.';

    public function __construct(
        private McpContext $context,
        private VisibleTeams $visibleTeams,
        private McpBoard $presentBoard,
    ) {}

    public function schema(JsonSchema $schema): array
    {
        return [
            'query' => $schema->string()->min(2)->max(100)->description('Keywords to look for.')->required(),
            'team_id' => $schema->string()->description('Only this team (UUID).'),
            'limit' => $schema->integer()->min(1)->max(self::MaxLimit)->default(self::MaxLimit),
        ];
    }

    protected function requiredScope(): McpScope
    {
        return McpScope::Read;
    }

    protected function run(Request $request): Response|ResponseFactory
    {
        $validated = $request->validate([
            'query' => ['required', 'string', 'min:2', 'max:100'],
            'team_id' => ['nullable', 'uuid'],
            'limit' => ['nullable', 'integer', 'min:1', 'max:'.self::MaxLimit],
        ]);

        $grant = McpGrant::current();
        $key = "mcp-search:{$grant->tokenId}";

        if (RateLimiter::tooManyAttempts($key, self::PerMinute)) {
            abort(429, __('Too many searches, wait a moment.'));
        }

        RateLimiter::hit($key);

        $teamIds = isset($validated['team_id'])
            ? [$this->context->team($validated['team_id'])->id]
            : $this->visibleTeams->ids($grant);
        $term = $validated['query'];
        $pattern = LikePattern::contains($term);
        $retroIds = Retro::query()->whereIn('team_id', $teamIds)->select('id');

        $matches = collect()
            ->concat($this->titles($retroIds, $pattern, $term))
            ->concat($this->summaries($retroIds, $pattern, $term))
            ->concat($this->actions($retroIds, $pattern, $term))
            ->concat($this->messages($retroIds, $pattern, $term, $grant))
            ->groupBy('retroId');

        $retros = Retro::query()
            ->whereIn('id', $matches->keys())
            ->latest()
            ->orderByDesc('id')
            ->limit((int) ($validated['limit'] ?? self::MaxLimit))
            ->get();

        return Response::structured([
            'results' => $retros->map(fn (Retro $retro) => [
                'board' => $this->presentBoard->handle($retro),
                'matches' => $matches->get($retro->id, collect())
                    ->map(fn (array $match) => ['kind' => $match['kind'], 'id' => $match['id'], 'snippet' => $match['snippet']])
                    ->values()
                    ->all(),
            ])->values()->all(),
        ]);
    }

    /**
     * @param  Builder<Retro>  $retroIds
     * @return Collection<int, array{retroId: string, kind: string, id: ?string, snippet: string}>
     */
    private function titles(Builder $retroIds, string $pattern, string $term): Collection
    {
        return Retro::query()
            ->whereIn('id', $retroIds)
            ->where('title', 'ilike', $pattern)
            ->get(['id', 'title'])
            ->map(fn (Retro $retro) => ['retroId' => $retro->id, 'kind' => 'title', 'id' => null, 'snippet' => LikePattern::snippet($retro->title, $term)]);
    }

    /**
     * Summaries are shown only on finished boards that kept them.
     *
     * @param  Builder<Retro>  $retroIds
     * @return Collection<int, array{retroId: string, kind: string, id: ?string, snippet: string}>
     */
    private function summaries(Builder $retroIds, string $pattern, string $term): Collection
    {
        return Retro::query()
            ->whereIn('id', $retroIds)
            ->where('phase', RetroPhase::Completed)
            ->where('ai_summary_enabled', true)
            ->where('summary', 'ilike', $pattern)
            ->get(['id', 'summary'])
            ->map(fn (Retro $retro) => ['retroId' => $retro->id, 'kind' => 'summary', 'id' => null, 'snippet' => LikePattern::snippet((string) $retro->summary, $term)]);
    }

    /**
     * @param  Builder<Retro>  $retroIds
     * @return Collection<int, array{retroId: string, kind: string, id: ?string, snippet: string}>
     */
    private function actions(Builder $retroIds, string $pattern, string $term): Collection
    {
        return ActionItem::query()
            ->whereIn('retro_id', $retroIds)
            ->where('content', 'ilike', $pattern)
            ->orderBy('created_at')
            ->get(['id', 'retro_id', 'content'])
            ->groupBy('retro_id')
            ->flatMap(fn (Collection $items) => $items->take(self::MatchesPerKind))
            ->map(fn (ActionItem $item) => ['retroId' => (string) $item->retro_id, 'kind' => 'action', 'id' => $item->id, 'snippet' => LikePattern::snippet($item->content, $term)]);
    }

    /**
     * Cards others are still writing are excluded in SQL, exactly the ones
     * the board hides (PresentCard), so hidden text can never match.
     *
     * @param  Builder<Retro>  $retroIds
     * @return Collection<int, array{retroId: string, kind: string, id: ?string, snippet: string}>
     */
    private function messages(Builder $retroIds, string $pattern, string $term, McpGrant $grant): Collection
    {
        $ownParticipantIds = Participant::query()->where('user_id', $grant->user->id)->select('id');
        $hidingRetroIds = Retro::query()->whereIn('phase', RetroPhase::hidingOthersCards())->select('id');

        return Card::query()
            ->whereIn('retro_id', $retroIds)
            ->where('content', 'ilike', $pattern)
            ->where(fn (Builder $query) => $query
                ->whereNotIn('retro_id', $hidingRetroIds)
                ->orWhereIn('participant_id', $ownParticipantIds))
            ->orderBy('position')
            ->get(['id', 'retro_id', 'content'])
            ->groupBy('retro_id')
            ->flatMap(fn (Collection $cards) => $cards->take(self::MatchesPerKind))
            ->map(fn (Card $card) => ['retroId' => $card->retro_id, 'kind' => 'message', 'id' => $card->id, 'snippet' => LikePattern::snippet((string) $card->content, $term)]);
    }
}
```

Register in `SkrumServer::$tools` after `GetSummary::class`: `SearchBoards::class`.

- [ ] **Step 6: Translations**

Append (skip keys already present):

```json
"Too many searches, wait a moment.": "Too many searches, wait a moment."
```
```json
"Too many searches, wait a moment.": "Trop de recherches, patientez un instant."
```
```json
"Too many searches, wait a moment.": "Demasiadas búsquedas, espera un momento."
```
```json
"Too many searches, wait a moment.": "Zu viele Suchen, warte einen Moment."
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Mcp/SearchBoardsTest.php tests/Feature/Retros/CardsTest.php tests/Feature/TranslationKeysTest.php`
Expected: PASS.

- [ ] **Step 8: Format and analyse**

Run: `vendor/bin/sail bin pint --dirty --format agent && vendor/bin/sail bin phpstan analyse --no-progress`
Expected: clean, 0 errors.

- [ ] **Step 9: Commit**

```bash
git add app/Mcp/Support/LikePattern.php app/Mcp/Tools/Retro/SearchBoards.php app/Enums/RetroPhase.php app/Mcp/Servers/SkrumServer.php tests/Feature/Mcp/SearchBoardsTest.php lang/en.json lang/fr.json lang/es.json lang/de.json
git commit -m "feat: search boards through MCP without matching hidden cards

Co-Authored-By: <your harness attribution>
Claude-Session: https://claude.ai/code/session_01SosW8d2Uj7QxsF1tws5ssS"
```

#### Implementer notes

- PostgreSQL's `ILIKE` uses `\` as its default escape character, so no `ESCAPE` clause is needed; the tests run on PostgreSQL only.
- Up to five action-item and five message matches are returned per board to keep results small; the spec does not fix a number.

### Task 9: Insights, health and ROTI

**Files:**
- Create: `app/Actions/Retros/SummarizeRoti.php` (extracted from `BuildResults::roti()`), `app/Mcp/Tools/Retro/ListInsights.php`, `app/Mcp/Tools/Retro/GetHealth.php`, `app/Mcp/Tools/Retro/GetRoti.php`
- Modify: `app/Actions/Retros/BuildResults.php` (uses `SummarizeRoti`, private `roti()` removed — no behaviour change), `app/Mcp/Servers/SkrumServer.php`
- Test: create `tests/Feature/Mcp/InsightsHealthRotiTest.php`

**Interfaces:**
- Consumes: Task 5 (`mcpToolNames()`, `SkrumTool` incl. `requiredFeature(): ?McpFeature`, `McpFeature::Insights`, `McpContext::retro()`, `McpContext::participant()`, `mcpStructured()`), existing `BuildInsights::handle(Retro): ?array` (themes with `cardIds`, suggestions via `PresentSuggestedAction`), `PresentHealthProgress::handle(Retro)` (`answeredBy` = participant ids, `[]` on anonymous retros), `PresentHealthStatement::handle(RetroHealthStatement)` (`key`, `label`, …), `SummarizeHealthCheck::handle(Retro): ?array`, `BuildHealthTrend::handle(Retro): array`, `Retro::effectiveSummaryStatus()`.
- Produces:
  - `SummarizeRoti::handle(Retro $retro): array{distribution: array<int, array{score: int, count: int}>, average: ?float, respondents: int}` (the exact former `BuildResults::roti()` output).
  - Tools `retro.board.insights.list` (feature `Insights`), `retro.board.health.get`, `retro.board.roti.get` with the result shapes of spec §6.1.

- [ ] **Step 1: Write the failing tests**

Create `tests/Feature/Mcp/InsightsHealthRotiTest.php`:

```php
<?php

use App\Actions\HealthCheck\FreezeHealthStatements;
use App\Enums\CardSentiment;
use App\Enums\HealthStatement;
use App\Enums\McpScope;
use App\Enums\RetroPhase;
use App\Enums\SummaryStatus;
use App\Mcp\Tools\Retro\GetHealth;
use App\Mcp\Tools\Retro\GetRoti;
use App\Mcp\Tools\Retro\ListInsights;
use App\Models\Card;
use App\Models\HealthCheckAnswer;
use App\Models\Participant;
use App\Models\Retro;
use App\Models\RetroTheme;
use App\Models\RotiVote;
use App\Models\SuggestedAction;
use App\Models\Team;
use App\Models\User;

it('offers insights only with an AI provider', function () {
    $user = teamMember(Team::factory()->create());

    expect(mcpToolNames(actingAsMcp($user)))->not->toContain('retro.board.insights.list');

    configureLlm();

    expect(mcpToolNames(actingAsMcp($user)))->toContain('retro.board.insights.list');
});

it('reports insights as not available before discussing', function () {
    configureLlm();
    $retro = Retro::factory()->inPhase(RetroPhase::Voting)->create();
    [$user] = retroMember($retro);

    expect(mcpStructured(actingAsMcp($user)->tool(ListInsights::class, ['board_id' => $retro->id])->assertOk()))
        ->toBe(['status' => 'not_available', 'themes' => [], 'suggestedActions' => []]);
});

it('lists themes with sentiment counts and suggestions with their theme', function () {
    configureLlm();
    $retro = Retro::factory()->inPhase(RetroPhase::Completed)->create([
        'summary_status' => SummaryStatus::Ready,
        'summary_generated_at' => now(),
    ]);
    [$user] = retroMember($retro);
    $theme = RetroTheme::factory()->create(['retro_id' => $retro->id, 'name' => 'Deploys']);
    $positive = Card::factory()->create(['retro_id' => $retro->id]);
    $negative = Card::factory()->create(['retro_id' => $retro->id]);
    $positive->forceFill(['sentiment' => CardSentiment::Positive])->save();
    $negative->forceFill(['sentiment' => CardSentiment::Negative])->save();
    $theme->cards()->attach([$positive->id, $negative->id]);
    $suggestion = SuggestedAction::factory()->create(['retro_id' => $retro->id, 'theme_id' => $theme->id, 'content' => 'Automate']);

    $result = mcpStructured(actingAsMcp($user)->tool(ListInsights::class, ['board_id' => $retro->id]));

    expect($result['status'])->toBe('ready')
        ->and($result['generatedAt'])->not->toBeNull()
        ->and($result['themes'][0])->toMatchArray([
            'id' => $theme->id,
            'name' => 'Deploys',
            'messageCount' => 2,
            'sentiment' => ['positive' => 1, 'neutral' => 0, 'negative' => 1],
        ])
        ->and($result['suggestedActions'][0])->toMatchArray([
            'id' => $suggestion->id,
            'content' => 'Automate',
            'themeId' => $theme->id,
            'themeName' => 'Deploys',
            'status' => 'pending',
            'actionItemId' => null,
        ]);
});

it('reports never-requested insights as not available with empty lists', function () {
    configureLlm();
    $retro = Retro::factory()->inPhase(RetroPhase::Discussing)->create();
    [$user] = retroMember($retro);

    expect(mcpStructured(actingAsMcp($user)->tool(ListInsights::class, ['board_id' => $retro->id])))
        ->toMatchArray(['status' => 'not_available', 'generatedAt' => null, 'themes' => [], 'suggestedActions' => []]);
});

/**
 * @return array{0: Retro, 1: User, 2: Participant}
 */
function mcpHealthBoard(RetroPhase $phase, bool $anonymous = false): array
{
    $retro = Retro::factory()->withHealthCheck()->inPhase($phase)->create(['is_anonymous' => $anonymous]);
    app(FreezeHealthStatements::class)->handle($retro);
    [$user, $participant] = retroMember($retro);

    return [$retro, $user, $participant];
}

it('reports a health check that never ran', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Completed)->create();
    [$user] = retroMember($retro);

    expect(mcpStructured(actingAsMcp($user)->tool(GetHealth::class, ['board_id' => $retro->id])->assertOk()))->toBe(['status' => 'not_run']);
});

it('shows progress and only the viewer own scores while collecting', function () {
    [$retro, $user, $participant] = mcpHealthBoard(RetroPhase::HealthCheck);
    $other = Participant::factory()->create(['retro_id' => $retro->id]);
    HealthCheckAnswer::factory()->create(['retro_id' => $retro->id, 'participant_id' => $participant->id, 'statement' => HealthStatement::Interaction->value, 'score' => 7]);
    HealthCheckAnswer::factory()->create(['retro_id' => $retro->id, 'participant_id' => $other->id, 'statement' => HealthStatement::Interaction->value, 'score' => 2]);

    $result = mcpStructured(actingAsMcp($user)->tool(GetHealth::class, ['board_id' => $retro->id]));
    $interaction = collect($result['categories'])->firstWhere('key', HealthStatement::Interaction->value);

    expect($result['status'])->toBe('in_progress')
        ->and($interaction['answers'])->toBe(2)
        ->and($interaction['answeredBy'])->toEqualCanonicalizing([$user->name, $other->displayName()])
        ->and($interaction)->not->toHaveKey('average')
        ->and($result['myScores'])->toBe([HealthStatement::Interaction->value => 7]);

    expect(json_encode($result))->not->toContain('"score":2');
});

it('names no one who answered on anonymous boards', function () {
    [$retro, $user, $participant] = mcpHealthBoard(RetroPhase::HealthCheck, anonymous: true);
    HealthCheckAnswer::factory()->create(['retro_id' => $retro->id, 'participant_id' => $participant->id]);

    $categories = mcpStructured(actingAsMcp($user)->tool(GetHealth::class, ['board_id' => $retro->id]))['categories'];

    expect(collect($categories)->pluck('answeredBy')->flatten()->all())->toBe([]);
});

it('shows only respondents between the health check and completion', function () {
    [$retro, $user, $participant] = mcpHealthBoard(RetroPhase::Voting);
    HealthCheckAnswer::factory()->create(['retro_id' => $retro->id, 'participant_id' => $participant->id]);

    expect(mcpStructured(actingAsMcp($user)->tool(GetHealth::class, ['board_id' => $retro->id])))->toBe(['status' => 'collected', 'respondents' => 1]);
});

it('reports averages, alignment and trend once completed, even with one answer', function () {
    [$retro, $user, $participant] = mcpHealthBoard(RetroPhase::Completed);
    $retro->update(['completed_at' => now()]);
    HealthCheckAnswer::factory()->create(['retro_id' => $retro->id, 'participant_id' => $participant->id, 'statement' => HealthStatement::Vision->value, 'score' => 8]);

    $result = mcpStructured(actingAsMcp($user)->tool(GetHealth::class, ['board_id' => $retro->id]));
    $vision = collect($result['categories'])->firstWhere('key', HealthStatement::Vision->value);

    expect($result['status'])->toBe('completed')
        ->and($vision['average'])->toBe(8.0)
        ->and($vision['answers'])->toBe(1)
        ->and($result)->toHaveKeys(['score', 'alignment', 'alignmentLevel', 'turnout', 'topStrength', 'growthArea', 'assessment', 'trend'])
        ->and($result['turnout'])->toBe(['respondents' => 1, 'participants' => 1])
        ->and($result['trend'][0])->toMatchArray(['boardId' => $retro->id, 'sameStatements' => true])
        ->and($result['trend'][0])->toHaveKeys(['title', 'completedAt', 'score', 'delta', 'url']);
});

it('keeps ROTI ratings hidden until completion', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Voting)->create();
    [$user, $participant] = retroMember($retro);

    expect(mcpStructured(actingAsMcp($user)->tool(GetRoti::class, ['board_id' => $retro->id])->assertOk()))->toBe(['status' => 'not_started']);

    $retro->update(['phase' => RetroPhase::Discussing]);
    RotiVote::factory()->create(['retro_id' => $retro->id, 'participant_id' => $participant->id, 'score' => 4]);
    RotiVote::factory()->create(['retro_id' => $retro->id, 'score' => 1]);

    expect(mcpStructured(actingAsMcp($user)->tool(GetRoti::class, ['board_id' => $retro->id])))
        ->toBe(['status' => 'collecting', 'respondents' => 2, 'myScore' => 4]);
});

it('reports the ROTI distribution and the team trend once completed', function () {
    $team = Team::factory()->create();
    $user = teamMember($team);
    $older = Retro::factory()->for($team)->inPhase(RetroPhase::Completed)->create(['completed_at' => now()->subWeek()]);
    RotiVote::factory()->create(['retro_id' => $older->id, 'score' => 2]);
    Retro::factory()->for($team)->inPhase(RetroPhase::Completed)->create(['completed_at' => now()->subDays(3)]);
    $retro = Retro::factory()->for($team)->inPhase(RetroPhase::Completed)->create(['completed_at' => now()]);
    RotiVote::factory()->create(['retro_id' => $retro->id, 'score' => 5]);

    $result = mcpStructured(actingAsMcp($user)->tool(GetRoti::class, ['board_id' => $retro->id]));

    expect($result['status'])->toBe('completed')
        ->and($result['average'])->toBe(5.0)
        ->and($result['respondents'])->toBe(1)
        ->and($result['myScore'])->toBeNull()
        ->and($result['distribution'])->toHaveCount(5)
        ->and(collect($result['trend'])->pluck('boardId')->all())->toBe([$older->id, $retro->id])
        ->and($result['trend'][0])->toMatchArray(['average' => 2.0, 'respondents' => 1]);
});

it('hides insights, health and ROTI of invisible boards', function (string $tool) {
    configureLlm();
    $retro = Retro::factory()->inPhase(RetroPhase::Completed)->create();

    actingAsMcp(teamMember(Team::factory()->create()), [McpScope::Read])->tool($tool, ['board_id' => $retro->id])->assertHasErrors(['Not found.']);
})->with([ListInsights::class, GetHealth::class, GetRoti::class]);
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Mcp/InsightsHealthRotiTest.php`
Expected: FAIL — `Class "App\Mcp\Tools\Retro\ListInsights" not found`.

- [ ] **Step 3: Extract `SummarizeRoti`**

Create `app/Actions/Retros/SummarizeRoti.php` with the body of `BuildResults::roti()`:

```php
<?php

namespace App\Actions\Retros;

use App\Models\Retro;

class SummarizeRoti
{
    /**
     * @return array{
     *     distribution: array<int, array{score: int, count: int}>,
     *     average: ?float,
     *     respondents: int
     * }
     */
    public function handle(Retro $retro): array
    {
        $totals = $retro->rotiVotes()
            ->selectRaw('score, count(*) as total')
            ->groupBy('score')
            ->pluck('total', 'score')
            ->mapWithKeys(fn (mixed $total, int|string $score) => [(int) $score => (int) $total]);

        $respondents = (int) $totals->sum();
        $weighted = $totals->map(fn (int $total, int $score) => $score * $total)->sum();

        return [
            'distribution' => collect(range(1, 5))
                ->map(fn (int $score) => ['score' => $score, 'count' => $totals->get($score, 0)])
                ->all(),
            'average' => $respondents === 0 ? null : round($weighted / $respondents, 1),
            'respondents' => $respondents,
        ];
    }
}
```

In `app/Actions/Retros/BuildResults.php`: add `private SummarizeRoti $summarizeRoti,` to the constructor, replace `'roti' => $this->roti($retro),` with `'roti' => $this->summarizeRoti->handle($retro),`, and delete the private `roti()` method with its docblock. Run `vendor/bin/sail artisan test --compact tests/Feature/Retros/ResultsTest.php tests/Feature/Retros/RotiTest.php` — still green.

- [ ] **Step 4: Tools**

Create `app/Mcp/Tools/Retro/ListInsights.php`:

```php
<?php

namespace App\Mcp\Tools\Retro;

use App\Actions\Retros\BuildInsights;
use App\Enums\McpScope;
use App\Enums\RetroPhase;
use App\Mcp\McpContext;
use App\Mcp\McpFeature;
use App\Mcp\Tools\SkrumTool;
use App\Models\Card;
use App\Models\Retro;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\ResponseFactory;
use Laravel\Mcp\Server\Tools\Annotations\IsOpenWorld;
use Laravel\Mcp\Server\Tools\Annotations\IsReadOnly;

#[IsReadOnly]
#[IsOpenWorld(false)]
class ListInsights extends SkrumTool
{
    protected string $name = 'retro.board.insights.list';

    protected string $description = 'List the insights generated for a board once the team discusses it: themes (groups of related messages with their sentiment) and suggested follow-up actions with their status (pending, promoted or rejected). Empty when nothing was generated.';

    public function __construct(
        private McpContext $context,
        private BuildInsights $buildInsights,
    ) {}

    public function schema(JsonSchema $schema): array
    {
        return [
            'board_id' => $schema->string()->description('The board id (UUID).')->required(),
        ];
    }

    protected function requiredScope(): McpScope
    {
        return McpScope::Read;
    }

    protected function requiredFeature(): ?McpFeature
    {
        return McpFeature::Insights;
    }

    protected function run(Request $request): Response|ResponseFactory
    {
        $validated = $request->validate(['board_id' => ['required', 'uuid']]);
        $retro = $this->context->retro($validated['board_id']);
        $insights = $this->buildInsights->handle($retro);

        if ($insights === null || ! in_array($retro->phase, [RetroPhase::Discussing, RetroPhase::Completed], true)) {
            return Response::structured(['status' => 'not_available', 'themes' => [], 'suggestedActions' => []]);
        }

        $themeNames = collect($insights['themes'])->pluck('name', 'id');
        $sentiments = $this->sentiments($retro, collect($insights['themes'])->pluck('cardIds')->flatten()->all());

        return Response::structured([
            'status' => $retro->effectiveSummaryStatus()?->value ?? 'not_available',
            'generatedAt' => $retro->summary_generated_at?->toIso8601String(),
            'themes' => collect($insights['themes'])->map(fn (array $theme) => [
                'id' => $theme['id'],
                'name' => $theme['name'],
                'messageCount' => count($theme['cardIds']),
                'messageIds' => $theme['cardIds'],
                'sentiment' => [
                    'positive' => collect($theme['cardIds'])->filter(fn (string $id) => $sentiments->get($id) === 'positive')->count(),
                    'neutral' => collect($theme['cardIds'])->filter(fn (string $id) => $sentiments->get($id) === 'neutral')->count(),
                    'negative' => collect($theme['cardIds'])->filter(fn (string $id) => $sentiments->get($id) === 'negative')->count(),
                ],
            ])->values()->all(),
            'suggestedActions' => collect($insights['suggestedActions'])->map(fn (array $suggestion) => [
                ...$suggestion,
                'themeName' => $suggestion['themeId'] === null ? null : $themeNames->get($suggestion['themeId']),
            ])->values()->all(),
        ]);
    }

    /**
     * @param  array<int, string>  $cardIds
     * @return \Illuminate\Support\Collection<string, ?string>
     */
    private function sentiments(Retro $retro, array $cardIds): \Illuminate\Support\Collection
    {
        return Card::query()
            ->where('retro_id', $retro->id)
            ->whereIn('id', $cardIds)
            ->get(['id', 'sentiment'])
            ->mapWithKeys(fn (Card $card) => [$card->id => $card->sentiment?->value]);
    }
}
```

Replace the fully-qualified `\Illuminate\Support\Collection` with an import before running pint. The order of the keys in `suggestedActions` is `id, content, themeId, status, actionItemId, themeName` (spread first); the test uses `toMatchArray`, so order does not matter.

Create `app/Mcp/Tools/Retro/GetHealth.php`:

```php
<?php

namespace App\Mcp\Tools\Retro;

use App\Actions\HealthCheck\BuildHealthTrend;
use App\Actions\HealthCheck\PresentHealthProgress;
use App\Actions\HealthCheck\PresentHealthStatement;
use App\Actions\HealthCheck\SummarizeHealthCheck;
use App\Enums\McpScope;
use App\Enums\RetroPhase;
use App\Mcp\McpContext;
use App\Mcp\Tools\SkrumTool;
use App\Models\Participant;
use App\Models\Retro;
use App\Models\RetroHealthStatement;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\ResponseFactory;
use Laravel\Mcp\Server\Tools\Annotations\IsOpenWorld;
use Laravel\Mcp\Server\Tools\Annotations\IsReadOnly;

#[IsReadOnly]
#[IsOpenWorld(false)]
class GetHealth extends SkrumTool
{
    protected string $name = 'retro.board.health.get';

    protected string $description = 'Get the team health check of a board: while collecting, who answered and your own scores; once the board is finished, the average per category (0–10), the overall score, alignment, strongest and weakest categories and the trend over the team\'s last boards. Individual scores of others are never returned.';

    public function __construct(
        private McpContext $context,
        private PresentHealthProgress $presentHealthProgress,
        private PresentHealthStatement $presentHealthStatement,
        private SummarizeHealthCheck $summarizeHealthCheck,
        private BuildHealthTrend $buildHealthTrend,
    ) {}

    public function schema(JsonSchema $schema): array
    {
        return [
            'board_id' => $schema->string()->description('The board id (UUID).')->required(),
        ];
    }

    protected function requiredScope(): McpScope
    {
        return McpScope::Read;
    }

    protected function run(Request $request): Response|ResponseFactory
    {
        $validated = $request->validate(['board_id' => ['required', 'uuid']]);
        $retro = $this->context->retro($validated['board_id']);
        $hasAnswers = $retro->healthCheckAnswers()->exists();

        if ($retro->phase === RetroPhase::HealthCheck) {
            return Response::structured($this->inProgress($retro));
        }

        if (! $hasAnswers) {
            return Response::structured(['status' => 'not_run']);
        }

        if ($retro->phase !== RetroPhase::Completed) {
            return Response::structured([
                'status' => 'collected',
                'respondents' => $retro->healthCheckAnswers()->distinct()->count('participant_id'),
            ]);
        }

        $summary = $this->summarizeHealthCheck->handle($retro);

        if ($summary === null) {
            return Response::structured(['status' => 'not_run']);
        }

        return Response::structured([
            'status' => 'completed',
            'categories' => collect($summary['statements'])->map(fn (array $statement) => [
                'key' => $statement['key'],
                'label' => $statement['label'],
                'average' => $statement['average'],
                'answers' => $statement['count'],
                'alignment' => $statement['consensus'],
            ])->values()->all(),
            'score' => $summary['score'],
            'alignment' => $summary['alignment']['value'],
            'alignmentLevel' => $summary['alignment']['level'],
            'turnout' => $summary['participation'],
            'topStrength' => $summary['topStrength'],
            'growthArea' => $summary['growthArea'],
            'assessment' => $summary['assessment'],
            'trend' => collect($this->buildHealthTrend->handle($retro))->map(fn (array $point) => [
                'boardId' => $point['retroId'],
                'title' => $point['title'],
                'completedAt' => $point['completedAt'],
                'score' => $point['score'],
                'delta' => $point['delta'],
                'sameStatements' => $point['sameStatements'],
                'url' => $point['url'],
            ])->values()->all(),
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    private function inProgress(Retro $retro): array
    {
        $names = $retro->participants()->with('user')->get()->mapWithKeys(fn (Participant $participant) => [$participant->id => $participant->displayName()]);
        $progress = collect($this->presentHealthProgress->handle($retro))->keyBy('key');
        $viewer = $this->context->participant($retro);
        $myScores = $viewer === null
            ? collect()
            : $retro->healthCheckAnswers()->where('participant_id', $viewer->id)->pluck('score', 'statement');

        return [
            'status' => 'in_progress',
            'categories' => $retro->healthStatements()->get()->map(function (RetroHealthStatement $statement) use ($progress, $names) {
                $presented = $this->presentHealthStatement->handle($statement);

                return [
                    'key' => $presented['key'],
                    'label' => $presented['label'],
                    'answers' => $progress[$statement->key]['count'] ?? 0,
                    'answeredBy' => collect($progress[$statement->key]['answeredBy'] ?? [])
                        ->map(fn (string $participantId) => $names->get($participantId, __('Former member')))
                        ->values()
                        ->all(),
                ];
            })->values()->all(),
            'myScores' => $myScores->map(fn (mixed $score) => (int) $score)->all(),
        ];
    }
}
```

Create `app/Mcp/Tools/Retro/GetRoti.php`:

```php
<?php

namespace App\Mcp\Tools\Retro;

use App\Actions\Retros\SummarizeRoti;
use App\Enums\McpScope;
use App\Enums\RetroPhase;
use App\Mcp\McpContext;
use App\Mcp\Tools\SkrumTool;
use App\Models\Retro;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\ResponseFactory;
use Laravel\Mcp\Server\Tools\Annotations\IsOpenWorld;
use Laravel\Mcp\Server\Tools\Annotations\IsReadOnly;

#[IsReadOnly]
#[IsOpenWorld(false)]
class GetRoti extends SkrumTool
{
    private const TrendPoints = 6;

    protected string $name = 'retro.board.roti.get';

    protected string $description = 'Get the ROTI (return on time invested, 1 to 5) of a board: while collecting, how many rated and your own rating; once finished, the average, the distribution and the trend over the team\'s last finished boards. Other people\'s ratings are never returned.';

    public function __construct(
        private McpContext $context,
        private SummarizeRoti $summarizeRoti,
    ) {}

    public function schema(JsonSchema $schema): array
    {
        return [
            'board_id' => $schema->string()->description('The board id (UUID).')->required(),
        ];
    }

    protected function requiredScope(): McpScope
    {
        return McpScope::Read;
    }

    protected function run(Request $request): Response|ResponseFactory
    {
        $validated = $request->validate(['board_id' => ['required', 'uuid']]);
        $retro = $this->context->retro($validated['board_id']);

        if (! in_array($retro->phase, [RetroPhase::Discussing, RetroPhase::Completed], true)) {
            return Response::structured(['status' => 'not_started']);
        }

        $viewer = $this->context->participant($retro);
        $myScore = $viewer === null ? null : $retro->rotiVotes()->where('participant_id', $viewer->id)->value('score');
        $myScore = $myScore === null ? null : (int) $myScore;

        if ($retro->phase === RetroPhase::Discussing) {
            return Response::structured([
                'status' => 'collecting',
                'respondents' => $retro->rotiVotes()->count(),
                'myScore' => $myScore,
            ]);
        }

        $roti = $this->summarizeRoti->handle($retro);

        return Response::structured([
            'status' => 'completed',
            'average' => $roti['average'],
            'distribution' => $roti['distribution'],
            'respondents' => $roti['respondents'],
            'myScore' => $myScore,
            'trend' => $this->trend($retro),
        ]);
    }

    /**
     * @return array<int, array{boardId: string, title: string, completedAt: ?string, average: ?float, respondents: int, url: string}>
     */
    private function trend(Retro $retro): array
    {
        return Retro::query()
            ->where('team_id', $retro->team_id)
            ->where('phase', RetroPhase::Completed)
            ->whereNotNull('completed_at')
            ->when($retro->completed_at, fn ($query, $completedAt) => $query->where('completed_at', '<=', $completedAt))
            ->whereHas('rotiVotes')
            ->withCount('rotiVotes')
            ->withAvg('rotiVotes', 'score')
            ->orderByDesc('completed_at')
            ->limit(self::TrendPoints)
            ->get()
            ->reverse()
            ->map(fn (Retro $point) => [
                'boardId' => $point->id,
                'title' => $point->title,
                'completedAt' => $point->completed_at?->toIso8601String(),
                'average' => $point->roti_votes_avg_score === null ? null : round((float) $point->roti_votes_avg_score, 1),
                'respondents' => (int) $point->roti_votes_count,
                'url' => route('retros.show', $point),
            ])
            ->values()
            ->all();
    }
}
```

Register the three tools in `SkrumServer::$tools` after `SearchBoards::class`: `ListInsights::class`, `GetHealth::class`, `GetRoti::class`.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Mcp/InsightsHealthRotiTest.php tests/Feature/Retros/ResultsTest.php tests/Feature/Retros/RotiTest.php`
Expected: PASS.

- [ ] **Step 6: Format and analyse**

Run: `vendor/bin/sail bin pint --dirty --format agent && vendor/bin/sail bin phpstan analyse --no-progress`
Expected: clean, 0 errors. If phpstan flags `roti_votes_avg_score` / `roti_votes_count`, add `@property-read` lines for them on `Retro` (`float|string|null $roti_votes_avg_score`, `int|null $roti_votes_count`).

- [ ] **Step 7: Commit**

```bash
git add app/Actions/Retros/SummarizeRoti.php app/Actions/Retros/BuildResults.php app/Mcp/Tools/Retro/ListInsights.php app/Mcp/Tools/Retro/GetHealth.php app/Mcp/Tools/Retro/GetRoti.php app/Mcp/Servers/SkrumServer.php tests/Feature/Mcp/InsightsHealthRotiTest.php
git commit -m "feat: read insights, health checks and ROTI through MCP

Co-Authored-By: <your harness attribution>
Claude-Session: https://claude.ai/code/session_01SosW8d2Uj7QxsF1tws5ssS"
```

#### Implementer notes

- Per-category `alignment` is `SummarizeHealthCheck`'s per-statement `consensus` (the value the Results view shows as alignment); board-level `alignment`/`alignmentLevel` come from its `alignment.value` / `alignment.level`.
- `in_progress` is returned during the `HealthCheck` phase even with no answer yet; spec §6.1's "no answers → not_run" applies to every other phase.
- `RetroTheme::factory()` / `SuggestedAction::factory()` exist (spec 2). If `RetroTheme::cards()` needs pivot columns other than the two ids, use what `tests/Feature/Retros/ResultsTest.php` or the insights tests do.
- `configureLlm()` must make `McpFeature::Insights` available; `McpFeature::isAvailable()` is evaluated per request (Task 5), so calling it before `actingAsMcp()` is enough.

### Task 10: Catalogue, read-scope sweep and verification of Plan 11a

**Files:**
- Test: create `tests/Feature/Mcp/CatalogueTest.php`, `tests/Feature/Mcp/ReadPrivacyTest.php`
- Modify: only if a test fails — the offending tool or presenter (expected: none)

**Interfaces:**
- Consumes: every tool of Tasks 5–9 registered in `SkrumServer::$tools`, `actingAsMcp()`, `mcpStructured()`, `configureLlm()`.
- Produces:
  - The catalogue expectation for Plan 11a (11 read tools); Plan 11b's Task 7 extends it to 25 names with the same `mcpToolNames()` helper (Task 5).
  - A privacy sweep over every Plan 11a tool's output (no email, no retro guest token or guest URL) that Plan 11b extends with its tools.

- [ ] **Step 1: Write the catalogue test**

Create `tests/Feature/Mcp/CatalogueTest.php`:

```php
<?php

use App\Enums\McpScope;
use App\Models\Team;

it('lists exactly the retrospective read tools of the contract', function () {
    configureLlm();
    $user = teamMember(Team::factory()->create());

    expect(mcpToolNames(actingAsMcp($user, [McpScope::Read, McpScope::Write, McpScope::Delete])))->toBe(collect([
        'retro.teams.list',
        'retro.team.members.list',
        'retro.boards.list',
        'retro.boards.search',
        'retro.actions.list',
        'retro.board.messages.list',
        'retro.board.summary.get',
        'retro.board.actions.list',
        'retro.board.insights.list',
        'retro.board.health.get',
        'retro.board.roti.get',
    ])->sort()->values()->all());
});

it('lists the read tools for a read-only token, without insights when no provider is set', function () {
    $user = teamMember(Team::factory()->create());

    expect(mcpToolNames(actingAsMcp($user)))->not->toContain('retro.board.insights.list')
        ->and(mcpToolNames(actingAsMcp($user)))->toHaveCount(10);
});
```

- [ ] **Step 2: Write the privacy sweep**

Create `tests/Feature/Mcp/ReadPrivacyTest.php`:

```php
<?php

use App\Enums\RetroPhase;
use App\Enums\SummaryStatus;
use App\Mcp\Tools\Retro\GetHealth;
use App\Mcp\Tools\Retro\GetRoti;
use App\Mcp\Tools\Retro\GetSummary;
use App\Mcp\Tools\Retro\ListActionItems;
use App\Mcp\Tools\Retro\ListBoardActionItems;
use App\Mcp\Tools\Retro\ListBoards;
use App\Mcp\Tools\Retro\ListInsights;
use App\Mcp\Tools\Retro\ListMessages;
use App\Mcp\Tools\Retro\ListTeamMembers;
use App\Mcp\Tools\Retro\ListTeams;
use App\Mcp\Tools\Retro\SearchBoards;
use App\Models\ActionItem;
use App\Models\Card;
use App\Models\Participant;
use App\Models\Retro;

it('never returns emails, guest tokens or guest links', function (string $tool, Closure $arguments) {
    configureLlm();
    $retro = Retro::factory()->withGuestAccess()->inPhase(RetroPhase::Completed)->create([
        'title' => 'Privacy board',
        'summary' => 'Privacy summary',
        'summary_status' => SummaryStatus::Ready,
    ]);
    [$user, $participant] = retroMember($retro);
    $guest = Participant::factory()->guest()->create(['retro_id' => $retro->id]);
    Card::factory()->create(['retro_id' => $retro->id, 'participant_id' => $guest->id, 'content' => 'Privacy card']);
    ActionItem::factory()->create(['retro_id' => $retro->id, 'content' => 'Privacy action', 'assignee_user_id' => $user->id]);

    $json = json_encode(mcpStructured(actingAsMcp($user)->tool($tool, $arguments($retro))->assertOk()));

    expect($json)->not->toContain($user->email)
        ->and($json)->not->toContain($retro->guest_token)
        ->and($json)->not->toContain('/join/')
        ->and($json)->not->toMatch('/[\w.+-]+@[\w-]+\.[\w.]+/');
})->with([
    'teams' => [ListTeams::class, fn (Retro $retro) => []],
    'members' => [ListTeamMembers::class, fn (Retro $retro) => ['team_id' => $retro->team_id]],
    'boards' => [ListBoards::class, fn (Retro $retro) => ['team_id' => $retro->team_id]],
    'search' => [SearchBoards::class, fn (Retro $retro) => ['query' => 'privacy']],
    'actions' => [ListActionItems::class, fn (Retro $retro) => ['status' => 'all']],
    'board actions' => [ListBoardActionItems::class, fn (Retro $retro) => ['board_id' => $retro->id]],
    'messages' => [ListMessages::class, fn (Retro $retro) => ['board_id' => $retro->id]],
    'summary' => [GetSummary::class, fn (Retro $retro) => ['board_id' => $retro->id]],
    'insights' => [ListInsights::class, fn (Retro $retro) => ['board_id' => $retro->id]],
    'health' => [GetHealth::class, fn (Retro $retro) => ['board_id' => $retro->id]],
    'roti' => [GetRoti::class, fn (Retro $retro) => ['board_id' => $retro->id]],
]);

it('never returns the viewer as a voter of a card', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Discussing)->create();
    [$user, $participant] = retroMember($retro);
    $card = Card::factory()->create(['retro_id' => $retro->id]);
    \App\Models\Vote::factory()->create(['retro_id' => $retro->id, 'card_id' => $card->id, 'participant_id' => $participant->id]);

    $json = json_encode(mcpStructured(actingAsMcp($user)->tool(ListMessages::class, ['board_id' => $retro->id])));

    expect($json)->not->toContain('myVotes')
        ->and($json)->not->toContain('voters');
});
```

Import `App\Models\Vote` instead of the fully-qualified name before running pint.

- [ ] **Step 3: Run the new tests**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Mcp/CatalogueTest.php tests/Feature/Mcp/ReadPrivacyTest.php`
Expected: PASS. A failure in the sweep is a real leak: fix it in the presenter or tool that produced the value (never in the test), in its own `fix:` commit with the test as regression.

- [ ] **Step 4: Full verification of Plan 11a**

Run:
```bash
export PATH="$HOME/.orbstack/bin:/opt/homebrew/bin:$PATH"
vendor/bin/sail artisan test --compact tests/Feature/Mcp tests/Feature/Retros tests/Feature/ActionItems tests/Feature/Settings tests/Feature/TranslationKeysTest.php tests/Feature/UuidPrimaryKeysTest.php
vendor/bin/sail bin pint --dirty --format agent
vendor/bin/sail bin phpstan analyse --no-progress
npm run types:check && npm run check
npm run build
```
Expected: all tests pass; pint clean; phpstan 0 errors; type-check clean; `npm run check` fails only on the known baseline files (`.devcontainer/devcontainer.json`, `docs/superpowers/*.md`); build succeeds.

- [ ] **Step 5: Commit**

```bash
git add tests/Feature/Mcp/CatalogueTest.php tests/Feature/Mcp/ReadPrivacyTest.php
git commit -m "test: pin the MCP read catalogue and sweep read tools for private data

Co-Authored-By: <your harness attribution>
Claude-Session: https://claude.ai/code/session_01SosW8d2Uj7QxsF1tws5ssS"
```

- [ ] **Step 6: Manual smoke check (controller, with the user)**

With Sail up and `SKRUM_MCP_ENABLED=true`: create a read-only token on `/settings/api-tokens`, then run
`claude mcp add --transport http skrum-local http://localhost/mcp --header "Authorization: Bearer <token>"` and ask the assistant "list my teams and the last board's summary". Expected: the 10 read tools (11 with a provider) appear in the client, `retro.teams.list` and `retro.board.summary.get` answer, and revoking the token makes the next call fail with 401. Record the outcome in the ledger.

#### Implementer notes

- Plan 11b Task 7 extends the catalogue to the 25 tools and the sweep to the poker and write tools; keep the dataset style of the sweep so it can reuse them.
