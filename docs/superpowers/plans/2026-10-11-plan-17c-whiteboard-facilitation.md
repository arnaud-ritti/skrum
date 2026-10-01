# Whiteboard Facilitation (Plan 17c) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A facilitator runs a session on a whiteboard: a shared countdown, a board lock, "bring everyone to me", a hand-over of the role, and a dot vote on sticky notes in which nobody, the facilitator included, sees anyone else's votes before the close.

**Architecture:** Every rule is on the server. The board row gains three columns (`locked`, `follow_enabled`, `timer_ends_at`); a vote is a `whiteboard_vote_sessions` row whose scope (`element_ids`) is fixed at opening, plus one `whiteboard_votes` row per member and note, deleted at close when only totals remain. All voting state leaves the server through one presenter, `PresentWhiteboardVoting`, which takes the viewer. The element write path (`WriteWhiteboardElements`) learns three things under the board lock it already holds: refuse non-facilitators on a locked board, refuse a change of the words of a note under vote, refund the votes of a note that is deleted. The client reflects this state: view mode, a status row, an overlay of vote controls positioned from scene coordinates, a results panel, and a `viewport` whisper for follow-me.

**Tech Stack:** Laravel 13, PHP 8.4, PostgreSQL, Pest 5, Reverb, Inertia 3 + React 19 (React Compiler on), Wayfinder, `@excalidraw/excalidraw` 0.18.1 (only through `resources/js/lib/whiteboard/excalidraw.ts`).

**Spec:** `docs/superpowers/specs/2026-10-01-whiteboard-design.md` — this plan covers R7 and R8: §11.1–§11.4, the facilitation columns and the two vote tables of §7, the `settings` keys `locked` / `follow_enabled`, the `timer` and `vote-sessions` rows and the events `timer.changed` / `vote.changed` and the whisper `viewport` of §12, the facilitator bar, status row, overlay and results panel of §13, and "Facilitation (R7–R8)" of §16. Read it, its section "Decisions made while planning 17c", and `.superpowers/sdd/whiteboard-rules.md` before starting.

**Not in this plan:** private writing and version history (17d). The hook points 17d needs are named in Task 4 ("Hooks for plan 17d") and not built.

**How this plan was checked — read this.** It was written in a worktree without `vendor/` or `node_modules/`: **nothing in it was run.** Every name it relies on was read in the repository at commit `e0524df` or in the library's files, and the file is cited next to the claim. Test code is complete; implementation is given as signatures, algorithm and the snippets that are not obvious. A test that fails for a reason other than the missing feature is a defect of this plan: fix the smallest thing that makes the specified behaviour true and report it. Where plan and spec disagree, the spec wins.

## Global Constraints

- No new dependency, PHP or JS. No JavaScript test runner: client logic stays thin, rules live on the server where a feature test pins them.
- Every primary and foreign key is a UUID (`tests/Feature/UuidPrimaryKeysTest.php`). Migrations have `up` only.
- Request bodies are snake_case (`votes_per_member`, `frame_element_id`, `allow_multiple`, `follow_enabled`); responses and snapshot keys camelCase; Excalidraw elements keep their own camelCase.
- Route names are camelCase segments (`whiteboards.voteSessions.votes.update`), URLs kebab-case (`vote-sessions`), controllers plural with CRUD method names, one controller per non-CRUD action.
- Every mutation: resolve member → guard → transaction with `lockForUpdate` on the board row → re-check inside the lock → broadcast after commit (`sendToOthers()`, or `sendToAll()` where this plan says so).
- Every UI string goes through `__()` / `t()` with its key in `lang/en.json`, `fr.json`, `de.json`, `es.json` (`tests/Feature/TranslationKeysTest.php`). Each task lists the keys it adds; append them at the end of each file (the files are not sorted), `en.json` with value = key. Run `grep -n '"<key>"' lang/en.json` first: a key already there must not be added twice.
- The board UI never names the canvas library and shows none of its branding. Library CSS is overridden with `!important` rules in the board block of `resources/css/app.css`.
- Nothing this plan adds may cover the canvas's own controls, the shapes toolbar or the reactions bar (bottom centre).
- PHP: early returns, no `else`, braces always, typed everything, no comment that restates code. `vendor/bin/pint --dirty --format agent` and `vendor/bin/phpstan analyse --memory-limit=1G <touched php files>` before each commit.
- Frontend: URLs only through Wayfinder (`@/actions/...`); `npm run build` (generates the actions), then `npm run types:check` (one known error in `resources/js/components/manage-passkeys.tsx` is not yours) and `npx vp check <files you touched>`. Leave `public/build` fresh.
- Tests: `DB_HOST=127.0.0.1 php artisan test --compact <paths>`. After the migration also run `vendor/bin/sail artisan migrate --no-interaction`. Guest-cookie requests use `->withCookies(whiteboardGuestCookie($guest))->withCredentials()`.
- Test helper functions are global across the suite: do not reuse a name that exists (`writeElements`, `storedElement`, `saveTemplate`, `boardWorthSaving`, `boardFromScene`, `uploadBoardFile`, `whiteboardChannelRequest`, and everything in `tests/Pest.php`).
- Git: `git add` explicit paths only; never stage `.junie/mcp/mcp.json`; every commit ends with the trailer of `.superpowers/sdd/whiteboard-rules.md`.
- Limits from the spec: timer 10–3600 seconds; votes per member 1–20; result text 200 characters; history 10 sessions; `viewport` whisper throttled 100 ms and repeated every 2 s.

## Review Focus

1. **The same request arrives twice** (a client retries a vote, or a delete, after a timeout): the second vote changes nothing and broadcasts nothing; the second delete refunds nothing more. Pinned in Task 3 ("broadcasts progress to the others and stays quiet when nothing changed") and Task 4 ("refunds once when the delete is sent twice").
2. **A note under vote is deleted, and the batch lists its text before or after it** (and the undo, in either order): the text freeze must not block either, the votes are refunded once, and the note comes back with its words. Pinned in Task 4 ("deletes a note under vote with its text, whatever their order, and refunds its votes", "brings a deleted note back with its words and without its votes").
3. **A voted note is resized, or simply moved**: the canvas re-wraps the text (`text` gets other line breaks, the words stay) and sends the text element with a new position; both must be accepted, and a template text stored without `originalText` must not be mistaken for an edit on its first move. Pinned in Task 4 ("still lets a note under vote be moved, restyled and resized", "accepts the first move of a text stored without its original").
4. **An element id that looks like a number** (`"0"`, `"12"`): PHP turns such array keys into integers and an empty-looking id into `false`; votes and results must keep the id a string, and a second write of element `"0"` must not answer 500. Pinned in Task 3 ("keeps element ids that look like numbers as strings") and Task 4 ("accepts a second write of an element whose id is 0").
5. **Someone is locked out, or replaced, in the middle of an action** (the board is locked while their batch is in flight; another member takes control of a locked board): the refusal is a 403 that can be told from a lost access, nothing is stored, and the exemption follows the current facilitator, not the person who locked. Pinned in Task 2 ("refuses element writes from a member and a guest on a locked board", "follows the facilitator role, not the person, when control changes").

---

## File Structure

Backend (new unless marked):

| Path | Responsibility |
|---|---|
| `database/migrations/2026_10_11_100000_add_whiteboard_facilitation.php` | Three board columns, two vote tables, one partial unique index |
| `app/Models/WhiteboardVoteSession.php`, `WhiteboardVote.php`, `database/factories/WhiteboardVoteSessionFactory.php`, `WhiteboardVoteFactory.php` | Models |
| `app/Models/Whiteboard.php` (modify) | Columns, casts, `voteSessions()` |
| `app/Events/Whiteboards/WhiteboardTimerChanged.php`, `WhiteboardVoteChanged.php` | `timer.changed`, `vote.changed` |
| `app/Events/Whiteboards/WhiteboardBroadcastEvent.php` (modify) | `sendToAll()` |
| `app/Http/Controllers/Whiteboards/WhiteboardTimersController.php` | `PUT timer` |
| `app/Http/Controllers/Whiteboards/WhiteboardSettingsController.php` (modify) | `locked`, `follow_enabled` |
| `app/Actions/Whiteboards/WhiteboardGuard.php` (modify) | `notLocked`, `openVoteSession`, `noOpenVoteSession` |
| `app/Actions/Whiteboards/BuildWhiteboardSnapshot.php` (modify) | Facilitation fields, `transferCandidates`, `voting`, `votingHistory`, `serverTime` |
| `app/Http/Controllers/Whiteboards/WhiteboardFacilitatorsController.php`, `WhiteboardFilesController.php`, `WhiteboardElementsController.php` (modify) | Follow off on change; lock on uploads and writes |
| `app/Actions/Whiteboards/PresentWhiteboardVoting.php` | The only serializer of voting state |
| `app/Actions/Whiteboards/OpenWhiteboardVote.php`, `CastWhiteboardVote.php`, `CloseWhiteboardVote.php` | The three vote mutations |
| `app/Http/Controllers/Whiteboards/WhiteboardVoteSessionsController.php`, `WhiteboardVotesController.php`, `WhiteboardVoteClosuresController.php`, `WhiteboardVoteDismissalsController.php` | Endpoints |
| `app/Actions/Whiteboards/WriteWhiteboardElements.php` (modify) | Lock, text freeze, refund |
| `routes/web.php`, `tests/Pest.php` (modify) | Routes, helpers |

Frontend (new unless marked):

| Path | Responsibility |
|---|---|
| `resources/js/lib/whiteboard/types.ts`, `scene-sync.ts`, `files.ts` (modify) | Types; the "locked" refusal |
| `resources/js/hooks/use-whiteboard-channel.ts`, `use-whiteboard.ts` (modify) | Events, timer, voting state, clock offset |
| `resources/js/hooks/use-whiteboard-request.ts` | One way to run a request and say why it failed |
| `resources/js/components/whiteboard/facilitator-bar.tsx` | Timer, lock, follow, vote controls (facilitator only) |
| `resources/js/components/whiteboard/status-bar.tsx` | The row that tells everyone the state |
| `resources/js/components/whiteboard/hand-over-dialog.tsx` | Hand over facilitation |
| `resources/js/hooks/use-whiteboard-follow.ts` | `viewport` whispers, fit, pause and resume |
| `resources/js/hooks/use-whiteboard-overlay.ts` | Scroll, zoom and note positions for the overlay |
| `resources/js/components/whiteboard/vote-dialog.tsx`, `vote-overlay.tsx`, `results-panel.tsx` | Voting UI |
| `resources/js/components/whiteboard/board.tsx`, `board-menu.tsx`, `top-bar.tsx`, `resources/css/app.css` (modify) | Wiring |

Shared shapes used by several tasks (PHPStan aliases are defined on `PresentWhiteboardVoting`; the TypeScript twins in `resources/js/lib/whiteboard/types.ts`). Key order is part of the contract: tests compare with `toBe`.

```
VoteCount  = {elementId: string, count: int}
VoteResult = {elementId: string, text: string, count: int}
Tally      = {myVotes: list<VoteCount>, remaining: int, finishedCount: int}
Voting     = {id: string, open: bool, votesPerMember: int, allowMultiple: bool, frameElementId: ?string,
              elementIds: list<string>, myVotes: list<VoteCount>, remaining: int, finishedCount: ?int,
              results: ?list<VoteResult>}
PastVote   = {id: string, closedAt: string, results: list<VoteResult>}
```

`myVotes` is a list of pairs and never a map keyed by element id: PHP would turn the key `"12"` into an integer and encode a map of such keys as a JSON list.

A note is **in scope** of a session when `WhiteboardVoteSession::isTarget($element)` is true: the row is live (`is_deleted` false), is a sticky (`is_sticky` true) and its `element_id` is in the session's `element_ids`. The **words** of a note are the text element whose `data.containerId` is the note's id.

---

### Task 1: Tables, models, snapshot fields, lock and follow switches, timer

**Files:**
- Create: `database/migrations/2026_10_11_100000_add_whiteboard_facilitation.php`, `app/Models/WhiteboardVoteSession.php`, `app/Models/WhiteboardVote.php`, `database/factories/WhiteboardVoteSessionFactory.php`, `database/factories/WhiteboardVoteFactory.php`, `app/Events/Whiteboards/WhiteboardTimerChanged.php`, `app/Http/Controllers/Whiteboards/WhiteboardTimersController.php`
- Modify: `app/Models/Whiteboard.php`, `app/Actions/Whiteboards/BuildWhiteboardSnapshot.php`, `app/Http/Controllers/Whiteboards/WhiteboardSettingsController.php`, `routes/web.php`, `tests/Pest.php`
- Test: `tests/Feature/Whiteboards/WhiteboardVoteModelTest.php`, `tests/Feature/Whiteboards/WhiteboardTimerTest.php`; modify `WhiteboardSnapshotTest.php`, `WhiteboardSettingsTest.php`, `WhiteboardEventsTest.php`

**Interfaces:**
- Consumes: `WhiteboardMember::current(Request)`, `WhiteboardGuard::facilitator(Whiteboard, WhiteboardMember)`, `WhiteboardBroadcastEvent` (`sendToOthers()`), helpers `whiteboardMember()`, `whiteboardFacilitator()`, `whiteboardGuest()`, `whiteboardGuestCookie()`, `sceneElement()`.
- Produces:
  - Columns `whiteboards.locked` (bool, false), `follow_enabled` (bool, false), `timer_ends_at` (nullable timestamp), cast on `Whiteboard` as `bool`, `bool`, `datetime`; `Whiteboard::voteSessions(): HasMany<WhiteboardVoteSession>`.
  - `WhiteboardVoteSession` with `votes_per_member: int`, `frame_element_id: ?string`, `allow_multiple: bool`, `element_ids: list<string>`, `opened_by_member_id: ?string`, `closed_at: ?Carbon`, `dismissed_at: ?Carbon`, `results: ?list<VoteResult>`; `votes(): HasMany<WhiteboardVote>`, `whiteboard(): BelongsTo`, `isOpen(): bool`, `isTarget(?WhiteboardElement $element): bool`. Factory state `closed(array $results = [])`.
  - `WhiteboardVote` with `whiteboard_vote_session_id`, `whiteboard_member_id`, `element_id`, `count: int`.
  - Snapshot: `board.locked: bool`, `board.followEnabled: bool`, `board.timerEndsAt: ?string` (ISO 8601, seconds), `serverTime` as `Y-m-d\TH:i:s.v\Z`.
  - `PATCH settings` accepts `locked`, `follow_enabled` (booleans).
  - `PUT whiteboards/{board}/timer` (`whiteboards.timer.update`) → `{timerEndsAt: ?string}`; event `WhiteboardTimerChanged(string $boardId, public ?string $timerEndsAt)`, `timer.changed`, payload `{timerEndsAt}`.
  - Test helpers in `tests/Pest.php`: `whiteboardSticky(Whiteboard $board, string $id, string $text = 'Idea', array $overrides = []): array{0: WhiteboardElement, 1: WhiteboardElement}` (the note, then its text `"{$id}-text"`), `openWhiteboardVote(Whiteboard $board, array $attributes = []): WhiteboardVoteSession`, `castWhiteboardVote(WhiteboardVoteSession $session, WhiteboardMember $member, string $elementId, int $count = 1): WhiteboardVote`.

Facts checked: the latest whiteboard migration is `2026_10_10_100000_create_whiteboard_templates_table.php`, which guards its raw index with `DB::getDriverName() !== 'pgsql'`; models use the `#[Fillable([...])]` attribute and `HasUuids` (`app/Models/Whiteboard.php`); the timer sibling is `app/Http/Controllers/Poker/PokerTimersController.php` (`'present', 'nullable', 'integer', 'min:10', 'max:3600'`, `startOfSecond()`, `toIso8601String()`); poker's snapshot gives `serverTime` as `now()->utc()->format('Y-m-d\TH:i:s.v\Z')` (`app/Actions/Poker/BuildPokerSnapshot.php`); a scoped binding resolves `{voteSession}` through `$board->voteSessions()` (the relation is the plural of the parameter, as `{whiteboardTemplate}` → `whiteboardTemplates()` in `routes/web.php`).

- [ ] **Step 1: Add the test helpers**

In `tests/Pest.php` add the imports `App\Models\WhiteboardElement`, `App\Models\WhiteboardVote`, `App\Models\WhiteboardVoteSession` (keep the list sorted) and, after `whiteboardGuestCookie()`:

```php
/**
 * A stored sticky note and the text bound to it (`{$id}-text`).
 *
 * @param  array<string, mixed>  $overrides  merged into the note
 * @return array{0: WhiteboardElement, 1: WhiteboardElement}
 */
function whiteboardSticky(Whiteboard $board, string $id, string $text = 'Idea', array $overrides = []): array
{
    $note = sceneElement([
        'id' => $id,
        'backgroundColor' => '#fff3bf',
        'customData' => ['skrum' => ['kind' => 'sticky']],
        'boundElements' => [['id' => "{$id}-text", 'type' => 'text']],
        ...$overrides,
    ]);

    $words = sceneElement([
        'id' => "{$id}-text",
        'type' => 'text',
        'text' => $text,
        'originalText' => $text,
        'containerId' => $id,
        'frameId' => $note['frameId'],
    ]);

    $store = fn (array $element): WhiteboardElement => WhiteboardElement::factory()->create([
        'whiteboard_id' => $board->id,
        'element_id' => $element['id'],
        'type' => $element['type'],
        'data' => $element,
        'version' => $element['version'],
        'version_nonce' => $element['versionNonce'],
        'is_sticky' => isset($element['customData']),
        'seq' => 1,
    ]);

    return [$store($note), $store($words)];
}

/**
 * An open vote on the live sticky notes the board holds right now.
 *
 * @param  array<string, mixed>  $attributes
 */
function openWhiteboardVote(Whiteboard $board, array $attributes = []): WhiteboardVoteSession
{
    return WhiteboardVoteSession::factory()->create([
        'whiteboard_id' => $board->id,
        'element_ids' => $board->elements()->where('is_sticky', true)->where('is_deleted', false)->orderBy('element_id')->pluck('element_id')->all(),
        ...$attributes,
    ]);
}

function castWhiteboardVote(WhiteboardVoteSession $session, WhiteboardMember $member, string $elementId, int $count = 1): WhiteboardVote
{
    return WhiteboardVote::factory()->create([
        'whiteboard_vote_session_id' => $session->id,
        'whiteboard_member_id' => $member->id,
        'element_id' => $elementId,
        'count' => $count,
    ]);
}
```

- [ ] **Step 2: Write the failing tests**

`tests/Feature/Whiteboards/WhiteboardVoteModelTest.php`:

```php
<?php

use App\Models\Whiteboard;
use App\Models\WhiteboardElement;
use App\Models\WhiteboardVote;
use App\Models\WhiteboardVoteSession;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

it('gives a board safe facilitation defaults', function () {
    $board = Whiteboard::factory()->create()->fresh();

    expect($board->locked)->toBeFalse()
        ->and($board->follow_enabled)->toBeFalse()
        ->and($board->timer_ends_at)->toBeNull()
        ->and($board->voteSessions()->count())->toBe(0);
});

it('stores a vote session and its votes with uuid keys', function () {
    $board = Whiteboard::factory()->create();
    [, $member] = whiteboardMember($board);
    whiteboardSticky($board, 'note');
    $session = openWhiteboardVote($board, ['opened_by_member_id' => $member->id]);
    $vote = castWhiteboardVote($session, $member, 'note', 2);

    $session = $session->fresh();

    expect(Str::isUuid($session->id))->toBeTrue()
        ->and(Str::isUuid($vote->id))->toBeTrue()
        ->and($session->votes_per_member)->toBe(3)
        ->and($session->allow_multiple)->toBeFalse()
        ->and($session->element_ids)->toBe(['note'])
        ->and($session->frame_element_id)->toBeNull()
        ->and($session->opened_by_member_id)->toBe($member->id)
        ->and($session->closed_at)->toBeNull()
        ->and($session->dismissed_at)->toBeNull()
        ->and($session->results)->toBeNull()
        ->and($session->isOpen())->toBeTrue()
        ->and($session->votes()->sole()->count)->toBe(2)
        ->and($session->whiteboard->id)->toBe($board->id)
        ->and($board->voteSessions()->sole()->id)->toBe($session->id);
});

it('counts as a target only a live sticky note the vote was opened on', function () {
    $board = Whiteboard::factory()->create();
    [$note] = whiteboardSticky($board, 'note');
    [$gone] = whiteboardSticky($board, 'gone');
    $plain = WhiteboardElement::factory()->create(['whiteboard_id' => $board->id, 'element_id' => 'plain']);
    $session = openWhiteboardVote($board, ['element_ids' => ['note', 'gone', 'plain']]);
    [$late, $words] = whiteboardSticky($board, 'late');
    $gone->update(['is_deleted' => true]);

    expect($session->isTarget($note))->toBeTrue()
        ->and($session->isTarget($gone))->toBeFalse()
        ->and($session->isTarget($plain))->toBeFalse()
        ->and($session->isTarget($late))->toBeFalse()
        ->and($session->isTarget($words))->toBeFalse()
        ->and($session->isTarget(null))->toBeFalse();
});

it('keeps one open vote per board in the database', function () {
    $board = Whiteboard::factory()->create();
    WhiteboardVoteSession::factory()->closed()->create(['whiteboard_id' => $board->id]);
    WhiteboardVoteSession::factory()->create(['whiteboard_id' => $board->id]);
    WhiteboardVoteSession::factory()->create();

    expect(fn () => WhiteboardVoteSession::factory()->create(['whiteboard_id' => $board->id]))
        ->toThrow(QueryException::class);
});

it('keeps one vote row per member and note', function () {
    $board = Whiteboard::factory()->create();
    [, $member] = whiteboardMember($board);
    $session = openWhiteboardVote($board);
    castWhiteboardVote($session, $member, 'note');

    expect(fn () => castWhiteboardVote($session, $member, 'note'))->toThrow(QueryException::class);
});

it('removes the votes with their board', function () {
    Storage::fake();

    $board = Whiteboard::factory()->create();
    [, $member] = whiteboardMember($board);
    castWhiteboardVote(openWhiteboardVote($board), $member, 'note');

    $board->delete();

    expect(WhiteboardVoteSession::query()->count())->toBe(0)
        ->and(WhiteboardVote::query()->count())->toBe(0);
});
```

`tests/Feature/Whiteboards/WhiteboardTimerTest.php`:

```php
<?php

use App\Events\Whiteboards\WhiteboardTimerChanged;
use App\Models\Whiteboard;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Queue;

beforeEach(function () {
    Event::fake([WhiteboardTimerChanged::class]);
    $this->travelTo(CarbonImmutable::parse('2026-10-11 10:00:00'));
});

it('starts and clears the countdown for the facilitator', function () {
    $board = Whiteboard::factory()->create();
    [$user] = whiteboardFacilitator($board);

    $this->actingAs($user)
        ->putJson(route('whiteboards.timer.update', $board), ['seconds' => 90])
        ->assertOk()
        ->assertExactJson(['timerEndsAt' => '2026-10-11T10:01:30+00:00']);

    expect($board->fresh()->timer_ends_at->toIso8601String())->toBe('2026-10-11T10:01:30+00:00');

    $this->actingAs($user)
        ->getJson(route('whiteboards.snapshot.show', $board))
        ->assertJsonPath('board.timerEndsAt', '2026-10-11T10:01:30+00:00');

    $this->actingAs($user)
        ->putJson(route('whiteboards.timer.update', $board), ['seconds' => null])
        ->assertOk()
        ->assertExactJson(['timerEndsAt' => null]);

    expect($board->fresh()->timer_ends_at)->toBeNull();
});

it('lets only the facilitator set the timer', function () {
    $board = Whiteboard::factory()->withGuestAccess()->create();
    whiteboardFacilitator($board);
    [$user] = whiteboardMember($board);
    $guest = whiteboardGuest($board);

    $this->withCookies(whiteboardGuestCookie($guest))->withCredentials()
        ->putJson(route('whiteboards.timer.update', $board), ['seconds' => 60])
        ->assertForbidden();

    $this->actingAs($user)
        ->putJson(route('whiteboards.timer.update', $board), ['seconds' => 60])
        ->assertForbidden();

    expect($board->fresh()->timer_ends_at)->toBeNull();

    Event::assertNotDispatched(WhiteboardTimerChanged::class);
});

it('accepts 10 seconds to one hour', function (mixed $seconds, bool $valid) {
    $board = Whiteboard::factory()->create();
    [$user] = whiteboardFacilitator($board);

    $response = $this->actingAs($user)->putJson(route('whiteboards.timer.update', $board), ['seconds' => $seconds]);

    $valid ? $response->assertOk() : $response->assertUnprocessable()->assertJsonValidationErrors('seconds');
})->with([
    'too short' => [9, false],
    'shortest' => [10, true],
    'longest' => [3600, true],
    'too long' => [3601, false],
    'not a number' => ['soon', false],
    'a fraction' => [12.5, false],
]);

it('refuses a request that does not say how long', function () {
    $board = Whiteboard::factory()->create(['timer_ends_at' => now()->addMinute()]);
    [$user] = whiteboardFacilitator($board);

    $this->actingAs($user)
        ->putJson(route('whiteboards.timer.update', $board), [])
        ->assertJsonValidationErrors('seconds');

    expect($board->fresh()->timer_ends_at)->not->toBeNull();
});

it('broadcasts the end time and starts nothing else', function () {
    Queue::fake();

    $board = Whiteboard::factory()->create();
    [$user] = whiteboardFacilitator($board);

    $this->actingAs($user)->putJson(route('whiteboards.timer.update', $board), ['seconds' => 30])->assertOk();

    Event::assertDispatched(WhiteboardTimerChanged::class, fn (WhiteboardTimerChanged $event) => $event->boardId === $board->id
        && $event->broadcastAs() === 'timer.changed'
        && $event->broadcastWith() === ['timerEndsAt' => '2026-10-11T10:00:30+00:00']);

    $this->actingAs($user)->putJson(route('whiteboards.timer.update', $board), ['seconds' => null])->assertOk();

    Event::assertDispatched(WhiteboardTimerChanged::class, fn (WhiteboardTimerChanged $event) => $event->broadcastWith() === ['timerEndsAt' => null]);

    Queue::assertNothingPushed();
});
```

