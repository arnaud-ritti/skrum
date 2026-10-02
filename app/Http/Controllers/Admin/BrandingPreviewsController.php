<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\BrandingPreviewRequest;
use App\Support\Branding\BrandPalette;
use App\Support\Branding\BrandPaletteSummary;
use App\Support\Branding\BrandStyle;
use Illuminate\Http\JsonResponse;

class BrandingPreviewsController extends Controller
{
    public function show(BrandingPreviewRequest $request): JsonResponse
    {
        $palette = BrandPalette::derive(
            $request->string('color')->toString(),
            (int) ($request->validated('radius') ?? BrandStyle::DefaultRadiusPx),
        );

        return response()->json([
            ...BrandPaletteSummary::of($palette),
            'css' => $palette->css(),
        ]);
    }
}
