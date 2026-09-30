<?php

namespace App\Http\Controllers\Retros;

use App\Actions\Retros\PresentCard;
use App\Actions\Retros\RetroGuard;
use App\Enums\RetroPhase;
use App\Events\Retros\CardCreated;
use App\Events\Retros\CardDeleted;
use App\Events\Retros\CardGroupNamed;
use App\Events\Retros\CardUpdated;
use App\Events\Retros\OwnCardSaved;
use App\Http\Controllers\Controller;
use App\Models\Card;
use App\Models\Participant;
use App\Models\Retro;
use App\Support\Gifs\Gif;
use App\Support\Gifs\GifCatalog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class CardsController extends Controller
{
    public function __construct(
        private PresentCard $presentCard,
        private GifCatalog $gifCatalog,
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

        $this->ensureGif($retro, $validated['gif_id'] ?? null);

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

        RetroGuard::phase($retro, RetroPhase::Writing, RetroPhase::Grouping);
        RetroGuard::unlocked($retro);
        RetroGuard::author($card, $participant);

        $validated = $request->validate([
            'content' => ['sometimes', 'nullable', 'string', 'max:1000'],
            'gif_id' => ['sometimes', 'nullable', 'string', 'max:64', 'regex:/^[A-Za-z0-9_-]+$/'],
        ]);

        if (($validated['gif_id'] ?? null) !== null && $validated['gif_id'] !== $card->gif_id) {
            $this->ensureGif($retro, $validated['gif_id']);
        }

        [$card, $presentingRetro] = DB::transaction(function () use ($retro, $card, $participant, $validated): array {
            $locked = Retro::query()->whereKey($retro->id)->lockForUpdate()->firstOrFail();

            RetroGuard::phase($locked, RetroPhase::Writing, RetroPhase::Grouping);
            RetroGuard::unlocked($locked);

            $fresh = $locked->cards()->whereKey($card->id)->firstOrFail();

            RetroGuard::author($fresh, $participant);

            $content = array_key_exists('content', $validated) ? $validated['content'] : $fresh->content;
            $gifId = array_key_exists('gif_id', $validated) ? $validated['gif_id'] : $fresh->gif_id;

            if ($gifId !== null && $gifId !== $fresh->gif_id) {
                RetroGuard::gifsEnabled($locked, $this->gifCatalog);
            }

            if ($content === null && $gifId === null) {
                throw ValidationException::withMessages(['content' => __('A card needs text or a GIF.')]);
            }

            $fresh->update(['content' => $content, 'gif_id' => $gifId]);

            (new CardUpdated($locked->id, $this->presentCard->handle($fresh, $locked, null)))->sendToOthers();
            (new OwnCardSaved($locked->id, $participant->id, $this->presentCard->handle($fresh, $locked, $participant)))->sendToOthers();

            return [$fresh, $locked];
        });

        return response()->json(['card' => $this->presentCard->handle($card, $presentingRetro, $participant)]);
    }

    public function destroy(Request $request, Retro $retro, Card $card): Response
    {
        $participant = Participant::current($request);

        RetroGuard::phase($retro, RetroPhase::Writing, RetroPhase::Grouping);
        RetroGuard::unlocked($retro);
        RetroGuard::author($card, $participant);

        DB::transaction(function () use ($retro, $card, $participant): void {
            $locked = Retro::query()->whereKey($retro->id)->lockForUpdate()->firstOrFail();

            RetroGuard::phase($locked, RetroPhase::Writing, RetroPhase::Grouping);
            RetroGuard::unlocked($locked);

            $card = $locked->cards()->whereKey($card->id)->firstOrFail();

            RetroGuard::author($card, $participant);

            $formerLeadId = $card->parent_card_id;
            $children = $card->children()->orderBy('position')->get();

            $card->delete();

            $ungroupedCards = $children->map(function (Card $child) use ($locked): array {
                $lastPosition = $locked->cards()
                    ->where('column_id', $child->column_id)
                    ->whereNull('parent_card_id')
                    ->max('position');

                $child->parent_card_id = null;
                $child->position = $lastPosition === null ? 0 : $lastPosition + 1;
                $child->save();

                return $this->presentCard->handle($child, $locked, null);
            })->all();

            (new CardDeleted($locked->id, $card->id, $ungroupedCards))->sendToOthers();

            $formerLead = $formerLeadId === null ? null : $locked->cards()->whereKey($formerLeadId)->first();

            if ($formerLead !== null && $formerLead->clearGroupNameWhenEmpty()) {
                (new CardGroupNamed($locked->id, $formerLead->id, null))->sendToOthers();
            }
        });

        return response()->noContent();
    }

    private function ensureGif(Retro $retro, ?string $gifId): void
    {
        if ($gifId === null) {
            return;
        }

        RetroGuard::gifsEnabled($retro, $this->gifCatalog);

        $gif = $this->gifCatalog->attempt(
            fn (): ?Gif => $this->gifCatalog->resolve($gifId),
            __('GIF search is unavailable.'),
        );

        if ($gif === null) {
            throw ValidationException::withMessages(['gif_id' => __('This GIF could not be found.')]);
        }
    }
}
