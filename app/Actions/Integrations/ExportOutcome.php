<?php

namespace App\Actions\Integrations;

class ExportOutcome
{
    public function __construct(
        public CreatedIssue $issue,
        public ExportAssignee $assignee,
        public ExportPriority $priority,
    ) {}
}
