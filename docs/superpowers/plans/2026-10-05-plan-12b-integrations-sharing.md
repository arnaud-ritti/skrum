# Plan 12b — Integrations sharing: links, results recap and email Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The facilitator of a retro (when a team member) or a workspace Owner/Admin can post a board or poker link to the team's Slack channel or Telegram chat (guest link only on explicit opt-in), post a results recap of a completed retro there, and email the results to participants or to the whole team — with every message escaped, built from already-revealed content only, sent by queued jobs with retries, and reported back on the board as a delivery line.

**Architecture:** One reusable path serves every share: `QueueShare` checks the team's connection, writes an `integration_deliveries` row and dispatches `DeliverToSlack` / `DeliverToTelegram` (both extend `DeliverToChannel`: `ShouldBeEncrypted`, 4 tries, backoff 10/60/300 s, 429 released after retry-after, lost access fails at once) with a message pre-built from a `ShareContent` (`LinkShareContent` or `RetroRecapContent`). The subject of a delivery is any model implementing `App\Contracts\DeliverySubject` (`Retro`, `PokerGame`; Plan 13d adds `GameRoom`), which names its team and announces a finished delivery on its own channel (`results.changed`, `game.changed`). The recap is assembled once by `BuildRetroRecap` into a `RetroRecap` value object that never holds a card author, a voter or a comment; Slack (Block Kit, `&<>` escaped, ≤ 3000 characters per section), Telegram (HTML, `htmlspecialchars`, ≤ 4096 characters) and email (`RetroRecapMail`, Markdown-escaped) only format it. Permissions live in `SharePermissions`, availability in `ShareOptions`; the board and poker snapshots expose them with the latest deliveries (`LatestDeliveries`).

**Tech Stack:** Laravel 13 (PHP 8.4), PostgreSQL, Pest, Laravel HTTP client, queues (database driver in production, `Queue::fake()` and `withFakeQueueInteractions()` in tests), notifications (mail), Reverb broadcasts, Inertia v3 + React 19, Wayfinder, Tailwind 4, lucide, Radix dialog/dropdown/checkbox, `sonner` (all installed).

**Spec:** `docs/superpowers/specs/2026-09-29-integrations-design.md` — §5 (5.1 retro and poker link shares, 5.2 recap, 5.3 email, 5.4 formatting and escaping, 5.5 delivery), §8 rows "Post a retro link, results recap…", "Post a poker link" and "See delivery status lines", §9 retro `shares` and `results-email`, poker `shares`, "Events and snapshot additions" (retro `integrations`, `results.deliveries`; poker `share` and latest deliveries), §10.1 rows Slack/Telegram link, recap and Email, §10.2, §11 "Results view", "Board header share dialog" and the share part of "Poker", §12 rows `DeliverToSlack`, `DeliverToTelegram`, `RetroResultsNotification` and `model:prune`, §13 rows for sharing, §15 bullets Recap content, Link share, Email, Delivery jobs, and §16 criteria 5, 6, the delivery half of 10 and 12. Built on Plan 12a (`docs/superpowers/plans/2026-10-05-plan-12a-integrations-foundation.md`, "Contract for Plans 12b–12d"). Game room invites (spec 6 §5.1 third bullet, spec 7 §3.1) are Plan 13d's, on the contract at the end of this plan. Parent: `docs/superpowers/specs/2026-09-29-retro-board-core-design.md`.

## Global Constraints

