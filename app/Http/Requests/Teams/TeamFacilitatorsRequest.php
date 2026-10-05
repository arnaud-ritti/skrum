<?php

namespace App\Http\Requests\Teams;

use Illuminate\Foundation\Http\FormRequest;

class TeamFacilitatorsRequest extends FormRequest
{
    public const int MaxFacilitators = 10;

    public function authorize(): bool
    {
        return $this->user()?->can('manageRituals', $this->route('team')) ?? false;
    }

    /**
     * @return array<string, array<int, string>>
     */
    public function rules(): array
    {
        return [
            'user_ids' => ['present', 'array', 'max:'.self::MaxFacilitators],
            'user_ids.*' => ['required', 'uuid', 'distinct'],
            'rotation' => ['required', 'boolean'],
        ];
    }

    /**
     * @return array<int, string>
     */
    public function userIds(): array
    {
        return array_values(array_map(strval(...), (array) $this->validated('user_ids')));
    }
}
