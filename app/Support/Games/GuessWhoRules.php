<?php

namespace App\Support\Games;

use App\Actions\Games\GameGuard;
use App\Actions\Games\PickRoundQuestion;
use App\Enums\GameKind;
use App\Enums\GameRoundOutcome;
use App\Events\Games\GameRoundRevealed;
use App\Events\Games\GameVotesCounted;
use App\Models\GameChoice;
use App\Models\GamePlayer;
use App\Models\GameRoom;
use App\Models\GameRound;
use App\Models\GameTextAnswer;
use Carbon\CarbonInterface;
use Illuminate\Auth\Access\AuthorizationException;
use Symfony\Component\HttpKernel\Exception\ConflictHttpException;

/**
 * Spec §6.10 (owner's answer 9 B): everyone answers a prompt; one answer is
 * drawn at random and shown without author; everyone but its author names
 * one author; the close tells who wrote it. Answers not drawn never leave
 * the server, and nobody learns who has voted (the author is the one who
 * cannot), only how many.
 */
class GuessWhoRules implements AsksQuestions, ClosesVoting, GameRules, RevealsInStages, TakesChoices
{
    public const FinderPoints = 5;

    public const PointsPerFooled = 2;

    public const MinimumAnswers = 2;

    public function __construct(
        private GameWordBook $gameWordBook,
        private PickRoundQuestion $pickRoundQuestion,
    ) {}

    public function kind(): GameKind
    {
        return GameKind::GuessWho;
    }

    public function isAvailable(GameRoom $room): bool
    {
        if (! $room->isIcebreaker()) {
            return true;
        }

        return ! $room->retro?->is_anonymous;
    }

    public function prepare(GameRoom $room, GameRound $round, array $input): void
    {
        $round->word = null;
        $round->question = $this->pickRoundQuestion->handle($room, $this->questions($room));
    }

    public function presentActive(GameRound $round, GameRoom $room, ?GamePlayer $viewer): array
    {
        $answers = $round->textAnswers()->get(['id', 'player_id', 'text', 'is_drawn']);
        $mine = $viewer === null ? null : $answers->firstWhere('player_id', $viewer->id);
        $drawn = $answers->firstWhere('is_drawn', true);
        $state = [
            'question' => $round->question,
            'answers' => $answers->sortBy('player_id')->map(fn (GameTextAnswer $answer): array => ['playerId' => $answer->player_id, 'answered' => true])->values()->all(),
            'myAnswer' => $mine instanceof GameTextAnswer ? ['id' => $mine->id, 'text' => $mine->text] : null,
        ];

        if (! $drawn instanceof GameTextAnswer) {
            return [...$state, 'drawn' => null, 'candidates' => [], 'votedCount' => 0, 'myChoice' => null];
        }

        $choices = $round->choices()->get(['player_id', 'choice']);
        $myChoice = $viewer === null ? null : $choices->firstWhere('player_id', $viewer->id);

        return [
            ...$state,
            'drawn' => ['id' => $drawn->id, 'text' => $drawn->text],
            'candidates' => $answers->pluck('player_id')->sort()->values()->all(),
            'votedCount' => $choices->count(),
            'myChoice' => $myChoice instanceof GameChoice ? $myChoice->choice : null,
        ];
    }

    public function presentEnded(GameRound $round): array
    {
        return $this->result($round);
    }

    public function endedPayload(GameRound $round, GameRoom $room): array
    {
        return $this->result($round);
    }

    public function expiryAnchor(GameRound $round): CarbonInterface
    {
        return $round->revealed_at ?? $round->started_at;
    }

    public function expire(GameRoom $room, GameRound $round): ?GameRoundOutcome
    {
        if ($round->revealed_at !== null) {
            return GameRoundOutcome::Revealed;
        }

        if ($round->textAnswers()->count() < self::MinimumAnswers) {
            return GameRoundOutcome::TimedOut;
        }

        $this->draw($room, $round);

        return null;
    }

    public function outcomeOnNextRound(GameRound $round): ?GameRoundOutcome
    {
        return $round->revealed_at === null ? null : GameRoundOutcome::Revealed;
    }

    public function takesTurns(GameRoom $room): bool
    {
        return false;
    }

    public function timesTurns(): bool
    {
        return false;
    }

    public function expireTurn(GameRoom $room, GameRound $round): ?GameRoundOutcome
    {
        return null;
    }