- Work on branch `feat/plan-12-integrations`, after Plan 12a's last commit. Plans 12c and 12d follow on the same branch **in the order 12b → 12c → 12d**; files shared with them are marked "(shared)" in the File map.
- Shells: prefix commands with `export PATH="$HOME/.orbstack/bin:/opt/homebrew/bin:$PATH";`. Commands through Sail: `vendor/bin/sail artisan …`, `vendor/bin/sail bin pint --dirty --format agent`, `vendor/bin/sail bin phpstan analyse --no-progress` (level 7, 0 errors). npm on the host.
- Tests run on PostgreSQL (the Sail `testing` database). This plan adds **no migration** (every column it uses exists since Plan 12a Task 3).
- **No new Composer or npm dependency.** Provider calls only through Plan 12a's `SlackClient::postMessage()` and `TelegramClient::sendMessageTo()`; no URL is built from user input.
- Every integration test file starts with `beforeEach(fn () => Http::preventStrayRequests());` (merged into the file's `beforeEach` when it has one) and fakes each provider call explicitly.
- Credentials are never read by this plan except inside the clients; jobs carry the delivery id, the pre-built message and the sharer's locale only (`ShouldBeEncrypted`). Delivery errors are stored through `IntegrationDelivery::markFailed()` (sanitized by Plan 12a).
- **Nothing that is not revealed leaves the instance:** link shares carry the retro/game title, team name, sharer's name and URL only; recaps and emails require a `Completed` retro and are built by `BuildRetroRecap` alone; no card author, voter, individual vote/score/rating, comment, survey, health answer, theme or card sentiment/category is ever read by a sharing class.
- **Request fields are snake_case** (`channel`, `kind`, `include_guest_link`, `audience`); responses and snapshot keys are camelCase exactly as below.
- Route names follow `routes/web.php`: `retros.shares.store`, `retros.results-email.store`, `poker.shares.store`.
- Every user-facing string via `t()` / `__()` (single-quoted PHP keys so `TranslationKeysTest` finds them) with real translations in `lang/{en,fr,es,de}.json` (German "du", French "vous", Spanish "tú"), appended at the end of each file, keeping every existing value. Each task lists its rows; add only keys that are missing at execution time (for example `Send`, `Summary`, `Suggested actions`, `Action items`, `Due :date`, `:name (guest)`, `Cancel` already exist). Provider names are never translated. `tests/Feature/TranslationKeysTest.php` stays green.
- Wayfinder: run `vendor/bin/sail artisan wayfinder:generate --with-form` after every route change. `resources/js/actions` and `resources/js/routes` are gitignored — never stage them. Frontend imports use the generated controllers, never hard-coded URLs.
- Frontend checks: `npm run types:check && npm run check` (known pre-existing failures only in `.devcontainer/devcontainer.json` and `docs/superpowers/*.md`). Format only touched files with `npx vp check --fix <paths>`.
- React: function components, `type Props`, no default exports except pages, Tailwind, lucide icons, `retroRequest()` from `@/lib/retro/api` for JSON calls, `ctx.run()` from the board/game context for mutations (it toasts errors), `usePage().props.locale` for `Intl` formatting, `toast` from `sonner`.
- PHP: constructor promotion, typed everything, array-shape docblocks on presenter return values, early returns, curly braces, no comments restating code, class constants in PascalCase. Pest helpers are global: every new helper name below is unique in `tests/`.
- Commit messages: Conventional Commits, ending with exactly:
  `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`
  `Claude-Session: https://claude.ai/code/session_01SosW8d2Uj7QxsF1tws5ssS`

## Spec amendments made with this plan

Plan writing found these gaps; the spec is updated to match (§5.1, §5.3, §5.5, §9 "Events and snapshot additions", §13):

1. **Retro snapshot `linkDeliveries`**: the latest `retro_link` delivery per channel, for viewers who may share (else `[]`). `results.deliveries` only exists once the retro is `Completed`, so without it a link posted during Writing or Discussing would have no delivery line.
2. **`results.emailRecipients: {participants, team} | null`** (recipient counts for the "Send to email" dialog, §11 "recipient count preview"); `null` for viewers who may not share or when email is unavailable.
3. **Email delivery status**: the `email` delivery row becomes `sent` (with `recipient_count`) as soon as one notification per recipient is queued; the mail transport's own retries are the queue worker's (§12, "3 tries (worker default)").
4. **Errors of the share endpoints** follow §13: a missing connection → 409 "Connect :provider in the team settings.", a lost one → 409 "Reconnect :provider in the team settings."; a disabled provider → 404; a link on a `Completed` retro, a recap or email before `Completed`, or the guest link while guest access is off → 422; an ended poker game → 403 (§15 "ended poker game → 403").
5. **Job failure text**: the delivery `error` is the translated user message of the provider error (in the sharer's locale, e.g. "Reconnect Slack in the team settings."), which the delivery line shows after "Slack: failed —".

## Review Focus

1. **Card text built to abuse the chat syntax** — `<!channel>`, `<http://evil|click>`, `<@U123>` or `&` in Slack; `<b>`, `<a href>` or `&` in Telegram; `[click](https://evil)` or `**` in the email — → shown literally, never a mention, link or markup. Pinned in Task 1 ("escapes link shares for both chats"), Task 2 ("escapes user content in Slack", "escapes user content in Telegram HTML") and Task 6 ("escapes Markdown in the mail").
2. **A very large retro** (dozens of long action items, many columns with 300-character top cards, a long summary, a hundred participant names) → the Slack message keeps every section ≤ 3000 characters and the Telegram message ≤ 4096 characters by dropping list items first (with "+ n more"), never a provider 400. Pinned in Task 2 ("keeps Slack sections within 3000 characters", "keeps Telegram messages within 4096 characters").
3. **An anonymous retro** → no participant name and no card author anywhere in the Slack JSON, the Telegram text or the email body, while action item assignees stay named ("(guest)" suffix for guests). Pinned in Task 7 ("keeps authors out of every channel on anonymous retros").
4. **The connection is lost between the click and the job** (integration deleted, marked "Reconnect required", Slack channel archived, bot kicked, provider disabled in env) → the job fails once without calling the provider or without retrying, the delivery line says why, and the board refreshes. Pinned in Task 1 ("fails at once without calling the provider when the connection is gone", "fails at once and asks for a reconnect when the Slack channel is gone", "fails at once when Telegram removed the bot").
5. **Repeated or racing shares** — a sixth post within a minute, a second email within ten minutes (also from another sharer), or an email to a member removed after the click → 429 with a translated message, or the removed member simply receives nothing. Pinned in Task 4 ("limits shares to five a minute") and Task 6 ("allows one email every ten minutes", "skips members who left before sending").

## File map

| Area | Files |
|---|---|
| Delivery plumbing | `app/Contracts/DeliverySubject.php`; `app/Enums/IntegrationDeliveryChannel.php`; `app/Models/{Retro,PokerGame}.php`; `app/Support/Integrations/Messages/{ShareContent,SlackText,TelegramText,LinkShareContent}.php`; `app/Jobs/Integrations/{DeliverToChannel,DeliverToSlack,DeliverToTelegram}.php`; `app/Actions/Integrations/{QueueShare,PresentIntegrationDelivery,LatestDeliveries}.php`; `routes/console.php` |
| Recap | `app/Support/Integrations/Messages/{RetroRecap,RecapText,RetroRecapContent,RetroRecapMail}.php`; `app/Actions/Integrations/BuildRetroRecap.php` |
| Permissions & snapshots | `app/Enums/RetroResultsAudience.php`; `app/Actions/Integrations/{SharePermissions,ShareOptions,RetroResultsRecipients}.php`; `app/Actions/Retros/{BuildBoardSnapshot,BuildResults}.php`; `app/Actions/Poker/BuildPokerSnapshot.php` **(shared: 12c adds `integrations`)** |
| Endpoints | `app/Actions/Integrations/BuildLinkShare.php`; `app/Http/Controllers/Integrations/{RetroSharesController,PokerSharesController,RetroResultsEmailsController}.php`; `app/Notifications/RetroResultsNotification.php`; `routes/web.php` **(shared: 12c/12d add routes)** |
| Frontend | `resources/js/types/integrations.ts` **(shared)**; `resources/js/lib/integrations.ts` **(shared)**; `resources/js/lib/retro/types.ts`; `resources/js/lib/poker/types.ts` **(shared: 12c extends `external`/`integrations`)**; `resources/js/components/integrations/share/{delivery-lines,post-link-section}.tsx`; `resources/js/components/retro/{board-post-link,share-board-button,guest-link-dialog,board}.tsx`; `resources/js/components/retro/results/{results-view,results-share-menu,recap-share-dialog,email-results-dialog}.tsx`; `resources/js/components/poker/{game-share-dialog,game-menu}.tsx` |
| Tests | `tests/Feature/Integrations/{DeliveryJobsTest,QueueShareTest,RetroRecapTest,RecapFormattingTest,ShareSnapshotTest,RetroSharesTest,PokerSharesTest,ResultsEmailTest,ShareRedactionTest}.php` |
| Translations | `lang/{en,fr,es,de}.json` **(shared)** — rows inside each task |

---
### Task 1: Delivery plumbing (`DeliverySubject`, `QueueShare`, delivery jobs, link content)

**Files:**
- Create: `app/Contracts/DeliverySubject.php`, `app/Support/Integrations/Messages/{ShareContent,SlackText,TelegramText,LinkShareContent}.php`, `app/Jobs/Integrations/{DeliverToChannel,DeliverToSlack,DeliverToTelegram}.php`, `app/Actions/Integrations/{QueueShare,PresentIntegrationDelivery,LatestDeliveries}.php`
- Modify: `app/Enums/IntegrationDeliveryChannel.php`, `app/Models/Retro.php`, `app/Models/PokerGame.php`, `routes/console.php`, `lang/{en,fr,es,de}.json`
- Test: create `tests/Feature/Integrations/DeliveryJobsTest.php`, `tests/Feature/Integrations/QueueShareTest.php`

**Interfaces:**
- Consumes (Plan 12a): `IntegrationProvider::{isEnabled(), label()}`, `IntegrationDeliveryChannel`, `IntegrationDeliveryKind`, `IntegrationDeliveryStatus`, `IntegrationDelivery::{markSent(), markFailed(), subject(), requestedBy(), team()}`, `IntegrationDelivery::factory()->forSubject($subject)`, `TeamIntegration::{ensureActive(), markChecked()}`, `TeamIntegration::factory()->{slack(), telegram(), reconnectRequired()}`, `Team::integration(IntegrationProvider)`, `SlackClient::postMessage(TeamIntegration, array)`, `TelegramClient::sendMessageTo(TeamIntegration, string)`, exceptions `IntegrationException` (`userMessage()`), `RateLimited` (`retryAfter`), `ProviderUnavailable`, `NotConnected`, `ReconnectRequired`; Pest `enableIntegrations()`, `disableIntegrations()`; events `ResultsChanged`, `PokerGameChanged` (`sendToOthers()`).
- Produces:
  - interface `App\Contracts\DeliverySubject { deliveryTeam(): Team; announceDeliveryChange(): void; }`, implemented by `Retro` (announces `results.changed`) and `PokerGame` (announces `game.changed`).
  - `IntegrationDeliveryChannel::provider(): ?IntegrationProvider`, `static shareChannels(): array<int, self>` (`Slack`, `Telegram`).
  - interface `App\Support\Integrations\Messages\ShareContent { toSlack(): array; toTelegram(): string; }`; `SlackText::{escape(string): string}` + constants `SectionLimit = 3000`, `HeaderLimit = 150`, `ButtonLimit = 75`; `TelegramText::{escape(string): string}` + constant `MessageLimit = 4096`; `LinkShareContent(string $text, string $buttonLabel, string $url)`.
  - jobs `App\Jobs\Integrations\DeliverToSlack(string $deliveryId, array $message, string $locale)` and `DeliverToTelegram(string $deliveryId, string $html, string $locale)`, both extending abstract `DeliverToChannel` (`$tries = 4`, `backoff(): [10, 60, 300]`).
  - `App\Actions\Integrations\QueueShare::{requireIntegration(Team, IntegrationProvider): TeamIntegration, handle(Model&DeliverySubject $subject, IntegrationDeliveryChannel $channel, IntegrationDeliveryKind $kind, User $requester, ShareContent $content): IntegrationDelivery}`.
  - `PresentIntegrationDelivery::handle(IntegrationDelivery): array{id, channel, kind, status, error, sentAt, createdAt, requestedBy, recipientCount}`; `LatestDeliveries::handle(Model $subject, array<int, IntegrationDeliveryKind> $kinds): array<int, …>` (newest per channel, sorted by channel value).
  - Pest helpers (this file only, unique names): `queuedSlackDelivery()`, `queuedTelegramDelivery()`, `runDeliveryJob()`.
- Tests required: DeliveryJobsTest — "marks a Slack delivery sent and announces it", "sends Telegram deliveries as HTML without link previews", "announces poker deliveries on the game channel", "releases a rate-limited Slack delivery after its retry-after", "releases a rate-limited Telegram delivery after retry_after", "leaves the delivery queued when the provider is down", "fails at once and asks for a reconnect when the Slack channel is gone", "fails at once when Telegram removed the bot", "fails at once without calling the provider when the connection is gone", "records the final failure after the last retry", "ignores deliveries that are gone or already finished". QueueShareTest — "queues a Slack delivery for an active connection", "queues Telegram deliveries with the HTML message", "refuses a team without an active connection", "refuses email as a share channel", "keeps credentials out of the queued job", "presents the latest delivery per channel", "escapes link shares for both chats", "prunes deliveries daily".

- [ ] **Step 1: Write the failing job tests**

Create `tests/Feature/Integrations/DeliveryJobsTest.php`:

```php
<?php

use App\Enums\IntegrationDeliveryChannel;
use App\Enums\IntegrationDeliveryStatus;
use App\Enums\IntegrationProvider;
use App\Enums\IntegrationStatus;
use App\Events\Poker\PokerGameChanged;
use App\Events\Retros\ResultsChanged;
use App\Jobs\Integrations\DeliverToSlack;
use App\Jobs\Integrations\DeliverToTelegram;
use App\Models\IntegrationDelivery;
use App\Models\PokerGame;
use App\Models\Retro;
use App\Models\TeamIntegration;
use App\Support\Integrations\Exceptions\ProviderUnavailable;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Http;

beforeEach(function () {
    Http::preventStrayRequests();
    Event::fake([ResultsChanged::class, PokerGameChanged::class]);
    enableIntegrations(IntegrationProvider::Slack, IntegrationProvider::Telegram);
});

function queuedSlackDelivery(?Retro $retro = null): IntegrationDelivery
{
    $retro ??= Retro::factory()->create();
    TeamIntegration::factory()->slack()->create(['team_id' => $retro->team_id]);

    return IntegrationDelivery::factory()->forSubject($retro)->create();
}

function queuedTelegramDelivery(?Retro $retro = null): IntegrationDelivery
{
    $retro ??= Retro::factory()->create();
    TeamIntegration::factory()->telegram()->create(['team_id' => $retro->team_id]);

    return IntegrationDelivery::factory()->forSubject($retro)->create(['channel' => IntegrationDeliveryChannel::Telegram]);
}

function runDeliveryJob(DeliverToSlack|DeliverToTelegram $job): DeliverToSlack|DeliverToTelegram
{
    $job->withFakeQueueInteractions();
    $job->handle();

    return $job;
}

it('marks a Slack delivery sent and announces it', function () {
    Http::fake(['hooks.slack.com/*' => Http::response('ok')]);
    $delivery = queuedSlackDelivery();

    runDeliveryJob(new DeliverToSlack($delivery->id, ['text' => 'hello'], 'en'))->assertNotFailed()->assertNotReleased();

    $fresh = $delivery->fresh();
    expect($fresh->status)->toBe(IntegrationDeliveryStatus::Sent)
        ->and($fresh->sent_at)->not->toBeNull()
        ->and($fresh->error)->toBeNull()
        ->and(TeamIntegration::query()->sole()->last_checked_at)->not->toBeNull();
    Http::assertSent(fn (Request $request) => $request->url() === 'https://hooks.slack.com/services/T000/B000/XXXX' && $request['text'] === 'hello');
    Event::assertDispatched(ResultsChanged::class, fn (ResultsChanged $event) => $event->retroId === $delivery->subject_id);
});

it('sends Telegram deliveries as HTML without link previews', function () {
    Http::fake(['api.telegram.org/*' => Http::response(['ok' => true, 'result' => ['message_id' => 1]])]);
    $delivery = queuedTelegramDelivery();

    runDeliveryJob(new DeliverToTelegram($delivery->id, '<b>Hello</b>', 'en'))->assertNotFailed();

    expect($delivery->fresh()->status)->toBe(IntegrationDeliveryStatus::Sent);
    Http::assertSent(fn (Request $request) => str_ends_with($request->url(), '/sendMessage')
        && $request['chat_id'] === '-100123'
        && $request['text'] === '<b>Hello</b>'
        && $request['parse_mode'] === 'HTML'
        && $request['link_preview_options'] === ['is_disabled' => true]);
});

it('announces poker deliveries on the game channel', function () {
    Http::fake(['hooks.slack.com/*' => Http::response('ok')]);
    $game = PokerGame::factory()->create();
    TeamIntegration::factory()->slack()->create(['team_id' => $game->team_id]);
    $delivery = IntegrationDelivery::factory()->forSubject($game)->create();

    runDeliveryJob(new DeliverToSlack($delivery->id, ['text' => 'hello'], 'en'));

    Event::assertDispatched(PokerGameChanged::class, fn (PokerGameChanged $event) => $event->gameId === $game->id);
    Event::assertNotDispatched(ResultsChanged::class);
});

it('releases a rate-limited Slack delivery after its retry-after', function () {
    Http::fake(['hooks.slack.com/*' => Http::response('rate_limited', 429, ['Retry-After' => '42'])]);
    $delivery = queuedSlackDelivery();

    runDeliveryJob(new DeliverToSlack($delivery->id, ['text' => 'hello'], 'en'))->assertReleased(42)->assertNotFailed();

    expect($delivery->fresh()->status)->toBe(IntegrationDeliveryStatus::Queued);
});

it('releases a rate-limited Telegram delivery after retry_after', function () {
    Http::fake(['api.telegram.org/*' => Http::response(['ok' => false, 'error_code' => 429, 'description' => 'Too Many Requests', 'parameters' => ['retry_after' => 7]], 429)]);
    $delivery = queuedTelegramDelivery();

    runDeliveryJob(new DeliverToTelegram($delivery->id, 'hi', 'en'))->assertReleased(7);

    expect($delivery->fresh()->status)->toBe(IntegrationDeliveryStatus::Queued);
});

it('leaves the delivery queued when the provider is down', function () {
    Http::fake(['hooks.slack.com/*' => Http::response('oops', 503)]);
    $delivery = queuedSlackDelivery();
    $job = new DeliverToSlack($delivery->id, ['text' => 'hello'], 'en');
    $job->withFakeQueueInteractions();

    expect(fn () => $job->handle())->toThrow(ProviderUnavailable::class);
    expect($delivery->fresh()->status)->toBe(IntegrationDeliveryStatus::Queued);
    Event::assertNotDispatched(ResultsChanged::class);
});

it('fails at once and asks for a reconnect when the Slack channel is gone', function (int $status, string $body) {
    Http::fake(['hooks.slack.com/*' => Http::response($body, $status)]);
    $delivery = queuedSlackDelivery();

    runDeliveryJob(new DeliverToSlack($delivery->id, ['text' => 'hello'], 'en'))->assertFailed();

    $fresh = $delivery->fresh();
    expect($fresh->status)->toBe(IntegrationDeliveryStatus::Failed)
        ->and($fresh->error)->toBe('Reconnect Slack in the team settings.')
        ->and(TeamIntegration::query()->sole()->status)->toBe(IntegrationStatus::ReconnectRequired);
    Event::assertDispatched(ResultsChanged::class);
})->with([
    'no service' => [404, 'no_service'],
    'forbidden' => [403, 'action_prohibited'],
    'archived' => [410, 'channel_is_archived'],
]);

it('fails at once when Telegram removed the bot', function () {
    Http::fake(['api.telegram.org/*' => Http::response(['ok' => false, 'error_code' => 403, 'description' => 'Forbidden: bot was kicked from the group chat'], 403)]);
    $delivery = queuedTelegramDelivery();

    runDeliveryJob(new DeliverToTelegram($delivery->id, 'hi', 'fr'))->assertFailed();

    expect($delivery->fresh()->error)->toBe("Reconnectez Telegram dans les paramètres de l'équipe.")
        ->and(TeamIntegration::query()->sole()->status)->toBe(IntegrationStatus::ReconnectRequired);
});

it('fails at once without calling the provider when the connection is gone', function (Closure $breakConnection, string $error) {
    Http::fake();
    $delivery = queuedSlackDelivery();
    $breakConnection(TeamIntegration::query()->sole());

    runDeliveryJob(new DeliverToSlack($delivery->id, ['text' => 'hello'], 'en'))->assertFailed();

    expect($delivery->fresh())->status->toBe(IntegrationDeliveryStatus::Failed)->error->toBe($error);
    Http::assertNothingSent();
})->with([
    'disconnected' => [fn (TeamIntegration $integration) => $integration->delete(), 'Connect Slack in the team settings.'],
    'reconnect required' => [fn (TeamIntegration $integration) => $integration->forceFill(['status' => IntegrationStatus::ReconnectRequired])->save(), 'Reconnect Slack in the team settings.'],
    'provider disabled' => [fn () => disableIntegrations(), 'Connect Slack in the team settings.'],
]);

it('records the final failure after the last retry', function () {
    $delivery = queuedSlackDelivery();

    (new DeliverToSlack($delivery->id, ['text' => 'hello'], 'en'))->failed(new ProviderUnavailable(IntegrationProvider::Slack, 'HTTP 503'));

    expect($delivery->fresh())
        ->status->toBe(IntegrationDeliveryStatus::Failed)
        ->error->toBe('Slack did not respond. Try again later.');
    Event::assertDispatched(ResultsChanged::class);
});

it('ignores deliveries that are gone or already finished', function () {
    Http::fake();
    $sent = IntegrationDelivery::factory()->sent()->create();
    $job = new DeliverToSlack($sent->id, ['text' => 'hello'], 'en');

    runDeliveryJob($job)->assertNotFailed();
    $job->failed(new RuntimeException('late'));
    runDeliveryJob(new DeliverToSlack('0199d3f0-0000-7000-8000-000000000000', ['text' => 'hello'], 'en'))->assertNotFailed();

    expect($sent->fresh()->status)->toBe(IntegrationDeliveryStatus::Sent);
    Http::assertNothingSent();
});
```

- [ ] **Step 2: Write the failing share tests**

Create `tests/Feature/Integrations/QueueShareTest.php`:

```php
<?php

use App\Actions\Integrations\LatestDeliveries;
use App\Actions\Integrations\QueueShare;
use App\Enums\IntegrationDeliveryChannel;
use App\Enums\IntegrationDeliveryKind;
use App\Enums\IntegrationDeliveryStatus;
use App\Enums\IntegrationProvider;
use App\Jobs\Integrations\DeliverToSlack;
use App\Jobs\Integrations\DeliverToTelegram;
use App\Models\IntegrationDelivery;
use App\Models\Retro;
use App\Models\TeamIntegration;
use App\Models\User;
use App\Support\Integrations\Exceptions\NotConnected;
use App\Support\Integrations\Exceptions\ReconnectRequired;
use App\Support\Integrations\Messages\LinkShareContent;
use Illuminate\Console\Scheduling\Event as ScheduledEvent;
use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;

beforeEach(function () {
    Http::preventStrayRequests();
    Queue::fake();
    enableIntegrations(IntegrationProvider::Slack, IntegrationProvider::Telegram);
});

it('queues a Slack delivery for an active connection', function () {
    $retro = Retro::factory()->create();
    TeamIntegration::factory()->slack()->create(['team_id' => $retro->team_id]);
    $sharer = User::factory()->create(['name' => 'Sam Sharer']);
    $content = new LinkShareContent('Sam invites you', 'Open', 'https://skrum.test/retros/1');

    app()->setLocale('fr');
    $delivery = app(QueueShare::class)->handle($retro, IntegrationDeliveryChannel::Slack, IntegrationDeliveryKind::RetroLink, $sharer, $content);

    expect($delivery->only(['team_id', 'subject_id', 'requested_by_user_id']))->toBe([
        'team_id' => $retro->team_id,
        'subject_id' => $retro->id,
        'requested_by_user_id' => $sharer->id,
    ])
        ->and($delivery->subject_type)->toBe($retro->getMorphClass())
        ->and($delivery->channel)->toBe(IntegrationDeliveryChannel::Slack)
        ->and($delivery->kind)->toBe(IntegrationDeliveryKind::RetroLink)
        ->and($delivery->status)->toBe(IntegrationDeliveryStatus::Queued);
    Queue::assertPushed(DeliverToSlack::class, fn (DeliverToSlack $job) => $job->deliveryId === $delivery->id
        && $job->message === $content->toSlack()
        && $job->locale === 'fr');
    Queue::assertNotPushed(DeliverToTelegram::class);
});

it('queues Telegram deliveries with the HTML message', function () {
    $retro = Retro::factory()->create();
    TeamIntegration::factory()->telegram()->create(['team_id' => $retro->team_id]);
    $content = new LinkShareContent('Sam invites you', 'Open', 'https://skrum.test/retros/1');

    $delivery = app(QueueShare::class)->handle($retro, IntegrationDeliveryChannel::Telegram, IntegrationDeliveryKind::RetroLink, User::factory()->create(), $content);

    Queue::assertPushed(DeliverToTelegram::class, fn (DeliverToTelegram $job) => $job->deliveryId === $delivery->id && $job->html === $content->toTelegram());
});

it('refuses a team without an active connection', function (Closure $setUp, string $exception) {
    $retro = Retro::factory()->create();
    $setUp($retro);

    expect(fn () => app(QueueShare::class)->handle($retro, IntegrationDeliveryChannel::Slack, IntegrationDeliveryKind::RetroLink, User::factory()->create(), new LinkShareContent('a', 'b', 'https://skrum.test')))
        ->toThrow($exception);
    expect(IntegrationDelivery::query()->count())->toBe(0);
    Queue::assertNothingPushed();
})->with([
    'not connected' => [fn () => null, NotConnected::class],
    'reconnect required' => [fn (Retro $retro) => TeamIntegration::factory()->slack()->reconnectRequired()->create(['team_id' => $retro->team_id]), ReconnectRequired::class],
    'provider disabled' => [function (Retro $retro): void {
        TeamIntegration::factory()->slack()->create(['team_id' => $retro->team_id]);
        disableIntegrations();
    }, NotConnected::class],
]);

it('refuses email as a share channel', function () {
    $retro = Retro::factory()->create();

    expect(fn () => app(QueueShare::class)->handle($retro, IntegrationDeliveryChannel::Email, IntegrationDeliveryKind::RetroResults, User::factory()->create(), new LinkShareContent('a', 'b', 'https://skrum.test')))
        ->toThrow(InvalidArgumentException::class);
});

it('keeps credentials out of the queued job', function () {
    $retro = Retro::factory()->create();
    TeamIntegration::factory()->slack()->create(['team_id' => $retro->team_id]);

    app(QueueShare::class)->handle($retro, IntegrationDeliveryChannel::Slack, IntegrationDeliveryKind::RetroLink, User::factory()->create(), new LinkShareContent('a', 'b', 'https://skrum.test'));

    Queue::assertPushed(DeliverToSlack::class, function (DeliverToSlack $job) {
        $serialized = serialize($job);

        return ! str_contains($serialized, 'hooks.slack.com') && ! str_contains($serialized, 'xoxp-test-token');
    });
    expect(json_encode(IntegrationDelivery::query()->sole()->toArray()))->not->toContain('hooks.slack.com');
});

it('presents the latest delivery per channel', function () {
    $retro = Retro::factory()->create();
    $sharer = User::factory()->create(['name' => 'Sam Sharer']);
    IntegrationDelivery::factory()->forSubject($retro)->failed()->create(['created_at' => now()->subHour()]);
    $latestSlack = IntegrationDelivery::factory()->forSubject($retro)->sent()->create(['requested_by_user_id' => $sharer->id, 'created_at' => now()->subMinute()]);
    $telegram = IntegrationDelivery::factory()->forSubject($retro)->create(['channel' => IntegrationDeliveryChannel::Telegram]);
    IntegrationDelivery::factory()->forSubject($retro)->create(['kind' => IntegrationDeliveryKind::RetroResults]);
    IntegrationDelivery::factory()->create();

    $latest = app(LatestDeliveries::class)->handle($retro, [IntegrationDeliveryKind::RetroLink]);

    expect(array_column($latest, 'id'))->toBe([$latestSlack->id, $telegram->id])
        ->and($latest[0])->toMatchArray([
            'channel' => 'slack',
            'kind' => 'retro_link',
            'status' => 'sent',
            'error' => null,
            'requestedBy' => 'Sam Sharer',
            'recipientCount' => null,
        ])
        ->and($latest[0]['sentAt'])->not->toBeNull()
        ->and($latest[1]['status'])->toBe('queued');
});

it('escapes link shares for both chats', function () {
    $content = new LinkShareContent('Ana invites you to "<!channel> & <http://evil|click>" (Team)', 'Open', 'https://skrum.test/join/abc?x=1&y=2');

    $slack = json_encode($content->toSlack(), JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    $telegram = $content->toTelegram();

    expect($slack)->not->toContain('<!channel>')
        ->and($slack)->not->toContain('<http://evil|click>')
        ->and($slack)->toContain('&lt;!channel&gt; &amp; &lt;http://evil|click&gt;')
        ->and($content->toSlack()['blocks'][1]['elements'][0]['url'])->toBe('https://skrum.test/join/abc?x=1&y=2')
        ->and($telegram)->toContain('&lt;!channel&gt; &amp; &lt;http://evil|click&gt;')
        ->and($telegram)->toContain('<a href="https://skrum.test/join/abc?x=1&amp;y=2">Open</a>')
        ->and($telegram)->not->toContain('<http://evil');
});

it('prunes deliveries daily', function () {
    $prune = collect(app(Schedule::class)->events())
        ->first(fn (ScheduledEvent $event) => str_contains((string) $event->command, 'model:prune') && str_contains((string) $event->command, 'IntegrationDelivery'));

    expect($prune)->not->toBeNull()
        ->and($prune->expression)->toBe('0 0 * * *');
});
```

- [ ] **Step 3: Run them to verify they fail**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Integrations/DeliveryJobsTest.php tests/Feature/Integrations/QueueShareTest.php`
Expected: FAIL — `Class "App\Jobs\Integrations\DeliverToSlack" not found`.

- [ ] **Step 4: Add the delivery subject contract**

Create `app/Contracts/DeliverySubject.php`:

```php
<?php

namespace App\Contracts;

use App\Models\Team;

/**
 * A model an integration delivery can be about: its team owns the
 * connection used, and it tells its viewers when a delivery changed.
 */
interface DeliverySubject
{
    public function deliveryTeam(): Team;

    public function announceDeliveryChange(): void;
}
```

In `app/Models/Retro.php`, add the imports `App\Contracts\DeliverySubject` and `App\Events\Retros\ResultsChanged`, declare `class Retro extends Model implements DeliverySubject`, and add after `isFacilitator()`:

```php
    public function deliveryTeam(): Team
    {
        return $this->team;
    }

    public function announceDeliveryChange(): void
    {
        (new ResultsChanged($this->id))->sendToOthers();
    }
```

In `app/Models/PokerGame.php`, add the imports `App\Contracts\DeliverySubject` and `App\Events\Poker\PokerGameChanged`, declare `class PokerGame extends Model implements DeliverySubject`, and add after `isFacilitator()`:

```php
    public function deliveryTeam(): Team
    {
        return $this->team;
    }

    public function announceDeliveryChange(): void
    {
        (new PokerGameChanged($this->id))->sendToOthers();
    }
```

A job has no socket id, so `sendToOthers()` reaches every viewer, the sharer included.

- [ ] **Step 5: Extend the channel enum**

Replace `app/Enums/IntegrationDeliveryChannel.php`:

```php
<?php

namespace App\Enums;

enum IntegrationDeliveryChannel: string
{
    case Slack = 'slack';
    case Telegram = 'telegram';
    case Email = 'email';

    /**
     * @return array<int, self>
     */
    public static function shareChannels(): array
    {
        return [self::Slack, self::Telegram];
    }

    public function provider(): ?IntegrationProvider
    {
        return match ($this) {
            self::Slack => IntegrationProvider::Slack,
            self::Telegram => IntegrationProvider::Telegram,
            self::Email => null,
        };
    }
}
```

- [ ] **Step 6: Create the message classes**

Create `app/Support/Integrations/Messages/ShareContent.php`:

```php
<?php

namespace App\Support\Integrations\Messages;

/**
 * A message built once, in the sharer's locale, when a share is requested.
 */
interface ShareContent
{
    /**
     * @return array<string, mixed>
     */
    public function toSlack(): array;

    public function toTelegram(): string;
}
```

Create `app/Support/Integrations/Messages/SlackText.php`:

```php
<?php

namespace App\Support\Integrations\Messages;

class SlackText
{
    public const SectionLimit = 3000;

    public const HeaderLimit = 150;

    public const ButtonLimit = 75;

    /**
     * Slack reads `<…>` as mentions and links and `&` as an entity, so user
     * text escaped this way can never ping a channel or hide a link.
     */
    public static function escape(string $text): string
    {
        return str_replace(['&', '<', '>'], ['&amp;', '&lt;', '&gt;'], $text);
    }
}
```

Create `app/Support/Integrations/Messages/TelegramText.php`:

```php
<?php

namespace App\Support\Integrations\Messages;

class TelegramText
{
    public const MessageLimit = 4096;

    /**
     * Telegram's HTML mode knows only a few named entities, so quotes are
     * written as numeric ones (ENT_HTML401).
     */
    public static function escape(string $text): string
    {
        return htmlspecialchars($text, ENT_QUOTES | ENT_SUBSTITUTE | ENT_HTML401, 'UTF-8');
    }
}
```

Create `app/Support/Integrations/Messages/LinkShareContent.php`:

```php
<?php

namespace App\Support\Integrations\Messages;

use Illuminate\Support\Str;

class LinkShareContent implements ShareContent
{
    private const TextLimit = 2900;

    public function __construct(
        public string $text,
        public string $buttonLabel,
        public string $url,
    ) {}

    public function toSlack(): array
    {
        $text = SlackText::escape(Str::limit($this->text, self::TextLimit, '…'));

        return [
            'text' => $text,
            'blocks' => [
                ['type' => 'section', 'text' => ['type' => 'mrkdwn', 'text' => $text]],
                ['type' => 'actions', 'elements' => [[
                    'type' => 'button',
                    'text' => ['type' => 'plain_text', 'text' => Str::limit($this->buttonLabel, SlackText::ButtonLimit - 1, '…')],
                    'url' => $this->url,
                ]]],
            ],
        ];
    }

    public function toTelegram(): string
    {
        $text = TelegramText::escape(Str::limit($this->text, self::TextLimit, '…'));
        $url = TelegramText::escape($this->url);
        $label = TelegramText::escape($this->buttonLabel);

        return "{$text}\n\n<a href=\"{$url}\">{$label}</a>";
    }
}
```

- [ ] **Step 7: Create the delivery jobs**

Create `app/Jobs/Integrations/DeliverToChannel.php`:

```php
<?php

namespace App\Jobs\Integrations;

use App\Contracts\DeliverySubject;
use App\Enums\IntegrationDeliveryStatus;
use App\Enums\IntegrationProvider;
use App\Models\IntegrationDelivery;
use App\Models\TeamIntegration;
use App\Support\Integrations\Exceptions\IntegrationException;
use App\Support\Integrations\Exceptions\NotConnected;
use App\Support\Integrations\Exceptions\ProviderUnavailable;
use App\Support\Integrations\Exceptions\RateLimited;
use Illuminate\Contracts\Queue\ShouldBeEncrypted;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Traits\Localizable;
use Throwable;

/**
 * Posts one pre-built message. The connection's secrets are read from the
 * database at run time, so neither the payload nor a failed-job record
 * ever holds them.
 */
abstract class DeliverToChannel implements ShouldBeEncrypted, ShouldQueue
{
    use Localizable;
    use Queueable;

    public int $tries = 4;

    public function __construct(public string $deliveryId, public string $locale) {}

    /**
     * @return array<int, int>
     */
    public function backoff(): array
    {
        return [10, 60, 300];
    }

    abstract protected function provider(): IntegrationProvider;

    abstract protected function send(TeamIntegration $integration): void;

    public function handle(): void
    {
        $delivery = $this->pendingDelivery();

        if ($delivery === null) {
            return;
        }

        try {
            $integration = $this->integration($delivery);
            $this->send($integration);
        } catch (RateLimited $exception) {
            $this->release($exception->retryAfter);

            return;
        } catch (ProviderUnavailable $exception) {
            throw $exception;
        } catch (IntegrationException $exception) {
            $this->finishFailed($delivery, $exception);
            $this->fail($exception);

            return;
        }

        $integration->markChecked();
        $delivery->markSent();
        $this->announce($delivery);
    }

    public function failed(?Throwable $exception): void
    {
        $delivery = $this->pendingDelivery();

        if ($delivery === null) {
            return;
        }

        $this->finishFailed($delivery, $exception);
    }

    private function pendingDelivery(): ?IntegrationDelivery
    {
        $delivery = IntegrationDelivery::query()->with('team')->find($this->deliveryId);

        if ($delivery === null || $delivery->status !== IntegrationDeliveryStatus::Queued) {
            return null;
        }

        return $delivery;
    }

    private function integration(IntegrationDelivery $delivery): TeamIntegration
    {
        $provider = $this->provider();
        $integration = $provider->isEnabled() ? $delivery->team->integration($provider) : null;

        if ($integration === null) {
            throw new NotConnected($provider);
        }

        $integration->ensureActive();

        return $integration;
    }

    private function finishFailed(IntegrationDelivery $delivery, ?Throwable $exception): void
    {
        $message = $this->withLocale($this->locale, fn (): string => $exception instanceof IntegrationException
            ? $exception->userMessage()
            : __('The message could not be delivered.'));

        $delivery->markFailed($message);
        $this->announce($delivery);
    }

    private function announce(IntegrationDelivery $delivery): void
    {
        $subject = $delivery->subject;

        if ($subject instanceof DeliverySubject) {
            $subject->announceDeliveryChange();
        }
    }
}
```

Create `app/Jobs/Integrations/DeliverToSlack.php`:

```php
<?php

namespace App\Jobs\Integrations;

use App\Enums\IntegrationProvider;
use App\Models\TeamIntegration;
use App\Support\Integrations\Slack\SlackClient;

class DeliverToSlack extends DeliverToChannel
{
    /**
     * @param  array<string, mixed>  $message
     */
    public function __construct(string $deliveryId, public array $message, string $locale)
    {
        parent::__construct($deliveryId, $locale);
    }

    protected function provider(): IntegrationProvider
    {
        return IntegrationProvider::Slack;
    }

    protected function send(TeamIntegration $integration): void
    {
        app(SlackClient::class)->postMessage($integration, $this->message);
    }
}
```

Create `app/Jobs/Integrations/DeliverToTelegram.php`:

```php
<?php

namespace App\Jobs\Integrations;

use App\Enums\IntegrationProvider;
use App\Models\TeamIntegration;
use App\Support\Integrations\Telegram\TelegramClient;

class DeliverToTelegram extends DeliverToChannel
{
    public function __construct(string $deliveryId, public string $html, string $locale)
    {
        parent::__construct($deliveryId, $locale);
    }

    protected function provider(): IntegrationProvider
    {
        return IntegrationProvider::Telegram;
    }

    protected function send(TeamIntegration $integration): void
    {
        app(TelegramClient::class)->sendMessageTo($integration, $this->html);
    }
}
```

- [ ] **Step 8: Create the share action and the presenters**

Create `app/Actions/Integrations/PresentIntegrationDelivery.php`:

```php
<?php

namespace App\Actions\Integrations;

use App\Models\IntegrationDelivery;

/**
 * @phpstan-type Delivery array{
 *     id: string,
 *     channel: string,
 *     kind: string,
 *     status: string,
 *     error: ?string,
 *     sentAt: ?string,
 *     createdAt: ?string,
 *     requestedBy: ?string,
 *     recipientCount: ?int
 * }
 */
class PresentIntegrationDelivery
{
    /**
     * @return Delivery
     */
    public function handle(IntegrationDelivery $delivery): array
    {
        return [
            'id' => $delivery->id,
            'channel' => $delivery->channel->value,
            'kind' => $delivery->kind->value,
            'status' => $delivery->status->value,
            'error' => $delivery->error,
            'sentAt' => $delivery->sent_at?->toIso8601String(),
            'createdAt' => $delivery->created_at?->toIso8601String(),
            'requestedBy' => $delivery->requestedBy?->name,
            'recipientCount' => $delivery->recipient_count,
        ];
    }
}
```

Create `app/Actions/Integrations/LatestDeliveries.php`:

```php
<?php

namespace App\Actions\Integrations;

use App\Enums\IntegrationDeliveryKind;
use App\Models\IntegrationDelivery;
use Illuminate\Database\Eloquent\Model;

/**
 * @phpstan-import-type Delivery from PresentIntegrationDelivery
 */
class LatestDeliveries
{
    public function __construct(private PresentIntegrationDelivery $presentIntegrationDelivery) {}

    /**
     * The newest delivery of each channel, for the delivery lines. Rows are
     * pruned after 90 days, so the scan stays small.
     *
     * @param  array<int, IntegrationDeliveryKind>  $kinds
     * @return array<int, Delivery>
     */
    public function handle(Model $subject, array $kinds): array
    {
        return IntegrationDelivery::query()
            ->whereMorphedTo('subject', $subject)
            ->whereIn('kind', array_map(fn (IntegrationDeliveryKind $kind): string => $kind->value, $kinds))
            ->with('requestedBy')
            ->orderByDesc('created_at')
            ->get()
            ->unique(fn (IntegrationDelivery $delivery): string => $delivery->channel->value)
            ->sortBy(fn (IntegrationDelivery $delivery): string => $delivery->channel->value)
            ->map(fn (IntegrationDelivery $delivery): array => $this->presentIntegrationDelivery->handle($delivery))
            ->values()
            ->all();
    }
}
```

Create `app/Actions/Integrations/QueueShare.php`:

```php
<?php

namespace App\Actions\Integrations;

use App\Contracts\DeliverySubject;
use App\Enums\IntegrationDeliveryChannel;
use App\Enums\IntegrationDeliveryKind;
use App\Enums\IntegrationDeliveryStatus;
use App\Enums\IntegrationProvider;
use App\Jobs\Integrations\DeliverToSlack;
use App\Jobs\Integrations\DeliverToTelegram;
use App\Models\IntegrationDelivery;
use App\Models\Team;
use App\Models\TeamIntegration;
use App\Models\User;
use App\Support\Integrations\Exceptions\NotConnected;
use App\Support\Integrations\Messages\ShareContent;
use Illuminate\Database\Eloquent\Model;
use InvalidArgumentException;

class QueueShare
{
    public function requireIntegration(Team $team, IntegrationProvider $provider): TeamIntegration
    {
        $integration = $provider->isEnabled() ? $team->integration($provider) : null;

        if ($integration === null) {
            throw new NotConnected($provider);
        }

        $integration->ensureActive();

        return $integration;
    }

    public function handle(
        Model&DeliverySubject $subject,
        IntegrationDeliveryChannel $channel,
        IntegrationDeliveryKind $kind,
        User $requester,
        ShareContent $content,
    ): IntegrationDelivery {
        $provider = $channel->provider() ?? throw new InvalidArgumentException('Email is not a share channel.');
        $team = $subject->deliveryTeam();

        $this->requireIntegration($team, $provider);

        $delivery = IntegrationDelivery::query()->create([
            'team_id' => $team->id,
            'channel' => $channel,
            'kind' => $kind,
            'subject_type' => $subject->getMorphClass(),
            'subject_id' => $subject->getKey(),
            'requested_by_user_id' => $requester->id,
            'status' => IntegrationDeliveryStatus::Queued,
        ]);

        $locale = app()->getLocale();

        $job = match ($provider) {
            IntegrationProvider::Slack => new DeliverToSlack($delivery->id, $content->toSlack(), $locale),
            IntegrationProvider::Telegram => new DeliverToTelegram($delivery->id, $content->toTelegram(), $locale),
            default => throw new InvalidArgumentException("{$provider->value} is not a share channel."),
        };

        dispatch($job)->afterCommit();

        return $delivery;
    }
}
```

- [ ] **Step 9: Schedule the pruning**

Append to `routes/console.php` (import `App\Models\IntegrationDelivery`):

```php
Schedule::command('model:prune', ['--model' => [IntegrationDelivery::class]])
    ->daily()
    ->onOneServer();
```

- [ ] **Step 10: Add the translations**

Append to each `lang/*.json` (only keys missing at execution time):

| Key (en) | fr | es | de |
|---|---|---|---|
| `The message could not be delivered.` | `Le message n'a pas pu être envoyé.` | `No se pudo enviar el mensaje.` | `Die Nachricht konnte nicht zugestellt werden.` |

The test "fails at once when Telegram removed the bot" reads Plan 12a's French row for `Reconnect :provider in the team settings.` (`Reconnectez :provider dans les paramètres de l'équipe.`): it proves the error is written in the sharer's locale.

- [ ] **Step 11: Run the tests**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Integrations/DeliveryJobsTest.php tests/Feature/Integrations/QueueShareTest.php`
Expected: PASS.

- [ ] **Step 12: Format, analyse and commit**

```bash
vendor/bin/sail bin pint --dirty --format agent
vendor/bin/sail bin phpstan analyse --no-progress
git add app/Contracts/DeliverySubject.php app/Enums/IntegrationDeliveryChannel.php app/Models/Retro.php app/Models/PokerGame.php app/Support/Integrations/Messages app/Jobs/Integrations app/Actions/Integrations/QueueShare.php app/Actions/Integrations/PresentIntegrationDelivery.php app/Actions/Integrations/LatestDeliveries.php routes/console.php lang tests/Feature/Integrations/DeliveryJobsTest.php tests/Feature/Integrations/QueueShareTest.php
git commit -m "feat: queue Slack and Telegram deliveries with retries and delivery lines

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SosW8d2Uj7QxsF1tws5ssS"
```

---
### Task 2: Results recap (`BuildRetroRecap`, Slack and Telegram formatting)

**Files:**
- Create: `app/Support/Integrations/Messages/{RetroRecap,RecapText,RetroRecapContent}.php`, `app/Actions/Integrations/BuildRetroRecap.php`
- Modify: `lang/{en,fr,es,de}.json`
- Test: create `tests/Feature/Integrations/RetroRecapTest.php`, `tests/Feature/Integrations/RecapFormattingTest.php`

**Interfaces:**
- Consumes: `SummarizeRoti::handle(Retro): array{distribution, average, respondents}`, `Retro::{effectiveSummaryStatus(), participants(), cards(), columns(), actionItems(), suggestedActions()}`, `ActionItem::{isCompleted()}`, `ActionItemPriority::sortWeight()`, `Participant::{isGuest(), displayName()}`, `SuggestedActionStatus::Pending`, `SummaryStatus::Ready`; Task 1's `ShareContent`, `SlackText`, `TelegramText`.
- Produces:
  - value object `App\Support\Integrations\Messages\RetroRecap` (public readonly-by-convention properties: `title`, `teamName`, `completedOn` (localized date), `url`, `participantCount`, `participantNames` (`array<int, string>|null`, null on anonymous retros), `cardCount`, `rotiAverage` (`?float`), `rotiRespondents`, `summary` (`?string`), `actionItems` (`array<int, array{content: string, assignee: ?string, dueOn: ?string, isCompleted: bool}>`), `hiddenActionItems`, `suggestedActions` (`array<int, string>`), `hiddenSuggestedActions`, `topCards` (`array<int, array{column: string, content: string, votes: int, groupedCount: int}>`)).
  - `App\Actions\Integrations\BuildRetroRecap::handle(Retro): RetroRecap` with constants `ActionItemLimit = 10`, `SuggestedActionLimit = 5`, `CardContentLimit = 300`.
  - `RecapText` (static, localized plain-text lines shared by the chat and mail formatters): `heading`, `context`, `participants(RetroRecap, bool $withNames = true)`, `cards`, `roti` (`?string`), `actionItem(array)`, `topCard(array)`, `more(int)`, `openLabel()`.
  - `RetroRecapContent(RetroRecap $recap) implements ShareContent`.
- Tests required: RetroRecapTest — "recaps a completed retro", "counts participants only on anonymous retros", "includes the summary only when it is ready", "lists open action items first, by priority, at most ten", "lists up to five pending suggestions", "picks the most voted top-level card of each column", "never carries card authors, voters or comments". RecapFormattingTest — "formats a Slack recap", "formats a Telegram recap", "escapes user content in Slack", "escapes user content in Telegram HTML", "keeps Slack sections within 3000 characters", "keeps Telegram messages within 4096 characters", "omits empty sections".

- [ ] **Step 1: Write the failing recap tests**

Create `tests/Feature/Integrations/RetroRecapTest.php`:

```php
<?php

use App\Actions\Integrations\BuildRetroRecap;
use App\Enums\ActionItemPriority;
use App\Enums\RetroPhase;
use App\Enums\SuggestedActionStatus;
use App\Enums\SummaryStatus;
use App\Models\ActionItem;
use App\Models\Card;
use App\Models\CardComment;
use App\Models\Column;
use App\Models\Participant;
use App\Models\Retro;
use App\Models\RotiVote;
use App\Models\SuggestedAction;
use App\Models\Team;
use App\Models\User;
use App\Models\Vote;
use App\Support\Integrations\Messages\RetroRecap;
use Illuminate\Support\Carbon;

function recapRetro(array $attributes = []): Retro
{
    return Retro::factory()->inPhase(RetroPhase::Completed)->create([
        'title' => 'Sprint 42',
        'team_id' => Team::factory()->create(['name' => 'Platform'])->id,
        'completed_at' => Carbon::parse('2026-09-28 15:00'),
        ...$attributes,
    ]);
}

function recapOf(Retro $retro): RetroRecap
{
    return app(BuildRetroRecap::class)->handle($retro->fresh());
}

function recapCard(Retro $retro, Column $column, int $votes, array $attributes = []): Card
{
    $card = Card::factory()->create(['retro_id' => $retro->id, 'column_id' => $column->id, ...$attributes]);
    Vote::factory()->count($votes)->create(['retro_id' => $retro->id, 'card_id' => $card->id]);

    return $card;
}

it('recaps a completed retro', function () {
    $retro = recapRetro();
    Participant::factory()->create(['retro_id' => $retro->id, 'user_id' => User::factory()->create(['name' => 'zoe'])->id]);
    $adam = Participant::factory()->create(['retro_id' => $retro->id, 'user_id' => User::factory()->create(['name' => 'Adam'])->id]);
    Participant::factory()->guest()->create(['retro_id' => $retro->id, 'guest_name' => 'Gus']);
    $column = Column::factory()->create(['retro_id' => $retro->id]);
    $lead = Card::factory()->create(['retro_id' => $retro->id, 'column_id' => $column->id, 'participant_id' => $adam->id]);
    Card::factory()->create(['retro_id' => $retro->id, 'column_id' => $column->id, 'participant_id' => $adam->id, 'parent_card_id' => $lead->id]);
    RotiVote::factory()->create(['retro_id' => $retro->id, 'participant_id' => $adam->id, 'score' => 4]);

    app()->setLocale('fr');
    $recap = recapOf($retro);

    expect($recap->title)->toBe('Sprint 42')
        ->and($recap->teamName)->toBe('Platform')
        ->and($recap->completedOn)->toBe('28 septembre 2026')
        ->and($recap->url)->toBe(route('retros.show', $retro))
        ->and($recap->participantNames)->toBe(['Adam', 'Gus (invité)', 'zoe'])
        ->and($recap->participantCount)->toBe(3)
        ->and($recap->cardCount)->toBe(2)
        ->and($recap->rotiAverage)->toBe(4.0)
        ->and($recap->rotiRespondents)->toBe(1);
});

it('counts participants only on anonymous retros', function () {
    $retro = recapRetro(['is_anonymous' => true]);
    Participant::factory()->count(3)->create(['retro_id' => $retro->id]);

    $recap = recapOf($retro);

    expect($recap->participantNames)->toBeNull()
        ->and($recap->participantCount)->toBe(3);
});

it('includes the summary only when it is ready', function (?SummaryStatus $status, ?string $expected) {
    $retro = recapRetro([
        'summary' => 'We shipped a lot.',
        'summary_status' => $status,
        'summary_requested_at' => now(),
    ]);

    expect(recapOf($retro)->summary)->toBe($expected);
})->with([
    'ready' => [SummaryStatus::Ready, 'We shipped a lot.'],
    'pending' => [SummaryStatus::Pending, null],
    'failed' => [SummaryStatus::Failed, null],
    'never generated' => [null, null],
]);

it('lists open action items first, by priority, at most ten', function () {
    $retro = recapRetro();
    $member = User::factory()->create(['name' => 'Ada']);
    $guest = Participant::factory()->guest()->create(['retro_id' => $retro->id, 'guest_name' => 'Gus']);
    ActionItem::factory()->completed()->priority(ActionItemPriority::High)->create(['retro_id' => $retro->id, 'content' => 'Done high']);
    ActionItem::factory()->priority(ActionItemPriority::Low)->create(['retro_id' => $retro->id, 'content' => 'Open low', 'created_at' => now()->subMinute()]);
    ActionItem::factory()->priority(ActionItemPriority::High)->assignedTo($member)->create(['retro_id' => $retro->id, 'content' => "Open\n  high", 'due_on' => '2026-10-15']);
    ActionItem::factory()->assignedToGuest($guest)->create(['content' => 'Open medium']);
    ActionItem::factory()->count(8)->priority(ActionItemPriority::Low)->create(['retro_id' => $retro->id, 'content' => 'Filler']);

    $recap = recapOf($retro);

    expect($recap->actionItems)->toHaveCount(10)
        ->and($recap->hiddenActionItems)->toBe(2)
        ->and($recap->actionItems[0])->toBe(['content' => 'Open high', 'assignee' => 'Ada', 'dueOn' => 'October 15, 2026', 'isCompleted' => false])
        ->and($recap->actionItems[1])->toBe(['content' => 'Open medium', 'assignee' => 'Gus (guest)', 'dueOn' => null, 'isCompleted' => false])
        ->and($recap->actionItems[2]['content'])->toBe('Open low')
        ->and(collect($recap->actionItems)->pluck('content'))->not->toContain('Done high');
});

it('lists up to five pending suggestions', function () {
    $retro = recapRetro();
    SuggestedAction::factory()->count(7)->sequence(fn ($sequence) => ['position' => $sequence->index, 'content' => "Idea {$sequence->index}"])->create(['retro_id' => $retro->id]);
    SuggestedAction::factory()->rejected()->create(['retro_id' => $retro->id, 'content' => 'Rejected idea', 'position' => 10]);
    SuggestedAction::factory()->create(['retro_id' => $retro->id, 'content' => 'Promoted idea', 'position' => 11, 'status' => SuggestedActionStatus::Promoted]);

    $recap = recapOf($retro);

    expect($recap->suggestedActions)->toBe(['Idea 0', 'Idea 1', 'Idea 2', 'Idea 3', 'Idea 4'])
        ->and($recap->hiddenSuggestedActions)->toBe(2);
});

it('picks the most voted top-level card of each column', function () {
    $retro = recapRetro();
    $wins = Column::factory()->create(['retro_id' => $retro->id, 'title' => 'Wins', 'position' => 0]);
    $quiet = Column::factory()->create(['retro_id' => $retro->id, 'title' => 'Quiet', 'position' => 1]);
    $pains = Column::factory()->create(['retro_id' => $retro->id, 'title' => 'Pains', 'position' => 2]);
    recapCard($retro, $wins, 2, ['position' => 1, 'content' => 'Later tie']);
    $lead = recapCard($retro, $wins, 2, ['position' => 0, 'content' => 'Earlier tie']);
    Card::factory()->create(['retro_id' => $retro->id, 'column_id' => $wins->id, 'parent_card_id' => $lead->id]);
    recapCard($retro, $quiet, 0);
    recapCard($retro, $pains, 1, ['content' => str_repeat('a', 400)]);

    $recap = recapOf($retro);

    expect($recap->topCards)->toHaveCount(2)
        ->and($recap->topCards[0])->toBe(['column' => 'Wins', 'content' => 'Earlier tie', 'votes' => 2, 'groupedCount' => 1])
        ->and($recap->topCards[1]['column'])->toBe('Pains')
        ->and(mb_strlen($recap->topCards[1]['content']))->toBe(300)
        ->and($recap->topCards[1]['content'])->toEndWith('…');
});

it('never carries card authors, voters or comments', function () {
    $retro = recapRetro(['is_anonymous' => true]);
    $author = Participant::factory()->create(['retro_id' => $retro->id, 'user_id' => User::factory()->create(['name' => 'Author Zelda'])->id]);
    $voter = Participant::factory()->create(['retro_id' => $retro->id, 'user_id' => User::factory()->create(['name' => 'Voter Victor'])->id]);
    $column = Column::factory()->create(['retro_id' => $retro->id]);
    $card = Card::factory()->create(['retro_id' => $retro->id, 'column_id' => $column->id, 'participant_id' => $author->id, 'content' => 'Deploys are slow']);
    Vote::factory()->create(['retro_id' => $retro->id, 'card_id' => $card->id, 'participant_id' => $voter->id]);
    CardComment::factory()->create(['retro_id' => $retro->id, 'card_id' => $card->id, 'content' => 'Secret comment text']);

    $serialized = json_encode(get_object_vars(recapOf($retro)), JSON_UNESCAPED_UNICODE);

    expect($serialized)->toContain('Deploys are slow')
        ->not->toContain('Author Zelda')
        ->not->toContain('Voter Victor')
        ->not->toContain('Secret comment text');
});
```

Card, vote and roti factories create a participant of their own unless `participant_id` is given, so the first test passes Adam's.

- [ ] **Step 2: Write the failing formatting tests**

Create `tests/Feature/Integrations/RecapFormattingTest.php`:

```php
<?php

use App\Support\Integrations\Messages\RetroRecap;
use App\Support\Integrations\Messages\RetroRecapContent;

function sampleRecap(array $overrides = []): RetroRecap
{
    return new RetroRecap(...[
        'title' => 'Sprint 42',
        'teamName' => 'Platform',
        'completedOn' => 'September 28, 2026',
        'url' => 'https://skrum.test/retros/1',
        'participantCount' => 3,
        'participantNames' => ['Ada', 'Bob', 'Gus (guest)'],
        'cardCount' => 12,
        'rotiAverage' => 4.5,
        'rotiRespondents' => 2,
        'summary' => 'We shipped a lot.',
        'actionItems' => [['content' => 'Fix the deploy', 'assignee' => 'Ada', 'dueOn' => 'October 15, 2026', 'isCompleted' => false]],
        'hiddenActionItems' => 0,
        'suggestedActions' => ['Automate the release notes'],
        'hiddenSuggestedActions' => 0,
        'topCards' => [['column' => 'Wins', 'content' => 'Faster reviews', 'votes' => 5, 'groupedCount' => 2]],
        ...$overrides,
    ]);
}

function slackSectionTexts(array $message): array
{
    return collect($message['blocks'])
        ->where('type', 'section')
        ->map(fn (array $block) => $block['text']['text'])
        ->values()
        ->all();
}

it('formats a Slack recap', function () {
    $message = (new RetroRecapContent(sampleRecap()))->toSlack();
    $json = json_encode($message, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);

    expect($message['text'])->toBe('Results of the retrospective "Sprint 42"')
        ->and($message['blocks'][0])->toBe(['type' => 'header', 'text' => ['type' => 'plain_text', 'text' => 'Results of the retrospective "Sprint 42"']])
        ->and(collect($message['blocks'])->last())->toBe(['type' => 'actions', 'elements' => [[
            'type' => 'button',
            'text' => ['type' => 'plain_text', 'text' => 'Open the results'],
            'url' => 'https://skrum.test/retros/1',
        ]]])
        ->and(count($message['blocks']))->toBeLessThanOrEqual(50)
        ->and($json)->toContain('Platform · completed on September 28, 2026')
        ->and($json)->toContain('Participants (3): Ada, Bob, Gus (guest)')
        ->and($json)->toContain('Cards: 12')
        ->and($json)->toContain('ROTI: 4.5/5 (2 answers)')
        ->and($json)->toContain('We shipped a lot.')
        ->and($json)->toContain('• Fix the deploy — Ada · Due October 15, 2026')
        ->and($json)->toContain('• Automate the release notes')
        ->and($json)->toContain('• Wins — Faster reviews (votes: 5, grouped cards: 2)');
});

it('formats a Telegram recap', function () {
    $html = (new RetroRecapContent(sampleRecap()))->toTelegram();

    expect($html)->toStartWith('<b>Results of the retrospective &quot;Sprint 42&quot;</b>')
        ->and($html)->toContain('Participants (3): Ada, Bob, Gus (guest)')
        ->and($html)->toContain("<b>Action items</b>\n• Fix the deploy — Ada · Due October 15, 2026")
        ->and($html)->toContain("<b>Top card per column</b>\n• Wins — Faster reviews (votes: 5, grouped cards: 2)")
        ->and($html)->toEndWith('<a href="https://skrum.test/retros/1">Open the results</a>');
});

it('escapes user content in Slack', function () {
    $recap = sampleRecap([
        'title' => '<!here> retro',
        'summary' => 'Ping <!channel> & <@U123>',
        'topCards' => [['column' => 'A&B', 'content' => 'See <http://evil.test|this>', 'votes' => 1, 'groupedCount' => 0]],
    ]);

    $json = json_encode((new RetroRecapContent($recap))->toSlack(), JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);

    expect($json)->not->toContain('<!channel>')
        ->not->toContain('<!here>')
        ->not->toContain('<@U123>')
        ->not->toContain('<http://evil.test|this>')
        ->toContain('Ping &lt;!channel&gt; &amp; &lt;@U123&gt;')
        ->toContain('A&amp;B — See &lt;http://evil.test|this&gt;');
});

it('escapes user content in Telegram HTML', function () {
    $recap = sampleRecap([
        'summary' => '<b>bold</b> & <a href="https://evil.test">x</a>',
        'actionItems' => [['content' => '<i>Fix</i>', 'assignee' => "O'Brien", 'dueOn' => null, 'isCompleted' => true]],
    ]);

    $html = (new RetroRecapContent($recap))->toTelegram();

    expect($html)->toContain('&lt;b&gt;bold&lt;/b&gt; &amp; &lt;a href=&quot;https://evil.test&quot;&gt;x&lt;/a&gt;')
        ->toContain('• ✓ &lt;i&gt;Fix&lt;/i&gt; — O&#039;Brien')
        ->not->toContain('href="https://evil.test"');
});

it('keeps Slack sections within 3000 characters', function () {
    $recap = sampleRecap([
        'summary' => str_repeat('s', 5000),
        'participantNames' => array_map(fn (int $index) => "Participant number {$index}", range(1, 200)),
        'actionItems' => array_fill(0, 10, ['content' => str_repeat('x', 290), 'assignee' => 'Ada', 'dueOn' => null, 'isCompleted' => false]),
        'hiddenActionItems' => 3,
        'topCards' => array_fill(0, 20, ['column' => 'Column', 'content' => str_repeat('y', 300), 'votes' => 2, 'groupedCount' => 0]),
    ]);

    $message = (new RetroRecapContent($recap))->toSlack();
    $actionItems = collect(slackSectionTexts($message))->first(fn (string $text) => str_starts_with($text, '*Action items*'));

    foreach (slackSectionTexts($message) as $text) {
        expect(mb_strlen($text))->toBeLessThanOrEqual(3000);
    }

    expect(mb_strlen($message['blocks'][0]['text']['text']))->toBeLessThanOrEqual(150)
        ->and($actionItems)->toMatch('/\+ \d+ more$/')
        ->and(substr_count($actionItems, '• '))->toBeLessThan(10);
});

it('keeps Telegram messages within 4096 characters', function () {
    $recap = sampleRecap([
        'summary' => 'Short summary.',
        'actionItems' => array_fill(0, 10, ['content' => str_repeat('x', 290), 'assignee' => 'Ada', 'dueOn' => null, 'isCompleted' => false]),
        'topCards' => array_fill(0, 8, ['column' => 'Column', 'content' => str_repeat('y', 300), 'votes' => 2, 'groupedCount' => 0]),
    ]);

    $html = (new RetroRecapContent($recap))->toTelegram();

    expect(mb_strlen($html))->toBeLessThanOrEqual(4096)
        ->and($html)->toContain('Short summary.')
        ->and($html)->toContain('Participants (3): Ada, Bob, Gus (guest)')
        ->and($html)->toMatch('/\+ \d+ more/');
});

it('omits empty sections', function () {
    $recap = sampleRecap([
        'rotiAverage' => null,
        'rotiRespondents' => 0,
        'summary' => null,
        'actionItems' => [],
        'suggestedActions' => [],
        'topCards' => [],
        'participantNames' => null,
    ]);

    $slack = json_encode((new RetroRecapContent($recap))->toSlack(), JSON_UNESCAPED_UNICODE);
    $telegram = (new RetroRecapContent($recap))->toTelegram();

    foreach ([$slack, $telegram] as $message) {
        expect($message)->toContain('Participants: 3')
            ->not->toContain('ROTI')
            ->not->toContain('Summary')
            ->not->toContain('Action items')
            ->not->toContain('Suggested actions')
            ->not->toContain('Top card per column');
    }
});
```

- [ ] **Step 3: Run them to verify they fail**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Integrations/RetroRecapTest.php tests/Feature/Integrations/RecapFormattingTest.php`
Expected: FAIL — `Class "App\Actions\Integrations\BuildRetroRecap" not found`.

- [ ] **Step 4: Create the recap value object and its text lines**

Create `app/Support/Integrations/Messages/RetroRecap.php`:

```php
<?php

namespace App\Support\Integrations\Messages;

/**
 * Everything a results recap may show (spec 6 §5.2). It is built from
 * revealed content only and holds no card author, voter or comment.
 */
class RetroRecap
{
    /**
     * @param  array<int, string>|null  $participantNames  null on anonymous retros
     * @param  array<int, array{content: string, assignee: ?string, dueOn: ?string, isCompleted: bool}>  $actionItems
     * @param  array<int, string>  $suggestedActions
     * @param  array<int, array{column: string, content: string, votes: int, groupedCount: int}>  $topCards
     */
    public function __construct(
        public string $title,
        public string $teamName,
        public string $completedOn,
        public string $url,
        public int $participantCount,
        public ?array $participantNames,
        public int $cardCount,
        public ?float $rotiAverage,
        public int $rotiRespondents,
        public ?string $summary,
        public array $actionItems,
        public int $hiddenActionItems,
        public array $suggestedActions,
        public int $hiddenSuggestedActions,
        public array $topCards,
    ) {}
}
```

Create `app/Support/Integrations/Messages/RecapText.php`:

```php
<?php

namespace App\Support\Integrations\Messages;

/**
 * The recap's lines as plain, unescaped text in the current locale; each
 * formatter escapes them for its own channel.
 */
class RecapText
{
    public static function heading(RetroRecap $recap): string
    {
        return __('Results of the retrospective ":title"', ['title' => $recap->title]);
    }

    public static function context(RetroRecap $recap): string
    {
        return __(':team · completed on :date', ['team' => $recap->teamName, 'date' => $recap->completedOn]);
    }

    public static function participants(RetroRecap $recap, bool $withNames = true): string
    {
        if ($recap->participantNames === null || ! $withNames) {
            return __('Participants: :count', ['count' => $recap->participantCount]);
        }

        return __('Participants (:count): :names', [
            'count' => $recap->participantCount,
            'names' => implode(', ', $recap->participantNames),
        ]);
    }

    public static function cards(RetroRecap $recap): string
    {
        return __('Cards: :count', ['count' => $recap->cardCount]);
    }

    public static function roti(RetroRecap $recap): ?string
    {
        if ($recap->rotiAverage === null) {
            return null;
        }

        return __('ROTI: :average/5 (:count answers)', [
            'average' => number_format($recap->rotiAverage, 1),
            'count' => $recap->rotiRespondents,
        ]);
    }

    /**
     * @param  array{content: string, assignee: ?string, dueOn: ?string, isCompleted: bool}  $item
     */
    public static function actionItem(array $item): string
    {
        $line = ($item['isCompleted'] ? '✓ ' : '').$item['content'];

        if ($item['assignee'] !== null) {
            $line .= " — {$item['assignee']}";
        }

        if ($item['dueOn'] !== null) {
            $line .= ' · '.__('Due :date', ['date' => $item['dueOn']]);
        }

        return $line;
    }

    /**
     * @param  array{column: string, content: string, votes: int, groupedCount: int}  $card
     */
    public static function topCard(array $card): string
    {
        $counts = __('votes: :count', ['count' => $card['votes']]);

        if ($card['groupedCount'] > 0) {
            $counts .= ', '.__('grouped cards: :count', ['count' => $card['groupedCount']]);
        }

        return "{$card['column']} — {$card['content']} ({$counts})";
    }

    public static function more(int $count): string
    {
        return __('+ :count more', ['count' => $count]);
    }

    public static function openLabel(): string
    {
        return __('Open the results');
    }
}
```

- [ ] **Step 5: Create the recap builder**

Create `app/Actions/Integrations/BuildRetroRecap.php`:

```php
<?php

namespace App\Actions\Integrations;

use App\Actions\Retros\SummarizeRoti;
use App\Enums\SuggestedActionStatus;
use App\Enums\SummaryStatus;
use App\Models\ActionItem;
use App\Models\Card;
use App\Models\Column;
use App\Models\Participant;
use App\Models\Retro;
use App\Support\Integrations\Messages\RetroRecap;
use Carbon\CarbonInterface;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;

/**
 * Reads only what the Results view shows of a completed retro, without
 * any card author, voter, comment, survey, health answer or theme.
 */
class BuildRetroRecap
{
    public const ActionItemLimit = 10;

    public const SuggestedActionLimit = 5;

    public const CardContentLimit = 300;

    public function __construct(private SummarizeRoti $summarizeRoti) {}

    public function handle(Retro $retro): RetroRecap
    {
        $retro->loadMissing(['team', 'participants.user']);

        $roti = $this->summarizeRoti->handle($retro);
        $actionItems = $this->actionItems($retro);
        $suggestedActions = $retro->suggestedActions()
            ->where('status', SuggestedActionStatus::Pending->value)
            ->pluck('content')
            ->map(fn (mixed $content): string => Str::squish((string) $content));

        return new RetroRecap(
            title: $retro->title,
            teamName: $retro->team->name,
            completedOn: $this->date($retro->completed_at ?? now()),
            url: route('retros.show', $retro),
            participantCount: $retro->participants->count(),
            participantNames: $retro->is_anonymous ? null : $this->participantNames($retro),
            cardCount: $retro->cards()->count(),
            rotiAverage: $roti['respondents'] > 0 ? $roti['average'] : null,
            rotiRespondents: $roti['respondents'],
            summary: $this->summary($retro),
            actionItems: $actionItems->take(self::ActionItemLimit)->values()->all(),
            hiddenActionItems: max(0, $actionItems->count() - self::ActionItemLimit),
            suggestedActions: $suggestedActions->take(self::SuggestedActionLimit)->values()->all(),
            hiddenSuggestedActions: max(0, $suggestedActions->count() - self::SuggestedActionLimit),
            topCards: $this->topCards($retro),
        );
    }

    /**
     * @return array<int, string>
     */
    private function participantNames(Retro $retro): array
    {
        return $retro->participants
            ->map(fn (Participant $participant): string => $participant->isGuest()
                ? __(':name (guest)', ['name' => $participant->displayName()])
                : $participant->displayName())
            ->sort(fn (string $first, string $second): int => strcasecmp($first, $second))
            ->values()
            ->all();
    }

    private function summary(Retro $retro): ?string
    {
        if ($retro->effectiveSummaryStatus() !== SummaryStatus::Ready || blank($retro->summary)) {
            return null;
        }

        return trim($retro->summary);
    }

    /**
     * @return Collection<int, array{content: string, assignee: ?string, dueOn: ?string, isCompleted: bool}>
     */
    private function actionItems(Retro $retro): Collection
    {
        return $retro->actionItems()
            ->with(['assigneeUser', 'assigneeParticipant.user'])
            ->get()
            ->sortBy([
                fn (ActionItem $first, ActionItem $second): int => $first->isCompleted() <=> $second->isCompleted(),
                fn (ActionItem $first, ActionItem $second): int => $first->priority->sortWeight() <=> $second->priority->sortWeight(),
                fn (ActionItem $first, ActionItem $second): int => $first->created_at <=> $second->created_at,
            ])
            ->map(fn (ActionItem $item): array => [
                'content' => Str::squish($item->content),
                'assignee' => $this->assignee($item),
                'dueOn' => $item->due_on === null ? null : $this->date($item->due_on),
                'isCompleted' => $item->isCompleted(),
            ])
            ->values();
    }

    private function assignee(ActionItem $item): ?string
    {
        if ($item->assigneeUser !== null) {
            return $item->assigneeUser->name;
        }

        $participant = $item->assigneeParticipant;

        if ($participant === null) {
            return null;
        }

        return $participant->isGuest()
            ? __(':name (guest)', ['name' => $participant->displayName()])
            : $participant->displayName();
    }

    /**
     * @return array<int, array{column: string, content: string, votes: int, groupedCount: int}>
     */
    private function topCards(Retro $retro): array
    {
        $cardsByColumn = Card::query()
            ->where('retro_id', $retro->id)
            ->whereNull('parent_card_id')
            ->withCount(['votes', 'children'])
            ->get()
            ->groupBy('column_id');

        return $retro->columns()->get()
            ->map(function (Column $column) use ($cardsByColumn): ?array {
                /** @var Collection<int, Card> $cards */
                $cards = $cardsByColumn->get($column->id) ?? collect();

                $top = $cards
                    ->filter(fn (Card $card): bool => (int) $card->getAttribute('votes_count') > 0)
                    ->sortBy([
                        fn (Card $first, Card $second): int => (int) $second->getAttribute('votes_count') <=> (int) $first->getAttribute('votes_count'),
                        fn (Card $first, Card $second): int => $first->position <=> $second->position,
                    ])
                    ->first();

                if ($top === null) {
                    return null;
                }

                $content = $top->content === null || trim($top->content) === ''
                    ? __('A card without text')
                    : Str::squish($top->content);

                return [
                    'column' => $column->title,
                    'content' => Str::limit($content, self::CardContentLimit - 1, '…'),
                    'votes' => (int) $top->getAttribute('votes_count'),
                    'groupedCount' => (int) $top->getAttribute('children_count'),
                ];
            })
            ->filter()
            ->values()
            ->all();
    }

    private function date(CarbonInterface $date): string
    {
        return $date->copy()->locale(app()->getLocale())->isoFormat('LL');
    }
}
```

- [ ] **Step 6: Create the chat formatting**

Create `app/Support/Integrations/Messages/RetroRecapContent.php`:

```php
<?php

namespace App\Support\Integrations\Messages;

use Generator;
use Illuminate\Support\Str;

/**
 * Slack and Telegram limit message sizes, so lists shrink first (with
 * "+ n more"), then the summary, then the participant names.
 */
class RetroRecapContent implements ShareContent
{
    private const SummaryLimit = 2800;

    private const NamesLimit = 2800;

    public function __construct(public RetroRecap $recap) {}

    public function toSlack(): array
    {
        $recap = $this->recap;
        $heading = RecapText::heading($recap);

        $blocks = [
            ['type' => 'header', 'text' => ['type' => 'plain_text', 'text' => SlackText::escape(Str::limit($heading, SlackText::HeaderLimit - 10, '…'))]],
            ['type' => 'context', 'elements' => [['type' => 'mrkdwn', 'text' => SlackText::escape(RecapText::context($recap))]]],
            $this->slackSection(implode("\n", array_filter([
                SlackText::escape(Str::limit(RecapText::participants($recap), self::NamesLimit, '…')),
                SlackText::escape(RecapText::cards($recap)),
                $this->escapeSlack(RecapText::roti($recap)),
            ]))),
        ];

        if ($recap->summary !== null) {
            $blocks[] = $this->slackSection('*'.SlackText::escape(__('Summary'))."*\n".SlackText::escape(Str::limit($recap->summary, self::SummaryLimit, '…')));
        }

        $lists = array_filter([
            $this->slackList(__('Action items'), array_map(RecapText::actionItem(...), $recap->actionItems), $recap->hiddenActionItems),
            $this->slackList(__('Suggested actions'), $recap->suggestedActions, $recap->hiddenSuggestedActions),
            $this->slackList(__('Top card per column'), array_map(RecapText::topCard(...), $recap->topCards), 0),
        ]);

        if ($lists !== []) {
            $blocks[] = ['type' => 'divider'];
            array_push($blocks, ...array_values($lists));
        }

        $blocks[] = ['type' => 'actions', 'elements' => [[
            'type' => 'button',
            'text' => ['type' => 'plain_text', 'text' => Str::limit(RecapText::openLabel(), SlackText::ButtonLimit - 1, '…')],
            'url' => $recap->url,
        ]]];

        return ['text' => SlackText::escape($heading), 'blocks' => $blocks];
    }

    public function toTelegram(): string
    {
        foreach ($this->telegramAttempts() as [$actionItems, $topCards, $summaryLimit, $withNames]) {
            $html = $this->telegramMessage($actionItems, $topCards, $summaryLimit, $withNames);

            if (mb_strlen($html) <= TelegramText::MessageLimit) {
                return $html;
            }
        }

        return $this->telegramMessage(0, 0, 0, false);
    }

    /**
     * @return array{type: string, text: array{type: string, text: string}}
     */
    private function slackSection(string $text): array
    {
        return ['type' => 'section', 'text' => ['type' => 'mrkdwn', 'text' => mb_substr($text, 0, SlackText::SectionLimit)]];
    }

    /**
     * @param  array<int, string>  $lines
     * @return array{type: string, text: array{type: string, text: string}}|null
     */
    private function slackList(string $heading, array $lines, int $hidden): ?array
    {
        if ($lines === []) {
            return null;
        }

        $shown = $lines;

        while (true) {
            $text = '*'.SlackText::escape($heading).'*';

            foreach ($shown as $line) {
                $text .= "\n• ".SlackText::escape($line);
            }

            $more = $hidden + count($lines) - count($shown);

            if ($more > 0) {
                $text .= "\n".SlackText::escape(RecapText::more($more));
            }

            if (mb_strlen($text) <= SlackText::SectionLimit || count($shown) <= 1) {
                return $this->slackSection($text);
            }

            array_pop($shown);
        }
    }

    private function escapeSlack(?string $text): ?string
    {
        return $text === null ? null : SlackText::escape($text);
    }

    /**
     * @return Generator<int, array{0: int, 1: int, 2: int, 3: bool}>
     */
    private function telegramAttempts(): Generator
    {
        $actionItems = count($this->recap->actionItems);
        $topCards = count($this->recap->topCards);

        while (true) {
            yield [$actionItems, $topCards, self::SummaryLimit, true];

            if ($actionItems === 0 && $topCards === 0) {
                break;
            }

            if ($topCards >= $actionItems) {
                $topCards--;
            } else {
                $actionItems--;
            }
        }

        yield [0, 0, 1000, true];
        yield [0, 0, 1000, false];
        yield [0, 0, 200, false];
    }

    private function telegramMessage(int $actionItems, int $topCards, int $summaryLimit, bool $withNames): string
    {
        $recap = $this->recap;

        $parts = [
            '<b>'.TelegramText::escape(RecapText::heading($recap))."</b>\n".TelegramText::escape(RecapText::context($recap)),
            implode("\n", array_map(TelegramText::escape(...), array_filter([
                RecapText::participants($recap, $withNames),
                RecapText::cards($recap),
                RecapText::roti($recap),
            ]))),
        ];

        if ($recap->summary !== null && $summaryLimit > 0) {
            $parts[] = '<b>'.TelegramText::escape(__('Summary'))."</b>\n".TelegramText::escape(Str::limit($recap->summary, $summaryLimit, '…'));
        }

        $parts[] = $this->telegramList(
            __('Action items'),
            array_map(RecapText::actionItem(...), array_slice($recap->actionItems, 0, $actionItems)),
            $recap->hiddenActionItems + count($recap->actionItems) - $actionItems,
        );
        $parts[] = $this->telegramList(__('Suggested actions'), $recap->suggestedActions, $recap->hiddenSuggestedActions);
        $parts[] = $this->telegramList(
            __('Top card per column'),
            array_map(RecapText::topCard(...), array_slice($recap->topCards, 0, $topCards)),
            count($recap->topCards) - $topCards,
        );
        $parts[] = '<a href="'.TelegramText::escape($recap->url).'">'.TelegramText::escape(RecapText::openLabel()).'</a>';

        return implode("\n\n", array_filter($parts, fn (?string $part): bool => $part !== null && $part !== ''));
    }

    /**
     * @param  array<int, string>  $lines
     */
    private function telegramList(string $heading, array $lines, int $more): ?string
    {
        if ($lines === [] && $more === 0) {
            return null;
        }

        $text = '<b>'.TelegramText::escape($heading).'</b>';

        foreach ($lines as $line) {
            $text .= "\n• ".TelegramText::escape($line);
        }

        if ($more > 0) {
            $text .= "\n".TelegramText::escape(RecapText::more($more));
        }

        return $text;
    }
}
```

`array_filter()` on the stats lines drops a `null` ROTI line; the participant line and the card line are never empty.

- [ ] **Step 7: Add the translations**

Append to each `lang/*.json` (only keys missing at execution time; `Summary`, `Suggested actions`, `Action items`, `Due :date` and `:name (guest)` already exist):

| Key (en) | fr | es | de |
|---|---|---|---|
| `Results of the retrospective ":title"` | `Résultats de la rétrospective « :title »` | `Resultados de la retrospectiva «:title»` | `Ergebnisse der Retrospektive „:title“` |
| `:team · completed on :date` | `:team · terminée le :date` | `:team · terminada el :date` | `:team · abgeschlossen am :date` |
| `Participants: :count` | `Participants : :count` | `Participantes: :count` | `Teilnehmende: :count` |
| `Participants (:count): :names` | `Participants (:count) : :names` | `Participantes (:count): :names` | `Teilnehmende (:count): :names` |
| `Cards: :count` | `Cartes : :count` | `Tarjetas: :count` | `Karten: :count` |
| `ROTI: :average/5 (:count answers)` | `ROTI : :average/5 (:count réponses)` | `ROTI: :average/5 (:count respuestas)` | `ROTI: :average/5 (:count Antworten)` |
| `Top card per column` | `Carte la plus votée par colonne` | `Tarjeta más votada por columna` | `Meistgewählte Karte pro Spalte` |
| `votes: :count` | `votes : :count` | `votos: :count` | `Stimmen: :count` |
| `grouped cards: :count` | `cartes regroupées : :count` | `tarjetas agrupadas: :count` | `gruppierte Karten: :count` |
| `+ :count more` | `+ :count de plus` | `+ :count más` | `+ :count weitere` |
| `A card without text` | `Une carte sans texte` | `Una tarjeta sin texto` | `Eine Karte ohne Text` |
| `Open the results` | `Ouvrir les résultats` | `Abrir los resultados` | `Ergebnisse öffnen` |

- [ ] **Step 8: Run the tests**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Integrations/RetroRecapTest.php tests/Feature/Integrations/RecapFormattingTest.php`
Expected: PASS.

- [ ] **Step 9: Format, analyse and commit**

```bash
vendor/bin/sail bin pint --dirty --format agent
vendor/bin/sail bin phpstan analyse --no-progress
git add app/Support/Integrations/Messages app/Actions/Integrations/BuildRetroRecap.php lang tests/Feature/Integrations/RetroRecapTest.php tests/Feature/Integrations/RecapFormattingTest.php
git commit -m "feat: build the retro results recap for Slack and Telegram

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SosW8d2Uj7QxsF1tws5ssS"
```

---
### Task 3: Share permissions, availability and snapshot additions

**Files:**
- Create: `app/Enums/RetroResultsAudience.php`, `app/Actions/Integrations/{SharePermissions,ShareOptions,RetroResultsRecipients}.php`
- Modify: `app/Actions/Retros/BuildBoardSnapshot.php`, `app/Actions/Retros/BuildResults.php`, `app/Actions/Poker/BuildPokerSnapshot.php` **(shared: Plan 12c adds `integrations` to the same array)**, `lang/{en,fr,es,de}.json`
- Test: create `tests/Feature/Integrations/ShareSnapshotTest.php`

**Interfaces:**
- Consumes: `User::canManage(Workspace)`, `Retro::isFacilitator(Participant)`, `PokerGame::{isFacilitator(PokerPlayer), isEnded()}`, `Participant::isGuest()`, `PokerPlayer::isGuest()`, `IntegrationAvailability::emailEnabled()` (Plan 12a), `TeamIntegration::isActive()`, Task 1's `LatestDeliveries`, `PresentIntegrationDelivery` (phpstan type `Delivery`).
- Produces:
  - enum `App\Enums\RetroResultsAudience` (`Participants = 'participants'`, `Team = 'team'`).
  - `SharePermissions::{retro(Retro, Participant): bool, ensureRetro(Retro, Participant): User, pokerGame(PokerGame, PokerPlayer): bool, ensurePokerGame(PokerGame, PokerPlayer): User}` — `ensure*` throw `AuthorizationException` (403) with a translated message and return the sharer's `User`.
  - `ShareOptions::{channels(Team): array{slack: bool, telegram: bool}, retro(Retro, Participant): array{slack: bool, telegram: bool, email: bool}, pokerGame(PokerGame, PokerPlayer): array{slack: bool, telegram: bool}}`; `channels()` is true per provider when it is enabled and the team's integration is `Active`.
  - `RetroResultsRecipients::{query(Retro, RetroResultsAudience): Builder<User>, counts(Retro): array{participants: int, team: int}, isRecipient(Retro, User): bool}` — current team members with a verified email (participants audience: those with a participant row in the retro).
  - Board snapshot: `integrations: {slack, telegram, email}` (all false for viewers who may not share), `linkDeliveries: Delivery[]` (latest `retro_link` per channel, sharers only, else `[]`). `results` gains `deliveries: Delivery[]` (latest `retro_results` per channel, including `email`; sharers only) and `emailRecipients: {participants, team} | null`.
  - Poker snapshot: `share: {slack, telegram}` (false for non-sharers and ended games), `deliveries: Delivery[]` (latest `poker_link` per channel, sharers only).
- Tests required: "offers every channel to a facilitator who is a team member", "offers channels to workspace admins", "offers nothing to other members, guests and a facilitator outside the team", "hides channels that are disabled or not active", "offers email only with a delivering mailer", "lists the latest results delivery per channel for sharers only", "counts email recipients for sharers", "lists the latest link delivery per channel", "offers poker shares to the facilitator and workspace admins while the game is open".

- [ ] **Step 1: Write the failing tests**

Create `tests/Feature/Integrations/ShareSnapshotTest.php`:

```php
<?php

use App\Actions\Poker\BuildPokerSnapshot;
use App\Actions\Retros\BuildBoardSnapshot;
use App\Enums\IntegrationDeliveryChannel;
use App\Enums\IntegrationDeliveryKind;
use App\Enums\IntegrationProvider;
use App\Enums\RetroPhase;
use App\Models\IntegrationDelivery;
use App\Models\Participant;
use App\Models\PokerGame;
use App\Models\PokerPlayer;
use App\Models\Retro;
use App\Models\Team;
use App\Models\TeamIntegration;
use App\Models\User;
use Illuminate\Support\Facades\Http;

beforeEach(function () {
    Http::preventStrayRequests();
    enableIntegrations(IntegrationProvider::Slack, IntegrationProvider::Telegram);
    config(['mail.default' => 'smtp']);
});

function shareSnapshot(Retro $retro, Participant $viewer): array
{
    return app(BuildBoardSnapshot::class)->handle($retro->fresh(), $viewer);
}

function connectShareChannels(Team $team): void
{
    TeamIntegration::factory()->slack()->create(['team_id' => $team->id]);
    TeamIntegration::factory()->telegram()->create(['team_id' => $team->id]);
}

it('offers every channel to a facilitator who is a team member', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Discussing)->create();
    connectShareChannels($retro->team);
    [, $facilitator] = retroFacilitator($retro);

    expect(shareSnapshot($retro, $facilitator)['integrations'])->toBe(['slack' => true, 'telegram' => true, 'email' => true]);
});

it('offers channels to workspace admins', function () {
    $retro = Retro::factory()->create();
    connectShareChannels($retro->team);
    [, $admin] = workspaceAdminParticipant($retro);

    expect(shareSnapshot($retro, $admin)['integrations'])->toBe(['slack' => true, 'telegram' => true, 'email' => true]);
});

it('offers nothing to other members, guests and a facilitator outside the team', function (Closure $viewerOf) {
    $retro = Retro::factory()->withGuestAccess()->create();
    connectShareChannels($retro->team);
    IntegrationDelivery::factory()->forSubject($retro)->create();
    $viewer = $viewerOf($retro);

    $snapshot = shareSnapshot($retro, $viewer);

    expect($snapshot['integrations'])->toBe(['slack' => false, 'telegram' => false, 'email' => false])
        ->and($snapshot['linkDeliveries'])->toBe([]);
})->with([
    'member' => [fn (Retro $retro) => retroMember($retro)[1]],
    'guest' => [fn (Retro $retro) => Participant::factory()->guest()->create(['retro_id' => $retro->id])],
    'facilitator outside the team' => [function (Retro $retro) {
        $participant = Participant::factory()->create(['retro_id' => $retro->id]);
        $retro->forceFill(['facilitator_participant_id' => $participant->id])->save();

        return $participant;
    }],
]);

it('hides channels that are disabled or not active', function () {
    $retro = Retro::factory()->create();
    TeamIntegration::factory()->slack()->reconnectRequired()->create(['team_id' => $retro->team_id]);
    TeamIntegration::factory()->telegram()->create(['team_id' => $retro->team_id]);
    config(['services.telegram.bot_token' => null]);
    [, $facilitator] = retroFacilitator($retro);

    expect(shareSnapshot($retro, $facilitator)['integrations'])->toBe(['slack' => false, 'telegram' => false, 'email' => true]);
});

it('offers email only with a delivering mailer', function (string $mailer) {
    config(['mail.default' => $mailer]);
    $retro = Retro::factory()->inPhase(RetroPhase::Completed)->create();
    [, $facilitator] = retroFacilitator($retro);

    $snapshot = shareSnapshot($retro, $facilitator);

    expect($snapshot['integrations']['email'])->toBeFalse()
        ->and($snapshot['results']['emailRecipients'])->toBeNull();
})->with(['log', 'array']);

it('lists the latest results delivery per channel for sharers only', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Completed)->create();
    [, $facilitator] = retroFacilitator($retro);
    [, $member] = retroMember($retro);
    $results = fn (array $attributes) => IntegrationDelivery::factory()->forSubject($retro)->create(['kind' => IntegrationDeliveryKind::RetroResults, ...$attributes]);
    $results(['status' => 'failed', 'error' => 'old', 'created_at' => now()->subHour()]);
    $slack = $results(['status' => 'sent', 'sent_at' => now()->subMinutes(2), 'created_at' => now()->subMinutes(2)]);
    $email = $results(['channel' => IntegrationDeliveryChannel::Email, 'status' => 'sent', 'recipient_count' => 4, 'sent_at' => now()]);
    IntegrationDelivery::factory()->forSubject($retro)->create(['created_at' => now()->addMinute()]);

    $deliveries = shareSnapshot($retro, $facilitator)['results']['deliveries'];

    expect(array_column($deliveries, 'id'))->toBe([$email->id, $slack->id])
        ->and($deliveries[0])->toMatchArray(['channel' => 'email', 'kind' => 'retro_results', 'recipientCount' => 4])
        ->and(shareSnapshot($retro, $member)['results']['deliveries'])->toBe([]);
});

it('counts email recipients for sharers', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Completed)->create();
    [, $facilitator] = retroFacilitator($retro);
    [, $member] = retroMember($retro);
    teamMember($retro->team);
    $unverified = User::factory()->unverified()->create();
    $retro->team->members()->attach($unverified);
    Participant::factory()->create(['retro_id' => $retro->id, 'user_id' => $unverified->id]);
    Participant::factory()->guest()->create(['retro_id' => $retro->id]);
    workspaceAdminParticipant($retro);

    expect(shareSnapshot($retro, $facilitator)['results']['emailRecipients'])->toBe(['participants' => 2, 'team' => 3])
        ->and(shareSnapshot($retro, $member)['results']['emailRecipients'])->toBeNull();
});

it('lists the latest link delivery per channel', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Voting)->create();
    [, $facilitator] = retroFacilitator($retro);
    IntegrationDelivery::factory()->forSubject($retro)->create(['created_at' => now()->subMinute()]);
    $latest = IntegrationDelivery::factory()->forSubject($retro)->failed('Reconnect Slack in the team settings.')->create();

    $snapshot = shareSnapshot($retro, $facilitator);

    expect(array_column($snapshot['linkDeliveries'], 'id'))->toBe([$latest->id])
        ->and($snapshot['linkDeliveries'][0])->toMatchArray(['status' => 'failed', 'error' => 'Reconnect Slack in the team settings.'])
        ->and($snapshot['results'])->toBeNull();
});

it('offers poker shares to the facilitator and workspace admins while the game is open', function () {
    $game = PokerGame::factory()->create();
    connectShareChannels($game->team);
    [, $facilitator] = pokerFacilitator($game);
    [, $member] = pokerMember($game);
    $admin = PokerPlayer::factory()->create(['poker_game_id' => $game->id, 'user_id' => workspaceManager($game->team->workspace)->id]);
    $guest = pokerGuest($game);
    $delivery = IntegrationDelivery::factory()->forSubject($game)->sent()->create();
    $snapshot = fn (PokerPlayer $player) => app(BuildPokerSnapshot::class)->handle($game->fresh(), $player->fresh());

    expect($snapshot($facilitator)['share'])->toBe(['slack' => true, 'telegram' => true])
        ->and(array_column($snapshot($facilitator)['deliveries'], 'id'))->toBe([$delivery->id])
        ->and($snapshot($admin)['share'])->toBe(['slack' => true, 'telegram' => true])
        ->and($snapshot($member)['share'])->toBe(['slack' => false, 'telegram' => false])
        ->and($snapshot($member)['deliveries'])->toBe([])
        ->and($snapshot($guest)['share'])->toBe(['slack' => false, 'telegram' => false]);

    $game->forceFill(['ended_at' => now()])->save();

    expect($snapshot($facilitator)['share'])->toBe(['slack' => false, 'telegram' => false]);
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Integrations/ShareSnapshotTest.php`
Expected: FAIL — `Undefined array key "integrations"`.

- [ ] **Step 3: Create the audience enum, permissions, options and recipients**

Create `app/Enums/RetroResultsAudience.php`:

```php
<?php

namespace App\Enums;

enum RetroResultsAudience: string
{
    case Participants = 'participants';
    case Team = 'team';
}
```

Create `app/Actions/Integrations/SharePermissions.php`:

```php
<?php

namespace App\Actions\Integrations;

use App\Models\Participant;
use App\Models\PokerGame;
use App\Models\PokerPlayer;
use App\Models\Retro;
use App\Models\User;
use Illuminate\Auth\Access\AuthorizationException;

/**
 * Spec 6 §8: the retro's facilitator while they are a team member, the
 * game's facilitator, and workspace Owners/Admins. Guests never share.
 */
class SharePermissions
{
    public function retro(Retro $retro, Participant $participant): bool
    {
        $user = $participant->user;

        if ($participant->isGuest() || $user === null) {
            return false;
        }

        $retro->loadMissing(['team.workspace', 'team.members']);

        if ($user->canManage($retro->team->workspace)) {
            return true;
        }

        return $retro->isFacilitator($participant) && $retro->team->members->contains('id', $user->id);
    }

    public function ensureRetro(Retro $retro, Participant $participant): User
    {
        $user = $participant->user;

        if ($user === null || ! $this->retro($retro, $participant)) {
            throw new AuthorizationException(__('Only the facilitator or a workspace admin can share this retrospective.'));
        }

        return $user;
    }

    public function pokerGame(PokerGame $game, PokerPlayer $player): bool
    {
        $user = $player->user;

        if ($player->isGuest() || $user === null) {
            return false;
        }

        if ($game->isFacilitator($player)) {
            return true;
        }

        return $user->canManage($game->team->workspace);
    }

    public function ensurePokerGame(PokerGame $game, PokerPlayer $player): User
    {
        $user = $player->user;

        if ($user === null || ! $this->pokerGame($game, $player)) {
            throw new AuthorizationException(__('Only the facilitator or a workspace admin can share this game.'));
        }

        return $user;
    }
}
```

Create `app/Actions/Integrations/ShareOptions.php`:

```php
<?php

namespace App\Actions\Integrations;

use App\Enums\IntegrationProvider;
use App\Models\Participant;
use App\Models\PokerGame;
use App\Models\PokerPlayer;
use App\Models\Retro;
use App\Models\Team;
use App\Models\TeamIntegration;
use App\Support\Integrations\IntegrationAvailability;

class ShareOptions
{
    private const NoChannels = ['slack' => false, 'telegram' => false];

    public function __construct(
        private SharePermissions $sharePermissions,
        private IntegrationAvailability $integrationAvailability,
    ) {}

    /**
     * @return array{slack: bool, telegram: bool}
     */
    public function channels(Team $team): array
    {
        $team->loadMissing('integrations');

        return [
            'slack' => $this->isActive($team, IntegrationProvider::Slack),
            'telegram' => $this->isActive($team, IntegrationProvider::Telegram),
        ];
    }

    /**
     * @return array{slack: bool, telegram: bool, email: bool}
     */
    public function retro(Retro $retro, Participant $viewer): array
    {
        if (! $this->sharePermissions->retro($retro, $viewer)) {
            return [...self::NoChannels, 'email' => false];
        }

        return [...$this->channels($retro->team), 'email' => $this->integrationAvailability->emailEnabled()];
    }

    /**
     * @return array{slack: bool, telegram: bool}
     */
    public function pokerGame(PokerGame $game, PokerPlayer $viewer): array
    {
        if ($game->isEnded() || ! $this->sharePermissions->pokerGame($game, $viewer)) {
            return self::NoChannels;
        }

        return $this->channels($game->team);
    }

    private function isActive(Team $team, IntegrationProvider $provider): bool
    {
        if (! $provider->isEnabled()) {
            return false;
        }

        return $team->integrations->contains(
            fn (TeamIntegration $integration): bool => $integration->provider === $provider && $integration->isActive(),
        );
    }
}
```

Create `app/Actions/Integrations/RetroResultsRecipients.php`:

```php
<?php

namespace App\Actions\Integrations;

use App\Enums\RetroResultsAudience;
use App\Models\Retro;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;

/**
 * Only current team members with a verified email ever receive results;
 * guests have no account and are never emailed (spec 6 §5.3).
 */
class RetroResultsRecipients
{
    /**
     * @return Builder<User>
     */
    public function query(Retro $retro, RetroResultsAudience $audience): Builder
    {
        return User::query()
            ->whereIn('id', $retro->team->members()->select('users.id'))
            ->whereNotNull('email_verified_at')
            ->when($audience === RetroResultsAudience::Participants, fn (Builder $query) => $query->whereIn(
                'id',
                $retro->participants()->whereNotNull('user_id')->select('user_id'),
            ));
    }

    /**
     * @return array{participants: int, team: int}
     */
    public function counts(Retro $retro): array
    {
        return [
            'participants' => $this->query($retro, RetroResultsAudience::Participants)->count(),
            'team' => $this->query($retro, RetroResultsAudience::Team)->count(),
        ];
    }

    public function isRecipient(Retro $retro, User $user): bool
    {
        return $this->query($retro, RetroResultsAudience::Team)->whereKey($user->id)->exists();
    }
}
```

- [ ] **Step 4: Extend the board snapshot and the results**

In `app/Actions/Retros/BuildBoardSnapshot.php`, import `App\Actions\Integrations\{LatestDeliveries,ShareOptions,SharePermissions}` and `App\Enums\IntegrationDeliveryKind`, add three constructor parameters after `private Llm $llm,`:

```php
        private ShareOptions $shareOptions,
        private SharePermissions $sharePermissions,
        private LatestDeliveries $latestDeliveries,
```

In `handle()`, after the `$carried = …;` statement, add:

```php
        $canShare = $this->sharePermissions->retro($retro, $viewerParticipant);
```

and add to the returned array, right after `'healthCheck' => …,`:

```php
            'integrations' => $this->shareOptions->retro($retro, $viewerParticipant),
            'linkDeliveries' => $canShare ? $this->latestDeliveries->handle($retro, [IntegrationDeliveryKind::RetroLink]) : [],
```

In `app/Actions/Retros/BuildResults.php`, import `App\Actions\Integrations\{LatestDeliveries,RetroResultsRecipients,SharePermissions}`, `App\Enums\IntegrationDeliveryKind` and `App\Support\Integrations\IntegrationAvailability`, add to the constructor after `private SummarizeRoti $summarizeRoti,`:

```php
        private SharePermissions $sharePermissions,
        private LatestDeliveries $latestDeliveries,
        private RetroResultsRecipients $retroResultsRecipients,
        private IntegrationAvailability $integrationAvailability,
```

extend the return docblock with (after the `summary` line, keeping the other lines):

```php
     *     summary: ?array{text: ?string, generatedAt: ?string, status: ?string, provider: string},
     *     deliveries: array<int, array{id: string, channel: string, kind: string, status: string, error: ?string, sentAt: ?string, createdAt: ?string, requestedBy: ?string, recipientCount: ?int}>,
     *     emailRecipients: ?array{participants: int, team: int}
```

and replace the end of `handle()` from `$health = …` with:

```php
        $health = $this->summarizeHealthCheck->handle($retro);
        $canShare = $this->sharePermissions->retro($retro, $retro->participants->firstWhere('id', $viewer->id) ?? $viewer);

        return [
            'participants' => $retro->participants->map(fn (Participant $participant) => $this->presentParticipant->handle($participant))->values()->all(),
            'health' => $health,
            'healthTrend' => $health === null ? null : $this->buildHealthTrend->forViewer($retro, $viewer),
            'surveys' => $surveys ?? $this->presentSurvey->many($retro, $viewer),
            'games' => null,
            'roti' => $this->summarizeRoti->handle($retro),
            'summary' => $this->presentRetroSummary->handle($retro),
            'deliveries' => $canShare ? $this->latestDeliveries->handle($retro, [IntegrationDeliveryKind::RetroResults]) : [],
            'emailRecipients' => $canShare && $this->integrationAvailability->emailEnabled()
                ? $this->retroResultsRecipients->counts($retro)
                : null,
        ];
```

- [ ] **Step 5: Extend the poker snapshot**

In `app/Actions/Poker/BuildPokerSnapshot.php`, import `App\Actions\Integrations\{LatestDeliveries,PresentIntegrationDelivery,ShareOptions,SharePermissions}` and `App\Enums\IntegrationDeliveryKind`; add `@phpstan-import-type Delivery from PresentIntegrationDelivery` to the class docblock and, in the `Snapshot` shape after `links: array{team: ?string},`:

```php
 *     share: array{slack: bool, telegram: bool},
 *     deliveries: array<int, Delivery>,
```

Add the constructor parameters:

```php
        private ShareOptions $shareOptions,
        private SharePermissions $sharePermissions,
        private LatestDeliveries $latestDeliveries,
```

and add to the returned array after `'links' => [...],`:

```php
            'share' => $this->shareOptions->pokerGame($game, $viewer),
            'deliveries' => $this->sharePermissions->pokerGame($game, $viewer)
                ? $this->latestDeliveries->handle($game, [IntegrationDeliveryKind::PokerLink])
                : [],
```

- [ ] **Step 6: Add the translations**

| Key (en) | fr | es | de |
|---|---|---|---|
| `Only the facilitator or a workspace admin can share this retrospective.` | `Seuls l'animateur ou un administrateur de l'espace de travail peuvent partager cette rétrospective.` | `Solo el facilitador o un administrador del espacio de trabajo puede compartir esta retrospectiva.` | `Nur der Moderator oder ein Workspace-Admin kann diese Retrospektive teilen.` |
| `Only the facilitator or a workspace admin can share this game.` | `Seuls l'animateur ou un administrateur de l'espace de travail peuvent partager cette partie.` | `Solo el facilitador o un administrador del espacio de trabajo puede compartir esta partida.` | `Nur der Moderator oder ein Workspace-Admin kann dieses Spiel teilen.` |

- [ ] **Step 7: Run the tests**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Integrations/ShareSnapshotTest.php tests/Feature/Retros/BoardSnapshotTest.php tests/Feature/Retros/ResultsTest.php tests/Feature/Poker/PokerSnapshotTest.php`
Expected: PASS (the existing snapshot suites, including their constant-query-count tests, stay green: the additions run a fixed number of queries).

- [ ] **Step 8: Format, analyse and commit**

```bash
vendor/bin/sail bin pint --dirty --format agent
vendor/bin/sail bin phpstan analyse --no-progress
git add app/Enums/RetroResultsAudience.php app/Actions/Integrations/SharePermissions.php app/Actions/Integrations/ShareOptions.php app/Actions/Integrations/RetroResultsRecipients.php app/Actions/Retros/BuildBoardSnapshot.php app/Actions/Retros/BuildResults.php app/Actions/Poker/BuildPokerSnapshot.php lang tests/Feature/Integrations/ShareSnapshotTest.php
git commit -m "feat: expose share channels and delivery lines in board and poker snapshots

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SosW8d2Uj7QxsF1tws5ssS"
```

---
### Task 4: Retro shares endpoint (board link and results recap)

**Files:**
- Create: `app/Actions/Integrations/BuildLinkShare.php`, `app/Http/Controllers/Integrations/RetroSharesController.php`
- Modify: `routes/web.php` **(shared)**, `lang/{en,fr,es,de}.json`
- Test: create `tests/Feature/Integrations/RetroSharesTest.php`

**Interfaces:**
- Consumes: Task 1 `QueueShare::handle()`, `PresentIntegrationDelivery::handle()`, `LinkShareContent`, `IntegrationDeliveryChannel::{shareChannels(), provider()}`; Task 2 `BuildRetroRecap::handle()`, `RetroRecapContent`; Task 3 `SharePermissions::ensureRetro()`; `Participant::current(Request)`; routes `retros.show`, `retros.join.show`.
- Produces:
  - `BuildLinkShare::{retro(Retro, User $sharer, bool $includeGuestLink): LinkShareContent, pokerGame(PokerGame, User $sharer, bool $includeGuestLink): LinkShareContent}` (Plan 13d adds `gameRoom()`).
  - `POST /retros/{retro}/shares` → `retros.shares.store` (`RetroSharesController::store`), body `{channel: slack|telegram, kind: link|results, include_guest_link?: bool}`, `throttle:5,1,shares`, response 202 = `PresentIntegrationDelivery` payload.
- Tests required: "queues a board link to Slack for the facilitator", "queues links to Telegram", "posts the guest link only on request", "refuses the guest link when guest access is off", "lets workspace admins share", "refuses other members, guests and a facilitator who left the team", "sends no board content in a link", "refuses a link on a completed retro and a recap before completion", "queues the results recap on a completed retro", "answers 404 when the provider is disabled", "refuses a team that is not connected or must reconnect", "limits shares to five a minute", "validates the channel and the kind".

- [ ] **Step 1: Write the failing tests**

Create `tests/Feature/Integrations/RetroSharesTest.php`:

```php
<?php

use App\Enums\IntegrationProvider;
use App\Enums\RetroPhase;
use App\Jobs\Integrations\DeliverToSlack;
use App\Jobs\Integrations\DeliverToTelegram;
use App\Models\Card;
use App\Models\IntegrationDelivery;
use App\Models\Participant;
use App\Models\Retro;
use App\Models\Team;
use App\Models\TeamIntegration;
use App\Models\User;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;

beforeEach(function () {
    Http::preventStrayRequests();
    Queue::fake();
    enableIntegrations(IntegrationProvider::Slack, IntegrationProvider::Telegram);
});

/**
 * @return array{0: Retro, 1: User}
 */
function shareableRetro(RetroPhase $phase = RetroPhase::Discussing, array $attributes = []): array
{
    $retro = Retro::factory()->inPhase($phase)->create([
        'title' => 'Sprint 42',
        'team_id' => Team::factory()->create(['name' => 'Platform'])->id,
        ...$attributes,
    ]);
    TeamIntegration::factory()->slack()->create(['team_id' => $retro->team_id]);
    TeamIntegration::factory()->telegram()->create(['team_id' => $retro->team_id]);
    [$facilitator] = retroFacilitator($retro);
    $facilitator->forceFill(['name' => 'Fran Facilitator'])->save();

    return [$retro, $facilitator];
}

function slackJobJson(DeliverToSlack $job): string
{
    return json_encode($job->message, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
}

it('queues a board link to Slack for the facilitator', function () {
    [$retro, $facilitator] = shareableRetro();

    $response = $this->actingAs($facilitator)
        ->postJson(route('retros.shares.store', $retro), ['channel' => 'slack', 'kind' => 'link'])
        ->assertAccepted()
        ->assertJson(['channel' => 'slack', 'kind' => 'retro_link', 'status' => 'queued', 'requestedBy' => 'Fran Facilitator']);

    $delivery = IntegrationDelivery::query()->sole();
    expect($response->json('id'))->toBe($delivery->id);
    Queue::assertPushed(DeliverToSlack::class, function (DeliverToSlack $job) use ($retro, $delivery) {
        $json = slackJobJson($job);

        return $job->deliveryId === $delivery->id
            && str_contains($json, 'Fran Facilitator invites you to the retrospective \"Sprint 42\" (Platform)')
            && str_contains($json, route('retros.show', $retro))
            && ! str_contains($json, $retro->guest_token);
    });
});

it('queues links to Telegram', function () {
    [$retro, $facilitator] = shareableRetro();

    $this->actingAs($facilitator)
        ->postJson(route('retros.shares.store', $retro), ['channel' => 'telegram', 'kind' => 'link'])
        ->assertAccepted()
        ->assertJson(['channel' => 'telegram']);

    Queue::assertPushed(DeliverToTelegram::class, fn (DeliverToTelegram $job) => str_contains($job->html, '<a href="'.route('retros.show', $retro).'">Open the retrospective</a>'));
});

it('posts the guest link only on request', function () {
    [$retro, $facilitator] = shareableRetro(attributes: ['guest_access_enabled' => true]);

    $this->actingAs($facilitator)
        ->postJson(route('retros.shares.store', $retro), ['channel' => 'slack', 'kind' => 'link', 'include_guest_link' => true])
        ->assertAccepted();
    $this->actingAs($facilitator)
        ->postJson(route('retros.shares.store', $retro), ['channel' => 'slack', 'kind' => 'link'])
        ->assertAccepted();

    $urls = collect(Queue::pushed(DeliverToSlack::class))->map(fn (DeliverToSlack $job) => $job->message['blocks'][1]['elements'][0]['url']);
    expect($urls->all())->toBe([route('retros.join.show', $retro->guest_token), route('retros.show', $retro)]);
});

it('refuses the guest link when guest access is off', function () {
    [$retro, $facilitator] = shareableRetro();

    $this->actingAs($facilitator)
        ->postJson(route('retros.shares.store', $retro), ['channel' => 'slack', 'kind' => 'link', 'include_guest_link' => true])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['include_guest_link' => 'Guest access is off for this retrospective.']);
    Queue::assertNothingPushed();
});

it('lets workspace admins share', function () {
    [$retro] = shareableRetro();
    [$admin] = workspaceAdminParticipant($retro);

    $this->actingAs($admin)
        ->postJson(route('retros.shares.store', $retro), ['channel' => 'slack', 'kind' => 'link'])
        ->assertAccepted();
});

it('refuses other members, guests and a facilitator who left the team', function (string $role) {
    [$retro, $facilitator] = shareableRetro(attributes: ['guest_access_enabled' => true]);

    $request = match ($role) {
        'member' => $this->actingAs(retroMember($retro)[0]),
        'guest' => $this->withCookies(retroGuestCookie(Participant::factory()->guest()->create(['retro_id' => $retro->id])))->withCredentials(),
        'former facilitator' => (function () use ($retro, $facilitator) {
            $retro->team->members()->detach($facilitator);

            return $this->actingAs($facilitator);
        })(),
    };

    $request->postJson(route('retros.shares.store', $retro), ['channel' => 'slack', 'kind' => 'link'])
        ->assertForbidden();
    Queue::assertNothingPushed();
})->with(['member', 'guest', 'former facilitator']);

it('sends no board content in a link', function () {
    [$retro, $facilitator] = shareableRetro(attributes: ['guest_access_enabled' => true]);
    Card::factory()->create(['retro_id' => $retro->id, 'content' => 'Secret card text']);

    $this->actingAs($facilitator)
        ->postJson(route('retros.shares.store', $retro), ['channel' => 'slack', 'kind' => 'link'])
        ->assertAccepted();
    $this->actingAs($facilitator)
        ->postJson(route('retros.shares.store', $retro), ['channel' => 'telegram', 'kind' => 'link'])
        ->assertAccepted();

    Queue::assertPushed(DeliverToSlack::class, fn (DeliverToSlack $job) => ! str_contains(slackJobJson($job), 'Secret card text'));
    Queue::assertPushed(DeliverToTelegram::class, fn (DeliverToTelegram $job) => ! str_contains($job->html, 'Secret card text'));
});

it('refuses a link on a completed retro and a recap before completion', function (RetroPhase $phase, string $kind, string $message) {
    [$retro, $facilitator] = shareableRetro($phase);

    $this->actingAs($facilitator)
        ->postJson(route('retros.shares.store', $retro), ['channel' => 'slack', 'kind' => $kind])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['kind' => $message]);
    Queue::assertNothingPushed();
})->with([
    'link after completion' => [RetroPhase::Completed, 'link', 'This retrospective is completed. Share its results instead.'],
    'recap while writing' => [RetroPhase::Writing, 'results', 'Results can be shared once the retrospective is completed.'],
    'recap while discussing' => [RetroPhase::Discussing, 'results', 'Results can be shared once the retrospective is completed.'],
]);

it('queues the results recap on a completed retro', function () {
    [$retro, $facilitator] = shareableRetro(RetroPhase::Completed);

    $this->actingAs($facilitator)
        ->postJson(route('retros.shares.store', $retro), ['channel' => 'slack', 'kind' => 'results'])
        ->assertAccepted()
        ->assertJson(['kind' => 'retro_results']);
    $this->actingAs($facilitator)
        ->postJson(route('retros.shares.store', $retro), ['channel' => 'telegram', 'kind' => 'results', 'include_guest_link' => true])
        ->assertAccepted();

    Queue::assertPushed(DeliverToSlack::class, fn (DeliverToSlack $job) => str_contains(slackJobJson($job), 'Results of the retrospective \"Sprint 42\"'));
    Queue::assertPushed(DeliverToTelegram::class, fn (DeliverToTelegram $job) => str_contains($job->html, 'Results of the retrospective &quot;Sprint 42&quot;')
        && ! str_contains($job->html, $retro->guest_token));
});

it('answers 404 when the provider is disabled', function () {
    [$retro, $facilitator] = shareableRetro();
    disableIntegrations();

    $this->actingAs($facilitator)
        ->postJson(route('retros.shares.store', $retro), ['channel' => 'slack', 'kind' => 'link'])
        ->assertNotFound();
});

it('refuses a team that is not connected or must reconnect', function () {
    [$retro, $facilitator] = shareableRetro();
    TeamIntegration::query()->where('provider', 'telegram')->delete();
    TeamIntegration::query()->where('provider', 'slack')->update(['status' => 'reconnect_required']);

    $this->actingAs($facilitator)
        ->postJson(route('retros.shares.store', $retro), ['channel' => 'telegram', 'kind' => 'link'])
        ->assertConflict()
        ->assertJson(['message' => 'Connect Telegram in the team settings.']);
    $this->actingAs($facilitator)
        ->postJson(route('retros.shares.store', $retro), ['channel' => 'slack', 'kind' => 'link'])
        ->assertConflict()
        ->assertJson(['message' => 'Reconnect Slack in the team settings.']);
    expect(IntegrationDelivery::query()->count())->toBe(0);
});

it('limits shares to five a minute', function () {
    [$retro, $facilitator] = shareableRetro();

    foreach (range(1, 5) as $attempt) {
        $this->actingAs($facilitator)
            ->postJson(route('retros.shares.store', $retro), ['channel' => 'slack', 'kind' => 'link'])
            ->assertAccepted();
    }

    $this->actingAs($facilitator)
        ->postJson(route('retros.shares.store', $retro), ['channel' => 'slack', 'kind' => 'link'])
        ->assertTooManyRequests();
});

it('validates the channel and the kind', function (array $body, string $field) {
    [$retro, $facilitator] = shareableRetro();

    $this->actingAs($facilitator)
        ->postJson(route('retros.shares.store', $retro), $body)
        ->assertUnprocessable()
        ->assertJsonValidationErrors($field);
})->with([
    'email is not a chat' => [['channel' => 'email', 'kind' => 'link'], 'channel'],
    'unknown channel' => [['channel' => 'teams', 'kind' => 'link'], 'channel'],
    'unknown kind' => [['channel' => 'slack', 'kind' => 'everything'], 'kind'],
    'guest link not a boolean' => [['channel' => 'slack', 'kind' => 'link', 'include_guest_link' => 'maybe'], 'include_guest_link'],
]);
```

- [ ] **Step 2: Run them to verify they fail**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Integrations/RetroSharesTest.php`
Expected: FAIL — `Route [retros.shares.store] not defined.`

- [ ] **Step 3: Create the link builder**

Create `app/Actions/Integrations/BuildLinkShare.php`:

```php
<?php

namespace App\Actions\Integrations;

use App\Models\PokerGame;
use App\Models\Retro;
use App\Models\User;
use App\Support\Integrations\Messages\LinkShareContent;

/**
 * An invitation carries the title, the team, the sharer's name and a URL,
 * never any board or game content (spec 6 §5.1). The guest URL is used
 * only when the sharer ticked the option.
 */
class BuildLinkShare
{
    public function retro(Retro $retro, User $sharer, bool $includeGuestLink): LinkShareContent
    {
        return new LinkShareContent(
            __(':sharer invites you to the retrospective ":title" (:team)', [
                'sharer' => $sharer->name,
                'title' => $retro->title,
                'team' => $retro->team->name,
            ]),
            __('Open the retrospective'),
            $includeGuestLink ? route('retros.join.show', $retro->guest_token) : route('retros.show', $retro),
        );
    }

    public function pokerGame(PokerGame $game, User $sharer, bool $includeGuestLink): LinkShareContent
    {
        return new LinkShareContent(
            __(':sharer invites you to the planning poker game ":title" (:team)', [
                'sharer' => $sharer->name,
                'title' => $game->title,
                'team' => $game->team->name,
            ]),
            __('Open the game'),
            $includeGuestLink ? route('poker.join.show', $game->guest_token) : route('poker.show', $game),
        );
    }
}
```

- [ ] **Step 4: Create the controller**

Create `app/Http/Controllers/Integrations/RetroSharesController.php`:

```php
<?php

namespace App\Http\Controllers\Integrations;

use App\Actions\Integrations\BuildLinkShare;
use App\Actions\Integrations\BuildRetroRecap;
use App\Actions\Integrations\PresentIntegrationDelivery;
use App\Actions\Integrations\QueueShare;
use App\Actions\Integrations\SharePermissions;
use App\Enums\IntegrationDeliveryChannel;
use App\Enums\IntegrationDeliveryKind;
use App\Enums\RetroPhase;
use App\Http\Controllers\Controller;
use App\Models\Participant;
use App\Models\Retro;
use App\Support\Integrations\Messages\RetroRecapContent;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class RetroSharesController extends Controller
{
    private const LinkKind = 'link';

    private const ResultsKind = 'results';

    public function __construct(
        private SharePermissions $sharePermissions,
        private QueueShare $queueShare,
        private BuildLinkShare $buildLinkShare,
        private BuildRetroRecap $buildRetroRecap,
        private PresentIntegrationDelivery $presentIntegrationDelivery,
    ) {}

    public function store(Request $request, Retro $retro): JsonResponse
    {
        $participant = Participant::current($request);

        $validated = $request->validate([
            'channel' => ['required', Rule::enum(IntegrationDeliveryChannel::class)->only(IntegrationDeliveryChannel::shareChannels())],
            'kind' => ['required', Rule::in([self::LinkKind, self::ResultsKind])],
            'include_guest_link' => ['sometimes', 'boolean'],
        ]);

        $channel = IntegrationDeliveryChannel::from($validated['channel']);

        abort_unless($channel->provider()?->isEnabled() ?? false, 404);

        $sharer = $this->sharePermissions->ensureRetro($retro, $participant);
        $isResults = $validated['kind'] === self::ResultsKind;
        $includeGuestLink = ! $isResults && $request->boolean('include_guest_link');

        $this->ensurePhase($retro, $isResults);

        if ($includeGuestLink && ! $retro->guest_access_enabled) {
            throw ValidationException::withMessages(['include_guest_link' => __('Guest access is off for this retrospective.')]);
        }

        $delivery = $this->queueShare->handle(
            $retro,
            $channel,
            $isResults ? IntegrationDeliveryKind::RetroResults : IntegrationDeliveryKind::RetroLink,
            $sharer,
            $isResults
                ? new RetroRecapContent($this->buildRetroRecap->handle($retro))
                : $this->buildLinkShare->retro($retro, $sharer, $includeGuestLink),
        );

        return response()->json($this->presentIntegrationDelivery->handle($delivery->load('requestedBy')), 202);
    }

    private function ensurePhase(Retro $retro, bool $isResults): void
    {
        $isCompleted = $retro->phase === RetroPhase::Completed;

        if ($isResults && ! $isCompleted) {
            throw ValidationException::withMessages(['kind' => __('Results can be shared once the retrospective is completed.')]);
        }

        if (! $isResults && $isCompleted) {
            throw ValidationException::withMessages(['kind' => __('This retrospective is completed. Share its results instead.')]);
        }
    }
}
```

- [ ] **Step 5: Register the route**

In `routes/web.php`, import `App\Http\Controllers\Integrations\RetroSharesController` and add inside the `retros/{retro}` group, after the `summary` routes:

```php
        Route::post('shares', [RetroSharesController::class, 'store'])->middleware('throttle:5,1,shares')->name('retros.shares.store');
```

The provider check happens in the controller (the channel is in the body). Then run `vendor/bin/sail artisan wayfinder:generate --with-form`.

- [ ] **Step 6: Add the translations**

| Key (en) | fr | es | de |
|---|---|---|---|
| `:sharer invites you to the retrospective ":title" (:team)` | `:sharer vous invite à la rétrospective « :title » (:team)` | `:sharer te invita a la retrospectiva «:title» (:team)` | `:sharer lädt dich zur Retrospektive „:title“ (:team) ein` |
| `Open the retrospective` | `Ouvrir la rétrospective` | `Abrir la retrospectiva` | `Retrospektive öffnen` |
| `:sharer invites you to the planning poker game ":title" (:team)` | `:sharer vous invite à la partie de planning poker « :title » (:team)` | `:sharer te invita a la partida de planning poker «:title» (:team)` | `:sharer lädt dich zum Planning-Poker-Spiel „:title“ (:team) ein` |
| `Open the game` | `Ouvrir la partie` | `Abrir la partida` | `Spiel öffnen` |
| `Guest access is off for this retrospective.` | `L'accès invité est désactivé pour cette rétrospective.` | `El acceso de invitados está desactivado para esta retrospectiva.` | `Der Gastzugang ist für diese Retrospektive ausgeschaltet.` |
| `Results can be shared once the retrospective is completed.` | `Les résultats peuvent être partagés une fois la rétrospective terminée.` | `Los resultados se pueden compartir cuando la retrospectiva haya terminado.` | `Die Ergebnisse können geteilt werden, sobald die Retrospektive abgeschlossen ist.` |
| `This retrospective is completed. Share its results instead.` | `Cette rétrospective est terminée. Partagez plutôt ses résultats.` | `Esta retrospectiva ha terminado. Comparte sus resultados en su lugar.` | `Diese Retrospektive ist abgeschlossen. Teile stattdessen ihre Ergebnisse.` |

- [ ] **Step 7: Run the tests**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Integrations/RetroSharesTest.php`
Expected: PASS.

- [ ] **Step 8: Format, analyse and commit**

```bash
vendor/bin/sail bin pint --dirty --format agent
vendor/bin/sail bin phpstan analyse --no-progress
git add app/Actions/Integrations/BuildLinkShare.php app/Http/Controllers/Integrations/RetroSharesController.php routes/web.php lang tests/Feature/Integrations/RetroSharesTest.php
git commit -m "feat: post retro links and results recaps to Slack and Telegram

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SosW8d2Uj7QxsF1tws5ssS"
```

---
### Task 5: Poker shares endpoint

**Files:**
- Create: `app/Http/Controllers/Integrations/PokerSharesController.php`
- Modify: `routes/web.php` **(shared)**, `lang/{en,fr,es,de}.json`
- Test: create `tests/Feature/Integrations/PokerSharesTest.php`

**Interfaces:**
- Consumes: Task 1 `QueueShare`, `PresentIntegrationDelivery`; Task 3 `SharePermissions::ensurePokerGame()`; Task 4 `BuildLinkShare::pokerGame()`; `PokerPlayer::current(Request)`, `PokerGuard::notEnded(PokerGame)`.
- Produces: `POST /poker/{game}/shares` → `poker.shares.store` (`PokerSharesController::store`), body `{channel: slack|telegram, include_guest_link?: bool}`, `throttle:5,1,shares`, 202 = `PresentIntegrationDelivery` payload.
- Tests required: "queues a game link for the facilitator", "posts the poker guest link only on request", "refuses the poker guest link when guest access is off", "lets workspace admins share a game", "refuses other players and guests", "refuses an ended game", "answers 404 for a disabled provider and 409 without a connection".

- [ ] **Step 1: Write the failing tests**

Create `tests/Feature/Integrations/PokerSharesTest.php`:

```php
<?php

use App\Enums\IntegrationProvider;
use App\Jobs\Integrations\DeliverToSlack;
use App\Jobs\Integrations\DeliverToTelegram;
use App\Models\PokerGame;
use App\Models\PokerPlayer;
use App\Models\PokerTask;
use App\Models\Team;
use App\Models\TeamIntegration;
use App\Models\User;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;

beforeEach(function () {
    Http::preventStrayRequests();
    Queue::fake();
    enableIntegrations(IntegrationProvider::Slack, IntegrationProvider::Telegram);
});

/**
 * @return array{0: PokerGame, 1: User}
 */
function shareablePokerGame(array $attributes = []): array
{
    $game = PokerGame::factory()->create([
        'title' => 'Sprint 12 sizing',
        'team_id' => Team::factory()->create(['name' => 'Platform'])->id,
        ...$attributes,
    ]);
    TeamIntegration::factory()->slack()->create(['team_id' => $game->team_id]);
    TeamIntegration::factory()->telegram()->create(['team_id' => $game->team_id]);
    [$facilitator] = pokerFacilitator($game);
    $facilitator->forceFill(['name' => 'Fran Facilitator'])->save();

    return [$game, $facilitator];
}

it('queues a game link for the facilitator', function () {
    [$game, $facilitator] = shareablePokerGame();
    PokerTask::factory()->create(['poker_game_id' => $game->id, 'title' => 'Secret task title']);

    $this->actingAs($facilitator)
        ->postJson(route('poker.shares.store', $game), ['channel' => 'slack'])
        ->assertAccepted()
        ->assertJson(['channel' => 'slack', 'kind' => 'poker_link', 'status' => 'queued']);
    $this->actingAs($facilitator)
        ->postJson(route('poker.shares.store', $game), ['channel' => 'telegram'])
        ->assertAccepted();

    Queue::assertPushed(DeliverToSlack::class, function (DeliverToSlack $job) use ($game) {
        $json = json_encode($job->message, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);

        return str_contains($json, 'Fran Facilitator invites you to the planning poker game \"Sprint 12 sizing\" (Platform)')
            && $job->message['blocks'][1]['elements'][0]['url'] === route('poker.show', $game)
            && ! str_contains($json, 'Secret task title');
    });
    Queue::assertPushed(DeliverToTelegram::class, fn (DeliverToTelegram $job) => str_contains($job->html, 'Open the game') && ! str_contains($job->html, 'Secret task title'));
});

it('posts the poker guest link only on request', function () {
    [$game, $facilitator] = shareablePokerGame(['guest_access_enabled' => true]);

    $this->actingAs($facilitator)
        ->postJson(route('poker.shares.store', $game), ['channel' => 'slack', 'include_guest_link' => true])
        ->assertAccepted();

    Queue::assertPushed(DeliverToSlack::class, fn (DeliverToSlack $job) => $job->message['blocks'][1]['elements'][0]['url'] === route('poker.join.show', $game->guest_token));
});

it('refuses the poker guest link when guest access is off', function () {
    [$game, $facilitator] = shareablePokerGame();

    $this->actingAs($facilitator)
        ->postJson(route('poker.shares.store', $game), ['channel' => 'slack', 'include_guest_link' => true])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['include_guest_link' => 'Guest access is off for this game.']);
    Queue::assertNothingPushed();
});

it('lets workspace admins share a game', function () {
    [$game] = shareablePokerGame();
    $admin = workspaceManager($game->team->workspace);
    PokerPlayer::factory()->create(['poker_game_id' => $game->id, 'user_id' => $admin->id]);

    $this->actingAs($admin)
        ->postJson(route('poker.shares.store', $game), ['channel' => 'slack'])
        ->assertAccepted();
});

it('refuses other players and guests', function (string $role) {
    [$game] = shareablePokerGame(['guest_access_enabled' => true]);

    $request = $role === 'guest'
        ? $this->withCookies(pokerGuestCookie(pokerGuest($game)))->withCredentials()
        : $this->actingAs(pokerMember($game)[0]);

    $request->postJson(route('poker.shares.store', $game), ['channel' => 'slack'])->assertForbidden();
    Queue::assertNothingPushed();
})->with(['member', 'guest']);

it('refuses an ended game', function () {
    [$game, $facilitator] = shareablePokerGame();
    $game->forceFill(['ended_at' => now()])->save();

    $this->actingAs($facilitator)
        ->postJson(route('poker.shares.store', $game), ['channel' => 'slack'])
        ->assertForbidden()
        ->assertJson(['message' => 'This game has ended.']);
});

it('answers 404 for a disabled provider and 409 without a connection', function () {
    [$game, $facilitator] = shareablePokerGame();
    TeamIntegration::query()->where('provider', 'telegram')->delete();
    config(['services.slack.client_id' => null]);

    $this->actingAs($facilitator)
        ->postJson(route('poker.shares.store', $game), ['channel' => 'slack'])
        ->assertNotFound();
    $this->actingAs($facilitator)
        ->postJson(route('poker.shares.store', $game), ['channel' => 'telegram'])
        ->assertConflict()
        ->assertJson(['message' => 'Connect Telegram in the team settings.']);
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Integrations/PokerSharesTest.php`
Expected: FAIL — `Route [poker.shares.store] not defined.`

- [ ] **Step 3: Create the controller**

Create `app/Http/Controllers/Integrations/PokerSharesController.php`:

```php
<?php

namespace App\Http\Controllers\Integrations;

use App\Actions\Integrations\BuildLinkShare;
use App\Actions\Integrations\PresentIntegrationDelivery;
use App\Actions\Integrations\QueueShare;
use App\Actions\Integrations\SharePermissions;
use App\Actions\Poker\PokerGuard;
use App\Enums\IntegrationDeliveryChannel;
use App\Enums\IntegrationDeliveryKind;
use App\Http\Controllers\Controller;
use App\Models\PokerGame;
use App\Models\PokerPlayer;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class PokerSharesController extends Controller
{
    public function __construct(
        private SharePermissions $sharePermissions,
        private QueueShare $queueShare,
        private BuildLinkShare $buildLinkShare,
        private PresentIntegrationDelivery $presentIntegrationDelivery,
    ) {}

    public function store(Request $request, PokerGame $game): JsonResponse
    {
        $player = PokerPlayer::current($request);

        $validated = $request->validate([
            'channel' => ['required', Rule::enum(IntegrationDeliveryChannel::class)->only(IntegrationDeliveryChannel::shareChannels())],
            'include_guest_link' => ['sometimes', 'boolean'],
        ]);

        $channel = IntegrationDeliveryChannel::from($validated['channel']);

        abort_unless($channel->provider()?->isEnabled() ?? false, 404);

        $sharer = $this->sharePermissions->ensurePokerGame($game, $player);
        PokerGuard::notEnded($game);

        $includeGuestLink = $request->boolean('include_guest_link');

        if ($includeGuestLink && ! $game->guest_access_enabled) {
            throw ValidationException::withMessages(['include_guest_link' => __('Guest access is off for this game.')]);
        }

        $delivery = $this->queueShare->handle(
            $game,
            $channel,
            IntegrationDeliveryKind::PokerLink,
            $sharer,
            $this->buildLinkShare->pokerGame($game, $sharer, $includeGuestLink),
        );

        return response()->json($this->presentIntegrationDelivery->handle($delivery->load('requestedBy')), 202);
    }
}
```

- [ ] **Step 4: Register the route**

In `routes/web.php`, import `App\Http\Controllers\Integrations\PokerSharesController` and add inside the `poker/{game}` group, after the `guest-token` route:

```php
        Route::post('shares', [PokerSharesController::class, 'store'])->middleware('throttle:5,1,shares')->name('poker.shares.store');
```

Then run `vendor/bin/sail artisan wayfinder:generate --with-form`.

- [ ] **Step 5: Add the translations**

| Key (en) | fr | es | de |
|---|---|---|---|
| `Guest access is off for this game.` | `L'accès invité est désactivé pour cette partie.` | `El acceso de invitados está desactivado para esta partida.` | `Der Gastzugang ist für dieses Spiel ausgeschaltet.` |

- [ ] **Step 6: Run the tests**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Integrations/PokerSharesTest.php`
Expected: PASS.

- [ ] **Step 7: Format, analyse and commit**

```bash
vendor/bin/sail bin pint --dirty --format agent
vendor/bin/sail bin phpstan analyse --no-progress
git add app/Http/Controllers/Integrations/PokerSharesController.php routes/web.php lang tests/Feature/Integrations/PokerSharesTest.php
git commit -m "feat: post planning poker links to Slack and Telegram

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SosW8d2Uj7QxsF1tws5ssS"
```

---
### Task 6: Email results (`RetroResultsNotification`, `results-email` endpoint)

**Files:**
- Create: `app/Support/Integrations/Messages/RetroRecapMail.php`, `app/Notifications/RetroResultsNotification.php`, `app/Http/Controllers/Integrations/RetroResultsEmailsController.php`
- Modify: `routes/web.php` **(shared)**, `lang/{en,fr,es,de}.json`
- Test: create `tests/Feature/Integrations/ResultsEmailTest.php`

**Interfaces:**
- Consumes: Task 2 `BuildRetroRecap`, `RecapText`; Task 3 `SharePermissions::ensureRetro()`, `RetroResultsRecipients::{query(), isRecipient()}`, `RetroResultsAudience`; Task 1 `PresentIntegrationDelivery`; `SummarizeHealthCheck::handle(Retro): ?array{score: float, participation: array{respondents: int, participants: int}, …}`; `IntegrationAvailability::emailEnabled()`; `Retro::announceDeliveryChange()`.
- Produces:
  - `RetroRecapMail::build(RetroRecap $recap, ?array $health): MailMessage` (Markdown-escaped lines, health line `x.x/10` when a health check was answered).
  - `App\Notifications\RetroResultsNotification(string $retroId)` — `mail`, `ShouldQueue`, `ShouldBeEncrypted`, `shouldSend()` re-checks the recipient is still a verified team member.
  - `POST /retros/{retro}/results-email` → `retros.results-email.store` (`RetroResultsEmailsController::store`), body `{audience: participants|team}`, 202 = `PresentIntegrationDelivery` payload (`channel: email`, `kind: retro_results`, `status: sent`, `recipientCount`); one email send per retro per 10 minutes.
- Tests required: "emails the results to participants with an account", "emails every team member on request", "sends each mail in the recipient's locale", "writes the recap, the health score and the link in the mail", "escapes Markdown in the mail", "skips members who left before sending", "allows one email every ten minutes", "refuses non-sharers, guests and unfinished retros", "answers 404 when the mailer does not deliver", "refuses when nobody can receive the results".

- [ ] **Step 1: Write the failing tests**

Create `tests/Feature/Integrations/ResultsEmailTest.php`:

```php
<?php

use App\Actions\HealthCheck\FreezeHealthStatements;
use App\Enums\IntegrationDeliveryChannel;
use App\Enums\IntegrationDeliveryKind;
use App\Enums\IntegrationDeliveryStatus;
use App\Enums\RetroPhase;
use App\Events\Retros\ResultsChanged;
use App\Models\Card;
use App\Models\Column;
use App\Models\HealthCheckAnswer;
use App\Models\IntegrationDelivery;
use App\Models\Participant;
use App\Models\Retro;
use App\Models\User;
use App\Models\Vote;
use App\Notifications\RetroResultsNotification;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Notification;

beforeEach(function () {
    Http::preventStrayRequests();
    Notification::fake();
    Event::fake([ResultsChanged::class]);
    config(['mail.default' => 'smtp']);
});

/**
 * @return array{0: Retro, 1: User}
 */
function emailableRetro(RetroPhase $phase = RetroPhase::Completed, array $attributes = []): array
{
    $retro = Retro::factory()->inPhase($phase)->create(['title' => 'Sprint 42', ...$attributes]);
    [$facilitator] = retroFacilitator($retro);

    return [$retro, $facilitator];
}

it('emails the results to participants with an account', function () {
    [$retro, $facilitator] = emailableRetro();
    [$participant] = retroMember($retro);
    $bystander = teamMember($retro->team);
    $unverified = User::factory()->unverified()->create();
    $retro->team->members()->attach($unverified);
    Participant::factory()->create(['retro_id' => $retro->id, 'user_id' => $unverified->id]);
    Participant::factory()->guest()->create(['retro_id' => $retro->id]);

    $this->actingAs($facilitator)
        ->postJson(route('retros.results-email.store', $retro), ['audience' => 'participants'])
        ->assertAccepted()
        ->assertJson(['channel' => 'email', 'kind' => 'retro_results', 'status' => 'sent', 'recipientCount' => 2]);

    Notification::assertSentTo([$facilitator, $participant], RetroResultsNotification::class, fn (RetroResultsNotification $notification) => $notification->retroId === $retro->id);
    Notification::assertNotSentTo([$bystander, $unverified], RetroResultsNotification::class);
    Notification::assertCount(2);
    expect(IntegrationDelivery::query()->sole())
        ->channel->toBe(IntegrationDeliveryChannel::Email)
        ->kind->toBe(IntegrationDeliveryKind::RetroResults)
        ->status->toBe(IntegrationDeliveryStatus::Sent)
        ->recipient_count->toBe(2)
        ->requested_by_user_id->toBe($facilitator->id);
    Event::assertDispatched(ResultsChanged::class);
});

it('emails every team member on request', function () {
    [$retro, $facilitator] = emailableRetro();
    $bystander = teamMember($retro->team);
    [$admin] = workspaceAdminParticipant($retro);

    $this->actingAs($facilitator)
        ->postJson(route('retros.results-email.store', $retro), ['audience' => 'team'])
        ->assertAccepted()
        ->assertJson(['recipientCount' => 2]);

    Notification::assertSentTo([$facilitator, $bystander], RetroResultsNotification::class);
    Notification::assertNotSentTo($admin, RetroResultsNotification::class);
});

it('sends each mail in the recipient\'s locale', function () {
    [$retro, $facilitator] = emailableRetro();
    $facilitator->forceFill(['locale' => 'fr'])->save();
    [$participant] = retroMember($retro);
    $participant->forceFill(['locale' => 'de'])->save();

    $this->actingAs($facilitator)
        ->postJson(route('retros.results-email.store', $retro), ['audience' => 'participants'])
        ->assertAccepted();

    Notification::assertSentTo($facilitator, RetroResultsNotification::class, fn ($notification, $channels, $notifiable, $locale) => $locale === 'fr');
    Notification::assertSentTo($participant, RetroResultsNotification::class, fn ($notification, $channels, $notifiable, $locale) => $locale === 'de');
});

it('writes the recap, the health score and the link in the mail', function () {
    [$retro, $facilitator] = emailableRetro(attributes: ['health_check_enabled' => true]);
    app(FreezeHealthStatements::class)->handle($retro);
    HealthCheckAnswer::factory()->create(['retro_id' => $retro->id, 'statement' => 'vision', 'score' => 7]);

    $mail = (new RetroResultsNotification($retro->id))->toMail($facilitator);
    $html = (string) $mail->render();

    expect($mail->subject)->toBe('Results of the retrospective "Sprint 42"')
        ->and($html)->toContain('Health check: 7.0/10')
        ->and($html)->toContain(route('retros.show', $retro))
        ->and($html)->toContain('Participants (');
});

it('escapes Markdown in the mail', function () {
    [$retro, $facilitator] = emailableRetro();
    $column = Column::factory()->create(['retro_id' => $retro->id]);
    $card = Card::factory()->create(['retro_id' => $retro->id, 'column_id' => $column->id, 'content' => '[click me](https://evil.test) <script>alert(1)</script>']);
    Vote::factory()->create(['retro_id' => $retro->id, 'card_id' => $card->id]);

    $html = (string) (new RetroResultsNotification($retro->id))->toMail($facilitator)->render();

    expect($html)->not->toContain('href="https://evil.test"')
        ->not->toContain('<script>alert(1)</script>')
        ->toContain('click me');
});

it('skips members who left before sending', function () {
    [$retro, $facilitator] = emailableRetro();
    $notification = new RetroResultsNotification($retro->id);

    expect($notification->shouldSend($facilitator, 'mail'))->toBeTrue();

    $retro->team->members()->detach($facilitator);

    expect($notification->shouldSend($facilitator, 'mail'))->toBeFalse();

    $retro->delete();

    expect($notification->shouldSend($facilitator, 'mail'))->toBeFalse();
});

it('allows one email every ten minutes', function () {
    [$retro, $facilitator] = emailableRetro();
    [$admin] = workspaceAdminParticipant($retro);

    $this->actingAs($facilitator)
        ->postJson(route('retros.results-email.store', $retro), ['audience' => 'participants'])
        ->assertAccepted();
    $this->actingAs($admin)
        ->postJson(route('retros.results-email.store', $retro), ['audience' => 'team'])
        ->assertTooManyRequests()
        ->assertJson(['message' => 'The results were emailed a few minutes ago.']);

    $this->travel(11)->minutes();

    $this->actingAs($admin)
        ->postJson(route('retros.results-email.store', $retro), ['audience' => 'team'])
        ->assertAccepted();
});

it('refuses non-sharers, guests and unfinished retros', function () {
    [$retro, $facilitator] = emailableRetro(attributes: ['guest_access_enabled' => true]);
    [$member] = retroMember($retro);
    $guest = Participant::factory()->guest()->create(['retro_id' => $retro->id]);

    $this->actingAs($member)
        ->postJson(route('retros.results-email.store', $retro), ['audience' => 'team'])
        ->assertForbidden();
    $this->withCookies(retroGuestCookie($guest))->withCredentials()
        ->postJson(route('retros.results-email.store', $retro), ['audience' => 'team'])
        ->assertForbidden();

    [$discussing, $otherFacilitator] = emailableRetro(RetroPhase::Discussing);

    $this->actingAs($otherFacilitator)
        ->postJson(route('retros.results-email.store', $discussing), ['audience' => 'team'])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['audience' => 'Results can be shared once the retrospective is completed.']);
    $this->actingAs($facilitator)
        ->postJson(route('retros.results-email.store', $retro), ['audience' => 'everyone'])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('audience');
    Notification::assertNothingSent();
});

it('answers 404 when the mailer does not deliver', function (string $mailer) {
    config(['mail.default' => $mailer]);
    [$retro, $facilitator] = emailableRetro();

    $this->actingAs($facilitator)
        ->postJson(route('retros.results-email.store', $retro), ['audience' => 'team'])
        ->assertNotFound();
})->with(['log', 'array']);

it('refuses when nobody can receive the results', function () {
    [$retro, $facilitator] = emailableRetro();
    $facilitator->forceFill(['email_verified_at' => null])->save();

    $this->actingAs($facilitator)
        ->postJson(route('retros.results-email.store', $retro), ['audience' => 'participants'])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['audience' => 'Nobody can receive these results by email.']);
    expect(IntegrationDelivery::query()->count())->toBe(0);
});
```

The last test acts as an unverified user: the `retros/{retro}` group does not require `verified` and `ResolveRetroParticipant` does not check it, so the request reaches the controller, where the facilitator passes `ensureRetro` but is no recipient.

- [ ] **Step 2: Run them to verify they fail**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Integrations/ResultsEmailTest.php`
Expected: FAIL — `Route [retros.results-email.store] not defined.`

- [ ] **Step 3: Create the mail formatter**

Create `app/Support/Integrations/Messages/RetroRecapMail.php`:

```php
<?php

namespace App\Support\Integrations\Messages;

use Illuminate\Notifications\Messages\MailMessage;

/**
 * The recap as a Markdown mail. User text is escaped so that it can never
 * become a link or formatting (the template already escapes HTML).
 */
class RetroRecapMail
{
    /**
     * @param  array{score: float, participation: array{respondents: int, participants: int}}|null  $health
     */
    public function build(RetroRecap $recap, ?array $health): MailMessage
    {
        $mail = (new MailMessage)
            ->subject(RecapText::heading($recap))
            ->line($this->escape(RecapText::context($recap)))
            ->line($this->escape(RecapText::participants($recap)))
            ->line($this->escape(RecapText::cards($recap)));

        $roti = RecapText::roti($recap);

        if ($roti !== null) {
            $mail->line($this->escape($roti));
        }

        if ($health !== null) {
            $mail->line($this->escape(__('Health check: :score/10 (:respondents of :participants participants answered)', [
                'score' => number_format($health['score'], 1),
                'respondents' => $health['participation']['respondents'],
                'participants' => $health['participation']['participants'],
            ])));
        }

        if ($recap->summary !== null) {
            $mail->line('**'.$this->escape(__('Summary')).'**');

            foreach (preg_split('/\R{2,}/u', $recap->summary) ?: [] as $paragraph) {
                $mail->line($this->escape($paragraph));
            }
        }

        $this->list($mail, __('Action items'), array_map(RecapText::actionItem(...), $recap->actionItems), $recap->hiddenActionItems);
        $this->list($mail, __('Suggested actions'), $recap->suggestedActions, $recap->hiddenSuggestedActions);
        $this->list($mail, __('Top card per column'), array_map(RecapText::topCard(...), $recap->topCards), 0);

        return $mail->action(__('View the results'), $recap->url);
    }

    /**
     * @param  array<int, string>  $lines
     */
    private function list(MailMessage $mail, string $heading, array $lines, int $hidden): void
    {
        if ($lines === []) {
            return;
        }

        $mail->line('**'.$this->escape($heading).'**');

        foreach ($lines as $line) {
            $mail->line('• '.$this->escape($line));
        }

        if ($hidden > 0) {
            $mail->line($this->escape(RecapText::more($hidden)));
        }
    }

    private function escape(string $text): string
    {
        $singleLine = preg_replace('/\s+/u', ' ', $text) ?? $text;

        return addcslashes($singleLine, '\\`*_{}[]()#+-.!|<>');
    }
}
```

- [ ] **Step 4: Create the notification**

Create `app/Notifications/RetroResultsNotification.php`:

```php
<?php

