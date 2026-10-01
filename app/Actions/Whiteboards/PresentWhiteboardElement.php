<?php

namespace App\Actions\Whiteboards;

use App\Models\WhiteboardElement;

/**
 * The only place an element is turned into a payload (spec §6.2).
 */
class PresentWhiteboardElement
{
    /**
     * @return array<string, mixed>
     */
    public function handle(WhiteboardElement $element): array
    {
        return $element->data;
    }
}
