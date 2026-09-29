<?php

namespace App\Http\Controllers\Retros;

use App\Actions\Retros\ChangeRetroPhase;
use App\Actions\Retros\RetroGuard;
use App\Enums\RetroPhase;
use App\Http\Controllers\Controller;
use App\Models\Participant;
use App\Models\Retro;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class RetroPhasesController extends Controller
{
    public function __construct(private ChangeRetroPhase $changeRetroPhase) {}

    public function update(Request $request, Retro $retro): JsonResponse
    {
        $participant = Participant::current($request);

        RetroGuard::facilitator($retro, $participant);

        $validated = $request->validate([
            'phase' => ['required', Rule::enum(RetroPhase::class)],
        ]);

        $phase = RetroPhase::from($validated['phase']);

        DB::transaction(function () use ($retro, $participant, $phase): void {
            $locked = Retro::query()->whereKey($retro->id)->lockForUpdate()->firstOrFail();

            RetroGuard::facilitator($locked, $participant);

            $this->changeRetroPhase->handle($locked, $phase);
        });

        return response()->json(['phase' => $phase->value]);
    }
}
