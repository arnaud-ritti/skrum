<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class TeamAccessRequestUpdateRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('manageMembers', $this->route('team')) ?? false;
    }

    /**
     * @return array<string, array<int, mixed>>
     */
    public function rules(): array
    {
        return [
            'decision' => ['required', Rule::in(['approve', 'decline'])],
        ];
    }
}