namespace App\Notifications;

use App\Actions\HealthCheck\SummarizeHealthCheck;
use App\Actions\Integrations\BuildRetroRecap;
use App\Actions\Integrations\RetroResultsRecipients;
use App\Models\Retro;
use App\Models\User;
use App\Support\Integrations\Messages\RetroRecapMail;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldBeEncrypted;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Carries the retro id only: the recap is written when the mail is sent,
 * in the recipient's locale, and nobody who left the team receives it.
 */
class RetroResultsNotification extends Notification implements ShouldBeEncrypted, ShouldQueue
{
    use Queueable;

    public function __construct(public string $retroId) {}

    /** @return array<int, string> */
    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function shouldSend(object $notifiable, string $channel): bool
    {
        $retro = Retro::query()->with('team')->find($this->retroId);

        if ($retro === null || ! $notifiable instanceof User) {
            return false;
        }

        return app(RetroResultsRecipients::class)->isRecipient($retro, $notifiable);
    }

    public function toMail(object $notifiable): MailMessage
    {
        $retro = Retro::query()->with('team')->findOrFail($this->retroId);

        return app(RetroRecapMail::class)->build(
            app(BuildRetroRecap::class)->handle($retro),
            app(SummarizeHealthCheck::class)->handle($retro),
        );
    }
}
```

- [ ] **Step 5: Create the controller**

Create `app/Http/Controllers/Integrations/RetroResultsEmailsController.php`:

```php
<?php

