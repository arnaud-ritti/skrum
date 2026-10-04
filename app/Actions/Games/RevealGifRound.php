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
     * @return array{roundId: string, revealedAt: string, answers: array<int, array<string, mixed>>, authorsHidden: bool}
     */
    public function handle(GameRoom $lockedRoom, GameRound $lockedRound): array
    {
        $lockedRound->forceFill(['revealed_at' => now()->startOfSecond()])->save();

        $payload = [
            'roundId' => $lockedRound->id,
            'revealedAt' => $lockedRound->revealed_at?->toIso8601String() ?? '',
            'answers' => $this->presentGifAnswers->revealed($lockedRound->gifAnswers()->get(), $lockedRoom, $lockedRound->authors_hidden),
            'authorsHidden' => PresentGifAnswers::authorsComeAtClose($lockedRoom, $lockedRound),
        ];

        new GameRoundRevealed($lockedRoom, $payload)->sendToOthers();

        return $payload;
    }
}
