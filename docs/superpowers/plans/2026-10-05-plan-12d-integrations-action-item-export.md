# Plan 12d — Action item export with assignee and priority mapping Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Team members who can edit an action item export it once per provider as a Jira Cloud or Linear issue (title, body with a link back, due date, mapped priority, mapped assignee) from the board, the carry-over panel and the global page; workspace Owners/Admins map team members to Jira/Linear accounts (automatic email matching, manual choice, "Never assign", reset) and High/Medium/Low to provider priorities, and every case where the assignee or priority cannot be set exports anyway with a warning.

**Architecture:** Export is one synchronous request: `ExportActionItem` refreshes the provider token *before* opening the transaction, then — inside `DB::transaction` with the retro and the item locked — inserts the `action_item_external_links` row first (unique per item and source, so a double click cannot create two issues), builds the issue with `BuildIssueDraft` (Jira ADF / Linear Markdown), resolves the assignee (`ResolveExportAssignee`, with one lazy email lookup) and the priority (`ResolveExportPriority`, Jira through the cached create screen `JiraCreateMeta`), creates the issue through `ExportToJira` / `ExportToLinear` (retrying once without the assignee when the provider refuses it) and fills the link row; a provider failure rolls everything back, and a lost access is re-recorded after the rollback. Accounts live in `IntegrationUserAccounts` (Jira user search, Linear user directory; emails compared in memory only); `MatchIntegrationUsers` (queued, unique per integration) runs on `IntegrationActivated` and on "Match by email". Links reach browsers only through `PresentActionItem.externalLinks` (members only) and a new member-only broadcast `action-item.external-links.changed`; guests never see them.

**Tech Stack:** Laravel 13 (PHP 8.4), PostgreSQL, Pest, Laravel HTTP client through Plan 12a's `JiraClient` / `LinearClient`, database queue, Inertia v3 + React 19, Wayfinder, Tailwind 4, lucide, Radix dialog/select/dropdown (all installed).

**Spec:** `docs/superpowers/specs/2026-09-29-integrations-design.md` — §3 `integration_user_mappings` and `action_item_external_links` usage, §7, §7.1, §7.2, §7.3, §8 rows "Export an action item", "Map members to Jira/Linear accounts, run email matching, search accounts, set the priority mapping", "See the export preview", §9 team-integration rows `targets`, `user-mappings` (GET, match, PUT, DELETE), `accounts`, `priorities`, PATCH `priorityMap`, the retro rows `action-items/{actionItem}/exports` and `…/exports/preview`, the Workspace rows, §10.1 rows "Jira / Linear export", "Jira user search", "Linear user list", §10.2 "Guests" and "Account mappings", §11 "Integrations page" People and Priorities panels and "Action item card", §12 row `MatchIntegrationUsers`, §13 export and mapping errors, §14 "Action items v2", §15 bullets Export and Assignee and priority mapping, §16 criteria 9 and 13. Builds on Plan 12a (`docs/superpowers/plans/2026-10-05-plan-12a-integrations-foundation.md`, its "Contract for Plans 12b–12d"). Parent: `docs/superpowers/specs/2026-09-29-retro-board-core-design.md`.

## Global Constraints

- Work on branch `feat/plan-12-integrations`. **Execution order: 12a → 12b → 12c → 12d** — this plan starts from the tip left by Plan 12c. Plans 12b and 12c were written in parallel with this one: where a step edits a shared file (`routes/web.php`, `app/Actions/Retros/BuildBoardSnapshot.php`, `resources/js/lib/retro/types.ts`, `resources/js/types/integrations.ts`, `lang/*.json`, `tests/Pest.php`, `app/Providers/AppServiceProvider.php`), anchor the edit on the code this plan names and keep whatever 12b/12c added around it.
- Shells: prefix commands with `export PATH="$HOME/.orbstack/bin:/opt/homebrew/bin:$PATH";`. Commands through Sail: `vendor/bin/sail artisan …`, `vendor/bin/sail bin pint --dirty --format agent`, `vendor/bin/sail bin phpstan analyse --no-progress` (level 7, 0 errors). npm on the host.
- Tests run on PostgreSQL (the Sail `testing` database). UUID primary keys only. The one migration of this plan uses the prefix `2026_10_05_1003xx`; only `up()`.
- **No new Composer or npm dependency.** Every provider call goes through Plan 12a's `JiraClient::{get,post,put}` / `LinearClient::query` (15 s timeout per call, token refresh built in). User input reaches a provider URL only as a validated path segment (`project_id` and `issue_type_id` match `^\d{1,20}$`, Linear `team_id` is a UUID) or a query parameter.
- Every integration test file starts with `beforeEach(fn () => Http::preventStrayRequests());` and fakes each provider call explicitly. A test that asserts "no provider call" simply registers no fake.
- Credentials are read only through `TeamIntegration`; provider emails are compared in memory and never stored, logged or returned (the account search returns `{accountId, displayName}` only). Provider errors reach users only through Plan 12a's `IntegrationException` messages.
- **Request fields are snake_case** (`source`, `project_id`, `issue_type_id`, `team_id`, `external_account_id`, `priority_map`, `q`); responses and props are camelCase exactly as spec §9.
- Route names follow `routes/web.php`: `teams.integrations.targets.index`, `teams.integrations.userMappings.index`, `teams.integrations.userMappings.match.store`, `teams.integrations.userMappings.update`, `teams.integrations.userMappings.destroy`, `teams.integrations.accounts.index`, `teams.integrations.priorities.index`, `retros.action-items.exports.store`, `retros.action-items.exports.preview`, `workspaces.actionItemExports.store`, `workspaces.actionItemExports.preview`.
- **Lock order** (same as every action item write since commit f133126): the item's retro row first (`lockForUpdate`), then the item (`WorkspaceActionItemGuard::lockWritable`).
- **Provider calls inside a transaction**: refresh the token before `DB::transaction` (`IntegrationTokens::accessToken`), and catch `ReconnectRequired` *outside* the transaction to call `markReconnectRequired()` on a freshly loaded row (Plan 12a Contract rule), because the status written inside a rolled-back transaction is lost.
- Every user-facing string via `t()` / `__()` with real translations in `lang/{en,fr,es,de}.json` (German "du", French "vous", Spanish "tú"), appended at the end of each file, keeping every existing value. Each task lists its own rows; add only keys that are missing at execution time. Provider names (Jira, Linear) and Jira's own priority names are never translated. `tests/Feature/TranslationKeysTest.php` stays green.
- Wayfinder: run `vendor/bin/sail artisan wayfinder:generate --with-form` after every route change. `resources/js/actions` and `resources/js/routes` are gitignored — never stage them. Frontend imports use the generated controllers (`@/actions/App/Http/Controllers/Integrations/…`), never hard-coded URLs.
- Frontend checks: `npm run types:check && npm run check` (known pre-existing failures only in `.devcontainer/devcontainer.json` and `docs/superpowers/*.md`). Format only touched files with `npx vp check --fix <paths>`.
- React: function components, `type Props`, no default exports except pages, Tailwind, lucide icons, `retroRequest()` from `@/lib/retro/api`, `toast` from `sonner`, `integrationErrorMessage()` from `@/lib/integrations`.
- PHP: constructor promotion, typed everything, array-shape docblocks on presenter return values, early returns, curly braces, no comments restating code, class constants in PascalCase. Test helper functions are global in Pest: every new helper name below is unique in `tests/`.
- Commit messages: Conventional Commits, ending with exactly:
  `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`
  `Claude-Session: https://claude.ai/code/session_01SosW8d2Uj7QxsF1tws5ssS`

## Spec amendments made with this plan

Plan writing found these gaps; the spec is updated to match (§3, §7, §7.1, §7.2, §9, §11):

