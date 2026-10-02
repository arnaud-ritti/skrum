<?php

namespace App\Support\Avatars;

use App\Support\InertImage;
use DiceBear\Avatar;
use DiceBear\Style;
use Illuminate\Http\Response;

class AvatarSvg
{
    private const string InitialsPattern = '/^[\p{L}\p{N}]{1,2}$/uD';

    public function __construct(private AvatarStyleCatalogue $catalogue) {}

    public function render(string $style, string $seed): ?string
    {
        $path = $this->catalogue->path($style);

        if ($path === null) {
            return null;
        }

        return (string) new Avatar(Style::fromJson((string) file_get_contents($path)), ['seed' => $seed]);
    }

    /**
     * Anything but one or two letters or digits is drawn as an empty tile.
     */
    public function renderInitials(mixed $initials): ?string
    {
        $letters = is_string($initials) && preg_match(self::InitialsPattern, $initials) === 1 ? $initials : ' ';

        return $this->render(AvatarStyleCatalogue::Initials, $letters);
    }

    public function response(string $svg, string $cacheControl): Response
    {
        return response($svg, 200, [
            'Content-Type' => 'image/svg+xml',
            'Cache-Control' => $cacheControl,
            'X-Content-Type-Options' => 'nosniff',
            'Content-Security-Policy' => InertImage::ContentSecurityPolicy,
        ]);
    }
}
