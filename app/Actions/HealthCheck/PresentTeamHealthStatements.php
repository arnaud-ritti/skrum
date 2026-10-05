<?php

namespace App\Actions\HealthCheck;

use App\Models\Team;
use App\Models\TeamHealthStatement;
use Illuminate\Support\Collection;

class PresentTeamHealthStatements
{
    public function __construct(
        private TeamHealthStatements $teamHealthStatements,
    ) {}

    /**
     * Every statement of the team, archived ones included, in its order.
     *
     * @return Collection<int, array{
     *     id: string,
     *     key: string,
     *     label: string,
     *     text: string,
     *     isBuiltin: bool,
     *     isArchived: bool
     * }>
     */
    public function handle(Team $team): Collection
    {
        return $this->teamHealthStatements->all($team)->map(function (TeamHealthStatement $statement): array {
            $builtin = $statement->builtin;

            return [
                'id' => $statement->id ?? $statement->key(),
                'key' => $builtin->value ?? $statement->key(),
                'label' => $builtin?->label() ?? (string) $statement->label,
                'text' => $builtin?->text() ?? (string) $statement->text,
                'isBuiltin' => $builtin !== null,
                'isArchived' => $statement->isArchived(),
            ];
        })->values();
    }
}
