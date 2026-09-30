<?php

namespace App\Actions\HealthCheck;

use App\Models\Retro;

class FreezeHealthStatements
{
    public function __construct(private TeamHealthStatements $teamHealthStatements) {}

    /**
     * Answers refer to the frozen keys, so a set that has answers is never replaced.
     */
    public function handle(Retro $retro): void
    {
        if ($retro->healthCheckAnswers()->exists()) {
            return;
        }

        $retro->healthStatements()->delete();

        foreach ($this->teamHealthStatements->active($retro->team) as $position => $statement) {
            $retro->healthStatements()->create([
                'key' => $statement->key(),
                'team_health_statement_id' => $statement->id,
                'builtin' => $statement->builtin,
                'text' => $statement->text,
                'label' => $statement->label,
                'position' => $position,
            ]);
        }
    }
}
