<?php

namespace App\Http\Controllers;

use App\Support\Avatars\AvatarPhotos;
use App\Support\InertImage;
use Illuminate\Http\Response;

class AvatarPhotosController extends Controller
{
    /**
     * The name changes with every upload, so the address is cached for good.
     */
    public function show(AvatarPhotos $photos, string $file): Response
    {
        $photo = $photos->read($file);

        abort_if($photo === null, 404);

        return response($photo['contents'], 200, [
            'Content-Type' => $photo['mime'],
            'Cache-Control' => AvatarsController::CacheControl,
            'X-Content-Type-Options' => 'nosniff',
            'Content-Security-Policy' => InertImage::ContentSecurityPolicy,
        ]);
    }
}
