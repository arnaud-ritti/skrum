<?php

namespace App\Actions\Whiteboards;

use App\Models\Whiteboard;

class PresentWhiteboardSummary
{
    /**
     * @return array{id: string, title: string, updatedAt: ?string, facilitatorName: ?string}
     */
    public function handle(Whiteboard $board): array
    {
        return [
            'id' => $board->id,
            'title' => $board->title,
            'updatedAt' => $board->updated_at?->toIso8601String(),
            'facilitatorName' => $board->facilitator?->displayName(),
        ];
    }
}
