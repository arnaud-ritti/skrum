<?php

namespace App\Actions\ActionItems;

use App\Enums\ActionItemStatus;
use Illuminate\Validation\Rule;

class ActionItemSubtaskRules
{
    /**
     * @return array<string, array<int, mixed>>
     */
    public static function create(): array
    {
        return ['content' => ['required', 'string', 'max:200']];
    }

    /**
     * @return array<string, array<int, mixed>>
     */
    public static function update(): array
    {
        return [
            'content' => ['sometimes', 'required', 'string', 'max:200'],
            'status' => ['sometimes', 'required', Rule::enum(ActionItemStatus::class)->only([ActionItemStatus::Open, ActionItemStatus::Completed])],
            'position' => ['sometimes', 'required', 'integer', 'min:0', 'max:19'],
        ];
    }
}
