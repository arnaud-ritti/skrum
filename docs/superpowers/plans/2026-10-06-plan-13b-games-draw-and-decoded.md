# Plan 13b — Draw & Guess and Decoded Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Two more games in every game room: **Draw & Guess** (a drawer draws a secret word on a shared canvas, the others guess in a chat) and **Decoded** (a clue giver describes the word with up to five emoji). Both run on Plan 13a's shared engine. The leader alone sees the word. Near misses are flagged "Very close!" to the guesser only. A correct guess ends the turn without its text ever leaving the server. Strokes appear live on every screen and are rebuilt from committed operations for late joiners and history.

**Architecture:** One abstract `WordGuessRules` (a `GameRules` of Plan 13a) carries everything the two games share: leader, word draw, mask, hints, guess chat presentation, the §4.6 points. `DrawAndGuessRules` and `DecodedRules` only add their pool and their `drawing` / `clue` fields. Mutations are single-purpose actions (`MakeGameGuess`, `RevealGameHint`, `AddDrawingOp`, `UndoDrawingOp`, `ClearDrawing`, `SetGameClue`). Each one locks through `LockGameRound`, guards through `GameGuard` and broadcasts one new `GameBroadcastEvent` subclass. Pure checks live in `GuessMatch` (normalised equality plus Levenshtein near miss), `DrawingOp` (operation parsing and caps) and the `ClueEmoji` rule. Live strokes are `game-stroke` whispers on whatever presence channel the room uses: `presence-game.{roomId}` here, and the retro channel in 13d's icebreaker. They go through `whisperTransport` and are accepted only from the current drawer's Reverb-stamped presence id and for the active round's id prefix. On pointer-up the drawer commits the stroke over HTTP. Every client rasterises committed operations with its own integer rasteriser on an 800 × 600 palette-index grid (disk stamping plus scanline flood fill). No browser anti-aliasing is involved, so every client computes the same fill.