namespace App\Http\Controllers\Integrations;

use App\Actions\Integrations\PresentIntegrationDelivery;
use App\Actions\Integrations\RetroResultsRecipients;
use App\Actions\Integrations\SharePermissions;
use App\Enums\IntegrationDeliveryChannel;
use App\Enums\IntegrationDeliveryKind;
use App\Enums\IntegrationDeliveryStatus;
use App\Enums\RetroPhase;
use App\Enums\RetroResultsAudience;
use App\Http\Controllers\Controller;
use App\Models\IntegrationDelivery;
use App\Models\Participant;
use App\Models\Retro;
use App\Notifications\RetroResultsNotification;
use App\Support\Integrations\IntegrationAvailability;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class RetroResultsEmailsController extends Controller
{
    private const CooldownSeconds = 600;

    public function __construct(
        private IntegrationAvailability $integrationAvailability,
        private SharePermissions $sharePermissions,
        private RetroResultsRecipients $retroResultsRecipients,
        private PresentIntegrationDelivery $presentIntegrationDelivery,
    ) {}

    public function store(Request $request, Retro $retro): JsonResponse
    {
        $participant = Participant::current($request);

        abort_unless($this->integrationAvailability->emailEnabled(), 404);

        $sharer = $this->sharePermissions->ensureRetro($retro, $participant);

        $validated = $request->validate([
            'audience' => ['required', Rule::enum(RetroResultsAudience::class)],
        ]);

        if ($retro->phase !== RetroPhase::Completed) {
            throw ValidationException::withMessages(['audience' => __('Results can be shared once the retrospective is completed.')]);
        }

        $cooldownKey = "retro-results-email:{$retro->id}";

        abort_if(RateLimiter::tooManyAttempts($cooldownKey, 1), 429, __('The results were emailed a few minutes ago.'));

        $recipients = $this->retroResultsRecipients->query($retro, RetroResultsAudience::from($validated['audience']))->get();

        if ($recipients->isEmpty()) {
            throw ValidationException::withMessages(['audience' => __('Nobody can receive these results by email.')]);
        }

        RateLimiter::hit($cooldownKey, self::CooldownSeconds);

        $delivery = IntegrationDelivery::query()->create([
            'team_id' => $retro->team_id,
            'channel' => IntegrationDeliveryChannel::Email,
            'kind' => IntegrationDeliveryKind::RetroResults,
            'subject_type' => $retro->getMorphClass(),
            'subject_id' => $retro->id,
            'requested_by_user_id' => $sharer->id,
            'status' => IntegrationDeliveryStatus::Queued,
        ]);

        Notification::send($recipients, new RetroResultsNotification($retro->id));

        $delivery->markSent($recipients->count());
        $retro->announceDeliveryChange();

        return response()->json($this->presentIntegrationDelivery->handle($delivery->load('requestedBy')), 202);
    }
}
```

- [ ] **Step 6: Register the route**

In `routes/web.php`, import `App\Http\Controllers\Integrations\RetroResultsEmailsController` and add inside the `retros/{retro}` group, after the `shares` route:

```php
        Route::post('results-email', [RetroResultsEmailsController::class, 'store'])->name('retros.results-email.store');
