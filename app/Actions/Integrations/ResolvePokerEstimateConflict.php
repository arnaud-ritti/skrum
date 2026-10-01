<?php

namespace App\Actions\Integrations;

use App\Actions\Poker\PokerGuard;
use App\Actions\Poker\SetPokerEstimate;
use App\Models\PokerGame;
use App\Models\PokerPlayer;
use App\Models\PokerTask;
use Illuminate\Validation\ValidationException;

/**
 * Spec 8 §5.8: nothing is overwritten silently; the facilitator keeps
 * skrum's estimate (written back again) or takes the source's card.
 */
class ResolvePokerEstimateConflict
{
    public const KeepSkrum = 'keepSkrum';

    public const UseSource = 'useSource';

    public function __construct(
        private RequestEstimateSync $requestEstimateSync,
        private SetPokerEstimate $setPokerEstimate,
    ) {}

    public function handle(PokerGame $locked, PokerTask $task, PokerPlayer $player, string $resolution): PokerTask
    {
        PokerGuard::notEnded($locked);

        $conflict = PokerTaskSync::for($locked)->estimateConflict($task);

        if ($conflict === null) {
            abort(409, __('This estimate is already in sync.'));
        }

        if ($resolution === self::KeepSkrum) {
            $this->requestEstimateSync->retryAndBroadcast($locked, $task, $player);

            return $task;
        }

        if ($conflict['matchingCard'] === null) {
            throw ValidationException::withMessages(['resolution' => __(':value is not in this deck.', ['value' => $conflict['sourceEstimate']])]);
        }

        return $this->setPokerEstimate->fromSource($locked, $task, $conflict['matchingCard']);
    }
}
