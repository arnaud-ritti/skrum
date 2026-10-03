<?php

namespace App\Http\Requests\Admin;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UsersIndexRequest extends FormRequest
{
    public const string StatusAll = 'all';

    public const string StatusActive = 'active';

    public const string StatusDeactivated = 'deactivated';

    public const string StatusAdmins = 'admins';

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'query' => ['nullable', 'string', 'max:100'],
            'status' => ['nullable', 'string', Rule::in([self::StatusAll, self::StatusActive, self::StatusDeactivated, self::StatusAdmins])],
        ];
    }

    public function searchTerm(): ?string
    {
        $term = $this->validated('query');

        if (! is_string($term) || trim($term) === '') {
            return null;
        }

        return trim($term);
    }

    public function status(): string
    {
        $status = $this->validated('status');

        return is_string($status) ? $status : self::StatusAll;
    }
}