```

Then run `vendor/bin/sail artisan wayfinder:generate --with-form`.

- [ ] **Step 7: Add the translations**

| Key (en) | fr | es | de |
|---|---|---|---|
| `Health check: :score/10 (:respondents of :participants participants answered)` | `Bilan de santé : :score/10 (:respondents participants sur :participants ont répondu)` | `Chequeo de salud: :score/10 (respondieron :respondents de :participants participantes)` | `Gesundheitscheck: :score/10 (:respondents von :participants Teilnehmenden haben geantwortet)` |
| `View the results` | `Voir les résultats` | `Ver los resultados` | `Ergebnisse ansehen` |
| `The results were emailed a few minutes ago.` | `Les résultats ont été envoyés par e-mail il y a quelques minutes.` | `Los resultados se enviaron por correo hace unos minutos.` | `Die Ergebnisse wurden vor ein paar Minuten per E-Mail verschickt.` |
| `Nobody can receive these results by email.` | `Personne ne peut recevoir ces résultats par e-mail.` | `Nadie puede recibir estos resultados por correo.` | `Niemand kann diese Ergebnisse per E-Mail erhalten.` |

The health wording follows the existing `Health check` rows (`Bilan de santé`, `Chequeo de salud`, `Gesundheitscheck`).

- [ ] **Step 8: Run the tests**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Integrations/ResultsEmailTest.php`
Expected: PASS.

