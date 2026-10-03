<?php

namespace App\Http\Requests\Teams;

use App\Actions\Teams\StartNextSprint;
use App\Models\Team;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class TeamSprintRequest extends FormRequest
{
    public const int MaxDays = 56;

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
            'number' => ['required', 'integer', 'min:1', 'max:'.StartNextSprint::MaxNumber],
            'starts_on' => ['required', 'date_format:Y-m-d'],
            'ends_on' => ['required', 'date_format:Y-m-d', 'after_or_equal:starts_on'],
        ];
    }

    /**
     * @return array<int, callable(Validator): void>
     */
    public function after(): array
    {
        return [
            function (Validator $validator): void {
                if ($validator->errors()->isNotEmpty()) {
                    return;
                }

                $startsOn = CarbonImmutable::parse((string) $this->input('starts_on'));
                $days = (int) $startsOn->diffInDays(CarbonImmutable::parse((string) $this->input('ends_on'))) + 1;

                if ($days > self::MaxDays) {
                    $validator->errors()->add('ends_on', __('A sprint lasts at most eight weeks.'));
                }
            },
        ];
    }

    /**
     * @return array{number: int, starts_on: string, ends_on: string}
     */
    public function sprint(): array
    {
        return [
            'number' => (int) $this->validated('number'),
            'starts_on' => (string) $this->validated('starts_on'),
            'ends_on' => (string) $this->validated('ends_on'),
        ];
    }
}
