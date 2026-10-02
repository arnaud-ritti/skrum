<?php

namespace App\Http\Controllers;

use App\Support\Branding\BrandAssets;
use App\Support\InertImage;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

class BrandAssetsController extends Controller
{
    private const string VersionedCacheControl = 'public, max-age=31536000, immutable';

    private const string UnversionedCacheControl = 'no-cache';

    /**
     * Only the address that names the current file is cached for a year: any other one is revalidated on each use.
     */
    public function show(Request $request, BrandAssets $assets, string $asset): Response
    {
        $file = $assets->read($asset);

        abort_if($file === null, 404);

        $version = $request->query('v');
        $isCurrentVersion = is_string($version) && hash_equals($file['version'], $version);

        return response($file['contents'], 200, [
            'Content-Type' => $file['mime'],
            'Cache-Control' => $isCurrentVersion ? self::VersionedCacheControl : self::UnversionedCacheControl,
            'X-Content-Type-Options' => 'nosniff',
            'Content-Security-Policy' => InertImage::ContentSecurityPolicy,
        ]);
    }
}
