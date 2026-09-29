<?php

namespace App\Http\Controllers\Retros;

use App\Actions\Retros\GroupCard;
use App\Actions\Retros\PresentCard;
use App\Actions\Retros\RetroGuard;
use App\Enums\RetroPhase;
use App\Events\Retros\CardGrouped;
use App\Events\Retros\CardUngrouped;
use App\Http\Controllers\Controller;
use App\Models\Card;
use App\Models\Participant;
use App\Models\Retro;
use Illuminate\Database\Eloquent\Collection as EloquentCollection;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class CardGroupsController extends Controller
{
    public function __construct(
        private GroupCard $groupCard,
        private PresentCard $presentCard,
    ) {}

    public function update(Request $request, Retro $retro, Card $card): JsonResponse
    {
        $participant = Participant::current($request);

        RetroGuard::phase($retro, RetroPhase::Grouping);

        $validated = $request->validate([
            'parent_card_id' => ['required', 'uuid', Rule::exists('cards', 'id')->where('retro_id', $retro->id)],
        ]);

        [$changed, $presentingRetro] = DB::transaction(function () use ($retro, $card, $validated): array {
            $locked = Retro::query()->whereKey($retro->id)->lockForUpdate()->firstOrFail();

            RetroGuard::phase($locked, RetroPhase::Grouping);

            $card = $locked->cards()->whereKey($card->id)->firstOrFail();
            $lead = $locked->cards()->whereKey($validated['parent_card_id'])->firstOrFail();

            $changed = $this->groupCard->group($card, $lead);

            (new CardGrouped($locked->id, $this->present($changed, $locked, null)))->sendToOthers();

            return [$changed, $locked];
        });

        return response()->json(['cards' => $this->present($changed, $presentingRetro, $participant)]);
    }

    public function destroy(Request $request, Retro $retro, Card $card): JsonResponse
    {
        $participant = Participant::current($request);

        RetroGuard::phase($retro, RetroPhase::Grouping);

        [$changed, $presentingRetro] = DB::transaction(function () use ($retro, $card): array {
            $locked = Retro::query()->whereKey($retro->id)->lockForUpdate()->firstOrFail();

            RetroGuard::phase($locked, RetroPhase::Grouping);

            $card = $locked->cards()->whereKey($card->id)->firstOrFail();

            $changed = $this->groupCard->ungroup($card);

            (new CardUngrouped($locked->id, $this->present($changed, $locked, null)))->sendToOthers();

            return [$changed, $locked];
        });

        return response()->json(['cards' => $this->present($changed, $presentingRetro, $participant)]);
    }

    /**
     * @param  Collection<int, Card>  $cards
     * @return array<int, array<string, mixed>>
     */
    private function present(Collection $cards, Retro $retro, ?Participant $viewer): array
    {
        $cards = new EloquentCollection($cards->all());
        $cards->load('participant.user');

        return $cards->map(fn (Card $card) => $this->presentCard->handle($card, $retro, $viewer))->values()->all();
    }
}
