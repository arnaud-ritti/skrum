# Plan 13c — Sprint in one GIF Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Game rooms (and, once Plan 13d wires them, retro icebreakers) can play **Sprint in one GIF**: the server asks a question, every player answers with one GIF found through skrum's proxy, the host (or the timer) reveals all answers at once, players vote for one favourite (not their own), and at close each vote earns the GIF's author 2 points — without any other player's GIF reaching a browser before the reveal, and without any vote count or voter-to-GIF link before the close.

**Architecture:** One new rules class, `App\Support\Games\SprintGifRules`, plugs the game into Plan 13a's engine through the `GameRules` contract: `prepare` picks a question (`PickGifQuestion`), `presentActive` redacts answers per viewer, `expire` makes the timer two-staged (reveal first, close second), `outcomeOnNextRound` lets "Next round" close a round in its voting window, and `points` awards 2 per vote received. Every GIF answer payload is built by `PresentGifAnswers` (the only class that decides whether authors and vote counts are shown); `RevealGifRound` is the single reveal path shared by the host endpoint and the timer. Mutations are single-purpose actions (`ChangeGifQuestion`, `SetGifAnswer`, `RemoveGifAnswer`, `RevealGifAnswers`, `CastGifVote`, `RetractGifVote`, `CloseGifRound`) behind one-resource controllers, each locking room then round with `LockGameRound`. Answer ids become random UUIDs (v4) so, on anonymous retros, neither ids nor tile order reveal when an answer was posted. The frontend adds a `SprintGifBoard` (question banner, answering stage, voting stage), a generic `GifSearchDialog` extracted from the retro GIF picker, and results tiles reused by the round end card and history.

**Tech Stack:** Laravel 13 (PHP 8.4), PostgreSQL, Pest, Reverb, the existing `GifCatalog` (Giphy/Tenor proxy with cache), React 19, Inertia v3, `@laravel/echo-react`, Wayfinder, Tailwind 4, lucide, Radix dialog (all already installed).

