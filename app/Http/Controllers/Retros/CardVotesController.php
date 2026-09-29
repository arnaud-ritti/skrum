<?php

namespace App\Http\Controllers\Retros;

use App\Actions\Retros\RetroGuard;
use App\Enums\RetroPhase;
use App\Events\Retros\VoteCast;
use App\Events\Retros\VoteRetracted;
use App\Http\Controllers\Controller;
use App\Models\Card;
use App\Models\Participant;
use App\Models\Retro;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class CardVotesController extends Controller
{
    public function store(Request $request, Retro $retro, Card $card): JsonResponse
    {
        $participant = Participant::current($request);

        RetroGuard::phase($retro, RetroPhase::Voting);

        DB::transaction(function () use ($retro, $card, $participant): void {
            $locked = Retro::query()->whereKey($retro->id)->lockForUpdate()->firstOrFail();

            RetroGuard::phase($locked, RetroPhase::Voting);

            $card = $locked->cards()->whereKey($card->id)->firstOrFail();

            if (! $card->isTopLevel()) {
                throw ValidationException::withMessages(['votes' => __('Votes can only be cast on cards that are not grouped under another card.')]);
            }

            Participant::query()->whereKey($participant->id)->lockForUpdate()->first();

            $used = $locked->votes()->where('participant_id', $participant->id)->count();

            if ($used >= $locked->votes_per_participant) {
                throw ValidationException::withMessages(['votes' => __('You have no votes left.')]);
            }

            $locked->votes()->create([
                'card_id' => $card->id,
                'participant_id' => $participant->id,
            ]);

            (new VoteCast($locked->id, $locked->votes()->count()))->sendToOthers();
        });

        return response()->json($this->tally($retro, $card, $participant), 201);
    }

    public function destroy(Request $request, Retro $retro, Card $card): JsonResponse
    {
        $participant = Participant::current($request);

        RetroGuard::phase($retro, RetroPhase::Voting);

        DB::transaction(function () use ($retro, $card, $participant): void {
            $locked = Retro::query()->whereKey($retro->id)->lockForUpdate()->firstOrFail();

            RetroGuard::phase($locked, RetroPhase::Voting);

            $vote = $card->votes()->where('participant_id', $participant->id)->latest()->lockForUpdate()->first();

            if ($vote === null) {
                throw ValidationException::withMessages(['votes' => __('You have not voted for this card.')]);
            }

            $vote->delete();

            (new VoteRetracted($locked->id, $locked->votes()->count()))->sendToOthers();
        });

        return response()->json($this->tally($retro, $card, $participant));
    }

    /**
     * @return array{
     *     cardId: string,
     *     myVotes: int,
     *     remainingVotes: int
     * }
     */
    private function tally(Retro $retro, Card $card, Participant $participant): array
    {
        $used = $retro->votes()->where('participant_id', $participant->id)->count();

        return [
            'cardId' => $card->id,
            'myVotes' => $card->votes()->where('participant_id', $participant->id)->count(),
            'remainingVotes' => max(0, $retro->votes_per_participant - $used),
        ];
    }
}
