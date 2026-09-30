<?php

namespace App\Support\Integrations\Jira;

class JiraCreateFields
{
    /**
     * @param  array<int, array{id: string, name: string}>  $priorities
     */
    public function __construct(
        public bool $hasAssignee,
        public bool $hasPriority,
        public array $priorities,
    ) {}
}
