<?php

namespace App\Http\Requests\Admin;

use App\Enums\AuditAction;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Str;
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
        return $this->validated('group');
    }

    public function actor(): ?string
    {
        return Str::lower($this->validated('actor') ?? '') ?: null;
    }
}
