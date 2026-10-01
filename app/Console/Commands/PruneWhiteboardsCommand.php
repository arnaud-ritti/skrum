<?php

namespace App\Console\Commands;

use App\Actions\Whiteboards\PruneWhiteboardFiles;
use App\Actions\Whiteboards\PurgeWhiteboardTombstones;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;

#[Description('Remove expired whiteboard tombstones and unused images')]
#[Signature('skrum:prune-whiteboards')]
class PruneWhiteboardsCommand extends Command
{
    public function handle(
        PurgeWhiteboardTombstones $purgeWhiteboardTombstones,
        PruneWhiteboardFiles $pruneWhiteboardFiles,
    ): int {
        $this->info('Purging expired tombstones...');

        $tombstones = $purgeWhiteboardTombstones->handle();

        $this->comment("Purged {$tombstones} tombstones.");

        $this->info('Pruning unused images...');

        $files = $pruneWhiteboardFiles->handle();

        $this->comment("Pruned {$files} images.");

        return self::SUCCESS;
    }
}
