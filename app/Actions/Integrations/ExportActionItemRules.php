<?php

namespace App\Actions\Integrations;

use Illuminate\Validation\Rule;

/**
 * Target ids end up in provider URL paths, so they are digits (Jira) or a
 * UUID (Linear) and nothing else; GitHub repository ids are digits too.
 */
class ExportActionItemRules
{
    /**
     * @return array<string, array<int, mixed>>
     */
    public static function rules(): array
    {
        return [
            'source' => ['required', 'string', Rule::in(ActionItemExportGuard::Sources)],
            'project_id' => ['exclude_unless:source,jira,jira_dc', 'required', 'string', 'regex:/^\d{1,20}\z/'],
            'issue_type_id' => ['exclude_unless:source,jira,jira_dc', 'required', 'string', 'regex:/^\d{1,20}\z/'],
            'team_id' => ['exclude_unless:source,linear', 'required', 'uuid'],
            'repository_id' => ['exclude_unless:source,github', 'required', 'string', 'regex:/^\d{1,20}\z/'],
        ];
    }
}
