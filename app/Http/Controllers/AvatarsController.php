<?php

namespace App\Http\Controllers;

use App\Support\Avatars\AvatarSvg;
use App\Support\Avatars\AvatarUrl;
use Illuminate\Http\Response;

class AvatarsController extends Controller
{
    public const string CacheControl = 'public, max-age=31536000, immutable';

    /**
     * This address has no style in it and is cached for a year, so it only ever draws the style of the environment.
     */
    public function show(AvatarUrl $avatarUrl, AvatarSvg $avatarSvg, string $seed): Response
    {
        $svg = $avatarSvg->render($avatarUrl->environmentStyle(), $seed);

        abort_if($svg === null, 404);

        return $avatarSvg->response($svg, self::CacheControl);
    }
}
