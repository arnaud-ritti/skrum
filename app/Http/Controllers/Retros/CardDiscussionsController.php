<?php

namespace App\Http\Controllers\Retros;

use App\Actions\Retros\RetroGuard;
use App\Enums\RetroPhase;
use App\Events\Retros\TopicDiscussed;
use App\Http\Controllers\Controller;
use App\Models\Card;
use App\Models\Participant;
use App\Models\Retro;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * The facilitator's "Discussed" mark on a topic: `update` marks, `destroy` unmarks.
 */
class CardDiscussionsController extends Controller
{
    public function update(Request $request, Retro $retro, Card $card): JsonResponse
    {
        return response()->json($this->mark($request, $retro, $card, true));
    }

    public function destroy(Request $request, Retro $retro, Card $card): JsonResponse
    {
        return response()->json($this->mark($request, $retro, $card, false));
    }

    /**
     * @return array{cardId: string, discussedAt: ?string}
     */
    private function mark(Request $request, Retro $retro, Card $card, bool $discussed): array
    {
        $participant = Participant::current($request);

        RetroGuard::facilitator($retro, $participant);
        RetroGuard::phase($retro, RetroPhase::Discussing, RetroPhase::Actions);

        return DB::transaction(function () use ($retro, $card, $participant, $discussed): array {
            $locked = Retro::query()->whereKey($retro->id)->lockForUpdate()->firstOrFail();

            RetroGuard::facilitator($locked, $participant);
            RetroGuard::phase($locked, RetroPhase::Discussing, RetroPhase::Actions);

            $topic = $locked->cards()->whereKey($card->id)->firstOrFail();

            if (! $topic->isTopLevel()) {
                throw ValidationException::withMessages(['card' => __('Only a topic can be marked as discussed.')]);
            }

            $topic->update(['discussed_at' => $discussed ? ($topic->discussed_at ?? now()) : null]);

            $discussedAt = $topic->discussed_at?->toIso8601String();

            new TopicDiscussed($locked->id, $topic->id, $discussedAt)->sendToOthers();

            return ['cardId' => $topic->id, 'discussedAt' => $discussedAt];
        });
    }
}
