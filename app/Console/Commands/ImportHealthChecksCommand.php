<?php

namespace App\Console\Commands;

use App\Support\Surveys\ImportHealthChecks;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;

#[Description('Copy the health checks of before plan 19 into team surveys (adds what is missing, changes nothing else)')]
#[Signature('surveys:import-health-checks')]
class ImportHealthChecksCommand extends Command
{
    public function handle(ImportHealthChecks $importHealthChecks): int
    {
        $this->info('Importing health checks…');

        $report = $importHealthChecks->handle();

        $this->comment("Created {$report['surveys']} surveys, {$report['questions']} questions, {$report['respondents']} respondents and {$report['answers']} answers.");
        $this->comment("Left behind {$report['skippedAnswers']} answers to statements outside their retro's set or already answered on five.");

        return self::SUCCESS;
    }
}