- [ ] **Step 9: Format, analyse and commit**

```bash
vendor/bin/sail bin pint --dirty --format agent
vendor/bin/sail bin phpstan analyse --no-progress
git add app/Support/Integrations/Messages/RetroRecapMail.php app/Notifications/RetroResultsNotification.php app/Http/Controllers/Integrations/RetroResultsEmailsController.php routes/web.php lang tests/Feature/Integrations/ResultsEmailTest.php
git commit -m "feat: email retro results to participants or the whole team

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SosW8d2Uj7QxsF1tws5ssS"
```

---
### Task 7: Redaction suite (what never leaves the instance)

**Files:**
- Test: create `tests/Feature/Integrations/ShareRedactionTest.php`

**Interfaces:**
- Consumes: the endpoints of Tasks 4 and 6, the jobs of Task 1 (`DeliverToSlack::$message`, `DeliverToTelegram::$html`), `RetroResultsNotification::toMail()`.
- Produces: no production code. This suite pins spec 6 §10.2 across the three channels at once, so a later change to any formatter or to the recap builder that leaks an author, a voter or a comment fails here.
- Tests required: "keeps authors out of every channel on anonymous retros", "names participants but never card authors on named retros", "never sends comments, surveys, themes, sentiment or health answers to the chats".

- [ ] **Step 1: Write the tests**

