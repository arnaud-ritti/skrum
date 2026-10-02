<?php

namespace App\Http\Controllers\Retros;

use App\Actions\Retros\RetroGuard;
use App\Actions\Retros\SummarizeReactions;
use App\Enums\RetroPhase;
use App\Events\Retros\CardReactionsChanged;
use App\Http\Controllers\Controller;
use App\Models\Card;
use App\Models\Participant;
use App\Models\Retro;
use App\Rules\SingleEmoji;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class CardReactionsController extends Controller
{
    public function __construct(private SummarizeReactions $summarizeReactions) {}

    public function update(Request $request, Retro $retro, Card $card): JsonResponse
    {
        return $this->toggle($request, $retro, $card, adds: true);
    }

    public function destroy(Request $request, Retro $retro, Card $card): JsonResponse
    {
        return $this->toggle($request, $retro, $card, adds: false);
    }

    private function toggle(Request $request, Retro $retro, Card $card, bool $adds): JsonResponse
    {
        $participant = Participant::current($request);

        $this->guard($retro);

        $validated = $request->validate([
            'emoji' => ['required', 'string', new SingleEmoji],
        ]);

        [$reactions, $presentingRetro] = DB::transaction(function () use ($retro, $card, $participant, $validated, $adds): array {
            $locked = Retro::query()->whereKey($retro->id)->lockForUpdate()->firstOrFail();

            $this->guard($locked);

            $fresh = $locked->cards()->whereKey($card->id)->firstOrFail();

            if ($adds) {
                $fresh->reactions()->firstOrCreate(
                    ['participant_id' => $participant->id, 'emoji' => $validated['emoji']],
                    ['retro_id' => $locked->id],
                );
            }

            if (! $adds) {
                $fresh->reactions()->where('participant_id', $participant->id)->where('emoji', $validated['emoji'])->delete();
            }

            $reactions = $fresh->reactions()->with('participant.user')->get();

            (new CardReactionsChanged($locked->id, $fresh->id, $this->summarizeReactions->forOthers($reactions, $locked)))->sendToOthers();

            return [$reactions, $locked];
        });

        return response()->json([
            'cardId' => $card->id,
            'reactions' => $this->summarizeReactions->handle($reactions, $presentingRetro, $participant),
        ]);
    }

    private function guard(Retro $retro): void
    {
        RetroGuard::phase($retro, RetroPhase::Grouping, RetroPhase::Voting, RetroPhase::Discussing, RetroPhase::Actions);
        RetroGuard::unlocked($retro);
        RetroGuard::reactionsEnabled($retro);
    }
}
