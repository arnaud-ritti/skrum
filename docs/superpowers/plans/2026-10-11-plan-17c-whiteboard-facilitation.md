# Whiteboard Facilitation (Plan 17c) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A facilitator runs a session on a whiteboard: a shared countdown, a board lock, "bring everyone to me", a hand-over of the role, and a dot vote on sticky notes in which nobody, the facilitator included, sees anyone else's votes before the close.

**Architecture:** Every rule is on the server. The board row gains three columns (`locked`, `follow_enabled`, `timer_ends_at`); a vote is a `whiteboard_vote_sessions` row whose scope (`element_ids`) is fixed at opening, plus one `whiteboard_votes` row per member and note, deleted at close when only totals remain. All voting state leaves the server through one presenter, `PresentWhiteboardVoting`, which takes the viewer. The element write path (`WriteWhiteboardElements`) learns three things under the board lock it already holds: refuse non-facilitators on a locked board, refuse a change of the words of a note under vote, refund the votes of a note that is deleted. The client reflects this state: view mode, a status row, an overlay of vote controls positioned from scene coordinates, a results panel, and a `viewport` whisper for follow-me.

**Tech Stack:** Laravel 13, PHP 8.4, PostgreSQL, Pest 5, Reverb, Inertia 3 + React 19 (React Compiler on), Wayfinder, `@excalidraw/excalidraw` 0.18.1 (only through `resources/js/lib/whiteboard/excalidraw.ts`).

**Spec:** `docs/superpowers/specs/2026-10-01-whiteboard-design.md` — this plan covers R7 and R8: §11.1–§11.4, the facilitation columns and the two vote tables of §7, the `settings` keys `locked` / `follow_enabled`, the `timer` and `vote-sessions` rows and the events `timer.changed` / `vote.changed` and the whisper `viewport` of §12, the facilitator bar, status row, overlay and results panel of §13, and "Facilitation (R7–R8)" of §16. Read it, its section "Decisions made while planning 17c", and `.superpowers/sdd/whiteboard-rules.md` before starting.

**Not in this plan:** private writing and version history (17d). The hook points 17d needs are named in Task 4 ("Hooks for plan 17d") and not built.

**How this plan was checked — read this.** A draft was written before plan 17b was finished, without running anything. It was then reconciled at commit `322c88b`: the whole plan was built once in the tree as a prototype and removed again. **Backend (Tasks 1–4):** every test below was run, seen failing for the stated reason where the behaviour is new, and passing with the implementation described; the complete suite (4 072 tests), Pint and PHPStan were green on the prototype. **Frontend (Tasks 5–7):** every listing was type-checked, linted and bundled at each task's end state; none of it has run in a browser, and what only a browser can show is in each task's "browser checks". Appendix B lists what the reconciliation changed. A test that fails for a reason other than the missing feature is still a defect of this plan: fix the smallest thing that makes the specified behaviour true and report it. Where plan and spec disagree, the spec wins.

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
- Tests: `DB_HOST=127.0.0.1 php artisan test --compact <paths>`. Never run two test commands at the same time: every run rebuilds the one test database, and the other run then fails on missing tables. After the migration also run `vendor/bin/sail artisan migrate --no-interaction`. Guest-cookie requests use `->withCookies(whiteboardGuestCookie($guest))->withCredentials()`.
- Test helper functions are global across the suite: do not reuse a name that exists (`writeElements`, `storedElement`, `saveTemplate`, `boardWorthSaving`, `boardFromScene`, `uploadBoardFile`, `whiteboardChannelRequest`, and everything in `tests/Pest.php`).
- Git: `git add` explicit paths only; never stage `.junie/mcp/mcp.json`; every commit ends with the trailer of `.superpowers/sdd/whiteboard-rules.md`.
- Limits from the spec: timer 10–3600 seconds, no longer reported five minutes after its end; votes per member 1–20; result text 200 characters; history 10 sessions; `viewport` whisper throttled 100 ms and repeated every 2 s.
- The element with the class `whiteboard-canvas` must stay a sibling of the reactions bar: rules of the board block of `resources/css/app.css` place the bar with `.whiteboard-canvas … ~ .whiteboard-reactions`.

## Review Focus

1. **The same request arrives twice** (a client retries a vote, or a delete, after a timeout): the second vote changes nothing and broadcasts nothing; the second delete refunds nothing more. Pinned in Task 3 ("broadcasts progress to the others and stays quiet when nothing changed") and Task 4 ("refunds once when the delete is sent twice").
2. **A note under vote is deleted, and the batch lists its text before or after it** (and the undo, in either order): the text freeze must not block either, the votes are refunded once, and the note comes back with its words. Pinned in Task 4 ("deletes a note under vote with its text, whatever their order, and refunds its votes", "brings a deleted note back with its words and without its votes").
3. **A voted note is resized, or simply moved**: the canvas re-wraps the text (`text` gets other line breaks, the words stay) and sends the text element with a new position; both must be accepted, and a template text stored without `originalText` must not be mistaken for an edit on its first move. Pinned in Task 4 ("still lets a note under vote be moved, restyled and resized", "accepts the first move of a text stored without its original").
4. **An element id that looks like a number** (`"0"`, `"12"`): PHP turns such array keys into integers and an empty-looking id into `false`; votes and results must keep the id a string, and a second write of element `"0"` must not answer 500. Pinned in Task 3 ("keeps element ids that look like numbers as strings") and Task 4 ("accepts a second write of an element whose id is 0").
5. **Someone is locked out, or replaced, in the middle of an action** (the board is locked while their batch is in flight; another member takes control of a locked board): the refusal is a 403 that can be told from a lost access, nothing is stored, and the exemption follows the current facilitator, not the person who locked. Pinned in Task 2 ("refuses element writes from a member and a guest on a locked board", "follows the facilitator role, not the person, when control changes").
6. **The words of a note under vote are cleared, or typed into a note that had none**: the canvas sends two elements, the text and the note (whose `boundElements` loses or gains the text). Refusing the text alone would store a note that no longer lists a live text still pointing to it — for every client, until a full page load. Both halves must be refused and handed back, in either order, while an arrow attached to the note still passes. Pinned in Task 4 ("refuses both halves when the words of a note under vote are cleared", "refuses both halves of the first words typed into an empty note under vote", "still lets an arrow be attached to a note under vote").

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
  - Snapshot: `board.locked: bool`, `board.followEnabled: bool`, `board.timerEndsAt: ?string` (ISO 8601, seconds; null once the timer ended more than `BuildWhiteboardSnapshot::TimerLingerMinutes` = 5 minutes ago), `serverTime` as `Y-m-d\TH:i:s.v\Z`.
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

