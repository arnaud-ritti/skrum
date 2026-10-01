<?php

namespace App\Actions\Whiteboards;

use App\Models\WhiteboardElement;
use App\Models\WhiteboardMember;

/**
 * The only place an element is turned into a payload. It takes the viewer
 * because private writing (spec §11.5) masks an element per viewer here.
 */
class PresentWhiteboardElement
{
    /**
     * @return array<string, mixed>
     */
    public function handle(WhiteboardElement $element, WhiteboardMember $viewer): array
    {
        return $element->data;
    }
}
