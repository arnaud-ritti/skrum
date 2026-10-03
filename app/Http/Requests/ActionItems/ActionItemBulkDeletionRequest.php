<?php

namespace App\Http\Requests\ActionItems;

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
            'ids' => ['required', 'array', 'min:1', 'max:'.ActionItemQuery::PerPage],
            'ids.*' => ['required', 'uuid', 'distinct'],
        ];
    }
}
