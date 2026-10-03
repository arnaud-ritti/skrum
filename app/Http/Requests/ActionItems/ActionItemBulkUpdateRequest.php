<?php

namespace App\Http\Requests\ActionItems;

use App\Actions\ActionItems\ActionItemQuery;
use App\Actions\ActionItems\ActionItemRules;
use Illuminate\Foundation\Http\FormRequest;

class ActionItemBulkUpdateRequest extends FormRequest
{
    public const Changes = ['status', 'priority', 'due_on', 'assignee_user_id'];

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
            'ids' => ['required', 'array', 'min:1', 'max:'.ActionItemQuery::PerPage],
            'ids.*' => ['required', 'uuid', 'distinct'],
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