**Tech Stack:** Laravel 13 (PHP 8.4), PostgreSQL (jsonb), Pest, Reverb client events, React 19, Inertia v3, `@laravel/echo-react`, Wayfinder, Tailwind 4, lucide, Radix select/dropdown/dialog, `frimousse` (spec 1's emoji picker), Canvas 2D API. Everything is already installed.

**Spec:** `docs/superpowers/specs/2026-09-29-games-design.md`:
- §4 common rules: guess matching, mask, rate limits for guesses.
- §4.1 Draw & Guess.
- §4.4 Decoded.
- §4.6 score rows for Draw & Guess and Decoded.
- §7: routes `secret`, `hints`, `drawing-ops`, `drawing-ops/last`, `drawing`, `clue`, `guesses`; the events `game.hint.revealed`, `game.drawing.*`, `game.clue.changed`, `game.guess.made`; the client event `game-stroke`; the snapshot round fields `word`, `guesses`, `drawing`, `clue`.
- §8 secrecy for these games.
- §9 Draw & Guess and Decoded UI, and the history replay.
- §10.
- §12 test groups "Draw & Guess", "Decoded", and the Draw & Guess / Decoded parts of "Secrecy" and "Scores".
- §13 criteria 3 (these two games), 4 (word and guess texts), 5, 11 (this plan's strings).

It builds on `docs/superpowers/plans/2026-10-06-plan-13a-games-foundation.md`; read its Global Constraints and "Contract for Plans 13b–13d" first. Plan 13c (Sprint in one GIF) and Plan 13d (icebreaker, leaderboards, `results.games`, invites) follow.

## Global Constraints

- Work on branch `feat/plan-13-games`, continuing after Plan 13a (all of its tasks committed). Plans 13c and 13d continue on the same branch after this one.
- Commands through Sail: `vendor/bin/sail artisan …`, `vendor/bin/sail bin pint --dirty --format agent`, `vendor/bin/sail bin phpstan analyse --no-progress` (level 7, 0 errors). npm on the host. Shells need `export PATH="$HOME/.orbstack/bin:/opt/homebrew/bin:$PATH"`.
- Tests run on PostgreSQL (the Sail `testing` database). This plan adds **no migration**: every column it writes (`game_rounds.leader_player_id, word, revealed_positions, clue, drawing, drawing_points, winner_player_id`, `game_guesses.*`) was created by 13a Task 1.
- No new Composer or npm dependency. Drawing uses the Canvas 2D API and a pure TypeScript rasteriser.
- **Request fields are snake_case** (`leader_player_id`, `text`, `client_op_id`, `op`, `clue`); response and broadcast payloads are camelCase exactly as spec §7. JSON responses are bare payloads.
- Every mutation follows 13a's order: the player is resolved by `ResolveGamePlayer`, which also applies the lazy timer expiry. Then, inside `DB::transaction`, `LockGameRound::handle($room, $round)` runs, followed by `GameGuard::mutable` → the role guard (403) → `GameGuard::activeRound` (409) → `GameGuard::roundGame` and input checks (422) → persist → broadcast with `->sendToOthers()`. Rate limits run first, in the controller, through `GameRateLimit::hit()`.
- **The secret word leaves the server only** through `WordGuessRules::presentActive()` for the round's leader, the `secret` endpoint for the leader, and 13a's ended-round paths (`EndGameRound`, `PresentGameRoundHistory`, round detail). **Correct guess texts are never serialized**: neither the chat presenter nor any broadcast nor the round detail reads a guess with `is_correct = true`. **The near-miss flag** (`veryClose`) appears only in the guesser's own response and snapshot. Tests use 13a's `gamePayloadExposesWord()`.
- Guests never receive team or workspace data (unchanged from 13a): they play, guess, draw and give clues like members.
- Every user-facing string goes through `t()` / `__()`, with real translations in `lang/{en,fr,es,de}.json` (German "du", French "vous", Spanish "tú"). Rows are appended at the end of each file, keeping every existing value. Each task lists its own rows; add only keys that are missing at execution time. `tests/Feature/TranslationKeysTest.php` stays green.
- Wayfinder: run `vendor/bin/sail artisan wayfinder:generate --with-form` after every route change. `resources/js/actions` and `resources/js/routes` are gitignored and never staged. The frontend imports generated controllers (`@/actions/App/Http/Controllers/Games/…`).
- Frontend checks: `npm run types:check && npm run check`. Known pre-existing failures are only in `.devcontainer/devcontainer.json` and `docs/superpowers/*.md`. Format only touched files, with `npx vp check --fix <paths>`. There is no frontend test runner (spec §1): frontend tasks are verified by the type check, lint and the walkthrough.
- React: function components, `type Props`, no default exports except pages, Tailwind, lucide icons, `useRoom()` for room state, `retroRequest()` from `@/lib/retro/api` for JSON calls, `ctx.run()` around every mutation so failures toast and refetch.
- PHP: constructor promotion, typed everything, array-shape docblocks on presenter return values, early returns, curly braces, no comments restating code, class constants in PascalCase. Test helper functions are global in Pest, and every new helper name below is unique in `tests/`.
- Never run two implementer subagents concurrently (shared git index).
- Commit messages: Conventional Commits, ending with exactly:
  `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`
  `Claude-Session: https://claude.ai/code/session_01SosW8d2Uj7QxsF1tws5ssS`

## Spec amendments made with this plan

Plan writing found gaps in spec §4.1, §4.4 and §7. These are decisions of this plan, to be copied into the spec before 13b starts:

- `POST /rounds` for Draw & Guess and Decoded **requires** `leaderPlayerId` (422 "Choose who leads this round."). The server does not track who is online, so the preselection of "the next online player" stays a UI rule.
- The active round payload of both games is `{mask, maxHints, guesses, word?}` plus `drawing` (Draw & Guess) or `clue` (Decoded). `maxHints` = `floor(letters / 2)`, where separators are not letters. The round detail of an ended round is `{mask (full), drawing | clue}`, with no guesses of any kind.
- A hint reveals **one position** (not every occurrence of that letter) and never a separator.
- The guess response is `{result, guessId, ended}`, where `ended` is the `RoundEnded` payload on a correct guess (the guesser is skipped by `toOthers()`, as in 13a).
- `GET rounds/{round}/secret` answers 403 to anyone but the round's leader. For the leader, it answers 409 "This round is over." once the round ended (the word is then in `game.round.ended`).
- Drawing operations:
  - The request body is `{client_op_id, op}`, where `client_op_id` matches `[A-Za-z0-9_-]{1,64}`.
  - The colour list is the six colours plus `white`, which is what the eraser strokes and fills with.
  - Coordinates are integers in 0–1000 × 0–750 inclusive.
  - `POST drawing-ops` answers 201 `{roundId, op, clientOpId}`.
  - Undo on an empty drawing is a 204 no-op without a broadcast.
  - Undo and clear share the drawing rate limit (20 per second).
- Stroke whispers:
  - A stroke longer than 100 points travels as several `game-stroke` messages with the same `id`, each starting with the previous message's last point.
  - The `id` starts with the first 8 characters of the round id, so receivers drop strokes of any other round.
  - The drawer commits a stroke automatically when it reaches 1 000 points and continues with a new one.
- The game snapshot carries `emojiData: {baseUrl, locale}` (the same values as the retro snapshot), so the Decoded clue editor can open the full emoji list outside a retro.
- The room shows a "Pass" button (Draw & Guess, Decoded) or a "Give up" button (Hangman) to the round's leader and the host. 13a built the endpoint but no control.

## Review Focus

1. **A guess lands in the same instant as a pass, the timer expiry or another correct guess** → the late request gets 409 "This round is over.". The round ends once, and nobody scores twice or wins twice. Pinned in Task 3 ("refuses a guess after the round ended").
2. **Guesses typed differently from the dictionary** (`" RoCkÉt "`, `Chat-Bot`, `todo   list` for `to-do list`, `LETE` for `l'été`) → correct. A guess of only spaces → 422, and nothing is stored. Pinned in Task 1 (`GuessMatchTest`) and Task 3 ("accepts a correct guess whatever its case, accents and spacing", "validates the guess text").
3. **The drawing budget at its exact edges**: the 500th operation and a stroke that brings the total to exactly 20 000 points are accepted, while one more is refused with "The drawing is full. Clear it to keep drawing.". Undo frees the budget. Pinned in Task 4 ("accepts the last operation and point the budget allows", "refuses operations beyond the budget", "undoes the last operation and frees its points").
4. **Hints on words with separators or few letters** (`to-do`, `l'été`, a 3-letter word) → a hint never reveals a space, hyphen or apostrophe, and the limit counts letters only (a 3-letter word gets one hint). Pinned in Task 3 ("never reveals a separator and counts letters only").
5. **Clue edits by the wrong person or at the wrong time**: a non-leader gets 403, an edit on an ended round gets 409, and a Draw & Guess round gets 422. Pinned in Task 5 ("keeps the clue to the clue giver of an active Decoded round").

## File map

Execution order on shared files: **13b → 13c → 13d**. 13c and 13d append to the same registry list, event list, reducer and board switch, so they must start from this plan's versions.

| Area | Files |
|---|---|
| Pure checks | `app/Enums/GuessResult.php`; `app/Support/Games/{GuessMatch,DrawingOp}.php`; `app/Rules/ClueEmoji.php` |
| Rules & events | `app/Support/Games/{WordGuessRules,DrawAndGuessRules,DecodedRules}.php`; `app/Events/Games/{GameHintRevealed,GameGuessMade,GameDrawingOpAdded,GameDrawingUndone,GameDrawingCleared,GameClueChanged}.php`; **shared:** `app/Actions/Games/GameGuard.php` (adds `leader`, `notLeader`), `app/Providers/AppServiceProvider.php` (registry list — 13c appends after this plan), `app/Actions/Games/BuildGameSnapshot.php` (adds `emojiData` — 13d adds its keys after this plan) |
| Actions & controllers | `app/Actions/Games/{MakeGameGuess,RevealGameHint,AddDrawingOp,UndoDrawingOp,ClearDrawing,SetGameClue}.php`; `app/Http/Controllers/Games/{GameRoundSecretsController,GameRoundHintsController,GameGuessesController,GameDrawingOpsController,GameDrawingsController,GameRoundCluesController}.php`; **shared:** `routes/web.php` |
| Frontend state | **shared:** `resources/js/lib/games/{types,room-reducer}.ts`, `resources/js/hooks/{use-game-channel,use-game-room}.ts` (13c appends its events and cases after this plan) |
| Drawing | `resources/js/lib/games/{drawing,stroke-whisper,rotation,hints}.ts`; `resources/js/hooks/{use-stroke-whispers,use-secret-word}.ts` |
| Frontend UI | `resources/js/components/games/{drawing-canvas,drawing-toolbar,draw-board,guess-chat,leader-word,hint-button,pass-round-button,clue-row,clue-editor,decoded-board,leader-picker}.tsx`; **shared:** `resources/js/components/games/{game-board,start-round-controls,round-detail}.tsx` (13c adds its cases after this plan), `resources/js/components/retro/{emoji-picker,board-context}.tsx` |
| Tests | `tests/Pest.php` (`wordGuessTable`); `tests/Unit/Games/GuessMatchTest.php`; `tests/Feature/Games/{DrawingOpTest,ClueEmojiTest,WordGuessRulesTest,WordGuessScoringTest,WordGuessPlayTest,DrawingTest,DecodedClueTest,WordGuessRedactionTest}.php` |
| Translations | `lang/{en,fr,es,de}.json` (rows inside each task) |

## Contract for Plans 13c and 13d

- `App\Support\Games\WordGuessRules` (abstract `GameRules`):
  - `public const GuessesShown = 50`
  - `static maxHints(string $word): int`
  - `static guesserPoints(int $hints): int`
  - Subclasses: `DrawAndGuessRules` (`kind() = DrawAndGuess`, drawable pool, `drawing`) and `DecodedRules` (`kind() = Decoded`, full pool, `clue`).
  - The registry binding in `AppServiceProvider::register()` is `new GameRulesRegistry([HangmanRules, DrawAndGuessRules, DecodedRules])`; 13c appends `SprintGifRules`.
- `GameGuard::leader(GameRound, GamePlayer)`: 403 "Only the player leading this round can do this.". `GameGuard::notLeader(GameRound, GamePlayer)`: 403 "You are leading this round, so you cannot guess.".
- `DrawingOp`:
  - Constants `Colors`, `Sizes`, `Width = 1000`, `Height = 750`, `MaxStrokePoints = 1000`, `MaxOps = 500`, `MaxPoints = 20000`.
  - `static parse(mixed $op): array` (422 on anything invalid).
  - `static pointCount(array $op): int`.
- `GuessMatch::check(string $word, string $guess): GuessResult`, with `App\Enums\GuessResult` = `Wrong`, `Near`, `Correct`.
- Events, all on 13a's base: `GameHintRevealed(GameRoom, string $roundId, array $mask)`, `GameGuessMade(GameRoom, array $payload)`, `GameDrawingOpAdded(GameRoom, string $roundId, array $op, string $clientOpId)`, `GameDrawingUndone(GameRoom, string $roundId)`, `GameDrawingCleared(GameRoom, string $roundId)`, `GameClueChanged(GameRoom, string $roundId, array $clue)`.
- Routes: `games.rounds.secret.show`, `games.rounds.hints.store`, `games.rounds.guesses.store`, `games.rounds.drawing-ops.store`, `games.rounds.drawing-ops.last.destroy`, `games.rounds.drawing.destroy`, `games.rounds.clue.update`.
- Snapshot: `emojiData: {baseUrl, locale}`, added in `BuildGameSnapshot::handle()` after `links`.
- Frontend:
  - Types: `DrawingColor`, `DrawingSize`, `DrawingPoint`, `DrawingOp`, `GameGuessEntry`, `GameGuessResponse`, `GameHintResponse`, `GameDrawingOpResponse`, `GameClueResponse`.
  - `GameRound` gains `word?`, `maxHints?`, `guesses?`, `drawing?`, `clue?` and the client-only `committedOpIds?`.
  - `GameRoundDetail` gains `drawing?`, `clue?`. `GameSnapshot` gains `emojiData`.
  - Reducer actions `guess.added`, `drawing.added`, `drawing.undone`, `drawing.cleared`.
  - `GameEvents` gains the six event names.
  - `useStrokeWhispers(presence, accept, onStroke)` takes any `WhisperChannel`: 13d passes the retro presence channel.
  - Components: `DrawingCanvas({ops, previews?, input?, label})` (13d's "Games we played" replay reuses it read-only), `DrawBoard`, `DecodedBoard`, `GuessChat`, `ClueRow`, `PassRoundButton`, `LeaderPicker`.
  - `EmojiPicker` accepts an `emojiData` prop and works outside a retro board.

---
### Task 1: Pure checks — guess matching, drawing operations and clue emoji

**Files:**
- Create: `app/Enums/GuessResult.php`, `app/Support/Games/GuessMatch.php`, `app/Support/Games/DrawingOp.php`, `app/Rules/ClueEmoji.php`
- Test: create `tests/Unit/Games/GuessMatchTest.php`, `tests/Feature/Games/DrawingOpTest.php`, `tests/Feature/Games/ClueEmojiTest.php`

**Interfaces:**
- Consumes: 13a `GameWord::normalize()`; `App\Rules\SingleEmoji`.
- Produces:
  - `App\Enums\GuessResult` (`Wrong = 'wrong'`, `Near = 'near'`, `Correct = 'correct'`).
  - `GuessMatch::check(string $word, string $guess): GuessResult`.
  - `DrawingOp`:
    - Constants: `Colors = ['black','red','orange','green','blue','purple','white']`, `Sizes = [4, 10, 24]`, `Width = 1000`, `Height = 750`, `MaxStrokePoints = 1000`, `MaxOps = 500`, `MaxPoints = 20000`.
    - `parse(mixed $op): array`: returns a normalised `{type: 'stroke', color, size, points}` or `{type: 'fill', color, x, y}`, and throws `ValidationException` on key `op` with "This drawing operation is not valid.".
    - `pointCount(array $op): int`.
  - `App\Rules\ClueEmoji`: one emoji that passes `SingleEmoji`, with no keycap, regional indicator or letter-like symbol. Failure message: "Use emoji only, without letters or digits.".

- [ ] **Step 1: Write the failing tests**

Create `tests/Unit/Games/GuessMatchTest.php`:

```php
<?php

use App\Enums\GuessResult;
use App\Support\Games\GuessMatch;

it('matches guesses whatever their case, accents, hyphens and spacing', function (string $word, string $guess) {
    expect(GuessMatch::check($word, $guess))->toBe(GuessResult::Correct);
})->with([
    ['chatbot', 'ChatBot'],
    ['chatbot', '  chatbôt '],
    ['chat-bot', 'chatbot'],
    ['to-do list', 'todo   list'],
    ["l'été", 'LETE'],
    ['Éléphant', 'elephant'],
]);

it('flags a guess one letter away from a short word as very close', function (string $guess, GuessResult $result) {
    expect(GuessMatch::check('kite', $guess))->toBe($result);
})->with([
    ['kit', GuessResult::Near],
    ['bite', GuessResult::Near],
    ['kites', GuessResult::Near],
    ['ki', GuessResult::Wrong],
    ['bike', GuessResult::Wrong],
]);

it('flags a guess one or two letters away from a longer word as very close', function (string $guess, GuessResult $result) {
    expect(GuessMatch::check('sprint', $guess))->toBe($result);
})->with([
    ['print', GuessResult::Near],
    ['sprnt', GuessResult::Near],
    ['spirnt', GuessResult::Near],
    ['spr', GuessResult::Wrong],
    ['planning', GuessResult::Wrong],
]);

it('treats a guess without letters as wrong', function () {
    expect(GuessMatch::check('kite', "--'"))->toBe(GuessResult::Wrong);
});
```

Create `tests/Feature/Games/DrawingOpTest.php`:

```php
<?php

use App\Support\Games\DrawingOp;
use Illuminate\Validation\ValidationException;

it('keeps a valid stroke and counts its points', function () {
    $op = DrawingOp::parse([
        'type' => 'stroke',
        'color' => 'red',
        'size' => 10,
        'points' => [[0, 0], [1000, 750], [500, 375]],
        'extra' => 'dropped',
    ]);

    expect($op)->toBe(['type' => 'stroke', 'color' => 'red', 'size' => 10, 'points' => [[0, 0], [1000, 750], [500, 375]]])
        ->and(DrawingOp::pointCount($op))->toBe(3);
});

it('keeps a valid fill that counts no point', function () {
    $op = DrawingOp::parse(['type' => 'fill', 'color' => 'white', 'x' => 12, 'y' => 700]);

    expect($op)->toBe(['type' => 'fill', 'color' => 'white', 'x' => 12, 'y' => 700])
        ->and(DrawingOp::pointCount($op))->toBe(0);
});

it('accepts a stroke of exactly the maximum points', function () {
    $points = array_fill(0, DrawingOp::MaxStrokePoints, [10, 10]);

    expect(DrawingOp::pointCount(DrawingOp::parse(['type' => 'stroke', 'color' => 'black', 'size' => 4, 'points' => $points])))
        ->toBe(DrawingOp::MaxStrokePoints);
});

it('refuses invalid operations', function (mixed $op) {
    DrawingOp::parse($op);
})->throws(ValidationException::class)->with([
    'not an array' => ['stroke'],
    'unknown type' => [['type' => 'circle', 'color' => 'red', 'x' => 1, 'y' => 1]],
    'unknown colour' => [['type' => 'stroke', 'color' => 'pink', 'size' => 4, 'points' => [[1, 1]]]],
    'unknown size' => [['type' => 'stroke', 'color' => 'red', 'size' => 5, 'points' => [[1, 1]]]],
    'size as text' => [['type' => 'stroke', 'color' => 'red', 'size' => '4', 'points' => [[1, 1]]]],
    'no points' => [['type' => 'stroke', 'color' => 'red', 'size' => 4, 'points' => []]],
    'too many points' => [['type' => 'stroke', 'color' => 'red', 'size' => 4, 'points' => array_fill(0, 1001, [1, 1])]],
    'x beyond the canvas' => [['type' => 'stroke', 'color' => 'red', 'size' => 4, 'points' => [[1001, 1]]]],
    'y beyond the canvas' => [['type' => 'stroke', 'color' => 'red', 'size' => 4, 'points' => [[1, 751]]]],
    'negative coordinate' => [['type' => 'stroke', 'color' => 'red', 'size' => 4, 'points' => [[-1, 1]]]],
    'decimal coordinate' => [['type' => 'stroke', 'color' => 'red', 'size' => 4, 'points' => [[1.5, 1]]]],
    'three coordinates' => [['type' => 'stroke', 'color' => 'red', 'size' => 4, 'points' => [[1, 1, 1]]]],
    'keyed point' => [['type' => 'stroke', 'color' => 'red', 'size' => 4, 'points' => [['x' => 1, 'y' => 1]]]],
    'fill outside' => [['type' => 'fill', 'color' => 'red', 'x' => 1, 'y' => 800]],
    'fill without y' => [['type' => 'fill', 'color' => 'red', 'x' => 1]],
]);

it('names the drawing operation in the error', function () {
    try {
        DrawingOp::parse(['type' => 'fill', 'color' => 'teal', 'x' => 1, 'y' => 1]);
    } catch (ValidationException $exception) {
        expect($exception->errors())->toBe(['op' => [__('This drawing operation is not valid.')]]);

        return;
    }

    $this->fail('The operation should have been refused.');
});
```

Create `tests/Feature/Games/ClueEmojiTest.php`:

```php
<?php

use App\Rules\ClueEmoji;
use Illuminate\Support\Facades\Validator;

function clueEmojiPasses(mixed $value): bool
{
    return Validator::make(['emoji' => $value], ['emoji' => [new ClueEmoji]])->passes();
}

it('accepts pictures', function (string $emoji) {
    expect(clueEmojiPasses($emoji))->toBeTrue();
})->with(['🚀', '🐛', '🔥', '👨‍💻', '👍🏽', '❤️', '🏳️‍🌈', '🔣']);

it('refuses letters, digits and letter-like emoji', function (mixed $value) {
    expect(clueEmojiPasses($value))->toBeFalse();
})->with([
    'keycap one' => '1️⃣',
    'keycap hash' => '#️⃣',
    'flag' => '🇫🇷',
    'regional indicator' => '🇦',
    'blood type A' => '🅰️',
    'blood type B' => '🅱',
    'O button' => '🅾️',
    'P button' => '🅿️',
    'AB button' => '🆎',
    'CL button' => '🆑',
    'OK button' => '🆗',
    'VS button' => '🆚',
    'information' => 'ℹ️',
    'circled M' => 'Ⓜ️',
    'latin capitals' => '🔠',
    'latin small' => '🔡',
    'numbers' => '🔢',
    'latin letters' => '🔤',
    'letter' => 'a',
    'word' => 'ok',
    'two emoji' => '🚀🚀',
    'not a string' => 7,
]);

it('explains the refusal', function () {
    $validator = Validator::make(['emoji' => '1️⃣'], ['emoji' => [new ClueEmoji]]);

    expect($validator->errors()->first('emoji'))->toBe(__('Use emoji only, without letters or digits.'));
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `vendor/bin/sail artisan test --compact tests/Unit/Games/GuessMatchTest.php tests/Feature/Games/DrawingOpTest.php tests/Feature/Games/ClueEmojiTest.php`
Expected: FAIL — `Class "App\Enums\GuessResult" not found`.

- [ ] **Step 3: Write the enum and the guess matcher**

Create `app/Enums/GuessResult.php`:

```php
<?php

namespace App\Enums;

enum GuessResult: string
{
    case Wrong = 'wrong';
    case Near = 'near';
    case Correct = 'correct';
}
```

Create `app/Support/Games/GuessMatch.php`:

```php
<?php

namespace App\Support\Games;

use App\Enums\GuessResult;

/**
 * Spec §4: both sides are folded to ASCII, lowercased and stripped of
 * hyphens, apostrophes and extra spaces; a guess one letter away from a
 * short word, or up to two from a longer one, is "very close".
 */
class GuessMatch
{
    private const ShortWordLetters = 4;

    public static function check(string $word, string $guess): GuessResult
    {
        $expected = GameWord::normalize($word);
        $given = GameWord::normalize($guess);

        if ($given === '') {
            return GuessResult::Wrong;
        }

        if ($given === $expected) {
            return GuessResult::Correct;
        }

        $letters = strlen(str_replace(' ', '', $expected));
        $maxDistance = $letters <= self::ShortWordLetters ? 1 : 2;

        return levenshtein($given, $expected) <= $maxDistance ? GuessResult::Near : GuessResult::Wrong;
    }
}
```

- [ ] **Step 4: Write the drawing operation parser**

Create `app/Support/Games/DrawingOp.php`:

```php
<?php

namespace App\Support\Games;

use Illuminate\Validation\ValidationException;

/**
 * Draw & Guess operations on the logical 1000 × 750 canvas. Parsing keeps
 * only known keys, so what is stored and broadcast is exactly this shape.
 */
class DrawingOp
{
    public const Colors = ['black', 'red', 'orange', 'green', 'blue', 'purple', 'white'];

    public const Sizes = [4, 10, 24];

    public const Width = 1000;

    public const Height = 750;

    public const MaxStrokePoints = 1000;

    public const MaxOps = 500;

    public const MaxPoints = 20000;

    /**
     * @return array{type: string, color: string, size: int, points: array<int, array{0: int, 1: int}>}|array{type: string, color: string, x: int, y: int}
     *
     * @throws ValidationException
     */
    public static function parse(mixed $op): array
    {
        if (! is_array($op)) {
            throw self::invalid();
        }

        $color = $op['color'] ?? null;

        if (! is_string($color) || ! in_array($color, self::Colors, true)) {
            throw self::invalid();
        }

        return match ($op['type'] ?? null) {
            'stroke' => self::stroke($color, $op['size'] ?? null, $op['points'] ?? null),
            'fill' => self::fill($color, $op['x'] ?? null, $op['y'] ?? null),
            default => throw self::invalid(),
        };
    }

    /**
     * @param  array<array-key, mixed>  $op
     */
    public static function pointCount(array $op): int
    {
        if (($op['type'] ?? null) !== 'stroke' || ! is_array($op['points'] ?? null)) {
            return 0;
        }

        return count($op['points']);
    }

    /**
     * @return array{type: string, color: string, size: int, points: array<int, array{0: int, 1: int}>}
     */
    private static function stroke(string $color, mixed $size, mixed $points): array
    {
        if (! is_int($size) || ! in_array($size, self::Sizes, true)) {
            throw self::invalid();
        }

        if (! is_array($points) || ! array_is_list($points)) {
            throw self::invalid();
        }

        $count = count($points);

        if ($count < 1 || $count > self::MaxStrokePoints) {
            throw self::invalid();
        }

        $clean = [];

        foreach ($points as $point) {
            if (! is_array($point) || ! array_is_list($point) || count($point) !== 2) {
                throw self::invalid();
            }

            [$x, $y] = $point;

            if (! is_int($x) || ! is_int($y) || ! self::inRange($x, self::Width) || ! self::inRange($y, self::Height)) {
                throw self::invalid();
            }

            $clean[] = [$x, $y];
        }

        return ['type' => 'stroke', 'color' => $color, 'size' => $size, 'points' => $clean];
    }

    /**
     * @return array{type: string, color: string, x: int, y: int}
     */
    private static function fill(string $color, mixed $x, mixed $y): array
    {
        if (! is_int($x) || ! is_int($y) || ! self::inRange($x, self::Width) || ! self::inRange($y, self::Height)) {
            throw self::invalid();
        }

        return ['type' => 'fill', 'color' => $color, 'x' => $x, 'y' => $y];
    }

    private static function inRange(int $value, int $max): bool
    {
        return $value >= 0 && $value <= $max;
    }

    private static function invalid(): ValidationException
    {
        return ValidationException::withMessages(['op' => __('This drawing operation is not valid.')]);
    }
}
```

- [ ] **Step 5: Write the clue emoji rule**

Create `app/Rules/ClueEmoji.php`:

```php
<?php

namespace App\Rules;

use Closure;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Support\Facades\Validator;

/**
 * A Decoded clue item: one emoji (spec 1's SingleEmoji) that does not spell
 * the answer — no keycaps, flags or letter and digit buttons (spec §4.4).
 */
class ClueEmoji implements ValidationRule
{
    private const LetterLike = '/\p{Regional_Indicator}|\x{20E3}|[\x{1F170}\x{1F171}\x{1F17E}\x{1F17F}\x{1F18E}\x{1F191}-\x{1F19A}\x{2139}\x{24C2}\x{1F520}-\x{1F522}\x{1F524}]/u';

    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        if (! is_string($value)) {
            $fail(__('Use emoji only, without letters or digits.'));

            return;
        }

        $isSingleEmoji = Validator::make(['emoji' => $value], ['emoji' => [new SingleEmoji]])->passes();

        if (! $isSingleEmoji || preg_match(self::LetterLike, $value) === 1) {
            $fail(__('Use emoji only, without letters or digits.'));
        }
    }
}
```

- [ ] **Step 6: Run the tests**

Run: `vendor/bin/sail artisan test --compact tests/Unit/Games/GuessMatchTest.php tests/Feature/Games/DrawingOpTest.php tests/Feature/Games/ClueEmojiTest.php`
Expected: PASS.

- [ ] **Step 7: Translations**

| Key (en) | fr | es | de |
|---|---|---|---|
| This drawing operation is not valid. | Cette opération de dessin n'est pas valide. | Esta operación de dibujo no es válida. | Dieser Zeichenschritt ist ungültig. |
| Use emoji only, without letters or digits. | Utilisez uniquement des emoji, sans lettres ni chiffres. | Usa solo emoji, sin letras ni cifras. | Nutze nur Emoji, ohne Buchstaben oder Ziffern. |

Run: `vendor/bin/sail artisan test --compact tests/Feature/TranslationKeysTest.php` — Expected: PASS.

- [ ] **Step 8: Format, analyse, commit**

```bash
vendor/bin/sail bin pint --dirty --format agent
vendor/bin/sail bin phpstan analyse --no-progress
git add app/Enums/GuessResult.php app/Support/Games/GuessMatch.php app/Support/Games/DrawingOp.php app/Rules/ClueEmoji.php tests/Unit/Games/GuessMatchTest.php tests/Feature/Games/DrawingOpTest.php tests/Feature/Games/ClueEmojiTest.php lang
git commit -m "feat(games): match guesses and check drawing operations and clue emoji

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SosW8d2Uj7QxsF1tws5ssS"
```

---
### Task 2: Word-guess rules, their events and the leader guards

**Files:**
- Create: `app/Support/Games/WordGuessRules.php`, `app/Support/Games/DrawAndGuessRules.php`, `app/Support/Games/DecodedRules.php`
- Create: `app/Events/Games/{GameHintRevealed,GameGuessMade,GameDrawingOpAdded,GameDrawingUndone,GameDrawingCleared,GameClueChanged}.php`
- Modify: `app/Actions/Games/GameGuard.php` (add `leader`, `notLeader`), `app/Providers/AppServiceProvider.php` (register both rules), `tests/Pest.php` (`wordGuessTable`)
- Test: create `tests/Feature/Games/WordGuessRulesTest.php`, `tests/Feature/Games/WordGuessScoringTest.php`; modify `tests/Feature/Games/GameEventsTest.php` (new rows in the naming dataset) and `tests/Feature/Games/GameRoomsTest.php` (its "unavailable game" row used `draw`, which this task makes available)

**Interfaces:**
- Consumes:
  - 13a: `GameRules`, `GameRulesRegistry`, `DrawGameWord::handle(GameRoom, bool)`, `GameWord::{mask,letterPositions}`, `GameBroadcastEvent`, `EndGameRound`.
  - 13a helpers: `gameRoomHost`, `gameRoomMember`, `gameRoomGuest`, `gameGuestCookie`, `activeGameRound`, `gamePayloadExposesWord`.
- Produces:
  - `WordGuessRules` (Contract section), with `prepare()` refusing a missing `leader_player_id` (422 on that key, "Choose who leads this round.").
  - Active payload `{mask, maxHints, guesses: [{id, playerId, text, veryClose?}], word?}` + `drawing` | `clue`; ended detail `{mask, drawing | clue}`.
  - `points()`: leader 5 on `Guessed` else 0; guesser `guesserPoints(hints)` with `isWin`; every other guesser 0.
  - `GameGuard::leader`, `GameGuard::notLeader`.
  - The six events with names `game.hint.revealed` `{roundId, mask}`, `game.guess.made` `{roundId, guessId, playerId, text}`, `game.drawing.op-added` `{roundId, op, clientOpId}`, `game.drawing.undone` `{roundId}`, `game.drawing.cleared` `{roundId}`, `game.clue.changed` `{roundId, clue}`.
  - Test helper `wordGuessTable(GameKind $game = GameKind::DrawAndGuess, string $word = 'rocket', array $roundAttributes = []): array{room, hostUser, host, leaderUser, leader, guesserUser, guesser, round}` (link-access room; the host, then the leader, then the guesser joined in that order; the round is active and led by the leader).

- [ ] **Step 1: Add the test helper**

In `tests/Pest.php` add `use App\Enums\GameKind;` if it is not imported yet, and append:

```php
/**
 * An active Draw & Guess or Decoded round in a link room: the host, the
 * leader and a guesser joined in that order.
 *
 * @param  array<string, mixed>  $roundAttributes
 * @return array{room: GameRoom, hostUser: User, host: GamePlayer, leaderUser: User, leader: GamePlayer, guesserUser: User, guesser: GamePlayer, round: GameRound}
 */
function wordGuessTable(GameKind $game = GameKind::DrawAndGuess, string $word = 'rocket', array $roundAttributes = []): array
{
    $room = GameRoom::factory()->game($game)->linkAccess()->create();
    [$hostUser, $host] = gameRoomHost($room);
    [$leaderUser, $leader] = gameRoomMember($room);
    [$guesserUser, $guesser] = gameRoomMember($room);
    $round = activeGameRound($room, ['word' => $word, 'leader_player_id' => $leader->id, ...$roundAttributes]);

    return [
        'room' => $room->fresh(),
        'hostUser' => $hostUser,
        'host' => $host,
        'leaderUser' => $leaderUser,
        'leader' => $leader,
        'guesserUser' => $guesserUser,
        'guesser' => $guesser,
        'round' => $round,
    ];
}
```

- [ ] **Step 2: Write the failing tests**

Create `tests/Feature/Games/WordGuessRulesTest.php`:

```php
<?php

use App\Actions\Games\BuildGameSnapshot;
use App\Enums\GameKind;
use App\Enums\GameRoundOutcome;
use App\Events\Games\GameRoundStarted;
use App\Models\GameGuess;
use App\Models\GameRoom;
use App\Models\GameRound;
use App\Support\Games\GameWordBook;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;

beforeEach(function () {
    Event::fake();
    $this->travelTo(CarbonImmutable::parse('2026-10-06 10:00:00'));
    app()->instance(GameWordBook::class, new GameWordBook(words: ['en' => [['word' => 'rocket', 'drawable' => true]]]));
});

it('offers both games in the picker', function () {
    $room = GameRoom::factory()->create();
    [, $host] = gameRoomHost($room);

    $games = collect(app(BuildGameSnapshot::class)->handle($room, $host)['games'])->pluck('available', 'value');

    expect($games['draw'])->toBeTrue()
        ->and($games['decoded'])->toBeTrue();
});

it('requires a leader to start', function (GameKind $game) {
    $room = GameRoom::factory()->game($game)->create();
    [$user] = gameRoomHost($room);

    $this->actingAs($user)->postJson(route('games.rounds.store', $room))
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['leader_player_id' => __('Choose who leads this round.')]);

    expect(GameRound::query()->count())->toBe(0);
})->with([GameKind::DrawAndGuess, GameKind::Decoded]);

it('draws Draw & Guess words from the drawable pool', function () {
    app()->instance(GameWordBook::class, new GameWordBook(words: ['en' => [
        ['word' => 'meeting', 'drawable' => false],
        ['word' => 'rocket', 'drawable' => true],
    ]]));
    $room = GameRoom::factory()->game(GameKind::DrawAndGuess)->create();
    [$user] = gameRoomHost($room);
    [, $leader] = gameRoomMember($room);

    $this->actingAs($user)->postJson(route('games.rounds.store', $room), ['leader_player_id' => $leader->id])
        ->assertCreated()
        ->assertJsonPath('round.leaderPlayerId', $leader->id);

    expect(GameRound::query()->sole()->word)->toBe('rocket');
});

it('draws Decoded words from every word', function () {
    app()->instance(GameWordBook::class, new GameWordBook(words: ['en' => [['word' => 'meeting', 'drawable' => false]]]));
    $room = GameRoom::factory()->game(GameKind::Decoded)->create();
    [$user] = gameRoomHost($room);
    [, $leader] = gameRoomMember($room);

    $this->actingAs($user)->postJson(route('games.rounds.store', $room), ['leader_player_id' => $leader->id])->assertCreated();

    expect(GameRound::query()->sole()->word)->toBe('meeting');
});

it('shows the word to the leader only', function (GameKind $game) {
    $room = GameRoom::factory()->game($game)->linkAccess()->create();
    [$hostUser] = gameRoomHost($room);
    [$leaderUser, $leader] = gameRoomMember($room);
    $guest = gameRoomGuest($room);

    $start = $this->actingAs($hostUser)
        ->postJson(route('games.rounds.store', $room), ['leader_player_id' => $leader->id])
        ->assertCreated();

    expect($start->json('round'))->not->toHaveKey('word')
        ->and($start->json('round.mask'))->toBe([null, null, null, null, null, null])
        ->and($start->json('round.maxHints'))->toBe(3)
        ->and($start->json('round.guesses'))->toBe([])
        ->and(gamePayloadExposesWord($start->json(), 'rocket'))->toBeFalse();

    $this->actingAs($leaderUser)->getJson(route('games.snapshot.show', $room))->assertJsonPath('round.word', 'rocket');
    $this->actingAs($hostUser)->getJson(route('games.snapshot.show', $room))->assertJsonMissingPath('round.word');

    app('auth')->forgetGuards();

    $this->withCookies(gameGuestCookie($guest))->getJson(route('games.snapshot.show', $room))->assertJsonMissingPath('round.word');

    Event::assertDispatched(GameRoundStarted::class, fn (GameRoundStarted $event) => ! array_key_exists('word', $event->round)
        && ! gamePayloadExposesWord($event->round, 'rocket'));
})->with([GameKind::DrawAndGuess, GameKind::Decoded]);

it('gives the word to a host who leads the round', function () {
    $room = GameRoom::factory()->game(GameKind::DrawAndGuess)->create();
    [$hostUser, $host] = gameRoomHost($room);
    gameRoomMember($room);

    $this->actingAs($hostUser)
        ->postJson(route('games.rounds.store', $room), ['leader_player_id' => $host->id])
        ->assertCreated()
        ->assertJsonPath('round.word', 'rocket');
});

it("presents wrong and near guesses and flags only the viewer's near misses", function () {
    $table = wordGuessTable();
    [$otherUser, $other] = gameRoomMember($table['room']);
    $wrong = GameGuess::factory()->create(['game_round_id' => $table['round']->id, 'player_id' => $other->id, 'text' => 'planet', 'created_at' => now()->subSeconds(3)]);
    $near = GameGuess::factory()->create(['game_round_id' => $table['round']->id, 'player_id' => $table['guesser']->id, 'text' => 'rockt', 'is_near_miss' => true, 'created_at' => now()->subSeconds(2)]);
    GameGuess::factory()->create(['game_round_id' => $table['round']->id, 'player_id' => $other->id, 'text' => 'RoCkEt', 'is_correct' => true, 'created_at' => now()->subSecond()]);

    $guesserView = $this->actingAs($table['guesserUser'])->getJson(route('games.snapshot.show', $table['room']))->json('round.guesses');
    $otherView = $this->actingAs($otherUser)->getJson(route('games.snapshot.show', $table['room']))->json('round.guesses');

    expect($guesserView)->toBe([
        ['id' => $wrong->id, 'playerId' => $other->id, 'text' => 'planet'],
        ['id' => $near->id, 'playerId' => $table['guesser']->id, 'text' => 'rockt', 'veryClose' => true],
    ])
        ->and($otherView)->toBe([
            ['id' => $wrong->id, 'playerId' => $other->id, 'text' => 'planet'],
            ['id' => $near->id, 'playerId' => $table['guesser']->id, 'text' => 'rockt'],
        ])
        ->and(gamePayloadJson($guesserView))->not->toContain('RoCkEt');
});

it('keeps the fifty latest guesses, oldest first', function () {
    $table = wordGuessTable();

    foreach (range(1, 55) as $index) {
        GameGuess::factory()->create([
            'game_round_id' => $table['round']->id,
            'player_id' => $table['guesser']->id,
            'text' => "guess {$index}",
            'created_at' => now()->subSeconds(100 - $index),
        ]);
    }

    $guesses = $this->actingAs($table['hostUser'])->getJson(route('games.snapshot.show', $table['room']))->json('round.guesses');

    expect($guesses)->toHaveCount(50)
        ->and($guesses[0]['text'])->toBe('guess 6')
        ->and($guesses[49]['text'])->toBe('guess 55');
});

it('shows the drawing while active and in the ended round', function () {
    $fill = ['type' => 'fill', 'color' => 'red', 'x' => 1, 'y' => 1];
    $table = wordGuessTable(GameKind::DrawAndGuess, 'kite', ['drawing' => [$fill]]);

    $this->actingAs($table['guesserUser'])
        ->getJson(route('games.snapshot.show', $table['room']))
        ->assertJsonPath('round.drawing', [$fill]);

    $table['round']->forceFill(['ended_at' => now(), 'outcome' => GameRoundOutcome::Passed])->save();

    $this->actingAs($table['guesserUser'])
        ->getJson(route('games.rounds.show', [$table['room'], $table['round']]))
        ->assertOk()
        ->assertJsonPath('word', 'kite')
        ->assertJsonPath('mask', ['k', 'i', 't', 'e'])
        ->assertJsonPath('drawing', [$fill])
        ->assertJsonMissingPath('guesses');
});

it('shows the clue while active and in the ended round', function () {
    $table = wordGuessTable(GameKind::Decoded, 'kite', ['clue' => ['🪁', '🌬️']]);

    $this->actingAs($table['guesserUser'])
        ->getJson(route('games.snapshot.show', $table['room']))
        ->assertJsonPath('round.clue', ['🪁', '🌬️'])
        ->assertJsonMissingPath('round.drawing');

    $table['round']->forceFill(['ended_at' => now(), 'outcome' => GameRoundOutcome::Passed])->save();

    $this->actingAs($table['guesserUser'])
        ->getJson(route('games.rounds.show', [$table['room'], $table['round']]))
        ->assertOk()
        ->assertJsonPath('clue', ['🪁', '🌬️'])
        ->assertJsonMissingPath('drawing');
});

it('times out when the host timer runs out', function (GameKind $game) {
    $table = wordGuessTable($game);
    $table['room']->update(['timer_ends_at' => now()->addMinute()]);

    $this->travel(2)->minutes();

    $this->actingAs($table['hostUser'])
        ->getJson(route('games.snapshot.show', $table['room']))
        ->assertJsonPath('round', null)
        ->assertJsonPath('history.0.outcome', 'timed_out')
        ->assertJsonPath('history.0.word', 'rocket');
})->with([GameKind::DrawAndGuess, GameKind::Decoded]);

it('builds the snapshot of a word-guess round with a constant number of queries', function () {
    $count = function (int $guesses): int {
        $table = wordGuessTable();

        foreach (range(1, $guesses) as $index) {
            GameGuess::factory()->create(['game_round_id' => $table['round']->id, 'player_id' => $table['guesser']->id]);
        }

        $room = $table['room']->fresh();
        $viewer = $table['guesser']->fresh();

        DB::flushQueryLog();
        DB::enableQueryLog();
        app(BuildGameSnapshot::class)->handle($room, $viewer);
        DB::disableQueryLog();

        return count(DB::getQueryLog());
    };

    expect($count(30))->toBe($count(2));
});
```

Create `tests/Feature/Games/WordGuessScoringTest.php`:

```php
<?php

use App\Actions\Games\EndGameRound;
use App\Enums\GameKind;
use App\Enums\GameRoundOutcome;
use App\Models\GameGuess;
use App\Models\GamePoint;
use Illuminate\Support\Facades\Event;

beforeEach(fn () => Event::fake());

dataset('word guess games', [GameKind::DrawAndGuess, GameKind::Decoded]);

it('scores a guessed round by the hints revealed', function (GameKind $game, int $hints, int $expected) {
    $table = wordGuessTable($game, 'retrospective', ['revealed_positions' => $hints === 0 ? [] : range(0, $hints - 1)]);
    [, $other] = gameRoomMember($table['room']);
    gameRoomMember($table['room']);
    GameGuess::factory()->create(['game_round_id' => $table['round']->id, 'player_id' => $other->id, 'text' => 'retro']);
    GameGuess::factory()->create(['game_round_id' => $table['round']->id, 'player_id' => $table['guesser']->id, 'text' => 'retrospective', 'is_correct' => true]);

    $ended = app(EndGameRound::class)->handle($table['room'], $table['round'], GameRoundOutcome::Guessed, $table['guesser']);

    expect($ended['points'])->toEqualCanonicalizing([
        ['playerId' => $table['leader']->id, 'points' => 5, 'isWin' => false],
        ['playerId' => $table['guesser']->id, 'points' => $expected, 'isWin' => true],
        ['playerId' => $other->id, 'points' => 0, 'isWin' => false],
    ])
        ->and(GamePoint::query()->count())->toBe(3)
        ->and(GamePoint::query()->where('player_id', $table['host']->id)->exists())->toBeFalse();
})->with('word guess games')->with([
    'no hint' => [0, 10],
    'one hint' => [1, 8],
    'three hints' => [3, 4],
    'five hints' => [5, 4],
]);

it('gives every actor a zero-point row when nobody guessed', function (GameKind $game, GameRoundOutcome $outcome) {
    $table = wordGuessTable($game);
    GameGuess::factory()->create(['game_round_id' => $table['round']->id, 'player_id' => $table['guesser']->id, 'text' => 'planet']);

    $ended = app(EndGameRound::class)->handle($table['room'], $table['round'], $outcome);

    expect($ended['points'])->toEqualCanonicalizing([
        ['playerId' => $table['leader']->id, 'points' => 0, 'isWin' => false],
        ['playerId' => $table['guesser']->id, 'points' => 0, 'isWin' => false],
    ]);
})->with('word guess games')->with([GameRoundOutcome::TimedOut, GameRoundOutcome::Passed]);

it('counts a guesser once however many guesses they made', function () {
    $table = wordGuessTable();
    GameGuess::factory()->count(3)->create(['game_round_id' => $table['round']->id, 'player_id' => $table['guesser']->id]);

    $ended = app(EndGameRound::class)->handle($table['room'], $table['round'], GameRoundOutcome::Passed);

    expect(collect($ended['points'])->where('playerId', $table['guesser']->id))->toHaveCount(1);
});
```

In `tests/Feature/Games/GameEventsTest.php` add these `use` lines:

```php
use App\Events\Games\GameClueChanged;
use App\Events\Games\GameDrawingCleared;
use App\Events\Games\GameDrawingOpAdded;
use App\Events\Games\GameDrawingUndone;
use App\Events\Games\GameGuessMade;
use App\Events\Games\GameHintRevealed;
```

and append these rows to the dataset of "names every event and its payload keys":

```php
    'hint revealed' => [fn (GameRoom $room) => new GameHintRevealed($room, 'r', [null, 'a']), 'game.hint.revealed', ['roundId', 'mask']],
    'guess made' => [fn (GameRoom $room) => new GameGuessMade($room, ['roundId' => 'r', 'guessId' => 'g', 'playerId' => 'p', 'text' => 'kit']), 'game.guess.made', ['roundId', 'guessId', 'playerId', 'text']],
    'drawing op added' => [fn (GameRoom $room) => new GameDrawingOpAdded($room, 'r', ['type' => 'fill', 'color' => 'red', 'x' => 1, 'y' => 1], 'op-1'), 'game.drawing.op-added', ['roundId', 'op', 'clientOpId']],
    'drawing undone' => [fn (GameRoom $room) => new GameDrawingUndone($room, 'r'), 'game.drawing.undone', ['roundId']],
    'drawing cleared' => [fn (GameRoom $room) => new GameDrawingCleared($room, 'r'), 'game.drawing.cleared', ['roundId']],
    'clue changed' => [fn (GameRoom $room) => new GameClueChanged($room, 'r', ['🚀']), 'game.clue.changed', ['roundId', 'clue']],
```

In `tests/Feature/Games/GameRoomsTest.php`, in the dataset of "validates new rooms", replace the row `'unavailable game' => [['game' => 'draw'], 'game'],` with (no GIF provider is configured in tests, so `gif` stays unavailable after Plan 13c too):

```php
    'unavailable game' => [['game' => 'gif'], 'game'],
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Games/WordGuessRulesTest.php tests/Feature/Games/WordGuessScoringTest.php tests/Feature/Games/GameEventsTest.php`
Expected: FAIL — `Class "App\Events\Games\GameHintRevealed" not found` and "offers both games in the picker" failing on `available: false`.

- [ ] **Step 4: Write the leader guards**

In `app/Actions/Games/GameGuard.php` add, after `leaderOrHost()`:

```php
    public static function leader(GameRound $round, GamePlayer $player): void
    {
        if ($round->leader_player_id !== null && $round->leader_player_id === $player->id) {
            return;
        }

        throw new AuthorizationException(__('Only the player leading this round can do this.'));
    }

    public static function notLeader(GameRound $round, GamePlayer $player): void
    {
        if ($round->leader_player_id !== $player->id) {
            return;
        }

        throw new AuthorizationException(__('You are leading this round, so you cannot guess.'));
    }
```

- [ ] **Step 5: Write the rules**

Create `app/Support/Games/WordGuessRules.php`:

```php
<?php

namespace App\Support\Games;

use App\Actions\Games\DrawGameWord;
use App\Enums\GameRoundOutcome;
use App\Models\GameGuess;
use App\Models\GamePlayer;
use App\Models\GameRoom;
use App\Models\GameRound;
use Carbon\CarbonInterface;
use Illuminate\Validation\ValidationException;

/**
 * Draw & Guess and Decoded: a leader knows the word, the others guess in a
 * chat. Only the leader ever receives the word from here; correct guesses
 * are never presented, and "very close" is shown to its guesser only.
 */
abstract class WordGuessRules implements GameRules
{
    public const GuessesShown = 50;

    private const LeaderPoints = 5;

    private const GuessPointsStart = 10;

    private const GuessPointsPerHint = 2;

    private const GuessPointsFloor = 4;

    public function __construct(private DrawGameWord $drawGameWord) {}

    abstract protected function drawableOnly(): bool;

    /**
     * The game's own field (drawing or clue), shown while active and after.
     *
     * @return array<string, mixed>
     */
    abstract protected function board(GameRound $round): array;

    public static function maxHints(string $word): int
    {
        return intdiv(count(GameWord::letterPositions($word)), 2);
    }

    public static function guesserPoints(int $hints): int
    {
        return max(self::GuessPointsStart - self::GuessPointsPerHint * $hints, self::GuessPointsFloor);
    }

    public function isAvailable(GameRoom $room): bool
    {
        return true;
    }

    public function prepare(GameRoom $room, GameRound $round, array $input): void
    {
        $leaderId = $input['leader_player_id'] ?? null;

        if (! is_string($leaderId) || $leaderId === '') {
            throw ValidationException::withMessages(['leader_player_id' => __('Choose who leads this round.')]);
        }

        $round->leader_player_id = $leaderId;
        $round->word = $this->drawGameWord->handle($room, $this->drawableOnly());
    }

    public function presentActive(GameRound $round, GameRoom $room, ?GamePlayer $viewer): array
    {
        $word = (string) $round->word;
        $isLeader = $viewer !== null && $viewer->id === $round->leader_player_id;

        return [
            'mask' => GameWord::mask($word, $round->revealed_positions),
            'maxHints' => self::maxHints($word),
            'guesses' => $this->guesses($round, $viewer),
            ...$this->board($round),
            ...($isLeader ? ['word' => $word] : []),
        ];
    }

    public function presentEnded(GameRound $round): array
    {
        $word = (string) $round->word;

        return [
            'mask' => GameWord::mask($word, GameWord::letterPositions($word)),
            ...$this->board($round),
        ];
    }

    public function endedPayload(GameRound $round, GameRoom $room): array
    {
        return [];
    }

    public function expiryAnchor(GameRound $round): CarbonInterface
    {
        return $round->started_at;
    }

    public function expire(GameRoom $room, GameRound $round): ?GameRoundOutcome
    {
        return GameRoundOutcome::TimedOut;
    }

    public function outcomeOnNextRound(GameRound $round): ?GameRoundOutcome
    {
        return null;
    }

    /**
     * The leader always took part; every guesser gets a row, and only a
     * guessed round pays: the winner by hints used, the leader a flat bonus.
     */
    public function points(GameRound $round, GameRoom $room): array
    {
        $isGuessed = $round->outcome === GameRoundOutcome::Guessed;
        $rows = [];

        if ($round->leader_player_id !== null) {
            $rows[$round->leader_player_id] = ['points' => $isGuessed ? self::LeaderPoints : 0, 'isWin' => false];
        }

        foreach ($round->guesses()->distinct()->pluck('player_id') as $playerId) {
            $rows[(string) $playerId] ??= ['points' => 0, 'isWin' => false];
        }

        if ($isGuessed && $round->winner_player_id !== null) {
            $rows[$round->winner_player_id] = [
                'points' => self::guesserPoints(count($round->revealed_positions)),
                'isWin' => true,
            ];
        }

        return $rows;
    }

    /**
     * @return array<int, array{id: string, playerId: string, text: string, veryClose?: true}>
     */
    private function guesses(GameRound $round, ?GamePlayer $viewer): array
    {
        return $round->guesses()
            ->where('is_correct', false)
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->limit(self::GuessesShown)
            ->get()
            ->reverse()
            ->map(fn (GameGuess $guess): array => [
                'id' => $guess->id,
                'playerId' => $guess->player_id,
                'text' => $guess->text,
                ...($guess->is_near_miss && $viewer !== null && $guess->player_id === $viewer->id ? ['veryClose' => true] : []),
            ])
            ->values()
            ->all();
    }
}
```

Create `app/Support/Games/DrawAndGuessRules.php`:

```php
<?php

namespace App\Support\Games;

use App\Enums\GameKind;
use App\Models\GameRound;

class DrawAndGuessRules extends WordGuessRules
{
    public function kind(): GameKind
    {
        return GameKind::DrawAndGuess;
    }

    protected function drawableOnly(): bool
    {
        return true;
    }

    protected function board(GameRound $round): array
    {
        return ['drawing' => $round->drawing];
    }
}
```

Create `app/Support/Games/DecodedRules.php`:

```php
<?php

namespace App\Support\Games;

use App\Enums\GameKind;
use App\Models\GameRound;

class DecodedRules extends WordGuessRules
{
    public function kind(): GameKind
    {
        return GameKind::Decoded;
    }

    protected function drawableOnly(): bool
    {
        return false;
    }

    protected function board(GameRound $round): array
    {
        return ['clue' => $round->clue];
    }
}
```

In `app/Providers/AppServiceProvider.php` add `use App\Support\Games\DecodedRules;` and `use App\Support\Games\DrawAndGuessRules;`, and extend the registry list:

```php
        $this->app->bind(GameRulesRegistry::class, fn (Application $app): GameRulesRegistry => new GameRulesRegistry([
            $app->make(HangmanRules::class),
            $app->make(DrawAndGuessRules::class),
            $app->make(DecodedRules::class),
        ]));
```

- [ ] **Step 6: Write the events**

Create `app/Events/Games/GameHintRevealed.php`:

```php
<?php

namespace App\Events\Games;

use App\Models\GameRoom;

class GameHintRevealed extends GameBroadcastEvent
{
    /**
     * @param  array<int, ?string>  $mask
     */
    public function __construct(GameRoom $room, public string $roundId, public array $mask)
    {
        parent::__construct($room);
    }

    public function broadcastAs(): string
    {
        return 'game.hint.revealed';
    }

    public function broadcastWith(): array
    {
        return ['roundId' => $this->roundId, 'mask' => $this->mask];
    }
}
```

Create `app/Events/Games/GameGuessMade.php`:

```php
<?php

namespace App\Events\Games;

use App\Models\GameRoom;

/**
 * Wrong and near-miss guesses only, without the near-miss flag: a correct
 * guess ends the round instead and its text never travels.
 */
class GameGuessMade extends GameBroadcastEvent
{
    /**
     * @param  array{roundId: string, guessId: string, playerId: string, text: string}  $payload
     */
    public function __construct(GameRoom $room, public array $payload)
    {
        parent::__construct($room);
    }

    public function broadcastAs(): string
    {
        return 'game.guess.made';
    }

    public function broadcastWith(): array
    {
        return $this->payload;
    }
}
```

Create `app/Events/Games/GameDrawingOpAdded.php`:

```php
<?php

namespace App\Events\Games;

use App\Models\GameRoom;

class GameDrawingOpAdded extends GameBroadcastEvent
{
    /**
     * @param  array<string, mixed>  $op
     */
    public function __construct(GameRoom $room, public string $roundId, public array $op, public string $clientOpId)
    {
        parent::__construct($room);
    }

    public function broadcastAs(): string
    {
        return 'game.drawing.op-added';
    }

    public function broadcastWith(): array
    {
        return ['roundId' => $this->roundId, 'op' => $this->op, 'clientOpId' => $this->clientOpId];
    }
}
```

Create `app/Events/Games/GameDrawingUndone.php`:

```php
<?php

namespace App\Events\Games;

use App\Models\GameRoom;

class GameDrawingUndone extends GameBroadcastEvent
{
    public function __construct(GameRoom $room, public string $roundId)
    {
        parent::__construct($room);
    }

    public function broadcastAs(): string
    {
        return 'game.drawing.undone';
    }

    public function broadcastWith(): array
    {
        return ['roundId' => $this->roundId];
    }
}
```

Create `app/Events/Games/GameDrawingCleared.php`:

```php
<?php

namespace App\Events\Games;

use App\Models\GameRoom;

class GameDrawingCleared extends GameBroadcastEvent
{
    public function __construct(GameRoom $room, public string $roundId)
    {
        parent::__construct($room);
    }

    public function broadcastAs(): string
    {
        return 'game.drawing.cleared';
    }

    public function broadcastWith(): array
    {
        return ['roundId' => $this->roundId];
    }
}
```

Create `app/Events/Games/GameClueChanged.php`:

```php
<?php

namespace App\Events\Games;

use App\Models\GameRoom;

class GameClueChanged extends GameBroadcastEvent
{
    /**
     * @param  array<int, string>  $clue
     */
    public function __construct(GameRoom $room, public string $roundId, public array $clue)
    {
        parent::__construct($room);
    }

    public function broadcastAs(): string
    {
        return 'game.clue.changed';
    }

    public function broadcastWith(): array
    {
        return ['roundId' => $this->roundId, 'clue' => $this->clue];
    }
}
```

- [ ] **Step 7: Run the tests**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Games`
Expected: PASS. (13a's engine tests keep their `FakeGameRules` through `bindGameRules()`; 13a's `GameRoundEngineTest` "refuses unavailable games and non-hosts when switching" switches to `gif`, which stays unavailable until 13c.)

- [ ] **Step 8: Translations**

| Key (en) | fr | es | de |
|---|---|---|---|
| Choose who leads this round. | Choisissez qui mène cette manche. | Elige quién dirige esta ronda. | Wähle, wer diese Runde leitet. |
| Only the player leading this round can do this. | Seul le joueur qui mène cette manche peut faire cela. | Solo quien dirige esta ronda puede hacerlo. | Das kann nur, wer diese Runde leitet. |
| You are leading this round, so you cannot guess. | Vous menez cette manche, vous ne pouvez donc pas deviner. | Diriges esta ronda, así que no puedes adivinar. | Du leitest diese Runde, also kannst du nicht raten. |

Run: `vendor/bin/sail artisan test --compact tests/Feature/TranslationKeysTest.php` — Expected: PASS.

- [ ] **Step 9: Format, analyse, commit**

```bash
vendor/bin/sail bin pint --dirty --format agent
vendor/bin/sail bin phpstan analyse --no-progress
git add app/Support/Games/WordGuessRules.php app/Support/Games/DrawAndGuessRules.php app/Support/Games/DecodedRules.php app/Events/Games app/Actions/Games/GameGuard.php app/Providers/AppServiceProvider.php tests/Pest.php tests/Feature/Games/WordGuessRulesTest.php tests/Feature/Games/WordGuessScoringTest.php tests/Feature/Games/GameEventsTest.php tests/Feature/Games/GameRoomsTest.php lang
git commit -m "feat(games): add the Draw & Guess and Decoded rules

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SosW8d2Uj7QxsF1tws5ssS"
```

---
### Task 3: Playing a word — the secret, hints and guesses

**Files:**
- Create: `app/Actions/Games/RevealGameHint.php`, `app/Actions/Games/MakeGameGuess.php`
- Create: `app/Http/Controllers/Games/{GameRoundSecretsController,GameRoundHintsController,GameGuessesController}.php`
- Modify: `routes/web.php`
- Test: create `tests/Feature/Games/WordGuessPlayTest.php`

**Interfaces:**
- Consumes: Task 1 (`GuessMatch`, `GuessResult`), Task 2 (`WordGuessRules::maxHints`, `GameGuard::{leader,notLeader}`, `GameHintRevealed`, `GameGuessMade`, `wordGuessTable`); 13a `LockGameRound`, `EndGameRound`, `GameGuard::{mutable,activeRound,roundGame}`, `GameRateLimit::hit`, `GameWord`.
- Produces:
  - `RevealGameHint::handle(GameRoom, GameRound, GamePlayer): array{roundId: string, mask: array<int, ?string>}`
  - `MakeGameGuess::handle(GameRoom, GameRound, GamePlayer, string $text): array{result: string, guessId: string, ended: ?array}`
  - Route `games.rounds.secret.show` (GET `rounds/{round}/secret` → `{word}`; 403 for anyone but the leader, 409 once the round ended).
  - Route `games.rounds.hints.store` (POST → `{roundId, mask}`).
  - Route `games.rounds.guesses.store` (POST body `text`, 1–50 characters after trimming → 200 `{result, guessId, ended}`), rate-limited on 13a's shared key `game-play:{playerId}` (3 per 3 s).

- [ ] **Step 1: Write the failing test**

Create `tests/Feature/Games/WordGuessPlayTest.php`:

```php
<?php

use App\Enums\GameKind;
use App\Enums\GameRoundOutcome;
use App\Events\Games\GameGuessMade;
use App\Events\Games\GameHintRevealed;
use App\Events\Games\GameRoundEnded;
use App\Models\GameGuess;
use App\Models\GamePoint;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Event;

beforeEach(function () {
    Event::fake();
    $this->travelTo(CarbonImmutable::parse('2026-10-06 10:00:00'));
});

dataset('guessing games', [GameKind::DrawAndGuess, GameKind::Decoded]);

it('gives the word to the leader only', function (GameKind $game) {
    $table = wordGuessTable($game);
    $guest = gameRoomGuest($table['room']);

    $this->actingAs($table['leaderUser'])
        ->getJson(route('games.rounds.secret.show', [$table['room'], $table['round']]))
        ->assertOk()
        ->assertExactJson(['word' => 'rocket']);

    foreach ([$table['hostUser'], $table['guesserUser']] as $user) {
        $this->actingAs($user)->getJson(route('games.rounds.secret.show', [$table['room'], $table['round']]))->assertForbidden();
    }

    app('auth')->forgetGuards();

    $this->withCookies(gameGuestCookie($guest))
        ->getJson(route('games.rounds.secret.show', [$table['room'], $table['round']]))
        ->assertForbidden();
})->with('guessing games');

it('refuses the secret of an ended round', function () {
    $table = wordGuessTable();
    $table['round']->forceFill(['ended_at' => now(), 'outcome' => GameRoundOutcome::Passed])->save();

    $this->actingAs($table['leaderUser'])
        ->getJson(route('games.rounds.secret.show', [$table['room'], $table['round']]))
        ->assertConflict();
});

it('reveals one letter per hint for the leader', function (GameKind $game) {
    $table = wordGuessTable($game);

    $response = $this->actingAs($table['leaderUser'])
        ->postJson(route('games.rounds.hints.store', [$table['room'], $table['round']]))
        ->assertOk()
        ->assertJsonPath('roundId', $table['round']->id);

    $mask = $response->json('mask');
    $shown = array_keys(array_filter($mask, fn (?string $letter) => $letter !== null));

    expect($shown)->toHaveCount(1)
        ->and($mask[$shown[0]])->toBe(mb_str_split('rocket')[$shown[0]])
        ->and($table['round']->fresh()->revealed_positions)->toBe($shown);

    Event::assertDispatched(GameHintRevealed::class, fn (GameHintRevealed $event) => $event->mask === $mask
        && ! gamePayloadExposesWord($event->broadcastWith(), 'rocket'));
})->with('guessing games');

it('stops at half the letters', function () {
    $table = wordGuessTable();

    $this->actingAs($table['leaderUser']);

    foreach (range(1, 3) as $hint) {
        $this->postJson(route('games.rounds.hints.store', [$table['room'], $table['round']]))->assertOk();
    }

    $this->postJson(route('games.rounds.hints.store', [$table['room'], $table['round']]))
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['hint' => __('No more letters can be revealed for this word.')]);

    expect($table['round']->fresh()->revealed_positions)->toHaveCount(3);
});

it('never reveals a separator and counts letters only', function (string $word, int $hints, array $separators) {
    $table = wordGuessTable(GameKind::Decoded, $word);

    $this->actingAs($table['leaderUser']);

    foreach (range(1, $hints) as $hint) {
        $this->postJson(route('games.rounds.hints.store', [$table['room'], $table['round']]))->assertOk();
    }

    $this->postJson(route('games.rounds.hints.store', [$table['room'], $table['round']]))->assertUnprocessable();

    expect(array_intersect($table['round']->fresh()->revealed_positions, $separators))->toBe([]);
})->with([
    'hyphen' => ['to-do', 2, [2]],
    'apostrophe' => ["l'été", 2, [1]],
    'space' => ['stand up', 3, [5]],
    'three letters' => ['bug', 1, []],
]);

it('keeps hints to the leader', function () {
    $table = wordGuessTable();

    $this->actingAs($table['hostUser'])
        ->postJson(route('games.rounds.hints.store', [$table['room'], $table['round']]))
        ->assertForbidden();

    expect($table['round']->fresh()->revealed_positions)->toBe([]);
});

it('broadcasts a wrong guess to the others', function (GameKind $game) {
    $table = wordGuessTable($game);

    $response = $this->actingAs($table['guesserUser'])
        ->postJson(route('games.rounds.guesses.store', [$table['room'], $table['round']]), ['text' => 'planet'])
        ->assertOk()
        ->assertJsonPath('result', 'wrong')
        ->assertJsonPath('ended', null);

    $guess = GameGuess::query()->sole();

    expect($response->json('guessId'))->toBe($guess->id)
        ->and($guess->text)->toBe('planet')
        ->and($guess->is_near_miss)->toBeFalse()
        ->and($guess->is_correct)->toBeFalse();

    Event::assertDispatched(GameGuessMade::class, fn (GameGuessMade $event) => $event->broadcastWith() === [
        'roundId' => $table['round']->id,
        'guessId' => $guess->id,
        'playerId' => $table['guesser']->id,
        'text' => 'planet',
    ]);
})->with('guessing games');

it('tells only the guesser that a guess was very close', function () {
    $table = wordGuessTable();

    $this->actingAs($table['guesserUser'])
        ->postJson(route('games.rounds.guesses.store', [$table['room'], $table['round']]), ['text' => 'rockt'])
        ->assertOk()
        ->assertJsonPath('result', 'near');

    expect(GameGuess::query()->sole()->is_near_miss)->toBeTrue();

    Event::assertDispatched(GameGuessMade::class, fn (GameGuessMade $event) => $event->broadcastWith()['text'] === 'rockt'
        && ! str_contains(gamePayloadJson($event->broadcastWith()), 'near')
        && ! str_contains(gamePayloadJson($event->broadcastWith()), 'veryClose'));
});

it('accepts a correct guess whatever its case, accents and spacing', function (GameKind $game) {
    $table = wordGuessTable($game);

    $response = $this->actingAs($table['guesserUser'])
        ->postJson(route('games.rounds.guesses.store', [$table['room'], $table['round']]), ['text' => '  RoCkÉt '])
        ->assertOk()
        ->assertJsonPath('result', 'correct')
        ->assertJsonPath('ended.outcome', 'guessed')
        ->assertJsonPath('ended.word', 'rocket')
        ->assertJsonPath('ended.winnerPlayerId', $table['guesser']->id)
        ->assertJsonPath('ended.leaderPlayerId', $table['leader']->id);

    expect($table['round']->fresh())
        ->outcome->toBe(GameRoundOutcome::Guessed)
        ->winner_player_id->toBe($table['guesser']->id)
        ->and(GameGuess::query()->sole()->is_correct)->toBeTrue()
        ->and(GamePoint::query()->where('player_id', $table['guesser']->id)->sole()->points)->toBe(10)
        ->and(str_contains(gamePayloadJson($response->json()), 'RoCkÉt'))->toBeFalse();

    Event::assertNotDispatched(GameGuessMade::class);
    Event::assertDispatched(GameRoundEnded::class, fn (GameRoundEnded $event) => ! str_contains(gamePayloadJson($event->payload), 'RoCkÉt'));
})->with('guessing games');

it('lets guests guess', function () {
    $table = wordGuessTable();
    $guest = gameRoomGuest($table['room']);

    $this->withCookies(gameGuestCookie($guest))
        ->postJson(route('games.rounds.guesses.store', [$table['room'], $table['round']]), ['text' => 'rocket'])
        ->assertOk()
        ->assertJsonPath('ended.winnerPlayerId', $guest->id);
});

it('keeps the leader from guessing', function () {
    $table = wordGuessTable();

    $this->actingAs($table['leaderUser'])
        ->postJson(route('games.rounds.guesses.store', [$table['room'], $table['round']]), ['text' => 'rocket'])
        ->assertForbidden()
        ->assertJsonPath('message', __('You are leading this round, so you cannot guess.'));

    expect(GameGuess::query()->count())->toBe(0)
        ->and($table['round']->fresh()->isActive())->toBeTrue();
});

it('refuses a guess after the round ended', function () {
    $table = wordGuessTable();
    $table['round']->forceFill(['ended_at' => now(), 'outcome' => GameRoundOutcome::Guessed])->save();

    $this->actingAs($table['guesserUser'])
        ->postJson(route('games.rounds.guesses.store', [$table['room'], $table['round']]), ['text' => 'rocket'])
        ->assertConflict()
        ->assertJsonPath('message', __('This round is over.'));

    expect(GameGuess::query()->count())->toBe(0)
        ->and(GamePoint::query()->count())->toBe(0);
});

it('refuses guesses in Hangman', function () {
    $table = wordGuessTable(GameKind::Hangman);

    $this->actingAs($table['guesserUser'])
        ->postJson(route('games.rounds.guesses.store', [$table['room'], $table['round']]), ['text' => 'rocket'])
        ->assertUnprocessable();
});

it('validates the guess text', function (mixed $text) {
    $table = wordGuessTable();

    $this->actingAs($table['guesserUser'])
        ->postJson(route('games.rounds.guesses.store', [$table['room'], $table['round']]), ['text' => $text])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('text');

    expect(GameGuess::query()->count())->toBe(0);
})->with([
    'empty' => '',
    'only spaces' => '    ',
    'too long' => str_repeat('a', 51),
    'not text' => [['rocket']],
]);

it('slows down a player guessing too fast', function () {
    $table = wordGuessTable();

    $this->actingAs($table['guesserUser']);

    foreach (['one', 'two', 'three'] as $text) {
        $this->postJson(route('games.rounds.guesses.store', [$table['room'], $table['round']]), ['text' => $text])->assertOk();
    }

    $this->postJson(route('games.rounds.guesses.store', [$table['room'], $table['round']]), ['text' => 'four'])
        ->assertTooManyRequests()
        ->assertJsonPath('message', __('Slow down a little.'));

    $this->travel(4)->seconds();

    $this->postJson(route('games.rounds.guesses.store', [$table['room'], $table['round']]), ['text' => 'four'])->assertOk();
});

it('lets the leader or the host pass', function (string $who) {
    $table = wordGuessTable();
    $actor = $who === 'leader' ? $table['leaderUser'] : $table['hostUser'];

    $this->actingAs($actor)
        ->postJson(route('games.rounds.pass.store', [$table['room'], $table['round']]))
        ->assertOk()
        ->assertJsonPath('ended.outcome', 'passed')
        ->assertJsonPath('ended.word', 'rocket');

})->with(['leader', 'host']);

it('keeps passing to the leader and the host', function () {
    $table = wordGuessTable();

    $this->actingAs($table['guesserUser'])
        ->postJson(route('games.rounds.pass.store', [$table['room'], $table['round']]))
        ->assertForbidden();

    expect($table['round']->fresh()->isActive())->toBeTrue();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Games/WordGuessPlayTest.php`
Expected: FAIL — `Route [games.rounds.secret.show] not defined.`

- [ ] **Step 3: Write the actions**

Create `app/Actions/Games/RevealGameHint.php`:

```php
<?php

namespace App\Actions\Games;

use App\Enums\GameKind;
use App\Events\Games\GameHintRevealed;
use App\Models\GamePlayer;
use App\Models\GameRoom;
use App\Models\GameRound;
use App\Support\Games\GameWord;
use App\Support\Games\WordGuessRules;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class RevealGameHint
{
    /**
     * One random hidden letter, up to half the word's letters; separators
     * are always shown already and never count.
     *
     * @return array{roundId: string, mask: array<int, ?string>}
     */
    public function handle(GameRoom $room, GameRound $round, GamePlayer $player): array
    {
        return DB::transaction(function () use ($room, $round, $player): array {
            [$lockedRoom, $lockedRound] = LockGameRound::handle($room, $round);

            GameGuard::mutable($lockedRoom);
            GameGuard::leader($lockedRound, $player);
            GameGuard::activeRound($lockedRoom, $lockedRound);
            GameGuard::roundGame($lockedRound, GameKind::DrawAndGuess, GameKind::Decoded);

            $word = (string) $lockedRound->word;
            $revealed = $lockedRound->revealed_positions;
            $hidden = array_values(array_diff(GameWord::letterPositions($word), $revealed));

            if ($hidden === [] || count($revealed) >= WordGuessRules::maxHints($word)) {
                throw ValidationException::withMessages(['hint' => __('No more letters can be revealed for this word.')]);
            }

            $revealed[] = $hidden[array_rand($hidden)];
            sort($revealed);

            $lockedRound->forceFill(['revealed_positions' => $revealed])->save();

            $mask = GameWord::mask($word, $revealed);

            (new GameHintRevealed($lockedRoom, $lockedRound->id, $mask))->sendToOthers();

            return ['roundId' => $lockedRound->id, 'mask' => $mask];
        });
    }
}
```

Create `app/Actions/Games/MakeGameGuess.php`:

```php
<?php

namespace App\Actions\Games;

use App\Enums\GameKind;
use App\Enums\GameRoundOutcome;
use App\Enums\GuessResult;
use App\Events\Games\GameGuessMade;
use App\Models\GameGuess;
use App\Models\GamePlayer;
use App\Models\GameRoom;
use App\Models\GameRound;
use App\Support\Games\GuessMatch;
use Illuminate\Support\Facades\DB;

class MakeGameGuess
{
    public function __construct(private EndGameRound $endGameRound) {}

    /**
     * A correct guess ends the round and is never broadcast; the others go
     * to every player without saying whether they were close.
     *
     * @return array{result: string, guessId: string, ended: ?array<string, mixed>}
     */
    public function handle(GameRoom $room, GameRound $round, GamePlayer $player, string $text): array
    {
        return DB::transaction(function () use ($room, $round, $player, $text): array {
            [$lockedRoom, $lockedRound] = LockGameRound::handle($room, $round);

            GameGuard::mutable($lockedRoom);
            GameGuard::notLeader($lockedRound, $player);
            GameGuard::activeRound($lockedRoom, $lockedRound);
            GameGuard::roundGame($lockedRound, GameKind::DrawAndGuess, GameKind::Decoded);

            $result = GuessMatch::check((string) $lockedRound->word, $text);

            /** @var GameGuess $guess */
            $guess = $lockedRound->guesses()->create([
                'player_id' => $player->id,
                'text' => $text,
                'is_near_miss' => $result === GuessResult::Near,
                'is_correct' => $result === GuessResult::Correct,
            ]);

            if ($result === GuessResult::Correct) {
                return [
                    'result' => $result->value,
                    'guessId' => $guess->id,
                    'ended' => $this->endGameRound->handle($lockedRoom, $lockedRound, GameRoundOutcome::Guessed, $player),
                ];
            }

            (new GameGuessMade($lockedRoom, [
                'roundId' => $lockedRound->id,
                'guessId' => $guess->id,
                'playerId' => $player->id,
                'text' => $guess->text,
            ]))->sendToOthers();

            return ['result' => $result->value, 'guessId' => $guess->id, 'ended' => null];
        });
    }
}
```

- [ ] **Step 4: Write the controllers and routes**

Create `app/Http/Controllers/Games/GameRoundSecretsController.php`:

```php
<?php

namespace App\Http\Controllers\Games;

use App\Actions\Games\GameGuard;
use App\Http\Controllers\Controller;
use App\Models\GamePlayer;
use App\Models\GameRoom;
use App\Models\GameRound;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class GameRoundSecretsController extends Controller
{
    public function show(Request $request, GameRoom $room, GameRound $round): JsonResponse
    {
        GameGuard::leader($round, GamePlayer::current($request));
        GameGuard::activeRound($room, $round);

        return response()->json(['word' => $round->word]);
    }
}
```

Create `app/Http/Controllers/Games/GameRoundHintsController.php`:

```php
<?php

namespace App\Http\Controllers\Games;

use App\Actions\Games\RevealGameHint;
use App\Http\Controllers\Controller;
use App\Models\GamePlayer;
use App\Models\GameRoom;
use App\Models\GameRound;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class GameRoundHintsController extends Controller
{
    public function store(Request $request, GameRoom $room, GameRound $round, RevealGameHint $revealGameHint): JsonResponse
    {
        return response()->json($revealGameHint->handle($room, $round, GamePlayer::current($request)));
    }
}
```

Create `app/Http/Controllers/Games/GameGuessesController.php`:

```php
<?php

namespace App\Http\Controllers\Games;

use App\Actions\Games\MakeGameGuess;
use App\Http\Controllers\Controller;
use App\Models\GamePlayer;
use App\Models\GameRoom;
use App\Models\GameRound;
use App\Support\Games\GameRateLimit;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class GameGuessesController extends Controller
{
    public function store(Request $request, GameRoom $room, GameRound $round, MakeGameGuess $makeGameGuess): JsonResponse
    {
        $player = GamePlayer::current($request);

        GameRateLimit::hit("game-play:{$player->id}", 3, 3);

        $validated = $request->validate([
            'text' => ['required', 'string', 'max:50'],
        ]);

        return response()->json($makeGameGuess->handle($room, $round, $player, trim($validated['text'])));
    }
}
```

In `routes/web.php` add the imports `use App\Http\Controllers\Games\GameGuessesController;`, `use App\Http\Controllers\Games\GameRoundHintsController;`, `use App\Http\Controllers\Games\GameRoundSecretsController;` and, inside the `games/{room}` group after the letters route:

```php
        Route::get('rounds/{round}/secret', [GameRoundSecretsController::class, 'show'])->name('games.rounds.secret.show')->whereUuid('round');
        Route::post('rounds/{round}/hints', [GameRoundHintsController::class, 'store'])->name('games.rounds.hints.store')->whereUuid('round');
        Route::post('rounds/{round}/guesses', [GameGuessesController::class, 'store'])->name('games.rounds.guesses.store')->whereUuid('round');
```

- [ ] **Step 5: Run the tests**

Run: `vendor/bin/sail artisan wayfinder:generate --with-form && vendor/bin/sail artisan test --compact tests/Feature/Games`
Expected: PASS. (`TrimStrings` and `ConvertEmptyStringsToNull` turn a text of only spaces into `null`, so `required` refuses it.)

- [ ] **Step 6: Translations**

| Key (en) | fr | es | de |
|---|---|---|---|
| No more letters can be revealed for this word. | Plus aucune lettre ne peut être révélée pour ce mot. | No se pueden revelar más letras de esta palabra. | Für dieses Wort können keine weiteren Buchstaben aufgedeckt werden. |

- [ ] **Step 7: Format, analyse, commit**

```bash
vendor/bin/sail bin pint --dirty --format agent
vendor/bin/sail bin phpstan analyse --no-progress
git add app/Actions/Games/RevealGameHint.php app/Actions/Games/MakeGameGuess.php app/Http/Controllers/Games/GameRoundSecretsController.php app/Http/Controllers/Games/GameRoundHintsController.php app/Http/Controllers/Games/GameGuessesController.php routes/web.php tests/Feature/Games/WordGuessPlayTest.php lang
git commit -m "feat(games): guess words, reveal hints and hand the word to the leader

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SosW8d2Uj7QxsF1tws5ssS"
```

---
### Task 4: Drawing — committed operations, undo and clear

**Files:**
- Create: `app/Actions/Games/{AddDrawingOp,UndoDrawingOp,ClearDrawing}.php`
- Create: `app/Http/Controllers/Games/{GameDrawingOpsController,GameDrawingsController}.php`
- Modify: `routes/web.php`
- Test: create `tests/Feature/Games/DrawingTest.php`

**Interfaces:**
- Consumes: Task 1 `DrawingOp`; Task 2 `GameGuard::leader`, `GameDrawingOpAdded`, `GameDrawingUndone`, `GameDrawingCleared`, `wordGuessTable`; 13a `LockGameRound`, `GameGuard`, `GameRateLimit`.
- Produces:
  - `AddDrawingOp::handle(GameRoom, GameRound, GamePlayer, mixed $op, string $clientOpId): array{roundId: string, op: array<string, mixed>, clientOpId: string}`. The operation is parsed after the guards.
  - `UndoDrawingOp::handle(GameRoom, GameRound, GamePlayer): void` and `ClearDrawing::handle(GameRoom, GameRound, GamePlayer): void`.
  - Route `games.rounds.drawing-ops.store` (POST `rounds/{round}/drawing-ops`, body `{client_op_id, op}` → 201).
  - Route `games.rounds.drawing-ops.last.destroy` (DELETE `rounds/{round}/drawing-ops/last` → 204).
  - Route `games.rounds.drawing.destroy` (DELETE `rounds/{round}/drawing` → 204).
  - All three share the rate limit key `game-draw:{playerId}` (20 per second).

- [ ] **Step 1: Write the failing test**

Create `tests/Feature/Games/DrawingTest.php`:

```php
<?php

use App\Enums\GameKind;
use App\Enums\GameRoundOutcome;
use App\Events\Games\GameDrawingCleared;
use App\Events\Games\GameDrawingOpAdded;
use App\Events\Games\GameDrawingUndone;
use App\Models\GameRoom;
use App\Models\GameRound;
use App\Support\Games\DrawingOp;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Event;
use Illuminate\Testing\TestResponse;

beforeEach(function () {
    Event::fake();
    $this->travelTo(CarbonImmutable::parse('2026-10-06 10:00:00'));
});

/**
 * @param  array<string, mixed>  $op
 */
function postDrawingOp(GameRoom $room, GameRound $round, array $op, string $clientOpId = 'op-1'): TestResponse
{
    return test()->postJson(route('games.rounds.drawing-ops.store', [$room, $round]), ['client_op_id' => $clientOpId, 'op' => $op]);
}

/**
 * @return array<string, mixed>
 */
function drawingStroke(int $points = 2, string $color = 'blue', int $size = 10): array
{
    return ['type' => 'stroke', 'color' => $color, 'size' => $size, 'points' => array_fill(0, $points, [100, 200])];
}

it('lets the drawer commit a stroke and broadcasts it', function () {
    $table = wordGuessTable();
    $stroke = ['type' => 'stroke', 'color' => 'blue', 'size' => 10, 'points' => [[0, 0], [1000, 750]]];

    $this->actingAs($table['leaderUser']);

    postDrawingOp($table['room'], $table['round'], $stroke, 'abc-123')
        ->assertCreated()
        ->assertExactJson(['roundId' => $table['round']->id, 'op' => $stroke, 'clientOpId' => 'abc-123']);

    expect($table['round']->fresh())
        ->drawing->toBe([$stroke])
        ->drawing_points->toBe(2);

    Event::assertDispatched(GameDrawingOpAdded::class, fn (GameDrawingOpAdded $event) => $event->op === $stroke
        && $event->clientOpId === 'abc-123'
        && $event->roundId === $table['round']->id);
});

it('commits fills and eraser strokes', function () {
    $table = wordGuessTable();
    $fill = ['type' => 'fill', 'color' => 'orange', 'x' => 500, 'y' => 375];
    $eraser = drawingStroke(3, 'white', 24);

    $this->actingAs($table['leaderUser']);

    postDrawingOp($table['room'], $table['round'], $fill)->assertCreated();
    postDrawingOp($table['room'], $table['round'], $eraser, 'op-2')->assertCreated();

    expect($table['round']->fresh())
        ->drawing->toBe([$fill, $eraser])
        ->drawing_points->toBe(3);
});

it('keeps drawing to the drawer', function () {
    $table = wordGuessTable();
    $guest = gameRoomGuest($table['room']);

    foreach ([$table['hostUser'], $table['guesserUser']] as $user) {
        $this->actingAs($user);
        postDrawingOp($table['room'], $table['round'], drawingStroke())->assertForbidden();
        $this->deleteJson(route('games.rounds.drawing-ops.last.destroy', [$table['room'], $table['round']]))->assertForbidden();
        $this->deleteJson(route('games.rounds.drawing.destroy', [$table['room'], $table['round']]))->assertForbidden();
    }

    app('auth')->forgetGuards();

    $this->withCookies(gameGuestCookie($guest))
        ->postJson(route('games.rounds.drawing-ops.store', [$table['room'], $table['round']]), ['client_op_id' => 'x', 'op' => drawingStroke()])
        ->assertForbidden();

    expect($table['round']->fresh()->drawing)->toBe([]);
});

it('refuses drawing in Decoded and on ended rounds', function () {
    $decoded = wordGuessTable(GameKind::Decoded);

    $this->actingAs($decoded['leaderUser']);
    postDrawingOp($decoded['room'], $decoded['round'], drawingStroke())->assertUnprocessable();

    $draw = wordGuessTable();
    $draw['round']->forceFill(['ended_at' => now(), 'outcome' => GameRoundOutcome::Passed])->save();

    $this->actingAs($draw['leaderUser']);
    postDrawingOp($draw['room'], $draw['round'], drawingStroke())->assertConflict();
});

it('validates the operation and its id', function (array $body) {
    $table = wordGuessTable();

    $this->actingAs($table['leaderUser'])
        ->postJson(route('games.rounds.drawing-ops.store', [$table['room'], $table['round']]), $body)
        ->assertUnprocessable();

    expect($table['round']->fresh()->drawing)->toBe([]);
})->with([
    'missing op' => [['client_op_id' => 'op-1']],
    'missing id' => [['op' => ['type' => 'fill', 'color' => 'red', 'x' => 1, 'y' => 1]]],
    'id with spaces' => [['client_op_id' => 'op 1', 'op' => ['type' => 'fill', 'color' => 'red', 'x' => 1, 'y' => 1]]],
    'id too long' => [['client_op_id' => str_repeat('a', 65), 'op' => ['type' => 'fill', 'color' => 'red', 'x' => 1, 'y' => 1]]],
    'pink' => [['client_op_id' => 'op-1', 'op' => ['type' => 'stroke', 'color' => 'pink', 'size' => 4, 'points' => [[1, 1]]]]],
    'size five' => [['client_op_id' => 'op-1', 'op' => ['type' => 'stroke', 'color' => 'red', 'size' => 5, 'points' => [[1, 1]]]]],
    'outside' => [['client_op_id' => 'op-1', 'op' => ['type' => 'stroke', 'color' => 'red', 'size' => 4, 'points' => [[1001, 1]]]]],
    'decimal' => [['client_op_id' => 'op-1', 'op' => ['type' => 'stroke', 'color' => 'red', 'size' => 4, 'points' => [[1.5, 1]]]]],
    'too long stroke' => [['client_op_id' => 'op-1', 'op' => ['type' => 'stroke', 'color' => 'red', 'size' => 4, 'points' => array_fill(0, 1001, [1, 1])]]],
]);

it('accepts the last operation and point the budget allows', function () {
    $table = wordGuessTable(GameKind::DrawAndGuess, 'rocket', [
        'drawing' => array_fill(0, DrawingOp::MaxOps - 1, ['type' => 'fill', 'color' => 'red', 'x' => 1, 'y' => 1]),
        'drawing_points' => DrawingOp::MaxPoints - 2,
    ]);

    $this->actingAs($table['leaderUser']);

    postDrawingOp($table['room'], $table['round'], drawingStroke(2))->assertCreated();

    expect($table['round']->fresh())
        ->drawing->toHaveCount(DrawingOp::MaxOps)
        ->drawing_points->toBe(DrawingOp::MaxPoints);
});

it('refuses operations beyond the budget', function (array $roundAttributes, array $op) {
    $table = wordGuessTable(GameKind::DrawAndGuess, 'rocket', $roundAttributes);

    $this->actingAs($table['leaderUser']);

    postDrawingOp($table['room'], $table['round'], $op)
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['op' => __('The drawing is full. Clear it to keep drawing.')]);
})->with([
    'too many operations' => [
        ['drawing' => array_fill(0, 500, ['type' => 'fill', 'color' => 'red', 'x' => 1, 'y' => 1])],
        ['type' => 'fill', 'color' => 'blue', 'x' => 2, 'y' => 2],
    ],
    'too many points' => [
        ['drawing' => [drawingStroke(1000)], 'drawing_points' => 19999],
        drawingStroke(2),
    ],
]);

it('undoes the last operation and frees its points', function () {
    $first = drawingStroke(3, 'red');
    $second = drawingStroke(5, 'green');
    $table = wordGuessTable(GameKind::DrawAndGuess, 'rocket', ['drawing' => [$first, $second], 'drawing_points' => 8]);

    $this->actingAs($table['leaderUser'])
        ->deleteJson(route('games.rounds.drawing-ops.last.destroy', [$table['room'], $table['round']]))
        ->assertNoContent();

    expect($table['round']->fresh())
        ->drawing->toBe([$first])
        ->drawing_points->toBe(3);

    Event::assertDispatched(GameDrawingUndone::class, fn (GameDrawingUndone $event) => $event->roundId === $table['round']->id);
});

it('ignores an undo on an empty drawing', function () {
    $table = wordGuessTable();

    $this->actingAs($table['leaderUser'])
        ->deleteJson(route('games.rounds.drawing-ops.last.destroy', [$table['room'], $table['round']]))
        ->assertNoContent();

    Event::assertNotDispatched(GameDrawingUndone::class);
});

it('clears the drawing', function () {
    $table = wordGuessTable(GameKind::DrawAndGuess, 'rocket', ['drawing' => [drawingStroke(4)], 'drawing_points' => 4]);

    $this->actingAs($table['leaderUser'])
        ->deleteJson(route('games.rounds.drawing.destroy', [$table['room'], $table['round']]))
        ->assertNoContent();

    expect($table['round']->fresh())
        ->drawing->toBe([])
        ->drawing_points->toBe(0);

    Event::assertDispatched(GameDrawingCleared::class);
});

it('slows down a drawer sending too many operations', function () {
    $table = wordGuessTable();

    $this->actingAs($table['leaderUser']);

    foreach (range(1, 20) as $index) {
        postDrawingOp($table['room'], $table['round'], drawingStroke(), "op-{$index}")->assertCreated();
    }

    postDrawingOp($table['room'], $table['round'], drawingStroke(), 'op-21')->assertTooManyRequests();

    $this->travel(2)->seconds();

    postDrawingOp($table['room'], $table['round'], drawingStroke(), 'op-21')->assertCreated();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Games/DrawingTest.php`
Expected: FAIL — `Route [games.rounds.drawing-ops.store] not defined.`

- [ ] **Step 3: Write the actions**

Create `app/Actions/Games/AddDrawingOp.php`:

```php
<?php

namespace App\Actions\Games;

use App\Enums\GameKind;
use App\Events\Games\GameDrawingOpAdded;
use App\Models\GamePlayer;
use App\Models\GameRoom;
use App\Models\GameRound;
use App\Support\Games\DrawingOp;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class AddDrawingOp
{
    /**
     * The committed copy of a stroke others already saw live: late joiners,
     * reconnects and history render from these operations only.
     *
     * @return array{roundId: string, op: array<string, mixed>, clientOpId: string}
     */
    public function handle(GameRoom $room, GameRound $round, GamePlayer $player, mixed $op, string $clientOpId): array
    {
        return DB::transaction(function () use ($room, $round, $player, $op, $clientOpId): array {
            [$lockedRoom, $lockedRound] = LockGameRound::handle($room, $round);

            GameGuard::mutable($lockedRoom);
            GameGuard::leader($lockedRound, $player);
            GameGuard::activeRound($lockedRoom, $lockedRound);
            GameGuard::roundGame($lockedRound, GameKind::DrawAndGuess);

            $parsed = DrawingOp::parse($op);
            $points = $lockedRound->drawing_points + DrawingOp::pointCount($parsed);

            if (count($lockedRound->drawing) >= DrawingOp::MaxOps || $points > DrawingOp::MaxPoints) {
                throw ValidationException::withMessages(['op' => __('The drawing is full. Clear it to keep drawing.')]);
            }

            $lockedRound->forceFill([
                'drawing' => [...$lockedRound->drawing, $parsed],
                'drawing_points' => $points,
            ])->save();

            (new GameDrawingOpAdded($lockedRoom, $lockedRound->id, $parsed, $clientOpId))->sendToOthers();

            return ['roundId' => $lockedRound->id, 'op' => $parsed, 'clientOpId' => $clientOpId];
        });
    }
}
```

Create `app/Actions/Games/UndoDrawingOp.php`:

```php
<?php

namespace App\Actions\Games;

use App\Enums\GameKind;
use App\Events\Games\GameDrawingUndone;
use App\Models\GamePlayer;
use App\Models\GameRoom;
use App\Models\GameRound;
use App\Support\Games\DrawingOp;
use Illuminate\Support\Facades\DB;

class UndoDrawingOp
{
    public function handle(GameRoom $room, GameRound $round, GamePlayer $player): void
    {
        DB::transaction(function () use ($room, $round, $player): void {
            [$lockedRoom, $lockedRound] = LockGameRound::handle($room, $round);

            GameGuard::mutable($lockedRoom);
            GameGuard::leader($lockedRound, $player);
            GameGuard::activeRound($lockedRoom, $lockedRound);
            GameGuard::roundGame($lockedRound, GameKind::DrawAndGuess);

            $drawing = $lockedRound->drawing;

            if ($drawing === []) {
                return;
            }

            array_pop($drawing);

            $lockedRound->forceFill([
                'drawing' => $drawing,
                'drawing_points' => array_sum(array_map(fn (array $op): int => DrawingOp::pointCount($op), $drawing)),
            ])->save();

            (new GameDrawingUndone($lockedRoom, $lockedRound->id))->sendToOthers();
        });
    }
}
```

Create `app/Actions/Games/ClearDrawing.php`:

```php
<?php

namespace App\Actions\Games;

use App\Enums\GameKind;
use App\Events\Games\GameDrawingCleared;
use App\Models\GamePlayer;
use App\Models\GameRoom;
use App\Models\GameRound;
use Illuminate\Support\Facades\DB;

class ClearDrawing
{
    public function handle(GameRoom $room, GameRound $round, GamePlayer $player): void
    {
        DB::transaction(function () use ($room, $round, $player): void {
            [$lockedRoom, $lockedRound] = LockGameRound::handle($room, $round);

            GameGuard::mutable($lockedRoom);
            GameGuard::leader($lockedRound, $player);
            GameGuard::activeRound($lockedRoom, $lockedRound);
            GameGuard::roundGame($lockedRound, GameKind::DrawAndGuess);

            $lockedRound->forceFill(['drawing' => [], 'drawing_points' => 0])->save();

            (new GameDrawingCleared($lockedRoom, $lockedRound->id))->sendToOthers();
        });
    }
}
```

- [ ] **Step 4: Write the controllers and routes**

Create `app/Http/Controllers/Games/GameDrawingOpsController.php`:

```php
<?php

namespace App\Http\Controllers\Games;

use App\Actions\Games\AddDrawingOp;
use App\Actions\Games\UndoDrawingOp;
use App\Http\Controllers\Controller;
use App\Models\GamePlayer;
use App\Models\GameRoom;
use App\Models\GameRound;
use App\Support\Games\GameRateLimit;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

class GameDrawingOpsController extends Controller
{
    public const RateLimitPerSecond = 20;

    public function store(Request $request, GameRoom $room, GameRound $round, AddDrawingOp $addDrawingOp): JsonResponse
    {
        $player = GamePlayer::current($request);

        GameRateLimit::hit("game-draw:{$player->id}", self::RateLimitPerSecond, 1);

        $validated = $request->validate([
            'client_op_id' => ['required', 'string', 'regex:/^[A-Za-z0-9_-]{1,64}$/'],
            'op' => ['required', 'array'],
        ]);

        return response()->json($addDrawingOp->handle($room, $round, $player, $validated['op'], $validated['client_op_id']), 201);
    }

    public function destroyLast(Request $request, GameRoom $room, GameRound $round, UndoDrawingOp $undoDrawingOp): Response
    {
        $player = GamePlayer::current($request);

        GameRateLimit::hit("game-draw:{$player->id}", self::RateLimitPerSecond, 1);

        $undoDrawingOp->handle($room, $round, $player);

        return response()->noContent();
    }
}
```

Create `app/Http/Controllers/Games/GameDrawingsController.php`:

```php
<?php

namespace App\Http\Controllers\Games;

use App\Actions\Games\ClearDrawing;
use App\Http\Controllers\Controller;
use App\Models\GamePlayer;
use App\Models\GameRoom;
use App\Models\GameRound;
use App\Support\Games\GameRateLimit;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

class GameDrawingsController extends Controller
{
    public function destroy(Request $request, GameRoom $room, GameRound $round, ClearDrawing $clearDrawing): Response
    {
        $player = GamePlayer::current($request);

        GameRateLimit::hit("game-draw:{$player->id}", GameDrawingOpsController::RateLimitPerSecond, 1);

        $clearDrawing->handle($room, $round, $player);

        return response()->noContent();
    }
}
```

In `routes/web.php` add the imports `use App\Http\Controllers\Games\GameDrawingOpsController;` and `use App\Http\Controllers\Games\GameDrawingsController;` and, inside the `games/{room}` group after the guesses route:

```php
        Route::post('rounds/{round}/drawing-ops', [GameDrawingOpsController::class, 'store'])->name('games.rounds.drawing-ops.store')->whereUuid('round');
        Route::delete('rounds/{round}/drawing-ops/last', [GameDrawingOpsController::class, 'destroyLast'])->name('games.rounds.drawing-ops.last.destroy')->whereUuid('round');
        Route::delete('rounds/{round}/drawing', [GameDrawingsController::class, 'destroy'])->name('games.rounds.drawing.destroy')->whereUuid('round');
```

- [ ] **Step 5: Run the tests**

Run: `vendor/bin/sail artisan wayfinder:generate --with-form && vendor/bin/sail artisan test --compact tests/Feature/Games`
Expected: PASS.

- [ ] **Step 6: Translations**

| Key (en) | fr | es | de |
|---|---|---|---|
| The drawing is full. Clear it to keep drawing. | Le dessin est plein. Effacez-le pour continuer à dessiner. | El dibujo está lleno. Bórralo para seguir dibujando. | Die Zeichnung ist voll. Lösche sie, um weiterzuzeichnen. |

- [ ] **Step 7: Format, analyse, commit**

```bash
vendor/bin/sail bin pint --dirty --format agent
vendor/bin/sail bin phpstan analyse --no-progress
git add app/Actions/Games/AddDrawingOp.php app/Actions/Games/UndoDrawingOp.php app/Actions/Games/ClearDrawing.php app/Http/Controllers/Games/GameDrawingOpsController.php app/Http/Controllers/Games/GameDrawingsController.php routes/web.php tests/Feature/Games/DrawingTest.php lang
git commit -m "feat(games): commit, undo and clear Draw & Guess drawings

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SosW8d2Uj7QxsF1tws5ssS"
```

---
### Task 5: Decoded clue and the emoji data of the snapshot

**Files:**
- Create: `app/Actions/Games/SetGameClue.php`, `app/Http/Controllers/Games/GameRoundCluesController.php`
- Modify: `app/Actions/Games/BuildGameSnapshot.php` (add `emojiData`), `routes/web.php`
- Test: create `tests/Feature/Games/DecodedClueTest.php`

**Interfaces:**
- Consumes: Task 1 `ClueEmoji`; Task 2 `GameGuard::leader`, `GameClueChanged`, `wordGuessTable`; 13a `LockGameRound`, `GameGuard`, `GameRateLimit`; `App\Http\Controllers\EmojiDataController::emojibaseLocale()`.
- Produces:
  - `SetGameClue::handle(GameRoom, GameRound, GamePlayer, mixed $clue): array{roundId: string, clue: array<int, string>}`. The input is validated after the guards: `clue` is a list of 0–5 `ClueEmoji`.
  - Route `games.rounds.clue.update` (PUT `rounds/{round}/clue`, body `clue`, rate key `game-clue:{playerId}`, 5 per second → 200 `{roundId, clue}`).
  - Snapshot key `emojiData: {baseUrl: '/emoji-data/{version}', locale}`.

- [ ] **Step 1: Write the failing test**

Create `tests/Feature/Games/DecodedClueTest.php`:

```php
<?php

use App\Actions\Games\BuildGameSnapshot;
use App\Enums\GameKind;
use App\Enums\GameRoundOutcome;
use App\Events\Games\GameClueChanged;
use App\Models\GameRoom;
use App\Models\GameRound;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Event;
use Illuminate\Testing\TestResponse;

beforeEach(function () {
    Event::fake();
    $this->travelTo(CarbonImmutable::parse('2026-10-06 10:00:00'));
});

function putClue(GameRoom $room, GameRound $round, mixed $clue): TestResponse
{
    return test()->putJson(route('games.rounds.clue.update', [$room, $round]), ['clue' => $clue]);
}

it('lets the clue giver set up to five emoji', function () {
    $table = wordGuessTable(GameKind::Decoded);
    $clue = ['🚀', '🔥', '👨‍💻', '👍🏽', '🏳️‍🌈'];

    $this->actingAs($table['leaderUser']);

    putClue($table['room'], $table['round'], $clue)
        ->assertOk()
        ->assertExactJson(['roundId' => $table['round']->id, 'clue' => $clue]);

    expect($table['round']->fresh()->clue)->toBe($clue);

    Event::assertDispatched(GameClueChanged::class, fn (GameClueChanged $event) => $event->clue === $clue
        && ! gamePayloadExposesWord($event->broadcastWith(), 'rocket'));
});

it('clears the clue', function () {
    $table = wordGuessTable(GameKind::Decoded, 'rocket', ['clue' => ['🚀']]);

    $this->actingAs($table['leaderUser']);

    putClue($table['room'], $table['round'], [])->assertOk()->assertJsonPath('clue', []);

    expect($table['round']->fresh()->clue)->toBe([]);
});

it('refuses more than five emoji', function () {
    $table = wordGuessTable(GameKind::Decoded);

    $this->actingAs($table['leaderUser']);

    putClue($table['room'], $table['round'], ['🚀', '🔥', '🐛', '🎉', '🧠', '🍕'])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['clue' => __('A clue holds five emoji at most.')]);
});

it('refuses letters, digits and letter-like emoji in a clue', function (string $item) {
    $table = wordGuessTable(GameKind::Decoded);

    $this->actingAs($table['leaderUser']);

    putClue($table['room'], $table['round'], ['🚀', $item])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['clue.1' => __('Use emoji only, without letters or digits.')]);

    expect($table['round']->fresh()->clue)->toBe([]);
})->with(['1️⃣', '#️⃣', '🇫🇷', '🅰️', '🆗', 'ℹ️', 'Ⓜ️', '🔤', 'a', 'rocket', '🚀🚀']);

it('refuses a clue that is not a list', function (mixed $clue) {
    $table = wordGuessTable(GameKind::Decoded);

    $this->actingAs($table['leaderUser']);

    putClue($table['room'], $table['round'], $clue)->assertUnprocessable();
})->with([
    'text' => '🚀',
    'keyed' => [['first' => '🚀']],
    'missing' => null,
]);

it('keeps the clue to the clue giver of an active Decoded round', function () {
    $decoded = wordGuessTable(GameKind::Decoded);

    $this->actingAs($decoded['hostUser']);
    putClue($decoded['room'], $decoded['round'], ['🚀'])->assertForbidden();

    $this->actingAs($decoded['guesserUser']);
    putClue($decoded['room'], $decoded['round'], ['🚀'])->assertForbidden();

    $draw = wordGuessTable(GameKind::DrawAndGuess);

    $this->actingAs($draw['leaderUser']);
    putClue($draw['room'], $draw['round'], ['🚀'])->assertUnprocessable();

    $decoded['round']->forceFill(['ended_at' => now(), 'outcome' => GameRoundOutcome::Passed])->save();

    $this->actingAs($decoded['leaderUser']);
    putClue($decoded['room'], $decoded['round'], ['🚀'])->assertConflict();

    expect($decoded['round']->fresh()->clue)->toBe([]);
});

it('slows down a clue giver editing too fast', function () {
    $table = wordGuessTable(GameKind::Decoded);

    $this->actingAs($table['leaderUser']);

    foreach (range(1, 5) as $index) {
        putClue($table['room'], $table['round'], ['🚀'])->assertOk();
    }

    putClue($table['room'], $table['round'], ['🔥'])->assertTooManyRequests();
});

it('hands the emoji list location to every player', function () {
    $room = GameRoom::factory()->linkAccess()->create();
    gameRoomHost($room);
    $guest = gameRoomGuest($room);

    expect(app(BuildGameSnapshot::class)->handle($room, $guest)['emojiData'])->toBe([
        'baseUrl' => '/emoji-data/'.config('services.emoji_data.version'),
        'locale' => 'en',
    ]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Games/DecodedClueTest.php`
Expected: FAIL — `Route [games.rounds.clue.update] not defined.`

- [ ] **Step 3: Write the action**

Create `app/Actions/Games/SetGameClue.php`:

```php
<?php

namespace App\Actions\Games;

use App\Enums\GameKind;
use App\Events\Games\GameClueChanged;
use App\Models\GamePlayer;
use App\Models\GameRoom;
use App\Models\GameRound;
use App\Rules\ClueEmoji;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

class SetGameClue
{
    public const MaxEmoji = 5;

    /**
     * The whole clue is replaced on every edit: the clue giver's client
     * sends its current row, debounced, so the last edit wins.
     *
     * @return array{roundId: string, clue: array<int, string>}
     */
    public function handle(GameRoom $room, GameRound $round, GamePlayer $player, mixed $clue): array
    {
        return DB::transaction(function () use ($room, $round, $player, $clue): array {
            [$lockedRoom, $lockedRound] = LockGameRound::handle($room, $round);

            GameGuard::mutable($lockedRoom);
            GameGuard::leader($lockedRound, $player);
            GameGuard::activeRound($lockedRoom, $lockedRound);
            GameGuard::roundGame($lockedRound, GameKind::Decoded);

            /** @var array{clue: array<int, string>} $validated */
            $validated = Validator::make(['clue' => $clue], [
                'clue' => ['present', 'array', 'list', 'max:'.self::MaxEmoji],
                'clue.*' => [new ClueEmoji],
            ], [
                'clue.max' => __('A clue holds five emoji at most.'),
            ])->validate();

            $emoji = array_values($validated['clue']);

            $lockedRound->forceFill(['clue' => $emoji])->save();

            (new GameClueChanged($lockedRoom, $lockedRound->id, $emoji))->sendToOthers();

            return ['roundId' => $lockedRound->id, 'clue' => $emoji];
        });
    }
}
```

- [ ] **Step 4: Write the controller, the route and the snapshot key**

Create `app/Http/Controllers/Games/GameRoundCluesController.php`:

```php
<?php

namespace App\Http\Controllers\Games;

use App\Actions\Games\SetGameClue;
use App\Http\Controllers\Controller;
use App\Models\GamePlayer;
use App\Models\GameRoom;
use App\Models\GameRound;
use App\Support\Games\GameRateLimit;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class GameRoundCluesController extends Controller
{
    public function update(Request $request, GameRoom $room, GameRound $round, SetGameClue $setGameClue): JsonResponse
    {
        $player = GamePlayer::current($request);

        GameRateLimit::hit("game-clue:{$player->id}", 5, 1);

        return response()->json($setGameClue->handle($room, $round, $player, $request->input('clue')));
    }
}
```

In `routes/web.php` add `use App\Http\Controllers\Games\GameRoundCluesController;` and, inside the `games/{room}` group after the drawing routes:

```php
        Route::put('rounds/{round}/clue', [GameRoundCluesController::class, 'update'])->name('games.rounds.clue.update')->whereUuid('round');
```

In `app/Actions/Games/BuildGameSnapshot.php`:
- Add `use App\Http\Controllers\EmojiDataController;`.
- In the `@phpstan-type Snapshot` add the line ` *     emojiData: array{baseUrl: string, locale: string},` after the `links` line.
- In `handle()`, after the `'links' => [...]` entry, add:

```php
            'emojiData' => [
                'baseUrl' => '/emoji-data/'.config('services.emoji_data.version'),
                'locale' => EmojiDataController::emojibaseLocale(app()->getLocale()),
            ],
```

- [ ] **Step 5: Run the tests**

Run: `vendor/bin/sail artisan wayfinder:generate --with-form && vendor/bin/sail artisan test --compact tests/Feature/Games`
Expected: PASS.

- [ ] **Step 6: Translations**

| Key (en) | fr | es | de |
|---|---|---|---|
| A clue holds five emoji at most. | Un indice contient cinq emoji au maximum. | Una pista tiene como máximo cinco emoji. | Ein Hinweis hat höchstens fünf Emoji. |

- [ ] **Step 7: Format, analyse, commit**

```bash
vendor/bin/sail bin pint --dirty --format agent
vendor/bin/sail bin phpstan analyse --no-progress
git add app/Actions/Games/SetGameClue.php app/Http/Controllers/Games/GameRoundCluesController.php app/Actions/Games/BuildGameSnapshot.php routes/web.php tests/Feature/Games/DecodedClueTest.php lang
git commit -m "feat(games): let the Decoded clue giver set emoji clues

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SosW8d2Uj7QxsF1tws5ssS"
```

---
### Task 6: Redaction suite — the word, correct guesses and the near-miss flag

**Files:**
- Test: create `tests/Feature/Games/WordGuessRedactionTest.php`

**Interfaces:**
- Consumes: every endpoint, presenter and event of Tasks 2–5 and 13a; `gamePayloadExposesWord()`, `gamePayloadJson()`.
- Produces: the invariant suite for spec §8 on Draw & Guess and Decoded. No production code changes unless a test fails. If one does, fix the presenter or event at fault, never the test.

- [ ] **Step 1: Write the suite**

Create `tests/Feature/Games/WordGuessRedactionTest.php`:

```php
<?php

use App\Enums\GameKind;
use App\Events\Games\GameBroadcastEvent;
use App\Events\Games\GameClueChanged;
use App\Events\Games\GameDrawingOpAdded;
use App\Events\Games\GameGuessMade;
use App\Events\Games\GameHintRevealed;
use App\Events\Games\GameRoomChanged;
use App\Events\Games\GameRoundEnded;
use App\Events\Games\GameRoundStarted;
use App\Events\Games\GameTimerChanged;
use App\Models\GameRoom;
use App\Models\GameRound;
use App\Models\User;
use App\Support\Games\GameWordBook;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Event;
use Inertia\Testing\AssertableInertia as Assert;

const GuessedWord = 'labyrinth';

beforeEach(function () {
    Event::fake();
    app()->instance(GameWordBook::class, new GameWordBook(words: ['en' => [['word' => GuessedWord, 'drawable' => true]]]));
});

dataset('redacted guessing games', [GameKind::DrawAndGuess, GameKind::Decoded]);

/**
 * @return Collection<int, GameBroadcastEvent>
 */
function wordGuessRoundBroadcasts(): Collection
{
    return collect([
        GameRoundStarted::class,
        GameHintRevealed::class,
        GameDrawingOpAdded::class,
        GameClueChanged::class,
        GameGuessMade::class,
        GameTimerChanged::class,
        GameRoomChanged::class,
    ])
        ->flatMap(fn (string $class) => Event::dispatched($class))
        ->map(fn (array $arguments): GameBroadcastEvent => $arguments[0]);
}

/**
 * A round started by the host with a member as leader, after the leader
 * revealed a hint and acted on the board.
 *
 * @return array{room: GameRoom, host: User, leader: User, guesser: User, guestCookie: array<string, string>, round: GameRound, startResponse: array<string, mixed>}
 */
function redactedWordGuessRound(GameKind $game): array
{
    $room = GameRoom::factory()->game($game)->linkAccess()->create();
    [$host] = gameRoomHost($room);
    [$leader, $leaderPlayer] = gameRoomMember($room);
    [$guesser] = gameRoomMember($room);
    $guest = gameRoomGuest($room);

    $startResponse = test()->actingAs($host)
        ->postJson(route('games.rounds.store', $room), ['leader_player_id' => $leaderPlayer->id])
        ->assertCreated()
        ->json();

    $round = GameRound::query()->sole();

    test()->actingAs($leader)->postJson(route('games.rounds.hints.store', [$room, $round]))->assertOk();

    $game === GameKind::DrawAndGuess
        ? test()->actingAs($leader)->postJson(route('games.rounds.drawing-ops.store', [$room, $round]), [
            'client_op_id' => 'op-1',
            'op' => ['type' => 'stroke', 'color' => 'black', 'size' => 4, 'points' => [[10, 10], [20, 20]]],
        ])->assertCreated()
        : test()->actingAs($leader)->putJson(route('games.rounds.clue.update', [$room, $round]), ['clue' => ['🌀', '🧭']])->assertOk();

    test()->actingAs($guesser)->postJson(route('games.rounds.guesses.store', [$room, $round]), ['text' => 'maze'])->assertOk();

    return [
        'room' => $room,
        'host' => $host,
        'leader' => $leader,
        'guesser' => $guesser,
        'guestCookie' => gameGuestCookie($guest),
        'round' => $round,
        'startResponse' => $startResponse,
    ];
}

it('keeps the word out of every non-leader snapshot, page and response', function (GameKind $game) {
    $table = redactedWordGuessRound($game);

    expect(gamePayloadExposesWord($table['startResponse'], GuessedWord))->toBeFalse();

    foreach ([$table['host'], $table['guesser']] as $user) {
        $snapshot = $this->actingAs($user)->getJson(route('games.snapshot.show', $table['room']))->assertOk()->json();

        expect(gamePayloadExposesWord($snapshot, GuessedWord))->toBeFalse()
            ->and(gamePayloadJson($snapshot))->not->toContain('"points"');
    }

    $this->actingAs($table['guesser'])
        ->get(route('games.show', $table['room']))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page->where('snapshot.round.id', $table['round']->id)
            ->where('snapshot', fn ($snapshot) => ! gamePayloadExposesWord($snapshot->toArray(), GuessedWord)));

    app('auth')->forgetGuards();

    $guestSnapshot = $this->withCookies($table['guestCookie'])->getJson(route('games.snapshot.show', $table['room']))->assertOk()->json();

    expect(gamePayloadExposesWord($guestSnapshot, GuessedWord))->toBeFalse();
})->with('redacted guessing games');

it('gives the word to the leader in the snapshot and the secret endpoint', function (GameKind $game) {
    $table = redactedWordGuessRound($game);

    $this->actingAs($table['leader'])->getJson(route('games.snapshot.show', $table['room']))->assertJsonPath('round.word', GuessedWord);
    $this->actingAs($table['leader'])->getJson(route('games.rounds.secret.show', [$table['room'], $table['round']]))->assertJsonPath('word', GuessedWord);

    foreach ([$table['host'], $table['guesser']] as $user) {
        $this->actingAs($user)->getJson(route('games.rounds.secret.show', [$table['room'], $table['round']]))->assertForbidden();
    }
})->with('redacted guessing games');

it('keeps the word out of every broadcast while the round is active', function (GameKind $game) {
    redactedWordGuessRound($game);

    $broadcasts = wordGuessRoundBroadcasts();

    expect($broadcasts->map(fn (GameBroadcastEvent $event) => $event->broadcastAs())->unique()->values()->all())
        ->toContain('game.round.started', 'game.hint.revealed', 'game.guess.made')
        ->and($broadcasts->contains(fn (GameBroadcastEvent $event) => gamePayloadExposesWord($event->broadcastWith(), GuessedWord)))->toBeFalse();
})->with('redacted guessing games');

it('keeps active rounds out of history and round detail', function (GameKind $game) {
    $table = redactedWordGuessRound($game);

    $this->actingAs($table['guesser'])->getJson(route('games.rounds.index', $table['room']))->assertOk()->assertExactJson([]);
    $this->actingAs($table['guesser'])->getJson(route('games.rounds.show', [$table['room'], $table['round']]))->assertNotFound();
})->with('redacted guessing games');

it('never serializes the text of a correct guess', function (GameKind $game) {
    $table = redactedWordGuessRound($game);
    $typed = 'LaByRiNtH';

    $guessResponse = $this->actingAs($table['guesser'])
        ->postJson(route('games.rounds.guesses.store', [$table['room'], $table['round']]), ['text' => $typed])
        ->assertOk()
        ->assertJsonPath('result', 'correct')
        ->json();

    $payloads = [
        $guessResponse,
        $this->actingAs($table['host'])->getJson(route('games.snapshot.show', $table['room']))->json(),
        $this->actingAs($table['host'])->getJson(route('games.rounds.index', $table['room']))->json(),
        $this->actingAs($table['host'])->getJson(route('games.rounds.show', [$table['room'], $table['round']]))->json(),
        ...wordGuessRoundBroadcasts()->map(fn (GameBroadcastEvent $event) => $event->broadcastWith())->all(),
        ...collect(Event::dispatched(GameRoundEnded::class))->map(fn (array $arguments) => $arguments[0]->broadcastWith())->all(),
    ];

    foreach ($payloads as $payload) {
        expect(str_contains(gamePayloadJson($payload), $typed))->toBeFalse();
    }

    Event::assertDispatched(GameRoundEnded::class, fn (GameRoundEnded $event) => $event->payload['word'] === GuessedWord);
})->with('redacted guessing games');

it('shows a near-miss text to everyone but flags it for its guesser only', function () {
    $table = redactedWordGuessRound(GameKind::DrawAndGuess);

    $this->actingAs($table['guesser'])
        ->postJson(route('games.rounds.guesses.store', [$table['room'], $table['round']]), ['text' => 'labyrint'])
        ->assertOk()
        ->assertJsonPath('result', 'near');

    $hostGuesses = $this->actingAs($table['host'])->getJson(route('games.snapshot.show', $table['room']))->json('round.guesses');
    $guesserGuesses = $this->actingAs($table['guesser'])->getJson(route('games.snapshot.show', $table['room']))->json('round.guesses');

    expect(collect($hostGuesses)->firstWhere('text', 'labyrint'))->not->toHaveKey('veryClose')
        ->and(collect($guesserGuesses)->firstWhere('text', 'labyrint')['veryClose'])->toBeTrue()
        ->and(collect($guesserGuesses)->firstWhere('text', 'maze'))->not->toHaveKey('veryClose');

    Event::assertDispatched(GameGuessMade::class, fn (GameGuessMade $event) => $event->payload['text'] === 'labyrint'
        && ! str_contains(gamePayloadJson($event->broadcastWith()), 'veryClose'));
});

it('reveals the word to everyone once the round ends', function (GameKind $game) {
    $table = redactedWordGuessRound($game);

    $this->actingAs($table['host'])->postJson(route('games.rounds.pass.store', [$table['room'], $table['round']]))->assertOk();

    $this->actingAs($table['guesser'])
        ->getJson(route('games.snapshot.show', $table['room']))
        ->assertJsonPath('round', null)
        ->assertJsonPath('history.0.word', GuessedWord);

    $this->actingAs($table['guesser'])
        ->getJson(route('games.rounds.show', [$table['room'], $table['round']]))
        ->assertOk()
        ->assertJsonPath('word', GuessedWord)
        ->assertJsonMissingPath('guesses');
})->with('redacted guessing games');
```

- [ ] **Step 2: Run the suite**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Games/WordGuessRedactionTest.php`
Expected: PASS. A failure is a leak: fix the presenter or event that carries the word or the guess text.

- [ ] **Step 3: Commit**

```bash
vendor/bin/sail bin pint --dirty --format agent
git add tests/Feature/Games/WordGuessRedactionTest.php
git commit -m "test(games): pin word, correct guess and near-miss redaction

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SosW8d2Uj7QxsF1tws5ssS"
```

---
### Task 7: Frontend state — types, reducer actions and live events

**Files:**
- Modify: `resources/js/lib/games/types.ts`, `resources/js/lib/games/room-reducer.ts`, `resources/js/hooks/use-game-channel.ts`, `resources/js/hooks/use-game-room.ts`

**Interfaces:**
- Consumes: payload shapes of Tasks 2–5; 13a's `RoomAction`, `roomReducer`, `GameEvents`, `useGameRoom.handleEvent`.
- Produces: the frontend Contract items:
  - Types `DrawingColor`, `DrawingSize`, `DrawingPoint`, `DrawingOp`, `GameGuessEntry`, `GameGuessMade`, `GameDrawingOpAdded`, `GameGuessResponse`, `GameHintResponse`, `GameDrawingOpResponse`, `GameClueResponse`, `GameSecretResponse`.
  - The extended `GameRound`, `GameRoundDetail` and `GameSnapshot`.
  - Reducer actions `guess.added`, `drawing.added`, `drawing.undone`, `drawing.cleared`.
  - Six event names and their `handleEvent` cases: a hint and a clue patch the round, a guess appends to the chat, and drawing events change the committed operations.

There is no frontend test runner (spec §1). This task is verified by the type check and lint, and exercised by Tasks 8–10 and the walkthrough.

- [ ] **Step 1: Extend the types**

In `resources/js/lib/games/types.ts`, add after the `GameLetterPick` type:

```ts
export type DrawingColor =
    | 'black'
    | 'red'
    | 'orange'
    | 'green'
    | 'blue'
    | 'purple'
    | 'white';

export type DrawingSize = 4 | 10 | 24;

/** Integer coordinates on the logical 1000 × 750 canvas. */
export type DrawingPoint = [number, number];

export type DrawingOp =
    | {
          type: 'stroke';
          color: DrawingColor;
          size: DrawingSize;
          points: DrawingPoint[];
      }
    | { type: 'fill'; color: DrawingColor; x: number; y: number };

export type GameGuessEntry = {
    id: string;
    playerId: string;
    text: string;
    /** Only on the viewer's own near misses. */
    veryClose?: boolean;
};
```

Replace the `GameRound` type with:

```ts
export type GameRound = {
    id: string;
    game: GameKind;
    leaderPlayerId: string | null;
    startedAt: string;
    revealedAt: string | null;
    mask?: GameMask;
    misses?: number;
    maxMisses?: number;
    pickedLetters?: string[];
    /** Client only: the latest picks seen live, oldest first. */
    recentPicks?: GameLetterPick[];
    /** The secret word: only ever present for the round's leader. */
    word?: string;
    maxHints?: number;
    guesses?: GameGuessEntry[];
    drawing?: DrawingOp[];
    clue?: string[];
    /** Client only: ids of the latest committed strokes, to drop their live previews. */
    committedOpIds?: string[];
};
```

Replace the `GameRoundDetail` type with:

```ts
export type GameRoundDetail = GameHistoryRound & {
    mask?: GameMask;
    misses?: number;
    maxMisses?: number;
    pickedLetters?: string[];
    drawing?: DrawingOp[];
    clue?: string[];
};
```

Add after the `GameLetterResponse` type:

```ts
export type GameGuessMade = {
    roundId: string;
    guessId: string;
    playerId: string;
    text: string;
};

export type GameDrawingOpAdded = {
    roundId: string;
    op: DrawingOp;
    clientOpId: string;
};

export type GameGuessResponse = {
    result: 'wrong' | 'near' | 'correct';
    guessId: string;
    ended: GameRoundEnded | null;
};

export type GameHintResponse = { roundId: string; mask: GameMask };

export type GameDrawingOpResponse = GameDrawingOpAdded;

export type GameClueResponse = { roundId: string; clue: string[] };

export type GameSecretResponse = { word: string };

export type EmojiDataLocation = { baseUrl: string; locale: string };
```

In the `GameSnapshot` type add, after `links`:

```ts
    emojiData: EmojiDataLocation;
```

- [ ] **Step 2: Extend the reducer**

In `resources/js/lib/games/room-reducer.ts`:

- Change the type import to:

```ts
import type {
    DrawingOp,
    GameGuessEntry,
    GameLetterPicked,
    GameRound,
    GameRoomState,
    GameRoundEnded,
    GameSnapshot,
} from './types';
```

- Extend `RoomAction` with four members, after `timer.set`:

```ts
    | { type: 'guess.added'; roundId: string; guess: GameGuessEntry }
    | {
          type: 'drawing.added';
          roundId: string;
          op: DrawingOp;
          clientOpId: string | null;
      }
    | { type: 'drawing.undone'; roundId: string }
    | { type: 'drawing.cleared'; roundId: string };
```

- Add under `const RecentPicks = 5;`:

```ts
/** Mirrors WordGuessRules::GuessesShown on the server. */
const GuessesShown = 50;

const CommittedOpIds = 20;
```

- Add these cases before the closing brace of the `switch` in `roomReducer`:

```ts
        case 'guess.added':
            return withRound(state, action.roundId, (round) => {
                const guesses = round.guesses ?? [];

                if (guesses.some((guess) => guess.id === action.guess.id)) {
                    return round;
                }

                return {
                    ...round,
                    guesses: [...guesses, action.guess].slice(-GuessesShown),
                };
            });
        case 'drawing.added':
            return withRound(state, action.roundId, (round) => ({
                ...round,
                drawing: [...(round.drawing ?? []), action.op],
                committedOpIds:
                    action.clientOpId === null
                        ? round.committedOpIds
                        : [
                              ...(round.committedOpIds ?? []),
                              action.clientOpId,
                          ].slice(-CommittedOpIds),
            }));
        case 'drawing.undone':
            return withRound(state, action.roundId, (round) => ({
                ...round,
                drawing: (round.drawing ?? []).slice(0, -1),
            }));
        case 'drawing.cleared':
            return withRound(state, action.roundId, (round) => ({
                ...round,
                drawing: [],
            }));
```

- [ ] **Step 3: Listen to the new events**

In `resources/js/hooks/use-game-channel.ts` extend `GameEvents` so it reads:

```ts
/** Plans 13b and 13c append their event names here. */
export const GameEvents = [
    'game.room.changed',
    'game.room.deleted',
    'game.timer.changed',
    'game.round.started',
    'game.round.ended',
    'game.letter.picked',
    'game.hint.revealed',
    'game.guess.made',
    'game.drawing.op-added',
    'game.drawing.undone',
    'game.drawing.cleared',
    'game.clue.changed',
] as const;
```

In `resources/js/hooks/use-game-room.ts`, extend the type import from `@/lib/games/types` with `GameDrawingOpAdded`, `GameGuessMade` and `GameMask`, and add these cases to the `switch (name)` of `handleEvent`, after `game.letter.picked`:

```ts
                case 'game.hint.revealed':
                    apply({
                        type: 'round.patched',
                        roundId: payload.roundId as string,
                        patch: { mask: payload.mask as GameMask },
                    });
                    break;
                case 'game.guess.made': {
                    const made = payload as unknown as GameGuessMade;

                    apply({
                        type: 'guess.added',
                        roundId: made.roundId,
                        guess: {
                            id: made.guessId,
                            playerId: made.playerId,
                            text: made.text,
                        },
                    });
                    break;
                }
                case 'game.drawing.op-added': {
                    const added = payload as unknown as GameDrawingOpAdded;

                    apply({
                        type: 'drawing.added',
                        roundId: added.roundId,
                        op: added.op,
                        clientOpId: added.clientOpId,
                    });
                    break;
                }
                case 'game.drawing.undone':
                    apply({
                        type: 'drawing.undone',
                        roundId: payload.roundId as string,
                    });
                    break;
                case 'game.drawing.cleared':
                    apply({
                        type: 'drawing.cleared',
                        roundId: payload.roundId as string,
                    });
                    break;
                case 'game.clue.changed':
                    apply({
                        type: 'round.patched',
                        roundId: payload.roundId as string,
                        patch: { clue: payload.clue as string[] },
                    });
                    break;
```

- [ ] **Step 4: Check types and lint**

Run: `vendor/bin/sail artisan wayfinder:generate --with-form && npm run types:check && npx vp check --fix resources/js/lib/games resources/js/hooks/use-game-channel.ts resources/js/hooks/use-game-room.ts && npm run check`
Expected: no new errors.

- [ ] **Step 5: Commit**

```bash
git add resources/js/lib/games resources/js/hooks/use-game-channel.ts resources/js/hooks/use-game-room.ts
git commit -m "feat(games): follow guesses, hints, drawings and clues live

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SosW8d2Uj7QxsF1tws5ssS"
```

---
### Task 8: Drawing library — rasteriser, flood fill, stroke whispers and rotation

**Files:**
- Create: `resources/js/lib/games/drawing.ts`, `resources/js/lib/games/stroke-whisper.ts`, `resources/js/lib/games/rotation.ts`, `resources/js/lib/games/hints.ts`
- Create: `resources/js/hooks/use-stroke-whispers.ts`

**Interfaces:**
- Consumes: Task 7 types; `whisperTransport`, `WhisperChannel` (`@/lib/realtime/whisper-transport`).
- Produces:
  - `drawing.ts`:
    - Constants `DrawingWidth = 1000`, `DrawingHeight = 750`, `RasterWidth = 800`, `RasterHeight = 600`, `DrawingColors` (the six pen colours), `EraserColor = 'white'`, `DrawingSizes`, `MaxStrokePoints = 1000`.
    - Guards `isDrawingColor`, `isDrawingSize`, `isDrawingPoint`.
    - `colorCss(color)`, `strokeRadius(size)`, type `Raster`, `createRaster()`, `applyOp(raster, op)`, `floodFill(raster, x, y, index)`, `replay(ops)`, `paintRaster(raster, image)`, `pointFromEvent(event, element)`, `drawPreview(ctx, color, size, points)`.
  - `stroke-whisper.ts`: `StrokeEvent = 'game-stroke'`, `StrokeWhisperPoints = 100`, `StrokeWhisperThrottleMs = 40`, type `StrokeMessage`, `strokeIdPrefix(roundId)`, `newStrokeId(roundId)`, `isStrokeMessage(raw, roundId)`, `strokeChunks(points, sent)`.
  - `rotation.ts`: `nextLeaderId(players, onlinePresenceIds, previousLeaderId)`.
  - `hints.ts`: `hintsUsed(mask)`.
  - `useStrokeWhispers(presence, source, onStroke) → send(message)`, where `source` = `{drawerPresenceId, roundId} | null`.

The rasteriser is deliberately not the browser's: strokes are stamped as integer disks and fills are an exact scanline flood fill on palette indexes. Two browsers therefore compute the same pixels, and a fill ends at the same edge everywhere (spec §4.1). Browser anti-aliasing would leave half-coloured pixels that stop a fill differently per engine.

- [ ] **Step 1: Write the rasteriser**

Create `resources/js/lib/games/drawing.ts`:

```ts
import type {
    DrawingColor,
    DrawingOp,
    DrawingPoint,
    DrawingSize,
} from './types';

export const DrawingWidth = 1000;
export const DrawingHeight = 750;
export const RasterWidth = 800;
export const RasterHeight = 600;
export const MaxStrokePoints = 1000;
export const EraserColor: DrawingColor = 'white';

export const DrawingColors: DrawingColor[] = [
    'black',
    'red',
    'orange',
    'green',
    'blue',
    'purple',
];

export const DrawingSizes: DrawingSize[] = [4, 10, 24];

const Scale = RasterWidth / DrawingWidth;

/** Index 0 is the white background of a fresh raster. */
const Palette: [DrawingColor, [number, number, number]][] = [
    ['white', [255, 255, 255]],
    ['black', [23, 23, 23]],
    ['red', [220, 38, 38]],
    ['orange', [234, 88, 12]],
    ['green', [22, 163, 74]],
    ['blue', [37, 99, 235]],
    ['purple', [147, 51, 234]],
];

const PaletteIndex = new Map<DrawingColor, number>(
    Palette.map(([color], index) => [color, index]),
);

const PaletteRgb = Uint8Array.from(Palette.flatMap(([, rgb]) => rgb));

/** One palette index per pixel of the 800 × 600 grid. */
export type Raster = Uint8Array;

export function isDrawingColor(value: unknown): value is DrawingColor {
    return (
        typeof value === 'string' && PaletteIndex.has(value as DrawingColor)
    );
}

export function isDrawingSize(value: unknown): value is DrawingSize {
    return DrawingSizes.includes(value as DrawingSize);
}

export function isDrawingPoint(value: unknown): value is DrawingPoint {
    if (!Array.isArray(value) || value.length !== 2) {
        return false;
    }

    const [x, y] = value as unknown[];

    return (
        Number.isInteger(x) &&
        Number.isInteger(y) &&
        (x as number) >= 0 &&
        (x as number) <= DrawingWidth &&
        (y as number) >= 0 &&
        (y as number) <= DrawingHeight
    );
}

export function colorCss(color: DrawingColor): string {
    const [red, green, blue] = Palette[PaletteIndex.get(color) ?? 0][1];

    return `rgb(${red} ${green} ${blue})`;
}

export function strokeRadius(size: DrawingSize): number {
    return Math.max(1, Math.round((size * Scale) / 2));
}

export function createRaster(): Raster {
    return new Uint8Array(RasterWidth * RasterHeight);
}

const disks = new Map<number, number[]>();

/** Offsets `[dx, dy, dx, dy, …]` of a filled disk, cached per radius. */
function disk(radius: number): number[] {
    const cached = disks.get(radius);

    if (cached) {
        return cached;
    }

    const offsets: number[] = [];
    const limit = radius * radius + radius;

    for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
            if (dx * dx + dy * dy <= limit) {
                offsets.push(dx, dy);
            }
        }
    }

    disks.set(radius, offsets);

    return offsets;
}

