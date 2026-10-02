<?php

namespace App\Http\Controllers;

use App\Support\Branding\BrandAssets;
use Illuminate\Http\Response;

class BrandAssetsController extends Controller
{
    public function show(BrandAssets $assets, string $asset): Response
    {
        $file = $assets->read($asset);

        abort_if($file === null, 404);

        return response($file['contents'], 200, [
            'Content-Type' => $file['mime'],
            'Cache-Control' => 'public, max-age=31536000, immutable',
            'X-Content-Type-Options' => 'nosniff',
            'Content-Security-Policy' => "default-src 'none'; style-src 'unsafe-inline'",
        ]);
    }
}