it('stops showing a countdown five minutes after it ended', function () {
    $board = Whiteboard::factory()->create(['timer_ends_at' => now()->addMinute()]);
    [$user] = whiteboardMember($board);

    $this->travel(5)->minutes();

    $this->actingAs($user)
        ->getJson(route('whiteboards.snapshot.show', $board))
        ->assertJsonPath('board.timerEndsAt', '2026-10-11T10:01:00+00:00');

    $this->travel(61)->seconds();

    $this->actingAs($user)
        ->getJson(route('whiteboards.snapshot.show', $board))
        ->assertJsonPath('board.timerEndsAt', null);

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
Expected: FAIL — `Class "App\Models\WhiteboardVoteSession" not found` (from the helpers), `Route [whiteboards.timer.update] not defined`, `board.locked` missing from the snapshot (`null` is not `false`), `serverTime` without milliseconds, `Class "App\Events\Whiteboards\WhiteboardTimerChanged" not found`.

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

`BuildWhiteboardSnapshot`: in `board`, after `reactionsEnabled`, add `'locked' => $board->locked`, `'followEnabled' => $board->follow_enabled`, `'timerEndsAt' => $this->timerEndsAt($board)`; replace `serverTime` by `now()->utc()->format('Y-m-d\TH:i:s.v\Z')`; extend the `board` part of the `Snapshot` PHPStan type (`locked: bool, followEnabled: bool, timerEndsAt: ?string`); and add:

```php
public const TimerLingerMinutes = 5;

/**
 * A board outlives its sessions: a countdown nobody stopped must not
 * read "Time's up!" for ever (spec §11.1).
 */
private function timerEndsAt(Whiteboard $board): ?string
{
    $endsAt = $board->timer_ends_at;

    if ($endsAt === null || $endsAt->lt(now()->subMinutes(self::TimerLingerMinutes))) {
        return null;
    }

    return $endsAt->toIso8601String();
}
```

The column is not cleared by a read; only the snapshot stops reporting it.

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

- [ ] **Step 7: Translation key** (append to each `lang/*.json`; `en.json` with value = key)

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

use App\Enums\WorkspaceRole;
use App\Events\Whiteboards\WhiteboardChanged;
use App\Events\Whiteboards\WhiteboardVoteChanged;
use App\Models\User;
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

it('refuses people outside the team on every facilitation endpoint', function () {
    $board = Whiteboard::factory()->create();
    whiteboardSticky($board, 'note');
    $session = openWhiteboardVote($board);
    $outsider = User::factory()->create();
    $board->team->workspace->members()->attach($outsider, ['role' => WorkspaceRole::Member->value]);

    $this->actingAs($outsider)->putJson(route('whiteboards.timer.update', $board), ['seconds' => 60])->assertForbidden();
    openVoteRequest($this->actingAs($outsider), $board)->assertForbidden();
    voteRequest($this->actingAs($outsider), $board, $session, 'note', 1)->assertForbidden();
    closeVoteRequest($this->actingAs($outsider), $board, $session)->assertForbidden();
    $this->actingAs($outsider)->postJson(route('whiteboards.voteSessions.dismiss.store', [$board, $session]))->assertForbidden();
    $this->actingAs($outsider)->getJson(route('whiteboards.voteSessions.show', [$board, $session]))->assertForbidden();

    expect(WhiteboardVote::query()->count())->toBe(0)
        ->and(WhiteboardVoteSession::query()->count())->toBe(1)
        ->and($session->fresh()->isOpen())->toBeTrue()
        ->and($board->fresh()->timer_ends_at)->toBeNull();
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

`app/Actions/Whiteboards/PresentWhiteboardVoting.php` (`php artisan make:class Actions/Whiteboards/PresentWhiteboardVoting --no-interaction`), the whole file as it passed the tests and PHPStan:

```php
<?php

namespace App\Actions\Whiteboards;

use App\Models\Whiteboard;
use App\Models\WhiteboardMember;
use App\Models\WhiteboardVote;
use App\Models\WhiteboardVoteSession;
use Illuminate\Support\Collection;

/**
 * The only place voting state is turned into a payload. While a session is
 * open a viewer gets their own votes and nothing about anyone else's (spec
 * §11.4); the facilitator is a viewer like any other.
 *
 * @phpstan-type VoteCount array{elementId: string, count: int}
 * @phpstan-type VoteResult array{elementId: string, text: string, count: int}
 * @phpstan-type Tally array{myVotes: list<VoteCount>, remaining: int, finishedCount: int}
 * @phpstan-type Voting array{
 *     id: string,
 *     open: bool,
 *     votesPerMember: int,
 *     allowMultiple: bool,
 *     frameElementId: ?string,
 *     elementIds: list<string>,
 *     myVotes: list<VoteCount>,
 *     remaining: int,
 *     finishedCount: ?int,
 *     results: ?list<VoteResult>
 * }
 * @phpstan-type PastVote array{id: string, closedAt: string, results: list<VoteResult>}
 */
class PresentWhiteboardVoting
{
    public const HistoryLength = 10;

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
            'myVotes' => array_values($mine
                ->map(fn (WhiteboardVote $vote): array => ['elementId' => $vote->element_id, 'count' => $vote->count])
                ->all()),
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
}
```

The key order of `session()` and `tally()` is the order the tests compare with `toBe`: do not reorder. `myVotes` goes through `array_values()` because PHPStan does not accept a collection's `all()` as a list. A closed session carries no `myVotes`: the rows no longer exist.

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

`CastWhiteboardVote::handle(...)` (constructor: `private PresentWhiteboardVoting $presentWhiteboardVoting`; class docblock `@phpstan-import-type Tally from PresentWhiteboardVoting`, method docblock `@return Tally`), in one `DB::transaction`:

1. Lock the board row as above. The board lock serialises every vote of a board, so the budget check cannot race.
2. `$open = $locked->voteSessions()->whereKey($session->id)->firstOrFail();` then `WhiteboardGuard::openVoteSession($open);` — the session is read again under the lock: a vote queued behind "close" is refused.
3. `$count > 1 && ! $open->allow_multiple` → `ValidationException::withMessages(['count' => __('Only one vote per note is allowed.')])`.
4. `$element = $locked->elements()->where('element_id', $elementId)->first();` — `! $open->isTarget($element)` → `ValidationException::withMessages(['votes' => __('This note is not part of the vote.')])`. This holds for `count` 0 too.
5. Budget: `$elsewhere = (int) $open->votes()->where('whiteboard_member_id', $member->id)->where('element_id', '!=', $elementId)->sum('count');` — `$elsewhere + $count > $open->votes_per_member` → `ValidationException::withMessages(['votes' => __('You have no votes left.')])`.
6. `$current = $open->votes()->where('whiteboard_member_id', $member->id)->where('element_id', $elementId)->first();` When `($current->count ?? 0) === $count` (written with `->`: PHPStan refuses `?->` on the left of `??`, rule `nullsafe.neverNull`), return `$this->presentWhiteboardVoting->tally($open, $member)` without writing or broadcasting (a retry).
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

`BuildWhiteboardSnapshot`: inject `private PresentWhiteboardVoting $presentWhiteboardVoting`; after `seq` add `'voting' => $this->presentWhiteboardVoting->current($board, $viewer)` and `'votingHistory' => $this->presentWhiteboardVoting->history($board, $viewer)`; in the class docblock add `@phpstan-import-type Voting from PresentWhiteboardVoting` and `@phpstan-import-type PastVote from PresentWhiteboardVoting` above `@phpstan-type Snapshot` (with an empty ` *` line between the imports and the type, as Pint wants), and in the type, after `seq: int,`, the lines `voting: ?Voting,` and `votingHistory: list<PastVote>,`.

- [ ] **Step 9: Translation keys** (append to each `lang/*.json`; `en.json` with value = key)

| Key (English) | French | German | Spanish |
|---|---|---|---|
| A vote is already open. | Un vote est déjà en cours. | Es läuft bereits eine Abstimmung. | Ya hay una votación abierta. |
| This vote is closed. | Ce vote est clos. | Diese Abstimmung ist geschlossen. | Esta votación está cerrada. |
| Choose a frame of this board. | Choisissez un cadre de ce tableau. | Wählen Sie einen Rahmen dieses Boards. | Elige un marco de esta pizarra. |
| There are no sticky notes to vote on. | Il n'y a aucun post-it sur lequel voter. | Es gibt keine Haftnotizen, über die abgestimmt werden kann. | No hay notas adhesivas sobre las que votar. |
| Only one vote per note is allowed. | Un seul vote par post-it est autorisé. | Pro Haftnotiz ist nur eine Stimme erlaubt. | Solo se permite un voto por nota. |
| This note is not part of the vote. | Ce post-it ne fait pas partie du vote. | Diese Haftnotiz gehört nicht zur Abstimmung. | Esta nota no forma parte de la votación. |
| Close the vote first. | Clôturez d'abord le vote. | Schließen Sie zuerst die Abstimmung. | Cierra primero la votación. |

Already in the four files (do not add again): `You have no votes left.`

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
- Produces: `WriteWhiteboardElements::handle()` keeps its signature and result shape; it now rejects with reason `voting` (a text, and a note whose list of bound texts changes), refunds votes, and no longer loses an element whose id is `"0"`. Nothing new for later tasks; the client learns the reason `voting` in Task 5.

The rule, in stored-data terms (spec §11.4). While the board has an open session:

- A **candidate** is an incoming element of type `text` whose container — the incoming `containerId` or the stored copy's — was a target of the session when the batch began.
- Candidates are handled **after** every other element of the batch. A candidate is rejected with `voting` when its container is still a target at that point **and** the write changes the words: `text` or `originalText ?? text` differ once all whitespace is removed, or `containerId` differs, or `isDeleted` differs, or there is no stored copy (a new text on the note).
- So: an edit, a lone deletion of the text, a new or re-bound text are refused; a move, a restyle, a re-wrap pass; deleting the note with its text passes in either order (the note is no longer a target when the text is looked at); the undo passes in either order (the note was not a target when the batch began).
- The **note** has its half of the rule, because the canvas writes the note as well when its words are cleared or first typed. An incoming element that has a stored copy, was a target when the batch began and stays one in this write (not deleted, still a sticky) is rejected with `voting` when the ids of the `text` entries of its `boundElements` differ from the stored copy's (compared as sorted sets; `null` and `[]` are the same; entries of other types, arrows, are ignored). It is looked at in batch order, not deferred: the answer depends on the note alone. The rejection hands back the stored note, so the writer's canvas puts the entry back (`scene-sync.ts` forces `rejection.element`, and drops a rejected element that has no stored copy).
- So: clearing the words refuses the text (`isDeleted`) **and** the note (`boundElements` without the text); the first words typed into an empty note in scope refuse the new text **and** the note (`boundElements` with it); in both cases, in either order, nothing is stored and nothing is broadcast. Attaching or detaching an arrow, moving, restyling, resizing and deleting the note pass.
- When an accepted write makes a note that was a target stop being one (deleted, or no longer a sticky), its votes in the open session are deleted. After the batch, if any row was deleted, `vote.changed` goes to everyone, the writer included, with the new `finishedCount`.
- The facilitator is not exempt. A closed session freezes nothing.

Facts checked: the canvas re-wraps a bound text when its container is resized — `wrapText()` splits the original into lines and joins them with `\n`, changing whitespace only (`node_modules/@excalidraw/excalidraw/dist/dev/chunk-4FTI6OG3.js`, `var wrapText`), and keeps the unwrapped words in `originalText`; built-in templates store `originalText` (`app/Support/WhiteboardTemplates/BuiltInTemplates.php:158`), but an element restored by the client gets one when it had none, hence the whitespace-blind comparison of `originalText ?? text`; `storedElements()` builds its id list with `->filter()`, which drops the id `"0"`; `WriteWhiteboardElements` is bound as a singleton (`AppServiceProvider`), so it must keep no state between calls. When a text editor is submitted, the canvas mutates the container too (`node_modules/@excalidraw/excalidraw/dist/dev/index.js`, `handleSubmit`, about line 24345): with words and no entry yet, `boundElements` gains `{type: 'text', id}`; submitted empty, the container's `boundElements` is filtered of its text entries and the text is marked deleted — so the batch holds both elements. A note made by the sticky tool starts with `boundElements: null` (`resources/js/components/whiteboard/sticky-tool.tsx`). Nothing repairs a one-sided binding during a session: `resources/js/lib/whiteboard/restore.ts` calls `restoreElements(elements, null)` without `repairBindings`, which the library only applies to the initial scene of a page load. `SanitizeWhiteboardElement` keeps `boundElements` as `null` or a list of `{id, type}` and keeps `customData` only on a sticky, which is what `save()` reads for `is_sticky`.

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

it('refuses both halves when the words of a note under vote are cleared', function (array $order) {
    [$board, $user, , $note, $words] = boardUnderVote();
    $batch = [
        'note' => [...$note, 'version' => 2, 'boundElements' => []],
        'text' => [...$words, 'version' => 2, 'isDeleted' => true],
    ];

    writeDuringVote($this->actingAs($user), $board, array_map(fn (string $key): array => $batch[$key], $order))
        ->assertOk()
        ->assertJsonPath('seq', 1)
        ->assertJsonPath('fromSeq', 1)
        ->assertJsonCount(2, 'rejected')
        ->assertJsonPath('rejected.0.id', 'note')
        ->assertJsonPath('rejected.0.reason', 'voting')
        ->assertJsonPath('rejected.0.element', $note)
        ->assertJsonPath('rejected.1.id', 'note-text')
        ->assertJsonPath('rejected.1.reason', 'voting')
        ->assertJsonPath('rejected.1.element', $words);

    $storedNote = $board->elements()->where('element_id', 'note')->sole();
    $storedWords = $board->elements()->where('element_id', 'note-text')->sole();

    expect($storedNote->data)->toEqual($note)
        ->and($storedNote->data['boundElements'])->toBe([['id' => 'note-text', 'type' => 'text']])
        ->and($storedNote->version)->toBe(1)
        ->and($storedWords->data)->toEqual($words)
        ->and($storedWords->is_deleted)->toBeFalse()
        ->and(WhiteboardVote::query()->count())->toBe(3);

    Event::assertNotDispatched(WhiteboardElementsChanged::class);
    Event::assertNotDispatched(WhiteboardVoteChanged::class);
})->with([
    'the note first' => [['note', 'text']],
    'the text first' => [['text', 'note']],
]);

it('refuses both halves of the first words typed into an empty note under vote', function (array $order) {
    [$board, $user] = boardUnderVote();
    $empty = sceneElement(['id' => 'empty', 'backgroundColor' => '#fff3bf', 'customData' => ['skrum' => ['kind' => 'sticky']]]);
    WhiteboardElement::factory()->create([
        'whiteboard_id' => $board->id, 'element_id' => 'empty', 'type' => 'rectangle', 'version' => 1, 'version_nonce' => 100,
        'is_sticky' => true, 'seq' => 1, 'data' => $empty,
    ]);
    WhiteboardVoteSession::query()->sole()->update(['element_ids' => ['note', 'kept', 'empty']]);
    $batch = [
        'note' => [...$empty, 'version' => 2, 'boundElements' => [['id' => 'first', 'type' => 'text']]],
        'text' => sceneElement(['id' => 'first', 'type' => 'text', 'text' => 'Hello', 'originalText' => 'Hello', 'containerId' => 'empty']),
    ];

    writeDuringVote($this->actingAs($user), $board, array_map(fn (string $key): array => $batch[$key], $order))
        ->assertOk()
        ->assertJsonPath('seq', 1)
        ->assertJsonCount(2, 'rejected')
        ->assertJsonPath('rejected.0.id', 'empty')
        ->assertJsonPath('rejected.0.reason', 'voting')
        ->assertJsonPath('rejected.0.element', $empty)
        ->assertJsonPath('rejected.1', ['id' => 'first', 'reason' => 'voting', 'element' => null]);

    $storedNote = $board->elements()->where('element_id', 'empty')->sole();

    expect($storedNote->data)->toEqual($empty)
        ->and($storedNote->data['boundElements'])->toBeNull()
        ->and($storedNote->version)->toBe(1)
        ->and($board->elements()->where('element_id', 'first')->exists())->toBeFalse();

    Event::assertNotDispatched(WhiteboardElementsChanged::class);
})->with([
    'the note first' => [['note', 'text']],
    'the text first' => [['text', 'note']],
]);

it('still lets an arrow be attached to a note under vote', function () {
    [$board, $user, , $note] = boardUnderVote();
    $empty = sceneElement(['id' => 'empty', 'customData' => ['skrum' => ['kind' => 'sticky']]]);
    WhiteboardElement::factory()->create([
        'whiteboard_id' => $board->id, 'element_id' => 'empty', 'type' => 'rectangle', 'version' => 1, 'version_nonce' => 100,
        'is_sticky' => true, 'seq' => 1, 'data' => $empty,
    ]);
    WhiteboardVoteSession::query()->sole()->update(['element_ids' => ['note', 'kept', 'empty']]);

    writeDuringVote($this->actingAs($user), $board, [
        [...$note, 'version' => 2, 'boundElements' => [['id' => 'link', 'type' => 'arrow'], ['id' => 'note-text', 'type' => 'text']]],
        [...$empty, 'version' => 2, 'x' => 300, 'boundElements' => []],
    ])
        ->assertOk()
        ->assertJsonPath('rejected', [])
        ->assertJsonPath('seq', 3);

    expect($board->elements()->where('element_id', 'note')->sole()->data['boundElements'])->toHaveCount(2)
        ->and($board->elements()->where('element_id', 'empty')->sole()->data['x'])->toBe(300);
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
Expected: FAIL — the text changes are accepted (no `voting` rejection), the note half of a cleared or first text is stored (`rejected` is empty and `seq` moves), the votes of a deleted note stay, the second write of `"0"` answers 500 (unique violation). "copies no vote into a duplicate or a template", "leaves a note added after the vote opened free to edit", "frees the words again", "still lets an arrow be attached to a note under vote" and "still lets a note under vote be moved, restyled and resized" are expected to PASS already: they pin what must stay true.

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

    if ($reason === null && $session !== null && $this->rebindsWordsOfTarget($targetsBefore, $existing, $element)) {
        $reason = 'voting';
    }

    // unchanged: the rejection when `$reason !== null`, `$liveCount`, `$seq++`, `save`, `$stored->put`, `$accepted`

    if ($session !== null && isset($targetsBefore[$element['id']]) && ! $session->isTarget($saved)) {
        $refunded += $session->votes()->where('element_id', $element['id'])->delete();
    }
}
```

`stale`, `locked`, `file` and `full` keep precedence over `voting` (a stale write converges silently, as before). The second check is the note's half of the freeze: it runs for every element in batch order (a note is never deferred) and is false for a text, which is never a target. After `$locked->update(['seq' => $seq])` and the `WhiteboardElementsChanged` broadcast:

```php
if ($session !== null && $refunded > 0) {
    (new WhiteboardVoteChanged($locked->id, $session->id, $this->presentWhiteboardVoting->finishedCount($session)))->sendToAll();
}
```

A replayed batch stops at `isSameWrite` and therefore refunds nothing twice. `rebindsWordsOfTarget` decides "stays a target" from the incoming element the way `save()` will store it (`is_deleted` from `isDeleted`, `is_sticky` from `isset(customData)`); the id is in the session's list because it is a key of `$targetsBefore`. New private methods:

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

/**
 * A note that stays under vote keeps the text it holds: the canvas
 * rewrites the note's list when its words are cleared or first typed,
 * and that half of the batch must not be stored without the other.
 *
 * @param  array<int|string, true>  $targetsBefore
 * @param  array<string, mixed>  $element
 */
private function rebindsWordsOfTarget(array $targetsBefore, ?WhiteboardElement $existing, array $element): bool
{
    if ($existing === null || ! isset($targetsBefore[$element['id']])) {
        return false;
    }

    if ($element['isDeleted'] || ! isset($element['customData'])) {
        return false;
    }

    return $this->boundTextIds($existing->data) !== $this->boundTextIds($element);
}

/**
 * @param  array<string, mixed>  $element
 * @return list<string>
 */
private function boundTextIds(array $element): array
{
    $bound = $element['boundElements'] ?? null;

    if (! is_array($bound)) {
        return [];
    }

    $ids = [];

    foreach ($bound as $entry) {
        if (is_array($entry) && ($entry['type'] ?? null) === 'text' && is_string($entry['id'] ?? null)) {
            $ids[] = $entry['id'];
        }
    }

    $ids = array_values(array_unique($ids));

    sort($ids);

    return $ids;
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

The snippets above, put together, are this change to the file as it stands after Task 2. Everything in it except `rebindsWordsOfTarget`, `boundTextIds` and their one call passed every test of this plan, Pint and PHPStan on the prototype; those three pieces and their tests were added afterwards (Appendix B) and have not been run: see their tests fail first, as for the rest.

```diff
--- a/app/Actions/Whiteboards/WriteWhiteboardElements.php
+++ b/app/Actions/Whiteboards/WriteWhiteboardElements.php
@@ -3,9 +3,11 @@
 namespace App\Actions\Whiteboards;
 
 use App\Events\Whiteboards\WhiteboardElementsChanged;
+use App\Events\Whiteboards\WhiteboardVoteChanged;
 use App\Models\Whiteboard;
 use App\Models\WhiteboardElement;
 use App\Models\WhiteboardMember;
+use App\Models\WhiteboardVoteSession;
 use Illuminate\Support\Collection;
 use Illuminate\Support\Facades\DB;
 
@@ -25,6 +27,7 @@
         private SanitizeWhiteboardElement $sanitizeWhiteboardElement,
         private PresentWhiteboardElement $presentWhiteboardElement,
         private OrderWhiteboardElements $orderWhiteboardElements,
+        private PresentWhiteboardVoting $presentWhiteboardVoting,
     ) {}
 
     /**
@@ -41,13 +44,20 @@
             $fromSeq = $locked->seq;
             $seq = $fromSeq;
             $isFacilitator = $locked->isFacilitator($member);
-            $stored = $this->storedElements($locked, $rawElements);
+            $session = $locked->voteSessions()->whereNull('closed_at')->first();
+            $stored = $this->storedElements($locked, $rawElements, $session !== null);
+            $targetsBefore = $this->targets($session, $stored);
+            $refunded = 0;
             $fileIds = $locked->files()->pluck('file_id')->flip();
             $liveCount = $locked->elements()->where('is_deleted', false)->count();
             $accepted = [];
             $rejected = [];
 
-            foreach ($rawElements as $raw) {
+            $queue = array_map(fn (mixed $raw): array => [$raw, true], array_values($rawElements));
+
+            while ($queue !== []) {
+                [$raw, $mayDefer] = array_shift($queue);
+
                 $element = $this->sanitizeWhiteboardElement->handle($raw);
 
                 if ($element === null) {
@@ -64,8 +74,22 @@
                     continue;
                 }
 
+                if ($mayDefer && $this->isWordsOfTarget($existing, $element, $targetsBefore)) {
+                    $queue[] = [$raw, false];
+
+                    continue;
+                }
+
                 $reason = $this->refusal($existing, $element, $isFacilitator, $fileIds, $liveCount);
 
+                if ($reason === null && ! $mayDefer && $session !== null && $this->changesWordsOfTarget($session, $stored, $targetsBefore, $existing, $element)) {
+                    $reason = 'voting';
+                }
+
+                if ($reason === null && $session !== null && $this->rebindsWordsOfTarget($targetsBefore, $existing, $element)) {
+                    $reason = 'voting';
+                }
+
                 if ($reason !== null) {
                     $rejected[] = $this->rejection($element['id'], $reason, $existing, $member);
 
@@ -79,6 +103,10 @@
 
                 $stored->put($element['id'], $saved);
                 $accepted[$element['id']] = $saved;
+
+                if ($session !== null && isset($targetsBefore[$element['id']]) && ! $session->isTarget($saved)) {
+                    $refunded += $session->votes()->where('element_id', $element['id'])->delete();
+                }
             }
 
             if ($seq === $fromSeq) {
@@ -89,6 +117,10 @@
 
             (new WhiteboardElementsChanged($locked->id, $seq, $fromSeq, $this->broadcastable($accepted)))->sendToOthers();
 
+            if ($session !== null && $refunded > 0) {
+                (new WhiteboardVoteChanged($locked->id, $session->id, $this->presentWhiteboardVoting->finishedCount($session)))->sendToAll();
+            }
+
             return ['seq' => $seq, 'fromSeq' => $fromSeq, 'rejected' => $rejected];
         });
     }
@@ -97,17 +129,170 @@
      * @param  array<int, mixed>  $rawElements
      * @return Collection<string, WhiteboardElement>
      */
-    private function storedElements(Whiteboard $board, array $rawElements): Collection
+    private function storedElements(Whiteboard $board, array $rawElements, bool $withContainers): Collection
     {
         $ids = collect($rawElements)
             ->map(fn (mixed $raw): ?string => $this->rawId($raw))
-            ->filter()
+            ->filter(fn (?string $id): bool => $id !== null)
             ->unique()
             ->values();
 
-        return $board->elements()->whereIn('element_id', $ids)->get()->keyBy('element_id');
+        $stored = $board->elements()->whereIn('element_id', $ids)->get()->keyBy('element_id');
+
+        if (! $withContainers) {
+            return $stored;
+        }
+
+        $containerIds = collect($rawElements)
+            ->map(fn (mixed $raw): mixed => is_array($raw) ? ($raw['containerId'] ?? null) : null)
+            ->merge($stored->map(fn (WhiteboardElement $element): mixed => $element->data['containerId'] ?? null)->values())
+            ->filter(fn (mixed $id): bool => is_string($id) && preg_match(SanitizeWhiteboardElement::IdPattern, $id) === 1 && ! $stored->has($id))
+            ->unique()
+            ->values();
+
+        if ($containerIds->isEmpty()) {
+            return $stored;
+        }
+
+        return $stored->union($board->elements()->whereIn('element_id', $containerIds)->get()->keyBy('element_id'));
     }
 
+    /**
+     * @param  Collection<string, WhiteboardElement>  $stored
+     * @return array<int|string, true>
+     */
+    private function targets(?WhiteboardVoteSession $session, Collection $stored): array
+    {
+        if ($session === null) {
+            return [];
+        }
+
+        $targets = [];
+
+        foreach ($stored as $element) {
+            if ($session->isTarget($element)) {
+                $targets[$element->element_id] = true;
+            }
+        }
+
+        return $targets;
+    }
+
+    /**
+     * @param  array<string, mixed>  $element
+     * @return list<string>
+     */
+    private function containerIds(?WhiteboardElement $existing, array $element): array
+    {
+        return array_values(array_unique(array_filter(
+            [$element['containerId'] ?? null, $existing?->data['containerId'] ?? null],
+            fn (mixed $id): bool => is_string($id),
+        )));
+    }
+
+    /**
+     * @param  array<string, mixed>  $element
+     * @param  array<int|string, true>  $targetsBefore
+     */
+    private function isWordsOfTarget(?WhiteboardElement $existing, array $element, array $targetsBefore): bool
+    {
+        if ($element['type'] !== 'text') {
+            return false;
+        }
+
+        foreach ($this->containerIds($existing, $element) as $containerId) {
+            if (isset($targetsBefore[$containerId])) {
+                return true;
+            }
+        }
+
+        return false;
+    }
+
+    /**
+     * @param  Collection<string, WhiteboardElement>  $stored
+     * @param  array<int|string, true>  $targetsBefore
+     * @param  array<string, mixed>  $element
+     */
+    private function changesWordsOfTarget(WhiteboardVoteSession $session, Collection $stored, array $targetsBefore, ?WhiteboardElement $existing, array $element): bool
+    {
+        $underVote = false;
+
+        foreach ($this->containerIds($existing, $element) as $containerId) {
+            if (isset($targetsBefore[$containerId]) && $session->isTarget($stored->get($containerId))) {
+                $underVote = true;
+            }
+        }
+
+        if (! $underVote) {
+            return false;
+        }
+
+        if ($existing === null) {
+            return true;
+        }
+
+        $before = $existing->data;
+
+        return $this->letters($before['text'] ?? null) !== $this->letters($element['text'] ?? null)
+            || $this->letters($before['originalText'] ?? $before['text'] ?? null) !== $this->letters($element['originalText'] ?? $element['text'] ?? null)
+            || ($before['containerId'] ?? null) !== ($element['containerId'] ?? null)
+            || $existing->is_deleted !== $element['isDeleted'];
+    }
+
+    /**
+     * A note that stays under vote keeps the text it holds: the canvas
+     * rewrites the note's list when its words are cleared or first typed,
+     * and that half of the batch must not be stored without the other.
+     *
+     * @param  array<int|string, true>  $targetsBefore
+     * @param  array<string, mixed>  $element
+     */
+    private function rebindsWordsOfTarget(array $targetsBefore, ?WhiteboardElement $existing, array $element): bool
+    {
+        if ($existing === null || ! isset($targetsBefore[$element['id']])) {
+            return false;
+        }
+
+        if ($element['isDeleted'] || ! isset($element['customData'])) {
+            return false;
+        }
+
+        return $this->boundTextIds($existing->data) !== $this->boundTextIds($element);
+    }
+
+    /**
+     * @param  array<string, mixed>  $element
+     * @return list<string>
+     */
+    private function boundTextIds(array $element): array
+    {
+        $bound = $element['boundElements'] ?? null;
+
+        if (! is_array($bound)) {
+            return [];
+        }
+
+        $ids = [];
+
+        foreach ($bound as $entry) {
+            if (is_array($entry) && ($entry['type'] ?? null) === 'text' && is_string($entry['id'] ?? null)) {
+                $ids[] = $entry['id'];
+            }
+        }
+
+        $ids = array_values(array_unique($ids));
+
+        sort($ids);
+
+        return $ids;
+    }
+
+    private function letters(mixed $text): string
+    {
+        return (string) preg_replace('/\s+/u', '', is_string($text) ? $text : '');
+    }
+
     private function rawId(mixed $raw): ?string
     {
         if (! is_array($raw)) {
```

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

No test runner on the client: this task is checked by the gates and, after the plan, by the browser checks at its end. Every listing below was built in the tree at this task's end state, type-checked (`npm run types:check`), linted and formatted (`npx vp check`), and bundled (`npm run build`). None of it has run in a browser. Diffs are against the files as they are before this task; apply them by hand and let `npx vp check --fix` settle the formatting.

**Files:**
- Create: `resources/js/hooks/use-whiteboard-request.ts`, `resources/js/components/whiteboard/facilitator-bar.tsx`, `resources/js/components/whiteboard/status-bar.tsx`, `resources/js/components/whiteboard/hand-over-dialog.tsx`
- Modify: `resources/js/lib/whiteboard/types.ts`, `resources/js/lib/whiteboard/scene-sync.ts`, `resources/js/lib/whiteboard/files.ts`, `resources/js/hooks/use-whiteboard-channel.ts`, `resources/js/hooks/use-whiteboard.ts`, `resources/js/components/whiteboard/board.tsx`, `resources/js/components/whiteboard/board-menu.tsx`, `resources/js/components/whiteboard/top-bar.tsx`, `resources/css/app.css`, `lang/{en,fr,de,es}.json`

**Interfaces:**
- Consumes: the snapshot of Tasks 1–3 (`board.locked`, `board.followEnabled`, `board.timerEndsAt`, `me.transferCandidates`, `voting`, `votingHistory`, `serverTime` with milliseconds); Wayfinder actions generated by `npm run build` — `WhiteboardTimersController.update(boardId)` → `{timerEndsAt}`, `WhiteboardSettingsController.update(boardId)`, `WhiteboardFacilitatorsController.update(boardId)`, `WhiteboardVoteSessionsController.show({ board, voteSession })` → `WhiteboardVoting` (parameter names read in the generated `resources/js/actions/App/Http/Controllers/Whiteboards/WhiteboardVoteSessionsController.ts`); events `timer.changed` `{timerEndsAt}` and `vote.changed` `{sessionId, finishedCount}`; the 403 with `errors.locked` of Task 2; `TimerDisplay({ endsAt, offset })` of `resources/js/components/retro/timer-display.tsx` (countdown, then "Time's up!", one toast and one sound); `useServerOffset(serverTime)` of `resources/js/hooks/use-countdown.ts`; `retroRequest`, `RetroRequestError(status, message, errors)` of `resources/js/lib/retro/api.ts`.
- Produces (used by Tasks 6 and 7):
  - Types `VoteCount`, `VoteResult`, `VoteTally`, `WhiteboardVoting`, `PastVote`, `TransferCandidate` in `resources/js/lib/whiteboard/types.ts`; `WhiteboardSnapshot` gains `board.locked`, `board.followEnabled`, `board.timerEndsAt`, `me.transferCandidates`, `voting`, `votingHistory`; `RejectReason` gains `'voting'`.
  - `WhiteboardState` (from `useWhiteboard`) gains `serverOffset: number`, `setTimer(timerEndsAt: string | null): void`, `applyTally(sessionId: string, tally: VoteTally): void`; `state.snapshot` gains `voting` and `votingHistory`.
  - `useWhiteboardRequest(): <T>(request: Promise<T>) => Promise<T | undefined>` — the response (`null` for a 204), or `undefined` after a toast that says why it failed. Callers test `=== undefined`.
  - `FacilitatorBar({ state }: { state: WhiteboardState })`; `StatusBar({ children }: { children: ReactNode })`, which renders nothing when it has no child; `HandOverDialog({ state, open, onOpenChange })`.
  - `SceneSyncDeps.onLocked: () => void`.
  - On the canvas wrapper (`.whiteboard-canvas`): class `relative` and the attribute `data-facilitator="true|false"`.

Facts checked in `node_modules/@excalidraw/excalidraw/dist` (0.18.1): the canvas takes `viewModeEnabled?: boolean` (`types/excalidraw/types.d.ts:436`); while the prop is `undefined` the user's own "View mode" toggle exists (`typeof appProps.viewModeEnabled === "undefined"`, `dev/index.js:21592`), and a change of the prop is copied into the state with `!!` (`dev/index.js:30486`), so `true` → `undefined` leaves view mode; the context menu is `<ul class="context-menu">` whose items carry `data-testid="{action name}"` (`dev/index.js:14104`, `14131`), the lock actions being `toggleElementLock` (`dev/index.js:9135`) and `unlockAllElements` (`dev/index.js:9188`). In the repository: `scene-sync.ts` treats 401, 403, 404 and 419 as fatal (`FatalStatuses`); `files.ts` throws `RetroRequestError(status, 'upload refused')` for them without reading the body; `use-whiteboard.ts` sends every event that is not `board.*` to `onElementsChanged`, so the two new events are routed by name before that; `use-whiteboard-toolbar-slot.ts` returns `null` while the shapes toolbar is absent, which is the case in view mode, so the sticky tool would fall back to the top bar unless it is told not to.

- [ ] **Step 1: Types** (`resources/js/lib/whiteboard/types.ts`)

```diff
diff --git a/resources/js/lib/whiteboard/types.ts b/resources/js/lib/whiteboard/types.ts
index efbbb77..6083f53 100644
--- a/resources/js/lib/whiteboard/types.ts
+++ b/resources/js/lib/whiteboard/types.ts
@@ -8,6 +8,33 @@ export type SceneElement = Record<string, unknown> & {
     isDeleted: boolean;
 };
 
+export type VoteCount = { elementId: string; count: number };
+
+export type VoteResult = { elementId: string; text: string; count: number };
+
+export type VoteTally = {
+    myVotes: VoteCount[];
+    remaining: number;
+    finishedCount: number;
+};
+
+export type WhiteboardVoting = {
+    id: string;
+    open: boolean;
+    votesPerMember: number;
+    allowMultiple: boolean;
+    frameElementId: string | null;
+    elementIds: string[];
+    myVotes: VoteCount[];
+    remaining: number;
+    finishedCount: number | null;
+    results: VoteResult[] | null;
+};
+
+export type PastVote = { id: string; closedAt: string; results: VoteResult[] };
+
+export type TransferCandidate = { userId: string; name: string };
+
 export type WhiteboardSnapshot = {
     board: {
         id: string;
@@ -18,6 +45,9 @@ export type WhiteboardSnapshot = {
         guestUrl: string | null;
         cursorsEnabled: boolean;
         reactionsEnabled: boolean;
+        locked: boolean;
+        followEnabled: boolean;
+        timerEndsAt: string | null;
     };
     me: {
         id: string;
@@ -28,15 +58,24 @@ export type WhiteboardSnapshot = {
         isFacilitator: boolean;
         canTakeControl: boolean;
         canDelete: boolean;
+        transferCandidates: TransferCandidate[];
     };
     members: PresenceMember[];
     elements: SceneElement[];
     seq: number;
+    voting: WhiteboardVoting | null;
+    votingHistory: PastVote[];
     links: { team: string | null };
     serverTime: string;
 };
 
-export type RejectReason = 'invalid' | 'stale' | 'locked' | 'file' | 'full';
+export type RejectReason =
+    | 'invalid'
+    | 'stale'
+    | 'locked'
+    | 'file'
+    | 'full'
+    | 'voting';
 
 export type WriteResponse = {
     seq: number;
```

- [ ] **Step 2: Channel events and board state**

`resources/js/hooks/use-whiteboard-channel.ts`:

```diff
diff --git a/resources/js/hooks/use-whiteboard-channel.ts b/resources/js/hooks/use-whiteboard-channel.ts
index 9308b07..49ab0be 100644
--- a/resources/js/hooks/use-whiteboard-channel.ts
+++ b/resources/js/hooks/use-whiteboard-channel.ts
@@ -6,6 +6,8 @@ import { useSafeConnectionStatus } from './use-retro-channel';
 
 export const WhiteboardEvents = [
     'elements.changed',
+    'timer.changed',
+    'vote.changed',
     'board.changed',
     'board.deleted',
 ] as const;
```

`resources/js/hooks/use-whiteboard.ts` becomes (run `npm run build` first if `@/actions/.../WhiteboardVoteSessionsController` is missing: Wayfinder generates it):

```ts
import { useCallback, useEffect, useRef, useState } from 'react';
import WhiteboardSnapshotsController from '@/actions/App/Http/Controllers/Whiteboards/WhiteboardSnapshotsController';
import WhiteboardVoteSessionsController from '@/actions/App/Http/Controllers/Whiteboards/WhiteboardVoteSessionsController';
import type { WhisperChannel } from '@/lib/realtime/whisper-transport';
import { RetroRequestError, retroRequest } from '@/lib/retro/api';
import type { PresenceMember } from '@/lib/retro/types';
import type {
    ElementsChangedPayload,
    VoteTally,
    WhiteboardSnapshot,
    WhiteboardVoting,
} from '@/lib/whiteboard/types';
import { useServerOffset } from './use-countdown';
import { useWhiteboardChannel } from './use-whiteboard-channel';

const SessionExpiredStatuses = [401, 419];
/** One fetch of the viewer's own votes covers every vote event of this window. */
const TallyCoalesceMs = 1500;

export type BoardStatus = 'active' | 'ended' | 'deleted';

type BoardMeta = Pick<
    WhiteboardSnapshot,
    'board' | 'me' | 'members' | 'links' | 'voting' | 'votingHistory'
>;

export type SceneListeners = {
    onElementsChanged: (payload: ElementsChangedPayload) => void;
    onResync: () => void;
    onLeaving: (member: PresenceMember) => void;
};

export type WhiteboardState = {
    snapshot: BoardMeta;
    status: BoardStatus;
    sessionExpired: boolean;
    online: PresenceMember[];
    presence: WhisperChannel | null;
    connected: boolean;
    reconnecting: boolean;
    /** Server clock minus this browser's, in milliseconds. */
    serverOffset: number;
    refetch: () => Promise<void>;
    fail: (error: RetroRequestError) => void;
    setTimer: (timerEndsAt: string | null) => void;
    applyTally: (sessionId: string, tally: VoteTally) => void;
    listeners: { current: SceneListeners | null };
};

/**
 * Board settings, members, voting state and access. The scene itself lives
 * in Excalidraw and is kept in step by scene-sync, which registers itself in
 * `listeners`.
 */
export function useWhiteboard(initial: WhiteboardSnapshot): WhiteboardState {
    const [snapshot, setSnapshot] = useState<BoardMeta>(initial);
    const [status, setStatus] = useState<BoardStatus>('active');
    const [sessionExpired, setSessionExpired] = useState(false);
    const initialOffset = useServerOffset(initial.serverTime);
    const [measuredOffset, setMeasuredOffset] = useState<number | null>(null);
    const listeners = useRef<SceneListeners | null>(null);
    const latestRefetch = useRef(0);
    /** Bumped by every answer to a vote of this tab: older fetches are stale. */
    const voteEpoch = useRef(0);
    const tallyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const boardId = initial.board.id;

    useEffect(
        () => () => {
            if (tallyTimer.current !== null) {
                clearTimeout(tallyTimer.current);
            }
        },
        [],
    );

    const fail = useCallback((error: RetroRequestError) => {
        if (SessionExpiredStatuses.includes(error.status)) {
            setSessionExpired(true);

            return;
        }

        setStatus(error.status === 404 ? 'deleted' : 'ended');
    }, []);

    const refetch = useCallback(async () => {
        const request = ++latestRefetch.current;
        const sentAt = Date.now();
        const epoch = voteEpoch.current;

        try {
            const fresh = await retroRequest<WhiteboardSnapshot>(
                WhiteboardSnapshotsController.show(boardId),
            );

            if (request !== latestRefetch.current) {
                return;
            }

            setMeasuredOffset(
                new Date(fresh.serverTime).getTime() -
                    (sentAt + Date.now()) / 2,
            );
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
        } catch (error) {
            if (
                error instanceof RetroRequestError &&
                [401, 403, 404, 419].includes(error.status)
            ) {
                fail(error);
            }
        }
    }, [boardId, fail]);

    const setTimer = useCallback((timerEndsAt: string | null) => {
        setSnapshot((current) => ({
            ...current,
            board: { ...current.board, timerEndsAt },
        }));
    }, []);

    const applyTally = useCallback((sessionId: string, tally: VoteTally) => {
        voteEpoch.current += 1;
        setSnapshot((current) =>
            current.voting?.id === sessionId && current.voting.open
                ? { ...current, voting: { ...current.voting, ...tally } }
                : current,
        );
    }, []);

    /** The event does not say who voted: each client asks for its own tally. */
    const fetchTally = async (sessionId: string) => {
        const epoch = voteEpoch.current;

        try {
            const fresh = await retroRequest<WhiteboardVoting>(
                WhiteboardVoteSessionsController.show({
                    board: boardId,
                    voteSession: sessionId,
                }),
            );

            if (epoch !== voteEpoch.current) {
                return;
            }

            setSnapshot((current) =>
                current.voting?.id === fresh.id
                    ? { ...current, voting: fresh }
                    : current,
            );
        } catch {
            // The next vote event or board.changed catches up.
        }
    };

    const onVoteChanged = (sessionId: string, finishedCount: number) => {
        setSnapshot((current) =>
            current.voting?.id === sessionId && current.voting.open
                ? { ...current, voting: { ...current.voting, finishedCount } }
                : current,
        );

        if (tallyTimer.current !== null) {
            return;
        }

        tallyTimer.current = setTimeout(() => {
            tallyTimer.current = null;
            void fetchTally(sessionId);
        }, TallyCoalesceMs);
    };

    const channel = useWhiteboardChannel(boardId, status === 'active', {
        onEvent: ({ name, payload }) => {
            if (name === 'board.deleted') {
                setStatus('deleted');

                return;
            }

            if (name === 'board.changed') {
                void refetch();

                return;
            }

            if (name === 'timer.changed') {
                setTimer(
                    (payload as { timerEndsAt: string | null }).timerEndsAt,
                );

                return;
            }

            if (name === 'vote.changed') {
                const { sessionId, finishedCount } = payload as {
                    sessionId: string;
                    finishedCount: number;
                };

                onVoteChanged(sessionId, finishedCount);

                return;
            }

            listeners.current?.onElementsChanged(
                payload as ElementsChangedPayload,
            );
        },
        onResync: () => {
            void refetch();
            listeners.current?.onResync();
        },
        onLeaving: (member) => listeners.current?.onLeaving(member),
    });

    return {
        snapshot,
        status,
        sessionExpired,
        ...channel,
        serverOffset: measuredOffset ?? initialOffset,
        refetch,
        fail,
        setTimer,
        applyTally,
        listeners,
    };
}
```

What it does that is not obvious:
- **Clock offset.** `useServerOffset(initial.serverTime)` is late by the time the page took to load. Every `refetch` measures again around its request (`sentAt`, then the midpoint), and the channel's first `here` triggers a refetch moments after the page opens. `TimerDisplay` gets `serverOffset`.
- **Votes.** `vote.changed` never says who voted (spec §12). The handler shows the new `finishedCount` at once and schedules one fetch of the viewer's own session state 1 500 ms later; events arriving meanwhile join that fetch. `voteEpoch` grows with every answer to a vote cast in this tab: a fetch or a snapshot that started before such an answer is older than it and must not replace it.

- [ ] **Step 3: `resources/js/hooks/use-whiteboard-request.ts`**

```ts
import { useCallback } from 'react';
import { toast } from 'sonner';
import { useTrans } from '@/hooks/use-trans';
import { RetroRequestError } from '@/lib/retro/api';

/**
 * Runs a request and says why it failed. Resolves to the response (null for
 * a 204), or to undefined after the toast.
 */
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

`board-menu.tsx` keeps its own `attempt` and `run`.

- [ ] **Step 4: The locked refusal in the sync**

`resources/js/lib/whiteboard/files.ts` — the body of an access refusal is read so that `errors` survives:

```diff
diff --git a/resources/js/lib/whiteboard/files.ts b/resources/js/lib/whiteboard/files.ts
index 8ab185a..ceee864 100644
--- a/resources/js/lib/whiteboard/files.ts
+++ b/resources/js/lib/whiteboard/files.ts
@@ -56,7 +56,15 @@ export async function uploadBoardFile(
     }
 
     if (AccessStatuses.includes(response.status)) {
-        throw new RetroRequestError(response.status, 'upload refused');
+        const payload = (await response.json().catch(() => null)) as {
+            errors?: Record<string, string[]>;
+        } | null;
+
+        throw new RetroRequestError(
+            response.status,
+            'upload refused',
+            payload?.errors ?? {},
+        );
     }
 
     throw new Error(`upload failed: ${response.status}`);
```

`resources/js/lib/whiteboard/scene-sync.ts`:

```diff
diff --git a/resources/js/lib/whiteboard/scene-sync.ts b/resources/js/lib/whiteboard/scene-sync.ts
index b68b231..d7514cb 100644
--- a/resources/js/lib/whiteboard/scene-sync.ts
+++ b/resources/js/lib/whiteboard/scene-sync.ts
@@ -31,6 +31,8 @@ export type SceneSyncDeps = {
     onFatal: (error: RetroRequestError) => void;
     onRejected: (reason: RejectReason) => void;
     onOffline: (offline: boolean) => void;
+    /** The board is locked for this member: unsent edits were dropped. */
+    onLocked: () => void;
 };
 
 export type SceneSync = {
@@ -46,6 +48,11 @@ const stamp = (element: SceneElement) =>
 const isFatal = (error: unknown): error is RetroRequestError =>
     error instanceof RetroRequestError && FatalStatuses.includes(error.status);
 
+const isLocked = (error: unknown): error is RetroRequestError =>
+    error instanceof RetroRequestError &&
+    error.status === 403 &&
+    'locked' in error.errors;
+
 export function createSceneSync(deps: SceneSyncDeps): SceneSync {
     const { api, boardId } = deps;
     /** What the server is known to hold, per element. */
@@ -64,6 +71,8 @@ export function createSceneSync(deps: SceneSyncDeps): SceneSync {
     let recoveryOwed = false;
     let recoveryFailures = 0;
     let recoveryTimer: ReturnType<typeof setTimeout> | null = null;
+    /** The next reload drops what the server does not hold (locked board). */
+    let discarding = false;
 
     /** Nothing may report the board in step while a reload is still owed. */
     const setOffline = (offline: boolean) =>
@@ -327,6 +336,14 @@ export function createSceneSync(deps: SceneSyncDeps): SceneSync {
         } catch (error) {
             failed = true;
 
+            if (isLocked(error)) {
+                failed = false;
+                discard();
+                deps.onLocked();
+
+                return;
+            }
+
             if (isFatal(error)) {
                 deps.onFatal(error);
 
@@ -350,12 +367,13 @@ export function createSceneSync(deps: SceneSyncDeps): SceneSync {
             WhiteboardSnapshotsController.show(boardId),
         );
         const alive = new Set(snapshot.elements.map((element) => element.id));
+        const dropsLocal = discarding;
+        const keepsLocal = (element: SceneElement) =>
+            !dropsLocal && (pending.has(element.id) || !known.has(element.id));
 
         setScene(
             scene().map((element) =>
-                alive.has(element.id) ||
-                pending.has(element.id) ||
-                !known.has(element.id)
+                alive.has(element.id) || keepsLocal(element)
                     ? element
                     : { ...element, isDeleted: true },
             ),
@@ -363,6 +381,10 @@ export function createSceneSync(deps: SceneSyncDeps): SceneSync {
         remember(scene().filter((element) => !alive.has(element.id)));
         force(snapshot.elements);
         seq = snapshot.seq;
+
+        if (dropsLocal) {
+            discarding = false;
+        }
     };
 
     /**
@@ -421,9 +443,21 @@ export function createSceneSync(deps: SceneSyncDeps): SceneSync {
             })
             .finally(() => {
                 recovering = null;
+
+                // A discard asked for while a reload was running.
+                if (discarding && !disposed && recoveryTimer === null) {
+                    recover();
+                }
             });
     };
 
+    /** The board is locked for us: what we have not sent is dropped (spec §11.2). */
+    const discard = () => {
+        pending.clear();
+        discarding = true;
+        recover();
+    };
+
     const fetchDelta = async () => {
         const delta = await retroRequest<ElementsDelta>(
             WhiteboardElementsController.index(boardId, {
```

Why each part:
- `isLocked` is tested **before** `isFatal`: 403 is in `FatalStatuses`, and falling through would show "Your access to this board has ended".
- The refused batch was already taken out of `pending` and is not requeued; `discard()` drops the rest and asks for a reload of the scene.
- In `replaceScene`, local elements the server does not hold are normally kept (they may be unsent work). While `discarding`, they are tombstoned locally; the two lines that follow (`remember(...)`, `force(snapshot.elements)`) stamp those tombstones as known, so they are never sent, and put the server's copy over every local one.
- The flag is read once per reload (`dropsLocal`) and cleared by the reload that used it. A discard asked for while a reload is already running is honoured by the `finally` branch, which starts another one.

- [ ] **Step 5: `StatusBar` and `FacilitatorBar`**

`resources/js/components/whiteboard/status-bar.tsx`:

```tsx
import { Children, type ReactNode } from 'react';

/** What everyone on the board needs to know right now; nothing when calm. */
export function StatusBar({ children }: { children: ReactNode }) {
    if (Children.toArray(children).length === 0) {
        return null;
    }

    return (
        <div
            role="status"
            className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b bg-muted/40 px-4 py-1.5 text-sm"
        >
            {children}
        </div>
    );
}
```

It is a row in the page flow between the top bar and the canvas, so it covers nothing; the canvas resizes itself.

`resources/js/components/whiteboard/facilitator-bar.tsx` (timer and lock; Task 6 adds follow-me, Task 7 the vote):

```tsx
import { AlarmClock, Lock, LockOpen } from 'lucide-react';
import { useState } from 'react';
import WhiteboardSettingsController from '@/actions/App/Http/Controllers/Whiteboards/WhiteboardSettingsController';
import WhiteboardTimersController from '@/actions/App/Http/Controllers/Whiteboards/WhiteboardTimersController';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useTrans } from '@/hooks/use-trans';
import type { WhiteboardState } from '@/hooks/use-whiteboard';
import { useWhiteboardRequest } from '@/hooks/use-whiteboard-request';
import { retroRequest } from '@/lib/retro/api';

const Minutes = [1, 3, 5, 10];

/** The facilitator's tools; follow-me and the vote join them in later tasks. */
export function FacilitatorBar({ state }: { state: WhiteboardState }) {
    const { t } = useTrans();
    const request = useWhiteboardRequest();
    const [busy, setBusy] = useState(false);
    const { board } = state.snapshot;

    const setTimer = async (seconds: number | null) => {
        setBusy(true);

        const response = await request(
            retroRequest<{ timerEndsAt: string | null }>(
                WhiteboardTimersController.update(board.id),
                { seconds },
            ),
        );

        setBusy(false);

        if (response !== undefined) {
            state.setTimer(response.timerEndsAt);
        }
    };

    const updateSettings = async (settings: Record<string, boolean>) => {
        const done = await request(
            retroRequest(
                WhiteboardSettingsController.update(board.id),
                settings,
            ),
        );

        if (done !== undefined) {
            await state.refetch();
        }
    };

    return (
        <div
            role="toolbar"
            aria-label={t('Facilitation tools')}
            className="flex items-center gap-1"
        >
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button size="sm" variant="outline" aria-label={t('Timer')}>
                        <AlarmClock className="size-4" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    {Minutes.map((minutes) => (
                        <DropdownMenuItem
                            key={minutes}
                            disabled={busy}
                            onSelect={() => void setTimer(minutes * 60)}
                        >
                            {t(':count min', { count: minutes })}
                        </DropdownMenuItem>
                    ))}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                        disabled={busy || board.timerEndsAt === null}
                        onSelect={() => void setTimer(null)}
                    >
                        {t('Stop timer')}
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
            <Button
                size="sm"
                variant={board.locked ? 'default' : 'outline'}
                aria-pressed={board.locked}
                aria-label={t(
                    board.locked ? 'Unlock the board' : 'Lock the board',
                )}
                title={t(board.locked ? 'Unlock the board' : 'Lock the board')}
                onClick={() => void updateSettings({ locked: !board.locked })}
            >
                {board.locked ? (
                    <Lock className="size-4" />
                ) : (
                    <LockOpen className="size-4" />
                )}
            </Button>
        </div>
    );
}
```

The timer menu is the retro one (`resources/js/components/retro/timer-control.tsx`) with the board's endpoint. "Stop timer" is disabled when the snapshot shows no timer, which includes one that ended more than five minutes ago (Task 1).

- [ ] **Step 6: Hand-over dialog and board menu**

`resources/js/components/whiteboard/hand-over-dialog.tsx` (the structure of `resources/js/components/poker/transfer-dialog.tsx`; the form is mounted only while open, so the choice resets; a failure leaves the dialog open, spec §13):

```tsx
import { useState } from 'react';
import WhiteboardFacilitatorsController from '@/actions/App/Http/Controllers/Whiteboards/WhiteboardFacilitatorsController';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { useTrans } from '@/hooks/use-trans';
import type { WhiteboardState } from '@/hooks/use-whiteboard';
import { useWhiteboardRequest } from '@/hooks/use-whiteboard-request';
import { retroRequest } from '@/lib/retro/api';

type Props = {
    state: WhiteboardState;
    open: boolean;
    onOpenChange: (open: boolean) => void;
};

export function HandOverDialog({ state, open, onOpenChange }: Props) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent aria-describedby={undefined}>
                {open && (
                    <HandOverForm
                        state={state}
                        onClose={() => onOpenChange(false)}
                    />
                )}
            </DialogContent>
        </Dialog>
    );
}

function HandOverForm({
    state,
    onClose,
}: {
    state: WhiteboardState;
    onClose: () => void;
}) {
    const { t } = useTrans();
    const request = useWhiteboardRequest();
    const [userId, setUserId] = useState('');
    const [busy, setBusy] = useState(false);
    const { board, me } = state.snapshot;
    const candidates = me.transferCandidates;

    const handOver = async () => {
        setBusy(true);

        const done = await request(
            retroRequest(WhiteboardFacilitatorsController.update(board.id), {
                user_id: userId,
            }),
        );

        setBusy(false);

        if (done === undefined) {
            return;
        }

        await state.refetch();
        onClose();
    };

    return (
        <>
            <DialogTitle>{t('Hand over facilitation')}</DialogTitle>

            {candidates.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                    {t('No one else can facilitate this board yet.')}
                </p>
            ) : (
                <div className="grid gap-2">
                    <Label htmlFor="whiteboard-new-facilitator">
                        {t('New facilitator')}
                    </Label>
                    <Select value={userId} onValueChange={setUserId}>
                        <SelectTrigger id="whiteboard-new-facilitator">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {candidates.map((candidate) => (
                                <SelectItem
                                    key={candidate.userId}
                                    value={candidate.userId}
                                >
                                    {candidate.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            )}

            <DialogFooter className="gap-2">
                <Button type="button" variant="secondary" onClick={onClose}>
                    {t('Cancel')}
                </Button>
                {candidates.length > 0 && (
                    <Button
                        disabled={busy || userId === ''}
                        onClick={() => void handOver()}
                    >
                        {t('Hand over')}
                    </Button>
                )}
            </DialogFooter>
        </>
    );
}
```

`resources/js/components/whiteboard/board-menu.tsx` — "Hand over facilitation" in the facilitator block, after "Rename"; "Take control", "Duplicate this board" and "Save as template" stay as they are:

```diff
--- a/resources/js/components/whiteboard/board-menu.tsx
+++ b/resources/js/components/whiteboard/board-menu.tsx
@@ -23,6 +23,7 @@
     DropdownMenuTrigger,
 } from '@/components/ui/dropdown-menu';
 import { Input } from '@/components/ui/input';
+import { HandOverDialog } from '@/components/whiteboard/hand-over-dialog';
 import { SaveTemplateDialog } from '@/components/whiteboard/save-template-dialog';
 import { useTrans } from '@/hooks/use-trans';
 import type { WhiteboardState } from '@/hooks/use-whiteboard';
@@ -44,6 +45,7 @@
     const [renaming, setRenaming] = useState(false);
     const [confirmingDelete, setConfirmingDelete] = useState(false);
     const [savingTemplate, setSavingTemplate] = useState(false);
+    const [handingOver, setHandingOver] = useState(false);
 
     /** Resolves to whether the request went through; says why when it did not. */
     const attempt = async (request: Promise<unknown>): Promise<boolean> => {
@@ -174,6 +176,11 @@
                             >
                                 {t('Rename')}
                             </DropdownMenuItem>
+                            <DropdownMenuItem
+                                onSelect={() => setHandingOver(true)}
+                            >
+                                {t('Hand over facilitation')}
+                            </DropdownMenuItem>
                             <DropdownMenuCheckboxItem
                                 checked={board.cursorsEnabled}
                                 onCheckedChange={(checked) =>
@@ -259,6 +266,12 @@
                 onOpenChange={setSavingTemplate}
             />
 
+            <HandOverDialog
+                state={state}
+                open={handingOver}
+                onOpenChange={setHandingOver}
+            />
+
             <Dialog open={confirmingDelete} onOpenChange={setConfirmingDelete}>
                 <DialogContent aria-describedby={undefined}>
                     <DialogTitle>{t('Delete this board?')}</DialogTitle>
```

- [ ] **Step 7: `board.tsx` and `top-bar.tsx`**

```diff
--- a/resources/js/components/whiteboard/board.tsx
+++ b/resources/js/components/whiteboard/board.tsx
@@ -1,9 +1,11 @@
 import { usePage } from '@inertiajs/react';
+import { Lock } from 'lucide-react';
 import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
 import { createPortal } from 'react-dom';
 import { toast } from 'sonner';
 import { ConnectionBanner } from '@/components/retro/connection-banner';
 import { SessionExpiredBanner } from '@/components/retro/session-expired-banner';
+import { TimerDisplay } from '@/components/retro/timer-display';
 import { useLocalPreference } from '@/hooks/use-local-preference';
 import { useTrans } from '@/hooks/use-trans';
 import { useWhiteboard } from '@/hooks/use-whiteboard';
@@ -24,6 +26,8 @@
 import { BoardGone } from './board-gone';
 import { BoardMenu } from './board-menu';
 import { BoardReactions } from './board-reactions';
+import { FacilitatorBar } from './facilitator-bar';
+import { StatusBar } from './status-bar';
 import { StickyTool } from './sticky-tool';
 import { TopBar } from './top-bar';
 
@@ -54,6 +58,8 @@
     const { t } = useTrans();
     const { locale } = usePage().props;
     const state = useWhiteboard(snapshot);
+    const { board, me } = state.snapshot;
+    const viewOnly = board.locked && !me.isFacilitator;
     const [api, setApi] = useState<ExcalidrawImperativeAPI | null>(null);
     const [offline, setOffline] = useState(false);
     const [hideMyCursor, setHideMyCursor] = useLocalPreference(
@@ -72,7 +78,7 @@
         presence: state.presence,
         online: state.online,
         meId: state.snapshot.me.id,
-        enabled: state.snapshot.board.cursorsEnabled,
+        enabled: board.cursorsEnabled,
         hidden: hideMyCursor,
     });
     const forgetCursor = useRef(cursors.forget);
@@ -80,7 +86,7 @@
     forgetCursor.current = cursors.forget;
     const dark = useSyncExternalStore(subscribeToTheme, isDark, () => false);
     const boardId = snapshot.board.id;
-    const { fail, listeners } = state;
+    const { fail, listeners, refetch } = state;
 
     const rejectionMessages = useRef<Record<RejectReason, string>>({
         invalid: '',
@@ -88,14 +94,19 @@
         locked: '',
         file: '',
         full: '',
+        voting: '',
     });
+    const lockedMessage = useRef('');
 
+    lockedMessage.current = t('This board is locked.');
+
     rejectionMessages.current = {
         invalid: t('This element could not be saved.'),
         stale: '',
         locked: t('Only the facilitator can change a locked element.'),
         file: t('This image could not be added.'),
         full: t('This board is full.'),
+        voting: t('Notes cannot be edited while a vote is open.'),
     };
 
     useEffect(() => {
@@ -111,6 +122,11 @@
             onRejected: (reason) =>
                 toast.error(rejectionMessages.current[reason], { id: reason }),
             onOffline: setOffline,
+            onLocked: () => {
+                toast.error(lockedMessage.current, { id: 'locked' });
+                // The lock may have been missed with its board.changed.
+                void refetch();
+            },
         });
 
         sync.current = created;
@@ -127,7 +143,7 @@
             sync.current = null;
             listeners.current = null;
         };
-    }, [api, boardId, fail, listeners]);
+    }, [api, boardId, fail, listeners, refetch]);
 
     useEffect(() => {
         if (state.connected || state.status !== 'active') {
@@ -156,7 +172,14 @@
                 inert={state.sessionExpired}
             >
                 <TopBar state={state}>
-                    {api && !toolbarSlot && <StickyTool api={api} />}
+                    <TimerDisplay
+                        endsAt={board.timerEndsAt}
+                        offset={state.serverOffset}
+                    />
+                    {me.isFacilitator && <FacilitatorBar state={state} />}
+                    {api && !toolbarSlot && !viewOnly && (
+                        <StickyTool api={api} />
+                    )}
                     <BoardMenu
                         state={state}
                         hideMyCursor={hideMyCursor}
@@ -166,17 +189,30 @@
                 <ConnectionBanner
                     reconnecting={state.reconnecting || offline}
                 />
+                <StatusBar>
+                    {viewOnly && (
+                        <span className="flex items-center gap-1.5">
+                            <Lock className="size-4" aria-hidden="true" />
+                            {t('This board is locked.')}
+                        </span>
+                    )}
+                </StatusBar>
                 {api &&
                     toolbarSlot &&
                     createPortal(
                         <StickyTool api={api} inToolbar />,
                         toolbarSlot,
                     )}
-                <div ref={canvas} className="whiteboard-canvas min-h-0 flex-1">
+                <div
+                    ref={canvas}
+                    className="whiteboard-canvas relative min-h-0 flex-1"
+                    data-facilitator={me.isFacilitator}
+                >
                     <Excalidraw
+                        viewModeEnabled={viewOnly ? true : undefined}
                         excalidrawAPI={setApi}
                         initialData={{ elements: initialElements as never }}
-                        name={state.snapshot.board.title}
+                        name={board.title}
                         onChange={(elements) =>
                             sync.current?.handleChange(
                                 elements as unknown as SceneElement[],
```

Points to keep when applying it:
- `viewModeEnabled={viewOnly ? true : undefined}`, not `false`: `false` would remove the user's own view-mode toggle on an unlocked board.
- The sticky tool's fallback in the top bar is not shown to someone who is view-only.
- `onLocked` refetches the snapshot: the client learns the lock even when it missed `board.changed`. `lockedMessage` is a ref refreshed on each render, as `rejectionMessages` is, so the effect does not restart when the locale's strings change.
- The class `whiteboard-canvas` stays on a **sibling of the reactions bar**: four rules of `resources/css/app.css` (`.whiteboard-canvas:has(~ .whiteboard-reactions) …`, `.whiteboard-canvas:has(.excalidraw--mobile) ~ .whiteboard-reactions`) rely on it.

`resources/js/components/whiteboard/top-bar.tsx` — the tools wrap under the title on a narrow screen:

```diff
diff --git a/resources/js/components/whiteboard/top-bar.tsx b/resources/js/components/whiteboard/top-bar.tsx
index aea395a..4886f62 100644
--- a/resources/js/components/whiteboard/top-bar.tsx
+++ b/resources/js/components/whiteboard/top-bar.tsx
@@ -17,7 +17,7 @@ export function TopBar({
     const { board, links } = state.snapshot;
 
     return (
-        <header className="flex items-center gap-3 border-b px-4 py-2">
+        <header className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b px-4 py-2">
             {links.team && (
                 <Button asChild size="icon" variant="ghost">
                     <Link href={links.team} aria-label={t('Back to the team')}>
```

- [ ] **Step 8: Lock entries of the context menu** — append to the board block of `resources/css/app.css`:

```css
/*
 * Only the facilitator may lock or unlock an element (spec §11.2). The
 * context menu of Excalidraw 0.18.1 names its entries by action; the
 * keyboard shortcut cannot be removed, and the server rejects what it does.
 */
.whiteboard-canvas[data-facilitator='false']
    .context-menu
    li[data-testid='toggleElementLock'],
.whiteboard-canvas[data-facilitator='false']
    .context-menu
    li[data-testid='unlockAllElements'] {
    display: none !important;
}
```

- [ ] **Step 9: Translation keys** (append to each `lang/*.json`; `en.json` with value = key)

| Key (English) | French | German | Spanish |
|---|---|---|---|
| Facilitation tools | Outils d'animation | Moderationswerkzeuge | Herramientas de facilitación |
| Lock the board | Verrouiller le tableau | Board sperren | Bloquear la pizarra |
| Unlock the board | Déverrouiller le tableau | Board entsperren | Desbloquear la pizarra |
| Notes cannot be edited while a vote is open. | Les post-it ne peuvent pas être modifiés pendant un vote. | Haftnotizen können während einer Abstimmung nicht bearbeitet werden. | Las notas no se pueden editar mientras hay una votación abierta. |
| No one else can facilitate this board yet. | Personne d'autre ne peut encore animer ce tableau. | Noch kann niemand sonst dieses Board moderieren. | Nadie más puede facilitar esta pizarra todavía. |

Already in the four files (checked with `grep` at reconciliation; do not add again): `This board is locked.` (Task 2), `Timer`, `:count min`, `Stop timer`, `Time's up!`, `Hand over facilitation`, `New facilitator`, `Hand over`, `Cancel`, `Something went wrong. Please try again.`, `Only the facilitator can change a locked element.`

- [ ] **Step 10: Gates and commit**

Run: `npm run build && npm run types:check && npx vp check resources/js/lib/whiteboard resources/js/hooks/use-whiteboard.ts resources/js/hooks/use-whiteboard-channel.ts resources/js/hooks/use-whiteboard-request.ts resources/js/components/whiteboard resources/css/app.css && DB_HOST=127.0.0.1 php artisan test --compact tests/Feature/TranslationKeysTest.php`
Expected: `types:check` shows only the known `manage-passkeys.tsx` error; no `vp check` failure; test PASS.

```bash
git add resources/js/lib/whiteboard/types.ts resources/js/lib/whiteboard/scene-sync.ts resources/js/lib/whiteboard/files.ts resources/js/hooks/use-whiteboard.ts resources/js/hooks/use-whiteboard-channel.ts resources/js/hooks/use-whiteboard-request.ts resources/js/components/whiteboard/facilitator-bar.tsx resources/js/components/whiteboard/status-bar.tsx resources/js/components/whiteboard/hand-over-dialog.tsx resources/js/components/whiteboard/board.tsx resources/js/components/whiteboard/board-menu.tsx resources/js/components/whiteboard/top-bar.tsx resources/css/app.css lang/en.json lang/fr.json lang/de.json lang/es.json
git commit -m "feat(whiteboard): countdown, board lock and hand-over on the board page"
```

**Browser checks** (for the walkthrough after the plan; A = facilitator, B = guest or second member):
- B5.1 Facilitator: the top bar shows a timer button and a lock button; a member and a guest see neither. Nothing new lies over the canvas, its shapes toolbar, its bottom controls or the reactions bar, at 1280 px and at 375 px; the canvas still fills the area under the bars.
- B5.2 A starts "1 min": within a second every browser shows the same countdown in the top bar (A and B at most one second apart); at zero each shows "Time's up!", a toast, and plays the sound. "Stop timer" removes it everywhere. A browser that opens the board mid-countdown shows the right remaining time.
- B5.3 A locks: B's canvas loses its shapes toolbar and the sticky tool (in the toolbar and in the top bar), a drag pans, the status row says "This board is locked."; B can still pan, zoom and send a reaction. A can still draw and B sees it. Unlock: B's tools come back without a reload.
- B5.4 From B's console on a locked board, `fetch` a `PUT /whiteboards/<id>/elements` with one element and the XSRF header: 403, body `errors.locked`; the page stays on the board (no "Your access to this board has ended") and the element is not in `GET snapshot`.
- B5.5 B starts typing in a text, A locks while B types: B's unsent text disappears, B sees the toast "This board is locked." and stays on the board in view mode, and A's canvas never shows the text.
- B5.6 A locks a shape (context menu). B right-clicks it and the empty canvas: no "Lock" / "Unlock" / "Unlock all elements" entry; B drags the shape: it returns to its place and the toast "Only the facilitator can change a locked element." shows. A still sees the entries.
- B5.7 Board menu of A: "Hand over facilitation" lists the other team members and the workspace's owners and admins by name, never a guest; choosing one makes them facilitator (A's top bar loses the tools without a reload, the snapshot's `facilitatorMemberId` changes); A then takes control back from the menu. With nobody else to choose the dialog says "No one else can facilitate this board yet.".
- B5.8 The canvas's own "View mode" entry (context menu on the empty canvas) is still there on an unlocked board.

---

### Task 6: Follow-me

The listings were type-checked, linted and bundled at this task's end state; follow-me has never run in a browser, and it has no server rule a feature test could pin (whispers never reach the server): its proof is the browser checks.

Names checked in `node_modules/@excalidraw/excalidraw/dist` (0.18.1): `ExcalidrawImperativeAPI.onScrollChange(callback: (scrollX, scrollY, zoom: Zoom) => void): UnsubscribeCallback` and `getAppState()` (`types/excalidraw/types.d.ts:634`, `612`); `AppState` fields `scrollX`, `scrollY`, `zoom: {value}`, `width`, `height` (`types.d.ts:245–310`); `updateScene({ appState })` takes `Pick<AppState, K>` (`types/excalidraw/components/App.d.ts:370`), and `Zoom['value']` is a branded number, hence the one cast in `apply`; the visible scene rectangle is `[-scrollX, -scrollY, -scrollX + width / zoom, -scrollY + height / zoom]` (`getVisibleSceneBounds`, `dev/chunk-4FTI6OG3.js:10591`); zoom is clamped to 0.1–30 (`MIN_ZOOM`, `MAX_ZOOM`, `dev/chunk-4FTI6OG3.js:291–292`). In the repository: `whisperTransport(channel, event, accept)` hands `accept` the sender id stamped by Reverb (`resources/js/lib/realtime/whisper-transport.ts`).

**Files:**
- Create: `resources/js/hooks/use-whiteboard-follow.ts`
- Modify: `resources/js/components/whiteboard/facilitator-bar.tsx`, `resources/js/components/whiteboard/board.tsx`, `lang/{en,fr,de,es}.json`

**Interfaces:**
- Consumes: `state.snapshot.board.followEnabled`, `board.facilitatorMemberId`, `me.isFacilitator`, `state.presence` (a `WhisperChannel | null`), `WhiteboardSettingsController.update(boardId)` with `{follow_enabled}`, `StatusBar`, `FacilitatorBar` and its `updateSettings` (Task 5).
- Produces: `useWhiteboardFollow({ api, presence, enabled, leading, facilitatorId }): { following: boolean; paused: boolean; resume(): void }`. Whisper `viewport`: `{x, y, width, height}` in scene coordinates.

- [ ] **Step 1: `resources/js/hooks/use-whiteboard-follow.ts`**

```ts
import { useEffect, useRef, useState } from 'react';
import {
    whisperTransport,
    type WhisperChannel,
} from '@/lib/realtime/whisper-transport';
import type { ExcalidrawImperativeAPI } from '@/lib/whiteboard/excalidraw';

const SendEveryMs = 100;
const RepeatEveryMs = 2000;
/** The canvas's own zoom limits (MIN_ZOOM, MAX_ZOOM in Excalidraw 0.18.1). */
const MinZoom = 0.1;
const MaxZoom = 30;

/** What the facilitator sees, in scene coordinates. */
type Viewport = { x: number; y: number; width: number; height: number };

type Applied = { scrollX: number; scrollY: number; zoom: number };

type Options = {
    api: ExcalidrawImperativeAPI | null;
    presence: WhisperChannel | null;
    /** The board's switch. */
    enabled: boolean;
    /** This client is the facilitator's: it sends, it never follows. */
    leading: boolean;
    facilitatorId: string | null;
};

function isViewport(raw: unknown): raw is Viewport {
    if (typeof raw !== 'object' || raw === null) {
        return false;
    }

    const { x, y, width, height } = raw as Record<string, unknown>;

    return (
        [x, y, width, height].every(
            (value) => typeof value === 'number' && Number.isFinite(value),
        ) &&
        (width as number) > 0 &&
        (height as number) > 0
    );
}

export function useWhiteboardFollow({
    api,
    presence,
    enabled,
    leading,
    facilitatorId,
}: Options) {
    const [paused, setPaused] = useState(false);
    const resumeRef = useRef<() => void>(() => {});

    useEffect(() => {
        if (!api || !presence || !enabled || !leading) {
            return;
        }

        const transport = whisperTransport(presence, 'viewport', () => false);
        let pending: ReturnType<typeof setTimeout> | null = null;
        let lastSent = 0;

        const send = () => {
            const { scrollX, scrollY, zoom, width, height } = api.getAppState();

            lastSent = Date.now();
            transport.send({
                x: -scrollX,
                y: -scrollY,
                width: width / zoom.value,
                height: height / zoom.value,
            });
        };

        const stopWatching = api.onScrollChange(() => {
            if (pending !== null) {
                return;
            }

            pending = setTimeout(
                () => {
                    pending = null;
                    send();
                },
                Math.max(0, SendEveryMs - (Date.now() - lastSent)),
            );
        });
        // Late joiners and a resized window get the view without a pan.
        const repeat = setInterval(send, RepeatEveryMs);

        send();

        return () => {
            stopWatching();
            clearInterval(repeat);

            if (pending !== null) {
                clearTimeout(pending);
            }
        };
    }, [api, presence, enabled, leading]);

    useEffect(() => {
        if (!api || !presence || !enabled || leading || !facilitatorId) {
            return;
        }

        let last: Viewport | null = null;
        let applied: Applied | null = null;
        let isPaused = false;

        const transport = whisperTransport(
            presence,
            'viewport',
            (senderId, raw) => senderId === facilitatorId && isViewport(raw),
        );

        /** Fits the whole rectangle, centred, whatever this window's shape. */
        const apply = (viewport: Viewport) => {
            const { width, height } = api.getAppState();

            if (width <= 0 || height <= 0) {
                return;
            }

            const zoom = Math.min(
                MaxZoom,
                Math.max(
                    MinZoom,
                    Math.min(width / viewport.width, height / viewport.height),
                ),
            );
            const scrollX =
                width / 2 / zoom - (viewport.x + viewport.width / 2);
            const scrollY =
                height / 2 / zoom - (viewport.y + viewport.height / 2);

            applied = { scrollX, scrollY, zoom };
            api.updateScene({
                appState: { scrollX, scrollY, zoom: { value: zoom } } as never,
            });
        };

        const stopListening = transport.onMessage((raw) => {
            last = raw as Viewport;

            if (!isPaused) {
                apply(last);
            }
        });

        // The canvas reports every change of view, ours included; one that
        // is not the view we just set is the person panning or zooming.
        const stopWatching = api.onScrollChange((scrollX, scrollY, zoom) => {
            // Before the first view arrives there is nothing to leave.
            if (!applied) {
                return;
            }

            if (
                applied.scrollX === scrollX &&
                applied.scrollY === scrollY &&
                applied.zoom === zoom.value
            ) {
                return;
            }

            isPaused = true;
            setPaused(true);
        });

        resumeRef.current = () => {
            isPaused = false;
            setPaused(false);

            if (last) {
                apply(last);
            }
        };

        return () => {
            stopListening();
            stopWatching();
            resumeRef.current = () => {};
            setPaused(false);
        };
    }, [api, presence, enabled, leading, facilitatorId]);

    const following = enabled && !leading;

    return {
        following,
        paused: following && paused,
        resume: () => resumeRef.current(),
    };
}
```

How it works:
- **Leading** (the facilitator's client while the switch is on): sends the visible rectangle at once, then at most every 100 ms after a change of view (one trailing send, never a queue), and every 2 s for late joiners and for a resized window. Its own `accept` refuses everything: a leader never follows.
- **Following**: accepts `viewport` only from the presence id equal to `facilitatorMemberId` and only when the four numbers are finite and the rectangle is not empty (spec §11.3). The whole rectangle is fitted and centred, so a follower with another window shape sees at least what the facilitator sees.
- **Pause**: the canvas reports every change of view through `onScrollChange`, the ones this hook makes included. A reported view that is not exactly the one just applied is the person panning or zooming: following pauses. Before the first view has arrived nothing can pause (the canvas also moves on its own while it opens). `resume()` applies the last view received.
- Switching follow-me off, or a change of facilitator (which switches it off on the server, Task 2), runs the cleanup: everyone is free and the pause is forgotten.
- Known limit, accepted: a facilitator with the board open in two tabs leads from both, and followers get both views in turn.

- [ ] **Step 2: The button** (`resources/js/components/whiteboard/facilitator-bar.tsx`)

```diff
--- a/resources/js/components/whiteboard/facilitator-bar.tsx
+++ b/resources/js/components/whiteboard/facilitator-bar.tsx
@@ -1,4 +1,4 @@
-import { AlarmClock, Lock, LockOpen } from 'lucide-react';
+import { AlarmClock, Lock, LockOpen, Presentation } from 'lucide-react';
 import { useState } from 'react';
 import WhiteboardSettingsController from '@/actions/App/Http/Controllers/Whiteboards/WhiteboardSettingsController';
 import WhiteboardTimersController from '@/actions/App/Http/Controllers/Whiteboards/WhiteboardTimersController';
@@ -101,6 +101,20 @@
                     <LockOpen className="size-4" />
                 )}
             </Button>
+            <Button
+                size="sm"
+                variant={board.followEnabled ? 'default' : 'outline'}
+                aria-pressed={board.followEnabled}
+                aria-label={t('Bring everyone to me')}
+                title={t('Bring everyone to me')}
+                onClick={() =>
+                    void updateSettings({
+                        follow_enabled: !board.followEnabled,
+                    })
+                }
+            >
+                <Presentation className="size-4" />
+            </Button>
         </div>
     );
 }
```

- [ ] **Step 3: Wire it** (`resources/js/components/whiteboard/board.tsx`)

```diff
--- a/resources/js/components/whiteboard/board.tsx
+++ b/resources/js/components/whiteboard/board.tsx
@@ -6,10 +6,12 @@
 import { ConnectionBanner } from '@/components/retro/connection-banner';
 import { SessionExpiredBanner } from '@/components/retro/session-expired-banner';
 import { TimerDisplay } from '@/components/retro/timer-display';
+import { Button } from '@/components/ui/button';
 import { useLocalPreference } from '@/hooks/use-local-preference';
 import { useTrans } from '@/hooks/use-trans';
 import { useWhiteboard } from '@/hooks/use-whiteboard';
 import { useWhiteboardCursors } from '@/hooks/use-whiteboard-cursors';
+import { useWhiteboardFollow } from '@/hooks/use-whiteboard-follow';
 import { useWhiteboardToolbarSlot } from '@/hooks/use-whiteboard-toolbar-slot';
 import {
     Excalidraw,
@@ -81,6 +83,13 @@
         enabled: board.cursorsEnabled,
         hidden: hideMyCursor,
     });
+    const follow = useWhiteboardFollow({
+        api,
+        presence: state.presence,
+        enabled: board.followEnabled,
+        leading: me.isFacilitator,
+        facilitatorId: board.facilitatorMemberId,
+    });
     const forgetCursor = useRef(cursors.forget);
 
     forgetCursor.current = cursors.forget;
@@ -196,6 +205,24 @@
                             {t('This board is locked.')}
                         </span>
                     )}
+                    {board.followEnabled && me.isFacilitator && (
+                        <span>{t('Everyone follows your view.')}</span>
+                    )}
+                    {follow.following && !follow.paused && (
+                        <span>{t('Following the facilitator')}</span>
+                    )}
+                    {follow.paused && (
+                        <span className="flex items-center gap-2">
+                            {t('Following paused')}
+                            <Button
+                                size="sm"
+                                variant="outline"
+                                onClick={follow.resume}
+                            >
+                                {t('Resume')}
+                            </Button>
+                        </span>
+                    )}
                 </StatusBar>
                 {api &&
                     toolbarSlot &&
```

- [ ] **Step 4: Translation keys** (append to each `lang/*.json`; `en.json` with value = key)

| Key (English) | French | German | Spanish |
|---|---|---|---|
| Bring everyone to me | Amener tout le monde à ma vue | Alle zu meiner Ansicht holen | Traer a todos a mi vista |
| Everyone follows your view. | Tout le monde suit votre vue. | Alle folgen Ihrer Ansicht. | Todos siguen tu vista. |
| Following the facilitator | Vous suivez l'animateur | Sie folgen dem Moderator | Siguiendo al facilitador |
| Following paused | Suivi en pause | Folgen pausiert | Seguimiento en pausa |
| Resume | Reprendre | Fortsetzen | Reanudar |

- [ ] **Step 5: Gates and commit**

Run: `npm run build && npm run types:check && npx vp check resources/js/hooks/use-whiteboard-follow.ts resources/js/components/whiteboard && DB_HOST=127.0.0.1 php artisan test --compact tests/Feature/TranslationKeysTest.php`
Expected: only the known `manage-passkeys.tsx` type error; no `vp check` failure; test PASS.

```bash
git add resources/js/hooks/use-whiteboard-follow.ts resources/js/components/whiteboard/facilitator-bar.tsx resources/js/components/whiteboard/board.tsx lang/en.json lang/fr.json lang/de.json lang/es.json
git commit -m "feat(whiteboard): bring everyone to the facilitator's view"
```

**Browser checks:**
- B6.1 A switches "Bring everyone to me" on: A's status row says "Everyone follows your view.", B's says "Following the facilitator", and B's view shows what A sees. B does not pause on its own: after ten seconds without touching B, its row still says "Following the facilitator". (If it pauses by itself, the canvas does not report back exactly the numbers it was given: compare with a tolerance of 1e-6 in `use-whiteboard-follow.ts` and say so.)
- B6.2 A pans and zooms: B's view follows within about a second, and what A sees is inside B's window when the two windows have different shapes.
- B6.3 B pans (or zooms): B's row says "Following paused" with "Resume"; A keeps moving and B's view stays. "Resume" brings B back to A's current view at once.
- B6.4 A browser that opens the board while follow-me is on is brought to A's view within about 2 s.
- B6.5 A switches it off: both rows lose the notice and B's view is free. A member takes control while it is on: it goes off (snapshot `followEnabled` false) and nobody is pulled to the new facilitator.
- B6.6 On a locked board B (view mode) still follows, pauses by dragging, and resumes.
- B6.7 Only the facilitator leads: with follow-me on, B's own pans and zooms never move A's view.

---

### Task 7: Voting in the browser — open, vote, badges, results

The listings were type-checked, linted and bundled at this task's end state (the end state of the plan); they have never run in a browser.

Names checked in `node_modules/@excalidraw/excalidraw/dist` (0.18.1): `ExcalidrawImperativeAPI.onChange(callback)` and `getSceneElements()` (non-deleted, ordered; `types/excalidraw/types.d.ts:631`, `611`); `scrollToContent(target?: string | ExcalidrawElement | readonly ExcalidrawElement[], opts?: {fitToContent?, animate?, …})` where a string is an element id (`types/excalidraw/components/App.d.ts:335`); a point of the scene is at `(sceneX + scrollX) * zoom + offsetLeft` in the window (`sceneCoordsToViewportCoords`, `dev/chunk-4FTI6OG3.js:1329`), so inside the element that holds the canvas it is `(sceneX + scrollX) * zoom`; the canvas layers are `--zIndex-canvas: 1`, `--zIndex-interactiveCanvas: 2`, its interface `--zIndex-layerUI: 4` (`dev/index.css:5546–5551`), and `.layer-ui__wrapper` has `pointer-events: none` (`dev/index.css:5030`), so a sibling at `z-index: 3` lies above the drawing, under the canvas's controls, and still takes clicks where no control is; a frame is `{type: 'frame', name: string | null}`. In the repository: the reactions bar is `fixed bottom-4 left-1/2 z-40` (`resources/js/components/realtime/flying-reactions.tsx:111`) and is placed against the canvas by sibling selectors on `.whiteboard-canvas` (`resources/css/app.css`, board block); `useWhiteboardToolbarSlot(canvas, …)` searches inside the element that carries `ref={canvas}`.

**Files:**
- Create: `resources/js/hooks/use-whiteboard-overlay.ts`, `resources/js/components/whiteboard/vote-dialog.tsx`, `resources/js/components/whiteboard/vote-overlay.tsx`, `resources/js/components/whiteboard/results-panel.tsx`
- Modify: `resources/js/components/whiteboard/facilitator-bar.tsx`, `resources/js/components/whiteboard/board.tsx`, `resources/js/components/whiteboard/board-menu.tsx`, `lang/{en,fr,de,es}.json`

**Interfaces:**
- Consumes: `state.snapshot.voting`, `votingHistory`, `state.applyTally`, `state.refetch`, `state.online` (Task 5); Wayfinder `WhiteboardVoteSessionsController.store(boardId)` (`{votes_per_member, frame_element_id, allow_multiple}` → `{id}`), `WhiteboardVotesController.update({ board, voteSession, elementId })` (`{count}` → `VoteTally`), `WhiteboardVoteClosuresController.store({ board, voteSession })`, `WhiteboardVoteDismissalsController.store({ board, voteSession })`; `useWhiteboardCursors({ …, enabled })`; `StatusBar`, `FacilitatorBar`, `useWhiteboardRequest`.
- Produces: nothing for later tasks. `FacilitatorBar` now takes `{ state, api }`; `BoardMenu` takes `onShowResults: () => void`.

- [ ] **Step 1: Where things are** — `resources/js/hooks/use-whiteboard-overlay.ts`

```ts
import { useEffect, useState } from 'react';
import type { ExcalidrawImperativeAPI } from '@/lib/whiteboard/excalidraw';

export type CanvasView = { scrollX: number; scrollY: number; zoom: number };

export type NoteBox = {
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
};

type CanvasElement = {
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
    isDeleted: boolean;
    customData?: Record<string, unknown>;
};

/** Scroll and zoom of the canvas, for anything drawn above it. */
export function useCanvasView(
    api: ExcalidrawImperativeAPI | null,
): CanvasView | null {
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

const isSticky = (element: CanvasElement) =>
    (element.customData?.skrum as { kind?: unknown } | undefined)?.kind ===
    'sticky';

/**
 * Where the given sticky notes are, in scene coordinates. `ids` must keep
 * its identity between renders (useMemo), or the subscription restarts.
 */
export function useNoteBoxes(
    api: ExcalidrawImperativeAPI | null,
    ids: readonly string[] | null,
): NoteBox[] {
    const [boxes, setBoxes] = useState<NoteBox[]>([]);

    useEffect(() => {
        if (!api || ids === null) {
            setBoxes([]);

            return;
        }

        const wanted = new Set(ids);
        let signature = '';

        const read = (elements: readonly CanvasElement[]) => {
            const next = elements
                .filter(
                    (element) =>
                        wanted.has(element.id) &&
                        !element.isDeleted &&
                        isSticky(element),
                )
                .map(({ id, x, y, width, height }) => ({
                    id,
                    x,
                    y,
                    width,
                    height,
                }));
            const nextSignature = next
                .map((box) => Object.values(box).join(':'))
                .join('|');

            // onChange also fires on every selection and pointer state.
            if (nextSignature === signature) {
                return;
            }

            signature = nextSignature;
            setBoxes(next);
        };

        read(api.getSceneElements());

        return api.onChange((elements) => read(elements));
    }, [api, ids]);

    return boxes;
}
```

- [ ] **Step 2: `resources/js/components/whiteboard/vote-overlay.tsx`**

```tsx
import { Minus, Plus } from 'lucide-react';
import { useMemo } from 'react';
import { useTrans } from '@/hooks/use-trans';
import { useCanvasView, useNoteBoxes } from '@/hooks/use-whiteboard-overlay';
import type { ExcalidrawImperativeAPI } from '@/lib/whiteboard/excalidraw';
import type { WhiteboardVoting } from '@/lib/whiteboard/types';
import { cn } from '@/lib/utils';

type Props = {
    api: ExcalidrawImperativeAPI;
    voting: WhiteboardVoting;
    onVote: (elementId: string, count: number) => void;
};

const controlButton =
    'flex size-6 items-center justify-center rounded-full hover:bg-accent disabled:opacity-40';

/**
 * Vote controls while the vote is open, count badges once it is closed,
 * anchored to the top-right corner of each note. Sits above the drawing and
 * under the canvas's own controls (z-index 3, between Excalidraw's canvases
 * at 1–2 and its interface at 4).
 */
export function VoteOverlay({ api, voting, onVote }: Props) {
    const { t } = useTrans();
    const view = useCanvasView(api);
    const ids = useMemo(
        () =>
            voting.open
                ? voting.elementIds
                : (voting.results ?? []).map((result) => result.elementId),
        [voting.open, voting.elementIds, voting.results],
    );
    const boxes = useNoteBoxes(api, ids);

    if (!view) {
        return null;
    }

    const mine = new Map(
        voting.myVotes.map((vote) => [vote.elementId, vote.count]),
    );
    const totals = new Map(
        (voting.results ?? []).map((result) => [
            result.elementId,
            result.count,
        ]),
    );

    return (
        <div className="pointer-events-none absolute inset-0 z-[3] overflow-hidden">
            {boxes.map((box) => {
                const count = mine.get(box.id) ?? 0;
                const total = totals.get(box.id) ?? 0;

                return (
                    <div
                        key={box.id}
                        className="absolute -translate-x-full -translate-y-1/2"
                        style={{
                            left:
                                (box.x + box.width + view.scrollX) * view.zoom,
                            top: (box.y + view.scrollY) * view.zoom,
                        }}
                    >
                        {!voting.open && (
                            <span
                                className="rounded-full bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground shadow-sm"
                                aria-label={t(
                                    total === 1
                                        ? ':count vote'
                                        : ':count votes',
                                    { count: total },
                                )}
                            >
                                {total}
                            </span>
                        )}
                        {voting.open && voting.allowMultiple && (
                            <span className="pointer-events-auto flex items-center gap-0.5 rounded-full border bg-background p-0.5 text-xs shadow-sm">
                                <button
                                    type="button"
                                    className={controlButton}
                                    aria-label={t('Remove a vote')}
                                    disabled={count === 0}
                                    onClick={() => onVote(box.id, count - 1)}
                                >
                                    <Minus className="size-3" />
                                </button>
                                <span
                                    className="min-w-4 text-center font-medium"
                                    aria-label={t('Your votes: :count', {
                                        count,
                                    })}
                                >
                                    {count}
                                </span>
                                <button
                                    type="button"
                                    className={controlButton}
                                    aria-label={t('Add a vote')}
                                    disabled={voting.remaining === 0}
                                    onClick={() => onVote(box.id, count + 1)}
                                >
                                    <Plus className="size-3" />
                                </button>
                            </span>
                        )}
                        {voting.open && !voting.allowMultiple && (
                            <button
                                type="button"
                                className={cn(
                                    'pointer-events-auto flex size-6 items-center justify-center rounded-full border bg-background text-xs font-medium shadow-sm disabled:opacity-40',
                                    count === 1 &&
                                        'border-primary bg-primary text-primary-foreground',
                                )}
                                aria-pressed={count === 1}
                                aria-label={t('Vote for this note')}
                                disabled={count === 0 && voting.remaining === 0}
                                onClick={() =>
                                    onVote(box.id, count === 1 ? 0 : 1)
                                }
                            >
                                {count === 1 ? (
                                    '1'
                                ) : (
                                    <Plus className="size-3" />
                                )}
                            </button>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
```

While the vote is open the only number shown on a note is the viewer's own count. Once closed, each note that received votes carries the total, the same for everyone; a note deleted since has no badge. The anchor is the note's top-right corner in its unrotated box (a rotated note keeps its control there: accepted). The controls keep their size at every zoom.

- [ ] **Step 3: `resources/js/components/whiteboard/vote-dialog.tsx`** (the facilitator opens a vote)

```tsx
import { useId, useState, type FormEvent } from 'react';
import WhiteboardVoteSessionsController from '@/actions/App/Http/Controllers/Whiteboards/WhiteboardVoteSessionsController';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { useTrans } from '@/hooks/use-trans';
import type { WhiteboardState } from '@/hooks/use-whiteboard';
import { RetroRequestError, retroRequest } from '@/lib/retro/api';
import type { ExcalidrawImperativeAPI } from '@/lib/whiteboard/excalidraw';

type Props = {
    state: WhiteboardState;
    api: ExcalidrawImperativeAPI;
    open: boolean;
    onOpenChange: (open: boolean) => void;
};

const AllNotes = 'all';

export function VoteDialog({ state, api, open, onOpenChange }: Props) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent aria-describedby={undefined}>
                {open && (
                    <VoteForm
                        state={state}
                        api={api}
                        onClose={() => onOpenChange(false)}
                    />
                )}
            </DialogContent>
        </Dialog>
    );
}

function VoteForm({
    state,
    api,
    onClose,
}: {
    state: WhiteboardState;
    api: ExcalidrawImperativeAPI;
    onClose: () => void;
}) {
    const { t } = useTrans();
    const budgetId = useId();
    const scopeId = useId();
    const multipleId = useId();
    const [votesPerMember, setVotesPerMember] = useState(3);
    const [scope, setScope] = useState(AllNotes);
    const [allowMultiple, setAllowMultiple] = useState(false);
    const [error, setError] = useState<string>();
    const [busy, setBusy] = useState(false);
    const [frames] = useState(() =>
        api
            .getSceneElements()
            .filter((element) => element.type === 'frame')
            .map((frame, position) => ({
                id: frame.id,
                name:
                    frame.name ?? t('Frame :number', { number: position + 1 }),
            })),
    );

    const start = async () => {
        setBusy(true);
        setError(undefined);

        try {
            await retroRequest<{ id: string }>(
                WhiteboardVoteSessionsController.store(state.snapshot.board.id),
                {
                    votes_per_member: votesPerMember,
                    frame_element_id: scope === AllNotes ? null : scope,
                    allow_multiple: allowMultiple,
                },
            );
            await state.refetch();
            onClose();
        } catch (caught) {
            setError(
                caught instanceof RetroRequestError && caught.status > 0
                    ? caught.message
                    : t('Something went wrong. Please try again.'),
            );
        } finally {
            setBusy(false);
        }
    };

    const submit = (event: FormEvent) => {
        event.preventDefault();
        void start();
    };

    return (
        <form onSubmit={submit} className="space-y-4">
            <DialogTitle>{t('Start a vote')}</DialogTitle>
            <div className="space-y-2">
                <Label htmlFor={budgetId}>{t('Votes per participant')}</Label>
                <Input
                    id={budgetId}
                    type="number"
                    required
                    min={1}
                    max={20}
                    value={votesPerMember}
                    onChange={(event) =>
                        setVotesPerMember(Number(event.target.value))
                    }
                />
            </div>
            <div className="space-y-2">
                <Label htmlFor={scopeId}>{t('Notes to vote on')}</Label>
                <Select value={scope} onValueChange={setScope}>
                    <SelectTrigger id={scopeId}>
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value={AllNotes}>
                            {t('All sticky notes')}
                        </SelectItem>
                        {frames.map((frame) => (
                            <SelectItem key={frame.id} value={frame.id}>
                                {t('Notes in :name', { name: frame.name })}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
            <div className="flex items-center gap-2">
                <Checkbox
                    id={multipleId}
                    checked={allowMultiple}
                    onCheckedChange={(checked) =>
                        setAllowMultiple(checked === true)
                    }
                />
                <Label htmlFor={multipleId}>
                    {t('Allow several votes on one note')}
                </Label>
            </div>
            <InputError message={error} />
            <DialogFooter>
                <Button type="button" variant="outline" onClick={onClose}>
                    {t('Cancel')}
                </Button>
                <Button disabled={busy}>{t('Start a vote')}</Button>
            </DialogFooter>
        </form>
    );
}
```

The message of a 422 ("A vote is already open.", "There are no sticky notes to vote on.", "Choose a frame of this board.") is shown inside the dialog, which stays open with what was chosen. A frame drawn a moment ago may not have reached the server yet (300 ms batch): the server then answers "Choose a frame of this board." and a second try works.

- [ ] **Step 4: `resources/js/components/whiteboard/results-panel.tsx`**

```tsx
import { LocateFixed, X } from 'lucide-react';
import WhiteboardVoteDismissalsController from '@/actions/App/Http/Controllers/Whiteboards/WhiteboardVoteDismissalsController';
import { Button } from '@/components/ui/button';
import { useTrans } from '@/hooks/use-trans';
import type { WhiteboardState } from '@/hooks/use-whiteboard';
import { useWhiteboardRequest } from '@/hooks/use-whiteboard-request';
import { retroRequest } from '@/lib/retro/api';
import type { ExcalidrawImperativeAPI } from '@/lib/whiteboard/excalidraw';
import type { VoteResult } from '@/lib/whiteboard/types';

type Props = {
    state: WhiteboardState;
    api: ExcalidrawImperativeAPI;
    onClose: () => void;
};

/** Beside the canvas, never over it; results never name a voter. */
export function ResultsPanel({ state, api, onClose }: Props) {
    const { t } = useTrans();
    const request = useWhiteboardRequest();
    const { board, me, voting, votingHistory } = state.snapshot;
    const closed = voting !== null && !voting.open ? voting : null;
    const onBoard = new Set(
        api.getSceneElements().map((element) => element.id),
    );

    const show = (elementId: string) => {
        api.scrollToContent(elementId, { fitToContent: false, animate: true });

        if (window.matchMedia('(max-width: 767px)').matches) {
            onClose();
        }
    };

    const hide = async (sessionId: string) => {
        const done = await request(
            retroRequest(
                WhiteboardVoteDismissalsController.store({
                    board: board.id,
                    voteSession: sessionId,
                }),
            ),
        );

        if (done !== undefined) {
            await state.refetch();
        }
    };

    const list = (results: VoteResult[]) => (
        <ol className="space-y-2">
            {results.map((result, position) => (
                <li
                    key={result.elementId}
                    className="flex items-start gap-2 rounded-md border p-2 text-sm"
                >
                    <span className="font-mono text-muted-foreground">
                        {position + 1}.
                    </span>
                    <span className="min-w-0 flex-1 break-words whitespace-pre-wrap">
                        {result.text === '' ? t('Empty note') : result.text}
                    </span>
                    <span className="shrink-0 font-medium">
                        {t(
                            result.count === 1 ? ':count vote' : ':count votes',
                            {
                                count: result.count,
                            },
                        )}
                    </span>
                    <Button
                        size="icon"
                        variant="ghost"
                        className="size-6 shrink-0"
                        aria-label={t('Show on the board')}
                        title={
                            onBoard.has(result.elementId)
                                ? t('Show on the board')
                                : t('This note is no longer on the board.')
                        }
                        disabled={!onBoard.has(result.elementId)}
                        onClick={() => show(result.elementId)}
                    >
                        <LocateFixed className="size-4" />
                    </Button>
                </li>
            ))}
        </ol>
    );

    return (
        <aside
            aria-label={t('Vote results')}
            className="w-80 shrink-0 space-y-4 overflow-y-auto border-l bg-background p-4 pb-20 max-md:absolute max-md:inset-0 max-md:z-50 max-md:w-auto"
        >
            <div className="flex items-center gap-2">
                <h2 className="flex-1 font-medium">{t('Vote results')}</h2>
                <Button
                    size="icon"
                    variant="ghost"
                    aria-label={t('Close')}
                    onClick={onClose}
                >
                    <X className="size-4" />
                </Button>
            </div>
            {closed && (
                <section className="space-y-2">
                    {(closed.results ?? []).length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                            {t('No votes were cast.')}
                        </p>
                    ) : (
                        list(closed.results ?? [])
                    )}
                    {me.isFacilitator && (
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={() => void hide(closed.id)}
                        >
                            {t('Hide the results')}
                        </Button>
                    )}
                </section>
            )}
            {votingHistory.length > 0 && (
                <section className="space-y-3">
                    <h3 className="text-sm font-medium text-muted-foreground">
                        {t('Previous votes')}
                    </h3>
                    {votingHistory.map((past) => (
                        <div key={past.id} className="space-y-2">
                            <p className="text-xs text-muted-foreground">
                                {new Date(past.closedAt).toLocaleString()}
                            </p>
                            {list(past.results)}
                        </div>
                    ))}
                </section>
            )}
        </aside>
    );
}
```

The panel sits **beside** the canvas, which shrinks; on a phone it takes the board area and has its close button. Its bottom padding keeps the last entry clear of the reactions bar on a narrow window.

- [ ] **Step 5: The vote button** (`resources/js/components/whiteboard/facilitator-bar.tsx`)

```diff
--- a/resources/js/components/whiteboard/facilitator-bar.tsx
+++ b/resources/js/components/whiteboard/facilitator-bar.tsx
@@ -1,7 +1,8 @@
-import { AlarmClock, Lock, LockOpen, Presentation } from 'lucide-react';
+import { AlarmClock, Lock, LockOpen, Presentation, Vote } from 'lucide-react';
 import { useState } from 'react';
 import WhiteboardSettingsController from '@/actions/App/Http/Controllers/Whiteboards/WhiteboardSettingsController';
 import WhiteboardTimersController from '@/actions/App/Http/Controllers/Whiteboards/WhiteboardTimersController';
+import WhiteboardVoteClosuresController from '@/actions/App/Http/Controllers/Whiteboards/WhiteboardVoteClosuresController';
 import { Button } from '@/components/ui/button';
 import {
     DropdownMenu,
@@ -14,15 +15,20 @@
 import type { WhiteboardState } from '@/hooks/use-whiteboard';
 import { useWhiteboardRequest } from '@/hooks/use-whiteboard-request';
 import { retroRequest } from '@/lib/retro/api';
+import type { ExcalidrawImperativeAPI } from '@/lib/whiteboard/excalidraw';
+import { VoteDialog } from './vote-dialog';
 
 const Minutes = [1, 3, 5, 10];
 
-/** The facilitator's tools; follow-me and the vote join them in later tasks. */
-export function FacilitatorBar({ state }: { state: WhiteboardState }) {
+type Props = { state: WhiteboardState; api: ExcalidrawImperativeAPI | null };
+
+/** Timer, board lock, follow-me and vote: the facilitator's tools. */
+export function FacilitatorBar({ state, api }: Props) {
     const { t } = useTrans();
     const request = useWhiteboardRequest();
     const [busy, setBusy] = useState(false);
-    const { board } = state.snapshot;
+    const [startingVote, setStartingVote] = useState(false);
+    const { board, voting } = state.snapshot;
 
     const setTimer = async (seconds: number | null) => {
         setBusy(true);
@@ -54,6 +60,21 @@
         }
     };
 
+    const closeVote = async (sessionId: string) => {
+        const done = await request(
+            retroRequest(
+                WhiteboardVoteClosuresController.store({
+                    board: board.id,
+                    voteSession: sessionId,
+                }),
+            ),
+        );
+
+        if (done !== undefined) {
+            await state.refetch();
+        }
+    };
+
     return (
         <div
             role="toolbar"
@@ -115,6 +136,30 @@
             >
                 <Presentation className="size-4" />
             </Button>
+            {voting?.open ? (
+                <Button size="sm" onClick={() => void closeVote(voting.id)}>
+                    {t('Close the vote')}
+                </Button>
+            ) : (
+                <Button
+                    size="sm"
+                    variant="outline"
+                    aria-label={t('Start a vote')}
+                    title={t('Start a vote')}
+                    disabled={api === null}
+                    onClick={() => setStartingVote(true)}
+                >
+                    <Vote className="size-4" />
+                </Button>
+            )}
+            {api && (
+                <VoteDialog
+                    state={state}
+                    api={api}
+                    open={startingVote}
+                    onOpenChange={setStartingVote}
+                />
+            )}
         </div>
     );
 }
```

"Start a vote" is offered again once a vote is closed: opening a new one puts the old results away (spec §11.4).

- [ ] **Step 6: Wire it** (`resources/js/components/whiteboard/board.tsx`, `board-menu.tsx`)

```diff
--- a/resources/js/components/whiteboard/board.tsx
+++ b/resources/js/components/whiteboard/board.tsx
@@ -3,6 +3,7 @@
 import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
 import { createPortal } from 'react-dom';
 import { toast } from 'sonner';
+import WhiteboardVotesController from '@/actions/App/Http/Controllers/Whiteboards/WhiteboardVotesController';
 import { ConnectionBanner } from '@/components/retro/connection-banner';
 import { SessionExpiredBanner } from '@/components/retro/session-expired-banner';
 import { TimerDisplay } from '@/components/retro/timer-display';
@@ -12,7 +13,9 @@
 import { useWhiteboard } from '@/hooks/use-whiteboard';
 import { useWhiteboardCursors } from '@/hooks/use-whiteboard-cursors';
 import { useWhiteboardFollow } from '@/hooks/use-whiteboard-follow';
+import { useWhiteboardRequest } from '@/hooks/use-whiteboard-request';
 import { useWhiteboardToolbarSlot } from '@/hooks/use-whiteboard-toolbar-slot';
+import { retroRequest } from '@/lib/retro/api';
 import {
     Excalidraw,
     MainMenu,
@@ -23,15 +26,18 @@
 import type {
     RejectReason,
     SceneElement,
+    VoteTally,
     WhiteboardSnapshot,
 } from '@/lib/whiteboard/types';
 import { BoardGone } from './board-gone';
 import { BoardMenu } from './board-menu';
 import { BoardReactions } from './board-reactions';
 import { FacilitatorBar } from './facilitator-bar';
+import { ResultsPanel } from './results-panel';
 import { StatusBar } from './status-bar';
 import { StickyTool } from './sticky-tool';
 import { TopBar } from './top-bar';
+import { VoteOverlay } from './vote-overlay';
 
 const HideMyCursorKey = 'skrum.hideMyCursor';
 const PollMs = 5000;
@@ -60,8 +66,21 @@
     const { t } = useTrans();
     const { locale } = usePage().props;
     const state = useWhiteboard(snapshot);
-    const { board, me } = state.snapshot;
+    const request = useWhiteboardRequest();
+    const { board, me, voting } = state.snapshot;
     const viewOnly = board.locked && !me.isFacilitator;
+    const votingOpen = voting?.open ?? false;
+    /** A person's own choice; null follows the vote (open once it closes). */
+    const [panel, setPanel] = useState<{
+        votingId: string | null;
+        open: boolean;
+    } | null>(null);
+    const showsPanel =
+        panel !== null && panel.votingId === (voting?.id ?? null)
+            ? panel.open
+            : voting !== null && !voting.open;
+    const choosePanel = (open: boolean) =>
+        setPanel({ votingId: voting?.id ?? null, open });
     const [api, setApi] = useState<ExcalidrawImperativeAPI | null>(null);
     const [offline, setOffline] = useState(false);
     const [hideMyCursor, setHideMyCursor] = useLocalPreference(
@@ -80,7 +99,8 @@
         presence: state.presence,
         online: state.online,
         meId: state.snapshot.me.id,
-        enabled: board.cursorsEnabled,
+        // A named pointer over a note would disclose a vote (spec §11.4).
+        enabled: board.cursorsEnabled && !votingOpen,
         hidden: hideMyCursor,
     });
     const follow = useWhiteboardFollow({
@@ -163,7 +183,32 @@
 
         return () => clearInterval(poll);
     }, [state.connected, state.status]);
+
+    const vote = async (elementId: string, count: number) => {
+        if (!voting) {
+            return;
+        }
+
+        const tally = await request(
+            retroRequest<VoteTally>(
+                WhiteboardVotesController.update({
+                    board: board.id,
+                    voteSession: voting.id,
+                    elementId,
+                }),
+                { count },
+            ),
+        );
+
+        if (tally === undefined) {
+            void state.refetch();
 
+            return;
+        }
+
+        state.applyTally(voting.id, tally);
+    };
+
     if (state.status !== 'active') {
         return (
             <BoardGone
@@ -185,7 +230,9 @@
                         endsAt={board.timerEndsAt}
                         offset={state.serverOffset}
                     />
-                    {me.isFacilitator && <FacilitatorBar state={state} />}
+                    {me.isFacilitator && (
+                        <FacilitatorBar state={state} api={api} />
+                    )}
                     {api && !toolbarSlot && !viewOnly && (
                         <StickyTool api={api} />
                     )}
@@ -193,6 +240,7 @@
                         state={state}
                         hideMyCursor={hideMyCursor}
                         onHideMyCursorChange={setHideMyCursor}
+                        onShowResults={() => choosePanel(true)}
                     />
                 </TopBar>
                 <ConnectionBanner
@@ -223,6 +271,29 @@
                             </Button>
                         </span>
                     )}
+                    {voting?.open && (
+                        <span>
+                            {t('Votes left: :count', {
+                                count: voting.remaining,
+                            })}
+                            {' · '}
+                            {t(':count of :total finished voting', {
+                                count: voting.finishedCount ?? 0,
+                                total: state.online.length,
+                            })}
+                            {board.cursorsEnabled &&
+                                ` · ${t('Cursors are hidden while the vote is open.')}`}
+                        </span>
+                    )}
+                    {voting && !voting.open && !showsPanel && (
+                        <Button
+                            size="sm"
+                            variant="outline"
+                            onClick={() => choosePanel(true)}
+                        >
+                            {t('Vote results')}
+                        </Button>
+                    )}
                 </StatusBar>
                 {api &&
                     toolbarSlot &&
@@ -231,43 +302,65 @@
                         toolbarSlot,
                     )}
                 <div
-                    ref={canvas}
-                    className="whiteboard-canvas relative min-h-0 flex-1"
+                    className="whiteboard-canvas relative flex min-h-0 flex-1"
                     data-facilitator={me.isFacilitator}
                 >
-                    <Excalidraw
-                        viewModeEnabled={viewOnly ? true : undefined}
-                        excalidrawAPI={setApi}
-                        initialData={{ elements: initialElements as never }}
-                        name={board.title}
-                        onChange={(elements) =>
-                            sync.current?.handleChange(
-                                elements as unknown as SceneElement[],
-                            )
-                        }
-                        onPointerUpdate={cursors.onPointerUpdate}
-                        langCode={ExcalidrawLocales[locale as string] ?? 'en'}
-                        theme={dark ? 'dark' : 'light'}
-                        aiEnabled={false}
-                        UIOptions={{
-                            canvasActions: {
-                                loadScene: false,
-                                saveToActiveFile: false,
-                                toggleTheme: false,
-                            },
-                        }}
+                    <div
+                        ref={canvas}
+                        className="relative min-h-0 min-w-0 flex-1"
                     >
-                        {/* The default menu ends with links to the library's own sites. */}
-                        <MainMenu>
-                            <MainMenu.DefaultItems.Export />
-                            <MainMenu.DefaultItems.SaveAsImage />
-                            <MainMenu.DefaultItems.SearchMenu />
-                            <MainMenu.DefaultItems.Help />
-                            <MainMenu.DefaultItems.ClearCanvas />
-                            <MainMenu.Separator />
-                            <MainMenu.DefaultItems.ChangeCanvasBackground />
-                        </MainMenu>
-                    </Excalidraw>
+                        <Excalidraw
+                            viewModeEnabled={viewOnly ? true : undefined}
+                            excalidrawAPI={setApi}
+                            initialData={{ elements: initialElements as never }}
+                            name={board.title}
+                            onChange={(elements) =>
+                                sync.current?.handleChange(
+                                    elements as unknown as SceneElement[],
+                                )
+                            }
+                            onPointerUpdate={cursors.onPointerUpdate}
+                            langCode={
+                                ExcalidrawLocales[locale as string] ?? 'en'
+                            }
+                            theme={dark ? 'dark' : 'light'}
+                            aiEnabled={false}
+                            UIOptions={{
+                                canvasActions: {
+                                    loadScene: false,
+                                    saveToActiveFile: false,
+                                    toggleTheme: false,
+                                },
+                            }}
+                        >
+                            {/* The default menu ends with links to the library's own sites. */}
+                            <MainMenu>
+                                <MainMenu.DefaultItems.Export />
+                                <MainMenu.DefaultItems.SaveAsImage />
+                                <MainMenu.DefaultItems.SearchMenu />
+                                <MainMenu.DefaultItems.Help />
+                                <MainMenu.DefaultItems.ClearCanvas />
+                                <MainMenu.Separator />
+                                <MainMenu.DefaultItems.ChangeCanvasBackground />
+                            </MainMenu>
+                        </Excalidraw>
+                        {api && voting && (
+                            <VoteOverlay
+                                api={api}
+                                voting={voting}
+                                onVote={(elementId, count) =>
+                                    void vote(elementId, count)
+                                }
+                            />
+                        )}
+                    </div>
+                    {api && showsPanel && (
+                        <ResultsPanel
+                            state={state}
+                            api={api}
+                            onClose={() => choosePanel(false)}
+                        />
+                    )}
                 </div>
                 <BoardReactions state={state} />
             </div>
```

Points to keep when applying it:
- **Cursors**: `enabled: board.cursorsEnabled && !votingOpen`. With the transport gone the hook neither sends nor draws and clears the pointers it had (spec §11.4). This is the one rule of this plan the server cannot enforce: whispers never pass through it.
- **Layout**: the outer row keeps the class `whiteboard-canvas` and `data-facilitator` (the reactions bar must stay its sibling, see Task 5), and is `relative flex`; the inner element carries `ref={canvas}`, is `relative min-w-0 flex-1`, and holds the canvas and the overlay; the panel is the row's second child.
- **Panel**: it opens by itself when a vote is closed and not dismissed; a person's own choice (close, or reopen from the status row or the menu) wins for that vote only, because the choice is stored with the vote's id.
- A vote that fails says why in a toast and refetches the snapshot, so the controls show the truth again.

```diff
--- a/resources/js/components/whiteboard/board-menu.tsx
+++ b/resources/js/components/whiteboard/board-menu.tsx
@@ -33,15 +33,19 @@
     state: WhiteboardState;
     hideMyCursor: boolean;
     onHideMyCursorChange: (hidden: boolean) => void;
+    onShowResults: () => void;
 };
 
 export function BoardMenu({
     state,
     hideMyCursor,
     onHideMyCursorChange,
+    onShowResults,
 }: Props) {
     const { t } = useTrans();
-    const { board, me, links } = state.snapshot;
+    const { board, me, links, voting, votingHistory } = state.snapshot;
+    const hasResults =
+        votingHistory.length > 0 || (voting !== null && !voting.open);
     const [renaming, setRenaming] = useState(false);
     const [confirmingDelete, setConfirmingDelete] = useState(false);
     const [savingTemplate, setSavingTemplate] = useState(false);
@@ -166,6 +170,11 @@
                             >
                                 {t('Save as template')}
                             </DropdownMenuItem>
+                            {hasResults && (
+                                <DropdownMenuItem onSelect={onShowResults}>
+                                    {t('Vote results')}
+                                </DropdownMenuItem>
+                            )}
                         </>
                     )}
                     {me.isFacilitator && (
```

Guests receive an empty `votingHistory`, so for them the entry exists only while closed results are on the board.

- [ ] **Step 7: Translation keys** (append to each `lang/*.json`; `en.json` with value = key)

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

Already in the four files (checked with `grep` at reconciliation; do not add again): `Votes per participant`, `Add a vote`, `Remove a vote`, `Your votes: :count`, `Votes left: :count`, `:count vote`, `:count votes`, `Close`, `Cancel`, `Something went wrong. Please try again.`

- [ ] **Step 8: Gates and commit**

Run: `npm run build && npm run types:check && npx vp check resources/js/hooks/use-whiteboard-overlay.ts resources/js/components/whiteboard && DB_HOST=127.0.0.1 php artisan test --compact tests/Feature/TranslationKeysTest.php`
Expected: only the known `manage-passkeys.tsx` type error; no `vp check` failure; test PASS.

```bash
git add resources/js/hooks/use-whiteboard-overlay.ts resources/js/components/whiteboard/vote-dialog.tsx resources/js/components/whiteboard/vote-overlay.tsx resources/js/components/whiteboard/results-panel.tsx resources/js/components/whiteboard/facilitator-bar.tsx resources/js/components/whiteboard/board.tsx resources/js/components/whiteboard/board-menu.tsx lang/en.json lang/fr.json lang/de.json lang/es.json
git commit -m "feat(whiteboard): dot voting on the board, with badges and a results panel"
```

**Browser checks:**
- B7.1 Facilitator: the vote button opens a dialog (votes per participant, scope, several votes per note). A board without notes answers "There are no sticky notes to vote on." inside the dialog, which stays open. With a frame on the board the scope lists "Notes in <frame name>" (or "Notes in Frame 1" for a frame without a name).
- B7.2 Vote open: every in-scope note has a vote control at its top-right corner in A and B; a note added afterwards has none. The controls stay on their notes while panning, zooming, and while a note is dragged; a control that scrolls under the shapes toolbar passes **behind** it, and none lies over the canvas's bottom controls or the reactions bar. The canvas still fills its area and the reactions bar sits where it did before this plan. (If a control covers a canvas control, do not raise the canvas controls: clip the overlay to the drawing area and say so.)
- B7.3 B votes: B's control shows B's count, the status row counts down "Votes left", A's page shows nothing of B's vote (no count on the note, no change but "x of y finished voting" when B spends the last one). At a budget of zero the "+" or the toggle of other notes is disabled; forcing it (`fetch` the PUT with a higher count) answers 422 "You have no votes left.".
- B7.4 While the vote is open no remote cursor is drawn in A or B even with "Show live cursors" on, and the status row says so; they come back when it closes.
- B7.5 B double-clicks an in-scope note and types: the text snaps back and the toast "Notes cannot be edited while a vote is open." shows; B can still drag, recolour and resize it, and A sees those. A (facilitator) is refused the same way. Then B double-clicks an in-scope note, deletes all its words and clicks away: the words come back with the same toast; B and then A drag that note and its words move with it in both browsers; after the vote is closed a double-click on it edits the existing words (no second text appears on the note). B double-clicks an in-scope note that has no words and types: the words disappear with the toast, and the note can still be dragged.
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

Title `# Plan 17c — whiteboard facilitation: walkthrough`. Then a "Before starting" section: `vendor/bin/sail artisan migrate --no-interaction`, `npm run build`; accounts, origins and the rules for tabs from `.superpowers/sdd/whiteboard-rules.md` — member A "Fran Facilitator" on `http://localhost`, guest B on `http://127.0.0.1` (guest access enabled on the board, token read with `docker exec skrum-pgsql-1 psql -U sail -d skrum -At -c "select guest_token from whiteboards where id='<board id>'"`), and `member@skrum.test` on `127.0.0.1` for the lines that say "second member" (one account per origin: finish with the guest first). Say in that section that **a guest is enough for every criterion** (a guest is a non-facilitator, votes, is locked out and follows), so that the walkthrough does not depend on a second login; only B7.9's "for a member" and B6.5's take-over need the second member, and each such line says how to check the same thing through `GET snapshot` when that login cannot be made. Never trigger a native dialog; when a canvas input cannot be driven after two attempts, check the same thing through the board's JSON endpoints and say so on the line.

Then one section per acceptance criterion of spec §16 "Facilitation (R7–R8)", in this order, each with an unticked `- [ ]` line per check written as **Setup → Action → Expected**, and the browser checks of Tasks 5–7 copied in full under the section named here (each as its own unticked line, with its id):

1. **Given the facilitator starts a 60-second timer, then every browser shows the same countdown and "Time's up" at zero.** Setup: A facilitates, B is on the board. Action: A starts "1 min". Expected: both show the same remaining time (read the `role="timer"` text in both within the same second), both show "Time's up!" at zero; `GET snapshot` gives the same `timerEndsAt` to both. Include B5.1, B5.2.
2. **Given the board is locked, when a non-facilitator writes an element, then the server answers 403 and the element is unchanged; the facilitator can still edit.** Setup: one shape on the board. Action: A locks; B tries to draw, then sends a `PUT elements` by `fetch`; A moves the shape. Expected: B is in view mode; the `fetch` answers 403 with `errors.locked`; the shape in `GET snapshot` is unchanged by B and changed by A. Include B5.3, B5.4, B5.5, B5.8.
3. **Given a locked element, when a non-facilitator moves or unlocks it, then the write is rejected and their canvas returns to the server copy.** Setup: A locks one shape on an unlocked board. Action: B drags it; B sends a `PUT elements` with `locked: false` and a higher version. Expected: the shape is back in place on B's canvas; the response's `rejected[0].reason` is `locked` and carries the stored copy; no lock entry in B's context menu. Include B5.6.
4. **Given follow-me is on, when the facilitator pans, then followers' views follow; a follower who pans sees "Following paused" and "Resume" re-attaches them.** Setup: a board with content spread over more than one screen. Include B6.1–B6.7. For B6.5's take-over without a second login: check instead that `PUT facilitator` by the second member is pinned by `WhiteboardFacilitationTest` and that after A hands over and takes control back, `followEnabled` is false in `GET snapshot`.
5. **Given an open voting session, then no payload received by any member contains another member's votes or any total (feature tests), and a member cannot exceed their budget.** Setup: A opens a vote with 3 votes; B votes twice. Action: in A's tab read `GET snapshot` and `GET vote-sessions/<id>` by `fetch`, and watch A's page. Expected: A's `voting.myVotes` is empty, there is no total and no other member's vote anywhere in the two bodies; B's fourth vote answers 422. State on the section's first line that the invariant itself is proved by `WhiteboardVotingSecrecyTest`, not by this replay. Include B7.1–B7.4, B7.7, B7.10.
6. **Given a closed session, then every member sees the same counts on notes and the same ranked list.** Include B7.8, B7.9, B7.11.
7. **Given an open session, when a sticky in scope has its text changed, then the write is rejected.** Include B7.5, B7.6.

Then a section **"Around the criteria"** with B5.7 (hand-over dialog; A hands over to a listed member and takes control back, which needs no second browser), B7.12, a check that a timer left running disappears from the top bar of a browser that opens the board more than five minutes after its end (set `timer_ends_at` in the past with `docker exec … psql … "update whiteboards set timer_ends_at = now() - interval '6 minutes' where id = '<id>'"` and reload), and a check that the reactions bar, the shapes toolbar and the canvas's bottom controls are never covered by the status row, the overlay or the panel (screenshots at 1280 px and 375 px, vote open and vote closed).

Then **"Regression of 17a and 17b basics"**: a new board from a template still opens, a sticky note added by A reaches B within a second, a reload keeps the scene with no write-back, "Duplicate this board" and "Save as template" still work from the menu, and the copy has no vote, no lock and no timer.

End with **"Feature tests that pin these criteria"**: `WhiteboardTimerTest`, `WhiteboardLockTest`, `WhiteboardElementWritesTest` (element lock), `WhiteboardFacilitationTest`, `WhiteboardVotingTest`, `WhiteboardVotingSecrecyTest`, `WhiteboardVotingWritesTest`, `WhiteboardVoteModelTest`, and a note that follow-me has no server rule to test (whispers never reach the server) and that "blocked while private writing is on" arrives with 17d.

- [ ] **Step 2: Full gates** (one command at a time: two test runs at once share one database and break each other)

```bash
vendor/bin/pint --dirty --format agent
vendor/bin/phpstan analyse --memory-limit=1G app/Models app/Events/Whiteboards app/Http/Controllers/Whiteboards app/Actions/Whiteboards database/factories/WhiteboardVoteSessionFactory.php database/factories/WhiteboardVoteFactory.php
DB_HOST=127.0.0.1 php -d memory_limit=-1 vendor/bin/pest --compact
npm run build && npm run types:check
npx vp check resources/js/lib/whiteboard resources/js/components/whiteboard resources/js/hooks/use-whiteboard.ts resources/js/hooks/use-whiteboard-channel.ts resources/js/hooks/use-whiteboard-request.ts resources/js/hooks/use-whiteboard-follow.ts resources/js/hooks/use-whiteboard-overlay.ts resources/css/app.css
vendor/bin/sail artisan migrate --no-interaction
```

Expected: the suite passes; PHPStan and Pint clean; `types:check` shows only the known `manage-passkeys.tsx` error; no `vp check` failure in the listed files. Also confirm that `git diff 322c88b -- package.json composer.json` is empty (no new dependency) and that `grep -rl "@excalidraw/excalidraw" resources/js` lists only `resources/js/lib/whiteboard/excalidraw.ts`.

- [ ] **Step 3: Check the spec against what was built**

Read spec §11.1–§11.4, the rows of §12 and "Decisions made while planning 17c" once more against the code. Where the code had to differ from this plan, the spec is the judge: fix the code, or, when the spec is wrong, the spec first — and list each difference in the report.

- [ ] **Step 4: Fix what the gates show**, re-run the affected gate, and record each fix in the report.

- [ ] **Step 5: Commit**

```bash
git add docs/superpowers/walkthroughs/plan-17c-whiteboard-facilitation.md
git commit -m "docs(whiteboard): walkthrough for the timer, the lock, follow-me and dot voting"
```

(Add any fixed file by its explicit path to the same or a separate commit.)

**Translation keys added by this task:** none.

---

## Appendix A — Translation keys

Every key this plan adds, with the task that adds it. `en.json` holds each key with itself as value. Keys are appended at the end of each file (the files are not sorted).

| Task | Key (English) | French | German | Spanish |
|---|---|---|---|---|
| 2 | This board is locked. | Ce tableau est verrouillé. | Dieses Board ist gesperrt. | Esta pizarra está bloqueada. |
| 3 | A vote is already open. | Un vote est déjà en cours. | Es läuft bereits eine Abstimmung. | Ya hay una votación abierta. |
| 3 | This vote is closed. | Ce vote est clos. | Diese Abstimmung ist geschlossen. | Esta votación está cerrada. |
| 3 | Choose a frame of this board. | Choisissez un cadre de ce tableau. | Wählen Sie einen Rahmen dieses Boards. | Elige un marco de esta pizarra. |
| 3 | There are no sticky notes to vote on. | Il n'y a aucun post-it sur lequel voter. | Es gibt keine Haftnotizen, über die abgestimmt werden kann. | No hay notas adhesivas sobre las que votar. |
| 3 | Only one vote per note is allowed. | Un seul vote par post-it est autorisé. | Pro Haftnotiz ist nur eine Stimme erlaubt. | Solo se permite un voto por nota. |
| 3 | This note is not part of the vote. | Ce post-it ne fait pas partie du vote. | Diese Haftnotiz gehört nicht zur Abstimmung. | Esta nota no forma parte de la votación. |
| 3 | Close the vote first. | Clôturez d'abord le vote. | Schließen Sie zuerst die Abstimmung. | Cierra primero la votación. |
| 5 | Facilitation tools | Outils d'animation | Moderationswerkzeuge | Herramientas de facilitación |
| 5 | Lock the board | Verrouiller le tableau | Board sperren | Bloquear la pizarra |
| 5 | Unlock the board | Déverrouiller le tableau | Board entsperren | Desbloquear la pizarra |
| 5 | Notes cannot be edited while a vote is open. | Les post-it ne peuvent pas être modifiés pendant un vote. | Haftnotizen können während einer Abstimmung nicht bearbeitet werden. | Las notas no se pueden editar mientras hay una votación abierta. |
| 5 | No one else can facilitate this board yet. | Personne d'autre ne peut encore animer ce tableau. | Noch kann niemand sonst dieses Board moderieren. | Nadie más puede facilitar esta pizarra todavía. |
| 6 | Bring everyone to me | Amener tout le monde à ma vue | Alle zu meiner Ansicht holen | Traer a todos a mi vista |
| 6 | Everyone follows your view. | Tout le monde suit votre vue. | Alle folgen Ihrer Ansicht. | Todos siguen tu vista. |
| 6 | Following the facilitator | Vous suivez l'animateur | Sie folgen dem Moderator | Siguiendo al facilitador |
| 6 | Following paused | Suivi en pause | Folgen pausiert | Seguimiento en pausa |
| 6 | Resume | Reprendre | Fortsetzen | Reanudar |
| 7 | Start a vote | Lancer un vote | Abstimmung starten | Iniciar una votación |
| 7 | Close the vote | Clôturer le vote | Abstimmung schließen | Cerrar la votación |
| 7 | Notes to vote on | Post-it soumis au vote | Haftnotizen zur Abstimmung | Notas sometidas a votación |
| 7 | All sticky notes | Tous les post-it | Alle Haftnotizen | Todas las notas adhesivas |
| 7 | Notes in :name | Post-it dans :name | Haftnotizen in :name | Notas en :name |
| 7 | Frame :number | Cadre :number | Rahmen :number | Marco :number |
| 7 | Allow several votes on one note | Autoriser plusieurs votes sur un même post-it | Mehrere Stimmen pro Haftnotiz erlauben | Permitir varios votos en una misma nota |
| 7 | Vote for this note | Voter pour ce post-it | Für diese Haftnotiz stimmen | Votar por esta nota |
| 7 | :count of :total finished voting | :count sur :total ont terminé de voter | :count von :total haben fertig abgestimmt | :count de :total han terminado de votar |
| 7 | Cursors are hidden while the vote is open. | Les curseurs sont masqués pendant le vote. | Cursor sind während der Abstimmung ausgeblendet. | Los cursores están ocultos durante la votación. |
| 7 | Vote results | Résultats du vote | Abstimmungsergebnisse | Resultados de la votación |
| 7 | Hide the results | Masquer les résultats | Ergebnisse ausblenden | Ocultar los resultados |
| 7 | Previous votes | Votes précédents | Frühere Abstimmungen | Votaciones anteriores |
| 7 | Show on the board | Afficher sur le tableau | Auf dem Board anzeigen | Mostrar en la pizarra |
| 7 | This note is no longer on the board. | Ce post-it n'est plus sur le tableau. | Diese Haftnotiz ist nicht mehr auf dem Board. | Esta nota ya no está en la pizarra. |
| 7 | Empty note | Post-it vide | Leere Haftnotiz | Nota vacía |
| 7 | No votes were cast. | Aucun vote n'a été exprimé. | Es wurden keine Stimmen abgegeben. | No se emitió ningún voto. |

## Appendix B — What was reconciled, and what only a browser can show

The draft of this plan was written at `e0524df`, before plan 17b was finished and without being run. It was reconciled at `322c88b` by building the whole plan once in the tree and removing it again.

**Run and green on the prototype:** all tests of Tasks 1–4 (seen failing first for the reasons the tasks state, the id `"0"` defect of `WriteWhiteboardElements::storedElements()` included); `tests/Feature/Whiteboards` together with `UuidPrimaryKeysTest` and `TranslationKeysTest`; the complete suite; Pint; PHPStan on the paths of Task 8; `npm run build`, `npm run types:check` and `npx vp check` at the end states of Tasks 5, 6 and 7. The log secrecy test was checked to fail when a vote is logged.

**Corrected against the draft:**
1. Two PHPStan errors in code the draft gave: `tally()` must return a list (`array_values`), and `$current?->count ?? 0` is refused (`nullsafe.neverNull`).
2. The results panel must not wrap the element that carries the class `whiteboard-canvas` away from the reactions bar: four CSS rules of plan 17a place the bar with sibling selectors. The class now sits on the row that holds the canvas and the panel.
3. Follow-me: nothing can pause before the first view has been applied (the canvas moves on its own while it opens); a discard asked for while the scene is already being reloaded is no longer lost.
4. The countdown: a board outlives its sessions, so the snapshot stops reporting a timer five minutes after its end (spec §11.1, decision 8), and the "cursors are hidden" notice is shown only when cursors are otherwise on.
5. Test added from the draft's last revision: people outside the team are refused on every facilitation endpoint.
6. Frontend tasks now carry complete, type-checked listings instead of descriptions.
7. Names confirmed, not changed: Wayfinder parameters `board`, `voteSession`, `elementId`; the migration date `2026_10_11_100000` (the latest whiteboard migration is still `2026_10_10_100000`); none of the helper names this plan adds existed.

**Added after the prototype, by review, and not run:** the note's half of the text freeze in Task 4 (`rebindsWordsOfTarget`, `boundTextIds`, their call, the tests "refuses both halves when the words of a note under vote are cleared", "refuses both halves of the first words typed into an empty note under vote" and "still lets an arrow be attached to a note under vote", Review Focus 6, spec §11.4). The fact behind it was read in the library (`handleSubmit` rewrites the container's `boundElements`), not observed in a browser; B7.5 now replays it.

**Not verified, because only a browser can** (each is a browser check): the overlay's stacking between the drawing and the canvas's controls (B7.2); that the canvas leaves view mode when the prop goes back to `undefined` and abandons an unfinished text edit when view mode starts (B5.3, B5.5); that the canvas reports back exactly the scroll and zoom it was given (B6.1); the height of the canvas inside the new row (B5.1, B7.2); that the lock entries of the context menu are inside `.whiteboard-canvas` (B5.6).

## Corrections

- Task 4: the text half of the freeze was keyed on the incoming type only, so a write reusing the id of a note's text with another type erased the words under vote; `isWordsOfTarget` now also looks at the stored type and `changesWordsOfTarget` refuses a change of type (spec §11.4; test "rejects a text of a note under vote rewritten as another type").
