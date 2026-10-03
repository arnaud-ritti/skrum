<?php

namespace App\Http\Requests;

use App\Actions\Teams\RequestTeamAccess;
use Illuminate\Foundation\Http\FormRequest;

class TeamAccessRequestStoreRequest extends FormRequest
{
    /**
     * @return array<string, array<int, mixed>>
     */
    public function rules(): array
    {
        return [
            'message' => ['nullable', 'string', 'max:'.RequestTeamAccess::MaxMessageLength],
        ];
    }
}