**Spec:** `docs/superpowers/specs/2026-09-29-games-design.md` — §4.2 (all of it), §4.6 (the Sprint in one GIF row, abandoned-during-voting rule, anonymous-retro zero rows), §4.7 last bullet (anonymous icebreakers award no GIF points), §5 (two-stage expiry for this game), §7 (routes `rounds/{round}/question`, `answer`, `reveal`, `vote`, `close`, `gifs`; snapshot `answers` / `myAnswer` / `voters` / `myVote`; events `game.question.changed`, `game.answer.changed`, `game.round.revealed`, `game.vote.changed`, `game.round.ended` with `answers`), §8 (GIF answers and votes), §9 (Sprint in one GIF UI), §10 (votes errors, GIF 502), §11 "Board engagement (spec 1)" first bullet (`GifCatalog::servable()`), §12 "Sprint in one GIF", the GIF lines of "Secrecy" and "Scores"; §13 criteria 3 (this game), 4 (GIF answers and votes), 10, 11 (this plan's strings), 12 (GIF part). Plans 13a (engine, rooms, Hangman) and 13b (Draw & Guess, Decoded) come before this plan; 13d (icebreaker lifecycle, leaderboards, `results.games`, invites) after. Parent: `docs/superpowers/specs/2026-09-29-retro-board-core-design.md`. Foundation: `docs/superpowers/plans/2026-10-06-plan-13a-games-foundation.md` ("Contract for Plans 13b–13d").

## Global Constraints

- Work on branch `feat/plan-13-games`, continuing after Plans 13a and 13b (both implemented and committed on it). Plan 13d continues on the same branch.
- Commands through Sail: `vendor/bin/sail artisan …`, `vendor/bin/sail bin pint --dirty --format agent`, `vendor/bin/sail bin phpstan analyse --no-progress` (level 7, 0 errors). npm on the host. Shells need `export PATH="$HOME/.orbstack/bin:/opt/homebrew/bin:$PATH"`.
- Tests run on PostgreSQL (the Sail `testing` database). No migration is needed by this plan (every column exists since Plan 13a Task 1); if one turns out to be needed, its filename uses the prefix `2026_10_06_1002xx`, with an `up()` method only.
- No new Composer or npm dependency.
- **Request fields are snake_case** (`text`, `gif_id`, `answer_id`); response and broadcast payloads are camelCase exactly as spec §7. JSON responses are bare payloads (no envelopes), as in Plan 13a.
- Every mutation: resolve the player (middleware, which also applies the lazy timer expiry) → cheap guards on the route-bound rows → `DB::transaction` with `LockGameRound::handle($room, $round)` (room, then round) → the same guards again on the locked rows → persist → broadcast with `->sendToOthers()` (after commit, `toOthers()`, report-don't-throw). Guard order: `GameGuard::mutable` → role (403) → round state (409) → input (422).
- **Secrecy (spec §8):** another player's `gif_id` never leaves the server before `revealed_at` is set; a vote count or a voter-to-answer link never leaves it before the round ends (only `voters: [playerId]`, `game.vote.changed {voted}` and the viewer's own `myVote`). GIF answer payloads are built only by `App\Actions\Games\PresentGifAnswers`. On the icebreaker of an anonymous retro no GIF payload carries an author (`playerId: null`), before or after the close, and every GIF `game_points` row is 0.
- Guests never receive team or workspace data (unchanged from 13a); guests may answer, vote and search GIFs (spec §4.2).
- Every user-facing string via `t()` / `__()` with real translations in `lang/{en,fr,es,de}.json` (German "du", French "vous", Spanish "tú"), appended at the end of each file, keeping every existing value. Each task lists its rows; add only keys that are missing at execution time. GIF questions live in `resources/games/gif-questions/*` (Plan 13a) and are not translation keys. `tests/Feature/TranslationKeysTest.php` stays green.
- Wayfinder: run `vendor/bin/sail artisan wayfinder:generate --with-form` after every route change. `resources/js/actions` and `resources/js/routes` are gitignored — never stage them. Frontend imports use the generated controllers (`@/actions/App/Http/Controllers/Games/…`).
- Frontend checks: `npm run types:check && npm run check` (known pre-existing failures only in `.devcontainer/devcontainer.json` and `docs/superpowers/*.md`). Format only touched files with `npx vp check --fix <paths>`.
- React: function components, `type Props`, no default exports except pages, Tailwind, lucide icons, `useRoom()` for room state, `retroRequest()` from `@/lib/retro/api` for JSON calls, `ctx.run()` around mutations (toast + refetch on failure).
- PHP: constructor promotion, typed everything, array-shape docblocks on presenter return values, early returns, curly braces, no comments restating code, class constants in PascalCase. Test helper functions are global in Pest: every new helper name below is unique in `tests/`.
- Never run two implementer subagents concurrently (shared git index).
- Commit messages: Conventional Commits, ending with exactly:
  `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`
  `Claude-Session: https://claude.ai/code/session_01SosW8d2Uj7QxsF1tws5ssS`

## Spec amendments made with this plan

Plan writing found these gaps in spec §4.2 / §7; they are decisions of this plan, to be copied into the spec before execution:

- **Answer ids are random (UUID v4).** Laravel's `HasUuids` generates time-ordered UUID v7 ids; since `game.answer.changed` tells everyone *when* each player answered, a time-ordered id revealed at reveal time would re-identify authors on anonymous retros. `GameGifAnswer::newUniqueId()` returns a v4 UUID, and revealed answers are listed in id order (random, stable).
- The GIF round payload carries `gifProvider` (`giphy` | `tenor` | `null`) for the attribution line of the search popover. A GIF object is `{id, previewUrl, url}` (proxied URLs, same shape as card GIFs).
- `myAnswer` is `{id, gif}` both before and after the reveal (the client needs the id to know which revealed tile is its own, since tiles carry no author on anonymous retros).
- `game.round.revealed` carries `revealedAt` besides `roundId` and `answers`.
- `game.round.ended` of a GIF round also carries `question`. `votes` in ended payloads, round detail and history answers is the final count for `Revealed` rounds and `null` for rounds that ended otherwise (`Passed` through the generic pass endpoint, `Abandoned`): their votes are discarded (§4.2 "votes are discarded with it"). Such rounds award no points and write no `game_points` rows.
- Responses: `PUT question` → `{question}`; `PUT answer` → `{myAnswer}`; `DELETE answer`, `PUT vote`, `DELETE vote` → 204; `POST reveal` → the round as the host sees it (the `GameSnapshot.round` shape); `POST close` → `{ended}` (the `RoundEnded` payload).
- `GET /games/{room}/gifs` answers 404 without a GIF provider and 403 "GIFs are turned off for this board." when the game is unavailable for the room (icebreaker of a retro with GIFs off), mirroring `RetroGifsController`; it also applies `GameGuard::mutable` (icebreaker only during its phase). A replacing `PUT answer` / `PUT vote` does not broadcast again (the public state — answered / voted — did not change).

## Review Focus

1. **Anonymous icebreaker: authorship leaking through ids or order** — revealed answer ids that are time-ordered, or tiles listed by creation time, would match the `game.answer.changed` timeline to a player. Expected: ids are v4 and tiles are ordered by id. Pinned in Task 1 ("gives answers random ids") and Task 6 ("never names the author of a GIF on an anonymous retro").
2. **The timer runs out before the reveal while nobody is connected, then a stale job fires** — the next request reveals (it does not close), and the job scheduled for the old end time is a no-op after that reveal; only a new timer (or the host) closes the voting window. Pinned in Task 2 ("reveals instead of closing when the timer runs out before the reveal", "ignores the old timer once the answers are revealed").
3. **An answer arrives in the same instant as the reveal** (a player changes GIF while the host clicks Reveal) → whichever commits second sees the locked round: an answer after the reveal gets 409 "The GIFs are already revealed." and the revealed set never changes. Pinned in Task 4 ("refuses answers once the GIFs are revealed").
4. **Votes on a stale or foreign tile** — an answer id from another round, a malformed id, or the voter's own GIF (also on anonymous tiles, addressed only by id) → 422 / 422 / 403, nothing stored. Pinned in Task 5 ("refuses an answer of another round", "refuses a vote for your own GIF").
5. **"Next round" during the voting window while the timer job also fires** → the round closes once, with points awarded once (engine idempotence + locks), and the new round starts. Pinned in Task 5 ("closes the voting round when the host starts the next one") and Task 2 ("closes the voting round when the timer runs out during voting").

## File map

Shared files also touched by Plans 13b and 13d are marked ⚑ — execute strictly in order 13b → 13c → 13d; each instruction below says where to insert so 13b's additions are kept.

| Area | Files |
|---|---|
| Answer ids & servable GIFs | `app/Models/GameGifAnswer.php`; `app/Support/Gifs/GifCatalog.php` |
| Presenting & questions | `app/Actions/Games/{PresentGameGif,PresentGifAnswers,PickGifQuestion,RevealGifRound}.php` |
| Events | `app/Events/Games/{GameQuestionChanged,GameAnswerChanged,GameRoundRevealed,GameVoteChanged}.php` |
| Rules | `app/Support/Games/SprintGifRules.php`; ⚑ `app/Providers/AppServiceProvider.php` |
| Mutations | `app/Actions/Games/{ChangeGifQuestion,SetGifAnswer,RemoveGifAnswer,RevealGifAnswers,CastGifVote,RetractGifVote,CloseGifRound}.php`; `app/Http/Controllers/Games/{GameQuestionsController,GameGifsController,GameAnswersController,GameRevealsController,GameVotesController,GameClosuresController}.php`; ⚑ `routes/web.php` |
| Tests | ⚑ `tests/Pest.php`; `tests/Feature/Games/{SprintGifSupportTest,SprintGifTest,SprintGifQuestionTest,GameGifSearchTest,SprintGifAnswersTest,SprintGifVotingTest,SprintGifRedactionTest}.php` |
| Frontend state | ⚑ `resources/js/lib/games/types.ts`; ⚑ `resources/js/lib/games/room-reducer.ts`; `resources/js/lib/games/gif.ts`; ⚑ `resources/js/hooks/use-game-channel.ts`; ⚑ `resources/js/hooks/use-game-room.ts` |
| GIF search dialog | `resources/js/components/gifs/gif-search-dialog.tsx`; `resources/js/components/retro/gif-picker.tsx`; `resources/js/components/games/game-gif-picker.tsx` |
| Board UI | `resources/js/components/games/{sprint-gif-board,gif-question-banner,gif-answer-stage,gif-voting-stage,gif-tile,gif-round-results}.tsx`; ⚑ `resources/js/components/games/{game-board,round-end-card,round-detail}.tsx` |
| Translations | ⚑ `lang/{en,fr,es,de}.json` (rows inside each task) |

## Contract for Plan 13d

Plan 13d (icebreaker lifecycle, leaderboards, `results.games`, invites) relies on exactly these products:

- `App\Actions\Games\PresentGifAnswers`: `static hidesAuthors(GameRoom $room): bool` (icebreaker of an `is_anonymous` retro); `closed(GameRound $round, GameRoom $room): array<int, array{id: string, gif: array{id: string, previewUrl: string, url: string}, playerId: ?string, votes: ?int}>` — `BuildGamesPlayed` maps it to spec §6.1's `answers: [{gif, playerId | null, votes}]` (it queries once per round; 13d should eager-load `gifAnswers` with `withCount('votes')` and call `revealed()` + counts itself if it needs a constant query count — `revealed(Collection $answers, GameRoom $room)` is public for that).
- `App\Support\Games\SprintGifRules`: `PointsPerVote = 2`; `isAvailable(GameRoom)` already honours `retros.gifs_enabled` for icebreaker rooms (13d's `icebreaker_game = gif` validation calls `GifCatalog::isAvailable()` and needs nothing more from this plan); `points()` already writes 0-point rows on anonymous icebreakers, so leaderboards need no GIF special case.
- Events `GameQuestionChanged`, `GameAnswerChanged`, `GameRoundRevealed`, `GameVoteChanged` extend `GameBroadcastEvent`, so they already travel on `presence-retro.{retroId}` for icebreaker rooms; 13d must relay `game.question.changed`, `game.answer.changed`, `game.round.revealed`, `game.vote.changed` from the retro channel into `handleEvent` (they are in `GameEvents`).
- Frontend: `GifRoundResults({answers, points?})` renders a closed GIF round (13d's "Games we played" rows can reuse it outside a `RoomProvider` only if they pass player names — it reads names from `useRoom()`, so 13d either wraps it or renders its own tiles from `results.games`); `GameGif`, `GameGifRevealed` types.

---

### Task 1: GIF answer ids, GIF payloads, question picking, servable answers and events

**Files:**
- Modify: `app/Models/GameGifAnswer.php`, `app/Support/Gifs/GifCatalog.php`, `tests/Pest.php`
- Create: `app/Actions/Games/PresentGameGif.php`, `app/Actions/Games/PickGifQuestion.php`
- Create: `app/Events/Games/{GameQuestionChanged,GameAnswerChanged,GameRoundRevealed,GameVoteChanged}.php`
- Test: create `tests/Feature/Games/SprintGifSupportTest.php`

**Interfaces:**
- Consumes: `GameWordBook::questions(string $locale): array<int, string>` and its test constructor `new GameWordBook(questions: [...])` (13a Task 2); `GameBroadcastEvent` (13a Task 4); models and factories of 13a Task 1.
- Produces:
  - `GameGifAnswer::newUniqueId(): string` (UUID v4).
  - `PresentGameGif::handle(string $gifId): array{id: string, previewUrl: string, url: string}` (relative `gifs.show` URLs).
  - `PickGifQuestion::handle(GameRoom $room, ?string $current = null): string` — random question of the room locale not among the room's last 20 round questions (nor `$current`); falls back to the whole pool minus `$current` when every question was used.
  - `GifCatalog::servable()` also serves ids stored in `game_gif_answers`.
  - Events (all `GameBroadcastEvent`): `GameQuestionChanged(GameRoom $room, string $roundId, string $question)` → `game.question.changed {roundId, question}`; `GameAnswerChanged(GameRoom $room, string $roundId, string $playerId, bool $answered)` → `game.answer.changed {roundId, playerId, answered}`; `GameRoundRevealed(GameRoom $room, array $payload)` → `game.round.revealed {roundId, revealedAt, answers}`; `GameVoteChanged(GameRoom $room, string $roundId, string $playerId, bool $voted)` → `game.vote.changed {roundId, playerId, voted}`.
  - Pest helpers: `gameGiphyItem(string $id): array`, `fakeGameGifs(string ...$ids): void` (configures Giphy and fakes search, trending and find for those ids; any other id 404s), `gameGifPayload(string $id): array`, `sprintGifRoom(): array{0: GameRoom, 1: User, 2: GamePlayer}` (link room, game `gif`, host), `activeGifRound(GameRoom $room, array $attributes = []): GameRound` (active GIF round, `word` null, question "How did the sprint feel?"), `anonymousGifIcebreaker(): array{0: GameRoom, 1: User, 2: GamePlayer, 3: User, 4: GamePlayer}` (room, facilitator user, host player, member user, member player of an anonymous retro in its Icebreaker phase with GIFs on).

- [ ] **Step 1: Add the test helpers**

In `tests/Pest.php` add the imports that are missing among `use App\Enums\GameKind;`, `use App\Enums\RetroPhase;`, `use App\Models\GamePlayer;`, `use App\Models\GameRoom;`, `use App\Models\GameRound;`, `use App\Models\Retro;`, `use App\Models\User;`, `use Illuminate\Http\Client\Request as HttpClientRequest;`, `use Illuminate\Support\Facades\Http;` and append:

```php
function gameGiphyItem(string $id): array
{
    return [
        'id' => $id,
        'images' => [
            'fixed_width' => ['url' => "https://media.giphy.com/{$id}/200w.gif", 'webp' => "https://media.giphy.com/{$id}/200w.webp", 'width' => '200', 'height' => '150'],
            'original' => ['url' => "https://media.giphy.com/{$id}/giphy.gif", 'webp' => "https://media.giphy.com/{$id}/giphy.webp", 'width' => '480', 'height' => '360'],
        ],
    ];
}

function fakeGameGifs(string ...$ids): void
{
    config(['services.gifs' => ['provider' => 'giphy', 'key' => 'game-gif-key', 'rating' => 'pg']]);

    Http::fake(function (HttpClientRequest $request) use ($ids) {
        $endpoint = basename((string) parse_url($request->url(), PHP_URL_PATH));

        if (in_array($endpoint, ['search', 'trending'], true)) {
            return Http::response(['data' => array_map(fn (string $id): array => gameGiphyItem($id), $ids)]);
        }

        if (in_array($endpoint, $ids, true)) {
            return Http::response(['data' => gameGiphyItem($endpoint)]);
        }

        return Http::response(['message' => 'Not found'], 404);
    });
}

function gameGifPayload(string $id): array
{
    return [
        'id' => $id,
        'previewUrl' => route('gifs.show', ['gif' => $id, 'size' => 'preview'], false),
        'url' => route('gifs.show', ['gif' => $id, 'size' => 'full'], false),
    ];
}

/**
 * @return array{0: GameRoom, 1: User, 2: GamePlayer}
 */
function sprintGifRoom(): array
{
    $room = GameRoom::factory()->game(GameKind::SprintGif)->linkAccess()->create();
    [$user, $host] = gameRoomHost($room);

    return [$room, $user, $host];
}

function activeGifRound(GameRoom $room, array $attributes = []): GameRound
{
    return activeGameRound($room, [
        'game' => GameKind::SprintGif,
        'word' => null,
        'question' => 'How did the sprint feel?',
        ...$attributes,
    ]);
}

/**
 * @return array{0: GameRoom, 1: User, 2: GamePlayer, 3: User, 4: GamePlayer}
 */
function anonymousGifIcebreaker(): array
{
    $retro = Retro::factory()->inPhase(RetroPhase::Icebreaker)->anonymous()->create(['gifs_enabled' => true]);
    [$facilitatorUser, $facilitator] = retroFacilitator($retro);
    [$memberUser, $participant] = retroMember($retro);
    $room = GameRoom::factory()->icebreaker($retro)->game(GameKind::SprintGif)->create();
    $host = GamePlayer::factory()->forParticipant($facilitator)->create(['game_room_id' => $room->id]);
    $member = GamePlayer::factory()->forParticipant($participant)->create(['game_room_id' => $room->id]);

    return [$room, $facilitatorUser, $host, $memberUser, $member];
}
```

- [ ] **Step 2: Write the failing test**

Create `tests/Feature/Games/SprintGifSupportTest.php`:

```php
<?php

use App\Actions\Games\PickGifQuestion;
use App\Actions\Games\PresentGameGif;
use App\Enums\GameKind;
use App\Enums\GameRoundOutcome;
use App\Events\Games\GameAnswerChanged;
use App\Events\Games\GameBroadcastEvent;
use App\Events\Games\GameQuestionChanged;
use App\Events\Games\GameRoundRevealed;
use App\Events\Games\GameVoteChanged;
use App\Models\GameGifAnswer;
use App\Models\GameRoom;
use App\Models\GameRound;
use App\Support\Games\GameWordBook;
use App\Support\Gifs\GifCatalog;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;

beforeEach(function () {
    $this->travelTo(CarbonImmutable::parse('2026-10-06 10:00:00'));
});

function gifQuestionRound(GameRoom $room, string $question, int $minutesAgo): GameRound
{
    return GameRound::factory()->game(GameKind::SprintGif)->ended(GameRoundOutcome::Revealed)->create([
        'game_room_id' => $room->id,
        'word' => null,
        'question' => $question,
        'started_at' => now()->subMinutes($minutesAgo),
    ]);
}

it('gives answers random ids', function () {
    $answers = GameGifAnswer::factory()->count(3)->create();

    foreach ($answers as $answer) {
        expect(Str::isUuid($answer->id))->toBeTrue()
            ->and($answer->id[14])->toBe('4');
    }
});

it('presents a GIF through the proxy', function () {
    expect(app(PresentGameGif::class)->handle('abc123'))->toBe([
        'id' => 'abc123',
        'previewUrl' => route('gifs.show', ['gif' => 'abc123', 'size' => 'preview'], false),
        'url' => route('gifs.show', ['gif' => 'abc123', 'size' => 'full'], false),
    ]);
});

it('picks a question the room did not ask recently', function () {
    app()->instance(GameWordBook::class, new GameWordBook(questions: ['en' => ['One?', 'Two?', 'Three?']]));
    $room = GameRoom::factory()->game(GameKind::SprintGif)->create();
    $other = GameRoom::factory()->game(GameKind::SprintGif)->create(['team_id' => $room->team_id]);
    gifQuestionRound($room, 'One?', 3);
    gifQuestionRound($room, 'Two?', 2);
    gifQuestionRound($other, 'Three?', 1);

    expect(app(PickGifQuestion::class)->handle($room))->toBe('Three?');
});

it('only avoids the last twenty questions', function () {
    app()->instance(GameWordBook::class, new GameWordBook(questions: ['en' => ['One?', 'Two?']]));
    $room = GameRoom::factory()->game(GameKind::SprintGif)->create();
    gifQuestionRound($room, 'One?', 60);

    foreach (range(1, 20) as $minutesAgo) {
        gifQuestionRound($room, 'Two?', $minutesAgo);
    }

    expect(app(PickGifQuestion::class)->handle($room))->toBe('One?');
});

it('starts over when every question was asked, never repeating the current one', function () {
    app()->instance(GameWordBook::class, new GameWordBook(questions: ['en' => ['One?', 'Two?']]));
    $room = GameRoom::factory()->game(GameKind::SprintGif)->create();
    gifQuestionRound($room, 'One?', 2);
    gifQuestionRound($room, 'Two?', 1);

    expect(app(PickGifQuestion::class)->handle($room, 'Two?'))->toBe('One?');
});

it('uses the room locale', function () {
    app()->instance(GameWordBook::class, new GameWordBook(questions: ['en' => ['English?'], 'fr' => ['Français ?']]));
    $room = GameRoom::factory()->game(GameKind::SprintGif)->create(['locale' => 'fr']);

    expect(app(PickGifQuestion::class)->handle($room))->toBe('Français ?');
});

it('serves GIFs used by game answers', function () {
    fakeGameGifs('answered1');
    GameGifAnswer::factory()->create(['gif_id' => 'answered1']);

    $catalog = app(GifCatalog::class);

    expect($catalog->servable('answered1')?->id)->toBe('answered1')
        ->and($catalog->servable('stranger'))->toBeNull();

    Http::assertSentCount(1);
});

it('names every GIF event and its payload keys', function (Closure $make, string $name, array $keys) {
    $room = GameRoom::factory()->create();

    /** @var GameBroadcastEvent $event */
    $event = $make($room);

    expect($event->broadcastAs())->toBe($name)
        ->and(array_keys($event->broadcastWith()))->toBe($keys);
})->with([
    'question' => [fn (GameRoom $room) => new GameQuestionChanged($room, 'r', 'Q?'), 'game.question.changed', ['roundId', 'question']],
    'answer' => [fn (GameRoom $room) => new GameAnswerChanged($room, 'r', 'p', true), 'game.answer.changed', ['roundId', 'playerId', 'answered']],
    'revealed' => [fn (GameRoom $room) => new GameRoundRevealed($room, ['roundId' => 'r', 'revealedAt' => 'now', 'answers' => []]), 'game.round.revealed', ['roundId', 'revealedAt', 'answers']],
    'vote' => [fn (GameRoom $room) => new GameVoteChanged($room, 'r', 'p', false), 'game.vote.changed', ['roundId', 'playerId', 'voted']],
]);
```

- [ ] **Step 3: Run test to verify it fails**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Games/SprintGifSupportTest.php`
Expected: FAIL — `Class "App\Actions\Games\PresentGameGif" not found` (and the id version assertion fails).

- [ ] **Step 4: Give answers random ids**

In `app/Models/GameGifAnswer.php` add `use Illuminate\Support\Str;` and, after the `use HasUuids;` line, the method:

```php
    /**
     * Random rather than time-ordered ids: on anonymous retros an answer's id
     * is shown at the reveal, and it must not tell when the answer was posted,
     * which the "answered" broadcasts could tie to its author.
     */
    public function newUniqueId(): string
    {
        return (string) Str::uuid();
    }
```

- [ ] **Step 5: Serve GIFs used by answers**

In `app/Support/Gifs/GifCatalog.php` add `use App\Models\GameGifAnswer;` and replace the `servable()` method with:

```php
    /**
     * Only GIFs someone searched for recently, or that a card or a game
     * answer uses, may be streamed, so the proxy cannot be used to fetch
     * arbitrary provider content.
     */
    public function servable(string $id): ?Gif
    {
        $cached = $this->cached($id);

        if ($cached !== null) {
            return $cached;
        }

        $isUsed = Card::query()->where('gif_id', $id)->exists()
            || GameGifAnswer::query()->where('gif_id', $id)->exists();

        if (! $isUsed) {
            return null;
        }

        return $this->resolve($id);
    }
```

- [ ] **Step 6: Write the GIF presenter and the question picker**

Create `app/Actions/Games/PresentGameGif.php`:

```php
<?php

namespace App\Actions\Games;

class PresentGameGif
{
    /**
     * @return array{id: string, previewUrl: string, url: string}
     */
    public function handle(string $gifId): array
    {
        return [
            'id' => $gifId,
            'previewUrl' => route('gifs.show', ['gif' => $gifId, 'size' => 'preview'], false),
            'url' => route('gifs.show', ['gif' => $gifId, 'size' => 'full'], false),
        ];
    }
}
```

Create `app/Actions/Games/PickGifQuestion.php`:

```php
<?php

namespace App\Actions\Games;

use App\Models\GameRoom;
use App\Models\GameRound;
use App\Support\Games\GameWordBook;
use Illuminate\Support\Arr;

class PickGifQuestion
{
    private const RecentQuestions = 20;

    public function __construct(private GameWordBook $gameWordBook) {}

    public function handle(GameRoom $room, ?string $current = null): string
    {
        $questions = $this->gameWordBook->questions($room->locale);
        $current = array_filter([$current]);

        $recent = GameRound::query()
            ->where('game_room_id', $room->id)
            ->whereNotNull('question')
            ->orderByDesc('started_at')
            ->orderByDesc('id')
            ->limit(self::RecentQuestions)
            ->pluck('question')
            ->all();

        $fresh = array_values(array_diff($questions, $recent, $current));

        if ($fresh === []) {
            $fresh = array_values(array_diff($questions, $current));
        }

        if ($fresh === []) {
            return $questions[0];
        }

        return Arr::random($fresh);
    }
}
```

- [ ] **Step 7: Write the events**

Create `app/Events/Games/GameQuestionChanged.php`:

```php
<?php

namespace App\Events\Games;

use App\Models\GameRoom;

class GameQuestionChanged extends GameBroadcastEvent
{
    public function __construct(GameRoom $room, public string $roundId, public string $question)
    {
        parent::__construct($room);
    }

    public function broadcastAs(): string
    {
        return 'game.question.changed';
    }

    public function broadcastWith(): array
    {
        return ['roundId' => $this->roundId, 'question' => $this->question];
    }
}
```

Create `app/Events/Games/GameAnswerChanged.php`:

```php
<?php

namespace App\Events\Games;

use App\Models\GameRoom;

/**
 * Only whether a player answered: the GIF itself stays secret until the reveal.
 */
class GameAnswerChanged extends GameBroadcastEvent
{
    public function __construct(GameRoom $room, public string $roundId, public string $playerId, public bool $answered)
    {
        parent::__construct($room);
    }

    public function broadcastAs(): string
    {
        return 'game.answer.changed';
    }

    public function broadcastWith(): array
    {
        return ['roundId' => $this->roundId, 'playerId' => $this->playerId, 'answered' => $this->answered];
    }
}
```

Create `app/Events/Games/GameRoundRevealed.php`:

```php
<?php

namespace App\Events\Games;

use App\Models\GameRoom;

class GameRoundRevealed extends GameBroadcastEvent
{
    /**
     * @param  array{roundId: string, revealedAt: string, answers: array<int, array<string, mixed>>}  $payload
     */
    public function __construct(GameRoom $room, public array $payload)
    {
        parent::__construct($room);
    }

    public function broadcastAs(): string
    {
        return 'game.round.revealed';
    }

    public function broadcastWith(): array
    {
        return $this->payload;
    }
}
```

Create `app/Events/Games/GameVoteChanged.php`:

```php
<?php

namespace App\Events\Games;

use App\Models\GameRoom;

/**
 * Only whether a player voted: whom they voted for stays secret until the close.
 */
class GameVoteChanged extends GameBroadcastEvent
{
    public function __construct(GameRoom $room, public string $roundId, public string $playerId, public bool $voted)
    {
        parent::__construct($room);
    }

    public function broadcastAs(): string
    {
        return 'game.vote.changed';
    }

    public function broadcastWith(): array
    {
        return ['roundId' => $this->roundId, 'playerId' => $this->playerId, 'voted' => $this->voted];
    }
}
```

- [ ] **Step 8: Run the tests**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Games/SprintGifSupportTest.php tests/Feature/Retros/GifsTest.php tests/Feature/UuidPrimaryKeysTest.php`
Expected: PASS.

- [ ] **Step 9: Format, analyse, commit**

```bash
vendor/bin/sail bin pint --dirty --format agent
vendor/bin/sail bin phpstan analyse --no-progress
git add app/Models/GameGifAnswer.php app/Support/Gifs/GifCatalog.php app/Actions/Games/PresentGameGif.php app/Actions/Games/PickGifQuestion.php app/Events/Games/GameQuestionChanged.php app/Events/Games/GameAnswerChanged.php app/Events/Games/GameRoundRevealed.php app/Events/Games/GameVoteChanged.php tests/Pest.php tests/Feature/Games/SprintGifSupportTest.php
git commit -m "feat(games): prepare GIF answers, questions and events for Sprint in one GIF

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SosW8d2Uj7QxsF1tws5ssS"
```

---

### Task 2: Sprint in one GIF rules — availability, presenting, reveal stage, scoring

**Files:**
- Create: `app/Actions/Games/PresentGifAnswers.php`, `app/Actions/Games/RevealGifRound.php`, `app/Support/Games/SprintGifRules.php`
- Modify: ⚑ `app/Providers/AppServiceProvider.php` (register the rules)
- Test: create `tests/Feature/Games/SprintGifTest.php`

**Interfaces:**
- Consumes: `GameRules`, `GameRulesRegistry`, `EndGameRound`, `ExpireGameRound`, `CloseExpiredGameRound`, `PresentGameRound` (13a); `PresentGameGif`, `PickGifQuestion`, `GameRoundRevealed` (Task 1); `GifCatalog::isAvailable()`, `providerName()`.
- Produces:
  - `PresentGifAnswers`: `static hidesAuthors(GameRoom $room): bool`; `pending(Collection $answers): array<int, array{playerId: string, answered: bool}>` (sorted by player id); `revealed(Collection $answers, GameRoom $room): array<int, array{id: string, gif: array{id: string, previewUrl: string, url: string}, playerId: ?string}>` (sorted by answer id); `closed(GameRound $round, GameRoom $room): array<int, array{id, gif, playerId: ?string, votes: ?int}>` (`votes` null unless the outcome is `Revealed`); `mine(GameGifAnswer $answer): array{id: string, gif: array{id: string, previewUrl: string, url: string}}`.
  - `RevealGifRound::handle(GameRoom $lockedRoom, GameRound $lockedRound): array{roundId: string, revealedAt: string, answers: array}` — sets `revealed_at` (whole second), broadcasts `GameRoundRevealed`; callers hold the locks and checked the round.
  - `SprintGifRules` (`PointsPerVote = 2`) implementing every `GameRules` method: availability (`GifCatalog::isAvailable()` and, for icebreaker rooms, `retros.gifs_enabled`); `prepare` (question, no word); `presentActive` → `{question, gifProvider, myAnswer, answers, voters, myVote}`; `presentEnded` → `{answers}` (closed); `endedPayload` → `{question, answers}` (closed); `expiryAnchor` = `revealed_at ?? started_at`; `expire` reveals (returns null) before the reveal and returns `Revealed` during voting; `outcomeOnNextRound` = `Revealed` during voting, else null; `points` = 2 per vote received for each author, 0-point rows for answerers without votes and voters without answers, all 0 on anonymous icebreakers, nothing unless the outcome is `Revealed`.
  - The registry list in `AppServiceProvider` ends with `$app->make(SprintGifRules::class)`.

- [ ] **Step 1: Write the failing test**

Create `tests/Feature/Games/SprintGifTest.php`:

```php
<?php

use App\Actions\Games\EndGameRound;
use App\Actions\Games\ExpireGameRound;
use App\Enums\GameKind;
use App\Enums\GameRoundOutcome;
use App\Enums\RetroPhase;
use App\Events\Games\GameRoundEnded;
use App\Events\Games\GameRoundRevealed;
use App\Jobs\CloseExpiredGameRound;
use App\Models\GameGifAnswer;
use App\Models\GameGifVote;
use App\Models\GamePlayer;
use App\Models\GamePoint;
use App\Models\GameRoom;
use App\Models\GameRound;
use App\Models\Retro;
use App\Support\Games\GameWordBook;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;

beforeEach(function () {
    Event::fake();
    fakeGameGifs('party', 'coffee', 'rocket');
    $this->travelTo(CarbonImmutable::parse('2026-10-06 10:00:00'));
    app()->instance(GameWordBook::class, new GameWordBook(questions: ['en' => ['How did the last deploy feel?']]));
});

function gifAnswer(GameRound $round, GamePlayer $player, string $gifId): GameGifAnswer
{
    return GameGifAnswer::factory()->create(['game_round_id' => $round->id, 'player_id' => $player->id, 'gif_id' => $gifId]);
}

function gifVote(GameRound $round, GamePlayer $voter, GameGifAnswer $answer): GameGifVote
{
    return GameGifVote::factory()->create(['game_round_id' => $round->id, 'voter_player_id' => $voter->id, 'answer_id' => $answer->id]);
}

it('is offered only with a GIF provider', function () {
    [$room, $user] = sprintGifRoom();

    $this->actingAs($user)->getJson(route('games.snapshot.show', $room))
        ->assertOk()
        ->assertJsonPath('games.1', ['value' => 'gif', 'label' => __('Sprint in one GIF'), 'available' => true]);

    config(['services.gifs.provider' => null]);

    $this->actingAs($user)->getJson(route('games.snapshot.show', $room))->assertJsonPath('games.1.available', false);
    $this->actingAs($user)->postJson(route('games.rounds.store', $room))
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['game' => __('This game is not available.')]);
});

it('is unavailable in an icebreaker whose retro turned GIFs off', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Icebreaker)->create(['gifs_enabled' => false]);
    [$user, $facilitator] = retroFacilitator($retro);
    $room = GameRoom::factory()->icebreaker($retro)->create();
    GamePlayer::factory()->forParticipant($facilitator)->create(['game_room_id' => $room->id]);

    $this->actingAs($user)->getJson(route('games.snapshot.show', $room))->assertJsonPath('games.1.available', false);
    $this->actingAs($user)->putJson(route('games.game.update', $room), ['game' => 'gif'])->assertUnprocessable();

    $retro->update(['gifs_enabled' => true]);

    $this->actingAs($user)->putJson(route('games.game.update', $room), ['game' => 'gif'])->assertNoContent();
});

it('starts a round with a question and no word', function () {
    [$room, $user] = sprintGifRoom();

    $this->actingAs($user)->postJson(route('games.rounds.store', $room))
        ->assertCreated()
        ->assertJsonPath('round.game', 'gif')
        ->assertJsonPath('round.question', 'How did the last deploy feel?')
        ->assertJsonPath('round.gifProvider', 'giphy')
        ->assertJsonPath('round.answers', [])
        ->assertJsonPath('round.myAnswer', null)
        ->assertJsonPath('round.voters', [])
        ->assertJsonPath('round.myVote', null)
        ->assertJsonPath('round.revealedAt', null);

    expect(GameRound::query()->sole())
        ->word->toBeNull()
        ->question->toBe('How did the last deploy feel?');
});

it('shows who answered but not what before the reveal', function () {
    [$room, $user] = sprintGifRoom();
    [$memberUser, $member] = gameRoomMember($room);
    $round = activeGifRound($room);
    $answer = gifAnswer($round, $member, 'party');

    $hostView = $this->actingAs($user)->getJson(route('games.snapshot.show', $room))->assertOk()->json('round');
    $memberView = $this->actingAs($memberUser)->getJson(route('games.snapshot.show', $room))->assertOk()->json('round');

    expect($hostView['answers'])->toBe([['playerId' => $member->id, 'answered' => true]])
        ->and($hostView['myAnswer'])->toBeNull()
        ->and(gamePayloadJson($hostView))->not->toContain('party')
        ->and($memberView['myAnswer'])->toBe(['id' => $answer->id, 'gif' => gameGifPayload('party')]);
});

it('shows the GIFs with their authors, the voters and my vote after the reveal, without counts', function () {
    [$room, $user, $host] = sprintGifRoom();
    [, $member] = gameRoomMember($room);
    $round = activeGifRound($room, ['revealed_at' => now()]);
    $mine = gifAnswer($round, $host, 'party');
    $theirs = gifAnswer($round, $member, 'coffee');
    gifVote($round, $host, $theirs);

    $view = $this->actingAs($user)->getJson(route('games.snapshot.show', $room))->assertOk()->json('round');

    $expected = collect([$mine, $theirs])->sortBy('id')->map(fn (GameGifAnswer $answer): array => [
        'id' => $answer->id,
        'gif' => gameGifPayload($answer->gif_id),
        'playerId' => $answer->player_id,
    ])->values()->all();

    expect($view['answers'])->toBe($expected)
        ->and($view['voters'])->toBe([$host->id])
        ->and($view['myVote'])->toBe($theirs->id)
        ->and($view['myAnswer']['id'])->toBe($mine->id)
        ->and(gamePayloadJson($view))->not->toContain('"votes"');
});

it('hides GIF authors in the icebreaker of an anonymous retro', function () {
    [$room, $hostUser, , , $member] = anonymousGifIcebreaker();
    $round = activeGifRound($room, ['revealed_at' => now()]);
    gifAnswer($round, $member, 'party');

    $view = $this->actingAs($hostUser)->getJson(route('games.snapshot.show', $room))->assertOk()->json('round');

    expect($view['answers'][0]['playerId'])->toBeNull()
        ->and(gamePayloadJson($view['answers']))->not->toContain($member->id);
});

it('gives authors 2 points per favourite vote at close and 0 to the others who took part', function () {
    [$room, , $host] = sprintGifRoom();
    [, $author] = gameRoomMember($room);
    [, $voter] = gameRoomMember($room);
    [, $watcher] = gameRoomMember($room);
    $round = activeGifRound($room, ['revealed_at' => now()]);
    $popular = gifAnswer($round, $author, 'party');
    $unloved = gifAnswer($round, $host, 'coffee');
    gifVote($round, $host, $popular);
    gifVote($round, $voter, $popular);

    $payload = app(EndGameRound::class)->handle($room, $round, GameRoundOutcome::Revealed);

    expect($payload['points'])->toEqualCanonicalizing([
        ['playerId' => $author->id, 'points' => 4, 'isWin' => false],
        ['playerId' => $host->id, 'points' => 0, 'isWin' => false],
        ['playerId' => $voter->id, 'points' => 0, 'isWin' => false],
    ])
        ->and(array_keys($payload))->toBe(['roundId', 'outcome', 'word', 'winnerPlayerId', 'leaderPlayerId', 'question', 'answers', 'points'])
        ->and($payload['word'])->toBeNull()
        ->and($payload['question'])->toBe('How did the sprint feel?')
        ->and(collect($payload['answers'])->firstWhere('id', $popular->id))->toBe([
            'id' => $popular->id,
            'gif' => gameGifPayload('party'),
            'playerId' => $author->id,
            'votes' => 2,
        ])
        ->and(collect($payload['answers'])->firstWhere('id', $unloved->id)['votes'])->toBe(0)
        ->and(GamePoint::query()->where('player_id', $watcher->id)->exists())->toBeFalse()
        ->and(GamePoint::query()->where('is_win', true)->exists())->toBeFalse()
        ->and(GamePoint::query()->where('player_id', $author->id)->sole()->game)->toBe(GameKind::SprintGif);
});

it('awards no GIF points in the icebreaker of an anonymous retro but still counts the votes', function () {
    [$room, , $host, , $member] = anonymousGifIcebreaker();
    $round = activeGifRound($room, ['revealed_at' => now()]);
    $answer = gifAnswer($round, $member, 'party');
    gifVote($round, $host, $answer);

    $payload = app(EndGameRound::class)->handle($room, $round, GameRoundOutcome::Revealed);

    expect($payload['points'])->toEqualCanonicalizing([
        ['playerId' => $member->id, 'points' => 0, 'isWin' => false],
        ['playerId' => $host->id, 'points' => 0, 'isWin' => false],
    ])
        ->and($payload['answers'][0]['votes'])->toBe(1)
        ->and($payload['answers'][0]['playerId'])->toBeNull()
        ->and(GamePoint::query()->sum('points'))->toBe(0);
});

it('scores nothing and discards the votes of a round abandoned during voting', function () {
    [$room, , $host] = sprintGifRoom();
    [, $member] = gameRoomMember($room);
    $round = activeGifRound($room, ['revealed_at' => now()]);
    $answer = gifAnswer($round, $member, 'party');
    gifVote($round, $host, $answer);

    $payload = app(EndGameRound::class)->handle($room, $round, GameRoundOutcome::Abandoned);

    expect($payload['points'])->toBe([])
        ->and($payload['answers'][0]['votes'])->toBeNull()
        ->and(GamePoint::query()->count())->toBe(0);
});

it('shows the closed answers in the round detail', function () {
    [$room, $user, $host] = sprintGifRoom();
    [, $member] = gameRoomMember($room);
    $round = activeGifRound($room, ['revealed_at' => now()]);
    $answer = gifAnswer($round, $member, 'party');
    gifVote($round, $host, $answer);
    app(EndGameRound::class)->handle($room, $round, GameRoundOutcome::Revealed);

    $this->actingAs($user)->getJson(route('games.rounds.show', [$room, $round]))
        ->assertOk()
        ->assertJsonPath('question', 'How did the sprint feel?')
        ->assertJsonPath('outcome', 'revealed')
        ->assertJsonPath('answers', [['id' => $answer->id, 'gif' => gameGifPayload('party'), 'playerId' => $member->id, 'votes' => 1]]);
});

it('reveals instead of closing when the timer runs out before the reveal', function () {
    [$room, $user] = sprintGifRoom();
    $room->update(['timer_ends_at' => now()->addMinute()]);
    $round = activeGifRound($room);

    $this->travel(65)->seconds();

    $this->actingAs($user)->getJson(route('games.snapshot.show', $room))
        ->assertOk()
        ->assertJsonPath('round.id', $round->id)
        ->assertJsonPath('round.revealedAt', '2026-10-06T10:01:05+00:00');

    Event::assertDispatched(GameRoundRevealed::class, fn (GameRoundRevealed $event) => $event->payload['roundId'] === $round->id);
    Event::assertNotDispatched(GameRoundEnded::class);
});

it('ignores the old timer once the answers are revealed', function () {
    [$room] = sprintGifRoom();
    $room->update(['timer_ends_at' => now()->addMinute()]);
    $round = activeGifRound($room);

    $this->travel(65)->seconds();
    app(ExpireGameRound::class)->handle($room->fresh());
    (new CloseExpiredGameRound($round->id, '2026-10-06T10:01:00+00:00'))->handle(app(ExpireGameRound::class));

    expect($round->fresh()->isActive())->toBeTrue()
        ->and($round->fresh()->revealed_at?->toIso8601String())->toBe('2026-10-06T10:01:05+00:00');

    Event::assertDispatchedTimes(GameRoundRevealed::class, 1);
});

it('closes the voting round when the timer runs out during voting', function () {
    [$room, $user, $host] = sprintGifRoom();
    [, $member] = gameRoomMember($room);
    $round = activeGifRound($room, ['revealed_at' => now()]);
    $answer = gifAnswer($round, $member, 'party');
    gifVote($round, $host, $answer);
    $room->update(['timer_ends_at' => now()->addMinute()]);

    $this->travel(61)->seconds();

    $this->actingAs($user)->getJson(route('games.snapshot.show', $room))
        ->assertOk()
        ->assertJsonPath('round', null)
        ->assertJsonPath('history.0.outcome', 'revealed');

    expect(GamePoint::query()->where('player_id', $member->id)->sole()->points)->toBe(2);
    Event::assertDispatched(GameRoundEnded::class, fn (GameRoundEnded $event) => $event->payload['answers'][0]['votes'] === 1);
});

it('presents a GIF round with a constant number of queries', function () {
    $count = function (int $players): int {
        [$room, , $host] = sprintGifRoom();
        $round = activeGifRound($room, ['revealed_at' => now()]);
        $hostAnswer = gifAnswer($round, $host, 'party');

        foreach (range(1, $players) as $index) {
            [, $player] = gameRoomMember($room);
            gifAnswer($round, $player, 'coffee');
            gifVote($round, $player, $hostAnswer);
        }

        $fresh = $room->fresh();
        $viewer = $host->fresh();

        DB::flushQueryLog();
        DB::enableQueryLog();
        app(\App\Actions\Games\BuildGameSnapshot::class)->handle($fresh, $viewer);
        DB::disableQueryLog();

        return count(DB::getQueryLog());
    };

    expect($count(6))->toBe($count(2));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Games/SprintGifTest.php`
Expected: FAIL — the snapshot reports `games.1.available` false (no rules registered for `gif`).

- [ ] **Step 3: Write the answers presenter and the reveal**

Create `app/Actions/Games/PresentGifAnswers.php`:

```php
<?php

namespace App\Actions\Games;

use App\Enums\GameRoundOutcome;
use App\Models\GameGifAnswer;
use App\Models\GameRoom;
use App\Models\GameRound;
use Illuminate\Support\Collection;

/**
 * The one place that turns GIF answers into payloads: before the reveal only
 * who answered, after it the GIFs without counts, and the counts once the
 * round closed. Authors are dropped on anonymous retros, before and after.
 */
class PresentGifAnswers
{
    public function __construct(private PresentGameGif $presentGameGif) {}

    public static function hidesAuthors(GameRoom $room): bool
    {
        return $room->isIcebreaker() && (bool) $room->retro?->is_anonymous;
    }

    /**
     * @param  Collection<int, GameGifAnswer>  $answers
     * @return array<int, array{playerId: string, answered: bool}>
     */
    public function pending(Collection $answers): array
    {
        return $answers
            ->sortBy('player_id')
            ->map(fn (GameGifAnswer $answer): array => ['playerId' => $answer->player_id, 'answered' => true])
            ->values()
            ->all();
    }

    /**
     * Listed by id: answer ids are random, so the order tells nothing about
     * who answered first.
     *
     * @param  Collection<int, GameGifAnswer>  $answers
     * @return array<int, array{id: string, gif: array{id: string, previewUrl: string, url: string}, playerId: ?string}>
     */
    public function revealed(Collection $answers, GameRoom $room): array
    {
        $hidesAuthors = self::hidesAuthors($room);

        return $answers
            ->sortBy('id')
            ->map(fn (GameGifAnswer $answer): array => [
                'id' => $answer->id,
                'gif' => $this->presentGameGif->handle($answer->gif_id),
                'playerId' => $hidesAuthors ? null : $answer->player_id,
            ])
            ->values()
            ->all();
    }

    /**
     * The answers of an ended round with their final vote count. Votes of a
     * round that did not close normally (passed, abandoned) were discarded.
     *
     * @return array<int, array{id: string, gif: array{id: string, previewUrl: string, url: string}, playerId: ?string, votes: ?int}>
     */
    public function closed(GameRound $round, GameRoom $room): array
    {
        $answers = $round->gifAnswers()->withCount('votes')->get();
        $countsVotes = $round->outcome === GameRoundOutcome::Revealed;
        $votes = $answers->mapWithKeys(fn (GameGifAnswer $answer): array => [
            $answer->id => $countsVotes ? (int) $answer->getAttribute('votes_count') : null,
        ]);

        return array_map(
            fn (array $answer): array => [...$answer, 'votes' => $votes[$answer['id']]],
            $this->revealed($answers, $room),
        );
    }

    /**
     * @return array{id: string, gif: array{id: string, previewUrl: string, url: string}}
     */
    public function mine(GameGifAnswer $answer): array
    {
        return [
            'id' => $answer->id,
            'gif' => $this->presentGameGif->handle($answer->gif_id),
        ];
    }
}
```

Create `app/Actions/Games/RevealGifRound.php`:

```php
<?php

namespace App\Actions\Games;

use App\Events\Games\GameRoundRevealed;
use App\Models\GameRoom;
use App\Models\GameRound;

/**
 * The single reveal path, used by the host's endpoint and by the timer. The
 * caller holds the room and round locks and checked the round is an active,
 * unrevealed GIF round. Revealing opens the voting window; it ends nothing.
 */
class RevealGifRound
{
    public function __construct(private PresentGifAnswers $presentGifAnswers) {}

    /**
     * @return array{roundId: string, revealedAt: string, answers: array<int, array<string, mixed>>}
     */
    public function handle(GameRoom $lockedRoom, GameRound $lockedRound): array
    {
        $lockedRound->forceFill(['revealed_at' => now()->startOfSecond()])->save();

        $payload = [
            'roundId' => $lockedRound->id,
            'revealedAt' => $lockedRound->revealed_at?->toIso8601String() ?? '',
            'answers' => $this->presentGifAnswers->revealed($lockedRound->gifAnswers()->get(), $lockedRoom),
        ];

        (new GameRoundRevealed($lockedRoom, $payload))->sendToOthers();

        return $payload;
    }
}
```

- [ ] **Step 4: Write the rules**

Create `app/Support/Games/SprintGifRules.php`:

```php
<?php

namespace App\Support\Games;

use App\Actions\Games\PickGifQuestion;
use App\Actions\Games\PresentGifAnswers;
use App\Actions\Games\RevealGifRound;
use App\Enums\GameKind;
use App\Enums\GameRoundOutcome;
use App\Models\GameGifAnswer;
use App\Models\GamePlayer;
use App\Models\GameRoom;
use App\Models\GameRound;
use App\Support\Gifs\GifCatalog;
use Carbon\CarbonInterface;

/**
 * Two stages inside one active round: answering until the reveal, then a
 * voting window until the close. Votes stay secret until the round ends.
 */
class SprintGifRules implements GameRules
{
    public const PointsPerVote = 2;

    public function __construct(
        private GifCatalog $gifCatalog,
        private PickGifQuestion $pickGifQuestion,
        private PresentGifAnswers $presentGifAnswers,
        private RevealGifRound $revealGifRound,
    ) {}

    public function kind(): GameKind
    {
        return GameKind::SprintGif;
    }

    public function isAvailable(GameRoom $room): bool
    {
        if (! $this->gifCatalog->isAvailable()) {
            return false;
        }

        if (! $room->isIcebreaker()) {
            return true;
        }

        return (bool) $room->retro?->gifs_enabled;
    }

    public function prepare(GameRoom $room, GameRound $round, array $input): void
    {
        $round->word = null;
        $round->question = $this->pickGifQuestion->handle($room);
    }

    public function presentActive(GameRound $round, GameRoom $room, ?GamePlayer $viewer): array
    {
        $answers = $round->gifAnswers()->get();
        $mine = $viewer === null ? null : $answers->firstWhere('player_id', $viewer->id);

        $state = [
            'question' => $round->question,
            'gifProvider' => $this->gifCatalog->providerName(),
            'myAnswer' => $mine instanceof GameGifAnswer ? $this->presentGifAnswers->mine($mine) : null,
        ];

        if ($round->revealed_at === null) {
            return [
                ...$state,
                'answers' => $this->presentGifAnswers->pending($answers),
                'voters' => [],
                'myVote' => null,
            ];
        }

        $votes = $round->gifVotes()->get(['voter_player_id', 'answer_id']);

        return [
            ...$state,
            'answers' => $this->presentGifAnswers->revealed($answers, $room),
            'voters' => $votes->pluck('voter_player_id')->sort()->values()->all(),
            'myVote' => $viewer === null ? null : $votes->firstWhere('voter_player_id', $viewer->id)?->answer_id,
        ];
    }

    public function presentEnded(GameRound $round): array
    {
        $round->loadMissing('room.retro');

        return ['answers' => $this->presentGifAnswers->closed($round, $round->room)];
    }

    public function endedPayload(GameRound $round, GameRoom $room): array
    {
        return [
            'question' => $round->question,
            'answers' => $this->presentGifAnswers->closed($round, $room),
        ];
    }

    public function expiryAnchor(GameRound $round): CarbonInterface
    {
        return $round->revealed_at ?? $round->started_at;
    }

    /**
     * Before the reveal the timer reveals and opens voting (the host sets a
     * new timer for the vote); during voting it closes the round.
     */
    public function expire(GameRoom $room, GameRound $round): ?GameRoundOutcome
    {
        if ($round->revealed_at === null) {
            $this->revealGifRound->handle($room, $round);

            return null;
        }

        return GameRoundOutcome::Revealed;
    }

    public function outcomeOnNextRound(GameRound $round): ?GameRoundOutcome
    {
        return $round->revealed_at === null ? null : GameRoundOutcome::Revealed;
    }

    /**
     * Every author earns 2 points per favourite vote received; everyone who
     * answered or voted gets a row. On anonymous retros a vote would tie a GIF
     * to its author through the points, so every row is 0 there.
     */
    public function points(GameRound $round, GameRoom $room): array
    {
        if ($round->outcome !== GameRoundOutcome::Revealed) {
            return [];
        }

        $awardsPoints = ! PresentGifAnswers::hidesAuthors($room);
        $rows = [];

        foreach ($round->gifAnswers()->withCount('votes')->get() as $answer) {
            $votes = (int) $answer->getAttribute('votes_count');

            $rows[$answer->player_id] = [
                'points' => $awardsPoints ? $votes * self::PointsPerVote : 0,
                'isWin' => false,
            ];
        }

        foreach ($round->gifVotes()->pluck('voter_player_id') as $voterId) {
            $rows[(string) $voterId] ??= ['points' => 0, 'isWin' => false];
        }

        return $rows;
    }
}
```

- [ ] **Step 5: Register the rules**

In `app/Providers/AppServiceProvider.php` add `use App\Support\Games\SprintGifRules;` and append `$app->make(SprintGifRules::class),` as the **last** entry of the `new GameRulesRegistry([...])` list (after `HangmanRules` and the classes Plan 13b added), for example:

```php
        $this->app->bind(GameRulesRegistry::class, fn (Application $app): GameRulesRegistry => new GameRulesRegistry([
            $app->make(HangmanRules::class),
            // …the entries Plan 13b added stay here…
            $app->make(SprintGifRules::class),
        ]));
```

(Keep 13b's real lines; the comment above is only to show the position — do not write it.)

- [ ] **Step 6: Run the tests**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Games`
Expected: PASS (the 13a/13b suites bind their own rules with `bindGameRules()` where they need to).

- [ ] **Step 7: Format, analyse, commit**

```bash
vendor/bin/sail bin pint --dirty --format agent
vendor/bin/sail bin phpstan analyse --no-progress
git add app/Actions/Games/PresentGifAnswers.php app/Actions/Games/RevealGifRound.php app/Support/Games/SprintGifRules.php app/Providers/AppServiceProvider.php tests/Feature/Games/SprintGifTest.php
git commit -m "feat(games): add the Sprint in one GIF rules

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SosW8d2Uj7QxsF1tws5ssS"
```

---

### Task 3: Question and GIF search endpoints

**Files:**
- Create: `app/Actions/Games/ChangeGifQuestion.php`, `app/Http/Controllers/Games/GameQuestionsController.php`, `app/Http/Controllers/Games/GameGifsController.php`
- Modify: ⚑ `routes/web.php`
- Test: create `tests/Feature/Games/SprintGifQuestionTest.php`, `tests/Feature/Games/GameGifSearchTest.php`

**Interfaces:**
- Consumes: `LockGameRound`, `GameGuard` (13a); `PickGifQuestion`, `GameQuestionChanged` (Task 1); `GameRulesRegistry::isAvailable()`; `GifCatalog::{isAvailable, search, attempt}`.
- Produces: `ChangeGifQuestion::handle(GameRoom $room, GameRound $round, GamePlayer $host, ?string $text): string` (null text = shuffle); routes `games.rounds.question.update` (PUT `games/{room}/rounds/{round}/question`, body `text?` 1–200, host only, `{question}`), `games.gifs.index` (GET `games/{room}/gifs?q=`, `{gifs: [{id, previewUrl, width, height}]}`, 20 per minute per player).

- [ ] **Step 1: Write the failing tests**

Create `tests/Feature/Games/SprintGifQuestionTest.php`:

```php
<?php

use App\Enums\GameKind;
use App\Events\Games\GameQuestionChanged;
use App\Models\GameGifAnswer;
use App\Support\Games\GameWordBook;
use Illuminate\Support\Facades\Event;

beforeEach(function () {
    Event::fake();
    fakeGameGifs('party');
    app()->instance(GameWordBook::class, new GameWordBook(questions: ['en' => ['First?', 'Second?', 'Third?']]));
});

it('shuffles the question for the host until the first answer', function () {
    [$room, $user] = sprintGifRoom();
    $round = activeGifRound($room, ['question' => 'First?']);

    $question = $this->actingAs($user)
        ->putJson(route('games.rounds.question.update', [$room, $round]))
        ->assertOk()
        ->json('question');

    expect($question)->toBeIn(['Second?', 'Third?'])
        ->and($round->fresh()->question)->toBe($question);

    Event::assertDispatched(GameQuestionChanged::class, fn (GameQuestionChanged $event) => $event->roundId === $round->id
        && $event->question === $question);
});

it('sets a custom question', function () {
    [$room, $user] = sprintGifRoom();
    $round = activeGifRound($room);

    $this->actingAs($user)
        ->putJson(route('games.rounds.question.update', [$room, $round]), ['text' => '  What did we ship?  '])
        ->assertOk()
        ->assertExactJson(['question' => 'What did we ship?']);

    expect($round->fresh()->question)->toBe('What did we ship?');
});

it('refuses to change the question once someone answered or the GIFs are revealed', function (string $case) {
    [$room, $user] = sprintGifRoom();
    [, $member] = gameRoomMember($room);
    $round = activeGifRound($room, $case === 'revealed' ? ['revealed_at' => now()] : []);

    if ($case === 'answered') {
        GameGifAnswer::factory()->create(['game_round_id' => $round->id, 'player_id' => $member->id]);
    }

    $this->actingAs($user)
        ->putJson(route('games.rounds.question.update', [$room, $round]), ['text' => 'Too late?'])
        ->assertConflict()
        ->assertJsonPath('message', __('The question can no longer be changed.'));
})->with(['answered', 'revealed']);

it('validates the custom question', function (mixed $text) {
    [$room, $user] = sprintGifRoom();
    $round = activeGifRound($room);

    $this->actingAs($user)
        ->putJson(route('games.rounds.question.update', [$room, $round]), ['text' => $text])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('text');
})->with(['empty' => [''], 'blank' => ['   '], 'too long' => [str_repeat('a', 201)], 'not a string' => [['a']]]);

it('keeps the question to the host and to GIF rounds', function () {
    [$room, $user] = sprintGifRoom();
    [$memberUser] = gameRoomMember($room);
    $round = activeGifRound($room);

    $this->actingAs($memberUser)->putJson(route('games.rounds.question.update', [$room, $round]))->assertForbidden();

    $hangman = activeGameRound($room, ['game' => GameKind::Hangman]);

    $this->actingAs($user)->putJson(route('games.rounds.question.update', [$room, $hangman]))->assertUnprocessable();
});
```

Create `tests/Feature/Games/GameGifSearchTest.php`:

```php
<?php

use App\Enums\RetroPhase;
use App\Models\GamePlayer;
use App\Models\GameRoom;
use App\Models\Retro;
use Illuminate\Support\Facades\Http;

it('searches GIFs for players through the server', function () {
    fakeGameGifs('party', 'coffee');
    [$room, $user] = sprintGifRoom();

    $response = $this->actingAs($user)
        ->getJson(route('games.gifs.index', ['room' => $room, 'q' => 'party']))
        ->assertOk()
        ->assertJsonPath('gifs.0.id', 'party')
        ->assertJsonPath('gifs.0.previewUrl', route('gifs.show', ['gif' => 'party', 'size' => 'preview'], false))
        ->assertJsonPath('gifs.0.width', 200);

    expect($response->getContent())->not->toContain('game-gif-key')->not->toContain('giphy.com');
});

it('returns trending GIFs for an empty query and serves guests', function () {
    fakeGameGifs('party', 'coffee');
    [$room] = sprintGifRoom();
    $guest = gameRoomGuest($room);

    $this->withCookies(gameGuestCookie($guest))
        ->getJson(route('games.gifs.index', $room))
        ->assertOk()
        ->assertJsonPath('gifs.1.id', 'coffee');

    Http::assertSent(fn ($request) => str_contains($request->url(), '/trending'));
});

it('is missing without a provider', function () {
    fakeGameGifs('party', 'coffee');
    [$room, $user] = sprintGifRoom();
    config(['services.gifs.provider' => null]);

    $this->actingAs($user)->getJson(route('games.gifs.index', $room))->assertNotFound();
});

it('is refused when the retro turned GIFs off', function () {
    fakeGameGifs('party', 'coffee');
    $retro = Retro::factory()->inPhase(RetroPhase::Icebreaker)->create(['gifs_enabled' => false]);
    [$user, $facilitator] = retroFacilitator($retro);
    $room = GameRoom::factory()->icebreaker($retro)->create();
    GamePlayer::factory()->forParticipant($facilitator)->create(['game_room_id' => $room->id]);

    $this->actingAs($user)->getJson(route('games.gifs.index', $room))
        ->assertForbidden()
        ->assertJsonPath('message', __('GIFs are turned off for this board.'));
});

it('limits searches per player', function () {
    fakeGameGifs('party', 'coffee');
    [$room, $user] = sprintGifRoom();
    [$otherUser] = gameRoomMember($room);

    foreach (range(1, 20) as $attempt) {
        $this->actingAs($user)->getJson(route('games.gifs.index', ['room' => $room, 'q' => "q{$attempt}"]))->assertOk();
    }

    $this->actingAs($user)->getJson(route('games.gifs.index', ['room' => $room, 'q' => 'q21']))
        ->assertTooManyRequests()
        ->assertJsonPath('message', __('Too many searches, wait a moment.'));

    $this->actingAs($otherUser)->getJson(route('games.gifs.index', ['room' => $room, 'q' => 'q21']))->assertOk();
});

it('answers 502 when the provider fails', function () {
    config(['services.gifs' => ['provider' => 'giphy', 'key' => 'game-gif-key', 'rating' => 'pg']]);
    Http::fake(['api.giphy.com/*' => Http::response([], 500)]);
    [$room, $user] = sprintGifRoom();

    $this->actingAs($user)->getJson(route('games.gifs.index', ['room' => $room, 'q' => 'x']))
        ->assertStatus(502)
        ->assertJsonPath('message', __('GIF search is unavailable.'));
});
```

Each search test fakes the provider itself (no `beforeEach`): `Http::fake()` stubs stack in registration order, so a shared fake would shadow the failing provider of the 502 test.

- [ ] **Step 2: Run tests to verify they fail**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Games/SprintGifQuestionTest.php tests/Feature/Games/GameGifSearchTest.php`
Expected: FAIL — `Route [games.rounds.question.update] not defined.`

- [ ] **Step 3: Write the question action and controller**

Create `app/Actions/Games/ChangeGifQuestion.php`:

```php
<?php

namespace App\Actions\Games;

use App\Enums\GameKind;
use App\Events\Games\GameQuestionChanged;
use App\Models\GamePlayer;
use App\Models\GameRoom;
use App\Models\GameRound;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpKernel\Exception\ConflictHttpException;

class ChangeGifQuestion
{
    public function __construct(private PickGifQuestion $pickGifQuestion) {}

    /**
     * Only until the first answer: afterwards the answers were chosen for
     * the question as it stands.
     */
    public function handle(GameRoom $room, GameRound $round, GamePlayer $host, ?string $text): string
    {
        return DB::transaction(function () use ($room, $round, $host, $text): string {
            [$lockedRoom, $lockedRound] = LockGameRound::handle($room, $round);

            GameGuard::mutable($lockedRoom);
            GameGuard::host($lockedRoom, $host);
            GameGuard::activeRound($lockedRoom, $lockedRound);
            GameGuard::roundGame($lockedRound, GameKind::SprintGif);

            if ($lockedRound->revealed_at !== null || $lockedRound->gifAnswers()->exists()) {
                throw new ConflictHttpException(__('The question can no longer be changed.'));
            }

            $question = $text ?? $this->pickGifQuestion->handle($lockedRoom, $lockedRound->question);

            $lockedRound->forceFill(['question' => $question])->save();

            (new GameQuestionChanged($lockedRoom, $lockedRound->id, $question))->sendToOthers();

            return $question;
        });
    }
}
```

Create `app/Http/Controllers/Games/GameQuestionsController.php`:

```php
<?php

namespace App\Http\Controllers\Games;

use App\Actions\Games\ChangeGifQuestion;
use App\Actions\Games\GameGuard;
use App\Http\Controllers\Controller;
use App\Models\GamePlayer;
use App\Models\GameRoom;
use App\Models\GameRound;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class GameQuestionsController extends Controller
{
    public function update(Request $request, GameRoom $room, GameRound $round, ChangeGifQuestion $changeGifQuestion): JsonResponse
    {
        $player = GamePlayer::current($request);

        GameGuard::mutable($room);
        GameGuard::host($room, $player);

        $validated = $request->validate([
            'text' => ['sometimes', 'string', 'max:200'],
        ]);

        return response()->json([
            'question' => $changeGifQuestion->handle($room, $round, $player, $validated['text'] ?? null),
        ]);
    }
}
```

(The framework's `TrimStrings` and `ConvertEmptyStringsToNull` middleware turn `"   "` into `null`, which the `string` rule refuses: a present but blank `text` is a 422, an absent one shuffles.)

- [ ] **Step 4: Write the search controller**

Create `app/Http/Controllers/Games/GameGifsController.php`:

```php
<?php

namespace App\Http\Controllers\Games;

use App\Actions\Games\GameGuard;
use App\Enums\GameKind;
use App\Http\Controllers\Controller;
use App\Models\GamePlayer;
use App\Models\GameRoom;
use App\Support\Games\GameRulesRegistry;
use App\Support\Gifs\Gif;
use App\Support\Gifs\GifCatalog;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Http\Exceptions\ThrottleRequestsException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;

class GameGifsController extends Controller
{
    private const SearchesPerMinute = 20;

    public function index(Request $request, GameRoom $room, GifCatalog $gifCatalog, GameRulesRegistry $gameRulesRegistry): JsonResponse
    {
        $player = GamePlayer::current($request);

        abort_unless($gifCatalog->isAvailable(), 404);

        GameGuard::mutable($room);

        if (! $gameRulesRegistry->isAvailable(GameKind::SprintGif, $room)) {
            throw new AuthorizationException(__('GIFs are turned off for this board.'));
        }

        $this->throttle($player);

        $validated = $request->validate(['q' => ['nullable', 'string', 'max:100']]);

        $gifs = $gifCatalog->attempt(
            fn (): array => $gifCatalog->search($validated['q'] ?? ''),
            __('GIF search is unavailable.'),
        );

        return response()->json([
            'gifs' => array_map(fn (Gif $gif): array => [
                'id' => $gif->id,
                'previewUrl' => route('gifs.show', ['gif' => $gif->id, 'size' => 'preview'], false),
                'width' => $gif->width,
                'height' => $gif->height,
            ], $gifs),
        ]);
    }

    /**
     * Keyed by player rather than by route middleware, which runs before the
     * player is resolved and would fall back to one limit per IP.
     */
    private function throttle(GamePlayer $player): void
    {
        $key = "game-gif-search:{$player->id}";

        if (RateLimiter::tooManyAttempts($key, self::SearchesPerMinute)) {
            throw new ThrottleRequestsException(__('Too many searches, wait a moment.'), null, ['Retry-After' => RateLimiter::availableIn($key)]);
        }

        RateLimiter::hit($key);
    }
}
```

- [ ] **Step 5: Register the routes**

In `routes/web.php` add `use App\Http\Controllers\Games\GameGifsController;` and `use App\Http\Controllers\Games\GameQuestionsController;`, and inside the `games/{room}` group, after the `games.rounds.letters.store` route (and after any route Plan 13b added there):

```php
        Route::put('rounds/{round}/question', [GameQuestionsController::class, 'update'])->name('games.rounds.question.update')->whereUuid('round');
        Route::get('gifs', [GameGifsController::class, 'index'])->name('games.gifs.index');
```

- [ ] **Step 6: Run the tests**

Run: `vendor/bin/sail artisan wayfinder:generate --with-form && vendor/bin/sail artisan test --compact tests/Feature/Games/SprintGifQuestionTest.php tests/Feature/Games/GameGifSearchTest.php`
Expected: PASS.

- [ ] **Step 7: Translations**

| Key (en) | fr | es | de |
|---|---|---|---|
| The question can no longer be changed. | La question ne peut plus être modifiée. | La pregunta ya no se puede cambiar. | Die Frage kann nicht mehr geändert werden. |

(`GIFs are turned off for this board.`, `Too many searches, wait a moment.` and `GIF search is unavailable.` already exist.)

- [ ] **Step 8: Format, analyse, commit**

```bash
vendor/bin/sail bin pint --dirty --format agent
vendor/bin/sail bin phpstan analyse --no-progress
git add app/Actions/Games/ChangeGifQuestion.php app/Http/Controllers/Games/GameQuestionsController.php app/Http/Controllers/Games/GameGifsController.php routes/web.php tests/Feature/Games/SprintGifQuestionTest.php tests/Feature/Games/GameGifSearchTest.php lang
git commit -m "feat(games): change the GIF question and search GIFs in rooms

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SosW8d2Uj7QxsF1tws5ssS"
```

---

### Task 4: Answering with a GIF

**Files:**
- Create: `app/Actions/Games/SetGifAnswer.php`, `app/Actions/Games/RemoveGifAnswer.php`, `app/Http/Controllers/Games/GameAnswersController.php`
- Modify: ⚑ `routes/web.php`
- Test: create `tests/Feature/Games/SprintGifAnswersTest.php`

**Interfaces:**
- Consumes: `LockGameRound`, `GameGuard`; `PresentGifAnswers::mine()` (Task 2); `GameAnswerChanged` (Task 1); `GifCatalog::{resolve, attempt}`.
- Produces: `SetGifAnswer::handle(GameRoom $room, GameRound $round, GamePlayer $player, string $gifId): array{id: string, gif: array{id: string, previewUrl: string, url: string}}`; `RemoveGifAnswer::handle(GameRoom $room, GameRound $round, GamePlayer $player): void`; routes `games.rounds.answer.update` (PUT, body `gif_id` matching `[A-Za-z0-9_-]{1,64}`, `{myAnswer}`), `games.rounds.answer.destroy` (DELETE, 204).

- [ ] **Step 1: Write the failing test**

Create `tests/Feature/Games/SprintGifAnswersTest.php`:

```php
<?php

use App\Enums\GameKind;
use App\Enums\GameRoundOutcome;
use App\Events\Games\GameAnswerChanged;
use App\Models\GameGifAnswer;
use Illuminate\Support\Facades\Event;

beforeEach(function () {
    Event::fake();
    fakeGameGifs('party', 'coffee');
});

it('sets an answer and tells the others only that the player answered', function () {
    [$room] = sprintGifRoom();
    [$user, $member] = gameRoomMember($room);
    $round = activeGifRound($room);

    $response = $this->actingAs($user)
        ->putJson(route('games.rounds.answer.update', [$room, $round]), ['gif_id' => 'party'])
        ->assertOk();

    $answer = GameGifAnswer::query()->sole();

    expect($response->json())->toBe(['myAnswer' => ['id' => $answer->id, 'gif' => gameGifPayload('party')]])
        ->and($answer->player_id)->toBe($member->id);

    Event::assertDispatched(GameAnswerChanged::class, fn (GameAnswerChanged $event) => $event->broadcastWith() === [
        'roundId' => $round->id,
        'playerId' => $member->id,
        'answered' => true,
    ] && ! str_contains(gamePayloadJson($event->broadcastWith()), 'party'));
});

it('replaces the answer without telling the others again', function () {
    [$room] = sprintGifRoom();
    [$user] = gameRoomMember($room);
    $round = activeGifRound($room);

    $this->actingAs($user)->putJson(route('games.rounds.answer.update', [$room, $round]), ['gif_id' => 'party'])->assertOk();
    $this->actingAs($user)->putJson(route('games.rounds.answer.update', [$room, $round]), ['gif_id' => 'coffee'])->assertOk();

    expect(GameGifAnswer::query()->sole()->gif_id)->toBe('coffee');
    Event::assertDispatchedTimes(GameAnswerChanged::class, 1);
});

it('removes the answer', function () {
    [$room] = sprintGifRoom();
    [$user, $member] = gameRoomMember($room);
    $round = activeGifRound($room);
    GameGifAnswer::factory()->create(['game_round_id' => $round->id, 'player_id' => $member->id, 'gif_id' => 'party']);

    $this->actingAs($user)->deleteJson(route('games.rounds.answer.destroy', [$room, $round]))->assertNoContent();

    expect(GameGifAnswer::query()->count())->toBe(0);
    Event::assertDispatched(GameAnswerChanged::class, fn (GameAnswerChanged $event) => $event->answered === false);
});

it('lets the host and guests answer', function () {
    [$room, $hostUser] = sprintGifRoom();
    $guest = gameRoomGuest($room);
    $round = activeGifRound($room);

    $this->actingAs($hostUser)->putJson(route('games.rounds.answer.update', [$room, $round]), ['gif_id' => 'party'])->assertOk();

    app('auth')->forgetGuards();

    $this->withCookies(gameGuestCookie($guest))
        ->putJson(route('games.rounds.answer.update', [$room, $round]), ['gif_id' => 'coffee'])
        ->assertOk();

    expect(GameGifAnswer::query()->count())->toBe(2);
});

it('refuses GIFs the provider does not know and malformed ids', function (string $gifId) {
    [$room, $user] = sprintGifRoom();
    $round = activeGifRound($room);

    $this->actingAs($user)
        ->putJson(route('games.rounds.answer.update', [$room, $round]), ['gif_id' => $gifId])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('gif_id');

    expect(GameGifAnswer::query()->count())->toBe(0);
})->with(['unknown' => ['nope'], 'malformed' => ['bad id!'], 'too long' => [str_repeat('a', 65)]]);

it('refuses answers once the GIFs are revealed', function () {
    [$room, $user, $host] = sprintGifRoom();
    $round = activeGifRound($room, ['revealed_at' => now()]);
    GameGifAnswer::factory()->create(['game_round_id' => $round->id, 'player_id' => $host->id, 'gif_id' => 'party']);

    $this->actingAs($user)
        ->putJson(route('games.rounds.answer.update', [$room, $round]), ['gif_id' => 'coffee'])
        ->assertConflict()
        ->assertJsonPath('message', __('The GIFs are already revealed.'));

    $this->actingAs($user)->deleteJson(route('games.rounds.answer.destroy', [$room, $round]))->assertConflict();

    expect(GameGifAnswer::query()->sole()->gif_id)->toBe('party');
});

it('refuses answers on ended rounds and in other games', function () {
    [$room, $user] = sprintGifRoom();
    $ended = activeGifRound($room, ['ended_at' => now(), 'outcome' => GameRoundOutcome::Revealed]);

    $this->actingAs($user)
        ->putJson(route('games.rounds.answer.update', [$room, $ended]), ['gif_id' => 'party'])
        ->assertConflict()
        ->assertJsonPath('message', __('This round is over.'));

    $hangman = activeGameRound($room, ['game' => GameKind::Hangman]);

    $this->actingAs($user)
        ->putJson(route('games.rounds.answer.update', [$room, $hangman]), ['gif_id' => 'party'])
        ->assertUnprocessable();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Games/SprintGifAnswersTest.php`
Expected: FAIL — `Route [games.rounds.answer.update] not defined.`

- [ ] **Step 3: Write the actions**

Create `app/Actions/Games/SetGifAnswer.php`:

```php
<?php

namespace App\Actions\Games;

use App\Enums\GameKind;
use App\Events\Games\GameAnswerChanged;
use App\Models\GameGifAnswer;
use App\Models\GamePlayer;
use App\Models\GameRoom;
use App\Models\GameRound;
use App\Support\Gifs\Gif;
use App\Support\Gifs\GifCatalog;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\ConflictHttpException;

class SetGifAnswer
{
    public function __construct(
        private GifCatalog $gifCatalog,
        private PresentGifAnswers $presentGifAnswers,
    ) {}

    /**
     * The GIF is looked up before the locks are taken (a provider call can
     * take seconds); the round is checked again once locked.
     *
     * @return array{id: string, gif: array{id: string, previewUrl: string, url: string}}
     */
    public function handle(GameRoom $room, GameRound $round, GamePlayer $player, string $gifId): array
    {
        self::guard($room, $round);

        $gif = $this->gifCatalog->attempt(
            fn (): ?Gif => $this->gifCatalog->resolve($gifId),
            __('GIF search is unavailable.'),
        );

        if ($gif === null) {
            throw ValidationException::withMessages(['gif_id' => __('This GIF could not be found.')]);
        }

        return DB::transaction(function () use ($room, $round, $player, $gifId): array {
            [$lockedRoom, $lockedRound] = LockGameRound::handle($room, $round);

            self::guard($lockedRoom, $lockedRound);

            $answer = GameGifAnswer::query()->updateOrCreate(
                ['game_round_id' => $lockedRound->id, 'player_id' => $player->id],
                ['gif_id' => $gifId],
            );

            if ($answer->wasRecentlyCreated) {
                (new GameAnswerChanged($lockedRoom, $lockedRound->id, $player->id, true))->sendToOthers();
            }

            return $this->presentGifAnswers->mine($answer);
        });
    }

    /**
     * Answers can change until the reveal, never after.
     */
    public static function guard(GameRoom $room, GameRound $round): void
    {
        GameGuard::mutable($room);
        GameGuard::activeRound($room, $round);
        GameGuard::roundGame($round, GameKind::SprintGif);

        if ($round->revealed_at !== null) {
            throw new ConflictHttpException(__('The GIFs are already revealed.'));
        }
    }
}
```

Create `app/Actions/Games/RemoveGifAnswer.php`:

```php
<?php

namespace App\Actions\Games;

use App\Events\Games\GameAnswerChanged;
use App\Models\GameGifAnswer;
use App\Models\GamePlayer;
use App\Models\GameRoom;
use App\Models\GameRound;
use Illuminate\Support\Facades\DB;

class RemoveGifAnswer
{
    public function handle(GameRoom $room, GameRound $round, GamePlayer $player): void
    {
        SetGifAnswer::guard($room, $round);

        DB::transaction(function () use ($room, $round, $player): void {
            [$lockedRoom, $lockedRound] = LockGameRound::handle($room, $round);

            SetGifAnswer::guard($lockedRoom, $lockedRound);

            $removed = GameGifAnswer::query()
                ->where('game_round_id', $lockedRound->id)
                ->where('player_id', $player->id)
                ->delete();

            if ($removed > 0) {
                (new GameAnswerChanged($lockedRoom, $lockedRound->id, $player->id, false))->sendToOthers();
            }
        });
    }
}
```

- [ ] **Step 4: Write the controller and routes**

Create `app/Http/Controllers/Games/GameAnswersController.php`:

```php
<?php

namespace App\Http\Controllers\Games;

use App\Actions\Games\RemoveGifAnswer;
use App\Actions\Games\SetGifAnswer;
use App\Http\Controllers\Controller;
use App\Models\GamePlayer;
use App\Models\GameRoom;
use App\Models\GameRound;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

class GameAnswersController extends Controller
{
    public function update(Request $request, GameRoom $room, GameRound $round, SetGifAnswer $setGifAnswer): JsonResponse
    {
        $validated = $request->validate([
            'gif_id' => ['required', 'string', 'regex:/^[A-Za-z0-9_-]{1,64}$/'],
        ]);

        return response()->json([
            'myAnswer' => $setGifAnswer->handle($room, $round, GamePlayer::current($request), $validated['gif_id']),
        ]);
    }

    public function destroy(Request $request, GameRoom $room, GameRound $round, RemoveGifAnswer $removeGifAnswer): Response
    {
        $removeGifAnswer->handle($room, $round, GamePlayer::current($request));

        return response()->noContent();
    }
}
```

In `routes/web.php` add `use App\Http\Controllers\Games\GameAnswersController;` and, inside the `games/{room}` group after the `games.rounds.question.update` route:

```php
        Route::put('rounds/{round}/answer', [GameAnswersController::class, 'update'])->name('games.rounds.answer.update')->whereUuid('round');
        Route::delete('rounds/{round}/answer', [GameAnswersController::class, 'destroy'])->name('games.rounds.answer.destroy')->whereUuid('round');
```

- [ ] **Step 5: Run the tests**

Run: `vendor/bin/sail artisan wayfinder:generate --with-form && vendor/bin/sail artisan test --compact tests/Feature/Games/SprintGifAnswersTest.php`
Expected: PASS.

- [ ] **Step 6: Translations**

| Key (en) | fr | es | de |
|---|---|---|---|
| The GIFs are already revealed. | Les GIF sont déjà révélés. | Los GIF ya se revelaron. | Die GIFs sind schon aufgedeckt. |

(`This GIF could not be found.` already exists.)

- [ ] **Step 7: Format, analyse, commit**

```bash
vendor/bin/sail bin pint --dirty --format agent
vendor/bin/sail bin phpstan analyse --no-progress
git add app/Actions/Games/SetGifAnswer.php app/Actions/Games/RemoveGifAnswer.php app/Http/Controllers/Games/GameAnswersController.php routes/web.php tests/Feature/Games/SprintGifAnswersTest.php lang
git commit -m "feat(games): answer the GIF question

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SosW8d2Uj7QxsF1tws5ssS"
```

---

### Task 5: Reveal, favourite votes and closing the round

**Files:**
- Create: `app/Actions/Games/{RevealGifAnswers,CastGifVote,RetractGifVote,CloseGifRound}.php`, `app/Http/Controllers/Games/{GameRevealsController,GameVotesController,GameClosuresController}.php`
- Modify: ⚑ `routes/web.php`
- Test: create `tests/Feature/Games/SprintGifVotingTest.php`

**Interfaces:**
- Consumes: `LockGameRound`, `GameGuard`, `EndGameRound`, `PresentGameRound`, `GameRateLimit` (13a); `RevealGifRound` (Task 2); `GameVoteChanged` (Task 1).
- Produces: `RevealGifAnswers::handle(GameRoom, GameRound, GamePlayer $host): void`; `CastGifVote::handle(GameRoom, GameRound, GamePlayer $voter, string $answerId): void`; `RetractGifVote::handle(GameRoom, GameRound, GamePlayer $voter): void`; `CloseGifRound::handle(GameRoom, GameRound, GamePlayer $host): array` (the `RoundEnded` payload); routes `games.rounds.reveal.store` (POST, host, the round as the host sees it), `games.rounds.vote.update` (PUT, body `answer_id`, 204), `games.rounds.vote.destroy` (DELETE, 204), `games.rounds.close.store` (POST, host, `{ended}`). Votes share the `game-play:{playerId}` rate limit (burst 3, 1 per second).

- [ ] **Step 1: Write the failing test**

Create `tests/Feature/Games/SprintGifVotingTest.php`:

```php
<?php

use App\Enums\GameRoundOutcome;
use App\Events\Games\GameRoundEnded;
use App\Events\Games\GameRoundRevealed;
use App\Events\Games\GameVoteChanged;
use App\Models\GameGifAnswer;
use App\Models\GameGifVote;
use App\Models\GamePlayer;
use App\Models\GamePoint;
use App\Models\GameRound;
use App\Support\Games\GameWordBook;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Event;

beforeEach(function () {
    Event::fake();
    fakeGameGifs('party', 'coffee');
    $this->travelTo(CarbonImmutable::parse('2026-10-06 10:00:00'));
    app()->instance(GameWordBook::class, new GameWordBook(questions: ['en' => ['What next?']]));
});

function votingAnswer(GameRound $round, GamePlayer $player, string $gifId = 'party'): GameGifAnswer
{
    return GameGifAnswer::factory()->create(['game_round_id' => $round->id, 'player_id' => $player->id, 'gif_id' => $gifId]);
}

it('reveals the GIFs for the host and opens voting without ending the round', function () {
    [$room, $user, $host] = sprintGifRoom();
    [, $member] = gameRoomMember($room);
    $round = activeGifRound($room);
    $answer = votingAnswer($round, $member);

    $this->actingAs($user)
        ->postJson(route('games.rounds.reveal.store', [$room, $round]))
        ->assertOk()
        ->assertJsonPath('id', $round->id)
        ->assertJsonPath('revealedAt', '2026-10-06T10:00:00+00:00')
        ->assertJsonPath('answers', [['id' => $answer->id, 'gif' => gameGifPayload('party'), 'playerId' => $member->id]])
        ->assertJsonPath('voters', []);

    expect($round->fresh()->isActive())->toBeTrue()
        ->and(GamePoint::query()->count())->toBe(0);

    Event::assertDispatched(GameRoundRevealed::class, fn (GameRoundRevealed $event) => $event->payload['answers'][0] === [
        'id' => $answer->id,
        'gif' => gameGifPayload('party'),
        'playerId' => $member->id,
    ]);
    Event::assertNotDispatched(GameRoundEnded::class);
});

it('refuses a second reveal and reveals by other players', function () {
    [$room, $user] = sprintGifRoom();
    [$memberUser] = gameRoomMember($room);
    $round = activeGifRound($room);

    $this->actingAs($memberUser)->postJson(route('games.rounds.reveal.store', [$room, $round]))->assertForbidden();
    $this->actingAs($user)->postJson(route('games.rounds.reveal.store', [$room, $round]))->assertOk();
    $this->actingAs($user)->postJson(route('games.rounds.reveal.store', [$room, $round]))
        ->assertConflict()
        ->assertJsonPath('message', __('The GIFs are already revealed.'));
});

it('lets players vote for one favourite and change their mind', function () {
    [$room, , $host] = sprintGifRoom();
    [$voterUser, $voter] = gameRoomMember($room);
    [, $other] = gameRoomMember($room);
    $round = activeGifRound($room, ['revealed_at' => now()]);
    $first = votingAnswer($round, $host, 'party');
    $second = votingAnswer($round, $other, 'coffee');

    $this->actingAs($voterUser)->putJson(route('games.rounds.vote.update', [$room, $round]), ['answer_id' => $first->id])->assertNoContent();
    $this->travel(2)->seconds();
    $this->actingAs($voterUser)->putJson(route('games.rounds.vote.update', [$room, $round]), ['answer_id' => $second->id])->assertNoContent();

    expect(GameGifVote::query()->sole())
        ->voter_player_id->toBe($voter->id)
        ->answer_id->toBe($second->id);

    Event::assertDispatchedTimes(GameVoteChanged::class, 1);
    Event::assertDispatched(GameVoteChanged::class, fn (GameVoteChanged $event) => $event->broadcastWith() === [
        'roundId' => $round->id,
        'playerId' => $voter->id,
        'voted' => true,
    ]);
});

it('retracts a vote', function () {
    [$room, , $host] = sprintGifRoom();
    [$voterUser, $voter] = gameRoomMember($room);
    $round = activeGifRound($room, ['revealed_at' => now()]);
    $answer = votingAnswer($round, $host);
    GameGifVote::factory()->create(['game_round_id' => $round->id, 'voter_player_id' => $voter->id, 'answer_id' => $answer->id]);

    $this->actingAs($voterUser)->deleteJson(route('games.rounds.vote.destroy', [$room, $round]))->assertNoContent();

    expect(GameGifVote::query()->count())->toBe(0);
    Event::assertDispatched(GameVoteChanged::class, fn (GameVoteChanged $event) => $event->voted === false);
});

it('refuses a vote for your own GIF', function () {
    [$room, $user, $host] = sprintGifRoom();
    $round = activeGifRound($room, ['revealed_at' => now()]);
    $own = votingAnswer($round, $host);

    $this->actingAs($user)
        ->putJson(route('games.rounds.vote.update', [$room, $round]), ['answer_id' => $own->id])
        ->assertForbidden()
        ->assertJsonPath('message', __('You cannot vote for your own GIF.'));

    expect(GameGifVote::query()->count())->toBe(0);
});

it('refuses votes before the reveal and after the close', function () {
    [$room, , $host] = sprintGifRoom();
    [$voterUser] = gameRoomMember($room);
    $round = activeGifRound($room);
    $answer = votingAnswer($round, $host);

    $this->actingAs($voterUser)
        ->putJson(route('games.rounds.vote.update', [$room, $round]), ['answer_id' => $answer->id])
        ->assertConflict()
        ->assertJsonPath('message', __('Voting has not started.'));

    $round->forceFill(['revealed_at' => now(), 'ended_at' => now(), 'outcome' => GameRoundOutcome::Revealed])->save();
    $this->travel(2)->seconds();

    $this->actingAs($voterUser)
        ->putJson(route('games.rounds.vote.update', [$room, $round]), ['answer_id' => $answer->id])
        ->assertConflict()
        ->assertJsonPath('message', __('This round is over.'));
});

it('refuses an answer of another round and malformed ids', function () {
    [$room] = sprintGifRoom();
    [$voterUser] = gameRoomMember($room);
    $round = activeGifRound($room, ['revealed_at' => now()]);
    $foreign = GameGifAnswer::factory()->create();

    $this->actingAs($voterUser)
        ->putJson(route('games.rounds.vote.update', [$room, $round]), ['answer_id' => $foreign->id])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['answer_id' => __('This GIF is not part of this round.')]);

    $this->travel(2)->seconds();

    $this->actingAs($voterUser)
        ->putJson(route('games.rounds.vote.update', [$room, $round]), ['answer_id' => 'not-a-uuid'])
        ->assertUnprocessable();
});

it('lets players without an answer and guests vote', function () {
    [$room, , $host] = sprintGifRoom();
    [$memberUser] = gameRoomMember($room);
    $guest = gameRoomGuest($room);
    $round = activeGifRound($room, ['revealed_at' => now()]);
    $answer = votingAnswer($round, $host);

    $this->actingAs($memberUser)->putJson(route('games.rounds.vote.update', [$room, $round]), ['answer_id' => $answer->id])->assertNoContent();

    app('auth')->forgetGuards();

    $this->withCookies(gameGuestCookie($guest))
        ->putJson(route('games.rounds.vote.update', [$room, $round]), ['answer_id' => $answer->id])
        ->assertNoContent();

    expect(GameGifVote::query()->count())->toBe(2);
});

it('closes the round for the host with the votes and the points', function () {
    [$room, $user, $host] = sprintGifRoom();
    [, $author] = gameRoomMember($room);
    $round = activeGifRound($room, ['revealed_at' => now()]);
    $answer = votingAnswer($round, $author);
    GameGifVote::factory()->create(['game_round_id' => $round->id, 'voter_player_id' => $host->id, 'answer_id' => $answer->id]);

    $response = $this->actingAs($user)
        ->postJson(route('games.rounds.close.store', [$room, $round]))
        ->assertOk()
        ->assertJsonPath('ended.outcome', 'revealed')
        ->assertJsonPath('ended.answers.0.votes', 1)
        ->assertJsonPath('ended.answers.0.playerId', $author->id);

    expect($response->json('ended.points'))->toEqualCanonicalizing([
        ['playerId' => $author->id, 'points' => 2, 'isWin' => false],
        ['playerId' => $host->id, 'points' => 0, 'isWin' => false],
    ])
        ->and($round->fresh()->outcome)->toBe(GameRoundOutcome::Revealed);
});

it('refuses a close before the reveal and by other players', function () {
    [$room, $user] = sprintGifRoom();
    [$memberUser] = gameRoomMember($room);
    $round = activeGifRound($room);

    $this->actingAs($user)
        ->postJson(route('games.rounds.close.store', [$room, $round]))
        ->assertConflict()
        ->assertJsonPath('message', __('Voting has not started.'));

    $round->forceFill(['revealed_at' => now()])->save();

    $this->actingAs($memberUser)->postJson(route('games.rounds.close.store', [$room, $round]))->assertForbidden();
});

it('closes the voting round when the host starts the next one', function () {
    [$room, $user, $host] = sprintGifRoom();
    [, $author] = gameRoomMember($room);
    $round = activeGifRound($room, ['revealed_at' => now()]);
    $answer = votingAnswer($round, $author);
    GameGifVote::factory()->create(['game_round_id' => $round->id, 'voter_player_id' => $host->id, 'answer_id' => $answer->id]);

    $this->actingAs($user)
        ->postJson(route('games.rounds.store', $room))
        ->assertCreated()
        ->assertJsonPath('ended.roundId', $round->id)
        ->assertJsonPath('ended.outcome', 'revealed')
        ->assertJsonPath('ended.answers.0.votes', 1)
        ->assertJsonPath('round.question', 'What next?');

    expect(GamePoint::query()->where('player_id', $author->id)->sole()->points)->toBe(2);
});

it('refuses to start the next round before the reveal', function () {
    [$room, $user] = sprintGifRoom();
    activeGifRound($room);

    $this->actingAs($user)
        ->postJson(route('games.rounds.store', $room))
        ->assertConflict()
        ->assertJsonPath('message', __('A round is already in progress.'));
});

it('slows down a player voting too fast', function () {
    [$room, , $host] = sprintGifRoom();
    [$voterUser] = gameRoomMember($room);
    [, $other] = gameRoomMember($room);
    $round = activeGifRound($room, ['revealed_at' => now()]);
    $first = votingAnswer($round, $host, 'party');
    $second = votingAnswer($round, $other, 'coffee');

    foreach ([$first, $second, $first] as $answer) {
        $this->actingAs($voterUser)->putJson(route('games.rounds.vote.update', [$room, $round]), ['answer_id' => $answer->id])->assertNoContent();
    }

    $this->actingAs($voterUser)
        ->putJson(route('games.rounds.vote.update', [$room, $round]), ['answer_id' => $second->id])
        ->assertTooManyRequests()
        ->assertJsonPath('message', __('Slow down a little.'));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Games/SprintGifVotingTest.php`
Expected: FAIL — `Route [games.rounds.reveal.store] not defined.`

- [ ] **Step 3: Write the actions**

Create `app/Actions/Games/RevealGifAnswers.php`:

```php
<?php

namespace App\Actions\Games;

use App\Enums\GameKind;
use App\Models\GamePlayer;
use App\Models\GameRoom;
use App\Models\GameRound;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpKernel\Exception\ConflictHttpException;

class RevealGifAnswers
{
    public function __construct(private RevealGifRound $revealGifRound) {}

    public function handle(GameRoom $room, GameRound $round, GamePlayer $host): void
    {
        DB::transaction(function () use ($room, $round, $host): void {
            [$lockedRoom, $lockedRound] = LockGameRound::handle($room, $round);

            GameGuard::mutable($lockedRoom);
            GameGuard::host($lockedRoom, $host);
            GameGuard::activeRound($lockedRoom, $lockedRound);
            GameGuard::roundGame($lockedRound, GameKind::SprintGif);

            if ($lockedRound->revealed_at !== null) {
                throw new ConflictHttpException(__('The GIFs are already revealed.'));
            }

            $this->revealGifRound->handle($lockedRoom, $lockedRound);
        });
    }
}
```

Create `app/Actions/Games/CastGifVote.php`:

```php
<?php

namespace App\Actions\Games;

use App\Enums\GameKind;
use App\Events\Games\GameVoteChanged;
use App\Models\GameGifAnswer;
use App\Models\GameGifVote;
use App\Models\GamePlayer;
use App\Models\GameRoom;
use App\Models\GameRound;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\ConflictHttpException;

/**
 * One favourite per player, replaceable until the close. Only "voted" is
 * broadcast: whom a player voted for stays secret until the round ends.
 */
class CastGifVote
{
    public function handle(GameRoom $room, GameRound $round, GamePlayer $voter, string $answerId): void
    {
        self::guard($room, $round);

        DB::transaction(function () use ($room, $round, $voter, $answerId): void {
            [$lockedRoom, $lockedRound] = LockGameRound::handle($room, $round);

            self::guard($lockedRoom, $lockedRound);

            $answer = GameGifAnswer::query()
                ->where('game_round_id', $lockedRound->id)
                ->whereKey($answerId)
                ->first();

            if ($answer === null) {
                throw ValidationException::withMessages(['answer_id' => __('This GIF is not part of this round.')]);
            }

            if ($answer->player_id === $voter->id) {
                throw new AuthorizationException(__('You cannot vote for your own GIF.'));
            }

            $vote = GameGifVote::query()->updateOrCreate(
                ['game_round_id' => $lockedRound->id, 'voter_player_id' => $voter->id],
                ['answer_id' => $answer->id],
            );

            if ($vote->wasRecentlyCreated) {
                (new GameVoteChanged($lockedRoom, $lockedRound->id, $voter->id, true))->sendToOthers();
            }
        });
    }

    /**
     * Votes are open between the reveal and the close.
     */
    public static function guard(GameRoom $room, GameRound $round): void
    {
        GameGuard::mutable($room);
        GameGuard::activeRound($room, $round);
        GameGuard::roundGame($round, GameKind::SprintGif);

        if ($round->revealed_at === null) {
            throw new ConflictHttpException(__('Voting has not started.'));
        }
    }
}
```

Create `app/Actions/Games/RetractGifVote.php`:

```php
<?php

namespace App\Actions\Games;

use App\Events\Games\GameVoteChanged;
use App\Models\GameGifVote;
use App\Models\GamePlayer;
use App\Models\GameRoom;
use App\Models\GameRound;
use Illuminate\Support\Facades\DB;

class RetractGifVote
{
    public function handle(GameRoom $room, GameRound $round, GamePlayer $voter): void
    {
        CastGifVote::guard($room, $round);

        DB::transaction(function () use ($room, $round, $voter): void {
            [$lockedRoom, $lockedRound] = LockGameRound::handle($room, $round);

            CastGifVote::guard($lockedRoom, $lockedRound);

            $removed = GameGifVote::query()
                ->where('game_round_id', $lockedRound->id)
                ->where('voter_player_id', $voter->id)
                ->delete();

            if ($removed > 0) {
                (new GameVoteChanged($lockedRoom, $lockedRound->id, $voter->id, false))->sendToOthers();
            }
        });
    }
}
```

Create `app/Actions/Games/CloseGifRound.php`:

```php
<?php

namespace App\Actions\Games;

use App\Enums\GameKind;
use App\Enums\GameRoundOutcome;
use App\Models\GamePlayer;
use App\Models\GameRoom;
use App\Models\GameRound;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpKernel\Exception\ConflictHttpException;

class CloseGifRound
{
    public function __construct(private EndGameRound $endGameRound) {}

    /**
     * @return array<string, mixed>
     */
    public function handle(GameRoom $room, GameRound $round, GamePlayer $host): array
    {
        return DB::transaction(function () use ($room, $round, $host): array {
            [$lockedRoom, $lockedRound] = LockGameRound::handle($room, $round);

            GameGuard::mutable($lockedRoom);
            GameGuard::host($lockedRoom, $host);
            GameGuard::activeRound($lockedRoom, $lockedRound);
            GameGuard::roundGame($lockedRound, GameKind::SprintGif);

            if ($lockedRound->revealed_at === null) {
                throw new ConflictHttpException(__('Voting has not started.'));
            }

            return $this->endGameRound->handle($lockedRoom, $lockedRound, GameRoundOutcome::Revealed)
                ?? throw new ConflictHttpException(__('This round is over.'));
        });
    }
}
```

- [ ] **Step 4: Write the controllers and routes**

Create `app/Http/Controllers/Games/GameRevealsController.php`:

```php
<?php

namespace App\Http\Controllers\Games;

use App\Actions\Games\PresentGameRound;
use App\Actions\Games\RevealGifAnswers;
use App\Http\Controllers\Controller;
use App\Models\GamePlayer;
use App\Models\GameRoom;
use App\Models\GameRound;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class GameRevealsController extends Controller
{
    public function store(Request $request, GameRoom $room, GameRound $round, RevealGifAnswers $revealGifAnswers, PresentGameRound $presentGameRound): JsonResponse
    {
        $player = GamePlayer::current($request);

        $revealGifAnswers->handle($room, $round, $player);

        return response()->json($presentGameRound->handle($round->refresh(), $room->refresh(), $player));
    }
}
```

Create `app/Http/Controllers/Games/GameVotesController.php`:

```php
<?php

namespace App\Http\Controllers\Games;

use App\Actions\Games\CastGifVote;
use App\Actions\Games\RetractGifVote;
use App\Http\Controllers\Controller;
use App\Models\GamePlayer;
use App\Models\GameRoom;
use App\Models\GameRound;
use App\Support\Games\GameRateLimit;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

class GameVotesController extends Controller
{
    public function update(Request $request, GameRoom $room, GameRound $round, CastGifVote $castGifVote): Response
    {
        $player = GamePlayer::current($request);

        GameRateLimit::hit("game-play:{$player->id}", 3, 3);

        $validated = $request->validate([
            'answer_id' => ['required', 'uuid'],
        ]);

        $castGifVote->handle($room, $round, $player, $validated['answer_id']);

        return response()->noContent();
    }

    public function destroy(Request $request, GameRoom $room, GameRound $round, RetractGifVote $retractGifVote): Response
    {
        $player = GamePlayer::current($request);

        GameRateLimit::hit("game-play:{$player->id}", 3, 3);

        $retractGifVote->handle($room, $round, $player);

        return response()->noContent();
    }
}
```

Create `app/Http/Controllers/Games/GameClosuresController.php`:

```php
<?php

namespace App\Http\Controllers\Games;

use App\Actions\Games\CloseGifRound;
use App\Http\Controllers\Controller;
use App\Models\GamePlayer;
use App\Models\GameRoom;
use App\Models\GameRound;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class GameClosuresController extends Controller
{
    public function store(Request $request, GameRoom $room, GameRound $round, CloseGifRound $closeGifRound): JsonResponse
    {
        return response()->json(['ended' => $closeGifRound->handle($room, $round, GamePlayer::current($request))]);
    }
}
```

In `routes/web.php` add `use App\Http\Controllers\Games\GameClosuresController;`, `use App\Http\Controllers\Games\GameRevealsController;`, `use App\Http\Controllers\Games\GameVotesController;` and, inside the `games/{room}` group after the `games.rounds.answer.destroy` route:

```php
        Route::post('rounds/{round}/reveal', [GameRevealsController::class, 'store'])->name('games.rounds.reveal.store')->whereUuid('round');
        Route::put('rounds/{round}/vote', [GameVotesController::class, 'update'])->name('games.rounds.vote.update')->whereUuid('round');
        Route::delete('rounds/{round}/vote', [GameVotesController::class, 'destroy'])->name('games.rounds.vote.destroy')->whereUuid('round');
        Route::post('rounds/{round}/close', [GameClosuresController::class, 'store'])->name('games.rounds.close.store')->whereUuid('round');
```

- [ ] **Step 5: Run the tests**

Run: `vendor/bin/sail artisan wayfinder:generate --with-form && vendor/bin/sail artisan test --compact tests/Feature/Games`
Expected: PASS.

- [ ] **Step 6: Translations**

| Key (en) | fr | es | de |
|---|---|---|---|
| Voting has not started. | Le vote n'a pas commencé. | La votación no ha empezado. | Die Abstimmung hat noch nicht begonnen. |
| You cannot vote for your own GIF. | Vous ne pouvez pas voter pour votre propre GIF. | No puedes votar por tu propio GIF. | Du kannst nicht für dein eigenes GIF stimmen. |
| This GIF is not part of this round. | Ce GIF ne fait pas partie de cette manche. | Este GIF no forma parte de esta ronda. | Dieses GIF gehört nicht zu dieser Runde. |

- [ ] **Step 7: Format, analyse, commit**

```bash
vendor/bin/sail bin pint --dirty --format agent
vendor/bin/sail bin phpstan analyse --no-progress
git add app/Actions/Games/RevealGifAnswers.php app/Actions/Games/CastGifVote.php app/Actions/Games/RetractGifVote.php app/Actions/Games/CloseGifRound.php app/Http/Controllers/Games/GameRevealsController.php app/Http/Controllers/Games/GameVotesController.php app/Http/Controllers/Games/GameClosuresController.php routes/web.php tests/Feature/Games/SprintGifVotingTest.php lang
git commit -m "feat(games): reveal GIF answers, vote for a favourite and close the round

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SosW8d2Uj7QxsF1tws5ssS"
```

---

### Task 6: Redaction suite — GIF answers before the reveal, votes before the close, anonymous authors

**Files:**
- Test: create `tests/Feature/Games/SprintGifRedactionTest.php`

**Interfaces:**
- Consumes: every endpoint, presenter and event of Tasks 1–5; `gamePayloadJson()` (13a).
- Produces: the GIF invariant suite of spec §8. No production code changes unless a test fails — then fix the presenter at fault (`PresentGifAnswers`, `SprintGifRules::presentActive`), never the test.

- [ ] **Step 1: Write the suite**

Create `tests/Feature/Games/SprintGifRedactionTest.php`:

```php
<?php

use App\Events\Games\GameAnswerChanged;
use App\Events\Games\GameBroadcastEvent;
use App\Events\Games\GameQuestionChanged;
use App\Events\Games\GameRoomChanged;
use App\Events\Games\GameRoundEnded;
use App\Events\Games\GameRoundRevealed;
use App\Events\Games\GameRoundStarted;
use App\Events\Games\GameTimerChanged;
use App\Events\Games\GameVoteChanged;
use App\Models\GameGifAnswer;
use App\Models\GameRound;
use App\Support\Games\GameWordBook;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Str;

const HiddenGif = 'hiddengif42';

beforeEach(function () {
    Event::fake();
    fakeGameGifs(HiddenGif, 'othergif7');
    app()->instance(GameWordBook::class, new GameWordBook(questions: ['en' => ['Which GIF sums up the sprint?']]));
});

/**
 * @param  array<int, class-string<GameBroadcastEvent>>  $classes
 * @return Collection<int, GameBroadcastEvent>
 */
function gifBroadcasts(array $classes): Collection
{
    return collect($classes)
        ->flatMap(fn (string $class) => Event::dispatched($class))
        ->map(fn (array $arguments): GameBroadcastEvent => $arguments[0]);
}

it('keeps other players GIFs out of every payload before the reveal', function () {
    [$room, $hostUser] = sprintGifRoom();
    [$memberUser] = gameRoomMember($room);
    $guest = gameRoomGuest($room);

    $start = $this->actingAs($hostUser)->postJson(route('games.rounds.store', $room))->assertCreated()->json();
    $round = GameRound::query()->sole();

    $this->actingAs($memberUser)->putJson(route('games.rounds.answer.update', [$room, $round]), ['gif_id' => HiddenGif])->assertOk();
    $this->actingAs($hostUser)->putJson(route('games.rounds.question.update', [$room, $round]))->assertConflict();

    $hostSnapshot = $this->actingAs($hostUser)->getJson(route('games.snapshot.show', $room))->assertOk()->json();

    app('auth')->forgetGuards();

    $guestSnapshot = $this->withCookies(gameGuestCookie($guest))->getJson(route('games.snapshot.show', $room))->assertOk()->json();

    foreach ([$start, $hostSnapshot, $guestSnapshot] as $payload) {
        expect(gamePayloadJson($payload))->not->toContain(HiddenGif);
    }

    expect(gifBroadcasts([GameRoundStarted::class, GameAnswerChanged::class, GameQuestionChanged::class, GameTimerChanged::class, GameRoomChanged::class])
        ->contains(fn (GameBroadcastEvent $event) => str_contains(gamePayloadJson($event->broadcastWith()), HiddenGif)))->toBeFalse();

    $this->actingAs($hostUser)->getJson(route('games.rounds.index', $room))->assertOk()->assertExactJson([]);
    $this->actingAs($hostUser)->getJson(route('games.rounds.show', [$room, $round]))->assertNotFound();
});

it('keeps vote counts and who voted for what secret until the close', function () {
    [$room, $hostUser, $host] = sprintGifRoom();
    [$memberUser, $member] = gameRoomMember($room);
    [$voterUser] = gameRoomMember($room);
    $round = activeGifRound($room);
    $hostAnswer = GameGifAnswer::factory()->create(['game_round_id' => $round->id, 'player_id' => $host->id, 'gif_id' => 'othergif7']);
    GameGifAnswer::factory()->create(['game_round_id' => $round->id, 'player_id' => $member->id, 'gif_id' => HiddenGif]);

    $this->actingAs($hostUser)->postJson(route('games.rounds.reveal.store', [$room, $round]))->assertOk();
    $this->actingAs($memberUser)->putJson(route('games.rounds.vote.update', [$room, $round]), ['answer_id' => $hostAnswer->id])->assertNoContent();
    $this->actingAs($voterUser)->putJson(route('games.rounds.vote.update', [$room, $round]), ['answer_id' => $hostAnswer->id])->assertNoContent();

    foreach ([$hostUser, $memberUser, $voterUser] as $user) {
        $view = $this->actingAs($user)->getJson(route('games.snapshot.show', $room))->assertOk()->json('round');

        expect(gamePayloadJson($view))->not->toContain('"votes"')
            ->and(array_map(fn (array $answer): array => array_keys($answer), $view['answers']))->each->toBe(['id', 'gif', 'playerId'])
            ->and($view['voters'])->toHaveCount(2)
            ->and(gamePayloadJson($view))->not->toContain('"points"');
    }

    expect($this->actingAs($hostUser)->getJson(route('games.snapshot.show', $room))->json('round.myVote'))->toBeNull()
        ->and(gifBroadcasts([GameVoteChanged::class])->every(fn (GameBroadcastEvent $event) => array_keys($event->broadcastWith()) === ['roundId', 'playerId', 'voted']))->toBeTrue()
        ->and(gifBroadcasts([GameRoundRevealed::class])->every(fn (GameBroadcastEvent $event) => ! str_contains(gamePayloadJson($event->broadcastWith()), '"votes"')))->toBeTrue();

    $this->actingAs($hostUser)->postJson(route('games.rounds.close.store', [$room, $round]))->assertOk();

    Event::assertDispatched(GameRoundEnded::class, fn (GameRoundEnded $event) => collect($event->payload['answers'])->firstWhere('id', $hostAnswer->id)['votes'] === 2);
});

it('never names the author of a GIF on an anonymous retro, even after the close', function () {
    [$room, $hostUser, , $memberUser, $member] = anonymousGifIcebreaker();

    $this->actingAs($hostUser)->postJson(route('games.rounds.store', $room))->assertCreated();
    $round = GameRound::query()->sole();

    $this->actingAs($memberUser)->putJson(route('games.rounds.answer.update', [$room, $round]), ['gif_id' => HiddenGif])->assertOk();
    $answer = GameGifAnswer::query()->sole();

    $this->actingAs($hostUser)->postJson(route('games.rounds.reveal.store', [$room, $round]))
        ->assertOk()
        ->assertJsonPath('answers.0.playerId', null);
    $this->actingAs($hostUser)->putJson(route('games.rounds.vote.update', [$room, $round]), ['answer_id' => $answer->id])->assertNoContent();

    $memberView = $this->actingAs($memberUser)->getJson(route('games.snapshot.show', $room))->assertOk()->json('round');

    expect($memberView['answers'][0]['playerId'])->toBeNull()
        ->and($memberView['myAnswer']['id'])->toBe($answer->id);

    $this->actingAs($hostUser)->postJson(route('games.rounds.close.store', [$room, $round]))
        ->assertOk()
        ->assertJsonPath('ended.answers.0.playerId', null)
        ->assertJsonPath('ended.answers.0.votes', 1);

    $this->actingAs($memberUser)->getJson(route('games.rounds.show', [$room, $round]))
        ->assertOk()
        ->assertJsonPath('answers.0.playerId', null);

    $authoredPayloads = gifBroadcasts([GameRoundRevealed::class, GameRoundEnded::class])
        ->map(fn (GameBroadcastEvent $event) => $event->broadcastWith()['answers']);

    expect($authoredPayloads)->not->toBeEmpty()
        ->and($authoredPayloads->flatten(1)->pluck('playerId')->filter()->all())->toBe([])
        ->and(Str::isUuid($answer->id))->toBeTrue()
        ->and($answer->id[14])->toBe('4');
});
```

- [ ] **Step 2: Run the suite**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Games/SprintGifRedactionTest.php`
Expected: PASS. A failure is a leak: fix the presenter or event that carries the data.

- [ ] **Step 3: Commit**

```bash
vendor/bin/sail bin pint --dirty --format agent
git add tests/Feature/Games/SprintGifRedactionTest.php
git commit -m "test(games): pin GIF answer, vote and author redaction

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SosW8d2Uj7QxsF1tws5ssS"
```

---

### Task 7: Frontend state — types, reducer actions and events

**Files:**
- Modify: ⚑ `resources/js/lib/games/types.ts`, ⚑ `resources/js/lib/games/room-reducer.ts`, ⚑ `resources/js/hooks/use-game-channel.ts`, ⚑ `resources/js/hooks/use-game-room.ts`
- Create: `resources/js/lib/games/gif.ts`

**Interfaces:**
- Consumes: the payload shapes of Tasks 1–5.
- Produces: types `GameGif`, `GameGifPending`, `GameGifRevealed`, `GameGifSlot`, `GameMyGifAnswer`, `GameRoundRevealed`, `GameGifSearchResult`; `GameRound` fields `question?`, `gifProvider?`, `answers?`, `myAnswer?`, `voters?`, `myVote?`; `GameRoundEnded` fields `question?`, `answers?`; `GameRoundDetail.answers?`; reducer actions `question.changed`, `answer.changed`, `round.revealed`, `vote.changed`; helpers `isRevealedAnswer`, `pendingAnswers`, `revealedAnswers`, `withPendingAnswer`, `withVoter`; the four event names in `GameEvents`, handled by `handleEvent`.

There is no frontend test runner (spec §1): this task is verified by the type check and lint, exercised by Task 9 and the walkthrough.

- [ ] **Step 1: Extend the types**

In `resources/js/lib/games/types.ts` add, before `export type GameRound`:

```ts
/** Proxied through skrum: never a provider URL. */
export type GameGif = { id: string; previewUrl: string; url: string };

/** Before the reveal: only who answered. */
export type GameGifPending = { playerId: string; answered: true };

/** After the reveal; playerId is null on anonymous retros, votes only once the round closed. */
export type GameGifRevealed = {
    id: string;
    gif: GameGif;
    playerId: string | null;
    votes?: number | null;
};

export type GameGifSlot = GameGifPending | GameGifRevealed;

export type GameMyGifAnswer = { id: string; gif: GameGif };

export type GameGifSearchResult = {
    id: string;
    previewUrl: string;
    width: number;
    height: number;
};
```

Inside `export type GameRound = { … }`, before its closing brace (after the fields 13a and 13b added), add:

```ts
    question?: string | null;
    gifProvider?: 'giphy' | 'tenor' | null;
    answers?: GameGifSlot[];
    myAnswer?: GameMyGifAnswer | null;
    voters?: string[];
    myVote?: string | null;
```

Inside `export type GameRoundDetail = GameHistoryRound & { … }` add:

```ts
    answers?: GameGifRevealed[];
```

Inside `export type GameRoundEnded = { … }` add:

```ts
    question?: string | null;
    answers?: GameGifRevealed[];
```

After `export type GameRoundEnded` add:

```ts
export type GameRoundRevealed = {
    roundId: string;
    revealedAt: string;
    answers: GameGifRevealed[];
};
```

- [ ] **Step 2: Write the GIF helpers**

Create `resources/js/lib/games/gif.ts`:

```ts
import type {
    GameGifPending,
    GameGifRevealed,
    GameGifSlot,
    GameRound,
} from './types';

export function isRevealedAnswer(
    answer: GameGifSlot,
): answer is GameGifRevealed {
    return 'id' in answer;
}

export function pendingAnswers(round: GameRound): GameGifPending[] {
    return (round.answers ?? []).filter(
        (answer): answer is GameGifPending => !isRevealedAnswer(answer),
    );
}

export function revealedAnswers(round: GameRound): GameGifRevealed[] {
    return (round.answers ?? []).filter(isRevealedAnswer);
}

export function withPendingAnswer(
    answers: GameGifPending[],
    playerId: string,
    answered: boolean,
): GameGifPending[] {
    const others = answers.filter((answer) => answer.playerId !== playerId);

    return answered ? [...others, { playerId, answered: true }] : others;
}

export function withVoter(
    voters: string[],
    playerId: string,
    voted: boolean,
): string[] {
    const others = voters.filter((voter) => voter !== playerId);

    return voted ? [...others, playerId] : others;
}
```

- [ ] **Step 3: Extend the reducer**

In `resources/js/lib/games/room-reducer.ts`:

1. Add `import { pendingAnswers, withPendingAnswer, withVoter } from './gif';` and add `GameRoundRevealed` to the type import from `./types`.
2. Append these members to the `RoomAction` union (after the ones 13a and 13b declared):

```ts
    | { type: 'question.changed'; roundId: string; question: string }
    | {
          type: 'answer.changed';
          roundId: string;
          playerId: string;
          answered: boolean;
      }
    | { type: 'round.revealed'; revealed: GameRoundRevealed }
    | {
          type: 'vote.changed';
          roundId: string;
          playerId: string;
          voted: boolean;
      }
```

3. Add these cases inside `roomReducer`'s `switch`, before its closing brace:

```ts
        case 'question.changed':
            return withRound(state, action.roundId, (round) => ({
                ...round,
                question: action.question,
            }));
        case 'answer.changed':
            return withRound(state, action.roundId, (round) =>
                round.revealedAt !== null
                    ? round
                    : {
                          ...round,
                          answers: withPendingAnswer(
                              pendingAnswers(round),
                              action.playerId,
                              action.answered,
                          ),
                      },
            );
        case 'round.revealed':
            return withRound(state, action.revealed.roundId, (round) => ({
                ...round,
                revealedAt: action.revealed.revealedAt,
                answers: action.revealed.answers,
                voters: [],
                myVote: null,
            }));
        case 'vote.changed':
            return withRound(state, action.roundId, (round) => ({
                ...round,
                voters: withVoter(
                    round.voters ?? [],
                    action.playerId,
                    action.voted,
                ),
            }));
```

- [ ] **Step 4: Listen to the events**

In `resources/js/hooks/use-game-channel.ts` append to the `GameEvents` array (after the names 13a and 13b listed):

```ts
    'game.question.changed',
    'game.answer.changed',
    'game.round.revealed',
    'game.vote.changed',
```

In `resources/js/hooks/use-game-room.ts` add `GameRoundRevealed` to the type import from `@/lib/games/types` and add these cases to the `switch` of `handleEvent`, before its closing brace:

```ts
                case 'game.question.changed':
                    apply({
                        type: 'question.changed',
                        roundId: payload.roundId as string,
                        question: payload.question as string,
                    });
                    break;
                case 'game.answer.changed':
                    apply({
                        type: 'answer.changed',
                        roundId: payload.roundId as string,
                        playerId: payload.playerId as string,
                        answered: payload.answered as boolean,
                    });
                    break;
                case 'game.round.revealed':
                    apply({
                        type: 'round.revealed',
                        revealed: payload as unknown as GameRoundRevealed,
                    });
                    break;
                case 'game.vote.changed':
                    apply({
                        type: 'vote.changed',
                        roundId: payload.roundId as string,
                        playerId: payload.playerId as string,
                        voted: payload.voted as boolean,
                    });
                    break;
```

- [ ] **Step 5: Check types and lint**

Run: `vendor/bin/sail artisan wayfinder:generate --with-form && npm run types:check && npx vp check --fix resources/js/lib/games resources/js/hooks/use-game-channel.ts resources/js/hooks/use-game-room.ts && npm run check`
Expected: no new errors.

- [ ] **Step 6: Commit**

```bash
git add resources/js/lib/games resources/js/hooks/use-game-channel.ts resources/js/hooks/use-game-room.ts
git commit -m "feat(games): track GIF answers, reveal and votes in the room state

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SosW8d2Uj7QxsF1tws5ssS"
```

---

### Task 8: GIF search dialog shared by cards and games

**Files:**
- Create: `resources/js/components/gifs/gif-search-dialog.tsx`, `resources/js/components/games/game-gif-picker.tsx`
- Modify: `resources/js/components/retro/gif-picker.tsx`

**Interfaces:**
- Consumes: `RetroGifsController.index` and `GameGifsController.index` (Wayfinder), `retroRequest`, `RetroRequestError`, `GameGifSearchResult` (Task 7).
- Produces: `GifSearchDialog({open, onOpenChange, onPick, search, provider, isolation?})` with `search: (query: string) => Promise<{ gifs: GameGifSearchResult[] }>` and `provider: 'giphy' | 'tenor' | null`; exported type `PickedGif = {id, previewUrl}`; `GifPicker` keeps its props and behaviour (it re-exports `PickedGif`); `GameGifPicker({open, onOpenChange, onPick, provider})`.

- [ ] **Step 1: Extract the generic dialog**

Create `resources/js/components/gifs/gif-search-dialog.tsx`:

```tsx
import { useEffect, useRef, useState, type HTMLAttributes } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useTrans } from '@/hooks/use-trans';
import type { GameGifSearchResult } from '@/lib/games/types';
import { RetroRequestError } from '@/lib/retro/api';

export type PickedGif = { id: string; previewUrl: string };

type Isolation = Pick<
    HTMLAttributes<HTMLDivElement>,
    'onKeyDown' | 'onPointerDown'
>;

const SearchDelayMs = 300;

type Props = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onPick: (gif: PickedGif) => void;
    search: (query: string) => Promise<{ gifs: GameGifSearchResult[] }>;
    provider: 'giphy' | 'tenor' | null;
    /** Keeps key and pointer events away from surrounding drag-and-drop. */
    isolation?: Isolation;
};

export function GifSearchDialog({
    open,
    onOpenChange,
    onPick,
    search,
    provider,
    isolation,
}: Props) {
    const { t } = useTrans();
    const [query, setQuery] = useState('');
    const [gifs, setGifs] = useState<GameGifSearchResult[]>([]);
    const [error, setError] = useState<'rate' | 'unavailable' | null>(null);
    const [loaded, setLoaded] = useState(false);
    const latestSearch = useRef(search);

    latestSearch.current = search;

    useEffect(() => {
        if (!open) {
            return;
        }

        let stale = false;

        setError(null);

        const timer = setTimeout(() => {
            latestSearch
                .current(query)
                .then((response) => {
                    if (stale) {
                        return;
                    }

                    setGifs(response.gifs);
                    setLoaded(true);
                })
                .catch((caught: unknown) => {
                    if (stale) {
                        return;
                    }

                    const tooMany =
                        caught instanceof RetroRequestError &&
                        caught.status === 429;

                    setError(tooMany ? 'rate' : 'unavailable');
                });
        }, SearchDelayMs);

        return () => {
            stale = true;
            clearTimeout(timer);
        };
    }, [open, query]);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                {...isolation}
                aria-describedby={undefined}
                className="max-w-lg"
            >
                <DialogTitle>{t('Choose a GIF')}</DialogTitle>
                <div {...isolation}>
                    <Input
                        value={query}
                        placeholder={t('Search GIFs…')}
                        aria-label={t('Search GIFs…')}
                        autoFocus
                        onChange={(event) => setQuery(event.target.value)}
                    />
                </div>
                {error && (
                    <p role="alert" className="text-sm text-destructive">
                        {error === 'rate'
                            ? t('Too many searches, wait a moment.')
                            : t('GIF search is unavailable.')}
                    </p>
                )}
                <div className="grid max-h-96 grid-cols-3 gap-2 overflow-y-auto">
                    {gifs.map((gif) => (
                        <button
                            key={gif.id}
                            type="button"
                            aria-label={t('Choose this GIF')}
                            className="overflow-hidden rounded-md focus-visible:ring-2 focus-visible:ring-primary"
                            onClick={() => {
                                onPick({
                                    id: gif.id,
                                    previewUrl: gif.previewUrl,
                                });
                                onOpenChange(false);
                            }}
                        >
                            <img
                                src={gif.previewUrl}
                                alt=""
                                width={gif.width}
                                height={gif.height}
                                loading="lazy"
                                className="h-auto w-full"
                            />
                        </button>
                    ))}
                </div>
                {!error && loaded && gifs.length === 0 && (
                    <p className="text-sm text-muted-foreground">
                        {t('No GIFs found.')}
                    </p>
                )}
                <p className="text-right text-xs text-muted-foreground">
                    {t('Powered by :provider', {
                        provider: provider === 'tenor' ? 'Tenor' : 'GIPHY',
                    })}
                </p>
            </DialogContent>
        </Dialog>
    );
}
```

- [ ] **Step 2: Make the card picker a thin wrapper**

Replace the whole content of `resources/js/components/retro/gif-picker.tsx` with:

```tsx
import { useCallback } from 'react';
import RetroGifsController from '@/actions/App/Http/Controllers/Retros/RetroGifsController';
import {
    GifSearchDialog,
    type PickedGif,
} from '@/components/gifs/gif-search-dialog';
import type { GameGifSearchResult } from '@/lib/games/types';
import { retroRequest } from '@/lib/retro/api';
import { useBoard } from './board-context';
import { dragIsolation } from './dnd';

export type { PickedGif };

type Props = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onPick: (gif: PickedGif) => void;
};

export function GifPicker({ open, onOpenChange, onPick }: Props) {
    const { board } = useBoard();
    const retroId = board.retro.id;

    const search = useCallback(
        (query: string) =>
            retroRequest<{ gifs: GameGifSearchResult[] }>(
                RetroGifsController.index(retroId, { query: { q: query } }),
            ),
        [retroId],
    );

    return (
        <GifSearchDialog
            open={open}
            onOpenChange={onOpenChange}
            onPick={onPick}
            search={search}
            provider={board.retro.gifProvider}
            isolation={dragIsolation}
        />
    );
}
```

- [ ] **Step 3: Write the game picker**

Create `resources/js/components/games/game-gif-picker.tsx`:

```tsx
import { useCallback } from 'react';
import GameGifsController from '@/actions/App/Http/Controllers/Games/GameGifsController';
import {
    GifSearchDialog,
    type PickedGif,
} from '@/components/gifs/gif-search-dialog';
import type { GameGifSearchResult } from '@/lib/games/types';
import { retroRequest } from '@/lib/retro/api';
import { useRoom } from './room-context';

type Props = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onPick: (gif: PickedGif) => void;
    provider: 'giphy' | 'tenor' | null;
};

