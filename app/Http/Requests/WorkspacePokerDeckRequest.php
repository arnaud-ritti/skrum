<?php

namespace App\Http\Requests;

use App\Actions\Poker\PokerDeckRules;
use App\Actions\Poker\SavedPokerDeckRules;
use App\Models\SavedPokerDeck;
use App\Models\Workspace;
use Illuminate\Foundation\Http\FormRequest;

class WorkspacePokerDeckRequest extends FormRequest
{
    public function authorize(): bool
    {
        $user = $this->user();

        if ($user === null) {
            return false;
        }

        $pokerDeck = $this->route('pokerDeck');

        if ($pokerDeck instanceof SavedPokerDeck) {
            return $user->can('update', $pokerDeck);
        }

        return $user->can('createForWorkspace', [SavedPokerDeck::class, $this->route('workspace')]);
    }

    /**
     * @return array<string, array<int, mixed>>
     */
    public function rules(): array
    {
        /** @var Workspace $workspace */
        $workspace = $this->route('workspace');
        $pokerDeck = $this->route('pokerDeck');

        if ($pokerDeck instanceof SavedPokerDeck) {
            return [
                'name' => ['sometimes', 'required', ...SavedPokerDeckRules::nameRules($workspace, $pokerDeck)],
                'cards' => ['sometimes', ...PokerDeckRules::cardListRules()],
                'cards.*' => PokerDeckRules::cardRules(),
                'include_unknown' => ['sometimes', 'boolean'],
                'include_coffee' => ['sometimes', 'boolean'],
            ];
        }

        return [
            'name' => ['required', ...SavedPokerDeckRules::nameRules($workspace)],
            'cards' => PokerDeckRules::cardListRules(),
            'cards.*' => PokerDeckRules::cardRules(),
            'include_unknown' => ['sometimes', 'boolean'],
            'include_coffee' => ['sometimes', 'boolean'],
        ];
    }

    /**
     * @return array<int, string>
     */
    public function deckCards(): array
    {
        /** @var array<int, string> $cards */
        $cards = $this->validated('cards');

        return PokerDeckRules::withSpecialCards(
            $cards,
            (bool) $this->validated('include_unknown', true),
            (bool) $this->validated('include_coffee', true),
        );
    }
}
