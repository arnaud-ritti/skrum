<?php

namespace App\Actions\Retros;

use App\Models\TopicNote;

class PresentTopicNote
{
    /**
     * Who wrote the note is not sent: the notes belong to the room.
     *
     * @return array{
     *     cardId: string,
     *     body: string,
     *     version: int,
     *     updatedAt: ?string
     * }
     */
    public function handle(?TopicNote $note, string $cardId): array
    {
        return [
            'cardId' => $cardId,
            'body' => $note === null ? '' : $note->body,
            'version' => $note === null ? 0 : $note->version,
            'updatedAt' => $note?->updated_at?->toIso8601String(),
        ];
    }
}
