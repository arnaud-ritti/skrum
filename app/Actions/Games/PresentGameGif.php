<?php

namespace App\Actions\Games;

class PresentGameGif
{
    /**
     * @return array{id: string, previewUrl: string, url: string}
     */
    public function handle(string $gifId): array
    {
        return [
            'id' => $gifId,
            'previewUrl' => route('gifs.show', ['gif' => $gifId, 'size' => 'preview'], false),
            'url' => route('gifs.show', ['gif' => $gifId, 'size' => 'full'], false),
        ];
    }
}
