<?php

namespace App\Actions\HealthCheck;

use App\Enums\HealthStatement;
use App\Models\Team;
use App\Models\TeamHealthStatement;
use Illuminate\Support\Collection;

class TeamHealthStatements
{
    /**
     * @return Collection<int, TeamHealthStatement>
     */
    public function all(Team $team): Collection
    {
        $stored = $team->healthStatements()->get();

        if ($stored->isNotEmpty()) {
            return $stored->toBase();
        }

        return $this->defaults();
    }

    /**
     * @return Collection<int, TeamHealthStatement>
     */
    public function active(Team $team): Collection
    {
        return $this->all($team)
            ->reject(fn (TeamHealthStatement $statement): bool => $statement->isArchived())
            ->values();
    }

    /**
     * Unsaved rows standing for a team that never changed its statements.
     *
     * @return Collection<int, TeamHealthStatement>
     */
    public function defaults(): Collection
    {
        return collect(HealthStatement::cases())->map(fn (HealthStatement $statement, int $position): TeamHealthStatement => new TeamHealthStatement([
            'builtin' => $statement,
            'position' => $position,
        ]));
    }
}
