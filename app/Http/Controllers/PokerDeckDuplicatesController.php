<?php

namespace App\Http\Controllers;

use App\Actions\Poker\SavedPokerDeckRules;
use App\Models\SavedPokerDeck;
use App\Models\Team;
use App\Models\Workspace;
use App\Support\Database\NameKey;
use App\Support\Database\Transactions;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Str;

class PokerDeckDuplicatesController extends Controller
{
    public function store(Request $request, Workspace $workspace, Team $team, SavedPokerDeck $pokerDeck): RedirectResponse
    {
        Gate::authorize('create', [SavedPokerDeck::class, $team]);

        DB::transaction(function () use ($request, $team, $pokerDeck): void {
            $lockedTeam = Team::query()->whereKey($team->id)->lockForUpdate()->firstOrFail();

            SavedPokerDeckRules::ensureRoom($lockedTeam);

            $lockedTeam->pokerDecks()->create([
                'name' => $this->availableName($lockedTeam, $pokerDeck->name),
                'cards' => $pokerDeck->cards,
                'created_by_user_id' => $request->user()->id,
            ]);
        }, Transactions::Attempts);

        return back();
    }

    private function availableName(Team $team, string $originalName): string
    {
        $takenKeys = $team->pokerDecks()->pluck('name_key');
        $baseName = __('Copy of :name', ['name' => $originalName]);

        $name = Str::limit($baseName, 40, '');
        $number = 2;

        while ($takenKeys->contains(NameKey::of($name))) {
            $suffix = " {$number}";

            $name = Str::limit($baseName, 40 - mb_strlen($suffix), '').$suffix;
            $number++;
        }

        return $name;
    }
}