Create `tests/Feature/Integrations/ShareRedactionTest.php`:

```php
<?php

use App\Enums\CardSentiment;
use App\Enums\IntegrationProvider;
use App\Enums\RetroPhase;
use App\Jobs\Integrations\DeliverToSlack;
use App\Jobs\Integrations\DeliverToTelegram;
use App\Models\ActionItem;
use App\Models\Card;
use App\Models\CardComment;
use App\Models\Column;
use App\Models\Participant;
use App\Models\Retro;
use App\Models\RetroTheme;
use App\Models\Survey;
use App\Models\TeamIntegration;
use App\Models\User;
use App\Models\Vote;
use App\Notifications\RetroResultsNotification;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Queue;

beforeEach(function () {
    Http::preventStrayRequests();
    Queue::fake();
    Notification::fake();
    config(['mail.default' => 'smtp']);
    enableIntegrations(IntegrationProvider::Slack, IntegrationProvider::Telegram);
});

/**
 * Posts the recap to both chats and renders the mail; returns the three
 * payloads as text.
 *
 * @return array{slack: string, telegram: string, email: string}
 */
function sharedRecapTexts(Retro $retro, User $sharer): array
{
    test()->actingAs($sharer)->postJson(route('retros.shares.store', $retro), ['channel' => 'slack', 'kind' => 'results'])->assertAccepted();
    test()->actingAs($sharer)->postJson(route('retros.shares.store', $retro), ['channel' => 'telegram', 'kind' => 'results'])->assertAccepted();

    $slack = Queue::pushed(DeliverToSlack::class)->first();
    $telegram = Queue::pushed(DeliverToTelegram::class)->first();

    return [
        'slack' => json_encode($slack->message, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
        'telegram' => $telegram->html,
        'email' => (string) (new RetroResultsNotification($retro->id))->toMail($sharer)->render(),
    ];
}

/**
 * @return array{0: Retro, 1: User}
 */
function redactionRetro(bool $anonymous): array
{
    $retro = Retro::factory()->inPhase(RetroPhase::Completed)->create(['is_anonymous' => $anonymous]);
    TeamIntegration::factory()->slack()->create(['team_id' => $retro->team_id]);
    TeamIntegration::factory()->telegram()->create(['team_id' => $retro->team_id]);
    [$facilitator] = retroFacilitator($retro);

    $author = Participant::factory()->create(['retro_id' => $retro->id, 'user_id' => User::factory()->create(['name' => 'Author Zelda'])->id]);
    $voter = Participant::factory()->create(['retro_id' => $retro->id, 'user_id' => User::factory()->create(['name' => 'Voter Victor'])->id]);
    $creator = Participant::factory()->create(['retro_id' => $retro->id, 'user_id' => User::factory()->create(['name' => 'Creator Cora'])->id]);
    $guest = Participant::factory()->guest()->create(['retro_id' => $retro->id, 'guest_name' => 'Guest Gus']);
    $column = Column::factory()->create(['retro_id' => $retro->id, 'title' => 'Pains']);
    $card = Card::factory()->create([
        'retro_id' => $retro->id,
        'column_id' => $column->id,
        'participant_id' => $author->id,
        'content' => 'Deploys are slow',
    ]);
    $card->forceFill(['sentiment' => CardSentiment::Negative, 'category' => 'Deployment pain'])->save();
    Vote::factory()->create(['retro_id' => $retro->id, 'card_id' => $card->id, 'participant_id' => $voter->id]);
    CardComment::factory()->create(['retro_id' => $retro->id, 'card_id' => $card->id, 'participant_id' => $voter->id, 'content' => 'Secret comment text']);
    ActionItem::factory()->assignedTo(User::factory()->create(['name' => 'Assignee Ada']))->create([
        'retro_id' => $retro->id,
        'content' => 'Speed up deploys',
        'created_by_participant_id' => $creator->id,
    ]);
    ActionItem::factory()->assignedToGuest($guest)->create(['content' => 'Write the runbook', 'created_by_participant_id' => $creator->id]);
    RetroTheme::factory()->create(['retro_id' => $retro->id, 'name' => 'Theme Tango']);
    Survey::factory()->create(['retro_id' => $retro->id, 'question' => 'Survey question Quinn']);

    return [$retro, $facilitator];
}

it('keeps authors out of every channel on anonymous retros', function () {
    [$retro, $facilitator] = redactionRetro(anonymous: true);

    foreach (sharedRecapTexts($retro, $facilitator) as $channel => $text) {
        expect($text)
            ->toContain('Deploys are slow')
            ->toContain('Assignee Ada')
            ->toContain('Guest Gus (guest)')
            ->not->toContain('Author Zelda')
            ->not->toContain('Voter Victor')
            ->not->toContain('Creator Cora')
            ->not->toContain($facilitator->name);
    }
});

it('names participants but never card authors on named retros', function () {
    [$retro, $facilitator] = redactionRetro(anonymous: false);

    $texts = sharedRecapTexts($retro, $facilitator);

    foreach ($texts as $text) {
        expect($text)->toContain('Creator Cora')->toContain('Author Zelda');
    }

    expect($texts['slack'])->not->toMatch('/Deploys are slow[^"]*Author Zelda/')
        ->and($texts['telegram'])->not->toMatch('/Deploys are slow[^\n]*Author Zelda/');
});

it('never sends comments, surveys, themes, sentiment or health answers to the chats', function () {
    [$retro, $facilitator] = redactionRetro(anonymous: false);

    foreach (sharedRecapTexts($retro, $facilitator) as $text) {
        expect($text)
            ->not->toContain('Secret comment text')
            ->not->toContain('Survey question Quinn')
            ->not->toContain('Theme Tango')
            ->not->toContain('Deployment pain')
            ->not->toContain('negative')
            ->not->toContain('xoxp-test-token')
            ->not->toContain('hooks.slack.com')
            ->not->toContain($retro->guest_token);
    }
});
```

On a named retro, "Author Zelda" appears in the participant list (spec 6 §5.2 item 2) — the second test checks that the name is never attached to the card line.

- [ ] **Step 2: Run the suite**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Integrations/ShareRedactionTest.php`
Expected: PASS (Tasks 1–6 already implement the rules; a failure here is a leak to fix in the recap builder or a formatter, not in the test).

- [ ] **Step 3: Commit**

```bash
vendor/bin/sail bin pint --dirty --format agent
git add tests/Feature/Integrations/ShareRedactionTest.php
git commit -m "test: pin what recaps and emails never send

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SosW8d2Uj7QxsF1tws5ssS"
```

---
### Task 8: Frontend foundation (types, delivery lines, post-link section)

**Files:**
- Create: `resources/js/components/integrations/share/delivery-lines.tsx`, `resources/js/components/integrations/share/post-link-section.tsx`
- Modify: `resources/js/types/integrations.ts` **(shared)**, `resources/js/lib/integrations.ts` **(shared)**, `resources/js/lib/retro/types.ts`, `resources/js/lib/poker/types.ts` **(shared: 12c)**, `lang/{en,fr,es,de}.json`

**Interfaces:**
- Consumes: the snapshot keys of Task 3; `formatRelativeTime(iso, locale, now)` from `@/lib/action-items/format`; `useIsMounted`, `useTrans`; UI `Button`, `Checkbox`, `Label`; `toast` from `sonner`.
- Produces (Plan 13d reuses all of them for room invites):
  - types (exported from `@/types`): `ShareChannel` (`'slack' | 'telegram'`), `DeliveryChannel` (`ShareChannel | 'email'`), `DeliveryKind`, `DeliveryStatus`, `IntegrationDelivery`, `ShareAvailability` (`Record<ShareChannel, boolean>`), `RetroResultsAudience` (`'participants' | 'team'`).
  - `@/lib/integrations`: `ShareChannels: ShareChannel[]`, `deliveryChannelLabel(channel: DeliveryChannel, t: (key: string) => string): string`.
  - `<DeliveryLines deliveries={IntegrationDelivery[]} />` — muted lines "Sent to Slack · 2 minutes ago", "Sending to Telegram…", "Slack: failed — {error}", "Emailed to 4 people · …"; renders nothing for `[]`.
  - `<PostLinkSection availability guestLinkAvailable guestLinkLabel deliveries onPost hint? />` with `onPost: (channel: ShareChannel, includeGuestLink: boolean) => Promise<boolean>`; renders nothing when no channel is available; the guest-link checkbox (off by default) only when `guestLinkAvailable`.
  - Retro `Snapshot` gains `integrations: ShareAvailability & { email: boolean }` and `linkDeliveries: IntegrationDelivery[]`; `Results` gains `deliveries: IntegrationDelivery[]` and `emailRecipients: { participants: number; team: number } | null`; `PokerSnapshot` gains `share: ShareAvailability` and `deliveries: IntegrationDelivery[]`.
- Checks required: `npm run types:check && npm run check` pass; `TranslationKeysTest` passes.

- [ ] **Step 1: Add the types**

Append to `resources/js/types/integrations.ts`:

```ts
export type ShareChannel = 'slack' | 'telegram';

export type DeliveryChannel = ShareChannel | 'email';

export type DeliveryKind =
    | 'retro_link'
    | 'poker_link'
    | 'retro_results'
    | 'game_room_link';

export type DeliveryStatus = 'queued' | 'sent' | 'failed';

export type IntegrationDelivery = {
    id: string;
    channel: DeliveryChannel;
    kind: DeliveryKind;
    status: DeliveryStatus;
    error: string | null;
    sentAt: string | null;
    createdAt: string | null;
    requestedBy: string | null;
    recipientCount: number | null;
};

export type ShareAvailability = Record<ShareChannel, boolean>;

export type RetroResultsAudience = 'participants' | 'team';
```

In `resources/js/lib/retro/types.ts`, add at the top:

```ts
import type { IntegrationDelivery, ShareAvailability } from '@/types';
```

add to the `Snapshot` type, after `healthCheck: HealthCheckState | null;`:

```ts
    integrations: ShareAvailability & { email: boolean };
    linkDeliveries: IntegrationDelivery[];
```

and to the `Results` type, after `summary: ResultsSummary | null;`:

```ts
    deliveries: IntegrationDelivery[];
    emailRecipients: { participants: number; team: number } | null;
```

In `resources/js/lib/poker/types.ts`, add at the top:

```ts
import type { IntegrationDelivery, ShareAvailability } from '@/types';
```

and to `PokerSnapshot`, after `links: { team: string | null };`:

```ts
    share: ShareAvailability;
    deliveries: IntegrationDelivery[];
```

- [ ] **Step 2: Add the channel helpers**

Append to `resources/js/lib/integrations.ts` (add the import at the top):

```ts
import type { DeliveryChannel, ShareChannel } from '@/types';

export const ShareChannels: ShareChannel[] = ['slack', 'telegram'];

export function deliveryChannelLabel(
    channel: DeliveryChannel,
    t: (key: string) => string,
): string {
    switch (channel) {
        case 'slack':
            return 'Slack';
        case 'telegram':
            return 'Telegram';
        case 'email':
            return t('Email');
    }
}
```

- [ ] **Step 3: Create the delivery lines**

Create `resources/js/components/integrations/share/delivery-lines.tsx`:

```tsx
import { usePage } from '@inertiajs/react';
import { useIsMounted } from '@/hooks/use-is-mounted';
import { useTrans } from '@/hooks/use-trans';
import { formatRelativeTime } from '@/lib/action-items/format';
import { deliveryChannelLabel } from '@/lib/integrations';
import type { IntegrationDelivery } from '@/types';

type Props = {
    deliveries: IntegrationDelivery[];
};