function stamp(
    raster: Raster,
    x: number,
    y: number,
    offsets: number[],
    index: number,
): void {
    for (let offset = 0; offset < offsets.length; offset += 2) {
        const pixelX = x + offsets[offset];
        const pixelY = y + offsets[offset + 1];

        if (
            pixelX < 0 ||
            pixelY < 0 ||
            pixelX >= RasterWidth ||
            pixelY >= RasterHeight
        ) {
            continue;
        }

        raster[pixelY * RasterWidth + pixelX] = index;
    }
}

function toRaster(value: number, size: number): number {
    return Math.min(size - 1, Math.max(0, Math.round(value * Scale)));
}

function drawStroke(
    raster: Raster,
    points: DrawingPoint[],
    size: DrawingSize,
    index: number,
): void {
    const radius = strokeRadius(size);
    const offsets = disk(radius);
    const spacing = Math.max(1, radius / 2);
    let previousX = toRaster(points[0][0], RasterWidth);
    let previousY = toRaster(points[0][1], RasterHeight);

    stamp(raster, previousX, previousY, offsets, index);

    for (let point = 1; point < points.length; point++) {
        const x = toRaster(points[point][0], RasterWidth);
        const y = toRaster(points[point][1], RasterHeight);
        const steps = Math.max(
            1,
            Math.ceil(Math.hypot(x - previousX, y - previousY) / spacing),
        );

        for (let step = 1; step <= steps; step++) {
            stamp(
                raster,
                Math.round(previousX + ((x - previousX) * step) / steps),
                Math.round(previousY + ((y - previousY) * step) / steps),
                offsets,
                index,
            );
        }

        previousX = x;
        previousY = y;
    }
}

