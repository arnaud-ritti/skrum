<?php

namespace App\Actions\Teams;

use App\Jobs\RefreshWhiteboardPreview;
use App\Models\Whiteboard;

class RefreshStaleWhiteboardPreviews
{
    /**
     * Boards whose thumbnail is older than their content, boards of before the release
     * included, get one built by the queue.
     *
     * @param  iterable<Whiteboard>  $boards
     */
    public function handle(iterable $boards): void
    {
        foreach ($boards as $board) {
            if ($board->preview_seq === $board->seq) {
                continue;
            }

            RefreshWhiteboardPreview::dispatch($board->id);
        }
    }
}
