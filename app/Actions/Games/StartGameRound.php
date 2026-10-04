<?php

namespace App\Actions\Games;

use App\Events\Games\GameRoundStarted;
use App\Models\GamePlayer;
use App\Models\GameRoom;
use App\Models\GameRound;
use App\Support\Games\GameRules;
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
        private ScheduleRoundExpiry $scheduleRoundExpiry,
        private AnnounceTeamGameRoom $announceTeamGameRoom,
        private NumberGameRound $numberGameRound,
        private ScheduleTurnExpiry $scheduleTurnExpiry,
        private ScheduleAutoHints $scheduleAutoHints,
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

            $numbering = $this->numberGameRound->handle($locked);

            $round = new GameRound([
                'game_room_id' => $locked->id,
                'game' => $locked->game,
                'started_at' => now()->startOfSecond(),
                'number' => $numbering['number'],
                'rounds_total' => $numbering['total'],
            ]);

            $rules->prepare($locked, $round, $input);
            $this->prepareTurns($locked, $round, $rules, $input);
            $this->scheduleAutoHints->prepare($locked, $round);
            $round->save();

            $locked->forceFill(['current_round_id' => $round->id])->save();

            $this->pruneEndedRounds($locked);

            $this->scheduleRoundExpiry->handle($locked, $round);
            $this->scheduleTurnExpiry->handle($round);
            $this->scheduleAutoHints->dispatch($round);

            new GameRoundStarted($locked, $this->presentGameRound->handle($round, $locked, null))->sendToOthers();

            $this->announceTeamGameRoom->changed($locked);

            return ['round' => $round, 'ended' => $ended];
        });
    }

    /**
     * A game in turns starts with the host's order; a game that times turns
     * copies the room's time per turn and sets the first deadline.
     *
     * @param  array<string, mixed>  $input
     */
    private function prepareTurns(GameRoom $room, GameRound $round, GameRules $rules, array $input): void
    {
        if ($rules->takesTurns($room)) {
            $order = array_values((array) ($input['turn_order'] ?? []));

            if ($order === []) {
                throw ValidationException::withMessages(['turn_order' => __('Choose who plays.')]);
            }

            $round->turn_order = $order;
            $round->turn_player_id = $order[0];
        }

        if (! $rules->timesTurns() || $room->turn_seconds === null) {
            return;
        }

        $round->turn_seconds = $room->turn_seconds;
        $round->turn_ends_at = $round->started_at->copy()->addSeconds($room->turn_seconds);
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

        return $this->endGameRound->handle($room, $round, $outcome, announcesToTeam: false);
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
            ->latest('ended_at')
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
