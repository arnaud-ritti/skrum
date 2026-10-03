<?php

namespace App\Http\Requests\Teams;

use App\Models\Team;
use Illuminate\Foundation\Http\FormRequest;

class TeamFacilitatorsRequest extends FormRequest
{
    public const int MaxFacilitators = 10;

    public function authorize(): bool
    {
        $team = $this->route('team');

        if (! $team instanceof Team) {
            return false;
        }

        return $this->user()?->can('manageRituals', $team) ?? false;
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
        return array_values(array_map(fn (mixed $id): string => (string) $id, (array) $this->validated('user_ids')));
    }
}