export function GameGifPicker({ open, onOpenChange, onPick, provider }: Props) {
    const roomId = useRoom().snapshot.room.id;

    const search = useCallback(
        (query: string) =>
            retroRequest<{ gifs: GameGifSearchResult[] }>(
                GameGifsController.index(roomId, { query: { q: query } }),
            ),
        [roomId],
    );

    return (
        <GifSearchDialog
            open={open}
            onOpenChange={onOpenChange}
            onPick={onPick}
            search={search}
            provider={provider}
        />
    );
}
```

- [ ] **Step 4: Check types and lint**

Run: `npm run types:check && npx vp check --fix resources/js/components/gifs resources/js/components/retro/gif-picker.tsx resources/js/components/games/game-gif-picker.tsx && npm run check`
Expected: no new errors (`card-composer.tsx` / `card-editor.tsx` keep importing `GifPicker` and `PickedGif` from `./gif-picker`).

- [ ] **Step 5: Commit**

```bash
git add resources/js/components/gifs resources/js/components/retro/gif-picker.tsx resources/js/components/games/game-gif-picker.tsx
git commit -m "refactor(gifs): share the GIF search dialog between cards and games

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SosW8d2Uj7QxsF1tws5ssS"
```

---

### Task 9: Sprint in one GIF board, results and history

**Files:**
- Create: `resources/js/components/games/{sprint-gif-board,gif-question-banner,gif-answer-stage,gif-voting-stage,gif-tile,gif-round-results}.tsx`
- Modify: ⚑ `resources/js/components/games/game-board.tsx`, ⚑ `resources/js/components/games/round-end-card.tsx`, ⚑ `resources/js/components/games/round-detail.tsx`

**Interfaces:**
- Consumes: `useRoom()` (13a), `GameGifPicker` (Task 8), helpers and types of Task 7, Wayfinder `GameQuestionsController`, `GameAnswersController`, `GameRevealsController`, `GameVotesController`, `GameClosuresController`.
- Produces: `SprintGifBoard({round})` (mounted by `GameBoard` for `round.game === 'gif'`), `GifTile({gif, caption, highlight?, children?})`, `GifRoundResults({answers, points?})` (used by `RoundEndCard` and `RoundDetail`).

- [ ] **Step 1: Write the tile and the results**

Create `resources/js/components/games/gif-tile.tsx`:

```tsx
import type { ReactNode } from 'react';
import type { GameGif } from '@/lib/games/types';
import { cn } from '@/lib/utils';