/** Exact 4-connected scanline fill of the region under (x, y). */
export function floodFill(
    raster: Raster,
    x: number,
    y: number,
    index: number,
): void {
    const target = raster[y * RasterWidth + x];

    if (target === index) {
        return;
    }

    const stack: number[] = [x, y];

    while (stack.length > 0) {
        const seedY = stack.pop() as number;
        const seedX = stack.pop() as number;
        const row = seedY * RasterWidth;

        if (raster[row + seedX] !== target) {
            continue;
        }

        let left = seedX;
        let right = seedX;

        while (left > 0 && raster[row + left - 1] === target) {
            left--;
        }

        while (right < RasterWidth - 1 && raster[row + right + 1] === target) {
            right++;
        }

        raster.fill(index, row + left, row + right + 1);

        for (const nextY of [seedY - 1, seedY + 1]) {
            if (nextY < 0 || nextY >= RasterHeight) {
                continue;
            }

            const nextRow = nextY * RasterWidth;
            let inRun = false;

            for (let column = left; column <= right; column++) {
                const matches = raster[nextRow + column] === target;

                if (matches && !inRun) {
                    stack.push(column, nextY);
                }

                inRun = matches;
            }
        }
    }
}

export function applyOp(raster: Raster, op: DrawingOp): void {
    const index = PaletteIndex.get(op.color) ?? 0;

    if (op.type === 'fill') {
        floodFill(
            raster,
            toRaster(op.x, RasterWidth),
            toRaster(op.y, RasterHeight),
            index,
        );

        return;
    }

    if (op.points.length === 0) {
        return;
    }

    drawStroke(raster, op.points, op.size, index);
}

