<?php

namespace App\Actions\Games;

use App\Enums\GameRoundOutcome;
use App\Models\GameGifAnswer;
use App\Models\GameRoom;
use App\Models\GameRound;
use Illuminate\Support\Collection;
use LogicException;

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
     * @return array<int, array{id: string, gif: array{id: string, previewUrl: string, url: string}, caption: ?string, playerId: ?string}>
     */
    public function revealed(Collection $answers, GameRoom $room): array
    {
        $hidesAuthors = self::hidesAuthors($room);

        return $answers
            ->sortBy('id')
            ->map(fn (GameGifAnswer $answer): array => [
                'id' => $answer->id,
                'gif' => $this->presentGameGif->handle($answer->gif_id),
                'caption' => $answer->caption,
                'playerId' => $hidesAuthors ? null : $answer->player_id,
            ])
            ->values()
            ->all();
    }

    /**
     * The answers of an ended round with their final vote count. Votes of a
     * round that did not close normally (passed, abandoned) were discarded.
     *
     * @return array<int, array{id: string, gif: array{id: string, previewUrl: string, url: string}, caption: ?string, playerId: ?string, votes: ?int}>
     */
    public function closed(GameRound $round, GameRoom $room): array
    {
        return $this->closedFrom($round->gifAnswers()->withCount('votes')->get(), $round, $room);
    }

    /**
     * The same as closed() for answers already loaded with their votes_count,
     * so a list of rounds can load every count in one query.
     *
     * @param  Collection<int, GameGifAnswer>  $answers
     * @return array<int, array{id: string, gif: array{id: string, previewUrl: string, url: string}, caption: ?string, playerId: ?string, votes: ?int}>
     */
    public function closedFrom(Collection $answers, GameRound $round, GameRoom $room): array
    {
        $countsVotes = $round->outcome === GameRoundOutcome::Revealed;
        $votes = $answers->mapWithKeys(function (GameGifAnswer $answer) use ($countsVotes): array {
            if (! $countsVotes) {
                return [$answer->id => null];
            }

            throw_unless(array_key_exists('votes_count', $answer->getAttributes()), LogicException::class, 'Load the answers withCount(\'votes\') before presenting a revealed round.');

            return [$answer->id => (int) $answer->getAttribute('votes_count')];
        });

        return array_map(
            fn (array $answer): array => [...$answer, 'votes' => $votes[$answer['id']]],
            $this->revealed($answers, $room),
        );
    }

    /**
     * @return array{id: string, gif: array{id: string, previewUrl: string, url: string}, caption: ?string}
     */
    public function mine(GameGifAnswer $answer): array
    {
        return [
            'id' => $answer->id,
            'gif' => $this->presentGameGif->handle($answer->gif_id),
            'caption' => $answer->caption,
        ];
    }
}
