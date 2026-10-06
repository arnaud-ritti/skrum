<?php

namespace App\Console\Commands;

use App\Actions\Admin\CheckForUpdate;
use App\Support\InstanceSettings;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;

#[Description('Ask the release feed for the latest Skrüm version, when the admin turned the check on')]
#[Signature('skrum:check-for-update')]
class CheckForUpdateCommand extends Command
{
    public function handle(InstanceSettings $settings, CheckForUpdate $checkForUpdate): int
    {
        if (! $settings->updateCheckEnabled()) {
            $this->comment('The update check is off.');

            return self::SUCCESS;
        }

        $this->info('Asking the release feed…');

        $latest = $checkForUpdate->handle();

        if ($latest === null) {
            Log::warning('The update check got no usable version from the release feed.');
            $this->warn('The release feed gave no usable version.');

            return self::SUCCESS;
        }

        $this->comment("Latest version: {$latest}.");

        return self::SUCCESS;
    }
}