export function replay(ops: DrawingOp[]): Raster {
    const raster = createRaster();

    for (const op of ops) {
        applyOp(raster, op);
    }

    return raster;
}

export function paintRaster(raster: Raster, image: ImageData): void {
    const data = image.data;

    for (let pixel = 0; pixel < raster.length; pixel++) {
        const colour = raster[pixel] * 3;
        const offset = pixel * 4;

        data[offset] = PaletteRgb[colour];
        data[offset + 1] = PaletteRgb[colour + 1];
        data[offset + 2] = PaletteRgb[colour + 2];
        data[offset + 3] = 255;
    }
}

/** Logical canvas coordinates of a pointer over an element showing the drawing. */
export function pointFromEvent(
    event: { clientX: number; clientY: number },
    element: Element,
): DrawingPoint {
    const rect = element.getBoundingClientRect();
    const x = Math.round(
        ((event.clientX - rect.left) / Math.max(1, rect.width)) * DrawingWidth,
    );
    const y = Math.round(
        ((event.clientY - rect.top) / Math.max(1, rect.height)) *
            DrawingHeight,
    );

    return [
        Math.min(DrawingWidth, Math.max(0, x)),
        Math.min(DrawingHeight, Math.max(0, y)),
    ];
}

/** A live stroke, drawn by the browser on top of the committed raster. */
export function drawPreview(
    ctx: CanvasRenderingContext2D,
    color: DrawingColor,
    size: DrawingSize,
    points: DrawingPoint[],
): void {
    if (points.length === 0) {
        return;
    }

    ctx.strokeStyle = colorCss(color);
    ctx.lineWidth = strokeRadius(size) * 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(points[0][0] * Scale, points[0][1] * Scale);

    for (const [x, y] of points.length === 1 ? points : points.slice(1)) {
        ctx.lineTo(x * Scale, y * Scale);
    }

    ctx.stroke();
}
```

- [ ] **Step 2: Write the stroke whisper format, rotation and hints helpers**

Create `resources/js/lib/games/stroke-whisper.ts`:

```ts
import { isDrawingColor, isDrawingPoint, isDrawingSize } from './drawing';
import type { DrawingColor, DrawingPoint, DrawingSize } from './types';

