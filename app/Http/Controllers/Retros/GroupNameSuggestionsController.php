<?php

namespace App\Http\Controllers\Retros;

use App\Actions\Retros\RetroGuard;
use App\Actions\Retros\SuggestGroupNames;
use App\Http\Controllers\Controller;
use App\Models\Card;
use App\Models\Participant;
use App\Models\Retro;
use App\Support\Llm\Llm;
use App\Support\RateLimit;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class GroupNameSuggestionsController extends Controller
{
    private const int RequestsPerMinutePerParticipant = 5;

    private const int RequestsPerMinutePerRetro = 20;

    public function store(Request $request, Retro $retro, Llm $llm, SuggestGroupNames $suggestGroupNames): JsonResponse
    {
        $participant = Participant::current($request);

        abort_unless($llm->isConfigured() && $retro->ai_summary_enabled, 404);

        RetroGuard::groupNaming($retro);

        $validated = $request->validate([
            'cardIds' => ['sometimes', 'array', 'max:'.SuggestGroupNames::MaxGroups],
            'cardIds.*' => ['uuid', 'distinct'],
        ]);

        $leads = $this->groups($retro, $validated['cardIds'] ?? null);

        RateLimit::hit("group-names:participant:{$participant->id}", self::RequestsPerMinutePerParticipant);
        RateLimit::hit("group-names:retro:{$retro->id}", self::RequestsPerMinutePerRetro);

        return response()->json(['suggestions' => $suggestGroupNames->handle($retro, $leads)]);
    }

    /**
     * @param  array<int, string>|null  $cardIds
     * @return Collection<int, Card>
     */
    private function groups(Retro $retro, ?array $cardIds): Collection
    {
        $query = $retro->cards()
            ->whereNull('parent_card_id')
            ->whereHas('children')
            ->with(['children' => fn ($children) => $children->orderBy('position'), 'column'])
            ->orderBy('position');

        if ($cardIds === null) {
            return $query->whereNull('group_name')->limit(SuggestGroupNames::MaxGroups)->get();
        }

        $leads = $query->whereIn('id', $cardIds)->get();

        if ($leads->count() !== count($cardIds)) {
            throw ValidationException::withMessages(['cardIds' => __('Only groups can be named.')]);
        }

        return $leads;
    }
}
