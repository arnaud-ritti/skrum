<?php

namespace App\Actions\Whiteboards;

use App\Models\WhiteboardElement;
use App\Models\WhiteboardMember;

/**
 * The only place an element is turned into a payload. A private element
 * (spec §11.5) is real for its author only: everyone else, the facilitator
 * included, gets the note with the `masked` marker and its text emptied.
 * Position, size, colour, version and nonce are the stored ones.
 */
class PresentWhiteboardElement
{
    /**
     * @return array<string, mixed>
     */
    public function handle(WhiteboardElement $element, WhiteboardMember $viewer): array
    {
        if (! $element->is_private || $element->author_member_id === $viewer->id) {
            return $element->data;
        }

        if ($element->type === 'text') {
            return [...$element->data, 'text' => '', 'originalText' => ''];
        }

        return [...$element->data, 'customData' => ['skrum' => ['kind' => 'sticky', 'masked' => true]]];
    }
}
