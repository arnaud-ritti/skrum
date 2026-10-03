<?php

namespace App\Http\Controllers\Retros;

use App\Actions\Retros\RetroGuard;
use App\Actions\Retros\SummarizeRoti;
use App\Enums\RetroPhase;
use App\Events\Retros\RotiRevealed;
use App\Http\Controllers\Controller;
use App\Models\Participant;
use App\Models\Retro;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class RetroRotiRevealsController extends Controller
{
    public function update(Request $request, Retro $retro, SummarizeRoti $summarizeRoti): JsonResponse
    {
        $participant = Participant::current($request);

        RetroGuard::facilitator($retro, $participant);
        RetroGuard::phase($retro, RetroPhase::Roti);

        $results = DB::transaction(function () use ($retro, $participant, $summarizeRoti): array {
            $locked = Retro::query()->whereKey($retro->id)->lockForUpdate()->firstOrFail();

            RetroGuard::facilitator($locked, $participant);
            RetroGuard::phase($locked, RetroPhase::Roti);

            if ($locked->roti_revealed_at !== null) {
                throw ValidationException::withMessages(['roti' => __('The ROTI is already revealed.')]);
            }

            $locked->update(['roti_revealed_at' => now()]);

            (new RotiRevealed($locked->id))->sendToOthers();

            return $summarizeRoti->handle($locked);
        });

        return response()->json(['results' => $results]);
    }
}
