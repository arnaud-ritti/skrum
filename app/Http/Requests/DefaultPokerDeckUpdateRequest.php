<?php

namespace App\Http\Requests;

use App\Enums\PokerDeck;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class DefaultPokerDeckUpdateRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('update', $this->route('team')) ?? false;
    }

    /**
     * @return array<string, array<int, mixed>>
     */
    public function rules(): array
    {
        return [
            'deck' => ['nullable', 'required_without:saved_deck_id', 'prohibits:saved_deck_id', Rule::enum(PokerDeck::class)->except(PokerDeck::Custom)],
            'saved_deck_id' => ['nullable', 'required_without:deck', 'uuid'],
        ];
    }
}