export const StrokeEvent = 'game-stroke';
export const StrokeWhisperPoints = 100;
export const StrokeWhisperThrottleMs = 40;

const StrokeIdPattern = /^[A-Za-z0-9_-]{1,64}$/;

export type StrokeMessage = {
    v: 1;
    id: string;
    color: DrawingColor;
    size: DrawingSize;
    points: DrawingPoint[];
};

/** Stroke ids start with the round's id prefix, so strokes of an older round are dropped. */
export function strokeIdPrefix(roundId: string): string {
    return roundId.slice(0, 8);
}

export function newStrokeId(roundId: string): string {
    const random = Math.random().toString(36).slice(2, 12);

    return `${strokeIdPrefix(roundId)}-${Date.now().toString(36)}${random}`;
}

export function isStrokeMessage(
    raw: unknown,
    roundId: string,
): raw is StrokeMessage {
    if (typeof raw !== 'object' || raw === null) {
        return false;
    }

    const message = raw as Record<string, unknown>;

    return (
        message.v === 1 &&
        typeof message.id === 'string' &&
        StrokeIdPattern.test(message.id) &&
        message.id.startsWith(`${strokeIdPrefix(roundId)}-`) &&
        isDrawingColor(message.color) &&
        isDrawingSize(message.size) &&
        Array.isArray(message.points) &&
        message.points.length >= 1 &&
        message.points.length <= StrokeWhisperPoints &&
        message.points.every(isDrawingPoint)
    );
}

/**
 * The unsent tail of a stroke as whisper chunks of at most 100 points, each
 * starting with the previous chunk's last point so receivers draw no gap.
 */
export function strokeChunks(
    points: DrawingPoint[],
    sent: number,
): { chunks: DrawingPoint[][]; sent: number } {
    const chunks: DrawingPoint[][] = [];
    let cursor = sent;

    while (cursor < points.length) {
        const start = Math.max(0, cursor - 1);
        const chunk = points.slice(start, start + StrokeWhisperPoints);

        chunks.push(chunk);
        cursor = start + chunk.length;
    }

    return { chunks, sent: cursor };
}
```

Create `resources/js/lib/games/rotation.ts`:

```ts
import type { GamePlayer } from './types';

/**
 * Spec §4.1 "endless rotation": the next online player after the previous
 * leader in join order, wrapping around; the first online player otherwise.
 */
export function nextLeaderId(
    players: GamePlayer[],
    onlinePresenceIds: Set<string>,
    previousLeaderId: string | null,
): string | null {
    const count = players.length;
    const start = players.findIndex((player) => player.id === previousLeaderId);

    for (let offset = 1; offset <= count; offset++) {
        const player = players[(start + offset + count) % count];

        if (onlinePresenceIds.has(player.presenceId)) {
            return player.id;
        }
    }

    return null;
}
```

Create `resources/js/lib/games/hints.ts`:

```ts
import type { GameMask } from './types';

const Separators = [' ', '-', "'"];

/** In Draw & Guess and Decoded, every letter shown on the mask came from a hint. */
export function hintsUsed(mask: GameMask): number {
    return mask.filter(
        (character) => character !== null && !Separators.includes(character),
    ).length;
}
```

- [ ] **Step 3: Write the whisper hook**

Create `resources/js/hooks/use-stroke-whispers.ts`:

```ts
import { useCallback, useEffect, useMemo, useRef } from 'react';
import {
    isStrokeMessage,
    StrokeEvent,
    type StrokeMessage,
} from '@/lib/games/stroke-whisper';
import {
    whisperTransport,
    type WhisperChannel,
} from '@/lib/realtime/whisper-transport';

export type StrokeSource = { drawerPresenceId: string; roundId: string };

/**
 * Live `game-stroke` whispers on any presence channel: a game room's, or
 * the retro's for an icebreaker (13d). Only the current drawer's
 * Reverb-stamped presence id is accepted, and only for the active round.
 */
export function useStrokeWhispers(
    presence: WhisperChannel | null,
    source: StrokeSource | null,
    onStroke: (message: StrokeMessage) => void,
): (message: StrokeMessage) => void {
    const accepted = useRef(source);
    const handler = useRef(onStroke);

    useEffect(() => {
        accepted.current = source;
        handler.current = onStroke;
    });

    const transport = useMemo(
        () =>
            presence === null
                ? null
                : whisperTransport(presence, StrokeEvent, (senderId, raw) => {
                      const current = accepted.current;

                      return (
                          current !== null &&
                          senderId === current.drawerPresenceId &&
                          isStrokeMessage(raw, current.roundId)
                      );
                  }),
        [presence],
    );

    useEffect(() => {
        if (transport === null) {
            return;
        }

        return transport.onMessage((raw) =>
            handler.current(raw as StrokeMessage),
        );
    }, [transport]);

    return useCallback(
        (message: StrokeMessage) => transport?.send(message),
        [transport],
    );
}
```

- [ ] **Step 4: Check types and lint**

Run: `npm run types:check && npx vp check --fix resources/js/lib/games resources/js/hooks/use-stroke-whispers.ts && npm run check`
Expected: no new errors.

- [ ] **Step 5: Commit**

```bash
git add resources/js/lib/games resources/js/hooks/use-stroke-whispers.ts
git commit -m "feat(games): rasterise drawings and relay live strokes

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SosW8d2Uj7QxsF1tws5ssS"
```

---
### Task 9: Draw & Guess UI — canvas, toolbar, guess chat, leader picker and pass

**Files:**
- Create: `resources/js/hooks/use-secret-word.ts`
- Create: `resources/js/components/games/{drawing-canvas,drawing-toolbar,draw-board,guess-chat,leader-word,hint-button,pass-round-button,leader-picker}.tsx`
- Modify: `resources/js/components/games/game-board.tsx`, `resources/js/components/games/start-round-controls.tsx`

**Interfaces:**
- Consumes:
  - Task 7: types and reducer actions.
  - Task 8: `drawing.ts`, `stroke-whisper.ts`, `rotation.ts`, `hints.ts`, `useStrokeWhispers`.
  - 13a: `useRoom()`, `WordMask`, `HangmanBoard`.
  - Wayfinder `Games/{GameRoundSecretsController,GameRoundHintsController,GameGuessesController,GameDrawingOpsController,GameDrawingsController,GameRoundPassesController,GameRoundsController}`.
- Produces:
  - `useSecretWord(round): string | null`: the leader fetches the word after `game.round.started` when the payload did not carry it.
  - `DrawingCanvas({ops, previews?, input?, label, className?})`, with exported types `PreviewStroke`, `CanvasTool`, `CanvasInput`.
  - `DrawingToolbar`, `DrawBoard({round})`, `GuessChat({round, isLeader})`, `LeaderWord({word, label})`, `HintButton({round})`, `PassRoundButton({round})` (leader or host; "Give up" in Hangman, "Pass" otherwise), `LeaderPicker({players, value, onChange, label})`.
  - `GameBoard` renders the board for `draw` and then `PassRoundButton`; Task 10 adds `decoded`.
  - `StartRoundControls` sends `leader_player_id` for `draw`/`decoded`. It preselects `nextLeaderId`, and shows "Waiting for another player" with Start disabled when fewer than 2 players are online.

- [ ] **Step 1: Write the secret word hook**

Create `resources/js/hooks/use-secret-word.ts`:

```ts
import { useEffect } from 'react';
import { toast } from 'sonner';
import GameRoundSecretsController from '@/actions/App/Http/Controllers/Games/GameRoundSecretsController';
import { useRoom } from '@/components/games/room-context';
import type { GameRound, GameSecretResponse } from '@/lib/games/types';
import { retroRequest } from '@/lib/retro/api';

/**
 * The public `game.round.started` payload never carries the word, so the
 * leader asks for it; everyone else gets null.
 */
