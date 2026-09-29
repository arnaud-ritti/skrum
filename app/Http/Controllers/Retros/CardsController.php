<?php

namespace App\Http\Controllers\Retros;

use App\Actions\Retros\PresentCard;
use App\Actions\Retros\RetroGuard;
use App\Enums\RetroPhase;
use App\Events\Retros\CardCreated;
use App\Events\Retros\CardDeleted;
use App\Events\Retros\CardUpdated;
use App\Http\Controllers\Controller;
use App\Models\Card;
use App\Models\Participant;
use App\Models\Retro;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class CardsController extends Controller
{
    public function __construct(private PresentCard $presentCard) {}

    public function store(Request $request, Retro $retro): JsonResponse
    {
        $participant = Participant::current($request);

        RetroGuard::phase($retro, RetroPhase::Writing);

        $validated = $request->validate([
            'column_id' => ['required', 'uuid', Rule::exists('columns', 'id')->where('retro_id', $retro->id)],
            'content' => ['required', 'string', 'max:1000'],
        ]);

        $card = DB::transaction(function () use ($retro, $participant, $validated): Card {
            $position = $retro->cards()
                ->where('column_id', $validated['column_id'])
                ->whereNull('parent_card_id')
                ->max('position');

            $card = $retro->cards()->create([
                'column_id' => $validated['column_id'],
                'participant_id' => $participant->id,
                'content' => $validated['content'],
                'position' => $position === null ? 0 : $position + 1,
            ]);

            (new CardCreated($retro->id, $this->presentCard->handle($card, $retro, null)))->sendToOthers();

            return $card;
        });

        return response()->json(['card' => $this->presentCard->handle($card, $retro, $participant)], 201);
    }

    public function update(Request $request, Retro $retro, Card $card): JsonResponse
    {
        $participant = Participant::current($request);

        RetroGuard::phase($retro, RetroPhase::Writing, RetroPhase::Grouping);
        RetroGuard::author($card, $participant);

        $validated = $request->validate([
            'content' => ['required', 'string', 'max:1000'],
        ]);

        DB::transaction(function () use ($retro, $card, $validated): void {
            $card->update(['content' => $validated['content']]);

            (new CardUpdated($retro->id, $this->presentCard->handle($card, $retro, null)))->sendToOthers();
        });

        return response()->json(['card' => $this->presentCard->handle($card, $retro, $participant)]);
    }

    public function destroy(Request $request, Retro $retro, Card $card): Response
    {
        $participant = Participant::current($request);

        RetroGuard::phase($retro, RetroPhase::Writing, RetroPhase::Grouping);
        RetroGuard::author($card, $participant);

        DB::transaction(function () use ($retro, $card): void {
            $children = $card->children()->orderBy('position')->get();

            $card->delete();

            $ungroupedCards = $children->map(function (Card $child) use ($retro): array {
                $lastPosition = $retro->cards()
                    ->where('column_id', $child->column_id)
                    ->whereNull('parent_card_id')
                    ->max('position');

                $child->parent_card_id = null;
                $child->position = $lastPosition === null ? 0 : $lastPosition + 1;
                $child->save();

                return $this->presentCard->handle($child, $retro, null);
            })->all();

            (new CardDeleted($retro->id, $card->id, $ungroupedCards))->sendToOthers();
        });

        return response()->noContent();
    }
}
