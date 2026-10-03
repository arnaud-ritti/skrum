<?php

namespace App\Actions\Games;

use App\Enums\GameKind;
use App\Models\GameRoom;
use App\Models\GameRound;
use LogicException;

/**
 * The one place that presents ended rounds (room history, round detail,
 * "Games we played"); it refuses active rounds, whose word is secret.
 */
class PresentGameRoundHistory
{
    public const Relations = ['leader.user', 'leader.participant.user', 'winner.user', 'winner.participant.user'];

    /**
     * @return array{
     *     id: string,
     *     game: string,
     *     outcome: string,
     *     word: ?string,
     *     question: ?string,
     *     clue: ?array<int, string>,
     *     leaderPlayerId: ?string,
     *     leaderName: ?string,
     *     winnerPlayerId: ?string,
     *     winnerName: ?string,
     *     endedAt: string,
     *     number: ?int,
     *     roundsTotal: ?int
     * }
     */
    public function handle(GameRound $round): array
    {
        throw_if($round->ended_at === null || $round->outcome === null, LogicException::class, 'Only ended rounds have a history.');

        return [
            'id' => $round->id,
            'game' => $round->game->value,
            'outcome' => $round->outcome->value,
            'word' => $round->word,
            'question' => $round->question,
            'clue' => $round->game === GameKind::Decoded ? $round->clue : null,
            'leaderPlayerId' => $round->leader_player_id,
            'leaderName' => $round->leader?->displayName(),
            'winnerPlayerId' => $round->winner_player_id,
            'winnerName' => $round->winner?->displayName(),
            'endedAt' => $round->ended_at->toIso8601String(),
            'number' => $round->number,
            'roundsTotal' => $round->rounds_total,
        ];
    }

    /**
     * The room's retained ended rounds, newest first.
     *
     * @return array<int, array<string, mixed>>
     */
    public function forRoom(GameRoom $room): array
    {
        return $room->rounds()
            ->whereNotNull('ended_at')
            ->whereNotNull('outcome')
            ->with(self::Relations)
            ->orderByDesc('ended_at')
            ->orderByDesc('id')
            ->limit(GameRoom::KeptRounds)
            ->get()
            ->map(fn (GameRound $round): array => $this->handle($round))
            ->all();
    }
}
