<?php

namespace App\Actions\Games;

use App\Events\Games\GameQuestionChanged;
use App\Models\GamePlayer;
use App\Models\GameRoom;
use App\Models\GameRound;
use App\Support\Games\AsksQuestions;
use App\Support\Games\GameRulesRegistry;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\ConflictHttpException;

class ChangeRoundQuestion
{
    public function __construct(
        private GameRulesRegistry $gameRulesRegistry,
        private PickRoundQuestion $pickRoundQuestion,
    ) {}

    /**
     * Only while the rules leave the question open: once answers were given,
     * they were given for the question as it stands.
     */
    public function handle(GameRoom $room, GameRound $round, GamePlayer $host, ?string $text): string
    {
        return DB::transaction(function () use ($room, $round, $host, $text): string {
            [$lockedRoom, $lockedRound] = LockGameRound::handle($room, $round);

            GameGuard::mutable($lockedRoom);
            GameGuard::host($lockedRoom, $host);
            GameGuard::activeRound($lockedRoom, $lockedRound);

            $rules = $this->gameRulesRegistry->for($lockedRound->game);

            if (! $rules instanceof AsksQuestions) {
                throw ValidationException::withMessages(['round' => __('This action does not apply to this game.')]);
            }

            if ($rules->questionLocked($lockedRound)) {
                throw new ConflictHttpException(__('The question can no longer be changed.'));
            }

            $question = $text ?? $this->pickRoundQuestion->handle($lockedRoom, $rules->questions($lockedRoom), $lockedRound->question);

            $lockedRound->forceFill(['question' => $question])->save();

            (new GameQuestionChanged($lockedRoom, $lockedRound->id, $question))->sendToOthers();

            return $question;
        });
    }
}