type Props = {
    gif: GameGif;
    caption: string;
    highlight?: boolean;
    children?: ReactNode;
};

export function GifTile({ gif, caption, highlight = false, children }: Props) {
    return (
        <figure
            className={cn(
                'flex flex-col gap-2 rounded-lg border p-2',
                highlight && 'border-primary ring-1 ring-primary',
            )}
        >
            <img
                src={gif.previewUrl}
                alt=""
                loading="lazy"
                className="aspect-square w-full rounded-md bg-muted object-cover"
            />
            <figcaption className="truncate text-center text-sm">
                {caption}
            </figcaption>
            {children}
        </figure>
    );
}
```

Create `resources/js/components/games/gif-round-results.tsx`:

```tsx
import { Badge } from '@/components/ui/badge';
import { useTrans } from '@/hooks/use-trans';
import type { GameGifRevealed, GamePointsAward } from '@/lib/games/types';
import { GifTile } from './gif-tile';
import { useRoom } from './room-context';

type Props = { answers: GameGifRevealed[]; points?: GamePointsAward[] };

export function GifRoundResults({ answers, points = [] }: Props) {
    const { snapshot } = useRoom();
    const { t } = useTrans();
    const names = new Map(
        snapshot.players.map((player) => [player.id, player.name]),
    );
    const earned = new Map(
        points.map((award) => [award.playerId, award.points]),
    );
    const ranked = [...answers].sort(
        (first, second) => (second.votes ?? 0) - (first.votes ?? 0),
    );

    if (ranked.length === 0) {
        return (
            <p className="text-sm text-muted-foreground">{t('No GIFs yet.')}</p>
        );
    }

    return (
        <ul className="grid w-full grid-cols-2 gap-3 sm:grid-cols-3">
            {ranked.map((answer) => {
                const author =
                    answer.playerId === null
                        ? null
                        : (names.get(answer.playerId) ?? t('Someone'));
                const gained =
                    answer.playerId === null
                        ? 0
                        : (earned.get(answer.playerId) ?? 0);

                return (
                    <li key={answer.id}>
                        <GifTile
                            gif={answer.gif}
                            caption={
                                author === null
                                    ? t('Anonymous GIF')
                                    : t('by :name', { name: author })
                            }
                        >
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-muted-foreground">
                                    {typeof answer.votes === 'number' &&
                                        t('Votes: :count', {
                                            count: answer.votes,
                                        })}
                                </span>
                                {gained > 0 && (
                                    <Badge variant="secondary">+{gained}</Badge>
                                )}
                            </div>
                        </GifTile>
                    </li>
                );
            })}
        </ul>
    );
}
```

- [ ] **Step 2: Write the question banner**

Create `resources/js/components/games/gif-question-banner.tsx`:

```tsx
import { Pencil, Shuffle } from 'lucide-react';
import { useState } from 'react';
import GameQuestionsController from '@/actions/App/Http/Controllers/Games/GameQuestionsController';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useTrans } from '@/hooks/use-trans';
import type { GameRound } from '@/lib/games/types';
import { retroRequest } from '@/lib/retro/api';
import { useRoom } from './room-context';

