<?php

namespace App\Http\Controllers\Retros;

use App\Actions\Retros\RetroGuard;
use App\Enums\RetroPhase;
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

        $respondents = DB::transaction(function () use ($retro, $participant, $score): int {
            $locked = Retro::query()->whereKey($retro->id)->lockForUpdate()->firstOrFail();

            $this->guard($locked);

            $locked->rotiVotes()->updateOrCreate(['participant_id' => $participant->id], ['score' => $score]);

            return $this->announce($locked);
        });

        return response()->json(['myScore' => $score, 'respondents' => $respondents]);
    }

    public function destroy(Request $request, Retro $retro): JsonResponse
    {
        $participant = Participant::current($request);

        $this->guard($retro);

        $respondents = DB::transaction(function () use ($retro, $participant): int {
            $locked = Retro::query()->whereKey($retro->id)->lockForUpdate()->firstOrFail();

            $this->guard($locked);

            $locked->rotiVotes()->where('participant_id', $participant->id)->delete();

            return $this->announce($locked);
        });

        return response()->json(['myScore' => null, 'respondents' => $respondents]);
    }

    private function guard(Retro $retro): void
    {
        RetroGuard::phase($retro, RetroPhase::Discussing, RetroPhase::Completed);
    }

    private function announce(Retro $retro): int
    {
        $voterIds = $retro->rotiVotes()->pluck('participant_id')->all();

        (new RotiChanged($retro->id, count($voterIds), $voterIds))->sendToOthers();

        return count($voterIds);
    }
}
