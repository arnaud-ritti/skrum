<?php

namespace App\Actions\Games;

use App\Enums\GameKind;
use App\Events\Games\GameAnswerChanged;
use App\Models\GameGifAnswer;
use App\Models\GamePlayer;
use App\Models\GameRoom;
use App\Models\GameRound;
use App\Support\Gifs\Gif;
use App\Support\Gifs\GifCatalog;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\ConflictHttpException;

class SetGifAnswer
{
    public function __construct(
        private GifCatalog $gifCatalog,
        private PresentGifAnswers $presentGifAnswers,
    ) {}

    /**
     * The GIF is looked up before the locks are taken (a provider call can
     * take seconds); the round is checked again once locked.
     *
     * @return array{id: string, gif: array{id: string, previewUrl: string, url: string}}
     */
    public function handle(GameRoom $room, GameRound $round, GamePlayer $player, string $gifId): array
    {
        self::guard($room, $round);

        $gif = $this->gifCatalog->attempt(
            fn (): ?Gif => $this->gifCatalog->resolve($gifId),
            __('GIF search is unavailable.'),
        );

        if ($gif === null) {
            throw ValidationException::withMessages(['gif_id' => __('This GIF could not be found.')]);
        }

        return DB::transaction(function () use ($room, $round, $player, $gifId): array {
            [$lockedRoom, $lockedRound] = LockGameRound::handle($room, $round);

            self::guard($lockedRoom, $lockedRound);

            $answer = GameGifAnswer::query()->updateOrCreate(
                ['game_round_id' => $lockedRound->id, 'player_id' => $player->id],
                ['gif_id' => $gifId],
            );

            if ($answer->wasRecentlyCreated) {
                (new GameAnswerChanged($lockedRoom, $lockedRound->id, $player->id, true))->sendToOthers();
            }

            return $this->presentGifAnswers->mine($answer);
        });
    }

    /**
     * Answers can change until the reveal, never after.
     */
    public static function guard(GameRoom $room, GameRound $round): void
    {
        GameGuard::mutable($room);
        GameGuard::activeRound($room, $round);
        GameGuard::roundGame($round, GameKind::SprintGif);

        if ($round->revealed_at !== null) {
            throw new ConflictHttpException(__('The GIFs are already revealed.'));
        }
    }
}