export function useSecretWord(round: GameRound): string | null {
    const { snapshot, dispatch, handleError } = useRoom();
    const isLeader = round.leaderPlayerId === snapshot.me.playerId;
    const needsWord = isLeader && round.word === undefined;
    const roomId = snapshot.room.id;
    const roundId = round.id;

    useEffect(() => {
        if (!needsWord) {
            return;
        }

        let isCurrent = true;

        retroRequest<GameSecretResponse>(
            GameRoundSecretsController.show({ room: roomId, round: roundId }),
        )
            .then((secret) => {
                if (isCurrent) {
                    dispatch({
                        type: 'round.patched',
                        roundId,
                        patch: { word: secret.word },
                    });
                }
            })
            .catch((error: unknown) => {
                const message = isCurrent ? handleError(error) : null;

                if (message !== null) {
                    toast.error(message);
                }
            });

        return () => {
            isCurrent = false;
        };
    }, [needsWord, roomId, roundId, dispatch, handleError]);

    return isLeader ? (round.word ?? null) : null;
}
```

- [ ] **Step 2: Write the canvas**

Create `resources/js/components/games/drawing-canvas.tsx`:

```tsx
import {
    useCallback,
    useEffect,
    useRef,
    type PointerEvent,
} from 'react';
import {
    applyOp,
    createRaster,
    drawPreview,
    EraserColor,
    MaxStrokePoints,
    paintRaster,
    pointFromEvent,
    RasterHeight,
    RasterWidth,
    replay,
    type Raster,
} from '@/lib/games/drawing';
import {
    newStrokeId,
    strokeChunks,
    StrokeWhisperThrottleMs,
    type StrokeMessage,
} from '@/lib/games/stroke-whisper';
import type {
    DrawingColor,
    DrawingOp,
    DrawingPoint,
    DrawingSize,
} from '@/lib/games/types';
import { cn } from '@/lib/utils';

export type PreviewStroke = {
    id: string;
    color: DrawingColor;
    size: DrawingSize;
    points: DrawingPoint[];
};

export type CanvasTool = 'pen' | 'eraser' | 'fill';

export type CanvasInput = {
    tool: CanvasTool;
    color: DrawingColor;
    size: DrawingSize;
    roundId: string;
    onCommit: (op: DrawingOp, clientOpId: string) => void;
    onLive: (message: StrokeMessage) => void;
};

type LiveStroke = PreviewStroke & { sent: number };

type Props = {
    ops: DrawingOp[];
    previews?: PreviewStroke[];
    /** Absent for viewers, the history replay and every non-drawer. */
    input?: CanvasInput | null;
    label: string;
    className?: string;
};

/**
 * Committed operations are rasterised by `drawing.ts` (identical on every
 * client); live strokes are drawn on top by the browser until committed.
 */
export function DrawingCanvas({
    ops,
    previews = [],
    input = null,
    label,
    className,
}: Props) {
    const canvas = useRef<HTMLCanvasElement>(null);
    const raster = useRef<Raster>(createRaster());
    const applied = useRef<DrawingOp[]>([]);
    const image = useRef<ImageData | null>(null);
    const live = useRef<LiveStroke | null>(null);
    const frame = useRef<number | null>(null);
    const timer = useRef<number | null>(null);
    const previewsRef = useRef(previews);
    const inputRef = useRef(input);

    useEffect(() => {
        previewsRef.current = previews;
        inputRef.current = input;
    });

    const redraw = useCallback(() => {
        frame.current = null;

        const ctx = canvas.current?.getContext('2d');

        if (!ctx || !image.current) {
            return;
        }

        ctx.putImageData(image.current, 0, 0);

        for (const stroke of previewsRef.current) {
            drawPreview(ctx, stroke.color, stroke.size, stroke.points);
        }

        if (live.current) {
            drawPreview(
                ctx,
                live.current.color,
                live.current.size,
                live.current.points,
            );
        }
    }, []);

    const scheduleRedraw = useCallback(() => {
        if (frame.current === null) {
            frame.current = requestAnimationFrame(redraw);
        }
    }, [redraw]);

    useEffect(() => {
        const ctx = canvas.current?.getContext('2d');

        if (!ctx) {
            return;
        }

        const previous = applied.current;
        const isAppend =
            ops.length >= previous.length &&
            previous.every((op, index) => ops[index] === op);

        if (isAppend) {
            for (const op of ops.slice(previous.length)) {
                applyOp(raster.current, op);
            }
        } else {
            raster.current = replay(ops);
        }

        applied.current = ops;
        image.current ??= ctx.createImageData(RasterWidth, RasterHeight);
        paintRaster(raster.current, image.current);
        scheduleRedraw();
    }, [ops, scheduleRedraw]);

    useEffect(() => {
        scheduleRedraw();
    }, [previews, scheduleRedraw]);

    const stopTimer = useCallback(() => {
        if (timer.current !== null) {
            window.clearInterval(timer.current);
            timer.current = null;
        }
    }, []);

    useEffect(
        () => () => {
            stopTimer();

            if (frame.current !== null) {
                cancelAnimationFrame(frame.current);
            }
        },
        [stopTimer],
    );

    const flush = useCallback(() => {
        const stroke = live.current;
        const current = inputRef.current;

        if (!stroke || !current) {
            return;
        }

        const { chunks, sent } = strokeChunks(stroke.points, stroke.sent);

        for (const points of chunks) {
            current.onLive({
                v: 1,
                id: stroke.id,
                color: stroke.color,
                size: stroke.size,
                points,
            });
        }

        stroke.sent = sent;
    }, []);

    const begin = useCallback(
        (point: DrawingPoint, color: DrawingColor, size: DrawingSize) => {
            const current = inputRef.current;

            if (!current) {
                return;
            }

            live.current = {
                id: newStrokeId(current.roundId),
                color,
                size,
                points: [point],
                sent: 0,
            };
            timer.current = window.setInterval(flush, StrokeWhisperThrottleMs);
        },
        [flush],
    );

    const finish = useCallback(() => {
        stopTimer();

        const stroke = live.current;

        if (!stroke) {
            return;
        }

        flush();
        live.current = null;
        inputRef.current?.onCommit(
            {
                type: 'stroke',
                color: stroke.color,
                size: stroke.size,
                points: stroke.points,
            },
            stroke.id,
        );
        scheduleRedraw();
    }, [flush, scheduleRedraw, stopTimer]);

    const onPointerDown = (event: PointerEvent<HTMLCanvasElement>) => {
        const current = inputRef.current;

        if (!current || (event.pointerType === 'mouse' && event.button !== 0)) {
            return;
        }

        const point = pointFromEvent(event, event.currentTarget);

        if (current.tool === 'fill') {
            current.onCommit(
                { type: 'fill', color: current.color, x: point[0], y: point[1] },
                newStrokeId(current.roundId),
            );

            return;
        }

        event.currentTarget.setPointerCapture(event.pointerId);
        begin(
            point,
            current.tool === 'eraser' ? EraserColor : current.color,
            current.size,
        );
        scheduleRedraw();
    };

    const onPointerMove = (event: PointerEvent<HTMLCanvasElement>) => {
        const stroke = live.current;

        if (!stroke) {
            return;
        }

        const point = pointFromEvent(event, event.currentTarget);
        const last = stroke.points[stroke.points.length - 1];

        if (last[0] === point[0] && last[1] === point[1]) {
            return;
        }

        stroke.points.push(point);

        if (stroke.points.length >= MaxStrokePoints) {
            finish();
            begin(point, stroke.color, stroke.size);
        }

        scheduleRedraw();
    };

    return (
        <canvas
            ref={canvas}
            width={RasterWidth}
            height={RasterHeight}
            role="img"
            aria-label={label}
            className={cn(
                'aspect-[4/3] w-full touch-none rounded-lg border bg-white',
                input && 'cursor-crosshair',
                className,
            )}
            onPointerDown={input ? onPointerDown : undefined}
            onPointerMove={input ? onPointerMove : undefined}
            onPointerUp={input ? finish : undefined}
            onPointerCancel={input ? finish : undefined}
        />
    );
}
```

- [ ] **Step 3: Write the toolbar and the small controls**

Create `resources/js/components/games/drawing-toolbar.tsx`:

```tsx
import { Eraser, PaintBucket, Pencil, Trash2, Undo2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useTrans } from '@/hooks/use-trans';
import { colorCss, DrawingColors, DrawingSizes } from '@/lib/games/drawing';
import type { DrawingColor, DrawingSize } from '@/lib/games/types';
import { cn } from '@/lib/utils';
import type { CanvasTool } from './drawing-canvas';

const ConfirmClearMs = 3000;

type Props = {
    tool: CanvasTool;
    color: DrawingColor;
    size: DrawingSize;
    canUndo: boolean;
    onTool: (tool: CanvasTool) => void;
    onColor: (color: DrawingColor) => void;
    onSize: (size: DrawingSize) => void;
    onUndo: () => void;
    onClear: () => void;
};

export function DrawingToolbar({
    tool,
    color,
    size,
    canUndo,
    onTool,
    onColor,
    onSize,
    onUndo,
    onClear,
}: Props) {
    const { t } = useTrans();
    const [confirmingClear, setConfirmingClear] = useState(false);

    useEffect(() => {
        if (!confirmingClear) {
            return;
        }

        const timeout = window.setTimeout(
            () => setConfirmingClear(false),
            ConfirmClearMs,
        );

        return () => window.clearTimeout(timeout);
    }, [confirmingClear]);

    const colorNames: Record<DrawingColor, string> = {
        black: t('Black'),
        red: t('Red'),
        orange: t('Orange'),
        green: t('Green'),
        blue: t('Blue'),
        purple: t('Purple'),
        white: t('White'),
    };

    const tools: { value: CanvasTool; label: string; Icon: typeof Pencil }[] = [
        { value: 'pen', label: t('Pen'), Icon: Pencil },
        { value: 'eraser', label: t('Eraser'), Icon: Eraser },
        { value: 'fill', label: t('Fill'), Icon: PaintBucket },
    ];

    return (
        <div
            role="toolbar"
            aria-label={t('Drawing tools')}
            className="flex flex-wrap items-center gap-3"
        >
            <div className="flex items-center gap-1.5">
                {DrawingColors.map((option) => (
                    <button
                        key={option}
                        type="button"
                        aria-label={colorNames[option]}
                        aria-pressed={color === option}
                        className={cn(
                            'size-7 rounded-full border-2 border-transparent ring-offset-2 ring-offset-background',
                            color === option && 'ring-2 ring-ring',
                        )}
                        style={{ backgroundColor: colorCss(option) }}
                        onClick={() => {
                            onColor(option);

                            if (tool === 'eraser') {
                                onTool('pen');
                            }
                        }}
                    />
                ))}
            </div>
            <div className="flex items-center gap-1">
                {DrawingSizes.map((option) => (
                    <button
                        key={option}
                        type="button"
                        aria-label={t('Size :size', { size: option })}
                        aria-pressed={size === option}
                        className={cn(
                            'flex size-8 items-center justify-center rounded-md hover:bg-muted',
                            size === option && 'bg-muted',
                        )}
                        onClick={() => onSize(option)}
                    >
                        <span
                            className="rounded-full bg-foreground"
                            style={{
                                width: Math.max(4, option * 0.8),
                                height: Math.max(4, option * 0.8),
                            }}
                        />
                    </button>
                ))}
            </div>
            <div className="flex items-center gap-1">
                {tools.map(({ value, label, Icon }) => (
                    <Button
                        key={value}
                        type="button"
                        size="icon"
                        variant={tool === value ? 'secondary' : 'ghost'}
                        aria-label={label}
                        aria-pressed={tool === value}
                        onClick={() => onTool(value)}
                    >
                        <Icon className="size-4" />
                    </Button>
                ))}
                <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    aria-label={t('Undo')}
                    disabled={!canUndo}
                    onClick={onUndo}
                >
                    <Undo2 className="size-4" />
                </Button>
                <Button
                    type="button"
                    size="sm"
                    variant={confirmingClear ? 'destructive' : 'ghost'}
                    disabled={!canUndo}
                    onClick={() => {
                        if (!confirmingClear) {
                            setConfirmingClear(true);

                            return;
                        }

                        setConfirmingClear(false);
                        onClear();
                    }}
                >
                    <Trash2 className="size-4" />
                    {confirmingClear ? t('Click again to clear') : t('Clear')}
                </Button>
            </div>
        </div>
    );
}
```

Create `resources/js/components/games/leader-word.tsx`:

```tsx
type Props = { word: string | null; label: string };

export function LeaderWord({ word, label }: Props) {
    return (
        <div className="flex flex-col items-center gap-1 text-center">
            <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                {label}
            </span>
            <span className="text-2xl font-semibold tracking-wide">
                {word ?? '…'}
            </span>
        </div>
    );
}
```

Create `resources/js/components/games/hint-button.tsx`:

```tsx
import { Lightbulb } from 'lucide-react';
import { useState } from 'react';
import GameRoundHintsController from '@/actions/App/Http/Controllers/Games/GameRoundHintsController';
import { Button } from '@/components/ui/button';
import { useTrans } from '@/hooks/use-trans';
import { hintsUsed } from '@/lib/games/hints';
import type { GameHintResponse, GameRound } from '@/lib/games/types';
import { retroRequest } from '@/lib/retro/api';
import { useRoom } from './room-context';

export function HintButton({ round }: { round: GameRound }) {
    const ctx = useRoom();
    const { t } = useTrans();
    const [busy, setBusy] = useState(false);
    const left = Math.max(0, (round.maxHints ?? 0) - hintsUsed(round.mask ?? []));

    const reveal = async () => {
        setBusy(true);

        const response = await ctx.run(
            retroRequest<GameHintResponse>(
                GameRoundHintsController.store({
                    room: ctx.snapshot.room.id,
                    round: round.id,
                }),
            ),
        );

        setBusy(false);

        if (response) {
            ctx.dispatch({
                type: 'round.patched',
                roundId: round.id,
                patch: { mask: response.mask },
            });
        }
    };

    return (
        <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={busy || left === 0}
            onClick={() => void reveal()}
        >
            <Lightbulb className="size-4" />
            {t('Reveal a letter (:count left)', { count: left })}
        </Button>
    );
}
```

Create `resources/js/components/games/pass-round-button.tsx`:

```tsx
import { Flag } from 'lucide-react';
import { useState } from 'react';
import GameRoundPassesController from '@/actions/App/Http/Controllers/Games/GameRoundPassesController';
import { Button } from '@/components/ui/button';
import { useTrans } from '@/hooks/use-trans';
import type { GameRound, GameRoundEnded } from '@/lib/games/types';
import { retroRequest } from '@/lib/retro/api';
import { useRoom } from './room-context';

/** The round's leader or the host ends the turn without a winner. */
export function PassRoundButton({ round }: { round: GameRound }) {
    const ctx = useRoom();
    const { t } = useTrans();
    const [busy, setBusy] = useState(false);
    const { room, me } = ctx.snapshot;

    if (!room.isHost && round.leaderPlayerId !== me.playerId) {
        return null;
    }

    const pass = async () => {
        setBusy(true);

        const response = await ctx.run(
            retroRequest<{ ended: GameRoundEnded }>(
                GameRoundPassesController.store({
                    room: room.id,
                    round: round.id,
                }),
            ),
        );

        setBusy(false);

        if (response?.ended) {
            ctx.dispatch({ type: 'round.ended', ended: response.ended });
            void ctx.refetch();
        }
    };

    return (
        <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={busy}
            onClick={() => void pass()}
        >
            <Flag className="size-4" />
            {round.game === 'hangman' ? t('Give up') : t('Pass')}
        </Button>
    );
}
```

Create `resources/js/components/games/leader-picker.tsx`:

```tsx
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import type { GamePlayer } from '@/lib/games/types';

type Props = {
    players: GamePlayer[];
    value: string | null;
    onChange: (playerId: string) => void;
    label: string;
};

