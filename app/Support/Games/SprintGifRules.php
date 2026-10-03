<?php

namespace App\Support\Games;

use App\Actions\Games\GameGuard;
use App\Actions\Games\PickRoundQuestion;
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
use Symfony\Component\HttpKernel\Exception\ConflictHttpException;

/**
 * Two stages inside one active round: answering until the reveal, then a
 * voting window until the close. Votes stay secret until the round ends.
 */
class SprintGifRules implements AsksQuestions, ClosesVoting, GameRules, RevealsInStages
{
    public const PointsPerVote = 2;

    public function __construct(
        private GifCatalog $gifCatalog,
        private PickRoundQuestion $pickRoundQuestion,
        private PresentGifAnswers $presentGifAnswers,
        private RevealGifRound $revealGifRound,
        private GameWordBook $gameWordBook,
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
        $round->question = $this->pickRoundQuestion->handle($room, $this->questions($room));
        $round->votes_allowed = $room->gif_votes;
        $round->authors_hidden = $room->gif_authors_hidden;
    }

    public function reveal(GameRoom $lockedRoom, GameRound $lockedRound, GamePlayer $actor): ?GameRoundOutcome
    {
        GameGuard::host($lockedRoom, $actor);

        if ($lockedRound->revealed_at !== null) {
            throw new ConflictHttpException(__('The GIFs are already revealed.'));
        }

        $this->revealGifRound->handle($lockedRoom, $lockedRound);

        return null;
    }

    public function close(GameRoom $lockedRoom, GameRound $lockedRound, GamePlayer $actor): GameRoundOutcome
    {
        GameGuard::host($lockedRoom, $actor);

        if ($lockedRound->revealed_at === null) {
            throw new ConflictHttpException(__('Voting has not started.'));
        }

        return GameRoundOutcome::Revealed;
    }

    public function questions(GameRoom $room): array
    {
        return $this->gameWordBook->questions($room->locale);
    }

    /**
     * Only until the first answer: afterwards the answers were chosen for
     * the question as it stands.
     */
    public function questionLocked(GameRound $round): bool
    {
        return $round->revealed_at !== null || $round->gifAnswers()->exists();
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
                'myVotes' => [],
                'votesAllowed' => $round->votes_allowed,
            ];
        }

        $votes = $round->gifVotes()->get(['voter_player_id', 'answer_id']);
        $myVotes = $viewer === null ? [] : $votes->where('voter_player_id', $viewer->id)->pluck('answer_id')->sort()->values()->all();

        return [
            ...$state,
            'answers' => $this->presentGifAnswers->revealed($answers, $room, $round->authors_hidden),
            'voters' => $votes->pluck('voter_player_id')->unique()->sort()->values()->all(),
            'myVote' => $myVotes[0] ?? null,
            'myVotes' => $myVotes,
            'votesAllowed' => $round->votes_allowed,
            'authorsHidden' => PresentGifAnswers::authorsComeAtClose($room, $round),
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

    public function takesTurns(GameRoom $room): bool
    {
        return false;
    }

    /**
     * The stages follow the room timer: no deadline is ever set per turn.
     */
    public function timesTurns(): bool
    {
        return false;
    }

    public function expireTurn(GameRoom $room, GameRound $round): ?GameRoundOutcome
    {
        return null;
    }

    /**
     * Every author earns 2 points per favourite vote received, and the authors
     * of the most-voted GIF (one vote at least) win; everyone who answered or
     * voted gets a row. On anonymous retros a vote would tie a GIF to its
     * author through the points, so every row is 0 there and no one wins.
     */
    public function points(GameRound $round, GameRoom $room): array
    {
        if ($round->outcome !== GameRoundOutcome::Revealed) {
            return [];
        }

        $awardsPoints = ! PresentGifAnswers::hidesAuthors($room);
        $rows = [];
        $votesByAuthor = $round->gifAnswers()->withCount('votes')->get()
            ->mapWithKeys(fn (GameGifAnswer $answer): array => [$answer->player_id => (int) $answer->getAttribute('votes_count')]);
        $topVotes = (int) $votesByAuthor->max();

        foreach ($votesByAuthor as $authorId => $votes) {
            $rows[$authorId] = [
                'points' => $awardsPoints ? $votes * self::PointsPerVote : 0,
                'isWin' => $awardsPoints && $topVotes > 0 && $votes === $topVotes,
            ];
        }

        foreach ($round->gifVotes()->pluck('voter_player_id') as $voterId) {
            $rows[(string) $voterId] ??= ['points' => 0, 'isWin' => false];
        }

        return $rows;
    }
}