    /**
     * A voter who named the author earns 5 and wins; the author earns 2 per
     * voter fooled; every other answerer played for 0. No draw, no rows.
     */
    public function points(GameRound $round, GameRoom $room): array
    {
        $drawn = $round->drawnAnswer();

        if ($round->outcome !== GameRoundOutcome::Revealed || $drawn === null) {
            return [];
        }

        $rows = [];
        $fooled = 0;

        foreach ($round->textAnswers()->pluck('player_id') as $playerId) {
            $rows[$playerId] = ['points' => 0, 'isWin' => false];
        }

        foreach ($round->choices()->get(['player_id', 'choice']) as $choice) {
            $found = $choice->choice === $drawn->player_id;
            $fooled += $found ? 0 : 1;
            $rows[$choice->player_id] = ['points' => $found ? self::FinderPoints : 0, 'isWin' => $found];
        }

        $rows[$drawn->player_id] = ['points' => $fooled * self::PointsPerFooled, 'isWin' => false];

        return $rows;
    }

    public function reveal(GameRoom $lockedRoom, GameRound $lockedRound, GamePlayer $actor): ?GameRoundOutcome
    {
        GameGuard::host($lockedRoom, $actor);

        if ($lockedRound->revealed_at !== null) {
            throw new ConflictHttpException(__('An answer has already been drawn.'));
        }

        if ($lockedRound->textAnswers()->count() < self::MinimumAnswers) {
            throw new ConflictHttpException(__('At least 2 answers are needed.'));
        }

        $this->draw($lockedRoom, $lockedRound);

        return null;
    }

    public function close(GameRoom $lockedRoom, GameRound $lockedRound, GamePlayer $actor): GameRoundOutcome
    {
        GameGuard::host($lockedRoom, $actor);

        if ($lockedRound->revealed_at === null) {
            throw new ConflictHttpException(__('No answer has been drawn yet.'));
        }

        return GameRoundOutcome::Revealed;
    }

    public function questions(GameRoom $room): array
    {
        return $this->gameWordBook->prompts($room->locale);
    }

    public function questionLocked(GameRound $round): bool
    {
        return $round->revealed_at !== null || $round->textAnswers()->exists();
    }

    /**
     * The candidates are the players who answered, minus the voter; the
     * drawn answer's author may not vote.
     */
    public function choicesFor(GameRound $lockedRound, GamePlayer $player): array
    {
        $drawn = $lockedRound->drawnAnswer();

        if ($drawn === null) {
            throw new ConflictHttpException(__('No answer has been drawn yet.'));
        }

        if ($drawn->player_id === $player->id) {
            throw new AuthorizationException(__('This is your answer.'));
        }

        return $lockedRound->textAnswers()
            ->where('player_id', '!=', $player->id)
            ->orderBy('player_id')
            ->pluck('player_id')
            ->all();
    }

    public function choiceChanged(GameRoom $lockedRoom, GameRound $lockedRound, GamePlayer $player, bool $chose): void
    {
        (new GameVotesCounted($lockedRoom, $lockedRound->id, $lockedRound->choices()->count()))->sendToOthers();
    }

    private function draw(GameRoom $lockedRoom, GameRound $lockedRound): void
    {
        $answers = $lockedRound->textAnswers()->orderBy('id')->get(['id', 'player_id', 'text']);
        $drawn = $answers->random();

        $drawn->forceFill(['is_drawn' => true])->save();
        $lockedRound->forceFill(['revealed_at' => now()->startOfSecond()])->save();

        (new GameRoundRevealed($lockedRoom, [
            'roundId' => $lockedRound->id,
            'revealedAt' => $lockedRound->revealed_at?->toIso8601String() ?? '',
            'answers' => [['id' => $drawn->id, 'text' => $drawn->text]],
            'candidates' => $answers->pluck('player_id')->sort()->values()->all(),
        ]))->sendToOthers();
    }

    /**
     * @return array{question: ?string, drawn: array{id: string, text: string, playerId: string}|null, nominations: array<int, array{playerId: string, voterIds: array<int, string>}>}
     */
    private function result(GameRound $round): array
    {
        $drawn = $round->drawnAnswer();

        if ($drawn === null) {
            return ['question' => $round->question, 'drawn' => null, 'nominations' => []];
        }

        $choices = $round->choices()->get(['player_id', 'choice']);

        return [
            'question' => $round->question,
            'drawn' => ['id' => $drawn->id, 'text' => $drawn->text, 'playerId' => $drawn->player_id],
            'nominations' => $round->textAnswers()->orderBy('player_id')->pluck('player_id')
                ->map(fn (string $candidateId): array => [
                    'playerId' => $candidateId,
                    'voterIds' => $choices->where('choice', $candidateId)->pluck('player_id')->sort()->values()->all(),
                ])
                ->values()
                ->all(),
        ];
    }
}
