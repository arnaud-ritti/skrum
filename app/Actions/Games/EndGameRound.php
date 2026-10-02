<?php

namespace App\Actions\Games;

use App\Enums\GameRoundOutcome;
use App\Events\Games\GameRoundEnded;
use App\Models\GamePlayer;
use App\Models\GameRoom;
use App\Models\GameRound;
use App\Support\Games\GameRulesRegistry;

/**
 * The only way a round ends. Callers hold the room and round locks; a round
 * that already ended is left untouched, so a replayed end (a timer job
 * after a lazy expiry, two concurrent last guesses) scores nothing twice.
 */
class EndGameRound
{
    public function __construct(
        private AwardRoundPoints $awardRoundPoints,
        private GameRulesRegistry $gameRulesRegistry,
        private AnnounceTeamGameRoom $announceTeamGameRoom,
    ) {}

    /**
     * A caller that goes on changing the room announces it to the team itself, once.
     *
     * @return array<string, mixed>|null the game.round.ended payload, null when the round had already ended
     */
    public function handle(
        GameRoom $room,
        GameRound $round,
        GameRoundOutcome $outcome,
        ?GamePlayer $winner = null,
        bool $announcesToTeam = true,
    ): ?array {
        if (! $round->isActive()) {
            return null;
        }

        $round->forceFill([
            'outcome' => $outcome,
            'ended_at' => now(),
            'winner_player_id' => $winner->id ?? $round->winner_player_id,
        ])->save();

        $points = $outcome === GameRoundOutcome::Abandoned ? [] : $this->awardRoundPoints->handle($room, $round);

        $payload = [
            'roundId' => $round->id,
            'outcome' => $outcome->value,
            'word' => $round->word,
            'winnerPlayerId' => $round->winner_player_id,
            'leaderPlayerId' => $round->leader_player_id,
            ...($this->gameRulesRegistry->find($round->game)?->endedPayload($round, $room) ?? []),
            'points' => $points,
        ];

        (new GameRoundEnded($room, $payload))->sendToOthers();

        if ($announcesToTeam) {
            $this->announceTeamGameRoom->changed($room);
        }

        return $payload;
    }
}
