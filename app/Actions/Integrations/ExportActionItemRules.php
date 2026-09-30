<?php

namespace App\Actions\Integrations;

use App\Enums\IntegrationProvider;
use Illuminate\Validation\Rule;

/**
 * Target ids end up in provider URL paths, so they are digits (Jira) or a
 * UUID (Linear) and nothing else.
 */
class ExportActionItemRules
{
    /**
     * @return array<string, array<int, mixed>>
     */
    public static function rules(): array
    {
        return [
            'source' => ['required', 'string', Rule::in([IntegrationProvider::Jira->value, IntegrationProvider::Linear->value])],
            'project_id' => ['exclude_unless:source,jira', 'required', 'string', 'regex:/^\d{1,20}\z/'],
            'issue_type_id' => ['exclude_unless:source,jira', 'required', 'string', 'regex:/^\d{1,20}\z/'],
            'team_id' => ['exclude_unless:source,linear', 'required', 'uuid'],
        ];
    }
}
