<?php

namespace App\Actions\Retros;

use App\Models\Retro;
use App\Support\Gifs\Gif;
use App\Support\Gifs\GifCatalog;
use Illuminate\Validation\ValidationException;

class EnsureCardGif
{
    public function __construct(private GifCatalog $gifCatalog) {}

    public function handle(Retro $retro, ?string $gifId): void
    {
        if ($gifId === null) {
            return;
        }

        RetroGuard::gifsEnabled($retro, $this->gifCatalog);

        $gif = $this->gifCatalog->attempt(
            fn (): ?Gif => $this->gifCatalog->resolve($gifId),
            __('GIF search is unavailable.'),
        );

        if ($gif === null) {
            throw ValidationException::withMessages(['gif_id' => __('This GIF could not be found.')]);
        }
    }
}
