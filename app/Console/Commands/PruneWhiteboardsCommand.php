<?php

namespace App\Console\Commands;

use App\Actions\Whiteboards\PruneWhiteboardFiles;
use App\Actions\Whiteboards\PurgeWhiteboardTombstones;
use App\Actions\Whiteboards\QueueMissedWhiteboardVersions;
use Illuminate\Console\Command;

class PruneWhiteboardsCommand extends Command
{
    protected $signature = 'skrum:prune-whiteboards';

    protected $description = 'Remove expired whiteboard tombstones and unused images, and queue missed versions';

    public function handle(
        PurgeWhiteboardTombstones $purgeWhiteboardTombstones,
        PruneWhiteboardFiles $pruneWhiteboardFiles,
        QueueMissedWhiteboardVersions $queueMissedWhiteboardVersions,
    ): int {
        $this->info('Purging expired tombstones...');

        $tombstones = $purgeWhiteboardTombstones->handle();

        $this->comment("Purged {$tombstones} tombstones.");

        $this->info('Pruning unused images...');

        $files = $pruneWhiteboardFiles->handle();

        $this->comment("Pruned {$files} images.");

        $this->info('Queuing missed versions...');

        $versions = $queueMissedWhiteboardVersions->handle();

        $this->comment("Queued {$versions} versions.");

        return self::SUCCESS;
    }
}