In `tests/Feature/Whiteboards/WhiteboardSnapshotTest.php`, add to the chain of the first test ("describes the board, the viewer, the members and the live elements"), after `->assertJsonPath('board.reactionsEnabled', true)`:

```php
        ->assertJsonPath('board.locked', false)
        ->assertJsonPath('board.followEnabled', false)
        ->assertJsonPath('board.timerEndsAt', null)
```

and add at the end of the file:

```php
it('gives the server time to the millisecond', function () {
    $board = Whiteboard::factory()->create();
    [$user] = whiteboardMember($board);

    $serverTime = $this->actingAs($user)->getJson(route('whiteboards.snapshot.show', $board))->json('serverTime');

    expect($serverTime)->toMatch('/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/');
});
```

In `tests/Feature/Whiteboards/WhiteboardSettingsTest.php` add:

```php
it('lets the facilitator lock the board and bring everyone to their view', function () {
    Event::fake([WhiteboardChanged::class]);

    $board = Whiteboard::factory()->create();
    [$user] = whiteboardFacilitator($board);

    $this->actingAs($user)
        ->patchJson(route('whiteboards.settings.update', $board), ['locked' => true, 'follow_enabled' => true])
        ->assertNoContent();

    expect($board->fresh()->locked)->toBeTrue()
        ->and($board->fresh()->follow_enabled)->toBeTrue();

    $this->actingAs($user)
        ->getJson(route('whiteboards.snapshot.show', $board))
        ->assertJsonPath('board.locked', true)
        ->assertJsonPath('board.followEnabled', true);

    Event::assertDispatched(WhiteboardChanged::class);
});

it('refuses the lock and follow switches from anyone else, and values that are not booleans', function (string $key) {
    $board = Whiteboard::factory()->create();
    [$facilitator] = whiteboardFacilitator($board);
    [$user] = whiteboardMember($board);

    $this->actingAs($user)
        ->patchJson(route('whiteboards.settings.update', $board), [$key => true])
        ->assertForbidden();

    $this->actingAs($facilitator)
        ->patchJson(route('whiteboards.settings.update', $board), [$key => 'sometimes'])
        ->assertJsonValidationErrors($key);

    expect($board->fresh()->getAttribute($key))->toBeFalse();
})->with(['locked', 'follow_enabled']);
```

In `tests/Feature/Whiteboards/WhiteboardEventsTest.php` add the import `App\Events\Whiteboards\WhiteboardTimerChanged` and:

```php
it('carries the end time in the timer event', function () {
    $running = new WhiteboardTimerChanged('b', '2026-10-11T10:00:30+00:00');
    $stopped = new WhiteboardTimerChanged('b', null);

    expect($running->broadcastAs())->toBe('timer.changed')
        ->and($running->broadcastOn()->name)->toBe('presence-whiteboard.b')
        ->and($running->broadcastWith())->toBe(['timerEndsAt' => '2026-10-11T10:00:30+00:00'])
        ->and($stopped->broadcastWith())->toBe(['timerEndsAt' => null]);
});
```

- [ ] **Step 3: Run them and see them fail**

Run: `DB_HOST=127.0.0.1 php artisan test --compact tests/Feature/Whiteboards/WhiteboardVoteModelTest.php tests/Feature/Whiteboards/WhiteboardTimerTest.php tests/Feature/Whiteboards/WhiteboardSnapshotTest.php tests/Feature/Whiteboards/WhiteboardSettingsTest.php tests/Feature/Whiteboards/WhiteboardEventsTest.php`
Expected: FAIL — `Class "App\Models\WhiteboardVoteSession" not found`, `Route [whiteboards.timer.update] not defined`, `board.locked` missing from the snapshot.

- [ ] **Step 4: Migration**

`php artisan make:migration add_whiteboard_facilitation --no-interaction`, rename the file to `2026_10_11_100000_add_whiteboard_facilitation.php` (it must sort after `2026_10_10_100000_create_whiteboard_templates_table.php` and after any whiteboard migration added since; if a later one exists, take the next free `2026_10_11_1001xx`). `up` only:

```php
Schema::table('whiteboards', function (Blueprint $table) {
    $table->boolean('locked')->default(false);
    $table->boolean('follow_enabled')->default(false);
    $table->timestamp('timer_ends_at')->nullable();
});

Schema::create('whiteboard_vote_sessions', function (Blueprint $table) {
    $table->uuid('id')->primary();
    $table->foreignUuid('whiteboard_id')->constrained()->cascadeOnDelete();
    $table->unsignedTinyInteger('votes_per_member');
    $table->string('frame_element_id', 40)->nullable();
    $table->boolean('allow_multiple')->default(false);
    $table->json('element_ids');
    $table->foreignUuid('opened_by_member_id')->nullable()->constrained('whiteboard_members')->nullOnDelete();
    $table->timestamp('closed_at')->nullable();
    $table->timestamp('dismissed_at')->nullable();
    $table->json('results')->nullable();
    $table->timestamps();

    $table->index(['whiteboard_id', 'closed_at']);
});

Schema::create('whiteboard_votes', function (Blueprint $table) {
    $table->uuid('id')->primary();
    $table->foreignUuid('whiteboard_vote_session_id')->constrained()->cascadeOnDelete();
    $table->foreignUuid('whiteboard_member_id')->constrained()->cascadeOnDelete();
    $table->string('element_id', 40);
    $table->unsignedTinyInteger('count');
    $table->timestamps();

    $table->unique(['whiteboard_vote_session_id', 'whiteboard_member_id', 'element_id'], 'whiteboard_votes_member_element_unique');
});

if (DB::getDriverName() !== 'pgsql') {
    return;
}

DB::statement('create unique index whiteboard_vote_sessions_one_open on whiteboard_vote_sessions (whiteboard_id) where closed_at is null');
```

The unique index is named because the default name is longer than PostgreSQL's 63 characters. `json` (not `jsonb`) like the other whiteboard columns: it keeps key order, which the `toBe` assertions on `results` rely on.

- [ ] **Step 5: Models and factories**

`WhiteboardVoteSession` (`HasFactory`, `HasUuids`, `#[Fillable(['whiteboard_id', 'votes_per_member', 'frame_element_id', 'allow_multiple', 'element_ids', 'opened_by_member_id', 'closed_at', 'dismissed_at', 'results'])]`), casts `votes_per_member` integer, `allow_multiple` boolean, `element_ids` array, `results` array, `closed_at` and `dismissed_at` datetime; typed relations `whiteboard(): BelongsTo`, `votes(): HasMany` (`WhiteboardVote`, no default order); property docblock in the style of `Whiteboard`; and:

```php
public function isOpen(): bool
{
    return $this->closed_at === null;
}

/**
 * In scope: a live sticky note the vote was opened on (spec §11.4).
 */
public function isTarget(?WhiteboardElement $element): bool
{
    if ($element === null || $element->is_deleted || ! $element->is_sticky) {
        return false;
    }

    return in_array($element->element_id, $this->element_ids, true);
}
```

`WhiteboardVote` (`#[Fillable(['whiteboard_vote_session_id', 'whiteboard_member_id', 'element_id', 'count'])]`, cast `count` integer, relations `session(): BelongsTo` with the foreign key `whiteboard_vote_session_id`, `member(): BelongsTo` with `whiteboard_member_id`).

`WhiteboardVoteSessionFactory::definition()`: `whiteboard_id => Whiteboard::factory()`, `votes_per_member => 3`, `allow_multiple => false`, `element_ids => []`; state:

```php
/**
 * @param  list<array{elementId: string, text: string, count: int}>  $results
 */
public function closed(array $results = []): static
{
    return $this->state(fn () => ['closed_at' => now(), 'results' => $results]);
}
```

`WhiteboardVoteFactory::definition()`: `whiteboard_vote_session_id => WhiteboardVoteSession::factory()`, `whiteboard_member_id => WhiteboardMember::factory()`, `element_id => 'note'`, `count => 1`.

`Whiteboard`: add `locked`, `follow_enabled`, `timer_ends_at` to `#[Fillable]`, to the property docblock (`bool`, `bool`, `Carbon|null`) and to `casts()` (`'locked' => 'boolean'`, `'follow_enabled' => 'boolean'`, `'timer_ends_at' => 'datetime'`), and:

```php
/** @return HasMany<WhiteboardVoteSession, $this> */
public function voteSessions(): HasMany
{
    return $this->hasMany(WhiteboardVoteSession::class);
}
```

- [ ] **Step 6: Snapshot, settings, timer**

`BuildWhiteboardSnapshot`: in `board`, after `reactionsEnabled`, add `'locked' => $board->locked`, `'followEnabled' => $board->follow_enabled`, `'timerEndsAt' => $board->timer_ends_at?->toIso8601String()`; replace `serverTime` by `now()->utc()->format('Y-m-d\TH:i:s.v\Z')`; extend the `Snapshot` PHPStan type (`locked: bool, followEnabled: bool, timerEndsAt: ?string`).

`WhiteboardSettingsController::update`: add `'locked' => ['sometimes', 'boolean']` and `'follow_enabled' => ['sometimes', 'boolean']` to the rules. Nothing else changes: the method already re-checks the facilitator under the lock and broadcasts `board.changed`.

`WhiteboardTimerChanged` extends `WhiteboardBroadcastEvent`: constructor `(string $boardId, public ?string $timerEndsAt)` calling `parent::__construct($boardId)`, `broadcastAs()` `'timer.changed'`, `broadcastWith()` `['timerEndsAt' => $this->timerEndsAt]`.

`WhiteboardTimersController::update(Request $request, Whiteboard $board): JsonResponse`:

1. `$member = WhiteboardMember::current($request); WhiteboardGuard::facilitator($board, $member);`
2. Validate `'seconds' => ['present', 'nullable', 'integer', 'min:10', 'max:3600']`.
3. `$endsAt = $validated['seconds'] === null ? null : now()->addSeconds((int) $validated['seconds'])->startOfSecond();` (the column keeps no fraction).
4. In `DB::transaction`: lock the board row (`Whiteboard::query()->whereKey($board->id)->lockForUpdate()->firstOrFail()`), `WhiteboardGuard::facilitator($locked, $member)` again, `$locked->update(['timer_ends_at' => $endsAt])`, `(new WhiteboardTimerChanged($locked->id, $endsAt?->toIso8601String()))->sendToOthers()`.
5. `return response()->json(['timerEndsAt' => $endsAt?->toIso8601String()]);`

No job is dispatched: the timer triggers nothing (spec §11.1). The timer keeps running on a locked board and across a change of facilitator.

Route, in the `whiteboards/{board}` group of `routes/web.php`, after the `facilitator` line:

```php
Route::put('timer', [WhiteboardTimersController::class, 'update'])->name('whiteboards.timer.update');
```

- [ ] **Step 7: Run the tests and the neighbours**

Run: `DB_HOST=127.0.0.1 php artisan test --compact tests/Feature/Whiteboards tests/Feature/UuidPrimaryKeysTest.php`
Expected: PASS.

- [ ] **Step 8: Gates and commit**

Run: `vendor/bin/pint --dirty --format agent`, `vendor/bin/phpstan analyse --memory-limit=1G app/Models/Whiteboard.php app/Models/WhiteboardVoteSession.php app/Models/WhiteboardVote.php app/Events/Whiteboards/WhiteboardTimerChanged.php app/Http/Controllers/Whiteboards/WhiteboardTimersController.php app/Http/Controllers/Whiteboards/WhiteboardSettingsController.php app/Actions/Whiteboards/BuildWhiteboardSnapshot.php database/factories/WhiteboardVoteSessionFactory.php database/factories/WhiteboardVoteFactory.php`, then `vendor/bin/sail artisan migrate --no-interaction`.

```bash
git add database/migrations/2026_10_11_100000_add_whiteboard_facilitation.php app/Models/Whiteboard.php app/Models/WhiteboardVoteSession.php app/Models/WhiteboardVote.php database/factories/WhiteboardVoteSessionFactory.php database/factories/WhiteboardVoteFactory.php app/Events/Whiteboards/WhiteboardTimerChanged.php app/Http/Controllers/Whiteboards/WhiteboardTimersController.php app/Http/Controllers/Whiteboards/WhiteboardSettingsController.php app/Actions/Whiteboards/BuildWhiteboardSnapshot.php routes/web.php tests/Pest.php tests/Feature/Whiteboards/WhiteboardVoteModelTest.php tests/Feature/Whiteboards/WhiteboardTimerTest.php tests/Feature/Whiteboards/WhiteboardSnapshotTest.php tests/Feature/Whiteboards/WhiteboardSettingsTest.php tests/Feature/Whiteboards/WhiteboardEventsTest.php
git commit -m "feat(whiteboard): facilitation tables, lock and follow switches, shared countdown"
```

