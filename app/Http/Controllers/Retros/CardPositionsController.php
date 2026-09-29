<?php

namespace App\Http\Controllers\Retros;

use App\Actions\Retros\PlaceCard;
use App\Actions\Retros\PresentCard;
use App\Actions\Retros\RetroGuard;
use App\Enums\RetroPhase;
use App\Events\Retros\CardsMoved;
use App\Http\Controllers\Controller;
use App\Models\Card;
use App\Models\Participant;
use App\Models\Retro;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class CardPositionsController extends Controller
{
    public function update(Request $request, Retro $retro, Card $card, PlaceCard $placeCard, PresentCard $presentCard): JsonResponse
    {
        $participant = Participant::current($request);

        RetroGuard::phase($retro, RetroPhase::Writing, RetroPhase::Grouping);

        if ($retro->phase === RetroPhase::Writing) {
            RetroGuard::author($card, $participant);
        }

        $validated = $request->validate([
            'column_id' => ['required', 'uuid', Rule::exists('columns', 'id')->where('retro_id', $retro->id)],
            'index' => ['required', 'integer', 'min:0'],
        ]);

        [$changed, $presentingRetro] = DB::transaction(function () use ($retro, $card, $participant, $validated, $placeCard, $presentCard): array {
            $locked = Retro::query()->whereKey($retro->id)->lockForUpdate()->firstOrFail();

            RetroGuard::phase($locked, RetroPhase::Writing, RetroPhase::Grouping);

            $fresh = $locked->cards()->whereKey($card->id)->firstOrFail();

            if ($locked->phase === RetroPhase::Writing) {
                RetroGuard::author($fresh, $participant);
            }

            $changed = $placeCard->handle($fresh, $locked->columns()->whereKey($validated['column_id'])->firstOrFail(), (int) $validated['index']);

            (new CardsMoved($locked->id, $changed->map(fn (Card $moved) => $presentCard->handle($moved, $locked, null))->all()))->sendToOthers();

            return [$changed, $locked];
        });

        return response()->json([
            'cards' => $changed->map(fn (Card $moved) => $presentCard->handle($moved, $presentingRetro, $participant))->all(),
        ]);
    }
}
