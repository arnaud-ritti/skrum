<?php

namespace App\Http\Requests\Admin;

use App\Enums\AuditAction;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class AuditEventsIndexRequest extends FormRequest
{
    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'group' => ['nullable', 'string', Rule::in(AuditAction::groups())],
            'actor' => ['nullable', 'string', 'uuid'],
        ];
    }

    public function group(): ?string
    {
        $group = $this->validated('group');

        return is_string($group) ? $group : null;
    }

    public function actor(): ?string
    {
        $actor = $this->validated('actor');

        return is_string($actor) ? strtolower($actor) : null;
    }
}
