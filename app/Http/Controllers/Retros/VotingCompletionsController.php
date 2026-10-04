<?php

namespace App\Http\Controllers\Retros;

use App\Actions\Retros\RetroGuard;
use App\Enums\RetroPhase;
use App\Events\Retros\VotingFinishedChanged;
use App\Http\Controllers\Controller;
use App\Models\Participant;
use App\Models\Retro;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * "I have finished voting": `update` says it, `destroy` takes it back. It
 * changes no card, so a locked board accepts it.
 */
class VotingCompletionsController extends Controller
{
    public function update(Request $request, Retro $retro): JsonResponse
    {
        return response()->json(['finishedIds' => $this->set($request, $retro, true)]);
    }

    public function destroy(Request $request, Retro $retro): JsonResponse
    {
        return response()->json(['finishedIds' => $this->set($request, $retro, false)]);
    }

    /**
     * @return array<int, string>
     */
    private function set(Request $request, Retro $retro, bool $finished): array
    {
        $participant = Participant::current($request);

        RetroGuard::phase($retro, RetroPhase::Voting);

        return DB::transaction(function () use ($retro, $participant, $finished): array {
            $locked = Retro::query()->whereKey($retro->id)->lockForUpdate()->firstOrFail();

            RetroGuard::phase($locked, RetroPhase::Voting);

            $voter = Participant::query()->whereKey($participant->id)->lockForUpdate()->firstOrFail();

            $voter->update(['voting_finished_at' => $finished ? ($voter->voting_finished_at ?? now()) : null]);

            $finishedIds = $locked->votingFinishedIds();

            new VotingFinishedChanged($locked->id, $finishedIds)->sendToOthers();

            return $finishedIds;
        });
    }
}