export function LeaderPicker({ players, value, onChange, label }: Props) {
    return (
        <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">{label}</span>
            <Select value={value ?? undefined} onValueChange={onChange}>
                <SelectTrigger className="w-48" aria-label={label}>
                    <SelectValue />
                </SelectTrigger>
                <SelectContent>
                    {players.map((player) => (
                        <SelectItem key={player.id} value={player.id}>
                            {player.name}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    );
}
```

- [ ] **Step 4: Write the guess chat**

Create `resources/js/components/games/guess-chat.tsx`:

```tsx
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import GameGuessesController from '@/actions/App/Http/Controllers/Games/GameGuessesController';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useTrans } from '@/hooks/use-trans';
import type { GameGuessResponse, GameRound } from '@/lib/games/types';
import { retroRequest } from '@/lib/retro/api';
import { useRoom } from './room-context';

const MaxGuessLength = 50;

type Props = { round: GameRound; isLeader: boolean };

export function GuessChat({ round, isLeader }: Props) {
    const ctx = useRoom();
    const { t } = useTrans();
    const [text, setText] = useState('');
    const [busy, setBusy] = useState(false);
    const list = useRef<HTMLOListElement>(null);
    const guesses = round.guesses ?? [];
    const names = new Map(
        ctx.snapshot.players.map((player) => [player.id, player.name]),
    );

    useEffect(() => {
        list.current?.scrollTo({ top: list.current.scrollHeight });
    }, [guesses.length]);

    const submit = async (event: FormEvent) => {
        event.preventDefault();

        const guess = text.trim();

        if (guess === '' || busy) {
            return;
        }

        setBusy(true);

        const response = await ctx.run(
            retroRequest<GameGuessResponse>(
                GameGuessesController.store({
                    room: ctx.snapshot.room.id,
                    round: round.id,
                }),
                { text: guess },
            ),
        );

        setBusy(false);

        if (!response) {
            return;
        }

        setText('');

        if (response.ended) {
            ctx.dispatch({ type: 'round.ended', ended: response.ended });
            void ctx.refetch();
            toast.success(t('You found it!'));

            return;
        }

        ctx.dispatch({
            type: 'guess.added',
            roundId: round.id,
            guess: {
                id: response.guessId,
                playerId: ctx.snapshot.me.playerId,
                text: guess,
                ...(response.result === 'near' ? { veryClose: true } : {}),
            },
        });
    };

    return (
        <section
            aria-labelledby="game-guesses"
            className="flex min-h-64 w-full flex-col gap-2 rounded-lg border p-3"
        >
            <h2 id="game-guesses" className="text-sm font-semibold">
                {t('Guesses')}
            </h2>
            <ol
                ref={list}
                aria-live="polite"
                className="max-h-96 flex-1 space-y-1 overflow-y-auto text-sm"
            >
                {guesses.length === 0 && (
                    <li className="text-muted-foreground">
                        {t('No guesses yet.')}
                    </li>
                )}
                {guesses.map((guess) => (
                    <li key={guess.id} className="break-words">
                        <span className="font-medium">
                            {names.get(guess.playerId) ?? t('Someone')}
                        </span>
                        {': '}
                        {guess.text}
                        {guess.veryClose && (
                            <Badge variant="secondary" className="ml-2">
                                {t('Very close!')}
                            </Badge>
                        )}
                    </li>
                ))}
            </ol>
            {isLeader ? (
                <p className="text-sm text-muted-foreground">
                    {t('You know the word, so you cannot guess.')}
                </p>
            ) : (
                <form
                    onSubmit={(event) => void submit(event)}
                    className="flex gap-2"
                >
                    <Input
                        value={text}
                        maxLength={MaxGuessLength}
                        readOnly={busy}
                        autoComplete="off"
                        placeholder={t('Your guess')}
                        aria-label={t('Your guess')}
                        onChange={(event) => setText(event.target.value)}
                    />
                    <Button type="submit" disabled={busy || text.trim() === ''}>
                        {t('Guess')}
                    </Button>
                </form>
            )}
        </section>
    );
}
```

- [ ] **Step 5: Write the Draw & Guess board**

Create `resources/js/components/games/draw-board.tsx`:

```tsx
import { useCallback, useEffect, useRef, useState } from 'react';
import GameDrawingOpsController from '@/actions/App/Http/Controllers/Games/GameDrawingOpsController';
import GameDrawingsController from '@/actions/App/Http/Controllers/Games/GameDrawingsController';
import { useSecretWord } from '@/hooks/use-secret-word';
import { useStrokeWhispers } from '@/hooks/use-stroke-whispers';
import { useTrans } from '@/hooks/use-trans';
import { MaxStrokePoints } from '@/lib/games/drawing';
import type { StrokeMessage } from '@/lib/games/stroke-whisper';
import type {
    DrawingColor,
    DrawingOp,
    DrawingSize,
    GameDrawingOpResponse,
    GameRound,
} from '@/lib/games/types';
import { retroRequest } from '@/lib/retro/api';
import {
    DrawingCanvas,
    type CanvasTool,
    type PreviewStroke,
} from './drawing-canvas';
import { DrawingToolbar } from './drawing-toolbar';
import { GuessChat } from './guess-chat';
import { HintButton } from './hint-button';
import { LeaderWord } from './leader-word';
import { useRoom } from './room-context';
import { WordMask } from './word-mask';

/** A live stroke nobody committed within this delay was abandoned (drawer offline). */
const StalePreviewMs = 3000;

type RemoteStroke = PreviewStroke & { updatedAt: number };

export function DrawBoard({ round }: { round: GameRound }) {
    const ctx = useRoom();
    const { t } = useTrans();
    const { snapshot, presence } = ctx;
    const roomId = snapshot.room.id;
    const isDrawer = round.leaderPlayerId === snapshot.me.playerId;
    const drawer =
        snapshot.players.find((player) => player.id === round.leaderPlayerId) ??
        null;
    const word = useSecretWord(round);
    const [tool, setTool] = useState<CanvasTool>('pen');
    const [color, setColor] = useState<DrawingColor>('black');
    const [size, setSize] = useState<DrawingSize>(10);
    const [remote, setRemote] = useState<RemoteStroke[]>([]);
    const [pending, setPending] = useState<PreviewStroke[]>([]);
    const queue = useRef<Promise<void>>(Promise.resolve());
    const committed = round.committedOpIds ?? [];
    const ops = round.drawing ?? [];

    const receive = useCallback((message: StrokeMessage) => {
        setRemote((current) => {
            const existing = current.find((stroke) => stroke.id === message.id);
            const points = existing
                ? [...existing.points, ...message.points.slice(1)]
                : message.points;
            const stroke: RemoteStroke = {
                id: message.id,
                color: message.color,
                size: message.size,
                points: points.slice(-MaxStrokePoints),
                updatedAt: Date.now(),
            };

            return [
                ...current.filter((known) => known.id !== message.id),
                stroke,
            ];
        });
    }, []);

    const sendStroke = useStrokeWhispers(
        presence,
        !isDrawer && drawer
            ? { drawerPresenceId: drawer.presenceId, roundId: round.id }
            : null,
        receive,
    );

    useEffect(() => {
        if (isDrawer) {
            return;
        }

        const interval = window.setInterval(() => {
            const cutoff = Date.now() - StalePreviewMs;

            setRemote((current) =>
                current.some((stroke) => stroke.updatedAt < cutoff)
                    ? current.filter((stroke) => stroke.updatedAt >= cutoff)
                    : current,
            );
        }, 1000);

        return () => window.clearInterval(interval);
    }, [isDrawer]);

    /** Operations are sent one after the other so the server keeps the drawer's order. */
    const enqueue = (task: () => Promise<void>) => {
        queue.current = queue.current.then(task, task);
    };

    const commit = (op: DrawingOp, clientOpId: string) => {
        if (op.type === 'stroke') {
            setPending((current) => [
                ...current,
                {
                    id: clientOpId,
                    color: op.color,
                    size: op.size,
                    points: op.points,
                },
            ]);
        }

        enqueue(async () => {
            const response = await ctx.run(
                retroRequest<GameDrawingOpResponse>(
                    GameDrawingOpsController.store({ room: roomId, round: round.id }),
                    { client_op_id: clientOpId, op },
                ),
            );

            if (response) {
                ctx.dispatch({
                    type: 'drawing.added',
                    roundId: round.id,
                    op: response.op,
                    clientOpId: response.clientOpId,
                });
            }

            setPending((current) =>
                current.filter((stroke) => stroke.id !== clientOpId),
            );
        });
    };

    const undo = () => {
        enqueue(async () => {
            const done = await ctx.run(
                retroRequest(
                    GameDrawingOpsController.destroyLast({
                        room: roomId,
                        round: round.id,
                    }),
                ),
            );

            if (done !== undefined) {
                ctx.dispatch({ type: 'drawing.undone', roundId: round.id });
            }
        });
    };

    const clear = () => {
        enqueue(async () => {
            const done = await ctx.run(
                retroRequest(
                    GameDrawingsController.destroy({
                        room: roomId,
                        round: round.id,
                    }),
                ),
            );

            if (done !== undefined) {
                ctx.dispatch({ type: 'drawing.cleared', roundId: round.id });
            }
        });
    };

    const previews = isDrawer
        ? pending
        : remote.filter((stroke) => !committed.includes(stroke.id));

    return (
        <div className="grid w-full max-w-5xl gap-4 lg:grid-cols-[1fr_18rem]">
            <div className="flex min-w-0 flex-col gap-3">
                <div className="flex min-h-14 flex-col items-center justify-center gap-1">
                    {isDrawer ? (
                        <LeaderWord word={word} label={t('Your word to draw')} />
                    ) : (
                        <>
                            <WordMask mask={round.mask ?? []} />
                            {drawer && (
                                <p className="text-sm text-muted-foreground">
                                    {t(':name is drawing', { name: drawer.name })}
                                </p>
                            )}
                        </>
                    )}
                </div>
                <DrawingCanvas
                    ops={ops}
                    previews={previews}
                    input={
                        isDrawer
                            ? {
                                  tool,
                                  color,
                                  size,
                                  roundId: round.id,
                                  onCommit: commit,
                                  onLive: sendStroke,
                              }
                            : null
                    }
                    label={isDrawer ? t('Your drawing') : t('The drawing')}
                />
                {isDrawer && (
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <DrawingToolbar
                            tool={tool}
                            color={color}
                            size={size}
                            canUndo={ops.length > 0}
                            onTool={setTool}
                            onColor={setColor}
                            onSize={setSize}
                            onUndo={undo}
                            onClear={clear}
                        />
                        <HintButton round={round} />
                    </div>
                )}
            </div>
            <GuessChat round={round} isLeader={isDrawer} />
        </div>
    );
}
```

- [ ] **Step 6: Mount the board and let the host choose the leader**

Replace `resources/js/components/games/game-board.tsx` with:

```tsx
import { useTrans } from '@/hooks/use-trans';
import type { GameRound } from '@/lib/games/types';
import { DrawBoard } from './draw-board';
import { HangmanBoard } from './hangman-board';
import { PassRoundButton } from './pass-round-button';

export function GameBoard({ round }: { round: GameRound }) {
    return (
        <div className="flex w-full flex-col items-center gap-4">
            <RoundBody round={round} />
            <div className="flex w-full max-w-5xl justify-end">
                <PassRoundButton round={round} />
            </div>
        </div>
    );
}

/** Keyed by round so live previews and tool state start clean each turn. */
function RoundBody({ round }: { round: GameRound }) {
    const { t } = useTrans();

    switch (round.game) {
        case 'hangman':
            return <HangmanBoard round={round} />;
        case 'draw':
            return <DrawBoard key={round.id} round={round} />;
        default:
            return (
                <p className="text-muted-foreground">
                    {t('This game is not available.')}
                </p>
            );
    }
}
```

Replace `resources/js/components/games/start-round-controls.tsx` with:

```tsx
import { Play } from 'lucide-react';
import { useMemo, useState } from 'react';
import GameRoundsController from '@/actions/App/Http/Controllers/Games/GameRoundsController';
import { Button } from '@/components/ui/button';
import { useTrans } from '@/hooks/use-trans';
import { nextLeaderId } from '@/lib/games/rotation';
import type { GameKind, GameStartResponse } from '@/lib/games/types';
import { retroRequest } from '@/lib/retro/api';
import { LeaderPicker } from './leader-picker';
import { useRoom } from './room-context';

const LeaderGames: GameKind[] = ['draw', 'decoded'];

export function StartRoundControls({ label }: { label: string }) {
    const ctx = useRoom();
    const { t } = useTrans();
    const [busy, setBusy] = useState(false);
    const [chosenLeaderId, setChosenLeaderId] = useState<string | null>(null);
    const { room, games, players, history } = ctx.snapshot;
    const onlineIds = useMemo(
        () => new Set(ctx.online.map((member) => member.id)),
        [ctx.online],
    );
    const onlinePlayers = players.filter((player) =>
        onlineIds.has(player.presenceId),
    );
    const needsLeader = LeaderGames.includes(room.game);
    const isAvailable = games.some(
        (option) => option.value === room.game && option.available,
    );
    const previousLeaderId =
        ctx.lastEnded?.leaderPlayerId ?? history[0]?.leaderPlayerId ?? null;
    const leaderId =
        chosenLeaderId !== null &&
        onlinePlayers.some((player) => player.id === chosenLeaderId)
            ? chosenLeaderId
            : nextLeaderId(players, onlineIds, previousLeaderId);
    const isWaiting = needsLeader && onlinePlayers.length < 2;

    if (!room.isHost) {
        return (
            <p className="text-muted-foreground">
                {t('Waiting for the host to start.')}
            </p>
        );
    }

    if (!isAvailable) {
        return (
            <p className="text-muted-foreground">
                {t('This game is not available.')}
            </p>
        );
    }

    const start = async () => {
        setBusy(true);

        const response = await ctx.run(
            retroRequest<GameStartResponse>(
                GameRoundsController.store(room.id),
                needsLeader ? { leader_player_id: leaderId } : {},
            ),
        );

        setBusy(false);

        if (!response) {
            return;
        }

        setChosenLeaderId(null);

        if (response.ended) {
            ctx.dispatch({ type: 'round.ended', ended: response.ended });
        }

        ctx.dispatch({ type: 'round.started', round: response.round });
    };

    return (
        <div className="flex flex-col items-center gap-3">
            {needsLeader && !isWaiting && (
                <LeaderPicker
                    players={onlinePlayers}
                    value={leaderId}
                    onChange={setChosenLeaderId}
                    label={
                        room.game === 'draw'
                            ? t('Who draws?')
                            : t('Who gives the clues?')
                    }
                />
            )}
            {isWaiting && (
                <p className="text-sm text-muted-foreground">
                    {t('Waiting for another player')}
                </p>
            )}
            <Button
                disabled={busy || isWaiting || (needsLeader && leaderId === null)}
                onClick={() => void start()}
            >
                <Play className="size-4" />
                {label}
            </Button>
        </div>
    );
}
```

- [ ] **Step 7: Check types and lint**

Run: `vendor/bin/sail artisan wayfinder:generate --with-form && npm run types:check && npx vp check --fix resources/js/hooks/use-secret-word.ts resources/js/components/games && npm run check`
Expected: no new errors.

- [ ] **Step 8: Translations**

| Key (en) | fr | es | de |
|---|---|---|---|
| Black | Noir | Negro | Schwarz |
| Red | Rouge | Rojo | Rot |
| Orange | Orange | Naranja | Orange |
| Green | Vert | Verde | Grün |
| Blue | Bleu | Azul | Blau |
| Purple | Violet | Morado | Lila |
| White | Blanc | Blanco | Weiß |
| Pen | Crayon | Lápiz | Stift |
| Eraser | Gomme | Goma | Radierer |
| Fill | Remplir | Rellenar | Füllen |
| Undo | Annuler | Deshacer | Rückgängig |
| Clear | Effacer | Borrar | Löschen |
| Click again to clear | Cliquez encore pour effacer | Vuelve a hacer clic para borrar | Zum Löschen erneut klicken |
| Drawing tools | Outils de dessin | Herramientas de dibujo | Zeichenwerkzeuge |
| Size :size | Taille :size | Tamaño :size | Größe :size |
| Reveal a letter (:count left) | Révéler une lettre (:count restantes) | Revelar una letra (quedan :count) | Einen Buchstaben aufdecken (noch :count) |
| Give up | Abandonner | Rendirse | Aufgeben |
| Pass | Passer | Pasar | Passen |
| Guesses | Propositions | Intentos | Rateversuche |
| No guesses yet. | Aucune proposition pour l'instant. | Aún no hay intentos. | Noch keine Rateversuche. |
| Very close! | Tout près ! | ¡Casi! | Ganz nah dran! |
| You know the word, so you cannot guess. | Vous connaissez le mot, vous ne pouvez donc pas deviner. | Conoces la palabra, así que no puedes adivinar. | Du kennst das Wort, also kannst du nicht raten. |
| Your guess | Votre proposition | Tu intento | Dein Tipp |
| Guess | Deviner | Adivinar | Raten |
| You found it! | Vous avez trouvé ! | ¡Lo encontraste! | Du hast es gefunden! |
| Your word to draw | Votre mot à dessiner | Tu palabra para dibujar | Dein Wort zum Zeichnen |
| :name is drawing | :name dessine | :name está dibujando | :name zeichnet |
| Your drawing | Votre dessin | Tu dibujo | Deine Zeichnung |
| The drawing | Le dessin | El dibujo | Die Zeichnung |
| Who draws? | Qui dessine ? | ¿Quién dibuja? | Wer zeichnet? |
| Who gives the clues? | Qui donne les indices ? | ¿Quién da las pistas? | Wer gibt die Hinweise? |
| Waiting for another player | En attente d'un autre joueur | Esperando a otro jugador | Warten auf eine weitere Person |

Run: `vendor/bin/sail artisan test --compact tests/Feature/TranslationKeysTest.php` — Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add resources/js/hooks/use-secret-word.ts resources/js/components/games lang
git commit -m "feat(games): play Draw & Guess in the browser

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SosW8d2Uj7QxsF1tws5ssS"
```

---
### Task 10: Decoded UI, the board-agnostic emoji picker and the history replay

**Files:**
- Create: `resources/js/lib/games/clue.ts`, `resources/js/components/games/{clue-row,clue-editor,decoded-board}.tsx`
- Modify: `resources/js/components/retro/board-context.tsx` (add `useOptionalBoard`), `resources/js/components/retro/emoji-picker.tsx` (accept `emojiData`), `resources/js/components/games/game-board.tsx` (add `decoded`), `resources/js/components/games/round-detail.tsx` (drawing replay, clue)

**Interfaces:**
- Consumes: Task 7 (`GameClueResponse`, `EmojiDataLocation`, `snapshot.emojiData`), Task 9 (`DrawingCanvas`, `GuessChat`, `HintButton`, `LeaderWord`, `useSecretWord`), `isSingleEmoji` (`@/lib/retro/emoji`), Wayfinder `GameRoundCluesController`.
- Produces:
  - `isClueEmoji(value)`, which mirrors `App\Rules\ClueEmoji`.
  - `ClueRow({clue, className?})` (5 slots, read-only; 13d's "Games we played" reuses it), `ClueEditor({round})` (clue giver; optimistic patch, PUT debounced 300 ms), `DecodedBoard({round})`.
  - `useOptionalBoard(): BoardContextValue | null`.
  - `EmojiPicker` prop `emojiData?: EmojiDataLocation`. It is used before the board's value, and the "More emoji…" entry is hidden when neither exists.
  - `RoundDetail` replays a Draw & Guess drawing read-only and shows a Decoded clue.

- [ ] **Step 1: Make the emoji picker work outside a retro**

In `resources/js/components/retro/board-context.tsx` append:

```tsx
/** For components shared with game rooms, which have no board. */
export function useOptionalBoard(): BoardContextValue | null {
    return useContext(BoardContext);
}
```

In `resources/js/components/retro/emoji-picker.tsx`:
- Replace the import `import { useBoard } from './board-context';` with `import { useOptionalBoard } from './board-context';`, and add `import type { EmojiDataLocation } from '@/lib/games/types';`.
- Replace the `Props` type with:

```tsx
type Props = {
    onPick: (emoji: string) => void;
    label: string;
    children: ReactNode;
    /** Where the full emoji list lives; defaults to the retro board's. */
    emojiData?: EmojiDataLocation;
};
```

- Change the signature to `export function EmojiPicker({ onPick, label, children, emojiData }: Props) {` and replace `const { board } = useBoard();` with:

```tsx
    const board = useOptionalBoard();
    const data = emojiData ?? board?.board.emojiData ?? null;
```

- In the JSX, wrap the separator and the "More emoji…" item as `{data !== null && (<>…</>)}`, so they read:

```tsx
                    {data !== null && (
                        <>
                            <DropdownMenuSeparator className="w-full" />
                            <DropdownMenuItem
                                className="w-full"
                                onSelect={() => setBrowsing(true)}
                            >
                                {t('More emoji…')}
                            </DropdownMenuItem>
                        </>
                    )}
```

- Wrap the whole `<Dialog …>…</Dialog>` as `{data !== null && (<Dialog …>…</Dialog>)}`, and inside it replace `locale={board.emojiData.locale}` with `locale={data.locale}` and `emojibaseUrl={board.emojiData.baseUrl}` with `emojibaseUrl={data.baseUrl}`.

This also stops the picker from requiring a retro board where it is already used outside one (the poker reactions bar mounts `FlyingReactions`, whose picker called `useBoard()`).

- [ ] **Step 2: Write the clue helpers and components**

Create `resources/js/lib/games/clue.ts`:

```ts
import { isSingleEmoji } from '@/lib/retro/emoji';

export const ClueSlots = 5;

const LetterLike =
    /\p{Regional_Indicator}|\u{20E3}|[\u{1F170}\u{1F171}\u{1F17E}\u{1F17F}\u{1F18E}\u{1F191}-\u{1F19A}\u{2139}\u{24C2}\u{1F520}-\u{1F522}\u{1F524}]/u;

/** Mirrors App\Rules\ClueEmoji, to refuse letter-like picks before sending. */
export function isClueEmoji(value: string): boolean {
    return isSingleEmoji(value) && !LetterLike.test(value);
}
```

Create `resources/js/components/games/clue-row.tsx`:

```tsx
import { useTrans } from '@/hooks/use-trans';
import { ClueSlots } from '@/lib/games/clue';
import { cn } from '@/lib/utils';

type Props = { clue: string[]; className?: string };

export function ClueRow({ clue, className }: Props) {
    const { t } = useTrans();

    return (
        <div
            role="img"
            aria-label={
                clue.length === 0
                    ? t('No clue yet')
                    : t('Clue: :emoji', { emoji: clue.join(' ') })
            }
            className={cn('flex justify-center gap-2', className)}
        >
            {Array.from({ length: ClueSlots }, (_, index) => (
                <span
                    key={index}
                    className="flex size-14 items-center justify-center rounded-lg border bg-muted/40 text-3xl"
                >
                    {clue[index] ?? ''}
                </span>
            ))}
        </div>
    );
}
```

Create `resources/js/components/games/clue-editor.tsx`:

```tsx
import { Plus, X } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import GameRoundCluesController from '@/actions/App/Http/Controllers/Games/GameRoundCluesController';
import { EmojiPicker } from '@/components/retro/emoji-picker';
import { Button } from '@/components/ui/button';
import { useTrans } from '@/hooks/use-trans';
import { ClueSlots, isClueEmoji } from '@/lib/games/clue';
import type { GameClueResponse, GameRound } from '@/lib/games/types';
import { retroRequest } from '@/lib/retro/api';
import { useRoom } from './room-context';

const SaveDelayMs = 300;

/**
 * The round's clue is the source of truth: edits patch it at once and the
 * whole row is saved after a short pause, so the last edit wins.
 */
export function ClueEditor({ round }: { round: GameRound }) {
    const ctx = useRoom();
    const { t } = useTrans();
    const timer = useRef<number | null>(null);
    const clue = round.clue ?? [];
    const roomId = ctx.snapshot.room.id;

    useEffect(
        () => () => {
            if (timer.current !== null) {
                window.clearTimeout(timer.current);
            }
        },
        [],
    );

    const save = (next: string[]) => {
        ctx.dispatch({
            type: 'round.patched',
            roundId: round.id,
            patch: { clue: next },
        });

        if (timer.current !== null) {
            window.clearTimeout(timer.current);
        }

        timer.current = window.setTimeout(() => {
            timer.current = null;

            void ctx.run(
                retroRequest<GameClueResponse>(
                    GameRoundCluesController.update({
                        room: roomId,
                        round: round.id,
                    }),
                    { clue: next },
                ),
            );
        }, SaveDelayMs);
    };

    const add = (emoji: string) => {
        if (!isClueEmoji(emoji)) {
            toast.error(t('Use emoji only, without letters or digits.'));

            return;
        }

        save([...clue, emoji].slice(0, ClueSlots));
    };

    return (
        <div className="flex flex-col items-center gap-2">
            <div className="flex justify-center gap-2">
                {Array.from({ length: ClueSlots }, (_, index) => {
                    const emoji = clue[index];

                    if (emoji !== undefined) {
                        return (
                            <button
                                key={index}
                                type="button"
                                aria-label={t('Remove :emoji', { emoji })}
                                className="group relative flex size-14 items-center justify-center rounded-lg border text-3xl hover:bg-muted"
                                onClick={() =>
                                    save(
                                        clue.filter(
                                            (_, position) => position !== index,
                                        ),
                                    )
                                }
                            >
                                {emoji}
                                <X className="absolute -top-1.5 -right-1.5 size-4 rounded-full border bg-background opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100" />
                            </button>
                        );
                    }

                    if (index !== clue.length) {
                        return (
                            <span
                                key={index}
                                className="size-14 rounded-lg border border-dashed"
                            />
                        );
                    }

                    return (
                        <EmojiPicker
                            key={index}
                            label={t('Add an emoji')}
                            emojiData={ctx.snapshot.emojiData}
                            onPick={add}
                        >
                            <Button
                                type="button"
                                variant="outline"
                                className="size-14"
                            >
                                <Plus className="size-5" />
                            </Button>
                        </EmojiPicker>
                    );
                })}
            </div>
            <p className="text-xs text-muted-foreground">
                {t(
                    'Describe the word with up to five emoji, without letters or digits.',
                )}
            </p>
        </div>
    );
}
```

Create `resources/js/components/games/decoded-board.tsx`:

```tsx
import { useSecretWord } from '@/hooks/use-secret-word';
import { useTrans } from '@/hooks/use-trans';
import type { GameRound } from '@/lib/games/types';
import { ClueEditor } from './clue-editor';
import { ClueRow } from './clue-row';
import { GuessChat } from './guess-chat';
import { HintButton } from './hint-button';
import { LeaderWord } from './leader-word';
import { useRoom } from './room-context';
import { WordMask } from './word-mask';

export function DecodedBoard({ round }: { round: GameRound }) {
    const { snapshot } = useRoom();
    const { t } = useTrans();
    const isLeader = round.leaderPlayerId === snapshot.me.playerId;
    const word = useSecretWord(round);
    const leader =
        snapshot.players.find((player) => player.id === round.leaderPlayerId) ??
        null;

    return (
        <div className="grid w-full max-w-5xl gap-4 lg:grid-cols-[1fr_18rem]">
            <div className="flex min-w-0 flex-col items-center gap-6 py-4">
                {isLeader ? (
                    <>
                        <LeaderWord
                            word={word}
                            label={t('Your word to describe')}
                        />
                        <ClueEditor round={round} />
                        <HintButton round={round} />
                    </>
                ) : (
                    <>
                        {leader && (
                            <p className="text-sm text-muted-foreground">
                                {t(':name is giving clues', {
                                    name: leader.name,
                                })}
                            </p>
                        )}
                        <ClueRow clue={round.clue ?? []} />
                    </>
                )}
                <WordMask mask={round.mask ?? []} />
            </div>
            <GuessChat round={round} isLeader={isLeader} />
        </div>
    );
}
```

- [ ] **Step 3: Mount the board and replay rounds in the history**

In `resources/js/components/games/game-board.tsx` add `import { DecodedBoard } from './decoded-board';` and, in `RoundBody`, after the `draw` case:

```tsx
        case 'decoded':
            return <DecodedBoard key={round.id} round={round} />;
```

In `resources/js/components/games/round-detail.tsx` add `import { ClueRow } from './clue-row';` and `import { DrawingCanvas } from './drawing-canvas';`, and in `GameDetail` add before `default:`:

```tsx
        case 'draw':
            return (
                <div className="space-y-2">
                    <DrawingCanvas
                        ops={detail.drawing ?? []}
                        label={t('Drawing of :word', {
                            word: detail.word ?? '',
                        })}
                    />
                    {detail.word && (
                        <p className="text-center text-xl font-semibold">
                            {detail.word}
                        </p>
                    )}
                </div>
            );
        case 'decoded':
            return (
                <div className="space-y-2">
                    <ClueRow clue={detail.clue ?? []} />
                    {detail.word && (
                        <p className="text-center text-xl font-semibold">
                            {detail.word}
                        </p>
                    )}
                </div>
            );
```

- [ ] **Step 4: Check types and lint**

Run: `npm run types:check && npx vp check --fix resources/js/lib/games resources/js/components/games resources/js/components/retro/emoji-picker.tsx resources/js/components/retro/board-context.tsx && npm run check`
Expected: no new errors. Then check the retro board still type-checks and renders its reactions picker (`npm run build`).

- [ ] **Step 5: Translations**

| Key (en) | fr | es | de |
|---|---|---|---|
| No clue yet | Pas encore d'indice | Aún no hay pista | Noch kein Hinweis |
| Clue: :emoji | Indice : :emoji | Pista: :emoji | Hinweis: :emoji |
| Remove :emoji | Retirer :emoji | Quitar :emoji | :emoji entfernen |
| Add an emoji | Ajouter un emoji | Añadir un emoji | Ein Emoji hinzufügen |
| Describe the word with up to five emoji, without letters or digits. | Décrivez le mot avec jusqu'à cinq emoji, sans lettres ni chiffres. | Describe la palabra con hasta cinco emoji, sin letras ni cifras. | Beschreibe das Wort mit bis zu fünf Emoji, ohne Buchstaben oder Ziffern. |
| Your word to describe | Votre mot à faire deviner | Tu palabra para describir | Dein Wort zum Beschreiben |
| :name is giving clues | :name donne les indices | :name está dando pistas | :name gibt Hinweise |
| Drawing of :word | Dessin de :word | Dibujo de :word | Zeichnung von :word |

Run: `vendor/bin/sail artisan test --compact tests/Feature/TranslationKeysTest.php` — Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add resources/js/lib/games/clue.ts resources/js/components/games resources/js/components/retro/emoji-picker.tsx resources/js/components/retro/board-context.tsx lang
git commit -m "feat(games): play Decoded and replay drawings in the history

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SosW8d2Uj7QxsF1tws5ssS"
```

---
### Task 11: Verification (controller-driven)

**Files:** none new. This task only runs checks and the walkthrough, and fixes what they find (each fix in its own commit, with a test).

- [ ] **Step 1: Full backend suite and static analysis**

Run:

```bash
vendor/bin/sail artisan test --compact
vendor/bin/sail bin phpstan analyse --no-progress
vendor/bin/sail bin pint --test --format agent
```

Expected: all green (the suite includes every earlier plan), phpstan 0 errors, pint clean.

- [ ] **Step 2: Frontend checks and build**

Run: `npm run types:check && npm run check && npm run build`
Expected: no new errors; the build succeeds.

- [ ] **Step 3: Spec coverage check**

For each item below, point at the passing test (file and name) and tick it:

- §4 guess matching and near miss: `GuessMatchTest`; guess rate limit: `WordGuessPlayTest` ("slows down a player guessing too fast").
- §4.1 leader, drawable words, word to the leader only: `WordGuessRulesTest`. Secret endpoint: `WordGuessPlayTest`. Drawing ops, caps, validation, undo, clear, rate limit: `DrawingTest`, `DrawingOpTest`. Hints: `WordGuessPlayTest`. Guesses (wrong, near, correct, leader 403, ended 409): `WordGuessPlayTest`. Pass: `WordGuessPlayTest`. Timer: `WordGuessRulesTest` ("times out when the host timer runs out").
- §4.4 clue rules: `ClueEmojiTest`, `DecodedClueTest`.
- §4.6 score rows: `WordGuessScoringTest`.
- §8 secrecy: `WordGuessRedactionTest`.
- Snapshot query budget: `WordGuessRulesTest` ("builds the snapshot of a word-guess round with a constant number of queries").

- [ ] **Step 4: Two-browser walkthrough (desktop + phone, `composer run dev` with Reverb and the queue worker)**

1. In a link room, the host switches the game to Draw & Guess with only one browser open. The end card shows "Waiting for another player" and Start is disabled.
2. A guest joins from the phone. The host sees "Who draws?" preselected on the guest, then starts.
3. The phone shows the word above the canvas. The desktop shows the mask `_ _ _ _` and ":name is drawing". The word is absent from the desktop's snapshot JSON (network tab).
4. The guest draws slowly. The line appears on the desktop while it is being drawn, then stays identical after the finger lifts. A long stroke keeps flowing without gaps.
5. The guest draws a closed shape and fills its inside. The fill stops at the same edge on both screens (compare screenshots). Undo removes the fill on both. "Clear" asks for a second click, then empties both canvases.
6. Open a third browser mid-round (member). It shows the committed drawing immediately.
7. The desktop types a wrong guess ("planet"): the phone sees it in the chat. It types a near miss: both see the text, and only the desktop shows "Very close!".
8. The guest reveals a letter. The mask updates everywhere and the button counts down to zero at half the letters.
9. The desktop types the word with other capitals and accents. The turn ends with the word and the desktop as winner on both. The guess text itself never appears in either chat.
10. "Next round": the preselected drawer rotates to the next online player.
11. Switch to Decoded. The clue giver adds 🚀 🌕 from the picker ("More emoji…" opens the full list) and removes one. The others see the row change within a second. Picking 1️⃣ or 🇫🇷 in the full list shows "Use emoji only, without letters or digits.".
12. Host "Pass" ends the round. In Hangman, the host sees "Give up".
13. History drawer: a Draw & Guess round replays its drawing read-only, and a Decoded round shows its clue.

- [ ] **Step 5: Record the outcome**

Write the results (passed steps, fixes made, anything deferred) in the ledger `.superpowers/sdd/2026-10-06-plan-13b-games-draw-and-decoded/progress.md`, and commit it with the fixes.
