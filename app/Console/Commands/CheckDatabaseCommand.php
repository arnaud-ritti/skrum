<?php

namespace App\Console\Commands;

use App\Support\Database\DatabaseRequirements;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

#[Description('Check that the database version and the connection settings are ones Skrum supports')]
#[Signature('skrum:check-database {--database= : The connection to check, the default one when omitted}')]
class CheckDatabaseCommand extends Command
{
    public function handle(): int
    {
        $connection = DB::connection($this->option('database'));

        $this->info("Checking the connection {$connection->getName()}, server version {$connection->getServerVersion()}...");

        $problems = DatabaseRequirements::problems($connection);

        foreach ($problems as $problem) {
            $this->error($problem);
        }

        if ($problems !== []) {
            return self::FAILURE;
        }

        $this->comment('The database is ready.');

        return self::SUCCESS;
    }
}
