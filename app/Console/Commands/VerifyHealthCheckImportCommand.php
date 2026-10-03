<?php

namespace App\Console\Commands;

use App\Support\Surveys\VerifyHealthCheckImport;
use Illuminate\Console\Command;

class VerifyHealthCheckImportCommand extends Command
{
    protected $signature = 'surveys:verify-health-import';

    protected $description = 'Compare the copied health-check answers with the old tables. Run it right after the upgrade, before new answers are given.';

    public function handle(VerifyHealthCheckImport $verifyHealthCheckImport): int
    {
        $this->info('Comparing old and copied health-check answers…');

        $differences = $verifyHealthCheckImport->handle();

        if ($differences === []) {
            $this->comment('All ok: every retro has the same answers on both sides.');

            return self::SUCCESS;
        }

        $this->table(['Retro', 'Title', 'Old answers', 'Copied', 'Old sum', 'Copied sum'], array_map('array_values', $differences));
        $this->error(count($differences).' retros differ.');

        return self::FAILURE;
    }
}
