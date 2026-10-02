<?php

namespace App\Actions\HealthCheck;

use App\Models\Team;
use App\Models\TeamHealthStatement;
use Illuminate\Support\Collection;

class PresentTeamHealthStatements
{
    public function __construct(
        private TeamHealthStatements $teamHealthStatements,
        private PresentHealthStatement $presentHealthStatement,
    ) {}

    /**
     * Every statement of the team, archived ones included, in its order.
     *
     * @return Collection<int, array<string, mixed>>
     */
    public function handle(Team $team): Collection
    {
        return $this->teamHealthStatements->all($team)->map(fn (TeamHealthStatement $statement): array => [
            'id' => $statement->id ?? $statement->key(),
            ...$this->presentHealthStatement->handle($statement),
            'isArchived' => $statement->isArchived(),
        ])->values();
    }
}
