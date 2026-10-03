<?php

namespace App\Actions\Whiteboards;

use App\Models\User;
use App\Models\Whiteboard;

/**
 * @phpstan-import-type Preview from PresentWhiteboardPreview
 */
class PresentWhiteboardSummary
{
    /**
     * @return array{id: string, title: string, updatedAt: ?string, facilitatorName: ?string, canDelete: bool, preview: Preview|null}
     */
    public function handle(Whiteboard $board, User $viewer, bool $viewerManagesWorkspace): array
    {
        return [
            'id' => $board->id,
            'title' => $board->title,
            'updatedAt' => $board->updated_at?->toIso8601String(),
            'facilitatorName' => $board->facilitator?->displayName(),
            'canDelete' => $viewerManagesWorkspace || $board->facilitator?->user_id === $viewer->id,
            'preview' => $board->preview,
        ];
    }
}
