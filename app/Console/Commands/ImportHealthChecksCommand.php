<?php

namespace App\Console\Commands;

use App\Support\Surveys\ImportHealthChecks;
use Illuminate\Console\Command;

class ImportHealthChecksCommand extends Command
{
    protected $signature = 'surveys:import-health-checks';

    protected $description = 'Copy the health checks of before plan 19 into team surveys (adds what is missing, changes nothing else)';

    public function handle(ImportHealthChecks $importHealthChecks): int
    {
        $this->info('Importing health checks…');

        $report = $importHealthChecks->handle();

        $this->comment("Created {$report['surveys']} surveys, {$report['questions']} questions, {$report['respondents']} respondents and {$report['answers']} answers.");
        $this->comment("Left behind {$report['skippedAnswers']} answers to statements outside their retro's set or already answered on five.");

        return self::SUCCESS;
    }
}
