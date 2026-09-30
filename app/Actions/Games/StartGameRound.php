<?php

namespace App\Actions\Games;

use App\Events\Games\GameRoundStarted;
use App\Models\GamePlayer;
use App\Models\GameRoom;
use App\Models\GameRound;
use App\Support\Games\GameRulesRegistry;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\ConflictHttpException;

class StartGameRound
{
    public function __construct(
        private GameRulesRegistry $gameRulesRegistry,
        private EndGameRound $endGameRound,
        private PresentGameRound $presentGameRound,
    ) {}

    /**
     * @param  array<string, mixed>  $input
     * @return array{round: GameRound, ended: ?array<string, mixed>}
     */
    public function handle(GameRoom $room, GamePlayer $host, array $input): array
    {
        return DB::transaction(function () use ($room, $host, $input): array {
            $locked = GameRoom::query()->whereKey($room->id)->lockForUpdate()->firstOrFail();

            GameGuard::mutable($locked);
            GameGuard::host($locked, $host);

            $rules = $this->gameRulesRegistry->find($locked->game);

            if ($rules === null || ! $rules->isAvailable($locked)) {
                throw ValidationException::withMessages(['game' => __('This game is not available.')]);
            }

            $ended = $this->closeActiveRound($locked);

            $round = new GameRound([
                'game_room_id' => $locked->id,
                'game' => $locked->game,
                'started_at' => now()->startOfSecond(),
            ]);

            $rules->prepare($locked, $round, $input);
            $round->save();

            $locked->forceFill(['current_round_id' => $round->id])->save();

            $this->pruneEndedRounds($locked);

            (new GameRoundStarted($locked, $this->presentGameRound->handle($round, $locked, null)))->sendToOthers();

            return ['round' => $round, 'ended' => $ended];
        });
    }

    /**
     * @return array<string, mixed>|null
     */
    private function closeActiveRound(GameRoom $room): ?array
    {
        if ($room->current_round_id === null) {
            return null;
        }

        $round = GameRound::query()->whereKey($room->current_round_id)->lockForUpdate()->first();

        if ($round === null || ! $round->isActive()) {
            return null;
        }

        $outcome = $this->gameRulesRegistry->find($round->game)?->outcomeOnNextRound($round);

        if ($outcome === null) {
            throw new ConflictHttpException(__('A round is already in progress.'));
        }

        return $this->endGameRound->handle($room, $round, $outcome);
    }

    /**
     * Pruned rounds take their guesses, answers and votes with them; their
     * points stay, detached, for the leaderboards.
     */
    private function pruneEndedRounds(GameRoom $room): void
    {
        $kept = GameRound::query()
            ->where('game_room_id', $room->id)
            ->whereNotNull('ended_at')
            ->orderByDesc('ended_at')
            ->orderByDesc('id')
            ->limit(GameRoom::KeptRounds)
            ->pluck('id');

        GameRound::query()
            ->where('game_room_id', $room->id)
            ->whereNotNull('ended_at')
            ->whereNotIn('id', $kept)
            ->delete();
    }
}
