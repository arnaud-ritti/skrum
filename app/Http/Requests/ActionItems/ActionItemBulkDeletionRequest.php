<?php

namespace App\Http\Requests\ActionItems;

use App\Actions\ActionItems\ActionItemBulkChanges;
use App\Actions\ActionItems\ActionItemQuery;
use Illuminate\Foundation\Http\FormRequest;

class ActionItemBulkDeletionRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, array<int, mixed>>
     */
    public function rules(): array
    {
        return [
            'ids' => ['required_without:count', 'prohibits:count,filters', 'array', 'min:1', 'max:'.ActionItemQuery::PerPage],
            'ids.*' => ['required', 'uuid', 'distinct'],
            'filters' => ['sometimes', 'missing_with:ids', 'array:'.implode(',', ActionItemBulkChanges::FilterKeys)],
            'filters.*' => ['nullable', 'string', 'max:500'],
            'count' => ['required_without:ids', 'integer', 'min:1', 'max:'.ActionItemBulkChanges::MatchingCap],
        ];
    }
}