const MaxQuestionLength = 200;

/** The host can shuffle or rewrite the question until the first answer (spec §4.2). */
export function GifQuestionBanner({ round }: { round: GameRound }) {
    const ctx = useRoom();
    const { t } = useTrans();
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState('');
    const [busy, setBusy] = useState(false);
    const canChange =
        ctx.snapshot.room.isHost &&
        round.revealedAt === null &&
        (round.answers ?? []).length === 0 &&
        !round.myAnswer;

    const save = async (text?: string) => {
        setBusy(true);

        const response = await ctx.run(
            retroRequest<{ question: string }>(
                GameQuestionsController.update({
                    room: ctx.snapshot.room.id,
                    round: round.id,
                }),
                text === undefined ? {} : { text },
            ),
        );

        setBusy(false);

        if (!response) {
            return;
        }

        ctx.dispatch({
            type: 'question.changed',
            roundId: round.id,
            question: response.question,
        });
        setEditing(false);
    };

    return (
        <div className="rounded-lg border bg-muted/40 p-4 text-center">
            {editing ? (
                <form
                    className="flex flex-col gap-2 sm:flex-row"
                    onSubmit={(event) => {
                        event.preventDefault();
                        void save(draft.trim());
                    }}
                >
                    <Input
                        value={draft}
                        maxLength={MaxQuestionLength}
                        aria-label={t('Question')}
                        autoFocus
                        onChange={(event) => setDraft(event.target.value)}
                    />
                    <Button type="submit" disabled={busy || draft.trim() === ''}>
                        {t('Save')}
                    </Button>
                    <Button
                        type="button"
                        variant="ghost"
                        onClick={() => setEditing(false)}
                    >
                        {t('Cancel')}
                    </Button>
                </form>
            ) : (
                <p className="text-lg font-semibold">{round.question}</p>
            )}
            {canChange && !editing && (
                <div className="mt-3 flex justify-center gap-2">
                    <Button
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() => void save()}
                    >
                        <Shuffle className="size-4" />
                        {t('Shuffle question')}
                    </Button>
                    <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                            setDraft(round.question ?? '');
                            setEditing(true);
                        }}
                    >
                        <Pencil className="size-4" />
                        {t('Edit question')}
                    </Button>
                </div>
            )}
        </div>
    );
}
```

- [ ] **Step 3: Write the answering stage**

Create `resources/js/components/games/gif-answer-stage.tsx`:

```tsx
import { Eye, ImageIcon } from 'lucide-react';
import { useState } from 'react';
import GameAnswersController from '@/actions/App/Http/Controllers/Games/GameAnswersController';
import GameRevealsController from '@/actions/App/Http/Controllers/Games/GameRevealsController';
import type { PickedGif } from '@/components/gifs/gif-search-dialog';
import { Button } from '@/components/ui/button';
import { useTrans } from '@/hooks/use-trans';
import { pendingAnswers, withPendingAnswer } from '@/lib/games/gif';
import type { GameMyGifAnswer, GameRound } from '@/lib/games/types';
import { retroRequest } from '@/lib/retro/api';
import { GameGifPicker } from './game-gif-picker';
import { GifTile } from './gif-tile';
import { useRoom } from './room-context';

