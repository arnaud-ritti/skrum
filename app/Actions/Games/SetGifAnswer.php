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
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\ConflictHttpException;

class SetGifAnswer
{
    public function __construct(
        private GifCatalog $gifCatalog,
        private PresentGifAnswers $presentGifAnswers,
    ) {}

    /**
     * A new GIF is looked up before the locks are taken (a provider call can
     * take seconds); the round is checked again once locked. A blank caption
     * is stored as none; without one ($keepsCaption) the stored one stays.
     *
     * @return array{id: string, gif: array{id: string, previewUrl: string, url: string}, caption: ?string}
     */
    public function handle(GameRoom $room, GameRound $round, GamePlayer $player, string $gifId, ?string $caption = null, bool $keepsCaption = false): array
    {
        self::guard($room, $round);

        $isSameGif = GameGifAnswer::query()
            ->where('game_round_id', $round->id)
            ->where('player_id', $player->id)
            ->where('gif_id', $gifId)
            ->exists();

        if (! $isSameGif) {
            $this->ensureGifExists($gifId);
        }

        $changes = $keepsCaption
            ? ['gif_id' => $gifId]
            : ['gif_id' => $gifId, 'caption' => Str::of((string) $caption)->trim()->toString() ?: null];

        return DB::transaction(function () use ($room, $round, $player, $changes): array {
            [$lockedRoom, $lockedRound] = LockGameRound::handle($room, $round);

            self::guard($lockedRoom, $lockedRound);

            $answer = GameGifAnswer::query()->updateOrCreate(
                ['game_round_id' => $lockedRound->id, 'player_id' => $player->id],
                $changes,
            );

            if ($answer->wasRecentlyCreated) {
                new GameAnswerChanged($lockedRoom, $lockedRound->id, $player->id, true)->sendToOthers();
            }

            return $this->presentGifAnswers->mine($answer);
        });
    }

    private function ensureGifExists(string $gifId): void
    {
        $gif = $this->gifCatalog->attempt(
            fn (): ?Gif => $this->gifCatalog->resolve($gifId),
            __('GIF search is unavailable.'),
        );

        if ($gif === null) {
            throw ValidationException::withMessages(['gif_id' => __('This GIF could not be found.')]);
        }
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
