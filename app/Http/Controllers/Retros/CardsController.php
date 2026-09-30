<?php

namespace App\Http\Controllers\Retros;

use App\Actions\Retros\DeleteCard;
use App\Actions\Retros\EnsureCardGif;
use App\Actions\Retros\PresentCard;
use App\Actions\Retros\RetroGuard;
use App\Actions\Retros\UpdateCard;
use App\Enums\RetroPhase;
use App\Events\Retros\CardCreated;
use App\Events\Retros\OwnCardSaved;
use App\Http\Controllers\Controller;
use App\Models\Card;
use App\Models\Participant;
use App\Models\Retro;
use App\Support\Gifs\GifCatalog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class CardsController extends Controller
{
    public function __construct(
        private PresentCard $presentCard,
        private GifCatalog $gifCatalog,
        private EnsureCardGif $ensureCardGif,
        private UpdateCard $updateCard,
        private DeleteCard $deleteCard,
    ) {}

    public function store(Request $request, Retro $retro): JsonResponse
    {
        $participant = Participant::current($request);

        RetroGuard::phase($retro, RetroPhase::Writing);
        RetroGuard::unlocked($retro);

        $validated = $request->validate([
            'column_id' => ['required', 'uuid', Rule::exists('columns', 'id')->where('retro_id', $retro->id)],
            'content' => ['required_without:gif_id', 'nullable', 'string', 'max:1000'],
            'gif_id' => ['nullable', 'string', 'max:64', 'regex:/^[A-Za-z0-9_-]+$/'],
        ]);

        $this->ensureCardGif->handle($retro, $validated['gif_id'] ?? null);

        [$card, $presentingRetro] = DB::transaction(function () use ($retro, $participant, $validated): array {
            $locked = Retro::query()->whereKey($retro->id)->lockForUpdate()->firstOrFail();

            RetroGuard::phase($locked, RetroPhase::Writing);
            RetroGuard::unlocked($locked);

            if (($validated['gif_id'] ?? null) !== null) {
                RetroGuard::gifsEnabled($locked, $this->gifCatalog);
            }

            $column = $locked->columns()->whereKey($validated['column_id'])->firstOrFail();

            $position = $locked->cards()
                ->where('column_id', $column->id)
                ->whereNull('parent_card_id')
                ->max('position');

            $card = $locked->cards()->create([
                'column_id' => $column->id,
                'participant_id' => $participant->id,
                'content' => $validated['content'] ?? null,
                'gif_id' => $validated['gif_id'] ?? null,
                'position' => $position === null ? 0 : $position + 1,
            ]);

            (new CardCreated($locked->id, $this->presentCard->handle($card, $locked, null)))->sendToOthers();
            (new OwnCardSaved($locked->id, $participant->id, $this->presentCard->handle($card, $locked, $participant)))->sendToOthers();

            return [$card, $locked];
        });

        return response()->json(['card' => $this->presentCard->handle($card, $presentingRetro, $participant)], 201);
    }

    public function update(Request $request, Retro $retro, Card $card): JsonResponse
    {
        $participant = Participant::current($request);

        // UpdateCard repeats these guards, but they must run before validation so a refused request answers 403 rather than 422.
        RetroGuard::phase($retro, RetroPhase::Writing, RetroPhase::Grouping);
        RetroGuard::unlocked($retro);
        RetroGuard::author($card, $participant);

        $validated = $request->validate([
            'content' => ['sometimes', 'nullable', 'string', 'max:1000'],
            'gif_id' => ['sometimes', 'nullable', 'string', 'max:64', 'regex:/^[A-Za-z0-9_-]+$/'],
        ]);

        $updated = $this->updateCard->handle($retro, $card, $participant, $validated);

        return response()->json(['card' => $this->presentCard->handle($updated, $updated->retro, $participant)]);
    }

    public function destroy(Request $request, Retro $retro, Card $card): Response
    {
        $this->deleteCard->handle($retro, $card, Participant::current($request));

        return response()->noContent();
    }
}
