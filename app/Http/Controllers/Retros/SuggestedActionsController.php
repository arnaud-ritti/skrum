<?php

namespace App\Http\Controllers\Retros;

use App\Actions\Retros\PresentSuggestedAction;
use App\Actions\Retros\RejectSuggestedAction;
use App\Actions\Retros\SuggestionGuard;
use App\Http\Controllers\Controller;
use App\Models\Participant;
use App\Models\Retro;
use App\Models\SuggestedAction;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class SuggestedActionsController extends Controller
{
    public function __construct(
        private SuggestionGuard $suggestionGuard,
        private RejectSuggestedAction $rejectSuggestedAction,
        private PresentSuggestedAction $presentSuggestedAction,
    ) {}

    public function destroy(Request $request, Retro $retro, SuggestedAction $suggestedAction): JsonResponse
    {
        $participant = Participant::current($request);

        $this->suggestionGuard->authorize($retro, $participant);

        $suggestion = DB::transaction(function () use ($retro, $suggestedAction, $participant): SuggestedAction {
            $locked = Retro::query()->whereKey($retro->id)->lockForUpdate()->firstOrFail();
            $fresh = $locked->suggestedActions()->whereKey($suggestedAction->id)->firstOrFail();

            $this->rejectSuggestedAction->handle($locked, $fresh, $participant);

            return $fresh;
        });

        return response()->json(['suggestedAction' => $this->presentSuggestedAction->handle($suggestion)]);
    }
}
