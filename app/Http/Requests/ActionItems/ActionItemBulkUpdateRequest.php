<?php

namespace App\Http\Requests\ActionItems;

use App\Actions\ActionItems\ActionItemRules;

class ActionItemBulkUpdateRequest extends ActionItemBulkDeletionRequest
{
    public const array Changes = ['status', 'priority', 'due_on', 'assignee_user_id'];

    /**
     * The values are checked as the single-item update checks them.
     *
     * @return array<string, array<int, mixed>>
     */
    public function rules(): array
    {
        $single = collect(ActionItemRules::update(allowsGuests: false))
            ->only(self::Changes)
            ->mapWithKeys(fn (array $rules, string $field): array => ["changes.{$field}" => $rules])
            ->all();

        return [
            ...parent::rules(),
            'changes' => ['required', 'array:'.implode(',', self::Changes), 'min:1'],
            ...$single,
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return ActionItemRules::messages();
    }
}
