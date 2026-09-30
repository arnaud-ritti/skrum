<?php

namespace App\Actions\Games;

use App\Enums\GameKind;
use App\Enums\GameRoundOutcome;
use App\Models\GamePlayer;
use App\Models\GameRoom;
use App\Models\GameRound;
use App\Models\Retro;
use Illuminate\Support\Collection;

/**
 * The "Games we played" section of a completed retro (spec §6.1). Only
 * ended rounds are read, through the same presenters as the room history
 * and the GIF round results, so no secrecy rule lives here; guesses are
 * never loaded.
 */
class BuildGamesPlayed
{
    public function __construct(
        private PresentGameRoundHistory $presentGameRoundHistory,
        private PresentGifAnswers $presentGifAnswers,
        private RoomLeaderboard $roomLeaderboard,
    ) {}

    /**
     * @return array{
     *     roomId: string,
     *     rounds: array<int, array<string, mixed>>,
     *     leaderboard: array<int, array{playerId: string, name: string, avatarUrl: string, isGuest: bool, points: int, wins: int, roundsPlayed: int}>,
     *     roundsPlayed: int
     * }|null
     */
    public function handle(Retro $retro): ?array
    {
        $room = GameRoom::query()
            ->where('retro_id', $retro->id)
            ->with(['players.user', 'players.participant.user'])
            ->first();

        if ($room === null) {
            return null;
        }

        $room->setRelation('retro', $retro);

        $rounds = $room->rounds()
            ->whereNotNull('ended_at')
            ->where('outcome', '!=', GameRoundOutcome::Abandoned->value)
            ->with([...PresentGameRoundHistory::Relations, 'gifAnswers' => fn ($query) => $query->withCount('votes')])
            ->orderBy('ended_at')
            ->orderBy('id')
            ->get();

        if ($rounds->isEmpty()) {
            return null;
        }

        $players = $room->players->keyBy('id');

        return [
            'roomId' => $room->id,
            'rounds' => $rounds->map(fn (GameRound $round): array => $this->round($round, $room))->values()->all(),
            'leaderboard' => $this->leaderboard($room, $players),
            'roundsPlayed' => $rounds->count(),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function round(GameRound $round, GameRoom $room): array
    {
        $history = $this->presentGameRoundHistory->handle($round);

        return [
            'id' => $history['id'],
            'game' => $history['game'],
            'outcome' => $history['outcome'],
            'word' => $history['word'],
            'question' => $history['question'],
            'clue' => $round->game === GameKind::Decoded ? array_values($round->clue) : null,
            'leader' => $this->person($round->leader),
            'winner' => $this->person($round->winner),
            'answers' => $round->game === GameKind::SprintGif ? $this->answers($round, $room) : null,
            'endedAt' => $history['endedAt'],
        ];
    }

    /**
     * @return array<int, array{gif: array{id: string, previewUrl: string, url: string}, playerId: ?string, votes: ?int}>
     */
    private function answers(GameRound $round, GameRoom $room): array
    {
        return array_map(
            fn (array $answer): array => [
                'gif' => $answer['gif'],
                'playerId' => $answer['playerId'],
                'votes' => $answer['votes'],
            ],
            $this->presentGifAnswers->closedFrom($round->gifAnswers, $round, $room),
        );
    }

    /**
     * @param  Collection<string, GamePlayer>  $players
     * @return array<int, array{playerId: string, name: string, avatarUrl: string, isGuest: bool, points: int, wins: int, roundsPlayed: int}>
     */
    private function leaderboard(GameRoom $room, Collection $players): array
    {
        $rows = [];

        foreach ($this->roomLeaderboard->handle($room) as $row) {
            $person = $this->person($players->get($row['playerId']));

            if ($person === null) {
                continue;
            }

            $rows[] = [
                ...$person,
                'points' => $row['points'],
                'wins' => $row['wins'],
                'roundsPlayed' => $row['roundsPlayed'],
            ];
        }

        return $rows;
    }

    /**
     * @return array{playerId: string, name: string, avatarUrl: string, isGuest: bool}|null
     */
    private function person(?GamePlayer $player): ?array
    {
        if ($player === null) {
            return null;
        }

        return [
            'playerId' => $player->id,
            'name' => $player->displayName(),
            'avatarUrl' => $player->avatarUrl(),
            'isGuest' => $player->isGuest(),
        ];
    }
}
