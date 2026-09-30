<?php

namespace App\Actions\ActionItems;

use App\Enums\ActionItemPriority;
use App\Enums\ActionItemStatus;
use Illuminate\Validation\Rule;

class ActionItemRules
{
    /**
     * @return array<string, array<int, mixed>>
     */
    public static function create(bool $allowsGuests): array
    {
        return [
            'content' => ['required', 'string', 'max:500'],
            ...self::optionalFields($allowsGuests),
        ];
    }

    /**
     * @return array<string, array<int, mixed>>
     */
    public static function update(bool $allowsGuests): array
    {
        return [
            'content' => ['sometimes', 'required', 'string', 'max:500'],
            ...self::optionalFields($allowsGuests),
            'status' => ['sometimes', 'required', Rule::enum(ActionItemStatus::class)],
        ];
    }

    /**
     * @return array<string, string>
     */
    public static function messages(): array
    {
        return [
            'assignee_participant_id.prohibited' => __('Guests can only be assigned from their own retrospective.'),
        ];
    }

    /**
     * The plain item fields of a validated request; assignee and status go
     * through ResolveActionItemAssignee and SetActionItemStatus.
     *
     * @param  array<string, mixed>  $validated
     * @return array<string, mixed>
     */
    public static function attributes(array $validated): array
    {
        return array_intersect_key($validated, array_flip(['content', 'priority', 'due_on']));
    }

    /**
     * @return array<string, array<int, mixed>>
     */
    private static function optionalFields(bool $allowsGuests): array
    {
        return [
            'priority' => ['sometimes', 'required', Rule::enum(ActionItemPriority::class)],
            'due_on' => ['sometimes', 'nullable', 'date_format:Y-m-d', 'after_or_equal:2000-01-01', 'before_or_equal:2100-12-31'],
            'assignee_user_id' => ['sometimes', 'nullable', 'uuid'],
            'assignee_participant_id' => $allowsGuests ? ['sometimes', 'nullable', 'uuid'] : ['prohibited'],
        ];
    }
}
