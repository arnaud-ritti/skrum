<?php

namespace App\Http\Requests\ActionItems;

use App\Actions\ActionItems\ActionItemBulkChanges;
use App\Actions\ActionItems\ActionItemQuery;
use App\Actions\ActionItems\ActionItemRules;
use Illuminate\Foundation\Http\FormRequest;

class ActionItemBulkUpdateRequest extends FormRequest
{
    public const array Changes = ['status', 'priority', 'due_on', 'assignee_user_id'];

    public function authorize(): bool
    {
        return true;
    }

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
            'ids' => ['required_without:count', 'prohibits:count,filters', 'array', 'min:1', 'max:'.ActionItemQuery::PerPage],
            'ids.*' => ['required', 'uuid', 'distinct'],
            'filters' => ['sometimes', 'missing_with:ids', 'array:'.implode(',', ActionItemBulkChanges::FilterKeys)],
            'filters.*' => ['nullable', 'string', 'max:500'],
            'count' => ['required_without:ids', 'integer', 'min:1', 'max:'.ActionItemBulkChanges::MatchingCap],
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
