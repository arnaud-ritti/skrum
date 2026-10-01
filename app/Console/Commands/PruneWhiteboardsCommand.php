<?php

namespace App\Console\Commands;

use App\Actions\Whiteboards\PurgeWhiteboardTombstones;
use Illuminate\Console\Command;

class PruneWhiteboardsCommand extends Command
{
    protected $signature = 'skrum:prune-whiteboards';

    protected $description = 'Remove expired whiteboard tombstones and unused images';

    public function handle(PurgeWhiteboardTombstones $purgeWhiteboardTombstones): int
    {
        $this->info('Purging expired tombstones...');

        $tombstones = $purgeWhiteboardTombstones->handle();

        $this->comment("Purged {$tombstones} tombstones.");

        return self::SUCCESS;
    }
}
