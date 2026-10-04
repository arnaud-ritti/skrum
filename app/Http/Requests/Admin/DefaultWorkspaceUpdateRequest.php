<?php

namespace App\Http\Requests\Admin;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Exists;

class DefaultWorkspaceUpdateRequest extends FormRequest
{
    /**
     * @return array<string, array<int, ValidationRule|Exists|string>>
     */
    public function rules(): array
    {
        return [
            'default_workspace_id' => ['present', 'nullable', 'uuid', Rule::exists('workspaces', 'id')],
        ];
    }
}
