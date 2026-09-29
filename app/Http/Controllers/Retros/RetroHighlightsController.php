<?php

namespace App\Http\Controllers\Retros;

use App\Actions\Retros\RetroGuard;
use App\Enums\RetroPhase;
use App\Events\Retros\CardHighlighted;
use App\Http\Controllers\Controller;
use App\Models\Participant;
use App\Models\Retro;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class RetroHighlightsController extends Controller
{
    public function update(Request $request, Retro $retro): JsonResponse
    {
        $participant = Participant::current($request);

        RetroGuard::facilitator($retro, $participant);
        RetroGuard::phase($retro, RetroPhase::Discussing);

        $validated = $request->validate([
            'card_id' => [
                'present',
                'nullable',
                'uuid',
                Rule::exists('cards', 'id')->where('retro_id', $retro->id)->whereNull('parent_card_id'),
            ],
        ]);

        DB::transaction(function () use ($retro, $participant, $validated): void {
            $locked = Retro::query()->whereKey($retro->id)->lockForUpdate()->firstOrFail();

            RetroGuard::facilitator($locked, $participant);
            RetroGuard::phase($locked, RetroPhase::Discussing);

            $locked->update(['highlighted_card_id' => $validated['card_id']]);

            (new CardHighlighted($locked->id, $validated['card_id']))->sendToOthers();
        });

        return response()->json(['highlightedCardId' => $validated['card_id']]);
    }
}
