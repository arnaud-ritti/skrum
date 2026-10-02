<?php

namespace App\Http\Controllers;

use App\Support\Avatars\AvatarStyleCatalogue;
use App\Support\Avatars\AvatarSvg;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

class StyledAvatarsController extends Controller
{
    public function show(Request $request, AvatarStyleCatalogue $catalogue, AvatarSvg $avatarSvg, string $style, string $seed): Response
    {
        abort_unless($catalogue->isSelectable($style), 404);

        $svg = $style === AvatarStyleCatalogue::Initials
            ? $avatarSvg->renderInitials($request->query('n'))
            : $avatarSvg->render($style, $seed);

        abort_if($svg === null, 404);

        return $avatarSvg->response($svg, AvatarsController::CacheControl);
    }
}
