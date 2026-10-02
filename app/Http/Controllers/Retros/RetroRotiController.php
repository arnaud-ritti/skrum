<?php

namespace App\Http\Controllers\Retros;

use App\Actions\Retros\RetroGuard;
use App\Events\Retros\RotiChanged;
use App\Http\Controllers\Controller;
use App\Models\Participant;
use App\Models\Retro;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class RetroRotiController extends Controller
{
    public function update(Request $request, Retro $retro): JsonResponse
    {
        $participant = Participant::current($request);

        $this->guard($retro);

        $validated = $request->validate([
            'score' => ['required', 'integer', 'between:1,5'],
        ]);

        $score = (int) $validated['score'];

        $voterIds = DB::transaction(function () use ($retro, $participant, $score): array {
            $locked = Retro::query()->whereKey($retro->id)->lockForUpdate()->firstOrFail();

            $this->guard($locked);

            $locked->rotiVotes()->updateOrCreate(['participant_id' => $participant->id], ['score' => $score]);

            return $this->announce($locked);
        });

        return response()->json(['myScore' => $score, 'respondents' => count($voterIds), 'voterIds' => $voterIds]);
    }

    public function destroy(Request $request, Retro $retro): JsonResponse
    {
        $participant = Participant::current($request);

        $this->guard($retro);

        $voterIds = DB::transaction(function () use ($retro, $participant): array {
            $locked = Retro::query()->whereKey($retro->id)->lockForUpdate()->firstOrFail();

            $this->guard($locked);

            $locked->rotiVotes()->where('participant_id', $participant->id)->delete();

            return $this->announce($locked);
        });

        return response()->json(['myScore' => null, 'respondents' => count($voterIds), 'voterIds' => $voterIds]);
    }

    private function guard(Retro $retro): void
    {
        RetroGuard::takesRotiVotes($retro);
    }

    /** @return array<int, string> */
    private function announce(Retro $retro): array
    {
        $voterIds = $retro->rotiVotes()->pluck('participant_id')->all();

        (new RotiChanged($retro->id, count($voterIds), $voterIds))->sendToOthers();

        return $voterIds;
    }
}