1. **`integration_user_mappings.account_inactive`** (bool, default `false`) stores the "Account inactive" flag that §7.1 sets on `manual` rows whose account disappeared; the flag is cleared when a later check finds the account active or an admin saves the row again.
2. **`externalLinks` in broadcasts**: `PresentActionItem.externalLinks` is `[{source, key, url}]` for members, `[]` for guests and **`null` when presented without a viewer** (board and team broadcasts reach guests too). Members receive the links of an export through a new member-only event `action-item.external-links.changed {actionItemId, externalLinks}` on `retro-members.{retroId}` (the item's running board and every running retro that carries it); clients keep their known links when a payload says `null`. The global page gets them from its existing reload after `team-action-item.saved`.
3. **`priority_map` request values**: each level accepts a Jira priority id or a Linear value 0–4, `null` (Jira only: "Don't set") and the string `"default"`, which removes the level's override (spec §3's "absent key = default mapping" had no way back).
4. **Export sources**: the board snapshot gains `exportSources: [{source, label, integrationId}]` (non-guests; Jira/Linear integrations of the retro's team that are enabled, active and write-enabled; `[]` otherwise) and the global action items page gains the prop `exportSources` keyed by team id, so the item card knows which export entries to show and where to load targets.
5. **Targets endpoint parameters**: `GET …/targets` accepts `?project_id=` (issue types of that project; default: the saved project, else the first) and `?q=` (project name filter); Jira projects are the first 50 the user can create issues in (`action=create`), ordered by name.
6. **Time budget**: every provider call of an export has Plan 12a's 15 s timeout (no cumulative budget); the browser waits up to 45 s for the export response.
7. **Preview state `none`** also covers a member who is not mapped and cannot be matched (no verified email, or a Jira connection without `read:jira-user`); the export then warns `notMapped`.
8. **`neverAssign`** appears in `warnings` with `message: null` (the table in §7.3 has no message for it); clients show only warnings with a message.

## Review Focus

1. **A token refresh or a lost access during the export transaction** → the refreshed Jira token is refreshed and stored *before* the transaction, so a later rollback cannot throw away a rotated refresh token; a `ReconnectRequired` raised inside the transaction still leaves the integration "Reconnect required" after the rollback. Pinned in Task 8 ("keeps a refreshed token when the export fails", "keeps the reconnect-required status after a rolled back export").
2. **Double submit or a second export to the same provider** → exactly one issue, the second request answers 409 "Already exported as :key." without calling the provider. Pinned in Task 8 ("creates one issue for a double submit").
3. **Assignee cannot be set** (guest assignee, member not mapped, "Never assign", Jira refuses the account, assignee not on the Jira create screen) or **priority unavailable** → the issue is still created, unassigned or with the provider default, and the response lists the matching warning; no skrum name is written into the issue. Pinned in Task 8 ("exports with an assignee refused by Jira", "exports without assignee or priority fields on the create screen", "warns about guest assignees and unmapped members").
4. **Automatic matching on ambiguous accounts** (0 or 2 results, inactive, app account, a different `emailAddress`) and **existing rows** (`manual`, "Never assign") → no mapping is created or overwritten; stale `email` rows are deleted and re-matched, inactive `manual` rows are flagged. Pinned in Task 3 ("accepts only one active Atlassian account with the same email", "never overwrites manual rows", "re-checks existing rows").
5. **Guests and members who cannot edit the item** → 403 on export and preview; guests never receive `externalLinks` (snapshot `[]`, broadcasts `null`, member-only event). Pinned in Task 1 ("hides external links from guests and broadcasts") and Task 8 ("refuses guests and members who cannot edit the item").

## File map

| Area | Files |
|---|---|
| Schema & presentation | `database/migrations/2026_10_05_100300_add_account_inactive_to_integration_user_mappings_table.php`; `app/Models/{IntegrationUserMapping,ActionItem}.php`; `app/Actions/Retros/PresentActionItem.php`; `app/Actions/ActionItems/BroadcastActionItemChange.php`; `app/Events/Retros/ActionItemExternalLinksChanged.php` |
| Accounts & priorities | `app/Support/Integrations/{ExternalAccount,IntegrationUserAccounts}.php`; `app/Support/Integrations/Linear/LinearPriority.php`; `app/Support/Integrations/Exceptions/{AssigneeMappingUnavailable,IssueCreationUncertain}.php` |
| Matching & mappings | `app/Actions/Integrations/{IntegrationMappingGuard,MatchIntegrationUserAccounts,PresentIntegrationUserMappings,SaveIntegrationUserMapping,ListProviderPriorities,UpdateTeamIntegration,PresentTeamIntegration}.php`; `app/Jobs/MatchIntegrationUsers.php`; `app/Providers/AppServiceProvider.php` |
| Export | `app/Enums/ExportWarningCode.php`; `app/Actions/Integrations/{ListExportTargets,ListExportSources,IssueDraft,BuildIssueDraft,ExportAssignee,ExportPriority,ExportOutcome,CreatedIssue,ResolveExportAssignee,ResolveExportPriority,PreviewActionItemExport,ActionItemExportGuard,ExportActionItemRules,ExportToJira,ExportToLinear,ExportActionItem}.php`; `app/Support/Integrations/Jira/{JiraCreateFields,JiraCreateMeta}.php` |
| HTTP | `app/Http/Controllers/Integrations/{IntegrationTargetsController,IntegrationUserMappingsController,IntegrationUserMatchesController,IntegrationAccountsController,IntegrationPrioritiesController,RetroActionItemExportsController,RetroActionItemExportPreviewsController,WorkspaceActionItemExportsController,WorkspaceActionItemExportPreviewsController}.php`; `app/Actions/Retros/BuildBoardSnapshot.php`; `app/Http/Controllers/WorkspaceActionItemsController.php`; `routes/web.php` |
| Frontend | `resources/js/types/integrations.ts`; `resources/js/lib/retro/{types,api,board-reducer}.ts`; `resources/js/lib/action-items/endpoints.ts`; `resources/js/hooks/{use-retro-channel,use-retro-board}.ts`; `resources/js/components/action-items/{action-item-card,external-link-chips,export-action-item-dialog,export-action-item-button}.tsx`; `resources/js/components/retro/{action-items-panel,carried-action-items-panel}.tsx`; `resources/js/pages/action-items/index.tsx`; `resources/js/components/integrations/{people-panel,account-picker-dialog,priorities-panel,jira-integration,linear-integration}.tsx` |
| Tests | `tests/Pest.php`; `tests/Feature/ActionItems/PresentActionItemTest.php`; `tests/Feature/Integrations/{ExternalLinksPresentationTest,IntegrationUserAccountsTest,MatchIntegrationUsersTest,UserMappingEndpointsTest,PriorityMappingTest,ExportTargetsTest,ExportResolutionTest,ActionItemExportTest}.php` |
| Translations | `lang/{en,fr,es,de}.json` (rows inside each task) |

---

### Task 1: External links on action items (`account_inactive`, `externalLinks`, member-only broadcast)

**Files:**
- Create: `database/migrations/2026_10_05_100300_add_account_inactive_to_integration_user_mappings_table.php`, `app/Events/Retros/ActionItemExternalLinksChanged.php`
- Modify: `app/Models/IntegrationUserMapping.php`, `app/Models/ActionItem.php`, `app/Actions/Retros/PresentActionItem.php`, `app/Actions/ActionItems/BroadcastActionItemChange.php`, `tests/Feature/ActionItems/PresentActionItemTest.php`
- Test: create `tests/Feature/Integrations/ExternalLinksPresentationTest.php`

**Interfaces:**
- Consumes: Plan 12a `ActionItemExternalLink` (`source` cast `IntegrationProvider`, `external_key`, `external_url`), `ActionItem::externalLinks()`, `IntegrationUserMapping`, `ActionItemExternalLink::factory()` (state `linear()`).
- Produces: column `integration_user_mappings.account_inactive` (fillable, cast `boolean`); `ActionItem::presentationRelations()` includes `externalLinks`; `PresentActionItem::handle()` adds `externalLinks: ?array<int, array{source: string, key: string, url: string}>` (members: list sorted by source; guests `[]`; no viewer `null`) and the public `PresentActionItem::presentExternalLinks(ActionItem): array`; event `App\Events\Retros\ActionItemExternalLinksChanged(string $retroId, string $actionItemId, array $externalLinks)` (`broadcastAs` `action-item.external-links.changed`, channel `private-retro-members.{retroId}`); `BroadcastActionItemChange::externalLinksChanged(ActionItem): void`.

- [ ] **Step 1: Write the failing test**

Create `tests/Feature/Integrations/ExternalLinksPresentationTest.php`:

```php
<?php

use App\Actions\ActionItems\ActionItemActor;
use App\Actions\ActionItems\BroadcastActionItemChange;
use App\Actions\Retros\PresentActionItem;
use App\Enums\RetroPhase;
use App\Events\Retros\ActionItemExternalLinksChanged;
use App\Models\ActionItem;
use App\Models\ActionItemExternalLink;
use App\Models\IntegrationUserMapping;
use App\Models\Participant;
use App\Models\Retro;
use App\Models\Team;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Http;

beforeEach(fn () => Http::preventStrayRequests());

function linkedBoardItem(): array
{
    $retro = Retro::factory()->inPhase(RetroPhase::Discussing)->withGuestAccess()->create();
    [$user, $member] = retroMember($retro);
    $item = ActionItem::factory()->create(['retro_id' => $retro->id, 'created_by_participant_id' => $member->id]);
    ActionItemExternalLink::factory()->linear()->create(['action_item_id' => $item->id, 'external_key' => 'ENG-7', 'external_url' => 'https://linear.app/acme/issue/ENG-7']);
    ActionItemExternalLink::factory()->create(['action_item_id' => $item->id, 'external_key' => 'PROJ-12', 'external_url' => 'https://acme.atlassian.net/browse/PROJ-12']);

    return [$retro, $item, $user, $member];
}

it('presents external links to members only', function () {
    [$retro, $item, , $member] = linkedBoardItem();
    $guest = Participant::factory()->guest()->create(['retro_id' => $retro->id]);
    $present = app(PresentActionItem::class);
    $loaded = $item->fresh()->loadForPresentation();

    expect($present->handle($loaded, ActionItemActor::forParticipant($member))['externalLinks'])->toBe([
        ['source' => 'jira', 'key' => 'PROJ-12', 'url' => 'https://acme.atlassian.net/browse/PROJ-12'],
        ['source' => 'linear', 'key' => 'ENG-7', 'url' => 'https://linear.app/acme/issue/ENG-7'],
    ])
        ->and($present->handle($loaded, ActionItemActor::forParticipant($guest))['externalLinks'])->toBe([])
        ->and($present->handle($loaded)['externalLinks'])->toBeNull();
});

it('hides external links from guests and broadcasts', function () {
    [$retro, , $user] = linkedBoardItem();
    $guest = Participant::factory()->guest()->create(['retro_id' => $retro->id]);

    $this->actingAs($user)->getJson(route('retros.snapshot.show', $retro))
        ->assertOk()
        ->assertJsonPath('actionItems.0.externalLinks.0.key', 'PROJ-12');

    $guestSnapshot = $this->withCookies(retroGuestCookie($guest))->withCredentials()
        ->getJson(route('retros.snapshot.show', $retro))
        ->assertOk();

    expect($guestSnapshot->json('actionItems.0.externalLinks'))->toBe([])
        ->and($guestSnapshot->getContent())->not->toContain('PROJ-12');
});

it('announces new links on the member channels of running retros only', function () {
    Event::fake();
    $team = Team::factory()->create();
    $source = Retro::factory()->inPhase(RetroPhase::Discussing)->create(['team_id' => $team->id, 'created_at' => now()->subDays(14)]);
    $carrying = Retro::factory()->create(['team_id' => $team->id, 'created_at' => now()->subDay()]);
    $item = ActionItem::factory()->create(['retro_id' => $source->id]);
    ActionItemExternalLink::factory()->create(['action_item_id' => $item->id, 'external_key' => 'PROJ-3']);

    app(BroadcastActionItemChange::class)->externalLinksChanged($item->fresh());

    Event::assertDispatchedTimes(ActionItemExternalLinksChanged::class, 2);
    Event::assertDispatched(ActionItemExternalLinksChanged::class, fn (ActionItemExternalLinksChanged $event) => $event->retroId === $carrying->id
        && $event->broadcastOn()->name === "private-retro-members.{$carrying->id}"
        && $event->broadcastAs() === 'action-item.external-links.changed'
        && $event->broadcastWith() === ['actionItemId' => $item->id, 'externalLinks' => [['source' => 'jira', 'key' => 'PROJ-3', 'url' => $item->externalLinks()->first()->external_url]]]);
    Event::assertDispatched(ActionItemExternalLinksChanged::class, fn (ActionItemExternalLinksChanged $event) => $event->retroId === $source->id);
});

it('stores the inactive flag of account mappings', function () {
    $mapping = IntegrationUserMapping::factory()->manual()->create(['account_inactive' => true]);

    expect($mapping->fresh()->account_inactive)->toBeTrue()
        ->and(IntegrationUserMapping::factory()->create()->fresh()->account_inactive)->toBeFalse();
});
```

In `tests/Feature/ActionItems/PresentActionItemTest.php`, in the test "presents every field of a board item", add `'externalLinks' => null,` after `'createdAt' => $item->created_at?->toIso8601String(),` in the expected array (the helper presents without a viewer).

- [ ] **Step 2: Run it to verify it fails**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Integrations/ExternalLinksPresentationTest.php tests/Feature/ActionItems/PresentActionItemTest.php`
Expected: FAIL — `Undefined array key "externalLinks"` and `Class "App\Events\Retros\ActionItemExternalLinksChanged" not found`.

- [ ] **Step 3: Add the column**

Create `database/migrations/2026_10_05_100300_add_account_inactive_to_integration_user_mappings_table.php`:

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('integration_user_mappings', function (Blueprint $table) {
            $table->boolean('account_inactive')->default(false)->after('matched_by');
        });
    }
};
```

In `app/Models/IntegrationUserMapping.php`:
- add `@property bool $account_inactive` after `@property IntegrationUserMatch $matched_by`;
- change the attribute to `#[Fillable(['user_id', 'external_account_id', 'external_display_name', 'matched_by', 'account_inactive', 'checked_at'])]`;
- add `'account_inactive' => 'boolean',` to `casts()`.

- [ ] **Step 4: Present the links**

In `app/Models/ActionItem.php`, change `presentationRelations()` to:

```php
    public static function presentationRelations(): array
    {
        return ['team.members', 'retro', 'author', 'createdByParticipant.user', 'assigneeUser', 'assigneeParticipant.user', 'subtasks', 'externalLinks'];
    }
```

In `app/Actions/Retros/PresentActionItem.php`:
- import `App\Models\ActionItemExternalLink`;
- in the return docblock add `*     externalLinks: ?array<int, array{source: string, key: string, url: string}>,` right before `*     createdAt: ?string`, and extend the class docblock sentence: `Creators and assignees are always named, also on anonymous retros. External issue links are for members: guests get none, and payloads presented without a viewer (broadcasts) carry null so clients keep what they know.`;
- in `handle()` add after `'createdAt' => …,`:

```php
            'externalLinks' => $this->externalLinksFor($item, $viewer),
```

- add the methods:

```php
    /**
     * @return array<int, array{source: string, key: string, url: string}>
     */
    public function presentExternalLinks(ActionItem $item): array
    {
        return $item->externalLinks
            ->sortBy(fn (ActionItemExternalLink $link): string => $link->source->value)
            ->map(fn (ActionItemExternalLink $link): array => [
                'source' => $link->source->value,
                'key' => $link->external_key,
                'url' => $link->external_url,
            ])
            ->values()
            ->all();
    }

    /**
     * @return ?array<int, array{source: string, key: string, url: string}>
     */
    private function externalLinksFor(ActionItem $item, ?ActionItemActor $viewer): ?array
    {
        if ($viewer === null) {
            return null;
        }

        if ($viewer->user === null) {
            return [];
        }

        return $this->presentExternalLinks($item);
    }
```

- [ ] **Step 5: Add the member-only event and the broadcast**

Create `app/Events/Retros/ActionItemExternalLinksChanged.php`:

```php
<?php

namespace App\Events\Retros;

class ActionItemExternalLinksChanged extends RetroMembersBroadcastEvent
{
    /**
     * @param  array<int, array{source: string, key: string, url: string}>  $externalLinks
     */
    public function __construct(string $retroId, public string $actionItemId, public array $externalLinks)
    {
        parent::__construct($retroId);
    }

    public function broadcastAs(): string
    {
        return 'action-item.external-links.changed';
    }

    public function broadcastWith(): array
    {
        return ['actionItemId' => $this->actionItemId, 'externalLinks' => $this->externalLinks];
    }
}
```

In `app/Actions/ActionItems/BroadcastActionItemChange.php`, import `App\Events\Retros\ActionItemExternalLinksChanged` and add after `commentsChanged()`:

```php
    /**
     * Issue keys are for members only, so they travel on the private
     * member channels of the boards that show the item.
     */
    public function externalLinksChanged(ActionItem $item): void
    {
        $item->load('externalLinks');
        $links = $this->presentActionItem->presentExternalLinks($item);
        $retroIds = $this->carryingRetroIds($item);

        if ($this->hasRunningBoard($item)) {
            array_unshift($retroIds, (string) $item->retro_id);
        }

        foreach (array_unique($retroIds) as $retroId) {
            (new ActionItemExternalLinksChanged($retroId, $item->id, $links))->sendToOthers();
        }
    }
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `vendor/bin/sail artisan migrate --no-interaction && vendor/bin/sail artisan test --compact tests/Feature/Integrations/ExternalLinksPresentationTest.php tests/Feature/ActionItems tests/Feature/Mcp`
Expected: PASS (existing action item and MCP suites unchanged in behaviour; MCP action items gain `externalLinks` through the spread in `McpActionItem`).

- [ ] **Step 7: Format, analyse and commit**

```bash
vendor/bin/sail bin pint --dirty --format agent
vendor/bin/sail bin phpstan analyse --no-progress
git add database/migrations/2026_10_05_100300_add_account_inactive_to_integration_user_mappings_table.php app/Models/IntegrationUserMapping.php app/Models/ActionItem.php app/Actions/Retros/PresentActionItem.php app/Actions/ActionItems/BroadcastActionItemChange.php app/Events/Retros/ActionItemExternalLinksChanged.php tests/Feature/Integrations/ExternalLinksPresentationTest.php tests/Feature/ActionItems/PresentActionItemTest.php
git commit -m "feat: present exported issue links to members only

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SosW8d2Uj7QxsF1tws5ssS"
```

---

### Task 2: Provider accounts and the Linear priority scale (`IntegrationUserAccounts`, `LinearPriority`)

**Files:**
- Create: `app/Support/Integrations/ExternalAccount.php`, `app/Support/Integrations/IntegrationUserAccounts.php`, `app/Support/Integrations/Linear/LinearPriority.php`
- Modify: `tests/Pest.php`, `lang/{en,fr,es,de}.json`
- Test: create `tests/Feature/Integrations/IntegrationUserAccountsTest.php`

**Interfaces:**
- Consumes: Plan 12a `JiraClient::get(TeamIntegration, string $path, array $query = []): array`, `LinearClient::query(TeamIntegration, string $query, array $variables = []): array`, `ProviderRejected`.
- Produces:
  - `App\Support\Integrations\ExternalAccount` (`string $id`, `string $displayName`, `bool $active`, `?string $email = null`; `toArray(): array{accountId: string, displayName: string}` — never the email).
  - `App\Support\Integrations\IntegrationUserAccounts` (injectable): `find(TeamIntegration, string $accountId): ?ExternalAccount` (Jira `GET rest/api/3/user`, Linear `user(id:)`; unknown or app accounts → `null`; inactive accounts are returned with `active = false`), `matchEmails(TeamIntegration, array<int, string> $emails): array<string, ExternalAccount>` (keyed by lower-cased email; Jira: one `user/search` per email; Linear: one directory read), `linearUsers(TeamIntegration): array<int, ExternalAccount>` (every page, disabled users included), `matchLinearEmails(array<int, ExternalAccount> $directory, array<int, string> $emails): array<string, ExternalAccount>`, `search(TeamIntegration, string $query): array<int, ExternalAccount>` (active only, ≤ 20).
  - `App\Support\Integrations\Linear\LinearPriority`: `Scale = [0, 1, 2, 3, 4]`, `Defaults = ['high' => 2, 'medium' => 3, 'low' => 4]`, `static label(int): string` (translated), `static options(): array<int, array{id: int, name: string}>`.
  - Pest helpers: `jiraApiUrl(string $path): string`, `jiraAccount(string $accountId, string $displayName, ?string $email = null, bool $active = true, string $type = 'atlassian'): array`, `linearAccount(string $id, string $name, string $email, bool $active = true): array`, `fakeLinearGraphql(array<string, mixed> $responses): void` (responses keyed by a fragment of the GraphQL document; a value is either the `data` array or a `Closure(HttpClientRequest): PromiseInterface`).

- [ ] **Step 1: Add the Pest helpers**

In `tests/Pest.php`, add `use Illuminate\Http\Client\Request as HttpClientRequest;` to the imports (alphabetical order) and append:

```php
function jiraApiUrl(string $path): string
{
    return 'api.atlassian.com/ex/jira/cloud-1/'.ltrim($path, '/');
}

/**
 * @return array<string, mixed>
 */
function jiraAccount(string $accountId, string $displayName, ?string $email = null, bool $active = true, string $type = 'atlassian'): array
{
    return array_filter([
        'accountId' => $accountId,
        'accountType' => $type,
        'displayName' => $displayName,
        'emailAddress' => $email,
        'active' => $active,
    ], fn (mixed $value): bool => $value !== null);
}

/**
 * @return array<string, mixed>
 */
function linearAccount(string $id, string $name, string $email, bool $active = true): array
{
    return ['id' => $id, 'name' => $name, 'displayName' => strtolower(strtok($name, ' ') ?: $name), 'email' => $email, 'active' => $active];
}

/**
 * @param  array<string, mixed>  $responses  keyed by a fragment of the GraphQL document
 */
function fakeLinearGraphql(array $responses): void
{
    Http::fake(['api.linear.app/graphql' => function (HttpClientRequest $request) use ($responses) {
        foreach ($responses as $fragment => $response) {
            if (str_contains((string) $request['query'], $fragment)) {
                return $response instanceof Closure ? $response($request) : Http::response(['data' => $response]);
            }
        }

        return Http::response(['errors' => [['message' => 'Unexpected query', 'extensions' => ['code' => 'INVALID_INPUT']]]], 400);
    }]);
}
```

- [ ] **Step 2: Write the failing test**

Create `tests/Feature/Integrations/IntegrationUserAccountsTest.php`:

```php
<?php

use App\Models\TeamIntegration;
use App\Support\Integrations\ExternalAccount;
use App\Support\Integrations\IntegrationUserAccounts;
use App\Support\Integrations\Linear\LinearPriority;
use Illuminate\Http\Client\Request as HttpClientRequest;
use Illuminate\Support\Facades\Http;

beforeEach(fn () => Http::preventStrayRequests());

it('accepts only one active Atlassian account with the same email', function (array $results, ?string $expected) {
    Http::fake([jiraApiUrl('rest/api/3/user/search*') => Http::response($results)]);

    $matches = app(IntegrationUserAccounts::class)->matchEmails(TeamIntegration::factory()->jira()->create(), ['Ada@Example.com']);

    expect(($matches['ada@example.com'] ?? null)?->id)->toBe($expected);
})->with([
    'one account' => [[jiraAccount('acc-1', 'Ada')], 'acc-1'],
    'same email shown' => [[jiraAccount('acc-1', 'Ada', 'ada@example.com')], 'acc-1'],
    'no account' => [[], null],
    'two accounts' => [[jiraAccount('acc-1', 'Ada'), jiraAccount('acc-2', 'Ada L.')], null],
    'inactive' => [[jiraAccount('acc-1', 'Ada', active: false)], null],
    'app account' => [[jiraAccount('acc-1', 'Bot', type: 'app')], null],
    'different email' => [[jiraAccount('acc-1', 'Ada', 'ada@other.com')], null],
]);

it('searches Jira by email with two results at most', function () {
    Http::fake([jiraApiUrl('rest/api/3/user/search*') => Http::response([])]);

    app(IntegrationUserAccounts::class)->matchEmails(TeamIntegration::factory()->jira()->create(), ['ada@example.com']);

    Http::assertSent(fn (HttpClientRequest $request) => str_contains($request->url(), 'rest/api/3/user/search')
        && $request['query'] === 'ada@example.com'
        && (int) $request['maxResults'] === 2);
});

it('matches Linear users in memory across every page', function () {
    fakeLinearGraphql(['users(' => function (HttpClientRequest $request) {
        return $request['variables']['after'] === null
            ? Http::response(['data' => ['users' => [
                'nodes' => [linearAccount('lin-1', 'Ada Lovelace', 'ADA@example.com'), linearAccount('lin-2', 'Old Ada', 'ada@example.com', active: false)],
                'pageInfo' => ['hasNextPage' => true, 'endCursor' => 'cursor-1'],
            ]]])
            : Http::response(['data' => ['users' => [
                'nodes' => [linearAccount('lin-3', 'Grace Hopper', 'grace@example.com'), linearAccount('lin-4', 'Grace H.', 'grace@example.com')],
                'pageInfo' => ['hasNextPage' => false, 'endCursor' => null],
            ]]]);
    }]);

    $matches = app(IntegrationUserAccounts::class)->matchEmails(TeamIntegration::factory()->linear()->create(), ['ada@example.com', 'grace@example.com', 'none@example.com']);

    expect(array_keys($matches))->toBe(['ada@example.com'])
        ->and($matches['ada@example.com']->id)->toBe('lin-1')
        ->and($matches['ada@example.com']->displayName)->toBe('Ada Lovelace');

    Http::assertSentCount(2);
    Http::assertNotSent(fn (HttpClientRequest $request) => str_contains($request->body(), 'example.com'));
});

it('finds accounts by id and reports inactive or unknown ones', function () {
    Http::fake([
        jiraApiUrl('rest/api/3/user?accountId=acc-1') => Http::response(jiraAccount('acc-1', 'Ada')),
        jiraApiUrl('rest/api/3/user?accountId=acc-2') => Http::response(jiraAccount('acc-2', 'Gone', active: false)),
        jiraApiUrl('rest/api/3/user?accountId=acc-3') => Http::response(['errorMessages' => ['Not found']], 404),
    ]);
    $jira = TeamIntegration::factory()->jira()->create();
    $accounts = app(IntegrationUserAccounts::class);

    expect($accounts->find($jira, 'acc-1')?->active)->toBeTrue()
        ->and($accounts->find($jira, 'acc-2')?->active)->toBeFalse()
        ->and($accounts->find($jira, 'acc-3'))->toBeNull();

    fakeLinearGraphql(['user(' => ['user' => null]]);

    expect($accounts->find(TeamIntegration::factory()->linear()->create(), 'lin-9'))->toBeNull();
});

it('searches active accounts without emails', function () {
    Http::fake([jiraApiUrl('rest/api/3/user/search*') => Http::response([
        jiraAccount('acc-1', 'Ada', 'ada@example.com'),
        jiraAccount('acc-2', 'Adam', active: false),
        jiraAccount('acc-3', 'Automation', type: 'app'),
    ])]);

    $found = app(IntegrationUserAccounts::class)->search(TeamIntegration::factory()->jira()->create(), 'ada');

    expect(array_map(fn (ExternalAccount $account): array => $account->toArray(), $found))->toBe([
        ['accountId' => 'acc-1', 'displayName' => 'Ada'],
    ]);

    fakeLinearGraphql(['users(' => ['users' => [
        'nodes' => [
            linearAccount('lin-1', 'Ada Lovelace', 'ada@example.com'),
            linearAccount('lin-2', 'Grace Hopper', 'grace@ada.dev'),
            linearAccount('lin-3', 'Ada Old', 'old@example.com', active: false),
            linearAccount('lin-4', 'Alan Turing', 'alan@example.com'),
        ],
        'pageInfo' => ['hasNextPage' => false, 'endCursor' => null],
    ]]]);

    $linear = app(IntegrationUserAccounts::class)->search(TeamIntegration::factory()->linear()->create(), 'ADA');

    expect(array_map(fn (ExternalAccount $account): string => $account->id, $linear))->toBe(['lin-1', 'lin-2']);
});

it('describes the Linear priority scale', function () {
    expect(LinearPriority::options())->toBe([
        ['id' => 0, 'name' => 'No priority'],
        ['id' => 1, 'name' => 'Urgent'],
        ['id' => 2, 'name' => 'High'],
        ['id' => 3, 'name' => 'Medium'],
        ['id' => 4, 'name' => 'Low'],
    ])->and(LinearPriority::Defaults)->toBe(['high' => 2, 'medium' => 3, 'low' => 4]);
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Integrations/IntegrationUserAccountsTest.php`
Expected: FAIL — `Class "App\Support\Integrations\IntegrationUserAccounts" not found`.

- [ ] **Step 4: Create the account classes**

Create `app/Support/Integrations/ExternalAccount.php`:

```php
<?php

namespace App\Support\Integrations;

/**
 * A Jira or Linear account. The email is kept for an in-memory comparison
 * and is never serialized.
 */
class ExternalAccount
{
    public function __construct(
        public string $id,
        public string $displayName,
        public bool $active,
        public ?string $email = null,
    ) {}

    /**
     * @return array{accountId: string, displayName: string}
     */
    public function toArray(): array
    {
        return ['accountId' => $this->id, 'displayName' => $this->displayName];
    }
}
```

Create `app/Support/Integrations/IntegrationUserAccounts.php`:

```php
<?php

namespace App\Support\Integrations;

use App\Enums\IntegrationProvider;
use App\Models\TeamIntegration;
use App\Support\Integrations\Exceptions\ProviderRejected;
use App\Support\Integrations\Jira\JiraClient;
use App\Support\Integrations\Linear\LinearClient;
use Illuminate\Support\Str;

/**
 * Accounts of the team's Jira site or Linear workspace. Provider emails
 * are compared here, in memory, and never stored or returned.
 */
class IntegrationUserAccounts
{
    private const SearchLimit = 20;

    private const JiraMatchLimit = 2;

    private const LinearPageSize = 250;

    private const JiraAccountType = 'atlassian';

    private const LinearUserFields = 'id name displayName email active';

    public function __construct(private JiraClient $jira, private LinearClient $linear) {}

    public function find(TeamIntegration $integration, string $accountId): ?ExternalAccount
    {
        try {
            return match ($integration->provider) {
                IntegrationProvider::Jira => $this->jiraAccount($this->jira->get($integration, 'rest/api/3/user', ['accountId' => $accountId])),
                IntegrationProvider::Linear => $this->linearAccount(data_get(
                    $this->linear->query($integration, 'query User($id: String!) { user(id: $id) { '.self::LinearUserFields.' } }', ['id' => $accountId]),
                    'user',
                )),
                default => null,
            };
        } catch (ProviderRejected) {
            return null;
        }
    }

    /**
     * @param  array<int, string>  $emails
     * @return array<string, ExternalAccount>
     */
    public function matchEmails(TeamIntegration $integration, array $emails): array
    {
        if ($integration->provider === IntegrationProvider::Linear) {
            return $this->matchLinearEmails($this->linearUsers($integration), $emails);
        }

        $matches = [];

        foreach ($emails as $email) {
            $account = $this->matchJiraEmail($integration, $email);

            if ($account !== null) {
                $matches[Str::lower($email)] = $account;
            }
        }

        return $matches;
    }

    /**
     * @param  array<int, ExternalAccount>  $directory
     * @param  array<int, string>  $emails
     * @return array<string, ExternalAccount>
     */
    public function matchLinearEmails(array $directory, array $emails): array
    {
        $matches = [];

        foreach ($emails as $email) {
            $wanted = Str::lower($email);
            $candidates = array_values(array_filter(
                $directory,
                fn (ExternalAccount $account): bool => $account->active && $account->email !== null && Str::lower($account->email) === $wanted,
            ));

            if (count($candidates) === 1) {
                $matches[$wanted] = $candidates[0];
            }
        }

        return $matches;
    }

    /**
     * @return array<int, ExternalAccount>
     */
    public function linearUsers(TeamIntegration $integration): array
    {
        return array_values(array_filter(array_map(
            fn (array $node): ?ExternalAccount => $this->linearAccount($node),
            $this->linearNodes($integration),
        )));
    }

    /**
     * @return array<int, ExternalAccount>
     */
    public function search(TeamIntegration $integration, string $query): array
    {
        if ($integration->provider === IntegrationProvider::Linear) {
            return $this->searchLinear($integration, Str::lower($query));
        }

        $results = $this->jira->get($integration, 'rest/api/3/user/search', ['query' => $query, 'maxResults' => self::SearchLimit]);

        return array_values(array_filter(
            array_map(fn (mixed $user): ?ExternalAccount => $this->jiraAccount($user), $results),
            fn (?ExternalAccount $account): bool => $account !== null && $account->active,
        ));
    }

    /**
     * Name, display name or email contain the query (spec §7.1).
     *
     * @return array<int, ExternalAccount>
     */
    private function searchLinear(TeamIntegration $integration, string $needle): array
    {
        $found = [];

        foreach ($this->linearNodes($integration) as $node) {
            $account = $this->linearAccount($node);

            if ($account === null || ! $account->active) {
                continue;
            }

            $haystack = Str::lower(implode(' ', [$account->displayName, (string) ($node['displayName'] ?? ''), (string) $account->email]));

            if (! str_contains($haystack, $needle)) {
                continue;
            }

            $found[] = $account;

            if (count($found) === self::SearchLimit) {
                break;
            }
        }

        return $found;
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function linearNodes(TeamIntegration $integration): array
    {
        $nodes = [];
        $after = null;

        do {
            $page = data_get($this->linear->query(
                $integration,
                'query Users($first: Int!, $after: String) { users(first: $first, after: $after, includeDisabled: true) { nodes { '.self::LinearUserFields.' } pageInfo { hasNextPage endCursor } } }',
                ['first' => self::LinearPageSize, 'after' => $after],
            ), 'users');

            foreach ((array) data_get($page, 'nodes', []) as $node) {
                if (is_array($node)) {
                    $nodes[] = $node;
                }
            }

            $after = data_get($page, 'pageInfo.endCursor');
        } while (data_get($page, 'pageInfo.hasNextPage') === true && is_string($after));

        return $nodes;
    }

    private function matchJiraEmail(TeamIntegration $integration, string $email): ?ExternalAccount
    {
        $results = $this->jira->get($integration, 'rest/api/3/user/search', ['query' => $email, 'maxResults' => self::JiraMatchLimit]);

        $candidates = array_values(array_filter(
            array_map(fn (mixed $user): ?ExternalAccount => $this->jiraAccount($user), $results),
            fn (?ExternalAccount $account): bool => $account !== null && $account->active,
        ));

        if (count($candidates) !== 1) {
            return null;
        }

        $candidate = $candidates[0];

        if ($candidate->email !== null && Str::lower($candidate->email) !== Str::lower($email)) {
            return null;
        }

        return $candidate;
    }

    private function jiraAccount(mixed $user): ?ExternalAccount
    {
        if (! is_array($user) || ! is_string($user['accountId'] ?? null)) {
            return null;
        }

        if (($user['accountType'] ?? null) !== self::JiraAccountType) {
            return null;
        }

        $email = $user['emailAddress'] ?? null;

        return new ExternalAccount(
            $user['accountId'],
            is_string($user['displayName'] ?? null) ? $user['displayName'] : $user['accountId'],
            ($user['active'] ?? false) === true,
            is_string($email) && $email !== '' ? $email : null,
        );
    }

    private function linearAccount(mixed $user): ?ExternalAccount
    {
        if (! is_array($user) || ! is_string($user['id'] ?? null)) {
            return null;
        }

        $name = is_string($user['name'] ?? null) && $user['name'] !== '' ? $user['name'] : (string) ($user['displayName'] ?? $user['id']);
        $email = $user['email'] ?? null;

        return new ExternalAccount(
            $user['id'],
            $name,
            ($user['active'] ?? false) === true,
            is_string($email) && $email !== '' ? $email : null,
        );
    }
}
```

Create `app/Support/Integrations/Linear/LinearPriority.php`:

```php
<?php

namespace App\Support\Integrations\Linear;

/**
 * Linear's fixed priority scale; skrum's High/Medium/Low map to 2/3/4 by
 * default.
 */
class LinearPriority
{
    public const Scale = [0, 1, 2, 3, 4];

    public const Defaults = ['high' => 2, 'medium' => 3, 'low' => 4];

    public static function label(int $value): string
    {
        return match ($value) {
            1 => __('Urgent'),
            2 => __('High'),
            3 => __('Medium'),
            4 => __('Low'),
            default => __('No priority'),
        };
    }

    /**
     * @return array<int, array{id: int, name: string}>
     */
    public static function options(): array
    {
        return array_map(fn (int $value): array => ['id' => $value, 'name' => self::label($value)], self::Scale);
    }
}
```

- [ ] **Step 5: Add the translations**

Append to `lang/{en,fr,es,de}.json` (`High`, `Medium`, `Low` already exist):

| Key (en) | fr | es | de |
|---|---|---|---|
| `Urgent` | `Urgente` | `Urgente` | `Dringend` |
| `No priority` | `Aucune priorité` | `Sin prioridad` | `Keine Priorität` |

- [ ] **Step 6: Run the test to verify it passes**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Integrations/IntegrationUserAccountsTest.php tests/Feature/TranslationKeysTest.php`
Expected: PASS.

- [ ] **Step 7: Format, analyse and commit**

```bash
vendor/bin/sail bin pint --dirty --format agent
vendor/bin/sail bin phpstan analyse --no-progress
git add app/Support/Integrations/ExternalAccount.php app/Support/Integrations/IntegrationUserAccounts.php app/Support/Integrations/Linear/LinearPriority.php tests/Pest.php tests/Feature/Integrations/IntegrationUserAccountsTest.php lang
git commit -m "feat: look up Jira and Linear accounts without storing emails

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SosW8d2Uj7QxsF1tws5ssS"
```

---
### Task 3: Automatic matching by email (`MatchIntegrationUserAccounts`, `MatchIntegrationUsers`)

**Files:**
- Create: `app/Actions/Integrations/IntegrationMappingGuard.php`, `app/Actions/Integrations/MatchIntegrationUserAccounts.php`, `app/Jobs/MatchIntegrationUsers.php`, `app/Support/Integrations/Exceptions/AssigneeMappingUnavailable.php`
- Modify: `app/Providers/AppServiceProvider.php`, `lang/{en,fr,es,de}.json`, Plan 12a's write-connect tests (`tests/Feature/Integrations/{ConnectJiraTest,ConnectLinearTest}.php`: `Queue::fake()`)
- Test: create `tests/Feature/Integrations/MatchIntegrationUsersTest.php`

**Interfaces:**
- Consumes: `IntegrationUserAccounts` (Task 2), Plan 12a `IntegrationActivated` (`$integration`, `$siteChanged`, after commit), `TeamIntegration::{canWrite, hasScope, userMappings, team}`, `IntegrationException`, `RateLimited` (`$retryAfter`), `ProviderUnavailable`.
- Produces:
  - `App\Actions\Integrations\IntegrationMappingGuard`: `static hasAccountScope(TeamIntegration): bool` (Linear always; Jira needs `read:jira-user`), `static canMap(TeamIntegration): bool` (tracker, provider enabled, `canWrite()`, account scope), `static ensureMappable(TeamIntegration): void` (404 for chat channels, then `ensureWritable()`, then `AssigneeMappingUnavailable`), `static ensureTracker(TeamIntegration): void` (404 for chat channels, then `ensureWritable()`).
  - `App\Support\Integrations\Exceptions\AssigneeMappingUnavailable` (409 "Reconnect :provider to enable assignee mapping.").
  - `App\Actions\Integrations\MatchIntegrationUserAccounts::handle(TeamIntegration): void`.
  - `App\Jobs\MatchIntegrationUsers` (`ShouldQueue`, `ShouldBeUnique` per integration id, `tries = 3`, `backoff = [30, 120]`): `static start(TeamIntegration): void` (sets the "matching" flag and dispatches), `static isRunning(TeamIntegration): bool`.
  - Listener: `IntegrationActivated` → `MatchIntegrationUsers::start()` (registered in `AppServiceProvider::boot`).

- [ ] **Step 1: Write the failing test**

Create `tests/Feature/Integrations/MatchIntegrationUsersTest.php`:

```php
<?php

use App\Actions\Integrations\MatchIntegrationUserAccounts;
use App\Enums\IntegrationAccess;
use App\Enums\IntegrationProvider;
use App\Enums\IntegrationUserMatch;
use App\Events\Integrations\IntegrationActivated;
use App\Jobs\MatchIntegrationUsers;
use App\Models\IntegrationUserMapping;
use App\Models\Team;
use App\Models\TeamIntegration;
use App\Models\User;
use Illuminate\Http\Client\Request as HttpClientRequest;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;

beforeEach(function () {
    Http::preventStrayRequests();
    enableIntegrations(IntegrationProvider::Jira, IntegrationProvider::Linear);
});

/**
 * @param  array<string, array<int, array<string, mixed>>>  $directory  search results per email
 */
function fakeJiraDirectory(array $directory): void
{
    Http::fake([jiraApiUrl('rest/api/3/user/search*') => fn (HttpClientRequest $request) => Http::response($directory[$request['query']] ?? [])]);
}

function matchingMember(Team $team, string $email): User
{
    $user = teamMember($team);
    $user->forceFill(['email' => $email])->save();

    return $user;
}

it('starts matching when a write connection becomes active', function () {
    Queue::fake();
    $integration = TeamIntegration::factory()->jira()->create();

    event(new IntegrationActivated($integration, false));

    Queue::assertPushed(MatchIntegrationUsers::class, fn (MatchIntegrationUsers $job) => $job->integrationId === $integration->id);
    expect(MatchIntegrationUsers::isRunning($integration))->toBeTrue();
});

it('maps team members with one active Jira account for their email', function () {
    $integration = TeamIntegration::factory()->jira()->create();
    $ada = matchingMember($integration->team, 'ada@example.com');
    $grace = matchingMember($integration->team, 'grace@example.com');
    fakeJiraDirectory([
        'ada@example.com' => [jiraAccount('acc-ada', 'Ada L.')],
        'grace@example.com' => [jiraAccount('acc-1', 'Grace'), jiraAccount('acc-2', 'Grace H.')],
    ]);

    app(MatchIntegrationUserAccounts::class)->handle($integration);

    $mapping = $integration->accountFor($ada);

    expect($mapping?->external_account_id)->toBe('acc-ada')
        ->and($mapping?->external_display_name)->toBe('Ada L.')
        ->and($mapping?->matched_by)->toBe(IntegrationUserMatch::Email)
        ->and($integration->accountFor($grace))->toBeNull();
});

it('looks up current members with a verified email only', function () {
    $integration = TeamIntegration::factory()->jira()->create();
    matchingMember($integration->team, 'ada@example.com');
    $unverified = matchingMember($integration->team, 'late@example.com');
    $unverified->forceFill(['email_verified_at' => null])->save();
    User::factory()->create(['email' => 'outsider@example.com']);
    fakeJiraDirectory([]);

    app(MatchIntegrationUserAccounts::class)->handle($integration);

    Http::assertSentCount(1);
    Http::assertSent(fn (HttpClientRequest $request) => $request['query'] === 'ada@example.com');
});

it('never overwrites manual rows', function () {
    $integration = TeamIntegration::factory()->jira()->create();
    $manual = matchingMember($integration->team, 'ada@example.com');
    $never = matchingMember($integration->team, 'grace@example.com');
    IntegrationUserMapping::factory()->manual()->create(['team_integration_id' => $integration->id, 'user_id' => $manual->id, 'external_account_id' => 'acc-chosen']);
    IntegrationUserMapping::factory()->neverAssign()->create(['team_integration_id' => $integration->id, 'user_id' => $never->id]);
    Http::fake([
        jiraApiUrl('rest/api/3/user?accountId=acc-chosen') => Http::response(jiraAccount('acc-chosen', 'Ada (chosen)')),
        jiraApiUrl('rest/api/3/user/search*') => Http::response([jiraAccount('acc-other', 'Someone')]),
    ]);

    app(MatchIntegrationUserAccounts::class)->handle($integration);

    expect($integration->accountFor($manual)?->external_account_id)->toBe('acc-chosen')
        ->and($integration->accountFor($never)?->isNeverAssign())->toBeTrue();
    Http::assertNotSent(fn (HttpClientRequest $request) => str_contains($request->url(), 'user/search'));
});

it('re-checks existing rows', function () {
    $integration = TeamIntegration::factory()->jira()->create();
    $stale = matchingMember($integration->team, 'ada@example.com');
    $inactive = matchingMember($integration->team, 'grace@example.com');
    $healthy = matchingMember($integration->team, 'alan@example.com');
    IntegrationUserMapping::factory()->create(['team_integration_id' => $integration->id, 'user_id' => $stale->id, 'external_account_id' => 'acc-gone']);
    IntegrationUserMapping::factory()->manual()->create(['team_integration_id' => $integration->id, 'user_id' => $inactive->id, 'external_account_id' => 'acc-left']);
    IntegrationUserMapping::factory()->manual()->create(['team_integration_id' => $integration->id, 'user_id' => $healthy->id, 'external_account_id' => 'acc-alan', 'account_inactive' => true]);
    Http::fake([
        jiraApiUrl('rest/api/3/user?accountId=acc-gone') => Http::response(['errorMessages' => ['Not found']], 404),
        jiraApiUrl('rest/api/3/user?accountId=acc-left') => Http::response(jiraAccount('acc-left', 'Grace', active: false)),
        jiraApiUrl('rest/api/3/user?accountId=acc-alan') => Http::response(jiraAccount('acc-alan', 'Alan T.')),
        jiraApiUrl('rest/api/3/user/search*') => Http::response([jiraAccount('acc-ada-new', 'Ada')]),
    ]);

    app(MatchIntegrationUserAccounts::class)->handle($integration);

    expect($integration->accountFor($stale)?->external_account_id)->toBe('acc-ada-new')
        ->and($integration->accountFor($inactive)?->account_inactive)->toBeTrue()
        ->and($integration->accountFor($inactive)?->external_account_id)->toBe('acc-left')
        ->and($integration->accountFor($healthy)?->account_inactive)->toBeFalse()
        ->and($integration->accountFor($healthy)?->external_display_name)->toBe('Alan T.');
});

it('matches Linear members on this server', function () {
    $integration = TeamIntegration::factory()->linear()->create();
    $ada = matchingMember($integration->team, 'ada@example.com');
    fakeLinearGraphql(['users(' => ['users' => [
        'nodes' => [linearAccount('lin-ada', 'Ada Lovelace', 'Ada@Example.com')],
        'pageInfo' => ['hasNextPage' => false, 'endCursor' => null],
    ]]]);

    app(MatchIntegrationUserAccounts::class)->handle($integration);

    expect($integration->accountFor($ada)?->external_account_id)->toBe('lin-ada');
    Http::assertNotSent(fn (HttpClientRequest $request) => str_contains($request->body(), 'ada@example.com'));
});

it('does nothing for read-only connections or Jira without account access', function () {
    $read = TeamIntegration::factory()->jira(IntegrationAccess::Read)->create();
    matchingMember($read->team, 'ada@example.com');
    $withoutScope = TeamIntegration::factory()->jira()->create(['scopes' => ['offline_access', 'read:jira-work', 'write:jira-work']]);
    matchingMember($withoutScope->team, 'ada@example.com');

    app(MatchIntegrationUserAccounts::class)->handle($read);
    app(MatchIntegrationUserAccounts::class)->handle($withoutScope);

    Http::assertNothingSent();
});

it('waits when the provider rate limits and clears the flag when done', function () {
    Queue::fake();
    $integration = TeamIntegration::factory()->jira()->create();
    matchingMember($integration->team, 'ada@example.com');
    Http::fake([jiraApiUrl('rest/api/3/user/search*') => Http::sequence()
        ->push([], 429, ['Retry-After' => '42'])
        ->push([])]);
    MatchIntegrationUsers::start($integration);

    $limited = (new MatchIntegrationUsers($integration->id))->withFakeQueueInteractions();
    $limited->handle(app(MatchIntegrationUserAccounts::class));

    $limited->assertReleased(42);
    expect(MatchIntegrationUsers::isRunning($integration))->toBeTrue();

    (new MatchIntegrationUsers($integration->id))->withFakeQueueInteractions()->handle(app(MatchIntegrationUserAccounts::class));

    expect(MatchIntegrationUsers::isRunning($integration))->toBeFalse();
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Integrations/MatchIntegrationUsersTest.php`
Expected: FAIL — `Class "App\Jobs\MatchIntegrationUsers" not found`.

- [ ] **Step 3: Create the guard and its exception**

Create `app/Support/Integrations/Exceptions/AssigneeMappingUnavailable.php`:

```php
<?php

namespace App\Support\Integrations\Exceptions;

/**
 * A Jira connection made before assignee mapping existed lacks the
 * read:jira-user scope; reconnecting grants it.
 */
class AssigneeMappingUnavailable extends IntegrationException
{
    public function status(): int
    {
        return 409;
    }

    public function userMessage(): string
    {
        return __('Reconnect :provider to enable assignee mapping.', ['provider' => $this->provider->label()]);
    }
}
```

Create `app/Actions/Integrations/IntegrationMappingGuard.php`:

```php
<?php

namespace App\Actions\Integrations;

use App\Enums\IntegrationProvider;
use App\Models\TeamIntegration;
use App\Support\Integrations\Exceptions\AssigneeMappingUnavailable;

class IntegrationMappingGuard
{
    public const JiraAccountScope = 'read:jira-user';

    public static function hasAccountScope(TeamIntegration $integration): bool
    {
        if ($integration->provider !== IntegrationProvider::Jira) {
            return true;
        }

        return $integration->hasScope(self::JiraAccountScope);
    }

    public static function canMap(TeamIntegration $integration): bool
    {
        if (! $integration->provider->isTracker()) {
            return false;
        }

        if (! $integration->provider->isEnabled()) {
            return false;
        }

        if (! $integration->canWrite()) {
            return false;
        }

        return self::hasAccountScope($integration);
    }

    /**
     * Chat channels have no accounts (404); trackers answer with the
     * connection's state (409).
     */
    public static function ensureMappable(TeamIntegration $integration): void
    {
        self::ensureTracker($integration);

        if (! self::hasAccountScope($integration)) {
            throw new AssigneeMappingUnavailable($integration->provider);
        }
    }

    public static function ensureTracker(TeamIntegration $integration): void
    {
        abort_unless($integration->provider->isTracker(), 404);

        $integration->ensureWritable();
    }
}
```

- [ ] **Step 4: Create the matching action and the job**

Create `app/Actions/Integrations/MatchIntegrationUserAccounts.php`:

```php
<?php

namespace App\Actions\Integrations;

use App\Enums\IntegrationProvider;
use App\Enums\IntegrationUserMatch;
use App\Models\TeamIntegration;
use App\Models\User;
use App\Support\Integrations\ExternalAccount;
use App\Support\Integrations\IntegrationUserAccounts;
use Illuminate\Support\Str;

/**
 * Spec §7.1 automatic matching: existing rows are only re-checked (stale
 * email rows are deleted so they can match again, inactive manual rows are
 * flagged), then members without a row are matched by verified email.
 */
class MatchIntegrationUserAccounts
{
    public function __construct(private IntegrationUserAccounts $accounts) {}

    public function handle(TeamIntegration $integration): void
    {
        if (! IntegrationMappingGuard::canMap($integration)) {
            return;
        }

        $directory = $integration->provider === IntegrationProvider::Linear
            ? $this->accounts->linearUsers($integration)
            : null;

        $this->recheck($integration, $directory);
        $this->matchUnmapped($integration, $directory);
    }

    /**
     * @param  array<int, ExternalAccount>|null  $directory
     */
    private function recheck(TeamIntegration $integration, ?array $directory): void
    {
        $known = $directory === null ? null : collect($directory)->keyBy(fn (ExternalAccount $account): string => $account->id);

        $mappings = $integration->userMappings()->whereNotNull('external_account_id')->get();

        foreach ($mappings as $mapping) {
            $accountId = (string) $mapping->external_account_id;
            $account = $known === null ? $this->accounts->find($integration, $accountId) : $known->get($accountId);
            $usable = $account !== null && $account->active;

            if (! $usable && $mapping->matched_by === IntegrationUserMatch::Email) {
                $mapping->delete();

                continue;
            }

            $mapping->forceFill([
                'account_inactive' => ! $usable,
                'external_display_name' => $account === null ? $mapping->external_display_name : $account->displayName,
                'checked_at' => now(),
            ])->save();
        }
    }

    /**
     * @param  array<int, ExternalAccount>|null  $directory
     */
    private function matchUnmapped(TeamIntegration $integration, ?array $directory): void
    {
        $mapped = $integration->userMappings()->pluck('user_id')->all();

        $members = $integration->team->members()
            ->whereNotNull('email_verified_at')
            ->whereNotIn('users.id', $mapped)
            ->get();

        if ($members->isEmpty()) {
            return;
        }

        $emails = $members->map(fn (User $member): string => $member->email)->all();

        $matches = $directory === null
            ? $this->accounts->matchEmails($integration, $emails)
            : $this->accounts->matchLinearEmails($directory, $emails);

        foreach ($members as $member) {
            $account = $matches[Str::lower($member->email)] ?? null;

            if ($account === null) {
                continue;
            }

            $integration->userMappings()->firstOrCreate(['user_id' => $member->id], [
                'external_account_id' => $account->id,
                'external_display_name' => $account->displayName,
                'matched_by' => IntegrationUserMatch::Email,
                'account_inactive' => false,
                'checked_at' => now(),
            ]);
        }
    }

}
```

Create `app/Jobs/MatchIntegrationUsers.php`:

```php
<?php

namespace App\Jobs;

use App\Actions\Integrations\MatchIntegrationUserAccounts;
use App\Models\TeamIntegration;
use App\Support\Integrations\Exceptions\IntegrationException;
use App\Support\Integrations\Exceptions\ProviderUnavailable;
use App\Support\Integrations\Exceptions\RateLimited;
use Illuminate\Contracts\Queue\ShouldBeUnique;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Cache;

class MatchIntegrationUsers implements ShouldBeUnique, ShouldQueue
{
    use Queueable;

    public int $tries = 3;

    public int $timeout = 300;

    public int $uniqueFor = 900;

    private const RunningSeconds = 900;

    public function __construct(public string $integrationId) {}

    public static function start(TeamIntegration $integration): void
    {
        Cache::put(self::runningKey($integration->id), true, self::RunningSeconds);

        self::dispatch($integration->id);
    }

    public static function isRunning(TeamIntegration $integration): bool
    {
        return Cache::has(self::runningKey($integration->id));
    }

    public function uniqueId(): string
    {
        return $this->integrationId;
    }

    /**
     * @return array<int, int>
     */
    public function backoff(): array
    {
        return [30, 120];
    }

    public function handle(MatchIntegrationUserAccounts $matchAccounts): void
    {
        $integration = TeamIntegration::query()->find($this->integrationId);

        try {
            if ($integration !== null) {
                $matchAccounts->handle($integration);
            }
        } catch (RateLimited $exception) {
            $this->release($exception->retryAfter);

            return;
        } catch (ProviderUnavailable $exception) {
            throw $exception;
        } catch (IntegrationException) {
            // A lost access is already recorded on the integration.
        }

        Cache::forget(self::runningKey($this->integrationId));
    }

    public function failed(): void
    {
        Cache::forget(self::runningKey($this->integrationId));
    }

    private static function runningKey(string $integrationId): string
    {
        return "integration-user-matching:{$integrationId}";
    }
}
```

- [ ] **Step 5: Listen to activations**

In `app/Providers/AppServiceProvider.php`, import `App\Events\Integrations\IntegrationActivated`, `App\Jobs\MatchIntegrationUsers` and `Illuminate\Support\Facades\Event`, and add at the end of `boot()` (before the `local` environment block):

```php
        Event::listen(IntegrationActivated::class, fn (IntegrationActivated $event) => MatchIntegrationUsers::start($event->integration));
```

- [ ] **Step 6: Add the translations**

Append to `lang/{en,fr,es,de}.json`:

| Key (en) | fr | es | de |
|---|---|---|---|
| `Reconnect :provider to enable assignee mapping.` | `Reconnectez :provider pour activer la correspondance des responsables.` | `Vuelve a conectar :provider para activar la asignación de responsables.` | `Verbinde :provider erneut, um die Zuordnung der Verantwortlichen zu aktivieren.` |

- [ ] **Step 7: Run the tests to verify they pass**

The test queue is `sync`, so once the listener exists every write connection saved through `SaveTeamIntegration` in a test runs the matching job at once and hits `Http::preventStrayRequests()`. Add `Queue::fake();` at the start of the `beforeEach` of every test file that connects a Jira or Linear integration with write access — at least `tests/Feature/Integrations/ConnectJiraTest.php` and `tests/Feature/Integrations/ConnectLinearTest.php` (search with `grep -rln "SaveTeamIntegration\|integrations.callback" tests/Feature`) — and, in each of those files, one existing write-connect test gains the line `Queue::assertPushed(MatchIntegrationUsers::class);` (import `App\Jobs\MatchIntegrationUsers`).

Run: `vendor/bin/sail artisan test --compact tests/Feature/Integrations`
Expected: PASS.

- [ ] **Step 8: Format, analyse and commit**

```bash
vendor/bin/sail bin pint --dirty --format agent
vendor/bin/sail bin phpstan analyse --no-progress
git add app/Actions/Integrations/IntegrationMappingGuard.php app/Actions/Integrations/MatchIntegrationUserAccounts.php app/Jobs/MatchIntegrationUsers.php app/Support/Integrations/Exceptions/AssigneeMappingUnavailable.php app/Providers/AppServiceProvider.php tests/Feature/Integrations lang
git commit -m "feat: match team members to Jira and Linear accounts by email

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SosW8d2Uj7QxsF1tws5ssS"
```

---
### Task 4: People endpoints (user mappings, email matching, account search)

**Files:**
- Create: `app/Actions/Integrations/PresentIntegrationUserMappings.php`, `app/Actions/Integrations/SaveIntegrationUserMapping.php`, `app/Http/Controllers/Integrations/IntegrationUserMappingsController.php`, `app/Http/Controllers/Integrations/IntegrationUserMatchesController.php`, `app/Http/Controllers/Integrations/IntegrationAccountsController.php`
- Modify: `routes/web.php`, `lang/{en,fr,es,de}.json`
- Test: create `tests/Feature/Integrations/UserMappingEndpointsTest.php`

**Interfaces:**
- Consumes: `IntegrationMappingGuard::ensureMappable`, `IntegrationUserAccounts::{find, search}`, `MatchIntegrationUsers::{start, isRunning}` (Tasks 2–3); Plan 12a `TeamPolicy::manageIntegrations`, the `EnsureIntegrationProviderEnabled` route group, `integrationAdmin(Team)`.
- Produces:
  - `PresentIntegrationUserMappings::handle(TeamIntegration): array{members: array<int, array{userId: string, name: string, email: string, avatarUrl: string, mapping: ?array{accountId: ?string, displayName: ?string, matchedBy: string, accountInactive: bool}}>, matching: bool}` and `member(User, ?IntegrationUserMapping): array` (one row).
  - `SaveIntegrationUserMapping::handle(TeamIntegration, User $member, ?string $accountId): IntegrationUserMapping` (manual row; `null` = "Never assign"; 422 on unknown or inactive account).
  - Routes (inside the `w/{workspace}` → `EnsureIntegrationProviderEnabled` group): `GET teams/{team}/integrations/{integration}/user-mappings` `teams.integrations.userMappings.index`; `POST …/user-mappings/match` `teams.integrations.userMappings.match.store` (`throttle:3,1`, 202 `{matching: true}`); `PUT …/user-mappings/{user}` `teams.integrations.userMappings.update` (body `external_account_id`); `DELETE …/user-mappings/{user}` `teams.integrations.userMappings.destroy` (204); `GET …/accounts?q=` `teams.integrations.accounts.index` (`throttle:30,1`, `[{accountId, displayName}]`).

- [ ] **Step 1: Write the failing test**

Create `tests/Feature/Integrations/UserMappingEndpointsTest.php`:

```php
<?php

use App\Enums\IntegrationAccess;
use App\Enums\IntegrationProvider;
use App\Enums\IntegrationUserMatch;
use App\Jobs\MatchIntegrationUsers;
use App\Models\IntegrationUserMapping;
use App\Models\Team;
use App\Models\TeamIntegration;
use App\Models\User;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;

beforeEach(function () {
    Http::preventStrayRequests();
    enableIntegrations(IntegrationProvider::Jira, IntegrationProvider::Linear, IntegrationProvider::Slack);
});

/**
 * @return array<string, mixed>
 */
function mappingRoute(TeamIntegration $integration, ?User $user = null): array
{
    return array_filter([
        'workspace' => $integration->team->workspace,
        'team' => $integration->team,
        'integration' => $integration,
        'user' => $user?->id,
    ]);
}

it('is reserved to workspace owners and admins', function () {
    $integration = TeamIntegration::factory()->jira()->create();
    $member = teamMember($integration->team);

    $this->actingAs($member)->getJson(route('teams.integrations.userMappings.index', mappingRoute($integration)))->assertForbidden();
    $this->actingAs($member)->putJson(route('teams.integrations.userMappings.update', mappingRoute($integration, $member)), ['external_account_id' => null])->assertForbidden();
    $this->actingAs($member)->postJson(route('teams.integrations.userMappings.match.store', mappingRoute($integration)))->assertForbidden();
    $this->actingAs($member)->getJson(route('teams.integrations.accounts.index', mappingRoute($integration)).'?q=ada')->assertForbidden();
});

it('lists every team member with their mapping', function () {
    $integration = TeamIntegration::factory()->jira()->create();
    $admin = integrationAdmin($integration->team);
    $mapped = teamMember($integration->team);
    $never = teamMember($integration->team);
    $inactive = teamMember($integration->team);
    IntegrationUserMapping::factory()->create(['team_integration_id' => $integration->id, 'user_id' => $mapped->id, 'external_account_id' => 'acc-1', 'external_display_name' => 'Ada L.']);
    IntegrationUserMapping::factory()->neverAssign()->create(['team_integration_id' => $integration->id, 'user_id' => $never->id]);
    IntegrationUserMapping::factory()->manual()->create(['team_integration_id' => $integration->id, 'user_id' => $inactive->id, 'account_inactive' => true]);

    $response = $this->actingAs($admin)->getJson(route('teams.integrations.userMappings.index', mappingRoute($integration)))->assertOk();

    $rows = collect($response->json('members'))->keyBy('userId');

    expect($rows)->toHaveCount(4)
        ->and($rows[$admin->id]['mapping'])->toBeNull()
        ->and($rows[$admin->id]['email'])->toBe($admin->email)
        ->and($rows[$mapped->id]['mapping'])->toBe(['accountId' => 'acc-1', 'displayName' => 'Ada L.', 'matchedBy' => 'email', 'accountInactive' => false])
        ->and($rows[$never->id]['mapping']['accountId'])->toBeNull()
        ->and($rows[$never->id]['mapping']['matchedBy'])->toBe('manual')
        ->and($rows[$inactive->id]['mapping']['accountInactive'])->toBeTrue()
        ->and($response->json('matching'))->toBeFalse();
});

it('maps a member manually after checking the account', function () {
    $integration = TeamIntegration::factory()->jira()->create();
    $admin = integrationAdmin($integration->team);
    $member = teamMember($integration->team);
    Http::fake([jiraApiUrl('rest/api/3/user?accountId=acc-ada') => Http::response(jiraAccount('acc-ada', 'Ada L.'))]);

    $this->actingAs($admin)
        ->putJson(route('teams.integrations.userMappings.update', mappingRoute($integration, $member)), ['external_account_id' => 'acc-ada'])
        ->assertOk()
        ->assertJsonPath('userId', $member->id)
        ->assertJsonPath('mapping.accountId', 'acc-ada')
        ->assertJsonPath('mapping.displayName', 'Ada L.')
        ->assertJsonPath('mapping.matchedBy', 'manual');

    expect($integration->accountFor($member)?->matched_by)->toBe(IntegrationUserMatch::Manual);
});

it('refuses unknown or inactive accounts', function (array|int $response, int $status) {
    $integration = TeamIntegration::factory()->jira()->create();
    $admin = integrationAdmin($integration->team);
    $member = teamMember($integration->team);
    Http::fake([jiraApiUrl('rest/api/3/user?accountId=acc-x') => Http::response($response, $status)]);

    $this->actingAs($admin)
        ->putJson(route('teams.integrations.userMappings.update', mappingRoute($integration, $member)), ['external_account_id' => 'acc-x'])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['external_account_id' => 'This Jira account was not found or is inactive.']);

    expect($integration->accountFor($member))->toBeNull();
})->with([
    'unknown' => [['errorMessages' => ['Not found']], 404],
    'inactive' => [jiraAccount('acc-x', 'Gone', active: false), 200],
]);

it('sets never assign and resets a mapping', function () {
    $integration = TeamIntegration::factory()->linear()->create();
    $admin = integrationAdmin($integration->team);
    $member = teamMember($integration->team);

    $this->actingAs($admin)
        ->putJson(route('teams.integrations.userMappings.update', mappingRoute($integration, $member)), ['external_account_id' => null])
        ->assertOk()
        ->assertJsonPath('mapping.accountId', null);

    expect($integration->accountFor($member)?->isNeverAssign())->toBeTrue();

    $this->actingAs($admin)
        ->deleteJson(route('teams.integrations.userMappings.destroy', mappingRoute($integration, $member)))
        ->assertNoContent();

    expect($integration->accountFor($member))->toBeNull();
});

it('only maps current members of the team', function () {
    $integration = TeamIntegration::factory()->jira()->create();
    $admin = integrationAdmin($integration->team);
    $stranger = teamMember(Team::factory()->create());

    $this->actingAs($admin)
        ->putJson(route('teams.integrations.userMappings.update', mappingRoute($integration, $stranger)), ['external_account_id' => null])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['user' => 'This person is not a member of the team.']);
});

it('starts email matching in the background', function () {
    Queue::fake();
    $integration = TeamIntegration::factory()->jira()->create();

    $this->actingAs(integrationAdmin($integration->team))
        ->postJson(route('teams.integrations.userMappings.match.store', mappingRoute($integration)))
        ->assertAccepted()
        ->assertJsonPath('matching', true);

    Queue::assertPushed(MatchIntegrationUsers::class);

    $this->actingAs(integrationAdmin($integration->team))
        ->getJson(route('teams.integrations.userMappings.index', mappingRoute($integration)))
        ->assertJsonPath('matching', true);
});

it('searches accounts without emails or avatars', function () {
    $integration = TeamIntegration::factory()->jira()->create();
    Http::fake([jiraApiUrl('rest/api/3/user/search*') => Http::response([
        [...jiraAccount('acc-1', 'Ada L.', 'ada@example.com'), 'avatarUrls' => ['48x48' => 'https://avatar.example/ada.png']],
    ])]);

    $response = $this->actingAs(integrationAdmin($integration->team))
        ->getJson(route('teams.integrations.accounts.index', mappingRoute($integration)).'?q=ada')
        ->assertOk()
        ->assertExactJson([['accountId' => 'acc-1', 'displayName' => 'Ada L.']]);

    expect($response->getContent())->not->toContain('example');
});

it('validates the account search', function (string $query) {
    $integration = TeamIntegration::factory()->jira()->create();

    $this->actingAs(integrationAdmin($integration->team))
        ->getJson(route('teams.integrations.accounts.index', mappingRoute($integration)).'?q='.urlencode($query))
        ->assertUnprocessable()
        ->assertJsonValidationErrors('q');
})->with(['too short' => 'a', 'too long' => str_repeat('a', 101)]);

it('answers with the state of the connection', function (TeamIntegration $integration, int $status, ?string $message) {
    $response = $this->actingAs(integrationAdmin($integration->team))
        ->getJson(route('teams.integrations.userMappings.index', mappingRoute($integration)))
        ->assertStatus($status);

    if ($message !== null) {
        $response->assertJsonPath('message', $message);
    }
})->with([
    'read only' => [fn () => TeamIntegration::factory()->jira(IntegrationAccess::Read)->create(), 409, 'This Jira connection is read-only.'],
    'reconnect required' => [fn () => TeamIntegration::factory()->linear()->reconnectRequired()->create(), 409, 'Reconnect Linear in the team settings.'],
    'Jira without account scope' => [fn () => TeamIntegration::factory()->jira()->create(['scopes' => ['offline_access', 'read:jira-work', 'write:jira-work']]), 409, 'Reconnect Jira to enable assignee mapping.'],
    'chat channel' => [fn () => TeamIntegration::factory()->slack()->create(), 404, null],
]);

it('does not exist while the provider is disabled', function () {
    $integration = TeamIntegration::factory()->jira()->create();
    disableIntegrations();

    $this->actingAs(integrationAdmin($integration->team))
        ->getJson(route('teams.integrations.userMappings.index', mappingRoute($integration)))
        ->assertNotFound();
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Integrations/UserMappingEndpointsTest.php`
Expected: FAIL — `Route [teams.integrations.userMappings.index] not defined.`

- [ ] **Step 3: Create the presenter and the save action**

Create `app/Actions/Integrations/PresentIntegrationUserMappings.php`:

```php
<?php

namespace App\Actions\Integrations;

use App\Jobs\MatchIntegrationUsers;
use App\Models\IntegrationUserMapping;
use App\Models\TeamIntegration;
use App\Models\User;

class PresentIntegrationUserMappings
{
    /**
     * Current team members only; rows of former members are kept but not
     * listed (spec §3).
     *
     * @return array{
     *     members: array<int, array{
     *         userId: string,
     *         name: string,
     *         email: string,
     *         avatarUrl: string,
     *         mapping: ?array{accountId: ?string, displayName: ?string, matchedBy: string, accountInactive: bool}
     *     }>,
     *     matching: bool
     * }
     */
    public function handle(TeamIntegration $integration): array
    {
        $mappings = $integration->userMappings()->get()->keyBy('user_id');
        $members = $integration->team->members()->orderBy('name')->get();

        return [
            'members' => $members
                ->map(fn (User $member): array => $this->member($member, $mappings->get($member->id)))
                ->values()
                ->all(),
            'matching' => MatchIntegrationUsers::isRunning($integration),
        ];
    }

    /**
     * @return array{
     *     userId: string,
     *     name: string,
     *     email: string,
     *     avatarUrl: string,
     *     mapping: ?array{accountId: ?string, displayName: ?string, matchedBy: string, accountInactive: bool}
     * }
     */
    public function member(User $member, ?IntegrationUserMapping $mapping): array
    {
        return [
            'userId' => $member->id,
            'name' => $member->name,
            'email' => $member->email,
            'avatarUrl' => $member->avatarUrl(),
            'mapping' => $mapping === null ? null : [
                'accountId' => $mapping->external_account_id,
                'displayName' => $mapping->external_display_name,
                'matchedBy' => $mapping->matched_by->value,
                'accountInactive' => $mapping->account_inactive,
            ],
        ];
    }
}
```

Create `app/Actions/Integrations/SaveIntegrationUserMapping.php`:

```php
<?php

namespace App\Actions\Integrations;

use App\Enums\IntegrationUserMatch;
use App\Models\IntegrationUserMapping;
use App\Models\TeamIntegration;
use App\Models\User;
use App\Support\Integrations\IntegrationUserAccounts;
use Illuminate\Validation\ValidationException;

class SaveIntegrationUserMapping
{
    public function __construct(private IntegrationUserAccounts $accounts) {}

    /**
     * A null account id is "Never assign", which automatic matching never
     * overwrites.
     */
    public function handle(TeamIntegration $integration, User $member, ?string $accountId): IntegrationUserMapping
    {
        $account = null;

        if ($accountId !== null) {
            $account = $this->accounts->find($integration, $accountId);

            if ($account === null || ! $account->active) {
                throw ValidationException::withMessages([
                    'external_account_id' => __('This :provider account was not found or is inactive.', ['provider' => $integration->provider->label()]),
                ]);
            }
        }

        return $integration->userMappings()->updateOrCreate(['user_id' => $member->id], [
            'external_account_id' => $account?->id,
            'external_display_name' => $account?->displayName,
            'matched_by' => IntegrationUserMatch::Manual,
            'account_inactive' => false,
            'checked_at' => now(),
        ]);
    }
}
```

- [ ] **Step 4: Create the controllers**

Create `app/Http/Controllers/Integrations/IntegrationUserMappingsController.php`:

```php
<?php

namespace App\Http\Controllers\Integrations;

use App\Actions\Integrations\IntegrationMappingGuard;
use App\Actions\Integrations\PresentIntegrationUserMappings;
use App\Actions\Integrations\SaveIntegrationUserMapping;
use App\Http\Controllers\Controller;
use App\Models\Team;
use App\Models\TeamIntegration;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\ValidationException;

/**
 * `{user}` is read as a plain id: a scoped binding would look for a
 * users() relation on the integration.
 */
class IntegrationUserMappingsController extends Controller
{
    public function __construct(private PresentIntegrationUserMappings $presentMappings) {}

    public function index(Workspace $workspace, Team $team, TeamIntegration $integration): JsonResponse
    {
        Gate::authorize('manageIntegrations', $team);

        IntegrationMappingGuard::ensureMappable($integration);

        return response()->json($this->presentMappings->handle($integration));
    }

    public function update(Request $request, Workspace $workspace, Team $team, TeamIntegration $integration, string $user, SaveIntegrationUserMapping $saveMapping): JsonResponse
    {
        Gate::authorize('manageIntegrations', $team);

        IntegrationMappingGuard::ensureMappable($integration);

        $validated = $request->validate([
            'external_account_id' => ['present', 'nullable', 'string', 'max:128'],
        ]);

        $member = $this->member($team, $user);
        $mapping = $saveMapping->handle($integration, $member, $validated['external_account_id']);

        return response()->json($this->presentMappings->member($member, $mapping));
    }

    public function destroy(Workspace $workspace, Team $team, TeamIntegration $integration, string $user): Response
    {
        Gate::authorize('manageIntegrations', $team);

        IntegrationMappingGuard::ensureMappable($integration);

        $member = $this->member($team, $user);

        $integration->userMappings()->where('user_id', $member->id)->delete();

        return response()->noContent();
    }

    private function member(Team $team, string $userId): User
    {
        $member = $team->members()->whereKey($userId)->first();

        if ($member === null) {
            throw ValidationException::withMessages(['user' => __('This person is not a member of the team.')]);
        }

        return $member;
    }
}
```

Create `app/Http/Controllers/Integrations/IntegrationUserMatchesController.php`:

```php
<?php

namespace App\Http\Controllers\Integrations;

use App\Actions\Integrations\IntegrationMappingGuard;
use App\Http\Controllers\Controller;
use App\Jobs\MatchIntegrationUsers;
use App\Models\Team;
use App\Models\TeamIntegration;
use App\Models\Workspace;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Gate;

class IntegrationUserMatchesController extends Controller
{
    public function store(Workspace $workspace, Team $team, TeamIntegration $integration): JsonResponse
    {
        Gate::authorize('manageIntegrations', $team);

        IntegrationMappingGuard::ensureMappable($integration);

        MatchIntegrationUsers::start($integration);

        return response()->json(['matching' => true], 202);
    }
}
```

Create `app/Http/Controllers/Integrations/IntegrationAccountsController.php`:

```php
<?php

namespace App\Http\Controllers\Integrations;

use App\Actions\Integrations\IntegrationMappingGuard;
use App\Http\Controllers\Controller;
use App\Models\Team;
use App\Models\TeamIntegration;
use App\Models\Workspace;
use App\Support\Integrations\ExternalAccount;
use App\Support\Integrations\IntegrationUserAccounts;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

class IntegrationAccountsController extends Controller
{
    public function index(Request $request, Workspace $workspace, Team $team, TeamIntegration $integration, IntegrationUserAccounts $accounts): JsonResponse
    {
        Gate::authorize('manageIntegrations', $team);

        IntegrationMappingGuard::ensureMappable($integration);

        $validated = $request->validate(['q' => ['required', 'string', 'min:2', 'max:100']]);

        return response()->json(array_map(
            fn (ExternalAccount $account): array => $account->toArray(),
            $accounts->search($integration, $validated['q']),
        ));
    }
}
```

- [ ] **Step 5: Register the routes**

In `routes/web.php`, import the three controllers and add inside the `Route::middleware(EnsureIntegrationProviderEnabled::class)->group(…)` block of the `w/{workspace}` group (after Plan 12a's `teams.integrations.detection.store` route):

```php
                Route::get('teams/{team}/integrations/{integration}/user-mappings', [IntegrationUserMappingsController::class, 'index'])
                    ->whereUuid('integration')
                    ->name('teams.integrations.userMappings.index');
                Route::post('teams/{team}/integrations/{integration}/user-mappings/match', [IntegrationUserMatchesController::class, 'store'])
                    ->whereUuid('integration')
                    ->middleware('throttle:3,1')
                    ->name('teams.integrations.userMappings.match.store');
                Route::put('teams/{team}/integrations/{integration}/user-mappings/{user}', [IntegrationUserMappingsController::class, 'update'])
                    ->whereUuid(['integration', 'user'])
                    ->name('teams.integrations.userMappings.update');
                Route::delete('teams/{team}/integrations/{integration}/user-mappings/{user}', [IntegrationUserMappingsController::class, 'destroy'])
                    ->whereUuid(['integration', 'user'])
                    ->name('teams.integrations.userMappings.destroy');
                Route::get('teams/{team}/integrations/{integration}/accounts', [IntegrationAccountsController::class, 'index'])
                    ->whereUuid('integration')
                    ->middleware('throttle:30,1')
                    ->name('teams.integrations.accounts.index');
```

Run `vendor/bin/sail artisan wayfinder:generate --with-form`.

- [ ] **Step 6: Add the translations**

Append to `lang/{en,fr,es,de}.json`:

| Key (en) | fr | es | de |
|---|---|---|---|
| `This :provider account was not found or is inactive.` | `Ce compte :provider est introuvable ou inactif.` | `Esta cuenta de :provider no existe o está inactiva.` | `Dieses :provider-Konto wurde nicht gefunden oder ist inaktiv.` |
| `This person is not a member of the team.` | `Cette personne n'est pas membre de l'équipe.` | `Esta persona no es miembro del equipo.` | `Diese Person ist kein Mitglied des Teams.` |

- [ ] **Step 7: Run the tests to verify they pass**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Integrations/UserMappingEndpointsTest.php tests/Feature/TranslationKeysTest.php`
Expected: PASS.

- [ ] **Step 8: Format, analyse and commit**

```bash
vendor/bin/sail bin pint --dirty --format agent
vendor/bin/sail bin phpstan analyse --no-progress
git add app/Actions/Integrations/PresentIntegrationUserMappings.php app/Actions/Integrations/SaveIntegrationUserMapping.php app/Http/Controllers/Integrations routes/web.php tests/Feature/Integrations/UserMappingEndpointsTest.php lang
git commit -m "feat: let admins map team members to Jira and Linear accounts

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SosW8d2Uj7QxsF1tws5ssS"
```

---

### Task 5: Priority mapping (`priorities` endpoint, `priority_map` settings)

**Files:**
- Create: `app/Actions/Integrations/ListProviderPriorities.php`, `app/Http/Controllers/Integrations/IntegrationPrioritiesController.php`
- Modify: `app/Actions/Integrations/UpdateTeamIntegration.php`, `app/Actions/Integrations/PresentTeamIntegration.php`, `routes/web.php`, `lang/{en,fr,es,de}.json`
- Test: create `tests/Feature/Integrations/PriorityMappingTest.php`

**Interfaces:**
- Consumes: Plan 12a `UpdateTeamIntegration::{rules(TeamIntegration): array, handle(TeamIntegration, User, array): TeamIntegration}`, `PresentTeamIntegration::SettingKeys`, route `teams.integrations.update`; `LinearPriority` (Task 2), `IntegrationMappingGuard::ensureTracker` (Task 3).
- Produces:
  - `ListProviderPriorities::handle(TeamIntegration): array<int, array{id: string|int, name: string}>` (Jira `GET rest/api/3/priority/search?maxResults=100`; Linear `LinearPriority::options()`).
  - `UpdateTeamIntegration::DefaultPriority = 'default'`; PATCH body `priority_map: {high?, medium?, low?}` (Jira: priority id, `null` = "Don't set", `"default"`; Linear: 0–4 or `"default"`) stored in `settings.priorityMap` as Jira `{id, name}|null` / Linear int, `"default"` removing the key.
  - `PresentTeamIntegration::SettingKeys` lists `priorityMap` for `jira` and `linear`.
  - Route `GET teams/{team}/integrations/{integration}/priorities` `teams.integrations.priorities.index` (Owners/Admins).

- [ ] **Step 1: Write the failing test**

Create `tests/Feature/Integrations/PriorityMappingTest.php`:

```php
<?php

use App\Enums\IntegrationAccess;
use App\Enums\IntegrationProvider;
use App\Models\TeamIntegration;
use Illuminate\Support\Facades\Http;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    Http::preventStrayRequests();
    enableIntegrations(IntegrationProvider::Jira, IntegrationProvider::Linear, IntegrationProvider::Slack);
});

function fakeJiraPriorities(): void
{
    Http::fake([jiraApiUrl('rest/api/3/priority/search*') => Http::response(['values' => [
        ['id' => '1', 'name' => 'Highest'],
        ['id' => '2', 'name' => 'High'],
        ['id' => '3', 'name' => 'Medium'],
        ['id' => '4', 'name' => 'Low'],
    ]])]);
}

/**
 * @return array<string, mixed>
 */
function priorityRoute(TeamIntegration $integration): array
{
    return ['workspace' => $integration->team->workspace, 'team' => $integration->team, 'integration' => $integration];
}

it('lists the priorities of the provider', function () {
    fakeJiraPriorities();
    $jira = TeamIntegration::factory()->jira()->create();
    $linear = TeamIntegration::factory()->linear()->create();

    $this->actingAs(integrationAdmin($jira->team))
        ->getJson(route('teams.integrations.priorities.index', priorityRoute($jira)))
        ->assertOk()
        ->assertJsonPath('0', ['id' => '1', 'name' => 'Highest'])
        ->assertJsonCount(4);

    $this->actingAs(integrationAdmin($linear->team))
        ->getJson(route('teams.integrations.priorities.index', priorityRoute($linear)))
        ->assertOk()
        ->assertJsonPath('2', ['id' => 2, 'name' => 'High'])
        ->assertJsonCount(5);
});

it('keeps the priorities to owners and admins of trackers', function () {
    $jira = TeamIntegration::factory()->jira()->create();
    $slack = TeamIntegration::factory()->slack()->create();

    $this->actingAs(teamMember($jira->team))->getJson(route('teams.integrations.priorities.index', priorityRoute($jira)))->assertForbidden();
    $this->actingAs(integrationAdmin($slack->team))->getJson(route('teams.integrations.priorities.index', priorityRoute($slack)))->assertNotFound();
});

it('maps Jira priorities, "Don\'t set" and defaults', function () {
    fakeJiraPriorities();
    $integration = TeamIntegration::factory()->jira()->create();
    $admin = integrationAdmin($integration->team);

    $this->actingAs($admin)
        ->patchJson(route('teams.integrations.update', priorityRoute($integration)), ['priority_map' => ['high' => '1', 'low' => null]])
        ->assertOk()
        ->assertJsonPath('settings.priorityMap.high', ['id' => '1', 'name' => 'Highest'])
        ->assertJsonPath('settings.priorityMap.low', null);

    $this->actingAs($admin)
        ->patchJson(route('teams.integrations.update', priorityRoute($integration)), ['priority_map' => ['high' => 'default']])
        ->assertOk()
        ->assertJsonMissingPath('settings.priorityMap.high')
        ->assertJsonPath('settings.priorityMap.low', null);
});

it('refuses priorities that are not on the Jira site', function () {
    fakeJiraPriorities();
    $integration = TeamIntegration::factory()->jira()->create();

    $this->actingAs(integrationAdmin($integration->team))
        ->patchJson(route('teams.integrations.update', priorityRoute($integration)), ['priority_map' => ['high' => '99']])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('priority_map.high');
});

it('maps Linear priorities within its scale', function () {
    $integration = TeamIntegration::factory()->linear()->create();
    $admin = integrationAdmin($integration->team);

    $this->actingAs($admin)
        ->patchJson(route('teams.integrations.update', priorityRoute($integration)), ['priority_map' => ['high' => 1, 'medium' => 0]])
        ->assertOk()
        ->assertJsonPath('settings.priorityMap.high', 1)
        ->assertJsonPath('settings.priorityMap.medium', 0);

    $this->actingAs($admin)
        ->patchJson(route('teams.integrations.update', priorityRoute($integration)), ['priority_map' => ['low' => 5]])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('priority_map.low');

    $this->actingAs($admin)
        ->patchJson(route('teams.integrations.update', priorityRoute($integration)), ['priority_map' => ['urgent' => 1]])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('priority_map');
});

it('refuses a priority mapping on a read-only connection', function () {
    $integration = TeamIntegration::factory()->linear(IntegrationAccess::Read)->create();

    $this->actingAs(integrationAdmin($integration->team))
        ->patchJson(route('teams.integrations.update', priorityRoute($integration)), ['priority_map' => ['high' => 1]])
        ->assertConflict()
        ->assertJsonPath('message', 'This Linear connection is read-only.');
});

it('shows the mapping on the integrations page', function () {
    $integration = TeamIntegration::factory()->linear()->create(['settings' => [
        'organizationId' => 'org-1', 'organizationName' => 'Acme', 'urlKey' => 'acme', 'priorityMap' => ['high' => 1],
    ]]);

    $this->actingAs(integrationAdmin($integration->team))
        ->get(route('teams.integrations.index', [$integration->team->workspace, $integration->team]))
        ->assertInertia(fn (Assert $page) => $page
            ->where('providers.2.provider', 'linear')
            ->where('providers.2.connection.settings.priorityMap', ['high' => 1]));
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Integrations/PriorityMappingTest.php`
Expected: FAIL — `Route [teams.integrations.priorities.index] not defined.`

- [ ] **Step 3: Create the priorities list and endpoint**

Create `app/Actions/Integrations/ListProviderPriorities.php`:

```php
<?php

namespace App\Actions\Integrations;

use App\Enums\IntegrationProvider;
use App\Models\TeamIntegration;
use App\Support\Integrations\Jira\JiraClient;
use App\Support\Integrations\Linear\LinearPriority;

class ListProviderPriorities
{
    private const JiraLimit = 100;

    public function __construct(private JiraClient $jira) {}

    /**
     * @return array<int, array{id: string|int, name: string}>
     */
    public function handle(TeamIntegration $integration): array
    {
        if ($integration->provider === IntegrationProvider::Linear) {
            return LinearPriority::options();
        }

        $response = $this->jira->get($integration, 'rest/api/3/priority/search', ['maxResults' => self::JiraLimit]);

        $priorities = [];

        foreach ((array) ($response['values'] ?? []) as $priority) {
            if (! is_array($priority) || ! is_string($priority['id'] ?? null) || ! is_string($priority['name'] ?? null)) {
                continue;
            }

            $priorities[] = ['id' => $priority['id'], 'name' => $priority['name']];
        }

        return $priorities;
    }
}
```

Create `app/Http/Controllers/Integrations/IntegrationPrioritiesController.php`:

```php
<?php

namespace App\Http\Controllers\Integrations;

use App\Actions\Integrations\IntegrationMappingGuard;
use App\Actions\Integrations\ListProviderPriorities;
use App\Http\Controllers\Controller;
use App\Models\Team;
use App\Models\TeamIntegration;
use App\Models\Workspace;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Gate;

class IntegrationPrioritiesController extends Controller
{
    public function index(Workspace $workspace, Team $team, TeamIntegration $integration, ListProviderPriorities $listPriorities): JsonResponse
    {
        Gate::authorize('manageIntegrations', $team);

        IntegrationMappingGuard::ensureTracker($integration);

        return response()->json($listPriorities->handle($integration));
    }
}
```

In `routes/web.php`, import the controller and add in the same group as Task 4's routes:

```php
                Route::get('teams/{team}/integrations/{integration}/priorities', [IntegrationPrioritiesController::class, 'index'])
                    ->whereUuid('integration')
                    ->name('teams.integrations.priorities.index');
```

Run `vendor/bin/sail artisan wayfinder:generate --with-form`.

- [ ] **Step 4: Extend the settings update**

In `app/Actions/Integrations/UpdateTeamIntegration.php`:
- import `App\Support\Integrations\Linear\LinearPriority` and `Closure`;
- add `public const DefaultPriority = 'default';` and the property `/** @var array<int, array{id: string|int, name: string}>|null */ private ?array $jiraPriorities = null;` (it memoizes the provider's priorities for one request: validation, then save);
- add `private ListProviderPriorities $listPriorities,` to the constructor;
- in `rules()`, append to the Jira arm and replace `default => []` by a Linear arm plus the default:

```php
            IntegrationProvider::Jira => [
                'cloud_id' => ['sometimes', 'required', 'string', Rule::in($this->ids($integration->setting('sites', []), 'cloudId'))],
                'story_point_field_id' => ['sometimes', 'required', 'string', Rule::in($this->ids($integration->setting('numberFields', []), 'id'))],
                'priority_map' => ['sometimes', 'array:high,medium,low'],
                'priority_map.*' => ['nullable', 'string', 'max:50', $this->jiraPriorityRule($integration)],
            ],
            IntegrationProvider::Linear => [
                'priority_map' => ['sometimes', 'array:high,medium,low'],
                'priority_map.*' => ['required', Rule::in([...array_map('strval', LinearPriority::Scale), self::DefaultPriority])],
            ],
            default => [],
```

- at the end of `handle()`, before `return $integration->refresh();`, add:

```php
        if (is_array($validated['priority_map'] ?? null)) {
            $integration->ensureWritable();

            $integration = $this->savePriorityMap($integration, $validated['priority_map']);
        }
```

- add the helpers:

```php
    /**
     * @param  array<string, mixed>  $changes
     */
    private function savePriorityMap(TeamIntegration $integration, array $changes): TeamIntegration
    {
        $map = (array) $integration->setting('priorityMap', []);

        foreach ($changes as $level => $value) {
            if ($value === self::DefaultPriority) {
                unset($map[$level]);

                continue;
            }

            $map[$level] = $integration->provider === IntegrationProvider::Jira
                ? $this->jiraPriority($integration, $value)
                : (int) $value;
        }

        $integration->forceFill(['settings' => [...$integration->settings, 'priorityMap' => $map]])->save();

        return $integration;
    }

    /**
     * @return array{id: string, name: string}|null
     */
    private function jiraPriority(TeamIntegration $integration, mixed $id): ?array
    {
        if (! is_string($id)) {
            return null;
        }

        foreach ($this->jiraPriorities($integration) as $priority) {
            if ($priority['id'] === $id) {
                return ['id' => $id, 'name' => $priority['name']];
            }
        }

        return null;
    }

    private function jiraPriorityRule(TeamIntegration $integration): Closure
    {
        return function (string $attribute, mixed $value, Closure $fail) use ($integration): void {
            if ($value === null || $value === self::DefaultPriority) {
                return;
            }

            $ids = array_map(fn (array $priority): string => (string) $priority['id'], $this->jiraPriorities($integration));

            if (! in_array($value, $ids, true)) {
                $fail(__('Choose one of the priorities of this Jira site.'));
            }
        };
    }

    /**
     * @return array<int, array{id: string|int, name: string}>
     */
    private function jiraPriorities(TeamIntegration $integration): array
    {
        return $this->jiraPriorities ??= $this->listPriorities->handle($integration);
    }
```

- in `app/Actions/Integrations/PresentTeamIntegration.php`, change the `jira` and `linear` entries of `SettingKeys` to:

```php
        'jira' => ['cloudId', 'siteName', 'siteUrl', 'sites', 'storyPointFields', 'numberFields', 'priorityMap'],
        'linear' => ['organizationName', 'urlKey', 'priorityMap'],
```

- [ ] **Step 5: Add the translations**

Append to `lang/{en,fr,es,de}.json`:

| Key (en) | fr | es | de |
|---|---|---|---|
| `Choose one of the priorities of this Jira site.` | `Choisissez l'une des priorités de ce site Jira.` | `Elige una de las prioridades de este sitio de Jira.` | `Wähle eine der Prioritäten dieser Jira-Site.` |

- [ ] **Step 6: Run the tests to verify they pass**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Integrations/PriorityMappingTest.php tests/Feature/Integrations/ConnectJiraTest.php tests/Feature/Integrations/IntegrationsPageTest.php tests/Feature/TranslationKeysTest.php`
Expected: PASS.

- [ ] **Step 7: Format, analyse and commit**

```bash
vendor/bin/sail bin pint --dirty --format agent
vendor/bin/sail bin phpstan analyse --no-progress
git add app/Actions/Integrations app/Http/Controllers/Integrations/IntegrationPrioritiesController.php routes/web.php tests/Feature/Integrations/PriorityMappingTest.php lang
git commit -m "feat: map skrum priorities to Jira and Linear priorities

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SosW8d2Uj7QxsF1tws5ssS"
```

---
### Task 6: Export targets and export sources

**Files:**
- Create: `app/Actions/Integrations/ListExportTargets.php`, `app/Actions/Integrations/ListExportSources.php`, `app/Http/Controllers/Integrations/IntegrationTargetsController.php`
- Modify: `app/Actions/Retros/BuildBoardSnapshot.php`, `app/Http/Controllers/WorkspaceActionItemsController.php`, `routes/web.php`
- Test: create `tests/Feature/Integrations/ExportTargetsTest.php`

**Interfaces:**
- Consumes: `IntegrationMappingGuard::ensureTracker` (Task 3); Plan 12a `JiraClient::get`, `LinearClient::query`, `TeamIntegration::{canWrite, setting}`, `Team::integrations()`, `IntegrationProvider::{isTracker, isEnabled, label, anyEnabled}`.
- Produces:
  - `ListExportTargets::handle(TeamIntegration, ?string $projectId = null, ?string $query = null): array` — Jira `{projects: [{id, key, name}], issueTypes: [{id, name}], defaults: {projectId: ?string, issueTypeId: ?string}}`; Linear `{teams: [{id, key, name}], defaults: {teamId: ?string}}`. Defaults: the saved `exportProjectId`/`exportIssueTypeId`/`exportTeamId` when still listed, else the first project, the issue type named "Task" (else the first), the first team.
  - `ListExportSources::forTeam(Team): array<int, array{source: string, label: string, integrationId: string}>` and `forTeams(Collection<int, Team>): array<string, array<int, array{source, label, integrationId}>>` (enabled, active, write-enabled Jira/Linear integrations; `[]` when no provider is enabled).
  - Route `GET teams/{team}/integrations/{integration}/targets` `teams.integrations.targets.index` (any team viewer; `throttle:30,1`; `?project_id=` digits, `?q=` ≤ 100).
  - Board snapshot key `exportSources` (after `carriedActionItemsHasMore`; `[]` for guests); `action-items/index` prop `exportSources` (keyed by team id).

- [ ] **Step 1: Write the failing test**

Create `tests/Feature/Integrations/ExportTargetsTest.php`:

```php
<?php

use App\Enums\IntegrationAccess;
use App\Enums\IntegrationProvider;
use App\Enums\RetroPhase;
use App\Models\Participant;
use App\Models\Retro;
use App\Models\Team;
use App\Models\TeamIntegration;
use Illuminate\Http\Client\Request as HttpClientRequest;
use Illuminate\Support\Facades\Http;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    Http::preventStrayRequests();
    enableIntegrations(IntegrationProvider::Jira, IntegrationProvider::Linear, IntegrationProvider::Slack);
});

/**
 * @param  array<string, string>  $query
 */
function targetsUrl(TeamIntegration $integration, array $query = []): string
{
    $url = route('teams.integrations.targets.index', [$integration->team->workspace, $integration->team, $integration]);

    return $query === [] ? $url : $url.'?'.http_build_query($query);
}

function fakeJiraTargets(): void
{
    Http::fake([
        jiraApiUrl('rest/api/3/project/search*') => Http::response(['values' => [
            ['id' => '10000', 'key' => 'PROJ', 'name' => 'Project'],
            ['id' => '10001', 'key' => 'OPS', 'name' => 'Operations'],
        ]]),
        jiraApiUrl('rest/api/3/issuetype/project*') => fn (HttpClientRequest $request) => Http::response($request['projectId'] === '10001'
            ? [['id' => '20', 'name' => 'Incident', 'subtask' => false]]
            : [['id' => '10', 'name' => 'Bug', 'subtask' => false], ['id' => '11', 'name' => 'Task', 'subtask' => false], ['id' => '12', 'name' => 'Sub-task', 'subtask' => true]]),
    ]);
}

it('lists Jira projects and preselects the Task issue type', function () {
    fakeJiraTargets();
    $integration = TeamIntegration::factory()->jira()->create();

    $this->actingAs(teamMember($integration->team))->getJson(targetsUrl($integration))
        ->assertOk()
        ->assertExactJson([
            'projects' => [['id' => '10000', 'key' => 'PROJ', 'name' => 'Project'], ['id' => '10001', 'key' => 'OPS', 'name' => 'Operations']],
            'issueTypes' => [['id' => '10', 'name' => 'Bug'], ['id' => '11', 'name' => 'Task']],
            'defaults' => ['projectId' => '10000', 'issueTypeId' => '11'],
        ]);

    Http::assertSent(fn (HttpClientRequest $request) => str_contains($request->url(), 'project/search') && $request['action'] === 'create');
});

it('preselects the last target and lists the issue types of a chosen project', function () {
    fakeJiraTargets();
    $integration = TeamIntegration::factory()->jira()->create();
    $integration->forceFill(['settings' => [...$integration->settings, 'exportProjectId' => '10001', 'exportIssueTypeId' => '20']])->save();
    $member = teamMember($integration->team);

    $this->actingAs($member)->getJson(targetsUrl($integration))
        ->assertJsonPath('defaults', ['projectId' => '10001', 'issueTypeId' => '20']);

    $this->actingAs($member)->getJson(targetsUrl($integration, ['project_id' => '10000']))
        ->assertJsonPath('defaults.projectId', '10000')
        ->assertJsonPath('issueTypes.1.name', 'Task');
});

it('lists Linear teams', function () {
    fakeLinearGraphql(['teams(' => ['teams' => ['nodes' => [
        ['id' => '6a1f0c1e-4e8b-4a55-9b53-3c0b5f1f0a01', 'key' => 'ENG', 'name' => 'Engineering'],
        ['id' => '6a1f0c1e-4e8b-4a55-9b53-3c0b5f1f0a02', 'key' => 'OPS', 'name' => 'Operations'],
    ]]]]);
    $integration = TeamIntegration::factory()->linear()->create();
    $integration->forceFill(['settings' => [...$integration->settings, 'exportTeamId' => '6a1f0c1e-4e8b-4a55-9b53-3c0b5f1f0a02']])->save();

    $this->actingAs(teamMember($integration->team))->getJson(targetsUrl($integration))
        ->assertOk()
        ->assertJsonPath('teams.0.key', 'ENG')
        ->assertJsonPath('defaults.teamId', '6a1f0c1e-4e8b-4a55-9b53-3c0b5f1f0a02');
});

it('refuses outsiders, read-only connections and chat channels', function () {
    $jira = TeamIntegration::factory()->jira()->create();
    $read = TeamIntegration::factory()->linear(IntegrationAccess::Read)->create();
    $slack = TeamIntegration::factory()->slack()->create();

    $this->actingAs(teamMember(Team::factory()->create()))->getJson(targetsUrl($jira))->assertForbidden();
    $this->actingAs(teamMember(Team::factory()->create(['workspace_id' => $jira->team->workspace_id])))->getJson(targetsUrl($jira))->assertForbidden();
    $this->actingAs(teamMember($read->team))->getJson(targetsUrl($read))->assertConflict();
    $this->actingAs(teamMember($slack->team))->getJson(targetsUrl($slack))->assertNotFound();
    $this->actingAs(teamMember($jira->team))->getJson(targetsUrl($jira, ['project_id' => '../x']))->assertUnprocessable();
});

it('offers export sources to members on the board', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Discussing)->withGuestAccess()->create();
    $jira = TeamIntegration::factory()->jira()->create(['team_id' => $retro->team_id]);
    TeamIntegration::factory()->linear(IntegrationAccess::Read)->create(['team_id' => $retro->team_id]);
    TeamIntegration::factory()->slack()->create(['team_id' => $retro->team_id]);
    [$user] = retroMember($retro);
    $guest = Participant::factory()->guest()->create(['retro_id' => $retro->id]);

    $this->actingAs($user)->getJson(route('retros.snapshot.show', $retro))
        ->assertJsonPath('exportSources', [['source' => 'jira', 'label' => 'Jira', 'integrationId' => $jira->id]]);

    $this->withCookies(retroGuestCookie($guest))->withCredentials()
        ->getJson(route('retros.snapshot.show', $retro))
        ->assertJsonPath('exportSources', []);

    disableIntegrations();

    $this->actingAs($user)->getJson(route('retros.snapshot.show', $retro))->assertJsonPath('exportSources', []);
});

it('offers export sources per team on the action items page', function () {
    $team = Team::factory()->create();
    $linear = TeamIntegration::factory()->linear()->create(['team_id' => $team->id]);
    TeamIntegration::factory()->jira()->reconnectRequired()->create(['team_id' => $team->id]);

    $this->actingAs(teamMember($team))
        ->get(route('workspaces.actionItems.index', $team->workspace))
        ->assertInertia(fn (Assert $page) => $page->where("exportSources.{$team->id}", [
            ['source' => 'linear', 'label' => 'Linear', 'integrationId' => $linear->id],
        ]));
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Integrations/ExportTargetsTest.php`
Expected: FAIL — `Route [teams.integrations.targets.index] not defined.`

- [ ] **Step 3: Create the targets and sources**

Create `app/Actions/Integrations/ListExportTargets.php`:

```php
<?php

namespace App\Actions\Integrations;

use App\Enums\IntegrationProvider;
use App\Models\TeamIntegration;
use App\Support\Integrations\Jira\JiraClient;
use App\Support\Integrations\Linear\LinearClient;
use Illuminate\Support\Str;

class ListExportTargets
{
    private const ProjectLimit = 50;

    private const TeamLimit = 100;

    private const PreferredIssueType = 'task';

    public function __construct(private JiraClient $jira, private LinearClient $linear) {}

    /**
     * @return array<string, mixed>
     */
    public function handle(TeamIntegration $integration, ?string $projectId = null, ?string $query = null): array
    {
        if ($integration->provider === IntegrationProvider::Linear) {
            return $this->linearTargets($integration);
        }

        return $this->jiraTargets($integration, $projectId, $query);
    }

    /**
     * @return array{
     *     projects: array<int, array{id: string, key: string, name: string}>,
     *     issueTypes: array<int, array{id: string, name: string}>,
     *     defaults: array{projectId: ?string, issueTypeId: ?string}
     * }
     */
    private function jiraTargets(TeamIntegration $integration, ?string $projectId, ?string $query): array
    {
        $response = $this->jira->get($integration, 'rest/api/3/project/search', array_filter([
            'maxResults' => self::ProjectLimit,
            'orderBy' => 'name',
            'action' => 'create',
            'query' => $query,
        ], fn (mixed $value): bool => $value !== null));

        $projects = [];

        foreach ((array) ($response['values'] ?? []) as $project) {
            if (! is_array($project) || ! is_string($project['id'] ?? null)) {
                continue;
            }

            $projects[] = ['id' => $project['id'], 'key' => (string) ($project['key'] ?? ''), 'name' => (string) ($project['name'] ?? '')];
        }

        $selected = $projectId ?? $this->listed($projects, $integration->setting('exportProjectId')) ?? ($projects[0]['id'] ?? null);
        $issueTypes = $selected === null ? [] : $this->issueTypes($integration, $selected);

        return [
            'projects' => $projects,
            'issueTypes' => $issueTypes,
            'defaults' => ['projectId' => $selected, 'issueTypeId' => $this->defaultIssueType($integration, $issueTypes)],
        ];
    }

    /**
     * @return array<int, array{id: string, name: string}>
     */
    private function issueTypes(TeamIntegration $integration, string $projectId): array
    {
        $types = [];

        foreach ($this->jira->get($integration, 'rest/api/3/issuetype/project', ['projectId' => $projectId]) as $type) {
            if (! is_array($type) || ! is_string($type['id'] ?? null) || ($type['subtask'] ?? false) === true) {
                continue;
            }

            $types[] = ['id' => $type['id'], 'name' => (string) ($type['name'] ?? '')];
        }

        return $types;
    }

    /**
     * @param  array<int, array{id: string, name: string}>  $issueTypes
     */
    private function defaultIssueType(TeamIntegration $integration, array $issueTypes): ?string
    {
        $saved = $this->listed($issueTypes, $integration->setting('exportIssueTypeId'));

        if ($saved !== null) {
            return $saved;
        }

        foreach ($issueTypes as $type) {
            if (Str::lower($type['name']) === self::PreferredIssueType) {
                return $type['id'];
            }
        }

        return $issueTypes[0]['id'] ?? null;
    }

    /**
     * @return array{teams: array<int, array{id: string, key: string, name: string}>, defaults: array{teamId: ?string}}
     */
    private function linearTargets(TeamIntegration $integration): array
    {
        $data = $this->linear->query($integration, 'query Teams($first: Int!) { teams(first: $first) { nodes { id key name } } }', ['first' => self::TeamLimit]);

        $teams = [];

        foreach ((array) data_get($data, 'teams.nodes', []) as $team) {
            if (! is_array($team) || ! is_string($team['id'] ?? null)) {
                continue;
            }

            $teams[] = ['id' => $team['id'], 'key' => (string) ($team['key'] ?? ''), 'name' => (string) ($team['name'] ?? '')];
        }

        return [
            'teams' => $teams,
            'defaults' => ['teamId' => $this->listed($teams, $integration->setting('exportTeamId')) ?? ($teams[0]['id'] ?? null)],
        ];
    }

    /**
     * @param  array<int, array{id: string}>  $items
     */
    private function listed(array $items, mixed $id): ?string
    {
        foreach ($items as $item) {
            if ($item['id'] === $id) {
                return $item['id'];
            }
        }

        return null;
    }
}
```

Create `app/Actions/Integrations/ListExportSources.php`:

```php
<?php

namespace App\Actions\Integrations;

use App\Enums\IntegrationProvider;
use App\Models\Team;
use App\Models\TeamIntegration;
use Illuminate\Database\Eloquent\Collection;

/**
 * The trackers an action item of a team can be exported to right now;
 * the item card shows one entry per source.
 */
class ListExportSources
{
    /**
     * @return array<int, array{source: string, label: string, integrationId: string}>
     */
    public function forTeam(Team $team): array
    {
        if (! IntegrationProvider::anyEnabled()) {
            return [];
        }

        return $team->integrations
            ->filter(fn (TeamIntegration $integration): bool => $integration->provider->isTracker()
                && $integration->provider->isEnabled()
                && $integration->canWrite())
            ->sortBy(fn (TeamIntegration $integration): string => $integration->provider->value)
            ->map(fn (TeamIntegration $integration): array => [
                'source' => $integration->provider->value,
                'label' => $integration->provider->label(),
                'integrationId' => $integration->id,
            ])
            ->values()
            ->all();
    }

    /**
     * @param  Collection<int, Team>  $teams
     * @return array<string, array<int, array{source: string, label: string, integrationId: string}>>
     */
    public function forTeams(Collection $teams): array
    {
        if (! IntegrationProvider::anyEnabled()) {
            return [];
        }

        $teams->loadMissing('integrations');

        return $teams->mapWithKeys(fn (Team $team): array => [$team->id => $this->forTeam($team)])->all();
    }
}
```

Create `app/Http/Controllers/Integrations/IntegrationTargetsController.php`:

```php
<?php

namespace App\Http\Controllers\Integrations;

use App\Actions\Integrations\IntegrationMappingGuard;
use App\Actions\Integrations\ListExportTargets;
use App\Http\Controllers\Controller;
use App\Models\Team;
use App\Models\TeamIntegration;
use App\Models\Workspace;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

class IntegrationTargetsController extends Controller
{
    public function index(Request $request, Workspace $workspace, Team $team, TeamIntegration $integration, ListExportTargets $listTargets): JsonResponse
    {
        Gate::authorize('view', $team);

        IntegrationMappingGuard::ensureTracker($integration);

        $validated = $request->validate([
            'project_id' => ['nullable', 'string', 'regex:/^\d{1,20}$/'],
            'q' => ['nullable', 'string', 'max:100'],
        ]);

        return response()->json($listTargets->handle($integration, $validated['project_id'] ?? null, $validated['q'] ?? null));
    }
}
```

In `routes/web.php`, import the controller and add in the `EnsureIntegrationProviderEnabled` group next to Task 4's routes:

```php
                Route::get('teams/{team}/integrations/{integration}/targets', [IntegrationTargetsController::class, 'index'])
                    ->whereUuid('integration')
                    ->middleware('throttle:30,1')
                    ->name('teams.integrations.targets.index');
```

Run `vendor/bin/sail artisan wayfinder:generate --with-form`.

- [ ] **Step 4: Expose the sources**

In `app/Actions/Retros/BuildBoardSnapshot.php`, import `App\Actions\Integrations\ListExportSources`, add `private ListExportSources $listExportSources,` as the last constructor parameter, and add right after `'carriedActionItemsHasMore' => $carried['hasMore'],`:

```php
            'exportSources' => $viewer->isGuest() ? [] : $this->listExportSources->forTeam($retro->team),
```

In `app/Http/Controllers/WorkspaceActionItemsController.php`, import `App\Actions\Integrations\ListExportSources`, add `private ListExportSources $listExportSources,` as the last constructor parameter, and add to the `action-items/index` props after `'realtimeTeamIds' => …,`:

```php
            'exportSources' => $this->listExportSources->forTeams($teams),
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Integrations/ExportTargetsTest.php tests/Feature/ActionItems tests/Feature/Retros`
Expected: PASS (existing snapshot and action item page tests unchanged).

- [ ] **Step 6: Format, analyse and commit**

```bash
vendor/bin/sail bin pint --dirty --format agent
vendor/bin/sail bin phpstan analyse --no-progress
git add app/Actions/Integrations/ListExportTargets.php app/Actions/Integrations/ListExportSources.php app/Http/Controllers/Integrations/IntegrationTargetsController.php app/Actions/Retros/BuildBoardSnapshot.php app/Http/Controllers/WorkspaceActionItemsController.php routes/web.php tests/Feature/Integrations/ExportTargetsTest.php
git commit -m "feat: list export targets and sources for action items

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SosW8d2Uj7QxsF1tws5ssS"
```

---

### Task 7: Issue content, assignee and priority resolution, export preview

**Files:**
- Create: `app/Enums/ExportWarningCode.php`, `app/Actions/Integrations/{IssueDraft,BuildIssueDraft,ExportAssignee,ExportPriority,ResolveExportAssignee,ResolveExportPriority,PreviewActionItemExport,ActionItemExportGuard}.php`, `app/Support/Integrations/Jira/{JiraCreateFields,JiraCreateMeta}.php`, `app/Http/Controllers/Integrations/{RetroActionItemExportPreviewsController,WorkspaceActionItemExportPreviewsController}.php`
- Modify: `routes/web.php`, `tests/Pest.php`, `lang/{en,fr,es,de}.json`
- Test: create `tests/Feature/Integrations/ExportResolutionTest.php`

**Interfaces:**
- Consumes: `IntegrationUserAccounts::matchEmails`, `IntegrationMappingGuard::hasAccountScope`, `LinearPriority` (Tasks 2–3); Plan 12a `JiraClient::get`, `TeamIntegration::{accountFor, userMappings, setting, ensureWritable}`, `NotConnected`, `IntegrationException`; spec 3 `ActionItemPermissions::authorizeEdit`, `ActionItemActor`, `WorkspaceActionItemGuard::visible`.
- Produces:
  - `App\Enums\ExportWarningCode` (`GuestAssignee = 'guestAssignee'`, `NotMapped = 'notMapped'`, `NeverAssign = 'neverAssign'`, `AssigneeRejected = 'assigneeRejected'`, `AssigneeUnavailable = 'assigneeUnavailable'`, `PriorityUnavailable = 'priorityUnavailable'`) with `message(IntegrationProvider, ?string $name = null, ?string $priority = null): ?string` (`NeverAssign` → `null`).
  - `IssueDraft` (`string $title`, `array<int, string> $lines`, `string $origin`, `string $link`, `?string $dueOn`; `markdown(): string`, `adf(): array`) built by `BuildIssueDraft::handle(ActionItem): IssueDraft`.
  - `ExportAssignee` (`?string $accountId`, `?ExportWarningCode $warning`, `?string $name`; `static assigned(string, string)`, `static unassigned(?ExportWarningCode = null, ?string $name = null)`, `withoutAccount(ExportWarningCode): self`), `ResolveExportAssignee::handle(ActionItem, TeamIntegration): ExportAssignee` (stores a lazy email match).
  - `ExportPriority` (`string|int|null $value`, `?ExportWarningCode $warning`, `?string $name`), `ResolveExportPriority::handle(ActionItem, TeamIntegration, ?JiraCreateFields $fields = null): ExportPriority`, `ResolveExportPriority::preview(ActionItem, TeamIntegration): ?string`, constant `JiraDefaultNames`.
  - `JiraCreateFields` (`bool $hasAssignee`, `bool $hasPriority`, `array<int, array{id: string, name: string}> $priorities`), `JiraCreateMeta::fields(TeamIntegration, string $projectId, string $issueTypeId): JiraCreateFields` (cached 10 min per integration, project and issue type).
  - `PreviewActionItemExport::handle(ActionItem, TeamIntegration): array{assignee: array{state: string, displayName: ?string}, priority: array{name: ?string}}` (no provider call).
  - `ActionItemExportGuard::authorize(ActionItem, ActionItemActor): User` (guests and non-editors 403), `ActionItemExportGuard::integration(Team, string $source): TeamIntegration` (404 disabled provider, 409 not connected / reconnect / read-only), `static sourceRules(): array`.
  - Routes `GET retros/{retro}/action-items/{actionItem}/exports/preview` `retros.action-items.exports.preview` and `GET w/{workspace}/action-items/{actionItem}/exports/preview` `workspaces.actionItemExports.preview` (`?source=`).
  - Pest helpers `exportBoardItem(array $attributes = []): array{0: Retro, 1: ActionItem, 2: User}` (completed retro "Sprint 12", item by a member) and `jiraCreateMeta(bool $assignee = true, bool $priority = true, ?array $priorities = null): array`.

- [ ] **Step 1: Add the Pest helpers**

Append to `tests/Pest.php` (imports `App\Enums\RetroPhase`, `App\Models\ActionItem`, `App\Models\Retro`, `App\Models\User` already exist):

```php
/**
 * @param  array<string, mixed>  $attributes
 * @return array{0: Retro, 1: ActionItem, 2: User}
 */
function exportBoardItem(array $attributes = []): array
{
    $retro = Retro::factory()->inPhase(RetroPhase::Completed)->withGuestAccess()->create(['title' => 'Sprint 12']);
    [$author, $participant] = retroMember($retro);
    $item = ActionItem::factory()->create([
        'retro_id' => $retro->id,
        'created_by_participant_id' => $participant->id,
        'content' => 'Speed up CI',
        ...$attributes,
    ]);

    return [$retro, $item, $author];
}

/**
 * @param  array<int, array{id: string, name: string}>|null  $priorities
 * @return array<string, mixed>
 */
function jiraCreateMeta(bool $assignee = true, bool $priority = true, ?array $priorities = null): array
{
    $fields = [['fieldId' => 'summary', 'name' => 'Summary']];

    if ($assignee) {
        $fields[] = ['fieldId' => 'assignee', 'name' => 'Assignee'];
    }

    if ($priority) {
        $fields[] = ['fieldId' => 'priority', 'name' => 'Priority', 'allowedValues' => $priorities ?? [
            ['id' => '2', 'name' => 'High'],
            ['id' => '3', 'name' => 'Medium'],
            ['id' => '4', 'name' => 'Low'],
        ]];
    }

    return ['startAt' => 0, 'maxResults' => 200, 'total' => count($fields), 'fields' => $fields];
}
```

- [ ] **Step 2: Write the failing test**

Create `tests/Feature/Integrations/ExportResolutionTest.php`:

```php
<?php

use App\Actions\Integrations\BuildIssueDraft;
use App\Actions\Integrations\ResolveExportAssignee;
use App\Actions\Integrations\ResolveExportPriority;
use App\Enums\ActionItemPriority;
use App\Enums\ExportWarningCode;
use App\Enums\IntegrationAccess;
use App\Enums\IntegrationProvider;
use App\Enums\IntegrationUserMatch;
use App\Models\ActionItem;
use App\Models\IntegrationUserMapping;
use App\Models\Participant;
use App\Models\Team;
use App\Models\TeamIntegration;
use App\Support\Integrations\Jira\JiraCreateFields;
use App\Support\Integrations\Jira\JiraCreateMeta;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Http;

beforeEach(function () {
    Http::preventStrayRequests();
    enableIntegrations(IntegrationProvider::Jira, IntegrationProvider::Linear);
});

function jiraFieldsWith(array $priorities, bool $hasPriority = true, bool $hasAssignee = true): JiraCreateFields
{
    return new JiraCreateFields($hasAssignee, $hasPriority, $priorities);
}

it('builds the issue from the item and its retro', function () {
    $this->travelTo(CarbonImmutable::parse('2026-10-05 09:00:00'));
    [$retro, $item, $author] = exportBoardItem(['content' => "Speed up CI\nCache the vendor folder", 'due_on' => '2026-10-20']);

    $draft = app(BuildIssueDraft::class)->handle($item->fresh());
    $link = route('workspaces.actionItems.index', ['workspace' => $retro->team->workspace, 'item' => $item->id]);

    expect($draft->title)->toBe('Speed up CI')
        ->and($draft->dueOn)->toBe('2026-10-20')
        ->and($draft->markdown())->toBe("Speed up CI\nCache the vendor folder\n\nFrom the retrospective \"Sprint 12\" on October 5, 2026: {$link}")
        ->and($draft->adf())->toBe(['type' => 'doc', 'version' => 1, 'content' => [
            ['type' => 'paragraph', 'content' => [['type' => 'text', 'text' => 'Speed up CI']]],
            ['type' => 'paragraph', 'content' => [['type' => 'text', 'text' => 'Cache the vendor folder']]],
            ['type' => 'paragraph', 'content' => [
                ['type' => 'text', 'text' => 'From the retrospective "Sprint 12" on October 5, 2026: '],
                ['type' => 'text', 'text' => $link, 'marks' => [['type' => 'link', 'attrs' => ['href' => $link]]]],
            ]],
        ]])
        ->and($draft->markdown())->not->toContain($author->name);
});

it('describes items added outside a retro and caps the title', function () {
    $this->travelTo(CarbonImmutable::parse('2026-10-05 09:00:00'));
    $team = Team::factory()->create();
    $item = ActionItem::factory()->withoutRetro($team, teamMember($team))->create(['content' => str_repeat('a', 300)]);

    $draft = app(BuildIssueDraft::class)->handle($item->fresh());

    expect(mb_strlen($draft->title))->toBe(255)
        ->and($draft->origin)->toBe('Added outside a retro on October 5, 2026:');
});

it('maps Linear priorities with defaults and overrides', function (ActionItemPriority $priority, array $map, int $expected) {
    [, $item] = exportBoardItem();
    $item->update(['priority' => $priority]);
    $integration = TeamIntegration::factory()->linear()->create();
    $integration->forceFill(['settings' => [...$integration->settings, 'priorityMap' => $map]])->save();

    $resolved = app(ResolveExportPriority::class)->handle($item->fresh(), $integration);

    expect($resolved->value)->toBe($expected)->and($resolved->warning)->toBeNull();
})->with([
    'high default' => [ActionItemPriority::High, [], 2],
    'medium default' => [ActionItemPriority::Medium, [], 3],
    'low default' => [ActionItemPriority::Low, [], 4],
    'override' => [ActionItemPriority::High, ['high' => 1], 1],
    'no priority' => [ActionItemPriority::Low, ['low' => 0], 0],
]);

it('maps Jira priorities against the create screen', function (array $map, ?JiraCreateFields $fields, ?string $expected, ?ExportWarningCode $warning, ?string $name) {
    [, $item] = exportBoardItem(['priority' => ActionItemPriority::High]);
    $integration = TeamIntegration::factory()->jira()->create();
    $integration->forceFill(['settings' => [...$integration->settings, 'priorityMap' => $map]])->save();

    $resolved = app(ResolveExportPriority::class)->handle($item->fresh(), $integration, $fields);

    expect($resolved->value)->toBe($expected)
        ->and($resolved->warning)->toBe($warning)
        ->and($resolved->name)->toBe($name);
})->with([
    'default by name' => [[], jiraFieldsWith([['id' => '7', 'name' => 'HIGH']]), '7', null, 'HIGH'],
    'override allowed' => [['high' => ['id' => '1', 'name' => 'Highest']], jiraFieldsWith([['id' => '1', 'name' => 'Highest']]), '1', null, 'Highest'],
    'override not allowed' => [['high' => ['id' => '1', 'name' => 'Highest']], jiraFieldsWith([['id' => '2', 'name' => 'High']]), null, ExportWarningCode::PriorityUnavailable, 'Highest'],
    'default missing' => [[], jiraFieldsWith([['id' => '9', 'name' => 'Blocker']]), null, ExportWarningCode::PriorityUnavailable, 'High'],
    'no priority field' => [[], jiraFieldsWith([], hasPriority: false), null, ExportWarningCode::PriorityUnavailable, 'High'],
    "don't set" => [['high' => null], jiraFieldsWith([['id' => '2', 'name' => 'High']]), null, null, null],
]);

it('resolves the assignee from the mapping', function () {
    [$retro, $item] = exportBoardItem();
    $integration = TeamIntegration::factory()->jira()->create(['team_id' => $retro->team_id]);
    $mapped = teamMember($retro->team);
    $never = teamMember($retro->team);
    IntegrationUserMapping::factory()->manual()->create(['team_integration_id' => $integration->id, 'user_id' => $mapped->id, 'external_account_id' => 'acc-1']);
    IntegrationUserMapping::factory()->neverAssign()->create(['team_integration_id' => $integration->id, 'user_id' => $never->id]);
    $guest = Participant::factory()->guest()->create(['retro_id' => $retro->id]);
    $resolve = app(ResolveExportAssignee::class);

    $item->update(['assignee_user_id' => $mapped->id]);
    expect($resolve->handle($item->fresh(), $integration)->accountId)->toBe('acc-1');

    $item->update(['assignee_user_id' => $never->id]);
    expect($resolve->handle($item->fresh(), $integration)->warning)->toBe(ExportWarningCode::NeverAssign);

    $item->update(['assignee_user_id' => null, 'assignee_participant_id' => $guest->id]);
    expect($resolve->handle($item->fresh(), $integration)->warning)->toBe(ExportWarningCode::GuestAssignee);

    $item->update(['assignee_participant_id' => null]);
    $none = $resolve->handle($item->fresh(), $integration);
    expect($none->accountId)->toBeNull()->and($none->warning)->toBeNull();
});

it('matches an unmapped assignee by email once and stores it', function () {
    [$retro, $item] = exportBoardItem();
    $integration = TeamIntegration::factory()->jira()->create(['team_id' => $retro->team_id]);
    $member = teamMember($retro->team);
    $item->update(['assignee_user_id' => $member->id]);
    Http::fake([jiraApiUrl('rest/api/3/user/search*') => Http::response([jiraAccount('acc-9', 'Grace H.')])]);

    $resolved = app(ResolveExportAssignee::class)->handle($item->fresh(), $integration);

    expect($resolved->accountId)->toBe('acc-9')
        ->and($integration->accountFor($member)?->matched_by)->toBe(IntegrationUserMatch::Email);
});

it('leaves the assignee unmapped when no lookup is possible or it fails', function (callable $setUp) {
    [$retro, $item] = exportBoardItem();
    $member = teamMember($retro->team);
    $item->update(['assignee_user_id' => $member->id]);
    $integration = $setUp($retro->team_id, $member);

    $resolved = app(ResolveExportAssignee::class)->handle($item->fresh(), $integration);

    expect($resolved->accountId)->toBeNull()
        ->and($resolved->warning)->toBe(ExportWarningCode::NotMapped)
        ->and($resolved->name)->toBe($member->name);
})->with([
    'no verified email' => [function (string $teamId, $member) {
        $member->forceFill(['email_verified_at' => null])->save();

        return TeamIntegration::factory()->jira()->create(['team_id' => $teamId]);
    }],
    'Jira without account scope' => [fn (string $teamId) => TeamIntegration::factory()->jira()->create([
        'team_id' => $teamId,
        'scopes' => ['offline_access', 'read:jira-work', 'write:jira-work'],
    ])],
    'provider error' => [function (string $teamId) {
        Http::fake([jiraApiUrl('rest/api/3/user/search*') => Http::response(['message' => 'boom'], 500)]);

        return TeamIntegration::factory()->jira()->create(['team_id' => $teamId]);
    }],
]);

it('caches the Jira create screen', function () {
    Http::fake([jiraApiUrl('rest/api/3/issue/createmeta/10000/issuetypes/11*') => Http::response(jiraCreateMeta(assignee: false))]);
    $integration = TeamIntegration::factory()->jira()->create();
    $meta = app(JiraCreateMeta::class);

    $first = $meta->fields($integration, '10000', '11');
    $meta->fields($integration, '10000', '11');

    expect($first->hasAssignee)->toBeFalse()
        ->and($first->hasPriority)->toBeTrue()
        ->and($first->priorities[0])->toBe(['id' => '2', 'name' => 'High']);
    Http::assertSentCount(1);
});

it('previews the export from stored data only', function () {
    [$retro, $item, $author] = exportBoardItem(['priority' => ActionItemPriority::Low]);
    $integration = TeamIntegration::factory()->jira()->create(['team_id' => $retro->team_id]);
    $mapped = teamMember($retro->team);
    $unmapped = teamMember($retro->team);
    IntegrationUserMapping::factory()->create(['team_integration_id' => $integration->id, 'user_id' => $mapped->id, 'external_account_id' => 'acc-1', 'external_display_name' => 'Ada (Jira)']);
    $preview = fn () => $this->actingAs($author)->getJson(route('retros.action-items.exports.preview', [$retro, $item]).'?source=jira');

    $item->update(['assignee_user_id' => $mapped->id]);
    $preview()->assertOk()->assertExactJson(['assignee' => ['state' => 'mapped', 'displayName' => 'Ada (Jira)'], 'priority' => ['name' => 'Low']]);

    $item->update(['assignee_user_id' => $unmapped->id]);
    $preview()->assertJsonPath('assignee', ['state' => 'willMatch', 'displayName' => $unmapped->name]);

    $integration->forceFill(['settings' => [...$integration->settings, 'priorityMap' => ['low' => null]]])->save();
    $preview()->assertJsonPath('priority.name', null);
});

it('previews for those who can export only', function () {
    [$retro, $item] = exportBoardItem();
    TeamIntegration::factory()->jira()->create(['team_id' => $retro->team_id]);
    [$other] = retroMember($retro);
    $guest = Participant::factory()->guest()->create(['retro_id' => $retro->id]);
    $admin = workspaceManager($retro->team->workspace);
    $url = route('retros.action-items.exports.preview', [$retro, $item]).'?source=jira';

    $this->actingAs($other)->getJson($url)->assertForbidden();
    $this->withCookies(retroGuestCookie($guest))->withCredentials()->getJson($url)->assertForbidden();
    $this->actingAs($admin)
        ->getJson(route('workspaces.actionItemExports.preview', [$retro->team->workspace, $item]).'?source=jira')
        ->assertOk()
        ->assertJsonPath('assignee.state', 'none');
});

it('answers with the state of the export source', function () {
    [$retro, $item, $author] = exportBoardItem();
    TeamIntegration::factory()->linear(IntegrationAccess::Read)->create(['team_id' => $retro->team_id]);
    $url = fn (string $source) => route('retros.action-items.exports.preview', [$retro, $item])."?source={$source}";

    $this->actingAs($author)->getJson($url('linear'))->assertConflict()->assertJsonPath('message', 'This Linear connection is read-only.');
    $this->actingAs($author)->getJson($url('jira'))->assertConflict()->assertJsonPath('message', 'Connect Jira in the team settings.');
    $this->actingAs($author)->getJson($url('slack'))->assertUnprocessable();

    disableIntegrations();

    $this->actingAs($author)->getJson($url('jira'))->assertNotFound();
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Integrations/ExportResolutionTest.php`
Expected: FAIL — `Class "App\Actions\Integrations\BuildIssueDraft" not found`.

- [ ] **Step 4: Create the warning codes and the issue draft**

Create `app/Enums/ExportWarningCode.php`:

```php
<?php

namespace App\Enums;

/**
 * Why an exported issue has no assignee or the provider's default
 * priority (spec §7.3). Warnings never block an export.
 */
enum ExportWarningCode: string
{
    case GuestAssignee = 'guestAssignee';
    case NotMapped = 'notMapped';
    case NeverAssign = 'neverAssign';
    case AssigneeRejected = 'assigneeRejected';
    case AssigneeUnavailable = 'assigneeUnavailable';
    case PriorityUnavailable = 'priorityUnavailable';

    public function message(IntegrationProvider $provider, ?string $name = null, ?string $priority = null): ?string
    {
        $label = $provider->label();

        return match ($this) {
            self::GuestAssignee => __('Guests have no :provider account, so the issue is unassigned.', ['provider' => $label]),
            self::NotMapped => __(':name has no :provider account mapped, so the issue is unassigned.', ['name' => (string) $name, 'provider' => $label]),
            self::NeverAssign => null,
            self::AssigneeRejected => __(':provider refused :name as assignee for this project, so the issue is unassigned.', ['name' => (string) $name, 'provider' => $label]),
            self::AssigneeUnavailable => __("This Jira project doesn't accept an assignee on creation."),
            self::PriorityUnavailable => __("Priority :priority isn't available in this project; :provider's default was used.", ['priority' => (string) $priority, 'provider' => $label]),
        };
    }
}
```

Create `app/Actions/Integrations/IssueDraft.php`:

```php
<?php

namespace App\Actions\Integrations;

/**
 * The provider-neutral issue: Jira receives it as ADF, Linear as
 * Markdown. It never names the creator of the item (spec §7).
 */
class IssueDraft
{
    /**
     * @param  array<int, string>  $lines
     */
    public function __construct(
        public string $title,
        public array $lines,
        public string $origin,
        public string $link,
        public ?string $dueOn,
    ) {}

    public function markdown(): string
    {
        return implode("\n", $this->lines)."\n\n{$this->origin} {$this->link}";
    }

    /**
     * @return array<string, mixed>
     */
    public function adf(): array
    {
        $paragraphs = array_map(fn (string $line): array => [
            'type' => 'paragraph',
            'content' => [['type' => 'text', 'text' => $line]],
        ], $this->lines);

        $paragraphs[] = ['type' => 'paragraph', 'content' => [
            ['type' => 'text', 'text' => "{$this->origin} "],
            ['type' => 'text', 'text' => $this->link, 'marks' => [['type' => 'link', 'attrs' => ['href' => $this->link]]]],
        ]];

        return ['type' => 'doc', 'version' => 1, 'content' => $paragraphs];
    }
}
```

Create `app/Actions/Integrations/BuildIssueDraft.php`:

```php
<?php

namespace App\Actions\Integrations;

use App\Models\ActionItem;
use Carbon\CarbonInterface;
use Illuminate\Support\Str;

class BuildIssueDraft
{
    private const TitleLength = 255;

    public function handle(ActionItem $item): IssueDraft
    {
        $item->loadMissing(['retro', 'team.workspace']);

        $lines = array_values(array_filter(
            array_map('trim', preg_split('/\R/u', $item->content) ?: []),
            fn (string $line): bool => $line !== '',
        ));

        $origin = $item->retro !== null
            ? __('From the retrospective ":title" on :date:', ['title' => $item->retro->title, 'date' => $this->date($item->retro->created_at)])
            : __('Added outside a retro on :date:', ['date' => $this->date($item->created_at)]);

        return new IssueDraft(
            Str::substr($lines[0] ?? $item->content, 0, self::TitleLength),
            $lines,
            $origin,
            route('workspaces.actionItems.index', ['workspace' => $item->team->workspace, 'item' => $item->id]),
            $item->due_on?->toDateString(),
        );
    }

    private function date(?CarbonInterface $date): string
    {
        return $date === null ? '' : $date->locale(app()->getLocale())->isoFormat('LL');
    }
}
```

- [ ] **Step 5: Create the resolution classes**

Create `app/Actions/Integrations/ExportAssignee.php`:

```php
<?php

namespace App\Actions\Integrations;

use App\Enums\ExportWarningCode;

class ExportAssignee
{
    public function __construct(
        public ?string $accountId,
        public ?ExportWarningCode $warning = null,
        public ?string $name = null,
    ) {}

    public static function assigned(string $accountId, string $name): self
    {
        return new self($accountId, null, $name);
    }

    public static function unassigned(?ExportWarningCode $warning = null, ?string $name = null): self
    {
        return new self(null, $warning, $name);
    }

    public function withoutAccount(ExportWarningCode $warning): self
    {
        return new self(null, $warning, $this->name);
    }
}
```

Create `app/Actions/Integrations/ExportPriority.php`:

```php
<?php

namespace App\Actions\Integrations;

use App\Enums\ExportWarningCode;

/**
 * A Jira priority id or a Linear value; null leaves the provider default.
 */
class ExportPriority
{
    public function __construct(
        public string|int|null $value,
        public ?ExportWarningCode $warning = null,
        public ?string $name = null,
    ) {}
}
```

Create `app/Support/Integrations/Jira/JiraCreateFields.php`:

```php
<?php

namespace App\Support\Integrations\Jira;

class JiraCreateFields
{
    /**
     * @param  array<int, array{id: string, name: string}>  $priorities
     */
    public function __construct(
        public bool $hasAssignee,
        public bool $hasPriority,
        public array $priorities,
    ) {}
}
```

Create `app/Support/Integrations/Jira/JiraCreateMeta.php`:

```php
<?php

namespace App\Support\Integrations\Jira;

use App\Models\TeamIntegration;
use Illuminate\Support\Facades\Cache;

/**
 * The fields of a project's create screen for one issue type (spec §7.1:
 * cached 10 minutes per integration, project and issue type).
 */
class JiraCreateMeta
{
    private const TtlSeconds = 600;

    private const FieldLimit = 200;

    public function __construct(private JiraClient $jira) {}

    public function fields(TeamIntegration $integration, string $projectId, string $issueTypeId): JiraCreateFields
    {
        /** @var array{assignee: bool, priority: bool, priorities: array<int, array{id: string, name: string}>} $cached */
        $cached = Cache::remember(
            "jira-createmeta:{$integration->id}:{$projectId}:{$issueTypeId}",
            self::TtlSeconds,
            fn (): array => $this->fetch($integration, $projectId, $issueTypeId),
        );

        return new JiraCreateFields($cached['assignee'], $cached['priority'], $cached['priorities']);
    }

    /**
     * @return array{assignee: bool, priority: bool, priorities: array<int, array{id: string, name: string}>}
     */
    private function fetch(TeamIntegration $integration, string $projectId, string $issueTypeId): array
    {
        $response = $this->jira->get(
            $integration,
            "rest/api/3/issue/createmeta/{$projectId}/issuetypes/{$issueTypeId}",
            ['maxResults' => self::FieldLimit],
        );

        $fields = [];

        foreach ((array) ($response['fields'] ?? $response['values'] ?? []) as $field) {
            if (is_array($field) && is_string($field['fieldId'] ?? null)) {
                $fields[$field['fieldId']] = $field;
            }
        }

        $priorities = [];

        foreach ((array) ($fields['priority']['allowedValues'] ?? []) as $value) {
            if (is_array($value) && is_string($value['id'] ?? null)) {
                $priorities[] = ['id' => $value['id'], 'name' => (string) ($value['name'] ?? '')];
            }
        }

        return [
            'assignee' => array_key_exists('assignee', $fields),
            'priority' => array_key_exists('priority', $fields),
            'priorities' => $priorities,
        ];
    }
}
```

Create `app/Actions/Integrations/ResolveExportPriority.php`:

```php
<?php

namespace App\Actions\Integrations;

use App\Enums\ExportWarningCode;
use App\Enums\IntegrationProvider;
use App\Models\ActionItem;
use App\Models\TeamIntegration;
use App\Support\Integrations\Jira\JiraCreateFields;
use App\Support\Integrations\Linear\LinearPriority;
use Illuminate\Support\Str;

/**
 * Spec §7.2: `settings.priorityMap.{level}` is a Jira `{id, name}`, `null`
 * ("Don't set") or a Linear value; a missing key is the default mapping.
 */
class ResolveExportPriority
{
    public const JiraDefaultNames = ['high' => 'High', 'medium' => 'Medium', 'low' => 'Low'];

    public function handle(ActionItem $item, TeamIntegration $integration, ?JiraCreateFields $fields = null): ExportPriority
    {
        $level = $item->priority->value;
        $map = (array) $integration->setting('priorityMap', []);

        if ($integration->provider === IntegrationProvider::Linear) {
            $value = is_int($map[$level] ?? null) ? $map[$level] : LinearPriority::Defaults[$level];

            return new ExportPriority($value, null, LinearPriority::label($value));
        }

        $overridden = array_key_exists($level, $map);
        $override = $map[$level] ?? null;

        if ($overridden && $override === null) {
            return new ExportPriority(null);
        }

        $name = is_array($override) ? (string) ($override['name'] ?? '') : self::JiraDefaultNames[$level];

        if ($fields === null || ! $fields->hasPriority) {
            return new ExportPriority(null, ExportWarningCode::PriorityUnavailable, $name);
        }

        foreach ($fields->priorities as $allowed) {
            $matches = is_array($override)
                ? $allowed['id'] === ($override['id'] ?? null)
                : Str::lower($allowed['name']) === Str::lower($name);

            if ($matches) {
                return new ExportPriority($allowed['id'], null, $allowed['name']);
            }
        }

        return new ExportPriority(null, ExportWarningCode::PriorityUnavailable, $name);
    }

    /**
     * What the export dialog shows, from stored data only; null means
     * "the provider's default".
     */
    public function preview(ActionItem $item, TeamIntegration $integration): ?string
    {
        $level = $item->priority->value;
        $map = (array) $integration->setting('priorityMap', []);

        if ($integration->provider === IntegrationProvider::Linear) {
            return LinearPriority::label(is_int($map[$level] ?? null) ? $map[$level] : LinearPriority::Defaults[$level]);
        }

        if (! array_key_exists($level, $map)) {
            return self::JiraDefaultNames[$level];
        }

        $override = $map[$level];

        return is_array($override) ? (string) ($override['name'] ?? '') : null;
    }
}
```

Create `app/Actions/Integrations/ResolveExportAssignee.php`:

```php
<?php

namespace App\Actions\Integrations;

use App\Enums\ExportWarningCode;
use App\Enums\IntegrationUserMatch;
use App\Models\ActionItem;
use App\Models\TeamIntegration;
use App\Models\User;
use App\Support\Integrations\Exceptions\IntegrationException;
use App\Support\Integrations\ExternalAccount;
use App\Support\Integrations\IntegrationUserAccounts;
use Illuminate\Support\Str;

/**
 * Spec §7.1 resolution at export time. The one lazy lookup never fails
 * the export: any provider error leaves the issue unassigned.
 */
class ResolveExportAssignee
{
    public function __construct(private IntegrationUserAccounts $accounts) {}

    public function handle(ActionItem $item, TeamIntegration $integration): ExportAssignee
    {
        if ($item->assignee_participant_id !== null) {
            return ExportAssignee::unassigned(ExportWarningCode::GuestAssignee);
        }

        $user = $item->assigneeUser;

        if ($user === null) {
            return ExportAssignee::unassigned();
        }

        $mapping = $integration->accountFor($user);

        if ($mapping !== null && $mapping->isNeverAssign()) {
            return ExportAssignee::unassigned(ExportWarningCode::NeverAssign, $user->name);
        }

        if ($mapping !== null && $mapping->external_account_id !== null) {
            return ExportAssignee::assigned($mapping->external_account_id, $user->name);
        }

        $account = $mapping === null ? $this->lookUp($integration, $user) : null;

        if ($account === null) {
            return ExportAssignee::unassigned(ExportWarningCode::NotMapped, $user->name);
        }

        $integration->userMappings()->firstOrCreate(['user_id' => $user->id], [
            'external_account_id' => $account->id,
            'external_display_name' => $account->displayName,
            'matched_by' => IntegrationUserMatch::Email,
            'account_inactive' => false,
            'checked_at' => now(),
        ]);

        return ExportAssignee::assigned($account->id, $user->name);
    }

    private function lookUp(TeamIntegration $integration, User $user): ?ExternalAccount
    {
        if ($user->email_verified_at === null) {
            return null;
        }

        if (! IntegrationMappingGuard::hasAccountScope($integration)) {
            return null;
        }

        try {
            return $this->accounts->matchEmails($integration, [$user->email])[Str::lower($user->email)] ?? null;
        } catch (IntegrationException) {
            return null;
        }
    }
}
```

- [ ] **Step 6: Create the preview, the guard and the endpoints**

Create `app/Actions/Integrations/PreviewActionItemExport.php`:

```php
<?php

namespace App\Actions\Integrations;

use App\Models\ActionItem;
use App\Models\TeamIntegration;

/**
 * What the export dialog announces, from stored data only (no provider
 * call, spec §7.3).
 */
class PreviewActionItemExport
{
    public function __construct(private ResolveExportPriority $resolvePriority) {}

    /**
     * @return array{assignee: array{state: string, displayName: ?string}, priority: array{name: ?string}}
     */
    public function handle(ActionItem $item, TeamIntegration $integration): array
    {
        return [
            'assignee' => $this->assignee($item, $integration),
            'priority' => ['name' => $this->resolvePriority->preview($item, $integration)],
        ];
    }

    /**
     * @return array{state: string, displayName: ?string}
     */
    private function assignee(ActionItem $item, TeamIntegration $integration): array
    {
        if ($item->assignee_participant_id !== null) {
            return ['state' => 'guest', 'displayName' => null];
        }

        $user = $item->assigneeUser;

        if ($user === null) {
            return ['state' => 'none', 'displayName' => null];
        }

        $mapping = $integration->accountFor($user);

        if ($mapping !== null && $mapping->isNeverAssign()) {
            return ['state' => 'never', 'displayName' => null];
        }

        if ($mapping !== null && $mapping->external_account_id !== null) {
            return ['state' => 'mapped', 'displayName' => $mapping->external_display_name];
        }

        if ($mapping === null && $user->email_verified_at !== null && IntegrationMappingGuard::hasAccountScope($integration)) {
            return ['state' => 'willMatch', 'displayName' => $user->name];
        }

        return ['state' => 'none', 'displayName' => null];
    }
}
```

Create `app/Actions/Integrations/ActionItemExportGuard.php`:

```php
<?php

namespace App\Actions\Integrations;

use App\Actions\ActionItems\ActionItemActor;
use App\Actions\ActionItems\ActionItemPermissions;
use App\Enums\IntegrationProvider;
use App\Models\ActionItem;
use App\Models\Team;
use App\Models\TeamIntegration;
use App\Models\User;
use App\Support\Integrations\Exceptions\NotConnected;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Validation\Rule;

class ActionItemExportGuard
{
    public function __construct(private ActionItemPermissions $permissions) {}

    /**
     * @return array<string, array<int, mixed>>
     */
    public static function sourceRules(): array
    {
        return ['source' => ['required', 'string', Rule::in([IntegrationProvider::Jira->value, IntegrationProvider::Linear->value])]];
    }

    public function authorize(ActionItem $item, ActionItemActor $actor): User
    {
        $user = $actor->user;

        if ($user === null) {
            throw new AuthorizationException(__('Guests cannot export action items.'));
        }

        $this->permissions->authorizeEdit($item, $actor);

        return $user;
    }

    public function integration(Team $team, string $source): TeamIntegration
    {
        $provider = IntegrationProvider::from($source);

        abort_unless($provider->isEnabled(), 404);

        $integration = $team->integration($provider);

        if ($integration === null) {
            throw new NotConnected($provider);
        }

        $integration->ensureWritable();

        return $integration;
    }
}
```

Create `app/Http/Controllers/Integrations/RetroActionItemExportPreviewsController.php`:

```php
<?php

namespace App\Http\Controllers\Integrations;

use App\Actions\ActionItems\ActionItemActor;
use App\Actions\Integrations\ActionItemExportGuard;
use App\Actions\Integrations\PreviewActionItemExport;
use App\Http\Controllers\Controller;
use App\Models\ActionItem;
use App\Models\Participant;
use App\Models\Retro;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class RetroActionItemExportPreviewsController extends Controller
{
    public function __construct(private ActionItemExportGuard $guard, private PreviewActionItemExport $previewExport) {}

    public function show(Request $request, Retro $retro, ActionItem $actionItem): JsonResponse
    {
        $this->guard->authorize($actionItem, ActionItemActor::forParticipant(Participant::current($request)));

        $validated = $request->validate(ActionItemExportGuard::sourceRules());
        $integration = $this->guard->integration($actionItem->team, $validated['source']);

        return response()->json($this->previewExport->handle($actionItem, $integration));
    }
}
```

Create `app/Http/Controllers/Integrations/WorkspaceActionItemExportPreviewsController.php`:

```php
<?php

namespace App\Http\Controllers\Integrations;

use App\Actions\ActionItems\ActionItemActor;
use App\Actions\ActionItems\WorkspaceActionItemGuard;
use App\Actions\Integrations\ActionItemExportGuard;
use App\Actions\Integrations\PreviewActionItemExport;
use App\Http\Controllers\Controller;
use App\Models\ActionItem;
use App\Models\Workspace;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class WorkspaceActionItemExportPreviewsController extends Controller
{
    public function __construct(private ActionItemExportGuard $guard, private PreviewActionItemExport $previewExport) {}

    public function show(Request $request, Workspace $workspace, ActionItem $actionItem): JsonResponse
    {
        $user = $request->user();

        WorkspaceActionItemGuard::visible($user, $workspace, $actionItem);

        $this->guard->authorize($actionItem, ActionItemActor::forUser($user));

        $validated = $request->validate(ActionItemExportGuard::sourceRules());
        $integration = $this->guard->integration($actionItem->team, $validated['source']);

        return response()->json($this->previewExport->handle($actionItem, $integration));
    }
}
```

In `routes/web.php`, import both controllers and add:
- inside the `retros/{retro}` group, after the `retros.action-items.subtasks.destroy` route:

```php
        Route::get('action-items/{actionItem}/exports/preview', [RetroActionItemExportPreviewsController::class, 'show'])
            ->middleware(EnsureIntegrationProviderEnabled::class)
            ->name('retros.action-items.exports.preview')
            ->whereUuid('actionItem');
```

- inside the `w/{workspace}` group, after the `workspaces.actionItemSubtasks.destroy` route:

```php
            Route::get('action-items/{actionItem}/exports/preview', [WorkspaceActionItemExportPreviewsController::class, 'show'])
                ->middleware(EnsureIntegrationProviderEnabled::class)
                ->name('workspaces.actionItemExports.preview')
                ->whereUuid('actionItem');
```

Run `vendor/bin/sail artisan wayfinder:generate --with-form`.

- [ ] **Step 7: Add the translations**

Append to `lang/{en,fr,es,de}.json`:

| Key (en) | fr | es | de |
|---|---|---|---|
| `From the retrospective ":title" on :date:` | `Issue de la rétrospective « :title » du :date :` | `De la retrospectiva «:title» del :date:` | `Aus der Retrospektive „:title“ vom :date:` |
| `Added outside a retro on :date:` | `Ajoutée hors rétrospective le :date :` | `Añadida fuera de una retrospectiva el :date:` | `Außerhalb einer Retro hinzugefügt am :date:` |
| `Guests cannot export action items.` | `Les invités ne peuvent pas exporter d'actions.` | `Los invitados no pueden exportar acciones.` | `Gäste können keine Aktionen exportieren.` |
| `Guests have no :provider account, so the issue is unassigned.` | `Les invités n'ont pas de compte :provider, le ticket n'est donc pas assigné.` | `Los invitados no tienen cuenta de :provider, así que la incidencia queda sin asignar.` | `Gäste haben kein :provider-Konto, daher ist das Issue niemandem zugewiesen.` |
| `:name has no :provider account mapped, so the issue is unassigned.` | `Aucun compte :provider n'est associé à :name, le ticket n'est donc pas assigné.` | `:name no tiene ninguna cuenta de :provider asociada, así que la incidencia queda sin asignar.` | `Für :name ist kein :provider-Konto zugeordnet, daher ist das Issue niemandem zugewiesen.` |
| `:provider refused :name as assignee for this project, so the issue is unassigned.` | `:provider a refusé :name comme responsable pour ce projet, le ticket n'est donc pas assigné.` | `:provider rechazó a :name como responsable de este proyecto, así que la incidencia queda sin asignar.` | `:provider hat :name als verantwortliche Person für dieses Projekt abgelehnt, daher ist das Issue niemandem zugewiesen.` |
| `This Jira project doesn't accept an assignee on creation.` | `Ce projet Jira n'accepte pas de responsable à la création.` | `Este proyecto de Jira no acepta un responsable al crear la incidencia.` | `Dieses Jira-Projekt akzeptiert beim Erstellen keine verantwortliche Person.` |
| `Priority :priority isn't available in this project; :provider's default was used.` | `La priorité :priority n'est pas disponible dans ce projet ; la valeur par défaut de :provider a été utilisée.` | `La prioridad :priority no está disponible en este proyecto; se usó la predeterminada de :provider.` | `Die Priorität :priority ist in diesem Projekt nicht verfügbar; der Standard von :provider wurde verwendet.` |

- [ ] **Step 8: Run the tests to verify they pass**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Integrations/ExportResolutionTest.php tests/Feature/TranslationKeysTest.php`
Expected: PASS.

- [ ] **Step 9: Format, analyse and commit**

```bash
vendor/bin/sail bin pint --dirty --format agent
vendor/bin/sail bin phpstan analyse --no-progress
git add app/Enums/ExportWarningCode.php app/Actions/Integrations app/Support/Integrations/Jira app/Http/Controllers/Integrations routes/web.php tests/Pest.php tests/Feature/Integrations/ExportResolutionTest.php lang
git commit -m "feat: resolve export assignee and priority with a stored-data preview

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SosW8d2Uj7QxsF1tws5ssS"
```

---
### Task 8: Exporting an action item (`ExportActionItem`, retro and workspace endpoints)

**Files:**
- Create: `app/Actions/Integrations/{CreatedIssue,ExportOutcome,ExportActionItemRules,ExportToJira,ExportToLinear,ExportActionItem}.php`, `app/Support/Integrations/Exceptions/IssueCreationUncertain.php`, `app/Http/Controllers/Integrations/{RetroActionItemExportsController,WorkspaceActionItemExportsController}.php`
- Modify: `routes/web.php`, `lang/{en,fr,es,de}.json`
- Test: create `tests/Feature/Integrations/ActionItemExportTest.php`

**Interfaces:**
- Consumes: Tasks 1–7 (`BroadcastActionItemChange::externalLinksChanged`, `BuildIssueDraft`, `ResolveExportAssignee`, `ResolveExportPriority`, `JiraCreateMeta`, `ExportAssignee::withoutAccount`, `ExportWarningCode::message`, `ActionItemExportGuard`); Plan 12a `IntegrationTokens::accessToken`, `JiraClient::post`, `LinearClient::query`, `ProviderRejected::$errors`, `ProviderUnavailable::$timedOut`, `ReconnectRequired`, `TeamIntegration::{site, setting, markReconnectRequired}`; spec 3 `WorkspaceActionItemGuard::{writable, lockWritable, visible}`, `PresentActionItem`.
- Produces:
  - `CreatedIssue` (`string $id`, `string $key`, `string $url`), `ExportOutcome` (`CreatedIssue $issue`, `ExportAssignee $assignee`, `ExportPriority $priority`).
  - `ExportToJira::create(TeamIntegration, ActionItem, IssueDraft, ExportAssignee, array{project_id: string, issue_type_id: string} $target): ExportOutcome` and `ExportToLinear::create(TeamIntegration, ActionItem, IssueDraft, ExportAssignee, array{team_id: string} $target): ExportOutcome` (both retry once without the assignee when the provider refuses it; a timed-out create throws `IssueCreationUncertain`, 502).
  - `ExportActionItem::handle(ActionItem, User, TeamIntegration, array $target): array{actionItem: ActionItem, warnings: array<int, array{code: string, message: ?string}>}`.
  - `ExportActionItemRules::rules(): array` (`source`, `project_id`/`issue_type_id` digits for Jira, `team_id` UUID for Linear).
  - Routes `POST retros/{retro}/action-items/{actionItem}/exports` `retros.action-items.exports.store` and `POST w/{workspace}/action-items/{actionItem}/exports` `workspaces.actionItemExports.store` → 201 `{actionItem, warnings}`.

- [ ] **Step 1: Write the failing test**

Create `tests/Feature/Integrations/ActionItemExportTest.php`:

```php
<?php

use App\Enums\ActionItemPriority;
use App\Enums\ActionItemRecurrence;
use App\Enums\IntegrationAccess;
use App\Enums\IntegrationProvider;
use App\Enums\IntegrationStatus;
use App\Enums\RetroPhase;
use App\Events\ActionItems\TeamActionItemSaved;
use App\Events\Retros\ActionItemExternalLinksChanged;
use App\Events\Retros\ActionItemSaved;
use App\Events\Retros\CarriedActionItemSaved;
use App\Models\ActionItem;
use App\Models\ActionItemExternalLink;
use App\Models\IntegrationUserMapping;
use App\Models\Participant;
use App\Models\Retro;
use App\Models\Team;
use App\Models\TeamIntegration;
use Illuminate\Http\Client\Request as HttpClientRequest;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Http;

const ExportLinearTeamId = '6a1f0c1e-4e8b-4a55-9b53-3c0b5f1f0a01';

beforeEach(function () {
    Http::preventStrayRequests();
    Event::fake([ActionItemSaved::class, TeamActionItemSaved::class, CarriedActionItemSaved::class, ActionItemExternalLinksChanged::class]);
    enableIntegrations(IntegrationProvider::Jira, IntegrationProvider::Linear);
});

function fakeJiraIssueCreation(?array $createMeta = null, mixed $create = null): void
{
    Http::fake([
        jiraApiUrl('rest/api/3/issue/createmeta/*') => Http::response($createMeta ?? jiraCreateMeta()),
        jiraApiUrl('rest/api/3/issue') => $create ?? Http::response(['id' => '10042', 'key' => 'PROJ-42', 'self' => 'https://api.atlassian.com/ex/jira/cloud-1/rest/api/3/issue/10042'], 201),
    ]);
}

/**
 * @return array<string, mixed>
 */
function jiraCreatePayload(int $index = 0): array
{
    $requests = collect(Http::recorded())
        ->map(fn (array $pair): HttpClientRequest => $pair[0])
        ->filter(fn (HttpClientRequest $request): bool => $request->method() === 'POST' && str_ends_with($request->url(), '/rest/api/3/issue'))
        ->values();

    return $requests[$index]->data()['fields'];
}

/**
 * @param  array<string, mixed>  $body
 */
function jiraExportRequest(Retro $retro, ActionItem $item, array $body = []): array
{
    return [route('retros.action-items.exports.store', [$retro, $item]), ['source' => 'jira', 'project_id' => '10000', 'issue_type_id' => '11', ...$body]];
}

it('exports a board item to Jira', function () {
    fakeJiraIssueCreation();
    [$retro, $item, $author] = exportBoardItem(['priority' => ActionItemPriority::High, 'due_on' => '2026-10-20']);
    $integration = TeamIntegration::factory()->jira()->create(['team_id' => $retro->team_id]);
    $assignee = teamMember($retro->team);
    IntegrationUserMapping::factory()->manual()->create(['team_integration_id' => $integration->id, 'user_id' => $assignee->id, 'external_account_id' => 'acc-1']);
    $item->update(['assignee_user_id' => $assignee->id]);

    $this->actingAs($author)->postJson(...jiraExportRequest($retro, $item))
        ->assertCreated()
        ->assertJsonPath('actionItem.externalLinks', [['source' => 'jira', 'key' => 'PROJ-42', 'url' => 'https://acme.atlassian.net/browse/PROJ-42']])
        ->assertJsonPath('warnings', []);

    $fields = jiraCreatePayload();

    expect($fields['project'])->toBe(['id' => '10000'])
        ->and($fields['issuetype'])->toBe(['id' => '11'])
        ->and($fields['summary'])->toBe('Speed up CI')
        ->and($fields['duedate'])->toBe('2026-10-20')
        ->and($fields['priority'])->toBe(['id' => '2'])
        ->and($fields['assignee'])->toBe(['accountId' => 'acc-1'])
        ->and($fields['description']['type'])->toBe('doc')
        ->and(json_encode($fields))->toContain('From the retrospective \"Sprint 12\"')
        ->and(json_encode($fields))->not->toContain($author->name);

    $link = ActionItemExternalLink::query()->sole();

    expect($link->external_id)->toBe('10042')
        ->and($link->external_site)->toBe('cloud-1')
        ->and($link->created_by_user_id)->toBe($author->id)
        ->and($integration->fresh()->setting('exportProjectId'))->toBe('10000')
        ->and($integration->fresh()->setting('exportIssueTypeId'))->toBe('11');
});

it('exports to Linear with a Markdown body', function () {
    fakeLinearGraphql(['issueCreate' => ['issueCreate' => ['success' => true, 'issue' => [
        'id' => 'lin-issue-1', 'identifier' => 'ENG-7', 'url' => 'https://linear.app/acme/issue/ENG-7/speed-up-ci',
    ]]]]);
    [$retro, $item, $author] = exportBoardItem();
    $integration = TeamIntegration::factory()->linear()->create(['team_id' => $retro->team_id]);

    $this->actingAs($author)
        ->postJson(route('retros.action-items.exports.store', [$retro, $item]), ['source' => 'linear', 'team_id' => ExportLinearTeamId])
        ->assertCreated()
        ->assertJsonPath('actionItem.externalLinks.0.key', 'ENG-7');

    Http::assertSent(function (HttpClientRequest $request) {
        $input = $request['variables']['input'] ?? [];

        return str_contains((string) $request['query'], 'issueCreate')
            && $input['teamId'] === ExportLinearTeamId
            && $input['title'] === 'Speed up CI'
            && $input['priority'] === 3
            && ! array_key_exists('assigneeId', $input)
            && str_contains($input['description'], 'From the retrospective "Sprint 12"');
    });

    expect($integration->fresh()->setting('exportTeamId'))->toBe(ExportLinearTeamId);
});

it('exports items added outside a retro from the global page', function () {
    fakeJiraIssueCreation();
    $team = Team::factory()->create();
    $author = teamMember($team);
    TeamIntegration::factory()->jira()->create(['team_id' => $team->id]);
    $item = ActionItem::factory()->withoutRetro($team, $author)->create(['content' => 'Book the room']);

    $this->actingAs($author)
        ->postJson(route('workspaces.actionItemExports.store', [$team->workspace, $item]), ['source' => 'jira', 'project_id' => '10000', 'issue_type_id' => '11'])
        ->assertCreated();

    expect(json_encode(jiraCreatePayload()))->toContain('Added outside a retro on');
});

it('exports each occurrence of a recurring item separately', function () {
    fakeJiraIssueCreation(create: Http::sequence()
        ->push(['id' => '1', 'key' => 'PROJ-1'], 201)
        ->push(['id' => '2', 'key' => 'PROJ-2'], 201));
    $team = Team::factory()->create();
    $author = teamMember($team);
    TeamIntegration::factory()->jira()->create(['team_id' => $team->id]);
    $first = ActionItem::factory()->withoutRetro($team, $author)->recurring(ActionItemRecurrence::Weekly)->create(['due_on' => '2026-10-05']);
    $next = ActionItem::factory()->withoutRetro($team, $author)->recurring(ActionItemRecurrence::Weekly)->create(['due_on' => '2026-10-12', 'previous_occurrence_id' => $first->id]);
    $body = ['source' => 'jira', 'project_id' => '10000', 'issue_type_id' => '11'];

    $this->actingAs($author)->postJson(route('workspaces.actionItemExports.store', [$team->workspace, $first]), $body)->assertCreated();
    $this->actingAs($author)->postJson(route('workspaces.actionItemExports.store', [$team->workspace, $next]), $body)->assertCreated();

    expect(ActionItemExternalLink::query()->orderBy('external_key')->pluck('external_key')->all())->toBe(['PROJ-1', 'PROJ-2']);
});

it('creates one issue for a double submit', function () {
    fakeJiraIssueCreation();
    [$retro, $item, $author] = exportBoardItem();
    TeamIntegration::factory()->jira()->create(['team_id' => $retro->team_id]);

    $this->actingAs($author)->postJson(...jiraExportRequest($retro, $item))->assertCreated();
    $this->actingAs($author)->postJson(...jiraExportRequest($retro, $item))
        ->assertConflict()
        ->assertJsonPath('message', 'Already exported as PROJ-42.');

    expect(collect(Http::recorded())->filter(fn (array $pair): bool => $pair[0]->method() === 'POST'))->toHaveCount(1)
        ->and(ActionItemExternalLink::query()->count())->toBe(1);
});

it('rolls back the link when the provider refuses the issue', function () {
    fakeJiraIssueCreation(create: Http::response(['errorMessages' => ['The project is archived.'], 'errors' => []], 400));
    [$retro, $item, $author] = exportBoardItem();
    TeamIntegration::factory()->jira()->create(['team_id' => $retro->team_id]);

    $this->actingAs($author)->postJson(...jiraExportRequest($retro, $item))
        ->assertUnprocessable()
        ->assertJsonPath('message', 'The project is archived.');

    expect(ActionItemExternalLink::query()->count())->toBe(0);
    Event::assertNotDispatched(ActionItemExternalLinksChanged::class);
});

it('warns that a timed out issue may exist', function () {
    fakeJiraIssueCreation(create: Http::failedConnection('cURL error 28: Operation timed out'));
    [$retro, $item, $author] = exportBoardItem();
    TeamIntegration::factory()->jira()->create(['team_id' => $retro->team_id]);

    $this->actingAs($author)->postJson(...jiraExportRequest($retro, $item))
        ->assertStatus(502)
        ->assertJsonPath('message', 'The issue may have been created. Check Jira before trying again.');

    expect(ActionItemExternalLink::query()->count())->toBe(0);
});

it('keeps the reconnect-required status after a rolled back export', function () {
    fakeLinearGraphql(['issueCreate' => fn () => Http::response(['errors' => [['message' => 'Authentication required', 'extensions' => ['code' => 'AUTHENTICATION_ERROR']]]], 401)]);
    [$retro, $item, $author] = exportBoardItem();
    $integration = TeamIntegration::factory()->linear()->create(['team_id' => $retro->team_id]);

    $this->actingAs($author)
        ->postJson(route('retros.action-items.exports.store', [$retro, $item]), ['source' => 'linear', 'team_id' => ExportLinearTeamId])
        ->assertConflict()
        ->assertJsonPath('message', 'Reconnect Linear in the team settings.');

    expect($integration->fresh()->status)->toBe(IntegrationStatus::ReconnectRequired)
        ->and(ActionItemExternalLink::query()->count())->toBe(0);
});

it('keeps a refreshed token when the export fails', function () {
    Http::fake(['auth.atlassian.com/oauth/token' => Http::response([
        'access_token' => 'jira-access-2',
        'refresh_token' => 'jira-refresh-2',
        'expires_in' => 3600,
        'scope' => 'offline_access read:jira-work write:jira-work read:jira-user',
    ])]);
    fakeJiraIssueCreation(create: Http::response(['errorMessages' => ['Nope.']], 400));
    [$retro, $item, $author] = exportBoardItem();
    $integration = TeamIntegration::factory()->jira()->expiring()->create(['team_id' => $retro->team_id]);

    $this->actingAs($author)->postJson(...jiraExportRequest($retro, $item))->assertUnprocessable();

    expect($integration->fresh()->credential('access_token'))->toBe('jira-access-2')
        ->and($integration->fresh()->credential('refresh_token'))->toBe('jira-refresh-2');
    Http::assertSent(fn (HttpClientRequest $request) => str_ends_with($request->url(), '/rest/api/3/issue') && $request->hasHeader('Authorization', 'Bearer jira-access-2'));
});

it('refuses guests and members who cannot edit the item', function () {
    [$retro, $item] = exportBoardItem();
    TeamIntegration::factory()->jira()->create(['team_id' => $retro->team_id]);
    [$other] = retroMember($retro);
    $guest = Participant::factory()->guest()->create(['retro_id' => $retro->id]);

    $this->actingAs($other)->postJson(...jiraExportRequest($retro, $item))->assertForbidden();
    $this->withCookies(retroGuestCookie($guest))->withCredentials()->postJson(...jiraExportRequest($retro, $item))->assertForbidden();

    Http::assertNothingSent();
});

it('lets the facilitator and workspace admins export', function (string $role) {
    fakeJiraIssueCreation();
    [$retro, $item] = exportBoardItem();
    TeamIntegration::factory()->jira()->create(['team_id' => $retro->team_id]);

    $response = match ($role) {
        'facilitator' => $this->actingAs(retroFacilitator($retro)[0])->postJson(...jiraExportRequest($retro, $item)),
        'workspace admin' => $this->actingAs(workspaceManager($retro->team->workspace))
            ->postJson(route('workspaces.actionItemExports.store', [$retro->team->workspace, $item]), ['source' => 'jira', 'project_id' => '10000', 'issue_type_id' => '11']),
    };

    $response->assertCreated();
})->with(['facilitator', 'workspace admin']);

it('answers with the state of the connection and validates the target', function () {
    [$retro, $item, $author] = exportBoardItem();
    TeamIntegration::factory()->linear(IntegrationAccess::Read)->create(['team_id' => $retro->team_id]);
    $url = route('retros.action-items.exports.store', [$retro, $item]);

    $this->actingAs($author)->postJson($url, ['source' => 'linear', 'team_id' => ExportLinearTeamId])
        ->assertConflict()
        ->assertJsonPath('message', 'This Linear connection is read-only.');
    $this->actingAs($author)->postJson($url, ['source' => 'jira', 'project_id' => '10000', 'issue_type_id' => '11'])
        ->assertConflict()
        ->assertJsonPath('message', 'Connect Jira in the team settings.');
    $this->actingAs($author)->postJson($url, ['source' => 'jira', 'project_id' => '../10000', 'issue_type_id' => '11'])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('project_id');
    $this->actingAs($author)->postJson($url, ['source' => 'linear', 'team_id' => 'ENG'])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('team_id');

    disableIntegrations();

    $this->actingAs($author)->postJson($url, ['source' => 'linear', 'team_id' => ExportLinearTeamId])->assertNotFound();
});

it('freezes items of a locked running retro', function () {
    [$retro, $item, $author] = exportBoardItem();
    $retro->forceFill(['phase' => RetroPhase::Discussing, 'is_locked' => true])->save();
    TeamIntegration::factory()->jira()->create(['team_id' => $retro->team_id]);

    $this->actingAs($author)->postJson(...jiraExportRequest($retro, $item))->assertStatus(423);

    Http::assertNothingSent();
});

it('exports with an assignee refused by Jira', function () {
    fakeJiraIssueCreation(create: Http::sequence()
        ->push(['errorMessages' => [], 'errors' => ['assignee' => 'User cannot be assigned issues.']], 400)
        ->push(['id' => '10042', 'key' => 'PROJ-42'], 201));
    [$retro, $item, $author] = exportBoardItem();
    $integration = TeamIntegration::factory()->jira()->create(['team_id' => $retro->team_id]);
    $assignee = teamMember($retro->team);
    IntegrationUserMapping::factory()->manual()->create(['team_integration_id' => $integration->id, 'user_id' => $assignee->id, 'external_account_id' => 'acc-1']);
    $item->update(['assignee_user_id' => $assignee->id]);

    $this->actingAs($author)->postJson(...jiraExportRequest($retro, $item))
        ->assertCreated()
        ->assertJsonPath('warnings', [[
            'code' => 'assigneeRejected',
            'message' => "Jira refused {$assignee->name} as assignee for this project, so the issue is unassigned.",
        ]]);

    expect(jiraCreatePayload(0))->toHaveKey('assignee')
        ->and(jiraCreatePayload(1))->not->toHaveKey('assignee')
        ->and($integration->accountFor($assignee)?->external_account_id)->toBe('acc-1');
});

it('exports without assignee or priority fields on the create screen', function () {
    fakeJiraIssueCreation(createMeta: jiraCreateMeta(assignee: false, priority: false));
    [$retro, $item, $author] = exportBoardItem(['priority' => ActionItemPriority::High]);
    $integration = TeamIntegration::factory()->jira()->create(['team_id' => $retro->team_id]);
    $assignee = teamMember($retro->team);
    IntegrationUserMapping::factory()->manual()->create(['team_integration_id' => $integration->id, 'user_id' => $assignee->id, 'external_account_id' => 'acc-1']);
    $item->update(['assignee_user_id' => $assignee->id]);

    $this->actingAs($author)->postJson(...jiraExportRequest($retro, $item))
        ->assertCreated()
        ->assertJsonPath('warnings', [
            ['code' => 'assigneeUnavailable', 'message' => "This Jira project doesn't accept an assignee on creation."],
            ['code' => 'priorityUnavailable', 'message' => "Priority High isn't available in this project; Jira's default was used."],
        ]);

    expect(jiraCreatePayload())->not->toHaveKey('assignee')->not->toHaveKey('priority');
});

it('warns about guest assignees and unmapped members', function (string $case, string $code, ?string $message) {
    fakeJiraIssueCreation();
    [$retro, $item, $author] = exportBoardItem();
    $integration = TeamIntegration::factory()->jira()->create(['team_id' => $retro->team_id]);
    $member = teamMember($retro->team);
    $member->forceFill(['name' => 'Grace', 'email_verified_at' => null])->save();

    if ($case === 'guest') {
        $guest = Participant::factory()->guest()->create(['retro_id' => $retro->id, 'guest_name' => 'Robin']);
        $item->update(['assignee_participant_id' => $guest->id]);
    }

    if ($case !== 'guest') {
        $item->update(['assignee_user_id' => $member->id]);
    }

    if ($case === 'never') {
        IntegrationUserMapping::factory()->neverAssign()->create(['team_integration_id' => $integration->id, 'user_id' => $member->id]);
    }

    $this->actingAs($author)->postJson(...jiraExportRequest($retro, $item))
        ->assertCreated()
        ->assertJsonPath('warnings', [['code' => $code, 'message' => $message]]);

    expect(json_encode(jiraCreatePayload()))->not->toContain('Grace');
})->with([
    'guest' => ['guest', 'guestAssignee', 'Guests have no Jira account, so the issue is unassigned.'],
    'unmapped' => ['unmapped', 'notMapped', 'Grace has no Jira account mapped, so the issue is unassigned.'],
    'never assign' => ['never', 'neverAssign', null],
]);

it('broadcasts the export to members of running boards', function () {
    fakeJiraIssueCreation();
    [$retro, $item, $author] = exportBoardItem();
    $retro->forceFill(['phase' => RetroPhase::Discussing])->save();
    TeamIntegration::factory()->jira()->create(['team_id' => $retro->team_id]);

    $this->actingAs($author)->postJson(...jiraExportRequest($retro, $item))->assertCreated();

    Event::assertDispatched(ActionItemSaved::class, fn (ActionItemSaved $event) => $event->actionItem['externalLinks'] === null);
    Event::assertDispatched(TeamActionItemSaved::class);
    Event::assertDispatched(ActionItemExternalLinksChanged::class, fn (ActionItemExternalLinksChanged $event) => $event->retroId === $retro->id
        && $event->externalLinks[0]['key'] === 'PROJ-42');
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Integrations/ActionItemExportTest.php`
Expected: FAIL — `Route [retros.action-items.exports.store] not defined.`

- [ ] **Step 3: Create the value objects, the rules and the uncertain-creation error**

Create `app/Actions/Integrations/CreatedIssue.php`:

```php
<?php

namespace App\Actions\Integrations;

class CreatedIssue
{
    public function __construct(public string $id, public string $key, public string $url) {}
}
```

Create `app/Actions/Integrations/ExportOutcome.php`:

```php
<?php

namespace App\Actions\Integrations;

class ExportOutcome
{
    public function __construct(
        public CreatedIssue $issue,
        public ExportAssignee $assignee,
        public ExportPriority $priority,
    ) {}
}
```

Create `app/Actions/Integrations/ExportActionItemRules.php`:

```php
<?php

namespace App\Actions\Integrations;

use App\Enums\IntegrationProvider;
use Illuminate\Validation\Rule;

/**
 * Target ids end up in provider URL paths, so they are digits (Jira) or a
 * UUID (Linear) and nothing else.
 */
class ExportActionItemRules
{
    /**
     * @return array<string, array<int, mixed>>
     */
    public static function rules(): array
    {
        return [
            'source' => ['required', 'string', Rule::in([IntegrationProvider::Jira->value, IntegrationProvider::Linear->value])],
            'project_id' => ['exclude_unless:source,jira', 'required', 'string', 'regex:/^\d{1,20}$/'],
            'issue_type_id' => ['exclude_unless:source,jira', 'required', 'string', 'regex:/^\d{1,20}$/'],
            'team_id' => ['exclude_unless:source,linear', 'required', 'uuid'],
        ];
    }
}
```

Create `app/Support/Integrations/Exceptions/IssueCreationUncertain.php`:

```php
<?php

namespace App\Support\Integrations\Exceptions;

/**
 * The create request left skrum but no answer came back: the issue may
 * exist, so the user must check before exporting again.
 */
class IssueCreationUncertain extends IntegrationException
{
    public function status(): int
    {
        return 502;
    }

    public function userMessage(): string
    {
        return __('The issue may have been created. Check :source before trying again.', ['source' => $this->provider->label()]);
    }
}
```

- [ ] **Step 4: Create the provider exporters**

Create `app/Actions/Integrations/ExportToJira.php`:

```php
<?php

namespace App\Actions\Integrations;

use App\Enums\ExportWarningCode;
use App\Enums\IntegrationProvider;
use App\Models\ActionItem;
use App\Models\TeamIntegration;
use App\Support\Integrations\Exceptions\IssueCreationUncertain;
use App\Support\Integrations\Exceptions\ProviderRejected;
use App\Support\Integrations\Exceptions\ProviderUnavailable;
use App\Support\Integrations\Jira\JiraClient;
use App\Support\Integrations\Jira\JiraCreateMeta;

class ExportToJira
{
    public function __construct(
        private JiraClient $jira,
        private JiraCreateMeta $createMeta,
        private ResolveExportPriority $resolvePriority,
    ) {}

    /**
     * @param  array{project_id: string, issue_type_id: string}  $target
     */
    public function create(TeamIntegration $integration, ActionItem $item, IssueDraft $draft, ExportAssignee $assignee, array $target): ExportOutcome
    {
        $fields = $this->createMeta->fields($integration, $target['project_id'], $target['issue_type_id']);
        $priority = $this->resolvePriority->handle($item, $integration, $fields);

        if ($assignee->accountId !== null && ! $fields->hasAssignee) {
            $assignee = $assignee->withoutAccount(ExportWarningCode::AssigneeUnavailable);
        }

        $payload = array_filter([
            'project' => ['id' => $target['project_id']],
            'issuetype' => ['id' => $target['issue_type_id']],
            'summary' => $draft->title,
            'description' => $draft->adf(),
            'duedate' => $draft->dueOn,
            'priority' => $priority->value === null ? null : ['id' => (string) $priority->value],
            'assignee' => $assignee->accountId === null ? null : ['accountId' => $assignee->accountId],
        ], fn (mixed $value): bool => $value !== null);

        try {
            $created = $this->send($integration, $payload);
        } catch (ProviderRejected $exception) {
            if (! isset($payload['assignee']) || ! array_key_exists('assignee', $exception->errors)) {
                throw $exception;
            }

            unset($payload['assignee']);
            $assignee = $assignee->withoutAccount(ExportWarningCode::AssigneeRejected);
            $created = $this->send($integration, $payload);
        }

        $key = (string) ($created['key'] ?? '');
        $siteUrl = rtrim((string) $integration->setting('siteUrl'), '/');

        return new ExportOutcome(new CreatedIssue((string) ($created['id'] ?? ''), $key, "{$siteUrl}/browse/{$key}"), $assignee, $priority);
    }

    /**
     * @param  array<string, mixed>  $fields
     * @return array<array-key, mixed>
     */
    private function send(TeamIntegration $integration, array $fields): array
    {
        try {
            return $this->jira->post($integration, 'rest/api/3/issue', ['fields' => $fields]);
        } catch (ProviderUnavailable $exception) {
            if ($exception->timedOut) {
                throw new IssueCreationUncertain(IntegrationProvider::Jira, $exception->detail());
            }

            throw $exception;
        }
    }
}
```

Create `app/Actions/Integrations/ExportToLinear.php`:

```php
<?php

namespace App\Actions\Integrations;

use App\Enums\ExportWarningCode;
use App\Enums\IntegrationProvider;
use App\Models\ActionItem;
use App\Models\TeamIntegration;
use App\Support\Integrations\Exceptions\IssueCreationUncertain;
use App\Support\Integrations\Exceptions\ProviderRejected;
use App\Support\Integrations\Exceptions\ProviderUnavailable;
use App\Support\Integrations\Linear\LinearClient;
use Illuminate\Support\Str;

class ExportToLinear
{
    private const CreateMutation = 'mutation IssueCreate($input: IssueCreateInput!) { issueCreate(input: $input) { success issue { id identifier url } } }';

    public function __construct(private LinearClient $linear, private ResolveExportPriority $resolvePriority) {}

    /**
     * @param  array{team_id: string}  $target
     */
    public function create(TeamIntegration $integration, ActionItem $item, IssueDraft $draft, ExportAssignee $assignee, array $target): ExportOutcome
    {
        $priority = $this->resolvePriority->handle($item, $integration);

        $input = array_filter([
            'teamId' => $target['team_id'],
            'title' => $draft->title,
            'description' => $draft->markdown(),
            'dueDate' => $draft->dueOn,
            'priority' => $priority->value,
            'assigneeId' => $assignee->accountId,
        ], fn (mixed $value): bool => $value !== null);

        try {
            $issue = $this->send($integration, $input);
        } catch (ProviderRejected $exception) {
            if (! isset($input['assigneeId']) || ! $this->mentionsAssignee($exception)) {
                throw $exception;
            }

            unset($input['assigneeId']);
            $assignee = $assignee->withoutAccount(ExportWarningCode::AssigneeRejected);
            $issue = $this->send($integration, $input);
        }

        return new ExportOutcome(
            new CreatedIssue((string) $issue['id'], (string) ($issue['identifier'] ?? ''), (string) ($issue['url'] ?? '')),
            $assignee,
            $priority,
        );
    }

    /**
     * @param  array<string, mixed>  $input
     * @return array<array-key, mixed>
     */
    private function send(TeamIntegration $integration, array $input): array
    {
        try {
            $data = $this->linear->query($integration, self::CreateMutation, ['input' => $input]);
        } catch (ProviderUnavailable $exception) {
            if ($exception->timedOut) {
                throw new IssueCreationUncertain(IntegrationProvider::Linear, $exception->detail());
            }

            throw $exception;
        }

        $issue = data_get($data, 'issueCreate.issue');

        if (data_get($data, 'issueCreate.success') !== true || ! is_array($issue) || ! is_string($issue['id'] ?? null)) {
            throw new ProviderRejected(IntegrationProvider::Linear, 'issue_not_created');
        }

        return $issue;
    }

    private function mentionsAssignee(ProviderRejected $exception): bool
    {
        return Str::contains(Str::lower($exception->getMessage().' '.json_encode($exception->errors)), 'assignee');
    }
}
```

- [ ] **Step 5: Create the export action**

Create `app/Actions/Integrations/ExportActionItem.php`:

```php
<?php

namespace App\Actions\Integrations;

use App\Actions\ActionItems\BroadcastActionItemChange;
use App\Actions\ActionItems\WorkspaceActionItemGuard;
use App\Enums\IntegrationProvider;
use App\Models\ActionItem;
use App\Models\Retro;
use App\Models\TeamIntegration;
use App\Models\User;
use App\Support\Integrations\Exceptions\ReconnectRequired;
use App\Support\Integrations\IntegrationTokens;
use Illuminate\Support\Facades\DB;

/**
 * Spec §7: one synchronous, one-shot export per item and provider. The
 * link row is written first under the item lock, so a double submit waits
 * and then finds it; any provider failure rolls the whole export back.
 */
class ExportActionItem
{
    public function __construct(
        private IntegrationTokens $tokens,
        private BuildIssueDraft $buildIssueDraft,
        private ResolveExportAssignee $resolveAssignee,
        private ExportToJira $exportToJira,
        private ExportToLinear $exportToLinear,
        private BroadcastActionItemChange $broadcast,
    ) {}

    /**
     * @param  array<string, mixed>  $target
     * @return array{actionItem: ActionItem, warnings: array<int, array{code: string, message: ?string}>}
     */
    public function handle(ActionItem $item, User $user, TeamIntegration $integration, array $target): array
    {
        $this->ensureNotExported($item, $integration);

        WorkspaceActionItemGuard::writable($item);

        $this->tokens->accessToken($integration);

        try {
            /** @var array{0: ActionItem, 1: ExportOutcome} $result */
            $result = DB::transaction(fn (): array => $this->export($item, $user, $integration, $target));
        } catch (ReconnectRequired $exception) {
            TeamIntegration::query()->find($integration->id)?->markReconnectRequired($exception->detail() ?? $exception->userMessage());

            throw $exception;
        }

        [$exported, $outcome] = $result;

        $this->broadcast->saved($exported);
        $this->broadcast->externalLinksChanged($exported);

        return ['actionItem' => $exported, 'warnings' => $this->warnings($integration->provider, $outcome)];
    }

    /**
     * @param  array<string, mixed>  $target
     * @return array{0: ActionItem, 1: ExportOutcome}
     */
    private function export(ActionItem $item, User $user, TeamIntegration $integration, array $target): array
    {
        if ($item->retro_id !== null) {
            Retro::query()->whereKey($item->retro_id)->lockForUpdate()->first();
        }

        $locked = WorkspaceActionItemGuard::lockWritable($item->id);

        $this->ensureNotExported($locked, $integration);

        $link = $locked->externalLinks()->create([
            'source' => $integration->provider,
            'external_site' => (string) $integration->site(),
            'external_id' => '',
            'external_key' => '',
            'external_url' => '',
            'created_by_user_id' => $user->id,
        ]);

        $draft = $this->buildIssueDraft->handle($locked);
        $assignee = $this->resolveAssignee->handle($locked, $integration);

        $outcome = $integration->provider === IntegrationProvider::Jira
            ? $this->exportToJira->create($integration, $locked, $draft, $assignee, $target)
            : $this->exportToLinear->create($integration, $locked, $draft, $assignee, $target);

        $link->update([
            'external_id' => $outcome->issue->id,
            'external_key' => $outcome->issue->key,
            'external_url' => $outcome->issue->url,
        ]);

        $this->rememberTarget($integration, $target);

        return [$locked->loadForPresentation(), $outcome];
    }

    private function ensureNotExported(ActionItem $item, TeamIntegration $integration): void
    {
        $existing = $item->externalLinks()->where('source', $integration->provider->value)->first();

        if ($existing === null) {
            return;
        }

        abort(409, __('Already exported as :key.', ['key' => $existing->external_key]));
    }

    /**
     * @param  array<string, mixed>  $target
     */
    private function rememberTarget(TeamIntegration $integration, array $target): void
    {
        $saved = $integration->provider === IntegrationProvider::Jira
            ? ['exportProjectId' => $target['project_id'], 'exportIssueTypeId' => $target['issue_type_id']]
            : ['exportTeamId' => $target['team_id']];

        $integration->forceFill(['settings' => [...$integration->settings, ...$saved]])->save();
    }

    /**
     * @return array<int, array{code: string, message: ?string}>
     */
    private function warnings(IntegrationProvider $provider, ExportOutcome $outcome): array
    {
        $warnings = [];

        if ($outcome->assignee->warning !== null) {
            $warnings[] = [
                'code' => $outcome->assignee->warning->value,
                'message' => $outcome->assignee->warning->message($provider, name: $outcome->assignee->name),
            ];
        }

        if ($outcome->priority->warning !== null) {
            $warnings[] = [
                'code' => $outcome->priority->warning->value,
                'message' => $outcome->priority->warning->message($provider, priority: $outcome->priority->name),
            ];
        }

        return $warnings;
    }
}
```

- [ ] **Step 6: Create the controllers and routes**

Create `app/Http/Controllers/Integrations/RetroActionItemExportsController.php`:

```php
<?php

namespace App\Http\Controllers\Integrations;

use App\Actions\ActionItems\ActionItemActor;
use App\Actions\Integrations\ActionItemExportGuard;
use App\Actions\Integrations\ExportActionItem;
use App\Actions\Integrations\ExportActionItemRules;
use App\Actions\Retros\PresentActionItem;
use App\Http\Controllers\Controller;
use App\Models\ActionItem;
use App\Models\Participant;
use App\Models\Retro;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Any phase: only a locked, still running board freezes its items (423,
 * as the workspace endpoints of spec 3).
 */
class RetroActionItemExportsController extends Controller
{
    public function __construct(
        private ActionItemExportGuard $guard,
        private ExportActionItem $exportActionItem,
        private PresentActionItem $presentActionItem,
    ) {}

    public function store(Request $request, Retro $retro, ActionItem $actionItem): JsonResponse
    {
        $actor = ActionItemActor::forParticipant(Participant::current($request));
        $user = $this->guard->authorize($actionItem, $actor);

        $validated = $request->validate(ExportActionItemRules::rules());
        $integration = $this->guard->integration($actionItem->team, $validated['source']);

        $result = $this->exportActionItem->handle($actionItem, $user, $integration, $validated);

        return response()->json([
            'actionItem' => $this->presentActionItem->handle($result['actionItem'], $actor),
            'warnings' => $result['warnings'],
        ], 201);
    }
}
```

Create `app/Http/Controllers/Integrations/WorkspaceActionItemExportsController.php`:

```php
<?php

namespace App\Http\Controllers\Integrations;

use App\Actions\ActionItems\ActionItemActor;
use App\Actions\ActionItems\WorkspaceActionItemGuard;
use App\Actions\Integrations\ActionItemExportGuard;
use App\Actions\Integrations\ExportActionItem;
use App\Actions\Integrations\ExportActionItemRules;
use App\Actions\Retros\PresentActionItem;
use App\Http\Controllers\Controller;
use App\Models\ActionItem;
use App\Models\Workspace;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class WorkspaceActionItemExportsController extends Controller
{
    public function __construct(
        private ActionItemExportGuard $guard,
        private ExportActionItem $exportActionItem,
        private PresentActionItem $presentActionItem,
    ) {}

    public function store(Request $request, Workspace $workspace, ActionItem $actionItem): JsonResponse
    {
        $user = $request->user();

        WorkspaceActionItemGuard::visible($user, $workspace, $actionItem);

        $actor = ActionItemActor::forUser($user);
        $this->guard->authorize($actionItem, $actor);

        $validated = $request->validate(ExportActionItemRules::rules());
        $integration = $this->guard->integration($actionItem->team, $validated['source']);

        $result = $this->exportActionItem->handle($actionItem, $user, $integration, $validated);

        return response()->json([
            'actionItem' => $this->presentActionItem->handle($result['actionItem'], $actor),
            'warnings' => $result['warnings'],
        ], 201);
    }
}
```

In `routes/web.php`, import both controllers and add next to Task 7's preview routes:
- in the `retros/{retro}` group:

```php
        Route::post('action-items/{actionItem}/exports', [RetroActionItemExportsController::class, 'store'])
            ->middleware(EnsureIntegrationProviderEnabled::class)
            ->name('retros.action-items.exports.store')
            ->whereUuid('actionItem');
```

- in the `w/{workspace}` group:

```php
            Route::post('action-items/{actionItem}/exports', [WorkspaceActionItemExportsController::class, 'store'])
                ->middleware(EnsureIntegrationProviderEnabled::class)
                ->name('workspaces.actionItemExports.store')
                ->whereUuid('actionItem');
```

Run `vendor/bin/sail artisan wayfinder:generate --with-form`.

- [ ] **Step 7: Add the translations**

Append to `lang/{en,fr,es,de}.json`:

| Key (en) | fr | es | de |
|---|---|---|---|
| `Already exported as :key.` | `Déjà exportée en :key.` | `Ya exportada como :key.` | `Bereits als :key exportiert.` |
| `The issue may have been created. Check :source before trying again.` | `Le ticket a peut-être été créé. Vérifiez dans :source avant de réessayer.` | `Puede que la incidencia se haya creado. Revisa :source antes de volver a intentarlo.` | `Das Issue wurde möglicherweise erstellt. Prüfe :source, bevor du es erneut versuchst.` |

- [ ] **Step 8: Run the tests to verify they pass**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Integrations tests/Feature/ActionItems tests/Feature/TranslationKeysTest.php`
Expected: PASS.

- [ ] **Step 9: Format, analyse and commit**

```bash
vendor/bin/sail bin pint --dirty --format agent
vendor/bin/sail bin phpstan analyse --no-progress
git add app/Actions/Integrations app/Support/Integrations/Exceptions/IssueCreationUncertain.php app/Http/Controllers/Integrations routes/web.php tests/Feature/Integrations/ActionItemExportTest.php lang
git commit -m "feat: export action items as Jira and Linear issues

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SosW8d2Uj7QxsF1tws5ssS"
```

---
### Task 9: Export UI (types, live links, export dialog, `PROJ-12 ↗` chips)

**Files:**
- Create: `resources/js/components/action-items/external-link-chips.tsx`, `resources/js/components/action-items/export-action-item-dialog.tsx`, `resources/js/components/action-items/export-action-item-button.tsx`
- Modify: `resources/js/types/integrations.ts`, `resources/js/lib/retro/types.ts`, `resources/js/lib/retro/api.ts`, `resources/js/lib/retro/board-reducer.ts`, `resources/js/lib/action-items/endpoints.ts`, `resources/js/hooks/use-retro-channel.ts`, `resources/js/hooks/use-retro-board.ts`, `resources/js/components/action-items/action-item-card.tsx`, `resources/js/components/retro/action-items-panel.tsx`, `resources/js/components/retro/carried-action-items-panel.tsx`, `resources/js/pages/action-items/index.tsx`, `lang/{en,fr,es,de}.json`

**Interfaces:**
- Consumes: Tasks 1, 6, 7 and 8 payloads and routes (Wayfinder `Integrations/{IntegrationTargetsController, RetroActionItemExportsController, RetroActionItemExportPreviewsController, WorkspaceActionItemExportsController, WorkspaceActionItemExportPreviewsController, TeamIntegrationsController}`); `retroRequest`, `RetroRequestError`; spec 3 `ActionItemCard`, `RunMutation`, `ActionItemEndpoints`, `upsertActionItem`.
- Produces (frontend contract for Task 10 and later plans):
  - Types in `@/types` (`resources/js/types/integrations.ts`): `TrackerProviderKey`, `PriorityLevel`, `JiraPriorityChoice`, `IntegrationPriorityMap`, `ProviderPriority`, `ExternalAccount`, `UserMapping`, `UserMappingRow`, `UserMappings`, `ExternalLink`, `ExportSource`, `ExportWarning`, `ExportTargetOption`, `ExportTargets`, `ExportPreview`; `IntegrationSettings.priorityMap`.
  - `ActionItem.externalLinks: ExternalLink[] | null`, `Snapshot.exportSources: ExportSource[]`; reducer action `{type: 'actionItem.externalLinks'; actionItemId; externalLinks}`; member event `action-item.external-links.changed`.
  - `retroRequest(route, data?, options?: {timeoutMs?: number})`.
  - `ActionItemEndpoints.exportItem(actionItemId)` and `ActionItemEndpoints.exportPreview(actionItemId, source)`.
  - Components `ExternalLinkChips` (`links`), `ExportActionItemDialog`, `ExportActionItemButton` and type `ExportContext = {workspace: string; sources: ExportSource[]; canManagePeople: boolean}`; `ActionItemCard` prop `exportContext?: ExportContext`.
- No frontend test runner exists: the checks are `npm run types:check && npm run check`, the feature tests of Tasks 1–8 (which pin every payload these components read) and the walkthrough of Task 11.

- [ ] **Step 1: Add the types**

Append to `resources/js/types/integrations.ts`:

```ts
export type TrackerProviderKey = 'jira' | 'linear';

export type PriorityLevel = 'high' | 'medium' | 'low';

export type JiraPriorityChoice = { id: string; name: string };

export type IntegrationPriorityMap = Partial<
    Record<PriorityLevel, JiraPriorityChoice | number | null>
>;

export type ProviderPriority = { id: string | number; name: string };

export type ExternalAccount = { accountId: string; displayName: string };

export type UserMapping = {
    accountId: string | null;
    displayName: string | null;
    matchedBy: 'email' | 'manual';
    accountInactive: boolean;
};

export type UserMappingRow = {
    userId: string;
    name: string;
    email: string;
    avatarUrl: string;
    mapping: UserMapping | null;
};

export type UserMappings = { members: UserMappingRow[]; matching: boolean };

export type ExternalLink = {
    source: TrackerProviderKey;
    key: string;
    url: string;
};

export type ExportSource = {
    source: TrackerProviderKey;
    label: string;
    integrationId: string;
};

export type ExportWarning = { code: string; message: string | null };

export type ExportTargetOption = { id: string; key?: string; name: string };

export type ExportTargets = {
    projects?: ExportTargetOption[];
    issueTypes?: ExportTargetOption[];
    teams?: ExportTargetOption[];
    defaults: {
        projectId?: string | null;
        issueTypeId?: string | null;
        teamId?: string | null;
    };
};

export type ExportPreview = {
    assignee: {
        state: 'mapped' | 'willMatch' | 'guest' | 'never' | 'none';
        displayName: string | null;
    };
    priority: { name: string | null };
};
```

In the same file, add `priorityMap?: IntegrationPriorityMap;` as the last member of `IntegrationSettings`.

In `resources/js/lib/retro/types.ts`:
- add at the top: `import type { ExportSource, ExternalLink } from '@/types/integrations';`
- in `ActionItem`, after `createdAt: string | null;`:

```ts
    /** Members only; null in broadcasts, where clients keep what they know. */
    externalLinks: ExternalLink[] | null;
```

- in `Snapshot`, after `carriedActionItemsHasMore: boolean;`: `exportSources: ExportSource[];`

- [ ] **Step 2: Let exports wait longer than other requests**

In `resources/js/lib/retro/api.ts`, add below `type Route = …`:

```ts
type RequestOptions = { timeoutMs?: number };
```

and change the signature and the signal of `retroRequest`:

```ts
export async function retroRequest<T = null>(
    route: Route,
    data?: Record<string, unknown>,
    options: RequestOptions = {},
): Promise<T> {
```

```ts
            signal: AbortSignal.timeout(options.timeoutMs ?? RequestTimeoutMs),
```

- [ ] **Step 3: Keep links live on the board and the global page**

In `resources/js/lib/retro/board-reducer.ts`:
- import `type { ExternalLink } from '@/types/integrations';`
- add to the action union after `| { type: 'actionItem.remove'; actionItemId: string }`:

```ts
    | {
          type: 'actionItem.externalLinks';
          actionItemId: string;
          externalLinks: ExternalLink[];
      }
```

- in `upsertActionItem`, change the merged object to keep known links when a broadcast carries `null`:

```ts
            ? {
                  ...incoming,
                  isMine: incoming.isMine || existing.isMine,
                  commentsRevision: existing.commentsRevision,
                  externalLinks: incoming.externalLinks ?? existing.externalLinks,
              }
```

- add a case after `case 'actionItem.remove':`'s block:

```ts
        case 'actionItem.externalLinks': {
            const withLinks = (items: ActionItem[]): ActionItem[] =>
                items.map((item) =>
                    item.id === action.actionItemId
                        ? { ...item, externalLinks: action.externalLinks }
                        : item,
                );

            return {
                ...state,
                actionItems: withLinks(state.actionItems),
                carriedActionItems: withLinks(state.carriedActionItems),
            };
        }
```

In `resources/js/hooks/use-retro-channel.ts`, add `'action-item.external-links.changed',` as the last entry of `MemberEvents`.

In `resources/js/hooks/use-retro-board.ts`, import `type { ExternalLink } from '@/types/integrations';` and add after the `case 'carried-action-item.removed':` block:

```ts
                case 'action-item.external-links.changed':
                    apply({
                        type: 'actionItem.externalLinks',
                        actionItemId: payload.actionItemId as string,
                        externalLinks: payload.externalLinks as ExternalLink[],
                    });
                    break;
```

In `resources/js/pages/action-items/index.tsx`, in `replaceActionItem`, add `externalLinks: incoming.externalLinks ?? item.externalLinks,` after `commentsRevision: item.commentsRevision,`.

- [ ] **Step 4: Add the export endpoints**

In `resources/js/lib/action-items/endpoints.ts`:
- import:

```ts
import RetroActionItemExportPreviewsController from '@/actions/App/Http/Controllers/Integrations/RetroActionItemExportPreviewsController';
import RetroActionItemExportsController from '@/actions/App/Http/Controllers/Integrations/RetroActionItemExportsController';
import WorkspaceActionItemExportPreviewsController from '@/actions/App/Http/Controllers/Integrations/WorkspaceActionItemExportPreviewsController';
import WorkspaceActionItemExportsController from '@/actions/App/Http/Controllers/Integrations/WorkspaceActionItemExportsController';
import type { TrackerProviderKey } from '@/types/integrations';
```

- add to `ActionItemEndpoints`:

```ts
    exportItem: (actionItemId: string) => EndpointRoute;
    exportPreview: (
        actionItemId: string,
        source: TrackerProviderKey,
    ) => EndpointRoute;
```

- add to the object returned by `boardActionItemEndpoints`:

```ts
        exportItem: (actionItem) =>
            RetroActionItemExportsController.store({
                retro: retroId,
                actionItem,
            }),
        exportPreview: (actionItem, source) =>
            RetroActionItemExportPreviewsController.show(
                { retro: retroId, actionItem },
                { query: { source } },
            ),
```

- add to the object returned by `workspaceActionItemEndpoints`:

```ts
        exportItem: (actionItem) =>
            WorkspaceActionItemExportsController.store({
                workspace,
                actionItem,
            }),
        exportPreview: (actionItem, source) =>
            WorkspaceActionItemExportPreviewsController.show(
                { workspace, actionItem },
                { query: { source } },
            ),
```

- [ ] **Step 5: Create the chips, the dialog and the button**

Create `resources/js/components/action-items/external-link-chips.tsx`:

```tsx
import { ArrowUpRight } from 'lucide-react';
import type { ExternalLink } from '@/types';

type Props = {
    links: ExternalLink[] | null;
};

export function ExternalLinkChips({ links }: Props) {
    if (links === null || links.length === 0) {
        return null;
    }

    return (
        <>
            {links.map((link) => (
                <a
                    key={link.source}
                    href={link.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-0.5 rounded border px-1.5 py-0.5 font-mono text-xs text-foreground hover:bg-muted"
                >
                    {link.key}
                    <ArrowUpRight className="size-3" aria-hidden />
                </a>
            ))}
        </>
    );
}
```

Create `resources/js/components/action-items/export-action-item-dialog.tsx`:

```tsx
import { Link } from '@inertiajs/react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import IntegrationTargetsController from '@/actions/App/Http/Controllers/Integrations/IntegrationTargetsController';
import TeamIntegrationsController from '@/actions/App/Http/Controllers/Integrations/TeamIntegrationsController';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { useTrans } from '@/hooks/use-trans';
import type { ActionItemEndpoints } from '@/lib/action-items/endpoints';
import { integrationErrorMessage } from '@/lib/integrations';
import { retroRequest } from '@/lib/retro/api';
import type { ActionItem } from '@/lib/retro/types';
import type {
    ExportPreview,
    ExportSource,
    ExportTargetOption,
    ExportTargets,
    ExportWarning,
} from '@/types';
import type { RunMutation } from './action-item-card';

/** Several provider calls run in one export (spec §7): wait longer. */
const ExportTimeoutMs = 45_000;

type Choice = {
    projectId: string | null;
    issueTypeId: string | null;
    teamId: string | null;
};

type Translate = (
    key: string,
    replacements?: Record<string, string | number>,
) => string;

type Props = {
    item: ActionItem;
    source: ExportSource;
    workspace: string;
    canManagePeople: boolean;
    endpoints: ActionItemEndpoints;
    run: RunMutation;
    onClose: () => void;
    onExported: (item: ActionItem) => void;
};

function assigneeLine(
    preview: ExportPreview,
    provider: string,
    t: Translate,
): string {
    switch (preview.assignee.state) {
        case 'mapped':
            return t('Assignee: :name (:provider)', {
                name: preview.assignee.displayName ?? '',
                provider,
            });
        case 'willMatch':
            return t(
                'Assignee: not mapped yet — skrum will try to match :name by email',
                { name: preview.assignee.displayName ?? '' },
            );
        case 'guest':
            return t('Unassigned (guest)');
        case 'never':
            return t('Unassigned (never assigned)');
        default:
            return t('Unassigned');
    }
}

function TargetSelect({
    label,
    value,
    options,
    disabled,
    onChange,
}: {
    label: string;
    value: string | null;
    options: ExportTargetOption[];
    disabled: boolean;
    onChange: (value: string) => void;
}) {
    return (
        <div className="space-y-1">
            <p className="text-sm font-medium">{label}</p>
            <Select
                value={value ?? undefined}
                disabled={disabled || options.length === 0}
                onValueChange={onChange}
            >
                <SelectTrigger className="w-full" aria-label={label}>
                    <SelectValue placeholder={label} />
                </SelectTrigger>
                <SelectContent>
                    {options.map((option) => (
                        <SelectItem key={option.id} value={option.id}>
                            {option.key
                                ? `${option.key} — ${option.name}`
                                : option.name}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    );
}

export function ExportActionItemDialog({
    item,
    source,
    workspace,
    canManagePeople,
    endpoints,
    run,
    onClose,
    onExported,
}: Props) {
    const { t } = useTrans();
    const [requestedProject, setRequestedProject] = useState<string | null>(
        null,
    );
    const [targets, setTargets] = useState<ExportTargets | null>(null);
    const [choice, setChoice] = useState<Choice>({
        projectId: null,
        issueTypeId: null,
        teamId: null,
    });
    const [preview, setPreview] = useState<ExportPreview | null>(null);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const isJira = source.source === 'jira';
    const previewUrl = endpoints.exportPreview(item.id, source.source).url;

    useEffect(() => {
        let cancelled = false;

        retroRequest<ExportTargets>(
            IntegrationTargetsController.index(
                {
                    workspace,
                    team: item.teamId,
                    integration: source.integrationId,
                },
                requestedProject === null
                    ? undefined
                    : { query: { project_id: requestedProject } },
            ),
        )
            .then((loaded) => {
                if (cancelled) {
                    return;
                }

                setTargets(loaded);
                setChoice({
                    projectId: loaded.defaults.projectId ?? null,
                    issueTypeId: loaded.defaults.issueTypeId ?? null,
                    teamId: loaded.defaults.teamId ?? null,
                });
                setLoadError(null);
            })
            .catch((error: unknown) => {
                if (!cancelled) {
                    setLoadError(
                        integrationErrorMessage(
                            error,
                            t('Could not reach :provider.', {
                                provider: source.label,
                            }),
                        ),
                    );
                }
            });

        return () => {
            cancelled = true;
        };
    }, [
        requestedProject,
        workspace,
        item.teamId,
        source.integrationId,
        source.label,
        t,
    ]);

    useEffect(() => {
        let cancelled = false;

        retroRequest<ExportPreview>({ url: previewUrl, method: 'get' })
            .then((loaded) => {
                if (!cancelled) {
                    setPreview(loaded);
                }
            })
            .catch(() => {
                if (!cancelled) {
                    setPreview(null);
                }
            });

        return () => {
            cancelled = true;
        };
    }, [previewUrl, item.assignee?.id, item.priority]);

    const ready = isJira
        ? choice.projectId !== null && choice.issueTypeId !== null
        : choice.teamId !== null;

    const submit = async () => {
        if (!ready || busy) {
            return;
        }

        setBusy(true);

        try {
            const body = isJira
                ? {
                      source: source.source,
                      project_id: choice.projectId,
                      issue_type_id: choice.issueTypeId,
                  }
                : { source: source.source, team_id: choice.teamId };
            const response = await run(
                retroRequest<{
                    actionItem: ActionItem;
                    warnings: ExportWarning[];
                }>(endpoints.exportItem(item.id), body, {
                    timeoutMs: ExportTimeoutMs,
                }),
            );

            if (!response) {
                return;
            }

            onExported(response.actionItem);

            const link = response.actionItem.externalLinks?.find(
                (candidate) => candidate.source === source.source,
            );

            toast.success(t('Exported as :key.', { key: link?.key ?? '' }));

            for (const warning of response.warnings) {
                if (warning.message !== null) {
                    toast.warning(warning.message);
                }
            }

            onClose();
        } finally {
            setBusy(false);
        }
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
            <DialogContent>
                <DialogTitle>
                    {t('Export to :provider', { provider: source.label })}
                </DialogTitle>
                <DialogDescription>
                    {t(
                        'Creates an issue with this action item and a link back to skrum. Later changes are not synced.',
                    )}
                </DialogDescription>
                {loadError !== null && (
                    <p className="text-sm text-destructive">{loadError}</p>
                )}
                {loadError === null && targets === null && (
                    <div className="flex justify-center py-4">
                        <Spinner />
                    </div>
                )}
                {loadError === null && targets !== null && (
                    <div className="space-y-3">
                        {isJira ? (
                            <>
                                <TargetSelect
                                    label={t('Project')}
                                    value={choice.projectId}
                                    options={targets.projects ?? []}
                                    disabled={busy}
                                    onChange={setRequestedProject}
                                />
                                <TargetSelect
                                    label={t('Issue type')}
                                    value={choice.issueTypeId}
                                    options={targets.issueTypes ?? []}
                                    disabled={busy}
                                    onChange={(issueTypeId) =>
                                        setChoice({ ...choice, issueTypeId })
                                    }
                                />
                            </>
                        ) : (
                            <TargetSelect
                                label={t('Linear team')}
                                value={choice.teamId}
                                options={targets.teams ?? []}
                                disabled={busy}
                                onChange={(teamId) =>
                                    setChoice({ ...choice, teamId })
                                }
                            />
                        )}
                    </div>
                )}
                {preview !== null && (
                    <ul className="space-y-1 text-sm text-muted-foreground">
                        <li>{assigneeLine(preview, source.label, t)}</li>
                        <li>
                            {preview.priority.name === null
                                ? t('Priority: :provider default', {
                                      provider: source.label,
                                  })
                                : t('Priority: :name', {
                                      name: preview.priority.name,
                                  })}
                        </li>
                    </ul>
                )}
                {canManagePeople && (
                    <Link
                        href={TeamIntegrationsController.index({
                            workspace,
                            team: item.teamId,
                        })}
                        className="text-sm underline"
                    >
                        {t('Manage people')}
                    </Link>
                )}
                <DialogFooter className="gap-2">
                    <Button variant="secondary" onClick={onClose}>
                        {t('Cancel')}
                    </Button>
                    <Button
                        disabled={!ready || busy}
                        onClick={() => void submit()}
                    >
                        {busy && <Spinner />}
                        {t('Export')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
```

Create `resources/js/components/action-items/export-action-item-button.tsx`:

```tsx
import { Upload } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useTrans } from '@/hooks/use-trans';
import type { ActionItemEndpoints } from '@/lib/action-items/endpoints';
import type { ActionItem } from '@/lib/retro/types';
import type { ExportSource } from '@/types';
import type { RunMutation } from './action-item-card';
import { ExportActionItemDialog } from './export-action-item-dialog';

export type ExportContext = {
    workspace: string;
    sources: ExportSource[];
    canManagePeople: boolean;
};

type Props = {
    item: ActionItem;
    context: ExportContext;
    endpoints: ActionItemEndpoints;
    run: RunMutation;
    onExported: (item: ActionItem) => void;
};

/**
 * One entry per connected tracker the item was not exported to yet: an
 * item is exported at most once per provider (spec §3).
 */
export function ExportActionItemButton({
    item,
    context,
    endpoints,
    run,
    onExported,
}: Props) {
    const { t } = useTrans();
    const [chosen, setChosen] = useState<ExportSource | null>(null);
    const exported = new Set(
        (item.externalLinks ?? []).map((link) => link.source),
    );
    const available = context.sources.filter(
        (source) => !exported.has(source.source),
    );

    if (available.length === 0 && chosen === null) {
        return null;
    }

    return (
        <>
            {available.length === 1 && (
                <Button
                    size="icon"
                    variant="ghost"
                    className="size-7 shrink-0"
                    aria-label={t('Export to :provider', {
                        provider: available[0].label,
                    })}
                    onClick={() => setChosen(available[0])}
                >
                    <Upload className="size-4" />
                </Button>
            )}
            {available.length > 1 && (
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button
                            size="icon"
                            variant="ghost"
                            className="size-7 shrink-0"
                            aria-label={t('Export')}
                        >
                            <Upload className="size-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        {available.map((source) => (
                            <DropdownMenuItem
                                key={source.source}
                                onSelect={() => setChosen(source)}
                            >
                                {t('Export to :provider', {
                                    provider: source.label,
                                })}
                            </DropdownMenuItem>
                        ))}
                    </DropdownMenuContent>
                </DropdownMenu>
            )}
            {chosen !== null && (
                <ExportActionItemDialog
                    item={item}
                    source={chosen}
                    workspace={context.workspace}
                    canManagePeople={context.canManagePeople}
                    endpoints={endpoints}
                    run={run}
                    onClose={() => setChosen(null)}
                    onExported={onExported}
                />
            )}
        </>
    );
}
```

- [ ] **Step 6: Wire the card, the board panels and the global page**

In `resources/js/components/action-items/action-item-card.tsx`:
- import `{ ExportActionItemButton, type ExportContext } from './export-action-item-button';` and `{ ExternalLinkChips } from './external-link-chips';`
- add `exportContext?: ExportContext;` to `Props` (after `children?: ReactNode;`) and to the destructured props;
- in the meta row, right before `{meta}`, add `<ExternalLinkChips links={item.externalLinks} />`;
- right before the `{manages && !editing && (` edit button, add:

```tsx
                {manages && exportContext && viewer.userId !== null && (
                    <ExportActionItemButton
                        item={item}
                        context={exportContext}
                        endpoints={endpoints}
                        run={run}
                        onExported={onSaved}
                    />
                )}
```

In `resources/js/components/retro/action-items-panel.tsx`, import `type { ExportContext } from '@/components/action-items/export-action-item-button';`, compute after `const groups = …`:

```tsx
    const exportContext: ExportContext | undefined =
        board.links.workspace === null
            ? undefined
            : {
                  workspace: board.links.workspace,
                  sources: board.exportSources,
                  canManagePeople: board.viewer.isWorkspaceManager,
              };
```

and pass `exportContext={exportContext}` to `ActionItemCard`.

In `resources/js/components/retro/carried-action-items-panel.tsx`, import the same type, compute after `const endpoints = useMemo(…)`:

```tsx
    const exportContext: ExportContext | undefined =
        workspace === null
            ? undefined
            : {
                  workspace,
                  sources: board.exportSources,
                  canManagePeople: board.viewer.isWorkspaceManager,
              };
```

and pass `exportContext={exportContext}` to its `ActionItemCard`.

In `resources/js/pages/action-items/index.tsx`:
- import `type { ExportSource } from '@/types';` (merge with the existing `@/types` import);
- add `exportSources: Record<string, ExportSource[]>;` to `Props` and to the destructured page props;
- pass to the `ActionItemCard` of `renderCard`:

```tsx
            exportContext={{
                workspace: workspace.slug,
                sources: exportSources[item.teamId] ?? [],
                canManagePeople: viewer.isWorkspaceManager,
            }}
```

- [ ] **Step 7: Add the translations**

Append to `lang/{en,fr,es,de}.json` (skip `Cancel` and `Unassigned` if they exist):

| Key (en) | fr | es | de |
|---|---|---|---|
| `Export` | `Exporter` | `Exportar` | `Exportieren` |
| `Export to :provider` | `Exporter vers :provider` | `Exportar a :provider` | `Nach :provider exportieren` |
| `Creates an issue with this action item and a link back to skrum. Later changes are not synced.` | `Crée un ticket avec cette action et un lien vers skrum. Les modifications ultérieures ne sont pas synchronisées.` | `Crea una incidencia con esta acción y un enlace a skrum. Los cambios posteriores no se sincronizan.` | `Erstellt ein Issue mit dieser Aktion und einem Link zurück zu skrum. Spätere Änderungen werden nicht synchronisiert.` |
| `Could not reach :provider.` | `Impossible de joindre :provider.` | `No se pudo contactar con :provider.` | `:provider ist nicht erreichbar.` |
| `Project` | `Projet` | `Proyecto` | `Projekt` |
| `Issue type` | `Type de ticket` | `Tipo de incidencia` | `Issue-Typ` |
| `Linear team` | `Équipe Linear` | `Equipo de Linear` | `Linear-Team` |
| `Assignee: :name (:provider)` | `Responsable : :name (:provider)` | `Responsable: :name (:provider)` | `Verantwortlich: :name (:provider)` |
| `Assignee: not mapped yet — skrum will try to match :name by email` | `Responsable : pas encore associé — skrum essaiera de retrouver :name par e-mail` | `Responsable: aún sin asociar — skrum intentará encontrar a :name por correo electrónico` | `Verantwortlich: noch nicht zugeordnet — skrum versucht, :name per E-Mail zu finden` |
| `Unassigned (guest)` | `Non assigné (invité)` | `Sin asignar (invitado)` | `Nicht zugewiesen (Gast)` |
| `Unassigned (never assigned)` | `Non assigné (jamais assigné)` | `Sin asignar (nunca se asigna)` | `Nicht zugewiesen (nie zuweisen)` |
| `Unassigned` | `Non assigné` | `Sin asignar` | `Nicht zugewiesen` |
| `Priority: :name` | `Priorité : :name` | `Prioridad: :name` | `Priorität: :name` |
| `Priority: :provider default` | `Priorité : valeur par défaut de :provider` | `Prioridad: la predeterminada de :provider` | `Priorität: Standard von :provider` |
| `Manage people` | `Gérer les personnes` | `Gestionar personas` | `Personen verwalten` |
| `Exported as :key.` | `Exportée en :key.` | `Exportada como :key.` | `Als :key exportiert.` |

- [ ] **Step 8: Run the checks**

Run:
```bash
vendor/bin/sail artisan wayfinder:generate --with-form
npx vp check --fix resources/js/types/integrations.ts resources/js/lib/retro/types.ts resources/js/lib/retro/api.ts resources/js/lib/retro/board-reducer.ts resources/js/lib/action-items/endpoints.ts resources/js/hooks/use-retro-channel.ts resources/js/hooks/use-retro-board.ts resources/js/components/action-items resources/js/components/retro/action-items-panel.tsx resources/js/components/retro/carried-action-items-panel.tsx resources/js/pages/action-items/index.tsx
npm run types:check && npm run check
vendor/bin/sail artisan test --compact tests/Feature/TranslationKeysTest.php
```
Expected: no type or lint error; PASS.

- [ ] **Step 9: Commit**

```bash
git add resources/js/types/integrations.ts resources/js/lib resources/js/hooks/use-retro-channel.ts resources/js/hooks/use-retro-board.ts resources/js/components/action-items resources/js/components/retro/action-items-panel.tsx resources/js/components/retro/carried-action-items-panel.tsx resources/js/pages/action-items/index.tsx lang
git commit -m "feat: export action items to Jira and Linear from their cards

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SosW8d2Uj7QxsF1tws5ssS"
```

---

### Task 10: People and Priorities panels on the integrations page

**Files:**
- Create: `resources/js/components/integrations/people-panel.tsx`, `resources/js/components/integrations/account-picker-dialog.tsx`, `resources/js/components/integrations/priorities-panel.tsx`
- Modify: `resources/js/components/integrations/jira-integration.tsx`, `resources/js/components/integrations/linear-integration.tsx`, `lang/{en,fr,es,de}.json`

**Interfaces:**
- Consumes: Tasks 4–5 routes (Wayfinder `Integrations/{IntegrationUserMappingsController, IntegrationUserMatchesController, IntegrationAccountsController, IntegrationPrioritiesController, TeamIntegrationsController}`), Task 9 types; Plan 12a `IntegrationScope`, `TeamIntegration`, `integrationErrorMessage`, the mount point after the connection details in the Jira and Linear cards.
- Produces: `PeoplePanel` (props `scope`, `connection`, `providerLabel`), `AccountPickerDialog` (props `scope`, `connection`, `providerLabel`, `memberName`, `onClose`, `onChoose(accountId)`), `PrioritiesPanel` (props `scope`, `connection`), shown on active write connections of Jira and Linear.

- [ ] **Step 1: Create the account picker**

Create `resources/js/components/integrations/account-picker-dialog.tsx`:

```tsx
import { useEffect, useState } from 'react';
import IntegrationAccountsController from '@/actions/App/Http/Controllers/Integrations/IntegrationAccountsController';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { useTrans } from '@/hooks/use-trans';
import { integrationErrorMessage } from '@/lib/integrations';
import { retroRequest } from '@/lib/retro/api';
import type {
    ExternalAccount,
    IntegrationScope,
    TeamIntegration,
} from '@/types';

const SearchDelayMs = 300;

const MinimumQueryLength = 2;

type Props = {
    scope: IntegrationScope;
    connection: TeamIntegration;
    providerLabel: string;
    memberName: string;
    onClose: () => void;
    onChoose: (accountId: string) => void;
};

export function AccountPickerDialog({
    scope,
    connection,
    providerLabel,
    memberName,
    onClose,
    onChoose,
}: Props) {
    const { t } = useTrans();
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<ExternalAccount[]>([]);
    const [searching, setSearching] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const { workspace, team } = scope;
    const integration = connection.id;
    const trimmed = query.trim();
    const searchable = trimmed.length >= MinimumQueryLength;

    useEffect(() => {
        if (trimmed.length < MinimumQueryLength) {
            return;
        }

        let cancelled = false;
        const timer = setTimeout(() => {
            setSearching(true);

            retroRequest<ExternalAccount[]>(
                IntegrationAccountsController.index(
                    { workspace, team, integration },
                    { query: { q: trimmed } },
                ),
            )
                .then((found) => {
                    if (!cancelled) {
                        setResults(found);
                        setError(null);
                    }
                })
                .catch((failure: unknown) => {
                    if (!cancelled) {
                        setError(
                            integrationErrorMessage(
                                failure,
                                t('Something went wrong.'),
                            ),
                        );
                    }
                })
                .finally(() => {
                    if (!cancelled) {
                        setSearching(false);
                    }
                });
        }, SearchDelayMs);

        return () => {
            cancelled = true;
            clearTimeout(timer);
        };
    }, [trimmed, workspace, team, integration, t]);

    return (
        <Dialog
            open
            onOpenChange={(open) => {
                if (!open) {
                    onClose();
                }
            }}
        >
            <DialogContent>
                <DialogTitle>
                    {t(':provider account of :name', {
                        provider: providerLabel,
                        name: memberName,
                    })}
                </DialogTitle>
                <DialogDescription>
                    {t('Search by name or email. Emails are not shown.')}
                </DialogDescription>
                <Input
                    autoFocus
                    value={query}
                    maxLength={100}
                    placeholder={t('Search')}
                    aria-label={t('Search')}
                    onChange={(event) => setQuery(event.target.value)}
                />
                {error !== null && (
                    <p className="text-sm text-destructive">{error}</p>
                )}
                {searchable && searching && <Spinner />}
                {searchable &&
                    !searching &&
                    error === null &&
                    results.length === 0 && (
                        <p className="text-sm text-muted-foreground">
                            {t('No account found.')}
                        </p>
                    )}
                {searchable && (
                    <ul className="max-h-64 space-y-1 overflow-y-auto">
                        {results.map((account) => (
                            <li key={account.accountId}>
                                <Button
                                    variant="ghost"
                                    className="w-full justify-start"
                                    onClick={() => onChoose(account.accountId)}
                                >
                                    {account.displayName}
                                </Button>
                            </li>
                        ))}
                    </ul>
                )}
            </DialogContent>
        </Dialog>
    );
}
```

- [ ] **Step 2: Create the People panel**

Create `resources/js/components/integrations/people-panel.tsx`:

```tsx
import { RefreshCw, UserSearch } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import IntegrationUserMappingsController from '@/actions/App/Http/Controllers/Integrations/IntegrationUserMappingsController';
import IntegrationUserMatchesController from '@/actions/App/Http/Controllers/Integrations/IntegrationUserMatchesController';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Spinner } from '@/components/ui/spinner';
import { useTrans } from '@/hooks/use-trans';
import { integrationErrorMessage } from '@/lib/integrations';
import { retroRequest } from '@/lib/retro/api';
import type {
    IntegrationScope,
    TeamIntegration,
    UserMappingRow,
    UserMappings,
} from '@/types';
import { AccountPickerDialog } from './account-picker-dialog';

/** Spec §11: the page polls every 5 s while email matching runs. */
const MatchingPollMs = 5_000;

type Props = {
    scope: IntegrationScope;
    connection: TeamIntegration;
    providerLabel: string;
};

function MappingBadge({ row }: { row: UserMappingRow }) {
    const { t } = useTrans();
    const mapping = row.mapping;

    if (mapping === null) {
        return <Badge variant="outline">{t('Not mapped')}</Badge>;
    }

    if (mapping.accountInactive) {
        return <Badge variant="destructive">{t('Account inactive')}</Badge>;
    }

    if (mapping.accountId === null) {
        return <Badge variant="secondary">{t('Never assign')}</Badge>;
    }

    return (
        <Badge variant="secondary">
            {mapping.matchedBy === 'email'
                ? t('Matched by email')
                : t('Set manually')}
        </Badge>
    );
}

export function PeoplePanel({ scope, connection, providerLabel }: Props) {
    const { t } = useTrans();
    const [data, setData] = useState<UserMappings | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [busyUser, setBusyUser] = useState<string | null>(null);
    const [picking, setPicking] = useState<UserMappingRow | null>(null);
    const [revision, setRevision] = useState(0);
    const { workspace, team } = scope;
    const integration = connection.id;
    const matching = data?.matching ?? false;

    useEffect(() => {
        let cancelled = false;

        retroRequest<UserMappings>(
            IntegrationUserMappingsController.index({
                workspace,
                team,
                integration,
            }),
        )
            .then((loaded) => {
                if (!cancelled) {
                    setData(loaded);
                    setError(null);
                }
            })
            .catch((failure: unknown) => {
                if (!cancelled) {
                    setError(
                        integrationErrorMessage(
                            failure,
                            t('Could not load the people of this team.'),
                        ),
                    );
                }
            });

        return () => {
            cancelled = true;
        };
    }, [workspace, team, integration, revision, t]);

    useEffect(() => {
        if (!matching) {
            return;
        }

        const timer = setInterval(
            () => setRevision((current) => current + 1),
            MatchingPollMs,
        );

        return () => clearInterval(timer);
    }, [matching]);

    const replaceRow = (row: UserMappingRow) =>
        setData((current) =>
            current === null
                ? current
                : {
                      ...current,
                      members: current.members.map((member) =>
                          member.userId === row.userId ? row : member,
                      ),
                  },
        );

    const fail = (failure: unknown) =>
        toast.error(integrationErrorMessage(failure, t('Something went wrong.')));

    const save = async (row: UserMappingRow, accountId: string | null) => {
        setBusyUser(row.userId);

        try {
            replaceRow(
                await retroRequest<UserMappingRow>(
                    IntegrationUserMappingsController.update({
                        workspace,
                        team,
                        integration,
                        user: row.userId,
                    }),
                    { external_account_id: accountId },
                ),
            );
        } catch (failure) {
            fail(failure);
        } finally {
            setBusyUser(null);
        }
    };

    const reset = async (row: UserMappingRow) => {
        setBusyUser(row.userId);

        try {
            await retroRequest(
                IntegrationUserMappingsController.destroy({
                    workspace,
                    team,
                    integration,
                    user: row.userId,
                }),
            );
            replaceRow({ ...row, mapping: null });
        } catch (failure) {
            fail(failure);
        } finally {
            setBusyUser(null);
        }
    };

    const matchByEmail = async () => {
        try {
            await retroRequest(
                IntegrationUserMatchesController.store({
                    workspace,
                    team,
                    integration,
                }),
            );
            setData((current) =>
                current === null ? current : { ...current, matching: true },
            );
        } catch (failure) {
            fail(failure);
        }
    };

    return (
        <section className="space-y-3 border-t pt-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                    <h3 className="text-sm font-medium">{t('People')}</h3>
                    <p className="text-xs text-muted-foreground">
                        {connection.provider === 'jira'
                            ? t(
                                  "Jira: members' emails are looked up on your Jira site.",
                              )
                            : t('Linear: emails are compared on this server.')}
                    </p>
                </div>
                <Button
                    variant="outline"
                    size="sm"
                    disabled={matching || data === null}
                    onClick={() => void matchByEmail()}
                >
                    {matching ? (
                        <Spinner />
                    ) : (
                        <RefreshCw className="size-4" aria-hidden />
                    )}
                    {t('Match by email')}
                </Button>
            </div>
            {error !== null && (
                <p className="text-sm text-destructive">{error}</p>
            )}
            {data === null && error === null && <Spinner />}
            {data !== null && (
                <ul className="divide-y rounded-md border">
                    {data.members.map((row) => (
                        <li
                            key={row.userId}
                            className="flex flex-wrap items-center gap-3 p-2 text-sm"
                        >
                            <Avatar className="size-6">
                                <AvatarImage src={row.avatarUrl} alt="" />
                                <AvatarFallback />
                            </Avatar>
                            <div className="min-w-0 flex-1">
                                <p className="truncate font-medium">
                                    {row.name}
                                </p>
                                <p className="truncate text-xs text-muted-foreground">
                                    {row.email}
                                </p>
                            </div>
                            <div className="flex min-w-0 items-center gap-2">
                                {row.mapping?.displayName && (
                                    <span className="truncate">
                                        {row.mapping.displayName}
                                    </span>
                                )}
                                <MappingBadge row={row} />
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="size-7"
                                            disabled={busyUser === row.userId}
                                            aria-label={t(
                                                'Change the :provider account of :name',
                                                {
                                                    provider: providerLabel,
                                                    name: row.name,
                                                },
                                            )}
                                        >
                                            {busyUser === row.userId ? (
                                                <Spinner />
                                            ) : (
                                                <UserSearch
                                                    className="size-4"
                                                    aria-hidden
                                                />
                                            )}
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                        <DropdownMenuItem
                                            onSelect={() => setPicking(row)}
                                        >
                                            {t('Choose an account…')}
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                            onSelect={() =>
                                                void save(row, null)
                                            }
                                        >
                                            {t('Never assign')}
                                        </DropdownMenuItem>
                                        {row.mapping !== null && (
                                            <DropdownMenuItem
                                                onSelect={() =>
                                                    void reset(row)
                                                }
                                            >
                                                {t('Reset')}
                                            </DropdownMenuItem>
                                        )}
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>
                        </li>
                    ))}
                </ul>
            )}
            {picking !== null && (
                <AccountPickerDialog
                    scope={scope}
                    connection={connection}
                    providerLabel={providerLabel}
                    memberName={picking.name}
                    onClose={() => setPicking(null)}
                    onChoose={(accountId) => {
                        const row = picking;

                        setPicking(null);
                        void save(row, accountId);
                    }}
                />
            )}
        </section>
    );
}
```

- [ ] **Step 3: Create the Priorities panel**

Create `resources/js/components/integrations/priorities-panel.tsx`:

```tsx
import { router } from '@inertiajs/react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import IntegrationPrioritiesController from '@/actions/App/Http/Controllers/Integrations/IntegrationPrioritiesController';
import TeamIntegrationsController from '@/actions/App/Http/Controllers/Integrations/TeamIntegrationsController';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { useTrans } from '@/hooks/use-trans';
import { integrationErrorMessage } from '@/lib/integrations';
import { retroRequest } from '@/lib/retro/api';
import type {
    IntegrationScope,
    PriorityLevel,
    ProviderPriority,
    TeamIntegration,
} from '@/types';

const Levels: PriorityLevel[] = ['high', 'medium', 'low'];

const DefaultChoice = 'default';

const DontSetChoice = 'none';

/** Jira's own priority names, matched on export (spec §7.2); not translated. */
const JiraDefaultNames: Record<PriorityLevel, string> = {
    high: 'High',
    medium: 'Medium',
    low: 'Low',
};

const LinearDefaults: Record<PriorityLevel, number> = {
    high: 2,
    medium: 3,
    low: 4,
};

type Props = {
    scope: IntegrationScope;
    connection: TeamIntegration;
};

export function PrioritiesPanel({ scope, connection }: Props) {
    const { t } = useTrans();
    const [priorities, setPriorities] = useState<ProviderPriority[] | null>(
        null,
    );
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const { workspace, team } = scope;
    const integration = connection.id;
    const isJira = connection.provider === 'jira';
    const map = connection.settings.priorityMap ?? {};
    const levelLabels: Record<PriorityLevel, string> = {
        high: t('High'),
        medium: t('Medium'),
        low: t('Low'),
    };

    useEffect(() => {
        let cancelled = false;

        retroRequest<ProviderPriority[]>(
            IntegrationPrioritiesController.index({
                workspace,
                team,
                integration,
            }),
        )
            .then((loaded) => {
                if (!cancelled) {
                    setPriorities(loaded);
                    setError(null);
                }
            })
            .catch((failure: unknown) => {
                if (!cancelled) {
                    setError(
                        integrationErrorMessage(
                            failure,
                            t('Something went wrong.'),
                        ),
                    );
                }
            });

        return () => {
            cancelled = true;
        };
    }, [workspace, team, integration, t]);

    const current = (level: PriorityLevel): string => {
        if (!(level in map)) {
            return DefaultChoice;
        }

        const value = map[level];

        if (value === null || value === undefined) {
            return DontSetChoice;
        }

        return typeof value === 'number' ? String(value) : value.id;
    };

    const defaultName = (level: PriorityLevel): string => {
        if (isJira) {
            return JiraDefaultNames[level];
        }

        return (
            priorities?.find((priority) => priority.id === LinearDefaults[level])
                ?.name ?? String(LinearDefaults[level])
        );
    };

    const change = async (level: PriorityLevel, choice: string) => {
        let value: string | number | null = choice;

        if (choice === DontSetChoice) {
            value = null;
        }

        if (!isJira && choice !== DefaultChoice) {
            value = Number(choice);
        }

        setBusy(true);

        try {
            await retroRequest(
                TeamIntegrationsController.update({
                    workspace,
                    team,
                    integration,
                }),
                { priority_map: { [level]: value } },
            );
            toast.success(t('Priority mapping saved.'));
            router.reload({ only: ['providers'] });
        } catch (failure) {
            toast.error(
                integrationErrorMessage(failure, t('Something went wrong.')),
            );
        } finally {
            setBusy(false);
        }
    };

    return (
        <section className="space-y-3 border-t pt-4">
            <div>
                <h3 className="text-sm font-medium">{t('Priorities')}</h3>
                <p className="text-xs text-muted-foreground">
                    {t('Priority of the issues created from action items.')}
                </p>
            </div>
            {error !== null && (
                <p className="text-sm text-destructive">{error}</p>
            )}
            {priorities === null && error === null && <Spinner />}
            {priorities !== null && (
                <div className="grid gap-2 sm:grid-cols-3">
                    {Levels.map((level) => (
                        <div key={level} className="space-y-1">
                            <p className="text-xs text-muted-foreground">
                                {levelLabels[level]}
                            </p>
                            <Select
                                value={current(level)}
                                disabled={busy}
                                onValueChange={(choice) =>
                                    void change(level, choice)
                                }
                            >
                                <SelectTrigger
                                    className="w-full"
                                    aria-label={t('Priority for :level', {
                                        level: levelLabels[level],
                                    })}
                                >
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value={DefaultChoice}>
                                        {t('Default (:name)', {
                                            name: defaultName(level),
                                        })}
                                    </SelectItem>
                                    {isJira && (
                                        <SelectItem value={DontSetChoice}>
                                            {t("Don't set")}
                                        </SelectItem>
                                    )}
                                    {priorities.map((priority) => (
                                        <SelectItem
                                            key={String(priority.id)}
                                            value={String(priority.id)}
                                        >
                                            {priority.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    ))}
                </div>
            )}
        </section>
    );
}
```

- [ ] **Step 4: Mount the panels**

In `resources/js/components/integrations/jira-integration.tsx`, import `{ PeoplePanel } from './people-panel';` and `{ PrioritiesPanel } from './priorities-panel';`. In `ConnectedJira`, inside the fragment of the non-`setup_required` branch, after the closing `</div>` of the "Story points field" block (the `<div className="space-y-2">` that follows `<IntegrationDetails …/>`) and before `</>`, add:

```tsx
                    {connection.status === 'active' &&
                        connection.access === 'write' && (
                            <>
                                <PeoplePanel
                                    scope={scope}
                                    connection={connection}
                                    providerLabel={card.label}
                                />
                                <PrioritiesPanel
                                    scope={scope}
                                    connection={connection}
                                />
                            </>
                        )}
```

In `resources/js/components/integrations/linear-integration.tsx`, import the two panels and replace the connected card's single child `<IntegrationDetails … />` with:

```tsx
            <IntegrationDetails
                connection={connection}
                rows={[
                    {
                        label: t('Linear workspace'),
                        value: connection.settings.organizationName,
                    },
                    {
                        label: t('Access'),
                        value:
                            connection.access === 'write'
                                ? t('Read and write')
                                : t('Read only'),
                    },
                ]}
            />
            {connection.status === 'active' &&
                connection.access === 'write' && (
                    <>
                        <PeoplePanel
                            scope={scope}
                            connection={connection}
                            providerLabel={card.label}
                        />
                        <PrioritiesPanel
                            scope={scope}
                            connection={connection}
                        />
                    </>
                )}
```

- [ ] **Step 5: Add the translations**

Append to `lang/{en,fr,es,de}.json` (skip `Reset`, `Search`, `High`, `Medium`, `Low` and `Something went wrong.` if they exist):

| Key (en) | fr | es | de |
|---|---|---|---|
| `People` | `Personnes` | `Personas` | `Personen` |
| `Jira: members' emails are looked up on your Jira site.` | `Jira : les e-mails des membres sont recherchés sur votre site Jira.` | `Jira: los correos de los miembros se buscan en tu sitio de Jira.` | `Jira: Die E-Mail-Adressen der Mitglieder werden auf deiner Jira-Site gesucht.` |
| `Linear: emails are compared on this server.` | `Linear : les e-mails sont comparés sur ce serveur.` | `Linear: los correos se comparan en este servidor.` | `Linear: E-Mail-Adressen werden auf diesem Server verglichen.` |
| `Match by email` | `Associer par e-mail` | `Asociar por correo electrónico` | `Per E-Mail zuordnen` |
| `Could not load the people of this team.` | `Impossible de charger les personnes de cette équipe.` | `No se pudieron cargar las personas de este equipo.` | `Die Personen dieses Teams konnten nicht geladen werden.` |
| `Change the :provider account of :name` | `Changer le compte :provider de :name` | `Cambiar la cuenta de :provider de :name` | `:provider-Konto von :name ändern` |
| `Choose an account…` | `Choisir un compte…` | `Elegir una cuenta…` | `Konto wählen …` |
| `Never assign` | `Ne jamais assigner` | `No asignar nunca` | `Nie zuweisen` |
| `Reset` | `Réinitialiser` | `Restablecer` | `Zurücksetzen` |
| `Not mapped` | `Non associé` | `Sin asociar` | `Nicht zugeordnet` |
| `Account inactive` | `Compte inactif` | `Cuenta inactiva` | `Konto inaktiv` |
| `Matched by email` | `Associé par e-mail` | `Asociado por correo electrónico` | `Per E-Mail zugeordnet` |
| `Set manually` | `Défini manuellement` | `Definido manualmente` | `Manuell festgelegt` |
| `:provider account of :name` | `Compte :provider de :name` | `Cuenta de :provider de :name` | `:provider-Konto von :name` |
| `Search by name or email. Emails are not shown.` | `Recherchez par nom ou e-mail. Les e-mails ne sont pas affichés.` | `Busca por nombre o correo electrónico. Los correos no se muestran.` | `Suche nach Name oder E-Mail. E-Mail-Adressen werden nicht angezeigt.` |
| `Search` | `Rechercher` | `Buscar` | `Suchen` |
| `No account found.` | `Aucun compte trouvé.` | `No se encontró ninguna cuenta.` | `Kein Konto gefunden.` |
| `Priorities` | `Priorités` | `Prioridades` | `Prioritäten` |
| `Priority of the issues created from action items.` | `Priorité des tickets créés à partir des actions.` | `Prioridad de las incidencias creadas a partir de las acciones.` | `Priorität der aus Aktionen erstellten Issues.` |
| `Priority for :level` | `Priorité pour :level` | `Prioridad para :level` | `Priorität für :level` |
| `Default (:name)` | `Par défaut (:name)` | `Predeterminada (:name)` | `Standard (:name)` |
| `Don't set` | `Ne pas définir` | `No definir` | `Nicht setzen` |
| `Priority mapping saved.` | `Correspondance des priorités enregistrée.` | `Asignación de prioridades guardada.` | `Prioritätszuordnung gespeichert.` |

- [ ] **Step 6: Run the checks**

Run:
```bash
vendor/bin/sail artisan wayfinder:generate --with-form
npx vp check --fix resources/js/components/integrations
npm run types:check && npm run check
vendor/bin/sail artisan test --compact tests/Feature/Integrations tests/Feature/TranslationKeysTest.php
```
Expected: no type or lint error; PASS.

- [ ] **Step 7: Commit**

```bash
git add resources/js/components/integrations lang
git commit -m "feat: add people and priority mapping panels to integrations

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SosW8d2Uj7QxsF1tws5ssS"
```

---

### Task 11: Verification

**Files:** none new (fixes only, each in the task whose code it touches).

- [ ] **Step 1: Run the whole backend suite and the static checks**

Run:
```bash
vendor/bin/sail bin pint --dirty --format agent
vendor/bin/sail bin phpstan analyse --no-progress
vendor/bin/sail artisan test --compact
npm run types:check && npm run check
npm run build
```
Expected: every test passes, phpstan reports 0 errors, no type or lint error (known pre-existing failures only in `.devcontainer/devcontainer.json` and `docs/superpowers/*.md`), the build succeeds.

- [ ] **Step 2: Check the spec criteria against the tests**

Go through spec §16 criteria 9 and 13 and §15 bullets "Export" and "Assignee and priority mapping"; for each item name the test that pins it (Tasks 1–8). Expected mapping:
- ADF/Markdown bodies with content, retro title, date, deep link, due date, never the creator → Task 7 "builds the issue from the item and its retro", Task 8 "exports a board item to Jira", "exports to Linear with a Markdown body";
- item without a retro → Task 7 "describes items added outside a retro…", Task 8 "exports items added outside a retro from the global page";
- recurring occurrences → Task 8 "exports each occurrence…"; double submit → "creates one issue for a double submit"; rollback → "rolls back the link…"; read-only → "answers with the state of the connection…"; target defaults saved → "exports a board item to Jira", "exports to Linear…";
- Jira/Linear email matching rules, no email in Linear requests, manual rows never overwritten, stale rows, inactive flag, verified members only → Task 2 and Task 3 tests;
- export resolution (mapped, never assign, lazy match stored, no email, guest, provider error) → Task 7; assignee refused → Task 8; create screen without assignee/priority → Task 8; default/override/not allowed priorities → Task 7; Linear 2/3/4 and 0–4 → Tasks 5 and 7;
- account search without emails or avatars, unknown/inactive → 422, Owner/Admin only, 409 read-only, reconnect-for-scope 409 → Task 4; reconnect to another site deletes mappings → Plan 12a (`SaveTeamIntegration`); preview makes no provider call → Task 7.
Any criterion without a test: add the test to the owning task's test file, run it, fix, commit.

- [ ] **Step 3: Manual walkthrough (real Jira Cloud and Linear test workspaces)**

With `JIRA_CLIENT_ID`/`JIRA_CLIENT_SECRET` and `LINEAR_CLIENT_ID`/`LINEAR_CLIENT_SECRET` set (redirect URIs as in `.env.example`), `composer run dev` and a queue worker running:
1. Connect Jira and Linear with "Read and write" on a team; the People panel shows "Matching…" then members matched by email (one member whose Jira email differs stays "Not mapped").
2. Map one member manually through the account search (the list shows names only), set another to "Never assign", reset a third; set High → "Highest" in Jira and Low → "No priority" in Linear.
3. On a running board (Discussing), export an item assigned to the manually mapped member to Jira: the dialog preselects "Task", shows "Assignee: {name} (Jira)" and "Priority: Highest"; the issue exists in Jira with the assignee, the priority, the due date and the link back; the card shows `PROJ-n ↗` in a second browser signed in as another member, and nothing in a guest browser.
4. Export a guest-assigned item to Linear: toast "Guests have no Linear account, so the issue is unassigned."; the issue is unassigned.
5. Export the same item again: the Jira entry is gone from its menu; forcing the request (browser devtools) answers "Already exported as PROJ-n.".
6. From the global action items page, export an item added outside a retro: the issue says "Added outside a retro on …".
7. Revoke the skrum app in Linear, export another item: 409 "Reconnect Linear in the team settings." and the integrations page shows "Reconnect required".

- [ ] **Step 4: Commit any fix**

```bash
git status --short
git add <fixed files>
git commit -m "fix: address plan 12d verification findings

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SosW8d2Uj7QxsF1tws5ssS"
```
(Skip when nothing changed.)