/** Other players' GIFs are never known before the reveal: only placeholders. */
export function GifAnswerStage({ round }: { round: GameRound }) {
    const ctx = useRoom();
    const { t } = useTrans();
    const [picking, setPicking] = useState(false);
    const [busy, setBusy] = useState(false);
    const { room, me, players } = ctx.snapshot;
    const answered = pendingAnswers(round);
    const others = answered.filter((answer) => answer.playerId !== me.playerId);
    const names = new Map(players.map((player) => [player.id, player.name]));
    const target = { room: room.id, round: round.id };

    const choose = async (gif: PickedGif) => {
        setBusy(true);

        const response = await ctx.run(
            retroRequest<{ myAnswer: GameMyGifAnswer }>(
                GameAnswersController.update(target),
                { gif_id: gif.id },
            ),
        );

        setBusy(false);

        if (!response) {
            return;
        }

        ctx.dispatch({
            type: 'round.patched',
            roundId: round.id,
            patch: {
                myAnswer: response.myAnswer,
                answers: withPendingAnswer(answered, me.playerId, true),
            },
        });
    };

    const remove = async () => {
        setBusy(true);

        const result = await ctx.run(
            retroRequest(GameAnswersController.destroy(target)),
        );

        setBusy(false);

        if (result === undefined) {
            return;
        }

        ctx.dispatch({
            type: 'round.patched',
            roundId: round.id,
            patch: {
                myAnswer: null,
                answers: withPendingAnswer(answered, me.playerId, false),
            },
        });
    };

    const reveal = async () => {
        setBusy(true);

        const revealed = await ctx.run(
            retroRequest<GameRound>(GameRevealsController.store(target)),
        );

        setBusy(false);

        if (revealed) {
            ctx.dispatch({
                type: 'round.patched',
                roundId: round.id,
                patch: revealed,
            });
        }
    };

    return (
        <section className="flex flex-col items-center gap-4">
            <p className="text-sm text-muted-foreground">
                {t('Pick a GIF that answers the question.')}
            </p>
            {round.myAnswer && (
                <div className="w-48">
                    <GifTile gif={round.myAnswer.gif} caption={t('Your GIF')} />
                </div>
            )}
            <div className="flex gap-2">
                <Button disabled={busy} onClick={() => setPicking(true)}>
                    {round.myAnswer ? t('Change GIF') : t('Choose a GIF')}
                </Button>
                {round.myAnswer && (
                    <Button
                        variant="outline"
                        disabled={busy}
                        onClick={() => void remove()}
                    >
                        {t('Remove GIF')}
                    </Button>
                )}
            </div>
            {others.length > 0 ? (
                <ul
                    aria-label={t('Answers')}
                    className="grid w-full grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4"
                >
                    {others.map((answer) => (
                        <li
                            key={answer.playerId}
                            className="flex aspect-square flex-col items-center justify-center gap-2 rounded-lg border border-dashed p-2 text-center text-sm text-muted-foreground"
                        >
                            <ImageIcon className="size-6" aria-hidden />
                            {t(':name answered', {
                                name: names.get(answer.playerId) ?? t('Someone'),
                            })}
                        </li>
                    ))}
                </ul>
            ) : (
                !round.myAnswer && (
                    <p className="text-sm text-muted-foreground">
                        {t('No GIFs yet.')}
                    </p>
                )
            )}
            {room.isHost && (
                <Button
                    variant="secondary"
                    disabled={busy}
                    onClick={() => void reveal()}
                >
                    <Eye className="size-4" />
                    {t('Reveal the GIFs')}
                </Button>
            )}
            <GameGifPicker
                open={picking}
                onOpenChange={setPicking}
                onPick={(gif) => void choose(gif)}
                provider={round.gifProvider ?? null}
            />
        </section>
    );
}
```

- [ ] **Step 4: Write the voting stage and the board**

Create `resources/js/components/games/gif-voting-stage.tsx`:

```tsx
import { Flag, Heart } from 'lucide-react';
import { useState } from 'react';
import GameClosuresController from '@/actions/App/Http/Controllers/Games/GameClosuresController';
import GameVotesController from '@/actions/App/Http/Controllers/Games/GameVotesController';
import { Button } from '@/components/ui/button';
import { useTrans } from '@/hooks/use-trans';
import { revealedAnswers, withVoter } from '@/lib/games/gif';
import type { GameRound, GameRoundEnded } from '@/lib/games/types';
import { retroRequest } from '@/lib/retro/api';
import { cn } from '@/lib/utils';
import { GifTile } from './gif-tile';
import { useRoom } from './room-context';

