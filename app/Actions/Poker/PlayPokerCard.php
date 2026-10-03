<?php

namespace App\Actions\Poker;

use App\Events\Poker\PokerRoundChanged;
use App\Events\Poker\PokerVoteChanged;
use App\Models\PokerGame;
use App\Models\PokerPlayer;
use App\Models\PokerRound;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class PlayPokerCard
{
    /**
     * Plays `$value` for `$player` (the requester — never anyone else), or
     * withdraws their card when `$value` is null. A card changed in a
     * revealed round (`PokerGuard::acceptsCard`) changes its result: the
     * room reloads the round instead of counting a vote.
     *
     * @return array{
     *     roundId: string,
     *     myVote: ?string,
     *     votesCount: int,
     *     version: int,
     *     revealed: bool
     * }
     */
    public function handle(PokerGame $game, PokerRound $round, PokerPlayer $player, ?string $value): array
    {
        return DB::transaction(function () use ($game, $round, $player, $value): array {
            $locked = PokerGame::query()->whereKey($game->id)->lockForUpdate()->firstOrFail();
            $lockedRound = PokerRound::query()->whereKey($round->id)->lockForUpdate()->firstOrFail();
            $lockedPlayer = PokerPlayer::query()->whereKey($player->id)->lockForUpdate()->firstOrFail();

            PokerGuard::notEnded($locked);
            PokerGuard::canVote($lockedPlayer);
            PokerGuard::acceptsCard($locked, $lockedRound, $value);

            if ($value !== null && ! in_array($value, $locked->cards, true)) {
                throw ValidationException::withMessages(['value' => __('Choose a card from the deck.')]);
            }

            $vote = $lockedRound->votes()->where('poker_player_id', $lockedPlayer->id)->first();
            $changed = $vote?->value !== $value;

            if ($changed && $value === null) {
                $vote?->delete();
            }

            if ($changed && $value !== null && $vote === null) {
                $lockedRound->votes()->create(['poker_player_id' => $lockedPlayer->id, 'value' => $value]);
            }

            if ($changed && $value !== null && $vote !== null) {
                $vote->update(['value' => $value]);
            }

            if ($changed) {
                $lockedRound->increment('version');
            }

            $votesCount = $lockedRound->votes()->count();
            $revealed = $lockedRound->isRevealed();

            if ($changed && $revealed) {
                (new PokerRoundChanged($locked->id))->sendToOthers();
            }

            if ($changed && ! $revealed) {
                (new PokerVoteChanged(
                    $locked->id,
                    $lockedRound->id,
                    $lockedPlayer->id,
                    $value !== null,
                    $votesCount,
                    $lockedRound->version,
                ))->sendToOthers();
            }

            return [
                'roundId' => $lockedRound->id,
                'myVote' => $value,
                'votesCount' => $votesCount,
                'version' => $lockedRound->version,
                'revealed' => $revealed,
            ];
        });
    }
}