export function DeliveryLines({ deliveries }: Props) {
    const { t } = useTrans();
    const { locale } = usePage().props;
    const isMounted = useIsMounted();

    if (deliveries.length === 0) {
        return null;
    }

    const describe = (delivery: IntegrationDelivery): string => {
        const channel = deliveryChannelLabel(delivery.channel, t);

        if (delivery.status === 'queued') {
            return t('Sending to :channel…', { channel });
        }

        if (delivery.status === 'failed') {
            return t(':channel: failed — :error', {
                channel,
                error:
                    delivery.error ??
                    t('Something went wrong. Please try again.'),
            });
        }

        const at = delivery.sentAt ?? delivery.createdAt;
        const time =
            isMounted && at ? formatRelativeTime(at, locale, Date.now()) : '';

        if (delivery.channel === 'email') {
            return t('Emailed to :count people · :time', {
                count: delivery.recipientCount ?? 0,
                time,
            });
        }

        return t('Sent to :channel · :time', { channel, time });
    };

    return (
        <ul
            className="space-y-0.5 text-xs text-muted-foreground"
            aria-live="polite"
        >
            {deliveries.map((delivery) => (
                <li
                    key={delivery.id}
                    className={
                        delivery.status === 'failed'
                            ? 'text-destructive'
                            : undefined
                    }
                >
                    {describe(delivery)}
                </li>
            ))}
        </ul>
    );
}
```

- [ ] **Step 4: Create the post-link section**

Create `resources/js/components/integrations/share/post-link-section.tsx`:

```tsx
import { useId, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { useTrans } from '@/hooks/use-trans';
import { ShareChannels } from '@/lib/integrations';
import type {
    IntegrationDelivery,
    ShareAvailability,
    ShareChannel,
} from '@/types';
import { DeliveryLines } from './delivery-lines';

type Props = {
    availability: ShareAvailability;
    guestLinkAvailable: boolean;
    guestLinkLabel: string;
    deliveries: IntegrationDelivery[];
    onPost: (
        channel: ShareChannel,
        includeGuestLink: boolean,
    ) => Promise<boolean>;
    hint?: string;
};

export function PostLinkSection({
    availability,
    guestLinkAvailable,
    guestLinkLabel,
    deliveries,
    onPost,
    hint,
}: Props) {
    const { t } = useTrans();
    const checkboxId = useId();
    const [includeGuestLink, setIncludeGuestLink] = useState(false);
    const [busy, setBusy] = useState<ShareChannel | null>(null);
    const channels = ShareChannels.filter((channel) => availability[channel]);

    if (channels.length === 0) {
        return null;
    }

    const post = async (channel: ShareChannel) => {
        setBusy(channel);

        const posted = await onPost(
            channel,
            guestLinkAvailable && includeGuestLink,
        );

        setBusy(null);

        if (posted) {
            toast(t('The message is on its way.'));
        }
    };

    return (
        <section className="space-y-3 border-t pt-4">
            <h3 className="text-sm font-medium">{t('Post a link')}</h3>
            {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
            {guestLinkAvailable && (
                <div className="flex items-center gap-2">
                    <Checkbox
                        id={checkboxId}
                        checked={includeGuestLink}
                        onCheckedChange={(checked) =>
                            setIncludeGuestLink(checked === true)
                        }
                    />
                    <Label htmlFor={checkboxId}>{guestLinkLabel}</Label>
                </div>
            )}
            <div className="flex flex-wrap gap-2">
                {channels.map((channel) => (
                    <Button
                        key={channel}
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={busy !== null}
                        onClick={() => void post(channel)}
                    >
                        {channel === 'slack'
                            ? t('Post link to Slack')
                            : t('Post link to Telegram')}
                    </Button>
                ))}
            </div>
            <DeliveryLines deliveries={deliveries} />
        </section>
    );
}
```

- [ ] **Step 5: Add the translations**

| Key (en) | fr | es | de |
|---|---|---|---|
| `Sending to :channel…` | `Envoi vers :channel…` | `Enviando a :channel…` | `Wird an :channel gesendet…` |
| `:channel: failed — :error` | `:channel : échec — :error` | `:channel: error — :error` | `:channel: fehlgeschlagen — :error` |
| `Sent to :channel · :time` | `Envoyé sur :channel · :time` | `Enviado a :channel · :time` | `An :channel gesendet · :time` |
| `Emailed to :count people · :time` | `Envoyé par e-mail à :count personnes · :time` | `Enviado por correo a :count personas · :time` | `Per E-Mail an :count Personen gesendet · :time` |
| `Post a link` | `Publier un lien` | `Publicar un enlace` | `Link posten` |
| `Post link to Slack` | `Publier le lien sur Slack` | `Publicar el enlace en Slack` | `Link in Slack posten` |
| `Post link to Telegram` | `Publier le lien sur Telegram` | `Publicar el enlace en Telegram` | `Link in Telegram posten` |
| `The message is on its way.` | `Le message est en route.` | `El mensaje está en camino.` | `Die Nachricht ist unterwegs.` |

(`Email` and `Something went wrong. Please try again.` already exist.)

- [ ] **Step 6: Check and commit**

Run: `vendor/bin/sail artisan wayfinder:generate --with-form && npm run types:check && npm run check`
Expected: no new error. The snapshot types now match the server payload of Task 3.

Run: `vendor/bin/sail artisan test --compact tests/Feature/TranslationKeysTest.php`
Expected: PASS.

```bash
npx vp check --fix resources/js/types/integrations.ts resources/js/lib/integrations.ts resources/js/lib/retro/types.ts resources/js/lib/poker/types.ts resources/js/components/integrations/share
git add resources/js/types/integrations.ts resources/js/lib/integrations.ts resources/js/lib/retro/types.ts resources/js/lib/poker/types.ts resources/js/components/integrations/share lang
git commit -m "feat: add delivery lines and the post-link section

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SosW8d2Uj7QxsF1tws5ssS"
```

---
### Task 9: Retro UI (board share, Results share menu, recap and email dialogs)

**Files:**
- Create: `resources/js/components/retro/board-post-link.tsx`, `resources/js/components/retro/share-board-button.tsx`, `resources/js/components/retro/results/{results-share-menu,recap-share-dialog,email-results-dialog}.tsx`
- Modify: `resources/js/components/retro/guest-link-dialog.tsx`, `resources/js/components/retro/board.tsx`, `resources/js/components/retro/results/results-view.tsx`, `lang/{en,fr,es,de}.json`

**Interfaces:**
- Consumes: Task 8 `PostLinkSection`, `DeliveryLines`, types; Wayfinder `@/actions/App/Http/Controllers/Integrations/RetroSharesController` (`store`) and `RetroResultsEmailsController` (`store`); `useBoard()` (`board`, `run`, `refetch`, `sessionExpired`); UI `Dialog*`, `DropdownMenu*`, `Button`; lucide `Share2`.
- Produces: `BoardPostLink` (post-link section bound to the board), `ShareBoardButton` (header button for every sharer before `Completed`), `ResultsShareMenu`, `RecapShareDialog`, `EmailResultsDialog`.
- Checks required: types and lint pass; walkthrough steps 1–4 of Task 11.

- [ ] **Step 1: Create the board post-link section and the header button**

Create `resources/js/components/retro/board-post-link.tsx`:

```tsx
import RetroSharesController from '@/actions/App/Http/Controllers/Integrations/RetroSharesController';
import { PostLinkSection } from '@/components/integrations/share/post-link-section';
import { useTrans } from '@/hooks/use-trans';
import { retroRequest } from '@/lib/retro/api';
import type { IntegrationDelivery, ShareChannel } from '@/types';
import { useBoard } from './board-context';

export function BoardPostLink() {
    const ctx = useBoard();
    const { t } = useTrans();
    const { retro, integrations, linkDeliveries } = ctx.board;

    if (retro.phase === 'completed') {
        return null;
    }

    const post = async (
        channel: ShareChannel,
        includeGuestLink: boolean,
    ): Promise<boolean> => {
        const delivery = await ctx.run(
            retroRequest<IntegrationDelivery>(
                RetroSharesController.store(retro.id),
                {
                    channel,
                    kind: 'link',
                    include_guest_link: includeGuestLink,
                },
            ),
        );

        if (delivery === undefined) {
            return false;
        }

        await ctx.refetch();

        return true;
    };

    return (
        <PostLinkSection
            availability={integrations}
            guestLinkAvailable={retro.guestAccessEnabled}
            guestLinkLabel={t(
                'Include the guest link (anyone in the channel can join)',
            )}
            deliveries={linkDeliveries}
            onPost={post}
        />
    );
}
```

Create `resources/js/components/retro/share-board-button.tsx`:

```tsx
import { Share2 } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { useTrans } from '@/hooks/use-trans';
import { useBoard } from './board-context';
import { BoardPostLink } from './board-post-link';

export function ShareBoardButton() {
    const { board, sessionExpired } = useBoard();
    const { t } = useTrans();
    const [open, setOpen] = useState(false);
    const { integrations, retro } = board;

    if (
        retro.phase === 'completed' ||
        (!integrations.slack && !integrations.telegram)
    ) {
        return null;
    }

    return (
        <>
            <Button
                size="sm"
                variant="outline"
                disabled={sessionExpired}
                onClick={() => setOpen(true)}
            >
                <Share2 className="size-4" />
                {t('Share')}
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent aria-describedby={undefined}>
                    <DialogTitle>{t('Share the board')}</DialogTitle>
                    <BoardPostLink />
                </DialogContent>
            </Dialog>
        </>
    );
}
```

In `resources/js/components/retro/guest-link-dialog.tsx`, import `{ BoardPostLink } from './board-post-link'` and render `<BoardPostLink />` as the last child of `<DialogContent>` (after the guest-link block), so the facilitator can post the link, with or without the guest URL, from the dialog that manages it.

In `resources/js/components/retro/board.tsx`, import `{ ShareBoardButton } from './share-board-button'` and add `<ShareBoardButton />` inside the `actions` fragment passed to `BoardHeader`, after `<SuggestGroupNamesButton />`.

- [ ] **Step 2: Create the recap dialog**

Create `resources/js/components/retro/results/recap-share-dialog.tsx`:

```tsx
import { useState } from 'react';
import { toast } from 'sonner';
import RetroSharesController from '@/actions/App/Http/Controllers/Integrations/RetroSharesController';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogTitle,
} from '@/components/ui/dialog';
import { useTrans } from '@/hooks/use-trans';
import { retroRequest } from '@/lib/retro/api';
import type { IntegrationDelivery, ShareChannel } from '@/types';
import { useBoard } from '../board-context';

type Props = {
    channel: ShareChannel | null;
    onClose: () => void;
};

export function RecapShareDialog({ channel, onClose }: Props) {
    const ctx = useBoard();
    const { t } = useTrans();
    const [busy, setBusy] = useState(false);
    const { retro, results } = ctx.board;
    const summaryStatus = results?.summary?.status ?? null;

    const send = async () => {
        if (channel === null) {
            return;
        }

        setBusy(true);

        const delivery = await ctx.run(
            retroRequest<IntegrationDelivery>(
                RetroSharesController.store(retro.id),
                { channel, kind: 'results' },
            ),
        );

        setBusy(false);

        if (delivery === undefined) {
            return;
        }

        toast(t('The message is on its way.'));
        onClose();
        await ctx.refetch();
    };

    return (
        <Dialog
            open={channel !== null}
            onOpenChange={(open) => {
                if (!open) {
                    onClose();
                }
            }}
        >
            <DialogContent>
                <DialogTitle>
                    {channel === 'telegram'
                        ? t('Share the results to Telegram')
                        : t('Share the results to Slack')}
                </DialogTitle>
                <DialogDescription>{t('The recap includes:')}</DialogDescription>
                <ul className="list-disc space-y-1 pl-5 text-sm">
                    <li>{t('Title, date and participants')}</li>
                    <li>{t('Number of cards and ROTI average')}</li>
                    {summaryStatus === 'ready' && <li>{t('The summary')}</li>}
                    <li>{t('Action items with their assignees')}</li>
                    <li>{t('Pending suggested actions')}</li>
                    <li>{t('The top card of each column')}</li>
                </ul>
                {summaryStatus === 'pending' && (
                    <p className="text-sm text-amber-700 dark:text-amber-400">
                        {t(
                            'The summary is still being generated and will not be included.',
                        )}
                    </p>
                )}
                {retro.isAnonymous && (
                    <p className="text-sm">
                        {t(
                            'Participants are shown as a count. Action items are shown with names.',
                        )}
                    </p>
                )}
                <p className="text-xs text-muted-foreground">
                    {t('Card authors, votes and comments are never shared.')}
                </p>
                <DialogFooter className="gap-2">
                    <Button type="button" variant="secondary" onClick={onClose}>
                        {t('Cancel')}
                    </Button>
                    <Button disabled={busy} onClick={() => void send()}>
                        {t('Send')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
```

- [ ] **Step 3: Create the email dialog**

Create `resources/js/components/retro/results/email-results-dialog.tsx`:

```tsx
import { useState } from 'react';
import { toast } from 'sonner';
import RetroResultsEmailsController from '@/actions/App/Http/Controllers/Integrations/RetroResultsEmailsController';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogTitle,
} from '@/components/ui/dialog';
import { useTrans } from '@/hooks/use-trans';
import { retroRequest } from '@/lib/retro/api';
import type { IntegrationDelivery, RetroResultsAudience } from '@/types';
import { useBoard } from '../board-context';

type Props = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
};

export function EmailResultsDialog({ open, onOpenChange }: Props) {
    const ctx = useBoard();
    const { t } = useTrans();
    const [audience, setAudience] =
        useState<RetroResultsAudience>('participants');
    const [busy, setBusy] = useState(false);
    const counts = ctx.board.results?.emailRecipients ?? {
        participants: 0,
        team: 0,
    };
    const options: Array<{ value: RetroResultsAudience; label: string }> = [
        {
            value: 'participants',
            label: t('Participants with an account (:count)', {
                count: counts.participants,
            }),
        },
        {
            value: 'team',
            label: t('All team members (:count)', { count: counts.team }),
        },
    ];

    const send = async () => {
        setBusy(true);

        const delivery = await ctx.run(
            retroRequest<IntegrationDelivery>(
                RetroResultsEmailsController.store(ctx.board.retro.id),
                { audience },
            ),
        );

        setBusy(false);

        if (delivery === undefined) {
            return;
        }

        toast(t('The results are on their way.'));
        onOpenChange(false);
        await ctx.refetch();
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent aria-describedby={undefined}>
                <DialogTitle>{t('Email the results')}</DialogTitle>
                <fieldset className="space-y-2">
                    <legend className="sr-only">{t('Recipients')}</legend>
                    {options.map((option) => (
                        <label
                            key={option.value}
                            className="flex items-center gap-2 text-sm"
                        >
                            <input
                                type="radio"
                                name="results-audience"
                                value={option.value}
                                checked={audience === option.value}
                                onChange={() => setAudience(option.value)}
                                className="size-4 accent-primary"
                            />
                            {option.label}
                        </label>
                    ))}
                </fieldset>
                <p className="text-xs text-muted-foreground">
                    {t('Guests have no account and are never emailed.')}
                </p>
                <DialogFooter className="gap-2">
                    <Button
                        type="button"
                        variant="secondary"
                        onClick={() => onOpenChange(false)}
                    >
                        {t('Cancel')}
                    </Button>
                    <Button
                        disabled={busy || counts[audience] === 0}
                        onClick={() => void send()}
                    >
                        {t('Send')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
```

- [ ] **Step 4: Create the share menu and mount it in the Results view**

Create `resources/js/components/retro/results/results-share-menu.tsx`:

```tsx
import { Share2 } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useTrans } from '@/hooks/use-trans';
import type { ShareChannel } from '@/types';
import { useBoard } from '../board-context';
import { EmailResultsDialog } from './email-results-dialog';
import { RecapShareDialog } from './recap-share-dialog';

type OpenDialog = { kind: 'recap'; channel: ShareChannel } | { kind: 'email' };

export function ResultsShareMenu() {
    const { board, sessionExpired } = useBoard();
    const { t } = useTrans();
    const [open, setOpen] = useState<OpenDialog | null>(null);
    const { integrations } = board;

    if (!integrations.slack && !integrations.telegram && !integrations.email) {
        return null;
    }

    return (
        <>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button size="sm" variant="outline" disabled={sessionExpired}>
                        <Share2 className="size-4" />
                        {t('Share')}
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    {integrations.email && (
                        <DropdownMenuItem
                            onSelect={() => setOpen({ kind: 'email' })}
                        >
                            {t('Send to email')}
                        </DropdownMenuItem>
                    )}
                    {integrations.slack && (
                        <DropdownMenuItem
                            onSelect={() =>
                                setOpen({ kind: 'recap', channel: 'slack' })
                            }
                        >
                            {t('Share to Slack')}
                        </DropdownMenuItem>
                    )}
                    {integrations.telegram && (
                        <DropdownMenuItem
                            onSelect={() =>
                                setOpen({ kind: 'recap', channel: 'telegram' })
                            }
                        >
                            {t('Share to Telegram')}
                        </DropdownMenuItem>
                    )}
                </DropdownMenuContent>
            </DropdownMenu>
            <RecapShareDialog
                channel={open?.kind === 'recap' ? open.channel : null}
                onClose={() => setOpen(null)}
            />
            <EmailResultsDialog
                open={open?.kind === 'email'}
                onOpenChange={(isOpen) => {
                    if (!isOpen) {
                        setOpen(null);
                    }
                }}
            />
        </>
    );
}
```

In `resources/js/components/retro/results/results-view.tsx`, import `{ DeliveryLines } from '@/components/integrations/share/delivery-lines'` and `{ ResultsShareMenu } from './results-share-menu'`, and replace the `completedAt` paragraph block with:

```tsx
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                    {completedAt && (
                        <p className="text-sm text-muted-foreground">
                            {t('Retrospective completed on :date', {
                                date: completedAt,
                            })}
                        </p>
                    )}
                    <DeliveryLines deliveries={results.deliveries} />
                </div>
                <ResultsShareMenu />
            </div>
```

- [ ] **Step 5: Add the translations**

| Key (en) | fr | es | de |
|---|---|---|---|
| `Include the guest link (anyone in the channel can join)` | `Inclure le lien invité (toute personne du canal peut rejoindre)` | `Incluir el enlace de invitado (cualquiera en el canal puede unirse)` | `Gastlink mitsenden (alle im Kanal können beitreten)` |
| `Share` | `Partager` | `Compartir` | `Teilen` |
| `Share the board` | `Partager le tableau` | `Compartir el tablero` | `Board teilen` |
| `Send to email` | `Envoyer par e-mail` | `Enviar por correo` | `Per E-Mail senden` |
| `Share to Slack` | `Partager sur Slack` | `Compartir en Slack` | `In Slack teilen` |
| `Share to Telegram` | `Partager sur Telegram` | `Compartir en Telegram` | `In Telegram teilen` |
| `Share the results to Slack` | `Partager les résultats sur Slack` | `Compartir los resultados en Slack` | `Ergebnisse in Slack teilen` |
| `Share the results to Telegram` | `Partager les résultats sur Telegram` | `Compartir los resultados en Telegram` | `Ergebnisse in Telegram teilen` |
| `The recap includes:` | `Le récapitulatif contient :` | `El resumen incluye:` | `Die Zusammenfassung enthält:` |
| `Title, date and participants` | `Titre, date et participants` | `Título, fecha y participantes` | `Titel, Datum und Teilnehmende` |
| `Number of cards and ROTI average` | `Nombre de cartes et moyenne ROTI` | `Número de tarjetas y media ROTI` | `Anzahl der Karten und ROTI-Durchschnitt` |
| `The summary` | `Le résumé` | `El resumen` | `Die Zusammenfassung` |
| `Action items with their assignees` | `Les actions à mener et leurs responsables` | `Las acciones a realizar y sus responsables` | `Aktionspunkte mit ihren Verantwortlichen` |
| `Pending suggested actions` | `Les actions suggérées en attente` | `Las acciones sugeridas pendientes` | `Offene vorgeschlagene Aktionspunkte` |
| `The top card of each column` | `La carte la plus votée de chaque colonne` | `La tarjeta más votada de cada columna` | `Die meistgewählte Karte jeder Spalte` |
| `The summary is still being generated and will not be included.` | `Le résumé est encore en cours de génération et ne sera pas inclus.` | `El resumen aún se está generando y no se incluirá.` | `Die Zusammenfassung wird noch erstellt und ist nicht enthalten.` |
| `Participants are shown as a count. Action items are shown with names.` | `Les participants sont indiqués par leur nombre. Les actions à mener sont nominatives.` | `Los participantes se muestran como un número. Las acciones a realizar se muestran con nombres.` | `Teilnehmende werden als Anzahl angezeigt. Aktionspunkte werden mit Namen angezeigt.` |
| `Card authors, votes and comments are never shared.` | `Les auteurs des cartes, les votes et les commentaires ne sont jamais partagés.` | `Los autores de las tarjetas, los votos y los comentarios nunca se comparten.` | `Kartenautoren, Stimmen und Kommentare werden nie geteilt.` |
| `Email the results` | `Envoyer les résultats par e-mail` | `Enviar los resultados por correo` | `Ergebnisse per E-Mail senden` |
| `Recipients` | `Destinataires` | `Destinatarios` | `Empfänger` |
| `Participants with an account (:count)` | `Participants avec un compte (:count)` | `Participantes con cuenta (:count)` | `Teilnehmende mit Konto (:count)` |
| `All team members (:count)` | `Tous les membres de l'équipe (:count)` | `Todos los miembros del equipo (:count)` | `Alle Teammitglieder (:count)` |
| `Guests have no account and are never emailed.` | `Les invités n'ont pas de compte et ne reçoivent jamais d'e-mail.` | `Los invitados no tienen cuenta y nunca reciben correos.` | `Gäste haben kein Konto und erhalten nie E-Mails.` |
| `The results are on their way.` | `Les résultats sont en route.` | `Los resultados están en camino.` | `Die Ergebnisse sind unterwegs.` |

- [ ] **Step 6: Check and commit**

Run: `vendor/bin/sail artisan wayfinder:generate --with-form && npm run types:check && npm run check`
Expected: no new error.

Run: `vendor/bin/sail artisan test --compact tests/Feature/TranslationKeysTest.php`
Expected: PASS.

```bash
npx vp check --fix resources/js/components/retro/board-post-link.tsx resources/js/components/retro/share-board-button.tsx resources/js/components/retro/guest-link-dialog.tsx resources/js/components/retro/board.tsx resources/js/components/retro/results
git add resources/js/components/retro/board-post-link.tsx resources/js/components/retro/share-board-button.tsx resources/js/components/retro/guest-link-dialog.tsx resources/js/components/retro/board.tsx resources/js/components/retro/results lang
git commit -m "feat: share retro links and results from the board

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SosW8d2Uj7QxsF1tws5ssS"
```

---
### Task 10: Poker share dialog

**Files:**
- Create: `resources/js/components/poker/game-share-dialog.tsx`
- Modify: `resources/js/components/poker/game-menu.tsx`, `lang/{en,fr,es,de}.json`

**Interfaces:**
- Consumes: Task 8 `PostLinkSection`, types; Wayfinder `@/actions/App/Http/Controllers/Integrations/PokerSharesController` (`store`); `useGame()` (`snapshot.{game, share, deliveries}`, `run`, `refetch`).
- Produces: `GameShareDialog` (props `open`, `onOpenChange`); a "Share…" item in `GameMenu` for viewers whose `share` has a channel.
- Checks required: types and lint pass; walkthrough step 5 of Task 11.

- [ ] **Step 1: Create the dialog**

Create `resources/js/components/poker/game-share-dialog.tsx`:

```tsx
import PokerSharesController from '@/actions/App/Http/Controllers/Integrations/PokerSharesController';
import { PostLinkSection } from '@/components/integrations/share/post-link-section';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { useTrans } from '@/hooks/use-trans';
import { retroRequest } from '@/lib/retro/api';
import type { IntegrationDelivery, ShareChannel } from '@/types';
import { useGame } from './game-context';

type Props = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
};

export function GameShareDialog({ open, onOpenChange }: Props) {
    const ctx = useGame();
    const { t } = useTrans();
    const { game, share, deliveries } = ctx.snapshot;

    const post = async (
        channel: ShareChannel,
        includeGuestLink: boolean,
    ): Promise<boolean> => {
        const delivery = await ctx.run(
            retroRequest<IntegrationDelivery>(
                PokerSharesController.store(game.id),
                { channel, include_guest_link: includeGuestLink },
            ),
        );

        if (delivery === undefined) {
            return false;
        }

        await ctx.refetch();

        return true;
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent aria-describedby={undefined}>
                <DialogTitle>{t('Share the game')}</DialogTitle>
                <PostLinkSection
                    availability={share}
                    guestLinkAvailable={game.guestAccessEnabled}
                    guestLinkLabel={t(
                        'Include the guest link (anyone in the channel can join)',
                    )}
                    deliveries={deliveries}
                    onPost={post}
                />
            </DialogContent>
        </Dialog>
    );
}
```

- [ ] **Step 2: Add the menu item**

In `resources/js/components/poker/game-menu.tsx`:

1. import `{ GameShareDialog } from './game-share-dialog'`;
2. extend the dialog union: `type OpenDialog = 'settings' | 'guests' | 'transfer' | 'end' | 'delete' | 'share' | null;`;
3. read `share` with the rest: `const { game, me, share } = ctx.snapshot;` and add `const canShare = share.slack || share.telegram;` below `isEnded`;
4. make the item the first child of `<DropdownMenuContent align="end">`:

```tsx
                    {canShare && (
                        <>
                            <DropdownMenuItem
                                onSelect={() => setChosen('share')}
                            >
                                {t('Share…')}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                        </>
                    )}
```

5. render the dialog next to the others:

```tsx
            <GameShareDialog open={open === 'share'} onOpenChange={close} />
```

`share` is already false for guests, other players and ended games (Task 3), and the menu itself only renders for the facilitator or a viewer who can delete the game (workspace Owners/Admins), who are exactly the sharers.

- [ ] **Step 3: Add the translations**

| Key (en) | fr | es | de |
|---|---|---|---|
| `Share…` | `Partager…` | `Compartir…` | `Teilen…` |
| `Share the game` | `Partager la partie` | `Compartir la partida` | `Spiel teilen` |

- [ ] **Step 4: Check and commit**

Run: `npm run types:check && npm run check`
Expected: no new error.

Run: `vendor/bin/sail artisan test --compact tests/Feature/TranslationKeysTest.php`
Expected: PASS.

```bash
npx vp check --fix resources/js/components/poker/game-share-dialog.tsx resources/js/components/poker/game-menu.tsx
git add resources/js/components/poker/game-share-dialog.tsx resources/js/components/poker/game-menu.tsx lang
git commit -m "feat: share planning poker links from the game menu

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SosW8d2Uj7QxsF1tws5ssS"
```

---

### Task 11: Verification

**Files:** none (fix only what the checks reveal, in the task that owns the code).

- [ ] **Step 1: Run the plan's suites**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Integrations tests/Feature/Retros/BoardSnapshotTest.php tests/Feature/Retros/ResultsTest.php tests/Feature/Poker/PokerSnapshotTest.php tests/Feature/TranslationKeysTest.php tests/Feature/UuidPrimaryKeysTest.php`
Expected: PASS.

- [ ] **Step 2: Static checks**

```bash
vendor/bin/sail bin pint --dirty --format agent
vendor/bin/sail bin phpstan analyse --no-progress
vendor/bin/sail artisan wayfinder:generate --with-form
npm run types:check && npm run check && npm run build
```

Expected: pint clean, phpstan 0 errors, no new type or lint error, build succeeds.

- [ ] **Step 3: Check the no-integration path**

Run: `vendor/bin/sail artisan test --compact --filter="answers 404"` (the provider-disabled and mailer-disabled cases) and confirm in the running app with every integration variable unset that the board header has no "Share" button, the Results view has no share menu and the poker game menu has no "Share…" item.

- [ ] **Step 4: Ask for the full suite**

Ask the user to run `vendor/bin/sail artisan test --compact` (the full suite) and report the result.

- [ ] **Step 5: Manual walkthrough** (real Slack workspace and Telegram group connected through Plan 12a; a queue worker running: `vendor/bin/sail artisan queue:work`; a delivering mailer, e.g. Mailpit)

1. As the facilitator of a retro in Discussing, open "Share" in the board header: post the link to Slack and to Telegram, once with "Include the guest link" (only offered when guest access is on). Both chats show the invitation with a button; the guest link opens the join page; the dialog shows "Sent to Slack · …".
2. Post a link whose retro title is `<!channel> & <b>test</b>`: Slack shows the text literally and pings nobody; Telegram shows the tags as text.
3. Complete an anonymous retro with cards, votes, action items (one assigned to a guest), ROTI and a summary still generating: "Share" → "Share to Slack" says the summary will not be included and that participants are shown as a count; the Slack and Telegram recaps show counts, action items with "(guest)", no author name.
4. "Send to email" → "Participants with an account": each participant receives the mail in their own language, guests receive nothing; a second send within ten minutes shows "The results were emailed a few minutes ago."
5. As the poker facilitator, "Share…" posts the game link; after "End game" the item disappears.
6. Archive the Slack channel (or revoke the app) and post again: the delivery line turns to "Slack: failed — Reconnect Slack in the team settings." and the integrations page shows "Reconnect required".

- [ ] **Step 6: Report**

Summarize the results (tests, static checks, walkthrough) to the user; do not claim a step passed without its output.

---

## Contract for Plan 13d

Plan 13d (game room invites, spec 7 §3.1) posts a standalone room's link through this plan's path. It relies on exactly these names:

**Delivery subject**
- Implement `App\Contracts\DeliverySubject` on `App\Models\GameRoom`: `deliveryTeam(): Team` (the room's team) and `announceDeliveryChange(): void` (broadcast `game.room.changed` on `presence-game.{roomId}` through the room's `GameBroadcastEvent` subclass and `sendToOthers()`). `DeliverToChannel` calls it after success and after failure; nothing in the jobs changes.
- Add the `deleting` hook on `GameRoom` that deletes `IntegrationDelivery::query()->whereMorphedTo('subject', $room)`, as `Retro` and `PokerGame` do (Plan 12a Task 3).
- The kind already exists: `IntegrationDeliveryKind::GameRoomLink` (`game_room_link`).

**Server**
- `App\Actions\Integrations\QueueShare::requireIntegration(Team $team, IntegrationProvider $provider): TeamIntegration` — throws `NotConnected` or `ReconnectRequired` (both `IntegrationException`, rendered as 409). Call it before building the message and let both propagate: rooms answer the same 409 "Connect :provider in the team settings." / "Reconnect :provider in the team settings." as the retro and poker shares (spec 6 §5.1 game room bullet, spec 7 §3.1). Do not catch or remap them.
- `QueueShare::handle(Model&DeliverySubject $subject, IntegrationDeliveryChannel $channel, IntegrationDeliveryKind $kind, User $requester, ShareContent $content): IntegrationDelivery` — creates the `queued` row (team from `deliveryTeam()`), dispatches `DeliverToSlack` / `DeliverToTelegram` after commit with the message pre-built in the current (sharer's) locale.
- `App\Support\Integrations\Messages\LinkShareContent(string $text, string $buttonLabel, string $url)` — plain, unescaped text; escaping is done per channel. Add `BuildLinkShare::gameRoom(GameRoom $room, User $sharer, bool $includeGuestLink): LinkShareContent` next to `retro()` and `pokerGame()` with the text `__(':sharer invites you to play :game in ":room" (:team)', …)` and the button `__('Join the game')`.
- `IntegrationDeliveryChannel::shareChannels()` / `provider()`; validation rule used by both controllers: `Rule::enum(IntegrationDeliveryChannel::class)->only(IntegrationDeliveryChannel::shareChannels())`, then `abort_unless($channel->provider()?->isEnabled() ?? false, 404)`; authorize first (403 for guests and non-managers), then validate; routes carry `->middleware('throttle:5,1,shares')` (own `shares` prefix, so the counter is per user and not shared with other throttled routes).
- `App\Actions\Integrations\ShareOptions::channels(Team): array{slack: bool, telegram: bool}` (enabled provider and `Active` integration) — combine it with the room-manager rule for the room snapshot's `share` booleans.
- `App\Actions\Integrations\LatestDeliveries::handle(Model $subject, array<int, IntegrationDeliveryKind> $kinds): array` and `PresentIntegrationDelivery::handle(IntegrationDelivery): array{id, channel, kind, status, error, sentAt, createdAt, requestedBy, recipientCount}` (phpstan type `Delivery`) — the room snapshot's `deliveries` is `LatestDeliveries::handle($room, [IntegrationDeliveryKind::GameRoomLink])` for managers, else `[]`; the share endpoint answers `202` with the presented delivery (`$delivery->load('requestedBy')`).

**Frontend**
- Types from `@/types`: `ShareChannel`, `ShareAvailability`, `IntegrationDelivery`.
- `<PostLinkSection availability guestLinkAvailable guestLinkLabel deliveries onPost hint? />` from `@/components/integrations/share/post-link-section` (pass `guestLinkAvailable={room.access === 'link'}`, the label "Include the guest link (anyone in the channel can join)" (spec §5.1; the existing translation key) and, for `team` rooms, `hint={t('Only members of :team can join.', …)}`); `<DeliveryLines deliveries />` from `@/components/integrations/share/delivery-lines`.

**Tests**
- Pest helpers `enableIntegrations()`, `disableIntegrations()` (Plan 12a); `Queue::fake()` and inspect `DeliverToSlack::$message` / `DeliverToTelegram::$html`; `runDeliveryJob()` is local to `DeliveryJobsTest.php` — copy its three lines into the room test file under a new name if the job must run.