**Translation keys added by this task:** none (validation messages are Laravel's).

---

### Task 2: Board lock, element lock, hand-over candidates

**Files:**
- Modify: `app/Actions/Whiteboards/WhiteboardGuard.php`, `app/Actions/Whiteboards/WriteWhiteboardElements.php`, `app/Http/Controllers/Whiteboards/WhiteboardElementsController.php`, `app/Http/Controllers/Whiteboards/WhiteboardFilesController.php`, `app/Http/Controllers/Whiteboards/WhiteboardFacilitatorsController.php`, `app/Actions/Whiteboards/BuildWhiteboardSnapshot.php`, `lang/{en,fr,de,es}.json`
- Test: `tests/Feature/Whiteboards/WhiteboardLockTest.php`; modify `WhiteboardElementWritesTest.php`, `WhiteboardFacilitationTest.php`, `WhiteboardSnapshotTest.php`

**Interfaces:**
- Consumes: Task 1 (`whiteboards.locked`, `follow_enabled`); `WriteWhiteboardElements::handle(Whiteboard, WhiteboardMember, array): array`; routes `whiteboards.elements.update`, `whiteboards.files.store`, `whiteboards.facilitator.update`, `whiteboards.duplicate.store`, `whiteboards.template.store`; helper `writeElements()` of `WhiteboardElementWritesTest.php` (only inside that file).
- Produces:
  - `WhiteboardGuard::notLocked(Whiteboard $board, WhiteboardMember $member): void` — passes when the board is not locked or the member facilitates; otherwise throws an `HttpResponseException` carrying a 403 JSON `{message: "This board is locked.", errors: {locked: ["This board is locked."]}}`.
  - Element writes and uploads call it before their work and again under the board lock.
  - `me.transferCandidates: list<array{userId: string, name: string}>` in the snapshot.
  - A change of facilitator sets `follow_enabled` to false.

Facts checked: the element lock is already enforced by `WriteWhiteboardElements::touchesLock()` (incoming `locked` true, or stored copy locked, for a non-facilitator → `locked`, stored copy returned) and pinned by "only lets the facilitator lock, unlock or change a locked element" in `WhiteboardElementWritesTest.php`; this task adds the cases that test does not cover (delete, guest, exact stored copy). `retroRequest` keeps only `status`, `message` and `errors` of an error response (`resources/js/lib/retro/api.ts`), and the client treats every 403 on a write as a lost access (`FatalStatuses` in `resources/js/lib/whiteboard/scene-sync.ts`): `errors.locked` is how Task 5 tells the two apart. Poker's candidates query is `BuildPokerSnapshot::transferCandidates()`; `WhiteboardFacilitatorsController::ensureCanHandOver()` accepts whoever `can('view', $team)` (`TeamPolicy::view`: workspace managers and team members), which is the same set.

- [ ] **Step 1: Write the failing tests**

`tests/Feature/Whiteboards/WhiteboardLockTest.php`:

```php
<?php

use App\Events\Whiteboards\WhiteboardElementsChanged;
use App\Models\User;
use App\Models\Whiteboard;
use App\Models\WhiteboardElement;
use App\Models\WhiteboardFile;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Storage;

beforeEach(function () {
    Storage::fake();
    Event::fake([WhiteboardElementsChanged::class]);
});

/**
 * A locked board holding one box, its facilitator and another member.
 *
 * @return array{0: Whiteboard, 1: User, 2: User}
 */
function lockedBoard(): array
{
    $board = Whiteboard::factory()->withGuestAccess()->create(['locked' => true, 'seq' => 1]);
    [$facilitator] = whiteboardFacilitator($board);
    [$member] = whiteboardMember($board);

    WhiteboardElement::factory()->create([
        'whiteboard_id' => $board->id,
        'element_id' => 'box',
        'version_nonce' => 100,
        'data' => sceneElement(['id' => 'box', 'x' => 7]),
    ]);

    return [$board, $facilitator, $member];
}

/**
 * @return array{elements: list<array<string, mixed>>}
 */
function lockedBoardEdit(): array
{
    return ['elements' => [sceneElement(['id' => 'box', 'version' => 2, 'x' => 99]), sceneElement(['id' => 'new'])]];
}

it('refuses element writes from a member and a guest on a locked board', function () {
    [$board, , $member] = lockedBoard();
    $guest = whiteboardGuest($board);

    $this->withCookies(whiteboardGuestCookie($guest))->withCredentials()
        ->putJson(route('whiteboards.elements.update', $board), lockedBoardEdit())
        ->assertForbidden()
        ->assertJsonPath('message', 'This board is locked.')
        ->assertJsonPath('errors.locked.0', 'This board is locked.');

    $this->actingAs($member)
        ->putJson(route('whiteboards.elements.update', $board), lockedBoardEdit())
        ->assertForbidden()
        ->assertJsonPath('message', 'This board is locked.')
        ->assertJsonPath('errors.locked.0', 'This board is locked.');

    expect($board->fresh()->seq)->toBe(1)
        ->and($board->elements()->sole()->data['x'])->toBe(7);

    Event::assertNotDispatched(WhiteboardElementsChanged::class);
});

it('lets the facilitator keep editing a locked board', function () {
    [$board, $facilitator] = lockedBoard();

    $this->actingAs($facilitator)
        ->putJson(route('whiteboards.elements.update', $board), lockedBoardEdit())
        ->assertOk()
        ->assertExactJson(['seq' => 3, 'fromSeq' => 1, 'rejected' => []]);

    expect($board->elements()->where('element_id', 'box')->sole()->data['x'])->toBe(99)
        ->and($board->elements()->count())->toBe(2);
});

it('refuses uploads on a locked board, except the facilitator\'s', function () {
    [$board, $facilitator, $member] = lockedBoard();

    $upload = fn (mixed $test) => $test->post(
        route('whiteboards.files.store', $board),
        ['file' => UploadedFile::fake()->image('photo.png', 20, 20), 'file_id' => 'abc123'],
        ['Accept' => 'application/json'],
    );

    $upload($this->actingAs($member))
        ->assertForbidden()
        ->assertJsonPath('errors.locked.0', 'This board is locked.');

    expect(WhiteboardFile::query()->count())->toBe(0)
        ->and(Storage::allFiles())->toBe([]);

    $upload($this->actingAs($facilitator))->assertCreated();

    expect(WhiteboardFile::query()->count())->toBe(1);
});

it('still lets everyone read a locked board', function () {
    [$board, , $member] = lockedBoard();
    $file = WhiteboardFile::factory()->create(['whiteboard_id' => $board->id]);
    Storage::put($file->path, 'image bytes');

    $this->actingAs($member)
        ->getJson(route('whiteboards.snapshot.show', $board))
        ->assertOk()
        ->assertJsonPath('board.locked', true)
        ->assertJsonCount(1, 'elements');

    $this->actingAs($member)
        ->getJson(route('whiteboards.elements.index', [$board, 'since' => 0]))
        ->assertOk()
        ->assertJsonCount(1, 'elements');

    $this->actingAs($member)
        ->get(route('whiteboards.files.show', [$board, $file->file_id]))
        ->assertOk();
});

it('follows the facilitator role, not the person, when control changes', function () {
    [$board, $facilitator, $member] = lockedBoard();

    $this->actingAs($member)
        ->putJson(route('whiteboards.facilitator.update', $board), ['user_id' => $member->id])
        ->assertNoContent();

    expect($board->fresh()->locked)->toBeTrue();

    $this->actingAs($member)
        ->putJson(route('whiteboards.elements.update', $board), lockedBoardEdit())
        ->assertOk()
        ->assertJsonPath('rejected', []);

    $this->actingAs($facilitator)
        ->putJson(route('whiteboards.elements.update', $board), ['elements' => [sceneElement(['id' => 'box', 'version' => 3, 'x' => 1])]])
        ->assertForbidden()
        ->assertJsonPath('errors.locked.0', 'This board is locked.');

    expect($board->elements()->where('element_id', 'box')->sole()->data['x'])->toBe(99);
});

it('gives everyone their pen back when the board is unlocked', function () {
    [$board, $facilitator, $member] = lockedBoard();

    $this->actingAs($facilitator)
        ->patchJson(route('whiteboards.settings.update', $board), ['locked' => false])
        ->assertNoContent();

    $this->actingAs($member)
        ->putJson(route('whiteboards.elements.update', $board), lockedBoardEdit())
        ->assertOk()
        ->assertJsonPath('rejected', []);
});

it('keeps duplicate and save as template open to members of a locked board', function () {
    [$board, , $member] = lockedBoard();

    $this->actingAs($member)->postJson(route('whiteboards.duplicate.store', $board))->assertCreated();
    $this->actingAs($member)->postJson(route('whiteboards.template.store', $board), ['name' => 'Locked'])->assertCreated();

    expect(Whiteboard::query()->whereKeyNot($board->id)->sole()->locked)->toBeFalse();
});
```

In `tests/Feature/Whiteboards/WhiteboardElementWritesTest.php` add (it uses that file's `writeElements()`):

```php
it('rejects a guest who deletes, moves or unlocks a locked element and hands back the stored copy', function (array $change) {
    $board = Whiteboard::factory()->withGuestAccess()->create(['seq' => 1]);
    whiteboardFacilitator($board);
    $guest = whiteboardGuest($board);
    $frame = sceneElement(['id' => 'frame', 'locked' => true, 'x' => 7]);
    WhiteboardElement::factory()->create([
        'whiteboard_id' => $board->id, 'element_id' => 'frame', 'version_nonce' => 100, 'data' => $frame,
    ]);

    writeElements($this->withCookies(whiteboardGuestCookie($guest))->withCredentials(), $board, [[...$frame, 'version' => 2, ...$change]])
        ->assertOk()
        ->assertJsonPath('seq', 1)
        ->assertJsonPath('rejected.0.reason', 'locked')
        ->assertJsonPath('rejected.0.element', $frame);

    $stored = $board->elements()->sole();

    expect($stored->data)->toEqual($frame)
        ->and($stored->is_deleted)->toBeFalse();

    Event::assertNotDispatched(WhiteboardElementsChanged::class);
})->with([
    'delete' => [['isDeleted' => true]],
    'move' => [['x' => 500]],
    'unlock' => [['locked' => false]],
]);
```

In `tests/Feature/Whiteboards/WhiteboardFacilitationTest.php` add:

```php
it('switches follow-me off when the facilitator changes, and leaves the lock alone', function (bool $takesControl) {
    $board = Whiteboard::factory()->create(['follow_enabled' => true, 'locked' => true]);
    [$facilitator] = whiteboardFacilitator($board);
    [$next] = whiteboardMember($board);

    $this->actingAs($takesControl ? $next : $facilitator)
        ->putJson(route('whiteboards.facilitator.update', $board), ['user_id' => $next->id])
        ->assertNoContent();

    expect($board->fresh()->follow_enabled)->toBeFalse()
        ->and($board->fresh()->locked)->toBeTrue()
        ->and($board->fresh()->facilitator?->user_id)->toBe($next->id);
})->with(['a hand-over' => false, 'a take-over' => true]);
```

In `tests/Feature/Whiteboards/WhiteboardSnapshotTest.php` add the imports `App\Enums\WorkspaceRole`, `App\Models\User` and:

```php
it('offers the facilitator the people who can take over, by name', function () {
    $board = Whiteboard::factory()->withGuestAccess()->create();
    [$user] = whiteboardFacilitator($board);
    $zoe = teamMember($board->team);
    $zoe->forceFill(['name' => 'Zoe'])->save();
    $adam = workspaceManager($board->team->workspace);
    $adam->forceFill(['name' => 'Adam'])->save();
    $outsider = User::factory()->create(['name' => 'Olaf']);
    $board->team->workspace->members()->attach($outsider, ['role' => WorkspaceRole::Member->value]);
    whiteboardGuest($board);

    $this->actingAs($user)
        ->getJson(route('whiteboards.snapshot.show', $board))
        ->assertJsonPath('me.transferCandidates', [
            ['userId' => $adam->id, 'name' => 'Adam'],
            ['userId' => $zoe->id, 'name' => 'Zoe'],
        ]);

    $this->actingAs($zoe)
        ->getJson(route('whiteboards.snapshot.show', $board))
        ->assertJsonPath('me.transferCandidates', []);
});
```

- [ ] **Step 2: Run them and see them fail**

Run: `DB_HOST=127.0.0.1 php artisan test --compact tests/Feature/Whiteboards/WhiteboardLockTest.php tests/Feature/Whiteboards/WhiteboardElementWritesTest.php tests/Feature/Whiteboards/WhiteboardFacilitationTest.php tests/Feature/Whiteboards/WhiteboardSnapshotTest.php`
Expected: FAIL — locked writes answer 200, uploads 201, `follow_enabled` stays true, `me.transferCandidates` is missing. The new element-lock test is expected to PASS already (17a built the rule); if it fails, the rule is incomplete: fix `touchesLock()` so that the three cases hold.

- [ ] **Step 3: The guard**

In `WhiteboardGuard`:

```php
/**
 * A 403 with `errors.locked`: the client must tell a locked board, on
 * which it stays, from an access that ended (spec §11.2).
 */
public static function notLocked(Whiteboard $board, WhiteboardMember $member): void
{
    if (! $board->locked || $board->isFacilitator($member)) {
        return;
    }

    $message = __('This board is locked.');

    throw new HttpResponseException(response()->json([
        'message' => $message,
        'errors' => ['locked' => [$message]],
    ], 403));
}
```

(`Illuminate\Http\Exceptions\HttpResponseException`.) Thrown inside a transaction, it rolls the transaction back like any exception.

- [ ] **Step 4: Writes and uploads**

- `WhiteboardElementsController::update`: `WhiteboardGuard::notLocked($board, $member);` right after `$member` is resolved (a refused request never reaches the JSON decoding).
- `WriteWhiteboardElements::handle`: `WhiteboardGuard::notLocked($locked, $member);` as the first statement after `$locked` is read with `lockForUpdate()`. This is the authoritative check: the lock and the facilitator are read under the board lock, so a write queued behind "lock the board" or behind "take control" sees the new state.
- `WhiteboardFilesController::store`: `WhiteboardGuard::notLocked($board, $member);` right after `$member` is resolved (before validation, so that it also covers the "file already exists" answer), and `WhiteboardGuard::notLocked($locked, $member);` as the first statement after `$locked` inside the transaction, before the quota check and before anything is written to storage.

Votes, the snapshot, `GET elements`, `GET files/{fileId}`, duplicate and save-as-template are not guarded.

- [ ] **Step 5: Follow-me off on a change of facilitator**

In `WhiteboardFacilitatorsController::update`, replace the update by:

```php
$locked->update(['facilitator_member_id' => $newFacilitator->id, 'follow_enabled' => false]);
```

- [ ] **Step 6: Hand-over candidates**

In `BuildWhiteboardSnapshot`, add to `me`, after `canDelete`:

```php
'transferCandidates' => $isFacilitator && ! $isGuest ? $this->transferCandidates($board, $viewer) : [],
```

and the method, a copy of poker's with the board's team (imports `App\Enums\WorkspaceRole`, `App\Models\User`):

```php
/**
 * @return array<int, array{userId: string, name: string}>
 */
private function transferCandidates(Whiteboard $board, WhiteboardMember $viewer): array
{
    $team = $board->team;

    $managerIds = $team->workspace->members()
        ->wherePivotIn('role', [WorkspaceRole::Owner->value, WorkspaceRole::Admin->value])
        ->pluck('users.id');

    return User::query()
        ->where(fn ($query) => $query
            ->whereIn('id', $team->members()->select('users.id'))
            ->orWhereIn('id', $managerIds))
        ->when($viewer->user_id !== null, fn ($query) => $query->whereKeyNot($viewer->user_id))
        ->orderBy('name')
        ->get(['id', 'name'])
        ->map(fn (User $user): array => ['userId' => $user->id, 'name' => $user->name])
        ->all();
}
```

Extend the `Snapshot` PHPStan type (`transferCandidates: array<int, array{userId: string, name: string}>`).

- [ ] **Step 7: Translation key**

| Key (English) | French | German | Spanish |
|---|---|---|---|
| This board is locked. | Ce tableau est verrouillé. | Dieses Board ist gesperrt. | Esta pizarra está bloqueada. |

- [ ] **Step 8: Run the tests**

Run: `DB_HOST=127.0.0.1 php artisan test --compact tests/Feature/Whiteboards tests/Feature/TranslationKeysTest.php`
Expected: PASS.

- [ ] **Step 9: Gates and commit**

Run: `vendor/bin/pint --dirty --format agent` and `vendor/bin/phpstan analyse --memory-limit=1G app/Actions/Whiteboards/WhiteboardGuard.php app/Actions/Whiteboards/WriteWhiteboardElements.php app/Actions/Whiteboards/BuildWhiteboardSnapshot.php app/Http/Controllers/Whiteboards/WhiteboardElementsController.php app/Http/Controllers/Whiteboards/WhiteboardFilesController.php app/Http/Controllers/Whiteboards/WhiteboardFacilitatorsController.php`.

```bash
git add app/Actions/Whiteboards/WhiteboardGuard.php app/Actions/Whiteboards/WriteWhiteboardElements.php app/Actions/Whiteboards/BuildWhiteboardSnapshot.php app/Http/Controllers/Whiteboards/WhiteboardElementsController.php app/Http/Controllers/Whiteboards/WhiteboardFilesController.php app/Http/Controllers/Whiteboards/WhiteboardFacilitatorsController.php lang/en.json lang/fr.json lang/de.json lang/es.json tests/Feature/Whiteboards/WhiteboardLockTest.php tests/Feature/Whiteboards/WhiteboardElementWritesTest.php tests/Feature/Whiteboards/WhiteboardFacilitationTest.php tests/Feature/Whiteboards/WhiteboardSnapshotTest.php
git commit -m "feat(whiteboard): board lock on writes and uploads, hand-over candidates"
```

---

### Task 3: Dot voting — sessions, votes, results, secrecy

**Files:**
- Create: `app/Actions/Whiteboards/PresentWhiteboardVoting.php`, `OpenWhiteboardVote.php`, `CastWhiteboardVote.php`, `CloseWhiteboardVote.php`, `app/Events/Whiteboards/WhiteboardVoteChanged.php`, `app/Http/Controllers/Whiteboards/WhiteboardVoteSessionsController.php`, `WhiteboardVotesController.php`, `WhiteboardVoteClosuresController.php`, `WhiteboardVoteDismissalsController.php`
- Modify: `app/Actions/Whiteboards/WhiteboardGuard.php`, `app/Actions/Whiteboards/BuildWhiteboardSnapshot.php`, `app/Events/Whiteboards/WhiteboardBroadcastEvent.php`, `routes/web.php`, `lang/{en,fr,de,es}.json`
- Test: `tests/Feature/Whiteboards/WhiteboardVotingTest.php`, `tests/Feature/Whiteboards/WhiteboardVotingSecrecyTest.php`; modify `WhiteboardEventsTest.php`

**Interfaces:**
- Consumes: Task 1 (models, helpers `whiteboardSticky`, `openWhiteboardVote`, `castWhiteboardVote`), Task 2 (`locked`), `WhiteboardChanged`, `SanitizeWhiteboardElement::IdPattern` (`/^[A-Za-z0-9_-]{1,40}$/`), the limiter `whiteboard-writes`.
- Produces:
  - `PresentWhiteboardVoting` (types `VoteCount`, `VoteResult`, `Tally`, `Voting`, `PastVote` of "Shared shapes"):
    - `currentSession(Whiteboard $board): ?WhiteboardVoteSession` — the open session, else the latest closed one with `dismissed_at` null
    - `current(Whiteboard $board, WhiteboardMember $viewer): ?Voting`
    - `session(WhiteboardVoteSession $session, WhiteboardMember $viewer): Voting`
    - `tally(WhiteboardVoteSession $session, WhiteboardMember $member): Tally`
    - `finishedCount(WhiteboardVoteSession $session): int`
    - `history(Whiteboard $board, WhiteboardMember $viewer): list<PastVote>`
  - `OpenWhiteboardVote::handle(Whiteboard $board, WhiteboardMember $member, int $votesPerMember, ?string $frameElementId, bool $allowMultiple): WhiteboardVoteSession`
  - `CastWhiteboardVote::handle(Whiteboard $board, WhiteboardVoteSession $session, WhiteboardMember $member, string $elementId, int $count): Tally`
  - `CloseWhiteboardVote::handle(Whiteboard $board, WhiteboardVoteSession $session, WhiteboardMember $member): void`
  - `WhiteboardGuard::openVoteSession(WhiteboardVoteSession $session): void` (422 `votes` "This vote is closed."), `WhiteboardGuard::noOpenVoteSession(Whiteboard $board): void` (422 `votes` "A vote is already open.")
  - `WhiteboardVoteChanged(string $boardId, public string $sessionId, public int $finishedCount)` — `vote.changed`, payload `{sessionId, finishedCount}`
  - `WhiteboardBroadcastEvent::sendToAll(): void`
  - Snapshot keys `voting: ?Voting`, `votingHistory: list<PastVote>`
  - Routes (group `whiteboards/{board}`):

    | Method | URL | Name | Controller |
    |---|---|---|---|
    | POST | `vote-sessions` | `whiteboards.voteSessions.store` | `WhiteboardVoteSessionsController@store` → 201 `{id}` |
    | GET | `vote-sessions/{voteSession}` | `whiteboards.voteSessions.show` | `WhiteboardVoteSessionsController@show` → `Voting` |
    | PUT | `vote-sessions/{voteSession}/votes/{elementId}` | `whiteboards.voteSessions.votes.update` | `WhiteboardVotesController@update` → `Tally` |
    | POST | `vote-sessions/{voteSession}/close` | `whiteboards.voteSessions.close.store` | `WhiteboardVoteClosuresController@store` → 204 |
    | POST | `vote-sessions/{voteSession}/dismiss` | `whiteboards.voteSessions.dismiss.store` | `WhiteboardVoteDismissalsController@store` → 204 |

Facts checked: `SendsToOthers::sendToOthers()` is `DB::afterCommit(fn () => rescue(fn () => broadcast($this)->toOthers()))` (`app/Events/Concerns/SendsToOthers.php`); `InteractsWithSockets` adds a public `$socket` to every event; the retro sibling for a budget under a row lock is `app/Http/Controllers/Retros/CardVotesController.php` ("You have no votes left." is an existing key); `Log::listen()` exists (`vendor/laravel/framework/src/Illuminate/Log/Logger.php`, `listen(Closure $callback)`); the `whiteboard-writes` limiter keys on user (or IP) and board (`app/Providers/AppServiceProvider.php`).

- [ ] **Step 1: Write the failing tests**

`tests/Feature/Whiteboards/WhiteboardVotingTest.php`:

```php
<?php

use App\Events\Whiteboards\WhiteboardChanged;
use App\Events\Whiteboards\WhiteboardVoteChanged;
use App\Models\Whiteboard;
use App\Models\WhiteboardElement;
use App\Models\WhiteboardVote;
use App\Models\WhiteboardVoteSession;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Route;

beforeEach(function () {
    Event::fake([WhiteboardChanged::class, WhiteboardVoteChanged::class]);
});

function openVoteRequest(mixed $test, Whiteboard $board, array $body = []): mixed
{
    return $test->postJson(route('whiteboards.voteSessions.store', $board), ['votes_per_member' => 3, 'allow_multiple' => false, ...$body]);
}

function voteRequest(mixed $test, Whiteboard $board, WhiteboardVoteSession $session, string $elementId, mixed $count): mixed
{
    return $test->putJson(route('whiteboards.voteSessions.votes.update', [$board, $session, $elementId]), ['count' => $count]);
}

function closeVoteRequest(mixed $test, Whiteboard $board, WhiteboardVoteSession $session): mixed
{
    return $test->postJson(route('whiteboards.voteSessions.close.store', [$board, $session]));
}

it('opens a vote on the live sticky notes of the board', function () {
    $board = Whiteboard::factory()->create();
    [$user, $member] = whiteboardFacilitator($board);
    whiteboardSticky($board, 'second');
    whiteboardSticky($board, 'first');
    [$erased] = whiteboardSticky($board, 'erased');
    $erased->update(['is_deleted' => true]);
    WhiteboardElement::factory()->create(['whiteboard_id' => $board->id, 'element_id' => 'plain']);

    $response = openVoteRequest($this->actingAs($user), $board, ['votes_per_member' => 5, 'allow_multiple' => true])->assertCreated();

    $session = WhiteboardVoteSession::query()->sole();

    $response->assertExactJson(['id' => $session->id]);

    expect($session->whiteboard_id)->toBe($board->id)
        ->and($session->votes_per_member)->toBe(5)
        ->and($session->allow_multiple)->toBeTrue()
        ->and($session->frame_element_id)->toBeNull()
        ->and($session->element_ids)->toBe(['first', 'second'])
        ->and($session->opened_by_member_id)->toBe($member->id)
        ->and($session->isOpen())->toBeTrue();

    Event::assertDispatched(WhiteboardChanged::class, fn (WhiteboardChanged $event) => $event->boardId === $board->id);
});

it('limits a vote to the notes inside a frame', function () {
    $board = Whiteboard::factory()->create();
    [$user] = whiteboardFacilitator($board);
    WhiteboardElement::factory()->create([
        'whiteboard_id' => $board->id, 'element_id' => 'zone', 'type' => 'frame', 'data' => sceneElement(['id' => 'zone', 'type' => 'frame']),
    ]);
    whiteboardSticky($board, 'inside', 'In', ['frameId' => 'zone']);
    whiteboardSticky($board, 'outside', 'Out');

    openVoteRequest($this->actingAs($user), $board, ['frame_element_id' => 'zone'])->assertCreated();

    $session = WhiteboardVoteSession::query()->sole();

    expect($session->frame_element_id)->toBe('zone')
        ->and($session->element_ids)->toBe(['inside']);
});

it('refuses a frame that is not a live frame of this board', function (string $frameElementId) {
    $board = Whiteboard::factory()->create();
    [$user] = whiteboardFacilitator($board);
    whiteboardSticky($board, 'note');
    WhiteboardElement::factory()->create(['whiteboard_id' => $board->id, 'element_id' => 'box']);
    WhiteboardElement::factory()->deleted()->create(['whiteboard_id' => $board->id, 'element_id' => 'old', 'type' => 'frame']);
    WhiteboardElement::factory()->create(['element_id' => 'theirs', 'type' => 'frame']);

    openVoteRequest($this->actingAs($user), $board, ['frame_element_id' => $frameElementId])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('frame_element_id');

    expect(WhiteboardVoteSession::query()->count())->toBe(0);
})->with([
    'unknown' => 'nowhere',
    'a rectangle' => 'box',
    'a deleted frame' => 'old',
    'a frame of another board' => 'theirs',
]);

it('lets only the facilitator open a vote', function () {
    $board = Whiteboard::factory()->withGuestAccess()->create();
    whiteboardFacilitator($board);
    [$user] = whiteboardMember($board);
    $guest = whiteboardGuest($board);
    whiteboardSticky($board, 'note');

    openVoteRequest($this->withCookies(whiteboardGuestCookie($guest))->withCredentials(), $board)->assertForbidden();
    openVoteRequest($this->actingAs($user), $board)->assertForbidden();

    expect(WhiteboardVoteSession::query()->count())->toBe(0);
});

it('refuses a second vote while one is open', function () {
    $board = Whiteboard::factory()->create();
    [$user] = whiteboardFacilitator($board);
    whiteboardSticky($board, 'note');
    openWhiteboardVote($board);

    openVoteRequest($this->actingAs($user), $board)
        ->assertUnprocessable()
        ->assertJsonPath('message', 'A vote is already open.');

    expect(WhiteboardVoteSession::query()->count())->toBe(1);
});

it('refuses a vote when no sticky note is in scope', function (?string $frameElementId) {
    $board = Whiteboard::factory()->create();
    [$user] = whiteboardFacilitator($board);
    WhiteboardElement::factory()->create(['whiteboard_id' => $board->id, 'element_id' => 'zone', 'type' => 'frame']);
    WhiteboardElement::factory()->create(['whiteboard_id' => $board->id, 'element_id' => 'plain']);

    if ($frameElementId !== null) {
        whiteboardSticky($board, 'outside');
    }

    openVoteRequest($this->actingAs($user), $board, ['frame_element_id' => $frameElementId])
        ->assertUnprocessable()
        ->assertJsonPath('message', 'There are no sticky notes to vote on.');

    expect(WhiteboardVoteSession::query()->count())->toBe(0);
})->with([
    'a board without notes' => [null],
    'a frame without notes' => ['zone'],
]);

it('validates the settings of a vote', function (array $body, string $field) {
    $board = Whiteboard::factory()->create();
    [$user] = whiteboardFacilitator($board);
    whiteboardSticky($board, 'note');

    $this->actingAs($user)
        ->postJson(route('whiteboards.voteSessions.store', $board), $body)
        ->assertJsonValidationErrors($field);

    expect(WhiteboardVoteSession::query()->count())->toBe(0);
})->with([
    'no budget' => [['allow_multiple' => false], 'votes_per_member'],
    'a budget of zero' => [['votes_per_member' => 0, 'allow_multiple' => false], 'votes_per_member'],
    'a budget above twenty' => [['votes_per_member' => 21, 'allow_multiple' => false], 'votes_per_member'],
    'no multiple flag' => [['votes_per_member' => 3], 'allow_multiple'],
    'a flag that is not a boolean' => [['votes_per_member' => 3, 'allow_multiple' => 'maybe'], 'allow_multiple'],
    'a frame id that cannot be an element id' => [['votes_per_member' => 3, 'allow_multiple' => false, 'frame_element_id' => 'not an id!'], 'frame_element_id'],
]);

it('puts the previous results away when a new vote opens', function () {
    $board = Whiteboard::factory()->create();
    [$user] = whiteboardFacilitator($board);
    whiteboardSticky($board, 'note');
    $previous = WhiteboardVoteSession::factory()
        ->closed([['elementId' => 'note', 'text' => 'Idea', 'count' => 2]])
        ->create(['whiteboard_id' => $board->id, 'element_ids' => ['note']]);

    openVoteRequest($this->actingAs($user), $board)->assertCreated();

    expect($previous->fresh()->dismissed_at)->not->toBeNull()
        ->and(WhiteboardVoteSession::query()->whereNull('closed_at')->count())->toBe(1);
});

it('casts, raises and removes a vote and answers with the voter\'s own tally', function () {
    $board = Whiteboard::factory()->create();
    whiteboardFacilitator($board);
    [$user, $member] = whiteboardMember($board);
    whiteboardSticky($board, 'first');
    whiteboardSticky($board, 'second');
    $session = openWhiteboardVote($board, ['allow_multiple' => true]);

    voteRequest($this->actingAs($user), $board, $session, 'first', 2)
        ->assertOk()
        ->assertExactJson(['myVotes' => [['elementId' => 'first', 'count' => 2]], 'remaining' => 1, 'finishedCount' => 0]);

    voteRequest($this->actingAs($user), $board, $session, 'second', 1)
        ->assertOk()
        ->assertExactJson([
            'myVotes' => [['elementId' => 'first', 'count' => 2], ['elementId' => 'second', 'count' => 1]],
            'remaining' => 0,
            'finishedCount' => 1,
        ]);

    voteRequest($this->actingAs($user), $board, $session, 'first', 0)
        ->assertOk()
        ->assertExactJson(['myVotes' => [['elementId' => 'second', 'count' => 1]], 'remaining' => 2, 'finishedCount' => 0]);

    expect(WhiteboardVote::query()->where('whiteboard_member_id', $member->id)->pluck('count', 'element_id')->all())
        ->toBe(['second' => 1]);
});

it('never lets a member spend more than the budget', function () {
    $board = Whiteboard::factory()->create();
    [$user] = whiteboardMember($board);
    whiteboardSticky($board, 'first');
    whiteboardSticky($board, 'second');
    $session = openWhiteboardVote($board, ['allow_multiple' => true]);

    voteRequest($this->actingAs($user), $board, $session, 'first', 3)->assertOk();

    voteRequest($this->actingAs($user), $board, $session, 'second', 1)
        ->assertUnprocessable()
        ->assertJsonPath('message', 'You have no votes left.');

    voteRequest($this->actingAs($user), $board, $session, 'first', 4)
        ->assertUnprocessable()
        ->assertJsonPath('message', 'You have no votes left.');

    voteRequest($this->actingAs($user), $board, $session, 'first', 2)->assertOk();
    voteRequest($this->actingAs($user), $board, $session, 'second', 1)->assertOk()->assertJsonPath('remaining', 0);

    expect((int) WhiteboardVote::query()->sum('count'))->toBe(3);
});

it('allows several votes on one note only when the vote says so', function () {
    $board = Whiteboard::factory()->create();
    [$user] = whiteboardMember($board);
    whiteboardSticky($board, 'note');
    $session = openWhiteboardVote($board);

    voteRequest($this->actingAs($user), $board, $session, 'note', 2)
        ->assertUnprocessable()
        ->assertJsonValidationErrors('count')
        ->assertJsonPath('message', 'Only one vote per note is allowed.');

    voteRequest($this->actingAs($user), $board, $session, 'note', 1)->assertOk();

    expect(WhiteboardVote::query()->sole()->count)->toBe(1);
});

it('refuses a vote on anything but a live sticky note of the vote', function (string $elementId) {
    $board = Whiteboard::factory()->create();
    [$user] = whiteboardMember($board);
    whiteboardSticky($board, 'note');
    [$erased] = whiteboardSticky($board, 'erased');
    $session = openWhiteboardVote($board);
    $erased->update(['is_deleted' => true]);
    whiteboardSticky($board, 'late');
    WhiteboardElement::factory()->create(['whiteboard_id' => $board->id, 'element_id' => 'plain']);

    voteRequest($this->actingAs($user), $board, $session, $elementId, 1)
        ->assertUnprocessable()
        ->assertJsonPath('message', 'This note is not part of the vote.');

    expect(WhiteboardVote::query()->count())->toBe(0);
})->with([
    'a plain shape' => 'plain',
    'a deleted note' => 'erased',
    'a note added after the vote opened' => 'late',
    'the text of a note' => 'note-text',
    'nothing on the board' => 'nowhere',
]);

it('refuses a vote once the vote is closed', function () {
    $board = Whiteboard::factory()->create();
    [$user] = whiteboardMember($board);
    whiteboardSticky($board, 'note');
    $session = WhiteboardVoteSession::factory()->closed()->create(['whiteboard_id' => $board->id, 'element_ids' => ['note']]);

    voteRequest($this->actingAs($user), $board, $session, 'note', 1)
        ->assertUnprocessable()
        ->assertJsonPath('message', 'This vote is closed.');

    expect(WhiteboardVote::query()->count())->toBe(0);
});

it('lets guests vote, and always in their own name', function () {
    $board = Whiteboard::factory()->withGuestAccess()->create();
    [, $member] = whiteboardMember($board);
    $guest = whiteboardGuest($board);
    whiteboardSticky($board, 'note');
    $session = openWhiteboardVote($board);

    $this->withCookies(whiteboardGuestCookie($guest))->withCredentials()
        ->putJson(route('whiteboards.voteSessions.votes.update', [$board, $session, 'note']), [
            'count' => 1, 'member_id' => $member->id, 'whiteboard_member_id' => $member->id,
        ])
        ->assertOk()
        ->assertJsonPath('remaining', 2);

    expect(WhiteboardVote::query()->sole()->whiteboard_member_id)->toBe($guest->id);
});

it('keeps voting open on a locked board', function () {
    $board = Whiteboard::factory()->create(['locked' => true]);
    whiteboardFacilitator($board);
    [$user] = whiteboardMember($board);
    whiteboardSticky($board, 'note');
    $session = openWhiteboardVote($board);

    voteRequest($this->actingAs($user), $board, $session, 'note', 1)->assertOk();

    expect(WhiteboardVote::query()->count())->toBe(1);
});

it('does not find the vote of another board', function () {
    $board = Whiteboard::factory()->create();
    [$user] = whiteboardFacilitator($board);
    $other = Whiteboard::factory()->create();
    whiteboardSticky($other, 'note');
    $theirs = openWhiteboardVote($other);

    voteRequest($this->actingAs($user), $board, $theirs, 'note', 1)->assertNotFound();
    closeVoteRequest($this->actingAs($user), $board, $theirs)->assertNotFound();
    $this->actingAs($user)->postJson(route('whiteboards.voteSessions.dismiss.store', [$board, $theirs]))->assertNotFound();
    $this->actingAs($user)->getJson(route('whiteboards.voteSessions.show', [$board, $theirs]))->assertNotFound();

    expect($theirs->fresh()->isOpen())->toBeTrue();
});

it('validates the count', function (array $body) {
    $board = Whiteboard::factory()->create();
    [$user] = whiteboardMember($board);
    whiteboardSticky($board, 'note');
    $session = openWhiteboardVote($board, ['allow_multiple' => true, 'votes_per_member' => 20]);

    $this->actingAs($user)
        ->putJson(route('whiteboards.voteSessions.votes.update', [$board, $session, 'note']), $body)
        ->assertJsonValidationErrors('count');
})->with([
    'missing' => [[]],
    'negative' => [['count' => -1]],
    'above twenty' => [['count' => 21]],
    'not a number' => [['count' => 'two']],
]);

it('broadcasts progress to the others and stays quiet when nothing changed', function () {
    $board = Whiteboard::factory()->create();
    [$user] = whiteboardMember($board);
    whiteboardSticky($board, 'first');
    whiteboardSticky($board, 'second');
    $session = openWhiteboardVote($board, ['votes_per_member' => 1]);

    voteRequest($this->actingAs($user), $board, $session, 'first', 1)->assertOk();

    Event::assertDispatched(WhiteboardVoteChanged::class, fn (WhiteboardVoteChanged $event) => $event->boardId === $board->id
        && $event->broadcastAs() === 'vote.changed'
        && $event->broadcastWith() === ['sessionId' => $session->id, 'finishedCount' => 1]);

    voteRequest($this->actingAs($user), $board, $session, 'first', 1)
        ->assertOk()
        ->assertExactJson(['myVotes' => [['elementId' => 'first', 'count' => 1]], 'remaining' => 0, 'finishedCount' => 1]);

    voteRequest($this->actingAs($user), $board, $session, 'second', 0)->assertOk();

    Event::assertDispatchedTimes(WhiteboardVoteChanged::class, 1);
    expect(WhiteboardVote::query()->count())->toBe(1);
});

it('keeps element ids that look like numbers as strings', function () {
    $board = Whiteboard::factory()->create();
    [$facilitator] = whiteboardFacilitator($board);
    [$user] = whiteboardMember($board);
    whiteboardSticky($board, '0', 'Zero');
    whiteboardSticky($board, '12', 'Twelve');
    $session = openWhiteboardVote($board, ['allow_multiple' => true]);

    voteRequest($this->actingAs($user), $board, $session, '0', 1)
        ->assertOk()
        ->assertExactJson(['myVotes' => [['elementId' => '0', 'count' => 1]], 'remaining' => 2, 'finishedCount' => 0]);

    voteRequest($this->actingAs($user), $board, $session, '12', 2)
        ->assertOk()
        ->assertJsonPath('myVotes', [['elementId' => '0', 'count' => 1], ['elementId' => '12', 'count' => 2]]);

    closeVoteRequest($this->actingAs($facilitator), $board, $session)->assertNoContent();

    expect($session->fresh()->results)->toBe([
        ['elementId' => '12', 'text' => 'Twelve', 'count' => 2],
        ['elementId' => '0', 'text' => 'Zero', 'count' => 1],
    ]);
});

it('closes the vote with ranked results and forgets who voted', function () {
    $board = Whiteboard::factory()->create();
    [$user] = whiteboardFacilitator($board);
    [, $ann] = whiteboardMember($board);
    [, $bob] = whiteboardMember($board);
    whiteboardSticky($board, 'low-right', 'Right', ['x' => 500, 'y' => 300]);
    whiteboardSticky($board, 'low-left', 'Left', ['x' => 0, 'y' => 300]);
    whiteboardSticky($board, 'top', str_repeat('é', 250), ['x' => 900, 'y' => 0]);
    whiteboardSticky($board, 'winner', 'Winner', ['x' => 900, 'y' => 900]);
    whiteboardSticky($board, 'unloved', 'Nobody', ['x' => 0, 'y' => 0]);
    $session = openWhiteboardVote($board, ['allow_multiple' => true, 'votes_per_member' => 5]);

    castWhiteboardVote($session, $ann, 'winner', 2);
    castWhiteboardVote($session, $bob, 'winner', 1);
    castWhiteboardVote($session, $ann, 'low-right');
    castWhiteboardVote($session, $bob, 'low-left');
    castWhiteboardVote($session, $ann, 'top');

    closeVoteRequest($this->actingAs($user), $board, $session)->assertNoContent();

    $session->refresh();

    expect($session->closed_at)->not->toBeNull()
        ->and($session->dismissed_at)->toBeNull()
        ->and($session->results)->toBe([
            ['elementId' => 'winner', 'text' => 'Winner', 'count' => 3],
            ['elementId' => 'top', 'text' => str_repeat('é', 200), 'count' => 1],
            ['elementId' => 'low-left', 'text' => 'Left', 'count' => 1],
            ['elementId' => 'low-right', 'text' => 'Right', 'count' => 1],
        ])
        ->and(WhiteboardVote::query()->count())->toBe(0)
        ->and(json_encode($session->results))->not->toContain($ann->id)
        ->and(json_encode($session->results))->not->toContain($bob->id);

    Event::assertDispatched(WhiteboardChanged::class, fn (WhiteboardChanged $event) => $event->boardId === $board->id);
});

it('leaves a note that is gone out of the results and gives a note without text an empty label', function () {
    $board = Whiteboard::factory()->create();
    [$user, $member] = whiteboardFacilitator($board);
    [$gone] = whiteboardSticky($board, 'gone');
    [, $words] = whiteboardSticky($board, 'bare');
    $session = openWhiteboardVote($board);
    castWhiteboardVote($session, $member, 'gone');
    castWhiteboardVote($session, $member, 'bare');
    $gone->update(['is_deleted' => true]);
    $words->update(['is_deleted' => true]);

    closeVoteRequest($this->actingAs($user), $board, $session)->assertNoContent();

    expect($session->fresh()->results)->toBe([['elementId' => 'bare', 'text' => '', 'count' => 1]]);
});

it('closes a vote once', function () {
    $board = Whiteboard::factory()->create();
    [$user, $member] = whiteboardFacilitator($board);
    whiteboardSticky($board, 'note');
    $session = openWhiteboardVote($board);
    castWhiteboardVote($session, $member, 'note');

    closeVoteRequest($this->actingAs($user), $board, $session)->assertNoContent();

    $closedAt = $session->fresh()->closed_at;
    $this->travel(5)->minutes();

    closeVoteRequest($this->actingAs($user), $board, $session)->assertNoContent();

    expect($session->fresh()->closed_at->equalTo($closedAt))->toBeTrue()
        ->and($session->fresh()->results)->toBe([['elementId' => 'note', 'text' => 'Idea', 'count' => 1]]);

    Event::assertDispatchedTimes(WhiteboardChanged::class, 1);
});

it('lets only the facilitator close and dismiss', function () {
    $board = Whiteboard::factory()->withGuestAccess()->create();
    whiteboardFacilitator($board);
    [$user] = whiteboardMember($board);
    $guest = whiteboardGuest($board);
    whiteboardSticky($board, 'note');
    $open = openWhiteboardVote($board);

    closeVoteRequest($this->withCookies(whiteboardGuestCookie($guest))->withCredentials(), $board, $open)->assertForbidden();
    closeVoteRequest($this->actingAs($user), $board, $open)->assertForbidden();

    expect($open->fresh()->isOpen())->toBeTrue();

    $open->update(['closed_at' => now(), 'results' => []]);

    $this->actingAs($user)
        ->postJson(route('whiteboards.voteSessions.dismiss.store', [$board, $open]))
        ->assertForbidden();

    expect($open->fresh()->dismissed_at)->toBeNull();
});

it('hides the results when the facilitator dismisses them, once', function () {
    $board = Whiteboard::factory()->create();
    [$user] = whiteboardFacilitator($board);
    $session = WhiteboardVoteSession::factory()
        ->closed([['elementId' => 'note', 'text' => 'Idea', 'count' => 1]])
        ->create(['whiteboard_id' => $board->id]);

    $this->actingAs($user)->postJson(route('whiteboards.voteSessions.dismiss.store', [$board, $session]))->assertNoContent();
    $this->actingAs($user)->postJson(route('whiteboards.voteSessions.dismiss.store', [$board, $session]))->assertNoContent();

    expect($session->fresh()->dismissed_at)->not->toBeNull();

    $this->actingAs($user)->getJson(route('whiteboards.snapshot.show', $board))->assertJsonPath('voting', null);

    Event::assertDispatchedTimes(WhiteboardChanged::class, 1);
});

it('refuses to dismiss a vote that is still open', function () {
    $board = Whiteboard::factory()->create();
    [$user] = whiteboardFacilitator($board);
    $session = openWhiteboardVote($board);

    $this->actingAs($user)
        ->postJson(route('whiteboards.voteSessions.dismiss.store', [$board, $session]))
        ->assertUnprocessable()
        ->assertJsonPath('message', 'Close the vote first.');

    expect($session->fresh()->dismissed_at)->toBeNull();
});

it('has no voting state on a board that never voted', function () {
    $board = Whiteboard::factory()->create();
    [$user] = whiteboardMember($board);

    $this->actingAs($user)
        ->getJson(route('whiteboards.snapshot.show', $board))
        ->assertJsonPath('voting', null)
        ->assertJsonPath('votingHistory', []);
});

it('lists past votes for members, newest first, and never for guests', function () {
    $board = Whiteboard::factory()->withGuestAccess()->create();
    [$user] = whiteboardMember($board);
    $guest = whiteboardGuest($board);
    $result = fn (string $text): array => [['elementId' => 'note', 'text' => $text, 'count' => 1]];
    $old = WhiteboardVoteSession::factory()->closed($result('Old'))->create([
        'whiteboard_id' => $board->id, 'closed_at' => now()->subDays(2), 'dismissed_at' => now()->subDays(2),
    ]);
    $recent = WhiteboardVoteSession::factory()->closed($result('Recent'))->create([
        'whiteboard_id' => $board->id, 'closed_at' => now()->subDay(), 'dismissed_at' => now()->subDay(),
    ]);
    WhiteboardVoteSession::factory()->closed()->create([
        'whiteboard_id' => $board->id, 'closed_at' => now()->subHours(2), 'dismissed_at' => now()->subHours(2),
    ]);
    $current = WhiteboardVoteSession::factory()->closed($result('Now'))->create(['whiteboard_id' => $board->id]);

    $this->withCookies(whiteboardGuestCookie($guest))->withCredentials()
        ->getJson(route('whiteboards.snapshot.show', $board))
        ->assertJsonPath('voting.id', $current->id)
        ->assertJsonPath('voting.results.0.text', 'Now')
        ->assertJsonPath('votingHistory', []);

    $this->actingAs($user)
        ->getJson(route('whiteboards.snapshot.show', $board))
        ->assertJsonPath('voting.id', $current->id)
        ->assertJsonPath('votingHistory.*.id', [$recent->id, $old->id])
        ->assertJsonPath('votingHistory.0.results', $result('Recent'))
        ->assertJsonPath('votingHistory.0.closedAt', $recent->closed_at->toIso8601String());
});

it('keeps the history to the ten most recent votes', function () {
    $board = Whiteboard::factory()->create();
    [$user] = whiteboardMember($board);

    foreach (range(1, 12) as $daysAgo) {
        WhiteboardVoteSession::factory()->closed([['elementId' => 'note', 'text' => "Day {$daysAgo}", 'count' => 1]])->create([
            'whiteboard_id' => $board->id, 'closed_at' => now()->subDays($daysAgo), 'dismissed_at' => now()->subDays($daysAgo),
        ]);
    }

    $this->actingAs($user)
        ->getJson(route('whiteboards.snapshot.show', $board))
        ->assertJsonCount(10, 'votingHistory')
        ->assertJsonPath('votingHistory.0.results.0.text', 'Day 1')
        ->assertJsonPath('votingHistory.9.results.0.text', 'Day 10');
});

it('throttles votes with the whiteboard limiter', function () {
    expect(Route::getRoutes()->getByName('whiteboards.voteSessions.votes.update')->gatherMiddleware())
        ->toContain('throttle:whiteboard-writes');
});
```

`tests/Feature/Whiteboards/WhiteboardVotingSecrecyTest.php` — the invariant "while a session is open, no payload a member receives holds another member's votes or a total" (spec §11.4, §14), on every surface: snapshot JSON, Inertia page props, the session endpoint, the vote response, `vote.changed`, `board.changed`, element payloads, the log; for the facilitator too.

```php
<?php

use App\Events\Whiteboards\WhiteboardChanged;
use App\Events\Whiteboards\WhiteboardElementsChanged;
use App\Events\Whiteboards\WhiteboardVoteChanged;
use App\Models\User;
use App\Models\Whiteboard;
use App\Models\WhiteboardMember;
use App\Models\WhiteboardVote;
use App\Models\WhiteboardVoteSession;
use Illuminate\Log\Events\MessageLogged;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Log;

beforeEach(function () {
    Event::fake([WhiteboardChanged::class, WhiteboardVoteChanged::class, WhiteboardElementsChanged::class]);
});

/**
 * A board with two notes and an open vote (3 votes each, several per note).
 * Bob has spent his budget (2 on the first note, 1 on the second), the guest
 * has voted once for the second note; Ann and the facilitator have not voted.
 *
 * @return array{
 *     board: Whiteboard,
 *     session: WhiteboardVoteSession,
 *     facilitator: array{0: User, 1: WhiteboardMember},
 *     ann: array{0: User, 1: WhiteboardMember},
 *     bob: array{0: User, 1: WhiteboardMember},
 *     guest: WhiteboardMember
 * }
 */
function votingRoom(): array
{
    $board = Whiteboard::factory()->withGuestAccess()->create();
    $facilitator = whiteboardFacilitator($board);
    $ann = whiteboardMember($board);
    $bob = whiteboardMember($board);
    $guest = whiteboardGuest($board);
    whiteboardSticky($board, 'first', 'First idea');
    whiteboardSticky($board, 'second', 'Second idea');
    $session = openWhiteboardVote($board, ['allow_multiple' => true, 'opened_by_member_id' => $facilitator[1]->id]);

    castWhiteboardVote($session, $bob[1], 'first', 2);
    castWhiteboardVote($session, $bob[1], 'second', 1);
    castWhiteboardVote($session, $guest, 'second', 1);

    return ['board' => $board, 'session' => $session, 'facilitator' => $facilitator, 'ann' => $ann, 'bob' => $bob, 'guest' => $guest];
}

/**
 * @param  list<array{elementId: string, count: int}>  $myVotes
 * @return array<string, mixed>
 */
function openVotingFor(WhiteboardVoteSession $session, array $myVotes, int $remaining, int $finishedCount = 1): array
{
    return [
        'id' => $session->id,
        'open' => true,
        'votesPerMember' => 3,
        'allowMultiple' => true,
        'frameElementId' => null,
        'elementIds' => ['first', 'second'],
        'myVotes' => $myVotes,
        'remaining' => $remaining,
        'finishedCount' => $finishedCount,
        'results' => null,
    ];
}

it('shows someone who has not voted nothing about the votes of the others', function (string $who) {
    $room = votingRoom();
    [$user] = $room[$who];
    $expected = openVotingFor($room['session'], [], 3);

    $snapshot = $this->actingAs($user)->getJson(route('whiteboards.snapshot.show', $room['board']))->assertOk();

    expect($snapshot->json('voting'))->toBe($expected)
        ->and($snapshot->json('votingHistory'))->toBe([])
        ->and($snapshot->getContent())->not->toContain('"count"');

    $this->actingAs($user)
        ->get(route('whiteboards.show', $room['board']))
        ->assertInertia(fn ($page) => $page->where('snapshot.voting', $expected)->where('snapshot.votingHistory', []));

    $this->actingAs($user)
        ->getJson(route('whiteboards.voteSessions.show', [$room['board'], $room['session']]))
        ->assertOk()
        ->assertExactJson($expected);
})->with([
    'the facilitator' => 'facilitator',
    'another member' => 'ann',
]);

it('shows a voter their own votes and nobody else\'s', function () {
    $room = votingRoom();

    $forGuest = $this->withCookies(whiteboardGuestCookie($room['guest']))->withCredentials()
        ->getJson(route('whiteboards.snapshot.show', $room['board']))
        ->assertOk();

    expect($forGuest->json('voting'))->toBe(openVotingFor($room['session'], [['elementId' => 'second', 'count' => 1]], 2));

    $forBob = $this->actingAs($room['bob'][0])
        ->getJson(route('whiteboards.snapshot.show', $room['board']))
        ->assertOk();

    expect($forBob->json('voting'))->toBe(openVotingFor($room['session'], [
        ['elementId' => 'first', 'count' => 2],
        ['elementId' => 'second', 'count' => 1],
    ], 0));
});

it('answers a vote with the voter\'s tally and nothing about the others', function () {
    $room = votingRoom();
    [$user] = $room['ann'];

    $this->actingAs($user)
        ->putJson(route('whiteboards.voteSessions.votes.update', [$room['board'], $room['session'], 'first']), ['count' => 1])
        ->assertOk()
        ->assertExactJson(['myVotes' => [['elementId' => 'first', 'count' => 1]], 'remaining' => 2, 'finishedCount' => 1]);

    $this->actingAs($user)
        ->putJson(route('whiteboards.voteSessions.votes.update', [$room['board'], $room['session'], 'second']), ['count' => 4])
        ->assertUnprocessable()
        ->assertExactJson(['message' => 'You have no votes left.', 'errors' => ['votes' => ['You have no votes left.']]]);
});

it('broadcasts progress without saying who voted or for what', function () {
    $room = votingRoom();
    [$user] = $room['ann'];

    $this->actingAs($user)
        ->putJson(route('whiteboards.voteSessions.votes.update', [$room['board'], $room['session'], 'first']), ['count' => 3])
        ->assertOk();

    Event::assertDispatched(WhiteboardVoteChanged::class, function (WhiteboardVoteChanged $event) use ($room) {
        $properties = array_keys(get_object_vars($event));
        sort($properties);

        return $event->broadcastWith() === ['sessionId' => $room['session']->id, 'finishedCount' => 2]
            && $properties === ['boardId', 'finishedCount', 'sessionId', 'socket'];
    });

    Event::assertDispatchedTimes(WhiteboardVoteChanged::class, 1);
    Event::assertNotDispatched(WhiteboardChanged::class);
});

it('keeps votes out of every element payload', function () {
    $room = votingRoom();
    [$user] = $room['facilitator'];
    $board = $room['board'];
    $stored = fn (): array => $board->elements()->get()->mapWithKeys(fn ($element) => [$element->element_id => $element->data])->all();

    $delta = $this->actingAs($user)->getJson(route('whiteboards.elements.index', [$board, 'since' => 0]))->assertOk();
    $snapshot = $this->actingAs($user)->getJson(route('whiteboards.snapshot.show', $board))->assertOk();

    expect($delta->json('elements'))->toHaveCount(4)
        ->and($snapshot->json('elements'))->toHaveCount(4);

    foreach ([...$delta->json('elements'), ...$snapshot->json('elements')] as $element) {
        expect($element)->toEqual($stored()[$element['id']]);
    }

    $this->actingAs($user)
        ->putJson(route('whiteboards.elements.update', $board), ['elements' => [sceneElement(['id' => 'box'])]])
        ->assertOk()
        ->assertExactJson(['seq' => 1, 'fromSeq' => 0, 'rejected' => []]);

    Event::assertDispatched(WhiteboardElementsChanged::class, fn (WhiteboardElementsChanged $event) => $event->broadcastWith() == [
        'seq' => 1, 'fromSeq' => 0, 'elements' => [$stored()['box']],
    ]);
});

it('writes nothing about votes to the log', function () {
    $logged = [];
    Log::listen(function (MessageLogged $message) use (&$logged): void {
        $logged[] = $message->message.json_encode($message->context);
    });

    $room = votingRoom();

    $this->actingAs($room['ann'][0])
        ->putJson(route('whiteboards.voteSessions.votes.update', [$room['board'], $room['session'], 'first']), ['count' => 1])
        ->assertOk();
    $this->actingAs($room['ann'][0])
        ->putJson(route('whiteboards.voteSessions.votes.update', [$room['board'], $room['session'], 'second']), ['count' => 9])
        ->assertUnprocessable();
    $this->actingAs($room['facilitator'][0])->getJson(route('whiteboards.snapshot.show', $room['board']))->assertOk();
    $this->actingAs($room['facilitator'][0])
        ->postJson(route('whiteboards.voteSessions.close.store', [$room['board'], $room['session']]))
        ->assertNoContent();

    expect($logged)->toBe([]);
});

it('shows everyone the same counts after the close, and never who voted', function () {
    $room = votingRoom();

    $this->actingAs($room['facilitator'][0])
        ->postJson(route('whiteboards.voteSessions.close.store', [$room['board'], $room['session']]))
        ->assertNoContent();

    Event::assertDispatched(WhiteboardChanged::class, fn (WhiteboardChanged $event) => $event->broadcastWith() === []);

    $expected = [
        'id' => $room['session']->id,
        'open' => false,
        'votesPerMember' => 3,
        'allowMultiple' => true,
        'frameElementId' => null,
        'elementIds' => [],
        'myVotes' => [],
        'remaining' => 0,
        'finishedCount' => null,
        'results' => [
            ['elementId' => 'first', 'text' => 'First idea', 'count' => 2],
            ['elementId' => 'second', 'text' => 'Second idea', 'count' => 2],
        ],
    ];

    $memberIds = [$room['facilitator'][1]->id, $room['ann'][1]->id, $room['bob'][1]->id, $room['guest']->id];

    auth()->logout();

    $asGuest = $this->withCookies(whiteboardGuestCookie($room['guest']))->withCredentials()
        ->getJson(route('whiteboards.snapshot.show', $room['board']))
        ->assertOk();

    expect($asGuest->json('voting'))->toBe($expected);

    foreach (['facilitator', 'ann', 'bob'] as $who) {
        $voting = $this->actingAs($room[$who][0])
            ->getJson(route('whiteboards.snapshot.show', $room['board']))
            ->assertOk()
            ->json('voting');

        expect($voting)->toBe($expected);

        foreach ($memberIds as $memberId) {
            expect(json_encode($voting))->not->toContain($memberId);
        }
    }

    expect(WhiteboardVote::query()->count())->toBe(0);
});
```

In `tests/Feature/Whiteboards/WhiteboardEventsTest.php` add the import `App\Events\Whiteboards\WhiteboardVoteChanged` and:

```php
it('carries only the session and the progress in the vote event', function () {
    $event = new WhiteboardVoteChanged('b', 'session-id', 2);

    expect($event->broadcastAs())->toBe('vote.changed')
        ->and($event->broadcastOn()->name)->toBe('presence-whiteboard.b')
        ->and($event->broadcastWith())->toBe(['sessionId' => 'session-id', 'finishedCount' => 2]);
});
```

- [ ] **Step 2: Run them and see them fail**

Run: `DB_HOST=127.0.0.1 php artisan test --compact tests/Feature/Whiteboards/WhiteboardVotingTest.php tests/Feature/Whiteboards/WhiteboardVotingSecrecyTest.php tests/Feature/Whiteboards/WhiteboardEventsTest.php`
Expected: FAIL — `Route [whiteboards.voteSessions.store] not defined`, `Class "App\Events\Whiteboards\WhiteboardVoteChanged" not found`.

- [ ] **Step 3: Event, `sendToAll`, guards**

`WhiteboardVoteChanged` extends `WhiteboardBroadcastEvent`: constructor `(string $boardId, public string $sessionId, public int $finishedCount)`; `broadcastAs()` `'vote.changed'`; `broadcastWith()` `['sessionId' => $this->sessionId, 'finishedCount' => $this->finishedCount]`. It has no other public property: the secrecy test compares the list.

In `WhiteboardBroadcastEvent` (import `Illuminate\Support\Facades\DB`):

```php
/**
 * To everyone on the channel, the sender included: for a change the
 * sender's own response does not describe.
 */
public function sendToAll(): void
{
    DB::afterCommit(function (): void {
        rescue(function (): void {
            broadcast($this);
        });
    });
}
```

In `WhiteboardGuard` (import `App\Models\WhiteboardVoteSession`, `Illuminate\Validation\ValidationException`):

```php
public static function openVoteSession(WhiteboardVoteSession $session): void
{
    if ($session->isOpen()) {
        return;
    }

    throw ValidationException::withMessages(['votes' => __('This vote is closed.')]);
}

public static function noOpenVoteSession(Whiteboard $board): void
{
    if (! $board->voteSessions()->whereNull('closed_at')->exists()) {
        return;
    }

    throw ValidationException::withMessages(['votes' => __('A vote is already open.')]);
}
```

- [ ] **Step 4: The presenter**

`app/Actions/Whiteboards/PresentWhiteboardVoting.php` (`php artisan make:class Actions/Whiteboards/PresentWhiteboardVoting --no-interaction`). Class docblock: "The only place voting state is turned into a payload. While a session is open a viewer gets their own votes and nothing about anyone else's (spec §11.4); the facilitator is a viewer like any other." Define the five PHPStan types of "Shared shapes" and `public const HistoryLength = 10;`.

```php
public function currentSession(Whiteboard $board): ?WhiteboardVoteSession
{
    return $board->voteSessions()->whereNull('closed_at')->first()
        ?? $board->voteSessions()->whereNull('dismissed_at')->orderByDesc('closed_at')->orderByDesc('id')->first();
}

/**
 * @return Voting|null
 */
public function current(Whiteboard $board, WhiteboardMember $viewer): ?array
{
    $session = $this->currentSession($board);

    if ($session === null) {
        return null;
    }

    return $this->session($session, $viewer);
}

/**
 * @return Voting
 */
public function session(WhiteboardVoteSession $session, WhiteboardMember $viewer): array
{
    $settings = [
        'id' => $session->id,
        'open' => $session->isOpen(),
        'votesPerMember' => $session->votes_per_member,
        'allowMultiple' => $session->allow_multiple,
        'frameElementId' => $session->frame_element_id,
    ];

    if (! $session->isOpen()) {
        return [...$settings, 'elementIds' => [], 'myVotes' => [], 'remaining' => 0, 'finishedCount' => null, 'results' => $session->results ?? []];
    }

    return [...$settings, 'elementIds' => $session->element_ids, ...$this->tally($session, $viewer), 'results' => null];
}

/**
 * @return Tally
 */
public function tally(WhiteboardVoteSession $session, WhiteboardMember $member): array
{
    $mine = $session->votes()->where('whiteboard_member_id', $member->id)->orderBy('element_id')->get();

    return [
        'myVotes' => $mine
            ->map(fn (WhiteboardVote $vote): array => ['elementId' => $vote->element_id, 'count' => $vote->count])
            ->values()
            ->all(),
        'remaining' => max(0, $session->votes_per_member - (int) $mine->sum('count')),
        'finishedCount' => $this->finishedCount($session),
    ];
}

public function finishedCount(WhiteboardVoteSession $session): int
{
    return $session->votes()
        ->get(['whiteboard_member_id', 'count'])
        ->groupBy('whiteboard_member_id')
        ->filter(fn (Collection $votes): bool => (int) $votes->sum('count') >= $session->votes_per_member)
        ->count();
}

/**
 * @return list<PastVote>
 */
public function history(Whiteboard $board, WhiteboardMember $viewer): array
{
    if ($viewer->isGuest()) {
        return [];
    }

    $current = $this->currentSession($board);

    return array_values($board->voteSessions()
        ->whereNotNull('closed_at')
        ->when($current !== null, fn ($query) => $query->whereKeyNot($current->id))
        ->orderByDesc('closed_at')
        ->orderByDesc('id')
        ->get()
        ->filter(fn (WhiteboardVoteSession $session): bool => ($session->results ?? []) !== [])
        ->take(self::HistoryLength)
        ->map(fn (WhiteboardVoteSession $session): array => [
            'id' => $session->id,
            'closedAt' => $session->closed_at->toIso8601String(),
            'results' => $session->results,
        ])
        ->all());
}
```

(`Illuminate\Support\Collection` for the type in `finishedCount`.) The key order of `session()` and `tally()` is the order the tests compare with `toBe`: do not reorder. A closed session carries no `myVotes`: the rows no longer exist.

- [ ] **Step 5: Open**

`OpenWhiteboardVote::handle(...)`, everything in one `DB::transaction`:

1. `$locked = Whiteboard::query()->whereKey($board->id)->lockForUpdate()->firstOrFail();`
2. `WhiteboardGuard::facilitator($locked, $member);`
3. `WhiteboardGuard::noOpenVoteSession($locked);` — **hook for 17d:** `WhiteboardGuard::notPrivateWriting($locked)` goes on the next line.
4. When `$frameElementId !== null`: it must be a live frame of this board — `$locked->elements()->where('element_id', $frameElementId)->where('type', 'frame')->where('is_deleted', false)->exists()`, else `ValidationException::withMessages(['frame_element_id' => __('Choose a frame of this board.')])`.
5. The scope, in PHP because `frameId` lives in the JSON:

```php
$elementIds = $locked->elements()
    ->where('is_sticky', true)
    ->where('is_deleted', false)
    ->get()
    ->filter(fn (WhiteboardElement $note): bool => $frameElementId === null || ($note->data['frameId'] ?? null) === $frameElementId)
    ->pluck('element_id')
    ->sort(SORT_STRING)
    ->values()
    ->all();
```

6. `$elementIds === []` → `ValidationException::withMessages(['votes' => __('There are no sticky notes to vote on.')])`.
7. `$locked->voteSessions()->whereNotNull('closed_at')->whereNull('dismissed_at')->update(['dismissed_at' => now()]);`
8. Create the session (`votes_per_member`, `frame_element_id`, `allow_multiple`, `element_ids`, `opened_by_member_id => $member->id`), `(new WhiteboardChanged($locked->id))->sendToOthers();`, return it.

Opening does not touch any element and does not bump `seq`.

- [ ] **Step 6: Vote**

`CastWhiteboardVote::handle(...)` (constructor: `private PresentWhiteboardVoting $presentWhiteboardVoting`), in one `DB::transaction`:

1. Lock the board row as above. The board lock serialises every vote of a board, so the budget check cannot race.
2. `$open = $locked->voteSessions()->whereKey($session->id)->firstOrFail();` then `WhiteboardGuard::openVoteSession($open);` — the session is read again under the lock: a vote queued behind "close" is refused.
3. `$count > 1 && ! $open->allow_multiple` → `ValidationException::withMessages(['count' => __('Only one vote per note is allowed.')])`.
4. `$element = $locked->elements()->where('element_id', $elementId)->first();` — `! $open->isTarget($element)` → `ValidationException::withMessages(['votes' => __('This note is not part of the vote.')])`. This holds for `count` 0 too.
5. Budget: `$elsewhere = (int) $open->votes()->where('whiteboard_member_id', $member->id)->where('element_id', '!=', $elementId)->sum('count');` — `$elsewhere + $count > $open->votes_per_member` → `ValidationException::withMessages(['votes' => __('You have no votes left.')])`.
6. `$current = $open->votes()->where('whiteboard_member_id', $member->id)->where('element_id', $elementId)->first();` When `($current?->count ?? 0) === $count`, return `$this->presentWhiteboardVoting->tally($open, $member)` without writing or broadcasting (a retry).
7. Otherwise: `$count === 0` → `$current?->delete()`; else `$open->votes()->updateOrCreate(['whiteboard_member_id' => $member->id, 'element_id' => $elementId], ['count' => $count])`. Then `(new WhiteboardVoteChanged($locked->id, $open->id, $this->presentWhiteboardVoting->finishedCount($open)))->sendToOthers();` and return the tally.

The voter is `$member`, resolved by the middleware; nothing in the body names a member. A vote never touches `whiteboards.seq` or `updated_at`. Write steps 6–7 with early returns, not a ternary with side effects.

- [ ] **Step 7: Close and dismiss**

`CloseWhiteboardVote::handle(...)` (`public const MaxTextLength = 200;`), in one `DB::transaction`: lock the board; `WhiteboardGuard::facilitator($locked, $member)`; `$open = $locked->voteSessions()->whereKey($session->id)->firstOrFail();` when `! $open->isOpen()` return (closing twice changes nothing and broadcasts nothing); `$open->update(['results' => $this->results($locked, $open), 'closed_at' => now()]);` `$open->votes()->delete();` `(new WhiteboardChanged($locked->id))->sendToOthers();`

```php
/**
 * @return list<array{elementId: string, text: string, count: int}>
 */
private function results(Whiteboard $board, WhiteboardVoteSession $session): array
{
    $totals = $session->votes()
        ->get(['element_id', 'count'])
        ->groupBy('element_id')
        ->map(fn (Collection $votes): int => (int) $votes->sum('count'));

    $notes = $board->elements()
        ->whereIn('element_id', $totals->keys()->map(fn (int|string $id): string => (string) $id)->all())
        ->get()
        ->filter(fn (WhiteboardElement $note): bool => $session->isTarget($note));

    $words = $board->elements()
        ->where('type', 'text')
        ->where('is_deleted', false)
        ->get()
        ->keyBy(fn (WhiteboardElement $text): string => (string) ($text->data['containerId'] ?? ''));

    return array_values($notes
        ->map(fn (WhiteboardElement $note): array => [
            'elementId' => $note->element_id,
            'text' => $this->label($words->get($note->element_id)),
            'count' => (int) $totals->get($note->element_id),
            'x' => (float) ($note->data['x'] ?? 0),
            'y' => (float) ($note->data['y'] ?? 0),
        ])
        ->sort(fn (array $first, array $second): int => [$second['count'], $first['y'], $first['x'], $first['elementId']]
            <=> [$first['count'], $second['y'], $second['x'], $second['elementId']])
        ->map(fn (array $result): array => ['elementId' => $result['elementId'], 'text' => $result['text'], 'count' => $result['count']])
        ->all());
}

private function label(?WhiteboardElement $words): string
{
    $text = $words?->data['originalText'] ?? $words?->data['text'] ?? '';

    return mb_substr(is_string($text) ? $text : '', 0, self::MaxTextLength);
}
```

`elementId` is taken from the model (`$note->element_id`, a string), never from a collection key: a key such as `"12"` is an integer in PHP. Order: count descending, then top-to-bottom (`y`), left-to-right (`x`), then id so that the order is total.

Dismiss, in `WhiteboardVoteDismissalsController::store(Request $request, Whiteboard $board, WhiteboardVoteSession $voteSession): Response`: member, `WhiteboardGuard::facilitator`, then in a transaction: lock the board, facilitator again, re-read the session through `$locked->voteSessions()`; open → `ValidationException::withMessages(['votes' => __('Close the vote first.')])`; `dismissed_at` already set → nothing; else `update(['dismissed_at' => now()])` and `(new WhiteboardChanged($locked->id))->sendToOthers()`. Answer `response()->noContent()`.

- [ ] **Step 8: Controllers, routes, snapshot**

```php
// WhiteboardVoteSessionsController
public function store(Request $request, Whiteboard $board, OpenWhiteboardVote $openWhiteboardVote): JsonResponse
{
    $member = WhiteboardMember::current($request);

    WhiteboardGuard::facilitator($board, $member);

    $validated = $request->validate([
        'votes_per_member' => ['required', 'integer', 'min:1', 'max:20'],
        'frame_element_id' => ['nullable', 'string', 'regex:'.SanitizeWhiteboardElement::IdPattern],
        'allow_multiple' => ['required', 'boolean'],
    ]);

    $session = $openWhiteboardVote->handle(
        $board,
        $member,
        (int) $validated['votes_per_member'],
        $validated['frame_element_id'] ?? null,
        $request->boolean('allow_multiple'),
    );

    return response()->json(['id' => $session->id], 201);
}

public function show(Request $request, Whiteboard $board, WhiteboardVoteSession $voteSession, PresentWhiteboardVoting $presentWhiteboardVoting): JsonResponse
{
    return response()->json($presentWhiteboardVoting->session($voteSession, WhiteboardMember::current($request)));
}

// WhiteboardVotesController
public function update(Request $request, Whiteboard $board, WhiteboardVoteSession $voteSession, string $elementId, CastWhiteboardVote $castWhiteboardVote): JsonResponse
{
    $member = WhiteboardMember::current($request);

    $validated = $request->validate([
        'count' => ['required', 'integer', 'min:0', 'max:20'],
    ]);

    return response()->json($castWhiteboardVote->handle($board, $voteSession, $member, $elementId, (int) $validated['count']));
}
```

`WhiteboardVoteClosuresController::store(Request, Whiteboard $board, WhiteboardVoteSession $voteSession, CloseWhiteboardVote): Response` — member, `WhiteboardGuard::facilitator($board, $member)`, the action, `response()->noContent()`.

Routes, in the `whiteboards/{board}` group (it has `scopeBindings()`, so `{voteSession}` is resolved through `$board->voteSessions()` and another board's session is a 404):

```php
Route::post('vote-sessions', [WhiteboardVoteSessionsController::class, 'store'])->name('whiteboards.voteSessions.store');
Route::get('vote-sessions/{voteSession}', [WhiteboardVoteSessionsController::class, 'show'])->name('whiteboards.voteSessions.show')->whereUuid('voteSession');
Route::put('vote-sessions/{voteSession}/votes/{elementId}', [WhiteboardVotesController::class, 'update'])->name('whiteboards.voteSessions.votes.update')->whereUuid('voteSession')->where('elementId', '[A-Za-z0-9_-]{1,40}')->middleware('throttle:whiteboard-writes');
Route::post('vote-sessions/{voteSession}/close', [WhiteboardVoteClosuresController::class, 'store'])->name('whiteboards.voteSessions.close.store')->whereUuid('voteSession');
Route::post('vote-sessions/{voteSession}/dismiss', [WhiteboardVoteDismissalsController::class, 'store'])->name('whiteboards.voteSessions.dismiss.store')->whereUuid('voteSession');
```

`BuildWhiteboardSnapshot`: inject `PresentWhiteboardVoting`; after `seq` add `'voting' => $this->presentWhiteboardVoting->current($board, $viewer)` and `'votingHistory' => $this->presentWhiteboardVoting->history($board, $viewer)`; import the `Voting` and `PastVote` types into the `Snapshot` type.

- [ ] **Step 9: Translation keys**

| Key (English) | French | German | Spanish |
|---|---|---|---|
| A vote is already open. | Un vote est déjà en cours. | Es läuft bereits eine Abstimmung. | Ya hay una votación abierta. |
| This vote is closed. | Ce vote est clos. | Diese Abstimmung ist geschlossen. | Esta votación está cerrada. |
| Choose a frame of this board. | Choisissez un cadre de ce tableau. | Wählen Sie einen Rahmen dieses Boards. | Elige un marco de esta pizarra. |
| There are no sticky notes to vote on. | Il n'y a aucun post-it sur lequel voter. | Es gibt keine Haftnotizen, über die abgestimmt werden kann. | No hay notas adhesivas sobre las que votar. |
| Only one vote per note is allowed. | Un seul vote par post-it est autorisé. | Pro Haftnotiz ist nur eine Stimme erlaubt. | Solo se permite un voto por nota. |
| This note is not part of the vote. | Ce post-it ne fait pas partie du vote. | Diese Haftnotiz gehört nicht zur Abstimmung. | Esta nota no forma parte de la votación. |
| Close the vote first. | Clôturez d'abord le vote. | Schließen Sie zuerst die Abstimmung. | Cierra primero la votación. |
| You have no votes left. | exists | exists | exists |

- [ ] **Step 10: Run the tests**

Run: `DB_HOST=127.0.0.1 php artisan test --compact tests/Feature/Whiteboards tests/Feature/TranslationKeysTest.php`
Expected: PASS.

- [ ] **Step 11: Gates and commit**

Run: `vendor/bin/pint --dirty --format agent` and `vendor/bin/phpstan analyse --memory-limit=1G app/Actions/Whiteboards/PresentWhiteboardVoting.php app/Actions/Whiteboards/OpenWhiteboardVote.php app/Actions/Whiteboards/CastWhiteboardVote.php app/Actions/Whiteboards/CloseWhiteboardVote.php app/Actions/Whiteboards/WhiteboardGuard.php app/Actions/Whiteboards/BuildWhiteboardSnapshot.php app/Events/Whiteboards app/Http/Controllers/Whiteboards`.

```bash
git add app/Actions/Whiteboards/PresentWhiteboardVoting.php app/Actions/Whiteboards/OpenWhiteboardVote.php app/Actions/Whiteboards/CastWhiteboardVote.php app/Actions/Whiteboards/CloseWhiteboardVote.php app/Actions/Whiteboards/WhiteboardGuard.php app/Actions/Whiteboards/BuildWhiteboardSnapshot.php app/Events/Whiteboards/WhiteboardVoteChanged.php app/Events/Whiteboards/WhiteboardBroadcastEvent.php app/Http/Controllers/Whiteboards/WhiteboardVoteSessionsController.php app/Http/Controllers/Whiteboards/WhiteboardVotesController.php app/Http/Controllers/Whiteboards/WhiteboardVoteClosuresController.php app/Http/Controllers/Whiteboards/WhiteboardVoteDismissalsController.php routes/web.php lang/en.json lang/fr.json lang/de.json lang/es.json tests/Feature/Whiteboards/WhiteboardVotingTest.php tests/Feature/Whiteboards/WhiteboardVotingSecrecyTest.php tests/Feature/Whiteboards/WhiteboardEventsTest.php
git commit -m "feat(whiteboard): dot voting with secret votes until the close"
```

---

### Task 4: Voting and element writes — text freeze, refund, no vote in a copy

**Files:**
- Modify: `app/Actions/Whiteboards/WriteWhiteboardElements.php`
- Test: `tests/Feature/Whiteboards/WhiteboardVotingWritesTest.php`

**Interfaces:**
- Consumes: `WhiteboardVoteSession::isTarget(?WhiteboardElement): bool`, `Whiteboard::voteSessions()`, `PresentWhiteboardVoting::finishedCount(WhiteboardVoteSession): int`, `WhiteboardVoteChanged`, `WhiteboardBroadcastEvent::sendToAll()`, `WhiteboardGuard::notLocked()` (already called in `handle`, Task 2), routes `whiteboards.elements.update`, `whiteboards.duplicate.store`, `whiteboards.template.store`, `whiteboards.voteSessions.show`.
- Produces: `WriteWhiteboardElements::handle()` keeps its signature and result shape; it now rejects with reason `voting`, refunds votes, and no longer loses an element whose id is `"0"`. Nothing new for later tasks; the client learns the reason `voting` in Task 5.

The rule, in stored-data terms (spec §11.4). While the board has an open session:

- A **candidate** is an incoming element of type `text` whose container — the incoming `containerId` or the stored copy's — was a target of the session when the batch began.
- Candidates are handled **after** every other element of the batch. A candidate is rejected with `voting` when its container is still a target at that point **and** the write changes the words: `text` or `originalText ?? text` differ once all whitespace is removed, or `containerId` differs, or `isDeleted` differs, or there is no stored copy (a new text on the note).
- So: an edit, a lone deletion of the text, a new or re-bound text are refused; a move, a restyle, a re-wrap pass; deleting the note with its text passes in either order (the note is no longer a target when the text is looked at); the undo passes in either order (the note was not a target when the batch began).
- When an accepted write makes a note that was a target stop being one (deleted, or no longer a sticky), its votes in the open session are deleted. After the batch, if any row was deleted, `vote.changed` goes to everyone, the writer included, with the new `finishedCount`.
- The facilitator is not exempt. A closed session freezes nothing.

Facts checked: the canvas re-wraps a bound text when its container is resized — `wrapText()` splits the original into lines and joins them with `\n`, changing whitespace only (`node_modules/@excalidraw/excalidraw/dist/dev/chunk-4FTI6OG3.js`, `var wrapText`), and keeps the unwrapped words in `originalText`; built-in templates store `originalText` (`app/Support/WhiteboardTemplates/BuiltInTemplates.php:158`), but an element restored by the client gets one when it had none, hence the whitespace-blind comparison of `originalText ?? text`; `storedElements()` builds its id list with `->filter()`, which drops the id `"0"`; `WriteWhiteboardElements` is bound as a singleton (`AppServiceProvider`), so it must keep no state between calls.

- [ ] **Step 1: Write the failing tests**

`tests/Feature/Whiteboards/WhiteboardVotingWritesTest.php`:

```php
<?php

use App\Events\Whiteboards\WhiteboardElementsChanged;
use App\Events\Whiteboards\WhiteboardVoteChanged;
use App\Models\User;
use App\Models\Whiteboard;
use App\Models\WhiteboardElement;
use App\Models\WhiteboardTemplate;
use App\Models\WhiteboardVote;
use App\Models\WhiteboardVoteSession;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Storage;

beforeEach(function () {
    Storage::fake();
    Event::fake([WhiteboardElementsChanged::class, WhiteboardVoteChanged::class]);
});

/**
 * A board whose note "note" (words "Ship it") and note "kept" are under an
 * open vote. The member has put two votes on "note" and one on "kept" (the
 * whole budget); someone else has put one on "kept".
 *
 * @return array{0: Whiteboard, 1: User, 2: WhiteboardVoteSession, 3: array<string, mixed>, 4: array<string, mixed>}
 */
function boardUnderVote(): array
{
    $board = Whiteboard::factory()->create(['seq' => 1]);
    whiteboardFacilitator($board);
    [$user, $member] = whiteboardMember($board);
    [, $other] = whiteboardMember($board);
    [$note, $words] = whiteboardSticky($board, 'note', 'Ship it');
    whiteboardSticky($board, 'kept', 'Keep it');
    $session = openWhiteboardVote($board, ['allow_multiple' => true]);

    castWhiteboardVote($session, $member, 'note', 2);
    castWhiteboardVote($session, $member, 'kept', 1);
    castWhiteboardVote($session, $other, 'kept', 1);

    return [$board, $user, $session, $note->data, $words->data];
}

function writeDuringVote(mixed $test, Whiteboard $board, array $elements): mixed
{
    return $test->putJson(route('whiteboards.elements.update', $board), ['elements' => $elements]);
}

it('rejects a change of the words of a note under vote and hands back the stored text', function (array $change) {
    [$board, $user, , , $words] = boardUnderVote();

    writeDuringVote($this->actingAs($user), $board, [[...$words, 'version' => 2, ...$change]])
        ->assertOk()
        ->assertJsonPath('seq', 1)
        ->assertJsonPath('fromSeq', 1)
        ->assertJsonPath('rejected.0.id', 'note-text')
        ->assertJsonPath('rejected.0.reason', 'voting')
        ->assertJsonPath('rejected.0.element', $words);

    $stored = $board->elements()->where('element_id', 'note-text')->sole();

    expect($stored->data)->toEqual($words)
        ->and($stored->is_deleted)->toBeFalse()
        ->and(WhiteboardVote::query()->count())->toBe(3);

    Event::assertNotDispatched(WhiteboardElementsChanged::class);
    Event::assertNotDispatched(WhiteboardVoteChanged::class);
})->with([
    'new words' => [['text' => 'Ship it later', 'originalText' => 'Ship it later']],
    'new words behind the same original' => [['text' => 'Sink it']],
    'a new original behind the same words' => [['originalText' => 'Sink it']],
    'the text erased on its own' => [['isDeleted' => true]],
    'the text taken off the note' => [['containerId' => null]],
]);

it('rejects a new text and a re-bound text on a note under vote', function () {
    [$board, $user] = boardUnderVote();
    $loose = sceneElement(['id' => 'loose', 'type' => 'text', 'text' => 'Loose', 'originalText' => 'Loose']);
    WhiteboardElement::factory()->create([
        'whiteboard_id' => $board->id, 'element_id' => 'loose', 'type' => 'text', 'version_nonce' => 100, 'data' => $loose,
    ]);

    writeDuringVote($this->actingAs($user), $board, [
        sceneElement(['id' => 'extra', 'type' => 'text', 'text' => 'Also', 'originalText' => 'Also', 'containerId' => 'note']),
        [...$loose, 'version' => 2, 'containerId' => 'note'],
    ])
        ->assertOk()
        ->assertJsonPath('seq', 1)
        ->assertJsonCount(2, 'rejected')
        ->assertJsonPath('rejected.0', ['id' => 'extra', 'reason' => 'voting', 'element' => null])
        ->assertJsonPath('rejected.1.id', 'loose')
        ->assertJsonPath('rejected.1.reason', 'voting')
        ->assertJsonPath('rejected.1.element', $loose);

    expect($board->elements()->where('element_id', 'extra')->exists())->toBeFalse();
});

it('still lets a note under vote be moved, restyled and resized', function () {
    [$board, $user, , $note, $words] = boardUnderVote();

    writeDuringVote($this->actingAs($user), $board, [
        [...$words, 'version' => 2, 'x' => 405, 'width' => 60, 'text' => "Ship\nit", 'fontSize' => 16],
        [...$note, 'version' => 2, 'x' => 400, 'width' => 70, 'backgroundColor' => '#ffc9c9'],
    ])
        ->assertOk()
        ->assertJsonPath('rejected', [])
        ->assertJsonPath('seq', 3);

    $text = $board->elements()->where('element_id', 'note-text')->sole()->data;

    expect($text['text'])->toBe("Ship\nit")
        ->and($text['originalText'])->toBe('Ship it')
        ->and($board->elements()->where('element_id', 'note')->sole()->data['backgroundColor'])->toBe('#ffc9c9')
        ->and(WhiteboardVote::query()->count())->toBe(3);

    Event::assertNotDispatched(WhiteboardVoteChanged::class);
});

it('accepts the first move of a text stored without its original', function () {
    [$board, $user, , , $words] = boardUnderVote();
    $legacy = Arr::except($words, 'originalText');
    $board->elements()->where('element_id', 'note-text')->sole()->update(['data' => $legacy]);

    writeDuringVote($this->actingAs($user), $board, [[...$legacy, 'version' => 2, 'x' => 77, 'originalText' => 'Ship it']])
        ->assertOk()
        ->assertJsonPath('rejected', []);

    expect($board->elements()->where('element_id', 'note-text')->sole()->data['x'])->toBe(77);
});

it('freezes the words for the facilitator too', function () {
    [$board, , , , $words] = boardUnderVote();
    $facilitator = $board->facilitator->user;

    writeDuringVote($this->actingAs($facilitator), $board, [[...$words, 'version' => 2, 'text' => 'Mine', 'originalText' => 'Mine']])
        ->assertOk()
        ->assertJsonPath('rejected.0.reason', 'voting');
});

it('leaves a note added after the vote opened free to edit', function () {
    [$board, $user] = boardUnderVote();
    [, $late] = whiteboardSticky($board, 'late', 'Draft');

    writeDuringVote($this->actingAs($user), $board, [[...$late->data, 'version' => 2, 'text' => 'Final', 'originalText' => 'Final']])
        ->assertOk()
        ->assertJsonPath('rejected', []);

    expect($board->elements()->where('element_id', 'late-text')->sole()->data['text'])->toBe('Final');
});

it('frees the words again once the vote is closed', function () {
    [$board, $user, $session, , $words] = boardUnderVote();
    $session->update(['closed_at' => now(), 'results' => []]);

    writeDuringVote($this->actingAs($user), $board, [[...$words, 'version' => 2, 'text' => 'Later', 'originalText' => 'Later']])
        ->assertOk()
        ->assertJsonPath('rejected', []);
});

it('deletes a note under vote with its text, whatever their order, and refunds its votes', function (array $order) {
    [$board, $user, $session, $note, $words] = boardUnderVote();
    $batch = [
        'note' => [...$note, 'version' => 2, 'isDeleted' => true],
        'text' => [...$words, 'version' => 2, 'isDeleted' => true],
    ];

    writeDuringVote($this->actingAs($user), $board, array_map(fn (string $key): array => $batch[$key], $order))
        ->assertOk()
        ->assertJsonPath('rejected', [])
        ->assertJsonPath('seq', 3);

    expect($board->elements()->whereIn('element_id', ['note', 'note-text'])->where('is_deleted', true)->count())->toBe(2)
        ->and($session->votes()->where('element_id', 'note')->count())->toBe(0)
        ->and((int) $session->votes()->where('element_id', 'kept')->sum('count'))->toBe(2);

    Event::assertDispatchedTimes(WhiteboardVoteChanged::class, 1);
    Event::assertDispatched(WhiteboardVoteChanged::class, fn (WhiteboardVoteChanged $event) => $event->boardId === $board->id
        && $event->broadcastWith() === ['sessionId' => $session->id, 'finishedCount' => 0]);

    $this->actingAs($user)
        ->getJson(route('whiteboards.voteSessions.show', [$board, $session]))
        ->assertJsonPath('myVotes', [['elementId' => 'kept', 'count' => 1]])
        ->assertJsonPath('remaining', 2);
})->with([
    'the note first' => [['note', 'text']],
    'the text first' => [['text', 'note']],
]);

it('refunds once when the delete is sent twice', function () {
    [$board, $user, , $note, $words] = boardUnderVote();
    $batch = [[...$note, 'version' => 2, 'isDeleted' => true], [...$words, 'version' => 2, 'isDeleted' => true]];

    writeDuringVote($this->actingAs($user), $board, $batch)->assertOk()->assertJsonPath('seq', 3);
    writeDuringVote($this->actingAs($user), $board, $batch)
        ->assertOk()
        ->assertExactJson(['seq' => 3, 'fromSeq' => 3, 'rejected' => []]);

    Event::assertDispatchedTimes(WhiteboardVoteChanged::class, 1);
    Event::assertDispatchedTimes(WhiteboardElementsChanged::class, 1);
});

it('brings a deleted note back with its words and without its votes', function (array $order) {
    [$board, $user, $session, $note, $words] = boardUnderVote();

    writeDuringVote($this->actingAs($user), $board, [
        [...$note, 'version' => 2, 'isDeleted' => true],
        [...$words, 'version' => 2, 'isDeleted' => true],
    ])->assertJsonPath('rejected', []);

    $batch = ['note' => [...$note, 'version' => 3], 'text' => [...$words, 'version' => 3]];

    writeDuringVote($this->actingAs($user), $board, array_map(fn (string $key): array => $batch[$key], $order))
        ->assertOk()
        ->assertJsonPath('rejected', []);

    expect($board->elements()->whereIn('element_id', ['note', 'note-text'])->where('is_deleted', false)->count())->toBe(2)
        ->and($board->elements()->where('element_id', 'note-text')->sole()->data['text'])->toBe('Ship it')
        ->and($session->votes()->where('element_id', 'note')->count())->toBe(0);

    $this->actingAs($user)
        ->putJson(route('whiteboards.voteSessions.votes.update', [$board, $session, 'note']), ['count' => 1])
        ->assertOk()
        ->assertJsonPath('remaining', 1);
})->with([
    'the note first' => [['note', 'text']],
    'the text first' => [['text', 'note']],
]);

it('says nothing about votes when the deleted note had none or was not under vote', function () {
    [$board, $user] = boardUnderVote();
    [$late] = whiteboardSticky($board, 'late');
    [$unvoted] = whiteboardSticky($board, 'unvoted');
    WhiteboardVoteSession::query()->sole()->update(['element_ids' => ['note', 'kept', 'unvoted']]);

    writeDuringVote($this->actingAs($user), $board, [
        [...$late->data, 'version' => 2, 'isDeleted' => true],
        [...$unvoted->data, 'version' => 2, 'isDeleted' => true],
    ])->assertOk()->assertJsonPath('rejected', []);

    expect(WhiteboardVote::query()->count())->toBe(3);

    Event::assertNotDispatched(WhiteboardVoteChanged::class);
});

it('copies no vote into a duplicate or a template', function () {
    [$board, $user, $session] = boardUnderVote();

    $this->actingAs($user)->postJson(route('whiteboards.duplicate.store', $board))->assertCreated();
    $this->actingAs($user)->postJson(route('whiteboards.template.store', $board), ['name' => 'Voted'])->assertCreated();

    $copy = Whiteboard::query()->whereKeyNot($board->id)->sole();
    $template = WhiteboardTemplate::query()->sole();

    expect($copy->voteSessions()->count())->toBe(0)
        ->and(WhiteboardVoteSession::query()->count())->toBe(1)
        ->and(WhiteboardVote::query()->count())->toBe(3)
        ->and($session->fresh()->isOpen())->toBeTrue()
        ->and($copy->elements()->where('is_sticky', true)->count())->toBe(2)
        ->and(json_encode($template->scene))->not->toContain($session->id)
        ->and(json_encode($template->scene))->not->toContain('vote');

    $this->actingAs($user)
        ->getJson(route('whiteboards.snapshot.show', $copy))
        ->assertJsonPath('voting', null)
        ->assertJsonPath('votingHistory', []);

    $copiedWords = $copy->elements()->where('type', 'text')->get()->first(fn (WhiteboardElement $text) => $text->data['text'] === 'Ship it')->data;

    writeDuringVote($this->actingAs($user), $copy, [[...$copiedWords, 'version' => 2, 'text' => 'Free', 'originalText' => 'Free']])
        ->assertOk()
        ->assertJsonPath('rejected', []);
});

it('accepts a second write of an element whose id is 0', function () {
    $board = Whiteboard::factory()->create();
    [$user] = whiteboardMember($board);

    writeDuringVote($this->actingAs($user), $board, [sceneElement(['id' => '0'])])->assertOk()->assertJsonPath('rejected', []);
    writeDuringVote($this->actingAs($user), $board, [sceneElement(['id' => '0', 'version' => 2, 'x' => 5])])
        ->assertOk()
        ->assertJsonPath('rejected', []);

    expect($board->elements()->sole()->data['x'])->toBe(5);
});
```

- [ ] **Step 2: Run them and see them fail**

Run: `DB_HOST=127.0.0.1 php artisan test --compact tests/Feature/Whiteboards/WhiteboardVotingWritesTest.php`
Expected: FAIL — the text changes are accepted (no `voting` rejection), the votes of a deleted note stay, the second write of `"0"` answers 500 (unique violation). "copies no vote into a duplicate or a template", "leaves a note added after the vote opened free to edit" and "frees the words again" are expected to PASS already: they pin what must stay true.

- [ ] **Step 3: Implement in `WriteWhiteboardElements`**

Constructor: add `private PresentWhiteboardVoting $presentWhiteboardVoting`. The class stays stateless.

`handle()`: after `WhiteboardGuard::notLocked($locked, $member)` and the existing reads, add

```php
$session = $locked->voteSessions()->whereNull('closed_at')->first();
$stored = $this->storedElements($locked, $rawElements, $session !== null);
$targetsBefore = $this->targets($session, $stored);
$refunded = 0;
```

and turn the `foreach` into a queue, so that a candidate is looked at after everything else:

```php
$queue = array_map(fn (mixed $raw): array => [$raw, true], array_values($rawElements));

while ($queue !== []) {
    [$raw, $mayDefer] = array_shift($queue);

    // unchanged: sanitize, the `invalid` rejection, `$existing`, `isSameWrite`

    if ($mayDefer && $this->isWordsOfTarget($existing, $element, $targetsBefore)) {
        $queue[] = [$raw, false];

        continue;
    }

    $reason = $this->refusal($existing, $element, $isFacilitator, $fileIds, $liveCount);

    if ($reason === null && ! $mayDefer && $session !== null && $this->changesWordsOfTarget($session, $stored, $targetsBefore, $existing, $element)) {
        $reason = 'voting';
    }

    // unchanged: the rejection when `$reason !== null`, `$liveCount`, `$seq++`, `save`, `$stored->put`, `$accepted`

    if ($session !== null && isset($targetsBefore[$element['id']]) && ! $session->isTarget($saved)) {
        $refunded += $session->votes()->where('element_id', $element['id'])->delete();
    }
}
```

`stale`, `locked`, `file` and `full` keep precedence over `voting` (a stale write converges silently, as before). After `$locked->update(['seq' => $seq])` and the `WhiteboardElementsChanged` broadcast:

```php
if ($session !== null && $refunded > 0) {
    (new WhiteboardVoteChanged($locked->id, $session->id, $this->presentWhiteboardVoting->finishedCount($session)))->sendToAll();
}
```

A replayed batch stops at `isSameWrite` and therefore refunds nothing twice. New private methods:

```php
/**
 * @param  Collection<string, WhiteboardElement>  $stored
 * @return array<int|string, true>
 */
private function targets(?WhiteboardVoteSession $session, Collection $stored): array
{
    if ($session === null) {
        return [];
    }

    $targets = [];

    foreach ($stored as $element) {
        if ($session->isTarget($element)) {
            $targets[$element->element_id] = true;
        }
    }

    return $targets;
}

/**
 * @param  array<string, mixed>  $element
 * @return list<string>
 */
private function containerIds(?WhiteboardElement $existing, array $element): array
{
    return array_values(array_unique(array_filter(
        [$element['containerId'] ?? null, $existing?->data['containerId'] ?? null],
        fn (mixed $id): bool => is_string($id),
    )));
}

/**
 * @param  array<string, mixed>  $element
 * @param  array<int|string, true>  $targetsBefore
 */
private function isWordsOfTarget(?WhiteboardElement $existing, array $element, array $targetsBefore): bool
{
    if ($element['type'] !== 'text') {
        return false;
    }

    foreach ($this->containerIds($existing, $element) as $containerId) {
        if (isset($targetsBefore[$containerId])) {
            return true;
        }
    }

    return false;
}

/**
 * The note was under vote when the batch began and still is: its words
 * may not change (spec §11.4). Deleting the note with its text, or
 * bringing both back, is not a change of words.
 *
 * @param  Collection<string, WhiteboardElement>  $stored
 * @param  array<int|string, true>  $targetsBefore
 * @param  array<string, mixed>  $element
 */
private function changesWordsOfTarget(WhiteboardVoteSession $session, Collection $stored, array $targetsBefore, ?WhiteboardElement $existing, array $element): bool
{
    $underVote = false;

    foreach ($this->containerIds($existing, $element) as $containerId) {
        if (isset($targetsBefore[$containerId]) && $session->isTarget($stored->get($containerId))) {
            $underVote = true;
        }
    }

    if (! $underVote) {
        return false;
    }

    if ($existing === null) {
        return true;
    }

    $before = $existing->data;

    return $this->letters($before['text'] ?? null) !== $this->letters($element['text'] ?? null)
        || $this->letters($before['originalText'] ?? $before['text'] ?? null) !== $this->letters($element['originalText'] ?? $element['text'] ?? null)
        || ($before['containerId'] ?? null) !== ($element['containerId'] ?? null)
        || $existing->is_deleted !== $element['isDeleted'];
}

private function letters(mixed $text): string
{
    return (string) preg_replace('/\s+/u', '', is_string($text) ? $text : '');
}
```

`storedElements()` gains a third parameter and loads the containers the freeze needs; its id list no longer drops `"0"`:

```php
/**
 * @param  array<int, mixed>  $rawElements
 * @return Collection<string, WhiteboardElement>
 */
private function storedElements(Whiteboard $board, array $rawElements, bool $withContainers): Collection
{
    $ids = collect($rawElements)
        ->map(fn (mixed $raw): ?string => $this->rawId($raw))
        ->filter(fn (?string $id): bool => $id !== null)
        ->unique()
        ->values();

    $stored = $board->elements()->whereIn('element_id', $ids)->get()->keyBy('element_id');

    if (! $withContainers) {
        return $stored;
    }

    $containerIds = collect($rawElements)
        ->map(fn (mixed $raw): mixed => is_array($raw) ? ($raw['containerId'] ?? null) : null)
        ->merge($stored->map(fn (WhiteboardElement $element): mixed => $element->data['containerId'] ?? null)->values())
        ->filter(fn (mixed $id): bool => is_string($id) && preg_match(SanitizeWhiteboardElement::IdPattern, $id) === 1 && ! $stored->has($id))
        ->unique()
        ->values();

    if ($containerIds->isEmpty()) {
        return $stored;
    }

    return $stored->union($board->elements()->whereIn('element_id', $containerIds)->get()->keyBy('element_id'));
}
```

Imports: `App\Events\Whiteboards\WhiteboardVoteChanged`, `App\Models\WhiteboardVoteSession`. Keep the rest of the class as it is (`refusal`, `isStale`, `touchesLock`, `liveDelta`, `save`, `rejection`, `broadcastable`).

- [ ] **Step 4: Run the tests**

Run: `DB_HOST=127.0.0.1 php artisan test --compact tests/Feature/Whiteboards`
Expected: PASS — in particular `WhiteboardElementWritesTest` unchanged (the order of `rejected` and of `seq` is the batch order whenever no vote is open, because nothing is deferred).

- [ ] **Step 5: Gates and commit**

Run: `vendor/bin/pint --dirty --format agent` and `vendor/bin/phpstan analyse --memory-limit=1G app/Actions/Whiteboards/WriteWhiteboardElements.php`.

```bash
git add app/Actions/Whiteboards/WriteWhiteboardElements.php tests/Feature/Whiteboards/WhiteboardVotingWritesTest.php
git commit -m "feat(whiteboard): freeze the words of notes under vote and refund deleted notes"
```

**Translation keys added by this task:** none (`voting` is a reason code; its message is added with the client in Task 5).

**Hooks for plan 17d (named, not built):**
- *Private writing on:* `PATCH settings` with `private_writing: true` must be refused while a vote is open — call `WhiteboardGuard::noOpenVoteSession($locked)` under the board lock in `WhiteboardSettingsController::update`.
- *Opening a vote while private writing is on:* `WhiteboardGuard::notPrivateWriting($locked)` right after `noOpenVoteSession` in `OpenWhiteboardVote::handle` (Task 3, Step 5, point 3).
- *The `private` refusal of an element write:* next to the `voting` refusal in the loop of `WriteWhiteboardElements::handle`, after `refusal()`; it applies to the note and to its text and, unlike `voting`, needs no deferral.
- *Restore:* the restore action writes rows itself, not through `WriteWhiteboardElements`, so the text freeze and the refund do not run for it. Inside its board lock and before it writes, it must end the voting state as spec §9 says: set `closed_at = now()`, `results = []` on the open session and delete its votes; set `dismissed_at` on a closed, undismissed session. It should also set `dismissed_at` on the session it has just closed without results, otherwise `PresentWhiteboardVoting::currentSession()` shows every member an empty results panel. Then `board.changed` as usual.
- *Results text and masked notes:* `CloseWhiteboardVote::label()` reads the real text of a note; votes cannot be open while private writing is on, so no masked text can reach `results`.
- *Templates, duplicate, versions:* they copy elements only (`ReadWhiteboardScene`), never a session or a vote; "copies no vote into a duplicate or a template" pins it, and a version's `scene` holds elements only.

---

### Task 5: Board state, countdown, lock and hand-over in the browser

No test runner: this task is checked by the gates and by the browser checks below. The code is a proposal, not run; every library name was read in `node_modules/@excalidraw/excalidraw/dist/types/excalidraw/types.d.ts` and every behaviour in `dist/dev/index.js`, as cited.

**Files:**
- Create: `resources/js/hooks/use-whiteboard-request.ts`, `resources/js/components/whiteboard/facilitator-bar.tsx`, `resources/js/components/whiteboard/status-bar.tsx`, `resources/js/components/whiteboard/hand-over-dialog.tsx`
- Modify: `resources/js/lib/whiteboard/types.ts`, `resources/js/lib/whiteboard/scene-sync.ts`, `resources/js/lib/whiteboard/files.ts`, `resources/js/hooks/use-whiteboard-channel.ts`, `resources/js/hooks/use-whiteboard.ts`, `resources/js/components/whiteboard/board.tsx`, `resources/js/components/whiteboard/board-menu.tsx`, `resources/js/components/whiteboard/top-bar.tsx`, `resources/css/app.css`, `lang/{en,fr,de,es}.json`

**Interfaces:**
- Consumes: the snapshot of Tasks 1–3; Wayfinder (after `npm run build`) `WhiteboardTimersController.update(boardId)` → `{timerEndsAt}`, `WhiteboardSettingsController.update(boardId)`, `WhiteboardFacilitatorsController.update(boardId)`, `WhiteboardVoteSessionsController.show({board, voteSession})` → `WhiteboardVoting`; events `timer.changed` `{timerEndsAt}`, `vote.changed` `{sessionId, finishedCount}`; the 403 with `errors.locked`; `TimerDisplay({endsAt, offset})` of `resources/js/components/retro/timer-display.tsx` (it shows the countdown, then "Time's up!", toasts and plays the sound once); `useServerOffset(serverTime)` of `resources/js/hooks/use-countdown.ts`; `retroRequest`, `RetroRequestError` (`status`, `message`, `errors`).
- Produces (used by Tasks 6 and 7):
  - Types in `resources/js/lib/whiteboard/types.ts`:

```ts
export type VoteCount = { elementId: string; count: number };
export type VoteResult = { elementId: string; text: string; count: number };
export type VoteTally = { myVotes: VoteCount[]; remaining: number; finishedCount: number };
export type WhiteboardVoting = {
    id: string;
    open: boolean;
    votesPerMember: number;
    allowMultiple: boolean;
    frameElementId: string | null;
    elementIds: string[];
    myVotes: VoteCount[];
    remaining: number;
    finishedCount: number | null;
    results: VoteResult[] | null;
};
export type PastVote = { id: string; closedAt: string; results: VoteResult[] };
export type TransferCandidate = { userId: string; name: string };
```

    `WhiteboardSnapshot['board']` gains `locked: boolean; followEnabled: boolean; timerEndsAt: string | null`; `me` gains `transferCandidates: TransferCandidate[]`; the snapshot gains `voting: WhiteboardVoting | null; votingHistory: PastVote[]`; `RejectReason` gains `'voting'`.
  - `WhiteboardState` (from `useWhiteboard`) gains `serverOffset: number`, `setTimer(timerEndsAt: string | null): void`, `applyTally(sessionId: string, tally: VoteTally): void`; `state.snapshot` gains `voting` and `votingHistory`.
  - `useWhiteboardRequest(): <T>(request: Promise<T>) => Promise<T | undefined>` — resolves to the response, or to `undefined` after a toast saying why it failed.
  - `FacilitatorBar({ state }: { state: WhiteboardState })`, `StatusBar({ children }: { children: ReactNode })` (renders nothing when it has no child).
  - `SceneSyncDeps.onLocked: () => void`.
  - On the canvas wrapper: class `relative` and the attribute `data-facilitator="true|false"`.

Facts checked: the canvas takes `viewModeEnabled?: boolean` (`types.d.ts:436`); while the prop is `undefined` the user's own "View mode" toggle exists (`predicate: typeof appProps.viewModeEnabled === "undefined"`, `index.js:21591`), and a change of the prop is copied into the state with `!!` (`index.js:30485`), so `true` → `undefined` leaves view mode; in view mode the shapes toolbar is not rendered (`index.js:21182`), "Clear canvas" is hidden (`index.js:5792`) and a drag pans; the context menu is an inline `<ul class="context-menu">` whose items are `<li data-testid="{action name}">` (`index.js:14104–14131`), the lock actions being `toggleElementLock` and `unlockAllElements` (`index.js:9135`, `9190`); `scene-sync.ts` treats 401, 403, 404 and 419 as fatal (`FatalStatuses`), and `files.ts` throws `RetroRequestError(status, 'upload refused')` for them without reading the body; `use-whiteboard.ts` sends every event that is not `board.*` to `onElementsChanged`, so new events must be routed by name.

- [ ] **Step 1: Types** — edit `resources/js/lib/whiteboard/types.ts` as listed under "Produces".

- [ ] **Step 2: Channel and board state**

`use-whiteboard-channel.ts`: add `'timer.changed'` and `'vote.changed'` to `WhiteboardEvents`.

`use-whiteboard.ts`:
- `BoardMeta = Pick<WhiteboardSnapshot, 'board' | 'me' | 'members' | 'links' | 'voting' | 'votingHistory'>`.
- Clock offset: `const initialOffset = useServerOffset(initial.serverTime); const [measuredOffset, setMeasuredOffset] = useState<number | null>(null);` and expose `serverOffset: measuredOffset ?? initialOffset`. The initial value is late by the time the page took to load; every `refetch` measures again around the request (the channel's first `here` triggers one moments after the page opens):

```ts
const sentAt = Date.now();
const epoch = voteEpoch.current;
const fresh = await retroRequest<WhiteboardSnapshot>(WhiteboardSnapshotsController.show(boardId));

if (request !== latestRefetch.current) {
    return;
}

setMeasuredOffset(new Date(fresh.serverTime).getTime() - (sentAt + Date.now()) / 2);
setSnapshot((current) => ({
    board: fresh.board,
    me: fresh.me,
    members: fresh.members,
    links: fresh.links,
    // A vote answered while this snapshot travelled is newer than it.
    voting:
        epoch !== voteEpoch.current &&
        fresh.voting?.open &&
        current.voting?.open &&
        current.voting.id === fresh.voting.id
            ? current.voting
            : fresh.voting,
    votingHistory: fresh.votingHistory,
}));
```

- `const voteEpoch = useRef(0);` and `const tallyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);` with an effect that clears the timer on unmount.
- `setTimer`: `setSnapshot((current) => ({ ...current, board: { ...current.board, timerEndsAt } }))`.
- `applyTally(sessionId, tally)`: `voteEpoch.current += 1`, then, when `current.voting?.id === sessionId && current.voting.open`, `voting: { ...current.voting, ...tally }`.
- Events, by name, in `onEvent`:

```ts
if (name === 'timer.changed') {
    setTimer((payload as { timerEndsAt: string | null }).timerEndsAt);

    return;
}

if (name === 'vote.changed') {
    onVoteChanged(payload as { sessionId: string; finishedCount: number });

    return;
}

if (name === 'elements.changed') {
    listeners.current?.onElementsChanged(payload as ElementsChangedPayload);
}
```

- `onVoteChanged({ sessionId, finishedCount })`: set `finishedCount` on the open session with that id; then, unless one is already scheduled, schedule in 1 500 ms one fetch of the viewer's own state — the event does not say who voted (spec §12):

```ts
const fetchTally = async (sessionId: string) => {
    const epoch = voteEpoch.current;

    try {
        const fresh = await retroRequest<WhiteboardVoting>(
            WhiteboardVoteSessionsController.show({ board: boardId, voteSession: sessionId }),
        );

        if (epoch !== voteEpoch.current) {
            return;
        }

        setSnapshot((current) => (current.voting?.id === fresh.id ? { ...current, voting: fresh } : current));
    } catch {
        // The next event or board.changed catches up.
    }
};
```

- Return `serverOffset`, `setTimer`, `applyTally` with the rest.

- [ ] **Step 3: `useWhiteboardRequest`**

```ts
export function useWhiteboardRequest() {
    const { t } = useTrans();

    return useCallback(
        async <T>(request: Promise<T>): Promise<T | undefined> => {
            try {
                return await request;
            } catch (error) {
                toast.error(
                    error instanceof RetroRequestError && error.status > 0
                        ? error.message
                        : t('Something went wrong. Please try again.'),
                );

                return undefined;
            }
        },
        [t],
    );
}
```

A 204 resolves to `null`, a failure to `undefined`: callers test `=== undefined`. `board-menu.tsx` keeps its own `attempt` and `run`.

- [ ] **Step 4: The locked refusal in the sync** (`scene-sync.ts`, `files.ts`)

`files.ts`: for `AccessStatuses`, read the body so that `errors` survives:

```ts
if (AccessStatuses.includes(response.status)) {
    const payload = (await response.json().catch(() => null)) as { errors?: Record<string, string[]> } | null;

    throw new RetroRequestError(response.status, 'upload refused', payload?.errors ?? {});
}
```

`scene-sync.ts`: add `onLocked: () => void` to `SceneSyncDeps`, and

```ts
const isLocked = (error: unknown): error is RetroRequestError =>
    error instanceof RetroRequestError && error.status === 403 && 'locked' in error.errors;
```

A closure flag `let discarding = false;` and

```ts
/** The board is locked for us: what we have not sent is dropped (spec §11.2). */
const discard = () => {
    pending.clear();
    discarding = true;
    recover();
};
```

In `replaceScene`, the local elements the server does not hold are kept only when nothing is being discarded:

```ts
const keepsLocal = (element: SceneElement) =>
    !discarding && (pending.has(element.id) || !known.has(element.id));

setScene(
    scene().map((element) =>
        alive.has(element.id) || keepsLocal(element) ? element : { ...element, isDeleted: true },
    ),
);
```

(the two lines after it, `remember(...)` and `force(snapshot.elements)`, stay: they stamp the local tombstones as known, so they are never sent, and put the server's copy over every local one). In the success branch of `recover()`, next to `recoveryOwed = false`, add `discarding = false;`. In the `catch` of `flush`, **before** `isFatal`:

```ts
if (isLocked(error)) {
    failed = false;
    discard();
    deps.onLocked();

    return;
}
```

The batch was already taken out of `pending` and is not requeued. `isLocked` must come first: 403 is in `FatalStatuses`, and falling through would show "Your access to this board has ended".

- [ ] **Step 5: `FacilitatorBar` and `StatusBar`**

`status-bar.tsx`:

```tsx
export function StatusBar({ children }: { children: ReactNode }) {
    if (Children.toArray(children).length === 0) {
        return null;
    }

    return (
        <div role="status" className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b bg-muted/40 px-4 py-1.5 text-sm">
            {children}
        </div>
    );
}
```

It is a row in the page flow between the top bar and the canvas, so it covers nothing; the canvas resizes itself.

`facilitator-bar.tsx`: `<div role="toolbar" aria-label={t('Facilitation tools')} className="flex items-center gap-1">` holding, in this task:
- **Timer:** a copy of `resources/js/components/retro/timer-control.tsx` (same `DropdownMenu`, `AlarmClock` trigger with `aria-label={t('Timer')}`, items `t(':count min', { count })` for 1, 3, 5 and 10 minutes, a separator, `t('Stop timer')` disabled while `board.timerEndsAt === null`). An item runs `const response = await request(retroRequest<{ timerEndsAt: string | null }>(WhiteboardTimersController.update(board.id), { seconds }))` and, when it is not `undefined`, `state.setTimer(response.timerEndsAt)`.
- **Lock:** `<Button size="sm" variant={board.locked ? 'default' : 'outline'} aria-pressed={board.locked} aria-label={t(board.locked ? 'Unlock the board' : 'Lock the board')} title={…same…}>` with `Lock` / `LockOpen` from `lucide-react`; on click `request(retroRequest(WhiteboardSettingsController.update(board.id), { locked: !board.locked }))`, then `state.refetch()` when it went through.

- [ ] **Step 6: `board.tsx`**

- `const { board, me } = state.snapshot; const viewOnly = board.locked && !me.isFacilitator;`
- `rejectionMessages`: add `voting: ''` to the initial value and `voting: t('Notes cannot be edited while a vote is open.')` to the assignment.
- `createSceneSync({ …, onLocked })` with `onLocked: () => { toast.error(lockedMessage.current, { id: 'locked' }); void refetch(); }`, where `lockedMessage` is a ref refreshed on each render with `t('This board is locked.')` (as `rejectionMessages` is) and `refetch` is `state.refetch` (stable, added to the effect's dependencies). The refetch makes the client learn the lock even when it missed `board.changed`.
- Top bar children, in this order: `<TimerDisplay endsAt={board.timerEndsAt} offset={state.serverOffset} />`, `{me.isFacilitator && <FacilitatorBar state={state} />}`, the sticky tool fallback now `{api && !toolbarSlot && !viewOnly && <StickyTool api={api} />}`, `<BoardMenu … />`. In `top-bar.tsx` the header becomes `flex flex-wrap items-center gap-x-3 gap-y-2 border-b px-4 py-2` so that the tools wrap under the title on a narrow screen.
- After `<ConnectionBanner />`:

```tsx
<StatusBar>
    {viewOnly && (
        <span className="flex items-center gap-1.5">
            <Lock className="size-4" aria-hidden="true" />
            {t('This board is locked.')}
        </span>
    )}
</StatusBar>
```

- Canvas wrapper: `<div ref={canvas} className="whiteboard-canvas relative min-h-0 flex-1" data-facilitator={me.isFacilitator}>`.
- `<Excalidraw viewModeEnabled={viewOnly ? true : undefined} … />`. Not `false`: that would remove the user's own view-mode toggle on an unlocked board.

- [ ] **Step 7: Lock entries of the context menu** — in the board block of `resources/css/app.css`:

```css
/*
 * Only the facilitator may lock or unlock an element (spec §11.2). The
 * context menu of Excalidraw 0.18.1 names its entries by action; the
 * keyboard shortcut cannot be removed, and the server rejects what it does.
 */
.whiteboard-canvas[data-facilitator='false'] .context-menu li[data-testid='toggleElementLock'],
.whiteboard-canvas[data-facilitator='false'] .context-menu li[data-testid='unlockAllElements'] {
    display: none !important;
}
```

- [ ] **Step 8: Hand-over dialog**

`hand-over-dialog.tsx` — `HandOverDialog({ state, open, onOpenChange }: { state: WhiteboardState; open: boolean; onOpenChange: (open: boolean) => void })`, the structure of `resources/js/components/poker/transfer-dialog.tsx`: title `t('Hand over facilitation')`; when `state.snapshot.me.transferCandidates` is empty the sentence `t('No one else can facilitate this board yet.')` and only "Cancel"; otherwise a `Label` `t('New facilitator')` (`htmlFor="whiteboard-new-facilitator"`) and a `Select` of the candidates (value `userId`, text `name`), footer `t('Cancel')` and `t('Hand over')` (disabled while busy or nothing chosen). Submit: `const done = await request(retroRequest(WhiteboardFacilitatorsController.update(board.id), { user_id: userId }))`; when not `undefined`, `await state.refetch()` and close. A failure leaves the dialog open (spec §13). Mount the body only while `open`, so the choice resets.

`board-menu.tsx`: in the facilitator block, after "Rename", `<DropdownMenuItem onSelect={() => setHandingOver(true)}>{t('Hand over facilitation')}</DropdownMenuItem>`, with `const [handingOver, setHandingOver] = useState(false)` and `<HandOverDialog state={state} open={handingOver} onOpenChange={setHandingOver} />` beside the other dialogs. "Take control" stays as it is for the others.

- [ ] **Step 9: Translation keys**

| Key (English) | French | German | Spanish |
|---|---|---|---|
| Facilitation tools | Outils d'animation | Moderationswerkzeuge | Herramientas de facilitación |
| Lock the board | Verrouiller le tableau | Board sperren | Bloquear la pizarra |
| Unlock the board | Déverrouiller le tableau | Board entsperren | Desbloquear la pizarra |
| Notes cannot be edited while a vote is open. | Les post-it ne peuvent pas être modifiés pendant un vote. | Haftnotizen können während einer Abstimmung nicht bearbeitet werden. | Las notas no se pueden editar mientras hay una votación abierta. |
| No one else can facilitate this board yet. | Personne d'autre ne peut encore animer ce tableau. | Noch kann niemand sonst dieses Board moderieren. | Nadie más puede facilitar esta pizarra todavía. |
| This board is locked. | exists (Task 2) | exists | exists |
| Timer, :count min, Stop timer, Time's up!, Hand over facilitation, New facilitator, Hand over, Cancel, Something went wrong. Please try again. | exist | exist | exist |

- [ ] **Step 10: Gates and commit**

Run: `npm run build && npm run types:check && npx vp check resources/js/lib/whiteboard resources/js/hooks/use-whiteboard.ts resources/js/hooks/use-whiteboard-channel.ts resources/js/hooks/use-whiteboard-request.ts resources/js/components/whiteboard && DB_HOST=127.0.0.1 php artisan test --compact tests/Feature/TranslationKeysTest.php`
Expected: no error in these files; test PASS.

```bash
git add resources/js/lib/whiteboard/types.ts resources/js/lib/whiteboard/scene-sync.ts resources/js/lib/whiteboard/files.ts resources/js/hooks/use-whiteboard.ts resources/js/hooks/use-whiteboard-channel.ts resources/js/hooks/use-whiteboard-request.ts resources/js/components/whiteboard/facilitator-bar.tsx resources/js/components/whiteboard/status-bar.tsx resources/js/components/whiteboard/hand-over-dialog.tsx resources/js/components/whiteboard/board.tsx resources/js/components/whiteboard/board-menu.tsx resources/js/components/whiteboard/top-bar.tsx resources/css/app.css lang/en.json lang/fr.json lang/de.json lang/es.json
git commit -m "feat(whiteboard): countdown, board lock and hand-over on the board page"
```

**Browser checks:**
- B5.1 Facilitator: the top bar shows a timer button and a lock button; a member and a guest see neither. Nothing new lies over the canvas, its shapes toolbar, its bottom controls or the reactions bar, at 1280 px and at 375 px.
- B5.2 Facilitator starts "1 min": within a second every browser shows the same countdown in the top bar (compare A and B: at most one second apart); at zero each shows "Time's up!", a toast, and plays the sound. "Stop timer" removes it everywhere. A browser that opens the board mid-countdown shows the right remaining time.
- B5.3 Facilitator locks: B's canvas loses its shapes toolbar and the sticky tool, a drag pans, the status row says "This board is locked."; B can still pan, zoom and send a reaction. A can still draw and B sees it. Unlock: B's tools come back without a reload.
- B5.4 From B's console on a locked board, `fetch` a `PUT /whiteboards/<id>/elements` with one element and the XSRF header: 403, body `errors.locked`; the page stays on the board (no "Your access to this board has ended"), shows the toast "This board is locked.", and the element is not in `GET snapshot`.
- B5.5 B starts typing in a text, A locks while B types: B's unsent text disappears, B stays on the board in view mode, and A's canvas never shows it.
- B5.6 A locks a shape (context menu). B right-clicks it and the canvas: no "Lock" / "Unlock" / "Unlock all elements" entry; B drags the shape: it returns to its place and the toast "Only the facilitator can change a locked element." shows. A still sees the entries.
- B5.7 Board menu of A: "Hand over facilitation" lists the other team members by name; choosing one makes them facilitator in both browsers without a reload (their top bar gains the tools, A's loses them). With nobody else in the team the dialog says "No one else can facilitate this board yet.". A guest never appears in the list.
- B5.8 The canvas's own "View mode" entry (context menu on the empty canvas) is still there on an unlocked board.

---

### Task 6: Follow-me

Proposal, not run. Names checked: `ExcalidrawImperativeAPI.onScrollChange(callback): UnsubscribeCallback` and `getAppState()` (`types.d.ts:616–634`), `AppState` fields `scrollX`, `scrollY`, `zoom: {value}`, `width`, `height` (`types.d.ts:245–312`); `updateScene({ appState })` only calls `setState(appState)` when no `elements` are given (`dist/dev/index.js:25932–25966`); the visible scene rectangle is `[-scrollX, -scrollY, -scrollX + width / zoom, -scrollY + height / zoom]` (`getVisibleSceneBounds`, `chunk-4FTI6OG3.js:10591`); zoom is clamped to 0.1–30 (`MIN_ZOOM`, `MAX_ZOOM`, `chunk-4FTI6OG3.js:291–292`); the canvas reports every change of scroll or zoom, whoever caused it, through `onScrollChange` (`componentDidUpdate`, `index.js:30442`); `whisperTransport(channel, event, accept)` stamps nothing itself: the sender id comes from Reverb (`resources/js/lib/realtime/whisper-transport.ts`).

**Files:**
- Create: `resources/js/hooks/use-whiteboard-follow.ts`
- Modify: `resources/js/components/whiteboard/facilitator-bar.tsx`, `resources/js/components/whiteboard/board.tsx`, `lang/{en,fr,de,es}.json`

**Interfaces:**
- Consumes: `state.snapshot.board.followEnabled`, `board.facilitatorMemberId`, `me.isFacilitator`, `state.presence` (a `WhisperChannel`), `WhiteboardSettingsController.update(boardId)` with `{follow_enabled}`, `StatusBar`, `useWhiteboardRequest`.
- Produces: `useWhiteboardFollow({ api, presence, enabled, leading, facilitatorId }): { following: boolean; paused: boolean; resume(): void }`. Whisper `viewport`: `{x, y, width, height}` in scene coordinates.

- [ ] **Step 1: The hook**

```ts
type Viewport = { x: number; y: number; width: number; height: number };

type Options = {
    api: ExcalidrawImperativeAPI | null;
    presence: WhisperChannel | null;
    /** The board's switch. */
    enabled: boolean;
    /** This client is the facilitator's: it sends, it never follows. */
    leading: boolean;
    facilitatorId: string | null;
};

const SendEveryMs = 100;
const RepeatEveryMs = 2000;
const MinZoom = 0.1;
const MaxZoom = 30;
```

`isViewport(raw)`: an object whose `x`, `y`, `width`, `height` are finite numbers, `width > 0`, `height > 0`.

**Leading** (effect on `[api, presence, enabled, leading]`, active when all four hold): `const transport = whisperTransport(presence, 'viewport', () => false);`

```ts
const send = () => {
    const { scrollX, scrollY, zoom, width, height } = api.getAppState();

    transport.send({ x: -scrollX, y: -scrollY, width: width / zoom.value, height: height / zoom.value });
};
```

Send once at once; on `api.onScrollChange` send at most every 100 ms with a trailing send (a timer that is set only when none is pending); `setInterval(send, RepeatEveryMs)` for late joiners and for a resized window. Cleanup: unsubscribe, clear the timer and the interval.

**Following** (effect on `[api, presence, enabled, leading, facilitatorId]`, active when `api && presence && enabled && !leading && facilitatorId`): refs `last` (the last viewport received), `applied` (`{scrollX, scrollY, zoom}` last set by us), `pausedRef`; state `paused`.

```ts
const transport = whisperTransport(
    presence,
    'viewport',
    (senderId, raw) => senderId === facilitatorId && isViewport(raw),
);

const apply = (viewport: Viewport) => {
    const { width, height } = api.getAppState();

    if (width <= 0 || height <= 0) {
        return;
    }

    const zoom = Math.min(MaxZoom, Math.max(MinZoom, Math.min(width / viewport.width, height / viewport.height)));
    const scrollX = width / 2 / zoom - (viewport.x + viewport.width / 2);
    const scrollY = height / 2 / zoom - (viewport.y + viewport.height / 2);

    applied.current = { scrollX, scrollY, zoom };
    api.updateScene({ appState: { scrollX, scrollY, zoom: { value: zoom } } } as never);
};

const stopListening = transport.onMessage((raw) => {
    last.current = raw as Viewport;

    if (!pausedRef.current) {
        apply(last.current);
    }
});

const stopWatching = api.onScrollChange((scrollX, scrollY, zoom) => {
    const ours = applied.current;

    if (ours && ours.scrollX === scrollX && ours.scrollY === scrollY && ours.zoom === zoom.value) {
        return;
    }

    pausedRef.current = true;
    setPaused(true);
});
```

The comparison is exact on purpose: the canvas reports back the very numbers `updateScene` was given, so anything else is the person panning or zooming. The whole rectangle is fitted and centred, so a follower with another window shape sees at least what the facilitator sees. Cleanup: both unsubscribes, `last.current = null`, `applied.current = null`, `pausedRef.current = false`, `setPaused(false)` — switching follow-me off frees everyone and forgets the pause.

`resume()`: `pausedRef.current = false; setPaused(false);` then `apply(last.current)` when there is one (it is defined inside the effect: keep it in a ref the returned `resume` calls). Return `{ following: enabled && !leading, paused: enabled && !leading && paused, resume }`.

Nothing is persisted and nothing goes through the server: a receiver's only protection is the sender id (spec §11.3), which is why `accept` compares it with `facilitatorId` from the snapshot and why Task 2 switches follow-me off when the facilitator changes.

- [ ] **Step 2: Wire it**

`board.tsx`:

```tsx
const follow = useWhiteboardFollow({
    api,
    presence: state.presence,
    enabled: board.followEnabled,
    leading: me.isFacilitator,
    facilitatorId: board.facilitatorMemberId,
});
```

and inside `<StatusBar>`, after the lock notice:

```tsx
{board.followEnabled && me.isFacilitator && <span>{t('Everyone follows your view.')}</span>}
{follow.following && !follow.paused && <span>{t('Following the facilitator')}</span>}
{follow.paused && (
    <span className="flex items-center gap-2">
        {t('Following paused')}
        <Button size="sm" variant="outline" onClick={follow.resume}>
            {t('Resume')}
        </Button>
    </span>
)}
```

`facilitator-bar.tsx`: a third control, `<Button size="sm" variant={board.followEnabled ? 'default' : 'outline'} aria-pressed={board.followEnabled} aria-label={t('Bring everyone to me')} title={t('Bring everyone to me')}>` with the `Presentation` icon; on click the settings request with `{ follow_enabled: !board.followEnabled }`, then `state.refetch()`.

- [ ] **Step 3: Translation keys**

| Key (English) | French | German | Spanish |
|---|---|---|---|
| Bring everyone to me | Amener tout le monde à ma vue | Alle zu meiner Ansicht holen | Traer a todos a mi vista |
| Everyone follows your view. | Tout le monde suit votre vue. | Alle folgen Ihrer Ansicht. | Todos siguen tu vista. |
| Following the facilitator | Vous suivez l'animateur | Sie folgen dem Moderator | Siguiendo al facilitador |
| Following paused | Suivi en pause | Folgen pausiert | Seguimiento en pausa |
| Resume | Reprendre | Fortsetzen | Reanudar |

- [ ] **Step 4: Gates and commit**

Run: `npm run build && npm run types:check && npx vp check resources/js/hooks/use-whiteboard-follow.ts resources/js/components/whiteboard/facilitator-bar.tsx resources/js/components/whiteboard/board.tsx && DB_HOST=127.0.0.1 php artisan test --compact tests/Feature/TranslationKeysTest.php`
Expected: no error in these files; test PASS.

```bash
git add resources/js/hooks/use-whiteboard-follow.ts resources/js/components/whiteboard/facilitator-bar.tsx resources/js/components/whiteboard/board.tsx lang/en.json lang/fr.json lang/de.json lang/es.json
git commit -m "feat(whiteboard): bring everyone to the facilitator's view"
```

**Browser checks:**
- B6.1 A switches "Bring everyone to me" on: A's status row says "Everyone follows your view.", B's says "Following the facilitator", and B's view shows what A sees.
- B6.2 A pans and zooms: B's view follows within about a second, and what A sees is inside B's window when the two windows have different shapes (resize B narrower).
- B6.3 B pans (or zooms): B's row says "Following paused" with "Resume"; A keeps moving and B's view stays. "Resume" brings B back to A's current view at once.
- B6.4 A browser that opens the board while follow-me is on is brought to A's view within 2 s.
- B6.5 A switches it off: both rows lose the notice and B's view is free. A member takes control while it is on: it goes off (snapshot `followEnabled` false) and nobody is pulled to the new facilitator.
- B6.6 On a locked board B (view mode) still follows, pauses by dragging, and resumes.
- B6.7 From B's console, whisper a `viewport` on the presence channel (`window.Echo` is not exposed: check instead that B's own pan never moves A, and that with A not facilitating no view moves).

---

### Task 7: Voting in the browser — open, vote, badges, results

Proposal, not run. Names checked: `ExcalidrawImperativeAPI.onChange(callback)`, `getSceneElements()` (non-deleted, ordered), `scrollToContent(target, opts)` where a string target is an element id and `fitToContent` defaults to `true` for it (`dist/dev/index.js:25770–25796`); a point of the scene is at `(sceneX + scrollX) * zoom + offsetLeft` in the window (`sceneCoordsToViewportCoords`, `chunk-4FTI6OG3.js:1329`), so inside the canvas wrapper it is `(sceneX + scrollX) * zoom`; the canvas layers are `--zIndex-canvas: 1`, `--zIndex-interactiveCanvas: 2`, its controls `--zIndex-layerUI: 4` (`dist/dev/index.css:5546–5551`), and `.excalidraw` (`position: relative; overflow: hidden`, no `z-index`) makes no stacking context of its own, so a sibling at `z-index: 3` lies above the drawing and under the controls; the reactions bar is `fixed … z-40` outside the wrapper (`resources/js/components/realtime/flying-reactions.tsx:111`); a frame is `{type: 'frame', name: string | null}` and every element may carry `customData` (`element/types.d.ts:71`, `140`).

**Files:**
- Create: `resources/js/hooks/use-whiteboard-overlay.ts`, `resources/js/components/whiteboard/vote-dialog.tsx`, `resources/js/components/whiteboard/vote-overlay.tsx`, `resources/js/components/whiteboard/results-panel.tsx`
- Modify: `resources/js/components/whiteboard/facilitator-bar.tsx`, `resources/js/components/whiteboard/board.tsx`, `resources/js/components/whiteboard/board-menu.tsx`, `lang/{en,fr,de,es}.json`

**Interfaces:**
- Consumes: `state.snapshot.voting`, `votingHistory`, `state.applyTally`, `state.refetch`, `state.online`; Wayfinder `WhiteboardVoteSessionsController.store(boardId)` (`{votes_per_member, frame_element_id, allow_multiple}` → `{id}`), `WhiteboardVotesController.update({board, voteSession, elementId})` (`{count}` → `VoteTally`), `WhiteboardVoteClosuresController.store({board, voteSession})`, `WhiteboardVoteDismissalsController.store({board, voteSession})`; `useWhiteboardCursors({ …, enabled })`; `StatusBar`, `FacilitatorBar`, `useWhiteboardRequest`.
- Produces: nothing for later tasks.

- [ ] **Step 1: Where things are** (`use-whiteboard-overlay.ts`)

```ts
export type CanvasView = { scrollX: number; scrollY: number; zoom: number };
export type NoteBox = { id: string; x: number; y: number; width: number; height: number };

export function useCanvasView(api: ExcalidrawImperativeAPI | null): CanvasView | null {
    const [view, setView] = useState<CanvasView | null>(null);

    useEffect(() => {
        if (!api) {
            return;
        }

        const { scrollX, scrollY, zoom } = api.getAppState();

        setView({ scrollX, scrollY, zoom: zoom.value });

        return api.onScrollChange((nextX, nextY, nextZoom) =>
            setView({ scrollX: nextX, scrollY: nextY, zoom: nextZoom.value }),
        );
    }, [api]);

    return view;
}
```

`useNoteBoxes(api, ids: readonly string[] | null): NoteBox[]` — the same pattern with `api.onChange((elements) => read(elements))` and a first `read(api.getSceneElements())`. `read` keeps the elements whose id is in `ids`, that are not deleted and whose `customData?.skrum?.kind === 'sticky'`, maps them to `{id, x, y, width, height}`, and calls `setBoxes` only when the string `id:x:y:width:height|…` differs from the last one: `onChange` fires on every selection and pointer state. With `ids === null` it sets `[]` and subscribes to nothing. The caller must pass a memoised `ids` (`useMemo`), or the effect restarts on every render.

- [ ] **Step 2: `VoteOverlay`**

`VoteOverlay({ api, voting, onVote }: { api: ExcalidrawImperativeAPI; voting: WhiteboardVoting; onVote: (elementId: string, count: number) => void })`, rendered inside the canvas wrapper, after `<Excalidraw>`:

```tsx
<div className="pointer-events-none absolute inset-0 z-[3] overflow-hidden">
    {boxes.map((box) => (
        <div
            key={box.id}
            className="absolute top-0 left-0 -translate-x-full -translate-y-1/2"
            style={{
                left: (box.x + box.width + view.scrollX) * view.zoom,
                top: (box.y + view.scrollY) * view.zoom,
            }}
        >
            {/* the control or the badge */}
        </div>
    ))}
</div>
```

`ids` is `voting.elementIds` while open and `voting.results.map((result) => result.elementId)` once closed. The anchor is the note's top-right corner in its unrotated box; a rotated note keeps its control at that corner (accepted). The controls keep their size at every zoom. Nothing is rendered until `view` is known.

- **Open** (`pointer-events-auto` on the control only): the viewer's own count for the note is `voting.myVotes.find(…)?.count ?? 0`.
  - `allowMultiple`: a pill `−  n  +` — two icon buttons (`Minus`, `Plus`, `aria-label={t('Remove a vote')}` / `t('Add a vote')`) around the count (`aria-label={t('Your votes: :count', { count })}`); `−` disabled at 0, `+` disabled when `voting.remaining === 0`; they call `onVote(id, count - 1)` / `onVote(id, count + 1)`.
  - otherwise: one round toggle button, `aria-pressed={count === 1}`, `aria-label={t('Vote for this note')}`, filled when pressed, disabled when `count === 0 && voting.remaining === 0`; it calls `onVote(id, count === 1 ? 0 : 1)`.
  - Style: `rounded-full border bg-background shadow-sm`, buttons `size-6`; the only thing shown is the viewer's own count.
- **Closed**: for each result whose note is still on the canvas, a badge (`rounded-full bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground`) with the count and `aria-label` `t(':count vote', { count })` for 1, `t(':count votes', { count })` otherwise. No pointer events.

- [ ] **Step 3: `VoteDialog`** (facilitator opens a vote)

`VoteDialog({ state, api, open, onOpenChange })`. Fields: `t('Votes per participant')` — `Input type="number" min={1} max={20}`, default 3; `t('Notes to vote on')` — a `Select` with `t('All sticky notes')` (value `''` is not allowed by the Select: use `'all'`) and one entry per frame read from `api.getSceneElements()` when the dialog opens, labelled `t('Notes in :name', { name: frame.name ?? t('Frame :number', { number: position + 1 }) })`; a `Checkbox` `t('Allow several votes on one note')`. Footer `t('Cancel')` / `t('Start a vote')` (disabled while busy). Submit:

```ts
try {
    await retroRequest<{ id: string }>(WhiteboardVoteSessionsController.store(board.id), {
        votes_per_member: votesPerMember,
        frame_element_id: scope === 'all' ? null : scope,
        allow_multiple: allowMultiple,
    });
    await state.refetch();
    onOpenChange(false);
} catch (error) {
    setError(
        error instanceof RetroRequestError && error.status > 0
            ? error.message
            : t('Something went wrong. Please try again.'),
    );
}
```

The message of a 422 ("A vote is already open.", "There are no sticky notes to vote on.") is shown inside the dialog with `InputError`, and the dialog stays open with what was chosen. Mount the form only while `open`. A frame just drawn may not have reached the server yet (300 ms batch): the server then answers "Choose a frame of this board." and a second try works.

- [ ] **Step 4: `ResultsPanel`**

`ResultsPanel({ state, api, onClose })`, an `<aside>` placed **beside** the canvas, never over it: wrap the canvas wrapper and the panel in `<div className="flex min-h-0 flex-1">`; the canvas wrapper keeps `min-h-0 flex-1` and gains `min-w-0`; the panel is `w-80 shrink-0 overflow-y-auto border-l bg-background p-4 max-md:absolute max-md:inset-0 max-md:z-50 max-md:w-auto` (on a phone it takes the board area, with its close button). Content:
- Header: `<h2>{t('Vote results')}</h2>`, a close button (`X`, `aria-label={t('Close')}`), and for the facilitator, when `voting` is closed, a button `t('Hide the results')` → `request(retroRequest(WhiteboardVoteDismissalsController.store({ board: board.id, voteSession: voting.id })))` then `state.refetch()`.
- The current results (when `voting && !voting.open`): an `<ol>`; each entry shows its rank, the text (`result.text === '' ? t('Empty note') : result.text`, `whitespace-pre-wrap break-words`), the count (`t(':count vote', …)` / `t(':count votes', …)`) and a button `t('Show on the board')` (`LocateFixed`) that calls `api.scrollToContent(result.elementId, { fitToContent: false, animate: true })` (and `onClose()` below `md`). The button is disabled, with `title={t('This note is no longer on the board.')}`, when no live element has that id (`api.getSceneElements().some(…)`, read when the panel renders). An empty list shows `t('No votes were cast.')`.
- `state.snapshot.votingHistory` (non-guests only receive any): a heading `t('Previous votes')` and, per past vote, its date (`new Date(closedAt).toLocaleString()`) and the same list without the hide button.

Results never name a voter: the payload holds none.

- [ ] **Step 5: Wire it** (`board.tsx`, `facilitator-bar.tsx`, `board-menu.tsx`)

`board.tsx`:
- `const { voting, votingHistory } = state.snapshot; const votingOpen = voting?.open ?? false;`
- Cursors: `enabled: board.cursorsEnabled && !votingOpen` in `useWhiteboardCursors` — with the transport gone the hook neither sends nor draws, and clears the pointers it had (spec §11.4). This is the one rule of this plan the server cannot enforce: whispers never pass through it.
- Voting: 

```ts
const vote = async (elementId: string, count: number) => {
    if (!voting) {
        return;
    }

    const tally = await request(
        retroRequest<VoteTally>(
            WhiteboardVotesController.update({ board: board.id, voteSession: voting.id, elementId }),
            { count },
        ),
    );

    if (tally === undefined) {
        void state.refetch();

        return;
    }

    state.applyTally(voting.id, tally);
};
```

- `{api && voting && <VoteOverlay api={api} voting={voting} onVote={(elementId, count) => void vote(elementId, count)} />}` inside the canvas wrapper, after `<Excalidraw>`.
- Results panel: `const [panel, setPanel] = useState<boolean | null>(null);` and `const showsPanel = panel ?? (voting !== null && !voting.open);` — it opens by itself when a vote closes, and a person's own choice wins afterwards; reset `panel` to `null` when `voting?.id` changes (key the state on it). Render `{api && showsPanel && <ResultsPanel state={state} api={api} onClose={() => setPanel(false)} />}` beside the canvas.
- Status row, after the follow notices:

```tsx
{voting?.open && (
    <span>
        {t('Votes left: :count', { count: voting.remaining })}
        {' · '}
        {t(':count of :total finished voting', { count: voting.finishedCount ?? 0, total: state.online.length })}
        {' · '}
        {t('Cursors are hidden while the vote is open.')}
    </span>
)}
{voting && !voting.open && !showsPanel && (
    <Button size="sm" variant="outline" onClick={() => setPanel(true)}>
        {t('Vote results')}
    </Button>
)}
```

`facilitator-bar.tsx` (it now takes `api: ExcalidrawImperativeAPI | null` too): a fourth control with the `Vote` icon —
- no vote, or results already dismissed: `aria-label={t('Start a vote')}`, opens `VoteDialog` (disabled while `api` is null);
- vote open: a text button `t('Close the vote')` → `request(retroRequest(WhiteboardVoteClosuresController.store({ board: board.id, voteSession: voting.id })))` then `state.refetch()`;
- vote closed and shown: `aria-label={t('Start a vote')}` again (opening a new vote puts the old results away, spec §11.4).

`board-menu.tsx`: for `!me.isGuest`, when `votingHistory.length > 0 || voting !== null`, an item `t('Vote results')` that opens the panel (new prop `onShowResults: () => void`, passed from `board.tsx` as `() => setPanel(true)`).

- [ ] **Step 6: Translation keys**

| Key (English) | French | German | Spanish |
|---|---|---|---|
| Start a vote | Lancer un vote | Abstimmung starten | Iniciar una votación |
| Close the vote | Clôturer le vote | Abstimmung schließen | Cerrar la votación |
| Notes to vote on | Post-it soumis au vote | Haftnotizen zur Abstimmung | Notas sometidas a votación |
| All sticky notes | Tous les post-it | Alle Haftnotizen | Todas las notas adhesivas |
| Notes in :name | Post-it dans :name | Haftnotizen in :name | Notas en :name |
| Frame :number | Cadre :number | Rahmen :number | Marco :number |
| Allow several votes on one note | Autoriser plusieurs votes sur un même post-it | Mehrere Stimmen pro Haftnotiz erlauben | Permitir varios votos en una misma nota |
| Vote for this note | Voter pour ce post-it | Für diese Haftnotiz stimmen | Votar por esta nota |
| :count of :total finished voting | :count sur :total ont terminé de voter | :count von :total haben fertig abgestimmt | :count de :total han terminado de votar |
| Cursors are hidden while the vote is open. | Les curseurs sont masqués pendant le vote. | Cursor sind während der Abstimmung ausgeblendet. | Los cursores están ocultos durante la votación. |
| Vote results | Résultats du vote | Abstimmungsergebnisse | Resultados de la votación |
| Hide the results | Masquer les résultats | Ergebnisse ausblenden | Ocultar los resultados |
| Previous votes | Votes précédents | Frühere Abstimmungen | Votaciones anteriores |
| Show on the board | Afficher sur le tableau | Auf dem Board anzeigen | Mostrar en la pizarra |
| This note is no longer on the board. | Ce post-it n'est plus sur le tableau. | Diese Haftnotiz ist nicht mehr auf dem Board. | Esta nota ya no está en la pizarra. |
| Empty note | Post-it vide | Leere Haftnotiz | Nota vacía |
| No votes were cast. | Aucun vote n'a été exprimé. | Es wurden keine Stimmen abgegeben. | No se emitió ningún voto. |
| Votes per participant, Add a vote, Remove a vote, Your votes: :count, Votes left: :count, :count vote, :count votes, Close, Cancel, Something went wrong. Please try again. | exist | exist | exist |

- [ ] **Step 7: Gates and commit**

Run: `npm run build && npm run types:check && npx vp check resources/js/hooks/use-whiteboard-overlay.ts resources/js/components/whiteboard && DB_HOST=127.0.0.1 php artisan test --compact tests/Feature/TranslationKeysTest.php`
Expected: no error in these files; test PASS.

```bash
git add resources/js/hooks/use-whiteboard-overlay.ts resources/js/components/whiteboard/vote-dialog.tsx resources/js/components/whiteboard/vote-overlay.tsx resources/js/components/whiteboard/results-panel.tsx resources/js/components/whiteboard/facilitator-bar.tsx resources/js/components/whiteboard/board.tsx resources/js/components/whiteboard/board-menu.tsx lang/en.json lang/fr.json lang/de.json lang/es.json
git commit -m "feat(whiteboard): dot voting on the board, with badges and a results panel"
```

**Browser checks:**
- B7.1 Facilitator: the vote button opens a dialog (votes per participant, scope, several votes per note). A board without notes answers "There are no sticky notes to vote on." inside the dialog. With a frame on the board the scope lists "Notes in <frame name>".
- B7.2 Vote open: every in-scope note has a vote control at its top-right corner in A and B; a note added afterwards has none. The controls stay on their notes while panning, zooming, and while a note is dragged; a control that scrolls under the shapes toolbar passes **behind** it, and none lies over the canvas's bottom controls or the reactions bar.
- B7.3 B votes: B's control shows B's count, the status row counts down "Votes left", A's page shows nothing of B's vote (no count on the note, no change but "x of y finished voting" when B spends the last one). At a budget of zero the "+" / toggle of other notes is disabled; forcing it (`fetch` the PUT with a higher count) answers 422 and shows "You have no votes left.".
- B7.4 While the vote is open no remote cursor is drawn in A or B even with "Show live cursors" on; they come back when it closes.
- B7.5 B double-clicks an in-scope note and types: the text snaps back and the toast "Notes cannot be edited while a vote is open." shows; B can still drag, recolour and resize it, and A sees those. A (facilitator) is refused the same way.
- B7.6 A deletes a note B voted for: B's "Votes left" goes back up within about 2 s without a reload.
- B7.7 A second tab of B on the same board shows B's votes within about 2 s of a vote cast in the first tab.
- B7.8 A closes the vote: in A and B the controls become count badges with the same numbers, and the results panel opens beside the canvas (the canvas shrinks; nothing is covered) with the same ranked list. "Show on the board" centres the note. A deleted note's entry has its button disabled.
- B7.9 A hides the results: badges and panel disappear for both. The board menu's "Vote results" shows them again under "Previous votes" for A and for a member; a guest has no such entry and no history.
- B7.10 A locks the board during an open vote: B can still vote and cannot move a note.
- B7.11 Dark theme and 375 px width: controls, badges, status row and panel are legible; the panel takes the board area and closes.
- B7.12 No library name or link appears in any of the new UI.

---

### Task 8: Acceptance and verification

**Files:**
- Create: `docs/superpowers/walkthroughs/plan-17c-whiteboard-facilitation.md`
- Modify: whatever the gates show to be wrong (with a test when a server rule was missing; the spec first if the spec is wrong).

**Interfaces:**
- Consumes: everything above.
- Produces: the walkthrough file replayed by the automated Chrome walkthrough after this plan.

- [ ] **Step 1: Write the walkthrough file**

Title `# Plan 17c — whiteboard facilitation: walkthrough`, a "Before starting" paragraph (`vendor/bin/sail artisan migrate --no-interaction`, `npm run build`; accounts, origins and the rules for tabs from `.superpowers/sdd/whiteboard-rules.md`: member A "Fran Facilitator" on `http://localhost`, guest B on `http://127.0.0.1`, `member@skrum.test` on `127.0.0.1` when a second member is needed), then one section per acceptance criterion of spec §16 "Facilitation (R7–R8)", in this order, each with an unticked `- [ ]` line per check written as **Setup → Action → Expected**:

1. **Given the facilitator starts a 60-second timer, then every browser shows the same countdown and "Time's up" at zero.** Setup: A facilitates, B is on the board. Action: A starts "1 min". Expected: both show the same remaining time (read the `role="timer"` text in both within the same second), both show "Time's up!" at zero; `GET snapshot` gives the same `timerEndsAt` to both. Include B5.1, B5.2.
2. **Given the board is locked, when a non-facilitator writes an element, then the server answers 403 and the element is unchanged; the facilitator can still edit.** Setup: one shape on the board. Action: A locks; B tries to draw, then sends a `PUT elements` by `fetch`; A moves the shape. Expected: B is in view mode; the `fetch` answers 403 with `errors.locked`; the shape in `GET snapshot` is unchanged by B and changed by A. Include B5.3, B5.4, B5.5, B5.8.
3. **Given a locked element, when a non-facilitator moves or unlocks it, then the write is rejected and their canvas returns to the server copy.** Setup: A locks one shape on an unlocked board. Action: B drags it; B sends a `PUT elements` with `locked: false`. Expected: the shape is back in place on B's canvas; the response's `rejected[0].reason` is `locked` and carries the stored copy; no lock entry in B's context menu. Include B5.6.
4. **Given follow-me is on, when the facilitator pans, then followers' views follow; a follower who pans sees "Following paused" and "Resume" re-attaches them.** Include B6.1–B6.6.
5. **Given an open voting session, then no payload received by any member contains another member's votes or any total (feature tests), and a member cannot exceed their budget.** Setup: A opens a vote with 3 votes; B votes twice. Action: in A's tab read `GET snapshot` and `GET vote-sessions/<id>` by `fetch`, and watch A's page. Expected: A's `voting.myVotes` is empty, there is no total and no other member's vote anywhere in the two bodies; B's fourth vote answers 422. State that the invariant itself is proved by `WhiteboardVotingSecrecyTest`, not by this replay. Include B7.1–B7.4, B7.7, B7.10.
6. **Given a closed session, then every member sees the same counts on notes and the same ranked list.** Include B7.8, B7.9, B7.11.
7. **Given an open session, when a sticky in scope has its text changed, then the write is rejected.** Include B7.5, B7.6.

Then a section **"Around the criteria"** with B5.7 (hand-over dialog), B6.7, B7.12, and a check that the reactions bar, the shapes toolbar and the canvas's bottom controls are never covered by the status row, the overlay or the panel (screenshots at 1280 px and 375 px, vote open and vote closed).

End with **"Feature tests that pin these criteria"**: `WhiteboardTimerTest`, `WhiteboardLockTest`, `WhiteboardElementWritesTest` (element lock), `WhiteboardFacilitationTest`, `WhiteboardVotingTest`, `WhiteboardVotingSecrecyTest`, `WhiteboardVotingWritesTest`, `WhiteboardVoteModelTest`, and a note that follow-me has no server rule to test (whispers never reach the server) and that "blocked while private writing is on" arrives with 17d.

- [ ] **Step 2: Full gates**

```bash
vendor/bin/pint --dirty --format agent
DB_HOST=127.0.0.1 php -d memory_limit=-1 vendor/bin/pest --compact
composer lint
npm run build && npm run types:check
npx vp check resources/js/lib/whiteboard resources/js/components/whiteboard resources/js/hooks/use-whiteboard.ts resources/js/hooks/use-whiteboard-channel.ts resources/js/hooks/use-whiteboard-request.ts resources/js/hooks/use-whiteboard-follow.ts resources/js/hooks/use-whiteboard-overlay.ts
vendor/bin/sail artisan migrate --no-interaction
```

Expected: the suite passes; PHPStan and Pint clean; `types:check` shows only the known `manage-passkeys.tsx` error; no `vp check` failure in the listed files. Also confirm that `git diff <commit before Task 1> -- package.json composer.json` is empty (no new dependency) and that `grep -rn "excalidraw" resources/js --include=*.tsx --include=*.ts -il` lists no file outside `resources/js/lib/whiteboard/`, `resources/js/components/whiteboard/` and the whiteboard hooks.

- [ ] **Step 3: Check the spec against what was built**

Read spec §11.1–§11.4, the rows of §12 and "Decisions made while planning 17c" once more against the code. Where the code had to differ from this plan, the spec is the judge: fix the code, or, when the spec is wrong, the spec first — and list each difference in the report.

- [ ] **Step 4: Fix what the gates show**, re-run the affected gate, and record each fix in the report.

- [ ] **Step 5: Commit**

```bash
git add docs/superpowers/walkthroughs/plan-17c-whiteboard-facilitation.md
git commit -m "docs(whiteboard): walkthrough for the timer, the lock, follow-me and dot voting"
```

(Add any fixed file by its explicit path to the same or a separate commit.)

---

## Assumptions to reconcile

Written at commit `e0524df` (plan 17b Tasks 1–7 merged, Tasks 8–9 in progress), in a worktree that could not run anything. Check each before executing:

1. **Nothing here was run.** PHP snippets and every test are unexecuted. Expect small corrections (a key order compared with `toBe`, a factory default, a PHPStan generic); the behaviour stated in the spec and in each test's name is what counts.
2. **Plan 17b Task 8 (board UI)** was uncommitted: `board-menu.tsx` will already hold "Duplicate this board" and "Save as template" with a `SaveTemplateDialog`, and `board.tsx` a `name` prop on the canvas. Tasks 5 and 7 add to these files; place the new menu items next to what is there (hand-over in the facilitator block, "Vote results" with the member entries) and keep 17b's.
3. **Plan 17b Task 9 (acceptance)** may have changed files this plan edits (`WhiteboardGuard`, `scene-sync.ts`, `lang/*.json`, a migration). Re-read them; if a whiteboard migration dated `2026_10_11` or later exists, date this plan's after it.
4. **`lang/*.json`** were being edited: run the `grep` for each key before adding it; the tables say which keys this plan believes exist.
5. **Routes used by tests of other features:** `whiteboards.duplicate.store` and `whiteboards.template.store` (17b) are called by Tasks 2 and 4; their controllers are assumed unchanged (`WhiteboardGuard::notGuest`, 201).
6. **`WriteWhiteboardElements`** is assumed as at `e0524df` (local variables `$locked`, `$stored`, `$saved`, `$accepted`, `$rejected`, `$liveCount`, methods `refusal`, `isSameWrite`, `rejection`, `storedElements`, `rawId`, `save`). If 17b's review changed it, apply Task 4's rule to the new shape rather than its snippets.
7. **The scoped binding** of `{voteSession}` relies on the relation name `voteSessions`; Wayfinder then names the parameters `board`, `voteSession`, `elementId`. Check the generated `resources/js/actions/App/Http/Controllers/Whiteboards/WhiteboardVotesController.ts` after the first `npm run build`.
8. **Test helper names** added here (`whiteboardSticky`, `openWhiteboardVote`, `castWhiteboardVote`, `lockedBoard`, `lockedBoardEdit`, `openVoteRequest`, `voteRequest`, `closeVoteRequest`, `votingRoom`, `openVotingFor`, `boardUnderVote`, `writeDuringVote`) must not exist yet: `grep -rn "^function " tests`.
9. **Canvas stacking.** The overlay at `z-index: 3` under the canvas controls rests on the reading of the library's stylesheet cited in Task 7; B7.2 is the proof. If a control ends up covered, do not raise the canvas controls: clip the overlay to the drawing area instead (inset it by the toolbar's height) and say so.
10. **View mode.** That the canvas leaves view mode when the prop goes from `true` to `undefined`, and that an unfinished text edit is abandoned when view mode starts, were read in the bundle, not seen: B5.3 and B5.5 are the proof.
11. **Follow-me's pause** relies on the canvas reporting back exactly the scroll and zoom it was given. If B6.1 shows followers pausing on their own, compare with a small tolerance (1e-6) instead of `===`.
12. **`Log::listen`** in the secrecy test assumes the test log channel dispatches `MessageLogged`; if the channel is `null` in `phpunit.xml`, the assertion still holds (nothing is logged) but proves less: then spy on `Log` instead.
13. **Second member account.** The walkthrough needs `member@skrum.test` on `127.0.0.1` for the hand-over check; the rules file says it exists in `DemoSeeder`.
