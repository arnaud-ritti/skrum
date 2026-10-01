<?php

namespace App\Actions\Whiteboards;

use App\Models\WhiteboardVersion;

/**
 * A version as the history panel lists it: never its scene.
 *
 * @phpstan-type VersionSummary array{id: string, name: ?string, createdAt: string, createdByName: ?string, automatic: bool}
 */
class PresentWhiteboardVersion
{
    /**
     * @return VersionSummary
     */
    public function handle(WhiteboardVersion $version): array
    {
        return [
            'id' => $version->id,
            'name' => $version->name,
            'createdAt' => $version->created_at->toIso8601String(),
            'createdByName' => $version->createdBy?->displayName(),
            'automatic' => $version->isAutomatic(),
        ];
    }
}
