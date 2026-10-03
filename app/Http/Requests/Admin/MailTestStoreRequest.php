<?php

namespace App\Http\Requests\Admin;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class MailTestStoreRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('manageInstance') ?? false;
    }

    /**
     * @return array<string, array<int, ValidationRule|string>>
     */
    public function rules(): array
    {
        return [
            'to' => ['required', 'string', 'email', 'max:255'],
        ];
    }

    public function recipient(): string
    {
        return (string) $this->validated('to');
    }
}
