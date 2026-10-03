<?php

namespace App\Http\Controllers\Retros;

use App\Actions\Retros\MoveTopicFocus;
use App\Actions\Retros\RetroGuard;
use App\Enums\RetroPhase;
use App\Http\Controllers\Controller;
use App\Models\Participant;
use App\Models\Retro;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class RetroHighlightsController extends Controller
{
    public function update(Request $request, Retro $retro, MoveTopicFocus $moveTopicFocus): JsonResponse
    {
        $participant = Participant::current($request);

        RetroGuard::facilitator($retro, $participant);
        RetroGuard::phase($retro, RetroPhase::Discussing, RetroPhase::Actions);

        $validated = $request->validate([
            'card_id' => [
                'present',
                'nullable',
                'uuid',
                Rule::exists('cards', 'id')->where('retro_id', $retro->id)->whereNull('parent_card_id'),
            ],
        ]);

        $moved = DB::transaction(function () use ($retro, $participant, $validated, $moveTopicFocus): array {
            $locked = Retro::query()->whereKey($retro->id)->lockForUpdate()->firstOrFail();

            RetroGuard::facilitator($locked, $participant);
            RetroGuard::phase($locked, RetroPhase::Discussing, RetroPhase::Actions);

            if ($validated['card_id'] !== null) {
                $isTopLevel = $locked->cards()->whereKey($validated['card_id'])->whereNull('parent_card_id')->exists();

                if (! $isTopLevel) {
                    throw ValidationException::withMessages(['card_id' => __('The selected card must be a top-level card of this retrospective.')]);
                }
            }

            return $moveTopicFocus->handle($locked, $validated['card_id']);
        });

        return response()->json(['highlightedCardId' => $validated['card_id'], ...$moved]);
    }
}