/** Counts stay hidden until the host finishes the round (spec §4.2). */
export function GifVotingStage({ round }: { round: GameRound }) {
    const ctx = useRoom();
    const { t } = useTrans();
    const [busy, setBusy] = useState(false);
    const { room, me, players } = ctx.snapshot;
    const answers = revealedAnswers(round);
    const voters = round.voters ?? [];
    const names = new Map(players.map((player) => [player.id, player.name]));
    const total = Math.max(ctx.online.length, voters.length);
    const target = { room: room.id, round: round.id };

    const vote = async (answerId: string) => {
        const retracting = round.myVote === answerId;

        setBusy(true);

        const result = await ctx.run(
            retroRequest(
                retracting
                    ? GameVotesController.destroy(target)
                    : GameVotesController.update(target),
                retracting ? undefined : { answer_id: answerId },
            ),
        );

        setBusy(false);

        if (result === undefined) {
            return;
        }

        ctx.dispatch({
            type: 'round.patched',
            roundId: round.id,
            patch: {
                myVote: retracting ? null : answerId,
                voters: withVoter(voters, me.playerId, !retracting),
            },
        });
    };

    const finish = async () => {
        setBusy(true);

        const response = await ctx.run(
            retroRequest<{ ended: GameRoundEnded }>(
                GameClosuresController.store(target),
            ),
        );

        setBusy(false);

        if (!response) {
            return;
        }

        ctx.dispatch({ type: 'round.ended', ended: response.ended });
        void ctx.refetch();
    };

    return (
        <section className="flex flex-col items-center gap-4">
            <p className="text-sm text-muted-foreground">
                {t('Vote for your favourite GIF.')}
            </p>
            <p aria-live="polite" className="text-sm font-medium">
                {t(':count of :total voted', {
                    count: voters.length,
                    total,
                })}
            </p>
            <ul className="grid w-full grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                {answers.map((answer) => {
                    const isMine = answer.id === round.myAnswer?.id;
                    const isChosen = answer.id === round.myVote;
                    const author =
                        answer.playerId === null
                            ? null
                            : (names.get(answer.playerId) ?? t('Someone'));
                    const caption = isMine
                        ? t('Your GIF')
                        : author === null
                          ? t('Anonymous GIF')
                          : t('by :name', { name: author });

                    return (
                        <li key={answer.id}>
                            <GifTile
                                gif={answer.gif}
                                caption={caption}
                                highlight={isChosen}
                            >
                                {!isMine && (
                                    <Button
                                        size="sm"
                                        variant={isChosen ? 'default' : 'outline'}
                                        aria-pressed={isChosen}
                                        disabled={busy}
                                        onClick={() => void vote(answer.id)}
                                    >
                                        <Heart
                                            className={cn(
                                                'size-4',
                                                isChosen && 'fill-current',
                                            )}
                                        />
                                        {isChosen
                                            ? t('Your favourite')
                                            : t('Favourite')}
                                    </Button>
                                )}
                            </GifTile>
                        </li>
                    );
                })}
            </ul>
            {answers.length === 0 && (
                <p className="text-sm text-muted-foreground">{t('No GIFs yet.')}</p>
            )}
            {room.isHost && (
                <Button disabled={busy} onClick={() => void finish()}>
                    <Flag className="size-4" />
                    {t('Finish round')}
                </Button>
            )}
        </section>
    );
}
```

Create `resources/js/components/games/sprint-gif-board.tsx`:

```tsx
import type { GameRound } from '@/lib/games/types';
import { GifAnswerStage } from './gif-answer-stage';
import { GifQuestionBanner } from './gif-question-banner';
import { GifVotingStage } from './gif-voting-stage';

