<?php

namespace App\Actions\Whiteboards;

use App\Models\WhiteboardVersion;

/**
 * The elements a version may show: all of them but those that were private
 * when it was stored and that no reveal has shown since (spec §9). They
 * carry real text, so every caller checks `notPrivateWriting` first.
 */
class ReadWhiteboardVersion
{
    /**
     * @return list<array<string, mixed>>
     */
    public function handle(WhiteboardVersion $version): array
    {
        $neverRevealed = array_flip($version->private_element_ids);

        return array_values(array_filter(
            $version->scene['elements'],
            fn (array $element): bool => ! isset($neverRevealed[$element['id']]),
        ));
    }
}
