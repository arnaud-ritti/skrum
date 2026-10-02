<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Support\Avatars\AvatarStyleCatalogue;
use App\Support\InertImage;
use DiceBear\Avatar;
use DiceBear\Style;
use Illuminate\Http\Response;

class AvatarPreviewsController extends Controller
{
    public function show(AvatarStyleCatalogue $catalogue, string $style, string $seed): Response
    {
        abort_unless($catalogue->isSelectable($style), 404);

        $path = $catalogue->path($style);

        abort_if($path === null, 404);

        $definition = Style::fromJson((string) file_get_contents($path));
        $svg = (string) new Avatar($definition, ['seed' => $seed]);

        return response($svg, 200, [
            'Content-Type' => 'image/svg+xml',
            'Cache-Control' => 'private, max-age=86400',
            'X-Content-Type-Options' => 'nosniff',
            'Content-Security-Policy' => InertImage::ContentSecurityPolicy,
        ]);
    }
}
