<?php

namespace App\Actions\Games;

use App\Enums\GameKind;
use App\Events\Games\GameQuestionChanged;
use App\Models\GamePlayer;
use App\Models\GameRoom;
use App\Models\GameRound;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpKernel\Exception\ConflictHttpException;

class ChangeGifQuestion
{
    public function __construct(private PickGifQuestion $pickGifQuestion) {}

    /**
     * Only until the first answer: afterwards the answers were chosen for
     * the question as it stands.
     */
    public function handle(GameRoom $room, GameRound $round, GamePlayer $host, ?string $text): string
    {
        return DB::transaction(function () use ($room, $round, $host, $text): string {
            [$lockedRoom, $lockedRound] = LockGameRound::handle($room, $round);

            GameGuard::mutable($lockedRoom);
            GameGuard::host($lockedRoom, $host);
            GameGuard::activeRound($lockedRoom, $lockedRound);
            GameGuard::roundGame($lockedRound, GameKind::SprintGif);

            if ($lockedRound->revealed_at !== null || $lockedRound->gifAnswers()->exists()) {
                throw new ConflictHttpException(__('The question can no longer be changed.'));
            }

            $question = $text ?? $this->pickGifQuestion->handle($lockedRoom, $lockedRound->question);

            $lockedRound->forceFill(['question' => $question])->save();

            (new GameQuestionChanged($lockedRoom, $lockedRound->id, $question))->sendToOthers();

            return $question;
        });
    }
}
