<?php

namespace App\Http\Requests\Teams;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class TeamRitualsRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('manageRituals', $this->route('team')) ?? false;
    }

    /**
     * @return array<string, array<int, mixed>>
     */
    public function rules(): array
    {
        return [
            'sprint_length_weeks' => ['nullable', 'integer', 'min:1', 'max:4'],
            'retro_weekday' => ['nullable', 'integer', 'min:1', 'max:7'],
            'retro_time' => ['nullable', 'date_format:H:i', Rule::prohibitedIf(fn (): bool => $this->input('retro_weekday') === null)],
        ];
    }

    /**
     * @return array{
     *     sprint_length_weeks: ?int,
     *     retro_weekday: ?int,
     *     retro_time: ?string
     * }
     */
    public function rituals(): array
    {
        $length = $this->validated('sprint_length_weeks');
        $weekday = $this->validated('retro_weekday');
        $time = $this->validated('retro_time');

        return [
            'sprint_length_weeks' => $length === null ? null : (int) $length,
            'retro_weekday' => $weekday === null ? null : (int) $weekday,
            'retro_time' => $time === null ? null : (string) $time,
        ];
    }
}
