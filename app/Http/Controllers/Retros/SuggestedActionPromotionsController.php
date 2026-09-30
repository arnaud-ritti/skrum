<?php

namespace App\Http\Controllers\Retros;

use App\Actions\Retros\PresentActionItem;
use App\Actions\Retros\PresentSuggestedAction;
use App\Actions\Retros\PromoteSuggestedAction;
use App\Actions\Retros\SuggestionGuard;
use App\Http\Controllers\Controller;
use App\Models\Participant;
use App\Models\Retro;
use App\Models\SuggestedAction;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class SuggestedActionPromotionsController extends Controller
{
    public function __construct(
        private SuggestionGuard $suggestionGuard,
        private PromoteSuggestedAction $promoteSuggestedAction,
        private PresentSuggestedAction $presentSuggestedAction,
        private PresentActionItem $presentActionItem,
    ) {}

    public function store(Request $request, Retro $retro, SuggestedAction $suggestedAction): JsonResponse
    {
        $participant = Participant::current($request);

        $this->suggestionGuard->authorize($retro, $participant);

        [$suggestion, $actionItem] = DB::transaction(function () use ($retro, $suggestedAction, $participant): array {
            $locked = Retro::query()->whereKey($retro->id)->lockForUpdate()->firstOrFail();
            $fresh = $locked->suggestedActions()->whereKey($suggestedAction->id)->firstOrFail();

            return [$fresh, $this->promoteSuggestedAction->handle($locked, $fresh, $participant)];
        });

        return response()->json([
            'suggestedAction' => $this->presentSuggestedAction->handle($suggestion),
            'actionItem' => $this->presentActionItem->handle($actionItem),
        ]);
    }
}