export function SprintGifBoard({ round }: { round: GameRound }) {
    return (
        <div className="flex w-full max-w-3xl flex-col gap-6">
            <GifQuestionBanner round={round} />
            {round.revealedAt === null ? (
                <GifAnswerStage round={round} />
            ) : (
                <GifVotingStage round={round} />
            )}
        </div>
    );
}
```

- [ ] **Step 5: Mount the board, the results and the history detail**

In `resources/js/components/games/game-board.tsx` add `import { SprintGifBoard } from './sprint-gif-board';` and, inside the `switch`, before `default:`:

```tsx
        case 'gif':
            return <SprintGifBoard round={round} />;
```

In `resources/js/components/games/round-end-card.tsx` add `import { GifRoundResults } from './gif-round-results';`; after the `const winner = …;` declaration add:

```tsx
    const question = lastEnded?.question ?? lastRound?.question ?? null;
```

change the class of the ended card's outer `<div>` from `max-w-md` to `max-w-2xl`, and insert, right after the `{word && (…)}` block (and before any block Plan 13b added after it):

```tsx
            {question && (
                <p className="text-lg font-medium">{question}</p>
            )}
            {lastEnded?.answers && (
                <GifRoundResults
                    answers={lastEnded.answers}
                    points={lastEnded.points}
                />
            )}
```

In `resources/js/components/games/round-detail.tsx` add `import { GifRoundResults } from './gif-round-results';` and, inside `GameDetail`'s `switch`, before `default:`:

```tsx
        case 'gif':
            return (
                <div className="space-y-3">
                    <p className="font-medium">{detail.question}</p>
                    <GifRoundResults answers={detail.answers ?? []} />
                </div>
            );
```

- [ ] **Step 6: Check types and lint**

Run: `npm run types:check && npx vp check --fix resources/js/components/games && npm run check`
Expected: no new errors.

- [ ] **Step 7: Translations**

| Key (en) | fr | es | de |
|---|---|---|---|
| Shuffle question | Changer de question | Cambiar pregunta | Andere Frage |
| Edit question | Modifier la question | Editar pregunta | Frage bearbeiten |
| Pick a GIF that answers the question. | Choisissez un GIF qui répond à la question. | Elige un GIF que responda a la pregunta. | Wähle ein GIF, das die Frage beantwortet. |
| Your GIF | Votre GIF | Tu GIF | Dein GIF |
| Change GIF | Changer de GIF | Cambiar GIF | GIF ändern |
| Remove GIF | Retirer le GIF | Quitar GIF | GIF entfernen |
| Answers | Réponses | Respuestas | Antworten |
| :name answered | :name a répondu | :name respondió | :name hat geantwortet |
| No GIFs yet. | Pas encore de GIF. | Aún no hay GIF. | Noch keine GIFs. |
| Reveal the GIFs | Révéler les GIF | Revelar los GIF | GIFs aufdecken |
| Vote for your favourite GIF. | Votez pour votre GIF préféré. | Vota por tu GIF favorito. | Stimme für dein Lieblings-GIF. |
| :count of :total voted | :count sur :total ont voté | Han votado :count de :total | :count von :total haben abgestimmt |
| Anonymous GIF | GIF anonyme | GIF anónimo | Anonymes GIF |
| by :name | par :name | de :name | von :name |
| Favourite | Favori | Favorito | Favorit |
| Your favourite | Votre favori | Tu favorito | Dein Favorit |
| Finish round | Terminer la manche | Terminar la ronda | Runde beenden |
| Votes: :count | Votes : :count | Votos: :count | Stimmen: :count |

(`Question`, `Save`, `Cancel`, `Choose a GIF`, `Someone`, `Search GIFs…`, `Choose this GIF`, `No GIFs found.`, `Powered by :provider` already exist.)

Run: `vendor/bin/sail artisan test --compact tests/Feature/TranslationKeysTest.php` — Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add resources/js/components/games lang
git commit -m "feat(games): play Sprint in one GIF in the room

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SosW8d2Uj7QxsF1tws5ssS"
```

---

### Task 10: Verification (controller-driven)

**Files:** none new (fixes only, each with its own commit).

- [ ] **Step 1: Run the affected suites**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Games tests/Feature/Retros/GifsTest.php tests/Feature/TranslationKeysTest.php tests/Feature/UuidPrimaryKeysTest.php`
Expected: PASS.

- [ ] **Step 2: Static checks**

Run: `vendor/bin/sail bin pint --dirty --format agent && vendor/bin/sail bin phpstan analyse --no-progress && vendor/bin/sail artisan wayfinder:generate --with-form && npm run types:check && npm run check && npm run build`
Expected: phpstan 0 errors; type check, lint (known pre-existing failures only) and build pass.

- [ ] **Step 3: Acceptance check against the spec**

Walk through spec §4.2, §4.6 (GIF row), §4.7 (anonymous bullet), §8 (GIF bullets) and §12 "Sprint in one GIF" and tick each rule against a test above: availability (Task 2), question shuffle/custom then 409 (Task 3), proxy search limits (Task 3), one answer per player replaceable/removable until reveal (Task 4), `servable` (Task 1), reveal by host or timer opening voting (Tasks 2, 5), votes one per player / replace / retract / self 403 / before-reveal and after-close 409 / non-answerers and guests (Task 5), no count or voter link before close (Task 6), close by host, by timer during voting and by next round (Tasks 2, 5), scoring rows and anonymous zero rows (Task 2), abandoned during voting scores nothing (Task 2). Any gap → add the test to the owning task's file and fix.

- [ ] **Step 4: Manual two-browser walkthrough**

With `SKRUM_GIF_PROVIDER` and `SKRUM_GIF_API_KEY` set, `composer run dev` running and the queue worker up, in two browsers (a member and a guest of a `link` room):

1. The host switches the room to "Sprint in one GIF" and starts: both see the question; the host shuffles and edits it; after the guest picks a GIF, the host's shuffle/edit buttons disappear.
2. Each player searches (attribution "Powered by GIPHY"/"Tenor" visible), picks, changes and removes a GIF; the other browser sees only "X answered" placeholders, never the GIF (check the network tab: no other player's GIF id before the reveal).
3. The host sets a 1-minute timer and waits: at zero the GIFs appear in both browsers (reveal, not close); the host sets a new timer.
4. Each player votes for the other's GIF (no "Favourite" button on their own tile), changes and retracts the vote; "n of m voted" updates live; no counts are visible.
5. The timer (or "Finish round") closes the round: vote counts and "+2" per vote appear on the end card in both browsers; the history drawer shows the round with the same counts.
6. Start the next round while a new round is in its voting window: the voting round closes with its points and the next question appears.

- [ ] **Step 5: Report**

Report the test counts, phpstan/type-check/lint results, walkthrough outcome and any deviation from this plan to the controller. Do not merge; Plan 13d continues on this branch.
